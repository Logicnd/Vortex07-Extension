/* ========================================================= */
/* FILE 22795 — site-wide ARG (erik2)                        */
/* ========================================================= */

const SCARY_MYTH_USER_ID = 22795;
const SCARY_MYTH_USERNAME = "erik2";
const SCARY_MYTH_PROFILE_PATH = `/users/${SCARY_MYTH_USER_ID}/profile`;
const VORTEX07_SCARY_MYTH_HASH = "#backdoor-22795";
const SCARY_MYTH_GRID_SIZE = 12;
const SCARY_MYTH_KEY = "ERIK2";
const SCARY_MYTH_KNOCK = [2, 2, 7, 9, 5];
const SCARY_MYTH_KNOCK_REVERSE = [5, 9, 7, 2, 2];

function mythCharCodeGridPos(char) {
  return (char.charCodeAt(0) % SCARY_MYTH_GRID_SIZE) + 1;
}

const CATALOG_CHARCODE_SEQ = [...SCARY_MYTH_KEY].map(mythCharCodeGridPos);
const GUESTBOOK_WORD_SEQ = ["home", "social", "catalog", "game", "download"];

const MYTH_ROUTE_BITS = {
  home: 1,
  social: 2,
  catalog: 4,
  download: 8,
  game: 16,
};

const ARG_STORE = {
  gate: "vortex07ArgGate",
  catalog: "vortex07ArgCatalog",
  guestbook: "vortex07ArgGuestbook",
  download: "vortex07ArgDownload",
  trace: "vortex07ArgTrace",
  core: "vortex07ArgCore",
  finale: "vortex07ArgFinale",
  vol: "vortex07ArgVol",
  catalogStep: "vortex07ArgCatalogStep",
  guestbookStep: "vortex07ArgGuestbookStep",
  routes: "vortex07ArgRoutes",
  whisper: "vortex07ArgWhisper",
  batchDup: "vortex07ArgBatchDup",
  logsRead: "vortex07ArgLogsRead",
  gateKnockStep: "vortex07ArgGateKnockStep",
  traceKnockStep: "vortex07ArgTraceKnockStep",
};

const ARG_VOL_HINTS = {
  "02": "site fragments decrypt rows · three at a time",
  "03": "finish catalog · guestbook · download outside first",
  "04": "invert the gate knock on this grid",
  "05": "core stamp required · then seal every log",
};

const MYTH_LOG_HINTS = [
  "",
  "",
  "",
  "unlisted market row",
  "solo lobby seat",
  "rep warmed before signup",
  "five footer stamps",
  "shift · not click",
  "batch parity digit",
  "future forum reply",
  "empty instance ping",
  "backdoor hash",
  "boot-time cache row",
  "charCode remainder grid",
  "footer order · not sentence order",
  "knock backwards here",
  "concatenate route stamps",
  "read all rows · seal file",
];

const ARG_RIDDLES = {
  afterGate: "segment 1 written to cache. unlisted stock exists.",
  afterCatalog: "segment 2 written. profiles keep ledgers for the absent.",
  afterGuestbook: "segment 3 written. the pull endpoint already knew your name.",
  afterDownload: "segments sealed. return to file 22795 · reverse the knock.",
  routesNeeded: "route table incomplete · walk all five footers · then probe batch.",
  whisperNeeded: "batch row duplicated · /players/batch · id 22795 · try twice.",
  doorReady: "backdoor hears you · shift opens what click cannot.",
};

const MYTH_FOOTER_TRACE = {
  home: "·01",
  catalog: "·04",
  social: "·02",
  download: "·07",
  game: "·05",
  page: "·",
};

const MYTH_FOOTER_WHISPERS = [
  "archive sync · pending",
  "route table gap detected",
  "batch endpoint duplicate row",
  "profile-views drift · file 22795",
  "guestbook author mismatch",
  "status ping from empty instance",
  "catalog slot referenced · no asset",
  "rep cache warmed early",
  "leaderboard row · no account",
  "session trace incomplete",
  "footer code is not decoration",
  "remainder grid · twelve slots",
  "parity fault on pull row",
  "shift before click on sealed tags",
];

const MYTH_PAGE_WHISPERS = {
  home: ["catalog ghosts start where nav ends", "footer ·01 is the first route stamp"],
  catalog: ["twelve cells · five taps · key order", "batch thumbs share one face"],
  social: ["footer ·02 between home and catalog", "leaderboard may list him early"],
  download: ["pull row checksum · batch parity", "footer ·07 is last stamp"],
  game: ["footer ·05 before the pull", "two-player lobby · one name"],
  profile: ["rep cache row 22795 · batch twice", "guestbook timestamps lie forward"],
};

const MYTH_LOG_ENTRIES = [
  { id: "01", title: "CATALOG", lines: ["listed under a game that was never uploaded.", "thumbnail is his face. play count: 1."], need: () => argHasGate() },
  { id: "02", title: "GUESTBOOK", lines: ["/api/guestbook returns entries from users who never typed.", "author field: erik2."], need: () => argHasGate() },
  { id: "03", title: "VIEWS", lines: ["/api/profile-views incremented while you were on /download.", "you did not visit."], need: () => argHasGate() },
  { id: "04", title: "KNOCK", lines: ["his file knocks twice, then carries on:", "2 · 2 · 7 · 9 · 5", "the grid listens."], need: () => argHasCatalog() },
  { id: "05", title: "LOBBY", lines: ["two-player server.", "one player listed.", "erik2."], need: () => argHasCatalog() },
  { id: "06", title: "LEADERBOARD", lines: ["ranked before account creation.", "rep cache warmed for 22795 at boot."], need: () => argHasCatalog() },
  { id: "07", title: "ROUTE", lines: ["door not in nav.", "shift opens what click cannot.", "five footers · five stamps."], need: () => argHasGuestbook() },
  { id: "08", title: "SIGHTING", lines: ["do not search for him.", "he is already in the tab behind this one."], need: () => argHasGuestbook() },
  { id: "09", title: "BATCH", lines: ["/api/players/batch returned the same user twice.", "ids matched. count did not.", "parity digit prefixes the pull key."], need: () => argHasGuestbook() },
  { id: "10", title: "FORUM", lines: ["deleted thread. last reply timestamp: future.", "author: erik2."], need: () => argHasDownload() },
  { id: "11", title: "STATUS", lines: ["/api/status: in-game.", "instance player list: []."], need: () => argHasDownload() },
  { id: "12", title: "DOOR", lines: ["backdoor sealed after knock.", "key accepted. myth persists."], need: () => argHasDownload() },
  { id: "13", title: "CACHE", lines: ["redis row for 22795 written at process start.", "no login event preceded it."], need: () => argHasTrace() },
  { id: "14", title: "MOSAIC", lines: ["twelve cells. id-derived batch.", "position = (charCode % 12) + 1."], need: () => argHasTrace() },
  { id: "15", title: "TRACE", lines: ["five routes. five codes.", "footer order · not alphabetical · not sentence order."], need: () => argHasTrace() },
  { id: "16", title: "REVERSE", lines: ["seal wants the knock backwards.", "grid does not forget."], need: () => argHasCore() },
  { id: "17", title: "CORE", lines: ["concatenate route stamps in guestbook order.", "no dots · no spaces · then type at core."], need: () => argHasCore() },
  { id: "18", title: "DASH", lines: ["myth dashboard loads for cleared files only.", "powers list is not a joke."], need: () => argHasFinale() },
];

const MYTH_DASHBOARD = {
  title: "FILE 22795 — MYTH DASHBOARD",
  stats: [
    { label: "scary rating", value: "MAX", bar: 100 },
    { label: "uninvited joins", value: "22795", bar: 100 },
    { label: "backdoor routes", value: "5", bar: 100 },
    { label: "empty-lobby presences", value: "1", bar: 100 },
    { label: "catalog ghosts", value: "1", bar: 100 },
    { label: "rep before existence", value: "YES", bar: 100 },
    { label: "guestbook ghosts", value: "∞", bar: 100 },
    { label: "profile-view drift", value: "ACTIVE", bar: 88 },
    { label: "ARG clearance", value: "LEGEND", bar: 100 },
    { label: "file integrity", value: "BROKEN", bar: 100 },
    { label: "knock echoes", value: "5", bar: 100 },
    { label: "route table gaps", value: "0", bar: 12 },
  ],
  powers: [
    "joins unpublished games without invite",
    "writes guestbook entries while keyboard idle",
    "increments profile-views during /download",
    "appears in batch API twice under one id",
    "ranks on leaderboard before account creation",
    "loads avatar on routes that 404",
    "stands in two-player servers alone",
    "opens doors not listed in nav",
    "survives account deletion in rep cache",
    "mirrors self in /api/players/batch",
    "writes forum replies with future timestamps",
    "occupies empty /api/status instances",
    "maps all five routes without nav entry",
    "unlocks myth dashboard for cleared investigators",
  ],
  foot: "myth canonized · erik2 · contributor file sealed",
};

let argKnockStep = 0;
let argKnockReverseStep = 0;
let catalogGridStep = 0;
let guestbookWordStep = 0;
let argActiveVol = "01";

function argGet(key) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function argSet(key, val) {
  try {
    sessionStorage.setItem(key, val);
  } catch {
    /* ignore */
  }
}

