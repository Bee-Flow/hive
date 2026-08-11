/**
 * normalize.js — document invariants.
 *
 * normalizeLight runs after every transaction: it is selection-safe (never drops
 * or reorders blocks that would shift live caret paths) — it only merges adjacent
 * equal-mark text runs and guarantees the doc is non-empty and ends in a
 * textblock so the caret always has somewhere to land.
 *
 * normalizeDeep additionally prunes empty containers; it runs only on content
 * import (setContent / replaceDoc), where the selection is reset anyway.
 */
import { isTextblock, isAtom } from '../model/schema.js';
import { emptyParagraph } from '../model/nodes.js';
import { sameMarkSet, sortMarks } from '../model/marks.js';
import { evaluateTable, displayResult, isFormulaCell } from './formula.js';

export function normalizeLight(doc) {
  let content = (doc.content || []).map(lightNode);
  if (content.length === 0) content = [emptyParagraph()];
  if (isAtom(content[content.length - 1].type)) content = [...content, emptyParagraph()];
  return recomputeFormulas({ type: 'doc', content });
}

function lightNode(n) {
  if (n.type === 'text' || isAtom(n.type) || !n.content) return n;
  if (isTextblock(n.type)) return { ...n, content: mergeText(n.content) };
  return { ...n, content: n.content.map(lightNode) };
}

export function normalizeDeep(doc) {
  let content = (doc.content || []).map(deepNode).filter(Boolean);
  if (content.length === 0) content = [emptyParagraph()];
  if (isAtom(content[content.length - 1].type)) content = [...content, emptyParagraph()];
  return recomputeFormulas({ type: 'doc', content });
}

/* ── formula recompute (transient value/error on formula atoms) ──────────── */
// Walks tables and refreshes each formula cell's computed display. Identity is
// preserved for unchanged cells so the reconciler only re-renders cells whose
// value actually changed (e.g. an edit to a referenced cell). Selection-safe:
// an atom is always one token, so positions never shift.
export function recomputeFormulas(doc) {
  const content = (doc.content || []).map(recomputeNode);
  return { type: 'doc', content };
}

function recomputeNode(n) {
  if (!n || n.type === 'text' || isAtom(n.type)) return n;
  if (n.type === 'table') return recomputeTable(n);
  if (!n.content) return n;
  let changed = false;
  const content = n.content.map((c) => { const nc = recomputeNode(c); if (nc !== c) changed = true; return nc; });
  return changed ? { ...n, content } : n;
}

/** Locate a cell's formula atom in the relaxed shape: {blockIdx, inlineIdx, atom}. */
function locateFormulaAtom(cell) {
  const blocks = cell?.content || [];
  for (let bi = 0; bi < blocks.length; bi++) {
    const inl = blocks[bi]?.content || [];
    for (let ii = 0; ii < inl.length; ii++) {
      if (inl[ii]?.type === 'formula') return { blockIdx: bi, inlineIdx: ii, atom: inl[ii] };
    }
  }
  return null;
}

function recomputeTable(table) {
  let results;
  try { results = evaluateTable(table); } catch (e) { results = new Map(); }
  let tChanged = false;
  const rows = (table.content || []).map((row, r) => {
    let rChanged = false;
    const cells = (row.content || []).map((cell, c) => {
      if (!isFormulaCell(cell)) return cell;
      // The atom is found by search, not assumed at content[0].content[0]:
      // the relaxed cell shape allows whitespace-only strays around it.
      const loc = locateFormulaAtom(cell);
      if (!loc) return cell;
      const res = results.get(`${r},${c}`);
      const display = displayResult(res);
      const isErr = !!(res && res.error);
      const { atom } = loc;
      if (atom.attrs?.value === display && !!atom.attrs?.error === isErr) return cell;
      rChanged = true;
      const newAtom = { ...atom, attrs: { ...(atom.attrs || {}), value: display, error: isErr } };
      const block = cell.content[loc.blockIdx];
      const inl = block.content.slice();
      inl[loc.inlineIdx] = newAtom;
      const blocks = cell.content.slice();
      blocks[loc.blockIdx] = { ...block, content: inl };
      return { ...cell, content: blocks };
    });
    if (!rChanged) return row;
    tChanged = true;
    return { ...row, content: cells };
  });
  return tChanged ? { ...table, content: rows } : table;
}

function deepNode(n) {
  if (n.type === 'text') return n.text === '' ? null : n;
  if (isAtom(n.type) || !n.content) return n;
  if (isTextblock(n.type)) return { ...n, content: mergeText(n.content) };
  // Flatten a table nested inside a cell — a legacy S8 artifact (new nesting is
  // impossible: transforms route table inserts after the host table). One
  // paragraph per nested row, cell texts joined with " | ". Lossy by design;
  // Markdown could not represent the nesting anyway.
  if (n.type === 'tableCell' && (n.content || []).some((c) => c?.type === 'table')) {
    const content = [];
    for (const child of n.content) {
      if (child?.type === 'table') content.push(...flattenNestedTable(child));
      else { const d = deepNode(child); if (d) content.push(d); }
    }
    return { ...n, content: content.length ? content : [emptyParagraph()] };
  }
  // Canonicalize a formula cell to exactly [paragraph[formula]] — whitespace
  // strays (leaked keystrokes, serializer padding) are tolerated at runtime by
  // the relaxed isFormulaCell but stripped on import. DEEP pass only: the
  // light (per-transaction) normalizer must never shift live caret positions.
  if (n.type === 'tableCell' && isFormulaCell(n)) {
    const loc = locateFormulaAtom(n);
    if (loc) return { ...n, content: [{ ...n.content[loc.blockIdx], content: [loc.atom] }] };
  }
  const content = n.content.map(deepNode).filter(Boolean);
  if (content.length === 0) {
    if (n.type === 'listItem' || n.type === 'taskItem' || n.type === 'tableCell') return { ...n, content: [emptyParagraph()] };
    return null; // empty list / blockquote / table / row → drop
  }
  return { ...n, content };
}

/** One paragraph per nested-table row: the row's cell texts joined " | ". */
function flattenNestedTable(table) {
  return (table.content || []).map((row) => {
    const text = (row.content || []).map(plainTextOf).join(' | ');
    return text.trim() === ''
      ? emptyParagraph()
      : { type: 'paragraph', content: [{ type: 'text', text }] };
  });
}

function plainTextOf(n) {
  const parts = [];
  const walk = (x) => {
    if (!x) return;
    if (x.type === 'text') parts.push(x.text || '');
    if (x.type === 'formula') parts.push(x.attrs?.src || '');
    (x.content || []).forEach(walk);
  };
  walk(n);
  return parts.join('').trim();
}

function mergeText(content) {
  const out = [];
  for (const c of content) {
    if (c.type === 'text' && c.text === '') continue;
    const last = out[out.length - 1];
    if (c.type === 'text' && last && last.type === 'text' && sameMarkSet(last.marks || [], c.marks || [])) {
      out[out.length - 1] = { ...last, text: last.text + c.text };
    } else if (c.type === 'text') {
      out.push(c.marks && c.marks.length ? { ...c, marks: sortMarks(c.marks) } : { type: 'text', text: c.text });
    } else {
      out.push(c);
    }
  }
  return out;
}
