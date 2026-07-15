/* Proxies Vortex07 community API calls — bypasses page CORS from playvortex.io. */
const ext = typeof browser !== "undefined" ? browser : chrome;

const DISCORD_LINK_STORAGE_KEY = "vortex07DiscordLink";
const DISCORD_SYNC_ALARM = "vortex07-discord-sync";
const DISCORD_SYNC_INTERVAL_MINUTES = 15;

/**
 * SECURITY NOTE (secrets in bundle):
 *
 * VOTE_SECRET and ADMIN_SECRET are embedded in this service worker because MV3
 * does not support runtime secret injection. This "raises the bar" against casual
 * API abuse — the signature still requires a matching Vercel env var, and votes are
 * additionally constrained by account-binding, rate limits, and daily caps.
 *
 * For a Chrome Web Store / public release:
 *  - Rotate both secrets to new values on Vercel before publishing.
 *  - Never log these values (debugLogs guard in content.js must not reach SW).
 *  - Admin secret is only injected when message.adminAuth === true, which only
 *    fires for users with dev account IDs (15936, 18202) — client-side guard only;
 *    server-side must validate X-Vortex07-Admin independently.
 */

/** Only the canonical API host is allowed; no wildcard *.vercel.app. */
const ALLOWED_API_HOSTS = new Set(["vortex07.vercel.app"]);

/** Must match VORTEX07_VOTE_SECRET on Vercel. */
const VOTE_SECRET = "vortex07-vote-hmac-v2-5-0-playvortex";
/** Must match VORTEX07_ADMIN_SECRET on Vercel. */
const ADMIN_SECRET = "vortex07-admin-audit-v2-5-0";

function isAllowedApiUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    return ALLOWED_API_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}

