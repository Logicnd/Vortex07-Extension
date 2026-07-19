/* Roblox-style thumbs on game detail pages — Vortex07 only. */

function extractGameIdFromHref(href) {
  const match = safeString(href).match(/\/games\/(\d+)(?:\/|$)/i);
  return match ? safeNumber(match[1]) : null;
}

function getGameIdFromPage() {
  const pathParts = safeString(window.location.pathname)
    .split("/")
    .filter(Boolean);
  if (pathParts[0] === "games" && pathParts[1]) {
    const fromParts = safeNumber(pathParts[1]);
    if (fromParts !== null) return fromParts;
  }

  const fromPath = extractGameIdFromHref(window.location.pathname);
  if (fromPath !== null) return fromPath;

  const playLink = document.querySelector(
    '.btn-play[href*="/games/"], a[href*="/games/"][class*="play"]',
  );
  if (playLink) {
    const fromPlay = extractGameIdFromHref(playLink.getAttribute("href") || "");
    if (fromPlay !== null) return fromPlay;
  }

  const panel = document.querySelector(".vortex07-game-rating-panel");
  if (panel?.dataset.vortex07GameId) {
    return safeNumber(panel.dataset.vortex07GameId);
  }

  return null;
}

async function loadMyGameVotes() {
  const data = await storageGet("local", { [GAME_MY_VOTES_KEY]: {} });
  const votes = data[GAME_MY_VOTES_KEY];
  return votes && typeof votes === "object" ? votes : {};
}

async function saveMyGameVote(gameId, vote) {
  const votes = await loadMyGameVotes();
  if (vote) votes[String(gameId)] = vote;
  else delete votes[String(gameId)];
  await storageSet("local", { [GAME_MY_VOTES_KEY]: votes });
}

async function getCachedGameVotes(gameId) {
  const data = await storageGet("local", { [GAME_VOTES_CACHE_KEY]: {} });
  const cache = data[GAME_VOTES_CACHE_KEY];
  return cache?.[String(gameId)] || null;
}

async function cacheGameVotes(gameId, status) {
  const data = await storageGet("local", { [GAME_VOTES_CACHE_KEY]: {} });
  const cache = data[GAME_VOTES_CACHE_KEY] || {};
  cache[String(gameId)] = {
    likes: Number(status.likes) || 0,
    dislikes: Number(status.dislikes) || 0,
    ratioPercent: Number(status.ratioPercent) || 0,
    myVote: status.myVote || null,
    cachedAt: Date.now(),
  };
  await storageSet("local", { [GAME_VOTES_CACHE_KEY]: cache });
}

function buildGameVoteStatus(json, localVote = null) {
  const likes = Number(json.likes) || 0;
  const dislikes = Number(json.dislikes) || 0;
  const apiVote =
    json.myVote === "like" || json.myVote === "dislike" ? json.myVote : null;
  const myVote = apiVote || localVote || null;
  const total = likes + dislikes;
  const ratioPercent =
    Number.isFinite(Number(json.ratioPercent)) && total > 0
      ? Number(json.ratioPercent)
      : total > 0
        ? Math.round((likes / total) * 100)
        : 0;

  return {
    likes,
    dislikes,
    ratioPercent,
    myVote,
    synced: Boolean(json.synced),
    localOnly: Boolean(json.localOnly),
  };
}

