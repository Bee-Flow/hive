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
 */

/* ── A1 reference helpers ────────────────────────────────── */

export function colLabel(index) {
  let i = index + 1;
  let s = '';
  while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); }
  return s;
}

export function colToIndex(label) {
  let n = 0;
  for (const ch of label.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** "A1" → {r,c} (0-based); "A" → {col:true,c}; else null. */
export function parseAnyRef(token) {
  const cell = /^([A-Za-z]+)(\d+)$/.exec(token);
  if (cell) return { r: parseInt(cell[2], 10) - 1, c: colToIndex(cell[1]), col: false };
  const col = /^([A-Za-z]+)$/.exec(token);
  if (col) return { c: colToIndex(col[1]), col: true };
  return null;
}

/* ── cell-shape helpers (table AST) ──────────────────────── */

export function isFormulaCell(cell) {
  const blocks = cell?.content || [];
  if (blocks.length !== 1) return false;
  const inl = blocks[0]?.content || [];
  return inl.length === 1 && inl[0]?.type === 'formula';
}

export function formulaSrc(cell) {
  return cell?.content?.[0]?.content?.[0]?.attrs?.src || '';
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
      toks.push({ t: 'num', v: parseFloat(src.slice(i, j)) }); i = j; continue;
    }
    if (/[A-Za-z]/.test(c)) {
      let j = i; while (j < src.length && /[A-Za-z0-9]/.test(src[j])) j++;
      toks.push({ t: 'ident', v: src.slice(i, j) }); i = j; continue;
    }
    if ('+-*/(),:%'.includes(c)) { toks.push({ t: c }); i++; continue; }
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
  const grid = rows.map((row) => (row.content || []).map(cellRaw));
  const memo = new Map();
  const evaluating = new Set();

  const rawIsFormula = (raw) => typeof raw === 'string' && /^\s*=/.test(raw);

  function cellNumericValue(r, c) {
    if (r < 0 || c < 0 || r >= grid.length || c >= (grid[r] ? grid[r].length : 0)) return { isNumber: false };
    const raw = grid[r][c];
    if (rawIsFormula(raw)) {
      const res = formulaResult(r, c);
      if (res.error) throw { e: res.error };
      if (res.blank) return { isNumber: false }; // empty formula ⇒ empty cell
      return { isNumber: true, num: res.value };
    }
    const t = (raw || '').trim();
    if (t === '') return { isNumber: false };
    const n = Number(t);
    return Number.isFinite(n) ? { isNumber: true, num: n } : { isNumber: false };
  }

  function numberAt(r, c) { const v = cellNumericValue(r, c); return v.isNumber ? v.num : 0; }

  function collectRange(aStr, bStr) {
    const a = parseAnyRef(aStr); const b = parseAnyRef(bStr);
    if (!a || !b || a.col !== b.col) throw { e: '#REF!' };
    let r1; let r2; let c1; let c2;
    if (a.col) { c1 = Math.min(a.c, b.c); c2 = Math.max(a.c, b.c); r1 = 0; r2 = grid.length - 1; }
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

  const out = new Map();
  for (let r = 0; r < rows.length; r++) {
    const cols = rows[r].content || [];
    for (let c = 0; c < cols.length; c++) if (rawIsFormula(grid[r][c])) out.set(`${r},${c}`, formulaResult(r, c));
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
