/**
 * MermaidView — mermaid diagram atom node-view.
 * Reuses the existing, TipTap-free MermaidBlock component verbatim.
 */
import React from 'react';
import MermaidBlock from '../../pages/notebooks/MermaidBlock.jsx';

export default function MermaidView({ node, view, editable }) {
  return (
    <div className="notebook-mermaid-block" onMouseDown={() => view.selectAtom(node)}>
      <MermaidBlock
        code={node.attrs?.code || ''}
        onCodeChange={(code) => view.updateAtom(node, { code })}
        editable={!!editable}
      />
    </div>
  );
}