function bytesToHex(bytes) {
  return [...new Uint8Array(bytes)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function buildVoteSignatureHeaders(actorUserId, targetUserId) {
  const timestamp = String(Date.now());
  const payload = `${actorUserId}|${targetUserId}|${timestamp}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(VOTE_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return {
    "X-Vortex07-Timestamp": timestamp,
    "X-Vortex07-Signature": bytesToHex(signature),
  };
}

function parseVoteBody(body) {
  if (!body) return null;
  try {
    const json = typeof body === "string" ? JSON.parse(body) : body;
    const actorUserId = String(json?.actorUserId || "").trim();
    const targetUserId = String(json?.userId || "").trim();
    if (!/^\d+$/.test(actorUserId) || !/^\d+$/.test(targetUserId)) return null;
    return { actorUserId, targetUserId };
  } catch {
    return null;
  }
}

function parseVoteQuery(url) {
  try {
    const parsed = new URL(url);
    const actorUserId = String(parsed.searchParams.get("actorUserId") || "").trim();
    const targetUserId = String(parsed.searchParams.get("userId") || "").trim();
    if (!/^\d+$/.test(actorUserId) || !/^\d+$/.test(targetUserId)) return null;
    return { actorUserId, targetUserId };
  } catch {
    return null;
  }
}

async function maybeSignReputationRequest(url, method, headers, body) {
  const upper = String(method || "GET").toUpperCase();
  if (upper !== "POST" && upper !== "DELETE") return headers || {};

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return headers || {};
  }

  // Economy daily claims share the same HMAC scheme (actor == target).
  if (
    !parsed.pathname.endsWith("/reputation") &&
    !parsed.pathname.endsWith("/economy")
  ) {
    return headers || {};
  }

  const vote =
    parseVoteBody(body) ||
    parseVoteQuery(url) ||
    null;
  if (!vote) return headers || {};

  const signHeaders = await buildVoteSignatureHeaders(
    vote.actorUserId,
    vote.targetUserId,
  );
  return { ...(headers || {}), ...signHeaders };
}

function isAllowedDiscordBotUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    return parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
  } catch {
    return false;
  }
}

async function readPlayvortexSessionCookie() {
  const urls = ["https://playvortex.io/", "https://www.playvortex.io/"];
  const seen = new Set();
  const parts = [];

  for (const url of urls) {
    const cookies = await ext.cookies.getAll({ url });
    for (const cookie of cookies || []) {
      const name = String(cookie.name || "").trim();
      const value = String(cookie.value || "").replace(/[\r\n\x00-\x1f\x7f]/g, "");
      if (!name || !value) continue;
      const key = `${name}=${value}`;
      if (seen.has(key)) continue;
      seen.add(key);
      parts.push(`${name}=${value}`);
    }
  }

  if (parts.length) return parts.join("; ");

  const domainCookies = await ext.cookies.getAll({ domain: "playvortex.io" });
  for (const cookie of domainCookies || []) {
    const name = String(cookie.name || "").trim();
    const value = String(cookie.value || "").replace(/[\r\n\x00-\x1f\x7f]/g, "");
    if (!name || !value) continue;
    const key = `${name}=${value}`;
    if (seen.has(key)) continue;
    seen.add(key);
    parts.push(`${name}=${value}`);
  }

  return parts.join("; ");
}

const BOT_URL_CANDIDATES = ["http://127.0.0.1:3210", "http://127.0.0.1:3000"];

async function pingBotUrl(botUrl) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(`${botUrl}/api/discord/ping`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!response.ok) return false;
    const data = await response.json().catch(() => ({}));
    return data?.service === "vortality";
  } catch {
    return false;
  }
}

/** Resolve the bot URL: explicit setting > cached working URL > probe known ports. */
async function getConfiguredBotUrl() {
  const stored = await ext.storage.sync.get("vortex07Settings");
  const fromSettings = String(stored?.vortex07Settings?.discordBotUrl || "")
    .trim()
    .replace(/\/$/, "");
  // Old builds saved the 3000 default as a real value; treat it as "auto" so
  // port detection still runs after the bot moved to 3210.
  if (fromSettings && fromSettings !== "http://127.0.0.1:3000" && fromSettings !== "http://localhost:3000") {
    return fromSettings;
  }

  const link = await readStoredDiscordLink();
  const cached = String(link?.botUrl || "").replace(/\/$/, "");

  const candidates = [...new Set([cached, ...BOT_URL_CANDIDATES].filter(Boolean))];
  for (const candidate of candidates) {
    if (!isAllowedDiscordBotUrl(candidate)) continue;
    if (await pingBotUrl(candidate)) {
      return candidate;
    }
  }

  return cached || BOT_URL_CANDIDATES[0];
}

async function readStoredDiscordLink() {
  const stored = await ext.storage.local.get(DISCORD_LINK_STORAGE_KEY);
  const link = stored?.[DISCORD_LINK_STORAGE_KEY];
  if (!link || typeof link !== "object") return null;
  if (!link.refreshToken && !link.lastSyncAt && !link.lastSyncOk && !link.lastSyncError) {
    return null;
  }
  return link;
}

async function saveStoredDiscordLink(link) {
  await ext.storage.local.set({
    [DISCORD_LINK_STORAGE_KEY]: {
      refreshToken: String(link.refreshToken || ""),
      username: String(link.username || ""),
      botUrl: String(link.botUrl || "http://127.0.0.1:3210").replace(/\/$/, ""),
      linkedAt: link.linkedAt || new Date().toISOString(),
      lastSyncAt: link.lastSyncAt || null,
      lastSyncOk: Boolean(link.lastSyncOk),
      lastSyncError: String(link.lastSyncError || ""),
    },
  });
}

async function clearStoredDiscordLink() {
  await ext.storage.local.remove(DISCORD_LINK_STORAGE_KEY);
}

function scheduleDiscordSyncAlarm() {
  if (!ext.alarms?.create) return;
  ext.alarms.create(DISCORD_SYNC_ALARM, {
    periodInMinutes: DISCORD_SYNC_INTERVAL_MINUTES,
  });
}

async function refreshDiscordSession(force = false) {
  const link = await readStoredDiscordLink();
  const botUrl = await getConfiguredBotUrl();

  if (!isAllowedDiscordBotUrl(botUrl)) {
    return { ok: false, error: "Invalid bot URL for auto-sync." };
  }

  const sessionCookie = await readPlayvortexSessionCookie();
  if (!sessionCookie) {
    return { ok: false, skipped: true, reason: "not-signed-in" };
  }

  if (!force && link?.lastSyncAt && link?.lastSyncOk) {
    const elapsed = Date.now() - new Date(link.lastSyncAt).getTime();
    if (elapsed < 2 * 60 * 1000) {
      return { ok: true, skipped: true, reason: "recently-synced" };
    }
  }

  const payload = { sessionCookie };
  if (link?.refreshToken) {
    payload.refreshToken = link.refreshToken;
  }

  let response;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    response = await fetch(`${botUrl}/api/discord/link/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timer);
  } catch (error) {
    const timedOut = error?.name === "AbortError";
    return {
      ok: false,
      botUrl,
      error: timedOut
        ? `Bot at ${botUrl} did not respond in time. Restart Vortality (npm run dev).`
        : `Bot unreachable at ${botUrl}. Start Vortality with npm run dev.`,
      detail: String(error?.message || error || ""),
    };
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    await saveStoredDiscordLink({
      refreshToken: link?.refreshToken || "",
      username: link?.username || "",
      botUrl,
      linkedAt: link?.linkedAt || null,
      lastSyncAt: new Date().toISOString(),
      lastSyncOk: false,
      lastSyncError: data.error || `Refresh failed (HTTP ${response.status})`,
    });
    return { ok: false, error: data.error || `Refresh failed (HTTP ${response.status})`, botUrl };
  }

  await saveStoredDiscordLink({
    refreshToken: data.refreshToken || link?.refreshToken || "",
    username: data.username || link?.username || "",
    botUrl,
    linkedAt: link?.linkedAt || new Date().toISOString(),
    lastSyncAt: new Date().toISOString(),
    lastSyncOk: true,
    lastSyncError: "",
  });
  scheduleDiscordSyncAlarm();

  return {
    ok: true,
    username: data.username || link?.username || "",
    healed: !link?.refreshToken,
    botUrl,
  };
}

