/**
 * Single source of truth for Vortex07 user settings (sync storage).
 * Loaded before content scripts and popup — no imports, attaches to global.
 */
(function initVortex07SettingsSchema(global) {
  const NAV_VISIBLE_DEFAULTS = {
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

  const DEFAULT_SETTINGS = {
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
    navVisible: { ...NAV_VISIBLE_DEFAULTS },
  };

  const LEGACY_KEYS = ["reputation", "banArchive", "themePreset", "johnVortexTheme"];

  function normalizeNavVisible(settings) {
    const raw =
      settings?.navVisible && typeof settings.navVisible === "object"
        ? settings.navVisible
        : {};
    const navVisible = { ...NAV_VISIBLE_DEFAULTS, ...raw };

    if (settings?.showForum === false) navVisible.forum = false;
    else if (
      settings?.showForum === true &&
      !Object.prototype.hasOwnProperty.call(raw, "forum")
    ) {
      navVisible.forum = true;
    }

    return navVisible;
  }

  /**
   * @param {object} [settings]
   */
  function normalizeSettings(settings) {
    const merged = { ...DEFAULT_SETTINGS, ...(settings || {}) };
    LEGACY_KEYS.forEach((key) => delete merged[key]);
    merged.navVisible = normalizeNavVisible(merged);
    merged.showForum = merged.navVisible.forum;
    return merged;
  }

  global.Vortex07SettingsSchema = {
    DEFAULT_SETTINGS,
    NAV_VISIBLE_DEFAULTS,
    normalizeSettings,
    normalizeNavVisible,
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
