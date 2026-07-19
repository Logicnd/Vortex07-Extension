// Vortex07 content.js
// Clean stable build: 2007 layout + smart player search + safe hover preview.
// IMPORTANT: keep this as plain JavaScript. Do not paste HTML-escaped text like &gt; or &amp;.

const ext = globalThis.Vortex07Ext?.api || (typeof browser !== "undefined" ? browser : chrome);

const VORTEX07_VERSION = (() => {
  try {
    return globalThis.Vortex07Ext?.getManifest?.()?.version || "2.6.0";
  } catch {
    return "2.6.0";
  }
})();
const VORTEX07_ROUTE_CLASS_PREFIX = "vortex07-route-";
const VORTEX_ORIGIN = "https://playvortex.io";
const PLAYVORTEX_WIKI_URL = "https://playvortex.wiki/";
const VORTEX07_SETTINGS_HASH = "#vortex07-settings";
const VORTEX07_FORUM_HASH = "#vortex07-forum";
const VORTEX07_DEVELOPER_IDS = new Set([15936, 18202]);
const VORTEX07_NT_USER_IDS = new Set([6905]);

function isNtVortexUser(userId) {
  const id = safeNumber(userId);
  return id !== null && VORTEX07_NT_USER_IDS.has(id);
}
const VORTEX07_HALO_DEVELOPER_ID = 1;
const VORTEX07_RECENT_PLAYERS_KEY = "vortex07RecentPlayers";
const VORTEX07_PLAYER_ARCHIVE_KEY = "vortex07PlayerArchive";
const VORTEX07_BOOSTER_IDS_KEY = "vortex07BoosterIds";
const VORTEX07_RECENT_PLAYERS_MAX = 10;
const VORTEX07_PLAYER_ARCHIVE_MAX = 500;
const API_TIMEOUT_MS = 5000;
const REPUTATION_VOTER_KEY = "vortex07VoterId";
const REPUTATION_MY_VOTES_KEY = "vortex07MyReputationVotes";
const REPUTATION_CACHE_KEY = "vortex07ReputationCache";
const REPUTATION_PENDING_KEY = "vortex07ReputationPending";
const GAME_VOTES_CACHE_KEY = "vortex07GameVotesCache";
const GAME_MY_VOTES_KEY = "vortex07MyGameVotes";
const GAME_COMMENTS_LOCAL_KEY = "vortex07GameCommentsLocal";
const COMMUNITY_REPUTATION_API = "https://vortex07-extension.vercel.app/api";
const VORTEX07_API_BASE = COMMUNITY_REPUTATION_API;
const LEADERBOARD_CACHE_KEY = "vortex07LeaderboardCache";
const STATUS_CACHE_KEY = "vortex07StatusCache";
const ACTIVITY_CACHE_KEY = "vortex07ActivityCache";
const GUESTBOOK_MAX_LEN = 120;
const STATUS_MAX_LEN = 80;
const VORTEX07_ROULETTE_LAST_KEY = "vortex07RouletteLastId";
const VORTEX07_FRIEND_IDS_CACHE_KEY = "vortex07FriendIdsCache";

const defaultSettings = Vortex07SettingsSchema.DEFAULT_SETTINGS;

let currentSettings = { ...defaultSettings };
let is2007Applied = false;
let bodyContainer = null;
let pageObserverStarted = false;
let layoutGuardStarted = false;
let searchDebounceTimer = null;
let lastSearchQuery = "";
let documentClickAttached = false;
let searchPositionListenersAttached = false;
let searchInputRef = null;
let searchHostRef = null;
let extensionContextValid = true;
let layoutGuardObserver = null;
let pageLayoutObserver = null;
let lastRepPanelUserId = null;
let lastGameRatingGameId = null;
let lastGlobalRepFetchAt = 0;
let lastGlobalRepIdsKey = "";
let lastLayoutEnhanceAt = 0;
let layoutEnhanceDebounceTimer = null;
let lastObserverEnhanceAt = 0;
let lastSessionFetchAt = 0;
let sessionUserFetchInFlight = null;
let repApiDownUntil = 0;
let lastRepFailureLogAt = 0;
let playvortexApiDownUntil = 0;
let playvortexRateLimitedUntil = 0;
let lastPlayvortexFailureLogAt = 0;
let sessionApiDownUntil = 0;
let profileBadgeEnhanceTimer = null;
let profileBadgeHydrateToken = 0;
let friendBadgeHydrateTimer = null;
let friendBadgeHydrateToken = 0;
let profileBadgeObserverStarted = false;
const profileRoleCache = new Map();
const playvortexUserRoleCacheAt = new Map();
const playvortexUserFetchInflight = new Map();
const playvortexInterceptorIngestedIds = new Set();
const knownBoosterIds = new Set();
let knownBoosterIdsLoaded = false;
let roleIngestRefreshTimer = null;
let playvortexUserFetchQueue = [];
let playvortexUserFetchActive = 0;
let playvortexUserFetchQueueTimer = null;
let lastPlayvortexUserFetchStartAt = 0;
let lastFriendBadgePageKey = "";
let friendBadgeApiFetchBudget = 0;
let lastProfileBadgeRefreshUserId = null;
let profileBadgeFastEnhanceTimer = null;
let initialLayoutBuildTimer = null;
let profileBadgeObserver = null;
let observerMutationsPaused = 0;
let isEnhancingBadges = false;
let isRunningLayoutEnhancements = false;
let lastEnhancedProfileKey = "";
let lastKnownPathname = "";

const extensionAssetUrlCache = new Map();
const apiRequestState = {
  queue: [],
  active: 0,
  lastGlobalAt: 0,
  endpointLastAt: new Map(),
  cache: new Map(),
  inflight: new Map(),
};

