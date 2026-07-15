import { pushRepActivity } from "./feature-store.js";
import { pushRepAuditEntry } from "./rep-audit.js";
import { getClientIp } from "./rate-limit.js";

export const LEADERBOARD_KEY = "vortex07:leaderboard";
export const PLAYER_NAMES_KEY = "vortex07:player-names";

let Redis = null;
try {
  const redisModule = await import("@upstash/redis");
  Redis = redisModule.Redis || null;
} catch {
  Redis = null;
}

const memoryStore = globalThis.__vortex07RepStore || {
  counts: {},
  voters: {},
  leaderboard: {},
  playerNames: {},
};
globalThis.__vortex07RepStore = memoryStore;

function resolveRedisCredentials() {
  const pairs = [
    [
      process.env.UPSTASH_REDIS_REST_URL,
      process.env.UPSTASH_REDIS_REST_TOKEN,
    ],
    [process.env.KV_REST_API_URL, process.env.KV_REST_API_TOKEN],
    [process.env.STORAGE_URL, process.env.STORAGE_TOKEN],
    [process.env.STORAGE_REST_API_URL, process.env.STORAGE_REST_API_TOKEN],
  ];

  for (const [url, token] of pairs) {
    if (url && token) return { url, token };
  }

  return null;
}

let redisClient = null;

function getRedis() {
  if (redisClient) return redisClient;

  const creds = resolveRedisCredentials();
  if (!creds) return null;

  redisClient = new Redis({
    url: creds.url,
    token: creds.token,
  });

  return redisClient;
}

export function getRedisClient() {
  return getRedis();
}

export function hasPersistentStore() {
  return Boolean(getRedis());
}

function parseZrangeResults(raw) {
  if (!Array.isArray(raw) || raw.length === 0) return [];

  if (typeof raw[0] === "object" && raw[0] !== null) {
    return raw
      .map((entry) => ({
        userId: Number(entry.member ?? entry.value ?? entry.id),
        count: Number(entry.score ?? entry.count) || 0,
      }))
      .filter((row) => Number.isFinite(row.userId));
  }

  const results = [];
  for (let i = 0; i < raw.length; i += 2) {
    const userId = Number(raw[i]);
    const count = Number(raw[i + 1]) || 0;
    if (!Number.isFinite(userId)) continue;
    results.push({ userId, count });
  }
  return results;
}

