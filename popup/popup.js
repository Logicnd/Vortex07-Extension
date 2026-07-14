(function () {
  const HOME = "https://playvortex.io/home";
  const DISCORD = "https://discord.gg/tGbVYTdqTG";  // Vortex07 Discord server

  const defaults = {
    enabled: true,
    darkMode: false,
    welcome: true,
    onlineDots: true,
    liveStats: true,
    capGames: true
  };

  const opts = document.getElementById("opts");
  const pill = document.getElementById("pill");
  let s = { ...defaults };

  function allCheckboxes() {
    return document.querySelectorAll("input[type=checkbox][data-key]");
  }

  function paint() {
    allCheckboxes().forEach((box) => {
      const key = box.dataset.key;
      box.checked = !!s[key];
      if (key !== "enabled") box.disabled = !s.enabled;
    });

    document.body.classList.toggle("dark", s.darkMode);
    document.body.classList.toggle("skin-off", !s.enabled);

    pill.textContent = s.enabled ? "ON" : "OFF";
    pill.classList.toggle("on", s.enabled);
  }

  document.body.addEventListener("change", (e) => {
    const box = e.target;
    if (box.type !== "checkbox" || !box.dataset.key) return;
    s[box.dataset.key] = box.checked;
    chrome.storage.local.set({ ...defaults, ...s });
    paint();
  });

  document.getElementById("discord-btn").onclick = () => {
    chrome.tabs.create({ url: DISCORD });
  };

  document.getElementById("site-link").onclick = (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: HOME });
  };

  chrome.storage.local.get(defaults, (data) => {
    s = { ...defaults, ...data };
    paint();
  });
})();
