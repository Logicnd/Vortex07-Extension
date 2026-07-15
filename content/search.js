/* ========================================================= */
/* ================= SEARCH ================================ */
/* ========================================================= */

function findSearchHost() {
  const alerts = document.getElementById("Alerts");

  return (
    (alerts &&
      (alerts.querySelector("#vortex07-search-form") ||
        alerts.querySelector("#search-form") ||
        alerts.querySelector(".navbar-search") ||
        alerts.querySelector(".vortex07-search-host"))) ||
    document.querySelector("#vortex07-search-slot #vortex07-search-form") ||
    document.querySelector("#vortex07-search-slot .vortex07-search-host") ||
    document.getElementById("vortex07-search-form") ||
    document.getElementById("search-form") ||
    document.querySelector(".navbar-search") ||
    document.querySelector(".navbar #search-form") ||
    document.querySelector(".navbar .navbar-search")
  );
}

function findSearchInput() {
  const host = findSearchHost();

  return (
    document.getElementById("vortex07-search-input") ||
    document.querySelector("#Alerts #vortex07-search-input") ||
    document.querySelector("#Alerts #search-form input") ||
    document.querySelector("#Alerts .navbar-search input") ||
    host?.querySelector('input[type="search"]') ||
    host?.querySelector('input[name="q"]') ||
    host?.querySelector('input[type="text"]') ||
    document.querySelector(".navbar-search input") ||
    document.querySelector('input[type="search"]') ||
    document.querySelector('input[name="q"]')
  );
}

function findSearchButton(host = findSearchHost()) {
  if (!host) return null;

  return (
    host.querySelector(".vortex07-search-go") ||
    host.querySelector('button[type="submit"]') ||
    host.querySelector("button")
  );
}

function moveSearchToAlerts() {
  const alerts = document.getElementById("Alerts");
  if (!alerts) return;

  const host = findSearchHost();
  if (host && !alerts.contains(host)) {
    alerts.appendChild(host);
    logSearch("Moved search host into #Alerts");
  }

  syncAttackModeBanner();
}

function buildVortex07SearchHost() {
  const form = document.createElement("form");
  form.id = "vortex07-search-form";
  form.className = "vortex07-search-host";
  form.setAttribute("autocomplete", "off");
  form.noValidate = true;

  const input = document.createElement("input");
  input.type = "text";
  input.name = "q";
  input.id = "vortex07-search-input";
  input.placeholder = "Find people";
  input.setAttribute("aria-label", "Find people");

  const button = document.createElement("button");
  button.type = "submit";
  button.className = "vortex07-search-go rbx-2007-btn";
  button.textContent = "Search";

  form.appendChild(input);
  form.appendChild(button);
  return form;
}

function ensureSearchFallbackSlot() {
  const navbar = document.querySelector(".navbar");
  if (!navbar) return null;

  let slot = navbar.querySelector("#vortex07-search-slot");
  if (slot) return slot;

  slot = document.createElement("div");
  slot.id = "vortex07-search-slot";
  slot.className = "vortex07-search-fallback-slot";

  const navActions = navbar.querySelector(".navbar-actions");
  if (navActions?.parentNode) {
    navActions.parentNode.insertBefore(slot, navActions);
  } else {
    navbar.appendChild(slot);
  }

  logSearch("Created fallback search slot in native navbar");
  return slot;
}

function resolveSearchAnchor() {
  return (
    document.getElementById("Alerts") ||
    document.getElementById("vortex07-search-slot")
  );
}

function ensureSearchSystem() {
  if (!currentSettings.userSearch) return;

  const anchor = resolveSearchAnchor();
  if (!anchor) return;

  let host = findSearchHost();

  if (!host) {
    host = buildVortex07SearchHost();
    anchor.appendChild(host);
    logSearch("Injected Vortex07 search host");
  } else if (!anchor.contains(host)) {
    anchor.appendChild(host);
    logSearch("Relocated search host into anchor");
  }

  host.classList.add("vortex07-search-host");

  const button = findSearchButton(host);
  if (button) {
    button.classList.add("vortex07-search-go", "rbx-2007-btn");
    if (!button.textContent.trim()) button.textContent = "Search";
  }

  searchHostRef = host;
  enhanceUserSearch();
  updateSearchPlaceholder();
}

