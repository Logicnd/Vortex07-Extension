/* ========================================================= */
/* = SOCIAL HEAT (v1.12.0) — guestbook + activity ticker === */
/* ========================================================= */

function getGuestbookAnchor() {
  const page = document.querySelector("#Body > .page:has(.profile-header), #Body > .page:has(.vortex07-profile-header)");
  if (!page) return null;

  return (
    page.querySelector(".bio-box") ||
    page.querySelector(".profile-info-panel") ||
    page.querySelector(".friends-section") ||
    page.querySelector(".profile-header")
  );
}

function mountGuestbookSection(section, anchor) {
  const page = anchor?.closest(".page");
  const bio = page?.querySelector(".bio-box");
  if (bio) {
    bio.insertAdjacentElement("afterend", section);
    return;
  }
  anchor.insertAdjacentElement("beforebegin", section);
}

async function fetchGuestbookEntries(profileUserId, limit = 20) {
  const id = safeNumber(profileUserId);
  if (id === null) return [];

  const apiBase = getVortex07ApiBase();
  if (!apiBase || !isRepApiAvailable() || shouldSkipNonEssentialPolling()) {
    return [];
  }

  try {
    const voterId = await ensureVoterId();
    const url = `${apiBase}/guestbook?profileUserId=${encodeURIComponent(id)}&voterId=${encodeURIComponent(voterId)}&limit=${encodeURIComponent(limit)}`;
    const response = await fetchReputationRequest(url, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = await response.json();
    return Array.isArray(json.entries) ? json.entries : [];
  } catch (err) {
    logRepFailureOnce("Guestbook fetch failed:", err);
    return [];
  }
}


async function postGuestbookMessage(profileUserId, message) {
  const profileId = safeNumber(profileUserId);
  if (profileId === null) return { ok: false, reason: "invalid-profile" };

  const authorId = getLoggedInUserIdFromNav();
  if (authorId === null) return { ok: false, reason: "not-logged-in" };
  if (authorId === profileId) return { ok: false, reason: "self" };

  const clean = safeString(message).replace(/\s+/g, " ").trim().slice(0, GUESTBOOK_MAX_LEN);
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

    const response = await fetchReputationRequest(`${apiBase}/guestbook`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        profileUserId: profileId,
        authorId,
        voterId,
        authorName,
        message: clean,
      }),
    });

    if (response.status === 429) {
      return { ok: false, reason: "already-posted-today" };
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const json = await response.json();
    return { ok: true, entry: json.entry || null };
  } catch (err) {
    markRepApiFailure();
    logRepFailureOnce("Guestbook post failed:", err);
    return { ok: false, reason: "error" };
  }
}

function renderGuestbookEntries(listEl, entries) {
  listEl.textContent = "";
  if (!entries.length) {
    const empty = document.createElement("li");
    empty.className = "vortex07-guestbook-empty";
    empty.textContent = "No guestbook entries yet — be the first to sign.";
    listEl.appendChild(empty);
    return;
  }

  entries.forEach((entry) => {
    const li = document.createElement("li");
    li.className = "vortex07-guestbook-entry";

    const meta = document.createElement("div");
    meta.className = "vortex07-guestbook-entry-meta";

    const author = document.createElement(
      entry.authorId ? "a" : "span",
    );
    author.className = "vortex07-guestbook-author";
    author.textContent = safeString(entry.authorName) || `User ${entry.authorId}`;
    if (entry.authorId) {
      author.href = `/users/${entry.authorId}/profile`;
    }

    const date = document.createElement("span");
    date.className = "vortex07-guestbook-date";
    date.textContent = formatGuestbookDate(entry.createdAt);

    meta.append(author, date);

    const body = document.createElement("p");
    body.className = "vortex07-guestbook-message";
    body.textContent = safeString(entry.message);

    li.append(meta, body);
    listEl.appendChild(li);
  });
}

