/**
 * The client mirror of the variable vocabulary in
 * server/appStudio/componentSpecs.js.
 *
 * A mirror, not a fetch: the runtime seeds `vars` at mount, long before any
 * catalog request could land, and a default that arrives late is a default that
 * did not apply. appVariables.lockstep.test.js reads the server module directly
 * and asserts these agree, so drift fails CI instead of quietly changing what a
 * filter starts out matching.
 */

export const VARIABLE_TYPES = ['text', 'number', 'yesno', 'date', 'record', 'list', 'any'];

export const VARIABLE_TYPE_DEFAULTS = {
    text: '', number: 0, yesno: false, date: null, record: {}, list: [], any: null,
};

export const VARIABLE_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]{0,59}$/;

export const RESERVED_VARIABLE_NAMES = ['filters', 'true', 'false', 'null'];

export const MAX_VARIABLES = 30;
export const MAX_VARIABLE_DEFAULT_BYTES = 2048;
export const MAX_VARIABLE_NAME_LEN = 60;
export const MAX_VARIABLE_LABEL_LEN = 80;
export const MAX_VARIABLE_DESCRIPTION_LEN = 500;
const MAX_STRING = 5000;

const ISO_DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

function jsonBytes(value) {
    try {
        const text = JSON.stringify(value);
        return text === undefined ? 4 : new TextEncoder().encode(text).length;
    } catch { return Infinity; }
}

/** Bring a declared default in line with its type. Mirrors coerceVariableDefault. */
export function coerceVariableDefault(type, value) {
    const fallback = Object.prototype.hasOwnProperty.call(VARIABLE_TYPE_DEFAULTS, type)
        ? VARIABLE_TYPE_DEFAULTS[type] : null;
    const miss = () => ({ value: fallback, coerced: true });

    switch (type) {
        case 'text': {
            if (typeof value === 'string') {
                return value.length > MAX_STRING
                    ? { value: value.slice(0, MAX_STRING), coerced: true }
                    : { value, coerced: false };
            }
            if (typeof value === 'number' && Number.isFinite(value)) return { value: String(value), coerced: true };
            if (typeof value === 'boolean') return { value: String(value), coerced: true };
            return miss();
        }
        case 'number': {
            if (typeof value === 'number' && Number.isFinite(value)) return { value, coerced: false };
            if (typeof value === 'string' && value.trim() !== '') {
                const n = Number(value);
                if (Number.isFinite(n)) return { value: n, coerced: true };
            }
            if (typeof value === 'boolean') return { value: value ? 1 : 0, coerced: true };
            return miss();
        }
        case 'yesno': {
            if (typeof value === 'boolean') return { value, coerced: false };
            if (value === 'true' || value === 1) return { value: true, coerced: true };
            if (value === 'false' || value === 0) return { value: false, coerced: true };
            return miss();
        }
        case 'date': {
            if (value === null) return { value: null, coerced: false };
            if (typeof value === 'string') {
                if (ISO_DATE_ONLY_RE.test(value)) return { value, coerced: false };
                if (ISO_DATE_ONLY_RE.test(value.slice(0, 10))) return { value: value.slice(0, 10), coerced: true };
            }
            return miss();
        }
        case 'record': {
            const ok = value && typeof value === 'object' && !Array.isArray(value);
            if (!ok) return miss();
            return jsonBytes(value) > MAX_VARIABLE_DEFAULT_BYTES ? miss() : { value, coerced: false };
        }
        case 'list': {
            if (!Array.isArray(value)) return miss();
            return jsonBytes(value) > MAX_VARIABLE_DEFAULT_BYTES ? miss() : { value, coerced: false };
        }
        case 'any':
        default: {
            if (value === undefined) return { value: null, coerced: true };
            return jsonBytes(value) > MAX_VARIABLE_DEFAULT_BYTES ? miss() : { value, coerced: false };
        }
    }
}

/** The `vars` a run starts from: { [name]: coerced default }. */
export function seedVariableDefaults(variables) {
    const out = {};
    for (const v of Array.isArray(variables) ? variables : []) {
        if (!v || typeof v !== 'object') continue;
        if (typeof v.name !== 'string' || !VARIABLE_NAME_RE.test(v.name)) continue;
        if (RESERVED_VARIABLE_NAMES.includes(v.name)) continue;
        const type = VARIABLE_TYPES.includes(v.type) ? v.type : 'any';
        out[v.name] = coerceVariableDefault(type, v.default).value;
    }
    return out;
}

/** Declared names, in declaration order. */
export function listVariableNames(variables) {
    return (Array.isArray(variables) ? variables : [])
        .map((v) => (v && typeof v.name === 'string' ? v.name : null))
        .filter(Boolean);
}

function sameValue(a, b) {
    if (a === b) return true;
    if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
    try { return JSON.stringify(a) === JSON.stringify(b); } catch { return false; }
}

/**
 * Fold a change in the DECLARATIONS into the live `vars` bag — merging, never
 * resetting.
 *
 * The editor re-renders this on every inspector keystroke, so a reset would
 * wipe a filter the author is looking at while they type. The rules:
 *
 *   added        → seed it with its default.
 *   default changed → adopt the new one ONLY if the live value is still the old
 *                  default, i.e. nothing has written it yet. A value an action
 *                  or a filter bar produced is real state and outranks an
 *                  editor-side edit to the declaration.
 *   removed      → drop it only if it still holds its old default. Undeclared
 *                  names stay perfectly legal (set_variable can write anything),
 *                  so discarding a live value would be a behaviour change rather
 *                  than a cleanup.
 *
 * Returns `prev` BY REFERENCE when nothing changed, so setVars bails out of the
 * re-render instead of scheduling one per keystroke.
 */
export function reconcileVariableDefaults(prev, prevDecls, nextDecls) {
    const before = seedVariableDefaults(prevDecls);
    const after = seedVariableDefaults(nextDecls);
    const current = prev && typeof prev === 'object' ? prev : {};

    let changed = false;
    const out = { ...current };

    for (const [name, value] of Object.entries(after)) {
        if (!(name in current)) { out[name] = value; changed = true; continue; }
        const wasUntouched = name in before && sameValue(current[name], before[name]);
        if (wasUntouched && !sameValue(current[name], value)) { out[name] = value; changed = true; }
    }

    for (const name of Object.keys(before)) {
        if (name in after) continue;
        if (!(name in current)) continue;
        if (!sameValue(current[name], before[name])) continue;   // written since — keep it
        delete out[name];
        changed = true;
    }

    return changed ? out : prev;
}
