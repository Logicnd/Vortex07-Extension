/* Forum REST API (split from guestbook.js) */

function getForumAuthorInfo() {
  const userId = getLoggedInUserIdFromNav();
  if (userId === null) {
    return { authorUserId: null, authorName: "Guest" };
  }
  const session = cachedSessionUser || getSessionUserFromNav();
  const authorName =
    safeString(session?.username) || `Player ${userId}`;
  return {
    authorUserId: userId,
    authorName,
  };
}

function collectForumUserIds(...groups) {
  const ids = new Set();
  groups.flat().forEach((row) => {
    const id = safeNumber(row?.authorUserId);
    if (id !== null) ids.add(id);
  });
  return [...ids];
}

async function hydrateForumProfiles(userIds, authorsFromApi = {}) {
  const ids = [...new Set(userIds.map((id) => safeNumber(id)).filter((id) => id !== null))];
  if (!ids.length) {
    return { authors: { ...authorsFromApi }, avatars: {} };
  }

  const avatarMap = await fetchPlayerAvatars(ids, { userInitiated: true });
  const avatars = {};
  avatarMap.forEach((url, id) => {
    if (url) avatars[String(id)] = url;
  });

  return {
    authors: { ...authorsFromApi },
    avatars,
  };
}

async function fetchForumFeed(categoryId = "general", limit = 30, offset = 0) {
  const apiBase = getVortex07ApiBase();
  if (!apiBase) return { threads: [], authors: {}, avatars: {} };

  try {
    const voterId = await ensureVoterId();
    const actorId = getLoggedInUserIdFromNav();
    const actorParam =
      actorId !== null ? `&actorUserId=${encodeURIComponent(actorId)}` : "";
    const url =
      `${apiBase}/forum?action=feed&category=${encodeURIComponent(categoryId)}` +
      `&limit=${encodeURIComponent(limit)}&offset=${encodeURIComponent(offset)}` +
      `&voterId=${encodeURIComponent(voterId)}${actorParam}`;
    const response = await fetchReputationRequest(url, {
      headers: { Accept: "application/json" },
      force: true,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = await response.json();
    const threads = Array.isArray(json.threads) ? json.threads : [];
    const profiles = await hydrateForumProfiles(
      collectForumUserIds(threads),
      json.authors || {},
    );
    return { threads, ...profiles };
  } catch (err) {
    logRepFailureOnce("Forum feed fetch failed:", err);
    return { threads: [], authors: {}, avatars: {} };
  }
}

async function fetchForumThreads(categoryId = "general", limit = 30, offset = 0) {
  const feed = await fetchForumFeed(categoryId, limit, offset);
  return feed.threads || [];
}

async function fetchForumThread(threadId) {
  const id = safeString(threadId);
  if (!id) return null;

  const apiBase = getVortex07ApiBase();
  if (!apiBase) return null;

  try {
    const voterId = await ensureVoterId();
    const actorId = getLoggedInUserIdFromNav();
    const actorParam =
      actorId !== null ? `&actorUserId=${encodeURIComponent(actorId)}` : "";
    const url =
      `${apiBase}/forum?action=thread&threadId=${encodeURIComponent(id)}` +
      `&voterId=${encodeURIComponent(voterId)}${actorParam}`;
    const response = await fetchReputationRequest(url, {
      headers: { Accept: "application/json" },
      force: true,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = await response.json();
    const profiles = await hydrateForumProfiles(
      collectForumUserIds([json.thread, ...(json.posts || [])]),
      json.authors || {},
    );
    return { ...json, ...profiles };
  } catch (err) {
    logRepFailureOnce("Forum thread fetch failed:", err);
    return null;
  }
}

async function createForumThread({ categoryId, title, body }) {
  const apiBase = getVortex07ApiBase();
  if (!apiBase) return { ok: false, reason: "no-api" };

  const cleanTitle = safeString(title).slice(0, 120);
  const cleanBody = safeString(body).slice(0, 1000);
  if (!cleanTitle || !cleanBody) return { ok: false, reason: "empty" };

  const author = getForumAuthorInfo();
  if (author.authorUserId === null) return { ok: false, reason: "not-logged-in" };

  const boardId = safeString(categoryId).toLowerCase();
  const boardAliases = {
    "off-topic": "offtopic",
    offtopic: "offtopic",
    "help-support": "help",
    help: "help",
    general: "general",
    "vortex07-dev": "vortex07-dev",
  };
  const resolvedCategoryId = boardAliases[boardId] || boardId;

  try {
    const voterId = await ensureVoterId();
    const response = await fetchReputationRequest(`${apiBase}/forum`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "create-thread",
        voterId,
        categoryId: resolvedCategoryId,
        category: resolvedCategoryId,
        title: cleanTitle,
        body: cleanBody,
        authorUserId: author.authorUserId,
        authorName: author.authorName,
      }),
    });

    if (response.status === 429) return { ok: false, reason: "rate-limit" };
    if (response.status === 404) return { ok: false, reason: "not-deployed" };
    if (!response.ok) {
      let apiError = "";
      try {
        const errJson = await response.json();
        apiError = safeString(errJson?.error);
      } catch {
        /* ignore */
      }
      return { ok: false, reason: apiError || "error", status: response.status };
    }

    const json = await response.json();
    const threadView =
      json.thread && json.post ? { thread: json.thread, posts: [json.post] } : null;
    let profiles = null;
    if (threadView && author.authorUserId !== null) {
      profiles = await hydrateForumProfiles([author.authorUserId], {
        [String(author.authorUserId)]: { userId: author.authorUserId, rep: 0, status: "" },
      });
      if (threadView) {
        threadView.authors = profiles.authors;
        threadView.avatars = profiles.avatars;
      }
    }
    return {
      ok: true,
      thread: json.thread || null,
      post: json.post || null,
      threadView,
      profiles,
    };
  } catch (err) {
    logRepFailureOnce("Forum thread create failed:", err);
    return { ok: false, reason: "network" };
  }
}

async function replyToForumThread({ threadId, body, parentPostId = null }) {
  const id = safeString(threadId);
  if (!id) return { ok: false, reason: "invalid-thread" };

  const apiBase = getVortex07ApiBase();
  if (!apiBase) return { ok: false, reason: "no-api" };

  const cleanBody = safeString(body).slice(0, 1000);
  if (!cleanBody) return { ok: false, reason: "empty" };

  const author = getForumAuthorInfo();
  if (author.authorUserId === null) return { ok: false, reason: "not-logged-in" };

  try {
    const voterId = await ensureVoterId();
    const payload = {
      action: "reply",
      voterId,
      threadId: id,
      body: cleanBody,
      authorUserId: author.authorUserId,
      authorName: author.authorName,
    };
    if (parentPostId) payload.parentPostId = safeString(parentPostId);
    const response = await fetchReputationRequest(`${apiBase}/forum`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (response.status === 429) return { ok: false, reason: "rate-limit" };
    if (response.status === 404) return { ok: false, reason: "not-deployed" };
    if (!response.ok) {
      let apiError = "";
      try {
        const errJson = await response.json();
        apiError = safeString(errJson?.error);
      } catch {
        /* ignore */
      }
      return { ok: false, reason: apiError || "error", status: response.status };
    }

    const json = await response.json();
    return { ok: true, post: json.post || null, thread: json.thread || null };
  } catch (err) {
    logRepFailureOnce("Forum reply failed:", err);
    return { ok: false, reason: "network" };
  }
}

async function likeForumPost({ threadId, postId }) {
  const tid = safeString(threadId);
  const pid = safeString(postId);
  if (!tid || !pid) return { ok: false, reason: "invalid-post" };

  const apiBase = getVortex07ApiBase();
  if (!apiBase) return { ok: false, reason: "no-api" };

  try {
    const voterId = await ensureVoterId();
    const response = await fetchReputationRequest(`${apiBase}/forum`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "like-post",
        voterId,
        threadId: tid,
        postId: pid,
      }),
    });

    if (response.status === 429) return { ok: false, reason: "rate-limit" };
    if (response.status === 404) return { ok: false, reason: "not-deployed" };
    if (!response.ok) {
      let apiError = "";
      try {
        const errJson = await response.json();
        apiError = safeString(errJson?.error);
      } catch {
        /* ignore */
      }
      return { ok: false, reason: apiError || "error", status: response.status };
    }

    const json = await response.json();
    return {
      ok: true,
      likeCount: Number(json.likeCount) || 0,
      myLike: Boolean(json.myLike),
    };
  } catch (err) {
    logRepFailureOnce("Forum like failed:", err);
    return { ok: false, reason: "network" };
  }
}

