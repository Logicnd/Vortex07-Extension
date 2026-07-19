import { applyCors, handleOptions } from "../util/http.js";
import { enforceRateLimit } from "../util/rate.js";
import {
  addGuestbookEntry,
  getGuestbookEntries,
  GUESTBOOK_MAX_LEN,
} from "../store/features.js";
import { hasPersistentStore, isValidVoterId } from "../store/reputation.js";

export default async function handler(req, res) {
  applyCors(res, req);
  if (handleOptions(req, res)) return;

  const profileUserId = String(
    req.query?.profileUserId || req.body?.profileUserId || "",
  ).trim();
  const voterId = String(req.query?.voterId || req.body?.voterId || "").trim();

  if (!/^\d+$/.test(profileUserId)) {
    res.status(400).json({ error: "Invalid profileUserId" });
    return;
  }

  if (!isValidVoterId(voterId)) {
    res.status(400).json({ error: "Invalid voterId" });
    return;
  }

  if (req.method === "GET") {
    if (
      !(await enforceRateLimit(req, res, {
        route: "guestbook-get",
        limit: 120,
        windowSec: 60,
        voterId,
        voterLimit: 60,
      }))
    ) {
      return;
    }

    const limit = Number(req.query?.limit) || 20;
    const entries = await getGuestbookEntries(profileUserId, limit);
    res.status(200).json({
      profileUserId: Number(profileUserId),
      entries,
      maxLength: GUESTBOOK_MAX_LEN,
      persistent: hasPersistentStore(),
    });
    return;
  }

  if (req.method === "POST") {
    if (
      !(await enforceRateLimit(req, res, {
        route: "guestbook-post",
        limit: 20,
        windowSec: 60,
        voterId,
        voterLimit: 10,
      }))
    ) {
      return;
    }

    const authorId = String(req.body?.authorId || voterId).trim();
    if (!/^\d+$/.test(authorId)) {
      res.status(400).json({ error: "Invalid authorId" });
      return;
    }

    if (authorId === profileUserId) {
      res.status(400).json({ error: "Cannot sign your own guestbook" });
      return;
    }

    const result = await addGuestbookEntry(
      profileUserId,
      authorId,
      req.body?.message || req.query?.message || "",
      req.body?.authorName || req.query?.authorName || "",
    );

    if (!result.ok) {
      const status = result.error === "already-posted-today" ? 429 : 400;
      res.status(status).json({ error: result.error, maxLength: GUESTBOOK_MAX_LEN });
      return;
    }

    res.status(200).json({
      ok: true,
      entry: result.entry,
      maxLength: GUESTBOOK_MAX_LEN,
      persistent: hasPersistentStore(),
    });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}
