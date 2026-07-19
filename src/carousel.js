/* Friends carousel, friend avatar hydration, and search rows — simplified page-wrap pagination. */

let friendAvatarHydrateToken = 0;
let friendAvatarHydrateTimer = null;

function getFriendCardAvatarImg(card) {
  if (!card) return null;
  const wrap = card.querySelector(".friend-avatar-wrap, [class*='avatar-wrap']");
  const scoped = wrap?.querySelector(".friend-avatar, img");
  if (scoped && !scoped.closest(".vortex07-retro-badge-wrap")) return scoped;
  const direct = card.querySelector(".friend-avatar");
  return direct && !direct.closest(".vortex07-retro-badge-wrap") ? direct : null;
}

function friendAvatarNeedsHydration(img) {
  if (!img) return false;
  const dataSrc = safeString(img.getAttribute("data-src") || img.dataset.src || img.dataset.avatar || "");
  const attr = safeString(img.getAttribute("src") || "");
  if (dataSrc && !attr) {
    const resolved = safeImageSrc(dataSrc, "");
    if (resolved) {
      img.src = resolved;
      return friendAvatarNeedsHydration(img);
    }
  }
  if (!attr) return true;
  const src = safeImageSrc(attr, "");
  if (!src) return true;
  if (/placeholder|default-avatar|no-avatar|noob\.png/i.test(attr)) return true;
  if (img.complete && img.naturalWidth === 0) return true;
  return false;
}

async function hydrateFriendCardAvatars(root = document) {
  const scope = root instanceof Element ? root : document;
  const pending = new Map();
  scope.querySelectorAll(".friend-card").forEach((card) => {
    const img = getFriendCardAvatarImg(card);
    if (!img) return;
    const userId = getUserIdFromRepNode(card);
    if (userId === null) return;
    if (!friendAvatarNeedsHydration(img)) return;
    pending.set(userId, img);
  });
  if (pending.size === 0) return;
  const token = ++friendAvatarHydrateToken;
  const avatarMap = await fetchPlayerAvatars([...pending.keys()], { userInitiated: true });
  if (token !== friendAvatarHydrateToken) return;
  pending.forEach((img, userId) => {
    const src = safeImageSrc(avatarMap.get(userId) || "", "");
    if (!src) return;
    img.referrerPolicy = "no-referrer";
    img.decoding = "async";
    img.src = src;
    fitAvatarImage(img);
  });
  normalizeAvatarImages(root);
}

function scheduleFriendCardAvatarHydration(root) {
  clearTimeout(friendAvatarHydrateTimer);
  friendAvatarHydrateTimer = setTimeout(() => {
    friendAvatarHydrateTimer = null;
    void hydrateFriendCardAvatars(root);
  }, 80);
}

function makePlayerRow(player, options = {}) {
  const id = safeNumber(player.id);
  if (id === null) return null;
  const username = player.username || "unknown";
  const query = options.isRecent ? "" : lastSearchQuery;
  const row = document.createElement("div");
  row.className = "vortex07-user-result vortex07-player-result";
  row.dataset.vortex07UserId = String(id);
  const mainLink = document.createElement("a");
  mainLink.className = "vortex07-player-result-link";
  mainLink.href = `/users/${id}/profile`;
  mainLink.appendChild(makeUserAvatarEl(id, username, player.avatarUrl, { onlineStatus: player.onlineStatus }));
  const info = document.createElement("span");
  info.className = "vortex07-user-info";
  const nameLine = document.createElement("span");
  nameLine.className = "vortex07-user-name";
  nameLine.innerHTML = highlightMatch(username, query);
  info.appendChild(nameLine);
  const status = player.onlineStatus || "";
  const lastOnlineAt = Number(player.lastOnlineAt) || 0;
  if (status !== "online" && status !== "in-game" && lastOnlineAt > 0) {
    const lastOnline = document.createElement("span");
    lastOnline.className = "vortex07-user-last-online";
    lastOnline.textContent = formatLastOnlineLabel(lastOnlineAt);
    info.appendChild(lastOnline);
  }
  mainLink.appendChild(info);
  if (player.isBanned) {
    const badge = document.createElement("span");
    badge.className = "vortex07-user-banned";
    badge.textContent = "BANNED";
    mainLink.appendChild(badge);
  }
  row.appendChild(mainLink);
  mainLink.addEventListener("click", () => {
    void pushRecentPlayer(player);
    void snapshotPlayerToArchive(player, "search");
  });
  if (typeof decorateScarySearchRow === "function") {
    decorateScarySearchRow(row, id);
  }
  return row;
}

