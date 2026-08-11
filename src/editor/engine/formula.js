/**
 * formula.js — a small, dependency-free spreadsheet-formula engine for tables.
 *
 * Scope (the "core set" Tom chose): arithmetic (+ - * / %, parentheses, unary
 * minus), cell refs (A1), ranges (A1:B3) and whole-column ranges (C:C), and the
 * functions SUM / AVERAGE (AVG) / MIN / MAX / COUNT / PRODUCT. Errors surface as
 * Excel-style sentinels (#DIV/0!, #REF!, #NAME?, #CIRC!, #ERR!).
 *
 * Formulas live as the literal `=…` text of a table cell so they round-trip
 * through Markdown unchanged; the computed value is derived here (transient).
 *
 * References are resolved against the table's VISUAL grid (see tables.js), so
 * A1 always means the cell the user sees under column A even when the table
 * contains merged cells.
 */
import { tableGrid } from './tables.js';
import { colLabel, colToIndex, parseAnyRef } from './formulaRefs.js';

// Re-exported so existing importers of formula.js keep working.
export { colLabel, colToIndex, parseAnyRef };

/* ── cell-shape helpers (table AST) ──────────────────────── */

/** Raw cell text that denotes a formula (leading `=`). */
export const rawIsFormula = (raw) => typeof raw === 'string' && /^\s*=/.test(raw);

/**
 * A formula cell: every block is a paragraph, exactly ONE formula atom in
 * total, and every other inline node is whitespace-only text. The strict
 * "exactly [paragraph[formula]]" shape meant one stray character (e.g. a
 * keystroke that leaked past the atom, S1) silently de-formula'd the cell —
 * it froze at its last value and read as ""/0 in ranges (S7). Strays are
 * canonicalized away by the deep normalizer.
 */
export function isFormulaCell(cell) {
  const blocks = cell?.content || [];
  if (!blocks.length) return false;
  let formulas = 0;
  for (const b of blocks) {
    if (b?.type !== 'paragraph') return false;
    for (const inl of b.content || []) {
      if (inl?.type === 'formula') formulas += 1;
      else if (inl?.type === 'text') { if ((inl.text || '').trim() !== '') return false; }
      else return false;
      if (formulas > 1) return false;
    }
  }
  return formulas === 1;
}

/** The (single) formula atom of a cell, or null. Walks the relaxed shape. */
export function findFormulaAtom(cell) {
  for (const b of cell?.content || []) {
    for (const inl of b?.content || []) if (inl?.type === 'formula') return inl;
  }
  return null;
}

export function formulaSrc(cell) {
  return findFormulaAtom(cell)?.attrs?.src || '';
}

function cellPlainText(cell) {
  const parts = [];
  const walk = (n) => { if (!n) return; if (n.type === 'text') parts.push(n.text || ''); (n.content || []).forEach(walk); };
  (cell?.content || []).forEach(walk);
  return parts.join('');
}

const cellRaw = (cell) => (isFormulaCell(cell) ? formulaSrc(cell) : cellPlainText(cell));

/* ── tokenizer + parser/evaluator ────────────────────────── */

function tokenize(src) {
  const toks = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9.]/.test(c)) {
      let j = i; while (j < src.length && /[0-9.]/.test(src[j])) j++;
      const lit = src.slice(i, j);
      // parseFloat stops at the second dot, so "1.2.3" silently became 1.2.
      const n = Number(lit);
      if (!Number.isFinite(n)) throw { e: '#ERR!' };
      toks.push({ t: 'num', v: n }); i = j; continue;
    }
    if (/[A-Za-z]/.test(c)) {
      let j = i; while (j < src.length && /[A-Za-z0-9]/.test(src[j])) j++;
      toks.push({ t: 'ident', v: src.slice(i, j) }); i = j; continue;
    }
    if ('+-*/(),:%'.includes(c)) { toks.push({ t: c }); i++; continue; }
    if (c === '#') {
      // An error sentinel embedded literally in the source — most commonly the
      // #REF! a structural remap writes over a deleted reference. Evaluating
      // any expression containing it yields THAT error, not a generic #ERR!.
      const m = /^#[A-Za-z0-9/]+[!?]/.exec(src.slice(i));
      if (m) throw { e: m[0].toUpperCase() };
      throw { e: '#ERR!' };
    }
    throw { e: '#ERR!' };
  }
  return toks;
}

const FUNCS = {
  SUM: (n) => n.reduce((a, b) => a + b, 0),
  AVERAGE: (n) => { if (!n.length) throw { e: '#DIV/0!' }; return n.reduce((a, b) => a + b, 0) / n.length; },
  AVG: (n) => FUNCS.AVERAGE(n),
  MIN: (n) => (n.length ? Math.min(...n) : 0),
  MAX: (n) => (n.length ? Math.max(...n) : 0),
  COUNT: (n) => n.length,
  PRODUCT: (n) => (n.length ? n.reduce((a, b) => a * b, 1) : 0),
};

