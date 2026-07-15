/* Catalog avatar preview — early WebGL patch for chunky 2007-style edges */

(function installCatalogRetroPreview() {
  if (globalThis.__VORTEX07_CATALOG_PREVIEW_PATCH__) return;
  globalThis.__VORTEX07_CATALOG_PREVIEW_PATCH__ = true;

  const RETRO_BUFFER_RATIO = 0.52;

  function isCatalogRoute() {
    const path = location.pathname || "";
    return path === "/catalog" || path.startsWith("/catalog/");
  }

  function isPreviewCanvas(canvas) {
    if (!canvas) return false;
    if (canvas.id === "preview-canvas") return true;
    return Boolean(canvas.closest?.(".avatar-canvas-wrap"));
  }

  function downscalePreviewBuffer(canvas) {
    if (!canvas || canvas.dataset.vortex07RetroRes === "1") return;

    const currentW = canvas.width;
    const currentH = canvas.height;
    if (!currentW || !currentH) return;

    const nextW = Math.max(88, Math.round(currentW * RETRO_BUFFER_RATIO));
    const nextH = Math.max(108, Math.round(currentH * RETRO_BUFFER_RATIO));
    if (nextW >= currentW && nextH >= currentH) return;

    canvas.width = nextW;
    canvas.height = nextH;
    canvas.dataset.vortex07RetroRes = "1";
  }

  const nativeGetContext = HTMLCanvasElement.prototype.getContext;

  HTMLCanvasElement.prototype.getContext = function getContext(type, options) {
    const ctxType = String(type || "").toLowerCase();
    const isWebGl =
      ctxType === "webgl" ||
      ctxType === "webgl2" ||
      ctxType === "experimental-webgl";

    if (isWebGl && isCatalogRoute() && isPreviewCanvas(this)) {
      downscalePreviewBuffer(this);
      options = {
        ...(options || {}),
        antialias: false,
        alpha: false,
        depth: true,
        stencil: false,
        preserveDrawingBuffer: true,
        powerPreference: "low-power",
      };
    }

    return nativeGetContext.call(this, type, options);
  };
})();
