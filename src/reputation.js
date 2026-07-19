/* Extension-only thumbs-up reputation — blocky 2007 UI.     */

function repThumbUpSvg(size = 14) {
  return `<svg class="vortex07-rep-svg vortex07-rep-svg-up" viewBox="0 0 16 16" width="${size}" height="${size}" aria-hidden="true" focusable="false"><path class="vortex07-rep-svg-fill" d="M3 6.5h2.4V4.2c0-1.1.9-2 2.1-2s2.1.9 2.1 2v2.3H13c.6 0 1 .4 1 1v.6c0 1.7-.9 3.2-2.2 4.1L11.2 15H2V6.5h1z"/><path class="vortex07-rep-svg-stroke" d="M3 6.5h2.4V4.2c0-1.1.9-2 2.1-2s2.1.9 2.1 2v2.3H13c.6 0 1 .4 1 1v.6c0 1.7-.9 3.2-2.2 4.1L11.2 15H2V6.5h1z"/></svg>`;
}

function repThumbDownSvg(size = 14) {
  return `<svg class="vortex07-rep-svg vortex07-rep-svg-down" viewBox="0 0 16 16" width="${size}" height="${size}" aria-hidden="true" focusable="false"><path class="vortex07-rep-svg-fill" d="M3 9.5h2.4v2.3c0 1.1.9 2 2.1 2s2.1-.9 2.1-2V9.5H13c.6 0 1-.4 1-1v-.6c0-1.7-.9-3.2-2.2-4.1L11.2 1H2v8.5h1z"/><path class="vortex07-rep-svg-stroke" d="M3 9.5h2.4v2.3c0 1.1.9 2 2.1 2s2.1-.9 2.1-2V9.5H13c.6 0 1-.4 1-1v-.6c0-1.7-.9-3.2-2.2-4.1L11.2 1H2v8.5h1z"/></svg>`;
}

function isVortex07Developer(userId) {
  const id = Number(userId);
  return Number.isFinite(id) && VORTEX07_DEVELOPER_IDS.has(id);
}

function isTheHaloDeveloper(userId) {
  return safeNumber(userId) === VORTEX07_HALO_DEVELOPER_ID;
}

function applyAvatarFrameClasses(wrap, userId) {
  if (!wrap) return;
  const id = safeNumber(userId);
  if (id === null) return;

  wrap.classList.toggle("vortex07-dev-avatar-frame", isVortex07Developer(id));
  wrap.classList.toggle(
    "vortex07-rainbow-avatar-frame",
    isTheHaloDeveloper(id),
  );
}

function readOnlineStatus(rawPlayer) {
  if (!rawPlayer || typeof rawPlayer !== "object") return "";

  if (
    readBooleanLike(
      rawPlayer.isInGame ??
        rawPlayer.inGame ??
        rawPlayer.in_game ??
        rawPlayer.is_in_game,
    )
  ) {
    return "in-game";
  }

  if (
    readBooleanLike(
      rawPlayer.isOnline ?? rawPlayer.online ?? rawPlayer.is_online,
    )
  ) {
    return "online";
  }

  const status = safeLower(
    rawPlayer.status ??
      rawPlayer.presence ??
      rawPlayer.onlineStatus ??
      rawPlayer.online_status,
  );

  if (status.includes("in-game") || status.includes("ingame")) return "in-game";
  if (status.includes("online")) return "online";
  if (status.includes("offline")) return "offline";

  if (rawPlayer.isOnline === false || rawPlayer.online === false) {
    return "offline";
  }

  return "";
}

function parseTimestampValue(value) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value < 1e12 ? value * 1000 : value;
  }
  const text = safeString(value);
  if (!text) return 0;
  if (/^\d+$/.test(text)) {
    const n = Number(text);
    return n < 1e12 ? n * 1000 : n;
  }
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : 0;
}

function readLastOnlineAt(rawPlayer) {
  if (!rawPlayer || typeof rawPlayer !== "object") return 0;

  const nested =
    rawPlayer.profile && typeof rawPlayer.profile === "object" ? rawPlayer.profile : null;

  const candidates = [
    rawPlayer.lastOnlineAt,
    rawPlayer.last_online_at,
    rawPlayer.lastOnline,
    rawPlayer.last_online,
    rawPlayer.lastSeenAt,
    rawPlayer.last_seen_at,
    rawPlayer.lastSeen,
    rawPlayer.last_seen,
    rawPlayer.lastActiveAt,
    rawPlayer.last_active_at,
    rawPlayer.lastActive,
    rawPlayer.last_active,
    nested?.lastOnlineAt,
    nested?.last_online_at,
    nested?.lastOnline,
    nested?.last_online,
    nested?.lastSeenAt,
    nested?.last_seen,
  ];

  for (const candidate of candidates) {
    const ts = parseTimestampValue(candidate);
    if (ts > 0) return ts;
  }

  return 0;
}

function readRoleBoolean(value) {
  if (value === true) return true;
  if (value === false || value === null || value === undefined) return false;
  if (typeof value === "number") return value > 0;
  if (typeof value === "string") {
    const text = value.trim().toLowerCase();
    if (["false", "no", "0", "off", "none", ""].includes(text)) return false;
    if (["true", "yes", "1", "on"].includes(text)) return true;
    if (/boost|nitro|premium/.test(text)) return true;
  }
  return readBooleanLike(value);
}

function readBoosterFromBadgesList(rawPlayer) {
  const lists = [
    rawPlayer?.badges,
    rawPlayer?.user_badges,
    rawPlayer?.role_badges,
  ];

  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    if (
      list.some((entry) => {
        const text = safeLower(entry);
        return (
          text.includes("booster") ||
          text.includes("server_booster") ||
          text.includes("server-booster") ||
          text === "boost"
        );
      })
    ) {
      return true;
    }
  }

  return false;
}

const PLAYER_ROLE_SIGNAL_KEYS = [
  "is_booster",
  "isBooster",
  "is_staff",
  "isStaff",
  "is_moderator",
  "isModerator",
  "booster",
  "staff",
  "moderator",
  "badges",
  "user_badges",
  "role_badges",
  "roles",
];

function playerPayloadHasRoleSignals(rawPlayer) {
  if (!rawPlayer || typeof rawPlayer !== "object") return false;
  if (rawPlayer.roles && typeof rawPlayer.roles === "object") return true;
  return PLAYER_ROLE_SIGNAL_KEYS.some((key) =>
    Object.prototype.hasOwnProperty.call(rawPlayer, key),
  );
}

function extractUserEntriesFromPayload(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) {
    return payload.filter((entry) => entry && typeof entry === "object");
  }
  if (typeof payload !== "object") return [];

  for (const key of ["users", "results", "friends", "data", "items"]) {
    const nested = payload[key];
    if (Array.isArray(nested)) {
      return nested.filter((entry) => entry && typeof entry === "object");
    }
  }

  return [payload];
}

