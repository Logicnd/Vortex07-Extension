import { applyCors, handleOptions } from "../util/http.js";
import { enforceRateLimit } from "../util/rate.js";
import { getBatchStatuses } from "../store/features.js";
import {
  canAccessForumCategory,
  createReply,
  createThread,
  FORUM_BODY_MAX,
  FORUM_CATEGORIES,
  FORUM_TITLE_MAX,
  getThreadWithPosts,
  isValidCategoryId,
  listAccessibleCategories,
  listThreads,
  normalizeCategoryId,
  purgeForum,
  togglePostLike,
} from "../store/forum.js";
import { hasPersistentStore, isValidVoterId } from "../store/reputation.js";

function uniqueAuthorIds(rows = []) {
  const ids = new Set();
  rows.forEach((row) => {
    const id = Number(row?.authorUserId);
    if (Number.isFinite(id) && id > 0) ids.add(id);
  });
  return [...ids];
}

async function buildAuthorsMap(userIds) {
  const ids = [...new Set(userIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0))];
  if (!ids.length) return {};

  const statusMap = await getBatchStatuses(ids);
  const authors = {};
  ids.forEach((id) => {
    authors[String(id)] = {
      userId: id,
      status: statusMap.get(id) || "",
    };
  });
  return authors;
}

export default async function handler(req, res) {
  applyCors(res, req);
  if (handleOptions(req, res)) return;

  const action = String(req.query?.action || req.body?.action || "").trim();
  const voterId = String(req.query?.voterId || req.body?.voterId || "").trim();
  const actorUserId = Number(req.query?.actorUserId ?? req.body?.actorUserId) || null;

  if (!isValidVoterId(voterId)) {
    res.status(400).json({ error: "Invalid voterId" });
    return;
  }

  if (req.method === "GET") {
    if (
      !(await enforceRateLimit(req, res, {
        route: "forum-get",
        limit: 120,
        windowSec: 60,
        voterId,
        voterLimit: 60,
      }))
    ) {
      return;
    }

    if (action === "feed" || action === "threads") {
      const categoryId = normalizeCategoryId(req.query?.category || "general");
      if (!isValidCategoryId(categoryId)) {
        res.status(400).json({ error: "Invalid category" });
        return;
      }

      const limit = Number(req.query?.limit) || 30;
      const offset = Number(req.query?.offset) || 0;
      if (!canAccessForumCategory(categoryId, actorUserId)) {
        res.status(403).json({ error: "forbidden" });
        return;
      }
      const threads = await listThreads(categoryId, limit, offset, { userId: actorUserId });
      const authors =
        action === "feed" ? await buildAuthorsMap(uniqueAuthorIds(threads)) : undefined;

      res.status(200).json({
        categoryId,
        threads,
        authors,
        categories: listAccessibleCategories(actorUserId),
        titleMax: FORUM_TITLE_MAX,
        bodyMax: FORUM_BODY_MAX,
        persistent: hasPersistentStore(),
      });
      return;
    }

    if (action === "thread") {
      const threadId = String(req.query?.threadId || "").trim();
      if (!threadId) {
        res.status(400).json({ error: "Missing threadId" });
        return;
      }

      const data = await getThreadWithPosts(threadId, voterId, { userId: actorUserId });
      if (!data) {
        res.status(404).json({ error: "Thread not found" });
        return;
      }

      const authors = await buildAuthorsMap(
        uniqueAuthorIds([data.thread, ...(data.posts || [])]),
      );

      res.status(200).json({
        ...data,
        authors,
        titleMax: FORUM_TITLE_MAX,
        bodyMax: FORUM_BODY_MAX,
        persistent: hasPersistentStore(),
      });
      return;
    }

    res.status(400).json({ error: "Invalid action" });
    return;
  }

  if (req.method === "POST") {
    if (
      !(await enforceRateLimit(req, res, {
        route: "forum-post",
        limit: 30,
        windowSec: 3600,
        voterId,
        voterLimit: 10,
      }))
    ) {
      return;
    }

    const authorUserId = req.body?.authorUserId ?? req.query?.authorUserId ?? null;
    const authorName = req.body?.authorName || req.query?.authorName || "";

    if (action === "purge") {
      const secret = String(req.body?.secret || req.query?.secret || "").trim();
      const expected = String(process.env.FORUM_PURGE_SECRET || "vortex07-purge-forum").trim();
      if (!secret || secret !== expected) {
        res.status(403).json({ error: "forbidden" });
        return;
      }

      const result = await purgeForum();
      res.status(200).json({ ok: true, ...result });
      return;
    }

    if (action === "like-post") {
      const threadId = String(req.body?.threadId || "").trim();
      const postId = String(req.body?.postId || "").trim();
      if (!threadId || !postId) {
        res.status(400).json({ error: "missing-fields" });
        return;
      }

      const result = await togglePostLike({ voterId, threadId, postId });
      if (!result.ok) {
        const status = result.error === "post-not-found" ? 404 : 400;
        res.status(status).json({ error: result.error });
        return;
      }

      res.status(200).json({ ok: true, ...result });
      return;
    }

    if (action === "create-thread" || (!action && req.body?.categoryId)) {
      const categoryId = normalizeCategoryId(
        req.body?.categoryId || req.body?.category || req.body?.boardId || "",
      );
      const result = await createThread({
        voterId,
        categoryId,
        title: req.body?.title || "",
        body: req.body?.body || "",
        authorUserId,
        authorName,
      });

      if (!result.ok) {
        const status = result.error === "forbidden" ? 403 : 400;
        res.status(status).json({
          error: result.error,
          titleMax: FORUM_TITLE_MAX,
          bodyMax: FORUM_BODY_MAX,
        });
        return;
      }

      res.status(200).json({
        ok: true,
        thread: result.thread,
        post: result.post,
        persistent: hasPersistentStore(),
      });
      return;
    }

    if (action === "reply" || (!action && req.body?.threadId)) {
      const threadId = String(req.body?.threadId || "").trim();
      const parentPostId = req.body?.parentPostId ?? null;
      const result = await createReply({
        voterId,
        threadId,
        body: req.body?.body || "",
        parentPostId,
        authorUserId,
        authorName,
      });

      if (!result.ok) {
        const status =
          result.error === "forbidden" ? 403
          : result.error === "thread-not-found" || result.error === "invalid-parent" ? 404
          : 400;
        res.status(status).json({
          error: result.error,
          bodyMax: FORUM_BODY_MAX,
        });
        return;
      }

      res.status(200).json({
        ok: true,
        post: result.post,
        thread: result.thread,
        persistent: hasPersistentStore(),
      });
      return;
    }

    res.status(400).json({ error: "Invalid action" });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}
