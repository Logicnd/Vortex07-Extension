
function apiEndpointKey(urlString) {
  try {
    const url = new URL(urlString);
    return `${url.origin}${url.pathname}`;
  } catch {
    return safeString(urlString);
  }
}

function apiCacheKey(method, urlString) {
  try {
    const url = new URL(urlString);
    return `${method}:${url.pathname}${url.search}`;
  } catch {
    return `${method}:${urlString}`;
  }
}

function readApiCacheEntry(key) {
  const entry = apiRequestState.cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.at > API_CACHE_TTL_MS) {
    apiRequestState.cache.delete(key);
    return null;
  }
  return entry;
}

function writeApiCacheEntry(key, value) {
  apiRequestState.cache.set(key, { at: Date.now(), value });
}

function drainApiRequestQueue() {
  if (apiRequestState.active >= API_MAX_CONCURRENT_REQUESTS) return;
  if (apiRequestState.queue.length === 0) return;

  const sinceGlobal = Date.now() - apiRequestState.lastGlobalAt;
  if (sinceGlobal < API_GLOBAL_MIN_DELAY_MS) {
    setTimeout(drainApiRequestQueue, API_GLOBAL_MIN_DELAY_MS - sinceGlobal);
    return;
  }

  const item = apiRequestState.queue.shift();
  if (!item) return;

  const endpoint = apiEndpointKey(item.url);
  const sinceEndpoint = Date.now() - (apiRequestState.endpointLastAt.get(endpoint) || 0);
  if (sinceEndpoint < API_ENDPOINT_MIN_DELAY_MS) {
    apiRequestState.queue.unshift(item);
    setTimeout(drainApiRequestQueue, API_ENDPOINT_MIN_DELAY_MS - sinceEndpoint);
    return;
  }

  apiRequestState.active += 1;
  apiRequestState.lastGlobalAt = Date.now();
  apiRequestState.endpointLastAt.set(endpoint, Date.now());

  void (async () => {
    try {
      item.resolve(await item.run());
    } catch (err) {
      item.reject(err);
    } finally {
      apiRequestState.active -= 1;
      drainApiRequestQueue();
    }
  })();
}

function enqueueManagedApiRequest(url, run) {
  const cacheKey = apiCacheKey("GET", url);
  if (apiRequestState.inflight.has(cacheKey)) {
    return apiRequestState.inflight.get(cacheKey);
  }

  const promise = new Promise((resolve, reject) => {
    apiRequestState.queue.push({ url, run, resolve, reject });
    drainApiRequestQueue();
  }).finally(() => {
    apiRequestState.inflight.delete(cacheKey);
  });

  apiRequestState.inflight.set(cacheKey, promise);
  return promise;
}

async function managedPlayvortexGet(urlString, fetchOptions = {}, cacheOptions = {}) {
  const cacheKey = apiCacheKey("GET", urlString);
  const cached = readApiCacheEntry(cacheKey);
  const allowStale = cacheOptions.allowStale !== false;

  if (cached && !cacheOptions.forceRefresh) {
    if (allowStale && Date.now() - cached.at > API_CACHE_TTL_MS * 0.5) {
      void enqueueManagedApiRequest(urlString, async () => {
        try {
          const fresh = await fetchWithResilience(urlString, fetchOptions);
          if (fresh?.ok) {
            const text = await fresh.clone().text();
            const json = parsePlayvortexJsonPayload(text);
            if (json !== null) writeApiCacheEntry(cacheKey, json);
          }
        } catch {
          /* stale-while-revalidate — ignore background refresh errors */
        }
      }).catch(() => {});
    }
    return cached.value;
  }

  return enqueueManagedApiRequest(urlString, async () => {
    const response = await fetchWithResilience(urlString, fetchOptions);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const rawText = await response.text();
    if (isCloudflareRateLimitText(rawText)) {
      markPlayvortexApiFailure(429, { severe: true });
      throw new Error("rate_limited");
    }
    const json = parsePlayvortexJsonPayload(rawText);
    if (json === null) throw new Error("Invalid JSON response");
    writeApiCacheEntry(cacheKey, json);
    return json;
  });
}

