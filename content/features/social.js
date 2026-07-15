/* Social page polish + tier features (merged) */

/* ========================================================= */
/* = TIER A SOCIAL (v1.11.0) ============================== */
/* ========================================================= */

async function isUserInVortex07Cache(userId) {
  const id = safeNumber(userId);
  if (id === null) return false;

  const key = String(id);
  const readStatus = () => {
    if (Object.prototype.hasOwnProperty.call(sessionMemoryStore.statusCache, key)) {
      return sessionMemoryStore.statusCache[key];
    }
    return null;
  };

  let status = readStatus();
  if (status === null) {
    const data = await storageGet("local", { [STATUS_CACHE_KEY]: {} });
    if (Object.prototype.hasOwnProperty.call(data[STATUS_CACHE_KEY] || {}, key)) {
      status = data[STATUS_CACHE_KEY][key];
    }
  }

  const clean =
    typeof normalizeExtensionStatus === "function"
      ? normalizeExtensionStatus(status || "")
      : String(status || "").trim();
  const result = Boolean(clean);

  return result;
}

async function cacheFriendIdsFromPage() {
  const ids = [];
  document
    .querySelectorAll(
      ".friends-grid .friend-card, .friends-section .friend-card, .friends-grid > a[href*='/users/']",
    )
    .forEach((card) => {
      const id = getUserIdFromRepNode(card);
      if (id !== null) ids.push(id);
    });

  if (ids.length === 0) return;

  const data = await storageGet("local", { [VORTEX07_FRIEND_IDS_CACHE_KEY]: [] });
  const existing = Array.isArray(data[VORTEX07_FRIEND_IDS_CACHE_KEY])
    ? data[VORTEX07_FRIEND_IDS_CACHE_KEY]
    : [];
  const merged = [...new Set([...ids, ...existing.map((entry) => safeNumber(entry)).filter(Boolean)])].slice(
    0,
    200,
  );
  await storageSet("local", { [VORTEX07_FRIEND_IDS_CACHE_KEY]: merged });
}

async function countFriendsOnVortex07() {
  const cards = document.querySelectorAll(
    ".friends-grid .friend-card, .friends-section .friend-card, .friends-grid > a[href*='/users/']",
  );
  const ids = [];
  cards.forEach((card) => {
    const id = getUserIdFromRepNode(card);
    if (id !== null) ids.push(id);
  });

  if (ids.length === 0) return 0;

  let count = 0;
  for (const id of ids) {
    if (await isUserInVortex07Cache(id)) count += 1;
  }
  return count;
}

function injectMutualVortexIndicator(count) {
  const header = document.querySelector(".profile-header");
  if (!header || count <= 0) return;

  let pill = header.querySelector(".vortex07-mutual-indicator");
  if (!pill) {
    pill = document.createElement("div");
    pill.className = "vortex07-mutual-indicator";
    const statusHost = header.querySelector(".vortex07-profile-status-host");
    const usernameEl = header.querySelector(".profile-username");
    if (statusHost) {
      statusHost.insertAdjacentElement("afterend", pill);
    } else if (usernameEl) {
      usernameEl.insertAdjacentElement("afterend", pill);
    } else {
      header.appendChild(pill);
    }
  }

  pill.textContent =
    count === 1 ? "1 friend uses Vortex07" : `${count} friends use Vortex07`;
}

async function injectProfileMutualIndicator() {
  if (!currentSettings.enabled) return;
  if (getProfileUserIdFromPage() === null) return;

  await cacheFriendIdsFromPage();
  const count = await countFriendsOnVortex07();
  const header = document.querySelector(".profile-header");
  header?.querySelector(".vortex07-mutual-indicator")?.remove();
  if (count > 0) injectMutualVortexIndicator(count);
}

