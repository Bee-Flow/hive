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
// `*` is in the char class so a `[*]` wildcard path (e.g.
// steps.read.output.results[*].attachments) is recognised as a clean ref
// path — the server's ref resolver (bind.js REF_RE / tokenizePath) fully
// supports `[*]` as a flatten-map. Without it, such a path fell through to
// the `expr` kind, which the restricted grammar can't evaluate → silent
// undefined at runtime.
const SIMPLE_PATH_RE = /^[a-zA-Z_$][\w$.[\]*]*$/;
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
 * Detect an in-progress variable token at the caret, to trigger the inline
 * autocomplete picker while typing.
 *   - mode 'fixed' (templates): an UNCLOSED `{{` before the caret with a
 *     path-ish partial → the token spans from the `{{` to the caret.
 *   - mode 'expression'/path: a partial rooted path (`steps.` / `trigger.` /
 *     `loop.` / `item.` / `vars.`) ending at the caret.
 * `roots` overrides which roots count — App Studio's scope shares none of the
 * routine roots but `item`/`vars` (see AUTOCOMPLETE_ROOTS).
 * Returns `{ start, end, query }` (range in el.value) or null.
 */
export function getAutocompleteToken(el, mode, roots = AUTOCOMPLETE_ROOTS) {
    if (!el || typeof el.value !== 'string') return null;
    const caret = el.selectionStart ?? el.value.length;
    const hit = getAutocompleteTokenFromPrefix(el.value.slice(0, caret), mode, roots);
    return hit ? { start: caret - hit.length, end: caret, query: hit.query } : null;
}

/**
 * The same rule, expressed over just the text BEFORE the caret — which is all a
 * contenteditable can offer (RefTokenInput has no selectionStart, and the pills
 * before the caret are not text at all). Returns `{ length, query }`, where
 * `length` is how many typed characters the accepted suggestion should swallow.
 */
export function getAutocompleteTokenFromPrefix(before, mode, roots = AUTOCOMPLETE_ROOTS) {
    const text = typeof before === 'string' ? before : '';
    if (mode === 'fixed') {
        const open = text.lastIndexOf('{{');
        if (open === -1) return null;
        const partial = text.slice(open + 2);
        if (partial.includes('}') || partial.includes('{')) return null;
        if (!/^[\w$.[\]*\s]*$/.test(partial)) return null;
        return { length: text.length - open, query: partial.trim() };
    }
    const list = safeRoots(roots);
    if (!list.length) return null;
    // Built from `list` rather than written out, so a caller with a different
    // scope (App Studio: currentUser/form/screen/actions/…) completes ITS roots
    // instead of the routine builder's.
    const rooted = new RegExp(`(?:^|[^\\w$.])((?:${list.join('|')})\\.[\\w$.[\\]*]*)$`);
    const m = rooted.exec(text);
    if (m) return { length: m[1].length, query: m[1] };
    // A bare partial that could still BECOME a root ("st", "trig", "steps").
    // Without this the picker only ever opened once a full root plus its dot
    // was already typed, so typing "st" suggested nothing and the feature read
    // as broken (BFSF-321). Restricted to prefixes of an actual root, and to
    // 2+ characters, so ordinary expression text doesn't pop the picker open on
    // every keystroke.
    const bare = /(?:^|[^\w$.])([A-Za-z_$][\w$]*)$/.exec(text);
    if (!bare) return null;
    const partial = bare[1];
    if (partial.length < 2) return null;
    const lower = partial.toLowerCase();
    if (!list.some(root => root.toLowerCase().startsWith(lower))) return null;
    return { length: partial.length, query: partial };
}

// Roots the expression-mode picker will complete. Superset of VALID_REF_ROOTS:
// `item` is the conventional loop-body alias and is accepted by the runtime
// resolver, so users expect it to autocomplete too.
export const AUTOCOMPLETE_ROOTS = ['steps', 'trigger', 'loop', 'item', 'vars'];

/**
 * Keep only roots that are plain identifiers, so a caller-supplied list (in
 * App Studio's case, one fetched from the server catalog) can never smuggle
 * regex metacharacters into the pattern built above.
 */
function safeRoots(roots) {
    const list = Array.isArray(roots) ? roots : AUTOCOMPLETE_ROOTS;
    return list.filter(r => typeof r === 'string' && /^[A-Za-z_$][\w$]*$/.test(r));
}

/**
 * Replace [start, end) of the element's value with `snippet`, placing the
 * caret after it. Sibling of insertAtCursor for token-replacement (the
 * range was recorded when autocomplete opened — focus may have moved to
 * the picker's search box since). Returns the new full value.
 */
export function replaceRange(el, start, end, snippet) {
    if (!el) return null;
    const value = String(el.value ?? '');
    const from = Math.max(0, Math.min(start, value.length));
    const to = Math.max(from, Math.min(end, value.length));
    const next = value.slice(0, from) + snippet + value.slice(to);
    el.value = next;
    const caret = from + snippet.length;
    try { el.setSelectionRange(caret, caret); } catch (_) { /* ignore */ }
    el.focus();
    return next;
}

/**
 * Suggest a field NAME from a picked path — the last meaningful segment
 * (`trigger.output.subject` → `subject`). Used by the Set editor's
 * "Add field from a previous step" action.
 */