function readPlayerRoles(rawPlayer) {
  if (!rawPlayer || typeof rawPlayer !== "object") {
    return { isStaff: false, isModerator: false, isBooster: false };
  }

  const nested =
    rawPlayer.roles && typeof rawPlayer.roles === "object" ?
      rawPlayer.roles
    : null;

  const isModerator = readRoleBoolean(
      rawPlayer.isModerator ??
        rawPlayer.moderator ??
        rawPlayer.is_moderator ??
        nested?.isModerator ??
        nested?.moderator ??
        nested?.is_moderator,
    );
  const isStaff =
    readRoleBoolean(
      rawPlayer.isStaff ??
        rawPlayer.staff ??
        rawPlayer.is_staff ??
        nested?.isStaff ??
        nested?.staff ??
        nested?.is_staff,
    ) || isModerator;

  return {
    isStaff,
    isModerator,
    isBooster:
      readRoleBoolean(
        rawPlayer.isBooster ??
          rawPlayer.booster ??
          rawPlayer.is_booster ??
          rawPlayer.isServerBooster ??
          rawPlayer.is_server_booster ??
          rawPlayer.server_booster ??
          rawPlayer.serverBooster ??
          rawPlayer.has_booster ??
          rawPlayer.hasBooster ??
          nested?.isBooster ??
          nested?.booster ??
          nested?.is_booster ??
          nested?.is_server_booster ??
          nested?.server_booster,
      ) || readBoosterFromBadgesList(rawPlayer),
  };
}

async function loadKnownBoosterIds() {
  if (knownBoosterIdsLoaded) return;
  knownBoosterIdsLoaded = true;

  try {
    const data = await storageGet("local", { [VORTEX07_BOOSTER_IDS_KEY]: [] });
    const list = data[VORTEX07_BOOSTER_IDS_KEY];
    if (!Array.isArray(list)) return;

    list.forEach((entry) => {
      const id = safeNumber(entry);
      if (id !== null) knownBoosterIds.add(id);
    });
  } catch (err) {
    logWarn("Failed to load booster ID cache:", err);
  }
}

async function persistKnownBoosterId(userId) {
  const id = safeNumber(userId);
  if (id === null || knownBoosterIds.has(id)) return;

  knownBoosterIds.add(id);
  try {
    await storageSet("local", {
      [VORTEX07_BOOSTER_IDS_KEY]: [...knownBoosterIds],
    });
  } catch (err) {
    logWarn("Failed to persist booster ID cache:", err);
  }
}

async function removeKnownBoosterId(userId) {
  const id = safeNumber(userId);
  if (id === null || !knownBoosterIds.has(id)) return;

  knownBoosterIds.delete(id);
  try {
    await storageSet("local", {
      [VORTEX07_BOOSTER_IDS_KEY]: [...knownBoosterIds],
    });
  } catch (err) {
    logWarn("Failed to update booster ID cache:", err);
  }
}

function applyKnownBoosterIdsToRoles(userId, roles = null) {
  const id = safeNumber(userId);
  if (id === null || !knownBoosterIds.has(id)) return roles;

  if (roles?.isBooster === false) {
    void removeKnownBoosterId(id);
    return roles;
  }

  return mergePlayerRoles(roles, {
    isStaff: false,
    isModerator: false,
    isBooster: true,
  });
}

function resolvePlayerRoles(userId, roles = null, domRoles = null) {
  const id = safeNumber(userId);
  let merged = mergePlayerRoles(
    mergePlayerRoles(roles, domRoles),
    id === null ? null : profileRoleCache.get(id),
  );
  merged = applyKnownBoosterIdsToRoles(id, merged);
  return merged;
}

function mergeFreshPlayerRoles(prev, fresh, rawPlayer) {
  let merged = mergePlayerRoles(prev, fresh);
  if (!rawPlayer || typeof rawPlayer !== "object") return merged;

  const hasExplicitBooster =
    Object.prototype.hasOwnProperty.call(rawPlayer, "is_booster") ||
    Object.prototype.hasOwnProperty.call(rawPlayer, "isBooster");

  if (hasExplicitBooster) {
    merged = {
      ...merged,
      isBooster:
        rawPlayer.is_booster === true || rawPlayer.isBooster === true,
    };
  } else if (prev?.isBooster && fresh && !fresh.isBooster) {
    merged = { ...merged, isBooster: true };
  }

  return merged;
}

function rememberPlayvortexUserRoles(rawPlayer) {
  if (!rawPlayer || typeof rawPlayer !== "object") return null;

  const id = safeNumber(rawPlayer.id ?? rawPlayer.userId ?? rawPlayer.user_id);
  if (id === null) return null;

  const roles = readPlayerRoles(rawPlayer);
  const prev = profileRoleCache.get(id);
  const merged = mergeFreshPlayerRoles(prev, roles, rawPlayer);
  const changed = !rolesSnapshotEqual(prev, merged);
  profileRoleCache.set(id, merged);
  playvortexUserRoleCacheAt.set(id, Date.now());

  if (merged.isBooster) {
    void persistKnownBoosterId(id);
  } else if (knownBoosterIds.has(id)) {
    void removeKnownBoosterId(id);
  }

  return { roles: merged, changed };
}

function ingestPlayvortexUserPayload(payload, context = {}) {
  if (!payload) return;

  let rolesChanged = false;
  const entries = extractUserEntriesFromPayload(payload);

  entries.forEach((entry) => {
    if (!entry || typeof entry !== "object") return;

    const authoritative = Boolean(
      context.authoritative || playerPayloadHasRoleSignals(entry),
    );
    if (!authoritative) return;

    const id = safeNumber(entry.id ?? entry.userId ?? entry.user_id);
    if (id !== null) playvortexInterceptorIngestedIds.add(id);

    const remembered = rememberPlayvortexUserRoles(entry);
    if (remembered?.changed) rolesChanged = true;
  });

  if (rolesChanged) scheduleBadgeRefreshAfterRoleIngest();
}

function scheduleBadgeRefreshAfterRoleIngest() {
  if (!currentSettings.enabled || isEnhancingBadges) return;

  clearTimeout(roleIngestRefreshTimer);
  roleIngestRefreshTimer = setTimeout(() => {
    roleIngestRefreshTimer = null;
    if (areObserverMutationsPaused()) return;
    enhanceRetroBadges();
  }, ROLE_INGEST_REFRESH_DEBOUNCE_MS);
}

function installPlayvortexFetchInterceptor() {
  if (window.__vortex07FetchHooked) return;
  window.__vortex07FetchHooked = true;

  const nativeFetch = window.fetch.bind(window);

  window.fetch = async function vortex07Fetch(input, init) {
    const response = await nativeFetch(input, init);

    try {
      const rawUrl =
        typeof input === "string" ? input
        : input instanceof URL ? input.href
        : input?.url || "";
      const pathname = rawUrl.startsWith("http")
        ? new URL(rawUrl).pathname
        : rawUrl.split("?")[0];

      const isUserRecord = /^\/api\/users\/\d+\/?$/.test(pathname);
      const isUserSearch = pathname === "/api/users/search";
      const isFriendsList = pathname === "/api/friends" || /^\/api\/friends\/\d+\/?$/.test(pathname);

      if (!isUserRecord && !isUserSearch && !isFriendsList) {
        return response;
      }

      if (response.status === 429 || response.status === 403) {
        markPlayvortexApiFailure(response.status, { severe: response.status === 429 });
        return response;
      }

      const clone = response.clone();
      void clone
        .text()
        .then((text) => {
          if (isCloudflareRateLimitText(text)) {
            markPlayvortexApiFailure(429, { severe: true });
            return;
          }
          const data = parsePlayvortexJsonPayload(text);
          if (data === null || data === undefined) return;
          ingestPlayvortexUserPayload(data, { authoritative: isUserRecord });
        })
        .catch(() => {});
    } catch (_err) {
      // Ignore hook failures — never break native fetch.
    }

    return response;
  };
}

