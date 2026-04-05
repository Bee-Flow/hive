/**
 * Lightweight spreadsheet formula evaluator.
 * Supports: basic arithmetic, cell references, ranges, and common functions.
 *
 * Usage:
 *   const result = evaluateFormula('=SUM(A1:A5)', cells);
 *   // cells is { "A1": { value: 10, formula: null }, "B2": { value: 20 } }
 */

// ─── Cell Reference Helpers ──────────────────────────────────────

function parseCellRef(ref) {
    const match = ref.match(/^([A-Z]+)(\d+)$/i);
    if (!match) return null;
    const colStr = match[1].toUpperCase();
    const row = parseInt(match[2], 10);
    let col = 0;
    for (let i = 0; i < colStr.length; i++) {
        col = col * 26 + (colStr.charCodeAt(i) - 64);
    }
    return { col, row }; // 1-based
}

function toCellRef(col, row) {
    let colStr = '';
    let c = col;
    while (c > 0) {
        c--;
        colStr = String.fromCharCode(65 + (c % 26)) + colStr;
        c = Math.floor(c / 26);
    }
    return `${colStr}${row}`;
}

/**
 * Expand a range like "A1:C3" into an array of cell refs.
 */
function expandRange(rangeStr) {
    const parts = rangeStr.split(':');
    if (parts.length !== 2) return [rangeStr];
    const start = parseCellRef(parts[0]);
    const end = parseCellRef(parts[1]);
    if (!start || !end) return [rangeStr];

    const refs = [];
    const minCol = Math.min(start.col, end.col);
    const maxCol = Math.max(start.col, end.col);
    const minRow = Math.min(start.row, end.row);
    const maxRow = Math.max(start.row, end.row);

    for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
            refs.push(toCellRef(c, r));
        }
    }
    return refs;
}

// ─── Get numeric value from a cell ──────────────────────────────

function getCellNumericValue(ref, cells, visited) {
    const cell = cells[ref.toUpperCase()];
    if (!cell) return 0;

    let raw;
    if (typeof cell === 'object' && cell !== null) {
        // If this cell has a formula, evaluate it recursively
        if (cell.formula && typeof cell.formula === 'string' && cell.formula.startsWith('=')) {
            return evaluateFormulaInner(cell.formula, cells, visited);
        }
        raw = cell.value;
    } else {
        raw = cell;
    }

    // If it's a string that looks like a formula
    if (typeof raw === 'string' && raw.startsWith('=')) {
        return evaluateFormulaInner(raw, cells, visited);
    }

    const num = Number(raw);
    return isNaN(num) ? 0 : num;
}

/**
 * Get an array of numeric values from a range (or single ref).
 */
function resolveValues(token, cells, visited) {
    if (token.includes(':')) {
        const refs = expandRange(token);
        return refs.map(r => getCellNumericValue(r, cells, visited));
    }
    // Single cell ref?
    if (/^[A-Z]+\d+$/i.test(token)) {
        return [getCellNumericValue(token, cells, visited)];
    }
    const n = Number(token);
    return [isNaN(n) ? 0 : n];
}

// ─── Built-in Functions ─────────────────────────────────────────

const FUNCTIONS = {
    SUM: (args) => args.reduce((a, b) => a + b, 0),
    AVERAGE: (args) => args.length ? args.reduce((a, b) => a + b, 0) / args.length : 0,
    AVG: (args) => FUNCTIONS.AVERAGE(args),
    MIN: (args) => args.length ? Math.min(...args) : 0,
    MAX: (args) => args.length ? Math.max(...args) : 0,
    COUNT: (args) => args.filter(v => typeof v === 'number' && !isNaN(v)).length,
    COUNTA: (args) => args.filter(v => v !== 0 && v !== '' && v != null).length,
    ABS: (args) => Math.abs(args[0] || 0),
    ROUND: (args) => {
        const val = args[0] || 0;
        const dec = args[1] || 0;
        const mult = Math.pow(10, dec);
        return Math.round(val * mult) / mult;
    },
    INT: (args) => Math.floor(args[0] || 0),
    SQRT: (args) => Math.sqrt(args[0] || 0),
    POWER: (args) => Math.pow(args[0] || 0, args[1] || 0),
    IF: null, // Special handling below
};

// ─── Tokenizer / Expression Parser ──────────────────────────────

/**
 * Split function arguments respecting nested parentheses.
 */
function splitArgs(str) {
    const args = [];
    let depth = 0;
    let current = '';
    for (let i = 0; i < str.length; i++) {
        const ch = str[i];
        if (ch === '(') depth++;
        else if (ch === ')') depth--;
        if (ch === ',' && depth === 0) {
            args.push(current.trim());
            current = '';
        } else {
            current += ch;
        }
    }
    if (current.trim()) args.push(current.trim());
    return args;
}