function argHasGate() {
  return argGet(ARG_STORE.gate) === "1";
}
function argHasCatalog() {
  return argGet(ARG_STORE.catalog) === "1";
}
function argHasGuestbook() {
  return argGet(ARG_STORE.guestbook) === "1";
}
function argHasDownload() {
  return argGet(ARG_STORE.download) === "1";
}
function argHasTrace() {
  return argGet(ARG_STORE.trace) === "1";
}
function argHasCore() {
  return argGet(ARG_STORE.core) === "1";
}
function argHasFinale() {
  return argGet(ARG_STORE.finale) === "1";
}
function argHasWhisper() {
  return argGet(ARG_STORE.whisper) === "1";
}
function argRoutesMask() {
  return Number(argGet(ARG_STORE.routes) || 0);
}
function argRoutesComplete() {
  return argRoutesMask() === 31;
}
function argCanOpenArchive() {
  return argRoutesComplete() && argHasWhisper();
}
function argBatchDupCount() {
  const n = Number(argGet(ARG_STORE.batchDup) || 0);
  return n > 0 ? n : 2;
}
function mythFooterTraceCode(route) {
  return safeString(MYTH_FOOTER_TRACE[route] || "").replace(/·/g, "");
}
function mythCoreTraceKey() {
  return GUESTBOOK_WORD_SEQ.map((route) => mythFooterTraceCode(route)).join("");
}
function mythDownloadKey() {
  return `${argBatchDupCount()}59722`;
}
function argLogUnlockCount() {
  if (argHasCore()) return 18;
  if (argHasTrace()) return 15;
  if (argHasDownload()) return 12;
  if (argHasGuestbook()) return 9;
  if (argHasCatalog()) return 6;
  if (argHasGate()) return 3;
  return 0;
}
function argDashUnlockCount() {
  if (argHasFinale()) return MYTH_DASHBOARD.stats.length;
  if (argHasCore()) return 8;
  if (argHasTrace()) return 4;
  return 0;
}
function argDashPowerUnlockCount() {
  if (argHasFinale()) return MYTH_DASHBOARD.powers.length;
  if (argHasCore()) return 5;
  return 0;
}

function argSiteFragmentsComplete() {
  return argHasGate() && argHasCatalog() && argHasGuestbook() && argHasDownload();
}

function argActiveSiteRoute() {
  if (!argHasGate() || argHasFinale()) return null;
  if (!argHasCatalog()) return "catalog";
  if (!argHasGuestbook()) return "profile";
  if (!argHasDownload()) return "download";
  if (!argHasTrace()) return "profile";
  return null;
}

function argVolUnlocked(volId) {
  if (volId === "01") return true;
  if (volId === "02") return argHasGate();
  if (volId === "03") return argSiteFragmentsComplete();
  if (volId === "04") return argHasTrace();
  if (volId === "05") return argHasCore();
  return false;
}

function saveKnockStep(reverse, step) {
  saveArgStep(reverse ? ARG_STORE.traceKnockStep : ARG_STORE.gateKnockStep, step);
}

function loadKnockStep(reverse) {
  return loadArgStep(reverse ? ARG_STORE.traceKnockStep : ARG_STORE.gateKnockStep);
}

function renderArgArchiveFooter() {
  let hint = "· file 22795 · session only ·";
  if (!argHasGate()) hint = "· id splits into five taps ·";
  else if (!argSiteFragmentsComplete()) hint = "· catalog · guestbook · download ·";
  else if (!argHasTrace()) hint = "· first knock · reversed ·";
  else if (!argHasCore()) hint = "· footer stamps · guestbook order ·";
  else if (!argHasFinale()) hint = "· read each log · seal when done ·";
  return `<p class="vortex07-scary-archive-footer">${hint}</p>`;
}

function renderVolLocked(volId, label) {
  const mild = ARG_VOL_HINTS[volId] || "segment sealed";
  return (
    '<div class="vortex07-arg-vol vortex07-arg-vol--locked">' +
    '<pre class="vortex07-scary-archive-banner">═══════════════════\n  ███ — LOCKED\n═══════════════════</pre>' +
    `<p class="vortex07-arg-vol-locked-label">${label}</p>` +
    `<p class="vortex07-arg-vol-locked-hint">${mild}</p>` +
    "</div>"
  );
}

function argMaxUnlockedVol() {
  if (argHasFinale()) return "05";
  if (argHasCore()) return "05";
  if (argHasTrace()) return "04";
  if (argSiteFragmentsComplete()) return "03";
  if (argHasGate()) return "02";
  return "01";
}

function mythPickIndex(pool, salt = "") {
  if (!pool?.length) return 0;
  let hash = 0;
  const seed = `${window.location.pathname}|${salt}`;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash % pool.length;
}

function showArgFragmentToast(text, label = "") {
  document.querySelector(".vortex07-arg-fragment-toast")?.remove();

  const toast = document.createElement("div");
  toast.className = "vortex07-arg-fragment-toast";
  toast.setAttribute("role", "status");
  toast.innerHTML =
    '<div class="vortex07-arg-fragment-titlebar">' +
    '<span class="vortex07-arg-fragment-titlebar-icon" aria-hidden="true">!</span>' +
    `<span class="vortex07-arg-fragment-titlebar-text">${label || "Notice"}</span>` +
    "</div>" +
    '<div class="vortex07-arg-fragment-body">' +
    `<p class="vortex07-arg-fragment-text">${text}</p>` +
    "</div>";

  (document.body || document.documentElement).appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("vortex07-arg-fragment-toast--show"));

  setTimeout(() => {
    toast.classList.remove("vortex07-arg-fragment-toast--show");
    setTimeout(() => toast.remove(), 180);
  }, 5200);
}

function clearScaryMythInjections() {
  stopCatalogGhostWatch();
  stopGuestbookGhostWatch();
  stopDownloadPuzzleWatch();
  document
    .querySelectorAll(
      ".vortex07-scary-name-badge, .vortex07-myth-trace, .vortex07-myth-catalog-ghost, .vortex07-myth-guestbook-ghost, .vortex07-arg-guestbook-section, .vortex07-myth-download-checksum, .vortex07-arg-fragment-toast, .vortex07-myth-home-file, .vortex07-myth-profile-journal, .vortex07-myth-route-panel, .vortex07-myth-leaderboard-note, .vortex07-myth-activity-glitch",
    )
    .forEach((el) => {
      el.remove();
    });
  document
    .querySelectorAll(".vortex07-user-result-scary, .vortex07-user-scary")
    .forEach((el) => {
      el.classList.remove("vortex07-user-result-scary", "vortex07-user-scary");
    });
  document.querySelectorAll(".vortex07-hover-scary").forEach((el) => el.remove());
  document.querySelector(".profile-header")?.classList.remove("vortex07-myth-profile-header");
  closeScarySecretDoorway({ restoreHash: true });
}

function clearScaryProfileEasterEgg() {
  document.querySelectorAll(".vortex07-scary-name-badge, .vortex07-myth-profile-journal").forEach((el) => {
    el.remove();
  });
  document.querySelector(".profile-header")?.classList.remove("vortex07-myth-profile-header");
}

/* ——— archive volumes ——— */

function renderArgVolTabs(activeVol) {
  const vols = [
    { id: "01", label: "GATE" },
    { id: "02", label: "LOGS" },
    { id: "03", label: "TRACE" },
    { id: "04", label: "CORE" },
    { id: "05", label: "DASH" },
  ];

  return (
    '<nav class="vortex07-arg-vol-tabs">' +
    vols
      .map((vol) => {
        const unlocked = argVolUnlocked(vol.id);
        const active = activeVol === vol.id ? " vortex07-arg-vol-tab--active" : "";
        const locked = unlocked ? "" : " vortex07-arg-vol-tab--locked";
        const hint = unlocked ? "" : ` title="${ARG_VOL_HINTS[vol.id] || "locked"}"`;
        return `<button type="button" class="vortex07-arg-vol-tab${active}${locked}" data-vol="${vol.id}"${hint} ${unlocked ? "" : "disabled"}>${vol.label}</button>`;
      })
      .join("") +
    "</nav>"
  );
}

function renderLogEntriesMarkup() {
  const unlockCount = argLogUnlockCount();
  return MYTH_LOG_ENTRIES.map((entry, index) => {
    const unlocked = index < unlockCount && entry.need();
    if (!unlocked) {
      const mildHint =
        index === unlockCount && MYTH_LOG_HINTS[index]
          ? `<p class="vortex07-arg-log-hint">next · ${MYTH_LOG_HINTS[index]}</p>`
          : "";
      return (
        `<section class="vortex07-scary-archive-entry vortex07-scary-archive-entry--locked" data-entry-id="${entry.id}">` +
        `<h3 class="vortex07-scary-archive-entry-title">>> ${entry.id} — ████████</h3>` +
        `<p class="vortex07-arg-log-sealed">segment sealed</p>` +
        mildHint +
        `</section>`
      );
    }
    const readMask = Number(argGet(ARG_STORE.logsRead) || 0);
    const readBit = 1 << index;
    const readClass = readMask & readBit ? " vortex07-arg-log-hit" : "";
    return (
      `<section class="vortex07-scary-archive-entry vortex07-scary-archive-entry--clickable${readClass}" data-entry-id="${entry.id}" data-log-idx="${index}">` +
      `<h3 class="vortex07-scary-archive-entry-title">>> ${entry.id} — ${entry.title}</h3>` +
      entry.lines.map((line) => `<p>${line}</p>`).join("") +
      `</section>`
    );
  }).join("");
}