function createOnlineDot(status) {
  const dot = document.createElement("span");
  dot.className = "vortex07-search-online-dot";
  dot.setAttribute("aria-hidden", "true");

  if (status === "online") dot.classList.add("vortex07-status-online");
  else if (status === "in-game") dot.classList.add("vortex07-status-ingame");
  else if (status === "offline") dot.classList.add("vortex07-status-offline");
  else dot.hidden = true;

  return dot;
}

const VORTEX07_NATIVE_STAFF_SELECTOR =
  ".staff-badge-icon, [data-vortex07-badge-kind='staff']";
const VORTEX07_NATIVE_BOOSTER_SELECTOR =
  ".boost-badge-icon, svg.boost-badge-icon, svg.profile-badge-icon[title='Server Booster'], [data-vortex07-badge-kind='booster']";
const VORTEX07_NATIVE_MODERATOR_SELECTOR =
  ".moderator-badge-icon, [data-vortex07-badge-kind='moderator']";

function readRolesFromScope(scope) {
  if (!scope?.querySelector) return null;

  const hasNativeBooster = Boolean(
    scope.querySelector(VORTEX07_NATIVE_BOOSTER_SELECTOR),
  );
  const hasRetroBooster = Boolean(
    scope.querySelector("[data-vortex07-badge-kind='booster']"),
  );

  const isModerator = Boolean(
    scope.querySelector(VORTEX07_NATIVE_MODERATOR_SELECTOR),
  );

  return {
    isStaff:
      Boolean(scope.querySelector(VORTEX07_NATIVE_STAFF_SELECTOR)) ||
      isModerator,
    isModerator,
    isBooster: hasNativeBooster || hasRetroBooster,
  };
}

function resolveBadgeRoleScope(host, badgeHost) {
  return (
    badgeHost?.closest(".profile-header") ||
    host?.closest(".profile-header") ||
    badgeHost?.closest(".friend-card, .user-card, .user-row") ||
    host?.closest(".friend-card, .user-card, .user-row") ||
    badgeHost ||
    host
  );
}

function resolveBadgeIconSize(host) {
  if (!host) return VORTEX07_BADGE_ICON_SIZE;
  if (host.closest(".profile-username, .profile-header")) {
    return VORTEX07_BADGE_ICON_SIZE_PROFILE;
  }
  if (host.closest(".vortex07-user-name-row, .vortex07-hover-name-row")) {
    return VORTEX07_BADGE_ICON_SIZE_SEARCH;
  }
  if (host.closest(".friends-grid .friend-name, .friends-grid .friend-card")) {
    return VORTEX07_BADGE_ICON_SIZE_GRID;
  }
  if (host.closest(".friend-name, .user-card-name, .vortex07-home-leaderboard-name")) {
    return VORTEX07_BADGE_ICON_SIZE_FRIEND;
  }
  if (host.closest(".user-row-name")) {
    return VORTEX07_BADGE_ICON_SIZE_COMPACT;
  }
  return VORTEX07_BADGE_ICON_SIZE;
}

function applyBadgeWrapSize(wrap, size) {
  if (!wrap || !size) return;
  wrap.style.width = `${size}px`;
  wrap.style.height = `${size}px`;
  const img = wrap.querySelector(".vortex07-retro-badge-img");
  if (img) {
    img.setAttribute("width", String(size));
    img.setAttribute("height", String(size));
    img.style.width = `${size}px`;
    img.style.height = `${size}px`;
  }
}
function resolveBadgeKindMeta(kind) {
  if (kind === "owner") {
    return { title: "Owner", extraClass: "" };
  }
  if (kind === "developer") {
    return { title: "Vortex07 Developer", extraClass: "" };
  }
  if (kind === "staff") {
    return { title: "Staff", extraClass: "vortex07-search-role-badge" };
  }
  if (kind === "booster") {
    return { title: "Server Booster", extraClass: "vortex07-search-role-badge" };
  }
  return null;
}

function resolveBadgeKinds(userId, roles = null) {
  const id = safeNumber(userId);
  if (id === null) return [];

  const kinds = [];
  if (isTheHaloDeveloper(id)) kinds.push("owner");
  if (isVortex07Developer(id)) kinds.push("developer");
  if (roles?.isStaff || roles?.isModerator) kinds.push("staff");
  if (roles?.isBooster) kinds.push("booster");
  return kinds;
}

function mergePlayerRoles(primary = null, secondary = null) {
  if (!primary && !secondary) return null;
  const isModerator = Boolean(primary?.isModerator || secondary?.isModerator);
  return {
    isStaff: Boolean(
      primary?.isStaff || secondary?.isStaff || isModerator,
    ),
    isModerator,
    isBooster: Boolean(primary?.isBooster || secondary?.isBooster),
  };
}

function resolveUsernameBadgeHost(host) {
  if (!host) return null;
  if (host.classList.contains("profile-username")) {
    return ensureProfileBadgeHost(host);
  }
  if (host.classList.contains("friend-name")) {
    host.classList.add("vortex07-friend-name-host");
  }
  return host;
}

function finalizeBadgeHost(badgeHost) {
  if (!badgeHost?.querySelector(".vortex07-retro-badge-wrap")) return;

  replaceNativeBadgeIcons(badgeHost);

  badgeHost.classList.add("vortex07-badges-ready");
  if (badgeHost.classList.contains("profile-badges")) {
    badgeHost.classList.add("vortex07-badge-strip");
  }
  badgeHost.closest(".profile-username")?.classList.add("vortex07-badges-ready");
  badgeHost
    .querySelectorAll(
      ".staff-badge-icon:not(.vortex07-retro-badge-wrap), .boost-badge-icon:not(.vortex07-retro-badge-wrap), .moderator-badge-icon:not(.vortex07-retro-badge-wrap)",
    )
    .forEach((el) => {
      el.hidden = true;
      el.setAttribute("aria-hidden", "true");
    });
}

function badgesMatchDesiredState(badgeHost, desiredKinds) {
  if (!badgeHost?.classList.contains("vortex07-badges-ready")) return false;

  const existingKinds = [...badgeHost.querySelectorAll(".vortex07-retro-badge-wrap")]
    .map((el) => el.dataset.vortex07BadgeKind)
    .filter(Boolean)
    .sort();

  const desired = [...desiredKinds].sort();
  if (existingKinds.length !== desired.length) return false;
  return existingKinds.every((kind, index) => kind === desired[index]);
}

function organizeFriendNameLayout(nameHost) {
  if (!nameHost?.classList.contains("friend-name")) return;

  const badges = [...nameHost.querySelectorAll(".vortex07-retro-badge-wrap")];
  let text = "";

  nameHost.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent;
    } else if (
      node.nodeType === Node.ELEMENT_NODE &&
      !node.classList.contains("vortex07-retro-badge-wrap") &&
      !node.classList.contains("friend-name-text") &&
      !node.classList.contains("vortex07-friend-badge-row")
    ) {
      text += node.textContent;
    }
  });

  text = safeString(text);
  if (!text && badges.length === 0) return;

  const existingText = nameHost.querySelector(".friend-name-text");
  const existingRow = nameHost.querySelector(".vortex07-friend-badge-row");

  if (existingText) {
    if (text) existingText.textContent = text;
  } else {
    nameHost.textContent = "";
    nameHost.classList.add("vortex07-friend-name-host");

    const textEl = document.createElement("span");
    textEl.className = "friend-name-text";
    textEl.textContent = text;
    nameHost.appendChild(textEl);
  }

  if (badges.length === 0) {
    existingRow?.remove();
    return;
  }

  let badgeRow = existingRow;
  if (!badgeRow) {
    badgeRow = document.createElement("span");
    badgeRow.className = "vortex07-friend-badge-row";
    nameHost.appendChild(badgeRow);
  }

  badges.forEach((badge) => badgeRow.appendChild(badge));
}