async function injectProfileGuestbook() {
  if (!currentSettings.enabled || !currentSettings.showGuestbook) return;

  const profileId = getProfileUserIdFromPage();
  const anchor = getGuestbookAnchor();
  if (profileId === null || !anchor) return;

  let section = document.querySelector(".vortex07-guestbook-section");
  if (!section) {
    section = document.createElement("section");
    section.className =
      "vortex07-guestbook-section vortex07-profile-guestbook home-section";
    section.innerHTML = `
      <div class="section-header">
        <h2 class="section-title">Guestbook</h2>
        <span class="section-link vortex07-guestbook-tag">Vortex07 only</span>
      </div>
      <ul class="vortex07-guestbook-list"></ul>
      <form class="vortex07-guestbook-form" hidden>
        <input type="text" class="vortex07-guestbook-input" maxlength="${GUESTBOOK_MAX_LEN}" placeholder="Leave a short message (once per day)…" autocomplete="off" />
        <button type="submit" class="vortex07-guestbook-submit rbx-2007-btn">Sign</button>
      </form>
      <p class="vortex07-guestbook-hint" hidden></p>
    `;
    mountGuestbookSection(section, anchor);

    const form = section.querySelector(".vortex07-guestbook-form");
    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const input = form.querySelector(".vortex07-guestbook-input");
      const hint = section.querySelector(".vortex07-guestbook-hint");
      const submit = form.querySelector(".vortex07-guestbook-submit");
      if (!input || !submit) return;

      submit.disabled = true;
      const result = await postGuestbookMessage(profileId, input.value);
      submit.disabled = false;

      if (result.ok) {
        input.value = "";
        form.hidden = true;
        if (hint) {
          hint.hidden = false;
          hint.textContent = "Signed! You can post again tomorrow.";
        }
        const list = section.querySelector(".vortex07-guestbook-list");
        const entries = await fetchGuestbookEntries(profileId, 20);
        if (list) renderGuestbookEntries(list, entries);
        return;
      }

      if (hint) {
        hint.hidden = false;
        hint.textContent =
          result.reason === "already-posted-today"
            ? "You already signed this guestbook today."
            : result.reason === "not-logged-in"
              ? "Log in to sign guestbooks."
              : "Could not post — try again later.";
      }
    });
  }

  const list = section.querySelector(".vortex07-guestbook-list");
  const form = section.querySelector(".vortex07-guestbook-form");
  const hint = section.querySelector(".vortex07-guestbook-hint");
  const loggedInId = getLoggedInUserIdFromNav();
  const canSign = loggedInId !== null && loggedInId !== profileId;

  if (form) form.hidden = !canSign;
  if (hint) hint.hidden = true;

  if (list) {
    list.innerHTML = '<li class="vortex07-guestbook-loading">Loading…</li>';
    const entries = await fetchGuestbookEntries(profileId, 20);
    renderGuestbookEntries(list, entries);
    if (typeof ensureMythGuestbookGhost === "function") ensureMythGuestbookGhost();
  }
}

async function pushLocalActivityEvent(userId, delta = 1) {
  const id = safeNumber(userId);
  if (id === null) return;

  const event = { type: "rep", userId: id, delta: Number(delta) || 1, at: Date.now() };
  const data = await storageGet("local", { [ACTIVITY_CACHE_KEY]: [] });
  const existing = Array.isArray(data[ACTIVITY_CACHE_KEY]) ? data[ACTIVITY_CACHE_KEY] : [];
  const next = [event, ...existing].slice(0, 40);
  await storageSet("local", { [ACTIVITY_CACHE_KEY]: next });
}

