import {
  getRedisClient,
  hasPersistentStore,
  isValidVoterId,
} from "./reputation-store.js";

export { hasPersistentStore, isValidVoterId };

const memoryStore = globalThis.__vortex07GameVotesStore || {
  likes: {},
  dislikes: {},
  votes: {},
};
globalThis.__vortex07GameVotesStore = memoryStore;

function likesKey(gameId) {
  return `gamevote:likes:${gameId}`;
}

function dislikesKey(gameId) {
  return `gamevote:dislikes:${gameId}`;
}

function voteKey(gameId, voterId) {
  return `gamevote:vote:${gameId}:${voterId}`;
}

function memoryVoteKey(gameId, voterId) {
  return `${gameId}:${voterId}`;
}

export function isValidGameId(gameId) {
  return /^\d+$/.test(String(gameId || ""));
}

export function calcRatioPercent(likes, dislikes) {
  const total = (Number(likes) || 0) + (Number(dislikes) || 0);
  if (total <= 0) return 0;
  return Math.round(((Number(likes) || 0) / total) * 100);
}

async function getLikes(gameId) {
  const redis = getRedisClient();
  if (redis) {
    return Number(await redis.get(likesKey(gameId))) || 0;
  }
  return Number(memoryStore.likes[gameId]) || 0;
}

async function getDislikes(gameId) {
  const redis = getRedisClient();
  if (redis) {
    return Number(await redis.get(dislikesKey(gameId))) || 0;
  }
  return Number(memoryStore.dislikes[gameId]) || 0;
}

async function getVoterVote(gameId, voterId) {
  const redis = getRedisClient();
  if (redis) {
    const value = await redis.get(voteKey(gameId, voterId));
    return value === "like" || value === "dislike" ? value : null;
  }
  const value = memoryStore.votes[memoryVoteKey(gameId, voterId)];
  return value === "like" || value === "dislike" ? value : null;
}

async function adjustCounter(gameId, type, delta) {
  const numericDelta = Number(delta) || 0;
  if (numericDelta === 0) return;

  const redis = getRedisClient();
  const key = type === "like" ? likesKey(gameId) : dislikesKey(gameId);
  const memField = type === "like" ? "likes" : "dislikes";

  if (redis) {
    if (numericDelta > 0) {
      await redis.incrby(key, numericDelta);
      return;
    }
    const current = Number(await redis.get(key)) || 0;
    const next = Math.max(0, current + numericDelta);
    if (next <= 0) {
      await redis.del(key);
    } else {
      await redis.set(key, next);
    }
    return;
  }

  const current = Number(memoryStore[memField][gameId]) || 0;
  memoryStore[memField][gameId] = Math.max(0, current + numericDelta);
}

async function setVoterVote(gameId, voterId, vote) {
  const redis = getRedisClient();
  const memKey = memoryVoteKey(gameId, voterId);

  if (redis) {
    if (!vote) {
      await redis.del(voteKey(gameId, voterId));
      return;
    }
    await redis.set(voteKey(gameId, voterId), vote);
    return;
  }

  if (!vote) {
    delete memoryStore.votes[memKey];
    return;
  }
  memoryStore.votes[memKey] = vote;
}

export async function getGameVotes(gameId, voterId = "") {
  const likes = await getLikes(gameId);
  const dislikes = await getDislikes(gameId);
  const myVote = voterId ? await getVoterVote(gameId, voterId) : null;

  return {
    gameId: Number(gameId),
    likes,
    dislikes,
    ratioPercent: calcRatioPercent(likes, dislikes),
    myVote,
  };
}

export async function setGameVote(gameId, voterId, requestedVote) {
  const current = await getVoterVote(gameId, voterId);
  let nextVote = requestedVote;

  if (requestedVote !== "like" && requestedVote !== "dislike") {
    nextVote = null;
  } else if (requestedVote === current) {
    nextVote = null;
  }

  if (nextVote === null) {
    if (!current) {
      return getGameVotes(gameId, voterId);
    }
    await adjustCounter(gameId, current, -1);
    await setVoterVote(gameId, voterId, null);
    return getGameVotes(gameId, voterId);
  }

  if (current && current !== nextVote) {
    await adjustCounter(gameId, current, -1);
  }

  if (current !== nextVote) {
    await adjustCounter(gameId, nextVote, 1);
    await setVoterVote(gameId, voterId, nextVote);
  }

  return getGameVotes(gameId, voterId);
}
