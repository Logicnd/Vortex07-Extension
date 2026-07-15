/** Shared DOM string helpers (loaded before content scripts). */

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function highlightMatch(text, query) {
  const cleanText = escapeHtml(text);
  const cleanQuery = safeString(query);

  if (!cleanQuery) return cleanText;

  const escapedQuery = cleanQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escapedQuery})`, "ig");

  return cleanText.replace(
    regex,
    '<span class="vortex07-search-highlight">$1</span>',
  );
}
