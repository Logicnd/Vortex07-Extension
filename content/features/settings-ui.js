/* Shared Vortex07 settings UI — used on playvortex settings tab. */
(function initVortex07SettingsUi(global) {
  const VORTEX07_NAV_VISIBLE_DEFAULTS =
    global.Vortex07SettingsSchema?.NAV_VISIBLE_DEFAULTS ?? {
      home: true,
      games: true,
      catalog: true,
      social: true,
      download: true,
      discord: true,
      profile: true,
      forum: true,
      vortex07: true,
      admin: true,
    };

  const VORTEX07_NAV_ITEMS = [
    { key: "home", label: "Home" },
    { key: "games", label: "Games" },
    { key: "catalog", label: "Catalog" },
    { key: "social", label: "Social" },
    { key: "download", label: "Download" },
    { key: "discord", label: "Discord" },
    { key: "profile", label: "My Vortex / profile" },
    { key: "forum", label: "Forum" },
    { key: "vortex07", label: "Settings" },
    { key: "admin", label: "Admin (devs only)" },
  ];

  const VORTEX07_DEFAULT_SETTINGS =
    global.Vortex07SettingsSchema?.DEFAULT_SETTINGS ?? {
      enabled: true,
      customNav: true,
      classicFooter: true,
      retroButtons: true,
      userSearch: true,
      friendRowCarousels: true,
      darkMode: false,
      iconCache: true,
      reputationApiUrl: "",
      discordBotUrl: "",
      showExtensionStatus: true,
      showGuestbook: true,
      showForum: true,
      showActivityTicker: true,
      showVertexPoints: true,
      debugLogs: false,
      navVisible: { ...VORTEX07_NAV_VISIBLE_DEFAULTS },
    };

  const VORTEX07_CHECKBOX_IDS = [
    "enabled",
    "customNav",
    "classicFooter",
    "retroButtons",
    "userSearch",
    "friendRowCarousels",
    "darkMode",
    "iconCache",
    "showExtensionStatus",
    "showGuestbook",
    "showActivityTicker",
    "showVertexPoints",
    "debugLogs",
  ];

  const VORTEX07_TEXT_IDS = ["reputationApiUrl", "discordBotUrl"];
  const VORTEX07_DEPENDENT_CHECKBOX_IDS = VORTEX07_CHECKBOX_IDS.filter(
    (id) => id !== "enabled",
  );

  function normalizeNavVisible(settings) {
    if (global.Vortex07SettingsSchema?.normalizeNavVisible) {
      return global.Vortex07SettingsSchema.normalizeNavVisible(settings);
    }
    const raw =
      settings?.navVisible && typeof settings.navVisible === "object"
        ? settings.navVisible
        : {};
    return { ...VORTEX07_NAV_VISIBLE_DEFAULTS, ...raw };
  }

  function normalizeSettings(settings) {
    if (global.Vortex07SettingsSchema?.normalizeSettings) {
      return global.Vortex07SettingsSchema.normalizeSettings(settings);
    }
    const merged = { ...VORTEX07_DEFAULT_SETTINGS, ...(settings || {}) };
    delete merged.reputation;
    delete merged.themePreset;
    delete merged.johnVortexTheme;
    merged.navVisible = normalizeNavVisible(merged);
    merged.showForum = merged.navVisible.forum;
    return merged;
  }

  function buildNavTabGridHtml() {
    return VORTEX07_NAV_ITEMS.map(
      ({ key, label }) => `
        <label class="vortex07-settings-nav-item">
          <input type="checkbox" data-nav-item="${key}" />
          <span>${label}</span>
        </label>
      `,
    ).join("");
  }

  function buildSettingsPageHtml(version) {
    const ver = String(version || "2.6.0");
    return `
      <div class="vortex07-settings-shell">
        <div class="vortex07-settings-titlebar">
          <span class="vortex07-settings-glyph" aria-hidden="true">V07</span>
          <h1 class="vortex07-settings-heading">Vortex07 Settings</h1>
          <span class="vortex07-settings-ver">v${ver}</span>
        </div>

        <div class="vortex07-settings-client">
          <fieldset class="vortex07-settings-group" data-group="general">
            <legend>General</legend>
            <label class="vortex07-settings-row vortex07-settings-row-master">
              <input type="checkbox" id="vortex07-enabled" data-setting="enabled" />
              <span>Enable Vortex07</span>
            </label>
            <p class="vortex07-settings-hint vortex07-settings-off-hint" id="vortex07-enabledHint" hidden>
              Vortex07 is off — check the box above, then refresh playvortex.
            </p>
            <label class="vortex07-settings-row">
              <input type="checkbox" id="vortex07-customNav" data-setting="customNav" />
              <span>Classic navigation tabs</span>
            </label>
            <label class="vortex07-settings-row">
              <input type="checkbox" id="vortex07-classicFooter" data-setting="classicFooter" />
              <span>Classic footer legalese</span>
            </label>
            <label class="vortex07-settings-row">
              <input type="checkbox" id="vortex07-retroButtons" data-setting="retroButtons" />
              <span>Windows XP style buttons</span>
            </label>
            <label class="vortex07-settings-row">
              <input type="checkbox" id="vortex07-darkMode" data-setting="darkMode" />
              <span>Dark mode (retro night theme)</span>
            </label>
          </fieldset>

          <fieldset class="vortex07-settings-group" data-group="navigation">
            <legend>Top bar tabs</legend>
            <p class="vortex07-settings-hint vortex07-settings-group-intro">
              Hide tabs you don't use — the bar auto-shrinks when it gets crowded. Changes apply instantly.
            </p>
            <div class="vortex07-settings-nav-grid">${buildNavTabGridHtml()}</div>
            <div class="vortex07-settings-nav-presets">
              <button type="button" class="vortex07-settings-nav-preset" data-nav-preset="minimal">
                Minimal
              </button>
              <button type="button" class="vortex07-settings-nav-preset" data-nav-preset="default">
                Show all
              </button>
            </div>
            <p class="vortex07-settings-hint" id="vortex07-navTabHint"></p>
          </fieldset>

          <fieldset class="vortex07-settings-group" data-group="layout">
            <legend>Layout</legend>
            <label class="vortex07-settings-row">
              <input type="checkbox" id="vortex07-friendRowCarousels" data-setting="friendRowCarousels" />
              <span>Friend row scroll arrows (home &amp; profiles)</span>
            </label>
            <p class="vortex07-settings-hint">Hidden on the dedicated Friends page.</p>
            <label class="vortex07-settings-row">
              <input type="checkbox" id="vortex07-iconCache" data-setting="iconCache" />
              <span>Cache extension badge &amp; logo URLs</span>
            </label>
          </fieldset>

          <fieldset class="vortex07-settings-group" data-group="search">
            <legend>Search</legend>
            <label class="vortex07-settings-row">
              <input type="checkbox" id="vortex07-userSearch" data-setting="userSearch" />
              <span>Smart player search</span>
            </label>
          </fieldset>

          <fieldset class="vortex07-settings-group" data-group="social">
            <legend>Social features</legend>
            <p class="vortex07-settings-hint vortex07-settings-group-intro">
              Extension-only extras on profiles and home — toggle what you want visible.
            </p>
            <label class="vortex07-settings-row">
              <input type="checkbox" id="vortex07-showExtensionStatus" data-setting="showExtensionStatus" />
              <span>Extension status lines</span>
            </label>
            <p class="vortex07-settings-hint">Shown on profiles, social cards, and search results.</p>
            <label class="vortex07-settings-row">
              <input type="checkbox" id="vortex07-showGuestbook" data-setting="showGuestbook" />
              <span>Profile guestbook</span>
            </label>
            <p class="vortex07-settings-hint">Sign once per day on other players' profiles.</p>
            <label class="vortex07-settings-row">
              <input type="checkbox" id="vortex07-showActivityTicker" data-setting="showActivityTicker" />
              <span>Home activity ticker</span>
            </label>
            <p class="vortex07-settings-hint">Live rep feed on the home page.</p>
            <label class="vortex07-settings-row">
              <input type="checkbox" id="vortex07-showVertexPoints" data-setting="showVertexPoints" />
              <span>Vertex Points wallet (header coin)</span>
            </label>
            <p class="vortex07-settings-hint">Vortex07 currency — click the coin daily for bonus VP.</p>
          </fieldset>

          <fieldset class="vortex07-settings-group" data-group="dev">
            <legend>Developer</legend>
            <label class="vortex07-settings-row">
              <input type="checkbox" id="vortex07-debugLogs" data-setting="debugLogs" />
              <span>Debug / API console logs</span>
            </label>
            <div class="vortex07-settings-field">
              <label for="vortex07-reputationApiUrl">Rep API override (optional)</label>
              <input
                type="text"
                id="vortex07-reputationApiUrl"
                data-setting="reputationApiUrl"
                placeholder="Default: vortex07-extension.vercel.app/api"
                spellcheck="false"
              />
              <p class="vortex07-settings-hint" id="vortex07-repApiHint">
                Global reputation is always on. Override only for a custom sync server.
              </p>
            </div>
          </fieldset>

          <fieldset class="vortex07-settings-group" data-group="discord-link">
            <legend>Link Discord</legend>
            <p class="vortex07-settings-hint vortex07-settings-group-intro">
              Safe linking — never type your playvortex password in Discord. Run <strong>/link</strong> once in the Vortality server, paste the code here, and the extension keeps your session synced automatically.
            </p>
            <p class="vortex07-settings-hint vortex07-settings-discord-autosync" id="vortex07-discordAutoSyncStatus">
              Checking auto-sync…
            </p>
            <div class="vortex07-settings-link-row">
              <button type="button" class="vortex07-settings-link-btn" id="vortex07-discordSyncBtn">
                Sync now
              </button>
            </div>
            <div class="vortex07-settings-field">
              <label for="vortex07-discordBotUrl">Vortality bot API</label>
              <input
                type="text"
                id="vortex07-discordBotUrl"
                data-setting="discordBotUrl"
                placeholder="Auto-detected — leave empty"
                spellcheck="false"
              />
              <p class="vortex07-settings-hint">Leave empty — auto-finds Vortality on port <strong>3210</strong>. Port 3000 is used by another app on your PC.</p>
            </div>
            <div class="vortex07-settings-field">
              <label for="vortex07-discordLinkCode">Link code from /link</label>
              <div class="vortex07-settings-link-row">
                <input
                  type="text"
                  id="vortex07-discordLinkCode"
                  placeholder="ABCD-EFGH"
                  spellcheck="false"
                  maxlength="9"
                  autocomplete="off"
                />
                <button type="button" class="vortex07-settings-link-btn" id="vortex07-discordLinkBtn">
                  Confirm link
                </button>
              </div>
              <p class="vortex07-settings-hint" id="vortex07-discordLinkStatus">
                Codes expire in 15 minutes.
              </p>
            </div>
          </fieldset>

          <div class="vortex07-settings-community">
            <span class="vortex07-settings-community-label">Community</span>
            <a
              class="vortex07-settings-wiki"
              href="https://playvortex.wiki/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Official Wiki — guides · lore · game info
            </a>
            <a
              class="vortex07-settings-discord"
              href="https://discord.gg/bVq4fTeDVS"
              target="_blank"
              rel="noopener noreferrer"
            >
              Vortality Discord — updates · support · suggestions
            </a>
          </div>
        </div>

        <div class="vortex07-settings-statusbar">
          <span id="vortex07-saveStatus">Ready</span>
          <span>Changes save automatically</span>
        </div>
      </div>
    `;
  }

  function readSettingsFromRoot(root) {
    const settings = {};

    VORTEX07_CHECKBOX_IDS.forEach((id) => {
      const input = root.querySelector(`[data-setting="${id}"]`);
      if (input) settings[id] = Boolean(input.checked);
    });

    VORTEX07_TEXT_IDS.forEach((id) => {
      const input = root.querySelector(`[data-setting="${id}"]`);
      if (input) settings[id] = String(input.value || "").trim();
    });

    const navVisible = { ...VORTEX07_NAV_VISIBLE_DEFAULTS };
    VORTEX07_NAV_ITEMS.forEach(({ key }) => {
      const input = root.querySelector(`[data-nav-item="${key}"]`);
      if (input) navVisible[key] = Boolean(input.checked);
    });
    settings.navVisible = navVisible;
    settings.showForum = navVisible.forum;

    return normalizeSettings(settings);
  }

  function applySettingsToRoot(root, settings) {
    const normalized = normalizeSettings(settings);

    VORTEX07_CHECKBOX_IDS.forEach((id) => {
      const input = root.querySelector(`[data-setting="${id}"]`);
      if (input) input.checked = Boolean(normalized[id]);
    });

    VORTEX07_TEXT_IDS.forEach((id) => {
      const input = root.querySelector(`[data-setting="${id}"]`);
      if (input) input.value = normalized[id] || "";
    });

    VORTEX07_NAV_ITEMS.forEach(({ key }) => {
      const input = root.querySelector(`[data-nav-item="${key}"]`);
      if (input) input.checked = normalized.navVisible[key] !== false;
    });

    applyMasterToggleState(root, normalized);
    updateRepApiHint(root, normalized);
    updateNavTabHint(root, normalized);
    return normalized;
  }

  function updateNavTabHint(root, settings) {
    const hint = root.querySelector("#vortex07-navTabHint");
    if (!hint) return;
    const visible = VORTEX07_NAV_ITEMS.filter(
      ({ key }) => settings.navVisible?.[key] !== false,
    ).length;
    hint.textContent = `${visible} tab${visible === 1 ? "" : "s"} visible in the top bar.`;
  }

  function applyNavPreset(root, preset) {
    const minimal = {
      home: true,
      games: true,
      social: true,
      profile: true,
      vortex07: true,
      catalog: false,
      download: false,
      discord: false,
      forum: false,
      admin: false,
    };

    VORTEX07_NAV_ITEMS.forEach(({ key }) => {
      const input = root.querySelector(`[data-nav-item="${key}"]`);
      if (!input) return;
      if (preset === "minimal") {
        input.checked = minimal[key] !== false;
        return;
      }
      input.checked = true;
    });
  }

  function applyMasterToggleState(root, settings) {
    const enabled = Boolean(settings.enabled);
    const shell = root.querySelector(".vortex07-settings-shell");
    const enabledHint = root.querySelector("#vortex07-enabledHint");

    VORTEX07_DEPENDENT_CHECKBOX_IDS.forEach((id) => {
      const input = root.querySelector(`[data-setting="${id}"]`);
      if (input) input.disabled = !enabled;
    });

    VORTEX07_TEXT_IDS.forEach((id) => {
      const input = root.querySelector(`[data-setting="${id}"]`);
      if (input) input.disabled = !enabled;
    });

    root.querySelectorAll("[data-nav-item]").forEach((input) => {
      input.disabled = !enabled;
    });

    root.querySelectorAll("[data-nav-preset]").forEach((btn) => {
      btn.disabled = !enabled;
    });

    shell?.classList.toggle("vortex07-settings-off", !enabled);
    if (enabledHint) enabledHint.hidden = enabled;
  }

  function updateRepApiHint(root, settings) {
    const hint = root.querySelector("#vortex07-repApiHint");
    if (!hint) return;

    const url = String(settings.reputationApiUrl || "").trim();
    if (!url) {
      hint.textContent =
        "Global rep sync: vortex07-extension.vercel.app — shared by all Vortex07 users.";
      return;
    }

    hint.textContent = `Custom sync via ${url.replace(/^https?:\/\//, "")}`;
  }

  function setSaveStatus(root, text, type) {
    const el = root.querySelector("#vortex07-saveStatus");
    if (!el) return;

    el.textContent = text;
    el.classList.remove("save-ok", "save-err");
    if (type) el.classList.add(type);
  }

  function saveSettingsFromRoot(root) {
    const settings = readSettingsFromRoot(root);
    applyMasterToggleState(root, settings);
    updateRepApiHint(root, settings);
    updateNavTabHint(root, settings);

    const save = global.Vortex07Ext?.storageSet;
    if (typeof save !== "function") {
      setSaveStatus(root, "Save failed", "save-err");
      return;
    }

    save("sync", { vortex07Settings: settings })
      .then(() => {
        setSaveStatus(
          root,
          settings.enabled ? "Settings saved" : "Disabled — refresh tab",
          "save-ok",
        );
      })
      .catch(() => {
        setSaveStatus(root, "Save failed", "save-err");
      });
  }

  function loadSettings(callback) {
    const load = global.Vortex07Ext?.storageGet;
    if (typeof load !== "function") {
      callback(normalizeSettings(VORTEX07_DEFAULT_SETTINGS));
      return;
    }

    load("sync", { vortex07Settings: VORTEX07_DEFAULT_SETTINGS })
      .then((data) => {
        callback(normalizeSettings(data.vortex07Settings));
      })
      .catch(() => {
        callback(normalizeSettings(VORTEX07_DEFAULT_SETTINGS));
      });
  }

  function normalizeLinkCode(raw) {
    const compact = String(raw || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 8);
    if (compact.length <= 4) return compact;
    return `${compact.slice(0, 4)}-${compact.slice(4)}`;
  }

  function resetDiscordLinkForm(root) {
    const linkInput = root.querySelector("#vortex07-discordLinkCode");
    const linkBtn = root.querySelector("#vortex07-discordLinkBtn");
    const linkStatus = root.querySelector("#vortex07-discordLinkStatus");

    if (linkInput) {
      linkInput.value = "";
      linkInput.disabled = false;
      linkInput.readOnly = false;
    }
    if (linkBtn) linkBtn.disabled = false;
    if (linkStatus) linkStatus.textContent = "One-time setup — after linking, auto-sync handles the rest.";
    refreshDiscordLinkStatus(root);
  }

  function formatDiscordAutoSyncStatus(status, syncResult) {
    if (syncResult?.ok && syncResult?.healed) {
      return `Auto-sync restored ${syncResult.username || "your link"} just now. Try /profile in Discord.`;
    }

    if (syncResult?.ok && !syncResult?.skipped) {
      return `Auto-sync pushed your session to the bot${syncResult.username ? ` (${syncResult.username})` : ""}.`;
    }

    if (syncResult?.error) {
      const where = syncResult.botUrl ? ` (${syncResult.botUrl})` : "";
      return `Auto-sync failed${where}: ${syncResult.error}`;
    }

    if (!status?.signedIn) {
      return "Sign in on playvortex.io first, then press Sync now.";
    }

    if (status?.lastSyncOk && status?.lastSyncAt) {
      const when = new Date(status.lastSyncAt);
      const mins = Math.max(0, Math.round((Date.now() - when.getTime()) / 60000));
      const ago = mins < 2 ? "just now" : `${mins}m ago`;
      const username = status.username ? ` as ${status.username}` : "";
      return `Auto-sync active${username} · last pushed ${ago}. Bot restarts are handled automatically.`;
    }

    if (status?.lastSyncError) {
      return `Auto-sync failed: ${status.lastSyncError}`;
    }

    if (status?.linked) {
      return `Linked${status.username ? ` as ${status.username}` : ""} · waiting to push your session to the bot. Press Sync now.`;
    }

    return "If Discord already knows your account, just press Sync now while signed in here. Otherwise run /link once.";
  }

  function refreshDiscordLinkStatus(root, syncResult) {
    const autoStatus = root?.querySelector("#vortex07-discordAutoSyncStatus");
    if (!autoStatus) return;

    const runtime = global.Vortex07Ext?.sendRuntimeMessage;
    if (typeof runtime !== "function") {
      autoStatus.textContent = "Auto-sync status unavailable in this context.";
      return;
    }

    runtime({ type: "vortex07-discord-status" })
      .then((status) => {
        autoStatus.textContent = formatDiscordAutoSyncStatus(status, syncResult);
      })
      .catch(() => {
        autoStatus.textContent = "Auto-sync status unavailable.";
      });
  }

  function syncDiscordLinkNow(root, fromButton = false) {
    const autoStatus = root?.querySelector("#vortex07-discordAutoSyncStatus");
    const syncBtn = root?.querySelector("#vortex07-discordSyncBtn");
    const runtime = global.Vortex07Ext?.sendRuntimeMessage;

    if (typeof runtime !== "function") {
      if (autoStatus) autoStatus.textContent = "Extension runtime unavailable.";
      return;
    }

    if (autoStatus) autoStatus.textContent = "Syncing session to bot…";
    if (syncBtn) syncBtn.disabled = true;

    runtime({ type: "vortex07-discord-sync", force: true })
      .then((result) => {
        refreshDiscordLinkStatus(root, result);
      })
      .catch(() => {
        if (autoStatus) {
          autoStatus.textContent = "Sync failed. Is the Vortality bot running?";
        }
      })
      .finally(() => {
        if (syncBtn) syncBtn.disabled = false;
        if (fromButton && autoStatus && autoStatus.textContent === "Syncing session to bot…") {
          autoStatus.textContent = "Sync finished — check the message above.";
        }
      });
  }

  function isSettingsPageDomReady(root) {
    return Boolean(root?.querySelector("#vortex07-discordLinkCode"));
  }

  function submitDiscordLink(root) {
    const linkInput = root.querySelector("#vortex07-discordLinkCode");
    const linkBtn = root.querySelector("#vortex07-discordLinkBtn");
    const linkStatus = root.querySelector("#vortex07-discordLinkStatus");
    const code = normalizeLinkCode(linkInput?.value || "");
    const settings = readSettingsFromRoot(root);
    const botUrl = String(settings.discordBotUrl || "").trim();

    if (linkInput && linkInput.value !== code) {
      linkInput.value = code;
    }

    if (!code) {
      if (linkStatus) linkStatus.textContent = "Enter the code from /link first.";
      linkInput?.focus();
      return;
    }

    if (linkStatus) linkStatus.textContent = "Linking…";
    if (linkBtn) linkBtn.disabled = true;
    if (linkInput) linkInput.disabled = true;

    const runtime = global.Vortex07Ext?.sendRuntimeMessage;
    if (typeof runtime !== "function") {
      if (linkStatus) linkStatus.textContent = "Extension runtime unavailable.";
      if (linkBtn) linkBtn.disabled = false;
      if (linkInput) linkInput.disabled = false;
      return;
    }

    runtime({
      type: "vortex07-discord-link",
      code,
      botUrl,
    })
      .then((result) => {
        if (result?.ok) {
          if (linkStatus) {
            linkStatus.textContent = result.autoSync
              ? `Linked ${result.username || "account"}. Auto-sync is on — you shouldn't need to /link again.`
              : `Linked ${result.username || "account"} to Discord. Run /profile in the server.`;
          }
          if (linkInput) linkInput.value = "";
          refreshDiscordLinkStatus(root);
          return;
        }
        if (linkStatus) {
          linkStatus.textContent = result?.error || "Link failed. Check the code and try /link again.";
        }
        linkInput?.focus();
      })
      .catch(() => {
        if (linkStatus) linkStatus.textContent = "Link failed. Is the Vortality bot running?";
        linkInput?.focus();
      })
      .finally(() => {
        if (linkBtn) linkBtn.disabled = false;
        if (linkInput) linkInput.disabled = false;
      });
  }

  function wireDiscordLinkDelegation(root) {
    if (!root || root.dataset.vortex07DiscordWired === "true") return;
    root.dataset.vortex07DiscordWired = "true";

    root.addEventListener("click", (event) => {
      if (event.target?.id === "vortex07-discordLinkBtn") {
        event.preventDefault();
        submitDiscordLink(root);
        return;
      }
      if (event.target?.id === "vortex07-discordSyncBtn") {
        event.preventDefault();
        syncDiscordLinkNow(root, true);
      }
    });

    root.addEventListener("keydown", (event) => {
      if (event.target?.id !== "vortex07-discordLinkCode") return;
      if (event.key !== "Enter") return;
      event.preventDefault();
      submitDiscordLink(root);
    });

    root.addEventListener("input", (event) => {
      if (event.target?.id !== "vortex07-discordLinkCode") return;
      const input = event.target;
      const formatted = normalizeLinkCode(input.value);
      if (input.value !== formatted) input.value = formatted;
    });

    root.addEventListener("focusin", (event) => {
      if (event.target?.id !== "vortex07-discordLinkCode") return;
      const linkBtn = root.querySelector("#vortex07-discordLinkBtn");
      const linkStatus = root.querySelector("#vortex07-discordLinkStatus");
      if (linkBtn?.disabled) return;
      if (linkStatus && !linkStatus.textContent.includes("Linking")) {
        linkStatus.textContent = "Paste your /link code, then press Confirm link or Enter.";
      }
    });
  }

  function ensureSettingsPageReady(root, version) {
    if (!root) return;

    wireDiscordLinkDelegation(root);

    if (!isSettingsPageDomReady(root)) {
      delete root.dataset.vortex07SettingsWired;
      mountSettingsPage(root, version);
      return;
    }

    const linkBtn = root.querySelector("#vortex07-discordLinkBtn");
    const linkInput = root.querySelector("#vortex07-discordLinkCode");
    const linkStatus = root.querySelector("#vortex07-discordLinkStatus");
    const stuckLinking = linkStatus?.textContent === "Linking…";

    if (stuckLinking || linkBtn?.disabled || linkInput?.disabled) {
      resetDiscordLinkForm(root);
    }

    syncDiscordLinkNow(root);
  }

  function wireSettingsPage(root) {
    if (!root || root.dataset.vortex07SettingsWired === "true") return;
    root.dataset.vortex07SettingsWired = "true";

    let saveTimer = null;
    const queueSave = () => {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => saveSettingsFromRoot(root), 120);
    };

    root.querySelectorAll('[data-setting]').forEach((input) => {
      input.addEventListener("change", queueSave);
      if (input.type === "text") input.addEventListener("input", queueSave);
    });

    root.querySelectorAll("[data-nav-item]").forEach((input) => {
      input.addEventListener("change", queueSave);
    });

    root.querySelectorAll("[data-nav-preset]").forEach((btn) => {
      btn.addEventListener("click", () => {
        applyNavPreset(root, btn.dataset.navPreset);
        queueSave();
      });
    });

    root.querySelector('[data-setting="enabled"]')?.addEventListener("change", () => {
      const live = readSettingsFromRoot(root);
      applyMasterToggleState(root, live);
    });

    wireDiscordLinkDelegation(root);

    global.Vortex07Ext?.onStorageChanged?.((changes, namespace) => {
      if (namespace === "sync" && changes.vortex07Settings) {
        applySettingsToRoot(root, normalizeSettings(changes.vortex07Settings.newValue));
      }
    });
  }

  function mountSettingsPage(root, version) {
    delete root.dataset.vortex07SettingsWired;
    root.innerHTML = buildSettingsPageHtml(version);
    wireSettingsPage(root);
    wireDiscordLinkDelegation(root);
    loadSettings((settings) => {
      applySettingsToRoot(root, settings);
      syncDiscordLinkNow(root);
    });
  }

  global.Vortex07SettingsUi = {
    DEFAULT_SETTINGS: VORTEX07_DEFAULT_SETTINGS,
    normalizeSettings,
    buildSettingsPageHtml,
    mountSettingsPage,
    ensureSettingsPageReady,
    resetDiscordLinkForm,
    applySettingsToRoot,
    loadSettings,
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