function isInsideSearchUi(target) {
  if (!target || !target.closest) return false;

  return Boolean(
    target.closest(
      "#Alerts, #vortex07-search-slot, .vortex07-search-host, #search-form, #vortex07-search-form, .navbar-search, #vortex07-user-results, #vortex07-hover-preview",
    ),
  );
}

function updateSearchPlaceholder() {
  const input = findSearchInput();
  if (!input) return;

  input.placeholder = "Find people";
  input.setAttribute("aria-label", "Find people");
}

function showResultsBox() {
  const box = getOrCreateResultsBox();
  if (!box) return;

  box.hidden = false;
  box.classList.add("vortex07-results-open");
  box.style.setProperty("display", "block", "important");
  box.style.setProperty("visibility", "visible", "important");
  box.style.setProperty("pointer-events", "auto", "important");
  updateResultsBoxPosition();
}

function hideResultsBox() {
  const box = document.getElementById("vortex07-user-results");
  if (!box) return;

  box.hidden = true;
  box.classList.remove("vortex07-results-open");
  box.style.setProperty("display", "none", "important");
  hideHoverPreview();
}

function getOrCreateResultsBox() {
  let resultsBox = document.getElementById("vortex07-user-results");

  if (!resultsBox) {
    resultsBox = document.createElement("div");
    resultsBox.id = "vortex07-user-results";
    resultsBox.className = "vortex07-user-results";
    resultsBox.hidden = true;
    document.body.appendChild(resultsBox);
    logSearch("Created search results box on document.body");
  } else if (resultsBox.parentNode !== document.body) {
    document.body.appendChild(resultsBox);
    logSearch("Moved search results box to document.body");
  }

  resultsBox.style.setProperty("position", "fixed", "important");
  resultsBox.style.setProperty("right", "auto", "important");
  resultsBox.style.setProperty("z-index", "2147483647", "important");
  resultsBox.style.setProperty("overflow", "visible", "important");

  return resultsBox;
}

function updateResultsBoxPosition() {
  const input = findSearchInput();
  const box = document.getElementById("vortex07-user-results");
  if (!input || !box || box.hidden) return;

  const rect = input.getBoundingClientRect();
  const width = 240;

  box.style.setProperty("position", "fixed", "important");
  box.style.setProperty("top", `${Math.round(rect.bottom + 2)}px`, "important");
  box.style.setProperty("left", `${Math.round(rect.left)}px`, "important");
  box.style.setProperty("width", `${width}px`, "important");
  box.style.setProperty("min-width", `${width}px`, "important");
  box.style.setProperty("right", "auto", "important");
  box.style.setProperty("z-index", "2147483647", "important");
  box.style.setProperty("overflow", "visible", "important");
  box.style.setProperty("display", "block", "important");

  logSearch("Positioned search results box:", {
    top: box.style.top,
    left: box.style.left,
    width: box.style.width,
  });
}

function attachSearchPositionListeners() {
  if (searchPositionListenersAttached) return;
  searchPositionListenersAttached = true;

  window.addEventListener("scroll", () => updateResultsBoxPosition(), true);
  window.addEventListener("resize", () => updateResultsBoxPosition());
}

function runPlayerSearchFromUi() {
  const input = findSearchInput();
  if (!input) return;

  const query = input.value.trim();
  if (query.length < 2) {
    void showRecentPlayersDropdown();
    return;
  }

  searchPlayers(query);
}

async function loadRecentPlayers() {
  const data = await storageGet("local", { [VORTEX07_RECENT_PLAYERS_KEY]: [] });
  const list = data[VORTEX07_RECENT_PLAYERS_KEY];
  return Array.isArray(list) ? list : [];
}

