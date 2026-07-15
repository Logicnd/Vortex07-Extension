/** Shared date/time formatters (loaded before content scripts). */

function formatRelativeLastOnline(timestamp) {
  const n = Number(timestamp);
  if (!Number.isFinite(n) || n <= 0) return "";
  const diff = Math.max(0, Date.now() - n);
  const sec = Math.floor(diff / 1000);
  if (sec < 120) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} minute${min === 1 ? "" : "s"} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} day${day === 1 ? "" : "s"} ago`;
  const month = Math.floor(day / 30);
  if (month < 12) return `${month} month${month === 1 ? "" : "s"} ago`;
  const year = Math.floor(day / 365);
  return `${year} year${year === 1 ? "" : "s"} ago`;
}

function formatLastOnlineLabel(timestamp) {
  const relative = formatRelativeLastOnline(timestamp);
  if (!relative) return "";
  return `Last online ${relative}`;
}

function formatArchiveLastSeen(timestamp) {
  const value = Number(timestamp);
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `Last seen ${date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
}

function formatGuestbookDate(timestamp) {
  const date = new Date(Number(timestamp) || Date.now());
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatGameCommentDate(timestamp) {
  const n = Number(timestamp);
  if (!Number.isFinite(n) || n <= 0) return "";
  const date = new Date(n);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