function sanitizePlayerName(name) {
  const clean = String(name || "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 32);

  if (!clean) return "";
  if (/^user\d+$/i.test(clean)) return "";
  if (clean.toLowerCase() === "client") return "";
  return clean;
}

export async function setPlayerName(userId, username) {
  const clean = sanitizePlayerName(username);
  if (!clean) return "";

  const redis = getRedis();
  if (redis) {
    await redis.hset(PLAYER_NAMES_KEY, String(userId), clean);
    return clean;
  }

  if (!memoryStore.playerNames) memoryStore.playerNames = {};
  memoryStore.playerNames[userId] = clean;
  return clean;
}

export async function getPlayerName(userId) {
  const redis = getRedis();
  if (redis) {
    const value = await redis.hget(PLAYER_NAMES_KEY, String(userId));
    return sanitizePlayerName(value || "");
  }

  return sanitizePlayerName(memoryStore.playerNames?.[userId] || "");
}

async function attachLeaderboardNames(results) {
  return Promise.all(
    results.map(async (row) => ({
      ...row,
      username: (await getPlayerName(row.userId)) || null,
    })),
  );
}

async function syncLeaderboardScore(userId, count) {
  const numericCount = Math.max(0, Number(count) || 0);
  const redis = getRedis();

  if (redis) {
    if (numericCount <= 0) {
      await redis.zrem(LEADERBOARD_KEY, String(userId));
      return;
    }
    await redis.zadd(LEADERBOARD_KEY, {
      score: numericCount,
      member: String(userId),
    });
    return;
  }

  if (!memoryStore.leaderboard) memoryStore.leaderboard = {};
  if (numericCount <= 0) {
    delete memoryStore.leaderboard[userId];
    return;
  }
  memoryStore.leaderboard[userId] = numericCount;
}

/**
 * Count = number of unique likers. It is the size of the voter set and can
 * never be negative. Each user contributes exactly 0 (not liked) or 1 (liked).
 */
export async function getCount(userId) {
  const redis = getRedis();
  if (redis) {
    const voters = Number(await redis.scard(`rep:voters:${userId}`)) || 0;
    if (voters > 0) return voters;
    const legacy = Number(await redis.get(`rep:count:${userId}`)) || 0;
    return Math.max(0, legacy);
  }
  const voters = memoryStore.voters[userId];
  if (Array.isArray(voters) && voters.length) return voters.length;
  return Math.max(0, Number(memoryStore.counts[userId]) || 0);
}

export async function hasVoted(userId, voterKey) {
  const redis = getRedis();
  if (redis) {
    const voted = await redis.sismember(`rep:voters:${userId}`, voterKey);
    return Boolean(voted);
  }
  const voters = memoryStore.voters[userId] || [];
  return voters.includes(voterKey);
}

export async function getReputation(userId, voterKey = "") {
  const count = await getCount(userId);
  const voted = voterKey ? await hasVoted(userId, voterKey) : false;
  return {
    userId: Number(userId),
    count,
    myVote: voted ? "up" : null,
    hasVoted: voted,
  };
}

/**
 * Set like state explicitly. requestedVote:
 *  - "add"    -> like (no-op if already liked)
 *  - "remove" -> unlike (no-op if not liked)
 *  - "up"     -> toggle
 *  - null     -> unlike
 */
export async function setReputationVote(userId, voterKey, requestedVote, auditContext = {}) {
  const alreadyLiked = await hasVoted(userId, voterKey);
  const action = String(requestedVote || "").trim();

  let targetLiked;
  if (action === "add") {
    targetLiked = true;
  } else if (action === "remove" || action === "" || requestedVote === null) {
    targetLiked = false;
  } else if (action === "up") {
    targetLiked = !alreadyLiked;
  } else {
    targetLiked = !alreadyLiked;
  }

  if (targetLiked === alreadyLiked) {
    return getReputation(userId, voterKey);
  }

  return targetLiked
    ? like(userId, voterKey, auditContext)
    : unlike(userId, voterKey, auditContext);
}

async function like(userId, voterKey, auditContext) {
  if (auditContext.targetUsername) {
    await setPlayerName(userId, auditContext.targetUsername);
  }

  const redis = getRedis();
  if (redis) {
    const added = await redis.sadd(`rep:voters:${userId}`, voterKey);
    const count = Number(await redis.scard(`rep:voters:${userId}`)) || 0;
    await redis.set(`rep:count:${userId}`, count);
    await syncLeaderboardScore(userId, count);
    if (added) {
      await pushRepActivity(userId, 1);
      await pushRepAuditEntry({
        actorUserId: auditContext.actorUserId,
        targetUserId: userId,
        delta: 1,
        ip: auditContext.ip,
      });
    }
    return { userId: Number(userId), count, myVote: "up", hasVoted: true };
  }

  if (!memoryStore.voters[userId]) memoryStore.voters[userId] = [];
  const isNew = !memoryStore.voters[userId].includes(voterKey);
  if (isNew) memoryStore.voters[userId].push(voterKey);
  const count = memoryStore.voters[userId].length;
  memoryStore.counts[userId] = count;
  await syncLeaderboardScore(userId, count);
  if (isNew) {
    await pushRepActivity(userId, 1);
    await pushRepAuditEntry({
      actorUserId: auditContext.actorUserId,
      targetUserId: userId,
      delta: 1,
      ip: auditContext.ip,
    });
  }
  return { userId: Number(userId), count, myVote: "up", hasVoted: true };
}

async function unlike(userId, voterKey, auditContext) {
  const redis = getRedis();
  if (redis) {
    const removed = await redis.srem(`rep:voters:${userId}`, voterKey);
    const count = Number(await redis.scard(`rep:voters:${userId}`)) || 0;
    if (count <= 0) {
      await redis.del(`rep:count:${userId}`);
    } else {
      await redis.set(`rep:count:${userId}`, count);
    }
    await syncLeaderboardScore(userId, count);
    if (removed) {
      await pushRepAuditEntry({
        actorUserId: auditContext.actorUserId,
        targetUserId: userId,
        delta: -1,
        ip: auditContext.ip,
      });
    }
    return { userId: Number(userId), count, myVote: null, hasVoted: false };
  }

  const voters = memoryStore.voters[userId] || [];
  const had = voters.includes(voterKey);
  memoryStore.voters[userId] = voters.filter((id) => id !== voterKey);
  const count = memoryStore.voters[userId].length;
  memoryStore.counts[userId] = count;
  await syncLeaderboardScore(userId, count);
  if (had) {
    await pushRepAuditEntry({
      actorUserId: auditContext.actorUserId,
      targetUserId: userId,
      delta: -1,
      ip: auditContext.ip,
    });
  }
  return { userId: Number(userId), count, myVote: null, hasVoted: false };
}

export async function addVote(userId, voterKey, auditContext = {}) {
  const result = await like(userId, voterKey, auditContext);
  return { added: true, count: result.count };
}

export async function removeVote(userId, voterKey, auditContext = {}) {
  const result = await unlike(userId, voterKey, auditContext);
  return { removed: true, count: result.count };
}

export async function purgeUserReputation(userId, auditContext = {}) {
  const id = String(userId || "").trim();
  if (!/^\d+$/.test(id)) {
    return { ok: false, error: "Invalid userId" };
  }

  const previousCount = await getCount(id);
  const redis = getRedis();

  if (redis) {
    await redis.del(`rep:count:${id}`);
    await redis.del(`rep:voters:${id}`);
  } else {
    delete memoryStore.counts[id];
    delete memoryStore.voters[id];
  }

  await syncLeaderboardScore(id, 0);

  if (previousCount > 0) {
    await pushRepAuditEntry({
      actorUserId: auditContext.actorUserId || 0,
      targetUserId: Number(id),
      delta: -previousCount,
      ip: auditContext.ip,
      kind: "admin_purge",
    });
  }

  return {
    ok: true,
    userId: Number(id),
    previousCount,
    purged: previousCount > 0,
  };
}

export async function getBatchReputation(ids, voterKey) {
  const results = await Promise.all(
    ids.map(async (id) => {
      const row = await getReputation(id, voterKey);
      return {
        userId: row.userId,
        count: row.count,
        myVote: row.myVote,
        hasVoted: row.hasVoted,
      };
    }),
  );
  return results;
}

export async function getLeaderboard(limit = 25) {
  const cap = Math.min(Math.max(Number(limit) || 25, 1), 100);
  const redis = getRedis();

  if (redis) {
    const raw = await redis.zrange(LEADERBOARD_KEY, 0, cap - 1, {
      rev: true,
      withScores: true,
    });
    const results = await attachLeaderboardNames(parseZrangeResults(raw));
    return { results, limit: cap };
  }

  const results = Object.entries(memoryStore.leaderboard || {})
    .map(([userId, count]) => ({
      userId: Number(userId),
      count: Number(count) || 0,
    }))
    .filter((row) => Number.isFinite(row.userId))
    .sort((a, b) => b.count - a.count)
    .slice(0, cap);

  return { results: await attachLeaderboardNames(results), limit: cap };
}

export function parseNumericIds(raw) {
  return String(raw || "")
    .split(",")
    .map((part) => part.trim())
    .filter((id) => /^\d+$/.test(id))
    .slice(0, 50);
}

export function isValidVoterId(voterId) {
  return voterId && voterId.length >= 8 && voterId.length <= 80;
}

export function resolveVoterKey({ actorUserId, voterId }) {
  const actorKey = actorStorageKeyFromActor(actorUserId);
  if (actorKey) return actorKey;
  if (isValidVoterId(voterId)) return voterId;
  return "";
}

function actorStorageKeyFromActor(actorUserId) {
  const id = String(actorUserId || "").trim();
  if (!/^\d+$/.test(id)) return "";
  return `pv:${id}`;
}

export { getClientIp };
