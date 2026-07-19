
let layoutBootTimer = null;
let cachedSessionUser = null;

async function initVortex07() {
  logDebug("Starting Vortex07", VORTEX07_VERSION);

  lastKnownPathname = safeString(window.location.pathname);

  await loadKnownBoosterIds();
  preloadBadgeAssets();

  const data = await storageGet("sync", { vortex07Settings: defaultSettings });
  currentSettings = normalizeSettings(data.vortex07Settings);
  logDebug("Loaded settings:", currentSettings);

  const enabled = Boolean(currentSettings.enabled);

  document.documentElement.classList.toggle("vortex07-active", enabled);
  applyThemePreferences(currentSettings);
  await syncThemeStylesheet(enabled);

  if (!enabled) {
    revealBody();
    logCritical(
      "Vortex07 is OFF in the popup — enable it to restore the 2007 shell, search, and reputation.",
    );
    return;
  }

  if (shouldDeferExtensionWork()) return;

  cleanupLegacyAuthPageDom();
  startHoverLoop();
  startObserver();
  startProfileBadgeObserver();
  startLayoutBootRetry();

  void syncPendingReputationVotes().catch((err) => {
    logRepFailureOnce("Pending rep sync on init failed:", err);
  });
}

function startLayoutBootRetry() {
  if (layoutBootTimer) return;

  let attempts = 0;
  const maxAttempts = 45;

  const tick = () => {
    if (!currentSettings.enabled || is2007Applied) {
      layoutBootTimer = null;
      return;
    }

    if (shouldDeferExtensionWork()) {
      layoutBootTimer = null;
      revealBody();
      return;
    }

    attempts += 1;
    build2007Layout();

    if (is2007Applied) {
      layoutBootTimer = null;
      logDebug("Layout boot succeeded on attempt", attempts);
      return;
    }

    if (attempts >= maxAttempts) {
      layoutBootTimer = null;
      logCritical(
        "Layout shell delayed — running search, rep, and layout fixes in fallback mode.",
      );
      bootstrapFeaturesWithoutShell();
      return;
    }

    layoutBootTimer = setTimeout(tick, 1000);
  };

  tick();
}

if (globalThis.Vortex07Ext?.onStorageChanged) {
  try {
    globalThis.Vortex07Ext.onStorageChanged((changes, namespace) => {
      if (!isExtensionContextAlive()) return;
      if (namespace !== "sync" || !changes.vortex07Settings) return;

    const oldSettings = currentSettings;
    const newSettings = normalizeSettings(changes.vortex07Settings.newValue);

    currentSettings = newSettings;

    logDebug("Settings changed:", currentSettings);

    const enabledChanged = oldSettings.enabled !== newSettings.enabled;
    const navChanged = oldSettings.customNav !== newSettings.customNav;
    const themeChanged = oldSettings.darkMode !== newSettings.darkMode;

    if (enabledChanged || navChanged) {
      location.reload();
      return;
    }

    if (themeChanged) {
      applyThemePreferences(newSettings);
    }

    if (oldSettings.iconCache !== newSettings.iconCache) {
      extensionAssetUrlCache.clear();
    }

    updateFooterState();
    updateRetroButtonState();

    if (oldSettings.friendRowCarousels !== newSettings.friendRowCarousels) {
      if (newSettings.friendRowCarousels) enhanceFriendsCarousels();
      else removeFriendCarousels();
    }

    if (currentSettings.userSearch) ensureSearchSystem();
    else removeUserSearch();

    ensureVertexWallet();

    const forumChanged = oldSettings.showForum !== newSettings.showForum;
    if (forumChanged) {
      const navActions = document.querySelector(
        "#Container .Navigation .navbar-actions",
      );
      injectVortex07ExtensionNavs(navActions);
      syncVortex07ExtensionVisibility();
    }
  });
  } catch (err) {
    if (isContextInvalidatedError(err)) shutdownStaleContentScript("storage.onChanged");
  }
}

function cloneShellNavActions(navActions) {
  if (!navActions) return null;

  const clone = navActions.cloneNode(true);
  clone.classList.add("vortex07-nav-actions-clone");

  clone.querySelectorAll("#my-profile-btn").forEach((el) => {
    el.dataset.vortex07Nav = "profile";
    el.textContent = "My Vortex";
  });

  clone.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
  return clone;
}

function hideNativeChrome(navbar, siteFooter) {
  if (navbar) {
    navbar.classList.add("vortex07-native-navbar-hidden");
    navbar.style.cssText =
      "position:absolute!important;left:-9999px!important;top:0!important;width:1px!important;height:1px!important;overflow:hidden!important;opacity:0!important;pointer-events:none!important;";
  }

  if (siteFooter) siteFooter.style.display = "none";
}
function isAuthPage() {
  const path = safeString(window.location.pathname).toLowerCase();
  if (/\/(login|signin|signup|register|logout)(\/|$)/.test(path)) return true;
  if (document.getElementById("Container")) return false;
  if (
    document.querySelector(
      ".games-section, .games-grid, .friends-section, .profile-header, .catalog-container, .game-detail",
    )
  ) {
    return false;
  }
  const wrap = document.querySelector(".wrap");
  return Boolean(wrap?.querySelector("input[type='password']"));
}