const GLOBAL_REP_MIN_INTERVAL_MS = 60000;
const PROFILE_BADGE_DEBOUNCE_MS = 200;
const FRIEND_BADGE_DEBOUNCE_MS = 800;
const FRIEND_BADGE_QUEUE_MAX = 3;
const FRIEND_BADGE_QUEUE_SPACING_MS = 3000;
const FRIENDS_ROW_PAGE_SIZE = 10;
const FRIENDS_ROW_PROFILE_PAGE_SIZE = 10;
const PLAYVORTEX_USER_ROLE_CACHE_TTL_MS = 600000;
const PLAYVORTEX_USER_FETCH_MAX_CONCURRENT = 1;
const PLAYVORTEX_USER_FETCH_QUEUE_SPACING_MS = 1200;
const ROLE_INGEST_REFRESH_DEBOUNCE_MS = 500;
const LAYOUT_ENHANCE_INTERVAL_MS = 12000;
const LAYOUT_OBSERVER_DEBOUNCE_MS = 2000;
const SESSION_FETCH_MIN_INTERVAL_MS = 600000;
const REP_API_COOLDOWN_MS = 90000;
const REP_FETCH_TIMEOUT_MS = 8000;
const PLAYVORTEX_API_COOLDOWN_MS = 120000;
const PLAYVORTEX_RATE_LIMIT_COOLDOWN_MS = 900000;

const API_MAX_CONCURRENT_REQUESTS = 2;
const API_GLOBAL_MIN_DELAY_MS = 350;
const API_ENDPOINT_MIN_DELAY_MS = 800;
const API_CACHE_TTL_MS = 120000;
const API_MAX_RETRIES = 0;
const API_REQUEST_TIMEOUT_MS = 5000;
const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_CACHE_TTL_MS = 45000;

const RESILIENCE_SLOW_MS = 8000;
const RESILIENCE_MAX_RETRIES = 2;
const CIRCUIT_FAILURE_THRESHOLD = 3;
const CIRCUIT_FAILURE_WINDOW_MS = 60000;
const ATTACK_MODE_DURATION_MS = 90000;
const ATTACK_MODE_REP_CACHE_MS = 300000;
const ATTACK_MODE_LEADERBOARD_CACHE_MS = 300000;

const RESILIENCE_CIRCUITS = {
  playvortex: { failures: [], attackModeUntil: 0 },
  vortex07_api: { failures: [], attackModeUntil: 0 },
};

const RETRYABLE_HTTP_STATUSES = new Set([429, 502, 503, 504]);

const sessionMemoryStore = {
  voterId: "",
  myVotes: {},
  repCache: {},
  statusCache: {},
  pendingVotes: [],
};

const avatarMemoryCache = new Map();
let lastRecordedProfileVisitId = null;

let extensionPausedForSite = false;

function logDebug(...args) {
  if (currentSettings.debugLogs) console.log("[Vortex07][DEBUG]", ...args);
}

function logApi(...args) {
  if (currentSettings.debugLogs) console.log("[Vortex07][API]", ...args);
}

function logSearch(...args) {
  if (currentSettings.debugLogs) console.log("[Vortex07][SEARCH]", ...args);
}

function logAvatar(...args) {
  if (currentSettings.debugLogs) console.log("[Vortex07][AVATAR]", ...args);
}

function logBanned(...args) {
  if (currentSettings.debugLogs) console.log("[Vortex07][BANNED]", ...args);
}

function logRep(...args) {
  if (currentSettings.debugLogs) console.log("[Vortex07][REP]", ...args);
}

function logWarn(...args) {
  if (currentSettings.debugLogs) console.warn("[Vortex07][WARN]", ...args);
}

function logCritical(...args) {
  console.warn("[Vortex07]", ...args);
}

function logError(...args) {
  console.error("[Vortex07][ERROR]", ...args);
}

function revealBody() {
  document.getElementById("vortex-2007-hide")?.remove();
  document.getElementById("vortex07-anti-fouc")?.remove();
  const html = document.documentElement;
  if (html) {
    html.classList.remove("vortex07-loading");
    html.style.visibility = "";
    html.style.opacity = "";
  }
  if (document.body) {
    document.body.style.visibility = "";
    document.body.style.opacity = "";
  }
}

function ensureNativeAuthStylesheet() {
  document.querySelectorAll('link[rel="stylesheet"]').forEach((link) => {
    const href = link.getAttribute("href") || "";
    if (!/(?:^|\/)auth\.css/i.test(href)) return;
    if (link.disabled) link.disabled = false;
    if (link.dataset.vortex07Disabled === "1") delete link.dataset.vortex07Disabled;
  });
}

function syncNativeSiteStylesheets(enabled) {
  // Keep playvortex auth.css — disabling it breaks login/signup layout.
  const pattern = /(?:^|\/)social\.css|(?:^|\/)catalog\.css/i;

  document.querySelectorAll('link[rel="stylesheet"]').forEach((link) => {
    const href = link.getAttribute("href") || "";
    if (!pattern.test(href)) return;

    if (enabled) {
      link.disabled = true;
      link.dataset.vortex07Disabled = "1";
    } else if (link.dataset.vortex07Disabled === "1") {
      link.disabled = false;
      delete link.dataset.vortex07Disabled;
    }
  });

  ensureNativeAuthStylesheet();
}