async function collectRoulettePool() {
  const ids = new Set();

  const archive = await loadPlayerArchive();
  archive.forEach((entry) => {
    const id = safeNumber(entry?.id);
    if (id !== null) ids.add(id);
  });

  const recent = await loadRecentPlayers();
  recent.forEach((entry) => {
    const id = safeNumber(entry?.id);
    if (id !== null) ids.add(id);
  });

  const friendData = await storageGet("local", { [VORTEX07_FRIEND_IDS_CACHE_KEY]: [] });
  const friendIds = Array.isArray(friendData[VORTEX07_FRIEND_IDS_CACHE_KEY])
    ? friendData[VORTEX07_FRIEND_IDS_CACHE_KEY]
    : [];
  friendIds.forEach((entry) => {
    const id = safeNumber(entry);
    if (id !== null) ids.add(id);
  });

  document
    .querySelectorAll(".friend-card, .friends-grid > a[href*='/users/']")
    .forEach((card) => {
      const id = getUserIdFromRepNode(card);
      if (id !== null) ids.add(id);
    });

  const repData = await storageGet("local", { [REPUTATION_CACHE_KEY]: {} });
  Object.keys(repData[REPUTATION_CACHE_KEY] || {}).forEach((key) => {
    const id = safeNumber(key);
    if (id !== null) ids.add(id);
  });

  if (ids.size < 5) {
    const leaderboard = await fetchLeaderboard(50);
    leaderboard.forEach((row) => {
      const id = safeNumber(row.userId);
      if (id !== null) ids.add(id);
    });
  }

  if (ids.size < 3 && isPlayvortexApiAvailable()) {
    const letters = ["a", "e", "s", "m", "j"];
    const letter = letters[Math.floor(Math.random() * letters.length)];
    const players = await fetchTopPlayers(letter, {
      userInitiated: true,
      throwOnFailure: false,
    });
    players.forEach((player) => {
      const id = safeNumber(player.id);
      if (id !== null) ids.add(id);
    });
  }

  return [...ids];
}

async function spinVortexRoulette() {
  const btn = document.getElementById("vortex07-roulette-btn");
  if (btn?.classList.contains("vortex07-roulette-spinning")) return;

  let lastId = null;
  try {
    lastId = safeNumber(sessionStorage.getItem(VORTEX07_ROULETTE_LAST_KEY));
  } catch {
    /* ignore */
  }

  btn?.classList.add("vortex07-roulette-spinning");

  const pool = await collectRoulettePool();
  const loggedInId = getLoggedInUserIdFromNav();
  let candidates = pool.filter((id) => id !== lastId && id !== loggedInId);
  if (candidates.length === 0) {
    candidates = pool.filter((id) => id !== loggedInId);
  }
  if (candidates.length === 0) {
    btn?.classList.remove("vortex07-roulette-spinning");
    showVortexToast("No profiles to explore — search some players first");
    return;
  }

  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  try {
    sessionStorage.setItem(VORTEX07_ROULETTE_LAST_KEY, String(pick));
  } catch {
    /* ignore */
  }

  const names = await resolveLeaderboardDisplayNames([pick]);
  const label = names.get(pick) || `user${pick}`;
  showVortexToast(`🎲 ${label}`);

  await sleep(480);
  btn?.classList.remove("vortex07-roulette-spinning");
  window.location.assign(`/users/${pick}/profile`);
}

function injectRouletteButton() {
  if (!currentSettings.enabled) return;

  const anchor = document.getElementById("Alerts") || document.getElementById("Options");
  if (!anchor) return;

  let btn = document.getElementById("vortex07-roulette-btn");
  if (btn) {
    if (!btn.querySelector(".vortex07-roulette-icon")) {
      btn.textContent = "";
      const icon = document.createElement("img");
      icon.className = "vortex07-roulette-icon";
      icon.alt = "";
      icon.src = getExtensionBrandLogoUrl();
      icon.onerror = () => {
        icon.remove();
        btn.textContent = "🎲";
      };
      btn.appendChild(icon);
    }
    return;
  }

  btn = document.createElement("button");
  btn.type = "button";
  btn.id = "vortex07-roulette-btn";
  btn.className = "vortex07-roulette-btn rbx-2007-btn";
  btn.title = "Surprise Me — random Vortex profile";
  btn.setAttribute("aria-label", "Surprise Me");
  btn.textContent = "";
  const icon = document.createElement("img");
  icon.className = "vortex07-roulette-icon";
  icon.alt = "";
  icon.src = getExtensionBrandLogoUrl();
  icon.onerror = () => {
    icon.remove();
    btn.textContent = "🎲";
  };
  btn.appendChild(icon);
  btn.addEventListener("click", () => void spinVortexRoulette());

  const searchHost = findSearchHost();
  if (searchHost?.parentNode === anchor) {
    searchHost.insertAdjacentElement("afterend", btn);
  } else {
    anchor.appendChild(btn);
  }
}

