/**
 * mdToAst.js — parse BeeFlow-Flavored Markdown (BFM) into the editor AST.
 *
 * Hand-written, dependency-free, and shareable between client (ESM) and server
 * (CJS twin) so there is no transitive-dependency fragility. The grammar is the
 * inverse of astToMd.js; the fixture corpus locks the round-trip.
 */
import { node, doc, emptyParagraph } from '../model/nodes.js';
import { mark, addMark, sortMarks, sameMarkSet } from '../model/marks.js';

export function markdownToAst(md) {
  const src = String(md == null ? '' : md).replace(/\r\n?/g, '\n');
  const lines = src.split('\n');
  const blocks = parseBlocks(lines);
  if (!blocks.length) blocks.push(emptyParagraph());
  return doc(blocks);
}

/* ── Block parsing ──────────────────────────────────────── */

function parseBlocks(lines) {
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const ln = lines[i];
    if (isBlank(ln)) { i++; continue; }

    const fence = ln.match(/^( {0,3})(`{3,}|~{3,})\s*([^\n]*)$/);
    if (fence) { const r = parseFence(lines, i, fence); out.push(r.node); i = r.next; continue; }

    if (/^\$\$/.test(ln)) { const r = parseMathBlock(lines, i); out.push(r.node); i = r.next; continue; }

    const h = ln.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/);
    if (h) { out.push(parseHeading(h)); i++; continue; }

    if (/^ {0,3}([-*_])\s*(?:\1\s*){2,}$/.test(ln)) { out.push(node('horizontalRule')); i++; continue; }

    if (/^ {0,3}>/.test(ln)) { const r = parseBlockquote(lines, i); out.push(r.node); i = r.next; continue; }

    if (ln.includes('|') && i + 1 < lines.length && isAlignRow(lines[i + 1])) {
      const r = parseTable(lines, i); out.push(r.node); i = r.next; continue;
    }

    if (matchListMarker(ln)) { const r = parseList(lines, i); out.push(r.node); i = r.next; continue; }

    const r = parseParagraph(lines, i);
    if (r.node) out.push(r.node);
    i = r.next;
  }
  return out;
}

function parseFence(lines, i, fence) {
  const marker = fence[2][0];
  const len = fence[2].length;
  const info = fence[3].trim();
  const body = [];
  let j = i + 1;
  while (j < lines.length) {
    const cl = lines[j].match(/^( {0,3})(`{3,}|~{3,})\s*$/);
    if (cl && cl[2][0] === marker && cl[2].length >= len) { j++; break; }
    body.push(lines[j]); j++;
  }
  const code = body.join('\n');
  if (/^mermaid$/i.test(info)) return { node: node('mermaid', { code }), next: j };
  if (/^chart$/i.test(info)) return { node: node('chart', { spec: code }), next: j };
  return { node: node('codeBlock', info ? { language: info } : null, [{ type: 'text', text: code }]), next: j };
}

function parseMathBlock(lines, i) {
  const single = lines[i].match(/^\$\$(.+)\$\$\s*$/);
  if (single) return { node: node('mathBlock', { latex: single[1].trim() }), next: i + 1 };
  const body = [];
  let j = i + 1;
  while (j < lines.length) {
    if (/^\$\$\s*$/.test(lines[j])) { j++; break; }
    body.push(lines[j]); j++;
  }
  return { node: node('mathBlock', { latex: body.join('\n').trim() }), next: j };
}

function parseHeading(h) {
  const level = Math.min(3, h[1].length);
  const { text, align } = extractBlockAlign(h[2]);
  return node('heading', { level, align }, parseInline(text));
}

function extractBlockAlign(text) {
  const m = text.match(/^(.*?)\s*\{align=(left|center|right)\}\s*$/);
  if (m) return { text: m[1], align: m[2] === 'left' ? null : m[2] };
  return { text, align: null };
}

function parseBlockquote(lines, i) {
  const inner = [];
  let j = i;
  while (j < lines.length && /^ {0,3}>/.test(lines[j])) {
    inner.push(lines[j].replace(/^ {0,3}>\s?/, ''));
    j++;
  }
  return { node: node('blockquote', null, parseBlocks(inner)), next: j };
}

function parseParagraph(lines, i) {
  const buf = [];
  let j = i;
  while (j < lines.length) {
    const ln = lines[j];
    if (isBlank(ln)) break;
    if (j !== i && isBlockStart(lines, j)) break;
    buf.push(ln); j++;
  }
  const raw = buf.join('\n');
  const { text, align } = extractBlockAlign(raw);
  const imgOnly = text.trim().match(/^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)(\{[^}]*\})?$/);
  if (imgOnly) return { node: parseImageMatch(imgOnly), next: j };
  return { node: node('paragraph', align ? { align } : null, parseInline(text)), next: j };
}