async function fetchGameVoteStatus(gameId) {
  const numericId = safeNumber(gameId);
  if (numericId === null) return null;

  const voterId = await ensureVoterId();
  const myVotes = await loadMyGameVotes();
  const localVote =
    myVotes[String(numericId)] === "like" || myVotes[String(numericId)] === "dislike"
      ? myVotes[String(numericId)]
      : null;
  const apiBase = getVortex07ApiBase();

  if (!apiBase) {
    const cached = await getCachedGameVotes(numericId);
    if (cached) {
      return buildGameVoteStatus(cached, localVote || cached.myVote);
    }
    return buildGameVoteStatus(
      { likes: 0, dislikes: 0, ratioPercent: 0, myVote: localVote },
      localVote,
    );
  }

  if (!isRepApiAvailable()) {
    const cached = await getCachedGameVotes(numericId);
    if (cached) {
      return buildGameVoteStatus(
        { ...cached, synced: false, localOnly: true },
        localVote || cached.myVote,
      );
    }
    return buildGameVoteStatus(
      { likes: 0, dislikes: 0, ratioPercent: 0, myVote: localVote, localOnly: true },
      localVote,
    );
  }

  try {
    const url = `${apiBase}/game-votes?gameId=${encodeURIComponent(numericId)}&voterId=${encodeURIComponent(voterId)}`;
    const response = await fetchReputationRequest(url, {
      headers: { Accept: "application/json" },
      force: true,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const json = await response.json();
    const status = buildGameVoteStatus({ ...json, synced: true }, localVote);
    await cacheGameVotes(numericId, status);
    if (status.myVote) await saveMyGameVote(numericId, status.myVote);
    else await saveMyGameVote(numericId, null);
    logRep("Fetched game votes:", { gameId: numericId, ...status });
    return status;
  } catch (err) {
    markRepApiFailure();
    logRepFailureOnce("Game vote fetch failed:", err);
    const cached = await getCachedGameVotes(numericId);
    if (cached) {
      return buildGameVoteStatus(
        { ...cached, synced: false, localOnly: false },
        localVote || cached.myVote,
      );
    }
    return buildGameVoteStatus(
      { likes: 0, dislikes: 0, ratioPercent: 0, myVote: localVote, localOnly: true },
      localVote,
    );
  }
}

async function submitGameVote(gameId, vote) {
  const numericId = safeNumber(gameId);
  if (numericId === null) return { ok: false, reason: "invalid-game" };

  const requested =
    vote === "like" || vote === "dislike" ? vote : null;
  const voterId = await ensureVoterId();
  const apiBase = getVortex07ApiBase();
  const myVotes = await loadMyGameVotes();
  const currentVote =
    myVotes[String(numericId)] === "like" || myVotes[String(numericId)] === "dislike"
      ? myVotes[String(numericId)]
      : null;

  if (apiBase && isRepApiAvailable()) {
    try {
      const response = await fetchReputationRequest(`${apiBase}/game-votes`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          gameId: numericId,
          voterId,
          vote: requested,
        }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const json = await response.json();
      const status = buildGameVoteStatus({ ...json, synced: true });
      await cacheGameVotes(numericId, status);
      await saveMyGameVote(numericId, status.myVote);
      logRep("Game vote synced:", numericId, status.myVote);
      return { ok: true, ...status };
    } catch (err) {
      markRepApiFailure();
      logRepFailureOnce("Game vote POST failed:", err);
    }
  }

  const cached = (await getCachedGameVotes(numericId)) || {
    likes: 0,
    dislikes: 0,
    ratioPercent: 0,
    myVote: currentVote,
  };
  let likes = Number(cached.likes) || 0;
  let dislikes = Number(cached.dislikes) || 0;
  let nextVote = requested;

  if (requested && requested === currentVote) nextVote = null;
  if (nextVote === null && currentVote) {
    if (currentVote === "like") likes = Math.max(0, likes - 1);
    else dislikes = Math.max(0, dislikes - 1);
  } else if (nextVote) {
    if (currentVote && currentVote !== nextVote) {
      if (currentVote === "like") likes = Math.max(0, likes - 1);
      else dislikes = Math.max(0, dislikes - 1);
    }
    if (currentVote !== nextVote) {
      if (nextVote === "like") likes += 1;
      else dislikes += 1;
    }
  }

  const total = likes + dislikes;
  const status = buildGameVoteStatus(
    {
      likes,
      dislikes,
      ratioPercent: total > 0 ? Math.round((likes / total) * 100) : 0,
      myVote: nextVote,
      localOnly: true,
    },
    nextVote,
  );
  await cacheGameVotes(numericId, status);
  await saveMyGameVote(numericId, status.myVote);
  return { ok: true, ...status, synced: false, localOnly: true };
}

function updateGameRatingPanel(panel, status) {
  const likes = Number(status.likes) || 0;
  const dislikes = Number(status.dislikes) || 0;
  const total = likes + dislikes;
  const likePct = total > 0 ? (likes / total) * 100 : 50;
  const dislikePct = total > 0 ? 100 - likePct : 50;

  const likeCountEl = panel.querySelector(".vortex07-game-rating-count-like");
  const dislikeCountEl = panel.querySelector(".vortex07-game-rating-count-dislike");
  const barLikeEl = panel.querySelector(".vortex07-game-rating-bar-like");
  const barDislikeEl = panel.querySelector(".vortex07-game-rating-bar-dislike");
  const likeBtn = panel.querySelector(".vortex07-game-vote-like");
  const dislikeBtn = panel.querySelector(".vortex07-game-vote-dislike");
  const busy = Boolean(status.busy);
  const myVote = status.myVote === "like" || status.myVote === "dislike" ? status.myVote : null;

  if (likeCountEl) likeCountEl.textContent = String(likes);
  if (dislikeCountEl) dislikeCountEl.textContent = String(dislikes);
  if (barLikeEl) barLikeEl.style.flexBasis = `${likePct}%`;
  if (barDislikeEl) barDislikeEl.style.flexBasis = `${dislikePct}%`;
  panel.classList.toggle("vortex07-game-rating-has-votes", total > 0);

  likeBtn?.classList.toggle("is-on", myVote === "like");
  dislikeBtn?.classList.toggle("is-on", myVote === "dislike");
  if (likeBtn) likeBtn.disabled = busy;
  if (dislikeBtn) dislikeBtn.disabled = busy;
  panel.classList.toggle("vortex07-game-rating-synced", Boolean(status.synced));
  panel.classList.toggle("vortex07-game-rating-pending", Boolean(status.localOnly));
  panel.dataset.myVote = myVote || "";
}

async function handleGameRatingAction(panel, gameId, vote) {
  const previous = {
    likes: Number(panel.dataset.likes) || 0,
    dislikes: Number(panel.dataset.dislikes) || 0,
    myVote: panel.dataset.myVote || null,
  };

  updateGameRatingPanel(panel, { ...previous, busy: true });

  const result = await submitGameVote(gameId, vote);
  if (!result.ok) {
    updateGameRatingPanel(panel, { ...previous, busy: false });
    return;
  }

  panel.dataset.likes = String(result.likes);
  panel.dataset.dislikes = String(result.dislikes);
  updateGameRatingPanel(panel, result);
}

async function refreshGameRatingPanel(panel, gameId) {
  try {
    const status = await fetchGameVoteStatus(gameId);
    if (!status) return null;
    panel.dataset.likes = String(status.likes);
    panel.dataset.dislikes = String(status.dislikes);
    updateGameRatingPanel(panel, status);
    return status;
  } catch (err) {
    if (!isContextInvalidatedError(err)) logWarn("Game rating refresh failed:", err);
    return null;
  }
}

const GAME_COMMENT_MAX_LEN = 200;
const GAME_COMMENTS_LOCAL_MAX = 50;
let lastGameCommentsGameId = null;

async function loadLocalGameComments(gameId) {
  const data = await storageGet("local", { [GAME_COMMENTS_LOCAL_KEY]: {} });
  const store = data[GAME_COMMENTS_LOCAL_KEY];
  const list = store?.[String(gameId)];
  return Array.isArray(list) ? list : [];
}

async function saveLocalGameComment(gameId, comment) {
  const data = await storageGet("local", { [GAME_COMMENTS_LOCAL_KEY]: {} });
  const store = data[GAME_COMMENTS_LOCAL_KEY] || {};
  const key = String(gameId);
  const list = Array.isArray(store[key]) ? store[key] : [];
  store[key] = [comment, ...list].slice(0, GAME_COMMENTS_LOCAL_MAX);
  await storageSet("local", { [GAME_COMMENTS_LOCAL_KEY]: store });
}

function mergeGameComments(apiComments, localComments) {
  const merged = Array.isArray(apiComments) ? [...apiComments] : [];
  const seen = new Set(merged.map((row) => safeString(row?.id)));
  for (const comment of localComments || []) {
    const id = safeString(comment?.id);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    merged.push(comment);
  }
  merged.sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));
  return merged;
}

