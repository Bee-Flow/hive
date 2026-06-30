/**
 * inline.js — token model for a textblock's inline content.
 *
 * Inline content is flattened to a list of tokens where each text token is one
 * UTF-16 code unit (so offsets match DOM text-node offsets exactly) and each
 * inline atom (hardBreak, mathInline, inline image) is a single token. Editing
 * text, deleting ranges and toggling marks all become trivial array splices on
 * tokens; `tokensToInline` re-merges adjacent equal-mark runs back into the AST.
 */
import { sameMarkSet, sortMarks, hasMark, addMark, removeMark } from '../model/marks.js';

/** @typedef {{ch:string, marks:Array}|{node:Object}} Token */

export function inlineToTokens(content = []) {
  const toks = [];
  for (const n of content) {
    if (n.type === 'text') {
      const marks = n.marks || [];
      for (let i = 0; i < n.text.length; i++) toks.push({ ch: n.text[i], marks });
    } else {
      toks.push({ node: n });
    }
  }
  return toks;
}

export function tokensToInline(toks) {
  const out = [];
  let buf = '';
  let bufMarks = null;
  const flush = () => {
    if (buf) {
      out.push(bufMarks && bufMarks.length ? { type: 'text', text: buf, marks: sortMarks(bufMarks) } : { type: 'text', text: buf });
      buf = '';
    }
  };
  for (const t of toks) {
    if (t.node) { flush(); out.push(t.node); bufMarks = null; }
    else {
      if (buf && !sameMarkSet(bufMarks || [], t.marks || [])) flush();
      buf += t.ch;
      bufMarks = t.marks || [];
    }
  }
  flush();
  return out;
}

export const blockLength = (block) => inlineToTokens(block.content || []).length;

/** Marks active at a boundary offset (for typing — inherits the mark before the caret). */
export function marksAt(toks, offset) {
  const t = toks[offset - 1] || toks[offset];
  if (!t || t.node) return [];
  return t.marks || [];
}

/** Build text tokens for a string with a given mark set. */
export function textTokens(str, marks = []) {
  const toks = [];
  for (let i = 0; i < str.length; i++) toks.push({ ch: str[i], marks });
  return toks;
}

/** Toggle a mark across tokens[from,to). Returns new token array. */
export function toggleMarkTokens(toks, from, to, markType, attrs, force) {
  const slice = toks.slice(from, to);
  const textToks = slice.filter((t) => !t.node);
  // If every text token already has the mark (and not forcing add), remove it.
  const allHave = textToks.length > 0 && textToks.every((t) => hasMark(t.marks || [], markType));
  const add = force === undefined ? !allHave : force;
  const out = toks.slice();
  for (let i = from; i < to; i++) {
    const t = out[i];
    if (t.node) continue;
    const marks = add ? addMark(t.marks || [], { type: markType, ...(attrs ? { attrs } : {}) }) : removeMark(t.marks || [], markType);
    out[i] = { ch: t.ch, marks };
  }
  return out;
}

/* ── Grapheme-cluster boundaries ────────────────────────── */
// Tokens are one UTF-16 code unit each (so offsets match DOM text-node offsets),
// but a *delete* must remove a whole grapheme cluster — never half a surrogate
// pair or a ZWJ emoji sequence. These return how many tokens (code units) the
// cluster at a boundary spans; callers delete that many at once.

let _seg;
function segmenter() {
  if (_seg === undefined) {
    _seg = (typeof Intl !== 'undefined' && Intl.Segmenter) ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
  }
  return _seg;
}

function lastGrapheme(str) {
  if (!str) return '';
  const seg = segmenter();
  if (seg) { let r = ''; for (const s of seg.segment(str)) r = s.segment; return r; }
  // Fallback: keep a trailing surrogate pair intact.
  const i = str.length - 1;
  const lo = str.charCodeAt(i);
  if (lo >= 0xDC00 && lo <= 0xDFFF && i >= 1 && str.charCodeAt(i - 1) >= 0xD800 && str.charCodeAt(i - 1) <= 0xDBFF) return str.slice(i - 1);
  return str.slice(i);
}

function firstGrapheme(str) {
  if (!str) return '';
  const seg = segmenter();
  if (seg) { for (const s of seg.segment(str)) return s.segment; }
  const hi = str.charCodeAt(0);
  if (hi >= 0xD800 && hi <= 0xDBFF && str.length >= 2 && str.charCodeAt(1) >= 0xDC00 && str.charCodeAt(1) <= 0xDFFF) return str.slice(0, 2);
  return str.slice(0, 1);
}

/** Tokens to delete going backward from `offset` (a whole grapheme; ≥1; 0 at start). */
export function graphemeBackLen(toks, offset) {
  if (offset <= 0) return 0;
  if (!toks[offset - 1] || toks[offset - 1].node) return 1; // atom or boundary
  let start = offset;
  while (start > 0 && toks[start - 1] && !toks[start - 1].node) start--;
  const run = toks.slice(start, offset).map((t) => t.ch).join('');
  return lastGrapheme(run).length || 1;
}

/** Tokens to delete going forward from `offset` (a whole grapheme; ≥1). */
export function graphemeForwardLen(toks, offset) {
  if (!toks[offset] || toks[offset].node) return 1; // atom or boundary
  let end = offset;
  while (end < toks.length && toks[end] && !toks[end].node) end++;
  const run = toks.slice(offset, end).map((t) => t.ch).join('');
  return firstGrapheme(run).length || 1;
}

/** Plain text of a token slice (atoms contribute a placeholder). */
export function tokensText(toks, from = 0, to = toks.length) {
  let s = '';
  for (let i = from; i < to; i++) {
    const t = toks[i];
    if (t.node) s += t.node.type === 'hardBreak' ? '\n' : '';
    else s += t.ch;
  }
  return s;
}
