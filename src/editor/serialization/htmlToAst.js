/**
 * htmlToAst.js — parse HTML into the editor AST.
 *
 * Used for (a) clipboard paste of rich HTML and (b) migrating legacy TipTap
 * documents (stored as HTML) to the canonical AST/Markdown. It understands the
 * legacy custom-node shapes so existing documents survive the migration:
 *   <img data-width data-alignment data-text-wrap>      → image
 *   <div data-type="mermaid-diagram" data-code="b64">   → mermaid
 *   <div data-type="blockMath" data-latex>              → mathBlock
 *   <span data-type="inlineMath" data-latex>            → mathInline
 *
 * Runs in any environment with a DOMParser (browser + jsdom). The server twin
 * swaps DOMParser for jsdom/cheerio but keeps this exact mapping.
 */
import { node, doc, emptyParagraph } from '../model/nodes.js';
import { mark, addMark, sortMarks, sameMarkSet } from '../model/marks.js';
import { decodeFromAttr, safeUrl, safeCssColor, safeCssFont, squareUpRows } from './util.js';

export function htmlToAst(html, DOMParserImpl) {
  const Impl = DOMParserImpl || (typeof DOMParser !== 'undefined' ? DOMParser : null);
  if (!Impl) throw new Error('[htmlToAst] No DOMParser available in this environment.');
  const parsed = new Impl().parseFromString(`<body>${html || ''}</body>`, 'text/html');
  const blocks = parseBlockChildren(parsed.body);
  if (!blocks.length) blocks.push(emptyParagraph());
  return doc(blocks);
}

/* ── Blocks ─────────────────────────────────────────────── */

function parseBlockChildren(el) {
  const out = [];
  let inlineBuf = [];
  const flushInline = () => {
    if (inlineBuf.length) {
      const inline = mergeAdjacentText(inlineBuf);
      if (inline.length) out.push(node('paragraph', null, inline));
      inlineBuf = [];
    }
  };

  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === 3) { // text
      if (child.textContent.trim()) collectInline(child, [], inlineBuf);
      continue;
    }
    if (child.nodeType !== 1) continue;
    const tag = child.tagName.toLowerCase();
    if (BLOCK_TAGS.has(tag) || isCustomBlock(child)) {
      flushInline();
      const b = parseBlock(child);
      if (b) out.push(...(Array.isArray(b) ? b : [b]));
    } else {
      collectInline(child, [], inlineBuf);
    }
  }
  flushInline();
  return out;
}

const BLOCK_TAGS = new Set([
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li',
  'blockquote', 'pre', 'hr', 'table', 'figure',
]);

function isCustomBlock(el) {
  const dt = el.getAttribute?.('data-type');
  return dt === 'mermaid-diagram' || dt === 'blockMath' || dt === 'chart' ||
    (el.tagName === 'IMG') || el.classList?.contains('resizable-image-wrapper');
}

function parseBlock(el) {
  const tag = el.tagName.toLowerCase();
  const dt = el.getAttribute('data-type');

  if (dt === 'mermaid-diagram') return node('mermaid', { code: decodeFromAttr(el.getAttribute('data-code')) || el.textContent || '' });
  if (dt === 'blockMath') return node('mathBlock', { latex: el.getAttribute('data-latex') || stripMathDelims(el.textContent) });
  if (dt === 'chart') return node('chart', { spec: decodeFromAttr(el.getAttribute('data-spec')) || '' });

  switch (tag) {
    case 'p':          return paragraphFrom(el);
    case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6':
      return node('heading', { level: Math.min(3, +tag[1]), align: alignFrom(el) }, inlineOf(el));
    case 'ul':         return listFrom(el);
    case 'ol':         return node('orderedList', { start: +el.getAttribute('start') || 1 }, itemsFrom(el, false));
    case 'blockquote': return node('blockquote', null, parseBlockChildren(el));
    case 'pre':        return codeBlockFrom(el);
    case 'hr':         return node('horizontalRule');
    case 'table':      return tableFrom(el);
    case 'img':        return imageFrom(el);
    case 'figure':     return parseBlockChildren(el);
    case 'div':        return divFrom(el);
    default:           return null;
  }
}

