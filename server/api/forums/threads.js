import { kv } from "@vercel/kv";

const OWNER_IDS = (process.env.OWNER_IDS || "").split(",").map((s) => s.trim());
const MAX_TITLE = 80;
const MAX_BODY = 2000;
const PAGE_SIZE = 20;

function sanitize(str, max) {
  return String(str || "").replace(/[<>]/g, "").trim().slice(0, max);
}

function forbidden(res) {
  return res.status(403).json({ error: "Forbidden." });
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();

  const { category, page = "1", id } = req.query;

  if (req.method === "GET" && id) {
    const thread = await kv.hgetall(`forum:thread:${id}`);
    if (!thread) return res.status(404).json({ error: "Thread not found." });
    const posts = await kv.lrange(`forum:posts:${id}`, 0, -1);
    const parsed = (posts || []).map((p) => (typeof p === "string" ? JSON.parse(p) : p));
    return res.status(200).json({ thread, posts: parsed });
  }

  if (req.method === "GET" && category) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const start = (pageNum - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE - 1;
    const ids = await kv.lrange(`forum:threads:${category}`, start, end);
    if (!ids?.length) return res.status(200).json({ threads: [], page: pageNum });

    const threads = await Promise.all(
      (ids || []).map(async (tid) => {
        const t = await kv.hgetall(`forum:thread:${tid}`);
        return t || null;
      })
    );

    return res.status(200).json({
      threads: threads.filter(Boolean),
      page: pageNum
    });
  }

  if (req.method === "POST") {
    const { username, title, body, categoryId } = req.body || {};
    if (!username || !title || !body || !categoryId) {
      return res.status(400).json({ error: "Missing fields." });
    }

    const cleanTitle = sanitize(title, MAX_TITLE);
    const cleanBody = sanitize(body, MAX_BODY);
    const cleanUser = sanitize(username, 32);
    if (!cleanTitle || !cleanBody || !cleanUser) {
      return res.status(400).json({ error: "Invalid content." });
    }

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const now = Date.now();

    const thread = {
      id,
      category: categoryId,
      title: cleanTitle,
      author: cleanUser,
      createdAt: now,
      replyCount: 0,
      lastReplyAt: now,
      pinned: "0"
    };

    await kv.hset(`forum:thread:${id}`, thread);
    await kv.lpush(`forum:threads:${categoryId}`, id);

    const firstPost = { id: `p-${id}-0`, threadId: id, author: cleanUser, body: cleanBody, createdAt: now };
    await kv.rpush(`forum:posts:${id}`, JSON.stringify(firstPost));

    return res.status(201).json({ thread, post: firstPost });
  }

  if (req.method === "DELETE") {
    const { threadId, requesterId } = req.body || {};
    if (!OWNER_IDS.includes(requesterId)) return forbidden(res);

    const thread = await kv.hgetall(`forum:thread:${threadId}`);
    if (!thread) return res.status(404).json({ error: "Not found." });

    await kv.del(`forum:thread:${threadId}`);
    await kv.del(`forum:posts:${threadId}`);
    await kv.lrem(`forum:threads:${thread.category}`, 0, threadId);

    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed." });
}
