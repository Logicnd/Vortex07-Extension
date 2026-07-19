// Anti-FOUC loader: hide the page as early as possible until Vortex07 applies.
(function () {
  const html = document.documentElement;
  if (!html) return;

  // Hide the entire document immediately, even before <body> is parsed.
  html.style.visibility = "hidden";
  html.style.opacity = "0";
  html.classList.add("vortex07-loading");

  const style = document.createElement("style");
  style.id = "vortex07-anti-fouc";
  style.textContent = "html.vortex07-loading { visibility: hidden !important; opacity: 0 !important; } html.vortex07-loading body { visibility: hidden !important; opacity: 0 !important; }";
  (document.head || html).appendChild(style);

  // Failsafe: reveal after 6 seconds if the main script hasn't.
  setTimeout(() => {
    html.classList.remove("vortex07-loading");
    html.style.visibility = "";
    html.style.opacity = "";
  }, 6000);
})();
