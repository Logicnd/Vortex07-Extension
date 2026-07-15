import { getRedisClient } from "./reputation-store.js";

export const FORUM_TITLE_MAX = 120;
export const FORUM_BODY_MAX = 1000;

export const FORUM_DEV_USER_IDS = new Set([15936, 18202]);

export const FORUM_CATEGORIES = [
  { id: "general", label: "General Discussion" },
  { id: "help", label: "Help & Support" },
  { id: "offtopic", label: "Off Topic" },
  { id: "vortex07-dev", label: "Developer Lounge", devOnly: true },
];

const memoryStore = globalThis.__vortex07ForumStore || {
  threads: {},
  posts: {},
  categoryThreads: {},
  threadPosts: {},
  postLikes: {},
  voterLikes: {},
  nextId: 1,
};
globalThis.__vortex07ForumStore = memoryStore;

function categoryThreadsKey(categoryId) {
  return `forum:cat:${categoryId}:threads`;
}

function threadKey(threadId) {
  return `forum:thread:${threadId}`;
}

function postKey(postId) {
  return `forum:post:${postId}`;
}

function threadPostsKey(threadId) {
  return `forum:thread:${threadId}:posts`;
}

function postLikesKey(postId) {
  return `forum:post:${postId}:likes`;
}

function voterLikeKey(postId, voterId) {
  return `forum:like:${postId}:${voterId}`;
}

export function normalizeCategoryId(raw) {
  const id = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!id) return "";

  const aliases = {
    "off-topic": "offtopic",
    offtopic: "offtopic",
    "help-support": "help",
    help: "help",
    general: "general",
    "vortex07-dev": "vortex07-dev",
    dev: "vortex07-dev",
    "developer-lounge": "vortex07-dev",
  };
  if (aliases[id]) return aliases[id];

  const direct = FORUM_CATEGORIES.find((cat) => cat.id === id);
  if (direct) return direct.id;

  const compact = id.replace(/-/g, "");
  const byCompact = FORUM_CATEGORIES.find((cat) => cat.id.replace(/-/g, "") === compact);
  if (byCompact) return byCompact.id;

  const byLabel = FORUM_CATEGORIES.find((cat) => {
    const label = cat.label.toLowerCase().replace(/[^a-z0-9]+/g, "");
    return label === compact;
  });
  return byLabel?.id || id;
}

export function isValidCategoryId(categoryId) {
  const id = normalizeCategoryId(categoryId);
  return FORUM_CATEGORIES.some((cat) => cat.id === id);
}

export function isDevOnlyCategory(categoryId) {
  const cat = FORUM_CATEGORIES.find((row) => row.id === categoryId);
  return Boolean(cat?.devOnly);
}

export function canAccessForumCategory(categoryId, userId = null) {
  if (!isValidCategoryId(categoryId)) return false;
  if (!isDevOnlyCategory(categoryId)) return true;
  const uid = Number(userId);
  return Number.isFinite(uid) && FORUM_DEV_USER_IDS.has(uid);
}

export function listAccessibleCategories(userId = null) {
  return FORUM_CATEGORIES.filter((cat) => canAccessForumCategory(cat.id, userId));
}

function sanitizeTitle(text) {
  return String(text || "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, FORUM_TITLE_MAX);
}

function sanitizeBody(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, FORUM_BODY_MAX);
}

function sanitizeAuthorName(name) {
  return String(name || "")
    .replace(/[\r\n\t<>]+/g, " ")
    .trim()
    .slice(0, 40);
}

async function nextForumId() {
  const redis = getRedisClient();
  if (redis) {
    return String(await redis.incr("forum:nextId"));
  }
  const id = String(memoryStore.nextId);
  memoryStore.nextId += 1;
  return id;
}

