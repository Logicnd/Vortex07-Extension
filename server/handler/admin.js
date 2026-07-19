import { applyCors, handleOptions } from "../util/http.js";
import { enforceRateLimit, getClientIp } from "../util/rate.js";
import {
  hasPersistentStore,
  purgeUserReputation,
} from "../store/reputation.js";
import { parseActorUserId, verifyAdminSecret } from "../util/auth.js";

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
