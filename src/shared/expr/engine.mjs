/**
 * Restricted expression evaluator — SHARED between the automation runtime
 * (server) and App Studio (client + server live preview / validation).
 *
 * Ported verbatim from server/automation/expr.js (which now re-exports this)
 * plus: an extended function whitelist (functions.mjs), `compile()` returning
 * the referenced root identifiers for validation-without-execution, and
 * `tryEvaluate()` that never throws (runtime formulas degrade to undefined).
 *
 * We deliberately do NOT use eval/new Function — a tiny recursive-descent
 * parser makes the surface auditable and impossible to smuggle calls/lookups
 * through. The ONLY callable forms are the closed whitelist in FUNCTIONS; any
 * other `ident(` throws at PARSE time. Member access (dot + computed bracket)
 * is prototype-safe (hasOwnProperty gate), so `x["constructor"]` resolves to
 * undefined rather than walking to Function.
 *
 * Grammar:
 *   expr     := ternary
 *   ternary  := logical_or ('?' ternary ':' ternary)?
 *   logical_or := logical_and ('||' logical_and)*
 *   logical_and := equality ('&&' equality)*
 *   equality := compare (('=='|'!='|'==='|'!==') compare)*
 *   compare  := additive (('<'|'<='|'>'|'>=') additive)*
 *   additive := multiplicative (('+'|'-') multiplicative)*
 *   multiplicative := unary (('*'|'/'|'%') unary)*
 *   unary    := ('!'|'-'|'+')? primary
 *   primary  := number | string | bool | null | call | identifier_path | '(' expr ')'
 *   call     := WHITELISTED_FN '(' (expr (',' expr)*)? ')'
 *   identifier_path := ident ('.' ident | '[' expr ']')*
 */

import { FUNCTIONS, EXPR_FUNCTIONS, EXPR_FUNCTION_NAMES } from './functions.mjs';

export class ExprError extends Error {
    constructor(message, index) { super(message); this.name = 'ExprError'; this.index = index; }
}

// ── Tokenizer ──────────────────────────────────────────
const TOKEN = {
    NUMBER: 'NUM', STRING: 'STR', IDENT: 'ID', BOOL: 'BOOL', NULL: 'NULL',
    LPAREN: '(', RPAREN: ')', LBRACK: '[', RBRACK: ']',
    DOT: '.', COMMA: ',', QMARK: '?', COLON: ':',
    OR: '||', AND: '&&', EQ: '==', NEQ: '!=', SEQ: '===', SNEQ: '!==',
    LT: '<', LTE: '<=', GT: '>', GTE: '>=',
    PLUS: '+', MINUS: '-', STAR: '*', SLASH: '/', PERCENT: '%',
    BANG: '!', EOF: 'EOF',
};

function tokenize(src) {
    if (typeof src !== 'string') throw new ExprError('Expression must be a string', 0);
    const tokens = [];
    let i = 0;
    while (i < src.length) {
        const c = src[i];
        if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { i++; continue; }
        if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] || ''))) {
            let j = i;
            while (j < src.length && /[0-9.]/.test(src[j])) j++;
            tokens.push({ t: TOKEN.NUMBER, v: parseFloat(src.slice(i, j)), i });
            i = j; continue;
        }
        if (c === '"' || c === "'") {
            const q = c; let j = i + 1; let out = '';
            while (j < src.length && src[j] !== q) {
                if (src[j] === '\\' && j + 1 < src.length) {
                    const n = src[j + 1];
                    out += (n === 'n' ? '\n' : n === 't' ? '\t' : n);
                    j += 2;
                } else { out += src[j]; j++; }
            }
            if (j >= src.length) throw new ExprError('Unterminated string in expression', i);
            tokens.push({ t: TOKEN.STRING, v: out, i });
            i = j + 1; continue;
        }
        if (/[A-Za-z_$]/.test(c)) {
            let j = i;
            while (j < src.length && /[A-Za-z0-9_$]/.test(src[j])) j++;
            const word = src.slice(i, j);
            if (word === 'true' || word === 'false') tokens.push({ t: TOKEN.BOOL, v: word === 'true', i });
            else if (word === 'null') tokens.push({ t: TOKEN.NULL, i });
            else tokens.push({ t: TOKEN.IDENT, v: word, i });
            i = j; continue;
        }
        const two = src.slice(i, i + 2);
        const three = src.slice(i, i + 3);
        if (three === '===') { tokens.push({ t: TOKEN.SEQ, i }); i += 3; continue; }
        if (three === '!==') { tokens.push({ t: TOKEN.SNEQ, i }); i += 3; continue; }
        if (two === '||') { tokens.push({ t: TOKEN.OR, i }); i += 2; continue; }
        if (two === '&&') { tokens.push({ t: TOKEN.AND, i }); i += 2; continue; }
        if (two === '==') { tokens.push({ t: TOKEN.EQ, i }); i += 2; continue; }
        if (two === '!=') { tokens.push({ t: TOKEN.NEQ, i }); i += 2; continue; }
        if (two === '<=') { tokens.push({ t: TOKEN.LTE, i }); i += 2; continue; }
        if (two === '>=') { tokens.push({ t: TOKEN.GTE, i }); i += 2; continue; }
        const single = {
            '(': TOKEN.LPAREN, ')': TOKEN.RPAREN, '[': TOKEN.LBRACK, ']': TOKEN.RBRACK,
            '.': TOKEN.DOT, ',': TOKEN.COMMA, '?': TOKEN.QMARK, ':': TOKEN.COLON,
            '<': TOKEN.LT, '>': TOKEN.GT, '+': TOKEN.PLUS, '-': TOKEN.MINUS,
            '*': TOKEN.STAR, '/': TOKEN.SLASH, '%': TOKEN.PERCENT, '!': TOKEN.BANG,
        };
        if (single[c]) { tokens.push({ t: single[c], i }); i++; continue; }
        throw new ExprError(`Unexpected character in expression: ${c}`, i);
    }
    tokens.push({ t: TOKEN.EOF, i: src.length });
    return tokens;
}