function normalizeRecentPlayer(entry) {
  if (!entry || typeof entry !== "object") return null;

  const id = safeNumber(entry.id);
  if (id === null) return null;

  const username = safeString(entry.username) || `user${id}`;
  const displayName = safeString(entry.displayName) || username;
  const cachedRoles = profileRoleCache.get(id);
  const roles = applyKnownBoosterIdsToRoles(id, cachedRoles || {
    isStaff: false,
    isModerator: false,
    isBooster: false,
  });

  return {
    id,
    username,
    displayName,
    avatarUrl: extractAvatarUrl(entry.avatarUrl),
    isBanned: false,
    onlineStatus: "",
    roles,
    seenAt: Number(entry.seenAt) || 0,
  };
}

async function pushRecentPlayer(player) {
  const normalized = normalizePlayer(player) || normalizeRecentPlayer(player);
  if (!normalized) return;

  const entry = {
    id: normalized.id,
    username: normalized.username,
    displayName: normalized.displayName || normalized.username,
    avatarUrl: normalized.avatarUrl || "",
    seenAt: Date.now(),
  };

  let list = await loadRecentPlayers();
  list = list.filter((item) => safeNumber(item?.id) !== entry.id);
  list.unshift(entry);
  if (list.length > VORTEX07_RECENT_PLAYERS_MAX) {
    list = list.slice(0, VORTEX07_RECENT_PLAYERS_MAX);
  }

  await storageSet("local", { [VORTEX07_RECENT_PLAYERS_KEY]: list });
  await snapshotPlayerToArchive(normalized, "recent");
}

function playerMatchesArchiveQuery(entry, query) {
  const q = normalizeSearchText(query);
  if (!q || q.length < 2) return false;

  const username = safeString(entry.username);
  const displayName = safeString(entry.displayName || entry.username);
  const idText = safeString(String(entry.id));

  const scores = [
    fuzzyMatchScore(username, q),
    fuzzyMatchScore(displayName, q),
    fuzzyMatchScore(idText, q),
  ];

  return Math.max(...scores) >= 55;
}

function archiveEntryFromPlayer(player, source = "browse") {
  const normalized = normalizePlayer(player) || normalizeRecentPlayer(player);
  if (!normalized) return null;

  return {
    id: normalized.id,
    username: normalized.username,
    displayName: normalized.displayName || normalized.username,
    avatarUrl: normalized.avatarUrl || "",
    isTermed: Boolean(normalized.isBanned),
    roles: normalized.roles || null,
    lastSeenAt: Date.now(),
    source: safeString(source) || "browse",
  };
}

async function loadPlayerArchive() {
  const data = await storageGet("local", { [VORTEX07_PLAYER_ARCHIVE_KEY]: [] });
  const list = data[VORTEX07_PLAYER_ARCHIVE_KEY];
  return Array.isArray(list) ? list : [];
}

async function snapshotPlayerToArchive(player, source = "browse") {
  const entry = archiveEntryFromPlayer(player, source);
  if (!entry) return;

  let list = await loadPlayerArchive();
  const existing = list.find((item) => safeNumber(item?.id) === entry.id);
  if (existing) {
    entry.isTermed = Boolean(entry.isTermed || existing.isTermed);
    if (!entry.avatarUrl) entry.avatarUrl = existing.avatarUrl || "";
    if (entry.username.startsWith("user") && existing.username) {
      entry.username = existing.username;
    }
  }

  list = list.filter((item) => safeNumber(item?.id) !== entry.id);
  list.unshift(entry);
  if (list.length > VORTEX07_PLAYER_ARCHIVE_MAX) {
    list = list.slice(0, VORTEX07_PLAYER_ARCHIVE_MAX);
  }

  await storageSet("local", { [VORTEX07_PLAYER_ARCHIVE_KEY]: list });
}

async function snapshotPlayersToArchive(players, source = "browse") {
  if (!Array.isArray(players) || players.length === 0) return;
  for (const player of players) {
    await snapshotPlayerToArchive(player, source);
  }
}

