import { applyCors, handleOptions } from "../util/http.js";
import {
  enforceRateLimit,
  enforceVoteRateLimits,
  getClientIp,
} from "../util/rate.js";
import {
  getBatchReputation,
  getReputation,
  hasPersistentStore,
  isValidVoterId,
  parseNumericIds,
  resolveVoterKey,
  setReputationVote,
} from "../store/reputation.js";
import {
  actorStorageKey,
  parseActorUserId,
  verifyVoteSignature,
} from "../util/auth.js";

// Client sends action: "add" to like, "remove" to unlike. POST without action toggles.
function resolveRequestedVote(req) {
  if (req.method === "DELETE") return "remove";
  const action = String(req.body?.action || req.query?.action || "").trim();
  if (action === "remove") return "remove";
  if (action === "add") return "add";
  return "up";
}

export default async function handler(req, res) {
  applyCors(res, req);
  if (handleOptions(req, res)) return;

  const userId = String(req.query?.userId || req.body?.userId || "").trim();
  const voterId = String(req.query?.voterId || req.body?.voterId || "").trim();
  const actorUserId = parseActorUserId(
    req.query?.actorUserId || req.body?.actorUserId,
  );
  const idsParam = String(req.query?.ids || "").trim();
  const voterKey = resolveVoterKey({ actorUserId, voterId });
  const isVoteMethod = req.method === "POST" || req.method === "DELETE";

  if (req.method === "GET" && idsParam) {
    if (
      !(await enforceRateLimit(req, res, {
        route: "reputation-batch",
        limit: 90,
        windowSec: 60,
        voterId: voterKey || voterId,
        voterLimit: 45,
      }))
    ) {
      return;
    }
    if (!voterKey && !isValidVoterId(voterId)) {
      res.status(400).json({ error: "Invalid voterId or actorUserId" });
      return;
    }

    const ids = parseNumericIds(idsParam);
    const results = await getBatchReputation(ids, voterKey || voterId);

    res.status(200).json({ results, persistent: hasPersistentStore() });
    return;
  }

  if (!/^\d+$/.test(userId)) {
    res.status(400).json({ error: "Invalid userId" });
    return;
  }

  if (req.method === "GET") {
    if (
      !(await enforceRateLimit(req, res, {
        route: "reputation-get",
        limit: 120,
        windowSec: 60,
        voterId: voterKey || voterId,
        voterLimit: 60,
      }))
    ) {
      return;
    }

    if (!voterKey && !isValidVoterId(voterId)) {
      res.status(400).json({ error: "Invalid voterId or actorUserId" });
      return;
    }

    const result = await getReputation(userId, voterKey || voterId);
    res.status(200).json({ ...result, persistent: hasPersistentStore() });
    return;
  }

  if (isVoteMethod) {
    if (!actorUserId) {
      res.status(400).json({ error: "actorUserId required" });
      return;
    }

    if (actorUserId === userId) {
      res.status(403).json({ error: "Cannot rep yourself" });
      return;
    }

    const signatureCheck = verifyVoteSignature(req, actorUserId, userId);
    if (!signatureCheck.ok) {
      res.status(403).json({ error: signatureCheck.error || "Forbidden" });
      return;
    }

    if (!(await enforceVoteRateLimits(req, res, actorUserId))) {
      return;
    }

    const storageKey = actorStorageKey(actorUserId);
    const auditContext = {
      actorUserId,
      ip: getClientIp(req),
      targetUsername: String(req.body?.targetUsername || req.query?.targetUsername || "").trim(),
    };

    const requestedVote = resolveRequestedVote(req);

    const result = await setReputationVote(
      userId,
      storageKey,
      requestedVote,
      auditContext,
    );

    res.status(200).json({
      ...result,
      persistent: hasPersistentStore(),
    });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}