function syncThemeStylesheet(enabled) {
  const STYLE_SHEETS = [
    { id: "vortex07-skin-css", path: "skin.css", label: "skin.css" },
  ];

  if (!enabled) {
    STYLE_SHEETS.forEach(({ id }) => document.getElementById(id)?.remove());
    syncNativeSiteStylesheets(false);
    return Promise.resolve();
  }

  syncNativeSiteStylesheets(true);

  const hrefs = STYLE_SHEETS.map((sheet) => ({
    ...sheet,
    href: extensionAssetUrl(sheet.path),
  }));

  const allPresent = hrefs.every(({ id }) => document.getElementById(id));
  if (allPresent) {
    hrefs.forEach(({ id, href }) => {
      const link = document.getElementById(id);
      if (link && link.href !== href) link.href = href;
    });
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const pending = [];

    hrefs.forEach(({ id, href, label }) => {
      const existing = document.getElementById(id);
      if (!existing) {
        const link = document.createElement("link");
        link.id = id;
        link.rel = "stylesheet";
        link.href = href;
        pending.push(
          new Promise((done) => {
            link.onload = () => done();
            link.onerror = () => {
              logError(`Failed to load Vortex07 ${label}`);
              done();
            };
          }),
        );
        (document.head || document.documentElement).appendChild(link);
      } else if (existing.href !== href) {
        existing.href = href;
      }
    });

    if (!pending.length) {
      resolve();
      return;
    }
    Promise.all(pending).then(() => resolve());
  });
}

function extensionAssetUrl(relativePath) {
  if (currentSettings.iconCache !== false && extensionAssetUrlCache.has(relativePath)) {
    return extensionAssetUrlCache.get(relativePath);
  }
  try {
    const base = ext.runtime.getURL(relativePath);
    const url = `${base}?v=${encodeURIComponent(VORTEX07_VERSION)}`;
    if (currentSettings.iconCache !== false) extensionAssetUrlCache.set(relativePath, url);
    return url;
  } catch (_err) {
    return "";
  }
}

function applyTopbarAsset(enabled) {
  const root = document.documentElement;
  if (!root) return;
  if (enabled) {
    root.style.setProperty(
      "--v07-topbar-bg",
      'url("' + chrome.runtime.getURL("assets/topbar.jpg") + '")',
    );
  } else {
    root.style.removeProperty("--v07-topbar-bg");
  }
}

function applyThemePreferences(settings = currentSettings) {
  const root = document.documentElement;
  if (!root) return;
  root.classList.toggle("vortex07-dark", Boolean(settings.darkMode));
  root.dataset.vortex07Theme = settings.darkMode ? "dark" : "light";
  applyTopbarAsset(true);
  refreshBrandLogos(settings);
}