function renderKnockGridMarkup(extraClass = "", options = {}) {
  const { sealed = false, reverse = false } = options;
  const cells = [];
  const gridExtra = [
    extraClass,
    sealed ? "vortex07-scary-archive-grid--sealed" : "",
    reverse ? "vortex07-arg-grid-reverse" : "",
  ]
    .filter(Boolean)
    .join(" ");

  for (let i = 1; i <= SCARY_MYTH_GRID_SIZE; i++) {
    const cellClass = sealed ? " vortex07-scary-archive-cell--sealed" : "";
    cells.push(
      `<button type="button" class="vortex07-scary-archive-cell vortex07-scary-archive-cell--css${cellClass}" data-idx="${i}" aria-label="${i}" ${sealed ? "disabled" : ""}>` +
        `<span class="vortex07-scary-archive-cell-idx">${i}</span>` +
        `</button>`,
    );
  }
  return `<div class="vortex07-scary-archive-grid ${gridExtra}">${cells.join("")}</div>`;
}

function renderVol01Gate() {
  if (argHasGate()) {
    return (
      '<div class="vortex07-arg-vol vortex07-arg-vol--01">' +
      '<pre class="vortex07-scary-archive-banner">═══════════════════\n  FILE 22795 · sealed\n═══════════════════</pre>' +
      `<p class="vortex07-arg-gate-sealed">knock accepted · ${SCARY_MYTH_KEY}</p>` +
      renderKnockGridMarkup("", { sealed: true }) +
      '<p class="vortex07-arg-vol-note">hunt continues outside the archive.</p>' +
      "</div>"
    );
  }

  return (
    '<div class="vortex07-arg-vol vortex07-arg-vol--01">' +
    '<pre class="vortex07-scary-archive-banner">═══════════════════\n  FILE 22795 · sealed\n═══════════════════</pre>' +
    '<p class="vortex07-arg-vol-note">· five taps · file id splits into digits ·</p>' +
    renderKnockGridMarkup("", { sealed: false }) +
    '<p class="vortex07-scary-key-readout">· · · · ·</p>' +
    '<button type="button" class="vortex07-arg-knock-reset">reset knock</button>' +
    "</div>"
  );
}

function renderVol02Logs() {
  const unlockCount = argLogUnlockCount();
  const sealReady = argHasCore() && unlockCount >= 18 && !argHasFinale();
  return (
    '<div class="vortex07-arg-vol vortex07-arg-vol--02">' +
    '<pre class="vortex07-scary-archive-banner">═══════════════════\n  FILE 22795 — erik2\n═══════════════════</pre>' +
    `<p class="vortex07-arg-vol-note">decrypted ${unlockCount}/18 · mark each row read</p>` +
    `<div class="vortex07-scary-archive-log">${renderLogEntriesMarkup()}</div>` +
    (sealReady
      ? '<button type="button" class="vortex07-arg-log-seal-btn rbx-2007-btn">Seal contributor file</button>'
      : argHasFinale()
        ? '<p class="vortex07-arg-vol-note vortex07-arg-vol-note--dim">· file canonized ·</p>'
        : '<p class="vortex07-arg-vol-note vortex07-arg-vol-note--dim">· more segments unlock with progress ·</p>') +
    "</div>"
  );
}

function renderVol03Trace() {
  const readout = argHasTrace() ? "sealed" : "· · · · ·";
  const sealed = argHasTrace();
  return (
    '<div class="vortex07-arg-vol vortex07-arg-vol--03">' +
    '<pre class="vortex07-scary-archive-banner">═══════════════════\n  TRACE — route seal\n═══════════════════</pre>' +
    '<p class="vortex07-arg-vol-note">invert the first knock · grid remembers</p>' +
    renderKnockGridMarkup("", { sealed, reverse: true }) +
    `<p class="vortex07-scary-key-readout vortex07-arg-reverse-readout${argHasTrace() ? " vortex07-scary-key-complete" : ""}">${readout}</p>` +
    (sealed ? "" : '<button type="button" class="vortex07-arg-knock-reset" data-reverse="1">reset knock</button>') +
    "</div>"
  );
}

function renderVol04Core() {
  return (
    '<div class="vortex07-arg-vol vortex07-arg-vol--04">' +
    '<pre class="vortex07-scary-archive-banner">═══════════════════\n  CORE — stamp confirm\n═══════════════════</pre>' +
    '<p class="vortex07-arg-vol-note">concatenate footer route codes · guestbook order · no separators</p>' +
    '<div class="vortex07-arg-core-input-row">' +
    '<span class="vortex07-arg-core-prompt">&gt;</span>' +
    `<input type="text" class="vortex07-arg-core-input" maxlength="24" autocomplete="off" spellcheck="false" placeholder="····" ${argHasCore() ? "disabled" : ""} />` +
    "</div>" +
    (argHasCore() ? '<p class="vortex07-arg-core-ok">stamp accepted · read remaining logs</p>' : "") +
    "</div>"
  );
}

function renderVol05Dash() {
  const statCount = argDashUnlockCount();
  const powerCount = argDashPowerUnlockCount();
  const stats = MYTH_DASHBOARD.stats
    .slice(0, statCount)
    .map(
      (row) =>
        `<div class="vortex07-arg-dash-stat">` +
        `<span class="vortex07-arg-dash-label">${row.label}</span>` +
        `<span class="vortex07-arg-dash-bar" style="--pct:${row.bar}%"></span>` +
        `<span class="vortex07-arg-dash-value">${row.value}</span>` +
        `</div>`,
    )
    .join("");

  const lockedStats = MYTH_DASHBOARD.stats.length - statCount;
  const lockedStatsMarkup =
    lockedStats > 0
      ? `<p class="vortex07-arg-dash-locked">${lockedStats} stat row${lockedStats === 1 ? "" : "s"} sealed · canonize file</p>`
      : "";

  const powers = MYTH_DASHBOARD.powers
    .slice(0, powerCount)
    .map((p) => `<li>${p}</li>`)
    .join("");
  const lockedPowers = MYTH_DASHBOARD.powers.length - powerCount;
  const lockedPowersMarkup =
    lockedPowers > 0
      ? `<p class="vortex07-arg-dash-locked">${lockedPowers} power${lockedPowers === 1 ? "" : "s"} redacted</p>`
      : "";

  return (
    '<div class="vortex07-arg-vol vortex07-arg-vol--05">' +
    '<pre class="vortex07-scary-archive-banner">═══════════════════\n  MYTH DASHBOARD\n═══════════════════</pre>' +
    `<div class="vortex07-arg-dash-stats">${stats}${lockedStatsMarkup}</div>` +
    '<div class="vortex07-arg-dash-powers">' +
    '<h4 class="vortex07-arg-dash-powers-title">unlocked myth powers</h4>' +
    `<ul>${powers}</ul>${lockedPowersMarkup}` +
    "</div>" +
    `<p class="vortex07-arg-dash-foot">${argHasFinale() ? MYTH_DASHBOARD.foot : "partial clearance · seal file 22795 for full row"}</p>` +
    "</div>"
  );
}

function renderArgVolume(vol) {
  if (!argVolUnlocked(vol)) {
    const labels = { "02": "LOGS", "03": "TRACE", "04": "CORE", "05": "DASH" };
    return renderVolLocked(vol, labels[vol] || "LOCKED");
  }
  if (vol === "01") return renderVol01Gate();
  if (vol === "02") return renderVol02Logs();
  if (vol === "03") return renderVol03Trace();
  if (vol === "04") return renderVol04Core();
  if (vol === "05") return renderVol05Dash();
  return renderVol01Gate();
}

function renderArgArchiveMarkup() {
  const maxVol = argMaxUnlockedVol();
  if (Number(argActiveVol) > Number(maxVol)) argActiveVol = maxVol;
  if (!argVolUnlocked(argActiveVol)) argActiveVol = maxVol;

  return (
    '<div class="vortex07-scary-archive-window vortex07-arg-window">' +
    '<div class="vortex07-scary-archive-titlebar">' +
    '<span class="vortex07-scary-archive-titlebar-icon" aria-hidden="true">▌</span>' +
    '<span class="vortex07-scary-archive-titlebar-text">VORTEX ARCHIVE — 22795</span>' +
    '<button type="button" class="vortex07-scary-archive-close" aria-label="Close">×</button>' +
    "</div>" +
    '<div class="vortex07-scary-archive-body">' +
    renderArgVolTabs(argActiveVol) +
    '<div class="vortex07-arg-vol-host">' +
    renderArgVolume(argActiveVol) +
    "</div>" +
    renderArgArchiveFooter() +
    "</div>" +
    "</div>"
  );
}

/* ——— overlay puzzles ——— */

function labelArgGridCells(overlay, gridSelector = ".vortex07-scary-archive-grid") {
  const grid = overlay?.querySelector(gridSelector);
  if (!grid) return;

  grid.querySelectorAll(".vortex07-scary-archive-cell").forEach((cell, index) => {
    const idx = index + 1;
    cell.dataset.idx = String(idx);
    cell.classList.add("vortex07-scary-archive-cell--css");
    if (cell.querySelector(".vortex07-scary-archive-cell-idx")) return;

    const idxLabel = document.createElement("span");
    idxLabel.className = "vortex07-scary-archive-cell-idx";
    idxLabel.textContent = String(idx);
    cell.appendChild(idxLabel);
  });
}

