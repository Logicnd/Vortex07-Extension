import { applyCors, handleOptions } from "../lib/http.js";
import { enforceRateLimit, getClientIp } from "../lib/rate-limit.js";
import {
  hasPersistentStore,
  purgeUserReputation,
} from "../lib/reputation-store.js";
import { parseActorUserId, verifyAdminSecret } from "../lib/vote-auth.js";

export default async function handler(req, res) {
  applyCors(res, req);
  if (handleOptions(req, res)) return;

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (!verifyAdminSecret(req)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  if (
    !(await enforceRateLimit(req, res, {
      route: "rep-admin",
      limit: 20,
      windowSec: 60,
    }))
  ) {
    return;
  }

  const userId = String(req.body?.userId || req.query?.userId || "").trim();
  if (!/^\d+$/.test(userId)) {
    res.status(400).json({ error: "Invalid userId" });
    return;
  }

  const actorUserId = parseActorUserId(req.body?.actorUserId) || "0";
  const result = await purgeUserReputation(userId, {
    actorUserId,
    ip: getClientIp(req),
  });

  res.status(200).json({
    ...result,
    persistent: hasPersistentStore(),
  });
}
