/**
 * formulaRemap.js — rewrite A1-style references in formula sources after a
 * structural table operation (add/delete row/column), S6.
 *
 * Before this pass existed, `=B3` silently pointed at the wrong row the moment
 * a row was inserted above it, and a deleted reference produced a plausible
 * wrong number instead of an error.
 *
 * Deliberately imports ONLY formulaRefs.js: tables.js needs this module while
 * formula.js imports tables.js, so importing formula.js here would close an
 * import cycle. The tiny formula-atom walk is therefore duplicated from
 * formula.js's findFormulaAtom — keep the shapes in sync.
 */
import { colLabel, colToIndex } from './formulaRefs.js';

const identity = (v) => v;

/**
 * Map a range dimension [lo, hi] (old 0-based indices) through `map`. A deleted
 * endpoint (map → null) CLAMPS inward to the nearest surviving member instead
 * of killing the whole range; null when nothing in the span survives.
 */
function mapSpan(map, lo, hi) {
  let a = null;
  for (let v = lo; v <= hi; v++) { const m = map(v); if (m != null) { a = m; break; } }
  if (a == null) return null;
  let b = a;
  for (let v = hi; v >= lo; v--) { const m = map(v); if (m != null) { b = m; break; } }
  return [a, b];
}

// One scan alternation: an error sentinel (left untouched — it must not have
// its inner letters mistaken for a reference), or an identifier optionally
// followed by a `:identifier` range tail.
const TOKEN_RX = /#[A-Za-z0-9/]+[!?]|([A-Za-z]+)(\d+)?(?:\s*:\s*([A-Za-z]+)(\d+)?)?/g;

/**
 * Rewrite the refs/ranges of one formula source through row/column index maps.
 *
 * @param {string} src        formula source, e.g. "=SUM(B2:B3)+C1"
 * @param {object} mapping    { rowMap?, colMap? } — (oldIndex) → newIndex,
 *   null for a deleted index; both default to identity. Indices are 0-based
 *   VISUAL grid coordinates (row 0 = spreadsheet row 1).
 * @returns {string}          the rewritten source. A deleted lone ref becomes
 *   the literal `#REF!`; a range clamps a deleted endpoint to the nearest
 *   surviving index and becomes `#REF!` only when nothing survives.
 */
export function remapSrc(src, { rowMap = identity, colMap = identity } = {}) {
  if (typeof src !== 'string' || src === '') return src;
  return src.replace(TOKEN_RX, (m, L1, D1, L2, D2, offset) => {
    if (L1 === undefined) return m;                                   // #REF!-style sentinel
    // Part of a longer identifier (e.g. the "B2" inside "A1B2") — the
    // tokenizer reads that as ONE ident, so it is not a reference here.
    if (offset > 0 && /[A-Za-z0-9]/.test(src[offset - 1])) return m;
    const after = src.slice(offset + m.length);
    if (/^[A-Za-z0-9]/.test(after)) return m;

    if (L2 === undefined) {
      // Bare letters: a function name (SUM(...)), or a lone column letter that
      // the evaluator already rejects as #NAME? — never a remappable ref.
      if (D1 === undefined) return m;
      if (/^\s*\(/.test(after)) return m;                             // identifier used as a function name
      const r = parseInt(D1, 10) - 1;
      const c = colToIndex(L1);
      const nr = rowMap(r);
      const nc = colMap(c);
      if (nr == null || nc == null) return '#REF!';                   // referenced cell was deleted
      if (nr === r && nc === c) return m;
      return `${colLabel(nc)}${nr + 1}`;
    }

    // Range. A mixed form (B2:B) is already invalid (#REF! at eval) — leave it.
    if ((D1 === undefined) !== (D2 === undefined)) return m;
    const c1 = colToIndex(L1);
    const c2 = colToIndex(L2);
    const cLo = Math.min(c1, c2);
    const cHi = Math.max(c1, c2);
    const cs = mapSpan(colMap, cLo, cHi);
    if (!cs) return '#REF!';
    if (D1 === undefined) {                                           // whole-column range B:B
      if (cs[0] === cLo && cs[1] === cHi) return m;
      return `${colLabel(cs[0])}:${colLabel(cs[1])}`;
    }
    const r1 = parseInt(D1, 10) - 1;
    const r2 = parseInt(D2, 10) - 1;
    const rLo = Math.min(r1, r2);
    const rHi = Math.max(r1, r2);
    const rs = mapSpan(rowMap, rLo, rHi);
    if (!rs) return '#REF!';
    if (rs[0] === rLo && rs[1] === rHi && cs[0] === cLo && cs[1] === cHi) return m;
    return `${colLabel(cs[0])}${rs[0] + 1}:${colLabel(cs[1])}${rs[1] + 1}`;
  });
}

/** The (single) formula atom of a cell in the relaxed shape, or null.
 *  Duplicates formula.js's findFormulaAtom to avoid the import cycle. */
function locateAtom(cell) {
  const blocks = cell?.content || [];
  for (let bi = 0; bi < blocks.length; bi++) {
    const inl = blocks[bi]?.content || [];
    for (let ii = 0; ii < inl.length; ii++) {
      if (inl[ii]?.type === 'formula') return { bi, ii, atom: inl[ii] };
    }
  }
  return null;
}

/**
 * Rewrite every formula src in `table` through `mapping`. Node identity is
 * preserved for rows/cells whose formulas are unchanged, so the reconciler
 * only re-renders what actually moved.
 */
export function remapFormulasInTable(table, mapping) {
  let tChanged = false;
  const rows = (table?.content || []).map((row) => {
    let rChanged = false;
    const cells = (row.content || []).map((cell) => {
      const loc = locateAtom(cell);
      if (!loc) return cell;
      const src = loc.atom.attrs?.src || '';
      const next = remapSrc(src, mapping);
      if (next === src) return cell;
      rChanged = true;
      const block = cell.content[loc.bi];
      const inl = block.content.slice();
      inl[loc.ii] = { ...loc.atom, attrs: { ...(loc.atom.attrs || {}), src: next } };
      const blocks = cell.content.slice();
      blocks[loc.bi] = { ...block, content: inl };
      return { ...cell, content: blocks };
    });
    if (!rChanged) return row;
    tChanged = true;
    return { ...row, content: cells };
  });
  return tChanged ? { ...table, content: rows } : table;
}
