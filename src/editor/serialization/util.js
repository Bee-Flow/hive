/**
 * util.js — shared, dependency-free helpers for the serializers.
 *
 * Byte-compatible with the legacy TipTap MermaidExtension encode/decode so HTML
 * produced by the new editor round-trips through the export pipeline and the old
 * editor unchanged.
 */

/* ── Mermaid data-code base64 (mirrors MermaidExtension.encodeForAttr) ── */
export function encodeForAttr(str) {
  try {
    return btoa(unescape(encodeURIComponent(str)));
  } catch {
    return String(str || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
}

export function decodeFromAttr(str) {
  if (!str) return '';
  try {
    const decoded = decodeURIComponent(escape(atob(str)));
    if (decoded && !decoded.includes('�')) return decoded;
  } catch {
    /* not base64 — fall through to entity decode */
  }
  return String(str)
    .replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

/* ── HTML escaping ── */
export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
export function escapeAttr(str) {
  return escapeHtml(str).replace(/'/g, '&#39;');
}

/* ── URL safety ── */
// The editor never injects innerHTML (render builds DOM nodes), so the only XSS
// vector from pasted/imported content is a dangerous URL scheme on a link href or
// image src. Strip those; allow http(s)/mailto/tel/relative/anchors + data:image.
export function safeUrl(url) {
  if (url == null) return url;
  const s = String(url).trim();
  if (/^(javascript|vbscript|file):/i.test(s)) return '';
  if (/^data:/i.test(s) && !/^data:image\//i.test(s)) return '';
  return s;
}

/* ── Markdown escaping ── */
// Characters that would otherwise be parsed as inline markers by our dialect.
const MD_INLINE_SPECIAL = /[\\`*_~=[\]$<>]/g;

/** Escape text for placement in a Markdown inline context. */
export function escapeMdText(str) {
  return String(str ?? '').replace(MD_INLINE_SPECIAL, (c) => '\\' + c);
}

/** Escape text that starts a line so it isn't read as a block marker. */
export function escapeMdLineStart(str) {
  return String(str ?? '').replace(/^(\s*)([#>+-]|\d+[.)])/, '$1\\$2');
}