function resetKnockState(overlay, reverse = false) {
  if (reverse) {
    argKnockReverseStep = 0;
    saveKnockStep(true, 0);
    const readout = overlay?.querySelector(".vortex07-arg-reverse-readout");
    if (readout && !argHasTrace()) readout.textContent = "· · · · ·";
    overlay?.querySelectorAll(".vortex07-arg-grid-reverse .vortex07-scary-archive-cell").forEach((c) => {
      c.classList.remove("vortex07-scary-cell-hit", "vortex07-scary-cell-wrong");
    });
    return;
  }
  argKnockStep = 0;
  saveKnockStep(false, 0);
  if (argHasGate()) return;
  const readout = overlay?.querySelector(".vortex07-arg-vol--01 .vortex07-scary-key-readout");
  if (readout) readout.textContent = "· · · · ·";
  overlay?.querySelectorAll(".vortex07-arg-vol--01 .vortex07-scary-archive-cell").forEach((c) => {
    c.classList.remove("vortex07-scary-cell-hit", "vortex07-scary-cell-wrong");
  });
}

function restoreKnockOverlayState(overlay) {
  if (!overlay) return;

  if (!argHasGate()) {
    const step = loadKnockStep(false);
    argKnockStep = step;
    const readout = overlay.querySelector(".vortex07-arg-vol--01 .vortex07-scary-key-readout");
    if (readout) {
      const slots = Array.from({ length: SCARY_MYTH_KEY.length }, () => "·");
      for (let i = 0; i < step; i++) slots[i] = SCARY_MYTH_KEY[i];
      readout.textContent = slots.join(" ");
    }
    for (let i = 0; i < step; i++) {
      const idx = SCARY_MYTH_KNOCK[i];
      overlay
        .querySelector(`.vortex07-arg-vol--01 .vortex07-scary-archive-cell[data-idx="${idx}"]`)
        ?.classList.add("vortex07-scary-cell-hit");
    }
  }

  if (!argHasTrace() && argSiteFragmentsComplete()) {
    const step = loadKnockStep(true);
    argKnockReverseStep = step;
    const readout = overlay.querySelector(".vortex07-arg-reverse-readout");
    if (readout && step) {
      const slots = Array.from({ length: SCARY_MYTH_KNOCK_REVERSE.length }, () => "·");
      for (let i = 0; i < step; i++) slots[i] = String(SCARY_MYTH_KNOCK_REVERSE[i]);
      readout.textContent = slots.join(" ");
    }
    for (let i = 0; i < step; i++) {
      const idx = SCARY_MYTH_KNOCK_REVERSE[i];
      overlay
        .querySelector(`.vortex07-arg-grid-reverse .vortex07-scary-archive-cell[data-idx="${idx}"]`)
        ?.classList.add("vortex07-scary-cell-hit");
    }
  }
}

function onArgKnockResetClick(overlay, reverse = false) {
  if (reverse && argHasTrace()) return;
  if (!reverse && argHasGate()) return;
  resetKnockState(overlay, reverse);
}

function onKnockCellClick(overlay, cell, reverse = false) {
  const step = reverse ? argKnockReverseStep : argKnockStep;
  const seq = reverse ? SCARY_MYTH_KNOCK_REVERSE : SCARY_MYTH_KNOCK;
  const idx = safeNumber(cell.dataset.idx);
  const expected = seq[step];
  const readout = overlay.querySelector(
    reverse ? ".vortex07-arg-reverse-readout" : ".vortex07-arg-vol--01 .vortex07-scary-key-readout",
  );
  if (idx === null || !readout) return;

  if (idx !== expected) {
    if (reverse) {
      argKnockReverseStep = 0;
      saveKnockStep(true, 0);
      readout.textContent = "· · · · ·";
    } else {
      argKnockStep = 0;
      saveKnockStep(false, 0);
      readout.textContent = "· · · · ·";
    }
    overlay
      .querySelectorAll(
        reverse ? ".vortex07-arg-grid-reverse .vortex07-scary-archive-cell" : ".vortex07-arg-vol--01 .vortex07-scary-archive-cell",
      )
      .forEach((slot) => {
        slot.classList.remove("vortex07-scary-cell-hit", "vortex07-scary-cell-wrong");
      });
    cell.classList.add("vortex07-scary-cell-wrong");
    setTimeout(() => cell.classList.remove("vortex07-scary-cell-wrong"), 420);
    return;
  }

  cell.classList.add("vortex07-scary-cell-hit");

  if (reverse) {
    argKnockReverseStep += 1;
    saveKnockStep(true, argKnockReverseStep);
    if (argKnockReverseStep < seq.length) return;
    argSet(ARG_STORE.trace, "1");
    saveKnockStep(true, 0);
    argKnockReverseStep = 0;
    readout.textContent = "sealed";
    readout.classList.add("vortex07-scary-key-complete");
    argActiveVol = "04";
    refreshArgOverlayIfOpen();
    return;
  }

  const slots = readout.textContent.split(" ");
  slots[argKnockStep] = SCARY_MYTH_KEY[argKnockStep];
  readout.textContent = slots.join(" ");
  argKnockStep += 1;
  saveKnockStep(false, argKnockStep);

  if (argKnockStep < SCARY_MYTH_KEY.length) return;

  argSet(ARG_STORE.gate, "1");
  saveKnockStep(false, 0);
  argKnockStep = 0;
  readout.classList.add("vortex07-scary-key-complete");
  readout.textContent = SCARY_MYTH_KEY;
  showArgFragmentToast(ARG_RIDDLES.afterGate, "segment 1/4");
  setTimeout(() => closeScarySecretDoorway({ restoreHash: true }), 2200);
}

function onCoreKeySubmit(overlay, input) {
  if (argHasCore()) return;
  const val = safeString(input.value).trim();
  if (val !== mythCoreTraceKey()) {
    input.classList.add("vortex07-arg-core-wrong");
    setTimeout(() => input.classList.remove("vortex07-arg-core-wrong"), 500);
    return;
  }
  argSet(ARG_STORE.core, "1");
  argActiveVol = "02";
  refreshArgOverlayIfOpen();
  showArgFragmentToast("core stamp accepted · decrypt remaining logs · seal when read", "core");
}

function onArgLogEntryClick(entryEl) {
  const idx = safeNumber(entryEl.dataset.logIdx);
  if (idx === null) return;
  const readMask = Number(argGet(ARG_STORE.logsRead) || 0);
  const bit = 1 << idx;
  if (readMask & bit) return;
  argSet(ARG_STORE.logsRead, String(readMask | bit));
  entryEl.classList.add("vortex07-arg-log-hit");
}

function onArgLogSealClick() {
  if (!argHasCore() || argHasFinale()) return;
  const unlockCount = argLogUnlockCount();
  if (unlockCount < 18) return;
  const readMask = Number(argGet(ARG_STORE.logsRead) || 0);
  const needMask = (1 << 18) - 1;
  if ((readMask & needMask) !== needMask) {
    showArgFragmentToast("read every decrypted row before sealing", "logs");
    return;
  }
  argSet(ARG_STORE.finale, "1");
  argActiveVol = "05";
  refreshArgOverlayIfOpen();
  showArgFragmentToast("file 22795 canonized · myth dashboard cleared", "sealed");
}

function refreshArgOverlayIfOpen() {
  const overlay = document.getElementById("vortex07-scary-archive-overlay");
  if (!overlay || overlay.hidden) return;
  overlay.innerHTML = renderArgArchiveMarkup();
  bindArgOverlay(overlay);
  labelArgGridCells(overlay, ".vortex07-arg-vol--01 .vortex07-scary-archive-grid:not(.vortex07-arg-grid-reverse)");
  if (argSiteFragmentsComplete()) {
    labelArgGridCells(overlay, ".vortex07-arg-grid-reverse");
  }
  requestAnimationFrame(() => restoreKnockOverlayState(overlay));
}

function bindArgOverlay(overlay) {
  overlay.querySelectorAll(".vortex07-arg-vol-tab:not([disabled])").forEach((tab) => {
    tab.addEventListener("click", () => {
      argActiveVol = tab.dataset.vol || "01";
      refreshArgOverlayIfOpen();
    });
  });

  overlay.querySelectorAll(".vortex07-arg-vol--01 .vortex07-scary-archive-cell").forEach((cell) => {
    cell.addEventListener("click", (e) => {
      e.stopPropagation();
      onKnockCellClick(overlay, cell, false);
    });
  });

  overlay.querySelectorAll(".vortex07-arg-grid-reverse .vortex07-scary-archive-cell").forEach((cell) => {
    cell.addEventListener("click", (e) => {
      e.stopPropagation();
      onKnockCellClick(overlay, cell, true);
    });
  });

  const coreInput = overlay.querySelector(".vortex07-arg-core-input");
  if (coreInput) {
    coreInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") onCoreKeySubmit(overlay, coreInput);
    });
  }

  overlay.querySelectorAll(".vortex07-scary-archive-entry--clickable[data-log-idx]").forEach((entry) => {
    entry.addEventListener("click", () => onArgLogEntryClick(entry));
  });

  overlay.querySelector(".vortex07-arg-log-seal-btn")?.addEventListener("click", onArgLogSealClick);

  overlay.querySelectorAll(".vortex07-arg-knock-reset").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      onArgKnockResetClick(overlay, btn.dataset.reverse === "1");
    });
  });
}

function bindArgOverlayShell(overlay) {
  if (!overlay || overlay.dataset.vortex07ArgShellBound === "1") return;
  overlay.dataset.vortex07ArgShellBound = "1";
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay || event.target.closest(".vortex07-scary-archive-close")) {
      closeScarySecretDoorway({ restoreHash: true });
    }
  });
}

