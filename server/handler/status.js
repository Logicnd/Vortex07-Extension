import { applyCors, handleOptions } from "../util/http.js";
import { enforceRateLimit } from "../util/rate.js";
import {
  getStatus,
  setStatus,
  STATUS_MAX_LEN,
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
        route: "status-get",
        limit: 120,
        windowSec: 60,
        voterId,
        voterLimit: 60,
      }))
    ) {
      return;
    }

    const status = await getStatus(userId);
    res.status(200).json({ userId: Number(userId), status, persistent: hasPersistentStore() });
    return;
  }

  if (req.method === "POST") {
    if (
      !(await enforceRateLimit(req, res, {
        route: "status-set",
        limit: 30,
        windowSec: 60,
        voterId,
        voterLimit: 15,
      }))
    ) {
      return;
    }

    const rawStatus = req.body?.status ?? req.query?.status ?? "";
    const status = await setStatus(userId, rawStatus);

    res.status(200).json({
      userId: Number(userId),
      status,
      maxLength: STATUS_MAX_LEN,
      persistent: hasPersistentStore(),
    });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}