function isProfileRoleBadgeHost(host) {
  if (!host) return false;
  const profileHeader = host.closest(".profile-header, .vortex07-profile-header");
  if (!profileHeader) return false;
  return Boolean(
    host.matches?.(".profile-username, .profile-badges") ||
      host.closest(".profile-username"),
  );
}

function stripRoleBadgesFromHost(host) {
  if (!host?.querySelectorAll) return;

  host.querySelectorAll(".vortex07-retro-badge-wrap").forEach((el) => el.remove());
  host.classList.remove("vortex07-badges-ready", "vortex07-badge-strip");
  host
    .querySelector(".profile-badges")
    ?.classList.remove("vortex07-badges-ready", "vortex07-badge-strip");
  host.closest(".profile-username")?.classList.remove("vortex07-badges-ready");
  organizeFriendNameLayout(host);
}

function stripNonProfileRoleBadges(root = document) {
  if (!root?.querySelectorAll) return;

  root.querySelectorAll(".vortex07-retro-badge-wrap").forEach((wrap) => {
    const host =
      wrap.closest(
        ".profile-username, .profile-badges, .friend-name, .user-card-name, .user-row-name, .vortex07-user-name-row, .vortex07-hover-name-row, .vortex07-home-leaderboard-name-wrap, .vortex07-friend-name-host",
      ) || wrap.parentElement;
    if (host && !isProfileRoleBadgeHost(host)) {
      wrap.remove();
    }
  });

  root
    .querySelectorAll(
      ".friend-name, .user-card-name, .user-row-name, .vortex07-user-name-row, .vortex07-hover-name-row, .vortex07-home-leaderboard-name-wrap",
    )
    .forEach((nameHost) => {
      if (!isProfileRoleBadgeHost(nameHost)) {
        organizeFriendNameLayout(nameHost);
      }
    });
}

function syncUsernameBadges(host, userId, roles = null) {
  if (!host) return;

  const id = safeNumber(userId);
  if (id === null) return;

  if (!isProfileRoleBadgeHost(host)) {
    stripRoleBadgesFromHost(host);
    return;
  }

  markDeveloperPresence(host, id);

  const badgeHost = resolveUsernameBadgeHost(host);
  if (!badgeHost) return;

  const roleScope = resolveBadgeRoleScope(host, badgeHost);
  const domRoles = readRolesFromScope(roleScope);
  const mergedRoles = resolvePlayerRoles(id, roles, domRoles);
  const desiredKinds = resolveBadgeKinds(id, mergedRoles);

  if (badgesMatchDesiredState(badgeHost, desiredKinds)) {
    organizeFriendNameLayout(badgeHost);
    return;
  }

  replaceNativeBadgeIcons(roleScope);
  replaceNativeBadgeIcons(badgeHost);

  const existingByKind = new Map(
    [...badgeHost.querySelectorAll(".vortex07-retro-badge-wrap")]
      .map((el) => [el.dataset.vortex07BadgeKind, el])
      .filter(([kind]) => Boolean(kind)),
  );

  const badgeSize = resolveBadgeIconSize(badgeHost);

  existingByKind.forEach((el, kind) => {
    const file = VORTEX07_BADGE_ASSETS[kind];
    if (file) {
      const img = el.querySelector(".vortex07-retro-badge-img");
      const url = badgeAssetUrl(file);
      if (img && url && img.getAttribute("src") !== url) {
        img.setAttribute("src", url);
        wireBadgeIconFallback(img, kind);
      }
      applyBadgeWrapSize(el, badgeSize);
    }

    if (!desiredKinds.includes(kind)) {
      el.remove();
      existingByKind.delete(kind);
    }
  });

  desiredKinds.forEach((kind) => {
    if (existingByKind.has(kind)) return;

    const meta = resolveBadgeKindMeta(kind);
    if (!meta) return;

    const wrap = createRetroBadgeWrap(kind, meta.title, meta.extraClass, badgeSize);
    wrap.dataset.vortex07BadgeKind = kind;
    existingByKind.set(kind, wrap);
    badgeHost.appendChild(wrap);
  });

  let orderChanged = false;
  desiredKinds.forEach((kind, index) => {
    const el = existingByKind.get(kind);
    if (!el) return;
    const sibling = badgeHost.children[index];
    if (sibling !== el) {
      orderChanged = true;
      badgeHost.appendChild(el);
    }
  });

  if (orderChanged || desiredKinds.length > 0) {
    finalizeBadgeHost(badgeHost);
  }

  organizeFriendNameLayout(badgeHost);
}

function appendUsernameBadges(host, userId, roles = null) {
  syncUsernameBadges(host, userId, roles);
}

const VORTEX07_BADGE_ICON_SIZE = 14;
const VORTEX07_BADGE_ICON_SIZE_PROFILE = 18;
const VORTEX07_BADGE_ICON_SIZE_SEARCH = 15;
const VORTEX07_BADGE_ICON_SIZE_FRIEND = 12;
const VORTEX07_BADGE_ICON_SIZE_GRID = 10;
const VORTEX07_BADGE_ICON_SIZE_COMPACT = 13;

function badgeAssetUrl(filename) {
  return extensionAssetUrl(`assets/badge/${filename}`);
}

function preloadBadgeAssets() {
  if (!isExtensionContextAlive()) return;
  Object.entries(VORTEX07_BADGE_ASSETS).forEach(([kind, file]) => {
    const img = new Image();
    img.decoding = "async";
    img.src = badgeAssetUrl(file);
    wireBadgeIconFallback(img, kind);
  });
}

function retroBadgeImgHtml(kind, size = VORTEX07_BADGE_ICON_SIZE) {
  const file = VORTEX07_BADGE_ASSETS[kind];
  if (!file) return "";

  const url = badgeAssetUrl(file);
  if (!url) return "";

  return `<img class="vortex07-retro-badge-img vortex07-retro-badge-${kind}" src="${url}" width="${size}" height="${size}" alt="" aria-hidden="true" loading="eager" decoding="async" />`;
}

function createRetroBadgeWrap(kind, title, extraClass = "", size = VORTEX07_BADGE_ICON_SIZE) {
  const wrap = document.createElement("span");
  wrap.className =
    `profile-badge-icon vortex07-retro-badge-wrap vortex07-retro-badge-size-${size} ${extraClass}`.trim();
  wrap.title = title;
  wrap.dataset.vortex07Retro = "1";
  wrap.dataset.vortex07BadgeKind = kind;
  wrap.innerHTML = retroBadgeImgHtml(kind, size);
  applyBadgeWrapSize(wrap, size);
  wireBadgeIconFallback(wrap.querySelector(".vortex07-retro-badge-img"), kind);
  return wrap;
}

function replaceRetroBadgeElement(el, className, title, kind) {
  if (!el || el.dataset.vortex07Retro === "1") return;

  const wrap = createRetroBadgeWrap(kind, title, className);
  el.replaceWith(wrap);
}