function isBlockStart(lines, j) {
  const ln = lines[j];
  if (/^ {0,3}(`{3,}|~{3,})/.test(ln)) return true;
  if (/^#{1,6}\s+/.test(ln)) return true;
  if (/^ {0,3}([-*_])\s*(?:\1\s*){2,}$/.test(ln)) return true;
  if (/^ {0,3}>/.test(ln)) return true;
  if (matchListMarker(ln)) return true;
  if (/^\$\$/.test(ln)) return true;
  if (ln.includes('|') && j + 1 < lines.length && isAlignRow(lines[j + 1])) return true;
  return false;
}

/* ── Lists ──────────────────────────────────────────────── */

function matchListMarker(line) {
  const mb = line.match(/^( *)([-*+]) +/);
  if (mb) {
    const indent = mb[1].length;
    const markerEnd = mb[0].length;
    const rest = line.slice(markerEnd);
    const task = rest.match(/^\[([ xX])\]\s+/);
    if (task) {
      const contentCol = markerEnd + task[0].length;
      return { indent, ordered: false, task: true, checked: task[1].toLowerCase() === 'x', contentCol, content: line.slice(contentCol) };
    }
    return { indent, ordered: false, task: false, contentCol: markerEnd, content: rest };
  }
  const mo = line.match(/^( *)(\d+)([.)]) +/);
  if (mo) {
    return { indent: mo[1].length, ordered: true, start: parseInt(mo[2], 10), task: false, contentCol: mo[0].length, content: line.slice(mo[0].length) };
  }
  return null;
}

function parseList(lines, i) {
  const base = matchListMarker(lines[i]);
  const ordered = base.ordered;
  const baseIndent = base.indent;
  const isTask = base.task;
  const start = base.start || 1;
  const items = [];

  while (i < lines.length) {
    const lm = matchListMarker(lines[i]);
    if (!lm || lm.ordered !== ordered || lm.indent !== baseIndent || lm.task !== isTask) break;
    const contentCol = lm.contentCol;
    const itemLines = [lm.content];
    i++;
    while (i < lines.length) {
      const ln = lines[i];
      if (isBlank(ln)) {
        let k = i;
        while (k < lines.length && isBlank(lines[k])) k++;
        if (k < lines.length && leadingSpaces(lines[k]) >= contentCol) { itemLines.push(''); i++; continue; }
        break;
      }
      const child = matchListMarker(ln);
      if (child && child.indent <= baseIndent) break;
      if (leadingSpaces(ln) >= contentCol || child) {
        itemLines.push(ln.length >= contentCol ? ln.slice(contentCol) : ln.trimStart());
        i++; continue;
      }
      // lazy paragraph continuation
      itemLines.push(ln.trimStart()); i++;
    }
    const blocks = parseBlocks(itemLines);
    const content = blocks.length ? blocks : [emptyParagraph()];
    items.push(isTask ? node('taskItem', { checked: lm.checked }, content) : node('listItem', null, content));
  }

  const type = isTask ? 'taskList' : ordered ? 'orderedList' : 'bulletList';
  return { node: node(type, ordered ? { start } : null, items), next: i };
}

/* ── Tables ─────────────────────────────────────────────── */

function isAlignRow(line) {
  return /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/.test(line) && line.includes('-');
}

function parseTable(lines, i) {
  const aligns = splitRow(lines[i + 1]).map(parseAlign);
  const rows = [makeRow(splitRow(lines[i]), aligns, true)];
  let j = i + 2;
  while (j < lines.length && lines[j].includes('|') && !isBlank(lines[j])) {
    if (/^#{1,6}\s+/.test(lines[j]) || matchListMarker(lines[j])) break;
    rows.push(makeRow(splitRow(lines[j]), aligns, false));
    j++;
  }
  return { node: node('table', null, rows), next: j };
}

function splitRow(line) {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
  const cells = [];
  let cur = '';
  for (let k = 0; k < s.length; k++) {
    if (s[k] === '\\' && s[k + 1] === '|') { cur += '|'; k++; continue; }
    if (s[k] === '|') { cells.push(cur); cur = ''; continue; }
    cur += s[k];
  }
  cells.push(cur);
  return cells.map((c) => c.trim());
}

function parseAlign(spec) {
  const s = spec.trim();
  const l = s.startsWith(':'), r = s.endsWith(':');
  if (l && r) return 'center';
  if (r) return 'right';
  if (l) return 'left';
  return null;
}

function makeRow(cells, aligns, header) {
  const tcs = cells.map((c, idx) => {
    // A cell whose text is a formula (=…) becomes a single formula atom so it
    // round-trips Markdown and computes live. Header cells stay literal.
    const trimmed = (c || '').trim();
    const inline = (!header && /^=\S/.test(trimmed))
      ? [node('formula', { src: trimmed })]
      : parseInline(c);
    return node('tableCell', { header, align: aligns[idx] || null }, [node('paragraph', null, inline)]);
  });
  return node('tableRow', null, tcs);
}

/* ── Inline parsing ─────────────────────────────────────── */

function parseInline(text, marks = []) {
  const out = [];
  let buf = '';
  const s = text;
  const flush = () => { if (buf !== '') { out.push(makeText(buf, marks)); buf = ''; } };

  let p = 0;
  while (p < s.length) {
    const c = s[p];

    if (c === '\\' && s[p + 1] === '\n') { flush(); out.push({ type: 'hardBreak' }); p += 2; continue; }
    if (c === '\n') { flush(); out.push({ type: 'hardBreak' }); p++; continue; }
    if (c === '\\' && p + 1 < s.length && /[\\`*_~=[\]$<>!]/.test(s[p + 1])) { buf += s[p + 1]; p += 2; continue; }

    const sub = s.slice(p);
    let m;

    if (c === '`' && (m = sub.match(/^(`+)([\s\S]*?)\1/))) {
      flush(); out.push(makeText(m[2], addM(marks, 'code'))); p += m[0].length; continue;
    }
    if (c === '!' && (m = sub.match(/^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)(\{[^}]*\})?/))) {
      flush(); out.push(parseImageMatch(m)); p += m[0].length; continue;
    }
    if (c === '$' && s[p + 1] !== '$' && (m = sub.match(/^\$([^$\n]+?)\$/))) {
      flush(); out.push({ type: 'mathInline', attrs: { latex: m[1].trim() } }); p += m[0].length; continue;
    }
    if (c === '[' && (m = sub.match(/^\[((?:[^\][]|\[[^\]]*\])*)\]\(([^)\s]*)(?:\s+"([^"]*)")?\)/))) {
      flush(); out.push(...parseInline(m[1], addM(marks, 'link', { href: m[2] }))); p += m[0].length; continue;
    }
    if (c === '[' && (m = sub.match(/^\[((?:[^\][]|\[[^\]]*\])*)\]\{([^}]*)\}/))) {
      flush();
      let mm = marks;
      for (const sp of parseSpanAttrs(m[2])) mm = addMark(mm, sp);
      out.push(...parseInline(m[1], mm));
      p += m[0].length; continue;
    }
    if (c === '*' && s.slice(p, p + 3) === '***' && (m = sub.match(/^\*\*\*([\s\S]+?)\*\*\*/))) {
      flush(); out.push(...parseInline(m[1], addMark(addM(marks, 'bold'), mark('italic')))); p += m[0].length; continue;
    }
    if (c === '*' && s[p + 1] === '*' && (m = sub.match(/^\*\*([\s\S]+?)\*\*/))) {
      flush(); out.push(...parseInline(m[1], addM(marks, 'bold'))); p += m[0].length; continue;
    }
    if (c === '~' && s[p + 1] === '~' && (m = sub.match(/^~~([\s\S]+?)~~/))) {
      flush(); out.push(...parseInline(m[1], addM(marks, 'strike'))); p += m[0].length; continue;
    }
    if (c === '=' && s[p + 1] === '=' && (m = sub.match(/^==([\s\S]+?)==/))) {
      flush(); out.push(...parseInline(m[1], addM(marks, 'highlight'))); p += m[0].length; continue;
    }
    if ((c === '*' || c === '_') && (m = sub.match(c === '*' ? /^\*([^\s*][\s\S]*?)\*/ : /^_([^\s_][\s\S]*?)_/))) {
      flush(); out.push(...parseInline(m[1], addM(marks, 'italic'))); p += m[0].length; continue;
    }

    buf += c; p++;
  }
  flush();
  return mergeAdjacentText(out);
}

function parseImageMatch(m) {
  const attrs = { src: m[2], alt: m[1] || null, title: m[3] || null };
  if (m[4]) Object.assign(attrs, parseImageAttrs(m[4].slice(1, -1)));
  return node('image', attrs);
}

function parseImageAttrs(str) {
  const out = {};
  for (const t of str.trim().split(/\s+/)) {
    if (t.startsWith('w=')) out.width = parseInt(t.slice(2), 10) || null;
    else if (t.startsWith('align=')) out.alignment = t.slice(6);
    else if (t === 'wrap') out.textWrap = true;
  }
  return out;
}

function parseSpanAttrs(str) {
  let color = null, font = null, hl = false, hlColor = null, u = false;
  for (const t of str.trim().split(/\s+/)) {
    if (t === 'hl') hl = true;
    else if (t === 'u') u = true;
    else if (t.startsWith('bg=')) { hl = true; hlColor = t.slice(3); }
    else if (t.startsWith('color=')) color = t.slice(6);
    else if (t.startsWith('font=')) font = t.slice(5).replace(/_/g, ' ');
  }
  const marks = [];
  if (hl) marks.push(mark('highlight', hlColor ? { color: hlColor } : {}));
  if (color || font) marks.push(mark('textStyle', { color, fontFamily: font }));
  if (u) marks.push(mark('underline'));
  return marks;
}

const addM = (marks, type, attrs) => addMark(marks, mark(type, attrs));

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

const isBlank = (s) => /^\s*$/.test(s);
const leadingSpaces = (s) => (s.match(/^ */) || [''])[0].length;

export default markdownToAst;
