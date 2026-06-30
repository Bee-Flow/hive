/**
 * FormulaView — spreadsheet-formula atom node-view (table cells).
 * Shows the computed value (set transiently by normalize); double-click to edit
 * the `=…` source. A freshly inserted blank formula (src "=") opens straight in
 * edit mode. Commits on blur / Enter; an empty formula removes itself.
 */
import React, { useState, useRef, useEffect } from 'react';

export default function FormulaView({ node, view, editable }) {
  const src = node.attrs?.src || '';
  const value = node.attrs?.value;
  const isError = !!node.attrs?.error;
  const [editing, setEditing] = useState(src === '' || src === '=');
  const [draft, setDraft] = useState(src);
  const inputRef = useRef(null);

  useEffect(() => { setDraft(src); }, [src]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const commit = () => {
    setEditing(false);
    let s = draft.trim();
    if (s && !s.startsWith('=')) s = `=${s}`;
    if (!s || s === '=') { view.deleteAtom(node); return; }
    if (s !== src) view.updateAtom(node, { src: s });
  };

  if (editing && editable) {
    return (
      <input
        ref={inputRef}
        className="bf-formula-input"
        value={draft}
        placeholder="=SUM(A1:A3)"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') { e.preventDefault(); commit(); }
          if (e.key === 'Escape') { setDraft(src); setEditing(false); if (src === '' || src === '=') view.deleteAtom(node); }
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
      onDoubleClick={() => editable && setEditing(true)}
    >
      {display}
    </span>
  );
}
