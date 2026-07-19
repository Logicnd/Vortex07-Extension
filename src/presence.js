/* Sends a heartbeat to the local Vortality/CommitMonster bot so Discord shows Vortex07 presence. */
(function initVortex07RichPresence() {
const ext = globalThis.Vortex07Ext?.api || (typeof browser !== "undefined" ? browser : chrome);

const HEARTBEAT_INTERVAL_MS = 15_000;
const BOT_URL_CANDIDATES = ["http://127.0.0.1:3210", "http://127.0.0.1:3000"];

function isAllowedBotUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
  } catch {
    return false;
  }
}

async function resolveBotUrl() {
  try {
    const stored = await ext.storage.sync.get("vortex07Settings");
    const fromSettings = String(stored?.vortex07Settings?.discordBotUrl || "")
      .trim()
      .replace(/\/$/, "");
    if (fromSettings && isAllowedBotUrl(fromSettings)) return fromSettings;
  } catch {}

  for (const candidate of BOT_URL_CANDIDATES) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${candidate}/api/discord/ping`, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) continue;
      const data = await res.json().catch(() => ({}));
      if (data?.service === "vortality") return candidate;
    } catch {
      continue;
    }
  }

  return BOT_URL_CANDIDATES[0];
}

async function sendHeartbeat() {
  const botUrl = await resolveBotUrl();
  if (!botUrl) return;

  const pathname = location.pathname || "";

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    await fetch(`${botUrl}/api/vortex07/heartbeat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: location.href, pathname }),
      signal: controller.signal
    });
    clearTimeout(timer);
  } catch {
    // Bot may not be running. Fail silently so the extension never breaks for users without it.
  }
}

sendHeartbeat();
setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
})();