function evalExpr(toks, ctx) {
  let pos = 0;
  const peek = () => toks[pos];
  const next = () => toks[pos++];
  const expect = (t) => { if (!peek() || peek().t !== t) throw { e: '#ERR!' }; return next(); };

  function parseExpr() {
    let v = parseTerm();
    while (peek() && (peek().t === '+' || peek().t === '-')) {
      const op = next().t; const r = parseTerm();
      v = op === '+' ? v + r : v - r;
    }
    return v;
  }
  function parseTerm() {
    let v = parseUnary();
    while (peek() && (peek().t === '*' || peek().t === '/')) {
      const op = next().t; const r = parseUnary();
      if (op === '/') { if (r === 0) throw { e: '#DIV/0!' }; v /= r; } else v *= r;
    }
    return v;
  }
  function parseUnary() {
    if (peek() && peek().t === '-') { next(); return -parseUnary(); }
    if (peek() && peek().t === '+') { next(); return parseUnary(); }
    return parsePostfix();
  }
  function parsePostfix() {
    let v = parsePrimary();
    while (peek() && peek().t === '%') { next(); v /= 100; }
    return v;
  }
  function parsePrimary() {
    const tk = peek();
    if (!tk) throw { e: '#ERR!' };
    if (tk.t === 'num') { next(); return tk.v; }
    if (tk.t === '(') { next(); const v = parseExpr(); expect(')'); return v; }
    if (tk.t === 'ident') {
      next();
      if (peek() && peek().t === '(') { next(); const args = parseArgs(); expect(')'); return callFunc(tk.v.toUpperCase(), args); }
      // Bare range outside a function call — `=B2:C3` (drag pick), `=B:B`
      // (column-strip pick), `=A1+B2:B4` — folds through SUM. A single bare
      // column letter without the colon (`=B`) is still #NAME? below.
      if (peek() && peek().t === ':') {
        next();
        if (!peek() || peek().t !== 'ident') throw { e: '#ERR!' };
        const b = next().v;
        return FUNCS.SUM(ctx.collectRange(tk.v, b));
      }
      const ref = parseAnyRef(tk.v);
      if (ref && !ref.col) return ctx.numberAt(ref.r, ref.c);
      throw { e: '#NAME?' };
    }
    throw { e: '#ERR!' };
  }
  function parseArgs() {
    const args = [];
    if (peek() && peek().t === ')') return args;
    args.push(parseArg());
    while (peek() && peek().t === ',') { next(); args.push(parseArg()); }
    return args;
  }
  function parseArg() {
    if (peek() && peek().t === 'ident' && toks[pos + 1] && toks[pos + 1].t === ':') {
      const a = next().v; expect(':');
      if (!peek() || peek().t !== 'ident') throw { e: '#ERR!' };
      const b = next().v;
      return { range: ctx.collectRange(a, b) };
    }
    return { scalar: parseExpr() };
  }
  function callFunc(name, args) {
    const f = FUNCS[name];
    if (!f) throw { e: '#NAME?' };
    const nums = [];
    for (const a of args) { if (a.range) nums.push(...a.range); else nums.push(a.scalar); }
    return f(nums);
  }

  const result = parseExpr();
  if (pos !== toks.length) throw { e: '#ERR!' };
  if (!Number.isFinite(result)) throw { e: '#NUM!' };
  return result;
}

/* ── table evaluation ────────────────────────────────────── */

/**
 * Evaluate every formula cell in a table node. Returns a Map keyed "r,c"
 * → { value } | { error }. Resolves cross-cell refs with cycle detection.
 */
