import { humanizeFieldTail } from '../flow/displayHelpers';
import { parseRefTokens, resolveChipLabel } from './refTokens';

/**
 * The DOM half of the reference editor: turn a stored field value into editable
 * nodes, and read those nodes back into the stored value.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────
 * The runtime resolver needs an id path — `steps.act_f9aaff0e.output.results[*]
 * .output`. An author should never have to look at one. RefChips already showed
 * the friendly name, but only while the field was BLURRED: the moment you
 * clicked in to write your prompt, the raw ids came back. So the raw path was
 * always on screen exactly when someone was working.
 *
 * The fix is to stop treating a reference as text. In the editor it is one
 * atomic node — `contenteditable="false"`, so the caret steps over it and
 * Backspace takes the whole thing — carrying the raw path in `data-raw` and
 * showing only "gmail read ▸ Output".
 *
 * ── THE ONE INVARIANT ───────────────────────────────────────────────
 *      serializeHost(buildFragment(v)) === v
 * for every value, including ones with no references at all. Everything the
 * editor does goes through these two functions, so a bug here is a bug that
 * silently rewrites someone's saved automation. It is tested directly.
 *
 * Kept free of React so it can be tested as data-in / data-out, and so the
 * editor can own its DOM (a React re-render on every keystroke would destroy
 * the caret).
 */

export const PILL_ATTR = 'data-ref-pill';
export const PILL_SELECTOR = `[${PILL_ATTR}]`;
// A <br> the browser needs to make a trailing newline visible, but that is NOT
// part of the value. Without it, pressing Enter at the end moves the caret to a
// line that cannot be seen; with it counted, every Enter would double.
export const FILLER_ATTR = 'data-ref-filler';

const PILL_CLASS = [
    'inline-flex items-center gap-1 align-baseline mx-0.5 rounded px-1.5 py-0.5',
    'text-[11px] border select-none whitespace-nowrap',
].join(' ');
const PILL_OK = 'border-[var(--accent)]/40 bg-[var(--accent)]/15 text-[var(--accent)]';
// A reference to a step that no longer exists. Muted and dashed rather than red:
// it is usually a step the author just deleted, not an error to be alarmed by —
// but it must stay visible, because it is the only way to find and fix it.
const PILL_MISSING = 'border-dashed border-[var(--border-default)] bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]';

/**
 * One reference, as an atomic editor node.
 *
 * `data-raw` is the EXACT original substring (braces and inner spacing
 * included), which is what makes the round-trip byte-faithful — the pill is a
 * different presentation of that text, never a re-rendering of it.
 */
export function buildPill(token, { stepLabelById = null, doc = document } = {}) {
    const { name, suffix, missing } = resolveChipLabel(token, stepLabelById);
    const el = doc.createElement('span');
    el.setAttribute(PILL_ATTR, '');
    el.setAttribute('contenteditable', 'false');
    el.dataset.raw = token.raw;
    el.className = `${PILL_CLASS} ${missing ? PILL_MISSING : PILL_OK}`;
    el.title = missing ? `Step no longer exists — ${token.path}` : token.path;

    const nameEl = doc.createElement('span');
    nameEl.className = 'font-medium';
    nameEl.textContent = name;
    el.appendChild(nameEl);

    // The FIELD's name, not its path: "gmail read ▸ Output" tells an author
    // where the value comes from; "gmail read ▸ results[0].output" does not.
    // The exact path is one hover away.
    const tail = suffix ? humanizeFieldTail(suffix) : '';
    if (tail) {
        const suffixEl = doc.createElement('span');
        suffixEl.className = 'opacity-70';
        suffixEl.textContent = `▸ ${tail}`;
        el.appendChild(suffixEl);
    }
    return el;
}

/**
 * A value → the editor's child nodes. Literal runs become text nodes with `<br>`
 * for newlines; every recognised reference becomes a pill.
 */
export function buildFragment(value, { mode = 'fixed', stepLabelById = null, doc = document } = {}) {
    const frag = doc.createDocumentFragment();
    for (const token of parseRefTokens(value, { mode })) {
        if (token.type === 'ref') {
            frag.appendChild(buildPill(token, { stepLabelById, doc }));
            continue;
        }
        appendText(frag, token.text, doc);
    }
    return frag;
}

