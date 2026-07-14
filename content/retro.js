// vortex07 — skins playvortex.io when retro toggle is on

(function () {
  "use strict";

  const DEFAULTS = {
    enabled: true,
    darkMode: false,
    welcome: true,
    onlineDots: true,
    liveStats: true,
    capGames: true
  };
  let cfg = { ...DEFAULTS };

  function readSettings(data) {
    const out = { ...DEFAULTS };
    for (const key of Object.keys(DEFAULTS)) {
      if (key in data) out[key] = !!data[key];
    }
    return out;
  }

  function applyFeatureToggles() {
    if (!cfg.enabled || !document.documentElement.classList.contains("v07-retro")) return;
    applyRoutePatches();
    startPortalPoll();
  }
  const PER_PAGE = 9;
  const HOME_GAMES_CAP = 8;
  const API_CACHE_MS = 45000;
  const API_POLL_MS = 60000;
  let carouselInit = false;
  let isMutating = false;
  let rowUpdateQueued = false;
  let pendingFriendsRow = null;
  const boundFriendsRows = new WeakSet();
  const rowFriendCounts = new WeakMap();
  let savedDiscord = null;

  const NAV_VERSION = "10";
  const SEARCH_LIMIT = 5;
  const SEARCH_MIN_CHARS = 2;
  const SEARCH_DEBOUNCE = 280;

  const searchBindings = new WeakMap();

  // strip link order — profile href filled in later from the real nav button
  const NAV_SPEC = [
    { href: "/home", text: "Home" },
    { href: "/catalog", text: "Catalog", actionSel: "a[href=\"/catalog\"]" },
    { href: "profile", text: "MyVortex", actionSel: "#my-profile-btn", rename: true },
    { href: "/settings", text: "Settings", actionSel: "a[href=\"/settings\"]" },
    { href: "/__v07_forums__", text: "Forums", v07Forum: true },
    { href: "/terms", text: "Terms" },
    { href: "/privacy", text: "Privacy" }
  ];

  const PROFILE_PATH_RE = /\/users\/[^/]+\/profile\/?$/i;
  const GAME_PATH_RE = /\/(?:games?|play)\/([^/?#]+)/i;

  function isValidProfileHref(href) {
    if (!href) return false;
    try {
      const url = new URL(href, window.location.origin);
      return PROFILE_PATH_RE.test(url.pathname);
    } catch {
      return false;
    }
  }

  function storeProfileHref(href) {
    if (!isValidProfileHref(href)) return false;
    sessionStorage.setItem("v07-profile-href", href);
    chrome.storage.local.get({ v07NavCache: null }, (data) => {
      const cache = { ...(data.v07NavCache || {}), profileHref: href };
      chrome.storage.local.set({ v07NavCache: cache });
    });
    return true;
  }

  function clearInvalidProfileHref() {
    const cached = sessionStorage.getItem("v07-profile-href");
    if (cached && !isValidProfileHref(cached)) {
      sessionStorage.removeItem("v07-profile-href");
    }
  }

  function readProfileHrefFromDom(root) {
    const scope = root || document;
    const btn =
      scope.querySelector(".navbar-actions #my-profile-btn") ||
      scope.querySelector("#my-profile-btn");
    if (!btn?.href || !isValidProfileHref(btn.href)) return null;
    return btn.href;
  }

  function resolveProfileHref() {
    clearInvalidProfileHref();
    const dom = readProfileHrefFromDom();
    if (dom) return dom;
    const cached = sessionStorage.getItem("v07-profile-href");
    return cached && isValidProfileHref(cached) ? cached : null;
  }

  function applyProfileHref(el) {
    if (!el) return;
    const href = resolveProfileHref();
    if (href) {
      el.href = href;
      storeProfileHref(href);
      delete el.dataset.v07ProfilePending;
    } else {
      el.href = window.location.origin + "/home";
      el.dataset.v07ProfilePending = "1";
    }
  }

  function cacheNavSession(actions) {
    if (!actions) return;

    const logout = actions.querySelector("#logout-btn");
    const cache = {};

    const profileHref = readProfileHrefFromDom(actions);
    if (profileHref) {
      storeProfileHref(profileHref);
      cache.profileHref = profileHref;
    }

    if (logout) {
      sessionStorage.setItem("v07-has-logout", "1");
      sessionStorage.setItem("v07-logout-html", logout.outerHTML);
      cache.hasLogout = true;
      cache.logoutHtml = logout.outerHTML;
    } else {
      sessionStorage.setItem("v07-has-logout", "0");
      sessionStorage.removeItem("v07-logout-html");
      cache.hasLogout = false;
    }

    chrome.storage.local.set({ v07NavCache: cache });
  }

  function restoreNavCache(done) {
    chrome.storage.local.get({ v07NavCache: null }, (data) => {
      const cache = data.v07NavCache;
      if (cache?.profileHref) {
        if (isValidProfileHref(cache.profileHref)) {
          sessionStorage.setItem("v07-profile-href", cache.profileHref);
        } else {
          delete cache.profileHref;
          chrome.storage.local.set({ v07NavCache: cache });
        }
      }
      if (cache?.hasLogout) {
        sessionStorage.setItem("v07-has-logout", "1");
        if (cache.logoutHtml) {
          sessionStorage.setItem("v07-logout-html", cache.logoutHtml);
        }
      }
      done?.();
    });
  }

  function navHref(spec) {
    if (spec.href === "profile") {
      return resolveProfileHref() || window.location.origin + "/home";
    }
    if (spec.v07Forum) return "javascript:void(0)";
    if (spec.external) {
      return spec.href;
    }
    if (spec.href.startsWith("/")) {
      return window.location.origin + spec.href;
    }
    return spec.href;
  }

  function navPathForSpec(spec) {
    if (spec.href === "profile") return null;
    const raw = spec.href || "";
    if (raw.startsWith("http")) {
      try {
        return new URL(raw).pathname.toLowerCase();
      } catch {
        return null;
      }
    }
    return raw.toLowerCase();
  }

  function extractProfileUserId(pathOrUrl) {
    if (!pathOrUrl) return null;
    try {
      const path = String(pathOrUrl).startsWith("http")
        ? new URL(pathOrUrl).pathname
        : String(pathOrUrl);
      const match = path.match(/\/users\/([^/]+)\/profile/i);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }

  function isNavPathActive(spec, currentPath, linkEl) {
    if (spec.v07Forum) return false;
    if (spec.href === "profile") {
      if (linkEl?.href) {
        try {
          const linkPath = new URL(linkEl.href, window.location.origin).pathname
            .toLowerCase()
            .replace(/\/$/, "");
          if (currentPath === linkPath) return true;
        } catch {
          // profile link not ready yet
        }
      }

      const profileHref = resolveProfileHref();
      if (profileHref) {
        try {
          const path = new URL(profileHref, window.location.origin).pathname
            .toLowerCase()
            .replace(/\/$/, "");
          if (currentPath === path) return true;
        } catch {
          // profile link not ready yet
        }

        const resolvedId = extractProfileUserId(profileHref);
        const currentId = extractProfileUserId(currentPath);
        if (resolvedId && currentId && resolvedId === currentId) return true;
      }

      return false;
    }
    const linkPath = navPathForSpec(spec);
    if (!linkPath) return false;
    return currentPath === linkPath || currentPath === linkPath.replace(/\/$/, "");
  }

  function buildStripLinks(stripInner, actions) {
    const currentPath = window.location.pathname.toLowerCase().replace(/\/$/, "") || "/";

    NAV_SPEC.forEach((spec) => {
      let el = null;

      if (spec.actionSel && actions) {
        el = actions.querySelector(spec.actionSel);
        if (el) {
          if (spec.rename) {
            if (!el.dataset.v07OriginalLabel) {
              el.dataset.v07OriginalLabel = el.textContent.trim();
            }
            el.textContent = spec.text;
          }
          tagNavLink(el);
        }
      }

      if (!el) {
        el = document.createElement("a");
        el.className = "v07-nav-link";
        el.textContent = spec.text;
        el.dataset.v07Injected = "1";

        if (spec.external) {
          el.target = "_blank";
          el.rel = "noopener";
        }
      }

      el.href = navHref(spec);
      if (spec.v07Forum) el.dataset.v07Forum = "1";
      if (spec.href === "profile") {
        applyProfileHref(el);
      }

      el.classList.remove("v07-nav-active");
      el.removeAttribute("aria-current");
      if (isNavPathActive(spec, currentPath, el)) {
        el.classList.add("v07-nav-active");
        el.setAttribute("aria-current", "page");
      }

      stripInner.appendChild(el);
    });
  }

  function onReady(fn, selector) {
    const run = () => {
      if (selector && !document.querySelector(selector)) return;
      fn();
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", run, { once: true });
    } else {
      run();
    }
  }

  function applyTopbarAsset(on) {
    const root = document.documentElement;
    if (on) {
      root.style.setProperty(
        "--v07-topbar-bg",
        'url("' + chrome.runtime.getURL("assets/topbarbg.jpg") + '")'
      );
      root.style.setProperty(
        "--v07-play-btn",
        'url("' + chrome.runtime.getURL("assets/OriginalPlayButton.png") + '")'
      );
      root.style.setProperty(
        "--v07-signup-btn",
        'url("' + chrome.runtime.getURL("assets/SignUpAndPlay.png") + '")'
      );
    } else {
      root.style.removeProperty("--v07-topbar-bg");
      root.style.removeProperty("--v07-play-btn");
      root.style.removeProperty("--v07-signup-btn");
    }
  }

  function apply(data) {
    cfg = readSettings(data);
    const root = document.documentElement;
    const on = cfg.enabled;

    root.classList.toggle("v07-retro", on);
    root.classList.toggle("v07-dark", on && cfg.darkMode);
    applyTopbarAsset(on);

    if (!on) {
      stopPortalPoll();
      teardownOgNavbar();
      teardownOgSearch(document.querySelector(".navbar-search"));
      unpatchHome();
      unpatchCatalog();
      unpatchProfile();
      unpatchGame();
      delete document.body.dataset.v07Route;
      delete document.body.dataset.v07SearchQ;
      teardownFooterCopy();
      document.querySelectorAll(".friends-row").forEach((el) => unwrapPages(el));
      return;
    }

    hookSpaNavigation();
    onReady(() => {
      initFriendsCarousel();
      scheduleRowUpdate();
      onReady(() => {
        ensureOgNavbar();
        initOgSearch(document.querySelector(".navbar-search"));
      }, ".navbar");
      mountFooterCopy();
    });

    applyFeatureToggles();
  }

  function isHomePage() {
    const path = window.location.pathname.toLowerCase().replace(/\/$/, "") || "/";
    return path === "/home";
  }

  function isCatalogPage() {
    const path = window.location.pathname.toLowerCase().replace(/\/$/, "") || "/";
    return path === "/catalog";
  }

  function detectRoute() {
    const path = window.location.pathname.toLowerCase().replace(/\/$/, "") || "/";
    if (path === "/home") return "home";
    if (path === "/catalog") return "catalog";
    if (PROFILE_PATH_RE.test(path)) return "profile";
    if (path === "/settings") return "settings";
    if (path === "/download") return "download";
    if (path === "/search") return "search";
    if (path.startsWith("/terms")) return "terms";
    if (path.startsWith("/privacy")) return "privacy";
    if (GAME_PATH_RE.test(path)) return "game";
    if (document.querySelector(".wrap") && !document.querySelector(".navbar")) return "auth";
    return "other";
  }

  function isProfilePage() {
    return detectRoute() === "profile";
  }

  function isGamePage() {
    return detectRoute() === "game";
  }

  function isSearchPage() {
    return detectRoute() === "search";
  }

  function syncRoute() {
    const route = detectRoute();
    document.body.dataset.v07Route = route;

    if (route === "search") {
      const params = new URLSearchParams(window.location.search);
      const query = (params.get("q") || params.get("query") || "").trim();
      if (query) document.body.dataset.v07SearchQ = query;
      else delete document.body.dataset.v07SearchQ;
    } else {
      delete document.body.dataset.v07SearchQ;
    }
  }

  function extractGameKeyFromUrl() {
    const match = window.location.pathname.match(GAME_PATH_RE);
    return match ? match[1] : null;
  }

  function isOwnProfile() {
    const href = resolveProfileHref();
    if (!href) return false;
    try {
      const mine = new URL(href, window.location.origin).pathname.replace(/\/$/, "");
      const here = window.location.pathname.replace(/\/$/, "");
      return mine === here;
    } catch {
      return false;
    }
  }

  function readJoinDateText() {
    const label = document.querySelector(".join-date-label");
    if (label) return label.textContent.trim().replace(/^joined\s*/i, "");
    const meta = document.querySelector(".profile-meta");
    const match = meta?.textContent?.match(/joined\s+(.+)/i);
    return match ? match[1].trim() : null;
  }

  let savedDocTitle = "";

  function unpatchProfile() {
    document.querySelector(".v07-profile-tagline")?.remove();
    document.querySelector(".profile-username")?.removeAttribute("data-v07-joined");
    document.querySelector(".profile-username")?.removeAttribute("data-v07-own");
    if (savedDocTitle) {
      document.title = savedDocTitle;
      savedDocTitle = "";
    }
  }

  function patchProfile() {
    if (!document.documentElement.classList.contains("v07-retro")) return;

    if (!isProfilePage()) {
      unpatchProfile();
      return;
    }

    const page = document.querySelector(".page");
    if (!page) return;

    const username = document.querySelector(".profile-username")?.textContent?.trim();
    if (username) storeUsername(username);

    if (isOwnProfile() && username) {
      const title = `MyVortex — ${username}`;
      if (!savedDocTitle) savedDocTitle = document.title;
      if (document.title !== title) document.title = title;
    } else if (savedDocTitle) {
      document.title = savedDocTitle;
      savedDocTitle = "";
    }

    const usernameEl = document.querySelector(".profile-username");
    if (!usernameEl) return;

    const joined = readJoinDateText();
    if (joined) usernameEl.dataset.v07Joined = joined;
    else usernameEl.removeAttribute("data-v07-joined");
    usernameEl.dataset.v07Own = isOwnProfile() ? "1" : "0";
  }

  const GAME_LAYOUT_VERSION = "1";

  function findGameDescription(page) {
    return page.querySelector(
      ".game-description-box, .game-detail-description, .game-detail-about, .game-about"
    );
  }

  function restoreGameLayout(page) {
    const shell = page.querySelector(".v07-game-shell");
    if (!shell) return;

    const banner = shell.querySelector(".game-banner");
    const title = shell.querySelector(".game-detail-title");
    const creator = shell.querySelector(".game-detail-creator");
    const stats = shell.querySelector(".game-detail-stats");
    const playBtn = shell.querySelector(".btn-play, a.btn-play");
    const description = findGameDescription(shell);

    const header = document.createElement("div");
    header.className = "game-detail-header";

    const info = document.createElement("div");
    info.className = "game-detail-info";
    if (title) info.appendChild(title);
    if (creator) info.appendChild(creator);
    if (stats) info.appendChild(stats);
    header.appendChild(info);
    if (playBtn) header.appendChild(playBtn);

    const frag = document.createDocumentFragment();
    if (banner) frag.appendChild(banner);
    frag.appendChild(header);
    if (description) frag.appendChild(description);
    shell.replaceWith(frag);

    delete page.dataset.v07GameLayout;
  }

  function patchGameLayout(page) {
    if (page.dataset.v07GameLayout === GAME_LAYOUT_VERSION && page.querySelector(".v07-game-shell")) {
      return;
    }

    delete page.dataset.v07GameLayout;

    if (page.querySelector(".v07-game-shell")) {
      restoreGameLayout(page);
    }

    const banner = page.querySelector(".game-banner");
    const header = page.querySelector(".game-detail-header");
    if (!banner || !header) return;

    const info = header.querySelector(".game-detail-info");
    const title = info?.querySelector(".game-detail-title") || header.querySelector(".game-detail-title");
    const creator = info?.querySelector(".game-detail-creator") || header.querySelector(".game-detail-creator");
    const stats = info?.querySelector(".game-detail-stats") || header.querySelector(".game-detail-stats");
    const playBtn = header.querySelector(".btn-play, a.btn-play");
    const description = findGameDescription(page);

    const shell = document.createElement("div");
    shell.className = "v07-game-shell";
    shell.dataset.v07Injected = "1";

    const hero = document.createElement("div");
    hero.className = "v07-game-hero";

    const thumbWrap = document.createElement("div");
    thumbWrap.className = "v07-game-thumb-wrap";
    thumbWrap.appendChild(banner);

    const main = document.createElement("div");
    main.className = "v07-game-main";

    const titleRow = document.createElement("div");
    titleRow.className = "v07-game-title-row";

    const titles = document.createElement("div");
    titles.className = "v07-game-titles";
    if (title) titles.appendChild(title);
    if (creator) titles.appendChild(creator);
    titleRow.appendChild(titles);
    if (playBtn) titleRow.appendChild(playBtn);
    main.appendChild(titleRow);

    if (description) {
      const aboutWrap = document.createElement("div");
      aboutWrap.className = "v07-game-about-wrap";
      aboutWrap.appendChild(description);
      main.appendChild(aboutWrap);
    }

    if (stats) {
      const statsWrap = document.createElement("div");
      statsWrap.className = "v07-game-stats-wrap";
      statsWrap.appendChild(stats);
      main.appendChild(statsWrap);
    }

    hero.appendChild(thumbWrap);
    hero.appendChild(main);
    shell.appendChild(hero);

    header.replaceWith(shell);
    page.dataset.v07GameLayout = GAME_LAYOUT_VERSION;
  }

  function unpatchGame() {
    const page = document.querySelector(".page");
    if (page?.dataset.v07GameLayout) restoreGameLayout(page);
    document.querySelector(".v07-place-strip")?.remove();
  }

  function syncGameDetailLive(games) {
    const page = document.querySelector(".page");
    if (!page || !isGamePage()) return;

    const key = extractGameKeyFromUrl();
    let playing = null;

    if (games && key) {
      const game = games.find((entry) => {
        const id = entry?.id ?? entry?.game_id;
        const slug = entry?.slug;
        return String(id) === key || String(slug) === key;
      });
      playing = game?.playing ?? game?.player_count ?? game?.players ?? game?.active_players;
    }

    let strip = page.querySelector(".v07-place-strip");
    if (playing != null) {
      if (!strip) {
        strip = document.createElement("p");
        strip.className = "v07-place-strip";
        strip.dataset.v07Injected = "1";
        const anchor = page.querySelector(".v07-game-shell") || page.querySelector(".game-detail-header");
        if (anchor) anchor.insertAdjacentElement("afterend", strip);
        else page.prepend(strip);
      }
      strip.textContent = `${playing} playing now.`;
    } else {
      strip?.remove();
    }
  }

  function patchGame() {
    if (!document.documentElement.classList.contains("v07-retro")) return;

    if (!isGamePage()) {
      unpatchGame();
      return;
    }

    const page = document.querySelector(".page");
    if (page) patchGameLayout(page);

    if (cfg.liveStats) syncGameDetailLive(apiCache.games.data);
    else document.querySelector(".v07-place-strip")?.remove();
  }

  function applyRoutePatches() {
    if (!document.documentElement.classList.contains("v07-retro")) return;
    syncRoute();
    patchHome();
    patchCatalog();
    patchProfile();
    patchGame();
  }

  let catalogWatch = null;
  let catalogRetryTimer = null;
  let catalogRefreshTimer = null;
  let lastWearingKey = "";
  let savedCatalogKey = null;
  let catBusy = false;

  function equippedItemNames() {
    const names = [];
    document.querySelectorAll(".market-card.equipped .item-name, .face-card.equipped .item-name").forEach((el) => {
      const name = el.textContent.trim();
      if (name && !names.includes(name)) names.push(name);
    });
    return names;
  }

  function firstEquippedCard() {
    return document.querySelector(
      ".market-grid .market-card.equipped, .market-grid .face-card.equipped"
    );
  }

  function catalogSectionDividers() {
    return [...document.querySelectorAll(".market-grid .catalog-section-divider")].filter(
      (el) => el.textContent.trim()
    );
  }

  function currentCatalogKey() {
    return equippedItemNames().join("\0");
  }

  function syncCatalogHelper() {
    const main = document.querySelector(".catalog-main");
    const grid = main?.querySelector(".market-grid");
    if (!main || !grid) return;

    let bar = main.querySelector(".v07-cat-helper");
    if (!bar) {
      bar = document.createElement("div");
      bar.className = "v07-cat-helper";
      bar.dataset.v07Injected = "1";
      bar.innerHTML =
        '<p class="v07-cat-helper-tip"></p>' +
        '<button type="button" class="v07-cat-jump">Show equipped</button>';
      grid.insertAdjacentElement("beforebegin", bar);
      bar.querySelector(".v07-cat-jump")?.addEventListener("click", () => {
        firstEquippedCard()?.scrollIntoView({ block: "nearest" });
      });
    }

    const count = equippedItemNames().length;
    const tip = bar.querySelector(".v07-cat-helper-tip");
    const jump = bar.querySelector(".v07-cat-jump");
    if (!tip || !jump) return;

    const name = resolveDisplayName();
    let text = count
      ? `${count} item${count === 1 ? "" : "s"} on — click items to swap, then Save.`
      : "Click items to try them on — Save when you're done.";
    if (name) text = `Building as ${name}. ${text}`;
    tip.textContent = text;

    jump.hidden = count === 0;
    if (count > 0) jump.textContent = `Show equipped (${count})`;
  }

  function syncCatalogTabs() {
    const main = document.querySelector(".catalog-main");
    const helper = main?.querySelector(".v07-cat-helper");
    if (!main || !helper) return;

    const dividers = catalogSectionDividers();
    const labels = dividers.map((el) => el.textContent.trim());
    let tabs = main.querySelector(".v07-cat-tabs");

    if (labels.length < 2) {
      tabs?.remove();
      return;
    }

    const key = labels.join("|");
    if (!tabs) {
      tabs = document.createElement("div");
      tabs.className = "v07-cat-tabs";
      tabs.dataset.v07Injected = "1";
      helper.insertAdjacentElement("afterend", tabs);
    } else if (tabs.dataset.v07TabsKey === key) {
      return;
    }

    tabs.dataset.v07TabsKey = key;
    tabs.replaceChildren(
      ...dividers.map((divider, index) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "v07-cat-tab";
        btn.textContent = labels[index];
        btn.addEventListener("click", () => {
          divider.scrollIntoView({ block: "start", behavior: "smooth" });
        });
        return btn;
      })
    );
  }

  function syncCatalogSaveNote() {
    const panel = document.querySelector(".avatar-panel");
    const saveBtn = panel?.querySelector("#save-btn");
    if (!panel || !saveBtn) return;

    const key = currentCatalogKey();
    if (savedCatalogKey == null) savedCatalogKey = key;

    let note = panel.querySelector(".v07-cat-save-note");
    if (!note) {
      note = document.createElement("p");
      note.className = "v07-cat-save-note";
      note.dataset.v07Injected = "1";
      saveBtn.insertAdjacentElement("afterend", note);

      if (!saveBtn.dataset.v07SaveHooked) {
        saveBtn.dataset.v07SaveHooked = "1";
        saveBtn.addEventListener("click", () => {
          setTimeout(() => {
            savedCatalogKey = currentCatalogKey();
            syncCatalogSaveNote();
          }, 350);
        });
      }
    }

    const dirty = key !== savedCatalogKey;
    note.textContent = dirty ? "Unsaved outfit changes." : "Saved outfit preview.";
    note.classList.toggle("v07-cat-save-note-dirty", dirty);
  }

  function syncCatalogBuilderLine() {
    document.querySelector(".v07-cat-builder")?.remove();
  }

  function syncWearingPanel() {
    if (catBusy) return;

    const panel = document.querySelector(".avatar-panel");
    const saveBtn = panel?.querySelector("#save-btn");
    if (!panel || !saveBtn) return;

    const grid = document.querySelector(".market-grid");
    if (!grid) return;

    const items = equippedItemNames();
    const key = items.join("\0");
    if (key === lastWearingKey && panel.querySelector(".v07-cat-wearing")) return;
    lastWearingKey = key;

    catBusy = true;
    try {
      let box = panel.querySelector(".v07-cat-wearing");
      if (!box) {
        box = document.createElement("div");
        box.className = "v07-cat-wearing";
        box.dataset.v07Injected = "1";
        box.innerHTML =
          '<div class="v07-cat-wearing-head">Wearing</div>' +
          '<ul class="v07-cat-wearing-list"></ul>' +
          '<p class="v07-cat-wearing-empty">Nothing equipped yet.</p>';
        saveBtn.insertAdjacentElement("beforebegin", box);
      }

      const list = box.querySelector(".v07-cat-wearing-list");
      const empty = box.querySelector(".v07-cat-wearing-empty");
      const head = box.querySelector(".v07-cat-wearing-head");
      if (!list || !empty) return;

      if (head) head.textContent = items.length ? `Wearing (${items.length})` : "Wearing";

      if (!items.length) {
        empty.hidden = false;
        list.hidden = true;
        list.replaceChildren();
        return;
      }

      empty.hidden = true;
      list.hidden = false;
      list.replaceChildren(
        ...items.map((name) => {
          const li = document.createElement("li");
          li.textContent = name;
          return li;
        })
      );
    } finally {
      catBusy = false;
    }
  }

  function scheduleCatalogRefresh() {
    if (catalogRefreshTimer) clearTimeout(catalogRefreshTimer);
    catalogRefreshTimer = setTimeout(() => {
      catalogRefreshTimer = null;
      if (!isCatalogPage() || !document.documentElement.classList.contains("v07-retro")) return;
      syncWearingPanel();
      syncCatalogHelper();
      syncCatalogTabs();
      syncCatalogSaveNote();
    }, 250);
  }

  function watchCatalogGrid() {
    const grid = document.querySelector(".market-grid");
    if (!grid || grid.dataset.v07CatObs) return;

    grid.dataset.v07CatObs = "1";
    catalogWatch = new MutationObserver((mutations) => {
      const classChange = mutations.some((m) => m.type === "attributes" && m.attributeName === "class");
      if (!classChange) return;
      scheduleCatalogRefresh();
    });
    catalogWatch.observe(grid, {
      subtree: true,
      attributes: true,
      attributeFilter: ["class"]
    });
  }

  function unpatchCatalog() {
    if (catalogRetryTimer) {
      clearTimeout(catalogRetryTimer);
      catalogRetryTimer = null;
    }
    if (catalogRefreshTimer) {
      clearTimeout(catalogRefreshTimer);
      catalogRefreshTimer = null;
    }
    lastWearingKey = "";
    savedCatalogKey = null;
    document
      .querySelectorAll(
        ".v07-cat-wearing, .v07-cat-builder, .v07-cat-helper, .v07-cat-tabs, .v07-cat-save-note"
      )
      .forEach((el) => el.remove());
    document.querySelector(".market-grid")?.removeAttribute("data-v07-cat-obs");
    if (catalogWatch) {
      catalogWatch.disconnect();
      catalogWatch = null;
    }
  }

  function patchCatalog(retriesLeft = 4) {
    if (!document.documentElement.classList.contains("v07-retro")) return;

    if (!isCatalogPage()) {
      unpatchCatalog();
      return;
    }

    if (!document.querySelector(".catalog-container")) return;

    const panelReady = document.querySelector(".avatar-panel") && document.querySelector("#save-btn");
    const gridReady = document.querySelector(".market-grid");

    if ((!panelReady || !gridReady) && retriesLeft > 0) {
      if (!catalogRetryTimer) {
        catalogRetryTimer = setTimeout(() => {
          catalogRetryTimer = null;
          patchCatalog(retriesLeft - 1);
        }, 500);
      }
      if (panelReady) syncCatalogHelper();
      return;
    }

    syncCatalogHelper();
    if (gridReady) {
      syncWearingPanel();
      syncCatalogTabs();
      syncCatalogSaveNote();
      watchCatalogGrid();
    }

    if (!resolveDisplayName()) {
      ensureUsernameCached().then((fetched) => {
        if (!fetched || !isCatalogPage()) return;
        syncCatalogHelper();
      });
    }
  }

  function isGenericProfileLabel(text) {
    const value = String(text || "").trim().toLowerCase();
    return !value || value === "profile" || value === "myvortex" || value === "my profile";
  }

  function storeUsername(username) {
    const clean = String(username || "").trim();
    if (isGenericProfileLabel(clean)) return false;
    sessionStorage.setItem("v07-username", clean);
    return true;
  }

  function readUsernameFromProfilePage() {
    const text = document.querySelector(".profile-username")?.textContent?.trim();
    if (text && !isGenericProfileLabel(text)) return text;
    return null;
  }

  function parseUsernameFromPayload(data) {
    if (!data || typeof data !== "object") return null;
    const username = String(data.username || data.display_name || data.name || "").trim();
    return username && !isGenericProfileLabel(username) ? username : null;
  }

  let usernameFetchPromise = null;

  async function fetchUsernameFromApi() {
    const endpoints = ["/api/users/me", "/me"];
    for (const endpoint of endpoints) {
      try {
        const res = await fetch(endpoint);
        if (!res.ok) continue;
        const username = parseUsernameFromPayload(await res.json());
        if (username) {
          storeUsername(username);
          return username;
        }
      } catch {
        continue;
      }
    }

    const profileHref = resolveProfileHref();
    const userId = extractProfileUserId(profileHref);
    if (!userId) return null;

    try {
      const res = await fetch(`/api/users/${encodeURIComponent(userId)}`);
      if (!res.ok) return null;
      const username = parseUsernameFromPayload(await res.json());
      if (username) {
        storeUsername(username);
        return username;
      }
    } catch {
      return null;
    }

    return null;
  }

  function ensureUsernameCached() {
    if (usernameFetchPromise) return usernameFetchPromise;
    usernameFetchPromise = fetchUsernameFromApi().finally(() => {
      usernameFetchPromise = null;
    });
    return usernameFetchPromise;
  }

  function resolveDisplayName() {
    const cached = sessionStorage.getItem("v07-username");
    if (cached && !isGenericProfileLabel(cached)) return cached;

    const onProfile = readUsernameFromProfilePage();
    if (onProfile) {
      storeUsername(onProfile);
      return onProfile;
    }

    return null;
  }

  function cacheUsernameFromPage() {
    const onProfile = readUsernameFromProfilePage();
    if (onProfile) storeUsername(onProfile);
  }

  function syncHomeWelcome(page) {
    const name = resolveDisplayName();
    let welcome = page.querySelector(".v07-home-welcome");

    if (name) {
      if (!welcome) {
        welcome = buildHomeWelcome(name);
        const insertPoint = findHomeInsertPoint(page);
        if (insertPoint) page.insertBefore(welcome, insertPoint);
        else page.appendChild(welcome);
      } else {
        welcome.textContent = `Welcome back, ${name}.`;
      }
      return;
    }

    welcome?.remove();
  }

  const apiCache = {
    friends: { expires: 0, data: null },
    games: { expires: 0, data: null },
    requests: { expires: 0, count: 0 }
  };
  let portalPollTimer = null;

  function coerceArray(raw, keys) {
    if (Array.isArray(raw)) return raw;
    for (const key of keys) {
      if (Array.isArray(raw?.[key])) return raw[key];
    }
    return [];
  }

  function parseRequestCount(payload) {
    if (typeof payload?.count === "number") return payload.count;
    if (Array.isArray(payload)) return payload.length;
    if (Array.isArray(payload?.requests)) return payload.requests.length;
    if (Array.isArray(payload?.incoming)) return payload.incoming.length;
    if (Array.isArray(payload?.data)) return payload.data.length;
    return 0;
  }

  function friendIsOnline(friend) {
    return !!(
      friend?.is_online ||
      friend?.online ||
      friend?.status === "online" ||
      friend?.presence === "online"
    );
  }

  function friendId(friend) {
    const value =
      friend?.id ??
      friend?.user_id ??
      friend?.userId ??
      friend?.friend_id ??
      friend?.user?.id ??
      friend?.user?.user_id;
    return value != null ? String(value) : null;
  }

  function friendName(friend) {
    return String(
      friend?.username ||
        friend?.display_name ||
        friend?.name ||
        friend?.user?.username ||
        friend?.user?.display_name ||
        ""
    )
      .trim()
      .toLowerCase();
  }

  function extractFriendIdFromCard(card) {
    const href = card.getAttribute("href") || "";
    const match = href.match(/\/users\/([^/]+)\/profile/i);
    return match ? match[1] : null;
  }

  function extractGameKeyFromCard(card) {
    const href = card.getAttribute("href") || "";
    const match = href.match(/\/(?:games|play)\/([^/?#]+)/i);
    return match ? match[1] : null;
  }

  async function fetchFriendsCached() {
    if (apiCache.friends.data && apiCache.friends.expires > Date.now()) {
      return apiCache.friends.data;
    }
    try {
      const res = await fetch("/api/friends");
      if (!res.ok) return null;
      const data = coerceArray(await res.json(), ["friends", "data", "results"]);
      apiCache.friends = { data, expires: Date.now() + API_CACHE_MS };
      return data;
    } catch {
      return null;
    }
  }

  async function fetchGamesCached() {
    if (apiCache.games.data && apiCache.games.expires > Date.now()) {
      return apiCache.games.data;
    }
    try {
      const res = await fetch("/api/games");
      if (!res.ok) return null;
      const data = coerceArray(await res.json(), ["games", "data", "results"]);
      apiCache.games = { data, expires: Date.now() + API_CACHE_MS };
      return data;
    } catch {
      return null;
    }
  }

  async function fetchFriendRequestsCached() {
    if (apiCache.requests.expires > Date.now()) {
      return apiCache.requests.count;
    }

    const endpoints = ["/api/friends/requests/incoming", "/api/friends/requests"];
    for (const endpoint of endpoints) {
      try {
        const res = await fetch(endpoint);
        if (res.status === 404) continue;
        if (!res.ok) continue;
        const count = parseRequestCount(await res.json());
        apiCache.requests = { count, expires: Date.now() + API_CACHE_MS };
        return count;
      } catch {
        continue;
      }
    }

    apiCache.requests = { count: 0, expires: Date.now() + API_CACHE_MS };
    return 0;
  }

  function syncHomeOnlineStatus(page, friends) {
    const welcome = page.querySelector(".v07-home-welcome");
    if (!welcome) return;

    const onlineCount = friends.filter(friendIsOnline).length;
    let status = page.querySelector(".v07-home-status");

    if (onlineCount <= 0) {
      status?.remove();
      return;
    }

    if (!status) {
      status = document.createElement("p");
      status.className = "v07-home-status";
      status.dataset.v07Injected = "1";
      welcome.insertAdjacentElement("afterend", status);
    }

    status.textContent = `${onlineCount} friend${onlineCount === 1 ? "" : "s"} online right now.`;
  }

  function ensureFriendStatusDot(card) {
    let wrap = card.querySelector(".friend-avatar-wrap");
    const avatar = card.querySelector(".friend-avatar, img");

    if (!wrap && avatar) {
      if (avatar.parentElement && avatar.parentElement !== card) {
        wrap = avatar.parentElement;
        if (!wrap.classList.contains("friend-avatar-wrap")) {
          wrap.classList.add("friend-avatar-wrap");
        }
      } else {
        wrap = document.createElement("div");
        wrap.className = "friend-avatar-wrap";
        avatar.parentNode.insertBefore(wrap, avatar);
        wrap.appendChild(avatar);
      }
    }

    if (!wrap) return null;

    let dot = wrap.querySelector(".status-dot");
    if (!dot) {
      dot = document.createElement("span");
      dot.className = "status-dot";
      dot.setAttribute("aria-hidden", "true");
      wrap.appendChild(dot);
    }

    return dot;
  }

  function syncFriendOnlineDots(friends) {
    const onlineIds = new Set();
    const onlineNames = new Set();

    friends.forEach((friend) => {
      if (!friendIsOnline(friend)) return;
      const id = friendId(friend);
      const name = friendName(friend);
      if (id) onlineIds.add(id);
      if (name) onlineNames.add(name);
    });

    document.querySelectorAll(".friend-card, a.friend-card").forEach((card) => {
      const cardId = extractFriendIdFromCard(card);
      const cardName = card.querySelector(".friend-name")?.textContent?.trim().toLowerCase() || "";
      const isOnline =
        (cardId && onlineIds.has(cardId)) || (cardName && onlineNames.has(cardName));

      if (!isOnline) {
        card.querySelector(".status-dot")?.remove();
        return;
      }

      const dot = ensureFriendStatusDot(card);
      if (!dot) return;
      dot.classList.add("online");
      dot.classList.remove("offline");
    });
  }

  function restoreGameMeta(page) {
    if (!page) return;
    page
      .querySelectorAll(".games-grid > .game-card .game-card-meta, .games-grid > a.game-card .game-card-meta")
      .forEach((meta) => {
        if (meta.dataset.v07OrigMeta == null) return;
        meta.textContent = meta.dataset.v07OrigMeta;
        delete meta.dataset.v07OrigMeta;
      });
  }

  function syncGamePlayerCounts(page, games) {
    const counts = new Map();

    games.forEach((game) => {
      const playing = game?.playing ?? game?.player_count ?? game?.players ?? game?.active_players;
      if (playing == null) return;
      if (game?.id != null) counts.set(String(game.id), playing);
      if (game?.slug) counts.set(String(game.slug), playing);
    });

    page.querySelectorAll(".games-grid > .game-card, .games-grid > a.game-card").forEach((card) => {
      const key = extractGameKeyFromCard(card);
      if (!key || !counts.has(key)) return;
      const meta = card.querySelector(".game-card-meta");
      if (!meta) return;
      if (meta.dataset.v07OrigMeta == null) meta.dataset.v07OrigMeta = meta.textContent;
      const count = counts.get(key);
      meta.textContent = `${count} playing`;
    });
  }

  function syncFriendRequestBadge(count) {
    const link = document.querySelector(".v07-nav-strip-inner #my-profile-btn");
    if (!link) return;

    let badge = link.querySelector(".v07-friend-req-badge");
    if (count <= 0) {
      badge?.remove();
      return;
    }

    if (!badge) {
      badge = document.createElement("span");
      badge.className = "v07-friend-req-badge";
      badge.dataset.v07Injected = "1";
      link.appendChild(badge);
    }

    badge.textContent = ` (${count})`;
  }

  function clearPortalApiUi() {
    const page = document.querySelector(".page");
    document.querySelectorAll(".v07-home-status, .v07-friend-req-badge").forEach((el) => el.remove());
    document.querySelectorAll(".friend-card .status-dot, a.friend-card .status-dot").forEach((dot) => dot.remove());
    page?.querySelector(".v07-place-strip")?.remove();
    restoreGameMeta(page);
    apiCache.friends = { expires: 0, data: null };
    apiCache.games = { expires: 0, data: null };
    apiCache.requests = { expires: 0, count: 0 };
  }

  async function refreshPortalData() {
    if (!document.documentElement.classList.contains("v07-retro")) return;
    if (!cfg.onlineDots && !cfg.liveStats) return;

    const page = document.querySelector(".page");
    const onHome = isHomePage();
    const onGame = isGamePage();
    const needFriends = cfg.onlineDots || (cfg.liveStats && onHome);
    const needGames = cfg.liveStats && (onHome || onGame);
    const needRequests = cfg.liveStats;

    const friendsPromise =
      needFriends && (onHome || document.querySelector(".friend-card"))
        ? fetchFriendsCached()
        : Promise.resolve(null);
    const gamesPromise = needGames ? fetchGamesCached() : Promise.resolve(null);
    const requestsPromise = needRequests ? fetchFriendRequestsCached() : Promise.resolve(0);

    const [friends, games, requestCount] = await Promise.all([
      friendsPromise,
      gamesPromise,
      requestsPromise
    ]);

    if (friends && cfg.liveStats && page && onHome) syncHomeOnlineStatus(page, friends);
    else page?.querySelector(".v07-home-status")?.remove();

    if (friends && cfg.onlineDots) {
      syncFriendOnlineDots(friends);
    } else {
      document.querySelectorAll(".friend-card .status-dot, a.friend-card .status-dot").forEach((dot) => dot.remove());
    }

    if (page && onHome && games && cfg.liveStats) syncGamePlayerCounts(page, games);
    else if (page && onHome && !cfg.liveStats) restoreGameMeta(page);

    if (games && cfg.liveStats && onGame) syncGameDetailLive(games);
    else if (!cfg.liveStats || !onGame) document.querySelector(".v07-place-strip")?.remove();

    if (cfg.liveStats) syncFriendRequestBadge(requestCount || 0);
    else syncFriendRequestBadge(0);
  }

  function startPortalPoll() {
    if (portalPollTimer) clearInterval(portalPollTimer);
    portalPollTimer = null;
    if (!cfg.onlineDots && !cfg.liveStats) {
      clearPortalApiUi();
      return;
    }
    refreshPortalData();
    portalPollTimer = setInterval(refreshPortalData, API_POLL_MS);
  }

  function stopPortalPoll() {
    if (portalPollTimer) clearInterval(portalPollTimer);
    portalPollTimer = null;
    clearPortalApiUi();
  }

  function findHomeInsertPoint(page) {
    return (
      page.querySelector(".section-header") ||
      page.querySelector("#friends-carousel, .carousel-wrap") ||
      page.querySelector(".games-grid") ||
      page.firstElementChild
    );
  }

  function buildHomeWelcome(name) {
    const el = document.createElement("p");
    el.className = "v07-home-welcome";
    el.dataset.v07Injected = "1";
    el.textContent = `Welcome back, ${name}.`;
    return el;
  }

  function homePlaceCards(page) {
    return Array.from(page.querySelectorAll(".games-grid > .game-card, .games-grid > a.game-card"))
      .filter((card) => !card.hidden && card.style.display !== "none")
      .slice(0, 5);
  }

  function isLoggedOut() {
    return !document.getElementById("logout-btn") &&
      !document.querySelector(".navbar-actions #my-profile-btn");
  }

  function buildAuthPanel() {
    const side = document.createElement("div");
    side.className = "v07-home-robricks-side v07-home-auth-panel";
    side.dataset.v07Injected = "1";
    side.innerHTML =
      "<h2>Login</h2>" +
      '<form class="v07-auth-form" action="/login" method="post">' +
        '<label class="v07-auth-label">Username<input class="v07-auth-input" type="text" name="username" autocomplete="username" /></label>' +
        '<label class="v07-auth-label">Password<input class="v07-auth-input" type="password" name="password" autocomplete="current-password" /></label>' +
        '<button class="v07-auth-submit" type="submit">Log In</button>' +
      "</form>" +
      '<div class="v07-auth-divider"></div>' +
      '<p class="v07-auth-new">New to Vortex?</p>' +
      '<a class="v07-auth-signup-btn" href="/register"></a>';
    return side;
  }

  function updateHomeSectionTitles(page) {
    const headers = Array.from(page.querySelectorAll(".section-header"));
    headers.forEach((header, index) => {
      const title = header.querySelector(".section-title");
      if (!title) return;
      if (index === 0) title.textContent = "Friends";
      else if (index === 1) title.textContent = "Places";
    });
  }

  function capHomeGames(page) {
    const grid = page.querySelector(".games-grid");
    if (!grid) return;
    grid.querySelectorAll(":scope > .game-card, :scope > a.game-card").forEach((card, index) => {
      const hide = index >= HOME_GAMES_CAP;
      card.hidden = hide;
      card.style.display = hide ? "none" : "";
    });
  }

  function unpatchHome(page) {
    page = page || document.querySelector(".page");
    if (!page) return;

    page
      .querySelectorAll(".v07-home-welcome, .v07-home-news, .v07-home-status, .v07-home-links, .v07-home-robricks")
      .forEach((el) => el.remove());
    page.querySelectorAll(".games-grid > .game-card, .games-grid > a.game-card").forEach((card) => {
      card.hidden = false;
      card.style.display = "";
    });
    restoreGameMeta(page);
    delete page.dataset.v07HomePatched;
  }

  function patchHome() {
    if (!document.documentElement.classList.contains("v07-retro")) return;

    const page = document.querySelector(".page");
    if (!page) return;

    if (!isHomePage()) {
      unpatchHome(page);
      return;
    }

    if (cfg.welcome) {
      syncHomeWelcome(page);
      if (!resolveDisplayName()) {
        ensureUsernameCached().then((fetched) => {
          if (!fetched || !isHomePage()) return;
          const livePage = document.querySelector(".page");
          if (livePage) syncHomeWelcome(livePage);
        });
      }
    } else {
      page.querySelector(".v07-home-welcome")?.remove();
    }

    updateHomeSectionTitles(page);
    page.querySelector(".v07-home-links")?.remove();

    if (cfg.capGames) capHomeGames(page);
    else {
      page.querySelectorAll(".games-grid > .game-card, .games-grid > a.game-card").forEach((card) => {
        card.hidden = false;
        card.style.display = "";
      });
    }

    if (!cfg.liveStats) restoreGameMeta(page);

    page.dataset.v07HomePatched = "1";
    if (cfg.onlineDots || cfg.liveStats) deferPortalRefresh();
  }

  let portalRefreshQueued = false;

  function deferPortalRefresh() {
    if (portalRefreshQueued) return;
    portalRefreshQueued = true;
    setTimeout(() => {
      portalRefreshQueued = false;
      refreshPortalData();
    }, 0);
  }

  const FOOTER_VERSION = "3";

  const FOOTER_LINKS = [
    { label: "Terms of Service", href: "/terms" },
    { label: "Privacy Policy", href: "/privacy" }
  ];

  function extraFooterLinksFromSaved(footer) {
    const saved = footer.dataset.v07OriginalHtml;
    if (!saved) return [];

    const tmp = document.createElement("div");
    tmp.innerHTML = saved;

    const skip = new Set(
      FOOTER_LINKS.filter((item) => item.href).map((item) => item.label.toLowerCase())
    );

    const extras = [];
    tmp.querySelectorAll(".site-footer-links a").forEach((anchor) => {
      const label = anchor.textContent.trim();
      if (!label || skip.has(label.toLowerCase())) return;
      const href = anchor.getAttribute("href");
      if (!href) return;
      extras.push({ label, href });
    });

    return extras;
  }

  function buildFooterLinks(origin, footer) {
    const wrap = document.createElement("div");
    wrap.className = "site-footer-links";
    wrap.dataset.v07Injected = "1";

    const items = [
      ...FOOTER_LINKS.filter((item) => item.href),
      ...extraFooterLinksFromSaved(footer)
    ];

    items.forEach((item) => {
      const link = document.createElement("a");
      link.textContent = item.label;
      link.href = item.href.startsWith("http") ? item.href : origin + item.href;
      wrap.appendChild(link);
    });

    return wrap;
  }

  function buildFooterLegal() {
    const block = document.createElement("div");
    block.className = "v07-footer-legal";
    block.dataset.v07Injected = "1";
    block.innerHTML =
      "<p>&copy; 2007 Vortex Corporation. Vortex and the Vortex logo are trademarks of Vortex Corporation.</p>";
    return block;
  }

  function mountFooterCopy() {
    if (!document.documentElement.classList.contains("v07-retro")) return;

    const footer = document.querySelector(".site-footer");
    if (!footer) return;

    if (footer.dataset.v07FooterReady && footer.dataset.v07FooterVersion === FOOTER_VERSION) {
      return;
    }

    if (!footer.dataset.v07OriginalHtml) {
      footer.dataset.v07OriginalHtml = footer.innerHTML;
    }

    const origin = window.location.origin;
    footer.replaceChildren(buildFooterLegal(), buildFooterLinks(origin, footer));
    footer.dataset.v07FooterReady = "1";
    footer.dataset.v07FooterVersion = FOOTER_VERSION;
  }

  function teardownFooterCopy() {
    const footer = document.querySelector(".site-footer");
    if (!footer?.dataset.v07FooterReady) return;

    if (footer.dataset.v07OriginalHtml) {
      footer.innerHTML = footer.dataset.v07OriginalHtml;
      delete footer.dataset.v07OriginalHtml;
    }

    delete footer.dataset.v07FooterReady;
    delete footer.dataset.v07FooterVersion;
  }

  let navbarSyncQueued = false;
  let logoutDelegateBound = false;
  let profileDelegateBound = false;

  function queueNavbarSync() {
    if (navbarSyncQueued) return;
    navbarSyncQueued = true;
    setTimeout(() => {
      navbarSyncQueued = false;
      ensureOgNavbar();
    }, 0);
  }

  function bindProfileDelegate() {
    if (profileDelegateBound) return;
    profileDelegateBound = true;

    document.addEventListener(
      "click",
      (event) => {
        if (!document.documentElement.classList.contains("v07-retro")) return;

        const clicked = event.target.closest(".v07-nav-strip-inner #my-profile-btn");
        if (!clicked) return;

        const href = resolveProfileHref();
        if (href && isValidProfileHref(clicked.href)) return;

        const fresh = document.querySelector(".navbar-actions #my-profile-btn");
        if (fresh && isValidProfileHref(fresh.href)) {
          event.preventDefault();
          event.stopPropagation();
          storeProfileHref(fresh.href);
          clicked.href = fresh.href;
          fresh.click();
          return;
        }

        if (href) {
          event.preventDefault();
          window.location.href = href;
        }
      },
      true
    );
  }

  function bindLogoutDelegate() {
    if (logoutDelegateBound) return;
    logoutDelegateBound = true;

    document.addEventListener(
      "click",
      (event) => {
        if (!document.documentElement.classList.contains("v07-retro")) return;

        const clicked = event.target.closest("#logout-btn");
        if (!clicked?.closest(".v07-nav-banner-left")) return;

        const fresh = document.querySelector(".navbar-actions #logout-btn");
        if (fresh && fresh !== clicked) {
          event.preventDefault();
          event.stopPropagation();
          fresh.click();
        }
      },
      true
    );
  }

  function mountBannerUtility(bannerLeft, el, className) {
    if (!bannerLeft || !el) return el;

    el.classList.add(className);

    if (className === "v07-nav-utility") {
      bannerLeft.insertBefore(el, bannerLeft.firstChild);
      return el;
    }

    const logout = bannerLeft.querySelector("#logout-btn");
    if (logout) {
      bannerLeft.insertBefore(el, logout.nextSibling);
    } else {
      bannerLeft.appendChild(el);
    }

    return el;
  }

  function injectLogoutFromCache(bannerLeft) {
    if (sessionStorage.getItem("v07-has-logout") !== "1") return null;

    const html = sessionStorage.getItem("v07-logout-html");
    if (!html) return null;

    const tmp = document.createElement("div");
    tmp.innerHTML = html.trim();
    const btn = tmp.querySelector("#logout-btn");
    if (!btn) return null;

    btn.dataset.v07LogoutCached = "1";
    return mountBannerUtility(bannerLeft, btn, "v07-nav-utility");
  }

  function pruneNavbarActions(nav) {
    const actions = nav.querySelector(":scope > .navbar-actions");
    if (!actions) return;

    const banner = nav.querySelector(".v07-nav-banner");

    if (banner?.querySelector("#logout-btn")) {
      actions.querySelector("#logout-btn")?.remove();
    }

    if (banner?.querySelector('a[href="/download"]')) {
      actions.querySelector('a[href="/download"]')?.remove();
    }

    if (!actions.children.length) {
      actions.remove();
    }
  }

  function syncStripProfileHref() {
    const profileLink = document.querySelector(".v07-nav-strip-inner #my-profile-btn");
    if (!profileLink) return;
    applyProfileHref(profileLink);
    refreshStripActiveState();
  }

  function syncBannerUtilities(retriesLeft = 4) {
    const nav = document.querySelector(".navbar");
    const banner = nav?.querySelector(".v07-nav-banner");
    const bannerLeft = banner?.querySelector(".v07-nav-banner-left");
    if (!nav || !bannerLeft) return;

    const actions = nav.querySelector(":scope > .navbar-actions") || document.querySelector(".navbar-actions");
    const freshLogout = actions?.querySelector("#logout-btn");
    const bannerLogout = bannerLeft.querySelector("#logout-btn");

    if (freshLogout && freshLogout !== bannerLogout) {
      bannerLogout?.remove();
      mountBannerUtility(bannerLeft, freshLogout, "v07-nav-utility");
      cacheNavSession(actions);
    } else if (!bannerLogout) {
      const anyLogout = document.getElementById("logout-btn");
      if (anyLogout && anyLogout !== bannerLogout && !banner.contains(anyLogout)) {
        mountBannerUtility(bannerLeft, anyLogout, "v07-nav-utility");
        cacheNavSession(actions || anyLogout.parentElement);
      } else if (!anyLogout) {
        injectLogoutFromCache(bannerLeft);
      }
    }

    const freshDownload = actions?.querySelector('a[href="/download"]');
    const bannerDownload = bannerLeft.querySelector('a[href="/download"]');
    if (freshDownload && freshDownload !== bannerDownload) {
      bannerDownload?.remove();
      mountBannerUtility(bannerLeft, freshDownload, "v07-nav-play");
    }

    const freshProfile = actions?.querySelector("#my-profile-btn");
    if (freshProfile && isValidProfileHref(freshProfile.href)) {
      storeProfileHref(freshProfile.href);
    }

    syncStripProfileHref();
    pruneNavbarActions(nav);

    if (!bannerLeft.querySelector("#logout-btn") && retriesLeft > 0) {
      requestAnimationFrame(() => syncBannerUtilities(retriesLeft - 1));
    }
  }

  function ensureOgNavbar() {
    if (!document.documentElement.classList.contains("v07-retro")) return;

    const nav = document.querySelector(".navbar");
    if (!nav) return;

    bindLogoutDelegate();
    bindProfileDelegate();

    if (nav.dataset.v07NavReady && nav.dataset.v07NavVersion !== NAV_VERSION) {
      teardownOgNavbar();
    }

    if (!nav.dataset.v07NavReady) {
      initOgNavbar();
      return;
    }

    if (!nav.querySelector(".v07-nav-banner")) {
      delete nav.dataset.v07NavReady;
      delete nav.dataset.v07NavVersion;
      initOgNavbar();
      return;
    }

    syncBannerUtilities();
    syncStripProfileHref();
  }

  function tagNavLink(el) {
    if (!el) return;
    const id = el.id;
    el.className = "v07-nav-link";
    if (id) el.id = id;
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function profileHref(userId) {
    return `${window.location.origin}/users/${userId}/profile`;
  }

  function searchPageHref(query) {
    return `${window.location.origin}/search?q=${encodeURIComponent(query)}`;
  }

  function teardownOgSearch(searchRoot) {
    if (!searchRoot) return;

    const binding = searchBindings.get(searchRoot);
    if (binding) {
      binding.abort();
      searchBindings.delete(searchRoot);
    }

    const wrap = searchRoot.querySelector(".v07-search-wrap");
    const input = searchRoot.querySelector('input[name="q"], #search-input');
    searchRoot.querySelector(".v07-search-dropdown")?.remove();
    if (wrap && input && wrap.parentNode) {
      wrap.parentNode.insertBefore(input, wrap);
      wrap.remove();
    }

    delete searchRoot.dataset.v07SearchReady;
  }

  function initOgSearch(searchRoot) {
    if (!searchRoot || !document.documentElement.classList.contains("v07-retro")) return;
    if (searchRoot.dataset.v07SearchReady) return;

    const form = searchRoot.querySelector("form");
    const input = searchRoot.querySelector('input[name="q"], #search-input');
    if (!form || !input) return;

    let wrap = input.closest(".v07-search-wrap");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.className = "v07-search-wrap";
      input.parentNode.insertBefore(wrap, input);
      wrap.appendChild(input);
    }

    let dropdown = form.querySelector(".v07-search-dropdown");
    if (!dropdown) {
      dropdown = document.createElement("div");
      dropdown.className = "v07-search-dropdown";
      dropdown.hidden = true;
      dropdown.setAttribute("role", "listbox");
      dropdown.id = "v07-search-dropdown";
      form.appendChild(dropdown);
    }

    input.setAttribute("autocomplete", "off");
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-expanded", "false");
    input.setAttribute("aria-controls", dropdown.id);
    input.setAttribute("aria-autocomplete", "list");

    const avatarCache = new Map();
    const controller = new AbortController();
    const { signal } = controller;

    let debounceTimer = null;
    let fetchAbort = null;
    let activeIndex = -1;
    let currentResults = [];
    let currentQuery = "";
    let closeTimer = null;

    function setExpanded(open) {
      input.setAttribute("aria-expanded", open ? "true" : "false");
    }

    function closeDropdown() {
      dropdown.hidden = true;
      dropdown.innerHTML = "";
      activeIndex = -1;
      currentResults = [];
      setExpanded(false);
    }

    function openDropdown() {
      dropdown.hidden = false;
      setExpanded(true);
    }

    function highlightActive() {
      dropdown.querySelectorAll(".v07-search-hit").forEach((el, index) => {
        el.classList.toggle("v07-search-hit-active", index === activeIndex);
        if (index === activeIndex) {
          el.setAttribute("aria-selected", "true");
          el.scrollIntoView({ block: "nearest" });
        } else {
          el.removeAttribute("aria-selected");
        }
      });
    }

    function loadAvatars(users) {
      const applyCached = () => {
        users.forEach((u) => {
          const src = avatarCache.get(String(u.id));
          if (!src) return;
          dropdown.querySelectorAll(`img[data-uid="${u.id}"]`).forEach((img) => {
            if (!img.src) img.src = src;
          });
        });
      };

      const missing = users
        .map((u) => String(u.id))
        .filter((id) => !avatarCache.has(id));

      applyCached();
      if (!missing.length) return;

      fetch(`/api/users/avatar-pictures?ids=${missing.join(",")}`, { signal })
        .then((r) => (r.ok ? r.json() : {}))
        .then((map) => {
          for (const [uid, dataUri] of Object.entries(map || {})) {
            avatarCache.set(String(uid), dataUri);
          }
          users.forEach((u) => {
            const src = avatarCache.get(String(u.id));
            if (!src) return;
            dropdown.querySelectorAll(`img[data-uid="${u.id}"]`).forEach((img) => {
              if (!img.src) img.src = src;
            });
          });
        })
        .catch(() => {});
    }

    function renderStatus(message) {
      dropdown.innerHTML =
        '<div class="v07-search-head">Players</div>' +
        `<div class="v07-search-status">${escapeHtml(message)}</div>`;
      openDropdown();
    }

    function renderResults(query, results) {
      currentQuery = query;
      currentResults = results;
      activeIndex = -1;

      dropdown.innerHTML = "";

      const head = document.createElement("div");
      head.className = "v07-search-head";
      head.textContent = "Players";
      dropdown.appendChild(head);

      if (!results.length) {
        const empty = document.createElement("div");
        empty.className = "v07-search-status";
        empty.textContent = `No players named "${query}".`;
        dropdown.appendChild(empty);
        openDropdown();
        return;
      }

      const list = document.createElement("div");
      list.className = "v07-search-list";

      results.forEach((user, index) => {
        const hit = document.createElement("a");
        hit.className = "v07-search-hit";
        hit.href = profileHref(user.id);
        hit.setAttribute("role", "option");
        hit.dataset.index = String(index);

        const img = document.createElement("img");
        img.className = "v07-search-hit-avatar";
        img.alt = "";
        img.dataset.uid = String(user.id);
        const cached = avatarCache.get(String(user.id));
        if (cached) img.src = cached;

        const name = document.createElement("span");
        name.className = "v07-search-hit-name";
        name.textContent = user.username;

        hit.appendChild(img);
        hit.appendChild(name);

        hit.addEventListener(
          "mouseenter",
          () => {
            activeIndex = index;
            highlightActive();
          },
          { signal }
        );

        hit.addEventListener(
          "mousedown",
          (event) => {
            event.preventDefault();
          },
          { signal }
        );

        list.appendChild(hit);
      });

      dropdown.appendChild(list);

      const all = document.createElement("a");
      all.className = "v07-search-all";
      all.href = searchPageHref(query);
      all.textContent = `More results for "${query}" »`;
      dropdown.appendChild(all);

      openDropdown();
      highlightActive();
      loadAvatars(results);
    }

    async function runSearch(query) {
      if (fetchAbort) fetchAbort.abort();
      fetchAbort = new AbortController();

      renderStatus("Searching players...");

      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`, {
          signal: fetchAbort.signal
        });

        if (!res.ok) {
          if (res.status === 401) {
            renderStatus("Sign in to search players.");
          } else {
            renderStatus("Search unavailable right now.");
          }
          return;
        }

        const data = await res.json();
        const results = Array.isArray(data) ? data.slice(0, SEARCH_LIMIT) : [];
        renderResults(query, results);
      } catch (err) {
        if (err.name === "AbortError") return;
        renderStatus("Search unavailable right now.");
      }
    }

    function scheduleSearch() {
      const query = input.value.trim();

      if (debounceTimer) clearTimeout(debounceTimer);

      if (query.length < SEARCH_MIN_CHARS) {
        closeDropdown();
        return;
      }

      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        runSearch(query);
      }, SEARCH_DEBOUNCE);
    }

    function goToActiveResult() {
      if (activeIndex < 0 || !currentResults[activeIndex]) return false;
      window.location.href = profileHref(currentResults[activeIndex].id);
      return true;
    }

    input.addEventListener("input", scheduleSearch, { signal });

    input.addEventListener(
      "keydown",
      (event) => {
        if (dropdown.hidden) {
          if (event.key === "ArrowDown" && input.value.trim().length >= SEARCH_MIN_CHARS) {
            scheduleSearch();
          }
          return;
        }

        if (event.key === "ArrowDown") {
          event.preventDefault();
          if (!currentResults.length) return;
          activeIndex = (activeIndex + 1) % currentResults.length;
          highlightActive();
          return;
        }

        if (event.key === "ArrowUp") {
          event.preventDefault();
          if (!currentResults.length) return;
          activeIndex = activeIndex <= 0 ? currentResults.length - 1 : activeIndex - 1;
          highlightActive();
          return;
        }

        if (event.key === "Escape") {
          event.preventDefault();
          closeDropdown();
          return;
        }

        if (event.key === "Enter") {
          if (goToActiveResult()) {
            event.preventDefault();
          }
        }
      },
      { signal }
    );

    input.addEventListener(
      "focus",
      () => {
        if (closeTimer) {
          clearTimeout(closeTimer);
          closeTimer = null;
        }
        const query = input.value.trim();
        if (query.length >= SEARCH_MIN_CHARS && !dropdown.hidden) return;
        if (query.length >= SEARCH_MIN_CHARS) scheduleSearch();
      },
      { signal }
    );

    input.addEventListener(
      "blur",
      () => {
        closeTimer = setTimeout(closeDropdown, 150);
      },
      { signal }
    );

    form.addEventListener(
      "submit",
      (event) => {
        const query = input.value.trim();
        if (!query) {
          event.preventDefault();
          return;
        }
        if (!dropdown.hidden && goToActiveResult()) {
          event.preventDefault();
        }
      },
      { signal }
    );

    searchBindings.set(searchRoot, controller);
    searchRoot.dataset.v07SearchReady = "1";
  }

  function initOgNavbar() {
    const nav = document.querySelector(".navbar");
    if (!nav) return;

    if (nav.dataset.v07NavReady && nav.dataset.v07NavVersion !== NAV_VERSION) {
      teardownOgNavbar();
    }
    if (nav.dataset.v07NavReady) {
      syncBannerUtilities();
      return;
    }

    bindLogoutDelegate();
    bindProfileDelegate();

    const logo = nav.querySelector(".navbar-logo");
    const search = nav.querySelector(".navbar-search");
    const actions = nav.querySelector(".navbar-actions");
    if (!logo || !search || !actions) return;

    const banner = document.createElement("div");
    banner.className = "v07-nav-banner";

    const bannerLeft = document.createElement("div");
    bannerLeft.className = "v07-nav-banner-left";

    const logout = actions.querySelector("#logout-btn");
    if (logout) {
      logout.classList.add("v07-nav-utility");
      bannerLeft.appendChild(logout);
    }

    const download = actions.querySelector("a[href=\"/download\"]");
    if (download) {
      download.classList.add("v07-nav-play");
      bannerLeft.appendChild(download);
    }

    logo.classList.add("v07-nav-banner-logo");
    const img = logo.querySelector("img");
    if (img) {
      if (!img.dataset.v07OriginalSrc) {
        img.dataset.v07OriginalSrc = img.getAttribute("src") || "/logo.png";
      }
      img.src = chrome.runtime.getURL("assets/vortex-logo.png");
    }

    const bannerRight = document.createElement("div");
    bannerRight.className = "v07-nav-banner-right";
    search.classList.add("v07-nav-search");
    bannerRight.appendChild(search);

    banner.appendChild(bannerLeft);
    banner.appendChild(logo);
    banner.appendChild(bannerRight);

    const strip = document.createElement("div");
    strip.className = "v07-nav-strip";

    const stripInner = document.createElement("div");
    stripInner.className = "v07-nav-strip-inner";

    cacheNavSession(actions);
    buildStripLinks(stripInner, actions);

    strip.appendChild(stripInner);

    nav.insertBefore(banner, nav.firstChild);
    nav.appendChild(strip);

    savedDiscord = actions.querySelector(".btn-discord");
    if (savedDiscord) savedDiscord.remove();
    actions.remove();

    nav.dataset.v07NavReady = "1";
    nav.dataset.v07NavVersion = NAV_VERSION;

    initOgSearch(search);
    refreshStripActiveState();
  }

  function teardownOgNavbar() {
    const nav = document.querySelector(".navbar");
    if (!nav || !nav.dataset.v07NavReady) return;

    const banner = nav.querySelector(".v07-nav-banner");
    const strip = nav.querySelector(".v07-nav-strip");
    if (!banner) return;

    const logo = banner.querySelector(".navbar-logo");
    const search = banner.querySelector(".navbar-search");
    const download = banner.querySelector("a[href=\"/download\"]");
    const logout = banner.querySelector("#logout-btn");
    const stripInner = strip?.querySelector(".v07-nav-strip-inner");

    const actions = document.createElement("div");
    actions.className = "navbar-actions";

    const catalog = stripInner?.querySelector("a[href=\"/catalog\"], a[href$=\"/catalog\"]");
    if (catalog) {
      catalog.classList.remove("v07-nav-link");
      actions.appendChild(catalog);
    }

    if (download) {
      download.classList.remove("v07-nav-play");
      actions.appendChild(download);
    }

    if (logout) {
      logout.classList.remove("v07-nav-utility");
      actions.appendChild(logout);
    }

    stripInner?.querySelectorAll("[data-v07-injected]").forEach((el) => el.remove());

    stripInner?.querySelectorAll(".v07-nav-link").forEach((el) => {
      if (el.dataset.v07OriginalLabel) {
        el.textContent = el.dataset.v07OriginalLabel;
        delete el.dataset.v07OriginalLabel;
      }
      el.classList.remove("v07-nav-link", "v07-nav-active");
      el.removeAttribute("aria-current");
      actions.appendChild(el);
    });

    if (logo) {
      logo.classList.remove("v07-nav-banner-logo");
      const img = logo.querySelector("img");
      if (img?.dataset.v07OriginalSrc) {
        img.src = img.dataset.v07OriginalSrc;
      }
    }

    if (search) {
      teardownOgSearch(search);
      search.classList.remove("v07-nav-search");
    }

    banner.remove();
    strip?.remove();

    if (logo) nav.appendChild(logo);
    if (search) nav.appendChild(search);
    if (savedDiscord) actions.appendChild(savedDiscord);
    nav.appendChild(actions);
    savedDiscord = null;

    delete nav.dataset.v07NavReady;
    delete nav.dataset.v07NavVersion;
  }

  function refreshStripActiveState() {
    const stripInner = document.querySelector(".v07-nav-strip-inner");
    if (!stripInner) return;

    const currentPath = window.location.pathname.toLowerCase().replace(/\/$/, "") || "/";
    const links = stripInner.querySelectorAll(".v07-nav-link");

    NAV_SPEC.forEach((spec, index) => {
      const el = links[index];
      if (!el) return;
      el.classList.remove("v07-nav-active");
      el.removeAttribute("aria-current");
      if (isNavPathActive(spec, currentPath, el)) {
        el.classList.add("v07-nav-active");
        el.setAttribute("aria-current", "page");
      }
    });
  }

  function handleRouteChange() {
    if (!document.documentElement.classList.contains("v07-retro")) return;

    onReady(() => {
      ensureOgNavbar();
      initOgSearch(document.querySelector(".navbar-search"));
      refreshStripActiveState();
    }, ".navbar");
    ensureFriendsCarousel();
    scheduleRowUpdate();
    cacheUsernameFromPage();
    applyRoutePatches();
    deferPortalRefresh();
    mountFooterCopy();
  }

  function watchNavbar() {
    if (window.__v07NavWatch) return;
    window.__v07NavWatch = true;

    const observer = new MutationObserver(() => {
      if (!document.documentElement.classList.contains("v07-retro")) return;
      queueNavbarSync();
    });

    const attach = () => {
      const nav = document.querySelector(".navbar");
      if (!nav) return false;
      observer.observe(nav, { childList: true, subtree: true });
      return true;
    };

    if (!attach()) {
      onReady(attach, ".navbar");
    }
  }

  // playvortex is a spa — hook history so we re-run on client nav
  function hookSpaNavigation() {
    if (window.__v07NavHooked) return;
    window.__v07NavHooked = true;

    watchNavbar();

    const notify = () => setTimeout(handleRouteChange, 0);

    window.addEventListener("popstate", notify);

    const { pushState, replaceState } = history;
    history.pushState = function (...args) {
      const result = pushState.apply(this, args);
      notify();
      return result;
    };
    history.replaceState = function (...args) {
      const result = replaceState.apply(this, args);
      notify();
      return result;
    };
  }

  function findFriendsRows() {
    return [...document.querySelectorAll(".friends-row")];
  }

  function findFriendsRow() {
    return document.querySelector(".friends-row");
  }

  function getRowFriendCount(row) {
    return rowFriendCounts.get(row) ?? -1;
  }

  function setRowFriendCount(row, count) {
    rowFriendCounts.set(row, count);
  }

  function getWrap(row) {
    return row.closest("#friends-carousel, .carousel-wrap");
  }

  function countFriends(row) {
    const direct = row.querySelectorAll(":scope > .friend-card").length;
    if (direct > 0) return direct;
    return row.querySelectorAll(".v07-friends-page .friend-card").length;
  }

  function unwrapPages(row) {
    isMutating = true;
    try {
      row.querySelectorAll(".v07-friends-page").forEach((page) => {
        while (page.firstChild) {
          row.insertBefore(page.firstChild, page);
        }
        page.remove();
      });
      delete row.dataset.v07Paginated;
      row.scrollLeft = 0;
    } finally {
      isMutating = false;
    }
  }

  // friends carousel — 9 cards per "page", « » arrows
  function paginateFriendsRow(row) {
    if (!document.documentElement.classList.contains("v07-retro")) return;

    const cards = [...row.querySelectorAll(":scope > .friend-card")];
    if (cards.length === 0) return;

    const lastFriendCount = getRowFriendCount(row);

    if (row.dataset.v07Paginated && cards.length === 0) {
      const paged = row.querySelectorAll(".v07-friends-page .friend-card").length;
      if (paged === lastFriendCount) return;
    }

    if (row.dataset.v07Paginated) {
      const inPages = row.querySelectorAll(".v07-friends-page .friend-card").length;
      if (inPages === cards.length && cards.length === lastFriendCount) {
        updateCarouselArrows(row);
        return;
      }
      unwrapPages(row);
    }

    isMutating = true;
    try {
      const fragment = document.createDocumentFragment();
      for (let i = 0; i < cards.length; i += PER_PAGE) {
        const page = document.createElement("div");
        page.className = "v07-friends-page";
        for (let j = i; j < i + PER_PAGE && j < cards.length; j++) {
          page.appendChild(cards[j]);
        }
        fragment.appendChild(page);
      }
      row.appendChild(fragment);
      row.dataset.v07Paginated = "1";
      row.scrollLeft = 0;
      setRowFriendCount(row, cards.length);
    } finally {
      isMutating = false;
    }

    updateCarouselArrows(row);
    deferPortalRefresh();
  }

  function retrofitCarouselArrow(btn, glyph) {
    if (!btn) return;
    btn.querySelector("svg")?.remove();
    btn.textContent = glyph;
    btn.setAttribute("aria-label", glyph === "«" ? "Previous page" : "Next page");
  }

  function updateCarouselArrows(row) {
    const wrap = getWrap(row);
    if (!wrap) return;

    const prev = wrap.querySelector(".carousel-prev");
    const next = wrap.querySelector(".carousel-next");
    retrofitCarouselArrow(prev, "«");
    retrofitCarouselArrow(next, "»");
    const pageCount = row.querySelectorAll(".v07-friends-page").length;
    const singlePage = pageCount <= 1;

    wrap.classList.toggle("v07-friends-single", singlePage);

    if (prev) prev.hidden = singlePage || row.scrollLeft <= 1;
    if (next) {
      next.hidden = singlePage || row.scrollLeft + row.clientWidth >= row.scrollWidth - 2;
    }
  }

  function handleRowUpdate(row) {
    row = row || pendingFriendsRow || findFriendsRow();
    pendingFriendsRow = null;
    if (!row || !document.documentElement.classList.contains("v07-retro")) return;

    if (row.querySelector(":scope > .skel-card")) return;

    const lastFriendCount = getRowFriendCount(row);

    if (row.dataset.v07Paginated && !row.querySelector(":scope > .friend-card")) {
      const stable = countFriends(row);
      if (stable > 0 && stable === lastFriendCount) return;
    }

    if (row.querySelector(":scope > .empty-msg")) {
      if (row.querySelector(".v07-friends-page")) unwrapPages(row);
      setRowFriendCount(row, 0);
      updateCarouselArrows(row);
      return;
    }

    if (row.querySelector(":scope > .friend-card")) {
      paginateFriendsRow(row);
      return;
    }

    if (row.querySelector(".v07-friends-page")) {
      updateCarouselArrows(row);
    }
  }

  function scheduleRowUpdate(row) {
    if (row) pendingFriendsRow = row;
    if (rowUpdateQueued || isMutating) return;
    rowUpdateQueued = true;
    setTimeout(() => {
      rowUpdateQueued = false;
      handleRowUpdate();
    }, 0);
  }

  function bindFriendsRow(row) {
    if (!row || boundFriendsRows.has(row)) return;
    boundFriendsRows.add(row);

    const observer = new MutationObserver(() => {
      if (isMutating) return;
      scheduleRowUpdate(row);
    });
    observer.observe(row, { childList: true });

    let scrollQueued = false;
    row.addEventListener(
      "scroll",
      () => {
        if (scrollQueued) return;
        scrollQueued = true;
        requestAnimationFrame(() => {
          scrollQueued = false;
          updateCarouselArrows(row);
        });
      },
      { passive: true }
    );
  }

  function ensureFriendsCarousel() {
    if (!document.documentElement.classList.contains("v07-retro")) return;

    const rows = findFriendsRows();
    rows.forEach(bindFriendsRow);
    if (rows.length > 0) {
      scheduleRowUpdate(rows[0]);
    }
  }

  function initFriendsCarousel() {
    const boot = () => {
      ensureFriendsCarousel();

      if (!document.body.dataset.v07FriendsDocObs) {
        document.body.dataset.v07FriendsDocObs = "1";
        new MutationObserver(() => {
          if (!document.documentElement.classList.contains("v07-retro")) return;
          ensureFriendsCarousel();
          mountFooterCopy();
          queueNavbarSync();
        }).observe(document.body, { childList: true, subtree: true });
      }
    };

    if (carouselInit) {
      boot();
      return;
    }
    carouselInit = true;

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", boot, { once: true });
    } else {
      boot();
    }
  }

  const FORUM_API = "https://vortex07.vercel.app/api/forums";
  const FORUM_CATEGORIES = [
    { id: "general",  label: "General",       description: "General Vortex chat." },
    { id: "places",   label: "Places",        description: "Talk about games and places." },
    { id: "help",     label: "Help & Support", description: "Need a hand? Ask here." },
    { id: "offtopic", label: "Off Topic",     description: "Anything goes." },
    { id: "vortex07", label: "Vortex07",      description: "Extension feedback, bugs and ideas." }
  ];

  let forumOpen = false;
  let forumView = null;

  function forumUsername() {
    return resolveDisplayName() || sessionStorage.getItem("v07-username") || "Guest";
  }

  function forumTimeAgo(ts) {
    const diff = Date.now() - Number(ts);
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  async function forumFetch(path, opts = {}) {
    try {
      const res = await fetch(FORUM_API + path, {
        headers: { "Content-Type": "application/json" },
        ...opts
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  function getForumPage() {
    let page = document.getElementById("v07-forum-page");
    if (!page) {
      page = document.createElement("div");
      page.id = "v07-forum-page";
      page.className = "v07-forum-page";
      page.dataset.v07Injected = "1";
    }
    const sitePage = document.querySelector(".page");
    if (sitePage) {
      sitePage.style.display = "none";
      sitePage.after(page);
    } else {
      document.body.appendChild(page);
    }
    return page;
  }

  function closeForumPage() {
    forumOpen = false;
    forumView = null;
    document.getElementById("v07-forum-page")?.remove();
    const sitePage = document.querySelector(".page");
    if (sitePage) sitePage.style.display = "";
    document.querySelector(".v07-nav-link[data-v07-forum]")?.classList.remove("v07-nav-active");
  }

  function forumBreadcrumb(parts) {
    return parts.map((p, i) =>
      i < parts.length - 1
        ? `<a class="v07-forum-bc-link" data-action="${p.action}">${escapeHtml(p.label)}</a>`
        : `<span>${escapeHtml(p.label)}</span>`
    ).join(" &rsaquo; ");
  }

  function renderForumShell(breadcrumbs, innerHtml) {
    const page = getForumPage();
    page.innerHTML =
      `<div class="v07-forum-header">` +
        `<div class="v07-forum-header-inner">` +
          `<span class="v07-forum-title">Vortex07 Forums</span>` +
          `<div class="v07-forum-bc">${breadcrumbs}</div>` +
        `</div>` +
      `</div>` +
      `<div class="v07-forum-content">${innerHtml}</div>`;

    page.querySelectorAll("[data-action]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        handleForumAction(el.dataset.action, el.dataset);
      });
    });
  }

  function renderForumLoading() {
    renderForumShell(
      forumBreadcrumb([{ label: "Forums" }]),
      `<div class="v07-forum-loading"><span class="v07-forum-loading-dot"></span> Loading...</div>`
    );
  }

  async function renderForumIndex() {
    forumView = "index";
    renderForumLoading();
    const data = await forumFetch("/categories");
    const cats = data?.categories || FORUM_CATEGORIES;

    const rows = cats.map((cat) =>
      `<tr class="v07-forum-cat-row" data-action="category" data-cat="${escapeHtml(cat.id)}">` +
        `<td class="v07-forum-cat-icon">&#128172;</td>` +
        `<td class="v07-forum-cat-info">` +
          `<a class="v07-forum-cat-name" data-action="category" data-cat="${escapeHtml(cat.id)}">${escapeHtml(cat.label)}</a>` +
          `<p class="v07-forum-cat-desc">${escapeHtml(cat.description)}</p>` +
        `</td>` +
        `<td class="v07-forum-cat-count">${cat.threadCount ?? 0} threads</td>` +
      `</tr>`
    ).join("");

    renderForumShell(
      forumBreadcrumb([{ label: "Forums" }]),
      `<table class="v07-forum-table"><tbody>${rows}</tbody></table>`
    );
  }

  async function renderForumCategory(catId, page = 1) {
    forumView = { type: "category", catId, page };
    const cat = FORUM_CATEGORIES.find((c) => c.id === catId) || { id: catId, label: catId };
    renderForumLoading();

    const data = await forumFetch(`/threads?category=${catId}&page=${page}`);
    const threads = data?.threads || [];

    const rows = threads.length
      ? threads.map((t) =>
          `<tr class="v07-forum-thread-row" data-action="thread" data-tid="${escapeHtml(t.id)}" data-cat="${escapeHtml(catId)}">` +
            `<td class="v07-forum-thread-icon">${t.pinned === "1" ? "&#128204;" : "&#128196;"}</td>` +
            `<td class="v07-forum-thread-info">` +
              `<a class="v07-forum-thread-title" data-action="thread" data-tid="${escapeHtml(t.id)}" data-cat="${escapeHtml(catId)}">${escapeHtml(t.title)}</a>` +
              `<p class="v07-forum-thread-meta">by ${escapeHtml(t.author)} &mdash; ${forumTimeAgo(t.createdAt)}</p>` +
            `</td>` +
            `<td class="v07-forum-thread-replies">${t.replyCount || 0} replies</td>` +
          `</tr>`
        ).join("")
      : `<tr><td colspan="3" class="v07-forum-empty">No threads yet. Be the first to post!</td></tr>`;

    const newBtn = `<button class="v07-forum-new-btn" data-action="new-thread" data-cat="${escapeHtml(catId)}">+ New Thread</button>`;

    renderForumShell(
      forumBreadcrumb([
        { label: "Forums", action: "index" },
        { label: cat.label }
      ]),
      newBtn +
      `<table class="v07-forum-table"><tbody>${rows}</tbody></table>`
    );
  }

  async function renderForumThread(threadId, catId) {
    forumView = { type: "thread", threadId, catId };
    const cat = FORUM_CATEGORIES.find((c) => c.id === catId) || { id: catId, label: catId };
    renderForumLoading();

    const data = await forumFetch(`/threads?id=${threadId}`);
    if (!data) {
      renderForumShell(
        forumBreadcrumb([{ label: "Forums", action: "index" }, { label: cat.label, action: `category:${catId}` }, { label: "Thread" }]),
        `<div class="v07-forum-empty">Thread not found.</div>`
      );
      return;
    }

    const { thread, posts } = data;
    const postHtml = (posts || []).map((p, i) =>
      `<div class="v07-forum-post ${i % 2 === 0 ? "v07-forum-post-even" : ""}">` +
        `<div class="v07-forum-post-author">${escapeHtml(p.author)}</div>` +
        `<div class="v07-forum-post-body">${escapeHtml(p.body).replace(/\n/g, "<br>")}</div>` +
        `<div class="v07-forum-post-time">${forumTimeAgo(p.createdAt)}</div>` +
      `</div>`
    ).join("");

    const replyForm =
      `<div class="v07-forum-reply-wrap">` +
        `<h3 class="v07-forum-reply-head">Post a Reply</h3>` +
        `<textarea class="v07-forum-reply-input" id="v07-reply-box" placeholder="Write your reply..." maxlength="2000" rows="4"></textarea>` +
        `<button class="v07-forum-reply-btn" data-action="post-reply" data-tid="${escapeHtml(threadId)}">Post Reply</button>` +
      `</div>`;

    renderForumShell(
      forumBreadcrumb([
        { label: "Forums", action: "index" },
        { label: cat.label, action: `category:${catId}` },
        { label: thread.title }
      ]),
      `<h2 class="v07-forum-thread-heading">${escapeHtml(thread.title)}</h2>` +
      postHtml +
      replyForm
    );
  }

  function renderNewThreadForm(catId) {
    const cat = FORUM_CATEGORIES.find((c) => c.id === catId) || { id: catId, label: catId };
    renderForumShell(
      forumBreadcrumb([
        { label: "Forums", action: "index" },
        { label: cat.label, action: `category:${catId}` },
        { label: "New Thread" }
      ]),
      `<div class="v07-forum-new-wrap">` +
        `<h2 class="v07-forum-new-head">New Thread in ${escapeHtml(cat.label)}</h2>` +
        `<label class="v07-forum-new-label">Title` +
          `<input class="v07-forum-new-title" id="v07-thread-title" type="text" maxlength="80" placeholder="Thread title..." />` +
        `</label>` +
        `<label class="v07-forum-new-label">Message` +
          `<textarea class="v07-forum-new-body" id="v07-thread-body" maxlength="2000" rows="6" placeholder="Write your post..."></textarea>` +
        `</label>` +
        `<button class="v07-forum-reply-btn" data-action="submit-thread" data-cat="${escapeHtml(catId)}">Post Thread</button>` +
        `<button class="v07-forum-cancel-btn" data-action="category" data-cat="${escapeHtml(catId)}">Cancel</button>` +
      `</div>`
    );
  }

  async function handleForumAction(action, dataset) {
    if (action === "close") { closeForumPage(); return; }
    if (action === "index") { await renderForumIndex(); return; }

    if (action === "category") {
      await renderForumCategory(dataset.cat); return;
    }

    if (action.startsWith("category:")) {
      await renderForumCategory(action.split(":")[1]); return;
    }

    if (action === "thread") {
      await renderForumThread(dataset.tid, dataset.cat); return;
    }

    if (action === "new-thread") {
      renderNewThreadForm(dataset.cat); return;
    }

    if (action === "submit-thread") {
      const title = document.getElementById("v07-thread-title")?.value?.trim();
      const body = document.getElementById("v07-thread-body")?.value?.trim();
      if (!title || !body) return;

      const btn = document.querySelector("[data-action='submit-thread']");
      if (btn) btn.disabled = true;

      const res = await forumFetch("/threads", {
        method: "POST",
        body: JSON.stringify({ username: forumUsername(), title, body, categoryId: dataset.cat })
      });

      if (res?.thread) {
        await renderForumThread(res.thread.id, dataset.cat);
      } else {
        if (btn) btn.disabled = false;
      }
      return;
    }

    if (action === "post-reply") {
      const body = document.getElementById("v07-reply-box")?.value?.trim();
      if (!body) return;

      const btn = document.querySelector("[data-action='post-reply']");
      if (btn) btn.disabled = true;

      const res = await forumFetch("/reply", {
        method: "POST",
        body: JSON.stringify({ threadId: dataset.tid, username: forumUsername(), body })
      });

      if (res?.post && forumView?.threadId) {
        await renderForumThread(forumView.threadId, forumView.catId);
      } else {
        if (btn) btn.disabled = false;
      }
      return;
    }
  }

  function openForum() {
    forumOpen = true;
    document.querySelector(".v07-nav-link[data-v07-forum]")?.classList.add("v07-nav-active");
    renderForumIndex();
  }

  function bindForumNavClick() {
    document.addEventListener("click", (e) => {
      if (!document.documentElement.classList.contains("v07-retro")) return;

      const forumLink = e.target.closest(".v07-nav-link[data-v07-forum]");
      if (forumLink) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (forumOpen) { closeForumPage(); } else { openForum(); }
        return;
      }

      if (forumOpen && e.target.closest(".v07-nav-link")) {
        closeForumPage();
      }
    }, true);
  }

  restoreNavCache();

  hookSpaNavigation();

  chrome.storage.local.get(DEFAULTS, apply);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (!Object.keys(DEFAULTS).some((key) => changes[key])) return;

    chrome.storage.local.get(DEFAULTS, (data) => {
      const wasOn = cfg.enabled;
      cfg = readSettings(data);

      const root = document.documentElement;
      root.classList.toggle("v07-retro", cfg.enabled);
      root.classList.toggle("v07-dark", cfg.enabled && cfg.darkMode);
      applyTopbarAsset(cfg.enabled);

      if (!cfg.enabled) {
        apply(data);
        return;
      }

      if (!wasOn) {
        apply(data);
        return;
      }

      applyFeatureToggles();
    });
  });

  initFriendsCarousel();
  bindForumNavClick();
})();
