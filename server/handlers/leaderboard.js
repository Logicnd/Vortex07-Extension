import { applyCors, handleOptions } from "../lib/http.js";
import { enforceRateLimit } from "../lib/rate-limit.js";
import { getLeaderboard, hasPersistentStore } from "../lib/reputation-store.js";

export default async function handler(req, res) {
  applyCors(res, req);
  if (handleOptions(req, res)) return;

  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const limit = Number(req.query?.limit) || 25;

  if (
    !(await enforceRateLimit(req, res, {
      route: "leaderboard",
      limit: 120,
      windowSec: 60,
    }))
  ) {
    return;
  }

  const payload = await getLeaderboard(limit);

  res.setHeader("Cache-Control", "public, max-age=30, stale-while-revalidate=60");

  res.status(200).json({
    ...payload,
    persistent: hasPersistentStore(),
  });
}
