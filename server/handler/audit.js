import { applyCors, handleOptions } from "../util/http.js";
import { enforceRateLimit } from "../util/rate.js";
import {
  detectRepSpikes,
  getRepAuditFeed,
} from "../store/audit.js";
import { hasPersistentStore } from "../store/reputation.js";
import { verifyAdminSecret } from "../util/auth.js";

export default async function handler(req, res) {
  applyCors(res, req);
  if (handleOptions(req, res)) return;

  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (!verifyAdminSecret(req)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  if (
    !(await enforceRateLimit(req, res, {
      route: "rep-audit",
      limit: 30,
      windowSec: 60,
    }))
  ) {
    return;
  }

  const limit = Number(req.query?.limit) || 100;
  const targetUserId = String(req.query?.targetUserId || "").trim() || null;
  const events = await getRepAuditFeed(limit, targetUserId);
  const spikes = detectRepSpikes(events);

  res.status(200).json({
    events,
    spikes,
    limit,
    targetUserId,
    persistent: hasPersistentStore(),
  });
}
