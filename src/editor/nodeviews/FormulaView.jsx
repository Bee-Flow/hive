/**
 * FormulaView — spreadsheet-formula atom node-view (table cells).
 *
 * Shows the computed value (set transiently by the normalizer); double-click, or
 * type `=` in an empty cell, to edit the `=…` source. While the editor is open
 * the surrounding table becomes clickable: clicking a cell inserts its A1
 * reference, dragging inserts a range, and clicking a column header inserts a
 * whole-column range — the gesture people expect from a spreadsheet.
 *
 * Commits on blur / Enter / Tab; an empty formula removes itself.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import useTranslation from '../../hooks/useTranslation';

/** True when the caret sits where a reference can legally be inserted. */
function acceptsRefAt(text, caret) {
  const before = text.slice(0, caret).replace(/\s+$/, '');
  if (!before || before === '=') return true;
  // after an operator, an opening paren, a comma or a range colon
  return /[+\-*/%(,:=]$/.test(before);
}

/** Replace the reference token immediately before the caret, if any. */
function replaceTrailingRef(text, caret, ref) {
  const before = text.slice(0, caret);
  const after = text.slice(caret);
  // A1, A1:B2 or a bare column label already typed/inserted at the caret.
  const m = /([A-Za-z]+\d+(?::[A-Za-z]+\d+)?|[A-Za-z]+:[A-Za-z]+)$/.exec(before);
  const head = m ? before.slice(0, before.length - m[0].length) : before;
  return { text: head + ref + after, caret: (head + ref).length };
}

export default function FormulaView({ node, view, editable }) {
  const { t } = useTranslation();
  const src = node.attrs?.src || '';
  const value = node.attrs?.value;
  const isError = !!node.attrs?.error;
  const blank = src === '' || src === '=';
  const [editing, setEditing] = useState(blank);
  const [draft, setDraft] = useState(src || '=');
  const inputRef = useRef(null);
  const draftRef = useRef(draft);
  // Where the caret was before the click stole focus — a picked reference goes
  // in there, not at the end.
  const caretRef = useRef(draft.length);
  // The anchor a drag started from, so dragging REPLACES rather than appends.
  const pickBaseRef = useRef(null);
  // Set the instant a pick happens (mousedown, before the blur it causes), so
  // the blur handler can tell "clicked a cell to pick" from "clicked away".
  const justPickedRef = useRef(false);
  // {path, offset} of the atom, captured while editing — resolveAtom's fallback
  // when a recompute swapped the node identity under the open editor (S5).
  const fallbackAtRef = useRef(null);

  useEffect(() => { draftRef.current = draft; }, [draft]);
  useEffect(() => { setDraft(src || '='); }, [src]);
  useEffect(() => {
    if (!editing) return;
    const at = view?.resolveAtom ? view.resolveAtom(node) : null;
    if (at && at.inline) fallbackAtRef.current = { path: at.path, offset: at.offset };
  }, [editing, view, node]);
  useEffect(() => {
    if (!editing) return;
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    const at = Math.min(caretRef.current, el.value.length);
    try { el.setSelectionRange(at, at); } catch (_) { /* not selectable yet */ }
  }, [editing]);

  const rememberCaret = useCallback(() => {
    const el = inputRef.current;
    if (el) caretRef.current = el.selectionStart ?? el.value.length;
  }, []);

  const applyRef = useCallback((ref) => {
    const el = inputRef.current;
    justPickedRef.current = true;
    const base = pickBaseRef.current;
    const text = base ? base.text : draftRef.current;
    const caret = base ? base.caret : caretRef.current;
    // First pick of a gesture: remember the pre-pick text so a drag rewrites the
    // same reference instead of appending one per mousemove.
    if (!base) pickBaseRef.current = { text, caret };
    const next = acceptsRefAt(text, caret)
      ? { text: text.slice(0, caret) + ref + text.slice(caret), caret: caret + ref.length }
      : replaceTrailingRef(text, caret, ref);
    setDraft(next.text);
    draftRef.current = next.text;
    caretRef.current = next.caret;
    if (el) {
      // Keep focus in the input; the click landed on a table cell.
      requestAnimationFrame(() => {
        el.focus();
        try { el.setSelectionRange(next.caret, next.caret); } catch (_) { /* noop */ }
      });
    }
  }, []);

  // Arm reference picking for as long as the editor is open.
  useEffect(() => {
    if (!editing || !editable || !view?.beginRefPick) return undefined;
    const co = view.formulaTablePath ? view.formulaTablePath(node) : null;
    view.beginRefPick({
      tablePath: co,
      onPick: applyRef,
      // End of a pick gesture (mouseup). The pick usually causes NO blur (the
      // view preventDefaults the mousedown), so the armed justPickedRef would
      // otherwise eat the NEXT real blur and leave the input orphaned (S2).
      onCommitPick: () => { pickBaseRef.current = null; justPickedRef.current = false; },
    });
    return () => view.endRefPick?.();
  }, [editing, editable, view, node, applyRef]);

  // The model operation runs FIRST; the editor only closes when it succeeded.
  // Closing first turned a failed bridge call (stale node identity) into a
  // dead read-only "=" chip that survived save (S5).
  const commit = () => {
    pickBaseRef.current = null;
    const fallbackAt = fallbackAtRef.current;
    let s = draftRef.current.trim();
    if (s && !s.startsWith('=')) s = `=${s}`;
    let ok;
    if (!s || s === '=') ok = view.deleteAtom(node, { fallbackAt }) !== false;
    else if (s === src) ok = true; // unchanged — nothing to write
    else ok = view.updateAtom(node, { src: s }, { fallbackAt }) !== false;
    if (ok) setEditing(false);
  };

  const cancel = () => {
    pickBaseRef.current = null;
    setDraft(src || '=');
    // A brand-new blank atom is removed on cancel; attempt the delete BEFORE
    // closing so a stale identity still resolves via the position fallback.
    if (blank) view.deleteAtom(node, { fallbackAt: fallbackAtRef.current });
    setEditing(false);
  };

  if (editing && editable) {
    return (
      <input
        ref={inputRef}
        className="bf-formula-input"
        value={draft}
        placeholder="=SUM(A1:A3)"
        aria-label={t('notebooks.formula_input', 'Formula')}
        onChange={(e) => { justPickedRef.current = false; setDraft(e.target.value); pickBaseRef.current = null; rememberCaret(); }}
        onSelect={rememberCaret}
        onKeyUp={rememberCaret}
        // The input lives inside a contenteditable=false atom; without this the
        // editor's own mousedown handling would steal the caret.
        onMouseDown={(e) => e.stopPropagation()}
        onBlur={() => {
          // A blur caused by clicking a cell to PICK a reference must not
          // commit — applyRef refocuses a frame later. Anything else (clicking
          // away, tabbing out, closing the panel) commits as normal. Keying
          // this off `relatedTarget == null` instead would also swallow a click
          // outside the editor and leave the editor open forever.
          if (justPickedRef.current) { justPickedRef.current = false; return; }
          commit();
        }}
        onKeyDown={(e) => {
          // Typing after a pick means the user is editing on: the next blur is
          // a real "clicked away" and must commit again (S2).
          justPickedRef.current = false;
          e.stopPropagation();
          if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); commit(); }
          if (e.key === 'Escape') { e.preventDefault(); cancel(); }
        }}
      />
    );
  }

  const display = value != null && value !== '' ? value : src;
  return (
    <span
      className={`bf-formula${isError ? ' bf-formula-error' : ''}`}
      title={src}
      onMouseDown={() => view.selectAtom(node)}
      onDoubleClick={() => { if (editable) { caretRef.current = (src || '=').length; setEditing(true); } }}
    >
      {display}
    </span>
  );
}
