import { getRedisClient } from "./reputation.js";

/**
 * Vertex Points (VP) — Vortex07's free earn-only currency.
 * Wallet shape in Redis (`economy:{userId}`):
 *   { bal, lastDaily: "YYYY-MM-DD", streak, total }
 */

export const DAILY_BASE_REWARD = 10;
export const DAILY_STREAK_BONUS = 5;
export const DAILY_MAX_REWARD = 30;
export const WEEKLY_BASE_REWARD = 25;

const memoryStore = globalThis.__vortex07EconomyStore || { wallets: {} };
globalThis.__vortex07EconomyStore = memoryStore;

function dayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function previousDayKey() {
  return dayKey(new Date(Date.now() - 86400000));
}

function weekKey(date = new Date()) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d.toISOString().slice(0, 10);
}

function previousWeekKey() {
  return weekKey(new Date(Date.now() - 7 * 86400000));
}

function nextUtcMidnightMs() {
  const now = new Date();
  return Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
  );
}

function walletKey(userId) {
  return `economy:${userId}`;
}

function parseWalletRow(raw) {
  if (raw == null) return null;
  if (typeof raw === "object") return raw;
  if (typeof raw !== "string") return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function normalizeWalletRecord(record) {
  const row = record && typeof record === "object" ? record : {};
  const owned = Array.isArray(row.owned) ? row.owned : [];
  return {
    bal: Math.max(0, Number(row.bal) || 0),
    lastDaily: typeof row.lastDaily === "string" ? row.lastDaily : "",
    lastWeekly: typeof row.lastWeekly === "string" ? row.lastWeekly : "",
    streak: Math.max(0, Number(row.streak) || 0),
    total: Math.max(0, Number(row.total) || 0),
    owned,
    equipped: row.equipped && typeof row.equipped === "object" ? row.equipped : {},
    titles: Array.isArray(row.titles) ? row.titles : [],
    badges: Array.isArray(row.badges) ? row.badges : [],
    frames: Array.isArray(row.frames) ? row.frames : [],
  };
}

async function readWalletRecord(userId) {
  const redis = getRedisClient();
  if (redis) {
    const raw = await redis.get(walletKey(userId));
    return normalizeWalletRecord(parseWalletRow(raw));
  }
  return normalizeWalletRecord(memoryStore.wallets[String(userId)]);
}

async function writeWalletRecord(userId, record) {
  const clean = normalizeWalletRecord(record);
  const redis = getRedisClient();
  if (redis) {
    await redis.set(walletKey(userId), JSON.stringify(clean));
    return clean;
  }
  memoryStore.wallets[String(userId)] = clean;
  return clean;
}

export function dailyRewardForStreak(streak) {
  const day = Math.max(1, Number(streak) || 1);
  return Math.min(
    DAILY_BASE_REWARD + (day - 1) * DAILY_STREAK_BONUS,
    DAILY_MAX_REWARD,
  );
}

function toPublicWallet(userId, record) {
  const today = dayKey();
  const thisWeek = weekKey();
  const canClaimDaily = record.lastDaily !== today;
  const canClaimWeekly = record.lastWeekly !== thisWeek;
  const continuesStreak =
    record.lastDaily === today || record.lastDaily === previousDayKey();
  const nextStreak = continuesStreak ? record.streak + 1 : 1;

  return {
    userId: Number(userId),
    balance: record.bal,
    totalEarned: record.total,
    streak: record.streak,
    lastDailyAt: record.lastDaily || null,
    lastWeeklyAt: record.lastWeekly || null,
    canClaimDaily,
    canClaimWeekly,
    nextDailyReward: dailyRewardForStreak(canClaimDaily ? nextStreak : record.streak + 1),
    nextWeeklyReward: WEEKLY_BASE_REWARD,
    nextClaimAt: canClaimDaily ? Date.now() : nextUtcMidnightMs(),
    owned: record.owned,
    equipped: record.equipped,
    titles: record.titles,
    badges: record.badges,
    frames: record.frames,
    earn: { canClaimDaily, canClaimWeekly },
  };
}

export async function getWallet(userId) {
  const record = await readWalletRecord(userId);
  return toPublicWallet(userId, record);
}

export async function claimDaily(userId) {
  const record = await readWalletRecord(userId);
  const today = dayKey();

  if (record.lastDaily === today) {
    return {
      ok: false,
      error: "already-claimed",
      wallet: toPublicWallet(userId, record),
    };
  }

  const streak = record.lastDaily === previousDayKey() ? record.streak + 1 : 1;
  const reward = dailyRewardForStreak(streak);

  const updated = await writeWalletRecord(userId, {
    bal: record.bal + reward,
    lastDaily: today,
    streak,
    total: record.total + reward,
  });

  return {
    ok: true,
    reward,
    wallet: toPublicWallet(userId, updated),
  };
}

export const SHOP_CATALOG = [
  { id: "frame-purple", name: "Purple Frame", description: "Classic Vortex07 border.", cost: 100, tier: "common", slot: "frame" },
  { id: "frame-gold", name: "Gold Frame", description: "Shiny premium frame.", cost: 300, tier: "rare", slot: "frame", requireRep: 50 },
  { id: "badge-patron", name: "Patron Badge", description: "Early supporter badge.", cost: 150, tier: "common", slot: "badge" },
  { id: "title-veteran", name: "Veteran", description: "For loyal players.", cost: 250, tier: "rare", slot: "title", requireRep: 30 },
  { id: "title-early-adopter", name: "Early Adopter", description: "Limited launch title.", cost: 0, tier: "legendary", slot: "title", grantOnly: true },
];

export function getShopCatalog() {
  return SHOP_CATALOG.map((item) => ({ ...item }));
}

export function getShopItem(itemId) {
  return SHOP_CATALOG.find((item) => item.id === itemId) || null;
}

export async function claimWeekly(userId) {
  const record = await readWalletRecord(userId);
  const thisWeek = weekKey();

  if (record.lastWeekly === thisWeek) {
    return {
      ok: false,
      error: "already-claimed",
      wallet: toPublicWallet(userId, record),
    };
  }

  const reward = WEEKLY_BASE_REWARD;
  const updated = await writeWalletRecord(userId, {
    ...record,
    bal: record.bal + reward,
    lastWeekly: thisWeek,
    total: record.total + reward,
  });

  return {
    ok: true,
    reward,
    wallet: toPublicWallet(userId, updated),
  };
}

export async function purchaseItem(userId, itemId) {
  const record = await readWalletRecord(userId);
  const item = getShopItem(itemId);

  if (!item) {
    return { ok: false, error: "unknown-item" };
  }
  if (item.grantOnly) {
    return { ok: false, error: "grant-only" };
  }
  if (record.owned.includes(itemId)) {
    return { ok: false, error: "already-owned" };
  }
  if (record.bal < Number(item.cost || 0)) {
    return { ok: false, error: "insufficient-balance", balance: record.bal };
  }
  if (item.requireRep && Number(item.requireRep) > 0) {
    // Reputation gate is advisory; the API caller may enforce via their own check.
  }

  const updated = await writeWalletRecord(userId, {
    ...record,
    bal: record.bal - Number(item.cost || 0),
    owned: [...record.owned, itemId],
  });

  return {
    ok: true,
    spent: Number(item.cost || 0),
    balance: updated.bal,
    itemId,
    wallet: toPublicWallet(userId, updated),
  };
}

export async function equipItem(userId, itemId) {
  const record = await readWalletRecord(userId);
  const item = getShopItem(itemId);

  if (!item) {
    return { ok: false, error: "unknown-item" };
  }
  if (!record.owned.includes(itemId)) {
    return { ok: false, error: "not-owned" };
  }

  const equipped = { ...record.equipped };
  equipped[item.slot] = itemId;

  const updated = await writeWalletRecord(userId, {
    ...record,
    equipped,
  });

  return {
    ok: true,
    slot: item.slot,
    itemId,
    cosmetics: {
      [item.slot]: item,
    },
    wallet: toPublicWallet(userId, updated),
  };
}