// ── Parser (recursive descent) ─────────────────────────
function parse(tokens) {
    let pos = 0;
    const peek = () => tokens[pos];
    const eat = (t) => {
        if (tokens[pos].t !== t) throw new ExprError(`Expected ${t} but got ${tokens[pos].t}`, tokens[pos].i);
        return tokens[pos++];
    };
    const accept = (t) => (tokens[pos].t === t ? tokens[pos++] : null);

    function ternary() {
        const cond = logicalOr();
        if (accept(TOKEN.QMARK)) {
            const a = ternary();
            eat(TOKEN.COLON);
            const b = ternary();
            return { kind: 'ternary', cond, a, b };
        }
        return cond;
    }
    function logicalOr() {
        let n = logicalAnd();
        while (accept(TOKEN.OR)) n = { kind: 'binop', op: '||', a: n, b: logicalAnd() };
        return n;
    }
    function logicalAnd() {
        let n = equality();
        while (accept(TOKEN.AND)) n = { kind: 'binop', op: '&&', a: n, b: equality() };
        return n;
    }
    function equality() {
        let n = compare();
        while (true) {
            if (accept(TOKEN.SEQ)) n = { kind: 'binop', op: '===', a: n, b: compare() };
            else if (accept(TOKEN.SNEQ)) n = { kind: 'binop', op: '!==', a: n, b: compare() };
            else if (accept(TOKEN.EQ)) n = { kind: 'binop', op: '==', a: n, b: compare() };
            else if (accept(TOKEN.NEQ)) n = { kind: 'binop', op: '!=', a: n, b: compare() };
            else break;
        }
        return n;
    }
    function compare() {
        let n = additive();
        while (true) {
            if (accept(TOKEN.LTE)) n = { kind: 'binop', op: '<=', a: n, b: additive() };
            else if (accept(TOKEN.GTE)) n = { kind: 'binop', op: '>=', a: n, b: additive() };
            else if (accept(TOKEN.LT)) n = { kind: 'binop', op: '<', a: n, b: additive() };
            else if (accept(TOKEN.GT)) n = { kind: 'binop', op: '>', a: n, b: additive() };
            else break;
        }
        return n;
    }
    function additive() {
        let n = multiplicative();
        while (true) {
            if (accept(TOKEN.PLUS)) n = { kind: 'binop', op: '+', a: n, b: multiplicative() };
            else if (accept(TOKEN.MINUS)) n = { kind: 'binop', op: '-', a: n, b: multiplicative() };
            else break;
        }
        return n;
    }
    function multiplicative() {
        let n = unary();
        while (true) {
            if (accept(TOKEN.STAR)) n = { kind: 'binop', op: '*', a: n, b: unary() };
            else if (accept(TOKEN.SLASH)) n = { kind: 'binop', op: '/', a: n, b: unary() };
            else if (accept(TOKEN.PERCENT)) n = { kind: 'binop', op: '%', a: n, b: unary() };
            else break;
        }
        return n;
    }
    function unary() {
        if (accept(TOKEN.BANG)) return { kind: 'unop', op: '!', a: unary() };
        if (accept(TOKEN.MINUS)) return { kind: 'unop', op: '-', a: unary() };
        if (accept(TOKEN.PLUS)) return { kind: 'unop', op: '+', a: unary() };
        return primary();
    }
    function primary() {
        const tk = peek();
        if (tk.t === TOKEN.NUMBER) { pos++; return { kind: 'num', v: tk.v }; }
        if (tk.t === TOKEN.STRING) { pos++; return { kind: 'str', v: tk.v }; }
        if (tk.t === TOKEN.BOOL) { pos++; return { kind: 'bool', v: tk.v }; }
        if (tk.t === TOKEN.NULL) { pos++; return { kind: 'null' }; }
        if (tk.t === TOKEN.LPAREN) { pos++; const e = ternary(); eat(TOKEN.RPAREN); return e; }
        if (tk.t === TOKEN.IDENT) {
            pos++;
            if (peek().t === TOKEN.LPAREN) {
                if (!Object.prototype.hasOwnProperty.call(FUNCTIONS, tk.v)) {
                    throw new ExprError(`Unknown function: ${tk.v}`, tk.i);
                }
                eat(TOKEN.LPAREN);
                const args = [];
                if (peek().t !== TOKEN.RPAREN) {
                    args.push(ternary());
                    while (accept(TOKEN.COMMA)) args.push(ternary());
                }
                eat(TOKEN.RPAREN);
                return { kind: 'call', name: tk.v, args };
            }
            const path = [{ kind: 'name', v: tk.v }];
            while (true) {
                if (accept(TOKEN.DOT)) {
                    const id = eat(TOKEN.IDENT);
                    path.push({ kind: 'name', v: id.v });
                } else if (accept(TOKEN.LBRACK)) {
                    // `[*]` wildcard — same flatten-map semantics as the
                    // binding resolver's walkPath, so a picker-inserted path
                    // like `steps.x.output.results[*].subject` evaluates to
                    // the array of subjects instead of throwing
                    // "Unexpected token: *" (which conditions swallowed into a
                    // silent `false` → wrong branch).
                    if (peek().t === TOKEN.STAR) {
                        eat(TOKEN.STAR);
                        eat(TOKEN.RBRACK);
                        path.push({ kind: 'wildcard' });
                    } else {
                        const idx = ternary();
                        eat(TOKEN.RBRACK);
                        path.push({ kind: 'index', expr: idx });
                    }
                } else break;
            }
            return { kind: 'path', segments: path };
        }
        throw new ExprError(`Unexpected token: ${tk.t}`, tk.i);
    }

    const ast = ternary();
    if (peek().t !== TOKEN.EOF) throw new ExprError('Trailing tokens in expression', peek().i);
    return ast;
}

