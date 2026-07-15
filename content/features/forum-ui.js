/* Vortex07 Forum — retro Roblox layout, clean modern polish */
(function initVortex07ForumUi(global) {
  const TITLE_MAX = 120;
  const BODY_MAX = 1000;

  const FORUM_BOARD_GROUPS = [
    {
      label: "VORTEX",
      boards: [
        {
          id: "general",
          label: "General Discussion",
          description: "General chat about Vortex and the extension.",
          icon: "folder",
        },
        {
          id: "help",
          label: "Help & Support",
          description: "Questions about the site or extension.",
          icon: "folder",
        },
        {
          id: "offtopic",
          label: "Off Topic",
          description: "Everything else.",
          icon: "folder",
        },
      ],
    },
    {
      label: "VORTEX07",
      devOnly: true,
      boards: [
        {
          id: "vortex07-dev",
          label: "Developer Lounge",
          description: "Extension development — devs only.",
          icon: "briefcase",
        },
      ],
    },
  ];

  let view = "index";
  let activeBoardId = "general";
  let activeThreadId = null;
  let showNewThread = false;
  let threadSearch = "";
  let threadSort = "active";
  let replyTargetPostId = null;
  let cachedFeed = { threads: [], authors: {}, avatars: {} };
  const boardFeedCache = new Map();

  function isForumDev() {
    const userId =
      typeof getLoggedInUserIdFromNav === "function" ? getLoggedInUserIdFromNav() : null;
    return typeof isVortex07Developer === "function" && isVortex07Developer(userId);
  }

  function getVisibleBoardGroups() {
    return FORUM_BOARD_GROUPS.filter((group) => !group.devOnly || isForumDev());
  }

  function getAllBoards() {
    return getVisibleBoardGroups().flatMap((group) =>
      group.boards.map((board) => ({
        ...board,
        category: group.label,
        devOnly: Boolean(group.devOnly),
      })),
    );
  }

  function canAccessBoard(boardId) {
    const board = getAllBoards().find((row) => row.id === boardId);
    return Boolean(board);
  }

  function formatRelativeWhen(ts) {
    const n = Number(ts);
    if (!Number.isFinite(n) || n <= 0) return "—";
    const diff = Date.now() - n;
    const sec = Math.floor(diff / 1000);
    if (sec < 60) return "now";
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 48) return `${hr}h ago`;
    const day = Math.floor(hr / 24);
    if (day < 14) return `${day}d ago`;
    return formatRobloxWhen(n);
  }

  function formatRobloxWhen(ts) {
    const n = Number(ts);
    if (!Number.isFinite(n) || n <= 0) return "—";
    const d = new Date(n);
    const now = new Date();
    const sameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    if (sameDay) return `Today @ ${time}`;
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      d.getFullYear() === yesterday.getFullYear() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getDate() === yesterday.getDate();
    if (isYesterday) return `Yesterday @ ${time}`;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  function formatWhen(ts) {
    const n = Number(ts);
    if (!Number.isFinite(n) || n <= 0) return "—";
    return new Date(n).toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function renderBody(body) {
    return escapeHtml(body).replace(/\n/g, "<br>");
  }

  function profileFor(userId) {
    const key = String(userId || "");
    return {
      author: cachedFeed.authors[key] || cachedFeed.authors[Number(userId)] || null,
      avatar:
        cachedFeed.avatars[key] ||
        cachedFeed.avatars[Number(userId)] ||
        "",
    };
  }

  function setFeedContext(feed) {
    cachedFeed = {
      threads: feed?.threads || [],
      authors: feed?.authors || {},
      avatars: { ...cachedFeed.avatars, ...(feed?.avatars || {}) },
    };
  }

  function mergeAvatars(avatars = {}) {
    cachedFeed.avatars = { ...cachedFeed.avatars, ...avatars };
  }

  function getBoard(boardId = activeBoardId) {
    return getAllBoards().find((b) => b.id === boardId) || getAllBoards()[0];
  }

  function computeBoardStats(threads = []) {
    let posts = 0;
    threads.forEach((thread) => {
      posts += 1 + (Number(thread.replyCount) || 0);
    });
    return { threads: threads.length, posts };
  }

  function avatarHtml(api, userId, authorName, options = {}) {
    const { avatar } = profileFor(userId);
    const compact = Boolean(options.compact);
    const size = options.size || (options.large ? "lg" : compact ? "sm" : "md");
    if (typeof api?.buildAvatarHtml === "function") {
      return api.buildAvatarHtml(userId, authorName, avatar, compact, size);
    }
    const name = escapeHtml(authorName || "Guest");
    return `<span class="vortex07-forum-avatar-wrap is-guest"><span class="vortex07-forum-avatar-letter">${name.charAt(0).toUpperCase()}</span></span>`;
  }

  function authorLink(authorName, authorUserId) {
    const name = escapeHtml(authorName || "Guest");
    if (authorUserId) {
      return `<a class="vortex07-forum-author" href="/users/${Number(authorUserId)}/profile">${name}</a>`;
    }
    return `<span class="vortex07-forum-author">${name}</span>`;
  }

  function forumMiniIcon(type) {
    const common = 'class="vortex07-rbx-mini-icon" width="13" height="13" viewBox="0 0 13 13" aria-hidden="true"';
    const icons = {
      home: `<svg ${common}><rect x="1" y="5" width="11" height="7" fill="#f4f0d8" stroke="#6a5a2a"/><polygon points="1,5 6.5,1 12,5" fill="#fff8d0" stroke="#6a5a2a"/><rect x="5" y="8" width="3" height="4" fill="#c8b878"/></svg>`,
      new: `<svg ${common}><rect x="2" y="2" width="9" height="9" fill="#fff8d0" stroke="#6a5a2a"/><line x1="6.5" y1="4" x2="6.5" y2="9" stroke="#6a5a2a"/><line x1="4" y1="6.5" x2="9" y2="6.5" stroke="#6a5a2a"/></svg>`,
    };
    return icons[type] || "";
  }

  function isRecentlyActive(ts) {
    const n = Number(ts);
    if (!Number.isFinite(n) || n <= 0) return false;
    return Date.now() - n < 24 * 60 * 60 * 1000;
  }

  function formatForumClock() {
    return new Date().toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function collectUserIdsFromThreads(threads) {
    const ids = new Set();
    threads.forEach((thread) => {
      const id = Number(thread?.authorUserId);
      if (Number.isFinite(id) && id > 0) ids.add(id);
    });
    return [...ids];
  }

  async function hydrateVisibleAvatars(root, api, threads) {
    if (!api) return;
    const ids = collectUserIdsFromThreads(threads);
    if (ids.length && typeof api.refreshAvatars === "function") {
      const { avatars } = await api.refreshAvatars(ids);
      mergeAvatars(avatars);
    }
    if (typeof api.hydrateAvatarsInRoot === "function") {
      await api.hydrateAvatarsInRoot(root);
    }
  }

  async function fetchBoardFeed(api, boardId) {
    if (!api) return { threads: [], authors: {}, avatars: {} };
    const payload =
      typeof api.fetchFeed === "function"
        ? await api.fetchFeed(boardId)
        : { threads: await api.fetchThreads(boardId), authors: {}, avatars: {} };
    boardFeedCache.set(boardId, payload);
    return payload;
  }

  function bindCharCounter(root, selector, max) {
    root.querySelectorAll(selector).forEach((textarea) => {
      const field = textarea.closest(".vortex07-forum-field");
      let counter = field?.querySelector(".vortex07-forum-char-count");
      if (!counter && field) {
        counter = document.createElement("span");
        counter.className = "vortex07-forum-char-count";
        field.appendChild(counter);
      }
      const update = () => {
        const len = textarea.value.length;
        if (counter) counter.textContent = `${len}/${max}`;
      };
      textarea.addEventListener("input", update);
      update();
    });
  }

  function buildShellHtml() {
    return `
      <div class="vortex07-forum-shell vortex07-forum-shell--rbx">
        <div class="vortex07-rbx-toolbar">
          <nav class="vortex07-rbx-navstrip" id="vortex07ForumNavstrip" aria-label="Forum navigation"></nav>
          <div class="vortex07-rbx-clock" id="vortex07ForumClock"></div>
        </div>
        <div class="vortex07-rbx-whereami" id="vortex07ForumBreadcrumb"></div>
        <div class="vortex07-rbx-actionbar" id="vortex07ForumActionbar"></div>
        <div class="vortex07-forum-body" id="vortex07-forumBody">
          <p class="vortex07-forum-loading">Loading…</p>
        </div>
        <footer class="vortex07-rbx-foot">
          <span id="vortex07-forumStatus"></span>
        </footer>
      </div>
    `;
  }

  function canPostForum(api) {
    return typeof api?.canPost === "function" ? Boolean(api.canPost()) : false;
  }

  function forumLoginNoticeHtml() {
    return `<p class="vortex07-forum-login-notice"><a href="/login">Log in</a> to post.</p>`;
  }

  function forumErrorMessage(result, fallback) {
    const reason = result?.reason || result?.error;
    if (reason === "not-logged-in") return "Log in to post.";
    if (reason === "forbidden") return "You don't have access to this board.";
    if (reason === "rate-limit") return "Rate limited — try again later.";
    if (reason === "no-api") return "Forum unavailable.";
    if (reason === "not-deployed") return "Forum server is offline. Deploy the Vortex07 API to use forums.";
    if (reason === "network") return "Network error.";
    if (reason === "empty-title" || reason === "empty-body" || reason === "empty") {
      return "Title and message required.";
    }
    if (reason && reason !== "error") return `Error: ${reason}`;
    return fallback;
  }

  function sortThreads(threads) {
    const rows = [...threads];
    if (threadSort === "newest") {
      rows.sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));
      return rows;
    }
    if (threadSort === "replies") {
      rows.sort(
        (a, b) =>
          (Number(b.replyCount) || 0) - (Number(a.replyCount) || 0) ||
          (Number(b.lastReplyAt) || 0) - (Number(a.lastReplyAt) || 0),
      );
      return rows;
    }
    rows.sort((a, b) => (Number(b.lastReplyAt) || 0) - (Number(a.lastReplyAt) || 0));
    return rows;
  }

  function filterThreads(threads) {
    const q = threadSearch.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter((thread) => {
      const hay = `${thread.title || ""} ${thread.authorName || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }

  function flattenThreadPosts(posts) {
    const op = posts.find((p) => p.isOp) || posts[0];
    if (!op) return [];

    const byParent = new Map();
    posts
      .filter((p) => !p.isOp)
      .forEach((post) => {
        const pid = String(post.parentPostId || op.id);
        if (!byParent.has(pid)) byParent.set(pid, []);
        byParent.get(pid).push(post);
      });

    for (const list of byParent.values()) {
      list.sort((a, b) => (Number(a.createdAt) || 0) - (Number(b.createdAt) || 0));
    }

    const out = [{ post: op, depth: 0 }];
    function walk(parentId, depth) {
      for (const child of byParent.get(String(parentId)) || []) {
        out.push({ post: child, depth });
        walk(child.id, depth + 1);
      }
    }
    walk(op.id, 0);
    return out;
  }

  function bindTopChromeNav(root, api) {
    root.querySelectorAll("#vortex07ForumNavstrip [data-forum-nav]").forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        const target = link.dataset.forumNav || "home";
        if (target === "new" && !canPostForum(api)) return;
        navigateForum(target, root);
      });
    });
  }

  function renderTopChrome(root, api) {
    const nav = root.querySelector("#vortex07ForumNavstrip");
    const clock = root.querySelector("#vortex07ForumClock");
    const canPost = canPostForum(api);

    if (nav) {
      const newLink = canPost
        ? `<span class="vortex07-rbx-navsep">|</span><a href="#" class="vortex07-rbx-navlink" data-forum-nav="new">${forumMiniIcon("new")}New Topic</a>`
        : "";
      nav.innerHTML = `
        <a href="#" class="vortex07-rbx-navlink" data-forum-nav="home">${forumMiniIcon("home")}Home</a>
        ${newLink}
      `;
      bindTopChromeNav(root, api);
    }

    if (clock) {
      const update = () => {
        clock.textContent = `Current time: ${formatForumClock()}`;
      };
      update();
      clearInterval(root.__vortex07ForumClockTimer);
      root.__vortex07ForumClockTimer = setInterval(update, 30000);
    }
  }

  function renderBreadcrumb(root) {
    const el = root.querySelector("#vortex07ForumBreadcrumb");
    if (!el) return;
    const board = getBoard();

    if (view === "index") {
      el.innerHTML = "";
      return;
    }

    const parts = [`<a href="#" class="vortex07-rbx-whereami-link" data-forum-nav="home">Boards</a>`];

    if (view === "board" || view === "new" || view === "thread") {
      parts.push(
        `<span class="vortex07-rbx-whereami-sep">»</span>`,
        view === "board"
          ? `<strong>${escapeHtml(board.label)}</strong>`
          : `<a href="#" class="vortex07-rbx-whereami-link" data-forum-nav="board">${escapeHtml(board.label)}</a>`,
      );
    }

    if (view === "thread" && activeThreadId) {
      const thread = cachedFeed.threads.find((t) => String(t.id) === String(activeThreadId));
      parts.push(
        `<span class="vortex07-rbx-whereami-sep">»</span>`,
        `<strong>${escapeHtml(thread?.title || "Thread")}</strong>`,
      );
    }

    if (view === "new") {
      parts.push(
        `<span class="vortex07-rbx-whereami-sep">»</span>`,
        `<strong>New Topic</strong>`,
      );
    }

    el.innerHTML = parts.join("");
    el.querySelectorAll("[data-forum-nav]").forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        navigateForum(link.dataset.forumNav || "home", root);
      });
    });
  }

  function navigateForum(target, root) {
    const api = root.__vortex07ForumApi;
    if (target === "new" && !canPostForum(api)) return;
    if (target === "home") {
      view = "index";
      activeThreadId = null;
      showNewThread = false;
      replyTargetPostId = null;
    } else if (target === "board") {
      if (!canAccessBoard(activeBoardId)) {
        view = "index";
        activeBoardId = "general";
      } else {
        view = "board";
      }
      activeThreadId = null;
      showNewThread = false;
      replyTargetPostId = null;
    } else if (target === "new") {
      if (!canAccessBoard(activeBoardId)) return;
      view = "board";
      showNewThread = true;
      activeThreadId = null;
      replyTargetPostId = null;
    }
    renderForum(root);
  }

  function renderActionbar(root, api) {
    const bar = root.querySelector("#vortex07ForumActionbar");
    if (!bar) return;
    const canPost = canPostForum(api);

    if (view === "thread") {
      bar.innerHTML = `
        <button type="button" class="vortex07-forum-action-btn vortex07-forum-back" id="vortex07ForumBack">← Back to topics</button>
      `;
      bar.querySelector("#vortex07ForumBack")?.addEventListener("click", () => {
        view = "board";
        activeThreadId = null;
        replyTargetPostId = null;
        renderForum(root);
      });
      return;
    }

    if (view === "board" || view === "new") {
      bar.innerHTML = `
        ${canPost ? `<button type="button" class="vortex07-forum-action-btn vortex07-forum-new-btn" id="vortex07-forumNewThread">New Topic</button>` : ""}
        <select class="vortex07-forum-sort" id="vortex07-forumSort" aria-label="Sort topics">
          <option value="active"${threadSort === "active" ? " selected" : ""}>Active</option>
          <option value="newest"${threadSort === "newest" ? " selected" : ""}>Newest</option>
          <option value="replies"${threadSort === "replies" ? " selected" : ""}>Most replies</option>
        </select>
      `;
      bar.querySelector("#vortex07-forumNewThread")?.addEventListener("click", () => {
        if (!canPostForum(api)) return;
        showNewThread = true;
        renderForum(root);
      });
      bar.querySelector("#vortex07-forumSort")?.addEventListener("change", (event) => {
        threadSort = event.currentTarget.value || "active";
        renderThreadList(root, filterThreads(sortThreads(cachedFeed.threads)), api);
        void hydrateVisibleAvatars(root, api, filterThreads(sortThreads(cachedFeed.threads)));
      });
      return;
    }

    bar.innerHTML = "";
  }

  function bindBoardRowEvents(root) {
    const body = root.querySelector("#vortex07-forumBody");
    if (!body) return;

    body.querySelectorAll(".vortex07-forum-board-row").forEach((row) => {
      const open = () => {
        const boardId = row.getAttribute("data-board-id") || "general";
        if (!canAccessBoard(boardId)) return;
        activeBoardId = boardId;
        view = "board";
        renderForum(root);
      };
      row.addEventListener("click", (event) => {
        if (event.target.closest("a")) return;
        open();
      });
      row.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          open();
        }
      });
    });

    body.querySelectorAll(".vortex07-forum-board-link").forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        const boardId = link.getAttribute("data-board-id") || "general";
        if (!canAccessBoard(boardId)) return;
        activeBoardId = boardId;
        view = "board";
        renderForum(root);
      });
    });
  }

  function renderBoardIndex(root, api, feedsByBoard = new Map()) {
    const body = root.querySelector("#vortex07-forumBody");
    const status = root.querySelector("#vortex07-forumStatus");
    if (!body) return;

    let totalThreads = 0;
    let totalPosts = 0;

    const groupBlocks = getVisibleBoardGroups()
      .map((group) => {
        const boardRows = group.boards
          .map((board) => {
            const feed = feedsByBoard.get(board.id) || { threads: [] };
            const boardThreads = feed.threads || [];
            const boardStats = computeBoardStats(boardThreads);
            totalThreads += boardStats.threads;
            totalPosts += boardStats.posts;

            const last = sortThreads(boardThreads)[0];
            const lastWhen = last
              ? formatRobloxWhen(last.lastReplyAt || last.createdAt)
              : "—";
            const lastAuthor = last
              ? `by ${escapeHtml(last.authorName || "Guest")}`
              : "No posts yet";

            const lastAt = last ? last.lastReplyAt || last.createdAt : 0;
            const showNew = last && isRecentlyActive(lastAt);

            return `
              <tr class="vortex07-forum-board-row" data-board-id="${escapeHtml(board.id)}" tabindex="0">
                <td class="vortex07-forum-board-name-cell">
                  <a href="#" class="vortex07-forum-board-link" data-board-id="${escapeHtml(board.id)}"><span class="vortex07-rbx-board-chevron" aria-hidden="true">»</span>${escapeHtml(board.label)}</a>${showNew ? '<span class="vortex07-rbx-board-new">NEW</span>' : ""}${board.devOnly ? '<span class="vortex07-rbx-board-tag">DEV</span>' : ""}
                  <div class="vortex07-forum-board-desc">${escapeHtml(board.description)}</div>
                </td>
                <td class="vortex07-forum-board-stat">${boardStats.threads}</td>
                <td class="vortex07-forum-board-stat">${boardStats.posts}</td>
                <td class="vortex07-forum-board-last">
                  <div class="vortex07-rbx-last-when"><strong>${lastWhen}</strong></div>
                  <div class="vortex07-forum-board-last-by">${lastAuthor}</div>
                </td>
              </tr>`;
          })
          .join("");

        return `
          <table class="vortex07-forum-classic-table vortex07-forum-board-table">
            <thead>
              <tr class="vortex07-forum-cat-row"><th colspan="4">${escapeHtml(group.label)}</th></tr>
              <tr class="vortex07-forum-head-row">
                <th class="vortex07-forum-board-name-head"></th>
                <th>Threads</th>
                <th>Posts</th>
                <th>Last Post</th>
              </tr>
            </thead>
            <tbody>${boardRows}</tbody>
          </table>`;
      })
      .join("");

    body.innerHTML = `<div class="vortex07-forum-index">${groupBlocks}</div>`;
    if (status) status.textContent = `${totalThreads} topics · ${totalPosts} posts`;

    bindBoardRowEvents(root);
  }

  function renderThreadList(root, threads, api) {
    const body = root.querySelector("#vortex07-forumBody");
    const status = root.querySelector("#vortex07-forumStatus");
    if (!body) return;

    const board = getBoard();

    if (!threads.length) {
      body.innerHTML = `<div class="vortex07-forum-empty"><p>No topics yet.</p></div>`;
      if (status) status.textContent = board.label;
      return;
    }

    const rows = threads
      .map(
        (thread) => `
          <tr class="vortex07-forum-people-row" role="button" tabindex="0" data-thread-id="${escapeHtml(thread.id)}">
            <td class="vortex07-forum-people-avatar">${avatarHtml(api, thread.authorUserId, thread.authorName, { compact: true, size: "sm" })}</td>
            <td class="vortex07-forum-people-name">
              <a href="#" class="vortex07-forum-thread-title" data-thread-id="${escapeHtml(thread.id)}">${escapeHtml(thread.title)}</a>
              <div class="vortex07-forum-people-starter">by ${authorLink(thread.authorName, thread.authorUserId)}</div>
            </td>
            <td class="vortex07-forum-people-stat">${Number(thread.replyCount) || 0}</td>
            <td class="vortex07-forum-people-last">
              <div class="vortex07-rbx-last-when"><strong>${formatRobloxWhen(thread.lastReplyAt || thread.createdAt)}</strong></div>
              <div class="vortex07-forum-board-last-by">by ${escapeHtml(thread.authorName || "Guest")}</div>
            </td>
          </tr>
        `,
      )
      .join("");

    body.innerHTML = `
      <table class="vortex07-forum-classic-table vortex07-forum-people-table">
        <thead>
          <tr class="vortex07-forum-cat-row"><th colspan="4">${escapeHtml(board.label)}</th></tr>
          <tr class="vortex07-forum-head-row">
            <th class="vortex07-forum-people-avatar-head"></th>
            <th>Topic</th>
            <th class="vortex07-forum-people-stat-head">Replies</th>
            <th>Last Post</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;

    if (status) status.textContent = `${threads.length} topic${threads.length === 1 ? "" : "s"}`;

    body.querySelectorAll("[data-thread-id]").forEach((row) => {
      const open = () => {
        activeThreadId = row.dataset.threadId || null;
        view = "thread";
        replyTargetPostId = null;
        renderForum(root);
      };
      row.addEventListener("click", (event) => {
        if (event.target.closest("a")) return;
        open();
      });
      row.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          open();
        }
      });
    });

    body.querySelectorAll(".vortex07-forum-thread-title[data-thread-id]").forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        activeThreadId = link.dataset.threadId || null;
        view = "thread";
        replyTargetPostId = null;
        renderForum(root);
      });
    });

    void hydrateVisibleAvatars(root, api, threads);
  }

  function postActionsHtml(post, threadId, canPost) {
    const pid = escapeHtml(post.id);
    const tid = escapeHtml(threadId);
    const likeCount = Number(post.likeCount) || 0;
    const myLike = Boolean(post.myLike);
    const parts = [];

    if (canPost) {
      parts.push(`<a href="#" class="vortex07-rbx-postlink" data-quote-post="${pid}">Quote</a>`);
      parts.push(`<a href="#" class="vortex07-rbx-postlink" data-reply-to="${pid}">Reply</a>`);
    }

    if (post.canLike) {
      const label = likeCount > 0 ? `Like (${likeCount})` : "Like";
      parts.push(
        `<button type="button" class="vortex07-rbx-like-btn${myLike ? " is-liked" : ""}" data-like-post="${pid}" data-thread-id="${tid}" aria-pressed="${myLike ? "true" : "false"}">${label}</button>`,
      );
    }

    return parts.length
      ? `<div class="vortex07-rbx-post-actions">${parts.join('<span class="vortex07-rbx-postlink-sep">|</span>')}</div>`
      : "";
  }

  function classicPostHtml(api, post, threadId, postNum, depth = 0) {
    const canPost = canPostForum(api);
    const isOp = Boolean(post.isOp) || postNum === 1;

    return `
      <article class="vortex07-rbx-post${isOp ? " is-op" : ""}" data-post-id="${escapeHtml(post.id)}" data-depth="${depth}">
        <aside class="vortex07-rbx-post-user">
          ${avatarHtml(api, post.authorUserId, post.authorName, { compact: true, size: "sm" })}
          <div class="vortex07-rbx-post-username">${authorLink(post.authorName, post.authorUserId)}</div>
        </aside>
        <section class="vortex07-rbx-post-main">
          <header class="vortex07-rbx-post-head">
            <span class="vortex07-rbx-posted">${formatWhen(post.createdAt)}</span>
            <span class="vortex07-rbx-post-number">#${postNum}</span>
          </header>
          <div class="vortex07-rbx-post-body">${renderBody(post.body)}</div>
          <footer class="vortex07-rbx-post-foot">${postActionsHtml(post, threadId, canPost)}</footer>
        </section>
      </article>
    `;
  }

  function renderNewThreadForm(root, api) {
    const body = root.querySelector("#vortex07-forumBody");
    const status = root.querySelector("#vortex07-forumStatus");
    if (!body) return;

    if (!canPostForum(api)) {
      showNewThread = false;
      body.innerHTML = `<div class="vortex07-forum-empty">${forumLoginNoticeHtml()}</div>`;
      return;
    }

    if (!canAccessBoard(activeBoardId)) {
      showNewThread = false;
      body.innerHTML = `<div class="vortex07-forum-empty"><p>You don't have access to this board.</p></div>`;
      return;
    }

    const board = getBoard();

    body.innerHTML = `
      <form class="vortex07-forum-form vortex07-forum-new-topic-form" id="vortex07-forumNewForm">
        <input type="hidden" name="categoryId" value="${escapeHtml(activeBoardId)}" />
        <fieldset class="vortex07-forum-group">
          <legend>Post New Topic — ${escapeHtml(board.label)}</legend>
          <label class="vortex07-forum-field">
            <span>Title</span>
            <input type="text" name="title" maxlength="${TITLE_MAX}" required class="vortex07-forum-input" />
          </label>
          <label class="vortex07-forum-field">
            <span>Message</span>
            <textarea name="body" maxlength="${BODY_MAX}" rows="8" required class="vortex07-forum-input"></textarea>
          </label>
          <div class="vortex07-forum-form-actions">
            <button type="submit" class="vortex07-forum-submit vortex07-forum-action-btn">Post Topic</button>
            <button type="button" class="vortex07-forum-cancel-reply" id="vortex07ForumCancelNew">Cancel</button>
          </div>
          <p class="vortex07-forum-hint" id="vortex07-forumFormHint"></p>
        </fieldset>
      </form>
    `;

    bindCharCounter(body, "#vortex07-forumNewForm textarea", BODY_MAX);

    body.querySelector("#vortex07ForumCancelNew")?.addEventListener("click", () => {
      showNewThread = false;
      renderForum(root);
    });

    body.querySelector("#vortex07-forumNewForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const hint = body.querySelector("#vortex07-forumFormHint");
      const submit = form.querySelector(".vortex07-forum-submit");

      submit.disabled = true;
      if (status) status.textContent = "Posting…";

      const categoryId = form.categoryId?.value || activeBoardId;

      const result = await api.createThread({
        categoryId,
        title: form.title?.value || "",
        body: form.body?.value || "",
      });

      submit.disabled = false;

      if (!result.ok) {
        const msg = forumErrorMessage(result, "Could not post.");
        if (hint) hint.textContent = msg;
        if (status) status.textContent = board.label;
        return;
      }

      showNewThread = false;
      view = "thread";
      activeThreadId = result.thread?.id || null;
      replyTargetPostId = null;
      if (result.threadView) {
        root.__vortex07ForumThreadCache = result.threadView;
        if (result.profiles) setFeedContext({ ...cachedFeed, ...result.profiles });
      }
      renderForum(root);
    });
  }

  function focusReplyComposer(root, postId) {
    const body = root.querySelector("#vortex07-forumBody");
    if (!body) return;
    const form = body.querySelector("#vortex07-forumReplyForm");
    const textarea = form?.querySelector("textarea");
    const banner = body.querySelector("#vortex07ForumReplyBanner");
    const cancelBtn = body.querySelector("#vortex07ForumCancelReply");
    const postEl = body.querySelector(`[data-post-id="${postId}"]`);
    const authorName =
      postEl?.querySelector(".vortex07-rbx-post-username")?.textContent?.trim() || "this post";

    replyTargetPostId = postId || null;
    if (form) form.dataset.parentId = postId || form.dataset.defaultParent || "";
    if (banner) {
      banner.hidden = !postId;
      banner.innerHTML = postId
        ? `Replying to <strong>${escapeHtml(authorName)}</strong>`
        : "";
    }
    if (cancelBtn) cancelBtn.hidden = !postId;
    if (textarea) {
      if (postId) {
        textarea.placeholder = `Reply to ${authorName}…`;
        textarea.focus();
        form?.closest(".vortex07-rbx-reply-box")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      } else {
        textarea.placeholder = "Write a reply…";
      }
    }
  }

  function bindThreadInteractions(root, data, api) {
    const body = root.querySelector("#vortex07-forumBody");
    const { thread } = data;
    if (!body || !thread) return;

    bindCharCounter(body, "textarea", BODY_MAX);

    body.querySelectorAll("[data-quote-post]").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        const postEl = body.querySelector(`[data-post-id="${btn.dataset.quotePost}"]`);
        const text = postEl?.querySelector(".vortex07-rbx-post-body")?.textContent?.trim() || "";
        const author =
          postEl?.querySelector(".vortex07-rbx-post-username")?.textContent?.trim() || "user";
        const textarea = body.querySelector("#vortex07-forumReplyForm textarea");
        focusReplyComposer(root, btn.dataset.quotePost || "");
        if (textarea) {
          textarea.value = `[quote="${author}"]${text.slice(0, 400)}[/quote]\n\n`;
          textarea.focus();
        }
      });
    });

    body.querySelectorAll("[data-reply-to]").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        focusReplyComposer(root, btn.dataset.replyTo || "");
      });
    });

    body.querySelector("#vortex07ForumCancelReply")?.addEventListener("click", () => {
      focusReplyComposer(root, "");
    });

    body.querySelectorAll("[data-like-post]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (typeof api.likePost !== "function") return;
        btn.disabled = true;
        const result = await api.likePost({
          threadId: btn.dataset.threadId || thread.id,
          postId: btn.dataset.likePost,
        });
        btn.disabled = false;
        if (!result.ok) return;
        delete root.__vortex07ForumThreadCache;
        renderForum(root);
      });
    });

    body.querySelector("#vortex07-forumReplyForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const hint = body.querySelector("#vortex07-forumReplyHint");
      const submit = form.querySelector(".vortex07-forum-submit");
      const opId = form.dataset.parentId || form.dataset.defaultParent || "";

      submit.disabled = true;
      const result = await api.replyToThread({
        threadId: thread.id,
        parentPostId: opId || null,
        body: form.body?.value || "",
      });
      submit.disabled = false;

      if (!result.ok) {
        if (hint) hint.textContent = forumErrorMessage(result, "Could not reply.");
        return;
      }

      form.reset();
      replyTargetPostId = null;
      focusReplyComposer(root, "");
      bindCharCounter(body, "#vortex07-forumReplyForm textarea", BODY_MAX);
      delete root.__vortex07ForumThreadCache;
      renderForum(root);
    });
  }

  function renderThreadView(root, data, api) {
    const body = root.querySelector("#vortex07-forumBody");
    const status = root.querySelector("#vortex07-forumStatus");
    if (!body || !data?.thread) return;

    const { thread, posts = [] } = data;
    const flat = flattenThreadPosts(posts);

    const postBlocks = flat
      .map(({ post, depth }, index) => classicPostHtml(api, post, thread.id, index + 1, depth))
      .join("");

    const op = flat[0]?.post;
    const opId = op ? String(op.id) : "";
    const canPost = canPostForum(api);

    body.innerHTML = `
      <div class="vortex07-rbx-thread">
        <table class="vortex07-forum-classic-table vortex07-rbx-thread-title">
          <thead>
            <tr class="vortex07-forum-cat-row"><th colspan="2">${escapeHtml(thread.title)}</th></tr>
          </thead>
        </table>
        <div class="vortex07-rbx-postlist">${postBlocks}</div>
        ${
          canPost
            ? `<form class="vortex07-forum-form vortex07-forum-reply-form" id="vortex07-forumReplyForm" data-parent-id="${escapeHtml(opId)}" data-default-parent="${escapeHtml(opId)}">
          <fieldset class="vortex07-forum-group vortex07-rbx-reply-box">
            <legend>Post Reply</legend>
            <p class="vortex07-forum-reply-banner" id="vortex07ForumReplyBanner" hidden></p>
            <label class="vortex07-forum-field">
              <span class="vortex07-forum-sr-only">Message</span>
              <textarea name="body" maxlength="${BODY_MAX}" rows="4" required class="vortex07-forum-input" placeholder="Write a reply…"></textarea>
            </label>
            <div class="vortex07-forum-form-actions">
              <button type="submit" class="vortex07-forum-submit vortex07-forum-action-btn">Post Reply</button>
              <button type="button" class="vortex07-forum-cancel-reply" id="vortex07ForumCancelReply" hidden>Cancel reply</button>
            </div>
            <p class="vortex07-forum-hint" id="vortex07-forumReplyHint"></p>
          </fieldset>
        </form>`
            : forumLoginNoticeHtml()
        }
      </div>
    `;

    if (status) status.textContent = thread.title;
    bindThreadInteractions(root, data, api);
    focusReplyComposer(root, replyTargetPostId || "");
    void hydrateVisibleAvatars(
      root,
      api,
      flat.map(({ post }) => ({ authorUserId: post.authorUserId })),
    );
  }

  async function renderForum(root) {
    const api = root.__vortex07ForumApi;
    const body = root.querySelector("#vortex07-forumBody");
    if (!api || !body) return;

    renderTopChrome(root, api);
    renderBreadcrumb(root);
    renderActionbar(root, api);

    if (showNewThread) {
      view = "board";
      renderNewThreadForm(root, api);
      return;
    }

    if (view === "thread" && activeThreadId) {
      const cached = root.__vortex07ForumThreadCache;
      if (cached?.thread?.id === activeThreadId) {
        delete root.__vortex07ForumThreadCache;
        if (cached.authors || cached.avatars) {
          setFeedContext({
            ...cachedFeed,
            authors: { ...cachedFeed.authors, ...(cached.authors || {}) },
            avatars: { ...cachedFeed.avatars, ...(cached.avatars || {}) },
          });
        }
        renderThreadView(root, cached, api);
        return;
      }

      body.innerHTML = '<p class="vortex07-forum-loading">Loading…</p>';
      const data = await api.fetchThread(activeThreadId);
      if (!data?.thread) {
        body.innerHTML = '<p class="vortex07-forum-empty">Not found.</p>';
        return;
      }
      if (!canAccessBoard(data.thread.categoryId)) {
        body.innerHTML = '<p class="vortex07-forum-empty">You don\'t have access to this thread.</p>';
        return;
      }
      activeBoardId = data.thread.categoryId || activeBoardId;
      setFeedContext({
        threads: cachedFeed.threads,
        authors: data.authors || {},
        avatars: data.avatars || {},
      });
      renderThreadView(root, data, api);
      return;
    }

    if (view === "index") {
      body.innerHTML = '<p class="vortex07-forum-loading">Loading…</p>';
      const boards = getAllBoards();
      const feeds = await Promise.all(
        boards.map(async (board) => {
          const payload = await fetchBoardFeed(api, board.id);
          return [board.id, payload];
        }),
      );
      const feedsByBoard = new Map(feeds);
      const allThreads = feeds.flatMap(([, feed]) => feed.threads || []);
      setFeedContext({
        threads: allThreads,
        authors: Object.assign({}, ...feeds.map(([, f]) => f.authors || {})),
        avatars: Object.assign({}, ...feeds.map(([, f]) => f.avatars || {})),
      });
      renderBoardIndex(root, api, feedsByBoard);
      return;
    }

    if (!canAccessBoard(activeBoardId)) {
      view = "index";
      activeBoardId = "general";
      renderForum(root);
      return;
    }

    body.innerHTML = '<p class="vortex07-forum-loading">Loading…</p>';
    const payload = await fetchBoardFeed(api, activeBoardId);
    setFeedContext(payload);
    renderThreadList(root, filterThreads(sortThreads(payload.threads || [])), api);
  }

  function mountForumPage(root, version, api) {
    if (!root) return;
    root.__vortex07ForumApi = api;
    root.innerHTML = buildShellHtml(version);
    view = "index";
    activeBoardId = "general";
    activeThreadId = null;
    showNewThread = false;
    replyTargetPostId = null;
    threadSearch = "";
    threadSort = "active";
    cachedFeed = { threads: [], authors: {}, avatars: {} };
    boardFeedCache.clear();
    renderForum(root);
  }

  global.Vortex07ForumUi = {
    mountForumPage,
    renderForum,
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
