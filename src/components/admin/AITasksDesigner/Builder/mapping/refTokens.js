/**
 * Tokenize a bound-field value into literal text and step/trigger/loop
 * REFERENCE tokens, so the inspector can render references as chips that
 * show the human step NAME instead of the raw id (`steps.ai_87e358…`).
 *
 * This is DISPLAY-ONLY. The stored value is never changed — the runtime
 * resolver (server/automation/bind.js) needs the id-based path. Chips are
 * rendered over a read-only view of the field; editing happens on the raw
 * text. `serializeRefTokens(parseRefTokens(x)) === x` for any input.
 *
 * Three ref sources are recognised, matching the runtime paths:
 *   steps.<id>.output[.<field>]   → keyed by step id (resolvable to a label)
 *   trigger[.output][.<field>]    → the automation trigger
 *   loop.<itemVar>[.<field>]      → the current forEach/loop item
 *
 * The path regexes mirror the canonical ones in server/automation/portability.js
 * (PATH_HEAD_DOT_RE / EXPR_STEPS_DOT_RE) and the canvas humanizer in
 * flow/displayHelpers.js, with an added `loop.` branch the canvas lacks.
 */
import { TEMPLATE_RE } from '../../../../../utils/bindingHelpers';

// Identifier (step id / itemVar) and a dotted/bracketed field path tail.
const IDENT = '[A-Za-z_$][A-Za-z0-9_$]*';
// Field path: first segment then any number of `.seg` or `[idx]` / `[*]` parts.
const FIELD = '[A-Za-z0-9_$]+(?:\\.[A-Za-z0-9_$]+|\\[[^\\]]*\\])*';

// Scans an EXPRESSION/ref string for the three ref kinds. The negative
// lookbehind rejects lookalikes (`mysteps.x`, `vars.trigger`, `x.loop.y`)
// without consuming a prefix char, so the gaps between matches are exactly
// the literal spans — which is what keeps the round-trip byte-faithful.
const SCAN_RE = new RegExp(
    `(?<![A-Za-z0-9_$.])steps\\.(${IDENT})\\.output(?:\\.(${FIELD}))?` +
    `|(?<![A-Za-z0-9_$.])trigger(?:\\.output)?(?:\\.(${FIELD}))?` +
    `|(?<![A-Za-z0-9_$.])loop\\.(${IDENT})(?:\\.(${FIELD}))?`,
    'g',
);

// Anchored variants used to classify the inside of a `{{ … }}` interpolation.
const STEPS_ANCHOR = new RegExp(`^steps\\.(${IDENT})\\.output(?:\\.(${FIELD}))?$`);
const TRIGGER_ANCHOR = new RegExp(`^trigger(?:\\.output)?(?:\\.(${FIELD}))?$`);
const LOOP_ANCHOR = new RegExp(`^loop\\.(${IDENT})(?:\\.(${FIELD}))?$`);

/**
 * Classify a bare path string (no `{{}}`, already trimmed) as a ref.
 * Returns `{ source, stepId?, itemVar?, fieldPath }` or null.
 */
export function classifyRef(path) {
    if (typeof path !== 'string') return null;
    const text = path.trim();
    let m;
    if ((m = STEPS_ANCHOR.exec(text))) {
        return { source: 'steps', stepId: m[1], fieldPath: m[2] || '' };
    }
    if ((m = LOOP_ANCHOR.exec(text))) {
        return { source: 'loop', itemVar: m[1], fieldPath: m[2] || '' };
    }
    if ((m = TRIGGER_ANCHOR.exec(text))) {
        return { source: 'trigger', fieldPath: m[1] || '' };
    }
    return null;
}