async function refreshForumAvatars(userIds) {
  const ids = [...new Set(userIds.map((id) => safeNumber(id)).filter((id) => id !== null))];
  if (!ids.length) return { avatars: {} };
  const profiles = await hydrateForumProfiles(ids, {});
  return { avatars: profiles.avatars || {} };
}

async function hydrateForumAvatarsInRoot(root) {
  if (!root) return;

  const pendingIds = new Set();
  root.querySelectorAll("img.vortex07-forum-avatar-img[data-vortex07-uid]").forEach((img) => {
    if (img.classList.contains("is-loaded") && safeImageSrc(img.getAttribute("src") || "", "")) return;
    const id = safeNumber(img.dataset.vortex07Uid);
    if (id !== null) pendingIds.add(id);
  });

  if (!pendingIds.size) return;

  const avatarMap = await fetchPlayerAvatars([...pendingIds], { userInitiated: true });

  root.querySelectorAll("img.vortex07-forum-avatar-img[data-vortex07-uid]").forEach((img) => {
    const id = safeNumber(img.dataset.vortex07Uid);
    if (id === null) return;
    const src = safeImageSrc(avatarMap.get(id) || "", "");
    if (!src) return;
    img.src = src;
    img.classList.add("is-loaded");
    const wrap = img.closest(".vortex07-forum-avatar-wrap");
    if (wrap) wrap.classList.add("has-image");
  });
}