function makeMutedRow(text) {
  const row = document.createElement("div");
  row.className = "vortex07-user-result vortex07-user-muted";
  row.textContent = text;
  return row;
}

function clearSearchResults() {
  const resultsBox = document.getElementById("vortex07-user-results");
  if (!resultsBox) return;
  clearElement(resultsBox);
  hideResultsBox();
}

function clearUserResults() {
  clearSearchResults();
}

function enhanceLegacyStatusLabels() {
  // Status text labels intentionally disabled.
  // Native site status dots may remain styled by CSS if needed.
}

function flattenCarousels() {
  document
    .querySelectorAll(
      ".carousel-wrap, .carousel-track, .carousel-inner, .carousel-slider, [class*='carousel']",
    )
    .forEach((el) => {
      if (isInsideVortexShell(el) && el.closest("#Header, #Banner, .Navigation")) return;
      if (isFriendCarouselProtected(el)) return;
      if (typeof el.className === "string" && el.className.includes("vortex07")) return;
      el.style.transform = "none";
      el.style.transition = "none";
      el.style.animation = "none";
      el.style.overflow = "visible";
      el.style.width = "100%";
      el.style.maxWidth = "100%";
    });

  document
    .querySelectorAll(".carousel-arrow, .carousel-btn, [class*='carousel-prev'], [class*='carousel-next']")
    .forEach((el) => {
      if (isFriendCarouselProtected(el)) return;
      if (el.classList.contains("vortex07-carousel-btn")) return;
      if (typeof el.className === "string" && el.className.includes("vortex07")) return;
      el.style.display = "none";
      el.setAttribute("aria-hidden", "true");
      el.tabIndex = -1;
    });

  document.querySelectorAll(".carousel-wrap").forEach((wrap) => {
    if (isFriendCarouselProtected(wrap)) return;
    wrap.dataset.vortex07Flattened = "true";
  });
}

function isFriendCarouselRow(row) {
  if (!row?.matches?.(".friends-grid, .friends-row")) return false;
  if (!row.querySelector(".friend-card, a[href*='/users/']")) return false;
  if (row.closest(".user-list, .user-grid, #tab-content, .tab-content")) return false;
  if (isDedicatedFriendsPage() && row.closest(".friends-list, .friends-page, [class*='friends-page']")) {
    return false;
  }
  return true;
}

function isFriendCarouselProtected(el) {
  if (!el) return false;
  if (el.closest(".friends-section, .vortex07-friends-carousel-wrap")) return true;
  const wrap = el.closest(".carousel-wrap");
  if (wrap && isFriendCarouselRow(wrap.querySelector(".friends-grid, .friends-row"))) return true;
  return isFriendCarouselRow(el.closest(".friends-grid, .friends-row"));
}

function isDedicatedFriendsPage() {
  if (resolvePageRouteKey() !== "social") return false;
  const page = document.querySelector("#Body > .page, #Body > .catalog-container");
  if (!page) return true;
  const activeTab = page.querySelector(
    ".tab-bar .active, .tab-bar [aria-selected='true'], .tab-bar .tab-active",
  );
  if (activeTab && safeLower(activeTab.textContent).includes("friend")) return true;
  const hasHomeSections = page.querySelector(".home-section, .games-section");
  const hasFriendsMain = page.querySelector(
    ".friends-list, .friends-page, [class*='friends-page'], .friends-tab-panel",
  );
  return Boolean(hasFriendsMain && !hasHomeSections);
}