function paragraphFrom(el) {
  const inline = inlineOf(el);
  // <p><br></p> → empty paragraph
  if (inline.length === 1 && inline[0].type === 'hardBreak') return emptyParagraph();
  return node('paragraph', { align: alignFrom(el) }, inline);
}

function listFrom(el) {
  if (el.getAttribute('data-type') === 'taskList') return node('taskList', null, itemsFrom(el, true));
  return node('bulletList', null, itemsFrom(el, false));
}

function itemsFrom(listEl, task) {
  const items = [];
  for (const li of Array.from(listEl.children)) {
    if (li.tagName.toLowerCase() !== 'li') continue;
    if (task) {
      const checked = li.getAttribute('data-checked') === 'true' || !!li.querySelector('input[type="checkbox"]:checked');
      const contentEl = li.querySelector(':scope > div') || li;
      const blocks = parseBlockChildren(contentEl);
      items.push(node('taskItem', { checked }, blocks.length ? blocks : [emptyParagraph()]));
    } else {
      const blocks = parseBlockChildren(li);
      items.push(node('listItem', null, blocks.length ? blocks : [emptyParagraph()]));
    }
  }
  return items;
}

function codeBlockFrom(el) {
  const code = el.querySelector('code');
  const cls = (code?.getAttribute('class') || el.getAttribute('class') || '');
  const langMatch = cls.match(/language-([\w-]+)/);
  const text = (code || el).textContent || '';
  return node('codeBlock', langMatch ? { language: langMatch[1] } : null, [{ type: 'text', text: text.replace(/\n$/, '') }]);
}

function tableFrom(el) {
  const rows = [];
  // Only THIS table's rows: an unscoped 'tr' also matched the rows of a table
  // nested inside a td, duplicating them into the outer table on every reload
  // (the mini-grid artifact, S8). The nested table still parses — as cell
  // content, via parseBlockChildren below.
  const rowSel = ':scope > thead > tr, :scope > tbody > tr, :scope > tfoot > tr, :scope > tr';
  for (const tr of Array.from(el.querySelectorAll(rowSel))) {
    const cells = [];
    for (const cell of Array.from(tr.children)) {
      const t = cell.tagName.toLowerCase();
      if (t !== 'td' && t !== 'th') continue;
      cells.push(node('tableCell', {
        header: t === 'th',
        align: cellAlignFrom(cell),
        colspan: +cell.getAttribute('colspan') || 1,
        rowspan: +cell.getAttribute('rowspan') || 1,
        colwidth: cell.style && cell.style.width ? parseInt(cell.style.width, 10) || null : null,
      }, parseBlockChildren(cell)));
    }
    if (cells.length) rows.push(node('tableRow', null, cells));
  }
  // Pasted tables (Word, Google Docs, scraped pages) are frequently ragged.
  return node('table', null, squareUpRows(rows, emptyTableCell));
}

const emptyTableCell = (header) => node('tableCell', { header }, [emptyParagraph()]);

function imageFrom(img) {
  const width = img.getAttribute('data-width') || (img.style?.width ? parseInt(img.style.width, 10) : null);
  return node('image', {
    src: safeUrl(img.getAttribute('src')),
    alt: img.getAttribute('alt') || null,
    title: img.getAttribute('title') || null,
    width: width ? parseInt(width, 10) || null : null,
    alignment: img.getAttribute('data-alignment') || 'center',
    textWrap: img.getAttribute('data-text-wrap') === 'true',
  });
}

function divFrom(el) {
  const img = el.querySelector('img');
  if (img && el.classList.contains('resizable-image-wrapper')) {
    const n = imageFrom(img);
    if (el.getAttribute('data-alignment')) n.attrs.alignment = el.getAttribute('data-alignment');
    if (el.getAttribute('data-text-wrap')) n.attrs.textWrap = el.getAttribute('data-text-wrap') === 'true';
    return n;
  }
  const blocks = parseBlockChildren(el);
  return blocks.length ? blocks : null;
}