function openScarySecretDoorway() {
  if (!currentSettings.enabled) return;

  let overlay = document.getElementById("vortex07-scary-archive-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "vortex07-scary-archive-overlay";
    overlay.className = "vortex07-scary-archive-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    (document.body || document.documentElement).appendChild(overlay);
    bindArgOverlayShell(overlay);
  }

  const savedVol = argGet(ARG_STORE.vol);
  const maxVol = argMaxUnlockedVol();
  argActiveVol = savedVol && Number(savedVol) <= Number(maxVol) ? savedVol : maxVol;

  overlay.innerHTML = renderArgArchiveMarkup();
  bindArgOverlay(overlay);

  overlay.hidden = false;
  overlay.classList.add("vortex07-scary-archive-open");
  document.documentElement.classList.add("vortex07-scary-archive-active");

  labelArgGridCells(overlay, ".vortex07-arg-vol--01 .vortex07-scary-archive-grid:not(.vortex07-arg-grid-reverse)");
  if (argSiteFragmentsComplete()) {
    labelArgGridCells(overlay, ".vortex07-arg-grid-reverse");
  }
  requestAnimationFrame(() => restoreKnockOverlayState(overlay));

  if (window.location.hash !== VORTEX07_SCARY_MYTH_HASH) {
    const base = `${window.location.pathname}${window.location.search}`;
    history.pushState({ vortex07ScaryMyth: true }, "", `${base}${VORTEX07_SCARY_MYTH_HASH}`);
  }
}

function closeScarySecretDoorway(options = {}) {
  const overlay = document.getElementById("vortex07-scary-archive-overlay");
  if (overlay) {
    argSet(ARG_STORE.vol, argActiveVol);
    overlay.classList.remove("vortex07-scary-archive-open");
    overlay.hidden = true;
  }
  document.documentElement.classList.remove("vortex07-scary-archive-active");

  if (!options.restoreHash) return;
  if (window.location.hash !== VORTEX07_SCARY_MYTH_HASH) return;
  const base = `${window.location.pathname}${window.location.search}`;
  history.replaceState(history.state, "", base || window.location.pathname);
}

function syncScaryMythHashRoute() {
  if (!currentSettings.enabled) return;
  if (window.location.hash === VORTEX07_SCARY_MYTH_HASH && isScaryVortexUser(getProfileUserIdFromPage())) {
    if (!argHasGate() && !argCanOpenArchive()) {
      showArgFragmentToast(
        argRoutesComplete() ? ARG_RIDDLES.whisperNeeded : ARG_RIDDLES.routesNeeded,
        "backdoor sealed",
      );
      void maybeUnlockBatchWhisper();
      return;
    }
    openScarySecretDoorway();
    return;
  }
  if (window.location.hash !== VORTEX07_SCARY_MYTH_HASH) {
    closeScarySecretDoorway({ restoreHash: false });
  }
}

/* ——— site puzzles ——— */

function onCatalogGridCellClick(cell) {
  if (!argHasGate() || argHasCatalog()) return;

  const idx = safeNumber(cell.dataset.idx);
  catalogGridStep = loadArgStep(ARG_STORE.catalogStep);
  const expected = CATALOG_CHARCODE_SEQ[catalogGridStep];
  const ghost = cell.closest(".vortex07-myth-catalog-ghost");
  const readout = ghost?.querySelector(".vortex07-myth-catalog-readout");

  if (idx === null || !readout) return;

  if (idx !== expected) {
    catalogGridStep = 0;
    saveArgStep(ARG_STORE.catalogStep, 0);
    restoreKeyReadout(readout, 0);
    ghost?.querySelectorAll(".vortex07-myth-catalog-cell").forEach((slot) => {
      slot.classList.remove("vortex07-myth-catalog-cell-hit", "vortex07-myth-catalog-cell-wrong");
    });
    cell.classList.add("vortex07-myth-catalog-cell-wrong");
    setTimeout(() => cell.classList.remove("vortex07-myth-catalog-cell-wrong"), 420);
    return;
  }

  cell.classList.add("vortex07-myth-catalog-cell-hit");
  catalogGridStep += 1;
  saveArgStep(ARG_STORE.catalogStep, catalogGridStep);
  restoreKeyReadout(readout, catalogGridStep);

  if (catalogGridStep < SCARY_MYTH_KEY.length) return;

  catalogGridStep = 0;
  saveArgStep(ARG_STORE.catalogStep, 0);
  argSet(ARG_STORE.catalog, "1");
  stopCatalogGhostWatch();
  showArgFragmentToast(ARG_RIDDLES.afterCatalog, "segment 2/4");
}

function bindCatalogGridCell(cell) {
  bindArgPuzzleTap(cell, () => onCatalogGridCellClick(cell));
}

function buildCatalogGhostGrid() {
  const grid = document.createElement("div");
  grid.className = "vortex07-myth-catalog-grid";

  for (let i = 1; i <= SCARY_MYTH_GRID_SIZE; i++) {
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "vortex07-myth-catalog-cell";
    cell.dataset.idx = String(i);
    cell.setAttribute("aria-label", String(i));

    const idxLabel = document.createElement("span");
    idxLabel.className = "vortex07-myth-catalog-cell-idx";
    idxLabel.textContent = String(i);
    cell.appendChild(idxLabel);

    bindCatalogGridCell(cell);
    grid.appendChild(cell);
  }

  return grid;
}

function restoreCatalogGhostState(card) {
  const step = loadArgStep(ARG_STORE.catalogStep);
  catalogGridStep = step;
  const readout = card.querySelector(".vortex07-myth-catalog-readout");
  restoreKeyReadout(readout, step);
  if (!step) return;
  for (let i = 0; i < step; i++) {
    const targetIdx = CATALOG_CHARCODE_SEQ[i];
    const cell = card.querySelector(`.vortex07-myth-catalog-cell[data-idx="${targetIdx}"]`);
    cell?.classList.add("vortex07-myth-catalog-cell-hit");
  }
}

function ensureGuestbookReadout(list) {
  const section = list?.closest(".vortex07-guestbook-section, .vortex07-arg-guestbook-section");
  if (!section || section.querySelector(".vortex07-myth-guestbook-readout")) return;
  const readout = document.createElement("p");
  readout.className = "vortex07-myth-guestbook-readout";
  readout.textContent = "· · · · ·";
  list.insertAdjacentElement("afterend", readout);
}

function onGuestbookWordClick(wordEl) {
  if (!argHasCatalog() || argHasGuestbook()) return;
  guestbookWordStep = loadArgStep(ARG_STORE.guestbookStep);
  const expected = GUESTBOOK_WORD_SEQ[guestbookWordStep];
  const val = safeString(wordEl.dataset.word).toLowerCase();
  const host = wordEl.closest(".vortex07-myth-guestbook-ghost, .vortex07-guestbook-section, .vortex07-arg-guestbook-section");

  if (val !== expected) {
    guestbookWordStep = 0;
    saveArgStep(ARG_STORE.guestbookStep, 0);
    document.querySelectorAll(".vortex07-myth-word-pick").forEach((el) => {
      el.classList.remove("vortex07-myth-word-hit", "vortex07-myth-word-wrong");
    });
    const readout = host?.querySelector(".vortex07-myth-guestbook-readout");
    if (readout) readout.textContent = "· · · · ·";
    wordEl.classList.add("vortex07-myth-word-wrong");
    setTimeout(() => wordEl.classList.remove("vortex07-myth-word-wrong"), 420);
    return;
  }
  wordEl.classList.add("vortex07-myth-word-hit");
  guestbookWordStep += 1;
  saveArgStep(ARG_STORE.guestbookStep, guestbookWordStep);
  const readout =
    host?.closest(".vortex07-guestbook-section, .vortex07-arg-guestbook-section")?.querySelector(
      ".vortex07-myth-guestbook-readout",
    ) || document.querySelector(".vortex07-myth-guestbook-readout");
  if (readout) {
    const slots = ["·", "·", "·", "·", "·"];
    for (let i = 0; i < guestbookWordStep; i++) slots[i] = String(i + 1).padStart(2, "0");
    readout.textContent = slots.join(" ");
  }
  if (guestbookWordStep < GUESTBOOK_WORD_SEQ.length) return;
  guestbookWordStep = 0;
  saveArgStep(ARG_STORE.guestbookStep, 0);
  argSet(ARG_STORE.guestbook, "1");
  stopGuestbookGhostWatch();
  showArgFragmentToast(ARG_RIDDLES.afterGuestbook, "segment 3/4");
}

function onDownloadChecksumSubmit(input) {
  if (!argHasGuestbook() || argHasDownload()) return;
  const val = safeString(input.value).trim().toUpperCase();
  const ok = val === mythDownloadKey();
  if (!ok) {
    input.classList.add("vortex07-arg-core-wrong");
    setTimeout(() => input.classList.remove("vortex07-arg-core-wrong"), 500);
    return;
  }
  argSet(ARG_STORE.download, "1");
  stopDownloadPuzzleWatch();
  input.closest(".vortex07-myth-download-checksum")?.classList.add("vortex07-myth-download-checksum--ok");
  showArgFragmentToast(ARG_RIDDLES.afterDownload, "segments sealed");
}

let catalogGhostObserver = null;
let catalogGhostRetryTimer = null;
let guestbookGhostObserver = null;
let guestbookGhostRetryTimer = null;
let downloadPuzzleObserver = null;
let downloadPuzzleRetryTimer = null;

function loadArgStep(key) {
  return Number(argGet(key) || 0);
}

function saveArgStep(key, step) {
  argSet(key, String(step));
}

