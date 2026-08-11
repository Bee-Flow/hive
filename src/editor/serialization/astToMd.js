/**
 * astToMd.js — serialize the editor AST to canonical BeeFlow-Flavored Markdown (BFM).
 *
 * BFM = GFM + minimal additions:
 *  - mermaid → ```mermaid fenced block
 *  - math    → $…$ inline / $$…$$ block
 *  - image   → ![alt](src "title"){w=400 align=center wrap}  (suffix only for non-defaults)
 *  - highlight default → ==text==;  custom/color/font/underline → [text]{hl bg=# color=# font= u}
 *  - block align (heading/paragraph) → trailing {align=center}
 *
 * This is the canonical OUTPUT path and must be exact: correctness here defines
 * what the AI reads and what we persist. It is hand-written because no library
 * emits our dialect.
 */
import { getMark } from '../model/marks.js';
import { attr } from '../model/nodes.js';
import { escapeMdText } from './util.js';

// Node types that are block-level when they appear inside a table cell, and so
// need recursing into rather than being handed to the inline renderer.
const NON_INLINE = new Set([
  'paragraph', 'heading', 'blockquote', 'bulletList', 'orderedList', 'taskList',
  'listItem', 'taskItem', 'codeBlock', 'table', 'tableRow', 'tableCell', 'horizontalRule',
]);

export function astToMarkdown(docNode) {
  const blocks = docNode?.content || [];
  return serializeBlocks(blocks).replace(/\n{3,}/g, '\n\n').replace(/\s+$/, '') + '\n';
}

/* ── Blocks ─────────────────────────────────────────────── */

function serializeBlocks(nodes) {
  const out = [];
  for (const n of nodes) out.push(serializeBlock(n));
  return out.join('\n\n');
}

function serializeBlock(n) {
  switch (n.type) {
    case 'paragraph':      return withAlign(escapeParaStart(inline(n.content)), n);
    case 'heading':        return withAlign('#'.repeat(attr(n, 'level')) + ' ' + inline(n.content), n);
    case 'blockquote':     return prefixLines(serializeBlocks(n.content), '> ');
    case 'bulletList':     return serializeList(n, null);
    case 'orderedList':    return serializeList(n, attr(n, 'start') || 1);
    case 'taskList':       return serializeTaskList(n);
    case 'codeBlock':      return serializeCodeBlock(n);
    case 'horizontalRule': return '---';
    case 'table':          return serializeTable(n);
    case 'image':          return serializeImage(n);
    case 'mermaid':        return '```mermaid\n' + (attr(n, 'code') || '').replace(/\s+$/, '') + '\n```';
    case 'mathBlock':      return '$$\n' + (attr(n, 'latex') || '').trim() + '\n$$';
    case 'chart':          return '```chart\n' + (attr(n, 'spec') || '').replace(/\s+$/, '') + '\n```';
    default:               return n.content ? serializeBlocks(n.content) : '';
  }
}

/** Append a `{align=…}` suffix for centered/right blocks. */
function withAlign(str, n) {
  const a = attr(n, 'align');
  if (a === 'center' || a === 'right') return `${str} {align=${a}}`;
  return str;
}