/** Text with newlines → text nodes separated by <br>. */
export function appendText(parent, text, doc = document) {
    const parts = String(text ?? '').split('\n');
    parts.forEach((part, i) => {
        if (i > 0) parent.appendChild(doc.createElement('br'));
        if (part) parent.appendChild(doc.createTextNode(part));
    });
}

/**
 * The editor's nodes → the stored value.
 *
 * Deliberately tolerant of what a browser puts in a contenteditable on its own:
 * a paste can leave <div>/<p> wrappers and a stray <br>, and none of that may
 * change the author's text. Anything unrecognised is walked through, so an
 * unexpected wrapper costs its structure, never its content.
 */
export function serializeHost(host) {
    if (!host) return '';
    let out = '';

    const walk = (node, topLevel) => {
        for (let i = 0; i < node.childNodes.length; i += 1) {
            const child = node.childNodes[i];
            if (child.nodeType === 3) { out += child.nodeValue; continue; }
            if (child.nodeType !== 1) continue;
            if (child.hasAttribute?.(PILL_ATTR)) { out += child.dataset.raw ?? ''; continue; }
            if (child.tagName === 'BR') {
                if (!child.hasAttribute?.(FILLER_ATTR)) out += '\n';
                continue;
            }
            // A block wrapper starts a new line — except the very first one,
            // which is the existing line rather than a break from it.
            if (BLOCK_TAGS.has(child.tagName) && !(topLevel && i === 0)) out += '\n';
            walk(child, false);
        }
    };

    walk(host, true);
    return out;
}

const BLOCK_TAGS = new Set(['DIV', 'P', 'LI', 'SECTION', 'ARTICLE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6']);

/**
 * Replace the host's contents with `value`, then park the caret at the end.
 * Used on mount, when the value changes from outside (undo, an AI patch), and
 * on blur — which is what turns a `{{…}}` someone typed or pasted by hand into
 * a pill.
 */
export function renderInto(host, value, { mode, stepLabelById, doc = document } = {}) {
    if (!host) return;
    host.textContent = '';
    host.appendChild(buildFragment(value, { mode, stepLabelById, doc }));
    ensureTrailingFiller(host, doc);
}

/**
 * Guarantee a caret position after a trailing newline or pill.
 *
 * Two cases a contenteditable cannot represent on its own: a value ending in
 * `\n` (the new line has nothing to sit on) and one ending in a pill (there is
 * no text node to put the caret in, so the author cannot type after their own
 * reference — which is most of the time, since the reference usually comes
 * last). Both get an invisible node that serialization skips.
 */
export function ensureTrailingFiller(host, doc = document) {
    if (!host) return;
    const last = host.lastChild;
    if (last && last.nodeType === 1 && last.tagName === 'BR' && !last.hasAttribute(FILLER_ATTR)) {
        const filler = doc.createElement('br');
        filler.setAttribute(FILLER_ATTR, '');
        host.appendChild(filler);
        return;
    }
    if (last && last.nodeType === 1 && last.hasAttribute?.(PILL_ATTR)) {
        host.appendChild(doc.createTextNode(''));
    }
}

/** Put the caret at the very end of the host. */
export function caretToEnd(host, win = window) {
    const sel = win.getSelection?.();
    if (!sel || !host) return;
    const range = (win.document || document).createRange();
    range.selectNodeContents(host);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
}

/**
 * Insert nodes at the caret (or at the end when the caret is elsewhere) and
 * leave the caret AFTER them, in a text node the author can type into.
 */
