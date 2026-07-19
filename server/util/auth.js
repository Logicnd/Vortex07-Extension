import { createHmac, timingSafeEqual } from "node:crypto";

const SIGNATURE_MAX_SKEW_MS = 60_000;

export function actorStorageKey(actorUserId) {
  const id = String(actorUserId || "").trim();
  if (!/^\d+$/.test(id)) return "";
  return `pv:${id}`;
}

export function parseActorUserId(raw) {
  const value = String(raw || "").trim();
  if (!/^\d+$/.test(value)) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return String(numeric);
}

export function buildVoteSignaturePayload(actorUserId, targetUserId, timestamp) {
  return `${actorUserId}|${targetUserId}|${timestamp}`;
}

export function verifyVoteSignature(req, actorUserId, targetUserId) {
  const secret = String(process.env.VORTEX07_VOTE_SECRET || "").trim();
  if (!secret) {
    return { ok: false, error: "Vote signing not configured" };
  }

  const timestamp = String(
    req.headers?.["x-vortex07-timestamp"] ||
      req.headers?.["X-Vortex07-Timestamp"] ||
      "",
  ).trim();
  const signature = String(
    req.headers?.["x-vortex07-signature"] ||
      req.headers?.["X-Vortex07-Signature"] ||
      "",
  ).trim();

  if (!/^\d+$/.test(timestamp) || !/^[a-f0-9]{64}$/i.test(signature)) {
    return { ok: false, error: "Invalid signature headers" };
  }

  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > SIGNATURE_MAX_SKEW_MS) {
    return { ok: false, error: "Signature expired" };
  }

  const payload = buildVoteSignaturePayload(actorUserId, targetUserId, timestamp);
  const expected = createHmac("sha256", secret).update(payload).digest("hex");

  try {
    const a = Buffer.from(signature, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false, error: "Invalid signature" };
    }
  } catch {
    return { ok: false, error: "Invalid signature" };
  }

  return { ok: true };
}

export function verifyAdminSecret(req) {
  const expected = String(process.env.VORTEX07_ADMIN_SECRET || "").trim();
  if (!expected) return false;

  const provided = String(
    req.headers?.["x-vortex07-admin"] ||
      req.headers?.["X-Vortex07-Admin"] ||
      "",
  ).trim();

  if (!provided) return false;

  try {
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export const ADMIN_ACTOR_IDS = new Set(["15936", "18202"]);
