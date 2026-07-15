import { applyCors, handleOptions } from "../lib/http.js";
import { enforceRateLimit } from "../lib/rate-limit.js";
import { getActivityFeed } from "../lib/feature-store.js";
import { hasPersistentStore, isValidVoterId } from "../lib/reputation-store.js";

export default async function handler(req, res) {
  applyCors(res, req);
  if (handleOptions(req, res)) return;

  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const voterId = String(req.query?.voterId || "").trim();
  if (!isValidVoterId(voterId)) {
    res.status(400).json({ error: "Invalid voterId" });
    return;
  }

  if (
    !(await enforceRateLimit(req, res, {
      route: "activity-feed",
      limit: 120,
      windowSec: 60,
      voterId,
      voterLimit: 60,
    }))
  ) {
    return;
  }

  const limit = Number(req.query?.limit) || 15;
  const events = await getActivityFeed(limit);

  res.status(200).json({
    events,
    limit,
    persistent: hasPersistentStore(),
  });
}