export function insertAtCaret(host, nodes, opts = {}) {
    if (!host || !nodes.length) return;
    const { win = window, doc = document } = opts;
    const sel = win.getSelection?.();
    let range = null;
    if ('range' in opts) {
        // The caller owns the caret. Clicking the {} button moves focus to the
        // picker, and a programmatic refocus afterwards leaves the selection at
        // the START of the field — so trusting the live selection here would
        // drop every picked reference in front of the author's text. No
        // remembered caret means the end, which is where "add this" belongs.
        if (opts.range && host.contains(opts.range.commonAncestorContainer)) range = opts.range;
    } else if (sel && sel.rangeCount) {
        const candidate = sel.getRangeAt(0);
        if (host.contains(candidate.commonAncestorContainer)) range = candidate;
    }
    if (!range) {
        range = doc.createRange();
        range.selectNodeContents(host);
        range.collapse(false);
    }
    range.deleteContents();

    const frag = doc.createDocumentFragment();
    for (const n of nodes) frag.appendChild(n);
    const lastInserted = frag.lastChild;
    range.insertNode(frag);

    const after = doc.createTextNode('');
    lastInserted.parentNode.insertBefore(after, lastInserted.nextSibling);
    ensureTrailingFiller(host, doc);

    if (sel) {
        const caret = doc.createRange();
        caret.setStart(after, 0);
        caret.collapse(true);
        sel.removeAllRanges();
        sel.addRange(caret);
    }
}

/**
 * The pill immediately before a collapsed caret, if there is one.
 *
 * Browsers mostly delete a `contenteditable="false"` node atomically, but not
 * consistently — Firefox has historically left the element and cleared its
 * contents, which would turn a reference into an empty pill that serializes to
 * a raw path nobody can see. Handling Backspace ourselves makes it the same
 * everywhere: one press, the whole reference.
 */
export function pillBeforeCaret(host, win = window) {
    const sel = win.getSelection?.();
    if (!sel || !sel.isCollapsed || !sel.rangeCount || !host) return null;
    const { anchorNode, anchorOffset } = sel;
    if (!host.contains(anchorNode)) return null;

    let prev = null;
    if (anchorNode.nodeType === 3) {
        if (anchorOffset !== 0) return null;
        prev = anchorNode.previousSibling;
    } else if (anchorNode === host || host.contains(anchorNode)) {
        prev = anchorNode.childNodes[anchorOffset - 1] || null;
    }
    // Empty text nodes are our own caret parking spots — step over them.
    while (prev && prev.nodeType === 3 && prev.nodeValue === '') prev = prev.previousSibling;
    return (prev && prev.nodeType === 1 && prev.hasAttribute?.(PILL_ATTR)) ? prev : null;
}

/**
 * The plain text between the start of the host and a collapsed caret. Feeds the
 * `{{`-and-partial-path autocomplete, which has to look at what was TYPED —
 * pills contribute nothing, since a completed reference is never a prefix of
 * the next one.
 */
export function textBeforeCaret(host, win = window) {
    const sel = win.getSelection?.();
    if (!sel || !sel.isCollapsed || !sel.rangeCount || !host) return '';
    const { anchorNode, anchorOffset } = sel;
    if (!host.contains(anchorNode) && anchorNode !== host) return '';
    if (anchorNode.nodeType === 3) return String(anchorNode.nodeValue || '').slice(0, anchorOffset);
    return '';
}

/**
 * Delete `length` characters immediately before the caret. Used to swallow the
 * partial the author typed (`{{ste`) when they accept a suggestion, so the
 * pill replaces it rather than landing after it.
 */
export function deleteBeforeCaret(host, length, { win = window, range: saved = null } = {}) {
    if (length <= 0) return;
    const sel = win.getSelection?.();
    const ambient = (sel && sel.rangeCount) ? sel.getRangeAt(0) : null;
    const range = (saved && host?.contains(saved.commonAncestorContainer)) ? saved : ambient;
    if (!range || !sel) return;
    // A caret at the end of an element (which is where `collapse(false)` and a
    // fresh focus both leave it) reports the ELEMENT as its container, not the
    // text it visually sits after — so resolve to that text node first.
    let node = range.startContainer;
    let offset = range.startOffset;
    if (node.nodeType !== 3) {
        const before = node.childNodes[offset - 1];
        if (!before || before.nodeType !== 3) return;
        node = before;
        offset = node.nodeValue.length;
    }
    const start = Math.max(0, offset - length);
    node.nodeValue = node.nodeValue.slice(0, start) + node.nodeValue.slice(offset);
    const caret = (win.document || document).createRange();
    caret.setStart(node, start);
    caret.collapse(true);
    sel.removeAllRanges();
    sel.addRange(caret);
}
