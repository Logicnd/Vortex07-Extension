import activity from "../handler/activity.js";
import economy from "../handler/economy.js";
import forum from "../handler/forum.js";
import gameComments from "../handler/comments.js";
import gameVotes from "../handler/votes.js";
import guestbook from "../handler/guestbook.js";
import health from "../handler/health.js";
import leaderboard from "../handler/leaderboard.js";
import playersBatch from "../handler/players.js";
import profileViews from "../handler/views.js";
import repAdmin from "../handler/admin.js";
import repAudit from "../handler/audit.js";
import reputation from "../handler/reputation.js";
import status from "../handler/status.js";

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
