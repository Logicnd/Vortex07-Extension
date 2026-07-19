import { applyCors, handleOptions } from "../util/http.js";
import { enforceRateLimit } from "../util/rate.js";
import {
  addGameComment,
  getGameComments,
  GAME_COMMENT_MAX_LEN,
} from "../store/features.js";
import {
  getGameVotes,
  hasPersistentStore,
  isValidGameId,
  isValidVoterId,
  setGameVote,
} from "../store/votes.js";

function isCommentsRoute(req) {
  const url = String(req.url || "");
  if (url.includes("game-comments")) return true;

  const forwarded = String(
    req.headers?.["x-vercel-original-path"] ||
      req.headers?.["x-matched-path"] ||
      req.headers?.["x-forwarded-uri"] ||
      "",
  );
  return forwarded.includes("game-comments");
}

async function handleGameComments(req, res, gameId, voterId) {
  if (req.method === "GET") {
    if (
      !(await enforceRateLimit(req, res, {
        route: "game-comments-get",
        limit: 120,
        windowSec: 60,
        voterId,
        voterLimit: 60,
      }))
    ) {
      return;
    }

    const limit = Number(req.query?.limit) || 30;
    const comments = await getGameComments(gameId, limit);
    res.status(200).json({
      gameId: Number(gameId),
      comments,
      maxLength: GAME_COMMENT_MAX_LEN,
      persistent: hasPersistentStore(),
    });
    return;
  }

  if (req.method === "POST") {
    if (
      !(await enforceRateLimit(req, res, {
        route: "game-comments-post",
        limit: 30,
        windowSec: 60,
        voterId,
        voterLimit: 15,
      }))
    ) {
      return;
    }

    const authorId = String(req.body?.authorId || voterId).trim();
    if (!/^\d+$/.test(authorId)) {
      res.status(400).json({ error: "Invalid authorId" });
      return;
    }

    const result = await addGameComment(
      gameId,
      authorId,
      req.body?.message || req.query?.message || "",
      req.body?.authorName || req.query?.authorName || "",
    );

    if (!result.ok) {
      res.status(400).json({ error: result.error, maxLength: GAME_COMMENT_MAX_LEN });
      return;
    }

    res.status(200).json({
      ok: true,
      comment: result.entry,
      maxLength: GAME_COMMENT_MAX_LEN,
      persistent: hasPersistentStore(),
    });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}

async function handleGameVotes(req, res, gameId, voterId) {
  if (req.method === "GET") {
    if (
      !(await enforceRateLimit(req, res, {
        route: "game-votes-get",
        limit: 120,
        windowSec: 60,
        voterId,
        voterLimit: 60,
      }))
    ) {
      return;
    }

    const result = await getGameVotes(gameId, voterId);
    res.status(200).json({ ...result, persistent: hasPersistentStore() });
    return;
  }

  if (req.method === "POST") {
    if (
      !(await enforceRateLimit(req, res, {
        route: "game-votes-post",
        limit: 40,
        windowSec: 60,
        voterId,
        voterLimit: 20,
      }))
    ) {
      return;
    }

    const rawVote = req.body?.vote;
    const vote =
      rawVote === null || rawVote === undefined || rawVote === ""
        ? null
        : String(rawVote).trim();

    if (vote !== null && vote !== "like" && vote !== "dislike") {
      res.status(400).json({ error: "Invalid vote" });
      return;
    }

    const result = await setGameVote(gameId, voterId, vote);
    res.status(200).json({ ...result, persistent: hasPersistentStore() });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}

export default async function handler(req, res) {
  applyCors(res, req);
  if (handleOptions(req, res)) return;

  const gameId = String(req.query?.gameId || req.body?.gameId || "").trim();
  const voterId = String(req.query?.voterId || req.body?.voterId || "").trim();

  if (!isValidGameId(gameId)) {
    res.status(400).json({ error: "Invalid gameId" });
    return;
  }

  if (!isValidVoterId(voterId)) {
    res.status(400).json({ error: "Invalid voterId" });
    return;
  }

  if (isCommentsRoute(req)) {
    await handleGameComments(req, res, gameId, voterId);
    return;
  }

  await handleGameVotes(req, res, gameId, voterId);
}