function bindArgPuzzleTap(el, handler) {
  el.addEventListener(
    "pointerdown",
    (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      handler(el, event);
    },
    true,
  );
}

function restoreKeyReadout(readoutEl, step, key = SCARY_MYTH_KEY) {
  if (!readoutEl) return;
  const slots = Array.from({ length: key.length }, () => "·");
  for (let i = 0; i < step; i++) slots[i] = key[i];
  readoutEl.textContent = slots.join(" ");
  readoutEl.classList.toggle("vortex07-myth-catalog-readout--complete", step >= key.length);
}

function stopGuestbookGhostWatch() {
  guestbookGhostObserver?.disconnect();
  guestbookGhostObserver = null;
  if (guestbookGhostRetryTimer) {
    clearTimeout(guestbookGhostRetryTimer);
    guestbookGhostRetryTimer = null;
  }
}

function stopDownloadPuzzleWatch() {
  downloadPuzzleObserver?.disconnect();
  downloadPuzzleObserver = null;
  if (downloadPuzzleRetryTimer) {
    clearTimeout(downloadPuzzleRetryTimer);
    downloadPuzzleRetryTimer = null;
  }
}

function stopCatalogGhostWatch() {
  catalogGhostObserver?.disconnect();
  catalogGhostObserver = null;
  if (catalogGhostRetryTimer) {
    clearTimeout(catalogGhostRetryTimer);
    catalogGhostRetryTimer = null;
  }
}

function scheduleCatalogGhostRetry() {
  if (catalogGhostRetryTimer) return;
  catalogGhostRetryTimer = setTimeout(() => {
    catalogGhostRetryTimer = null;
    ensureMythCatalogGhost();
  }, 450);
}

function buildCatalogGhostCard() {
  const panel = document.createElement("section");
  panel.className =
    "vortex07-myth-catalog-ghost vortex07-myth-catalog-ghost--panel vortex07-myth-catalog-ghost--stealth catalog-game-card";

  const head = document.createElement("div");
  head.className = "vortex07-myth-catalog-ghost-head";

  const thumbWrap = document.createElement("div");
  thumbWrap.className = "vortex07-myth-catalog-ghost-thumb";
  thumbWrap.setAttribute("aria-hidden", "true");

  const titleBlock = document.createElement("div");
  titleBlock.className = "vortex07-myth-catalog-ghost-copy";

  const title = document.createElement("p");
  title.className = "vortex07-myth-catalog-ghost-title";
  title.textContent = "unlisted asset · row null";

  const hint = document.createElement("p");
  hint.className = "vortex07-myth-catalog-ghost-hint";
  hint.textContent = "checksum drift · inspect on shift";
  hint.hidden = true;

  const meta = document.createElement("p");
  meta.className = "vortex07-myth-catalog-ghost-meta";
  meta.textContent = "1 play · batch slot null · id 22795";

  titleBlock.append(title, hint, meta);
  head.append(thumbWrap, titleBlock);

  title.addEventListener("click", (event) => {
    if (!event.shiftKey) return;
    event.preventDefault();
    event.stopPropagation();
    panel.classList.toggle("vortex07-myth-catalog-ghost--revealed");
    hint.hidden = !panel.classList.contains("vortex07-myth-catalog-ghost--revealed");
  });

  const puzzle = document.createElement("div");
  puzzle.className = "vortex07-myth-catalog-puzzle";

  const readout = document.createElement("p");
  readout.className = "vortex07-myth-catalog-readout";
  readout.textContent = "· · · · ·";

  const grid = buildCatalogGhostGrid();
  puzzle.append(grid, readout);
  panel.append(head, puzzle);

  panel.addEventListener("click", (e) => {
    if (e.target.closest(".vortex07-myth-catalog-cell")) return;
    e.preventDefault();
    e.stopPropagation();
  });

  return panel;
}

function injectMythCatalogGhost() {
  if (!argHasGate() || argHasCatalog()) return;
  if (resolvePageRouteKey() !== "catalog") return;
  if (document.querySelector(".vortex07-myth-catalog-ghost")) return;

  const card = buildCatalogGhostCard();
  if (!mountCatalogGhostCard(card)) return;

  restoreCatalogGhostState(card);
}

function mountCatalogGhostCard(card) {
  const catalogMain = document.querySelector(".catalog-main");
  const container = document.querySelector(".catalog-container");

  if (catalogMain && isElementInDocument(catalogMain)) {
    const header = catalogMain.querySelector(".catalog-header");
    if (header?.parentElement === catalogMain) {
      catalogMain.insertBefore(card, header.nextSibling);
    } else {
      catalogMain.insertBefore(card, catalogMain.firstChild);
    }
    return true;
  }

  if (container && isElementInDocument(container)) {
    container.insertBefore(card, container.firstChild);
    return true;
  }

  return false;
}

function ensureMythCatalogGhost() {
  if (!currentSettings.enabled || !argHasGate() || argHasCatalog()) {
    stopCatalogGhostWatch();
    return;
  }
  if (resolvePageRouteKey() !== "catalog") {
    stopCatalogGhostWatch();
    return;
  }

  injectMythCatalogGhost();

  if (document.querySelector(".vortex07-myth-catalog-ghost")) {
    if (catalogGhostRetryTimer) {
      clearTimeout(catalogGhostRetryTimer);
      catalogGhostRetryTimer = null;
    }
  } else {
    scheduleCatalogGhostRetry();
  }

  if (catalogGhostObserver) return;

  const watchRoot = document.querySelector(".catalog-container, #Container, #Body");
  if (!watchRoot) {
    scheduleCatalogGhostRetry();
    return;
  }

  catalogGhostObserver = new MutationObserver(() => {
    if (!currentSettings.enabled || argHasCatalog() || resolvePageRouteKey() !== "catalog") {
      stopCatalogGhostWatch();
      return;
    }
    if (!document.querySelector(".vortex07-myth-catalog-ghost")) {
      injectMythCatalogGhost();
    }
  });
  catalogGhostObserver.observe(watchRoot, { childList: true, subtree: true });
}

function getOrCreateArgGuestbookList() {
  if (!isScaryVortexUser(getProfileUserIdFromPage())) return null;

  const existing =
    document.querySelector(".vortex07-guestbook-list") ||
    document.querySelector(".vortex07-arg-guestbook-list");
  if (existing) return existing;

  const anchor =
    document.querySelector(".profile-header")?.closest(".page") ||
    document.querySelector("#Body > .page:has(.profile-header)");
  if (!anchor) return null;

  const section = document.createElement("section");
  section.className = "vortex07-arg-guestbook-section home-section vortex07-guestbook-section";
  section.innerHTML =
    '<div class="section-header"><h2 class="section-title">Guestbook</h2></div>' +
    '<ul class="vortex07-arg-guestbook-list"></ul>' +
    '<p class="vortex07-myth-guestbook-readout">· · · · ·</p>';
  anchor.appendChild(section);
  return section.querySelector(".vortex07-arg-guestbook-list");
}

function buildGuestbookGhostEntry() {
  const li = document.createElement("li");
  li.className = "vortex07-guestbook-entry vortex07-myth-guestbook-ghost";

  const meta = document.createElement("div");
  meta.className = "vortex07-guestbook-entry-meta";

  const author = document.createElement("span");
  author.className = "vortex07-guestbook-author";
  author.textContent = SCARY_MYTH_USERNAME;

  const date = document.createElement("time");
  date.className = "vortex07-guestbook-date";
  date.textContent = "· future ·";

  meta.append(author, date);

  const body = document.createElement("p");
  body.className = "vortex07-guestbook-message vortex07-myth-guestbook-message";

  const parts = [
    { text: "joined a ", word: null },
    { text: "game", word: "game" },
    { text: " lobby after ", word: null },
    { text: "download", word: "download" },
    { text: " pull · seen on ", word: null },
    { text: "home", word: "home" },
    { text: " · listed in ", word: null },
    { text: "catalog", word: "catalog" },
    { text: " · wrote on ", word: null },
    { text: "social", word: "social" },
    { text: ".", word: null },
  ];

  parts.forEach((part) => {
    if (!part.word) {
      body.append(document.createTextNode(part.text));
      return;
    }
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "vortex07-myth-word-pick";
    btn.dataset.word = part.word;
    btn.textContent = part.text;
    bindArgPuzzleTap(btn, () => onGuestbookWordClick(btn));
    body.appendChild(btn);
  });

  li.append(meta, body);
  return li;
}

function restoreGuestbookGhostState(host) {
  const step = loadArgStep(ARG_STORE.guestbookStep);
  guestbookWordStep = step;
  const readout =
    host?.closest(".vortex07-guestbook-section, .vortex07-arg-guestbook-section")?.querySelector(
      ".vortex07-myth-guestbook-readout",
    ) || document.querySelector(".vortex07-myth-guestbook-readout");
  if (readout && step) {
    const slots = ["·", "·", "·", "·", "·"];
    for (let i = 0; i < step; i++) slots[i] = String(i + 1).padStart(2, "0");
    readout.textContent = slots.join(" ");
  }
  document.querySelectorAll(".vortex07-myth-guestbook-ghost .vortex07-myth-word-pick").forEach((btn) => {
    const order = GUESTBOOK_WORD_SEQ.indexOf(btn.dataset.word || "");
    if (order !== -1 && order < step) btn.classList.add("vortex07-myth-word-hit");
  });
}

