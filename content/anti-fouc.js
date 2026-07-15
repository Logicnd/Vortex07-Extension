// Anti-FOUC loader: hide the page as early as possible until Vortex07 applies.
(function () {
  const html = document.documentElement;
  if (!html) return;

  const style = document.createElement("style");
  style.id = "vortex07-anti-fouc";
  style.textContent = "html.vortex07-loading body { visibility: hidden !important; opacity: 0 !important; }";
  (document.head || html).appendChild(style);

  html.classList.add("vortex07-loading");

  // Failsafe: reveal after 6 seconds if the main script hasn't.
  setTimeout(() => {
    html.classList.remove("vortex07-loading");
  }, 6000);
})();