function normalizeSearchText(value) {
  return safeLower(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fuzzyMatchScore(haystack, needle) {
  const h = normalizeSearchText(haystack);
  const n = normalizeSearchText(needle);
  if (!n || n.length < 2) return 0;
  if (h === n) return 100;
  if (h.startsWith(n)) return 90;
  if (h.includes(n)) return 75;

  const tokens = n.split(" ").filter(Boolean);
  if (tokens.length > 1 && tokens.every((token) => h.includes(token))) return 65;

  let hi = 0;
  let score = 0;
  for (let ni = 0; ni < n.length; ni += 1) {
    const ch = n[ni];
    while (hi < h.length && h[hi] !== ch) hi += 1;
    if (hi >= h.length) return 0;
    score += 1;
    hi += 1;
  }
  return Math.round((score / n.length) * 55);
}

function getBrandLogoAssetPath() {
  return "assets/logo.png";
}

function getExtensionBrandLogoUrl(settings = currentSettings) {
  if (!isExtensionContextAlive()) return "";
  return extensionAssetUrl(getBrandLogoAssetPath());
}

function applyBrandLogo(targetEl, settings = currentSettings) {
  if (!targetEl) return;

  let link = targetEl.matches?.("a")
    ? targetEl
    : targetEl.querySelector("a, .navbar-logo");

  if (!link) {
    link = document.createElement("a");
    link.href = "/";
    link.className = "navbar-logo vortex07-logo-link";
    clearElement(targetEl);
    targetEl.appendChild(link);
  } else {
    link.classList.add("vortex07-logo-link");
  }

  link.href = "/";

  const logoUrl = getExtensionBrandLogoUrl(settings);
  let img = link.querySelector(".vortex07-logo-img");

  if (!img) {
    img = document.createElement("img");
    img.className = "vortex07-logo-img";
    img.alt = "Vortex";
    link.textContent = "";
    link.appendChild(img);
  }

  delete img.dataset.vortex07LogoFallback;
  img.onerror = null;
  img.src = logoUrl;
  img.dataset.vortex07LogoAsset = "png";
}

function refreshBrandLogos(settings = currentSettings) {
  ensureShellLogo(settings);

  document.querySelectorAll(".vortex07-roulette-icon").forEach((icon) => {
    icon.src = getExtensionBrandLogoUrl(settings);
  });
}

const VORTEX07_BADGE_ASSETS = {
  owner: "owner.png",
  developer: "dev.png",
  staff: "staff.png",
  booster: "booster.png",
};

function wireBadgeIconFallback(img, kind) {
  if (!img || img.dataset.vortex07BadgeFallback === "1") return;
  img.addEventListener(
    "error",
    () => {
      if (img.dataset.vortex07BadgeFallback === "1") return;
      img.dataset.vortex07BadgeFallback = "1";
      const file = VORTEX07_BADGE_ASSETS[kind];
      if (!file) return;
      const url = badgeAssetUrl(file);
      if (url && img.src !== url) img.src = url;
    },
    { once: true },
  );
}

function ensureShellLogo(settings = currentSettings) {
  const logoSlot = document.querySelector("#Container #Logo");
  if (!logoSlot) return;

  const img = logoSlot.querySelector(".vortex07-logo-img");
  const wantsRefresh = !img || img.dataset.vortex07LogoAsset !== "png";

  if (wantsRefresh) applyBrandLogo(logoSlot, settings);
}

function isPlayvortexUnavailable() {
  const root = document.documentElement;
  const body = document.body;

  if (root?.classList.contains("neterror") || body?.classList.contains("neterror")) {
    return true;
  }

  const errorCode = safeString(document.querySelector(".error-code")?.textContent);
  if (/HTTP ERROR [45]\d\d|ERR_[A-Z_]+|\b52[0-9]\b/i.test(errorCode)) {
    return true;
  }

  const title = safeString(document.title);
  if (
    /connection timed out|error 52[0-9]|error 1200|rate limit|cloudflare/i.test(
      title,
    ) &&
    !document.querySelector(".page, .catalog-container, .navbar, #Container")
  ) {
    return true;
  }

  if (
    document.querySelector("#cf-wrapper, .cf-error-overview, #cf-error-details") &&
    !document.querySelector(".page, .catalog-container, .navbar, #Container")
  ) {
    return true;
  }

  if (
    /^this site can't be reached|^this page isn't working/i.test(title) &&
    !document.querySelector(".page, .catalog-container, .navbar, #Container")
  ) {
    return true;
  }

  if (
    /error 1200|rate limit/i.test(title) &&
    document.querySelector(".error-code, #main-message") &&
    !document.querySelector(".page, .catalog-container, .navbar, #Container")
  ) {
    return true;
  }

  return false;
}

function pauseExtensionForBrokenSite() {
  if (extensionPausedForSite) return true;
  if (!isPlayvortexUnavailable()) return false;

  extensionPausedForSite = true;

  if (layoutBootTimer) {
    clearTimeout(layoutBootTimer);
    layoutBootTimer = null;
  }

  if (layoutGuardObserver) {
    layoutGuardObserver.disconnect();
    layoutGuardObserver = null;
  }

  if (pageLayoutObserver) {
    pageLayoutObserver.disconnect();
    pageLayoutObserver = null;
  }

  if (profileBadgeObserver) {
    profileBadgeObserver.disconnect();
    profileBadgeObserver = null;
  }

  layoutGuardStarted = false;
  pageObserverStarted = false;
  profileBadgeObserverStarted = false;

  revealBody();
  document.documentElement.classList.remove("vortex07-active");
  syncThemeStylesheet(false);

  logCritical(
    "Playvortex is down or unreachable (server/network error). Vortex07 stepped aside — reload when the site works again.",
  );

  return true;
}

function shouldDeferExtensionWork() {
  if (extensionPausedForSite) return true;
  return pauseExtensionForBrokenSite();
}

function normalizeSettings(settings) {
  return Vortex07SettingsSchema.normalizeSettings(settings);
}

function clearElement(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function safeString(value) {
  return String(value || "").trim();
}

function safeLower(value) {
  return safeString(value).toLowerCase();
}

function extractUserIdFromHref(href) {
  const match = safeString(href).match(/\/users\/(\d+)(?:\/|$)/i);
  return match ? safeNumber(match[1]) : null;
}

function safeImageSrc(value, fallback = "") {
  const src = safeString(value);
  if (!src) return fallback;
  if (src.startsWith("data:image/")) return src;
  if (src.startsWith("https://")) return src;
  if (src.startsWith("http://")) return src;
  if (src.startsWith("/")) return `${VORTEX_ORIGIN}${src}`;
  if (src.length > 80 && /^[A-Za-z0-9+/=]+$/.test(src)) {
    return `data:image/png;base64,${src}`;
  }
  return fallback;
}

function extractAvatarUrl(value) {
  if (!value) return "";
  if (typeof value === "string") return safeString(value);
  if (typeof value !== "object") return "";

  const direct = safeString(
    value.dataUri ||
      value.data_uri ||
      value.url ||
      value.image ||
      value.picture ||
      value.avatarUrl ||
      value.avatar_url ||
      value.avatar ||
      value.src,
  );
  if (direct) return direct;

  const base64 = safeString(value.base64 || value.data);
  if (!base64) return "";

  const mime = safeString(value.mime || value.contentType || "image/png");
  if (base64.startsWith("data:image/")) return base64;
  return `data:${mime};base64,${base64}`;
}

function logRepFailureOnce(...args) {
  const now = Date.now();
  if (now - lastRepFailureLogAt < 30000) return;
  lastRepFailureLogAt = now;
  logWarn(...args);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pruneCircuitFailures(circuit) {
  const now = Date.now();
  circuit.failures = circuit.failures.filter(
    (entry) => now - entry.at < CIRCUIT_FAILURE_WINDOW_MS,
  );
}

function isResilienceFailureStatus(status) {
  return (
    status === 429 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    status >= 500
  );
}

function isRetryableResilienceStatus(status) {
  return RETRYABLE_HTTP_STATUSES.has(status);
}

function getResilienceCircuit(name) {
  if (!RESILIENCE_CIRCUITS[name]) {
    RESILIENCE_CIRCUITS[name] = { failures: [], attackModeUntil: 0 };
  }
  return RESILIENCE_CIRCUITS[name];
}

function recordCircuitFailure(circuitName, reason) {
  const circuit = getResilienceCircuit(circuitName);
  const now = Date.now();
  pruneCircuitFailures(circuit);
  circuit.failures.push({ at: now, reason });

  if (circuit.failures.length >= CIRCUIT_FAILURE_THRESHOLD) {
    circuit.attackModeUntil = now + ATTACK_MODE_DURATION_MS;
    circuit.failures = [];
    syncAttackModeBanner();
    logWarn(`Attack mode active for ${circuitName} (${ATTACK_MODE_DURATION_MS / 1000}s)`);
  }

  if (circuitName === "vortex07_api") {
    markRepApiFailure();
  } else if (circuitName === "playvortex") {
    const status = typeof reason === "number" ? reason : 503;
    markPlayvortexApiFailure(status);
  }
}

function recordCircuitSuccess(circuitName) {
  const circuit = getResilienceCircuit(circuitName);
  pruneCircuitFailures(circuit);
  if (Date.now() >= circuit.attackModeUntil) {
    circuit.failures = [];
  }
}

function isCircuitInAttackMode(circuitName) {
  const circuit = getResilienceCircuit(circuitName);
  if (Date.now() < circuit.attackModeUntil) return true;
  if (circuit.attackModeUntil > 0) {
    circuit.attackModeUntil = 0;
    syncAttackModeBanner();
  }
  return false;
}

function isAttackModeActive() {
  return (
    isCircuitInAttackMode("playvortex") || isCircuitInAttackMode("vortex07_api")
  );
}

function shouldSkipNonEssentialPolling() {
  return isAttackModeActive();
}

function getEffectiveGlobalRepIntervalMs() {
  return shouldSkipNonEssentialPolling()
    ? ATTACK_MODE_REP_CACHE_MS
    : GLOBAL_REP_MIN_INTERVAL_MS;
}

function getAttackModeState() {
  return {
    active: isAttackModeActive(),
    playvortex: isCircuitInAttackMode("playvortex"),
    vortex07Api: isCircuitInAttackMode("vortex07_api"),
    until: Math.max(
      getResilienceCircuit("playvortex").attackModeUntil,
      getResilienceCircuit("vortex07_api").attackModeUntil,
    ),
  };
}

function syncAttackModeBanner() {
  const existing = document.getElementById("vortex07-attack-banner");
  if (!isAttackModeActive()) {
    existing?.remove();
    return;
  }

  if (existing) return;

  const alerts = document.getElementById("Alerts");
  if (!alerts) return;

  const banner = document.createElement("div");
  banner.id = "vortex07-attack-banner";
  banner.className = "vortex07-attack-banner";
  banner.textContent =
    "Vortex07: playvortex rate limited — extra requests paused";
  banner.title =
    "Cloudflare limited this tab. Vortex07 will back off for ~15 minutes.";
  alerts.insertAdjacentElement("afterbegin", banner);
}

async function fetchWithResilience(url, options = {}) {
  const {
    circuit = "vortex07_api",
    method = "GET",
    retries = method === "GET" ? RESILIENCE_MAX_RETRIES : 0,
    slowMs = RESILIENCE_SLOW_MS,
    timeoutMs = REP_FETCH_TIMEOUT_MS,
    credentials,
    headers,
    body,
    force = false,
  } = options;

  const effectiveRetries = circuit === "playvortex" ? 0 : retries;

  if (!force && method === "GET" && isCircuitInAttackMode(circuit)) {
    throw new Error(`circuit_open:${circuit}`);
  }

  let lastResponse = null;
  let lastError = null;

  for (let attempt = 0; attempt <= effectiveRetries; attempt += 1) {
    if (attempt > 0) {
      const backoff = Math.min(1000 * 2 ** (attempt - 1), 8000);
      const jitter = Math.floor(Math.random() * 400);
      await sleep(backoff + jitter);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const startedAt = Date.now();

    try {
      const response = await fetch(url, {
        method,
        credentials,
        headers,
        body,
        signal: controller.signal,
      });

      const elapsed = Date.now() - startedAt;
      lastResponse = response;

      if (elapsed > slowMs) {
        recordCircuitFailure(circuit, "slow");
      } else if (isResilienceFailureStatus(response.status)) {
        recordCircuitFailure(circuit, response.status);
        if (
          attempt < effectiveRetries &&
          method === "GET" &&
          isRetryableResilienceStatus(response.status)
        ) {
          continue;
        }
      } else if (response.ok) {
        recordCircuitSuccess(circuit);
      }

      return response;
    } catch (err) {
      lastError = err;
      const reason = err?.name === "AbortError" ? "timeout" : "network";
      recordCircuitFailure(circuit, reason);
      if (attempt < effectiveRetries && method === "GET") continue;
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  if (lastResponse) return lastResponse;
  throw lastError || new Error("fetch failed");
}

function isRepApiAvailable() {
  return Date.now() >= repApiDownUntil;
}

function markRepApiFailure() {
  repApiDownUntil = Date.now() + REP_API_COOLDOWN_MS;
}

function logPlayvortexFailureOnce(...args) {
  const now = Date.now();
  if (now - lastPlayvortexFailureLogAt < 60000) return;
  lastPlayvortexFailureLogAt = now;
  logCritical(...args);
}

function isPlayvortexApiAvailable() {
  return Date.now() >= playvortexApiDownUntil;
}

function isSessionApiAvailable() {
  return Date.now() >= sessionApiDownUntil;
}

function isCloudflareRateLimitText(text) {
  const sample = safeString(text).slice(0, 5000).toLowerCase();
  if (!sample) return false;
  return (
    sample.includes("error 1200") ||
    sample.includes("temporarily rate limited") ||
    (sample.includes("too many requests") &&
      (sample.includes("cloudflare") || sample.includes("ray id")))
  );
}

function parsePlayvortexJsonPayload(text) {
  const raw = safeString(text).trim();
  if (!raw || isCloudflareRateLimitText(raw)) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function markPlayvortexApiFailure(status, options = {}) {
  const severe = Boolean(options.severe || status === 429);
  const cooldown = severe ? PLAYVORTEX_RATE_LIMIT_COOLDOWN_MS : PLAYVORTEX_API_COOLDOWN_MS;

  playvortexApiDownUntil = Date.now() + cooldown;

  if (severe || status === 429) {
    playvortexRateLimitedUntil = Date.now() + cooldown;
    const circuit = getResilienceCircuit("playvortex");
    circuit.attackModeUntil = Date.now() + cooldown;
    circuit.failures = [];
    syncAttackModeBanner();
    logPlayvortexFailureOnce(
      `Playvortex rate limited — pausing extra requests for ${Math.round(cooldown / 60000)} min.`,
    );
    return;
  }

  if (status === 403 || status >= 500) {
    logPlayvortexFailureOnce(
      "Playvortex is having trouble — background requests paused briefly.",
    );
  }
}

function isPlayvortexUserFetchBlocked() {
  return (
    Date.now() < playvortexRateLimitedUntil ||
    Date.now() < playvortexApiDownUntil ||
    isCircuitInAttackMode("playvortex")
  );
}

function isPlayvortexUserRecordPath(path) {
  return /^\/api\/users\/\d+\/?$/.test(String(path || "").split("?")[0]);
}

function rolesSnapshotEqual(a, b) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return (
    Boolean(a.isStaff) === Boolean(b.isStaff) &&
    Boolean(a.isModerator) === Boolean(b.isModerator) &&
    Boolean(a.isBooster) === Boolean(b.isBooster)
  );
}

function hasFreshUserRolesInCache(userId) {
  const id = safeNumber(userId);
  if (id === null || !profileRoleCache.has(id)) return false;
  const cachedAt = playvortexUserRoleCacheAt.get(id) || 0;
  return Date.now() - cachedAt < PLAYVORTEX_USER_ROLE_CACHE_TTL_MS;
}

function resetFriendBadgeBudgetIfPageChanged() {
  const pageKey = safeString(window.location.pathname);
  if (pageKey === lastFriendBadgePageKey) return;
  lastFriendBadgePageKey = pageKey;
  friendBadgeApiFetchBudget = FRIEND_BADGE_QUEUE_MAX;
}

function drainPlayvortexUserFetchQueue() {
  if (isPlayvortexUserFetchBlocked()) return;
  if (playvortexUserFetchActive >= PLAYVORTEX_USER_FETCH_MAX_CONCURRENT) return;
  if (playvortexUserFetchQueue.length === 0) return;

  const sinceLast = Date.now() - lastPlayvortexUserFetchStartAt;
  if (
    lastPlayvortexUserFetchStartAt > 0 &&
    sinceLast < PLAYVORTEX_USER_FETCH_QUEUE_SPACING_MS
  ) {
    if (playvortexUserFetchQueueTimer) return;
    playvortexUserFetchQueueTimer = setTimeout(() => {
      playvortexUserFetchQueueTimer = null;
      drainPlayvortexUserFetchQueue();
    }, PLAYVORTEX_USER_FETCH_QUEUE_SPACING_MS - sinceLast);
    return;
  }

  const item = playvortexUserFetchQueue.shift();
  if (!item) return;

  playvortexUserFetchActive += 1;
  lastPlayvortexUserFetchStartAt = Date.now();

  void (async () => {
    try {
      item.resolve(await item.run());
    } catch (err) {
      item.reject(err);
    } finally {
      playvortexUserFetchActive -= 1;
      drainPlayvortexUserFetchQueue();
    }
  })();

  if (playvortexUserFetchActive < PLAYVORTEX_USER_FETCH_MAX_CONCURRENT) {
    drainPlayvortexUserFetchQueue();
  }
}

function enqueuePlayvortexUserFetch(run) {
  return new Promise((resolve, reject) => {
    playvortexUserFetchQueue.push({ run, resolve, reject });
    drainPlayvortexUserFetchQueue();
  });
}

function markSessionApiFailure(status) {
  sessionApiDownUntil = Date.now() + SESSION_FETCH_MIN_INTERVAL_MS;
  if (status === 429 || status === 403 || status >= 500) {
    logPlayvortexFailureOnce(
      "Playvortex is rate-limiting session checks — username lookup paused.",
    );
  }
}

async function fetchViaExtensionProxy(url, options = {}) {
  const ext = globalThis.Vortex07Ext?.api || chrome;
  if (typeof ext.runtime?.sendMessage !== "function") {
    throw new Error("extension messaging unavailable");
  }

  const payload = await ext.runtime.sendMessage({
    type: "vortex07-api-fetch",
    url,
    method: options.method || "GET",
    headers: options.headers,
    body: options.body,
    adminAuth: Boolean(options.adminAuth),
  });

  if (!payload || payload.error) {
    throw new Error(payload?.error || "extension api proxy failed");
  }

  return new Response(payload.body, {
    status: payload.status || 0,
    statusText: payload.statusText || "",
    headers: payload.headers || {},
  });
}

function shouldProxyVortexApiUrl(url) {
  try {
    const parsed = new URL(String(url));
    if (parsed.protocol !== "https:") return false;
    if (parsed.hostname === "vortex07-extension.vercel.app") return true;
    if (parsed.hostname === "vortex07.vercel.app") return true;
    return parsed.hostname.endsWith(".vercel.app") && parsed.pathname.startsWith("/api");
  } catch {
    return false;
  }
}

async function fetchReputationRequest(url, options = {}) {
  const method = String(options.method || "GET").toUpperCase();
  const isRepMutation =
    (method === "POST" || method === "DELETE") &&
    String(url).includes("/reputation");
  const noCache =
    Boolean(options.force) ||
    String(url).includes("/reputation") ||
    String(url).includes("/players/batch");

  if (isExtensionContextAlive() && shouldProxyVortexApiUrl(url)) {
    try {
      return await fetchViaExtensionProxy(url, options);
    } catch (err) {
      logRepFailureOnce("Extension API proxy failed, retrying direct:", err);
    }
  }

  if (isRepMutation) {
    throw new Error("Reputation votes must use the extension proxy");
  }

  return fetchWithResilience(url, {
    circuit: "vortex07_api",
    method,
    timeoutMs: REP_FETCH_TIMEOUT_MS,
    credentials: options.credentials,
    headers: options.headers,
    body: options.body,
    force: noCache,
  });
}

function isContextInvalidatedError(err) {
  const msg = String(err?.message || err || "").toLowerCase();
  return msg.includes("extension context invalidated");
}

function isExtensionContextAlive() {
  if (!extensionContextValid) return false;

  const check = globalThis.Vortex07Ext?.isContextAlive;
  if (typeof check === "function") {
    const alive = check();
    if (!alive) extensionContextValid = false;
    return alive;
  }

  try {
    if (!ext.runtime?.id) {
      extensionContextValid = false;
      return false;
    }
    return true;
  } catch (err) {
    if (isContextInvalidatedError(err)) extensionContextValid = false;
    return false;
  }
}

function shutdownStaleContentScript(reason) {
  if (!extensionContextValid && !layoutGuardObserver && !pageLayoutObserver) {
    return;
  }

  extensionContextValid = false;
  layoutGuardStarted = false;
  pageObserverStarted = false;

  if (layoutGuardObserver) {
    layoutGuardObserver.disconnect();
    layoutGuardObserver = null;
  }

  if (pageLayoutObserver) {
    pageLayoutObserver.disconnect();
    pageLayoutObserver = null;
  }

  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = null;
  }

  logDebug("Content script halted:", reason);
  maybeShowRefreshBanner();
}

function maybeShowRefreshBanner() {
  if (document.getElementById("vortex07-refresh-banner")) return;

  const banner = document.createElement("div");
  banner.id = "vortex07-refresh-banner";
  banner.textContent = "Vortex07 updated — refresh this page (F5)";
  banner.style.cssText =
    "position:fixed;bottom:0;left:0;right:0;z-index:2147483646;background:#d8d3ec;border-top:1px solid #808080;padding:4px 8px;text-align:center;color:#000;cursor:pointer;";
  banner.addEventListener("click", () => location.reload());

  (document.body || document.documentElement).appendChild(banner);
}

function mergeSessionStorageDefaults(defaults) {
  const out = { ...defaults };

  if (Object.prototype.hasOwnProperty.call(defaults, REPUTATION_VOTER_KEY)) {
    out[REPUTATION_VOTER_KEY] =
      sessionMemoryStore.voterId || defaults[REPUTATION_VOTER_KEY];
  }

  if (Object.prototype.hasOwnProperty.call(defaults, REPUTATION_MY_VOTES_KEY)) {
    out[REPUTATION_MY_VOTES_KEY] = {
      ...(defaults[REPUTATION_MY_VOTES_KEY] || {}),
      ...sessionMemoryStore.myVotes,
    };
  }

  if (Object.prototype.hasOwnProperty.call(defaults, REPUTATION_CACHE_KEY)) {
    out[REPUTATION_CACHE_KEY] = {
      ...(defaults[REPUTATION_CACHE_KEY] || {}),
      ...sessionMemoryStore.repCache,
    };
  }

  if (Object.prototype.hasOwnProperty.call(defaults, REPUTATION_PENDING_KEY)) {
    out[REPUTATION_PENDING_KEY] = sessionMemoryStore.pendingVotes.length
      ? [...sessionMemoryStore.pendingVotes]
      : defaults[REPUTATION_PENDING_KEY];
  }

  return out;
}

function applySessionStorageSet(payload) {
  if (payload[REPUTATION_VOTER_KEY]) {
    sessionMemoryStore.voterId = payload[REPUTATION_VOTER_KEY];
  }

  if (payload[REPUTATION_MY_VOTES_KEY]) {
    sessionMemoryStore.myVotes = {
      ...sessionMemoryStore.myVotes,
      ...payload[REPUTATION_MY_VOTES_KEY],
    };
  }

  if (payload[REPUTATION_CACHE_KEY]) {
    sessionMemoryStore.repCache = {
      ...sessionMemoryStore.repCache,
      ...payload[REPUTATION_CACHE_KEY],
    };
  }

  if (payload[REPUTATION_PENDING_KEY]) {
    sessionMemoryStore.pendingVotes = Array.isArray(payload[REPUTATION_PENDING_KEY])
      ? [...payload[REPUTATION_PENDING_KEY]]
      : sessionMemoryStore.pendingVotes;
  }
}

function storageGet(area, defaults) {
  if (area === "local") {
    defaults = mergeSessionStorageDefaults(defaults);
  }

  if (!isExtensionContextAlive()) {
    return Promise.resolve(defaults);
  }

  const extStorage = globalThis.Vortex07Ext?.storageGet;
  if (typeof extStorage !== "function") {
    logWarn(`storage.${area} unavailable`);
    return Promise.resolve(defaults);
  }

  return extStorage(area, defaults).catch((err) => {
    if (isContextInvalidatedError(err)) {
      shutdownStaleContentScript("storage.get promise");
    } else {
      logWarn(`storage.${area}.get failed:`, err);
    }
    return defaults;
  });
}

function storageSet(area, payload) {
  if (area === "local") applySessionStorageSet(payload);

  if (!isExtensionContextAlive()) {
    return Promise.resolve();
  }

  const extStorage = globalThis.Vortex07Ext?.storageSet;
  if (typeof extStorage !== "function") {
    logWarn(`storage.${area} unavailable`);
    return Promise.resolve();
  }

  return extStorage(area, payload).catch((err) => {
    if (isContextInvalidatedError(err)) {
      shutdownStaleContentScript("storage.set promise");
    } else {
      logWarn(`storage.${area}.set failed:`, err);
    }
  });
}

function isElementInDocument(el) {
  return Boolean(el && document.documentElement.contains(el));
}

function isInsideVortexShell(el) {
  const container = document.getElementById("Container");
  return Boolean(container && el && container.contains(el));
}

function areObserverMutationsPaused() {
  return observerMutationsPaused > 0;
}

function withDomEnhancementPaused(fn) {
  observerMutationsPaused += 1;
  try {
    return fn();
  } finally {
    observerMutationsPaused = Math.max(0, observerMutationsPaused - 1);
  }
}

function notePathnameChange() {
  const path = safeString(window.location.pathname);
  if (path === lastKnownPathname) return false;
  lastKnownPathname = path;
  lastEnhancedProfileKey = "";
  lastProfileBadgeRefreshUserId = null;
  lastGameRatingGameId = null;
  resetFriendBadgeBudgetIfPageChanged();
  if (path !== "/home" && path !== "/") {
    homeLeaderboardInjected = false;
    homeActivityInjected = false;
  }
  return true;
}

function resolvePageRouteKey() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  if (path === "/" || path === "/home") return "home";
  if (path === "/social") return "social";
  if (path.startsWith("/catalog")) return "catalog";
  if (path.includes("/profile")) return "profile";
  if (path === "/download") return "download";
  if (path === "/settings") return "settings";
  if (path.startsWith("/games/")) return "game";
  return "page";
}

function stripRouteClasses(el) {
  if (!el?.classList) return;
  [...el.classList].forEach((cls) => {
    if (cls.startsWith(VORTEX07_ROUTE_CLASS_PREFIX)) {
      el.classList.remove(cls);
    }
  });
}

function syncPageRouteClasses() {
  const container = document.getElementById("Container");
  if (!container) return;

  const routeKey = resolvePageRouteKey();
  stripRouteClasses(container);
  container.classList.add(`${VORTEX07_ROUTE_CLASS_PREFIX}${routeKey}`);

  const page = document.querySelector("#Body > .page, #Body > .catalog-container");
  if (!page) return;

  stripRouteClasses(page);
  page.classList.add(`${VORTEX07_ROUTE_CLASS_PREFIX}${routeKey}`, "vortex07-page-shell");
}

function enhanceSurfaceChrome() {
  document
    .querySelectorAll(
      "#Container .games-section .section-link, #Container .home-section .section-link, #Container .friends-section .section-link",
    )
    .forEach((link) => {
      link.classList.add("vortex07-section-action");
    });

  const socialPage = document.querySelector("#Body > .page:has(.tab-bar)");
  if (socialPage) {
    socialPage.classList.add("vortex07-social-shell");
  }

  const homePage = document.querySelector(
    "#Body > .page:has(.friends-section), #Body > .page:has(.games-section)",
  );
  const container = document.getElementById("Container");
  if (homePage && container?.classList.contains("vortex07-route-home")) {
    homePage.classList.add("vortex07-home-shell", "vortex07-home-retro");
  }

  const profilePage = document.querySelector(
    "#Body > .page:has(.profile-header), #Body > .page:has(.vortex07-profile-header)",
  );
  if (profilePage && container?.classList.contains("vortex07-route-profile")) {
    profilePage.classList.add("vortex07-profile-shell", "vortex07-profile-retro");
  }

  const catalogPage = document.querySelector("#Body > .catalog-container");
  if (catalogPage) {
    catalogPage.classList.add("vortex07-catalog-shell", "vortex07-catalog-retro");
  }

  const gamePage = document.querySelector(
    "#Body > .page:has(.game-detail-header), #Body > .page:has(.game-banner), #Body > .page:has(.game-stat)",
  );
  if (gamePage) {
    gamePage.classList.add("vortex07-game-shell");
  }

  const downloadPage = document.querySelector(
    "#Body > .page:has(.dl-card-platform), #Body > .page:has(.btn-download), #Body > .page:has([class*='dl-'])",
  );
  if (downloadPage) {
    downloadPage.classList.add("vortex07-download-shell", "vortex07-dl-retro");
  }

  document
    .querySelectorAll("#Container .tab-bar, #Container .user-grid, #Container .user-list")
    .forEach((el) => {
      el.classList.add("vortex07-social-surface");
    });

  enhanceSocialPage();
}

function profileBadgesNeedRefresh(header, userId) {
  if (!header || userId === null) return true;
  if (hasUnreplacedNativeBadges(header)) return true;

  const badgeHost = resolveProfileBadgeHost(header);
  if (!badgeHost) return true;

  const mergedRoles = resolvePlayerRoles(userId, readRolesFromScope(header));
  const desiredKinds = resolveBadgeKinds(userId, mergedRoles);

  if (!badgesMatchDesiredState(badgeHost, desiredKinds)) return true;

  return desiredKinds.some((kind) => {
    const wrap = badgeHost.querySelector(`[data-vortex07-badge-kind="${kind}"]`);
    const img = wrap?.querySelector(".vortex07-retro-badge-img");
    return !img?.getAttribute("src");
  });
}

function isProfileBadgeRelevantMutation(mutation) {
  if (!(mutation.target instanceof Element)) return false;

  if (
    mutation.target.closest(
      ".vortex07-retro-badge-wrap, .vortex07-reputation-panel, #vortex07-hover-preview",
    )
  ) {
    return false;
  }

  const profileScope =
    ".profile-header, .vortex07-profile-header, .profile-username, .profile-badges";

  if (mutation.type === "childList") {
    const nodes = [...mutation.addedNodes, ...mutation.removedNodes];
    return nodes.some((node) => {
      if (node instanceof Element) {
        return (
          node.matches?.(
            ".profile-header, .vortex07-profile-header, .profile-username, .profile-badges, .staff-badge-icon, .boost-badge-icon, .moderator-badge-icon",
          ) || Boolean(node.closest?.(profileScope))
        );
      }
      return Boolean(node.parentElement?.closest?.(profileScope));
    });
  }

  if (mutation.type === "attributes") {
    return Boolean(mutation.target.closest?.(profileScope));
  }

  return false;
}

