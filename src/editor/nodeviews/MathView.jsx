/**
 * MathView — KaTeX math atom node-view (inline or block).
 * Double-click to edit the TeX; commit on blur / Enter.
 */
import React, { useMemo, useState, useRef, useEffect } from 'react';
import katex from 'katex';

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export default function MathView({ node, view, inline, editable }) {
  const latex = node.attrs?.latex || '';
  // A freshly inserted formula has no TeX yet — open the input immediately
  // rather than making the user discover the double-click (BFSF-317).
  const [editing, setEditing] = useState(() => latex === '');
  const [draft, setDraft] = useState(latex);
  const inputRef = useRef(null);

  useEffect(() => { setDraft(latex); }, [latex]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const html = useMemo(() => {
    // KaTeX escapes its own error output, but the catch branch used to return
    // the raw source straight into dangerouslySetInnerHTML below.
    try { return katex.renderToString(latex || '\\,', { throwOnError: false, displayMode: !inline }); }
    catch { return escapeHtml(latex); }
  }, [latex, inline]);

  const commit = () => {
    setEditing(false);
    // Abandoning an empty formula should leave nothing behind, not an empty atom.
    if (!draft.trim()) { if (!latex) view.deleteAtom(node); return; }
    if (draft !== latex) view.updateAtom(node, { latex: draft });
  };

  if (editing && editable) {
    return (
      <input
        ref={inputRef}
        className="bf-math-input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } if (e.key === 'Escape') { setDraft(latex); setEditing(false); } }}
      />
    );
  }

  return (
    <span
      className={inline ? 'bf-math bf-math-inline' : 'bf-math bf-math-block'}
      onMouseDown={() => view.selectAtom(node)}
      onDoubleClick={() => editable && setEditing(true)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