async function searchPlayerArchive(query, liveIds = new Set()) {
  const q = safeString(query);
  if (q.length < 2) return [];

  const list = await loadPlayerArchive();
  return list
    .filter((entry) => {
      const id = safeNumber(entry?.id);
      if (id === null || liveIds.has(id)) return false;
      return playerMatchesArchiveQuery(entry, q);
    })
    .slice(0, 5)
    .map((entry) => ({
      id: safeNumber(entry.id),
      username: safeString(entry.username) || `user${entry.id}`,
      displayName: safeString(entry.displayName) || safeString(entry.username),
      avatarUrl: extractAvatarUrl(entry.avatarUrl),
      isBanned: Boolean(entry.isTermed),
      isArchived: true,
      onlineStatus: "",
      roles: entry.roles || resolvePlayerRoles(safeNumber(entry.id)),
      archiveSource: safeString(entry.source) || "archive",
      archivedAt: Number(entry.lastSeenAt) || 0,
    }))
    .filter((entry) => entry.id !== null);
}

async function resolveLeaderboardDisplayNames(userIds) {
  const map = new Map();
  const ids = userIds.map((id) => safeNumber(id)).filter((id) => id !== null);
  if (ids.length === 0) return map;

  const [recent, archive] = await Promise.all([
    loadRecentPlayers(),
    loadPlayerArchive(),
  ]);

  ids.forEach((id) => {
    const recentHit = recent.find((entry) => safeNumber(entry?.id) === id);
    const archiveHit = archive.find((entry) => safeNumber(entry?.id) === id);
    const label =
      safeString(recentHit?.displayName) ||
      safeString(recentHit?.username) ||
      safeString(archiveHit?.displayName) ||
      safeString(archiveHit?.username);
    if (label) map.set(id, label);
  });

  return map;
}

function getProfilePlayerSnapshot() {
  const id = getProfileUserIdFromPage();
  if (id === null) return null;

  const header = document.querySelector(".profile-header");
  if (!header) return null;

  const usernameEl = header.querySelector(".profile-username");
  let displayName = safeString(usernameEl?.textContent);
  if (usernameEl) {
    const clone = usernameEl.cloneNode(true);
    clone
      .querySelectorAll(
        ".profile-badges, .vortex07-retro-badge-wrap, img",
      )
      .forEach((el) => el.remove());
    displayName = safeString(clone.textContent);
  }

  const avatarImg = header.querySelector(".profile-avatar");
  const avatarUrl = extractAvatarUrl(avatarImg?.getAttribute("src") || "");

  let username = "";
  header.querySelectorAll("span, div, p, a").forEach((el) => {
    if (username) return;
    const text = safeString(el.textContent);
    if (/^@[\w.-]{2,30}$/.test(text)) username = text.slice(1);
  });

  return {
    id,
    username: username || `user${id}`,
    displayName: displayName || username || `User ${id}`,
    avatarUrl,
  };
}

async function recordProfilePageVisit() {
  const userId = getProfileUserIdFromPage();
  if (userId === null || lastRecordedProfileVisitId === userId) return;

  const snapshot = getProfilePlayerSnapshot();
  if (!snapshot) return;

  const recent = await loadRecentPlayers();
  const existing = recent.find((item) => safeNumber(item?.id) === userId);
  if (existing?.username && snapshot.username.startsWith("user")) {
    snapshot.username = existing.username;
  }
  if (existing?.displayName && !snapshot.displayName) {
    snapshot.displayName = existing.displayName;
  }
  if (existing?.avatarUrl && !snapshot.avatarUrl) {
    snapshot.avatarUrl = existing.avatarUrl;
  }

  lastRecordedProfileVisitId = userId;
  await pushRecentPlayer(snapshot);
  await snapshotPlayerToArchive(
    {
      ...snapshot,
      isBanned: Boolean(
        document.querySelector(".profile-header .error-msg, .profile-header .info-msg")
          ?.textContent?.toLowerCase()
          .includes("ban"),
      ),
    },
    "profile",
  );
}

