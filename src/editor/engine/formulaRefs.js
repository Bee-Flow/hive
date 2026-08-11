/**
 * formulaRefs.js — A1-style reference helpers.
 *
 * Split out of formula.js so both the evaluator and tables.js can use them:
 * formula.js needs the table grid (for visual addressing) and tables.js needs
 * column labels (for the header strip and click-to-pick), which would otherwise
 * be a cycle. Pure functions, no imports.
 */

/** 0 → "A", 25 → "Z", 26 → "AA". */
export function colLabel(index) {
  let i = index + 1;
  let s = '';
  while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); }
  return s;
}

/** "A" → 0, "AA" → 26. */
export function colToIndex(label) {
  let n = 0;
  for (const ch of label.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** "A1" → {r,c,col:false}; "A" → {c,col:true}; else null. */
export function parseAnyRef(token) {
  const cell = /^([A-Za-z]+)(\d+)$/.exec(token);
  if (cell) return { r: parseInt(cell[2], 10) - 1, c: colToIndex(cell[1]), col: false };
  const col = /^([A-Za-z]+)$/.exec(token);
  if (col) return { c: colToIndex(col[1]), col: true };
  return null;
}
