import { getRedisClient } from "./reputation-store.js";

export const STATUS_MAX_LEN = 80;

const memoryStore = globalThis.__vortex07FeatureStore || {
  statuses: {},
  viewCounts: {},
  viewDedup: {},
  guestbooks: {},
  gameComments: {},
  activityFeed: [],
};
globalThis.__vortex07FeatureStore = memoryStore;

function dayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function sanitizeStatus(text) {
  return String(text || "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, STATUS_MAX_LEN);
}

export async function getStatus(userId) {
  const redis = getRedisClient();
  if (redis) {
    const value = await redis.get(`status:${userId}`);
    return sanitizeStatus(value || "");
  }
  return sanitizeStatus(memoryStore.statuses[userId] || "");
}

export async function setStatus(userId, text) {
  const clean = sanitizeStatus(text);
  const redis = getRedisClient();

  if (redis) {
    if (!clean) {
      await redis.del(`status:${userId}`);
      return "";
    }
    await redis.set(`status:${userId}`, clean);
    return clean;
  }

  if (!clean) {
    delete memoryStore.statuses[userId];
    return "";
  }
  memoryStore.statuses[userId] = clean;
  return clean;
}

export async function getBatchStatuses(ids) {
  const map = new Map();
  await Promise.all(
    ids.map(async (id) => {
      map.set(Number(id), await getStatus(id));
    }),
  );
  return map;
}

export async function incrementProfileView(profileUserId, viewerId) {
  const profileId = String(profileUserId);
  const viewer = String(viewerId);
  const dedupeKey = `views:dedup:${profileId}:${viewer}:${dayKey()}`;
  const redis = getRedisClient();

  if (redis) {
    const seen = await redis.get(dedupeKey);
    if (seen) {
      const count = Number(await redis.get(`views:count:${profileId}`)) || 0;
      return { added: false, count };
    }

    await redis.set(dedupeKey, "1", { ex: 86400 });
    const count = Number(await redis.incr(`views:count:${profileId}`)) || 0;
    return { added: true, count };
  }

  if (memoryStore.viewDedup[dedupeKey]) {
    return {
      added: false,
      count: Number(memoryStore.viewCounts[profileId]) || 0,
    };
  }

  memoryStore.viewDedup[dedupeKey] = true;
  memoryStore.viewCounts[profileId] =
    (Number(memoryStore.viewCounts[profileId]) || 0) + 1;
  return { added: true, count: memoryStore.viewCounts[profileId] };
}

export async function getProfileViewCount(userId) {
  const redis = getRedisClient();
  if (redis) {
    return Number(await redis.get(`views:count:${userId}`)) || 0;
  }
  return Number(memoryStore.viewCounts[String(userId)]) || 0;
}

export const GUESTBOOK_MAX_LEN = 120;
export const GUESTBOOK_LIST_MAX = 50;
export const ACTIVITY_FEED_MAX = 80;
const ACTIVITY_FEED_KEY = "vortex07:activity:feed";

function sanitizeGuestbookMessage(text) {
  return String(text || "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, GUESTBOOK_MAX_LEN);
}

function sanitizeGuestbookAuthor(name) {
  return String(name || "")
    .replace(/[\r\n\t<>]+/g, " ")
    .trim()
    .slice(0, 40);
}

function guestbookListKey(profileUserId) {
  return `guestbook:list:${profileUserId}`;
}

function guestbookDedupKey(profileUserId, authorId) {
  return `guestbook:dedup:${profileUserId}:${authorId}:${dayKey()}`;
}

export async function canPostGuestbookToday(profileUserId, authorId) {
  const dedupeKey = guestbookDedupKey(profileUserId, authorId);
  const redis = getRedisClient();

  if (redis) {
    const seen = await redis.get(dedupeKey);
    return !seen;
  }

  return !memoryStore.viewDedup[dedupeKey];
}

export async function addGuestbookEntry(
  profileUserId,
  authorId,
  message,
  authorName = "",
) {
  const profileId = String(profileUserId);
  const author = String(authorId);
  const clean = sanitizeGuestbookMessage(message);
  if (!clean) {
    return { ok: false, error: "empty-message" };
  }

  const canPost = await canPostGuestbookToday(profileId, author);
  if (!canPost) {
    return { ok: false, error: "already-posted-today" };
  }

  const entry = {
    id: `${Date.now()}-${author}`,
    profileUserId: Number(profileId),
    authorId: Number(author),
    authorName: sanitizeGuestbookAuthor(authorName) || `User ${author}`,
    message: clean,
    createdAt: Date.now(),
  };

  const dedupeKey = guestbookDedupKey(profileId, author);
  const listKey = guestbookListKey(profileId);
  const payload = JSON.stringify(entry);
  const redis = getRedisClient();

  if (redis) {
    await redis.set(dedupeKey, "1", { ex: 86400 });
    await redis.lpush(listKey, payload);
    await redis.ltrim(listKey, 0, GUESTBOOK_LIST_MAX - 1);
    return { ok: true, entry };
  }

  memoryStore.viewDedup[dedupeKey] = true;
  if (!memoryStore.guestbooks) memoryStore.guestbooks = {};
  if (!Array.isArray(memoryStore.guestbooks[listKey])) {
    memoryStore.guestbooks[listKey] = [];
  }
  memoryStore.guestbooks[listKey].unshift(entry);
  memoryStore.guestbooks[listKey] = memoryStore.guestbooks[listKey].slice(
    0,
    GUESTBOOK_LIST_MAX,
  );
  return { ok: true, entry };
}

export async function getGuestbookEntries(profileUserId, limit = 20) {
  const cap = Math.min(Math.max(Number(limit) || 20, 1), GUESTBOOK_LIST_MAX);
  const listKey = guestbookListKey(profileUserId);
  const redis = getRedisClient();

  if (redis) {
    const raw = await redis.lrange(listKey, 0, cap - 1);
    return parseRedisListRows(raw);
  }

  const list = memoryStore.guestbooks?.[listKey] || [];
  return list.slice(0, cap);
}

export const GAME_COMMENT_MAX_LEN = 200;
export const GAME_COMMENT_LIST_MAX = 100;

function sanitizeGameComment(text) {
  return String(text || "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, GAME_COMMENT_MAX_LEN);
}

function sanitizeGameCommentAuthor(name) {
  return String(name || "")
    .replace(/[\r\n\t<>]+/g, " ")
    .trim()
    .slice(0, 40);
}

function gameCommentListKey(gameId) {
  return `gamecomments:list:${gameId}`;
}

/** Upstash may return list rows as objects (auto-deserialized) or JSON strings. */
function parseRedisListRow(row) {
  if (row == null) return null;
  if (typeof row === "object") return row;
  if (typeof row !== "string") return null;

  try {
    const parsed = JSON.parse(row);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function parseRedisListRows(raw) {
  return (raw || []).map(parseRedisListRow).filter(Boolean);
}

export async function addGameComment(gameId, authorId, message, authorName = "") {
  const game = String(gameId);
  const author = String(authorId);
  const clean = sanitizeGameComment(message);
  if (!clean) {
    return { ok: false, error: "empty-message" };
  }

  const entry = {
    id: `${Date.now()}-${author}`,
    gameId: Number(game),
    authorId: Number(author),
    authorName: sanitizeGameCommentAuthor(authorName) || `User ${author}`,
    message: clean,
    createdAt: Date.now(),
  };

  const listKey = gameCommentListKey(game);
  const payload = JSON.stringify(entry);
  const redis = getRedisClient();

  if (redis) {
    await redis.lpush(listKey, payload);
    await redis.ltrim(listKey, 0, GAME_COMMENT_LIST_MAX - 1);
    return { ok: true, entry };
  }

  if (!memoryStore.gameComments) memoryStore.gameComments = {};
  if (!Array.isArray(memoryStore.gameComments[listKey])) {
    memoryStore.gameComments[listKey] = [];
  }
  memoryStore.gameComments[listKey].unshift(entry);
  memoryStore.gameComments[listKey] = memoryStore.gameComments[listKey].slice(
    0,
    GAME_COMMENT_LIST_MAX,
  );
  return { ok: true, entry };
}

export async function getGameComments(gameId, limit = 30) {
  const cap = Math.min(Math.max(Number(limit) || 30, 1), GAME_COMMENT_LIST_MAX);
  const listKey = gameCommentListKey(gameId);
  const redis = getRedisClient();

  if (redis) {
    const raw = await redis.lrange(listKey, 0, cap - 1);
    return parseRedisListRows(raw);
  }

  const list = memoryStore.gameComments?.[listKey] || [];
  return list.slice(0, cap);
}

export async function pushRepActivity(userId, delta = 1) {
  const numericId = Number(userId);
  const numericDelta = Number(delta) || 0;
  if (!Number.isFinite(numericId) || numericDelta === 0) return;

  const event = {
    type: "rep",
    userId: numericId,
    delta: numericDelta,
    at: Date.now(),
  };
  const payload = JSON.stringify(event);
  const redis = getRedisClient();

  if (redis) {
    await redis.lpush(ACTIVITY_FEED_KEY, payload);
    await redis.ltrim(ACTIVITY_FEED_KEY, 0, ACTIVITY_FEED_MAX - 1);
    return;
  }

  if (!memoryStore.activityFeed) memoryStore.activityFeed = [];
  memoryStore.activityFeed.unshift(event);
  memoryStore.activityFeed = memoryStore.activityFeed.slice(0, ACTIVITY_FEED_MAX);
}

export async function getActivityFeed(limit = 15) {
  const cap = Math.min(Math.max(Number(limit) || 15, 1), ACTIVITY_FEED_MAX);
  const redis = getRedisClient();

  if (redis) {
    const raw = await redis.lrange(ACTIVITY_FEED_KEY, 0, cap - 1);
    return parseRedisListRows(raw);
  }

  return (memoryStore.activityFeed || []).slice(0, cap);
}
