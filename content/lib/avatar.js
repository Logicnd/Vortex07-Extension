/** Shared avatar helpers (loaded before content scripts). */

const VORTEX07_AVATAR_FRAME_IMG_SELECTORS = [
  ".profile-avatar-wrap > .profile-avatar",
  ".vortex07-profile-avatar-slot > .profile-avatar",
  ".friend-avatar-wrap > .friend-avatar",
  ".friend-avatar-wrap > img:not(.vortex07-retro-badge-img)",
  ".user-row-avatar-wrap > .user-row-avatar",
  ".user-row-avatar-wrap > img:not(.vortex07-retro-badge-img)",
  ".user-row > .user-row-avatar",
  ".user-card > .user-card-avatar",
].join(", ");

const VORTEX07_AVATAR_FRAME_WRAP_SELECTORS = [
  ".profile-avatar-wrap",
  ".vortex07-profile-avatar-slot",
  ".friend-avatar-wrap",
  ".user-row-avatar-wrap",
].join(", ");

function avatarColor(username) {
  const colors = ["#d8c7ff", "#cab6f2", "#bfa7e8", "#e2d6ff", "#c7b2ee"];
  let hash = 0;
  const source = String(username || "V");
  for (let i = 0; i < source.length; i += 1) {
    hash = source.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function initial(username) {
  return (
    String(username || "?")
      .trim()
      .charAt(0)
      .toUpperCase() || "?"
  );
}

function isVortex07BadgeImage(img) {
  if (!img || img.tagName !== "IMG") return true;
  return Boolean(
    img.classList.contains("vortex07-retro-badge-img") ||
      img.closest(".vortex07-retro-badge-wrap, .vortex07-forum-avatar-wrap"),
  );
}

function fitAvatarImage(img) {
  if (isVortex07BadgeImage(img)) return;

  const inFrame = Boolean(
    img.closest(
      ".profile-avatar-wrap, .vortex07-profile-avatar-slot, .friend-avatar-wrap, .user-row-avatar-wrap",
    ),
  );

  if (inFrame) {
    img.style.setProperty("width", "100%", "important");
    img.style.setProperty("height", "100%", "important");
    img.style.setProperty("min-width", "0", "important");
    img.style.setProperty("min-height", "0", "important");
  }

  img.style.setProperty("max-width", "none", "important");
  img.style.setProperty("max-height", "none", "important");
  img.style.setProperty("object-fit", "cover", "important");
  img.style.setProperty("display", "block", "important");
  img.style.setProperty("box-sizing", "border-box", "important");
  img.dataset.vortex07AvatarFit = "1";
}

function normalizeAvatarImages(root = document) {
  const scope = root instanceof Element ? root : document;

  scope.querySelectorAll(VORTEX07_AVATAR_FRAME_IMG_SELECTORS).forEach((img) => {
    fitAvatarImage(img);
  });

  scope.querySelectorAll(VORTEX07_AVATAR_FRAME_WRAP_SELECTORS).forEach((wrap) => {
    wrap.style.overflow = "hidden";
    wrap.style.boxSizing = "border-box";
  });
}