function ensureProfileMetaStack(header) {
  if (!header) return null;

  const avatarWrap = header.querySelector(
    ".profile-avatar-wrap, .vortex07-profile-avatar-slot",
  );
  let stack = header.querySelector(".vortex07-profile-meta-stack");

  if (!stack) {
    stack = document.createElement("div");
    stack.className = "vortex07-profile-meta-stack";
    if (avatarWrap) {
      avatarWrap.insertAdjacentElement("afterend", stack);
    } else {
      header.prepend(stack);
    }
  }

  const orderedSelectors = [
    ".profile-username",
    ".profile-last-seen",
    ".profile-meta",
    ".vortex07-profile-status-host",
    ".vortex07-mutual-indicator",
    ".profile-stats",
    ".profile-actions",
  ];

  orderedSelectors.forEach((selector) => {
    header.querySelectorAll(selector).forEach((el) => {
      if (el.closest(".vortex07-reputation-panel")) return;
      if (!stack.contains(el)) stack.appendChild(el);
    });
  });

  header.classList.add("vortex07-profile-showcase");
  header.dataset.vortex07MetaStack = "1";
  return stack;
}

function injectProfileStatusLine() {
  if (!currentSettings.enabled || !currentSettings.showExtensionStatus) return;

  const header = document.querySelector(".profile-header");
  const usernameEl = header?.querySelector(".profile-username");
  const userId = getProfileUserIdFromPage();
  if (!header || !usernameEl || userId === null) return;

  let host = header.querySelector(".vortex07-profile-status-host");
  if (!host) {
    host = document.createElement("div");
    host.className = "vortex07-profile-status-host";
    usernameEl.insertAdjacentElement("afterend", host);
  }

  host.dataset.vortex07UserId = String(userId);
  const loggedInId = getLoggedInUserIdFromNav();
  const isOwn = loggedInId !== null && loggedInId === userId;

  void (async () => {
    const status = await fetchUserStatus(userId);

    if (isOwn) {
      let editor = host.querySelector(".vortex07-status-editor");
      if (!editor) {
        host.textContent = "";

        const wrap = document.createElement("div");
        wrap.className = "vortex07-status-editor-wrap";

        editor = document.createElement("input");
        editor.type = "text";
        editor.className = "vortex07-status-editor";
        editor.maxLength = STATUS_MAX_LEN;
        editor.placeholder = "Set your Vortex07 status…";
        editor.spellcheck = false;
        editor.setAttribute("aria-label", "Vortex07 status line");

        const hint = document.createElement("span");
        hint.className = "vortex07-status-editor-hint";
        hint.setAttribute("aria-live", "polite");

        const updateHint = (state) => {
          if (state === "saving") {
            hint.textContent = "Saving…";
            hint.classList.add("vortex07-status-hint-saving");
            hint.classList.remove("vortex07-status-hint-synced");
            return;
          }
          if (state === "synced") {
            hint.textContent = "Synced";
            hint.classList.add("vortex07-status-hint-synced");
            hint.classList.remove("vortex07-status-hint-saving");
            return;
          }
          hint.classList.remove("vortex07-status-hint-saving", "vortex07-status-hint-synced");
          hint.textContent = `${editor.value.length}/${STATUS_MAX_LEN}`;
        };

        let saveTimer = null;
        const commit = async () => {
          updateHint("saving");
          editor.classList.remove("vortex07-status-synced");
          const result = await saveUserStatus(userId, editor.value);
          editor.classList.toggle("vortex07-status-empty", !normalizeExtensionStatus(editor.value));
          if (result.synced) {
            editor.classList.add("vortex07-status-synced");
            updateHint("synced");
            setTimeout(() => updateHint("idle"), 2200);
          } else {
            updateHint("idle");
          }
          scheduleExtensionMetaDecorations();
        };

        editor.addEventListener("input", () => {
          editor.classList.remove("vortex07-status-synced");
          updateHint("idle");
          clearTimeout(saveTimer);
          saveTimer = setTimeout(() => void commit(), 500);
        });
        editor.addEventListener("blur", () => void commit());
        editor.addEventListener("keydown", (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            editor.blur();
          }
        });

        wrap.append(editor, hint);
        host.appendChild(wrap);
        updateHint("idle");
      }

      editor.value = status;
      editor.classList.toggle("vortex07-status-empty", !status);
      return;
    }

    host.textContent = "";
    const line = renderExtensionStatusEl(status, {
      className: "vortex07-ext-status vortex07-ext-status-profile",
      userId,
    });
    if (line) host.appendChild(line);
  })();
}

