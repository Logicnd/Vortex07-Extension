import { applyCors, handleOptions } from "../util/http.js";
import { enforceRateLimit } from "../util/rate.js";
import {
  getBatchReputation,
  hasPersistentStore,
  isValidVoterId,
  parseNumericIds,
  resolveVoterKey,
} from "../store/reputation.js";
import { getBatchStatuses } from "../store/features.js";
import { parseActorUserId } from "../util/auth.js";

export default async function handler(req, res) {
  applyCors(res, req);
  if (handleOptions(req, res)) return;

  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const voterId = String(req.query?.voterId || "").trim();
  const actorUserId = parseActorUserId(req.query?.actorUserId);
  const voterKey = resolveVoterKey({ actorUserId, voterId });
  const ids = parseNumericIds(req.query?.ids);

  if (ids.length === 0) {
    res.status(400).json({ error: "Invalid ids" });
    return;
  }

  if (!voterKey && !isValidVoterId(voterId)) {
    res.status(400).json({ error: "Invalid voterId or actorUserId" });
    return;
  }

  if (
    !(await enforceRateLimit(req, res, {
      route: "players-batch",
      limit: 90,
      windowSec: 60,
      voterId: voterKey || voterId,
      voterLimit: 45,
    }))
  ) {
    return;
  }

  const [results, statusMap] = await Promise.all([
    getBatchReputation(ids, voterKey || voterId),
    getBatchStatuses(ids),
  ]);

  const merged = results.map((row) => ({
    ...row,
    status: statusMap.get(Number(row.userId)) || "",
  }));

  res.setHeader("Cache-Control", "private, max-age=15, stale-while-revalidate=30");

  res.status(200).json({
    results: merged,
    persistent: hasPersistentStore(),
  });
}