const VORTEX07_FORUM_API = {
  fetchFeed: fetchForumFeed,
  fetchThreads: fetchForumThreads,
  fetchThread: fetchForumThread,
  createThread: createForumThread,
  replyToThread: replyToForumThread,
  likePost: likeForumPost,
  refreshAvatars: refreshForumAvatars,
  hydrateAvatarsInRoot: hydrateForumAvatarsInRoot,
  canPost: () => getLoggedInUserIdFromNav() !== null,
  buildAvatarHtml(userId, authorName, avatarUrl = "", compact = false, size = "md") {
    const id = safeNumber(userId);
    const name = safeString(authorName) || "Guest";
    const letter = escapeHtml(initial(name));
    const color = avatarColor(name);
    const src = safeImageSrc(avatarUrl, "");
    const sizeClass = size === "lg" ? " is-lg" : size === "sm" ? " is-sm" : "";
    const compactClass = compact ? " is-compact" : "";

    if (id === null) {
      return `<span class="vortex07-forum-avatar-wrap is-guest${compactClass}${sizeClass}" style="background:${color}"><span class="vortex07-forum-avatar-letter">${letter}</span></span>`;
    }

    const imgTag = src
      ? `<img class="vortex07-forum-avatar-img is-loaded" src="${escapeHtml(src)}" data-vortex07-uid="${id}" alt="" loading="lazy" />`
      : `<img class="vortex07-forum-avatar-img" data-vortex07-uid="${id}" alt="" loading="lazy" />`;
    const loadedClass = src ? " has-image" : "";

    return `<a class="vortex07-forum-avatar-link" href="/users/${id}/profile" tabindex="-1"><span class="vortex07-forum-avatar-wrap${compactClass}${sizeClass}${loadedClass}" style="background:${color}">${imgTag}<span class="vortex07-forum-avatar-letter">${letter}</span></span></a>`;
  },
};