async function showRecentPlayersDropdown() {
  if (!currentSettings.userSearch) return;

  const recent = await loadRecentPlayers();
  if (recent.length === 0) {
    clearSearchResults();
    return;
  }

  const resultsBox = getOrCreateResultsBox();
  if (!resultsBox) return;

  clearElement(resultsBox);
  hideHoverPreview();

  const players = recent
    .map(normalizeRecentPlayer)
    .filter(Boolean)
    .slice(0, VORTEX07_RECENT_PLAYERS_MAX);
  const withAvatars = await attachAvatars(players, { userInitiated: false });

  withAvatars.forEach((player) => {
    const row = makePlayerRow(player, { isRecent: true });
    if (row) resultsBox.appendChild(row);
  });

  showResultsBox();
  hydrateSearchAvatars(resultsBox, withAvatars);
  logSearch("Rendered recent players:", { count: withAvatars.length });
}

function bindSearchHost(host, input) {
  if (!host || !input) return;

  host.classList.add("vortex07-search-host");

  if (!host.dataset.vortex07SubmitEnhanced) {
    host.dataset.vortex07SubmitEnhanced = "true";
    host.addEventListener("submit", (event) => {
      event.preventDefault();
      runPlayerSearchFromUi();
    });
  }

  const button = findSearchButton(host);
  if (button) {
    button.type = "submit";
    button.classList.add("vortex07-search-go", "rbx-2007-btn");
    if (!button.textContent.trim()) button.textContent = "Search";
  }
}

function enhanceUserSearch() {
  if (!currentSettings.userSearch) return;

  const input = findSearchInput();
  if (!input) return;

  if (
    searchInputRef &&
    searchInputRef !== input &&
    searchInputRef.dataset.vortex07SearchEnhanced === "true"
  ) {
    delete searchInputRef.dataset.vortex07SearchEnhanced;
  }

  if (
    input.dataset.vortex07SearchEnhanced === "true" &&
    isElementInDocument(input)
  ) {
    searchInputRef = input;
    bindSearchHost(findSearchHost(), input);
    getOrCreateResultsBox();
    updateResultsBoxPosition();
    return;
  }

  searchInputRef = input;
  input.dataset.vortex07SearchEnhanced = "true";
  input.setAttribute("autocomplete", "off");

  const host = input.closest("form") || input.parentElement;
  bindSearchHost(host, input);

  attachSearchPositionListeners();
  getOrCreateResultsBox();

  input.addEventListener("input", () => {
    const query = input.value.trim();
    if (query.length < 2) {
      void showRecentPlayersDropdown();
      return;
    }
    debouncedPlayerSearch(query);
  });

  input.addEventListener("focus", () => {
    const query = input.value.trim();
    if (query.length < 2) {
      void showRecentPlayersDropdown();
      return;
    }

    const box = document.getElementById("vortex07-user-results");

    if (
      query.length >= 2 &&
      query === lastSearchQuery &&
      box &&
      box.children.length > 0
    ) {
      showResultsBox();
    }
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      clearSearchResults();
    }
  });

  if (!documentClickAttached) {
    documentClickAttached = true;

    document.addEventListener(
      "click",
      (event) => {
        const box = document.getElementById("vortex07-user-results");
        if (!box) return;

        if (!isInsideSearchUi(event.target)) {
          hideResultsBox();
        }
      },
      true,
    );
  }

  logSearch("Player search attached");
}

function removeUserSearch() {
  hideResultsBox();
  document.getElementById("vortex07-user-results")?.remove();
  searchInputRef = null;
  searchHostRef = null;

  document
    .querySelectorAll('[data-vortex07-search-enhanced="true"]')
    .forEach((input) => {
      delete input.dataset.vortex07SearchEnhanced;
    });
}

function debouncedPlayerSearch(query) {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => searchPlayers(query), SEARCH_DEBOUNCE_MS);
}

