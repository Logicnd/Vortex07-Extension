import { applyCors, handleOptions } from "../util/http.js";
import { hasPersistentStore } from "../store/reputation.js";

const API_VERSION = "1.13.0";

const ENDPOINTS = [
  "GET /api/health",
  "GET|POST|DELETE /api/reputation",
  "GET /api/players/batch",
  "GET /api/leaderboard",
  "GET|POST /api/status",
  "GET|POST /api/profile-views",
  "GET|POST /api/guestbook",
  "GET /api/activity",
  "GET|POST /api/game-votes",
  "GET|POST /api/game-comments",
  "GET|POST /api/economy",
];

export default async function handler(req, res) {
  applyCors(res, req);
  if (handleOptions(req, res)) return;

  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({
    ok: true,
    service: "vortex07-api",
    version: API_VERSION,
    persistent: hasPersistentStore(),
    endpoints: ENDPOINTS,
    timestamp: Date.now(),
  });
}