function replaceNativeBadgeIcons(root = document) {
  if (!root?.querySelectorAll) return;

  root
    .querySelectorAll(
      `${VORTEX07_NATIVE_STAFF_SELECTOR}:not([data-vortex07-retro]):not(.vortex07-retro-badge-wrap)`,
    )
    .forEach((el) => {
      replaceRetroBadgeElement(
        el,
        "vortex07-retro-staff",
        el.getAttribute("title") || "Staff",
        "staff",
      );
    });

  root
    .querySelectorAll(
      `${VORTEX07_NATIVE_MODERATOR_SELECTOR}:not([data-vortex07-retro]):not(.vortex07-retro-badge-wrap)`,
    )
    .forEach((el) => {
      const badgeHost =
        el.closest(
          ".profile-badges, .profile-username, .friend-name, .vortex07-user-name-row, .vortex07-hover-name-row",
        ) || el.parentElement;
      const hasStaffBadge = badgeHost?.querySelector(
        `${VORTEX07_NATIVE_STAFF_SELECTOR}, [data-vortex07-badge-kind='staff']`,
      );

      if (hasStaffBadge) {
        el.hidden = true;
        el.setAttribute("aria-hidden", "true");
        el.dataset.vortex07Retro = "1";
        return;
      }

      replaceRetroBadgeElement(el, "vortex07-retro-staff", "Staff", "staff");
    });

  root
    .querySelectorAll(
      `${VORTEX07_NATIVE_BOOSTER_SELECTOR}:not([data-vortex07-retro]):not(.vortex07-retro-badge-wrap)`,
    )
    .forEach((el) => {
      replaceRetroBadgeElement(
        el,
        "vortex07-retro-booster",
        el.getAttribute("title") || "Server Booster",
        "booster",
      );
    });
}

function markDeveloperPresence(host, userId) {
  if (!isVortex07Developer(userId)) return;

  if (host.classList.contains("profile-username")) {
    host.classList.add("vortex07-dev-username");
  }
  if (host.classList.contains("friend-name")) {
    host.classList.add("vortex07-dev-friend-name");
  }
}

function ensureProfileBadgeHost(usernameEl) {
  if (!usernameEl) return null;

  let badges = usernameEl.querySelector(".profile-badges");
  if (!badges) {
    badges = document.createElement("span");
    badges.className = "profile-badges";
    usernameEl.appendChild(badges);
  }

  return badges;
}

function enhanceRetroBadges(root = document) {
  if (isEnhancingBadges || !currentSettings.enabled) return;

  isEnhancingBadges = true;
  try {
    withDomEnhancementPaused(() => {
      const profileHeader =
        root.matches?.(".profile-header") ?
          root
        : root.querySelector(".profile-header");
      const profileUsername = profileHeader?.querySelector(".profile-username");
      const profileRoles = profileHeader ? readRolesFromScope(profileHeader) : null;
      const profileUserId = profileUsername ? getProfileUserIdFromPage() : null;
      const currentProfileKey =
        profileUserId !== null ? profileEnhanceKey(profileUserId) : "";
      const skipProfileBadges =
        currentProfileKey !== "" &&
        currentProfileKey === lastEnhancedProfileKey &&
        !profileBadgesNeedRefresh(profileHeader, profileUserId);

      if (profileHeader) {
        replaceNativeBadgeIcons(profileHeader);
      }

      if (profileUsername && profileHeader && !skipProfileBadges) {
        syncUsernameBadges(
          profileUsername,
          profileUserId,
          resolvePlayerRoles(profileUserId, profileRoles),
        );
        if (
          currentProfileKey &&
          !profileBadgesNeedRefresh(profileHeader, profileUserId)
        ) {
          lastEnhancedProfileKey = currentProfileKey;
        }
        scheduleProfileBadgeHydration(
          profileHeader,
          profileUsername,
          profileUserId,
        );
      }

      stripNonProfileRoleBadges(root);
    });
  } finally {
    isEnhancingBadges = false;
  }
}

function getProfileUserIdFromPage() {
  const pathParts = safeString(window.location.pathname)
    .split("/")
    .filter(Boolean);
  if (pathParts[0] === "users" && pathParts[1]) {
    const fromParts = safeNumber(pathParts[1]);
    if (fromParts !== null) return fromParts;
  }

  const fromPath = extractUserIdFromHref(window.location.pathname);
  if (fromPath !== null) return fromPath;

  const header = document.querySelector(".profile-header");
  if (!header) return null;

  const statLink = header.querySelector('a.profile-stat[href*="user="]');
  if (statLink) {
    const match = safeString(statLink.getAttribute("href")).match(
      /[?&]user=(\d+)/i,
    );
    if (match) return safeNumber(match[1]);
  }

  const repPanel = header.querySelector(".vortex07-reputation-panel");
  if (repPanel?.dataset.vortex07UserId) {
    return safeNumber(repPanel.dataset.vortex07UserId);
  }

  const avatarImg = header.querySelector(
    "img[data-vortex07-uid], .profile-avatar[data-vortex07-uid]",
  );
  if (avatarImg?.dataset.vortex07Uid) {
    return safeNumber(avatarImg.dataset.vortex07Uid);
  }

  return null;
}

function readProfileDisplayName(userId) {
  const numericId = safeNumber(userId);
  if (numericId === null) return "";

  const pageId = getProfileUserIdFromPage();
  if (pageId !== numericId) return "";

  const header = document.querySelector(".profile-header");
  const usernameEl = header?.querySelector(".profile-username");
  if (!usernameEl) return "";

  const clone = usernameEl.cloneNode(true);
  clone
    .querySelectorAll(".profile-badges, .vortex07-retro-badge-wrap, img")
    .forEach((el) => el.remove());

  return safeString(clone.textContent);
}

async function fetchPlayvortexUserRecord(userId, options = {}) {
  const id = safeNumber(userId);
  if (id === null) return null;

  if (!options.force) {
    if (hasFreshUserRolesInCache(id)) return null;
  }

  if (isPlayvortexUserFetchBlocked() && !options.force) return null;

  const inflight = playvortexUserFetchInflight.get(id);
  if (inflight) return inflight;

  const promise = (async () => {
    const data = await enqueuePlayvortexUserFetch(() =>
      vortexApi.get(
        `/api/users/${id}`,
        {},
        { userInitiated: options.userInitiated === true },
      ),
    );
    if (!data || typeof data !== "object") return null;
    return data;
  })();

  playvortexUserFetchInflight.set(id, promise);
  try {
    return await promise;
  } finally {
    if (playvortexUserFetchInflight.get(id) === promise) {
      playvortexUserFetchInflight.delete(id);
    }
  }
}

async function fetchProfileUserRoles(userId, options = {}) {
  const id = safeNumber(userId);
  if (id === null) return null;

  if (!options.force) {
    if (hasFreshUserRolesInCache(id)) {
      return profileRoleCache.get(id);
    }
  }

  if (isPlayvortexUserFetchBlocked() && !options.force) {
    return profileRoleCache.get(id) || resolvePlayerRoles(id, null);
  }

  const data = await fetchPlayvortexUserRecord(id, options);
  if (!data) return profileRoleCache.get(id) || resolvePlayerRoles(id, null);

  const remembered = rememberPlayvortexUserRoles(data);
  return remembered?.roles ?? (profileRoleCache.get(id) || null);
}

