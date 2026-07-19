const SETTINGS_URL = "https://playvortex.io/home#vortex07-settings";

const POPUP_DEFAULT_SETTINGS =
  globalThis.Vortex07SettingsSchema?.DEFAULT_SETTINGS ?? {
    enabled: true,
    customNav: true,
    classicFooter: true,
    retroButtons: true,
    userSearch: true,
    friendRowCarousels: true,
    darkMode: false,
    iconCache: true,
    reputationApiUrl: "",
    showExtensionStatus: true,
    showGuestbook: true,
    showForum: true,
    showActivityTicker: true,
    debugLogs: false,
    navVisible: {},
  };

const POPUP_TOGGLE_IDS = [
  "enabled",
  "darkMode",
  "userSearch",
  "friendRowCarousels",
  "iconCache",
];

function normalizeSettings(settings) {
  if (globalThis.Vortex07SettingsSchema?.normalizeSettings) {
    return globalThis.Vortex07SettingsSchema.normalizeSettings(settings);
  }
  return { ...POPUP_DEFAULT_SETTINGS, ...(settings || {}) };
}

async function loadSettings() {
  const data = await Vortex07Ext.storageGet("sync", {
    vortex07Settings: POPUP_DEFAULT_SETTINGS,
  });
  return normalizeSettings(data.vortex07Settings);
}

async function saveSettings(settings) {
  await Vortex07Ext.storageSet("sync", { vortex07Settings: settings });
}

function applySettingsToPopup(settings) {
  const shell = document.getElementById("popupShell");
  shell?.classList.toggle("popup-off", !settings.enabled);
  document.documentElement.classList.toggle("popup-dark", Boolean(settings.darkMode));

  POPUP_TOGGLE_IDS.forEach((id) => {
    const input = document.querySelector(`[data-setting="${id}"]`);
    if (input) input.checked = Boolean(settings[id]);
  });

  POPUP_TOGGLE_IDS.filter((id) => id !== "enabled").forEach((id) => {
    const input = document.querySelector(`[data-setting="${id}"]`);
    if (input) input.disabled = !settings.enabled;
  });
}

function setSaveStatus(text, ok = true) {
  const el = document.getElementById("saveStatus");
  if (!el) return;
  el.textContent = text;
  el.classList.toggle("save-ok", ok);
  el.classList.toggle("save-err", !ok);
}

async function openSettingsOnPlayvortex() {
  const tabs = await Vortex07Ext.queryTabs({ active: true, currentWindow: true });
  const tab = tabs?.[0];
  const onVortex = tab?.url && /playvortex\.io/i.test(tab.url);

  if (onVortex && tab.id !== undefined) {
    await Vortex07Ext.updateTab(tab.id, { url: SETTINGS_URL });
  } else {
    await Vortex07Ext.createTab({ url: SETTINGS_URL });
  }

  window.close();
}

document.addEventListener("DOMContentLoaded", async () => {
  const manifest = Vortex07Ext.getManifest();
  const version = manifest?.version || "?";

  [document.getElementById("popupVersion"), document.getElementById("popupStatusVer")].forEach(
    (el) => {
      if (el) el.textContent = `v${version}`;
    },
  );

  let currentSettings = await loadSettings();
  applySettingsToPopup(currentSettings);

  document.getElementById("openSettingsTab")?.addEventListener("click", openSettingsOnPlayvortex);

  POPUP_TOGGLE_IDS.forEach((id) => {
    const input = document.querySelector(`[data-setting="${id}"]`);
    if (!input) return;

    input.addEventListener("change", async () => {
      const next = normalizeSettings({
        ...currentSettings,
        [id]: Boolean(input.checked),
      });

      const reloadNeeded = id === "enabled";

      try {
        await saveSettings(next);
        currentSettings = next;
        applySettingsToPopup(currentSettings);
        setSaveStatus("Saved");

        if (reloadNeeded) {
          setSaveStatus("Reload playvortex to apply");
        }
      } catch (_err) {
        setSaveStatus("Save failed", false);
      }
    });
  });

  Vortex07Ext.onStorageChanged((changes, namespace) => {
    if (namespace !== "sync" || !changes.vortex07Settings) return;
    currentSettings = normalizeSettings(changes.vortex07Settings.newValue);
    applySettingsToPopup(currentSettings);
  });
});