function cleanupProfileSocialClutter() {
  if (getProfileUserIdFromPage() === null) return;

  document
    .querySelectorAll(
      ".vortex07-guestbook-section, .vortex07-profile-status-host, .vortex07-status-editor",
    )
    .forEach((el) => el.remove());
}

function clearNtProfileTag() {
  document.querySelectorAll(".vortex07-nt-name-badge").forEach((el) => {
    el.remove();
  });
}

function injectNtProfileTag() {
  const userId = getProfileUserIdFromPage();
  if (!currentSettings.enabled || !isNtVortexUser(userId)) {
    clearNtProfileTag();
    return;
  }

  const usernameEl = document.querySelector(".profile-header .profile-username");
  if (!usernameEl || usernameEl.querySelector(".vortex07-nt-name-badge")) return;

  const badge = document.createElement("span");
  badge.className = "vortex07-nt-name-badge";
  badge.textContent = "NT";
  usernameEl.appendChild(badge);
}

function injectProfileTierFeatures() {
  const header = document.querySelector(".profile-header");
  ensureProfileMetaStack(header);
  cleanupProfileSocialClutter();

  void injectProfileMutualIndicator();
  enhanceFriendsCarousels();
  header?.querySelector(".vortex07-profile-rep-king-banner")?.remove();
  injectScaryProfileEasterEgg();
  injectNtProfileTag();
  scheduleExtensionMetaDecorations(header || document);
}

/* ========================================================= */


function resolveSocialEmptyMessage(page) {
  const activeTab = page.querySelector(".tab-btn.active");
  const tabText = safeLower(activeTab?.textContent || "");

  if (tabText.includes("request")) return "No pending requests";
  if (tabText.includes("friend")) return "No friends yet";
  if (tabText.includes("following")) return "Not following anyone yet";
  if (tabText.includes("follower")) return "No followers yet";
  if (tabText.includes("blocked")) return "No blocked users";
  return "Nothing here yet";
}

function enhanceSocialEmptyStates(page) {
  const emptyMessage = resolveSocialEmptyMessage(page);

  page.querySelectorAll(".empty-msg").forEach((el) => {
    el.classList.add("vortex07-social-empty");
  });

  page.querySelectorAll(".user-list, .user-grid, .friends-grid").forEach((container) => {
    const hasContent = container.querySelector(
      ".user-row, .user-card, .friend-card, .empty-msg, .vortex07-social-empty",
    );
    if (hasContent) return;

    if (container.dataset.vortex07EmptyInjected === "1") return;
    container.dataset.vortex07EmptyInjected = "1";

    const empty = document.createElement("div");
    empty.className = "vortex07-social-empty";
    empty.textContent = emptyMessage;
    container.appendChild(empty);
  });
}