/**
 * Parse a field value into an ordered token list.
 *
 * Token shapes:
 *   { type: 'literal', text }
 *   { type: 'ref', raw, path, source, stepId?, itemVar?, fieldPath, wrapped }
 *
 * `raw` is the exact original substring (including `{{ }}` and any internal
 * spacing when `wrapped`), so serialize round-trips verbatim. `path` is the
 * inner dotted path without braces.
 *
 * Mode semantics mirror bindingHelpers:
 *   - a value containing `{{…}}` is a template — only the `{{…}}` insides are
 *     refs; everything else (even ref-looking text) is literal.
 *   - 'fixed' mode without `{{…}}` is a plain literal — no refs.
 *   - 'expression' mode without `{{…}}` is scanned for bare refs.
 */
export function parseRefTokens(text, { mode = 'expression' } = {}) {
    const s = text == null ? '' : String(text);
    if (!s) return [];
    if (TEMPLATE_RE.test(s)) return tokenizeTemplate(s);
    if (mode === 'fixed') return [{ type: 'literal', text: s }];
    return tokenizeExpression(s);
}

function tokenizeTemplate(s) {
    const tokens = [];
    const TPL = /\{\{([^}]*)\}\}/g;
    let last = 0;
    let m;
    while ((m = TPL.exec(s))) {
        if (m.index > last) tokens.push({ type: 'literal', text: s.slice(last, m.index) });
        const full = m[0];
        const inner = m[1].trim();
        const ref = classifyRef(inner);
        if (ref) tokens.push({ type: 'ref', raw: full, path: inner, wrapped: true, ...ref });
        else tokens.push({ type: 'literal', text: full });
        last = m.index + full.length;
    }
    if (last < s.length) tokens.push({ type: 'literal', text: s.slice(last) });
    return tokens;
}

function tokenizeExpression(s) {
    const tokens = [];
    SCAN_RE.lastIndex = 0;
    let last = 0;
    let m;
    while ((m = SCAN_RE.exec(s))) {
        if (m.index > last) tokens.push({ type: 'literal', text: s.slice(last, m.index) });
        const full = m[0];
        let ref;
        if (m[1] != null) ref = { source: 'steps', stepId: m[1], fieldPath: m[2] || '' };
        else if (m[4] != null) ref = { source: 'loop', itemVar: m[4], fieldPath: m[5] || '' };
        else ref = { source: 'trigger', fieldPath: m[3] || '' };
        tokens.push({ type: 'ref', raw: full, path: full, wrapped: false, ...ref });
        last = m.index + full.length;
        if (SCAN_RE.lastIndex === m.index) SCAN_RE.lastIndex++; // zero-width guard
    }
    if (last < s.length) tokens.push({ type: 'literal', text: s.slice(last) });
    return tokens;
}

/** Concatenate tokens back into the original string (round-trip safe). */
export function serializeRefTokens(tokens) {
    if (!Array.isArray(tokens)) return '';
    return tokens.map(t => (t.type === 'literal' ? t.text : t.raw)).join('');
}

/** Cheap predicate: does this value contain at least one renderable ref? */
export function hasRefTokens(text, mode) {
    return parseRefTokens(text, { mode }).some(t => t.type === 'ref');
}

/**
 * Resolve the display label for a ref token.
 *   { name, suffix, missing }
 * `name` is the human step label (or 'Trigger' / 'Loop item'); `suffix` is
 * the field path shown after the name. `missing` is true only for a steps
 * ref whose id is no longer in the definition (deleted step) — rendered as
 * a muted chip, never an error.
 */
export function resolveChipLabel(token, stepLabelById = null) {
    if (!token) return { name: '', suffix: '', missing: false };
    if (token.source === 'steps') {
        const known = !!stepLabelById?.has?.(token.stepId);
        const name = stepLabelById?.get?.(token.stepId) || token.stepId;
        return { name, suffix: token.fieldPath || '', missing: !known };
    }
    if (token.source === 'trigger') {
        return { name: 'Trigger', suffix: token.fieldPath || '', missing: false };
    }
    if (token.source === 'loop') {
        const name = token.itemVar ? `Loop item · ${token.itemVar}` : 'Loop item';
        return { name, suffix: token.fieldPath || '', missing: false };
    }
    return { name: token.path || '', suffix: '', missing: false };
}