function parseStoredJson(raw) {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function parseZrangeMembers(raw) {
  if (!Array.isArray(raw) || raw.length === 0) return [];

  if (typeof raw[0] === "object" && raw[0] !== null) {
    return raw
      .map((entry) => String(entry.member ?? entry.value ?? entry.id ?? "").trim())
      .filter(Boolean);
  }

  if (typeof raw[0] === "string" || typeof raw[0] === "number") {
    const hasScores =
      raw.length >= 2 &&
      typeof raw[0] === "string" &&
      typeof raw[1] === "number" &&
      raw.length % 2 === 0;
    if (hasScores) {
      const members = [];
      for (let i = 0; i < raw.length; i += 2) {
        members.push(String(raw[i]));
      }
      return members;
    }
    return raw.map((entry) => String(entry));
  }

  return [];
}

async function saveThread(thread) {
  const redis = getRedisClient();
  const threadId = String(thread.id);
  const categoryId = String(thread.categoryId);

  if (redis) {
    await redis.set(threadKey(threadId), thread);
    await redis.zadd(categoryThreadsKey(categoryId), {
      score: Number(thread.lastReplyAt) || Date.now(),
      member: threadId,
    });
    return;
  }

  memoryStore.threads[thread.id] = thread;
  if (!memoryStore.categoryThreads[thread.categoryId]) {
    memoryStore.categoryThreads[thread.categoryId] = [];
  }
  const list = memoryStore.categoryThreads[thread.categoryId];
  const idx = list.findIndex((row) => row.id === thread.id);
  if (idx >= 0) list[idx] = thread;
  else list.push(thread);
  list.sort((a, b) => b.lastReplyAt - a.lastReplyAt);
}

async function getThreadById(threadId) {
  const id = String(threadId || "").trim();
  if (!id) return null;

  const redis = getRedisClient();
  if (redis) {
    const raw = await redis.get(threadKey(id));
    return parseStoredJson(raw);
  }
  return memoryStore.threads[id] || null;
}

async function getPostById(postId) {
  const id = String(postId || "").trim();
  if (!id) return null;

  const redis = getRedisClient();
  if (redis) {
    const raw = await redis.get(postKey(id));
    return parseStoredJson(raw);
  }
  return memoryStore.posts[id] || null;
}

async function savePost(post) {
  const redis = getRedisClient();
  const postId = String(post.id);
  const threadId = String(post.threadId);

  if (redis) {
    await redis.set(postKey(postId), post);
    await redis.zadd(threadPostsKey(threadId), {
      score: Number(post.createdAt) || Date.now(),
      member: postId,
    });
    return;
  }

  memoryStore.posts[post.id] = post;
  if (!memoryStore.threadPosts[post.threadId]) {
    memoryStore.threadPosts[post.threadId] = [];
  }
  const list = memoryStore.threadPosts[post.threadId];
  const idx = list.findIndex((row) => row.id === post.id);
  if (idx >= 0) list[idx] = post;
  else list.push(post);
  list.sort((a, b) => a.createdAt - b.createdAt);
}

async function getPostLikeCount(postId) {
  const redis = getRedisClient();
  if (redis) {
    return Number(await redis.get(postLikesKey(postId))) || 0;
  }
  return Number(memoryStore.postLikes[String(postId)]) || 0;
}

async function getPostLikedByVoter(postId, voterId) {
  const redis = getRedisClient();
  if (redis) {
    const value = await redis.get(voterLikeKey(postId, voterId));
    return Boolean(value);
  }
  return Boolean(memoryStore.voterLikes[`${postId}:${voterId}`]);
}

async function setPostLikeCount(postId, count) {
  const numeric = Math.max(0, Number(count) || 0);
  const redis = getRedisClient();
  if (redis) {
    if (numeric <= 0) await redis.del(postLikesKey(postId));
    else await redis.set(postLikesKey(postId), numeric);
    return;
  }
  if (numeric <= 0) delete memoryStore.postLikes[String(postId)];
  else memoryStore.postLikes[String(postId)] = numeric;
}

async function setPostLikedByVoter(postId, voterId, liked) {
  const redis = getRedisClient();
  const memKey = `${postId}:${voterId}`;
  if (redis) {
    if (liked) await redis.set(voterLikeKey(postId, voterId), "1");
    else await redis.del(voterLikeKey(postId, voterId));
    return;
  }
  if (liked) memoryStore.voterLikes[memKey] = true;
  else delete memoryStore.voterLikes[memKey];
}

async function enrichPost(post, voterId, forceOp = false) {
  if (!post) return null;
  const isOp = forceOp || Boolean(post.isOp);
  if (isOp) {
    return { ...post, isOp: true, likeCount: 0, myLike: false, canLike: false };
  }
  const likeCount = await getPostLikeCount(post.id);
  const myLike = voterId ? await getPostLikedByVoter(post.id, voterId) : false;
  return { ...post, isOp: false, likeCount, myLike, canLike: true };
}

async function getPostsForThread(threadId, voterId = "") {
  const id = String(threadId || "").trim();
  if (!id) return [];

  const redis = getRedisClient();
  let posts = [];

  if (redis) {
    const rawIds = await redis.zrange(threadPostsKey(id), 0, -1);
    const ids = parseZrangeMembers(rawIds);
    posts = (
      await Promise.all(
        ids.map(async (postId) => parseStoredJson(await redis.get(postKey(postId)))),
      )
    ).filter(Boolean);
  } else {
    posts = [...(memoryStore.threadPosts[id] || [])].sort(
      (a, b) => a.createdAt - b.createdAt,
    );
  }

  posts.sort((a, b) => (Number(a.createdAt) || 0) - (Number(b.createdAt) || 0));

  return Promise.all(
    posts.map((post, index) => {
      const legacyOp =
        post.isOp !== true &&
        post.isOp !== false &&
        index === 0 &&
        (post.parentPostId === null || post.parentPostId === undefined);
      return enrichPost(post, voterId, legacyOp || post.isOp === true);
    }),
  );
}

export async function listThreads(categoryId, limit = 30, offset = 0, options = {}) {
  if (!canAccessForumCategory(categoryId, options.userId)) {
    return [];
  }
  const cap = Math.min(Math.max(Number(limit) || 30, 1), 50);
  const skip = Math.max(Number(offset) || 0, 0);
  const redis = getRedisClient();

  if (redis) {
    const rawIds = await redis.zrange(categoryThreadsKey(categoryId), skip, skip + cap - 1, {
      rev: true,
    });
    const ids = parseZrangeMembers(rawIds);
    if (ids.length === 0) return [];

    const threads = await Promise.all(ids.map((threadId) => getThreadById(threadId)));
    return threads.filter(Boolean);
  }

  const rows = memoryStore.categoryThreads[categoryId] || [];
  return rows.slice(skip, skip + cap);
}

export async function getThreadWithPosts(threadId, voterId = "", options = {}) {
  const thread = await getThreadById(threadId);
  if (!thread) return null;
  if (!canAccessForumCategory(thread.categoryId, options.userId)) {
    return null;
  }

  const posts = await getPostsForThread(threadId, voterId);
  return { thread, posts };
}

export async function createThread({
  voterId,
  categoryId,
  title,
  body,
  authorUserId = null,
  authorName = "",
}) {
  const cleanTitle = sanitizeTitle(title);
  const cleanBody = sanitizeBody(body);
  const resolvedCategoryId = normalizeCategoryId(categoryId);

  if (!resolvedCategoryId || !isValidCategoryId(resolvedCategoryId)) {
    return { ok: false, error: "invalid-category" };
  }
  if (!canAccessForumCategory(resolvedCategoryId, authorUserId)) {
    return { ok: false, error: "forbidden" };
  }
  if (!cleanTitle) return { ok: false, error: "empty-title" };
  if (!cleanBody) return { ok: false, error: "empty-body" };

  const uid = Number(authorUserId);
  if (!Number.isFinite(uid) || uid <= 0) {
    return { ok: false, error: "not-logged-in" };
  }

  const now = Date.now();
  const threadId = await nextForumId();
  const postId = await nextForumId();
  const displayName =
    sanitizeAuthorName(authorName) ||
    (authorUserId ? `User ${authorUserId}` : "Guest");

  const thread = {
    id: threadId,
    categoryId: resolvedCategoryId,
    title: cleanTitle,
    authorVoterId: voterId,
    authorUserId: authorUserId ? Number(authorUserId) : null,
    authorName: displayName,
    createdAt: now,
    replyCount: 0,
    lastReplyAt: now,
  };

  const post = {
    id: postId,
    threadId,
    parentPostId: null,
    isOp: true,
    authorVoterId: voterId,
    authorUserId: authorUserId ? Number(authorUserId) : null,
    authorName: displayName,
    body: cleanBody,
    createdAt: now,
  };

  await saveThread(thread);
  await savePost(post);

  return { ok: true, thread, post: await enrichPost(post, voterId) };
}

export async function createReply({
  voterId,
  threadId,
  body,
  parentPostId = null,
  authorUserId = null,
  authorName = "",
}) {
  const cleanBody = sanitizeBody(body);
  if (!cleanBody) return { ok: false, error: "empty-body" };

  const uid = Number(authorUserId);
  if (!Number.isFinite(uid) || uid <= 0) {
    return { ok: false, error: "not-logged-in" };
  }

  const thread = await getThreadById(threadId);
  if (!thread) return { ok: false, error: "thread-not-found" };
  if (!canAccessForumCategory(thread.categoryId, authorUserId)) {
    return { ok: false, error: "forbidden" };
  }

  const posts = await getPostsForThread(threadId, voterId);
  const opPost = posts.find((row) => row.isOp) || posts[0];
  if (!opPost) return { ok: false, error: "thread-not-found" };

  let parentId = parentPostId ? String(parentPostId).trim() : String(opPost.id);
  const parentPost = posts.find((row) => String(row.id) === parentId);
  if (!parentPost) return { ok: false, error: "invalid-parent" };

  const now = Date.now();
  const postId = await nextForumId();
  const displayName =
    sanitizeAuthorName(authorName) ||
    (authorUserId ? `User ${authorUserId}` : "Guest");

  const post = {
    id: postId,
    threadId: String(threadId),
    parentPostId: String(parentPost.id),
    isOp: false,
    authorVoterId: voterId,
    authorUserId: authorUserId ? Number(authorUserId) : null,
    authorName: displayName,
    body: cleanBody,
    createdAt: now,
  };

  await savePost(post);

  const updatedThread = {
    ...thread,
    replyCount: (Number(thread.replyCount) || 0) + 1,
    lastReplyAt: now,
  };
  await saveThread(updatedThread);

  return {
    ok: true,
    post: await enrichPost(post, voterId),
    thread: updatedThread,
  };
}

export async function togglePostLike({ voterId, threadId, postId }) {
  const post = await getPostById(postId);
  if (!post || String(post.threadId) !== String(threadId)) {
    return { ok: false, error: "post-not-found" };
  }
  if (post.isOp) return { ok: false, error: "cannot-like-op" };

  const liked = await getPostLikedByVoter(postId, voterId);
  const count = await getPostLikeCount(postId);

  if (liked) {
    await setPostLikeCount(postId, count - 1);
    await setPostLikedByVoter(postId, voterId, false);
    return { ok: true, likeCount: Math.max(0, count - 1), myLike: false };
  }

  await setPostLikeCount(postId, count + 1);
  await setPostLikedByVoter(postId, voterId, true);
  return { ok: true, likeCount: count + 1, myLike: true };
}

export async function purgeForum() {
  const redis = getRedisClient();

  if (redis) {
    let cursor = 0;
    let total = 0;
    do {
      const [nextCursor, keys] = await redis.scan(cursor, { match: "forum:*", count: 100 });
      cursor = Number(nextCursor) || 0;
      if (Array.isArray(keys) && keys.length > 0) {
        await redis.del(...keys);
        total += keys.length;
      }
    } while (cursor !== 0);
    await redis.set("forum:nextId", "1");
    return { ok: true, cleared: total };
  }

  globalThis.__vortex07ForumStore = {
    threads: {},
    posts: {},
    categoryThreads: {},
    threadPosts: {},
    postLikes: {},
    voterLikes: {},
    nextId: 1,
  };
  return { ok: true, cleared: 0, memory: true };
}