async function loadCachedSearchResults(query) {
  const normalized = normalizeSearchText(query);
  if (normalized.length < 2) return null;

  const data = await storageGet("local", { vortex07LastPlayerSearch: null });
  const cached = data.vortex07LastPlayerSearch;
  if (!cached || !Array.isArray(cached.players)) return null;
  if (Date.now() - Number(cached.savedAt || 0) > SEARCH_CACHE_TTL_MS) return null;
  if (normalizeSearchText(cached.query) !== normalized) return null;
  return cached;
}

async function searchPlayers(query) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery || normalizedQuery.length < 2) return;

  lastSearchQuery = query;

  const resultsBox = getOrCreateResultsBox();
  if (!resultsBox) return;

  clearElement(resultsBox);
  showResultsBox();
  resultsBox.appendChild(makeMutedRow("Searching players..."));
  updateResultsBoxPosition();

  logSearch("Searching players:", query);

  const cached = await loadCachedSearchResults(query);
  if (cached) {
    logSearch("Search cache hit:", query);
    renderPlayerResults(cached.players, query);
  }

  try {
    const players = await fetchTopPlayers(query, { userInitiated: true });
    await snapshotPlayersToArchive(players, "search");
    const enriched = await enrichPlayersLastOnline(players, { userInitiated: true });
    renderPlayerResults(enriched, query);

    await storageSet("local", {
      vortex07LastPlayerSearch: { query, players: enriched, savedAt: Date.now() },
    });
  } catch (err) {
    if (cached) return;
    logError("Player search failed:", err);
    clearElement(resultsBox);
    resultsBox.appendChild(
      makeMutedRow(
        isPlayvortexApiAvailable()
          ? "No players found — try another name"
          : "Search busy — try again in a moment",
      ),
    );
    showResultsBox();
  }
}

async function fetchTopPlayers(query, options = {}) {
  const throwOnFailure = options.throwOnFailure !== false;
  const userInitiated = options.userInitiated !== false;

  const data = await vortexApi.get(
    "/api/users/search",
    { q: query },
    { userInitiated },
  );
  if (data === null) {
    if (throwOnFailure) throw new Error("Player search unavailable");
    return [];
  }

  const rows = Array.isArray(data) ? data : extractUserEntriesFromPayload(data);
  if (!rows.length) {
    logWarn("Player search response had no user rows:", data);
    return [];
  }

  logSearch(`Raw player search results: ${rows.length}`, rows);

  const players = rows.map(normalizePlayer).filter(Boolean).slice(0, 5);
  const bannedPlayers = players.filter((player) => player.isBanned);

  logSearch(`Normalized ${players.length} players`);
  logBanned(`Normalized ${bannedPlayers.length} banned players`, bannedPlayers);

  return attachAvatars(players, { userInitiated });
}

async function enrichPlayersLastOnline(players, options = {}) {
  if (!Array.isArray(players) || players.length === 0) return [];

  const enriched = players.map((player) => ({ ...player }));
  const targets = enriched.filter((player) => {
    const status = player.onlineStatus || "";
    if (status === "online" || status === "in-game") return false;
    return !Number(player.lastOnlineAt);
  });

  if (!targets.length) return enriched;

  await Promise.all(
    targets.slice(0, 5).map(async (player) => {
      const data = await fetchPlayvortexUserRecord(player.id, {
        userInitiated: options.userInitiated !== false,
        force: true,
      });
      if (!data || typeof data !== "object") return;

      const index = enriched.findIndex((row) => row.id === player.id);
      if (index < 0) return;

      const lastOnlineAt = readLastOnlineAt(data);
      const onlineStatus = readOnlineStatus(data) || enriched[index].onlineStatus;
      enriched[index] = {
        ...enriched[index],
        onlineStatus,
        ...(lastOnlineAt ? { lastOnlineAt } : {}),
      };
    }),
  );

  return enriched;
}