function enhanceSocialPage() {
  if (!currentSettings.enabled) return;

  const socialPage = document.querySelector("#Body > .page:has(.tab-bar)");
  if (!socialPage) return;

  socialPage.classList.add("vortex07-social-shell");

  socialPage.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.add("vortex07-social-tab");
    btn.classList.toggle("vortex07-social-tab-active", btn.classList.contains("active"));
  });

  ensureSocialFriendSearch(socialPage);
  wireSocialTabListeners(socialPage);
  syncSocialFriendSearchVisibility(socialPage);
  void decorateSocialFriendRows(socialPage);

  socialPage.querySelectorAll("#req-badge, .tab-btn .badge").forEach((badge) => {
    badge.classList.add("vortex07-pending-badge");
  });

  socialPage
    .querySelectorAll("#tab-content, .tab-content, .user-list, .user-grid")
    .forEach((el) => {
      el.classList.add("vortex07-social-tab-panel");
    });

  socialPage.querySelectorAll(".user-list .user-row, .user-row").forEach((row) => {
    row.classList.add("vortex07-social-user-row");

    const userId = getUserIdFromRepNode(row);
    if (userId !== null) row.dataset.vortex07UserId = String(userId);

    const actions = row.querySelector(".user-row-actions");
    const actionText = safeLower(actions?.textContent || "");
    const activeTab = socialPage.querySelector(".tab-btn.active");
    const onRequestsTab = safeLower(activeTab?.textContent || "").includes("request");
    const isRequest =
      onRequestsTab ||
      /accept|decline|cancel request|remove request/.test(actionText);
    row.classList.toggle("vortex07-friend-request-row", isRequest);

    const nameEl = row.querySelector(".user-row-name");
    if (nameEl) nameEl.classList.add("vortex07-user-name-row");
  });

  socialPage.querySelectorAll(".user-card").forEach((card) => {
    card.classList.add("vortex07-social-user-card", "vortex07-friend-tile");

    const userId = getUserIdFromRepNode(card);
    if (userId !== null) card.dataset.vortex07UserId = String(userId);

    const nameEl = card.querySelector(".user-card-name");
    if (nameEl) nameEl.classList.add("vortex07-user-name-row");
  });

  socialPage.querySelectorAll(".pagination").forEach((pagination) => {
    pagination.classList.add("vortex07-social-pagination");
    pagination.querySelectorAll("button").forEach((btn) => {
      if (currentSettings.retroButtons) btn.classList.add("rbx-2007-btn");
    });
  });

  enhanceSocialEmptyStates(socialPage);
}

function isSocialFriendsTabActive(socialPage) {
  const activeTab = socialPage.querySelector(".tab-btn.active");
  const tabText = safeLower(activeTab?.textContent || "");
  return tabText.includes("friend") && !tabText.includes("request");
}

function syncSocialFriendSearchVisibility(socialPage) {
  const searchWrap = socialPage.querySelector(".vortex07-social-friend-search-wrap");
  if (!searchWrap) return;

  const onFriendsTab = isSocialFriendsTabActive(socialPage);
  searchWrap.hidden = !onFriendsTab;

  if (!onFriendsTab) {
    socialPage.querySelector(".vortex07-social-friend-search-empty")?.remove();
    const input = searchWrap.querySelector("#vortex07-socialFriendSearch");
    if (input?.value) input.value = "";
    filterSocialFriendsList(socialPage, "", { force: true });
    return;
  }

  const input = searchWrap.querySelector("#vortex07-socialFriendSearch");
  filterSocialFriendsList(socialPage, input?.value || "");
}

function wireSocialTabListeners(socialPage) {
  if (socialPage.dataset.vortex07SocialTabsWired === "1") return;
  socialPage.dataset.vortex07SocialTabsWired = "1";

  const tabBar = socialPage.querySelector(".tab-bar");
  if (!tabBar) return;

  tabBar.addEventListener("click", (event) => {
    const btn = event.target.closest(".tab-btn");
    if (!btn || !tabBar.contains(btn)) return;

    requestAnimationFrame(() => {
      socialPage.querySelectorAll(".tab-btn").forEach((tabBtn) => {
        tabBtn.classList.toggle("vortex07-social-tab-active", tabBtn.classList.contains("active"));
      });
      syncSocialFriendSearchVisibility(socialPage);
      enhanceSocialEmptyStates(socialPage);
      void decorateSocialFriendRows(socialPage);
    });
  });
}