function shouldEnhanceFriendCarousels() {
  if (!currentSettings.friendRowCarousels) return false;
  if (isDedicatedFriendsPage()) return false;
  return true;
}

function removeFriendCarousels(root = document) {
  const rows = root instanceof Element
    ? Array.from(root.querySelectorAll(".friends-row, .friends-grid"))
    : Array.from(document.querySelectorAll(".friends-row, .friends-grid"));
  rows.forEach((row) => {
    if (row.dataset.v07Paginated) unwrapFriendsRow(row);
  });
}

// --- Simplified page-wrap pagination ---

const FRIENDS_CAROUSEL_PAGE_SIZE = 9;
const boundFriendsRows = new WeakSet();
const rowFriendCounts = new WeakMap();

function findFriendsRows() {
  return Array.from(document.querySelectorAll(".friends-grid, .friends-row"));
}

function getWrap(row) {
  return row?.closest(".friends-section, .carousel-wrap, .vortex07-friends-carousel-wrap") || row?.parentElement;
}

function getFriendRowCards(row) {
  return [...row.querySelectorAll(".friend-card, a[href*='/users/']")].filter(
    (el) => el.matches(".friend-card") || !el.closest(".friend-card"),
  );
}

function getRowFriendCount(row) {
  return rowFriendCounts.get(row) || 0;
}

function setRowFriendCount(row, n) {
  rowFriendCounts.set(row, n);
}

function unwrapFriendsRow(row) {
  if (!row || !row.dataset.v07Paginated) return;
  const pages = row.querySelectorAll(":scope > .v07-friends-page");
  if (!pages.length) return;
  row.dataset.v07Mutating = "1";
  try {
    pages.forEach((page) => {
      while (page.firstChild) row.appendChild(page.firstChild);
      page.remove();
    });
    delete row.dataset.v07Paginated;
    row.classList.remove("vortex07-friends-row-paged", "v07-friends-row-legacy");
    row.scrollLeft = 0;
  } finally {
    delete row.dataset.v07Mutating;
  }
}

function paginateFriendsRow(row) {
  if (!row || row.dataset.v07Paginated || row.classList.contains("vortex07-friends-row-paged")) return;
  const cards = getFriendRowCards(row);
  if (cards.length === 0) return;
  if (cards.length <= FRIENDS_CAROUSEL_PAGE_SIZE) return;
  const lastCount = getRowFriendCount(row);
  if (cards.length === lastCount && row.querySelectorAll(".v07-friends-page").length > 0) return;

  unwrapFriendsRow(row);
  row.dataset.v07Mutating = "1";
  try {
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < cards.length; i += FRIENDS_CAROUSEL_PAGE_SIZE) {
      const page = document.createElement("div");
      page.className = "v07-friends-page";
      for (let j = i; j < i + FRIENDS_CAROUSEL_PAGE_SIZE && j < cards.length; j++) {
        page.appendChild(cards[j]);
      }
      fragment.appendChild(page);
    }
    row.appendChild(fragment);
    row.dataset.v07Paginated = "1";
    row.classList.add("vortex07-friends-row-paged", "v07-friends-row-legacy");
    row.style.overflowX = "hidden";
    row.style.transform = "none";
    row.style.transition = "none";
    row.style.animation = "none";
    let parent = row.parentElement;
    while (parent && !parent.matches(".friends-section, .carousel-wrap, .vortex07-friends-carousel-wrap, #Container, #Body")) {
      parent.style.transform = "none";
      parent.style.transition = "none";
      parent.style.animation = "none";
      parent = parent.parentElement;
    }
    setRowFriendCount(row, cards.length);
    row.scrollLeft = 0;
  } finally {
    delete row.dataset.v07Mutating;
  }
  updateCarouselArrows(row);
  scheduleFriendCardAvatarHydration(row);
}