async function fetchPlayerAvatars(userIds, options = {}) {
  if (!Array.isArray(userIds) || userIds.length === 0) return new Map();

  const cleanIds = userIds
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id));
  if (cleanIds.length === 0) return new Map();

  const resultMap = new Map();
  const missingIds = [];

  cleanIds.forEach((id) => {
    if (avatarMemoryCache.has(id)) {
      resultMap.set(id, avatarMemoryCache.get(id));
      logAvatar(`cache hit ${id}`);
    } else {
      missingIds.push(id);
      logAvatar(`cache miss ${id}`);
    }
  });

  if (missingIds.length === 0) return resultMap;

  if (!options.userInitiated && shouldSkipNonEssentialPolling()) {
    return resultMap;
  }

  const url = `${VORTEX_ORIGIN}/api/users/avatar-pictures?ids=${encodeURIComponent(missingIds.join(","))}`;
  logAvatar("Fetching avatars:", url);

  try {
    const response = await fetchWithResilience(url, {
      circuit: "playvortex",
      method: "GET",
      timeoutMs: API_TIMEOUT_MS,
      credentials: "include",
      headers: { Accept: "application/json" },
      force: Boolean(options.userInitiated),
    });

    logAvatar("Avatar API status:", response.status);
    if (!response.ok) {
      if (
        response.status === 429 ||
        response.status === 403 ||
        response.status >= 500
      ) {
        markPlayvortexApiFailure(response.status);
      }
      logWarn("Avatar API unavailable, using fallback avatars.");
      return resultMap;
    }

    const data = await response.json();
    const fetchedMap = normalizeAvatarMap(data);
    fetchedMap.forEach((avatarUrl, id) => {
      avatarMemoryCache.set(id, avatarUrl);
      resultMap.set(id, avatarUrl);
    });

    logAvatar(`Fetched ${fetchedMap.size} avatars`);
  } catch (err) {
    if (err?.message?.startsWith("circuit_open:")) {
      logWarn("Avatar fetch skipped (attack mode)");
    } else if (err.name === "AbortError") logWarn("Avatar API timeout");
    else logWarn("Avatar API failed:", err);
  }

  return resultMap;
}

async function attachAvatars(players, options = {}) {
  if (!Array.isArray(players) || players.length === 0) return [];

  const ids = players
    .map((player) => player.id)
    .filter((id) => Number.isFinite(Number(id)));
  const avatarMap = await fetchPlayerAvatars(ids, options);

  return players.map((player) => ({
    ...player,
    avatarUrl: avatarMap.get(Number(player.id)) || "",
  }));
}

function renderPlayerResults(players, query) {
  const resultsBox = getOrCreateResultsBox();
  if (!resultsBox) return;

  clearElement(resultsBox);
  hideHoverPreview();

  const live = Array.isArray(players) ? players : [];
  let rendered = 0;

  if (live.length > 0) {
    live.slice(0, 5).forEach((player) => {
      const row = makePlayerRow(player);
      if (row) {
        resultsBox.appendChild(row);
        rendered += 1;
      }
    });
  }

  if (rendered === 0) {
    const label = safeString(query) || "your search";
    resultsBox.appendChild(
      makeMutedRow(`No players found for "${label}" — try a shorter name or ID`),
    );
  }

  showResultsBox();
  hydrateSearchAvatars(resultsBox, live);
  logSearch("Rendered player results:", {
    live: live.length,
  });
}

function makeUserAvatarEl(userId, username, avatarUrl = "", options = {}) {
  const wrap = document.createElement("span");
  wrap.className = "vortex07-user-avatar";
  applyAvatarFrameClasses(wrap, userId);

  const img = document.createElement("img");
  img.className = "vortex07-user-avatar-img";
  img.alt = "";
  img.loading = "lazy";
  img.dataset.vortex07Uid = String(userId);

  const letter = document.createElement("span");
  letter.className = "vortex07-user-avatar-letter";
  letter.textContent = initial(username);

  const revealImage = () => {
    img.style.display = "block";
    letter.style.display = "none";
  };

  const revealLetter = () => {
    img.removeAttribute("src");
    img.style.display = "none";
    letter.style.display = "block";
  };

  img.addEventListener("load", () => {
    if (img.naturalWidth > 0) revealImage();
    else revealLetter();
  });
  img.addEventListener("error", revealLetter);

  wrap.appendChild(img);
  wrap.appendChild(letter);

  const src = safeImageSrc(avatarUrl, "");
  if (src) {
    letter.style.display = "none";
    img.style.display = "block";
    img.src = src;
  } else {
    revealLetter();
  }

  if (options.onlineStatus) {
    wrap.appendChild(createOnlineDot(options.onlineStatus));
  }

  wrap.style.background = avatarColor(username);

  return wrap;
}

