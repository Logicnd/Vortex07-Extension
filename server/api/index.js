import activity from "../handlers/activity.js";
import economy from "../handlers/economy.js";
import forum from "../handlers/forum.js";
import gameComments from "../handlers/game-comments.js";
import gameVotes from "../handlers/game-votes.js";
import guestbook from "../handlers/guestbook.js";
import health from "../handlers/health.js";
import leaderboard from "../handlers/leaderboard.js";
import playersBatch from "../handlers/players/batch.js";
import profileViews from "../handlers/profile-views.js";
import repAdmin from "../handlers/rep-admin.js";
import repAudit from "../handlers/rep-audit.js";
import reputation from "../handlers/reputation.js";
import status from "../handlers/status.js";

const routes = {
  health,
  status,
  reputation,
  leaderboard,
  "players/batch": playersBatch,
  "profile-views": profileViews,
  guestbook,
  activity,
  "game-votes": gameVotes,
  "game-comments": gameComments,
  economy,
  forum,
  "rep-admin": repAdmin,
  "rep-audit": repAudit,
};

function normalizeRoute(raw) {
  if (!raw) return "";
  return String(raw)
    .replace(/^\//, "")
    .replace(/\/$/, "");
}

export default async function handler(req, res) {
  const routeKey = normalizeRoute(
    req.query?.__path || req.url?.split("?")[0]?.replace(/^\/api\//, ""),
  );
  const subHandler = routes[routeKey];

  if (!subHandler) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  await subHandler(req, res);
}