async function fetchActivityFeed(limit = 12) {
  const cap = Math.min(Math.max(Number(limit) || 12, 1), 30);
  const data = await storageGet("local", { [ACTIVITY_CACHE_KEY]: [] });
  const localEvents = Array.isArray(data[ACTIVITY_CACHE_KEY]) ? data[ACTIVITY_CACHE_KEY] : [];

  const apiBase = getVortex07ApiBase();
  if (!apiBase || !isRepApiAvailable() || shouldSkipNonEssentialPolling()) {
    return localEvents.slice(0, cap);
  }

  try {
    const voterId = await ensureVoterId();
    const url = `${apiBase}/activity?limit=${encodeURIComponent(cap)}&voterId=${encodeURIComponent(voterId)}`;
    const response = await fetchReputationRequest(url, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = await response.json();
    const remote = Array.isArray(json.events) ? json.events : [];
    const merged = [...remote, ...localEvents]
      .sort((a, b) => (Number(b.at) || 0) - (Number(a.at) || 0))
      .filter((event, index, arr) => {
        const key = `${event.type}:${event.userId}:${event.at}`;
        return arr.findIndex((row) => `${row.type}:${row.userId}:${row.at}` === key) === index;
      })
      .slice(0, cap);
    return merged;
  } catch (err) {
    logRepFailureOnce("Activity feed fetch failed:", err);
    return localEvents.slice(0, cap);
  }
}

async function formatActivityEvent(event, nameMap) {
  const userId = safeNumber(event?.userId);
  if (userId === null) return null;

  const label = nameMap.get(userId) || `@user${userId}`;
  const delta = Number(event.delta) || 1;
  if (event.type === "rep") {
    return `${label} got +${delta} rep`;
  }
  return null;
}

let homeActivityInjected = false;

async function injectHomeActivityTicker() {
  if (!currentSettings.enabled || !currentSettings.showActivityTicker) return;

  const path = window.location.pathname;
  if (path !== "/home" && path !== "/") return;

  if (document.querySelector(".vortex07-activity-ticker")) {
    homeActivityInjected = true;
    return;
  }
  if (homeActivityInjected) return;

  const gamesSection = document.querySelector("#Container .games-section");
  if (!gamesSection) return;

  homeActivityInjected = true;

  const ticker = document.createElement("div");
  ticker.className = "vortex07-activity-ticker";
  ticker.innerHTML =
    '<div class="vortex07-activity-head"><span class="vortex07-activity-title">Vortex07 Activity</span><span class="vortex07-activity-sub">Recent rep</span></div><ul class="vortex07-activity-list"><li class="vortex07-activity-loading">Loading…</li></ul>';
  gamesSection.insertAdjacentElement("afterend", ticker);

  const list = ticker.querySelector(".vortex07-activity-list");
  const events = await fetchActivityFeed(12);
  list.textContent = "";

  if (!events.length) {
    const empty = document.createElement("li");
    empty.className = "vortex07-activity-empty";
    empty.textContent = "No recent rep yet — upvote someone on a profile.";
    list.appendChild(empty);
    return;
  }

  const userIds = events
    .map((event) => safeNumber(event.userId))
    .filter((id) => id !== null);
  const names = await resolveLeaderboardDisplayNames(userIds);

  for (const event of events) {
    const text = await formatActivityEvent(event, names);
    if (!text) continue;

    const li = document.createElement("li");
    li.className = "vortex07-activity-item";
    const userId = safeNumber(event.userId);
    if (userId !== null) {
      const link = document.createElement("a");
      link.href = `/users/${userId}/profile`;
      link.className = "vortex07-activity-link";
      link.textContent = text;
      li.appendChild(link);
    } else {
      li.textContent = text;
    }
    list.appendChild(li);
  }

  if (!list.children.length) {
    const empty = document.createElement("li");
    empty.className = "vortex07-activity-empty";
    empty.textContent = "No recent rep yet — upvote someone on a profile.";
    list.appendChild(empty);
  }
}

function normalizePendingRepEntries(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      if (entry && typeof entry === "object") {
        const userId = safeNumber(entry.userId ?? entry.id);
        if (userId === null) return null;
        if (typeof entry.liked === "boolean") {
          return { userId, liked: entry.liked };
        }
        const vote = entry.vote === "up" || entry.vote === "down" ? entry.vote : "up";
        return { userId, liked: vote === "up" };
      }
      const userId = safeNumber(entry);
      return userId === null ? null : { userId, liked: true };
    })
    .filter(Boolean);
}

async function syncPendingReputationVotes() {
  const apiBase = getReputationApiBase();
  if (!apiBase || shouldSkipNonEssentialPolling()) return;

  const actorId = getActorUserId();
  if (actorId === null) return;

  const data = await storageGet("local", { [REPUTATION_PENDING_KEY]: [] });
  const pending = normalizePendingRepEntries(data[REPUTATION_PENDING_KEY]);
  if (pending.length === 0) return;

  const remaining = [];

  for (const entry of pending) {
    try {
      const response = await fetchReputationRequest(`${apiBase}/reputation`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: entry.userId,
          actorUserId: actorId,
          action: entry.liked ? "add" : "remove",
        }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json();
      const myVote = json.hasVoted || json.myVote === "up" ? "up" : null;
      await saveMyReputationVote(entry.userId, myVote);
      await cacheReputation(entry.userId, json.count, myVote);
      invalidateRepApiCache(entry.userId);
    } catch {
      remaining.push(entry);
    }
  }

  await storageSet("local", { [REPUTATION_PENDING_KEY]: remaining });
}

async function unqueuePendingReputationVote(userId) {
  const data = await storageGet("local", { [REPUTATION_PENDING_KEY]: [] });
  const pending = normalizePendingRepEntries(data[REPUTATION_PENDING_KEY]);
  const next = pending.filter((entry) => Number(entry.userId) !== Number(userId));
  if (next.length === pending.length) return;
  await storageSet("local", { [REPUTATION_PENDING_KEY]: next });
}

