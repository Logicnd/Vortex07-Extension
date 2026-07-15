import { getRedisClient } from "./reputation-store.js";

const memoryBuckets = new Map();

export function getClientIp(req) {
  const forwarded = String(req.headers?.["x-forwarded-for"] || "")
    .split(",")[0]
    .trim();
  if (forwarded) return forwarded.slice(0, 64);

  const realIp = String(req.headers?.["x-real-ip"] || "").trim();
  if (realIp) return realIp.slice(0, 64);

  return "unknown";
}

async function consumeToken(bucketKey, limit, windowSec) {
  const redis = getRedisClient();
  if (redis) {
    const count = await redis.incr(bucketKey);
    if (count === 1) {
      await redis.expire(bucketKey, windowSec);
    }
    return count;
  }

  const now = Date.now();
  const windowMs = windowSec * 1000;
  let bucket = memoryBuckets.get(bucketKey);
  if (!bucket || now - bucket.startedAt >= windowMs) {
    bucket = { startedAt: now, count: 0 };
    memoryBuckets.set(bucketKey, bucket);
  }
  bucket.count += 1;
  return bucket.count;
}

async function runChecks(res, checks, windowSec) {
  for (const check of checks) {
    const count = await consumeToken(check.key, check.limit, check.windowSec || windowSec);
    if (count > check.limit) {
      res.setHeader("Retry-After", String(check.windowSec || windowSec));
      res.status(429).json({
        error: "Too many requests",
        retryAfter: check.windowSec || windowSec,
      });
      return false;
    }
  }
  return true;
}

export async function enforceRateLimit(req, res, config) {
  const {
    route,
    limit,
    windowSec = 60,
    voterId = "",
    ipLimit = limit,
    voterLimit = 0,
  } = config;

  const ip = getClientIp(req);
  const windowSlot = Math.floor(Date.now() / (windowSec * 1000));
  const checks = [
    {
      key: `ratelimit:${route}:ip:${ip}:${windowSlot}`,
      limit: ipLimit,
    },
  ];

  if (voterId && voterLimit > 0) {
    checks.push({
      key: `ratelimit:${route}:voter:${voterId}:${windowSlot}`,
      limit: voterLimit,
    });
  }

  return runChecks(res, checks, windowSec);
}

export async function enforceVoteRateLimits(req, res, actorUserId) {
  const ip = getClientIp(req);
  const minuteSlot = Math.floor(Date.now() / 60000);
  const daySlot = new Date().toISOString().slice(0, 10);
  const actor = String(actorUserId || "unknown");

  return runChecks(
    res,
    [
      {
        key: `ratelimit:reputation-vote:ip:${ip}:${minuteSlot}`,
        limit: 10,
        windowSec: 60,
      },
      {
        key: `ratelimit:reputation-vote:actor:${actor}:${minuteSlot}`,
        limit: 5,
        windowSec: 60,
      },
      {
        key: `ratelimit:reputation-vote:actor-daily:${actor}:${daySlot}`,
        limit: 50,
        windowSec: 86400,
      },
    ],
    60,
  );
}