function collectFriendBadgeTargets(root = document) {
  const targets = [];

  root
    .querySelectorAll(
      "a.friend-card[href*='/users/'], a.user-card[href*='/users/'], .user-row a[href*='/users/']",
    )
    .forEach((link) => {
      const card =
        link.closest(".friend-card, .user-card, .user-row") || link;
      const userId = extractUserIdFromHref(link.getAttribute("href") || "");
      if (userId === null) return;

      const nameHost = card.querySelector(
        ".friend-name, .user-card-name, .user-row-name",
      );
      if (!nameHost) return;

      targets.push({ nameHost, userId });
    });

  return targets;
}

function scheduleFriendBadgeHydration(root = document) {
  if (!currentSettings.enabled) return;
  if (isPlayvortexUserFetchBlocked() || shouldSkipNonEssentialPolling()) return;

  const route = resolvePageRouteKey();
  if (route === "home" || route === "catalog") return;

  resetFriendBadgeBudgetIfPageChanged();
  if (friendBadgeApiFetchBudget <= 0) return;

  clearTimeout(friendBadgeHydrateTimer);
  friendBadgeHydrateTimer = setTimeout(() => {
    friendBadgeHydrateTimer = null;
    void hydrateFriendBadgesFromApi(root);
  }, FRIEND_BADGE_DEBOUNCE_MS);
}

async function hydrateFriendBadgesFromApi(root = document) {
  if (!currentSettings.enabled) return;
  if (isPlayvortexUserFetchBlocked() || shouldSkipNonEssentialPolling()) return;

  resetFriendBadgeBudgetIfPageChanged();
  if (friendBadgeApiFetchBudget <= 0) return;

  const targets = collectFriendBadgeTargets(root);
  if (targets.length === 0) return;

  const token = ++friendBadgeHydrateToken;
  const pendingIds = [];

  targets.forEach(({ userId }) => {
    if (isTheHaloDeveloper(userId)) return;
    if (hasFreshUserRolesInCache(userId)) return;
    pendingIds.push(userId);
  });

  const uniquePending = [...new Set(pendingIds)].slice(
    0,
    Math.min(friendBadgeApiFetchBudget, FRIEND_BADGE_QUEUE_MAX),
  );

  for (const userId of uniquePending) {
    if (token !== friendBadgeHydrateToken) return;
    if (isPlayvortexUserFetchBlocked() || friendBadgeApiFetchBudget <= 0) break;

    await fetchProfileUserRoles(userId, { userInitiated: false });
    friendBadgeApiFetchBudget -= 1;

    if (uniquePending.indexOf(userId) < uniquePending.length - 1) {
      await sleep(FRIEND_BADGE_QUEUE_SPACING_MS);
    }
  }

  if (token !== friendBadgeHydrateToken) return;

  targets.forEach(({ nameHost, userId }) => {
    if (!nameHost.isConnected) return;
    syncUsernameBadges(
      nameHost,
      userId,
      resolvePlayerRoles(userId, profileRoleCache.get(userId) || null),
    );
  });
}

function scheduleProfileBadgeHydration(header, usernameEl, userId) {
  if (!header || !usernameEl || userId === null) return;

  const id = safeNumber(userId);
  const isNewProfile = id !== null && id !== lastProfileBadgeRefreshUserId;
  if (isNewProfile) {
    lastProfileBadgeRefreshUserId = id;
    playvortexInterceptorIngestedIds.delete(id);
    playvortexUserRoleCacheAt.delete(id);
  }

  clearTimeout(profileBadgeEnhanceTimer);
  profileBadgeEnhanceTimer = setTimeout(() => {
    profileBadgeEnhanceTimer = null;
    void hydrateProfileBadgesFromApi(header, usernameEl, userId, {
      force: isNewProfile,
    });
  }, PROFILE_BADGE_DEBOUNCE_MS);
}

async function hydrateProfileBadgesFromApi(header, usernameEl, userId, options = {}) {
  if (!header?.isConnected || !usernameEl?.isConnected) return;

  const token = ++profileBadgeHydrateToken;

  withDomEnhancementPaused(() => {
    const domRoles = readRolesFromScope(header);
    replaceNativeBadgeIcons(header);
    syncUsernameBadges(
      usernameEl,
      userId,
      resolvePlayerRoles(userId, domRoles),
    );
  });

  if (
    !options.force &&
    hasFreshUserRolesInCache(userId)
  ) {
    return;
  }
  if (isPlayvortexUserFetchBlocked() && !options.force) return;

  const apiRoles = await fetchProfileUserRoles(userId, {
    userInitiated: false,
    force: options.force === true,
  });
  if (token !== profileBadgeHydrateToken) return;
  if (!usernameEl.isConnected) return;

  withDomEnhancementPaused(() => {
    replaceNativeBadgeIcons(header);
    syncUsernameBadges(
      usernameEl,
      userId,
      resolvePlayerRoles(userId, apiRoles, readRolesFromScope(header)),
    );
    const key = profileEnhanceKey(userId);
    if (key && !profileBadgesNeedRefresh(header, userId)) {
      lastEnhancedProfileKey = key;
    }
  });
}

function startProfileBadgeObserver() {
  if (profileBadgeObserverStarted) return;
  profileBadgeObserverStarted = true;

  profileBadgeObserver = new MutationObserver((mutations) => {
    if (!currentSettings.enabled || areObserverMutationsPaused()) return;
    if (!mutations.some(isProfileBadgeRelevantMutation)) return;
    scheduleProfileBadgeEnhanceFast();
  });

  profileBadgeObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "title"],
  });
}

function runProfileBadgeEnhanceFast() {
  if (!currentSettings.enabled || isEnhancingBadges || areObserverMutationsPaused()) {
    return;
  }

  const header = document.querySelector(".profile-header");
  const profileUsername = header?.querySelector(".profile-username");
  if (!header || !profileUsername) return;

  const userId = getProfileUserIdFromPage();
  if (userId === null) return;

  const key = profileEnhanceKey(userId);
  if (key && key === lastEnhancedProfileKey && !profileBadgesNeedRefresh(header, userId)) {
    return;
  }

  withDomEnhancementPaused(() => {
    const domRoles = readRolesFromScope(header);
    replaceNativeBadgeIcons(header);
    syncUsernameBadges(
      profileUsername,
      userId,
      resolvePlayerRoles(userId, domRoles),
    );
  });

  if (key && !profileBadgesNeedRefresh(header, userId)) {
    lastEnhancedProfileKey = key;
  }
}

function scheduleProfileBadgeEnhanceFast() {
  if (!currentSettings.enabled || areObserverMutationsPaused()) return;

  clearTimeout(profileBadgeFastEnhanceTimer);
  profileBadgeFastEnhanceTimer = setTimeout(() => {
    profileBadgeFastEnhanceTimer = null;
    runProfileBadgeEnhanceFast();
  }, PROFILE_BADGE_DEBOUNCE_MS);
}

function getLoggedInUserIdFromNav() {
  const links = document.querySelectorAll(
    '.navbar-actions a[href*="/users/"], #Alerts a[href*="/users/"]',
  );

  for (const link of links) {
    const href = link.getAttribute("href") || "";
    if (!href.includes("/profile")) continue;
    const id = extractUserIdFromHref(href);
    if (id !== null) return id;
  }

  return null;
}

function getActorUserId() {
  return getLoggedInUserIdFromNav();
}

