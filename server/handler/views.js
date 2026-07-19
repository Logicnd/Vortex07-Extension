import { applyCors, handleOptions } from "../util/http.js";
import { enforceRateLimit } from "../util/rate.js";
import {
  getProfileViewCount,
  incrementProfileView,
} from "../store/features.js";
import { hasPersistentStore, isValidVoterId } from "../store/reputation.js";

export default async function handler(req, res) {
  applyCors(res, req);
  if (handleOptions(req, res)) return;

  const userId = String(req.query?.userId || req.body?.userId || "").trim();
  const voterId = String(req.query?.voterId || req.body?.voterId || "").trim();

  if (!/^\d+$/.test(userId)) {
    res.status(400).json({ error: "Invalid userId" });
    return;
  }

  if (!isValidVoterId(voterId)) {
    res.status(400).json({ error: "Invalid voterId" });
    return;
  }

  if (req.method === "GET") {
    if (
      !(await enforceRateLimit(req, res, {
        route: "profile-views-get",
        limit: 120,
        windowSec: 60,
        voterId,
        voterLimit: 60,
      }))
    ) {
      return;
    }

    const count = await getProfileViewCount(userId);
    res.status(200).json({
      userId: Number(userId),
      count,
      persistent: hasPersistentStore(),
    });
    return;
  }

  if (req.method === "POST") {
    if (
      !(await enforceRateLimit(req, res, {
        route: "profile-view",
        limit: 60,
        windowSec: 86400,
        voterId,
        voterLimit: 60,
      }))
    ) {
      return;
    }

    const result = await incrementProfileView(userId, voterId);
    res.status(200).json({
      userId: Number(userId),
      count: result.count,
      added: result.added,
      persistent: hasPersistentStore(),
    });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}
