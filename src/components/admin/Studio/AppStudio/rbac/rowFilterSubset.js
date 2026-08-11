import { parseExpr } from '@shared/expr/engine.mjs';

/**
 * App Studio RBAC — client mirror of the server's row-filter subset validator.
 *
 * A row filter (access.rowFilters[role]) is the ONLY free-form expression a
 * data model carries, so the RLS gateway (server/appStudio/rlsGateway.js) only
 * accepts a small, safe subset before it becomes parameterised SQL:
 *
 *   comparisons  == === != !== < <= > >=
 *   logic        && ||
 *   unary        !
 *   operands     record.<field> · viewer.<attr> · string/number/bool literal
 *
 * Everything else — function calls, arithmetic (+ - * / %), ternaries, null,
 * bracket/computed access, unknown roots — is rejected. This validator walks the
 * SAME shared-expr AST the gateway parses (byte-identical engine) so the editor
 * can flag an out-of-subset rule BEFORE the owner saves and eats a 422. It is a
 * pre-flight aid, not the enforcement point.
 */

// Mirrors dataModel.SYSTEM_COLUMNS — always addressable as record.<col>.
const SYSTEM_COLUMNS = ['id', 'created_at', 'updated_at', 'created_by', 'org_id'];
const CMP = new Set(['==', '===', '!=', '!==', '<', '<=', '>', '>=']);
const LOGIC = new Set(['&&', '||']);

function fieldKeySet(table) {
    const set = new Set(SYSTEM_COLUMNS);
    const fields = Array.isArray(table?.fields) ? table.fields : [];
    for (const f of fields) {
        if (!f || typeof f.key !== 'string') continue;
        // Read-time computed fields have no physical column — the gateway rejects them.
        if (f.type === 'computed' && !(f.computed && f.computed.stored === true)) continue;
        set.add(f.key);
    }
    return set;
}

function checkPath(node, fieldKeys) {
    const segs = node.segments;
    if (!Array.isArray(segs) || segs.length !== 2) {
        throw new Error('Write record.<column> for the row, or viewer.id / viewer.role / viewer.organizationId for the person opening the app.');
    }
    const [root, leaf] = segs;
    if (root.kind !== 'name' || leaf.kind !== 'name') {
        throw new Error('A row rule can only use plain names like record.status — no [brackets].');
    }
    if (root.v === 'record') {
        if (!fieldKeys.has(leaf.v)) throw new Error(`This table has no column called "${leaf.v}".`);
        return;
    }
    if (root.v === 'viewer') return; // viewer.<attr> — bound at query time
    throw new Error(`There is nothing called "${root.v}" here — a row rule can only use record.<column> and viewer.<attribute>.`);
}

function checkOperand(node, fieldKeys) {
    if (!node || typeof node !== 'object') throw new Error('Something is missing on one side of a comparison.');
    switch (node.kind) {
        case 'num':
        case 'str':
        case 'bool':
            return;
        case 'path':
            return checkPath(node, fieldKeys);
        default:
            throw new Error(`A ${describeKind(node.kind)} is not allowed as a value here.`);
    }
}

function checkNode(node, fieldKeys) {
    if (!node || typeof node !== 'object') throw new Error('This rule is empty.');
    switch (node.kind) {
        case 'binop':
            if (LOGIC.has(node.op)) {
                checkNode(node.a, fieldKeys);
                checkNode(node.b, fieldKeys);
                return;
            }
            if (CMP.has(node.op)) {
                checkOperand(node.a, fieldKeys);
                checkOperand(node.b, fieldKeys);
                return;
            }
            throw new Error(`Operator "${node.op}" is not allowed in a row rule.`);
        case 'unop':
            if (node.op === '!') { checkNode(node.a, fieldKeys); return; }
            throw new Error(`Unary "${node.op}" is not allowed in a row rule.`);
        case 'path':
        case 'num':
        case 'str':
        case 'bool':
            return checkOperand(node, fieldKeys);
        default:
            throw new Error(`A ${describeKind(node.kind)} is not allowed in a row rule.`);
    }
}

function describeKind(kind) {
    switch (kind) {
        case 'call': return 'function call';
        case 'ternary': return 'conditional (a ? b : c)';
        case 'index': return 'bracket access';
        case 'null': return 'null literal';
        default: return `${kind} expression`;
    }
}

/**
 * Validate a row-filter expression string against the supported subset.
 * @param {string} expr the raw expression (empty = "no rule", always valid)
 * @param {object} [table] the data-model table (for record.<field> resolution)
 * @returns {{ ok: boolean, error: string|null }}
 */
export function validateRowFilterExpr(expr, table) {
    const src = String(expr ?? '').trim();
    if (!src) return { ok: true, error: null };
    let ast;
    try {
        ast = parseExpr(src);
    } catch (e) {
        return { ok: false, error: `This rule could not be read — ${e?.message || 'check the spelling and the brackets.'}` };
    }
    try {
        checkNode(ast, fieldKeySet(table));
        return { ok: true, error: null };
    } catch (e) {
        return { ok: false, error: e.message };
    }
}

export default validateRowFilterExpr;
