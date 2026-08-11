/**
 * App Studio runtime — binding resolution (v2).
 *
 * Binding shapes (owned by server/appStudio/componentSpecs.js, authoritative):
 *   { kind: 'static', value }
 *   { kind: 'actionResult', actionId, path }
 *   { kind: 'formula', expr }                         — restricted-JS expression
 *   { kind: 'record',  tableId, filter?, sort?, limit? } — one/first row
 *   { kind: 'records', tableId, filter?, sort?, limit? } — a list of rows
 *   { kind: 'dataset', datasetId, pick? }             — a named dataset
 *   { kind: 'connector', connectorId, params? }       — rows from an external
 *                                                       source (run acts-as-owner)
 *
 * PICK narrows a row-shaped result to ONE value: `pick: { row, column }` takes
 * the first (or last) row and reads one column out of it — what a stat tile
 * means by "the number", where the source itself resolves to a row array. It is
 * a READ-SIDE lens only: dataCacheKey ignores it, so two tiles picking different
 * columns of the same query still share one fetch. A binding without `pick`
 * resolves exactly as it always has.
 *
 * CONNECTOR PARAMS mirror dynamic filters: a `params` value may be a JSON
 * literal OR { kind:'formula', expr } resolved CLIENT-SIDE against the live
 * scope before the run (resolveBindingParams below). The server re-sanitises
 * the resolved literals; the cache key hashes them so a vars change refetches.
 *
 * DYNAMIC FILTERS: a record/records `filter` entry is { field, op, value }
 * where value is a JSON literal OR { kind:'formula', expr } resolved
 * CLIENT-SIDE against the live scope before the fetch (resolveBindingFilters
 * below). The request only ever carries literals — RLS stays the security
 * boundary. Both the fetch layer (AppDataScope) and the read path here key
 * the cache on the RESOLVED filter, so a vars/currentUser change refetches.
 *
 * The second argument is a BAG: `{ actionState, dataState, scope }`.
 *   actionState — { [actionId]: { status, result, error } } (useActionRunner.js)
 *   dataState   — { [cacheKey]: { status, result, error, tableId?, datasetId? } }
 *                 (DataContext.jsx — mirrors actionState's status vocabulary)
 *   scope       — the shared expression-scope root (buildScope) used by formulas
 *
 * Back-compat: v1 call sites pass a BARE actionState as the second argument
 * (`resolveBinding(binding, actionState)`). A second arg that is NOT a bag
 * (no own `actionState`/`dataState`/`scope` key) is treated as
 * `{ actionState: arg, dataState: {} }`, so old callers keep working verbatim.
 *
 * Everything here is defensive by contract: malformed bindings, missing
 * actions, dead paths and bad formulas resolve to `{ value: undefined }` —
 * they never throw, because a half-configured binding is a normal editor state.
 */

import { tryEvaluate } from '@shared/expr/engine.mjs';

/**
 * Safe path walk supporting dot AND bracket/index notation:
 *   'rows.0.title'  ·  'rows[0].title'  ·  'stats.open'  ·  'data["a-b"]'
 * Missing segments → undefined; never throws. Signature is (value, path) —
 * kept stable because AppList/AppKeyValue import and call it that way.
 */
export function walkPath(value, path) {
    if (path == null || path === '') return value;
    if (typeof path !== 'string') return undefined;
    let current = value;
    for (const segment of parsePathSegments(path)) {
        if (current == null || typeof current !== 'object') return undefined;
        current = Object.prototype.hasOwnProperty.call(current, segment) ? current[segment] : undefined;
    }
    return current;
}

/** 'rows[0].title' → ['rows','0','title']; tolerant of quotes and malformed tails. */
function parsePathSegments(path) {
    const out = [];
    let buf = '';
    const flush = () => { if (buf !== '') { out.push(buf); buf = ''; } };
    for (let i = 0; i < path.length; i++) {
        const c = path[i];
        if (c === '.') { flush(); continue; }
        if (c === '[') {
            flush();
            const close = path.indexOf(']', i);
            if (close < 0) { buf += path.slice(i); break; } // malformed — keep the rest literal
            let raw = path.slice(i + 1, close).trim();
            if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
                raw = raw.slice(1, -1);
            }
            if (raw !== '') out.push(raw);
            i = close;
            continue;
        }
        buf += c;
    }
    flush();
    return out;
}