// ── Evaluator ──────────────────────────────────────────
function walkPath(segments, runState) {
    let cur = runState;
    for (let i = 0; i < segments.length; i++) {
        if (cur == null) return undefined;
        const s = segments[i];
        if (s.kind === 'name') {
            // The own-property gate is the WHOLE gate — no `typeof cur ===
            // 'object'` term. hasOwnProperty.call auto-boxes primitives, so a
            // string's own members (`.length`, `[0]`) resolve while its
            // prototype members (`.toUpperCase`, `.constructor`) still come
            // back undefined. The extra object check made `…body.length > 5`
            // permanently false inside a condition while the identical path in
            // a ref binding or a {{…}} template resolved to 11 — the binding
            // resolver (server/automation/bind.js resolveTokens) has never had
            // that term, and both files document the permissive read as intent.
            cur = Object.prototype.hasOwnProperty.call(cur, s.v) ? cur[s.v] : undefined;
        } else if (s.kind === 'wildcard') {
            // `[*]`: map the REMAINDER of the path over the array's elements
            // and flatten one level, skipping misses — mirrors the binding
            // resolver's walkPath semantics so the same path string means the
            // same thing in a binding and in an expression.
            if (!Array.isArray(cur)) return undefined;
            const rest = segments.slice(i + 1);
            const out = [];
            for (const el of cur) {
                if (el == null) continue;
                const v = rest.length ? walkPath([{ kind: 'root', v: el }, ...rest], runState) : el;
                if (v === undefined) continue;
                if (Array.isArray(v)) out.push(...v);
                else out.push(v);
            }
            return out;
        } else if (s.kind === 'root') {
            // Internal marker used by the wildcard recursion: seed the walk
            // at a concrete element value instead of the runState root.
            cur = s.v;
        } else {
            const k = evalNode(s.expr, runState);
            if (cur == null) return undefined;
            // Prototype-chain gate on bracket access too — x["constructor"]
            // must resolve to undefined, never walk to Function. Own-property
            // only, no `typeof cur === 'object'` term, for the same reason as
            // the dot branch above: `name[0]` on a string has to work here
            // exactly as it does in a ref binding.
            cur = Object.prototype.hasOwnProperty.call(cur, k) ? cur[k] : undefined;
        }
    }
    return cur;
}

