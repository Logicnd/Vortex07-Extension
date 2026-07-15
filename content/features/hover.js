/* ========================================================= */
/* ================= HOVER PREVIEW ========================= */
/* ========================================================= */

let hoverX = 0;
let hoverY = 0;
let hoverLoopStarted = false;

function createHoverPreview() {
  let preview = document.getElementById("vortex07-hover-preview");

  if (!preview) {
    preview = document.createElement("div");
    preview.id = "vortex07-hover-preview";
    preview.style.position = "fixed";
    preview.style.zIndex = "2147483647";
    preview.style.pointerEvents = "none";
    preview.style.display = "none";
    preview.style.opacity = "1";
    (document.body || document.documentElement).appendChild(preview);
  }

  return preview;
}

function createHoverStatusPill(onlineStatus) {
  const pill = document.createElement("span");
  pill.className = `vortex07-hover-status-pill vortex07-hover-status-pill--${onlineStatus || "offline"}`;
  pill.textContent =
    onlineStatus === "in-game" ? "In Game" : onlineStatus === "online" ? "Online" : "Offline";
  return pill;
}

function showHoverPreview(player, event) {
  const preview = createHoverPreview();
  clearElement(preview);
  preview.className = "vortex07-hover-preview-rich";

  const container = document.createElement("div");
  container.className = "vortex07-hover-preview-body";

  const avatarWrap = document.createElement("div");
  avatarWrap.className = "vortex07-hover-avatar-wrap";
  applyAvatarFrameClasses(avatarWrap, player.id);

  const avatarSrc = safeImageSrc(player.avatarUrl, "");

  if (avatarSrc) {
    const img = document.createElement("img");
    img.src = avatarSrc;
    img.alt = "";
    img.loading = "lazy";
    img.className = "vortex07-hover-avatar-img";
    avatarWrap.appendChild(img);
  } else {
    const fallback = document.createElement("div");
    fallback.className = "vortex07-hover-avatar-fallback";
    fallback.textContent = initial(player.username);
    fallback.style.background = avatarColor(player.username);
    avatarWrap.appendChild(fallback);
  }

  if (player.onlineStatus) {
    avatarWrap.appendChild(createOnlineDot(player.onlineStatus));
  }

  container.appendChild(avatarWrap);

  const nameRow = document.createElement("div");
  nameRow.className = "vortex07-hover-name-row";
  nameRow.dataset.vortex07UserId = String(player.id);

  const name = document.createElement("span");
  name.className = "vortex07-hover-name";
  name.textContent = player.displayName || player.username || "Unknown";
  nameRow.appendChild(name);
  container.appendChild(nameRow);

  const user = document.createElement("div");
  user.className = "vortex07-hover-handle";
  user.textContent = `@${player.username || "unknown"}`;
  container.appendChild(user);

  const extStatusHost = document.createElement("div");
  extStatusHost.className = "vortex07-hover-ext-status-host";
  container.appendChild(extStatusHost);

  const meta = document.createElement("div");
  meta.className = "vortex07-hover-meta";

  if (player.onlineStatus) {
    meta.appendChild(createHoverStatusPill(player.onlineStatus));
  }

  container.appendChild(meta);

  if (player.isBanned) {
    const banned = document.createElement("div");
    banned.className = "vortex07-hover-banned";
    banned.textContent = "BANNED";
    container.appendChild(banned);
  }

  const hint = document.createElement("div");
  hint.className = "vortex07-hover-hint";
  hint.textContent = "View profile →";
  container.appendChild(hint);

  preview.appendChild(container);

  hoverX = event.clientX;
  hoverY = event.clientY;

  preview.style.left = hoverX + 12 + "px";
  preview.style.top = hoverY + 12 + "px";
  preview.style.display = "block";
  preview.style.opacity = "1";

  void hydrateHoverPreviewStatus(extStatusHost, player.id);
  if (typeof decorateMythHoverPreview === "function") {
    decorateMythHoverPreview(preview, player.id);
  }
}

async function hydrateHoverPreviewStatus(host, userId) {
  if (!host || !currentSettings.showExtensionStatus) return;

  const numericId = safeNumber(userId);
  if (numericId === null) return;

  const status = await fetchUserStatus(numericId);
  const line = renderExtensionStatusEl(status, {
    className: "vortex07-hover-ext-status",
    compact: true,
    userId: numericId,
  });

  clearElement(host);
  if (line) host.appendChild(line);
}

function moveHoverPreview(event) {
  hoverX = event.clientX;
  hoverY = event.clientY;

  const preview = document.getElementById("vortex07-hover-preview");
  if (!preview || preview.style.display === "none") return;

  preview.style.left = hoverX + 12 + "px";
  preview.style.top = hoverY + 12 + "px";
}

function hideHoverPreview() {
  const preview = document.getElementById("vortex07-hover-preview");
  if (!preview) return;
  preview.style.display = "none";
}

function startHoverLoop() {
  // Hover preview uses direct positioning — no smooth follow loop.
}

/* ========================================================= */