/** Deterministic JSON with sorted keys — the hash half of a data cache key. */
function stableStringify(value) {
    if (value == null) return 'null';
    if (typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
}

/**
 * Stable cache key for a record/records/dataset binding — the SAME key the
 * DataContext fetch hook stores results under. record/records key on the
 * table + a hash of {filter,sort,limit}; dataset keys on its id.
 * Returns null for non-data bindings.
 */
export function dataCacheKey(binding) {
    if (!binding || typeof binding !== 'object') return null;
    if (binding.kind === 'dataset') {
        return `dataset:${binding.datasetId ?? ''}`;
    }
    if (binding.kind === 'record' || binding.kind === 'records') {
        const shape = stableStringify({
            filter: binding.filter ?? null,
            sort: binding.sort ?? null,
            limit: binding.limit ?? null,
        });
        return `${binding.kind}:${binding.tableId ?? ''}:${shape}`;
    }
    if (binding.kind === 'aggregate') {
        const shape = stableStringify({
            filter: binding.filter ?? null,
            groupBy: binding.groupBy ?? null,
            aggregates: binding.aggregates ?? null,
            sort: binding.sort ?? null,
            limit: binding.limit ?? null,
        });
        return `aggregate:${binding.tableId ?? ''}:${shape}`;
    }
    if (binding.kind === 'connector') {
        // Params are resolved to literals (resolveBindingParams) BEFORE this key
        // is computed, so a vars/currentUser change splits the cache correctly.
        return `connector:${binding.connectorId ?? ''}:${stableStringify(binding.params ?? null)}`;
    }
    return null;
}

/** Filter ops that carry no value — their entries pass through untouched. */
const NO_VALUE_FILTER_OPS = new Set(['isNull', 'isNotNull']);

/**
 * Resolve a record/records binding's dynamic filter values against the live
 * scope: entries whose value is { kind:'formula', expr } are evaluated with
 * the shared engine (e.g. `currentUser.id`, `vars.filters.q`); everything
 * else is left alone. Rules (contract shared with the server-side validator):
 *
 *   • isNull / isNotNull entries have no value → pass through untouched;
 *   • an entry whose (resolved) value is undefined or null is OMITTED from
 *     the outgoing filter — '' / 0 / false are legit values and stay;
 *   • a filter left empty by omission is dropped entirely, so its cache key
 *     equals the no-filter key.
 *
 * Fast path: a binding needing no change is returned AS-IS (identity-stable,
 * memo-friendly). Non-record kinds and non-array (legacy object) filters pass
 * through unchanged. Never throws — a bad formula resolves to undefined and
 * the entry is omitted, because a half-configured filter is a normal state.
 *
 * NOTE: formula filters should stick to the stable scope roots (currentUser,
 * vars, forms, screen, today). `now` differs by milliseconds between the
 * fetch layer's scope and the renderer's, which would split their cache keys.
 */
export function resolveBindingFilters(binding, scope) {
    if (!binding || typeof binding !== 'object') return binding;
    if (binding.kind !== 'record' && binding.kind !== 'records' && binding.kind !== 'aggregate') return binding;
    if (!Array.isArray(binding.filter) || binding.filter.length === 0) return binding;

    let changed = false;
    const filter = [];
    for (const entry of binding.filter) {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) { filter.push(entry); continue; }
        if (NO_VALUE_FILTER_OPS.has(entry.op)) { filter.push(entry); continue; }
        const { required, ...rest } = entry;
        const value = resolveFilterValue(entry.value, scope);
        if (value === undefined || value === null) {
            // An unresolved filter is normally OMITTED, which is right for an
            // optional one (a filter_bar field nobody filled in). It is exactly
            // wrong for a filter that SCOPES a component to a selection: drop
            // "belongs to the open ticket" and the component cheerfully lists
            // every row in the table. `required` says so out loud — no value,
            // no query, no rows.
            if (required) return null;
            changed = true;
            continue;
        }
        if (required) { changed = true; filter.push({ ...rest, value }); continue; }
        if (value === entry.value) { filter.push(entry); continue; }
        changed = true;
        filter.push({ ...rest, value });
    }
    if (!changed) return binding;
    if (filter.length === 0) {
        const { filter: _dropped, ...rest } = binding;
        return rest;
    }
    return { ...binding, filter };
}

/** One filter value: {kind:'formula'} → evaluated against the scope; literal → itself. */
function resolveFilterValue(value, scope) {
    if (!value || typeof value !== 'object' || value.kind !== 'formula') return value;
    const expr = value.expr;
    if (typeof expr !== 'string' || !expr.trim()) return undefined;
    return tryEvaluate(expr, scope || {}).value;
}

/**
 * Resolve a connector binding's dynamic `params` against the live scope: a
 * value that is { kind:'formula', expr } is evaluated (e.g. `vars.filters.q`,
 * `currentUser.id`); literals pass through. A param resolving to `undefined`
 * (unset formula / failed eval) is OMITTED — `null`/''/0/false are legit values
 * and stay. The same stable-scope-roots caveat as filters applies (avoid `now`).
 *
 * Fast path: an unchanged binding is returned AS-IS (memo-friendly). Non-
 * connector kinds and non-object params pass through. Never throws.
 */
export function resolveBindingParams(binding, scope) {
    if (!binding || typeof binding !== 'object' || binding.kind !== 'connector') return binding;
    const params = binding.params;
    if (!params || typeof params !== 'object' || Array.isArray(params)) return binding;

    let changed = false;
    const out = {};
    for (const [k, v] of Object.entries(params)) {
        const value = resolveFilterValue(v, scope);
        if (value === undefined) { changed = true; continue; } // omit unresolved
        if (value !== v) changed = true;
        out[k] = value;
    }
    if (!changed) return binding;
    return { ...binding, params: out };
}