/**
 * Evaluate a simple arithmetic expression with cell references.
 * Supports: +, -, *, /, parentheses, function calls, cell refs.
 */
function evaluateExpression(expr, cells, visited) {
    expr = expr.trim();

    // Function call: FUNCNAME(...)
    const funcMatch = expr.match(/^([A-Z_]+)\((.+)\)$/is);
    if (funcMatch) {
        const funcName = funcMatch[1].toUpperCase();
        const innerStr = funcMatch[2];

        // Special IF handling
        if (funcName === 'IF') {
            const parts = splitArgs(innerStr);
            if (parts.length < 2) return '#VALUE!';
            const condition = evaluateExpression(parts[0], cells, visited);
            if (condition) {
                return parts[1] !== undefined ? evaluateExpression(parts[1], cells, visited) : 0;
            } else {
                return parts[2] !== undefined ? evaluateExpression(parts[2], cells, visited) : 0;
            }
        }

        const fn = FUNCTIONS[funcName];
        if (!fn) return `#NAME?`;

        const argParts = splitArgs(innerStr);
        const allValues = [];
        for (const part of argParts) {
            const vals = resolveValues(part.trim(), cells, visited);
            allValues.push(...vals);
        }
        return fn(allValues);
    }

    // Try to parse as simple arithmetic (with cell refs substituted)
    try {
        // Replace cell references with their numeric values
        // Match ranges first (A1:B5), then single refs (A1)
        let evalStr = expr;

        // Replace ranges — this handles things like SUM args that leaked through
        evalStr = evalStr.replace(/([A-Z]+\d+):([A-Z]+\d+)/gi, (match) => {
            const refs = expandRange(match);
            const sum = refs.reduce((s, r) => s + getCellNumericValue(r, cells, visited), 0);
            return String(sum);
        });

        // Replace single cell refs
        evalStr = evalStr.replace(/\b([A-Z]+\d+)\b/gi, (match) => {
            return String(getCellNumericValue(match, cells, visited));
        });

        // Security: only allow digits, operators, decimal points, spaces, parens
        if (!/^[\d\s+\-*/().,%<>=!&|e]+$/i.test(evalStr)) {
            return '#VALUE!';
        }

        // Handle comparison operators for IF conditions
        evalStr = evalStr.replace(/<>/g, '!==')
            .replace(/(?<!=)=(?!=)/g, '===')
            .replace(/>=/g, '>=')
            .replace(/<=/g, '<=');

        // eslint-disable-next-line no-eval
        const result = Function(`"use strict"; return (${evalStr})`)();
        if (typeof result === 'number' && !isFinite(result)) return '#DIV/0!';
        return result;
    } catch {
        return '#ERROR!';
    }
}

// ─── Main Entry Point ───────────────────────────────────────────

function evaluateFormulaInner(formula, cells, visited) {
    if (!formula || typeof formula !== 'string') return formula;
    if (!formula.startsWith('=')) return formula;

    // Circular reference detection
    const key = formula + '|' + JSON.stringify(Object.keys(visited || {}));
    if (visited && visited[formula]) return '#REF!';
    const newVisited = { ...visited, [formula]: true };

    const expr = formula.substring(1).trim(); // remove '='
    return evaluateExpression(expr, cells, newVisited);
}

/**
 * Evaluate a formula string against a cells map.
 * @param {string} formula - e.g. "=SUM(A1:A5)" or "=G2*F2"
 * @param {object} cells - { "A1": { value: 10 }, "B2": 20, ... }
 * @returns {*} The computed value, or an error string like "#REF!"
 */
export function evaluateFormula(formula, cells) {
    return evaluateFormulaInner(formula, cells || {}, {});
}

/**
 * Get the display value for a cell, evaluating formulas.
 * @param {*} cell - Cell data (string, number, or { value, formula, style })
 * @param {object} cells - All cells in the sheet
 * @returns {*} Computed display value
 */
export function getCellDisplayValue(cell, cells) {
    if (!cell) return '';

    if (typeof cell === 'object' && cell !== null) {
        // Has a formula? Evaluate it
        if (cell.formula && typeof cell.formula === 'string' && cell.formula.startsWith('=')) {
            return evaluateFormula(cell.formula, cells);
        }
        // Value is a formula string?
        if (typeof cell.value === 'string' && cell.value.startsWith('=')) {
            return evaluateFormula(cell.value, cells);
        }
        return cell.value ?? '';
    }

    // Bare string formula
    if (typeof cell === 'string' && cell.startsWith('=')) {
        return evaluateFormula(cell, cells);
    }

    return cell ?? '';
}

/**
 * Get the raw edit value for a cell (show formula text, not result).
 */
export function getCellEditValue(cell) {
    if (!cell) return '';
    if (typeof cell === 'object' && cell !== null) {
        return cell.formula || String(cell.value ?? '');
    }
    return String(cell);
}
