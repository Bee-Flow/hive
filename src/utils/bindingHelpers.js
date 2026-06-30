/**
 * Helpers for the mapping/binding UX. The runtime accepts four binding
 * kinds — literal, ref, template, expr — but the user-facing UI hides
 * the kind behind a simpler "fixed vs expression" toggle and detects
 * the right kind automatically when the user types `{{...}}` or a
 * clean path. Every function here is pure and side-effect free except
 * `insertAtCursor` which mutates a DOM input/textarea.
 */

// Exported so the chip/token layer (mapping/refTokens.js) shares the exact
// same notion of "contains an interpolation" — keep this the single source.
export const TEMPLATE_RE = /\{\{[^}]+\}\}/;
const SIMPLE_PATH_RE = /^[a-zA-Z_$][\w$.[\]]*$/;
const VALID_REF_ROOTS = ['trigger', 'steps', 'vars', 'secrets', 'loop'];

/**
 * Does the text contain a `{{ path }}` interpolation?
 */
export function detectTemplate(text) {
    if (typeof text !== 'string') return false;
    return TEMPLATE_RE.test(text);
}

/**
 * Looks like `steps.s1.output.foo` or `loop.item.subject` — no
 * operators, just a dotted/bracketed identifier path.
 */
export function isCleanPath(text) {
    if (typeof text !== 'string') return false;
    return SIMPLE_PATH_RE.test(text.trim());
}

/**
 * Pick the most appropriate binding kind for the user's typed value
 * given the current "mode". Mode is the user-facing toggle:
 *   - 'fixed'      — a literal text value, OR a template if it contains {{...}}
 *   - 'expression' — a ref (clean path) or a JS expression
 *
 * Returns a canonical binding object the runtime resolver accepts.
 */
export function bindingFromInput(value, mode) {
    if (mode === 'expression') {
        const v = String(value ?? '').trim();
        if (!v) return { kind: 'literal', value: '' };
        if (isCleanPath(v) && VALID_REF_ROOTS.includes(v.split('.')[0])) {
            return { kind: 'ref', path: v };
        }
        return { kind: 'expr', value: v };
    }
    // fixed mode
    if (detectTemplate(value)) return { kind: 'template', value: String(value) };
    return { kind: 'literal', value: value ?? '' };
}

/**
 * Inverse of bindingFromInput — given a stored binding, return the
 * `{ mode, text }` the input should display so the user can edit it
 * round-trip without losing meaning.
 *
 * Bare/unknown values are treated as fixed-mode literals (matches the
 * runtime resolver's tolerance — see canonicalizeBinding in
 * server/automation/builderTools.js).
 */
export function inputFromBinding(binding) {
    if (binding == null) return { mode: 'fixed', text: '' };
    if (typeof binding !== 'object') {
        return { mode: 'fixed', text: String(binding) };
    }
    if (binding.kind === 'literal') {
        const v = binding.value;
        if (v == null) return { mode: 'fixed', text: '' };
        if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
            return { mode: 'fixed', text: String(v) };
        }
        // Object/array literal — show JSON in fixed mode (rare).
        try { return { mode: 'fixed', text: JSON.stringify(v) }; }
        catch (_) { return { mode: 'fixed', text: '' }; }
    }
    if (binding.kind === 'template') return { mode: 'fixed', text: String(binding.value || '') };
    if (binding.kind === 'ref')      return { mode: 'expression', text: String(binding.path || '') };
    if (binding.kind === 'expr')     return { mode: 'expression', text: String(binding.value || '') };
    // Unknown shape — treat as JSON literal so user can at least see it.
    try { return { mode: 'fixed', text: JSON.stringify(binding) }; }
    catch (_) { return { mode: 'fixed', text: '' }; }
}

/**
 * Insert text at the input/textarea's caret position, keeping focus and
 * positioning the caret right after the inserted snippet. Falls back to
 * appending if the element doesn't expose a selection API.
 *
 * Returns the resulting full value so the caller can lift it into React
 * state in the same tick (uncontrolled DOM mutation alone won't trigger
 * React's onChange).
 */