function injectMythGuestbookGhost() {
  if (!argHasCatalog() || argHasGuestbook()) return;
  if (!isScaryVortexUser(getProfileUserIdFromPage())) return;

  const list = getOrCreateArgGuestbookList();
  if (!list || list.querySelector(".vortex07-myth-guestbook-ghost")) return;

  list.prepend(buildGuestbookGhostEntry());
  ensureGuestbookReadout(list);
  restoreGuestbookGhostState(list);
}

function scheduleGuestbookGhostRetry() {
  if (guestbookGhostRetryTimer) return;
  guestbookGhostRetryTimer = setTimeout(() => {
    guestbookGhostRetryTimer = null;
    ensureMythGuestbookGhost();
  }, 450);
}

function ensureMythGuestbookGhost() {
  if (!currentSettings.enabled || !argHasCatalog() || argHasGuestbook()) {
    stopGuestbookGhostWatch();
    return;
  }
  if (!isScaryVortexUser(getProfileUserIdFromPage())) return;

  injectMythGuestbookGhost();

  if (document.querySelector(".vortex07-myth-guestbook-ghost")) {
    if (guestbookGhostRetryTimer) {
      clearTimeout(guestbookGhostRetryTimer);
      guestbookGhostRetryTimer = null;
    }
  } else {
    scheduleGuestbookGhostRetry();
  }

  if (guestbookGhostObserver) return;

  const watchRoot = document.querySelector("#Body, #Container");
  if (!watchRoot) {
    scheduleGuestbookGhostRetry();
    return;
  }

  guestbookGhostObserver = new MutationObserver(() => {
    if (!currentSettings.enabled || argHasGuestbook() || !argHasCatalog()) {
      stopGuestbookGhostWatch();
      return;
    }
    if (!isScaryVortexUser(getProfileUserIdFromPage())) return;
    if (!document.querySelector(".vortex07-myth-guestbook-ghost")) {
      injectMythGuestbookGhost();
    }
  });
  guestbookGhostObserver.observe(watchRoot, { childList: true, subtree: true });
}

function injectMythDownloadChecksum() {
  if (!argHasGuestbook() || argHasDownload()) return;
  if (resolvePageRouteKey() !== "download") return;

  const host =
    document.querySelector(".dl-card-platform")?.closest(".dl-card") ||
    document.querySelector(".btn-download")?.closest(".page") ||
    document.querySelector("#Body > .page");
  if (!host || host.querySelector(".vortex07-myth-download-checksum")) return;

  const platform = host.querySelector(".dl-card-platform, .dl-meta, .dl-card-body");
  const wrap = document.createElement("div");
  wrap.className = "vortex07-myth-download-checksum dl-meta-footnote";

  const line = document.createElement("button");
  line.type = "button";
  line.className = "vortex07-myth-download-checksum-line";
  line.textContent = "checksum mismatch · 0x22795 · verify";

  const panel = document.createElement("div");
  panel.className = "vortex07-myth-download-checksum-panel";
  panel.hidden = true;

  const prompt = document.createElement("span");
  prompt.className = "vortex07-myth-download-checksum-prompt";
  prompt.textContent = ">";

  const input = document.createElement("input");
  input.type = "text";
  input.className = "vortex07-myth-download-checksum-input";
  input.maxLength = 12;
  input.autocomplete = "off";
  input.spellcheck = false;
  input.placeholder = "····";

  line.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
    if (!panel.hidden) input.focus();
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") onDownloadChecksumSubmit(input);
  });

  panel.append(prompt, input);
  wrap.append(line, panel);

  if (platform) {
    platform.appendChild(wrap);
    return;
  }

  const anchor = host.querySelector(".btn-download") || host.querySelector(".dl-notice") || host.firstElementChild;
  if (anchor?.parentElement) {
    anchor.parentElement.insertBefore(wrap, anchor.nextSibling);
  } else {
    host.appendChild(wrap);
  }
}

function scheduleDownloadPuzzleRetry() {
  if (downloadPuzzleRetryTimer) return;
  downloadPuzzleRetryTimer = setTimeout(() => {
    downloadPuzzleRetryTimer = null;
    ensureMythDownloadChecksum();
  }, 450);
}

function ensureMythDownloadChecksum() {
  if (!currentSettings.enabled || !argHasGuestbook() || argHasDownload()) {
    stopDownloadPuzzleWatch();
    return;
  }
  if (resolvePageRouteKey() !== "download") {
    stopDownloadPuzzleWatch();
    return;
  }

  injectMythDownloadChecksum();

  if (document.querySelector(".vortex07-myth-download-checksum")) {
    if (downloadPuzzleRetryTimer) {
      clearTimeout(downloadPuzzleRetryTimer);
      downloadPuzzleRetryTimer = null;
    }
  } else {
    scheduleDownloadPuzzleRetry();
  }

  if (downloadPuzzleObserver) return;

  const watchRoot = document.querySelector("#Body, #Container");
  if (!watchRoot) {
    scheduleDownloadPuzzleRetry();
    return;
  }

  downloadPuzzleObserver = new MutationObserver(() => {
    if (!currentSettings.enabled || argHasDownload() || !argHasGuestbook()) {
      stopDownloadPuzzleWatch();
      return;
    }
    if (resolvePageRouteKey() !== "download") return;
    if (!document.querySelector(".vortex07-myth-download-checksum")) {
      injectMythDownloadChecksum();
    }
  });
  downloadPuzzleObserver.observe(watchRoot, { childList: true, subtree: true });
}

function argRecordRoute(route) {
  const bit = MYTH_ROUTE_BITS[route];
  if (!bit) return;
  const mask = argRoutesMask();
  if (mask & bit) return;
  argSet(ARG_STORE.routes, String(mask | bit));
}

let mythBatchProbeInFlight = false;

async function maybeUnlockBatchWhisper() {
  if (!currentSettings.enabled || argHasWhisper() || argHasGate()) return;
  if (!argRoutesComplete()) return;
  if (typeof fetchBatchPlayerData !== "function" || mythBatchProbeInFlight) return;

  mythBatchProbeInFlight = true;
  try {
    await fetchBatchPlayerData([SCARY_MYTH_USER_ID]);
    argSet(ARG_STORE.batchDup, "2");
    argSet(ARG_STORE.whisper, "1");
    showArgFragmentToast(ARG_RIDDLES.doorReady, "backdoor");
  } catch {
    /* endpoint down · stays sealed */
  } finally {
    mythBatchProbeInFlight = false;
  }
}

function mythFooterProgressNote() {
  if (argHasGate()) return "";
  if (!argRoutesComplete()) {
    const walked = Object.values(MYTH_ROUTE_BITS).filter((bit) => argRoutesMask() & bit).length;
    return ` · route table ${walked}/5`;
  }
  if (!argHasWhisper()) return " · batch row unverified";
  return " · backdoor listening";
}

const MYTH_ROUTE_LABELS = {
  home: { code: "·01", label: "home" },
  social: { code: "·02", label: "social" },
  catalog: { code: "·04", label: "catalog" },
  game: { code: "·05", label: "game" },
  download: { code: "·07", label: "download" },
};

const MYTH_JOURNAL_LINES = [
  { text: "footer stamps form a route table · walk all five", need: () => !argRoutesComplete() },
  { text: "batch row duplicated for id 22795 · probe /players/batch", need: () => argRoutesComplete() && !argHasWhisper() },
  { text: "shift opens what click cannot on sealed tags", need: () => argHasWhisper() && !argHasGate() },
  { text: "unlisted catalog row · remainder grid · key order", need: () => argHasGate() && !argHasCatalog() },
  { text: "guestbook words follow footer order · not sentence order", need: () => argHasCatalog() && !argHasGuestbook() },
  { text: "pull checksum · parity digit + batch id tail", need: () => argHasGuestbook() && !argHasDownload() },
  { text: "reverse the gate knock inside file 22795", need: () => argHasDownload() && !argHasTrace() },
  { text: "concatenate route stamps · guestbook order · core prompt", need: () => argHasTrace() && !argHasCore() },
  { text: "read every log row · seal contributor file", need: () => argHasCore() && !argHasFinale() },
  { text: "myth dashboard cleared · file canonized", need: () => argHasFinale() },
];

function mythVisibleJournalLines() {
  return MYTH_JOURNAL_LINES.filter((line) => line.need());
}

function injectMythHomeFile() {
  if (!currentSettings.enabled || argHasFinale()) return;
  if (resolvePageRouteKey() !== "home") return;

  const mask = argRoutesMask();
  document.querySelector(".vortex07-myth-home-file")?.remove();
  if (!mask) return;

  const anchor =
    document.querySelector(".vortex07-activity-ticker") ||
    document.querySelector("#Container .games-section") ||
    document.querySelector("#Body > .page");
  if (!anchor) return;

  const panel = document.createElement("aside");
  panel.className = "vortex07-myth-home-file home-section";
  panel.setAttribute("aria-label", "Contributor cache");

  const routeLines = Object.entries(MYTH_ROUTE_LABELS)
    .map(([key, meta]) => {
      const hit = mask & MYTH_ROUTE_BITS[key];
      const dim = hit ? "" : " vortex07-myth-route-line--dim";
      return `<p class="vortex07-myth-route-line${dim}">${meta.code} ${meta.label}${hit ? "" : " · pending"}</p>`;
    })
    .join("");

  const cards = [
    {
      tag: "ROUTE",
      text: argRoutesComplete()
        ? "table complete · batch endpoint may respond"
        : "footer codes are not decoration · walk each route",
    },
    {
      tag: "CACHE",
      text: argHasWhisper()
        ? "row 22795 duplicated · backdoor listening"
        : "profile-views drift logged · id 22795",
    },
    {
      tag: "FILE",
      text: argHasGate()
        ? "segment 1 sealed · hunt continues in catalog"
        : "shift+click SCARY on erik2 after batch whisper",
    },
  ]
    .map(
      (card) =>
        `<article class="vortex07-myth-home-file-card"><span class="vortex07-myth-home-file-tag">${card.tag}</span><p class="vortex07-myth-home-file-text">${card.text}</p></article>`,
    )
    .join("");

  panel.innerHTML =
    '<div class="vortex07-myth-home-file-head">' +
    '<span class="vortex07-myth-home-file-title">Contributor cache</span>' +
    '<span class="vortex07-myth-home-file-sub">session trace · file 22795</span>' +
    "</div>" +
    '<div class="vortex07-myth-route-panel"><span class="vortex07-myth-route-label">route table</span>' +
    routeLines +
    "</div>" +
    `<div class="vortex07-myth-home-file-grid">${cards}</div>` +
    `<p class="vortex07-myth-home-file-foot"><a class="vortex07-myth-home-file-link" href="${SCARY_MYTH_PROFILE_PATH}">view profile →</a></p>`;

  anchor.insertAdjacentElement("afterend", panel);
}

