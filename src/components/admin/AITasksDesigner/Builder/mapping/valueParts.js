/**
 * The VISUAL value model behind ValueBuilder — a binding expressed as an
 * ordered list of parts a non-technical user can assemble by clicking:
 *
 *   [{ type: 'text', text: 'Order ' }, { type: 'data', path: 'item.id' }]
 *
 * Why a second model at all: the stored bindings are written for the runtime
 * (`{{steps.act_4d4307a.output.total}}`), and that string is unreadable — it
 * names a step by its internal id, and it makes the user type `{{ }}` and
 * `lower(...)` by hand to do anything beyond "copy this value". Parts are what
 * the editor renders (a chip with the step's NAME, a text box, a transform
 * chip); this module is the lossless bridge between the two.
 *
 * Round-trip contract: `buildValue(parseValue(b))` is equivalent to `b` for
 * every binding shape this module reports as supported. Anything else — a
 * hand-written expression, a template with a computed interpolation — comes
 * back `supported: false` and the editor keeps its hands off it (it renders
 * the humanised read-only form plus an "edit as formula" escape).
 *
 * Pure module: no React, no DOM. The paths and quoting rules mirror
 * utils/bindingHelpers (which owns the binding <-> input-text mapping) and
 * mapping/refTokens (which owns ref classification for chips).
 */
import { bindingFromInput } from '../../../../../utils/bindingHelpers';
import { humanizeFieldTail } from '../flow/displayHelpers';
import { classifyRef, resolveChipLabel } from './refTokens';

/** Roots a user can PICK. `secrets` is deliberately absent — never a chip. */
const DATA_ROOTS = new Set(['steps', 'trigger', 'vars', 'loop', 'item', '_index']);

// A clean dotted/bracketed path, the same shape isCleanPath accepts.
const PATH_RE = /^[A-Za-z_$][A-Za-z0-9_$]*(?:\.[A-Za-z0-9_$]+|\[[^\]]*\])*$/;

const TEMPLATE_TOKEN = /\{\{([^}]*)\}\}/g;