async function queuePendingReputationVote(userId, liked = true) {
  const data = await storageGet("local", { [REPUTATION_PENDING_KEY]: [] });
  const pending = normalizePendingRepEntries(data[REPUTATION_PENDING_KEY]);
  const numericId = Number(userId);
  const next = pending.filter((entry) => Number(entry.userId) !== numericId);
  next.push({ userId: numericId, liked: Boolean(liked) });
  await storageSet("local", { [REPUTATION_PENDING_KEY]: next });
}

function getUserIdFromRepNode(node) {
  if (!node) return null;
  if (node.dataset?.vortex07UserId) return safeNumber(node.dataset.vortex07UserId);
  const href =
    node.getAttribute("href") ||
    node.querySelector("a[href*='/users/']")?.getAttribute("href") ||
    "";
  return extractUserIdFromHref(href);
}

/* Rep badges only render on the profile page (inline rep widget).
   This cleanup strips any card/list badges left in the DOM. */
async function applyGlobalRepBadges(root = document) {
  root
    .querySelectorAll(".vortex07-global-rep, .vortex07-rep-milestone")
    .forEach((el) => el.remove());

  scheduleExtensionMetaDecorations(root);
}

let globalRepScheduled = false;

function scheduleGlobalRepBadges(root = document) {
  if (globalRepScheduled) {
    return;
  }
  globalRepScheduled = true;

  requestAnimationFrame(async () => {
    globalRepScheduled = false;
    await applyGlobalRepBadges(root);
  });
}

let homeLeaderboardInjected = false;

async function injectHomeLeaderboardStrip() {
  if (!currentSettings.enabled) return;

  const path = window.location.pathname;
  if (path !== "/home" && path !== "/") return;

  if (document.querySelector(".vortex07-home-leaderboard")) {
    homeLeaderboardInjected = true;
    return;
  }

  if (homeLeaderboardInjected) return;

  const gamesSection = document.querySelector("#Container .games-section");
  if (!gamesSection) return;

  homeLeaderboardInjected = true;

  const strip = document.createElement("div");
  strip.className = "vortex07-home-leaderboard";
  strip.innerHTML =
    '<div class="vortex07-home-leaderboard-head"><span class="vortex07-home-leaderboard-title">Vortex07 Rep Leaderboard</span><span class="vortex07-home-leaderboard-sub">Extension users only</span></div><ol class="vortex07-home-leaderboard-list"><li class="vortex07-home-leaderboard-loading">Loading…</li></ol><div class="vortex07-home-leaderboard-foot" hidden><span class="vortex07-home-leaderboard-foot-text">Give rep on profiles to climb the board</span></div>';

  const activityTicker = document.querySelector(".vortex07-activity-ticker");
  if (activityTicker) {
    activityTicker.insertAdjacentElement("afterend", strip);
  } else {
    gamesSection.insertAdjacentElement("afterend", strip);
  }

  const list = strip.querySelector(".vortex07-home-leaderboard-list");
  const rows = await fetchLeaderboard(10);
  list.textContent = "";

  if (!rows.length) {
    const empty = document.createElement("li");
    empty.className = "vortex07-home-leaderboard-empty";
    empty.textContent = "No rep yet — be the first to give rep on a profile.";
    list.appendChild(empty);
    return;
  }

  const userIds = rows
    .map((row) => safeNumber(row.userId))
    .filter((id) => id !== null);
  const avatars = await fetchPlayerAvatars(userIds);
  const displayNames = await resolveLeaderboardDisplayNames(userIds);
  const rankClasses = [
    "vortex07-home-leaderboard-row--gold",
    "vortex07-home-leaderboard-row--silver",
    "vortex07-home-leaderboard-row--bronze",
  ];

  rows.forEach((row, index) => {
    const userId = safeNumber(row.userId);
    if (userId === null) return;

    const li = document.createElement("li");
    li.className = "vortex07-home-leaderboard-row";
    if (rankClasses[index]) li.classList.add(rankClasses[index]);

    const rank = document.createElement("span");
    rank.className = "vortex07-home-leaderboard-rank";
    rank.textContent = String(index + 1);

    const avatar = document.createElement("img");
    avatar.className = "vortex07-home-leaderboard-avatar";
    avatar.alt = "";
    avatar.loading = "lazy";
    avatar.src =
      avatars.get(userId) ||
      `${VORTEX_ORIGIN}/images/placeholder-avatar.png`;

    const nameWrap = document.createElement("span");
    nameWrap.className = "vortex07-home-leaderboard-name-wrap";

    const name = document.createElement("a");
    name.className = "vortex07-home-leaderboard-name";
    name.href = `/users/${userId}/profile`;
    name.textContent =
      displayNames.get(userId) || `@user${userId}`;
    nameWrap.appendChild(name);

    const count = document.createElement("span");
    count.className = "vortex07-home-leaderboard-count";
    count.innerHTML = `<span class="vortex07-global-rep-icon" aria-hidden="true">${repThumbUpSvg(10)}</span><span class="vortex07-global-rep-num">${Number(row.count) || 0}</span>`;

    li.append(rank, avatar, nameWrap, count);
    list.appendChild(li);
  });

  const foot = strip.querySelector(".vortex07-home-leaderboard-foot");
  if (foot) foot.hidden = false;
}