export function evaluateTable(table) {
  const rows = table?.content || [];
  // References are VISUAL: A1 is the first column as the user sees it. Building
  // the lookup from array indices meant that in any table with a merged cell,
  // A1 addressed a different cell than the one labelled A. `grid[r][c]` is the
  // raw text occupying visual slot (r, c); a merged cell repeats its own text
  // across every slot it covers, which is what a spreadsheet does too.
  const { grid: vgrid, rows: nRows, cols: nCols } = tableGrid(table);
  const grid = [];
  for (let r = 0; r < nRows; r++) {
    grid[r] = [];
    for (let c = 0; c < nCols; c++) {
      const e = vgrid[r]?.[c];
      grid[r][c] = e ? cellRaw(e.cell) : '';
    }
  }
  const memo = new Map();
  const evaluating = new Set();
  // Whole-column ranges (A:A) should aggregate the DATA, not the header label —
  // used by collectRange below.
  const hasHeaderRow = !!(rows[0]?.content?.[0]?.attrs?.header);

  function cellNumericValue(r, c, { strict = false } = {}) {
    if (r < 0 || c < 0 || r >= grid.length || c >= (grid[r] ? grid[r].length : 0)) {
      // A DIRECT reference to a cell outside the table is an error. It used to
      // fall through to numberAt's `|| 0`, so a typo'd reference in a financial
      // table produced a plausible wrong number instead of #REF!. Inside a
      // RANGE, out-of-bounds slots are just skipped (strict = false).
      if (strict) throw { e: '#REF!' };
      return { isNumber: false };
    }
    const raw = grid[r][c];
    if (rawIsFormula(raw)) {
      // A member that is CURRENTLY being evaluated means the range contains
      // the formula itself (or an ancestor) — genuine circularity always
      // propagates, strict or not, or a self-range SUM would quietly compute
      // a wrong number from the remaining cells.
      if (evaluating.has(`${r},${c}`)) throw { e: '#CIRC!' };
      const res = formulaResult(r, c);
      if (res.error) {
        // DIRECT refs propagate the error; inside a RANGE the erroring cell is
        // skipped so one #REF! doesn't blank a whole column SUM (S10 —
        // deliberate deviation from Excel's propagate-everything semantics).
        if (strict) throw { e: res.error };
        return { isNumber: false };
      }
      if (res.blank) return { isNumber: false }; // empty formula ⇒ empty cell
      return { isNumber: true, num: res.value };
    }
    const t = (raw || '').trim();
    if (t === '') return { isNumber: false };
    const n = Number(t);
    return Number.isFinite(n) ? { isNumber: true, num: n } : { isNumber: false };
  }

  function numberAt(r, c) { const v = cellNumericValue(r, c, { strict: true }); return v.isNumber ? v.num : 0; }

  function collectRange(aStr, bStr) {
    const a = parseAnyRef(aStr); const b = parseAnyRef(bStr);
    if (!a || !b || a.col !== b.col) throw { e: '#REF!' };
    let r1; let r2; let c1; let c2;
    if (a.col) { c1 = Math.min(a.c, b.c); c2 = Math.max(a.c, b.c); r1 = hasHeaderRow ? 1 : 0; r2 = grid.length - 1; }
    else { r1 = Math.min(a.r, b.r); r2 = Math.max(a.r, b.r); c1 = Math.min(a.c, b.c); c2 = Math.max(a.c, b.c); }
    const nums = [];
    for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) { const v = cellNumericValue(r, c); if (v.isNumber) nums.push(v.num); }
    return nums;
  }

  function formulaResult(r, c) {
    const key = `${r},${c}`;
    if (memo.has(key)) return memo.get(key);
    if (evaluating.has(key)) { const res = { error: '#CIRC!' }; memo.set(key, res); return res; }
    evaluating.add(key);
    let res;
    try {
      const expr = grid[r][c].trim().slice(1); // strip leading '='
      if (!expr.trim()) res = { blank: true }; // a bare "=" is an empty formula, not an error
      else res = { value: evalExpr(tokenize(expr), { numberAt, collectRange }) };
    } catch (e) {
      res = { error: (e && e.e) || '#ERR!' };
    }
    evaluating.delete(key);
    memo.set(key, res);
    return res;
  }

  // Output stays keyed by ARRAY position (`rowIdx,cellIdx`) — that is what the
  // renderers and the normalizer address cells by — while the evaluation above
  // resolved references visually.
  const out = new Map();
  for (let r = 0; r < nRows; r++) {
    for (let c = 0; c < nCols; c++) {
      const e = vgrid[r]?.[c];
      if (!e || e.originR !== r || e.originC !== c) continue;   // covered slot
      if (!rawIsFormula(grid[r][c])) continue;
      out.set(`${e.rowIdx},${e.cellIdx}`, formulaResult(r, c));
    }
  }
  return out;
}

/**
 * Display matrix of a table: rows of cell strings, with formula cells resolved to
 * their computed value. Used to snapshot a table into a chart.
 */
export function tableToMatrix(table) {
  const results = evaluateTable(table);
  return (table?.content || []).map((row, r) => (row.content || []).map((cell, c) => (
    isFormulaCell(cell) ? displayResult(results.get(`${r},${c}`)) : cellPlainText(cell)
  )));
}

/** Pretty-print a numeric result (trim float noise) or pass through an error. */
export function formatNumber(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '#NUM!';
  return String(Math.round(n * 1e10) / 1e10);
}

/** Display string for an evaluateTable() result entry. */
export function displayResult(res) {
  if (!res || res.blank) return '';
  return res.error ? res.error : formatNumber(res.value);
}
