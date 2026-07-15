(function () {
  "use strict";

  const ORIGIN = "https://playvortex.io";

  const HIDDEN_FLAGS = [
    { key: "debugMode", label: "Debug mode", desc: "Log extra diagnostics in the console" },
    { key: "adminMode", label: "Admin mode", desc: "Enable owner-only forum controls" },
    { key: "noCap", label: "No game cap", desc: "Ignore the 8-game home grid cap" },
    { key: "rawApi", label: "Raw API", desc: "Show raw network responses in dumps" },
    { key: "silentMode", label: "Silent mode", desc: "Suppress non-error extension logs" }
  ];

  let activeTab = null;

  function $(sel) {
    return document.querySelector(sel);
  }

  function $$(sel) {
    return document.querySelectorAll(sel);
  }

  function setText(id, text) {
    const el = typeof id === "string" ? $(id) : id;
    if (el) el.textContent = String(text);
  }

  function stamp() {
    return new Date().toLocaleTimeString();
  }

  function out(id, value, ok) {
    const el = $(id);
    if (!el) return;
    el.classList.remove("ok", "err");
    el.classList.add(ok ? "ok" : "err");
    if (value === undefined) {
      el.textContent = "";
      return;
    }
    if (typeof value === "string") {
      el.textContent = value;
    } else {
      try {
        el.textContent = JSON.stringify(value, null, 2);
      } catch (e) {
        el.textContent = String(value);
      }
    }
  }

  async function findActiveVortexTab() {
    try {
      const tabs = await chrome.tabs.query({
        url: ORIGIN + "/*",
        active: true,
        currentWindow: true
      });
      activeTab = tabs && tabs[0] ? tabs[0] : null;
    } catch (e) {
      activeTab = null;
    }
    updateStatus();
    return activeTab;
  }

  function updateStatus() {
    const manifest = chrome.runtime.getManifest();
    setText("#ext-ver", manifest.version || "?");
    setText("#active-tab", activeTab ? activeTab.title || activeTab.url : "none");
    setText("#tab-id", activeTab ? activeTab.id : "-");
    setText("#session", stamp());

    const badge = $("#conn-status");
    if (activeTab) {
      badge.textContent = "online";
      badge.classList.add("online");
    } else {
      badge.textContent = "offline";
      badge.classList.remove("online");
    }
  }

  async function sendToTab(msg) {
    if (!activeTab) {
      await findActiveVortexTab();
    }
    if (!activeTab) {
      throw new Error("No active playvortex.io tab found");
    }
    return chrome.tabs.sendMessage(activeTab.id, msg);
  }

  async function relayFetch(method, url, headers, body) {
    const fullUrl = url.startsWith("http") ? url : ORIGIN + url;
    return sendToTab({
      type: "V07_API",
      method,
      url: fullUrl,
      headers,
      body
    });
  }

  /* ---------------- tabs ---------------- */

  function initTabs() {
    $("#tabs").addEventListener("click", (e) => {
      const tab = e.target.closest(".tab");
      if (!tab) return;
      const name = tab.dataset.tab;
      $$(".tab").forEach((t) => t.classList.toggle("active", t === tab));
      $$(".panel").forEach((p) => p.classList.toggle("active", p.id === "tab-" + name));
    });
  }

  /* ---------------- status ---------------- */

  async function doPing() {
    out("#ping-out", "pinging...", true);
    try {
      const res = await sendToTab({ type: "V07_PING" });
      out("#ping-out", { ok: true, time: stamp(), response: res }, true);
    } catch (e) {
      out("#ping-out", { ok: false, error: e.message }, false);
    }
  }

  /* ---------------- storage ---------------- */

  async function loadStorage() {
    try {
      const data = await chrome.storage.local.get(null);
      $("#storage-json").value = JSON.stringify(data, null, 2);
      out("#storage-msg", "loaded " + Object.keys(data).length + " keys", true);
    } catch (e) {
      out("#storage-msg", { error: e.message }, false);
    }
  }

  async function saveStorage() {
    try {
      const text = $("#storage-json").value;
      const parsed = JSON.parse(text);
      if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Storage root must be a plain object");
      }
      await chrome.storage.local.clear();
      await chrome.storage.local.set(parsed);
      out("#storage-msg", "saved " + Object.keys(parsed).length + " keys", true);
    } catch (e) {
      out("#storage-msg", { error: e.message }, false);
    }
  }

  /* ---------------- api ---------------- */

  async function sendApi() {
    const method = $("#api-method").value;
    const url = $("#api-url").value.trim();
    const headersText = $("#api-headers").value.trim();
    const bodyText = $("#api-body").value.trim();

    let headers = {};
    let body = undefined;

    try {
      headers = headersText ? JSON.parse(headersText) : {};
    } catch (e) {
      out("#api-out", { error: "Invalid headers JSON: " + e.message }, false);
      return;
    }

    if (bodyText) {
      try {
        JSON.parse(bodyText);
        body = bodyText;
        headers["Content-Type"] = headers["Content-Type"] || "application/json";
      } catch (e) {
        body = bodyText;
      }
    }

    out("#api-out", "sending " + method + " " + url + "...", true);
    try {
      const res = await relayFetch(method, url, headers, body || undefined);
      out("#api-out", res, res.ok);
    } catch (e) {
      out("#api-out", { ok: false, error: e.message }, false);
    }
  }

  /* ---------------- inject ---------------- */

  async function injectCss() {
    const css = $("#inject-css").value;
    if (!css.trim()) return;
    try {
      const res = await sendToTab({ type: "V07_INJECT_CSS", css });
      out("#inject-out", { ok: true, injected: res }, true);
    } catch (e) {
      out("#inject-out", { ok: false, error: e.message }, false);
    }
  }

  async function injectJs() {
    const js = $("#inject-js").value;
    if (!js.trim()) return;
    try {
      const res = await sendToTab({ type: "V07_INJECT_JS", js });
      out("#inject-out", { ok: true, injected: res }, true);
    } catch (e) {
      out("#inject-out", { ok: false, error: e.message }, false);
    }
  }

  /* ---------------- flags ---------------- */

  function renderFlags(state) {
    const list = $("#flag-list");
    list.innerHTML = "";
    for (const f of HIDDEN_FLAGS) {
      const div = document.createElement("div");
      div.className = "flag";
      const meta = document.createElement("div");
      meta.innerHTML = "<b>" + f.label + "</b><small>" + f.desc + "</small>";
      const box = document.createElement("input");
      box.type = "checkbox";
      box.dataset.key = f.key;
      box.checked = !!state[f.key];
      div.appendChild(meta);
      div.appendChild(box);
      list.appendChild(div);
    }
  }

  async function loadFlags() {
    try {
      const data = await chrome.storage.local.get({ v07HiddenFlags: {} });
      renderFlags(data.v07HiddenFlags || {});
      out("#flags-msg", "flags loaded", true);
    } catch (e) {
      out("#flags-msg", { error: e.message }, false);
    }
  }

  async function saveFlags() {
    try {
      const next = {};
      $$("#flag-list input[type=checkbox]").forEach((box) => {
        next[box.dataset.key] = box.checked;
      });
      await chrome.storage.local.set({ v07HiddenFlags: next });
      out("#flags-msg", next, true);
    } catch (e) {
      out("#flags-msg", { error: e.message }, false);
    }
  }

  /* ---------------- dump ---------------- */

  async function dumpEndpoint(url) {
    try {
      const res = await relayFetch("GET", url, {}, undefined);
      return { url, ok: res.ok, status: res.status, data: res.data };
    } catch (e) {
      return { url, ok: false, error: e.message };
    }
  }

  async function runDump(btn) {
    const paths = btn.dataset.dump.split(",").map((s) => s.trim());
    out("#dump-out", "fetching " + paths.length + " endpoint(s)...", true);
    const results = await Promise.all(paths.map((p) => dumpEndpoint(p)));
    out("#dump-out", results, results.every((r) => r.ok));
  }

  /* ---------------- init ---------------- */

  function bindEvents() {
    $("#ping-btn").addEventListener("click", doPing);
    $("#refresh-status").addEventListener("click", findActiveVortexTab);

    $("#storage-load").addEventListener("click", loadStorage);
    $("#storage-save").addEventListener("click", saveStorage);

    $("#api-send").addEventListener("click", sendApi);

    $("#inject-css-btn").addEventListener("click", injectCss);
    $("#inject-js-btn").addEventListener("click", injectJs);

    $("#flags-save").addEventListener("click", saveFlags);

    $$("#tab-dump .btn[data-dump]").forEach((btn) => {
      btn.addEventListener("click", () => runDump(btn));
    });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    initTabs();
    await findActiveVortexTab();
    bindEvents();
    loadStorage();
    loadFlags();
  });
})();
