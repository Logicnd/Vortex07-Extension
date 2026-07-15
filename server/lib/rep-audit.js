import { createHash } from "node:crypto";
import { getRedisClient } from "./reputation-store.js";
import { getClientIp } from "./rate-limit.js";

export const REP_AUDIT_KEY = "vortex07:rep:audit";
export const REP_AUDIT_MAX = 2000;

const memoryAudit = globalThis.__vortex07RepAudit || [];
globalThis.__vortex07RepAudit = memoryAudit;

function hashIp(ip) {
  return createHash("sha256")
    .update(String(ip || "unknown"))
    .digest("hex")
    .slice(0, 16);
}

export async function pushRepAuditEntry({
  actorUserId,
  targetUserId,
  delta,
  ip = "unknown",
  kind = "vote",
}) {
  const actor = Number(actorUserId);
  const target = Number(targetUserId);
  const numericDelta = Number(delta) || 0;
  if (!Number.isFinite(target) || numericDelta === 0) {
    return;
  }
  if (kind !== "admin_purge" && !Number.isFinite(actor)) {
    return;
  }

  const event = {
    at: Date.now(),
    actorUserId: Number.isFinite(actor) ? actor : 0,
    targetUserId: target,
    delta: numericDelta,
    ipHash: hashIp(ip),
    kind,
  };

  const redis = getRedisClient();
  if (redis) {
    await redis.lpush(REP_AUDIT_KEY, JSON.stringify(event));
    await redis.ltrim(REP_AUDIT_KEY, 0, REP_AUDIT_MAX - 1);
    return;
  }

  memoryAudit.unshift(event);
  if (memoryAudit.length > REP_AUDIT_MAX) {
    memoryAudit.length = REP_AUDIT_MAX;
  }
}

export async function getRepAuditFeed(limit = 100, targetUserId = null) {
  const cap = Math.min(Math.max(Number(limit) || 100, 1), 500);
  const targetFilter =
    targetUserId !== null && targetUserId !== undefined && /^\d+$/.test(String(targetUserId))
      ? Number(targetUserId)
      : null;

  const redis = getRedisClient();
  let events = [];

  if (redis) {
    const raw = await redis.lrange(REP_AUDIT_KEY, 0, REP_AUDIT_MAX - 1);
    events = (raw || [])
      .map((row) => {
        try {
          return JSON.parse(row);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } else {
    events = [...memoryAudit];
  }

  if (targetFilter !== null) {
    events = events.filter((event) => Number(event.targetUserId) === targetFilter);
  }

  return events.slice(0, cap);
}

export function detectRepSpikes(events, windowMs = 10 * 60 * 1000, threshold = 5) {
  const now = Date.now();
  const counts = new Map();

  for (const event of events) {
    const at = Number(event?.at) || 0;
    if (now - at > windowMs) continue;
    if (event?.kind === "admin_purge") continue;
    if (Number(event?.delta) !== 1) continue;

    const target = Number(event?.targetUserId);
    if (!Number.isFinite(target)) continue;
    counts.set(target, (counts.get(target) || 0) + 1);
  }

  return [...counts.entries()]
    .filter(([, count]) => count > threshold)
    .map(([targetUserId, count]) => ({ targetUserId, count, windowMs }))
    .sort((a, b) => b.count - a.count);
}