function findLayoutParts() {
  if (isAuthPage()) {
    return {
      navbar: null,
      navActions: null,
      logoLink: null,
      siteFooter: null,
      mainContent: null,
    };
  }

  const mainContent =
    document.querySelector(".page") ||
    document.querySelector(".catalog-container") ||
    document.querySelector("main.home") ||
    document.querySelector("main");

  return {
    navbar: document.querySelector(".navbar"),
    navActions: document.querySelector(".navbar-actions"),
    logoLink: document.querySelector(".navbar-logo"),
    siteFooter: document.querySelector(".site-footer"),
    mainContent,
  };
}

function build2007Layout() {
  if (is2007Applied || !currentSettings.enabled || shouldDeferExtensionWork()) return;

  if (isAuthPage()) {
    enhanceAuthPageChrome();
    revealBody();
    return;
  }

  if (document.getElementById("Container")) {
    is2007Applied = true;
    bodyContainer = document.getElementById("Body");
    revealBody();
    ensureSearchSystem();
    ensureVertexWallet();
    injectReputationWidget();
    injectGameRatingWidget();
    scheduleGlobalRepBadges();
    runThrottledLayoutEnhancements();
    wireShellNavControls(document.querySelector(".navbar .navbar-actions"));
    ensureShellLogo();
    refreshShellAuthBanner();
    markActiveNavTab();
    if (!layoutGuardStarted) startLayoutGuard();
    if (!window.__vortex07SettingsRouting) startVortex07SettingsRouting();
    syncVortex07SettingsVisibility();
    syncAttackModeBanner();
    return;
  }

  let { navbar, navActions, logoLink, siteFooter, mainContent } =
    findLayoutParts();

  if (window.location.pathname === "/download" && !mainContent) {
    const dlContent = document.querySelectorAll(
      ".dl-hero, .dl-cards, .dl-footer-note",
    );
    if (dlContent.length > 0) {
      mainContent = document.createElement("div");
      mainContent.className = "page";
      dlContent.forEach((el) => mainContent.appendChild(el));
    }
  }

  if (!mainContent) {
    const authWrap =
      document.querySelector(".wrap") &&
      !document.querySelector(".navbar, .page, .catalog-container, main");
    if (authWrap) {
      enhanceAuthPageChrome();
      revealBody();
    }
    return;
  }

  if (!document.body) return;

  let signOutLink = null;
  let shellNavActions = cloneShellNavActions(navActions);

  if (shellNavActions && currentSettings.customNav) {
    signOutLink = rebuildNavigation(shellNavActions);
  } else if (shellNavActions) {
    const split = splitNavActions(shellNavActions);
    signOutLink = split.signOutLink;
    shellNavActions.textContent = "";
    split.navItems.forEach((link) => shellNavActions.appendChild(link));
    softenNavigation(shellNavActions);
  }

  const container = document.createElement("div");
  container.id = "Container";

  const header = createHeader();
  mountSignOutLink(signOutLink, header.authSlot);
  clearElement(header.logoSlot);
  applyBrandLogo(header.logoSlot);
  if (shellNavActions) header.navigationSlot.appendChild(shellNavActions);

  container.appendChild(header.headerEl);
  ensureSearchSystem();

  bodyContainer = document.createElement("div");
  bodyContainer.id = "Body";
  bodyContainer.appendChild(mainContent);
  container.appendChild(bodyContainer);

  if (currentSettings.classicFooter)
    container.appendChild(createClassicFooter());

  document.body.insertBefore(container, document.body.firstChild);

  is2007Applied = true;
  revealBody();

  hideNativeChrome(navbar, siteFooter);
  wireShellNavControls(navActions);
  refreshShellAuthBanner();
  markActiveNavTab();

  updateRetroButtonState();
  enhanceLegacyStatusLabels();
  flattenCarousels();
  enhanceFriendsCarousels();
  compressHeroSections();
  normalizeFriendTiles();
  normalizeProfileLayout();
  normalizeAvatarImages();
  normalizeOnlineIndicators();
  syncPageRouteClasses();
  enhanceSurfaceChrome();
  enhanceRetroBadges();
  injectReputationWidget();
  injectGameRatingWidget();
  scheduleGlobalRepBadges();
  ensureSearchSystem();
  ensureVertexWallet();
  startLayoutGuard();
  startVortex07SettingsRouting();
  syncVortex07SettingsVisibility();

  logDebug("2007 layout applied");
}

