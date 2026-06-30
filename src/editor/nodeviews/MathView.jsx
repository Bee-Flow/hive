/**
 * MathView — KaTeX math atom node-view (inline or block).
 * Double-click to edit the TeX; commit on blur / Enter.
 */
import React, { useMemo, useState, useRef, useEffect } from 'react';
import katex from 'katex';

export default function MathView({ node, view, inline, editable }) {
  const latex = node.attrs?.latex || '';
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(latex);
  const inputRef = useRef(null);

  useEffect(() => { setDraft(latex); }, [latex]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const html = useMemo(() => {
    try { return katex.renderToString(latex || '\\,', { throwOnError: false, displayMode: !inline }); }
    catch { return latex; }
  }, [latex, inline]);

  const commit = () => { setEditing(false); if (draft !== latex) view.updateAtom(node, { latex: draft }); };

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