/* ── Inline ─────────────────────────────────────────────── */

function inlineOf(el) {
  const buf = [];
  for (const child of Array.from(el.childNodes)) collectInline(child, [], buf);
  return mergeAdjacentText(buf);
}

function collectInline(domNode, marks, out) {
  if (domNode.nodeType === 3) {
    const text = domNode.textContent.replace(/\s+/g, ' ');
    if (text) out.push(makeText(text, marks));
    return;
  }
  if (domNode.nodeType !== 1) return;

  const tag = domNode.tagName.toLowerCase();
  const dt = domNode.getAttribute('data-type');

  if (tag === 'br') { out.push({ type: 'hardBreak' }); return; }
  if (tag === 'img') { out.push(imageFrom(domNode)); return; }
  if (dt === 'inlineMath') { out.push({ type: 'mathInline', attrs: { latex: domNode.getAttribute('data-latex') || stripMathDelims(domNode.textContent) } }); return; }
  if (dt === 'formula') { out.push({ type: 'formula', attrs: { src: domNode.getAttribute('data-formula') || domNode.textContent || '' } }); return; }

  const add = markForTag(tag, domNode);
  const nextMarks = add ? addMark(marks, add) : marks;
  if (tag === 'code') { out.push(makeText(domNode.textContent, nextMarks)); return; }
  for (const child of Array.from(domNode.childNodes)) collectInline(child, nextMarks, out);
}

function markForTag(tag, el) {
  switch (tag) {
    case 'strong': case 'b':   return mark('bold');
    case 'em': case 'i':       return mark('italic');
    case 'u':                  return mark('underline');
    case 's': case 'del': case 'strike': return mark('strike');
    case 'code':               return mark('code');
    // Imported/pasted HTML is untrusted: style values are validated on the way
    // IN as well as on the way out (astToHtml), so a hostile value never even
    // reaches the document model.
    case 'mark':               return mark('highlight', { color: safeCssColor(cssValue(el, 'background-color') || cssValue(el, 'background')) || null });
    case 'a':                  return mark('link', { href: safeUrl(el.getAttribute('href') || ''), target: el.getAttribute('target') || undefined, rel: el.getAttribute('rel') || undefined });
    case 'span': {
      const color = safeCssColor(cssValue(el, 'color'));
      const font = safeCssFont((cssValue(el, 'font-family') || '').replace(/['"]/g, ''));
      if (color || font) return mark('textStyle', { color: color || null, fontFamily: font || null });
      return null;
    }
    default: return null;
  }
}

/* ── helpers ────────────────────────────────────────────── */

// Block align: 'left' is the implicit default → null.
function alignFrom(el) {
  const a = cellAlignFrom(el);
  return a === 'left' ? null : a;
}

// Table-cell align: 'left' (`:--`) is meaningful and preserved.
function cellAlignFrom(el) {
  const a = cssValue(el, 'text-align') || el.getAttribute('align');
  return (a === 'center' || a === 'right' || a === 'left') ? a : null;
}

function cssValue(el, prop) {
  const style = el.getAttribute?.('style') || '';
  const m = style.match(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, 'i'));
  return m ? m[1].trim() : null;
}

function stripMathDelims(s) {
  return String(s || '').replace(/^\s*\\?[([]\s*/, '').replace(/\s*\\?[)\]]\s*$/, '').replace(/^\$+|\$+$/g, '').trim();
}

function makeText(str, marks) {
  return marks && marks.length ? { type: 'text', text: str, marks: sortMarks(marks) } : { type: 'text', text: str };
}

function mergeAdjacentText(nodes) {
  const out = [];
  for (const n of nodes) {
    const last = out[out.length - 1];
    if (n.type === 'text' && last && last.type === 'text' && sameMarkSet(last.marks || [], n.marks || [])) {
      last.text += n.text;
    } else out.push(n);
  }
  return out.filter((n) => !(n.type === 'text' && n.text === ''));
}

export default htmlToAst;