function buildLocalGameComment(gameId, authorId, authorName, message) {
  return {
    id: `local-${Date.now()}-${authorId}`,
    gameId: Number(gameId),
    authorId: Number(authorId),
    authorName: safeString(authorName) || `User ${authorId}`,
    message,
    createdAt: Date.now(),
    localOnly: true,
  };
}


async function syncLocalGameCommentsToApi(gameId, localComments) {
  const id = safeNumber(gameId);
  if (id === null || !localComments?.length) return;

  const apiBase = getVortex07ApiBase();
  if (!apiBase || !isRepApiAvailable()) return;

  const pending = localComments.filter((row) => row?.localOnly && safeString(row?.message));
  if (!pending.length) return;

  for (const comment of pending) {
    try {
      const voterId = await ensureVoterId();
      const response = await fetchReputationRequest(`${apiBase}/game-comments`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          gameId: id,
          authorId: comment.authorId,
          voterId,
          authorName: comment.authorName || `User ${comment.authorId}`,
          message: comment.message,
        }),
      });
      if (!response.ok) continue;

      const json = await response.json();
      if (json?.comment?.id) {
        const data = await storageGet("local", { [GAME_COMMENTS_LOCAL_KEY]: {} });
        const store = data[GAME_COMMENTS_LOCAL_KEY] || {};
        const key = String(id);
        const list = Array.isArray(store[key]) ? store[key] : [];
        store[key] = list.filter((row) => row?.id !== comment.id);
        await storageSet("local", { [GAME_COMMENTS_LOCAL_KEY]: store });
      }
    } catch (err) {
      logRepFailureOnce("Local game comment sync failed:", err);
    }
  }
}