export function suggestKeyFromPath(path) {
    const cleaned = String(path || '').trim().replace(/\[(?:\*|\d+)\]/g, '');
    const segs = cleaned.split('.').filter(Boolean);
    let seg = segs.pop() || '';
    if (seg === 'output' && segs.length) seg = segs.pop();
    const key = seg.replace(/[^A-Za-z0-9_]/g, '_').replace(/^_+|_+$/g, '');
    return key || 'field';
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
    const right = renderBindingValue(rightBinding);
    return `${left} ${op} ${right}`;
}

/**
 * Render a binding as the right-hand side of a restricted-JS expression:
 * literals as JSON, refs as the bare path, exprs verbatim. Shared by the
 * condition/filter builders so every comparison serialises identically.
 */
export function renderBindingValue(b) {
    if (!b || typeof b !== 'object') return JSON.stringify(b ?? '');
    // `?? ''` here meant an EXPLICIT null rendered as the empty string, so the
    // condition builder rewrote `form.assignee == null` into
    // `form.assignee == ""` the moment any row in the group was edited — "show
    // this only when nobody is assigned" quietly became "…when the assignee is
    // an empty string", which is a different question with a different answer.
    // Only `undefined` means "nothing filled in yet"; parseExprToRows produces
    // value:null solely from a literal `null` the author actually wrote.
    if (b.kind === 'literal') return JSON.stringify(b.value === undefined ? '' : b.value);
    if (b.kind === 'ref')     return String(b.path || '');
    if (b.kind === 'expr')    return String(b.value || '');
    if (b.kind === 'template') return templateToExprFragment(String(b.value || ''));
    return JSON.stringify(b);
}

// A single `{{ path }}` token, scanned exactly like the runtime's
// server/automation/bind.js interpolateTemplate so "what counts as an
// interpolation" cannot drift between the two.
const TEMPLATE_TOKEN_RE = /\{\{\s*([^}]+?)\s*\}\}/g;

/**
 * Render a `template` binding as an EXPRESSION fragment.
 *
 * This used to be `JSON.stringify(b.value)`, which turned the raw,
 * uninterpolated template text into a string LITERAL: picking a variable in
 * the condition builder's default "fixed" mode (BindingField inserts
 * `{{path}}` there, and bindingFromInput promotes that to kind 'template')
 * saved
 *     steps.s1.output.status == "{{trigger.output.status}}"
 * — an expression that is false for every run, silently, with a green status.
 * Nothing interpolates inside an `expr`; only the binding resolver does that.
 *
 * So a template that is ONE whole-string interpolation collapses to its bare
 * path — the same rule BindingField.translateForMode uses when the user flips
 * the mode switch. Mixed literal+interpolation text becomes `concat(...)` of
 * quoted literal runs and bare paths (`concat` is on the engine's whitelist),
 * which is what the template MEANT. Anything whose interpolation isn't a clean
 * path (e.g. `{{a + 1}}`) keeps the historical quoted-raw-string rendering
 * rather than emitting something the restricted grammar can't parse.
 */
function templateToExprFragment(text) {
    const parts = [];
    let last = 0;
    let sawPath = false;
    TEMPLATE_TOKEN_RE.lastIndex = 0;
    let m;
    while ((m = TEMPLATE_TOKEN_RE.exec(text)) !== null) {
        const inner = m[1].trim();
        if (!isCleanPath(inner)) return JSON.stringify(text);
        if (m.index > last) parts.push(JSON.stringify(text.slice(last, m.index)));
        parts.push(inner);
        sawPath = true;
        last = m.index + m[0].length;
    }
    if (!sawPath) return JSON.stringify(text);
    if (last < text.length) parts.push(JSON.stringify(text.slice(last)));
    return parts.length === 1 ? parts[0] : `concat(${parts.join(', ')})`;
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
        // Never walk the prototype chain — mirrors server bind.js: a picked
        // path like "constructor" must preview as undefined here, exactly as
        // it resolves at runtime. Array/string indices and `.length` are own
        // properties (hasOwnProperty.call auto-boxes primitives), so
        // legitimate paths are unaffected.
        if (!Object.prototype.hasOwnProperty.call(cur, tok.key)) return undefined;
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

// Mirrors server bind.js REF_RE. The FE walkPath above deliberately skips
// this check (it previews saved paths verbatim), but walkRelativePath must
// enforce it so a parse_json field path resolves IDENTICALLY at design time
// and at runtime — e.g. a bare-digit path `0` is rejected on both sides
// (use `[0]`).
const REF_RE = /^[A-Za-z_$][A-Za-z0-9_$]*(?:\.[A-Za-z_$][A-Za-z0-9_$]*|\[(?:[0-9]+|\*|"[^"]*"|'[^']*')\])*$/;

/**
 * Walk a path RELATIVE to an arbitrary value (not the runState roots).
 * Byte-for-byte mirror of server/automation/bind.js walkRelativePath —
 * used by the parse_json step editor's live preview so what the user sees
 * is exactly what the runtime extracts.
 *
 * Wrapping the value as `{$: value}` and prefixing the path with `$`/`$.`
 * keeps REF_RE satisfied (it rejects a leading `[`) while allowing
 * root-array sources (`[0].x`, `[*].sku`), and reuses resolveTokens'
 * `[*]` flatten + prototype-chain block unchanged. `''`/`'$'`/nullish
 * returns the whole source.
 */
export function walkRelativePath(path, value) {
    if (path === '' || path === '$' || path == null) return value;
    const p = String(path);
    const abs = p.startsWith('[') ? `$${p}` : `$.${p}`;
    if (!REF_RE.test(abs)) return undefined;
    const tokens = tokenizePath(abs);
    if (!tokens) return undefined;
    return resolveTokens(tokens, { $: value });
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