function serializeCodeBlock(n) {
  const lang = attr(n, 'language') || '';
  const body = (n.content || []).map((c) => c.text || '').join('');
  // Use enough backticks to exceed any run inside the body.
  const longest = (body.match(/`+/g) || []).reduce((m, s) => Math.max(m, s.length), 0);
  const fence = '`'.repeat(Math.max(3, longest + 1));
  return `${fence}${lang}\n${body.replace(/\n$/, '')}\n${fence}`;
}

function serializeList(listNode, start) {
  const items = listNode.content || [];
  const lines = items.map((item, i) => {
    const marker = start == null ? '- ' : `${start + i}. `;
    return serializeListItem(item, marker);
  });
  return lines.join('\n');
}

function serializeTaskList(listNode) {
  const items = listNode.content || [];
  return items.map((item) => {
    const box = attr(item, 'checked') ? '[x]' : '[ ]';
    return serializeListItem(item, `- ${box} `);
  }).join('\n');
}

const isListType = (t) => t === 'bulletList' || t === 'orderedList' || t === 'taskList';

function serializeListItem(item, marker) {
  const blocks = item.content || [];
  // Tight: a paragraph followed by a nested list joins with a single newline;
  // separate paragraphs stay loose (blank line).
  let inner = '';
  blocks.forEach((b, idx) => {
    const s = serializeBlock(b);
    inner += idx === 0 ? s : (isListType(b.type) ? '\n' : '\n\n') + s;
  });
  const pad = ' '.repeat(marker.length);
  const lines = inner.split('\n');
  return lines
    .map((l, i) => (i === 0 ? marker + l : l ? pad + l : ''))
    .join('\n');
}

/** Escape a paragraph's leading char if it would otherwise read as a block marker. */
function escapeParaStart(str) {
  return str.replace(/^(\s*)(#{1,6}\s|[-*+]\s|\d+[.)]\s|>\s|`{3,}|~{3,})/, (_, sp, mk) => sp + '\\' + mk);
}

function serializeTable(tableNode) {
  const rows = tableNode.content || [];
  if (!rows.length) return '';
  const headerCells = rows[0].content || [];

  const renderRow = (row) =>
    '| ' + (row.content || []).map((cell) => cellText(cell)).join(' | ') + ' |';

  const alignRow =
    '| ' + headerCells.map((cell) => {
      const a = attr(cell, 'align');
      if (a === 'center') return ':-:';
      if (a === 'right') return '--:';
      if (a === 'left') return ':--';
      return '---';
    }).join(' | ') + ' |';

  const out = [renderRow(rows[0]), alignRow];
  for (let i = 1; i < rows.length; i++) out.push(renderRow(rows[i]));
  return out.join('\n');

  function cellText(cell) {
    const blocks = cell.content || [];
    // A Markdown cell is a single line, so block structure is flattened — but it
    // must still be REPRESENTED. This used to be `b.content ? inline(b.content) : ''`,
    // which silently emptied any cell holding a list, an image or a blockquote:
    // those either carry their payload in attrs (image) or nest another level
    // (list → listItem → paragraph), so the one-level check produced ''. A table
    // of screenshots or bulleted cells survived a save as a grid of blanks.
    const txt = blocks.map(cellBlock).filter(Boolean).join(' ').trim();
    const spans = cellSpanSuffix(cell);
    return txt.replace(/\|/g, '\\|').replace(/\n/g, ' ') + spans;
  }

  function cellBlock(b) {
    if (!b || typeof b !== 'object') return '';
    switch (b.type) {
      case 'image':      return serializeImage(b);
      case 'bulletList':
      case 'orderedList': {
        const ordered = b.type === 'orderedList';
        return (b.content || []).map((li, i) => {
          const marker = ordered ? `${i + 1}. ` : '• ';
          return marker + (li.content || []).map(cellBlock).filter(Boolean).join(' ');
        }).join('<br>');
      }
      case 'taskList':
        return (b.content || []).map((li) => {
          const done = attr(li, 'checked') ? '[x] ' : '[ ] ';
          return done + (li.content || []).map(cellBlock).filter(Boolean).join(' ');
        }).join('<br>');
      case 'codeBlock': {
        const code = (b.content || []).map((c) => c.text || '').join('');
        return '`' + code.replace(/`/g, '\\`').replace(/\n/g, ' ') + '`';
      }
      case 'horizontalRule': return '';
      default:
        // paragraph, heading, blockquote, listItem, … — recurse when the child
        // is itself block-level, otherwise render its inline run.
        if (!b.content) return '';
        return b.content.some((c) => c && c.type && c.type !== 'text' && NON_INLINE.has(c.type))
          ? b.content.map(cellBlock).filter(Boolean).join(' ')
          : inline(b.content);
    }
  }

  /**
   * Merged-cell geometry as a trailing `{cs=2 rs=3}` marker.
   *
   * GFM tables have no concept of a merged cell, so colspan/rowspan were simply
   * dropped: a header spanning two columns came back as one cell and every row
   * beneath it shifted left. Emitting the span keeps the grid reconstructable
   * (mdToAst reads this back), and degrades to visible-but-harmless text in any
   * other Markdown renderer.
   */
  function cellSpanSuffix(cell) {
    const cs = parseInt(attr(cell, 'colspan'), 10);
    const rs = parseInt(attr(cell, 'rowspan'), 10);
    const cw = parseInt(attr(cell, 'colwidth'), 10);
    const parts = [];
    if (Number.isFinite(cs) && cs > 1) parts.push(`cs=${cs}`);
    if (Number.isFinite(rs) && rs > 1) parts.push(`rs=${rs}`);
    // Column widths round-trip through HTML but were dropped here, so every AI
    // read/write (which goes via the Markdown mirror) silently reset them.
    if (Number.isFinite(cw) && cw > 0) parts.push(`w=${cw}`);
    return parts.length ? ` {${parts.join(' ')}}` : '';
  }
}

function serializeImage(n) {
  const src = attr(n, 'src') || '';
  const alt = (attr(n, 'alt') || '').replace(/\]/g, '\\]');
  const title = attr(n, 'title');
  const titlePart = title ? ` "${title.replace(/"/g, '\\"')}"` : '';
  const attrs = imageAttrSuffix(n);
  return `![${alt}](${mdUrl(src)}${titlePart})${attrs}`;
}

function imageAttrSuffix(n) {
  const parts = [];
  const w = attr(n, 'width');
  const align = attr(n, 'alignment');
  const wrap = attr(n, 'textWrap');
  if (w) parts.push(`w=${w}`);
  if (align && align !== 'center') parts.push(`align=${align}`);
  if (wrap) parts.push('wrap');
  return parts.length ? `{${parts.join(' ')}}` : '';
}

function prefixLines(str, prefix) {
  return str.split('\n').map((l) => (l ? prefix + l : prefix.trimEnd())).join('\n');
}

/* ── Inline ─────────────────────────────────────────────── */

function inline(nodes = []) {
  let out = '';
  for (const n of nodes) out += serializeInline(n);
  return out;
}

function serializeInline(n) {
  if (n.type === 'hardBreak') return '\\\n';
  if (n.type === 'mathInline') return `$${(n.attrs?.latex || '').trim()}$`;
  // Formula: the canonical `=…` text round-trips Markdown; computed value is transient.
  if (n.type === 'formula') return n.attrs?.src || '';
  if (n.type === 'image') return serializeImage(n);
  if (n.type !== 'text') return '';

  const marks = n.marks || [];
  let s = escapeMdText(n.text);
  // Re-escape block-marker characters only when this run begins a line context;
  // the block serializer handles line starts, so escape conservatively here.

  // innermost → outermost (marks are pre-sorted outermost-first)
  if (hasType(marks, 'code')) return '`' + n.text.replace(/`/g, '\\`') + '`'; // code: literal, no other marks
  if (hasType(marks, 'strike')) s = `~~${s}~~`;
  if (hasType(marks, 'italic')) s = `*${s}*`;
  if (hasType(marks, 'bold')) s = `**${s}**`;
  s = wrapSpan(s, marks);
  const link = getMark(marks, 'link');
  if (link) s = `[${s}](${mdUrl(link.attrs?.href || '')})`;
  return s;
}

/**
 * Render a URL for a Markdown destination.
 *
 * A bare `(`/`)` or space inside the destination ends it early, so
 * `https://en.wikipedia.org/wiki/Foo_(bar)` round-tripped as
 * `https://en.wikipedia.org/wiki/Foo_(bar` plus a stray `)` in the text — the
 * link broke a little more on every save. The angle-bracket form is the
 * CommonMark way to say "this whole thing is the destination".
 */
export function mdUrl(url) {
  const s = String(url ?? '');
  if (!s) return '';
  if (/[()\s]/.test(s)) return `<${s.replace(/([<>])/g, '\\$1')}>`;
  return s;
}

function wrapSpan(inner, marks) {
  const hl = getMark(marks, 'highlight');
  const ts = getMark(marks, 'textStyle');
  const u = hasType(marks, 'underline');
  const color = ts?.attrs?.color || null;
  const font = ts?.attrs?.fontFamily || null;
  const hlColor = hl?.attrs?.color || null;

  const onlyDefaultHighlight = hl && !color && !font && !u && !hlColor;
  if (onlyDefaultHighlight) return `==${inner}==`;
  if (!hl && !color && !font && !u) return inner;

  const parts = [];
  if (hl && !hlColor) parts.push('hl');
  if (hlColor) parts.push(`bg=${hlColor}`);
  if (color) parts.push(`color=${color}`);
  if (font) parts.push(`font=${font.replace(/\s/g, '_')}`);
  if (u) parts.push('u');
  return `[${inner}]{${parts.join(' ')}}`;
}

const hasType = (marks, t) => marks.some((m) => m.type === t);

export default astToMarkdown;