async function fetchGameComments(gameId, limit = 30) {
  const id = safeNumber(gameId);
  if (id === null) return [];

  const localComments = await loadLocalGameComments(id);
  await syncLocalGameCommentsToApi(id, localComments);

  const refreshedLocal = await loadLocalGameComments(id);
  const apiBase = getVortex07ApiBase();
  if (!apiBase || !isRepApiAvailable()) {
    return mergeGameComments([], refreshedLocal).slice(0, limit);
  }

  try {
    const voterId = await ensureVoterId();
    const url =
      `${apiBase}/game-comments?gameId=${encodeURIComponent(id)}` +
      `&voterId=${encodeURIComponent(voterId)}&limit=${encodeURIComponent(limit)}`;
    const response = await fetchReputationRequest(url, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = await response.json();
    const apiComments = Array.isArray(json.comments) ? json.comments : [];
    return mergeGameComments(apiComments, refreshedLocal).slice(0, limit);
  } catch (err) {
    logRepFailureOnce("Game comments fetch failed:", err);
    return mergeGameComments([], refreshedLocal).slice(0, limit);
  }
}

async function postGameComment(gameId, message) {
  const numericId = safeNumber(gameId);
  if (numericId === null) return { ok: false, reason: "invalid-game" };

  const authorId = getLoggedInUserIdFromNav();
  if (authorId === null) return { ok: false, reason: "not-logged-in" };

  const clean = safeString(message).replace(/\s+/g, " ").trim().slice(0, GAME_COMMENT_MAX_LEN);
  if (!clean) return { ok: false, reason: "empty" };

  const apiBase = getVortex07ApiBase();
  if (!apiBase) return { ok: false, reason: "no-api" };

  try {
    const voterId = await ensureVoterId();
    const session = cachedSessionUser || getSessionUserFromNav();
    const authorName =
      safeString(session?.displayName) ||
      safeString(session?.username) ||
      `User ${authorId}`;

    const postUrl = `${apiBase}/game-comments`;
    const response = await fetchReputationRequest(postUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        gameId: numericId,
        authorId,
        voterId,
        authorName,
        message: clean,
      }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = await response.json();
    return { ok: true, comment: json.comment || null };
  } catch (err) {
    markRepApiFailure();
    logRepFailureOnce("Game comment post failed:", err);

    const session = cachedSessionUser || getSessionUserFromNav();
    const authorName =
      safeString(session?.displayName) ||
      safeString(session?.username) ||
      `User ${authorId}`;
    const comment = buildLocalGameComment(numericId, authorId, authorName, clean);
    await saveLocalGameComment(numericId, comment);
    return { ok: true, comment, localOnly: true };
  }
}

function renderGameComments(listEl, comments) {
  listEl.textContent = "";
  if (!comments.length) {
    const empty = document.createElement("li");
    empty.className = "vortex07-game-comments-empty";
    empty.textContent = "No comments yet — be the first.";
    listEl.appendChild(empty);
    return;
  }

  comments.forEach((comment) => {
    const li = document.createElement("li");
    li.className = "vortex07-game-comments-entry";

    const meta = document.createElement("div");
    meta.className = "vortex07-game-comments-entry-meta";

    const author = document.createElement(comment.authorId ? "a" : "span");
    author.className = "vortex07-game-comments-author";
    author.textContent = safeString(comment.authorName) || `User ${comment.authorId}`;
    if (comment.authorId) author.href = `/users/${comment.authorId}/profile`;

    const date = document.createElement("span");
    date.className = "vortex07-game-comments-date";
    date.textContent = formatGameCommentDate(comment.createdAt);

    meta.append(author, date);

    const body = document.createElement("p");
    body.className = "vortex07-game-comments-message";
    body.textContent = safeString(comment.message);

    li.append(meta, body);
    listEl.appendChild(li);
  });
}

async function refreshGameCommentsSection(section, gameId) {
  const list = section.querySelector(".vortex07-game-comments-list");
  if (!list) return;

  list.innerHTML = '<li class="vortex07-game-comments-loading">Loading…</li>';
  const comments = await fetchGameComments(gameId);
  renderGameComments(list, comments);
}

function injectGameCommentsSection(gameId) {
  if (!currentSettings.enabled) return;

  const anchor =
    document.querySelector(".game-description-box") ||
    document.querySelector("#Body > .page:has(.game-detail-header)");
  if (!anchor) return;

  let section = document.querySelector(".vortex07-game-comments-section");

  if (!section) {
    section = document.createElement("section");
    section.className = "vortex07-game-comments-section home-section";
    section.innerHTML = `
      <div class="section-header">
        <h2 class="section-title">Comments</h2>
        <span class="section-link vortex07-game-comments-tag">Vortex07 only</span>
      </div>
      <p class="vortex07-game-comments-coming-soon">COMING SOON</p>
    `;
    anchor.insertAdjacentElement("afterend", section);
  }

  section.dataset.vortex07GameId = String(gameId);
  lastGameCommentsGameId = gameId;
}

function injectGameRatingWidget() {
  if (!currentSettings.enabled) return;
  if (resolvePageRouteKey() !== "game") return;

  const gameId = getGameIdFromPage();
  if (gameId === null) return;

  const header =
    document.querySelector(".game-detail-header") ||
    document.querySelector(".vortex07-game-shell");
  if (!header) return;

  let panel = document.querySelector(".vortex07-game-rating-panel");
  if (
    panel &&
    (!panel.querySelector(".vortex07-game-rating-bar") ||
      panel.querySelector(".vortex07-game-rating-summary"))
  ) {
    panel.remove();
    panel = null;
  }
  const isNewPanel = !panel;

  if (!panel) {
    panel = document.createElement("div");
    panel.className = "vortex07-game-rating-panel";
    panel.dataset.vortex07GameId = String(gameId);
    panel.innerHTML = `
      <div class="vortex07-game-rating-icons">
        <button type="button" class="vortex07-game-vote-btn vortex07-game-vote-like" title="Like this game" aria-label="Like this game">
          ${repThumbUpSvg(18)}
        </button>
        <button type="button" class="vortex07-game-vote-btn vortex07-game-vote-dislike" title="Dislike this game" aria-label="Dislike this game">
          ${repThumbDownSvg(18)}
        </button>
      </div>
      <div class="vortex07-game-rating-bar" role="presentation" aria-hidden="true">
        <span class="vortex07-game-rating-bar-like"></span>
        <span class="vortex07-game-rating-bar-dislike"></span>
      </div>
      <div class="vortex07-game-rating-counts" aria-live="polite">
        <span class="vortex07-game-rating-count-like">0</span>
        <span class="vortex07-game-rating-count-dislike">0</span>
      </div>
    `;

    panel.querySelector(".vortex07-game-vote-like")?.addEventListener("click", async () => {
      if (!isExtensionContextAlive()) {
        maybeShowRefreshBanner();
        return;
      }
      await handleGameRatingAction(panel, gameId, "like");
    });

    panel.querySelector(".vortex07-game-vote-dislike")?.addEventListener("click", async () => {
      if (!isExtensionContextAlive()) {
        maybeShowRefreshBanner();
        return;
      }
      await handleGameRatingAction(panel, gameId, "dislike");
    });

    header.appendChild(panel);
  } else if (panel.dataset.vortex07GameId !== String(gameId)) {
    panel.dataset.vortex07GameId = String(gameId);
    lastGameRatingGameId = null;
  }

  if (isNewPanel || lastGameRatingGameId !== gameId) {
    lastGameRatingGameId = gameId;
    void refreshGameRatingPanel(panel, gameId);
  }

  injectGameCommentsSection(gameId);
}

function repMapFromBatchJson(json) {
  const map = new Map();
  const rows = json?.results || json?.counts || json;

  if (Array.isArray(rows)) {
    rows.forEach((row) => {
      const id = safeNumber(row.userId ?? row.id);
      if (id === null) return;
      map.set(id, {
        count: Number(row.count) || 0,
        hasVoted: Boolean(row.hasVoted),
        myVote:
          row.myVote === "up" || row.myVote === "down"
            ? row.myVote
            : row.hasVoted
              ? "up"
              : null,
        status: normalizeExtensionStatus(row.status || ""),
      });
      cacheReputation(id, row.count, row.myVote || (row.hasVoted ? "up" : null));
      if (row.status !== undefined) void cacheStatus(id, row.status || "");
    });
  } else if (rows && typeof rows === "object") {
    Object.entries(rows).forEach(([key, value]) => {
      const id = safeNumber(key);
      if (id === null) return;
      const count = typeof value === "object" ? value.count : value;
      const myVote =
        typeof value === "object" && (value.myVote === "up" || value.myVote === "down")
          ? value.myVote
          : typeof value === "object" && value.hasVoted
            ? "up"
            : null;
      map.set(id, { count: Number(count) || 0, hasVoted: myVote === "up", myVote });
      cacheReputation(id, count, myVote);
    });
  }

  return map;
}

async function fetchBatchPlayerData(userIds) {
  const apiBase = getVortex07ApiBase();
  const ids = [...new Set(userIds.map((id) => safeNumber(id)).filter(Boolean))];
  if (!apiBase || ids.length === 0) return new Map();

  if (!isRepApiAvailable() || shouldSkipNonEssentialPolling()) {
    return buildRepMapFromCache(ids);
  }

  try {
    const query = await buildRepActorQuery({
      ids: ids.join(","),
    });
    const url = `${apiBase}/players/batch?${query}`;
    const response = await fetchReputationRequest(url, {
      headers: { Accept: "application/json" },
      force: true,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const json = await response.json();
    return repMapFromBatchJson(json);
  } catch (err) {
    markRepApiFailure();
    logRepFailureOnce("Batch player fetch failed:", err);
    return buildRepMapFromCache(ids);
  }
}

async function fetchLeaderboard(limit = 25) {
  const apiBase = getVortex07ApiBase();
  const cap = Math.min(Math.max(Number(limit) || 25, 1), 100);

  const data = await storageGet("local", { [LEADERBOARD_CACHE_KEY]: null });
  const cached = data[LEADERBOARD_CACHE_KEY];
  const cacheMaxAge = shouldSkipNonEssentialPolling()
    ? ATTACK_MODE_LEADERBOARD_CACHE_MS
    : 30000;

  if (
    cached?.results?.length &&
    cached.cachedAt &&
    Date.now() - cached.cachedAt < cacheMaxAge
  ) {
    return cached.results.slice(0, cap);
  }

  if (!apiBase || !isRepApiAvailable() || shouldSkipNonEssentialPolling()) {
    return cached?.results || [];
  }

  try {
    const url = `${apiBase}/leaderboard?limit=${encodeURIComponent(cap)}`;
    const response = await fetchReputationRequest(url, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const json = await response.json();
    const results = Array.isArray(json?.results) ? json.results : [];
    await storageSet("local", {
      [LEADERBOARD_CACHE_KEY]: { results, cachedAt: Date.now() },
    });
    return results;
  } catch (err) {
    markRepApiFailure();
    logRepFailureOnce("Leaderboard fetch failed:", err);
    const data = await storageGet("local", { [LEADERBOARD_CACHE_KEY]: null });
    return data[LEADERBOARD_CACHE_KEY]?.results || [];
  }
}

async function fetchReputationCountsBulk(userIds) {
  const apiBase = getVortex07ApiBase();
  const ids = [...new Set(userIds.map((id) => safeNumber(id)).filter(Boolean))];
  if (!apiBase || ids.length === 0) return new Map();

  const idsKey = ids.slice().sort((a, b) => a - b).join(",");
  const now = Date.now();

  if (
    idsKey === lastGlobalRepIdsKey &&
    now - lastGlobalRepFetchAt < getEffectiveGlobalRepIntervalMs()
  ) {
    return buildRepMapFromCache(ids);
  }

  if (!isRepApiAvailable() || shouldSkipNonEssentialPolling()) {
    return buildRepMapFromCache(ids);
  }

  if (ids.length >= 2) {
    const map = await fetchBatchPlayerData(ids);
    if (map.size > 0) {
      lastGlobalRepFetchAt = now;
      lastGlobalRepIdsKey = idsKey;
    }
    return map;
  }

  try {
    const voterId = await ensureVoterId();
    const url = `${apiBase}/reputation?userId=${encodeURIComponent(ids[0])}&voterId=${encodeURIComponent(voterId)}`;
    const response = await fetchReputationRequest(url, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const json = await response.json();
    const myVote =
      json.myVote === "up" || json.myVote === "down"
        ? json.myVote
        : json.hasVoted
          ? "up"
          : null;
    const map = new Map();
    map.set(ids[0], {
      count: Number(json.count) || 0,
      hasVoted: myVote === "up",
      myVote,
    });
    await cacheReputation(ids[0], json.count, myVote);

    lastGlobalRepFetchAt = now;
    lastGlobalRepIdsKey = idsKey;
    return map;
  } catch (err) {
    markRepApiFailure();
    logRepFailureOnce("Bulk reputation fetch failed:", err);
    return buildRepMapFromCache(ids);
  }
}

async function buildRepMapFromCache(ids) {
  const map = new Map();
  for (const id of ids) {
    const cached = await getCachedReputation(id);
    if (cached) {
      const myVote =
        cached.myVote === "up" || cached.myVote === "down"
          ? cached.myVote
          : cached.hasVoted
            ? "up"
            : null;
      map.set(id, { count: cached.count, hasVoted: myVote === "up", myVote });
    }
  }
  return map;
}

function normalizeExtensionStatus(text) {
  return safeString(text)
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, STATUS_MAX_LEN);
}

async function getCachedStatus(userId) {
  const mem = sessionMemoryStore.statusCache[String(userId)];
  if (mem !== undefined) return mem;

  const data = await storageGet("local", { [STATUS_CACHE_KEY]: {} });
  const cache = data[STATUS_CACHE_KEY];
  return cache?.[String(userId)] ?? null;
}

async function cacheStatus(userId, status) {
  const clean = normalizeExtensionStatus(status);
  sessionMemoryStore.statusCache[String(userId)] = clean;
  const data = await storageGet("local", { [STATUS_CACHE_KEY]: {} });
  const cache = data[STATUS_CACHE_KEY] || {};
  cache[String(userId)] = clean;
  await storageSet("local", { [STATUS_CACHE_KEY]: cache });
  return clean;
}

async function fetchUserStatus(userId) {
  const id = safeNumber(userId);
  if (id === null) return "";

  const apiBase = getVortex07ApiBase();
  if (!apiBase || !isRepApiAvailable()) {
    const cached = await getCachedStatus(id);
    return cached ?? "";
  }

  try {
    const voterId = await ensureVoterId();
    const url = `${apiBase}/status?userId=${encodeURIComponent(id)}&voterId=${encodeURIComponent(voterId)}`;
    const response = await fetchReputationRequest(url, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = await response.json();
    return cacheStatus(id, json.status || "");
  } catch (err) {
    markRepApiFailure();
    logRepFailureOnce("Status fetch failed:", err);
    const cached = await getCachedStatus(id);
    return cached ?? "";
  }
}

async function saveUserStatus(userId, status) {
  const id = safeNumber(userId);
  if (id === null) return { ok: false };

  const clean = normalizeExtensionStatus(status);
  await cacheStatus(id, clean);

  const apiBase = getVortex07ApiBase();
  if (!apiBase || !isRepApiAvailable()) {
    return { ok: true, status: clean, synced: false };
  }

  try {
    const voterId = await ensureVoterId();
    const response = await fetchReputationRequest(`${apiBase}/status`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId: id, voterId, status: clean }),
      force: true,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = await response.json();
    const saved = await cacheStatus(id, json.status || clean);
    return { ok: true, status: saved, synced: true };
  } catch (err) {
    markRepApiFailure();
    logRepFailureOnce("Status save failed:", err);
    return { ok: true, status: clean, synced: false };
  }
}

async function fetchBatchStatuses(userIds) {
  const ids = [...new Set(userIds.map((id) => safeNumber(id)).filter(Boolean))];
  const map = new Map();
  if (ids.length === 0) return map;

  for (const id of ids) {
    const mem = sessionMemoryStore.statusCache[String(id)];
    if (mem !== undefined) map.set(id, mem);
  }

  const missing = ids.filter((id) => !map.has(id));
  if (missing.length === 0) return map;

  const batchMap = await fetchBatchPlayerData(missing);
  missing.forEach((id) => {
    const row = batchMap.get(id);
    const status = normalizeExtensionStatus(row?.status || "");
    sessionMemoryStore.statusCache[String(id)] = status;
    map.set(id, status);
  });

  return map;
}

function truncateStatus(text, max = 42) {
  const clean = normalizeExtensionStatus(text);
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1)}…`;
}

function renderExtensionStatusEl(text, options = {}) {
  const clean = normalizeExtensionStatus(text);
  if (!clean || !currentSettings.showExtensionStatus) return null;

  const el = document.createElement(options.tag || "div");
  el.className = options.className || "vortex07-ext-status";
  el.textContent = options.compact ? truncateStatus(clean) : clean;
  el.title = clean;
  if (options.userId) el.dataset.vortex07UserId = String(options.userId);
  return el;
}

function decorateExtensionStatusHost(host, userId, status) {
  if (!host || !currentSettings.showExtensionStatus) return;

  const clean = normalizeExtensionStatus(status);
  let line = host.querySelector(".vortex07-ext-status");
  if (!clean) {
    line?.remove();
    return;
  }

  if (!line) {
    line = renderExtensionStatusEl(clean, {
      className: host.dataset.vortex07StatusClass || "vortex07-ext-status",
      compact: host.dataset.vortex07StatusCompact === "1",
      userId,
    });
    if (!line) return;
    host.appendChild(line);
  } else {
    line.textContent = host.dataset.vortex07StatusCompact === "1"
      ? truncateStatus(clean)
      : clean;
    line.title = clean;
  }
}

async function applyExtensionStatusLines(root = document) {
  if (!currentSettings.enabled || !currentSettings.showExtensionStatus) return;

  const targets = [];
  root.querySelectorAll(".vortex07-player-result").forEach((row) => {
    const id = safeNumber(row.dataset.vortex07UserId);
    if (id === null) return;
    const info = row.querySelector(".vortex07-user-info");
    if (!info) return;
    info.dataset.vortex07StatusCompact = "1";
    targets.push({ host: info, userId: id });
  });

  root.querySelectorAll(".friend-card, .user-card, .user-row").forEach((card) => {
    const id = getUserIdFromRepNode(card);
    if (id === null) return;
    const nameHost = card.querySelector(".friend-name, .user-card-name, .user-row-name");
    if (!nameHost) return;
    nameHost.dataset.vortex07StatusCompact = "1";
    targets.push({ host: nameHost, userId: id });
  });

  if (targets.length === 0) return;

  const statusMap = await fetchBatchStatuses(targets.map((t) => t.userId));
  targets.forEach(({ host, userId }) => {
    decorateExtensionStatusHost(host, userId, statusMap.get(userId) || "");
  });
}

let extensionMetaScheduled = false;

function scheduleExtensionMetaDecorations(root = document) {
  if (extensionMetaScheduled || !currentSettings.enabled) return;
  extensionMetaScheduled = true;

  requestAnimationFrame(async () => {
    extensionMetaScheduled = false;
    await applyExtensionStatusLines(root);
  });
}

function showVortexToast(message) {
  let toast = document.getElementById("vortex07-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "vortex07-toast";
    toast.className = "vortex07-toast";
    (document.body || document.documentElement).appendChild(toast);
  }

  toast.textContent = message;
  toast.classList.add("vortex07-toast-visible");
  clearTimeout(showVortexToast.hideTimer);
  showVortexToast.hideTimer = setTimeout(() => {
    toast.classList.remove("vortex07-toast-visible");
  }, 2200);
}