const vortexApi = {
  async get(path, params = {}, options = {}) {
    const userInitiated = Boolean(options.userInitiated);
    const userRecordPath = isPlayvortexUserRecordPath(path);

    if (userRecordPath && isPlayvortexUserFetchBlocked()) {
      logApi("GET skipped (playvortex user cooldown):", path);
      return null;
    }

    if (!userInitiated && !isPlayvortexApiAvailable()) {
      logApi("GET skipped (playvortex cooldown):", path);
      return null;
    }

    const url = new URL(path, VORTEX_ORIGIN);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "")
        url.searchParams.set(key, String(value));
    });

    logApi("GET", url.pathname + url.search);

    const cacheKey = apiCacheKey("GET", url.toString());
    const cached = readApiCacheEntry(cacheKey);
    if (cached && !options.forceRefresh) {
      logApi(`${url.pathname} cache hit`);
      if (Date.now() - cached.at > API_CACHE_TTL_MS * 0.5) {
        void managedPlayvortexGet(
          url.toString(),
          {
            circuit: "playvortex",
            method: "GET",
            timeoutMs: API_REQUEST_TIMEOUT_MS,
            credentials: "include",
            headers: { Accept: "application/json" },
            force: userInitiated,
            retries: API_MAX_RETRIES,
          },
          { allowStale: true, forceRefresh: true },
        ).catch(() => {});
      }
      return cached.value;
    }

    try {
      const json = await managedPlayvortexGet(
        url.toString(),
        {
          circuit: "playvortex",
          method: "GET",
          timeoutMs: API_REQUEST_TIMEOUT_MS,
          credentials: "include",
          headers: { Accept: "application/json" },
          force: userInitiated,
          retries: API_MAX_RETRIES,
        },
        { forceRefresh: Boolean(options.forceRefresh) },
      );

      logApi(`${url.pathname} response:`, json);
      return json;
    } catch (err) {
      if (err?.message === "rate_limited") {
        return null;
      }
      if (err?.message?.startsWith("HTTP ")) {
        const status = Number(err.message.replace("HTTP ", ""));
        if (status === 429 || status === 403 || status >= 500) {
          markPlayvortexApiFailure(status, { severe: status === 429 });
        }
      }
      if (err?.message?.startsWith("circuit_open:")) {
        logApi("GET skipped (attack mode):", path);
        return null;
      }
      if (err.name === "AbortError") logWarn(`API timeout: ${url.pathname}`);
      else logWarn(`API failed: ${url.pathname}`, err);
      return null;
    }
  },
};

function normalizePlayer(rawPlayer) {
  if (!rawPlayer || typeof rawPlayer !== "object") return null;

  const id = safeNumber(rawPlayer.id ?? rawPlayer.userId ?? rawPlayer.user_id);
  if (id === null) return null;

  const username = safeString(
    rawPlayer.username ||
      rawPlayer.name ||
      rawPlayer.userName ||
      rawPlayer.user_name,
  );
  const displayName = safeString(
    rawPlayer.displayName ||
      rawPlayer.display_name ||
      rawPlayer.nickname ||
      username,
  );
  if (!username) return null;

  const detection = detectBannedStatus(rawPlayer);
  const player = {
    id,
    username,
    displayName: displayName || username,
    isBanned: detection.isBanned,
    bannedDetectedBy: detection.detectedBy,
    bannedRawValue: detection.rawValue,
    onlineStatus: readOnlineStatus(rawPlayer),
    lastOnlineAt: readLastOnlineAt(rawPlayer),
    roles: readPlayerRoles(rawPlayer),
    avatarUrl: extractAvatarUrl(
      rawPlayer.avatarUrl ||
        rawPlayer.avatar_url ||
        rawPlayer.avatar ||
        rawPlayer.picture ||
        rawPlayer.profilePicture ||
        rawPlayer.profile_picture ||
        rawPlayer.headshot,
    ),
  };

  logBannedCandidate(rawPlayer, player, detection);
  if (playerPayloadHasRoleSignals(rawPlayer)) {
    rememberPlayvortexUserRoles(rawPlayer);
  }
  player.roles = resolvePlayerRoles(id, readPlayerRoles(rawPlayer));
  return player;
}

