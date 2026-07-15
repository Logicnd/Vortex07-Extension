const PLAYVORTEX_ORIGINS = new Set([
  "https://playvortex.io",
  "https://www.playvortex.io",
]);

function resolveCorsOrigin(req) {
  const origin = String(req?.headers?.origin || "").trim();
  if (origin && PLAYVORTEX_ORIGINS.has(origin)) return origin;
  return "*";
}

/** Open CORS for playvortex.io + extension direct-fetch fallback (Firefox). */
export function applyCors(res, req) {
  const allowOrigin = resolveCorsOrigin(req);
  res.setHeader("Access-Control-Allow-Origin", allowOrigin);
  if (allowOrigin !== "*") {
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Accept, X-Vortex07-Signature, X-Vortex07-Timestamp, X-Vortex07-Admin",
  );
  res.setHeader("Access-Control-Max-Age", "86400");
}

export function handleOptions(req, res) {
  applyCors(res, req);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true;
  }
  return false;
}