export function insertAtCursor(el, snippet) {
    if (!el) return null;
    const isTextLike = (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
    if (!isTextLike) return null;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const before = el.value.slice(0, start);
    const after = el.value.slice(end);
    const next = before + snippet + after;
    el.value = next;
    const caret = start + snippet.length;
    try { el.setSelectionRange(caret, caret); } catch (_) { /* ignore */ }
    el.focus();
    return next;
}

/**
 * Format a path for insertion given the current field mode.
 *   - 'fixed'      — wrap as `{{path}}` so the runtime interpolates it
 *   - 'expression' — bare path (the field will detect ref vs expr)
 */
export function formatPathForInsert(path, mode) {
    const cleaned = String(path || '').trim();
    if (!cleaned) return '';
    if (mode === 'fixed') return `{{${cleaned}}}`;
    return cleaned;
}

/**
 * Try to break a raw expression like `steps.s1.output.total > 1000`
 * into `{ leftPath, op, rightValue }` for the visual Condition builder.
 * Returns null when the expression doesn't fit the simple
 * `<path> <op> <literal-or-path>` template (the visual mode falls back
 * to "advanced raw" in that case).
 *
 * Supported operators (textual, in order of length so longer alternatives
 * don't get shadowed by shorter ones):
 *   ===, !==, ==, !=, >=, <=, >, <
 */
const COND_OPS = ['===', '!==', '==', '!=', '>=', '<=', '>', '<'];

export function parseSimpleCondition(expr) {
    if (typeof expr !== 'string') return null;
    const text = expr.trim();
    if (!text) return null;
    for (const op of COND_OPS) {
        // Find an operator with whitespace on at least one side so we
        // don't match `>=` inside a longer token.
        const idx = findOperator(text, op);
        if (idx === -1) continue;
        const left = text.slice(0, idx).trim();
        const right = text.slice(idx + op.length).trim();
        if (!left || !right) continue;
        if (!isCleanPath(left)) return null;
        return { leftPath: left, op, rightRaw: right };
    }
    return null;
}

function findOperator(text, op) {
    let from = 0;
    while (from < text.length) {
        const idx = text.indexOf(op, from);
        if (idx === -1) return -1;
        const before = idx > 0 ? text[idx - 1] : ' ';
        const after = idx + op.length < text.length ? text[idx + op.length] : ' ';
        // Reject if surrounded by other operator chars (avoids splitting `>=` on `>`).
        const opChars = new Set(['=', '!', '<', '>']);
        if (opChars.has(before) || opChars.has(after)) {
            from = idx + 1;
            continue;
        }
        return idx;
    }
    return -1;
}

/**
 * Build a raw expression string from the visual Condition builder's
 * three slots. `rightBinding` may be a literal (rendered as JSON) or
 * a ref/expr (rendered as the bare path / expression).
 */
export function buildConditionExpr(leftPath, op, rightBinding) {
    const left = String(leftPath || '').trim();
    if (!left) return '';
    const right = renderRightSide(rightBinding);
    return `${left} ${op} ${right}`;
}

function renderRightSide(b) {
    if (!b || typeof b !== 'object') return JSON.stringify(b ?? '');
    if (b.kind === 'literal') return JSON.stringify(b.value ?? '');
    if (b.kind === 'ref')     return String(b.path || '');
    if (b.kind === 'expr')    return String(b.value || '');
    if (b.kind === 'template') return JSON.stringify(b.value || '');
    return JSON.stringify(b);
}

// §WS4.1 — canonical path tokeniser/resolver, ported to match the SERVER runtime
// (server/automation/bind.js tokenizePath/resolveTokens) byte-for-byte in
// semantics. The previous FE walker split on '.' and only understood `[N]`
// numeric indices — so any path containing a `[*]` wildcard (e.g. a forEach
// `…results[*].output.field` shape) resolved to undefined in the design-time
// preview while the live runtime resolved it. Keeping the two in lock-step is
// what makes the VariableTree preview match what the automation actually sees.
function tokenizePath(path) {
    const tokens = [];
    let i = 0;
    let buf = '';
    const flush = () => { if (buf.length) { tokens.push({ type: 'prop', key: buf }); buf = ''; } };
    while (i < path.length) {
        const c = path[i];
        if (c === '.') { flush(); i++; continue; }
        if (c === '[') {
            flush();
            const close = path.indexOf(']', i);
            if (close < 0) return null;
            const raw = path.slice(i + 1, close);
            if (raw === '*') tokens.push({ type: 'wild' });
            else if (raw.startsWith('"') && raw.endsWith('"')) tokens.push({ type: 'prop', key: raw.slice(1, -1) });
            else if (raw.startsWith("'") && raw.endsWith("'")) tokens.push({ type: 'prop', key: raw.slice(1, -1) });
            else tokens.push({ type: 'prop', key: parseInt(raw, 10) });
            i = close + 1;
            continue;
        }
        buf += c;
        i++;
    }
    flush();
    return tokens;
}

function resolveTokens(tokens, cur) {
    for (let t = 0; t < tokens.length; t++) {
        const tok = tokens[t];
        if (tok.type === 'wild') {
            if (!Array.isArray(cur)) return undefined;
            const rest = tokens.slice(t + 1);
            const out = [];
            for (const el of cur) {
                const m = resolveTokens(rest, el);
                if (m === undefined) continue;
                if (Array.isArray(m)) out.push(...m);
                else out.push(m);
            }
            return out;
        }
        if (cur == null) return undefined;
        cur = cur[tok.key];
    }
    return cur;
}

/**
 * Walk a dotted/bracketed path on an object
 * (`steps.s1.output.results[0].subject`, `…results[*].output.field`,
 * `obj["quoted key"]`). Returns undefined if any segment is missing — never
 * throws. Supports `[*]` wildcard flatten with the same semantics as the server
 * runtime. Used by the VariableTree to resolve a sample value to display.
 */
export function walkPath(path, root) {
    if (!path || root == null) return undefined;
    const tokens = tokenizePath(String(path));
    if (!tokens) return undefined;
    return resolveTokens(tokens, root);
}

/**
 * Format a sample value for inline display in the variable tree.
 * Strings are shown raw (truncated), numbers/booleans/null serialise
 * naturally, objects/arrays show as `{…}` / `[N items]`.
 */
export function previewValue(value, maxLen = 40) {
    if (value == null) return '—';
    if (typeof value === 'string') {
        return value.length > maxLen ? value.slice(0, maxLen - 1) + '…' : value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (Array.isArray(value)) return `[${value.length} item${value.length === 1 ? '' : 's'}]`;
    if (typeof value === 'object') {
        const keys = Object.keys(value);
        if (keys.length === 0) return '{}';
        return `{${keys.slice(0, 3).join(', ')}${keys.length > 3 ? '…' : ''}}`;
    }
    return String(value);
}
