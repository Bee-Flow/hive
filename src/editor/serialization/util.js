/**
 * util.js — shared, dependency-free helpers for the serializers.
 *
 * Byte-compatible with the legacy TipTap MermaidExtension encode/decode so HTML
 * produced by the new editor round-trips through the export pipeline and the old
 * editor unchanged.
 */

/* ── Content sniffing ── */
// Single definition shared by the content pipeline and insertContent, so the
// prop-load and programmatic-insert paths route HTML vs Markdown identically.
export const looksLikeHtml = (s) => /<\/?[a-z][\s\S]*>/i.test(s || '');

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

/* ── Attribute value safety ──
 *
 * astToHtml builds HTML by string concatenation, and that HTML is not just fed
 * to the editor — it is STORED (notebooks.document_content) and re-rendered
 * server-side into PDF/DOCX exports. So an attribute value taken from document
 * content is untrusted output, and escaping is not optional here.
 *
 * Escaping alone is also not enough inside style="": an escaped value is still
 * parsed as CSS, where url(), expression() and comment tricks live. For values
 * that land in CSS we whitelist the shapes the editor actually produces and
 * drop anything else, rather than trying to sanitise arbitrary CSS.
 */
const CSS_COLOR = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%]+\)|[a-z]{3,20})$/i;
const CSS_FONT = /^[\w\s,'-]+$/;
const ALIGNMENTS = new Set(['left', 'center', 'right', 'justify']);

/** A CSS colour, or '' when it isn't one. */
export function safeCssColor(v) {
  const s = String(v ?? '').trim();
  return CSS_COLOR.test(s) ? s : '';
}

/** A font-family list, or '' when it contains anything CSS-structural. */
export function safeCssFont(v) {
  const s = String(v ?? '').trim();
  if (!s || /[();{}<>:"\\]/.test(s)) return '';
  return CSS_FONT.test(s) ? s : '';
}

/** A known alignment keyword, or '' — never echo an arbitrary string. */
export function safeAlign(v) {
  const s = String(v ?? '').trim().toLowerCase();
  return ALIGNMENTS.has(s) ? s : '';
}

/** A non-negative integer, or null. Used for widths / colspan / rowspan. */
export function safeInt(v) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** A browsing-context keyword, or '' — these are a closed set, so whitelist. */
const TARGETS = new Set(['_blank', '_self', '_parent', '_top']);
export function safeTarget(v) {
  const s = String(v ?? '').trim();
  return TARGETS.has(s) ? s : '';
}

/** A space-separated link-relation token list, or ''. */
const REL_TOKEN = /^[a-z][a-z-]*$/;
export function safeRel(v) {
  const toks = String(v ?? '').trim().toLowerCase().split(/\s+/).filter((t) => REL_TOKEN.test(t));
  return toks.join(' ');
}

/* ── Table shape ── */

/**
 * Pad short rows so every row of a parsed table spans the same visual width.
 *
 * Neither parser enforced this — a Markdown table with mismatched pipe counts
 * (constant in AI-authored and hand-pasted content) and a `<table>` with uneven
 * `<tr>`s both produced a ragged grid. Nothing repaired it afterwards, and the
 * structural commands then misbehaved on it. Padding only ever APPENDS cells, so
 * no existing cell index shifts and a live selection stays valid.
 */
export function squareUpRows(rows, makeEmptyCell) {
  if (!rows?.length) return rows;
  const occupied = rows.map(() => []);
  rows.forEach((row, r) => {
    let c = 0;
    for (const cell of row.content || []) {
      while (occupied[r][c]) c += 1;
      const cs = Math.max(1, parseInt(cell?.attrs?.colspan, 10) || 1);
      const rs = Math.max(1, parseInt(cell?.attrs?.rowspan, 10) || 1);
      for (let dr = 0; dr < rs && r + dr < rows.length; dr++) {
        for (let dc = 0; dc < cs; dc++) occupied[r + dr][c + dc] = true;
      }
      c += cs;
    }
  });
  const width = occupied.reduce((m, o) => Math.max(m, o.length), 0);
  if (!width) return rows;
  return rows.map((row, r) => {
    let filled = 0;
    for (let c = 0; c < width; c++) if (occupied[r][c]) filled += 1;
    if (filled >= width) return row;
    const header = !!row.content?.[0]?.attrs?.header;
    const pad = Array.from({ length: width - filled }, () => makeEmptyCell(header));
    return { ...row, content: [...(row.content || []), ...pad] };
  });
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