function normalizeAvatarMap(rawAvatarResponse) {
  const avatarMap = new Map();
  if (!rawAvatarResponse) return avatarMap;

  if (Array.isArray(rawAvatarResponse)) {
    rawAvatarResponse.forEach((entry) => {
      if (!entry || typeof entry !== "object") return;
      const numericId = Number(
        entry.id ?? entry.userId ?? entry.user_id ?? entry.uid,
      );
      const avatarUrl = extractAvatarUrl(
        entry.dataUri ||
          entry.avatarUrl ||
          entry.avatar ||
          entry.picture ||
          entry.image ||
          entry.url ||
          entry,
      );
      if (!Number.isFinite(numericId) || !avatarUrl) return;
      avatarMap.set(numericId, avatarUrl);
    });
    return avatarMap;
  }

  if (typeof rawAvatarResponse !== "object") return avatarMap;

  const source =
    rawAvatarResponse.avatars ||
    rawAvatarResponse.pictures ||
    rawAvatarResponse.data ||
    rawAvatarResponse;

  if (!source || typeof source !== "object" || Array.isArray(source))
    return avatarMap;

  Object.entries(source).forEach(([id, value]) => {
    const numericId = Number(id);
    const avatarUrl = extractAvatarUrl(value);
    if (!Number.isFinite(numericId) || !avatarUrl) return;
    avatarMap.set(numericId, avatarUrl);
  });

  return avatarMap;
}

function readBooleanLike(value) {
  if (value === true) return true;
  if (value === false) return false;

  const text = safeLower(value);
  return [
    "true",
    "yes",
    "1",
    "banned",
    "terminated",
    "deleted",
    "restricted",
    "disabled",
    "suspended",
  ].includes(text);
}

function detectBannedStatus(rawPlayer) {
  const result = { isBanned: false, detectedBy: "", rawValue: null };
  if (!rawPlayer || typeof rawPlayer !== "object") return result;

  const directFields = [
    "isBanned",
    "banned",
    "is_banned",
    "isTerminated",
    "terminated",
    "is_terminated",
    "deleted",
    "isDeleted",
    "is_deleted",
    "restricted",
    "isRestricted",
    "is_restricted",
    "disabled",
    "isDisabled",
    "is_disabled",
    "suspended",
    "isSuspended",
    "is_suspended",
  ];

  for (const field of directFields) {
    if (Object.prototype.hasOwnProperty.call(rawPlayer, field)) {
      const value = rawPlayer[field];
      if (readBooleanLike(value)) {
        result.isBanned = true;
        result.detectedBy = field;
        result.rawValue = value;
        return result;
      }
    }
  }

  const statusFields = [
    "status",
    "accountStatus",
    "account_status",
    "moderationStatus",
    "moderation_status",
    "state",
  ];
  const bannedWords = [
    "banned",
    "ban",
    "terminated",
    "deleted",
    "restricted",
    "disabled",
    "moderated",
    "suspended",
  ];

  for (const field of statusFields) {
    if (Object.prototype.hasOwnProperty.call(rawPlayer, field)) {
      const value = rawPlayer[field];
      const text = safeLower(value);
      if (bannedWords.some((word) => text.includes(word))) {
        result.isBanned = true;
        result.detectedBy = field;
        result.rawValue = value;
        return result;
      }
    }
  }

  return result;
}

function logBannedCandidate(rawPlayer, normalizedPlayer, detection) {
  if (!currentSettings.debugLogs) return;

  const id =
    normalizedPlayer?.id ??
    rawPlayer?.id ??
    rawPlayer?.userId ??
    rawPlayer?.user_id ??
    "unknown";
  const username =
    normalizedPlayer?.username ??
    rawPlayer?.username ??
    rawPlayer?.name ??
    "unknown";

  if (detection?.isBanned) {
    logBanned("Detected banned user:", {
      id,
      username,
      detectedBy: detection.detectedBy,
      rawValue: detection.rawValue,
      normalized: normalizedPlayer,
      raw: rawPlayer,
    });
    return;
  }

  const visibleSignals = {};
  [
    "isBanned",
    "banned",
    "terminated",
    "deleted",
    "restricted",
    "disabled",
    "suspended",
    "status",
    "accountStatus",
    "moderationStatus",
    "state",
  ].forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(rawPlayer || {}, key))
      visibleSignals[key] = rawPlayer[key];
  });

  if (Object.keys(visibleSignals).length > 0) {
    logBanned("Ban-related fields found but user was not marked banned:", {
      id,
      username,
      fields: visibleSignals,
    });
  }
}