function retrofitCarouselArrow(btn, glyph) {
  if (!btn) return;
  btn.querySelector("svg")?.remove();
  btn.textContent = glyph;
  btn.setAttribute("aria-label", glyph === "\u00ab" ? "Previous page" : "Next page");
}

function updateCarouselArrows(row) {
  const wrap = getWrap(row);
  if (!wrap) return;
  const prev = wrap.querySelector(".carousel-prev");
  const next = wrap.querySelector(".carousel-next");
  retrofitCarouselArrow(prev, "\u00ab");
  retrofitCarouselArrow(next, "\u00bb");
  const pageCount = row.querySelectorAll(".v07-friends-page").length;
  const singlePage = pageCount <= 1;
  wrap.classList.toggle("v07-friends-single", singlePage);
  if (prev) prev.hidden = singlePage || row.scrollLeft <= 1;
  if (next) {
    next.hidden = singlePage || row.scrollLeft + row.clientWidth >= row.scrollWidth - 2;
  }
}

function bindFriendsRow(row) {
  if (!row || boundFriendsRows.has(row)) return;
  boundFriendsRows.add(row);
  const observer = new MutationObserver(() => {
    if (row.dataset.v07Mutating) return;
    if (getFriendRowCards(row).length > 0 && !row.dataset.v07Paginated) {
      scheduleRowUpdate(row);
    } else if (row.dataset.v07Paginated) {
      scheduleRowUpdate(row);
    }
  });
  observer.observe(row, { childList: true });
  let scrollQueued = false;
  row.addEventListener(
    "scroll",
    () => {
      if (scrollQueued) return;
      scrollQueued = true;
      requestAnimationFrame(() => {
        scrollQueued = false;
        updateCarouselArrows(row);
      });
    },
    { passive: true },
  );
  const wrap = getWrap(row);
  if (wrap) {
    const prev = wrap.querySelector(".carousel-prev");
    const next = wrap.querySelector(".carousel-next");
    if (prev) prev.addEventListener("click", () => row.scrollBy({ left: -row.clientWidth, behavior: "smooth" }));
    if (next) next.addEventListener("click", () => row.scrollBy({ left: row.clientWidth, behavior: "smooth" }));
  }
}

function scheduleRowUpdate(row) {
  if (row.dataset.v07UpdateQueued) return;
  row.dataset.v07UpdateQueued = "1";
  setTimeout(() => {
    delete row.dataset.v07UpdateQueued;
    handleRowUpdate(row);
  }, 0);
}

function handleRowUpdate(row) {
  if (!row || !shouldEnhanceFriendCarousels()) return;
  const cards = getFriendRowCards(row);
  if (row.dataset.v07Paginated) {
    const lastCount = getRowFriendCount(row);
    if (cards.length !== lastCount || row.querySelectorAll(".v07-friends-page").length === 0) {
      unwrapFriendsRow(row);
      paginateFriendsRow(row);
    }
    updateCarouselArrows(row);
    return;
  }
  if (row.querySelector(":scope > .skel-card")) return;
  if (row.querySelector(":scope > .empty-msg")) {
    updateCarouselArrows(row);
    return;
  }
  if (cards.length > 0) {
    paginateFriendsRow(row);
  }
}

function ensureFriendsCarousel() {
  if (!shouldEnhanceFriendCarousels()) return;
  findFriendsRows().forEach((row) => {
    if (!isFriendCarouselRow(row)) return;
    bindFriendsRow(row);
    if (getFriendRowCards(row).length > 0 && !row.dataset.v07Paginated) {
      paginateFriendsRow(row);
    } else if (row.dataset.v07Paginated) {
      updateCarouselArrows(row);
    }
  });
}

function enhanceFriendsCarousels(root = document) {
  if (!shouldEnhanceFriendCarousels()) {
    if (isDedicatedFriendsPage()) removeFriendCarousels(root);
    return;
  }
  if (root instanceof Element && root.matches?.(".friends-row, .friends-grid")) {
    bindFriendsRow(root);
    handleRowUpdate(root);
  }
  ensureFriendsCarousel();
}