async function hydrateProfileAvatar(header, profileId) {
  if (!header || profileId === null) return;

  const avatar = header.querySelector(".profile-avatar");
  if (!avatar || avatar.dataset.vortex07AvatarHydrated === "1") return;

  const currentSrc = extractAvatarUrl(avatar.getAttribute("src") || "");
  const needsFetch = !currentSrc;

  const applyAvatarUrl = (url) => {
    if (!url) return false;
    avatar.src = url;
    avatar.alt = "";
    avatar.decoding = "async";
    avatar.referrerPolicy = "no-referrer";
    avatar.dataset.vortex07AvatarHydrated = "1";
    return true;
  };

  if (!needsFetch) {
    avatar.decoding = "async";
    avatar.referrerPolicy = "no-referrer";
    fitAvatarImage(avatar);
    avatar.addEventListener(
      "error",
      () => {
        void fetchPlayerAvatars([profileId], { userInitiated: true }).then((map) => {
          const url = map.get(profileId);
          if (url) applyAvatarUrl(url);
        });
      },
      { once: true },
    );
    return;
  }

  const map = await fetchPlayerAvatars([profileId], { userInitiated: true });
  if (applyAvatarUrl(map.get(profileId))) {
    fitAvatarImage(avatar);
  }
}

function normalizeProfileLayout() {
  const header = document.querySelector(".profile-header");
  if (!header) return;

  header.classList.add("vortex07-profile-header");

  const avatarWrap = header.querySelector(".profile-avatar-wrap");
  if (avatarWrap) avatarWrap.classList.add("vortex07-profile-avatar-slot");

  const avatar = header.querySelector(".profile-avatar");
  const profileId = getProfileUserIdFromPage();
  if (avatarWrap && profileId !== null) {
    applyAvatarFrameClasses(avatarWrap, profileId);
  }

  normalizeAvatarImages(header);

  if (profileId !== null) {
    void hydrateProfileAvatar(header, profileId);
  }

  ensureProfileMetaStack(header);
}

function applyAvatarFramesToPage(root = document) {
  const profileId = getProfileUserIdFromPage();
  if (profileId !== null) {
    const profileWrap = root.querySelector(".profile-avatar-wrap");
    if (profileWrap) applyAvatarFrameClasses(profileWrap, profileId);
  }

  root
    .querySelectorAll(".friend-card, .user-card, .user-row")
    .forEach((card) => {
      const userId = getUserIdFromRepNode(card);
      if (userId === null) return;

      const wrap =
        card.querySelector(
          ".friend-avatar-wrap, .user-row-avatar-wrap, [class*='avatar-wrap']",
        ) || card.querySelector(".friend-avatar, .user-row-avatar")?.parentElement;

      if (wrap) applyAvatarFrameClasses(wrap, userId);
    });
}

function normalizeOnlineIndicators() {
  document
    .querySelectorAll(
      ".friend-card, .profile-header, .user-row, .user-card",
    )
    .forEach((card) => {
      const indicators = card.querySelectorAll(
        ".status-dot, [class*='online-status'], [class*='status-indicator'], [data-online], [data-status]",
      );

      indicators.forEach((el) => {
        if (el.closest(".vortex07-reputation-panel")) return;
        if (el.matches("a, button, input, select, textarea")) return;

        el.classList.add("vortex07-status-pill");

        const text = safeLower(
          el.textContent ||
            el.getAttribute("data-status") ||
            el.getAttribute("data-online") ||
            el.className,
        );

        const isOnline =
          text.includes("online") ||
          text.includes("in-game") ||
          text.includes("ingame") ||
          el.classList.contains("online") ||
          el.getAttribute("data-online") === "true" ||
          el.getAttribute("data-status") === "online";

        const isOffline =
          text.includes("offline") ||
          el.classList.contains("offline") ||
          el.getAttribute("data-status") === "offline";

        el.classList.toggle("vortex07-status-online", isOnline);
        el.classList.toggle("vortex07-status-offline", isOffline && !isOnline);
      });
    });
}

/* ========================================================= */
