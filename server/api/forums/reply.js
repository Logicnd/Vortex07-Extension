import { kv } from "@vercel/kv";

const MAX_BODY = 2000;

function sanitize(str, max) {
  return String(str || "").replace(/[<>]/g, "").trim().slice(0, max);
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });

  const { threadId, username, body } = req.body || {};
  if (!threadId || !username || !body) {
    return res.status(400).json({ error: "Missing fields." });
  }

  const thread = await kv.hgetall(`forum:thread:${threadId}`);
  if (!thread) return res.status(404).json({ error: "Thread not found." });

  const cleanBody = sanitize(body, MAX_BODY);
  const cleanUser = sanitize(username, 32);
  if (!cleanBody || !cleanUser) return res.status(400).json({ error: "Invalid content." });

  const now = Date.now();
  const postCount = await kv.llen(`forum:posts:${threadId}`);
  const post = {
    id: `p-${threadId}-${postCount}`,
    threadId,
    author: cleanUser,
    body: cleanBody,
    createdAt: now
  };

  await kv.rpush(`forum:posts:${threadId}`, JSON.stringify(post));
  await kv.hset(`forum:thread:${threadId}`, {
    replyCount: postCount,
    lastReplyAt: now
  });

  return res.status(201).json({ post });
}