function isVortex07DeveloperSession() {
  const actorId = getActorUserId();
  return actorId !== null && VORTEX07_DEVELOPER_IDS.has(actorId);
}

async function buildRepActorQuery(extraParams = {}) {
  const voterId = await ensureVoterId();
  const actorId = getActorUserId();

  if (actorId !== null) {
    return new URLSearchParams({
      ...extraParams,
      actorUserId: String(actorId),
      voterId,
    }).toString();
  }

  return new URLSearchParams({ ...extraParams, voterId }).toString();
}

function invalidateRepApiCache(userId = null) {
  const keysToDelete = [];
  for (const key of apiRequestState.cache.keys()) {
    if (!key.includes("/reputation") && !key.includes("/players/batch")) continue;
    if (userId !== null && !key.includes(String(userId))) continue;
    keysToDelete.push(key);
  }
  keysToDelete.forEach((key) => apiRequestState.cache.delete(key));
}

function getReputationApiBase() {
  if (!currentSettings.enabled) return "";
  const custom = safeString(currentSettings.reputationApiUrl).replace(/\/$/, "");
  if (custom && isVortex07DeveloperSession()) return custom;
  return VORTEX07_API_BASE;
}

function getVortex07ApiBase() {
  return getReputationApiBase();
}

async function ensureVoterId() {
  if (sessionMemoryStore.voterId) return sessionMemoryStore.voterId;

  const data = await storageGet("local", { [REPUTATION_VOTER_KEY]: "" });
  if (data[REPUTATION_VOTER_KEY]) {
    sessionMemoryStore.voterId = data[REPUTATION_VOTER_KEY];
    return data[REPUTATION_VOTER_KEY];
  }

  const voterId =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `v${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  sessionMemoryStore.voterId = voterId;
  await storageSet("local", { [REPUTATION_VOTER_KEY]: voterId });
  return voterId;
}

// Reputation is a simple like: your vote is either "up" (liked) or null.
function normalizeRepVote(vote) {
  return vote === "up" || vote === "like" ? "up" : null;
}

async function loadMyReputationVotes() {
  const data = await storageGet("local", { [REPUTATION_MY_VOTES_KEY]: {} });
  const votes = data[REPUTATION_MY_VOTES_KEY];
  if (!votes || typeof votes !== "object") return {};

  const normalized = {};
  Object.entries(votes).forEach(([userId, value]) => {
    // Any truthy legacy value (timestamp, "up", etc.) counts as a like.
    if (value && value !== "down" && value !== "dislike") {
      normalized[userId] = "up";
    }
  });
  return normalized;
}

async function saveMyReputationVote(userId, vote) {
  const votes = await loadMyReputationVotes();
  const key = String(userId);
  if (normalizeRepVote(vote) === "up") votes[key] = "up";
  else delete votes[key];
  await storageSet("local", { [REPUTATION_MY_VOTES_KEY]: votes });
}

async function removeMyReputationVote(userId) {
  await saveMyReputationVote(userId, null);
}

async function getCachedReputation(userId) {
  const data = await storageGet("local", { [REPUTATION_CACHE_KEY]: {} });
  const cache = data[REPUTATION_CACHE_KEY];
  return cache?.[String(userId)] || null;
}

// Count is always the total number of likers (never negative). "myVote" only
// reflects whether YOU liked them, and contributes exactly 0 or 1 to the total.
function buildReputationStatus(count, myVote, meta = {}) {
  const voted = normalizeRepVote(myVote) === "up";
  return {
    count: Math.max(0, Number(count) || 0),
    myVote: voted ? "up" : null,
    hasVoted: voted,
    ...meta,
  };
}

async function cacheReputation(userId, count, myVote) {
  const data = await storageGet("local", { [REPUTATION_CACHE_KEY]: {} });
  const cache = data[REPUTATION_CACHE_KEY] || {};
  const voted = normalizeRepVote(myVote) === "up";
  cache[String(userId)] = {
    count: Math.max(0, Number(count) || 0),
    myVote: voted ? "up" : null,
    hasVoted: voted,
    cachedAt: Date.now(),
  };
  await storageSet("local", { [REPUTATION_CACHE_KEY]: cache });
}

function mergeReputationStatus(apiCount, apiVoted, localVoted, meta = {}) {
  const count = Math.max(0, Number(apiCount) || 0);
  const voted = Boolean(apiVoted || localVoted);

  // If we liked locally but the server hasn't caught up yet, include our +1.
  let displayCount = count;
  if (localVoted && !apiVoted) displayCount = count + 1;
  if (!localVoted && apiVoted) displayCount = count;

  return buildReputationStatus(displayCount, voted ? "up" : null, meta);
}

async function fetchReputationStatus(userId) {
  const myVotes = await loadMyReputationVotes();
  const localVoted = normalizeRepVote(myVotes[String(userId)]) === "up";
  const cached = await getCachedReputation(userId);
  const apiBase = getReputationApiBase();

  // Use cache for instant display while we sync.
  if (cached) {
    const cachedVoted = normalizeRepVote(cached.myVote) === "up";
    const voted = localVoted || cachedVoted;
    if (!apiBase || !isRepApiAvailable()) {
      return buildReputationStatus(cached.count, voted ? "up" : null, {
        synced: false,
        localOnly: true,
      });
    }
  }

  if (!apiBase || !isRepApiAvailable()) {
    if (cached) {
      return buildReputationStatus(cached.count, localVoted ? "up" : null, {
        synced: false,
        localOnly: true,
      });
    }
    return buildReputationStatus(localVoted ? 1 : 0, localVoted ? "up" : null, {
      synced: false,
      localOnly: true,
    });
  }

  try {
    const query = await buildRepActorQuery({ userId: String(userId) });
    const url = `${apiBase}/reputation?${query}`;
    const response = await fetchReputationRequest(url, {
      headers: { Accept: "application/json" },
      force: true,
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const json = await response.json();
    const apiVoted = normalizeRepVote(json.myVote) === "up" || Boolean(json.hasVoted);

    if (localVoted && !apiVoted) {
      void syncPendingReputationVotes();
    }

    const status = mergeReputationStatus(json.count, apiVoted, localVoted, {
      synced: !localVoted || apiVoted,
      localOnly: localVoted && !apiVoted,
    });

    // Keep local vote record in sync with what we display.
    if (status.myVote === "up") {
      await saveMyReputationVote(userId, "up");
    } else if (apiVoted && !localVoted) {
      await saveMyReputationVote(userId, "up");
    } else if (!localVoted && !apiVoted) {
      await removeMyReputationVote(userId);
    }

    await cacheReputation(userId, status.count, status.myVote);
    logRep("Fetched reputation:", { userId, ...status });

    return status;
  } catch (err) {
    markRepApiFailure();
    logRepFailureOnce("Reputation fetch failed:", err);
    if (cached) {
      return buildReputationStatus(
        cached.count,
        localVoted || normalizeRepVote(cached.myVote) === "up" ? "up" : null,
        { synced: false, localOnly: true },
      );
    }
    return buildReputationStatus(localVoted ? 1 : 0, localVoted ? "up" : null, {
      synced: false,
      localOnly: true,
    });
  }
}

async function postReputationAction(userId, action) {
  const actorId = getActorUserId();
  if (actorId === null) throw new Error("not-logged-in");

  const apiBase = getReputationApiBase();
  if (!apiBase) throw new Error("no-api");

  const response = await fetchReputationRequest(`${apiBase}/reputation`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userId,
      actorUserId: actorId,
      action,
      targetUsername: readProfileDisplayName(userId),
    }),
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

// Like or unlike. Saves locally first so a refresh always reflects your click.
async function submitReputationVote(userId, wantLiked) {
  const numericId = safeNumber(userId);
  if (numericId === null) return { ok: false, reason: "invalid-user" };

  const actorId = getActorUserId();
  if (actorId === null) return { ok: false, reason: "not-logged-in" };

  if (actorId === numericId) {
    return { ok: false, reason: "self" };
  }

  const action = wantLiked ? "add" : "remove";
  const cached = await getCachedReputation(numericId);
  const baseCount = Math.max(0, Number(cached?.count) || 0);
  const myVotes = await loadMyReputationVotes();
  const wasLiked = normalizeRepVote(myVotes[String(numericId)]) === "up";

  // Adjust from the count that excludes our vote if we were already counted in cache.
  const countWithoutMe = wasLiked ? Math.max(0, baseCount - 1) : baseCount;
  const optimisticCount = wantLiked ? countWithoutMe + 1 : countWithoutMe;
  const optimisticStatus = buildReputationStatus(
    optimisticCount,
    wantLiked ? "up" : null,
    { synced: false, localOnly: true },
  );

  await saveMyReputationVote(numericId, wantLiked ? "up" : null);
  await cacheReputation(numericId, optimisticStatus.count, optimisticStatus.myVote);

  const apiBase = getReputationApiBase();
  if (apiBase && isExtensionContextAlive()) {
    try {
      const json = await postReputationAction(numericId, action);
      const status = buildReputationStatus(
        json.count,
        json.myVote || (json.hasVoted ? "up" : null),
        { synced: true },
      );
      await saveMyReputationVote(numericId, status.myVote);
      await cacheReputation(numericId, status.count, status.myVote);
      await unqueuePendingReputationVote(numericId);
      invalidateRepApiCache(numericId);
      if (status.myVote === "up") void pushLocalActivityEvent(numericId, 1);
      logRep("Reputation vote synced:", numericId, status.myVote, status.count);
      return { ok: true, ...status };
    } catch (err) {
      markRepApiFailure();
      logRepFailureOnce("Reputation POST failed:", err);
      await queuePendingReputationVote(numericId, wantLiked);
    }
  } else if (apiBase) {
    await queuePendingReputationVote(numericId, wantLiked);
  }

  if (wantLiked) void pushLocalActivityEvent(numericId, 1);
  logRep("Reputation vote (local):", numericId, optimisticStatus.myVote, optimisticStatus.count);
  return { ok: true, ...optimisticStatus };
}

function updateReputationPanel(panel, status) {
  const countEl = panel.querySelector(".vortex07-rep-inline-count");
  const thumbBtn = panel.querySelector(".vortex07-rep-thumb-btn");
  const count = Number(status.count) || 0;
  const voted = normalizeRepVote(status.myVote) === "up";
  const busy = Boolean(status.busy);

  if (countEl) countEl.textContent = String(count);

  if (thumbBtn) {
    thumbBtn.classList.toggle("is-on", voted);
    thumbBtn.disabled = busy;
    thumbBtn.title = voted ? "Remove your like" : "Like";
    thumbBtn.setAttribute("aria-pressed", String(voted));
  }

  panel.dataset.myVote = voted ? "up" : "";
  panel.dataset.count = String(count);
  panel.classList.toggle("vortex07-rep-synced", Boolean(status.synced));
  panel.classList.toggle("vortex07-rep-pending", Boolean(status.localOnly));
}

async function handleReputationPanelAction(panel, userId) {
  const currentlyLiked = panel.dataset.myVote === "up";
  const wantLiked = !currentlyLiked;
  const previous = {
    count: Number(panel.dataset.count) || 0,
    myVote: currentlyLiked ? "up" : null,
  };

  updateReputationPanel(panel, { ...previous, busy: true });

  const result = await submitReputationVote(userId, wantLiked);
  if (!result.ok) {
    updateReputationPanel(panel, { ...previous, busy: false });
    return;
  }

  updateReputationPanel(panel, result);
  scheduleGlobalRepBadges();
}

async function refreshReputationPanel(panel, userId) {
  try {
    const cached = await getCachedReputation(userId);
    const myVotes = await loadMyReputationVotes();
    const localVoted = normalizeRepVote(myVotes[String(userId)]) === "up";
    if (cached || localVoted) {
      updateReputationPanel(
        panel,
        buildReputationStatus(
          cached?.count ?? (localVoted ? 1 : 0),
          localVoted || normalizeRepVote(cached?.myVote) === "up" ? "up" : null,
          { synced: false, localOnly: true },
        ),
      );
    }

    const status = await fetchReputationStatus(userId);
    updateReputationPanel(panel, status);
    return status;
  } catch (err) {
    if (!isContextInvalidatedError(err)) logWarn("Reputation panel refresh failed:", err);
    return null;
  }
}

function injectReputationWidget() {
  if (!currentSettings.enabled) return;

  const userId = getProfileUserIdFromPage();
  if (userId === null) return;

  const header = document.querySelector(".profile-header");
  if (!header) return;

  header.querySelector(".vortex07-reputation-panel")?.remove();

  const stats = header.querySelector(".profile-stats");
  const actions = header.querySelector(".profile-actions");
  const repHost = stats || actions;
  if (!repHost) return;

  let panel =
    repHost.querySelector(".vortex07-rep-inline-widget") ||
    actions?.querySelector(".vortex07-rep-inline-widget") ||
    stats?.querySelector(".vortex07-rep-inline-widget");

  const isNew = !panel;

  if (panel) {
    panel.querySelector(".vortex07-rep-thumb-down")?.remove();
    if (stats && panel.parentElement !== stats) {
      stats.appendChild(panel);
    }
    if (stats && panel.parentElement === stats && !panel.querySelector(".vortex07-profile-stat-sep")) {
      const sep = document.createElement("span");
      sep.className = "vortex07-profile-stat-sep";
      sep.setAttribute("aria-hidden", "true");
      sep.textContent = "|";
      panel.prepend(sep);
    }
  }

  if (!panel) {
    panel = document.createElement("span");
    panel.className = "vortex07-rep-inline-widget";
    panel.dataset.vortex07UserId = String(userId);
    panel.setAttribute("aria-live", "polite");

    panel.innerHTML = `
      <span class="vortex07-profile-stat-sep" aria-hidden="true">|</span>
      <button type="button" class="vortex07-rep-thumb-btn rbx-2007-btn" title="Like" aria-label="Like" aria-pressed="false">
        ${repThumbUpSvg(14)}
      </button><span class="vortex07-rep-inline-count">0</span>`;

    panel.querySelector(".vortex07-rep-thumb-btn")?.addEventListener("click", async () => {
      if (!isExtensionContextAlive()) {
        maybeShowRefreshBanner();
        return;
      }
      await handleReputationPanelAction(panel, userId);
    });

    repHost.appendChild(panel);
  } else if (panel.dataset.vortex07UserId !== String(userId)) {
    panel.dataset.vortex07UserId = String(userId);
    lastRepPanelUserId = null;
  }

  if (isNew || lastRepPanelUserId !== userId) {
    lastRepPanelUserId = userId;
    refreshReputationPanel(panel, userId);
    if (isExtensionContextAlive()) syncPendingReputationVotes();
  }

  injectProfileTierFeatures();
}