function isSignOutNavItem(el) {
  if (!el) return false;
  const text = safeLower(el.textContent);
  const href = safeLower(el.getAttribute?.("href") || "");
  return (
    text.includes("sign out") ||
    text.includes("signout") ||
    text.includes("log out") ||
    href.includes("/logout") ||
    href.includes("signout")
  );
}

function splitNavActions(navActions) {
  const navItems = [];
  let signOutLink = null;

  if (!navActions) return { navItems, signOutLink };

  Array.from(navActions.children).forEach((link) => {
    if (!link || !link.tagName) return;
    if (link.classList?.contains("Separator")) return;
    if (isSignOutNavItem(link)) {
      signOutLink = link;
      return;
    }
    navItems.push(link);
  });

  return { navItems, signOutLink };
}

function mountSignOutLink(signOutLink, authSlot) {
  if (!signOutLink || !authSlot) return;

  signOutLink.classList.add("vortex07-signout-link");
  authSlot.appendChild(signOutLink);
}

function findShellNavControl(kind) {
  const candidates = document.querySelectorAll(
    "#Container .Navigation a, #Container .Navigation button, #Authentication a, #Authentication button",
  );

  for (const el of candidates) {
    const text = safeLower(el.textContent);
    if (
      kind === "profile" &&
      (el.dataset.vortex07Nav === "profile" ||
        text.includes("my vortex") ||
        text.includes("profile"))
    ) {
      return el;
    }
    if (kind === "logout" && isSignOutNavItem(el)) return el;
  }

  return null;
}

async function fallbackNavigateToProfile() {
  try {
    const res = await fetchWithResilience(`${VORTEX_ORIGIN}/me`, {
      circuit: "playvortex",
      method: "GET",
      timeoutMs: API_TIMEOUT_MS,
      credentials: "include",
      force: true,
    });
    if (!res.ok) return;
    const data = await res.json();
    const id = data?.id ?? data?.userId ?? data?.user?.id;
    if (id) window.location.assign(`/users/${id}/profile`);
  } catch (err) {
    logError("Profile navigation fallback failed", err);
  }
}

function wireNavControlForward(shellEl, nativeEl, fallback) {
  if (!shellEl) return;

  const nativeKey =
    nativeEl?.id ||
    nativeEl?.getAttribute?.("href") ||
    safeLower(nativeEl?.textContent);

  if (shellEl.dataset.vortex07NavForward === nativeKey && nativeKey) return;
  if (shellEl.dataset.vortex07NavForward === "fallback" && !nativeEl) return;

  shellEl.dataset.vortex07NavForward = nativeKey || "fallback";

  shellEl.addEventListener(
    "click",
    (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (nativeEl) {
        nativeEl.click();
        return;
      }

      if (typeof fallback === "function") fallback();
    },
    true,
  );
}

function wireShellNavControls(nativeNavActions) {
  if (!nativeNavActions || !document.getElementById("Container")) return;

  const nativeProfile = nativeNavActions.querySelector("#my-profile-btn");
  const nativeLogout = nativeNavActions.querySelector("#logout-btn");

  const shellProfile = findShellNavControl("profile");
  const shellLogout =
    document.querySelector("#Authentication .vortex07-signout-link") ||
    findShellNavControl("logout");

  if (shellProfile) {
    shellProfile.dataset.vortex07Nav = "profile";
    if (safeLower(shellProfile.textContent) !== "my vortex") {
      shellProfile.textContent = "My Vortex";
    }
  }

  wireNavControlForward(shellProfile, nativeProfile, fallbackNavigateToProfile);
  wireNavControlForward(shellLogout, nativeLogout);
}

function rebuildNavigation(navActions) {
  const { navItems, signOutLink } = splitNavActions(navActions);

  navItems.forEach((link) => {
    if (link.tagName === "A" || link.tagName === "BUTTON") {
      link.className = "MenuItem vortex07-nav-tab";
    }
  });

  navActions.textContent = "";
  navActions.classList.add("vortex07-nav-actions");
  navActions.classList.remove("vortex07-nav-split");

  navItems.forEach((link) => navActions.appendChild(link));
  injectVortex07ExtensionNavs(navActions);
  return signOutLink;
}

function injectVortex07ExtensionNavs(navActions) {
  injectVortex07ForumNav(navActions);
  injectVortex07SettingsNav(navActions);
}