// `parseJson(<source path>)` / `parseJson(<source path>, "<path in the json>")`
// — the exact shape JsonExtractSection writes. NOTE: the expression language
// DOES decode backslash escapes inside string literals (engine.mjs tokenizer:
// \n → newline, \t → tab, \<any> → that char) — an earlier version of this
// comment claimed otherwise. This regex still accepts only escape-free
// arguments, which is fine: JsonExtractSection never writes escapes into a
// JSON path. join()'s separator DOES need them — see JOIN_CALL below.
const JSON_CALL = /^parseJson\(\s*([^,()]+?)\s*(?:,\s*(["'])([^"']*)\2\s*)?\)$/;

// `join(<path>, "<separator>")` — the one transform that carries an argument.
// The separator is an engine string literal, escapes and all (a newline
// separator is stored as `join(p, "\n")`).
const JOIN_CALL = /^join\(\s*([^,()]+?)\s*,\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')\s*\)$/;

/** Encode a separator as an engine double-quoted string literal's body. */
export function escapeExprString(s) {
    return String(s ?? '')
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\t/g, '\\t');
}

/** Mirror of the engine tokenizer's escape decoding (engine.mjs). */
function decodeExprString(s) {
    let out = '';
    const src = String(s ?? '');
    for (let i = 0; i < src.length; i++) {
        if (src[i] === '\\' && i + 1 < src.length) {
            const n = src[i + 1];
            out += n === 'n' ? '\n' : n === 't' ? '\t' : n;
            i++;
        } else {
            out += src[i];
        }
    }
    return out;
}

/**
 * The one-click value transforms. Each is a single-argument call in the shared
 * expression language (join carries a second, string argument), so a
 * transformed pick stays a plain `fn(path)` — round trippable, and readable in
 * the raw editor for whoever opens it later.
 *
 * `for` says what SHAPE the transform is about ('text' | 'list' | 'any') —
 * used for ORDERING AND ANNOTATION in the dropdown only, never to remove an
 * entry: sample data is often missing or wrong about shapes, and a transform
 * the user can see is a transform they can still reach.
 */
export const VALUE_TRANSFORMS = [
    { id: 'lower', label: 'lowercase', hint: 'Make the text lowercase', for: 'text' },
    { id: 'upper', label: 'UPPERCASE', hint: 'Make the text uppercase', for: 'text' },
    { id: 'trim', label: 'trim spaces', hint: 'Remove spaces around the text', for: 'text' },
    { id: 'number', label: 'as a number', hint: 'Read the value as a number', for: 'any' },
    { id: 'round', label: 'rounded', hint: 'Round to a whole number', for: 'any' },
    { id: 'toStr', label: 'as text', hint: 'Read the value as text', for: 'any' },
    { id: 'first', label: 'just the first one', hint: 'The first item of the list', for: 'list' },
    { id: 'last', label: 'just the last one', hint: 'The last item of the list', for: 'list' },
    { id: 'join', label: 'all of them, joined into text', hint: 'Every value in one piece of text, with a separator', for: 'list', arg: 'separator' },
    { id: 'count', label: 'count of items', hint: 'How many items the list has', for: 'list' },
];

const TRANSFORM_IDS = new Set(VALUE_TRANSFORMS.map(t => t.id));

/** Is this a data path the picker could have produced? */
export function isDataPath(s) {
    const text = String(s ?? '').trim();
    if (!text || !PATH_RE.test(text)) return false;
    return DATA_ROOTS.has(text.split(/[.[]/)[0]);
}

/**
 * Binding -> visual parts.
 *
 * Returns `{ supported: true, parts, transform }` or, for anything the visual
 * editor cannot represent faithfully, `{ supported: false, parts: [],
 * transform: null, text }` where `text` is the raw source for display.
 */
export function parseValue(binding) {
    const no = (text = '') => ({ supported: false, parts: [], transform: null, transformArg: null, text });
    const yes = (parts, transform = null, transformArg = null) => ({ supported: true, parts, transform, transformArg, text: '' });

    if (binding == null) return yes([]);
    if (typeof binding !== 'object') return yes(textParts(String(binding)));

    if (binding.kind === 'literal') {
        const v = binding.value;
        if (v == null || v === '') return yes([]);
        if (typeof v === 'object') return no(safeJson(v));
        return yes(textParts(String(v)));
    }
    if (binding.kind === 'ref') {
        const path = String(binding.path || '').trim();
        if (!path) return yes([]);
        return isDataPath(path) ? yes([{ type: 'data', path }]) : no(path);
    }
    if (binding.kind === 'template') return parseTemplate(String(binding.value || ''));
    if (binding.kind === 'expr') {
        const src = String(binding.value || '').trim();
        if (!src) return yes([]);
        if (isDataPath(src)) return yes([{ type: 'data', path: src }]);
        // A field placed by "Pick fields from it" — shown as a chip like any
        // other pick, because to the user that is exactly what it was.
        const json = JSON_CALL.exec(src);
        if (json && isDataPath(json[1])) {
            return yes([{ type: 'json', path: json[1].trim(), jsonPath: json[3] ?? '' }]);
        }
        // join(path, "sep") first — its second argument would trip the
        // single-argument matcher below.
        const join = JOIN_CALL.exec(src);
        if (join && isDataPath(join[1])) {
            return yes([{ type: 'data', path: join[1].trim() }], 'join', decodeExprString(join[2] ?? join[3] ?? ''));
        }
        const call = /^([A-Za-z_$][A-Za-z0-9_$]*)\(([^()]*)\)$/.exec(src);
        if (call && TRANSFORM_IDS.has(call[1]) && isDataPath(call[2])) {
            return yes([{ type: 'data', path: call[2].trim() }], call[1]);
        }
        return no(src);
    }
    return no(safeJson(binding));
}

function parseTemplate(source) {
    const parts = [];
    TEMPLATE_TOKEN.lastIndex = 0;
    let last = 0;
    let m;
    while ((m = TEMPLATE_TOKEN.exec(source))) {
        const inner = m[1].trim();
        // A `{{ }}` holding anything but a plain pickable path (a function
        // call, an operator) is somebody's hand-written template — leave it be
        // rather than round-tripping it into something subtly different.
        if (!isDataPath(inner)) return { supported: false, parts: [], transform: null, text: source };
        if (m.index > last) parts.push({ type: 'text', text: source.slice(last, m.index) });
        parts.push({ type: 'data', path: inner });
        last = m.index + m[0].length;
    }
    if (last < source.length) parts.push({ type: 'text', text: source.slice(last) });
    return { supported: true, parts, transform: null, text: '' };
}

function textParts(text) {
    return text === '' ? [] : [{ type: 'text', text }];
}

function safeJson(v) {
    try { return JSON.stringify(v); } catch { return ''; }
}

/**
 * Visual parts -> binding. The kind is chosen by SHAPE, exactly the way a
 * hand-written value would be classified:
 *
 *   nothing            -> empty literal        (the field stays, valued null)
 *   one text           -> literal
 *   one data           -> ref / expr           (bindingFromInput picks)
 *   one data + change  -> expr `fn(path)`
 *   mixed              -> template `a {{p}} b`
 *
 * A transform on a mixed value is dropped — the editor only offers it while
 * exactly one data part is present, so this only ever fires on stale state.
 *
 * `transformArg` is join's separator (default ', '); other transforms ignore
 * it.
 */
export function buildValue(parts, transform = null, transformArg = null) {
    const kept = (Array.isArray(parts) ? parts : []).filter(
        p => p && (p.type === 'text' ? p.text !== '' : !!p.path),
    );
    if (!kept.length) return { kind: 'literal', value: '' };

    // A JSON pick is a function call, and `{{ }}` interpolation can't hold one
    // — so it is always the whole value. The editor never offers to combine it
    // with anything (no add buttons on a JSON chip); this is the belt.
    const json = kept.find(p => p.type === 'json');
    if (json) {
        if (!json.jsonPath) return { kind: 'expr', value: `parseJson(${json.path})` };
        const quote = json.jsonPath.includes('"') ? "'" : '"';
        return { kind: 'expr', value: `parseJson(${json.path}, ${quote}${json.jsonPath}${quote})` };
    }

    if (kept.length === 1) {
        const only = kept[0];
        if (only.type === 'text') return { kind: 'literal', value: only.text };
        if (transform === 'join') {
            return { kind: 'expr', value: `join(${only.path}, "${escapeExprString(transformArg ?? ', ')}")` };
        }
        if (transform && TRANSFORM_IDS.has(transform)) {
            return { kind: 'expr', value: `${transform}(${only.path})` };
        }
        return bindingFromInput(only.path, 'expression');
    }

    const value = kept.map(p => (p.type === 'text' ? p.text : `{{${p.path}}}`)).join('');
    return { kind: 'template', value };
}

/**
 * How a picked path is NAMED on screen. Never returns an internal step id when
 * the step is known: `steps.act_4d4307a.output.total` reads as
 * "gmail search ▸ Total", `item.from_email` as "Current row ▸ From email".
 *
 * `stepLabelById` is the inspector's id -> label map (VariablePickerContext).
 */
export function describeDataPath(path, stepLabelById = null) {
    const raw = String(path || '').trim();
    if (!raw) return { name: '', suffix: '', missing: false, source: 'steps' };

    const ref = classifyRef(raw);
    if (ref) {
        const { name, suffix, missing } = resolveChipLabel({ ...ref }, stepLabelById);
        // `missing` means the id isn't in the label map — a deleted step, or a
        // surface that didn't pass one. Either way the id itself is never shown:
        // "Previous step ▸ Total" tells the user as much as `act_4d4307a` does,
        // and the exact path stays in the chip's title for whoever needs it.
        return { name: missing ? 'Previous step' : name, suffix: humanizeFieldTail(suffix), missing, source: ref.source };
    }
    const root = raw.split(/[.[]/)[0];
    if (root === 'item') {
        const tail = raw.slice(4).replace(/^\./, '');
        return { name: 'Current row', suffix: humanizeFieldTail(tail), missing: false, source: 'item' };
    }
    if (raw === '_index') {
        return { name: 'Row number', suffix: '', missing: false, source: 'item' };
    }
    if (root === 'vars') {
        return { name: 'Variable', suffix: humanizeFieldTail(raw.slice(5)), missing: false, source: 'vars' };
    }
    return { name: raw, suffix: '', missing: false, source: 'steps' };
}

/** Label for a transform id (for the chip). */
export function transformLabel(id) {
    return VALUE_TRANSFORMS.find(t => t.id === id)?.label || id;
}
