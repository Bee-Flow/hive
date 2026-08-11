import { fireEvent } from '@testing-library/react';
import { serializeHost } from '../components/admin/AITasksDesigner/Builder/mapping/refEditorDom';

/**
 * Driving a RefTokenInput from a test.
 *
 * The mapping fields are no longer `<input>`s — a reference has to be an atomic
 * node, which a form control cannot hold — so `fireEvent.change` and
 * `getByDisplayValue` do not reach them. These three helpers say what a test
 * means instead of spreading contenteditable mechanics across twenty files:
 *
 *   editor(scope)        the editable host (role=textbox)
 *   typeInEditor(el, s)  replace its contents with plain text, as typing would
 *   editorValue(el)      the STORED value — raw paths and all
 *
 * `editorValue` deliberately reads the stored value rather than the visible
 * text: what the author sees is "gmail read ▸ Output", what the runtime gets is
 * `{{steps.act_….output}}`, and a test asserting the contract wants the latter.
 * Use `el.textContent` when the point IS what is on screen.
 */

/** The editable host inside `scope` (a container or a queries object). */
export function editor(scope, { index = 0 } = {}) {
    const root = scope?.container || scope?.baseElement || scope || document.body;
    const found = root.querySelectorAll('[data-ref-editor]');
    return found[index] || null;
}

/** All editable hosts inside `scope`, in document order. */
export function editors(scope) {
    const root = scope?.container || scope?.baseElement || scope || document.body;
    return Array.from(root.querySelectorAll('[data-ref-editor]'));
}

/**
 * Type `text` into the editor, replacing whatever was there — the contenteditable
 * equivalent of `fireEvent.change(input, { target: { value: text } })`.
 */
export function typeInEditor(el, text) {
    if (!el) throw new Error('typeInEditor: no editor element');
    el.textContent = '';
    for (const [i, line] of String(text ?? '').split('\n').entries()) {
        if (i > 0) el.appendChild(document.createElement('br'));
        if (line) el.appendChild(document.createTextNode(line));
    }
    // Leave the caret where typing would leave it — at the end. The editor
    // remembers the caret so a picked reference lands where the author was, and
    // a helper that skipped this would exercise a path real typing never takes.
    const sel = window.getSelection?.();
    if (sel) {
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
    }
    fireEvent.input(el);
    return el;
}

/** The value the field would store — the raw paths, not the pill labels. */
export function editorValue(el) {
    return el ? serializeHost(el) : '';
}

/**
 * The editor holding exactly `value` — the contenteditable answer to
 * `getByDisplayValue`. Throws with the values it did find, so a failure names
 * the mismatch instead of just saying "null".
 */
export function editorWithValue(scope, value) {
    const all = editors(scope);
    const hit = all.find(el => serializeHost(el) === value);
    if (hit) return hit;
    throw new Error(
        `No ref editor holds ${JSON.stringify(value)}. Found: ${
            all.map(el => JSON.stringify(serializeHost(el))).join(', ') || '(none)'}`,
    );
}