const EMPTY = Object.freeze({ actionState: {}, dataState: {}, scope: undefined });

/** Normalize the second argument into a bag, honouring the v1 bare-actionState form. */
function normalizeBag(arg) {
    if (arg == null || typeof arg !== 'object') return EMPTY;
    if ('actionState' in arg || 'dataState' in arg || 'scope' in arg) {
        return {
            actionState: arg.actionState || {},
            dataState: arg.dataState || {},
            scope: arg.scope,
        };
    }
    // A bare actionState map (v1 call sites) — never carries a dataState/scope.
    return { actionState: arg, dataState: {}, scope: undefined };
}

/**
 * Turn a dataState entry into the standard resolve result. A key with NO entry
 * is "not started", not "loaded empty": the fetch layer registers every data
 * binding on the screen but only writes its first entry in an effect, so the
 * frame before that must render the skeleton — reporting isLoading:false there
 * flashes "No results" on every list, grid and board.
 */
function fromDataEntry(entry) {
    if (!entry) return { value: undefined, isLoading: true, error: null, errorCode: null };
    const status = entry.status;
    const isLoading = status === 'loading' || status === 'running';
    const value = status === 'success' ? entry.result : undefined;
    // errorCode is the TYPED failure (currently only 'connection_required'),
    // written by useAppDataSource. It rode in the cache entry and stopped here,
    // so nothing downstream could tell "reconnect Gmail" apart from "the
    // server broke" — and ErrorText's whole connection branch was unreachable.
    return { value, isLoading, error: entry.error ?? null, errorCode: entry.errorCode ?? null };
}

/**
 * Narrow a row-shaped result to the ONE value `pick` names. An out-of-range or
 * absent row/column resolves to undefined (the component then shows its own
 * empty state) — never throws, because a half-configured pick is a normal
 * editor state. No `pick` returns the value untouched.
 */
function applyPick(value, pick) {
    if (!pick || typeof pick !== 'object' || Array.isArray(pick)) return value;
    let row = value;
    if (Array.isArray(row)) {
        if (row.length === 0) return undefined;
        row = pick.row === 'last' ? row[row.length - 1] : row[0];
    }
    const column = pick.column;
    if (column == null || column === '') return row;
    if (row == null || typeof row !== 'object') return undefined;
    return Object.prototype.hasOwnProperty.call(row, column) ? row[column] : undefined;
}

/**
 * resolveBinding(binding, bagOrActionState) → { value, isLoading, error, errorCode }.
 *
 * isLoading is true while the underlying source (action / data query) is in
 * flight AND for a data binding whose cache key has no entry yet (its fetch has
 * not started — see fromDataEntry). Formula/static resolution is synchronous
 * (isLoading:false).
 *
 * `errorCode` is the TYPED failure and is null everywhere except a data query
 * that reported one ('connection_required'). Every branch spells it out rather
 * than leaving it off: a caller destructuring one result shape and not another
 * is how the connection message got lost the first time.
 */
export function resolveBinding(binding, arg) {
    if (binding == null || typeof binding !== 'object') {
        return { value: undefined, isLoading: false, error: null, errorCode: null };
    }
    const { actionState, dataState, scope } = normalizeBag(arg);

    switch (binding.kind) {
        case 'static':
            return { value: binding.value, isLoading: false, error: null, errorCode: null };

        case 'actionResult': {
            const entry = (actionState || {})[binding.actionId];
            const isLoading = entry?.status === 'running';
            const value = entry?.status === 'success' ? walkPath(entry.result, binding.path) : undefined;
            return { value, isLoading, error: entry?.status === 'error' ? (entry.error ?? null) : null, errorCode: null };
        }

        case 'formula': {
            const expr = binding.expr ?? binding.value;
            if (typeof expr !== 'string' || !expr.trim()) {
                return { value: undefined, isLoading: false, error: null, errorCode: null };
            }
            const { value, error } = tryEvaluate(expr, scope || {});
            return { value, isLoading: false, error, errorCode: null };
        }

        case 'record':
        case 'records':
        case 'aggregate':
        case 'dataset': {
            // Dynamic filters resolve against the scope BEFORE the key lookup,
            // so the read side lands on the same cache key the fetch layer
            // (AppDataScope → useAppDataSource) stored the entry under.
            const key = dataCacheKey(resolveBindingFilters(binding, scope));
            if (!key) return { value: undefined, isLoading: false, error: null, errorCode: null };
            const entry = fromDataEntry((dataState || {})[key]);
            if (!binding.pick) return entry;
            return { ...entry, value: applyPick(entry.value, binding.pick) };
        }

        case 'connector': {
            // Same read discipline as record/records/dataset, but params (not
            // filters) are the dynamic part — resolved to literals so the key
            // matches the one the fetch layer stored the run result under.
            const key = dataCacheKey(resolveBindingParams(binding, scope));
            if (!key) return { value: undefined, isLoading: false, error: null, errorCode: null };
            return fromDataEntry((dataState || {})[key]);
        }

        default:
            return { value: undefined, isLoading: false, error: null, errorCode: null };
    }
}

export default resolveBinding;