async function completeDiscordLink(message) {
  const code = String(message?.code || "").trim();
  const explicit = String(message?.botUrl || "").trim().replace(/\/$/, "");
  const botUrl =
    !explicit ||
    explicit === "http://127.0.0.1:3000" ||
    explicit === "http://localhost:3000"
      ? await getConfiguredBotUrl()
      : explicit;

  if (!code) {
    return { ok: false, error: "Missing link code." };
  }

  if (!isAllowedDiscordBotUrl(botUrl)) {
    return { ok: false, error: "Discord bot URL must be a local address (127.0.0.1)." };
  }

  const sessionCookie = await readPlayvortexSessionCookie();
  if (!sessionCookie) {
    return { ok: false, error: "Sign in on playvortex.io first, then try again." };
  }

  let response;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    response = await fetch(`${botUrl}/api/discord/link/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, sessionCookie }),
      signal: controller.signal,
    });
    clearTimeout(timer);
  } catch (error) {
    const timedOut = error?.name === "AbortError";
    return {
      ok: false,
      error: timedOut
        ? `Bot at ${botUrl} timed out. Restart Vortality (npm run dev).`
        : `Bot unreachable at ${botUrl}. Start Vortality with npm run dev.`,
    };
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { ok: false, error: data.error || `Link failed (HTTP ${response.status})` };
  }

  if (data.refreshToken) {
    await saveStoredDiscordLink({
      refreshToken: data.refreshToken,
      username: data.username || "",
      botUrl,
      linkedAt: new Date().toISOString(),
      lastSyncAt: new Date().toISOString(),
      lastSyncOk: true,
    });
    scheduleDiscordSyncAlarm();
  }

  return {
    ok: true,
    username: data.username || "",
    autoSync: Boolean(data.refreshToken),
  };
}

async function getDiscordLinkStatus() {
  const link = await readStoredDiscordLink();
  const botUrl = await getConfiguredBotUrl();

  if (!link?.refreshToken && !link?.lastSyncOk) {
    return {
      linked: false,
      botUrl,
      signedIn: Boolean(await readPlayvortexSessionCookie()),
    };
  }

  return {
    linked: Boolean(link?.refreshToken || link?.lastSyncOk),
    username: link?.username || "",
    botUrl: link?.botUrl || botUrl,
    linkedAt: link?.linkedAt || null,
    lastSyncAt: link?.lastSyncAt || null,
    lastSyncOk: Boolean(link?.lastSyncOk),
    lastSyncError: link?.lastSyncError || "",
    signedIn: Boolean(await readPlayvortexSessionCookie()),
  };
}

ext.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "vortex07-discord-link") {
    void completeDiscordLink(message).then(sendResponse);
    return true;
  }

  if (message?.type === "vortex07-discord-sync") {
    void refreshDiscordSession(Boolean(message?.force)).then(sendResponse);
    return true;
  }

  if (message?.type === "vortex07-discord-status") {
    void getDiscordLinkStatus().then(sendResponse);
    return true;
  }

  if (message?.type === "vortex07-discord-unlink-local") {
    void clearStoredDiscordLink().then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message?.type !== "vortex07-api-fetch") return undefined;

  const url = String(message.url || "");
  if (!isAllowedApiUrl(url)) {
    sendResponse({ error: "blocked-url" });
    return false;
  }

  void (async () => {
    try {
      const headers = await maybeSignReputationRequest(
        url,
        message.method,
        message.headers,
        message.body,
      );

      if (message.adminAuth) {
        headers["X-Vortex07-Admin"] = ADMIN_SECRET;
      }

      const response = await fetch(url, {
        method: message.method || "GET",
        headers,
        body: message.body || undefined,
      });

      const body = await response.text();
      sendResponse({
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        body,
        headers: {
          "content-type": response.headers.get("content-type") || "application/json",
        },
      });
    } catch (err) {
      sendResponse({ error: String(err?.message || err || "fetch failed") });
    }
  })();

  return true;
});

if (ext.alarms?.onAlarm) {
  ext.alarms.onAlarm.addListener((alarm) => {
    if (alarm?.name !== DISCORD_SYNC_ALARM) return;
    void refreshDiscordSession(false);
  });
}

if (ext.cookies?.onChanged) {
  ext.cookies.onChanged.addListener((changeInfo) => {
    const cookie = changeInfo?.cookie;
    if (!cookie?.domain?.includes("playvortex.io")) return;
    void refreshDiscordSession(false);
  });
}

let playvortexTabSyncTimer = null;
if (ext.tabs?.onUpdated) {
  ext.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
    if (changeInfo.status !== "complete") return;
    if (!String(tab?.url || "").includes("playvortex.io")) return;
    clearTimeout(playvortexTabSyncTimer);
    playvortexTabSyncTimer = setTimeout(() => {
      void refreshDiscordSession(false);
    }, 1500);
  });
}

void (async () => {
  scheduleDiscordSyncAlarm();
  void refreshDiscordSession(true);
})();