async function decorateSocialFriendRows(socialPage) {
  if (!isSocialFriendsTabActive(socialPage)) {
    socialPage.querySelectorAll(".vortex07-social-vortex-badge").forEach((badge) => badge.remove());
    return;
  }

  if (typeof isUserInVortex07Cache !== "function") return;

  const rows = socialPage.querySelectorAll(
    ".user-list .user-row:not(.vortex07-friend-request-row), .user-grid .user-card",
  );

  await Promise.all(
    [...rows].map(async (row) => {
      if (row.classList.contains("vortex07-social-friend-hidden")) {
        row.querySelector(".vortex07-social-vortex-badge")?.remove();
        return;
      }

      const userId = getUserIdFromRepNode(row);
      if (userId === null) return;

      const usesVortex = await isUserInVortex07Cache(userId);
      let badge = row.querySelector(".vortex07-social-vortex-badge");

      if (!usesVortex) {
        badge?.remove();
        return;
      }

      if (!badge) {
        badge = document.createElement("span");
        badge.className = "vortex07-social-vortex-badge";
        const nameEl = row.querySelector(".user-row-name, .user-card-name, .vortex07-user-name-row");
        if (nameEl) {
          nameEl.insertAdjacentElement("afterend", badge);
        } else {
          row.appendChild(badge);
        }
      }

      badge.textContent = "Uses Vortex07";
    }),
  );
}

function ensureSocialFriendSearch(socialPage) {
  const friendsTab = [...socialPage.querySelectorAll(".tab-btn")].find((btn) =>
    safeLower(btn.textContent).includes("friend") &&
    !safeLower(btn.textContent).includes("request"),
  );
  if (!friendsTab) return;

  let searchWrap = socialPage.querySelector(".vortex07-social-friend-search-wrap");
  if (!searchWrap) {
    searchWrap = document.createElement("div");
    searchWrap.className = "vortex07-social-friend-search-wrap";
    searchWrap.innerHTML =
      '<label class="vortex07-social-friend-search-label" for="vortex07-socialFriendSearch">Search friends</label><input type="search" id="vortex07-socialFriendSearch" class="vortex07-social-friend-search" placeholder="Search friends by name…" autocomplete="off" spellcheck="false" />';

    const tabPanel =
      socialPage.querySelector("#tab-content, .tab-content") ||
      friendsTab.parentElement;
    tabPanel?.insertAdjacentElement("afterbegin", searchWrap);

    const input = searchWrap.querySelector("#vortex07-socialFriendSearch");
    input?.addEventListener("input", () => {
      filterSocialFriendsList(socialPage, input.value);
      void decorateSocialFriendRows(socialPage);
    });
  }

  syncSocialFriendSearchVisibility(socialPage);
}

function getSocialFriendSearchText(node) {
  const nameEl = node.querySelector(".user-row-name, .user-card-name, .friend-name");
  return safeLower(nameEl?.textContent || node.textContent || "");
}

function filterSocialFriendsList(socialPage, query, options = {}) {
  const force = Boolean(options.force);
  if (!force && !isSocialFriendsTabActive(socialPage)) {
    socialPage.querySelectorAll(".vortex07-social-friend-hidden").forEach((row) => {
      row.classList.remove("vortex07-social-friend-hidden");
    });
    socialPage.querySelector(".vortex07-social-friend-search-empty")?.remove();
    return;
  }

  const needle = safeLower(query).trim();
  const rows = socialPage.querySelectorAll(".user-list .user-row, .user-grid .user-card");
  let visible = 0;

  rows.forEach((row) => {
    if (row.classList.contains("vortex07-friend-request-row")) return;
    const haystack = getSocialFriendSearchText(row);
    const match = !needle || haystack.includes(needle);
    row.classList.toggle("vortex07-social-friend-hidden", !match);
    if (match) visible += 1;
  });

  let empty = socialPage.querySelector(".vortex07-social-friend-search-empty");
  if (!force && !isSocialFriendsTabActive(socialPage)) {
    empty?.remove();
    return;
  }

  if (needle && visible === 0) {
    if (!empty) {
      empty = document.createElement("p");
      empty.className = "vortex07-social-friend-search-empty vortex07-social-empty";
      socialPage.querySelector(".user-list, .user-grid")?.appendChild(empty);
    }
    empty.textContent = `No friends match "${query.trim()}".`;
    empty.hidden = false;
  } else {
    empty?.remove();
  }
}