async function hydrateSearchAvatars(root, players = []) {
  if (!root) return;

  const pendingIds = new Set();

  if (Array.isArray(players) && players.length > 0) {
    players.forEach((player) => {
      const id = safeNumber(player?.id);
      if (id === null) return;
      if (safeImageSrc(player.avatarUrl, "")) return;
      pendingIds.add(id);
    });
  }

  root.querySelectorAll("img[data-vortex07-uid]").forEach((img) => {
    if (!imgNeedsAvatarHydration(img)) return;
    const id = Number(img.dataset.vortex07Uid);
    if (Number.isFinite(id)) pendingIds.add(id);
  });

  if (pendingIds.size === 0) return;

  const avatarMap = await fetchPlayerAvatars([...pendingIds], {
    userInitiated: true,
  });

  root.querySelectorAll("img[data-vortex07-uid]").forEach((img) => {
    const id = Number(img.dataset.vortex07Uid);
    if (!Number.isFinite(id)) return;
    if (!imgNeedsAvatarHydration(img)) return;

    const src = safeImageSrc(avatarMap.get(id) || "", "");
    if (!src) return;
    img.src = src;
  });

  if (typeof decorateScarySearchResults === "function") {
    decorateScarySearchResults(root);
  }
}

function imgNeedsAvatarHydration(img) {
  const attr = img.getAttribute("src");
  if (!attr) return true;
  return !safeImageSrc(attr, "");
}


function compressHeroSections() {
  document
    .querySelectorAll(
      ".hero, .page-hero, .home-hero, .site-hero, .banner-hero, [class*='hero-banner'], [class*='Hero']",
    )
    .forEach((el) => {
      if (el.closest("#Banner, #Header, #Logo")) return;
      el.classList.add("vortex07-hero-compressed");
    });

  document.querySelectorAll(".dl-hero").forEach((el) => {
    el.classList.add("vortex07-dl-hero-compact");
  });
}

function normalizeFriendTiles() {
  const grids = document.querySelectorAll(
    ".friends-grid, .friends-section, .friends-list, [class*='friends-grid'], [class*='friend-list']",
  );

  grids.forEach((grid) => {
    grid.style.removeProperty("display");
    grid.style.removeProperty("grid-template-columns");
    grid.style.removeProperty("grid-template-rows");
    grid.style.removeProperty("gap");
  });

  document
    .querySelectorAll(
      ".friend-card, .user-card, .friends-grid > a, .friends-section > a, .friends-list > a",
    )
    .forEach((card) => {
      card.classList.add("vortex07-friend-tile");

      const friendId = getUserIdFromRepNode(card);
      if (friendId !== null) {
        card.dataset.vortex07UserId = String(friendId);
      }

      [
        "width",
        "min-width",
        "max-width",
        "flex",
        "flex-direction",
        "align-items",
        "align-self",
        "grid-column",
        "grid-row",
        "justify-content",
      ].forEach((prop) => card.style.removeProperty(prop));

      card.querySelectorAll(".friend-name, span, p").forEach((label) => {
        if (label.closest(".friend-avatar, [class*='avatar']")) return;
        if (label.querySelector("img")) return;

        label.style.removeProperty("position");
        label.style.removeProperty("top");
        label.style.removeProperty("right");
        label.style.removeProperty("bottom");
        label.style.removeProperty("left");
        label.style.removeProperty("align-self");
      });
    });

  if (getProfileUserIdFromPage() !== null) {
    void injectProfileMutualIndicator();
  }

  if (shouldEnhanceFriendCarousels() && document.querySelector(".friend-card")) {
    enhanceFriendsCarousels();
  }
}