function injectMythProfileJournal() {
  if (!currentSettings.enabled || argHasFinale()) return;
  if (!isScaryVortexUser(getProfileUserIdFromPage())) return;

  const header = document.querySelector(".profile-header");
  if (!header) return;

  const lines = mythVisibleJournalLines();
  let journal = header.querySelector(".vortex07-myth-profile-journal");

  if (!lines.length) {
    journal?.remove();
    return;
  }

  if (!journal) {
    journal = document.createElement("details");
    journal.className = "vortex07-myth-profile-journal";
    journal.open = false;

    const summary = document.createElement("summary");
    summary.textContent = "Contributor notes · file 22795";
    journal.appendChild(summary);

    const list = document.createElement("ul");
    list.className = "vortex07-myth-profile-journal-list";
    journal.appendChild(list);

    const stack = header.querySelector(".vortex07-profile-meta-stack") || header;
    stack.appendChild(journal);
  }

  const list = journal.querySelector(".vortex07-myth-profile-journal-list");
  if (!list) return;

  list.textContent = "";
  lines.forEach((line) => {
    const li = document.createElement("li");
    li.textContent = line.text;
    list.appendChild(li);
  });
}

function decorateScarySearchRow(row, userId) {
  if (!currentSettings.enabled || !isScaryVortexUser(userId) || !row) return;

  row.classList.add("vortex07-user-result-scary");
  const nameEl = row.querySelector(".vortex07-user-name, .vortex07-player-result-link .vortex07-user-info");
  if (nameEl && !nameEl.querySelector(".vortex07-user-scary")) {
    const badge = document.createElement("span");
    badge.className = "vortex07-user-scary";
    badge.textContent = "SCARY";
    badge.title = "Shift+click SCARY badge on profile to open archive";
    nameEl.appendChild(badge);
  }
}

function decorateScarySearchResults(root = document) {
  if (!currentSettings.enabled) return;
  const scope = root instanceof Element ? root : document;
  scope.querySelectorAll(".vortex07-user-result[data-vortex07-user-id]").forEach((row) => {
    const userId = safeNumber(row.dataset.vortex07UserId);
    if (userId !== null) decorateScarySearchRow(row, userId);
  });
}

function decorateMythHoverPreview(preview, userId) {
  if (!currentSettings.enabled || !preview || !isScaryVortexUser(userId)) return;
  if (preview.querySelector(".vortex07-hover-scary")) return;

  const body = preview.querySelector(".vortex07-hover-preview-body") || preview;
  const note = document.createElement("div");
  note.className = "vortex07-hover-scary";
  note.innerHTML =
    '<span class="vortex07-hover-scary-glyph" aria-hidden="true">!</span>' +
    `<span>file ${SCARY_MYTH_USER_ID} · shift opens backdoor</span>`;
  body.appendChild(note);

  if (!argHasGate() && argCanOpenArchive()) {
    const whisper = document.createElement("p");
    whisper.className = "vortex07-myth-hover-whisper";
    whisper.textContent = ARG_RIDDLES.doorReady;
    body.appendChild(whisper);
  }
}

function injectMythHomeAmbience() {
  if (!currentSettings.enabled || argHasGate()) return;
  if (resolvePageRouteKey() !== "home") return;

  if (argHasWhisper() && !argHasGate()) {
    const ticker = document.querySelector(".vortex07-activity-ticker .vortex07-activity-list");
    ticker?.querySelector(".vortex07-myth-activity-glitch")?.remove();
    if (ticker && !ticker.querySelector(".vortex07-myth-activity-glitch")) {
      const li = document.createElement("li");
      li.className = "vortex07-activity-item vortex07-myth-activity-glitch";
      const link = document.createElement("a");
      link.href = SCARY_MYTH_PROFILE_PATH;
      link.className = "vortex07-activity-link";
      link.textContent = "erik2 joined an unpublished game · just now";
      li.appendChild(link);
      ticker.prepend(li);
    }
  }

  const leaderboard = document.querySelector(".vortex07-home-leaderboard");
  if (leaderboard && !leaderboard.querySelector(".vortex07-myth-leaderboard-note") && !argRoutesComplete()) {
    const note = document.createElement("span");
    note.className = "vortex07-myth-leaderboard-note";
    note.textContent = "cache warmed for 22795 before signup · footer route table incomplete";
    leaderboard.querySelector(".vortex07-home-leaderboard-head")?.appendChild(note);
  }
}

function injectMythFooterTrace() {
  const footer = document.querySelector("#Footer .Legalese");
  if (!footer) return;

  footer.querySelector(".vortex07-myth-trace")?.remove();

  const route = resolvePageRouteKey();
  argRecordRoute(route);

  const trace = MYTH_FOOTER_TRACE[route] || MYTH_FOOTER_TRACE.page;
  const pool = MYTH_PAGE_WHISPERS[route] || MYTH_FOOTER_WHISPERS;
  const whisper = pool[mythPickIndex(pool, route)];
  const progress = mythFooterProgressNote();
  const activeRoute = argActiveSiteRoute();
  const slotOpen =
    activeRoute &&
    ((activeRoute === "catalog" && route === "catalog") ||
      (activeRoute === "profile" && route === "profile" && isScaryVortexUser(getProfileUserIdFromPage())) ||
      (activeRoute === "download" && route === "download"));

  const wrap = document.createElement("span");
  wrap.className = "vortex07-myth-trace";
  wrap.innerHTML =
    `<span class="vortex07-myth-trace-whisper">${whisper}${progress}${slotOpen ? ' · <span class="vortex07-myth-trace-slot">fragment slot open</span>' : ""}</span>` +
    `<span class="vortex07-myth-trace-code">${trace}</span>`;

  footer.appendChild(document.createElement("br"));
  footer.appendChild(wrap);
}

function injectScaryProfileBadge(header) {
  const usernameEl = header?.querySelector(".profile-username");
  if (!usernameEl || usernameEl.querySelector(".vortex07-scary-name-badge")) return;

  const badge = document.createElement("span");
  badge.className = "vortex07-scary-name-badge";
  badge.textContent = "SCARY";
  badge.title = "";
  badge.addEventListener("click", (event) => {
    if (!event.shiftKey) return;
    event.preventDefault();
    event.stopPropagation();
    if (!argHasGate() && !argCanOpenArchive()) {
      showArgFragmentToast(
        argRoutesComplete() ? ARG_RIDDLES.whisperNeeded : ARG_RIDDLES.routesNeeded,
        "backdoor sealed",
      );
      void maybeUnlockBatchWhisper();
      return;
    }
    openScarySecretDoorway();
  });
  usernameEl.appendChild(badge);
}

function injectScaryProfileEasterEgg() {
  if (!currentSettings.enabled) return;

  const userId = getProfileUserIdFromPage();
  if (!isScaryVortexUser(userId)) {
    clearScaryProfileEasterEgg();
    return;
  }

  const header = document.querySelector(".profile-header");
  if (!header) return;

  document.querySelectorAll(".vortex07-scary-advisory").forEach((el) => {
    el.remove();
  });

  header.classList.add("vortex07-myth-profile-header");
  injectScaryProfileBadge(header);
  injectMythProfileJournal();
  ensureMythGuestbookGhost();
  syncScaryMythHashRoute();
}

function spreadScaryMythAcrossSite() {
  if (!currentSettings.enabled) return;
  injectMythFooterTrace();
  void maybeUnlockBatchWhisper();
  injectMythHomeFile();
  injectMythHomeAmbience();
  decorateScarySearchResults();
  ensureMythCatalogGhost();
  ensureMythGuestbookGhost();
  ensureMythDownloadChecksum();
  if (isScaryVortexUser(getProfileUserIdFromPage())) {
    injectMythProfileJournal();
  }
  syncScaryMythHashRoute();
}

globalThis.decorateScarySearchRow = decorateScarySearchRow;
globalThis.decorateScarySearchResults = decorateScarySearchResults;
globalThis.decorateMythHoverPreview = decorateMythHoverPreview;

function ensureScaryMythRouting() {
  if (window.__vortex07ScaryMythRouting) return;
  window.__vortex07ScaryMythRouting = true;

  window.addEventListener("hashchange", syncScaryMythHashRoute);
  window.addEventListener("popstate", syncScaryMythHashRoute);
}
