import { applyCors, handleOptions } from "../lib/http.js";
import { enforceRateLimit } from "../lib/rate-limit.js";
import {
  hasPersistentStore,
  isValidVoterId,
} from "../lib/reputation-store.js";
import { parseActorUserId, verifyVoteSignature } from "../lib/vote-auth.js";
import {
  claimDaily,
  claimWeekly,
  equipItem,
  getShopCatalog,
  getWallet,
  purchaseItem,
} from "../lib/economy-store.js";

export default async function handler(req, res) {
  applyCors(res, req);
  if (handleOptions(req, res)) return;

  const userId = String(req.query?.userId || req.body?.userId || "").trim();
  const voterId = String(req.query?.voterId || req.body?.voterId || "").trim();
  const view = String(req.query?.view || req.body?.view || "").trim();
  const action = String(req.body?.action || "").trim();

  const isCatalogView = view === "catalog";
  const isPublicView = view === "public";

  if (!isCatalogView && !/^\d+$/.test(userId)) {
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
        route: "economy-get",
        limit: 120,
        windowSec: 60,
        voterId,
        voterLimit: 60,
      }))
    ) {
      return;
    }

    if (isCatalogView) {
      res.status(200).json({ catalog: getShopCatalog(), persistent: hasPersistentStore() });
      return;
    }

    const wallet = await getWallet(userId);
    res.status(200).json({ ...wallet, persistent: hasPersistentStore() });
    return;
  }

  if (req.method === "POST") {
    const actorUserId = parseActorUserId(req.body?.actorUserId);
    if (!actorUserId || actorUserId !== userId) {
      res.status(400).json({ error: "actorUserId must match userId" });
      return;
    }

    const signatureCheck = verifyVoteSignature(req, actorUserId, userId);
    if (!signatureCheck.ok) {
      res.status(403).json({ error: signatureCheck.error || "Forbidden" });
      return;
    }

    if (!["daily", "weekly", "purchase", "equip"].includes(action)) {
      res.status(400).json({ error: "Invalid action" });
      return;
    }

    if (
      !(await enforceRateLimit(req, res, {
        route: `economy-${action}`,
        limit: 30,
        windowSec: 60,
        voterId: `pv:${actorUserId}`,
        voterLimit: 10,
      }))
    ) {
      return;
    }

    let result;
    if (action === "daily") result = await claimDaily(userId);
    else if (action === "weekly") result = await claimWeekly(userId);
    else if (action === "purchase") result = await purchaseItem(userId, String(req.body?.itemId || "").trim());
    else if (action === "equip") result = await equipItem(userId, String(req.body?.itemId || "").trim());

    res.status(200).json({
      ok: result.ok,
      ...(result.error ? { error: result.error } : {}),
      ...(result.reward ? { reward: result.reward } : {}),
      ...(result.spent !== undefined ? { spent: result.spent } : {}),
      ...(result.balance !== undefined ? { balance: result.balance } : {}),
      ...(result.itemId ? { itemId: result.itemId } : {}),
      ...(result.slot ? { slot: result.slot } : {}),
      ...(result.cosmetics ? { cosmetics: result.cosmetics } : {}),
      ...(result.wallet ? result.wallet : {}),
      persistent: hasPersistentStore(),
    });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}