function evalNode(n, ctx) {
    switch (n.kind) {
        case 'num': return n.v;
        case 'str': return n.v;
        case 'bool': return n.v;
        case 'null': return null;
        case 'path': return walkPath(n.segments, ctx);
        case 'call': {
            const fn = FUNCTIONS[n.name];
            if (!fn) throw new ExprError(`Unknown function: ${n.name}`);
            return fn(...n.args.map((a) => evalNode(a, ctx)));
        }
        case 'unop': {
            const v = evalNode(n.a, ctx);
            if (n.op === '!') return !v;
            if (n.op === '-') return -v;
            if (n.op === '+') return +v;
            return undefined;
        }
        case 'binop': {
            if (n.op === '&&') return evalNode(n.a, ctx) && evalNode(n.b, ctx);
            if (n.op === '||') return evalNode(n.a, ctx) || evalNode(n.b, ctx);
            const a = evalNode(n.a, ctx);
            const b = evalNode(n.b, ctx);
            switch (n.op) {
                case '+': return a + b;
                case '-': return a - b;
                case '*': return a * b;
                case '/': return a / b;
                case '%': return a % b;
                case '==': return a == b;   // eslint-disable-line eqeqeq
                case '!=': return a != b;   // eslint-disable-line eqeqeq
                case '===': return a === b;
                case '!==': return a !== b;
                case '<': return a < b;
                case '<=': return a <= b;
                case '>': return a > b;
                case '>=': return a >= b;
                default: throw new ExprError(`Unknown operator: ${n.op}`);
            }
        }
        case 'ternary': return evalNode(n.cond, ctx) ? evalNode(n.a, ctx) : evalNode(n.b, ctx);
        default: throw new ExprError(`Unknown node kind: ${n.kind}`);
    }
}

// Distinct root identifiers referenced by a path (for validation without
// executing) — e.g. `actions.x.result + form.total` → ['actions','form'].
function collectRefs(node, out) {
    if (!node || typeof node !== 'object') return out;
    if (node.kind === 'path' && node.segments[0]?.kind === 'name') out.add(node.segments[0].v);
    for (const key of ['a', 'b', 'cond', 'expr']) if (node[key]) collectRefs(node[key], out);
    if (node.segments) for (const s of node.segments) if (s.expr) collectRefs(s.expr, out);
    if (node.args) for (const a of node.args) collectRefs(a, out);
    return out;
}

// ── Public API ─────────────────────────────────────────

/** Parse an expression string → AST. Throws ExprError on bad grammar. */
export function parseExpr(src) {
    return parse(tokenize(src));
}

/** Parse + collect referenced roots WITHOUT executing. Throws on bad grammar. */
export function compile(src) {
    const ast = parseExpr(src);
    return { ast, refs: [...collectRefs(ast, new Set())] };
}

/**
 * Compile (if given a string) and evaluate against a scope root object.
 * Throws ExprError on bad grammar — automation callers rely on this to record
 * evaluation errors, so behavior is byte-identical to the original expr.js.
 */
export function evaluate(src, scope) {
    const ast = typeof src === 'string' ? parseExpr(src) : src;
    return evalNode(ast, scope || {});
}

/**
 * Safe evaluate for App Studio runtime formulas — NEVER throws. A parse or
 * eval failure returns `{ value: undefined, error }` so a bad formula degrades
 * to an empty value + an inspector badge rather than blanking a screen.
 */
export function tryEvaluate(src, scope) {
    try {
        return { value: evaluate(src, scope), error: null };
    } catch (e) {
        return { value: undefined, error: e instanceof Error ? e.message : String(e) };
    }
}

export { FUNCTIONS, EXPR_FUNCTIONS, EXPR_FUNCTION_NAMES };