function injectVortex07ForumNav(navActions) {
  if (!navActions) return;

  const existing = navActions.querySelector('[data-vortex07-nav="community-forum"]');
  const showForum = currentSettings.enabled && currentSettings.showForum;

  if (!showForum) {
    existing?.remove();
    if (window.location.hash === VORTEX07_FORUM_HASH) {
      history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}`,
      );
      hideVortex07ForumPage();
    }
    return;
  }

  if (existing) {
    existing.textContent = "Forum";
    existing.title = "Forum";
    return;
  }

  const link = document.createElement("a");
  link.href = `/home${VORTEX07_FORUM_HASH}`;
  link.className = "MenuItem vortex07-nav-tab vortex07-forum-tab";
  link.dataset.vortex07Nav = "community-forum";
  link.textContent = "Forum";
  link.title = "Forum";

  link.addEventListener(
    "click",
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      openVortex07ForumPage();
    },
    true,
  );

  const settingsTab = navActions.querySelector(
    '[data-vortex07-nav="extension-settings"]',
  );
  if (settingsTab) navActions.insertBefore(link, settingsTab);
  else navActions.appendChild(link);
}

function injectVortex07SettingsNav(navActions) {
  if (!navActions || navActions.querySelector('[data-vortex07-nav="extension-settings"]')) {
    return;
  }

  const link = document.createElement("a");
  link.href = `/home${VORTEX07_SETTINGS_HASH}`;
  link.className = "MenuItem vortex07-nav-tab";
  link.dataset.vortex07Nav = "extension-settings";
  link.textContent = "Vortex07";
  link.title = "Vortex07 Settings";

  link.addEventListener(
    "click",
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      openVortex07SettingsPage();
    },
    true,
  );

  navActions.appendChild(link);
}

function openVortex07SettingsPage() {
  const base = `${window.location.pathname}${window.location.search}`;
  if (window.location.hash !== VORTEX07_SETTINGS_HASH) {
    history.pushState({ vortex07Settings: true }, "", `${base}${VORTEX07_SETTINGS_HASH}`);
  }
  showVortex07SettingsPage();
}

function hideVortex07ExtensionPages(exceptClass = "") {
  document
    .querySelectorAll(".vortex07-settings-page, .vortex07-forum-page")
    .forEach((page) => {
      if (exceptClass && page.classList.contains(exceptClass)) return;
      page.hidden = true;
    });

  document
    .querySelectorAll("[data-vortex07-hidden-for-extension]")
    .forEach((el) => {
      el.hidden = false;
      delete el.dataset.vortex07HiddenForExtension;
    });
}

function hideMainPagesForExtensionPage(activePage) {
  const body = document.getElementById("Body");
  if (!body || !activePage) return;

  body
    .querySelectorAll(":scope > .page, :scope > .catalog-container, :scope > main")
    .forEach((el) => {
      if (
        el === activePage ||
        el.classList.contains("vortex07-settings-page") ||
        el.classList.contains("vortex07-forum-page")
      ) {
        return;
      }
      el.dataset.vortex07HiddenForExtension = "1";
      el.hidden = true;
    });
}

function hideVortex07ForumPage() {
  const page = document.querySelector(".vortex07-forum-page");
  if (page) page.hidden = true;
}

function showVortex07ForumPage() {
  if (!currentSettings.enabled || !currentSettings.showForum) {
    hideVortex07ForumPage();
    return;
  }

  const body = document.getElementById("Body");
  if (!body || !globalThis.Vortex07ForumUi) return;

  hideVortex07ExtensionPages("vortex07-forum-page");

  let page = body.querySelector(".vortex07-forum-page");
  if (!page) {
    page = document.createElement("div");
    page.className = "vortex07-forum-page page";
    body.appendChild(page);
    Vortex07ForumUi.mountForumPage(page, VORTEX07_VERSION, VORTEX07_FORUM_API);
  } else if (page.hidden) {
    Vortex07ForumUi.renderForum(page);
  }

  hideMainPagesForExtensionPage(page);
  page.hidden = false;
  markActiveNavTab();
}

function openVortex07ForumPage() {
  if (!currentSettings.enabled || !currentSettings.showForum) return;

  const base = `${window.location.pathname}${window.location.search}`;
  if (window.location.hash !== VORTEX07_FORUM_HASH) {
    history.pushState({ vortex07Forum: true }, "", `${base}${VORTEX07_FORUM_HASH}`);
  }
  showVortex07ForumPage();
}

function hideVortex07SettingsPage() {
  const page = document.querySelector(".vortex07-settings-page");
  if (page) page.hidden = true;
}

function showVortex07SettingsPage() {
  const body = document.getElementById("Body");
  if (!body || !globalThis.Vortex07SettingsUi) return;

  hideVortex07ExtensionPages("vortex07-settings-page");

  let page = body.querySelector(".vortex07-settings-page");
  if (!page) {
    page = document.createElement("div");
    page.className = "vortex07-settings-page page";
    body.appendChild(page);
    Vortex07SettingsUi.mountSettingsPage(page, VORTEX07_VERSION);
  } else {
    Vortex07SettingsUi.ensureSettingsPageReady(page, VORTEX07_VERSION);
  }

  hideMainPagesForExtensionPage(page);
  page.hidden = false;
  markActiveNavTab();
}

function syncVortex07ExtensionVisibility() {
  const hash = window.location.hash;

  if (hash === VORTEX07_FORUM_HASH) {
    if (!currentSettings.enabled || !currentSettings.showForum) {
      hideVortex07ForumPage();
      return;
    }
    showVortex07ForumPage();
    return;
  }

  hideVortex07ForumPage();

  if (hash === VORTEX07_SETTINGS_HASH) {
    showVortex07SettingsPage();
    return;
  }

  hideVortex07SettingsPage();
}

function syncVortex07SettingsVisibility() {
  syncVortex07ExtensionVisibility();
}

function startVortex07SettingsRouting() {
  if (window.__vortex07SettingsRouting) return;
  window.__vortex07SettingsRouting = true;

  window.addEventListener("hashchange", syncVortex07ExtensionVisibility);
  window.addEventListener("popstate", syncVortex07ExtensionVisibility);

  document.addEventListener(
    "click",
    (event) => {
      if (
        event.target.closest(
          '[data-vortex07-nav="extension-settings"], [data-vortex07-nav="community-forum"]',
        )
      ) {
        return;
      }
      if (!event.target.closest("#Container .Navigation a, #Container .Navigation button")) {
        return;
      }
      const hash = window.location.hash;
      if (
        hash !== VORTEX07_SETTINGS_HASH &&
        hash !== VORTEX07_FORUM_HASH
      ) {
        return;
      }
      history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
      syncVortex07ExtensionVisibility();
    },
    true,
  );
}

function softenNavigation(navActions) {
  navActions.classList.remove("vortex07-nav-actions");

  Array.from(navActions.children).forEach((link, index) => {
    if (
      index > 0 &&
      !link.previousElementSibling?.classList?.contains("Separator")
    ) {
      const sep = document.createElement("span");
      sep.className = "Separator";
      sep.textContent = " | ";
      navActions.insertBefore(sep, link);
    }

    if (link.tagName === "A" || link.tagName === "BUTTON") {
      link.className = "MenuItem";
    }
  });

  injectVortex07ExtensionNavs(navActions);
}

function isNativeUserLoggedIn() {
  return Boolean(
    document.querySelector(
      ".navbar #logout-btn, .navbar .btn-signout-sm, .navbar-actions .btn-signout-sm",
    ),
  );
}

function getSessionUserFromNav() {
  const profileBtn = document.querySelector(
    ".navbar #my-profile-btn, .navbar-actions a[href*='/profile']",
  );
  if (!profileBtn && !isNativeUserLoggedIn()) return null;

  const href = profileBtn?.getAttribute("href") || "";
  const id = extractUserIdFromHref(href);
  let username = safeString(profileBtn?.textContent).trim();

  if (!username || /^(profile|my vortex)$/i.test(username)) {
    if (cachedSessionUser?.username && cachedSessionUser.id === id) {
      username = cachedSessionUser.username;
    } else if (id !== null) {
      return {
        username: null,
        id,
        href: href || `/users/${id}/profile`,
        needsUsername: true,
      };
    } else if (isNativeUserLoggedIn()) {
      return { username: null, id: null, href: "/home", needsUsername: true };
    } else {
      return null;
    }
  }

  if (!href && id === null) return null;

  return {
    username,
    id,
    href: href || (id !== null ? `/users/${id}/profile` : "/"),
    needsUsername: false,
  };
}

async function fetchSessionUser() {
  if (cachedSessionUser?.username) return cachedSessionUser;

  const now = Date.now();
  if (now - lastSessionFetchAt < SESSION_FETCH_MIN_INTERVAL_MS) return null;
  if (!isSessionApiAvailable()) return null;
  if (sessionUserFetchInFlight) return sessionUserFetchInFlight;

  lastSessionFetchAt = now;
  sessionUserFetchInFlight = (async () => {
    try {
      const res = await fetchWithResilience(`${VORTEX_ORIGIN}/me`, {
        circuit: "playvortex",
        method: "GET",
        timeoutMs: API_TIMEOUT_MS,
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 429 || res.status >= 500) markSessionApiFailure(res.status);
        return null;
      }

      const data = await res.json();
      const username =
        data?.username ?? data?.user?.username ?? data?.name ?? data?.user?.name;
      const id = data?.id ?? data?.userId ?? data?.user?.id;

      if (!username) return null;

      cachedSessionUser = {
        username: safeString(username),
        id: safeNumber(id),
        href: id !== null ? `/users/${id}/profile` : "/",
        needsUsername: false,
      };
      return cachedSessionUser;
    } catch {
      return null;
    } finally {
      sessionUserFetchInFlight = null;
    }
  })();

  return sessionUserFetchInFlight;
}

async function refreshShellAuthBanner() {
  const auth = document.querySelector("#Container #Authentication");
  if (!auth) return;

  const signOut = auth.querySelector(".vortex07-signout-link");
  const loggedIn = isNativeUserLoggedIn() || Boolean(signOut);

  let session = getSessionUserFromNav();

  if (session?.needsUsername && !session.username) {
    const fetched = await fetchSessionUser();
    if (fetched?.username) {
      session = { ...fetched, needsUsername: false };
      cachedSessionUser = session;
    }
  }

  if (!session?.username && loggedIn) {
    const id = session?.id ?? getLoggedInUserIdFromNav();
    session = {
      username: id !== null ? `Player ${id}` : "Member",
      id,
      href: id !== null ? `/users/${id}/profile` : "/home",
      needsUsername: Boolean(id !== null),
    };
  }

  if (session?.username) cachedSessionUser = session;

  auth.querySelector(".vortex07-auth-guest")?.remove();

  if (!loggedIn && !session?.username) {
    if (!auth.querySelector(".vortex07-auth-guest")) {
      const guest = document.createElement("span");
      guest.className = "vortex07-auth-guest";
      guest.innerHTML = '<a href="/login">Member Login</a>';
      auth.insertBefore(guest, signOut || null);
    }
    auth.querySelector(".vortex07-auth-user")?.remove();
    return;
  }

  let line = auth.querySelector(".vortex07-auth-user");
  if (!line) {
    line = document.createElement("span");
    line.className = "vortex07-auth-user";
    auth.insertBefore(line, signOut || null);
  }

  const profileHref = escapeHtml(session?.href || "/home");
  const name = escapeHtml(session?.username || "Member");
  line.innerHTML = `Logged in as <a class="vortex07-auth-name" href="${profileHref}"><strong>${name}</strong></a>`;

  const navActions = document.querySelector(
    "#Container .Navigation .navbar-actions",
  );
  injectVortex07ExtensionNavs(navActions);
}

function markActiveNavTab() {
  const path = window.location.pathname;
  const onSettingsPage = window.location.hash === VORTEX07_SETTINGS_HASH;
  const onForumPage = window.location.hash === VORTEX07_FORUM_HASH;
  const links = document.querySelectorAll(
    "#Container .Navigation .MenuItem, #Container .Navigation .vortex07-nav-tab",
  );

  links.forEach((link) => {
    if (link.dataset.vortex07Nav === "extension-settings") {
      link.classList.toggle("vortex07-nav-active", onSettingsPage);
      return;
    }

    if (link.dataset.vortex07Nav === "community-forum") {
      link.classList.toggle("vortex07-nav-active", onForumPage);
      return;
    }

    const href = safeString(link.getAttribute("href"));
    let active = false;

    if (onSettingsPage || onForumPage) {
      active = false;
    } else if (href && href !== "/" && path.startsWith(href.replace(/#.*$/, ""))) {
      active = true;
    } else if (href === "/" && path === "/") {
      active = true;
    } else if (path.startsWith("/catalog") && href.includes("/catalog")) {
      active = true;
    } else if (path.includes("/profile") && href.includes("/profile")) {
      active = true;
    } else if (path.startsWith("/download") && href.includes("/download")) {
      active = true;
    } else if (path.startsWith("/settings") && href.includes("/settings")) {
      active = true;
    } else if (
      (path === "/home" || path === "/") &&
      (href === "/home" || href.startsWith("/home"))
    ) {
      active = true;
    }

    link.classList.toggle("vortex07-nav-active", active);
  });
}

function createHeader() {
  const headerEl = document.createElement("div");
  headerEl.id = "Header";

  const banner = document.createElement("div");
  banner.id = "Banner";

  const options = document.createElement("div");
  options.id = "Options";

  const auth = document.createElement("div");
  auth.id = "Authentication";

  const guest = document.createElement("span");
  guest.className = "vortex07-auth-guest";
  guest.innerHTML = '<a href="/login">Member Login</a>';

  auth.appendChild(guest);
  options.appendChild(auth);

  const logoSlot = document.createElement("div");
  logoSlot.id = "Logo";

  const alertsSlot = document.createElement("div");
  alertsSlot.id = "Alerts";

  banner.appendChild(options);
  banner.appendChild(logoSlot);
  banner.appendChild(alertsSlot);

  const navigationSlot = document.createElement("div");
  navigationSlot.className = "Navigation";

  headerEl.appendChild(banner);
  headerEl.appendChild(navigationSlot);

  return { headerEl, logoSlot, alertsSlot, navigationSlot, authSlot: auth };
}

function appendNavItem(parent, link) {
  if (parent.children.length > 0) {
    const sep = document.createElement("span");
    sep.className = "Separator";
    sep.textContent = " | ";
    parent.appendChild(sep);
  }
  parent.appendChild(link);
}

function createClassicFooter() {
  const footerDiv = document.createElement("div");
  footerDiv.id = "Footer";

  const hr = document.createElement("hr");
  const legal = document.createElement("p");
  legal.className = "Legalese";

  appendText(
    legal,
    'Vortex, "Online Building Toy", characters, logos, names, and all related indicia are trademarks of ',
  );
  appendFooterLink(legal, "Vortex Corporation", "javascript:void(0);");
  appendText(legal, ", ©2007. Patents pending.");
  legal.appendChild(document.createElement("br"));
  appendText(legal, "Enhanced by Vortex07 — ");
  appendFooterLink(legal, "V07 Settings", `${VORTEX_ORIGIN}/home${VORTEX07_SETTINGS_HASH}`);
  appendText(legal, ".");
  legal.appendChild(document.createElement("br"));

  appendText(
    legal,
    "Vortex Corp. is not affliated with Lego, MegaBloks, Bionicle, Pokemon, Nintendo, Lincoln Logs, Yu Gi Oh, K'nex, Tinkertoys, Erector Set, or the Pirates of the Caribbean. ARrrr!",
  );
  legal.appendChild(document.createElement("br"));

  appendText(legal, "Use of this site signifies your acceptance of the ");
  appendFooterLink(legal, "Terms and Conditions", "/terms");
  appendText(legal, ".");
  legal.appendChild(document.createElement("br"));

  appendFooterLink(legal, "Official Wiki", PLAYVORTEX_WIKI_URL, true);
  appendText(legal, " | ");
  appendFooterLink(legal, "Privacy Policy", "/privacy");
  appendText(legal, " | ");
  appendFooterLink(legal, "Contact Us", "javascript:void(0);");
  appendText(legal, " | ");
  appendFooterLink(legal, "About Us", "javascript:void(0);");
  appendText(legal, " | ");
  appendFooterLink(legal, "Jobs", "javascript:void(0);");

  footerDiv.appendChild(hr);
  footerDiv.appendChild(legal);
  return footerDiv;
}

function appendText(parent, text) {
  parent.appendChild(document.createTextNode(text));
}

function appendFooterLink(parent, text, href, external = false) {
  const link = document.createElement("a");
  link.textContent = text;
  link.href = href;
  if (external) {
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  }
  parent.appendChild(link);
}

function updateFooterState() {
  const footerDiv = document.getElementById("Footer");
  const container = document.getElementById("Container");

  if (!currentSettings.classicFooter && footerDiv) footerDiv.remove();
  else if (currentSettings.classicFooter && !footerDiv && container)
    container.appendChild(createClassicFooter());
}

function isProfileSocialButton(btn) {
  return Boolean(
    btn?.closest(
      ".profile-actions, .profile-buttons, .profile-header-actions, [class*='profile-actions'], [class*='profile-buttons']",
    ),
  );
}

function enhanceAuthPageChrome() {
  if (!currentSettings.enabled) return;

  cleanupLegacyAuthPageDom();
  syncNativeSiteStylesheets(true);
  document.body?.classList.toggle(
    "vortex07-auth-page",
    isAuthPage() || Boolean(document.querySelector("body > .wrap .logo-img")),
  );

  document.querySelectorAll(".btn-discord").forEach((el) => {
    el.classList.add("vortex07-discord-btn");
    if (currentSettings.retroButtons) el.classList.add("rbx-2007-btn");
  });

  document.querySelectorAll(".wrap .btn, .wrap .btn-signout, .wrap .btn-soon").forEach((el) => {
    if (currentSettings.retroButtons) el.classList.add("rbx-2007-btn");
  });
}

function cleanupLegacyAuthPageDom() {
  document.getElementById("vortex07-auth-host")?.remove();
  document.querySelectorAll("[data-vortex07-auth-hidden]").forEach((el) => {
    el.removeAttribute("hidden");
    el.removeAttribute("aria-hidden");
    el.removeAttribute("data-vortex07-auth-hidden");
  });
  if (typeof ensureNativeAuthStylesheet === "function") ensureNativeAuthStylesheet();
}

function updateRetroButtonState() {
  document
    .querySelectorAll(".rbx-2007-btn")
    .forEach((btn) => btn.classList.remove("rbx-2007-btn"));

  if (!currentSettings.enabled || !currentSettings.retroButtons) return;

  document
    .querySelectorAll(
      "#Container .btn-primary, #Container .btn-secondary, #Container .btn-play, #Container .Button, #Container .btn, #Container button, #Alerts button, .vortex07-search-host button, .vortex07-rep-thumb-btn, .vortex07-game-vote-btn, .btn-discord, .wrap .btn, .wrap .btn-signout",
    )
    .forEach((btn) => {
      if (isProfileSocialButton(btn)) return;
      btn.classList.add("rbx-2007-btn");
    });
}

function bootstrapFeaturesWithoutShell() {
  revealBody();
  lastLayoutEnhanceAt = 0;
  ensureSearchFallbackSlot();
  ensureSearchSystem();
  ensureVertexWallet();
  updateRetroButtonState();
  startProfileBadgeObserver();
  runThrottledLayoutEnhancements();
  if (!layoutGuardStarted) startLayoutGuard();
}

function scheduleLayoutEnhancements() {
  scheduleProfileBadgeEnhanceFast();

  clearTimeout(layoutEnhanceDebounceTimer);
  layoutEnhanceDebounceTimer = setTimeout(() => {
    layoutEnhanceDebounceTimer = null;
    runThrottledLayoutEnhancements();
  }, LAYOUT_OBSERVER_DEBOUNCE_MS);
}

function runThrottledLayoutEnhancements() {
  if (isRunningLayoutEnhancements || areObserverMutationsPaused()) return;

  const now = Date.now();
  if (now - lastObserverEnhanceAt < 500) return;
  lastObserverEnhanceAt = now;

  isRunningLayoutEnhancements = true;
  try {
    withDomEnhancementPaused(() => {
      notePathnameChange();
      syncPageRouteClasses();
      enhanceSurfaceChrome();

      const runHeavy = now - lastLayoutEnhanceAt >= LAYOUT_ENHANCE_INTERVAL_MS;

      if (runHeavy) lastLayoutEnhanceAt = now;

      updateFooterState();
      updateRetroButtonState();
      enhanceAuthPageChrome();
      wireShellNavControls(document.querySelector(".navbar .navbar-actions"));
      ensureShellLogo();
      markActiveNavTab();

      if (runHeavy) {
        refreshShellAuthBanner();
        injectReputationWidget();
        injectGameRatingWidget();
        syncVortex07SettingsVisibility();
      }

      if (currentSettings.userSearch) {
        ensureSearchSystem();
        updateResultsBoxPosition();
      }

      ensureVertexWallet();
      enhanceRetroBadges();

      if (!runHeavy) {
        enhanceFriendsCarousels();
        return;
      }

      enhanceLegacyStatusLabels();
      flattenCarousels();
      normalizeFriendTiles();
      enhanceFriendsCarousels();
      compressHeroSections();
      normalizeProfileLayout();
      normalizeAvatarImages();
      normalizeOnlineIndicators();
      applyAvatarFramesToPage();
      scheduleGlobalRepBadges();
      void injectHomeActivityTicker();
      void injectHomeLeaderboardStrip();
      scheduleExtensionMetaDecorations();

      if (getProfileUserIdFromPage() !== null) {
        void recordProfilePageVisit();
        injectProfileTierFeatures();
      }

      if (resolvePageRouteKey() === "game") {
        injectGameRatingWidget();
      }

      if (currentSettings.userSearch) updateResultsBoxPosition();
    });
  } finally {
    isRunningLayoutEnhancements = false;
  }
}

function scheduleInitialLayoutBuild() {
  if (is2007Applied || !currentSettings.enabled || areObserverMutationsPaused()) return;

  clearTimeout(initialLayoutBuildTimer);
  initialLayoutBuildTimer = setTimeout(() => {
    initialLayoutBuildTimer = null;
    if (!is2007Applied && !areObserverMutationsPaused()) build2007Layout();
  }, 300);
}

function startLayoutGuard() {
  if (layoutGuardStarted) return;
  layoutGuardStarted = true;
  let scheduled = false;

  layoutGuardObserver = new MutationObserver(() => {
    if (areObserverMutationsPaused()) return;

    if (!isExtensionContextAlive()) {
      if (is2007Applied) scheduleLayoutEnhancements();
      return;
    }

    if (scheduled) return;
    scheduled = true;

    requestAnimationFrame(() => {
      scheduled = false;

      if (!isExtensionContextAlive() || areObserverMutationsPaused()) return;

      const mainContent =
        document.querySelector(".page") ||
        document.querySelector(".catalog-container") ||
        document.querySelector("main.home") ||
        document.querySelector("main");

      if (
        mainContent &&
        bodyContainer &&
        isElementInDocument(bodyContainer) &&
        !bodyContainer.contains(mainContent) &&
        !isInsideVortexShell(mainContent) &&
        mainContent.parentElement === document.body
      ) {
        withDomEnhancementPaused(() => {
          bodyContainer.appendChild(mainContent);
        });
      }

      const navbar = document.querySelector(".navbar");
      if (navbar && !navbar.classList.contains("vortex07-native-navbar-hidden"))
        hideNativeChrome(navbar, null);

      const footer = document.querySelector(".site-footer");
      if (footer && footer.style.display !== "none") footer.style.display = "none";

      scheduleLayoutEnhancements();
    });
  });

  layoutGuardObserver.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true,
  });
}

function startObserver() {
  if (pageObserverStarted) return;
  pageObserverStarted = true;

  pageLayoutObserver = new MutationObserver(() => {
    if (areObserverMutationsPaused()) return;

    if (!isExtensionContextAlive()) {
      if (is2007Applied) scheduleLayoutEnhancements();
      return;
    }

    if (!is2007Applied) scheduleInitialLayoutBuild();
    else scheduleLayoutEnhancements();
  });

  pageLayoutObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  build2007Layout();
  logDebug("Page observer started");
}

(async () => {
  installPlayvortexFetchInterceptor();
  try {
    await initVortex07();
  } catch (err) {
    logError("Init failed:", err);
  } finally {
    revealBody();
  }
})();
