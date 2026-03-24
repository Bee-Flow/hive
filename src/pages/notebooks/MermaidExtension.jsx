/**
 * MermaidExtension — A custom TipTap node for rendering Mermaid diagrams.
 * 
 * This creates a `mermaidDiagram` node type that stores raw mermaid code
 * and renders it as an interactive diagram via a React NodeView.
 */
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import React from 'react';
import MermaidBlock from './MermaidBlock';

/* ── React NodeView component ──────────────────────── */
function MermaidNodeView({ node, updateAttributes, editor }) {
    const code = node.attrs.code || '';

    return (
        <NodeViewWrapper className="mermaid-node-wrapper" contentEditable={false}>
            <MermaidBlock
                code={code}
                onCodeChange={(newCode) => updateAttributes({ code: newCode })}
                editable={editor?.isEditable}
            />
        </NodeViewWrapper>
    );
}

/* ── TipTap Node Extension ─────────────────────────── */
const MermaidExtension = Node.create({
    name: 'mermaidDiagram',
    group: 'block',
    atom: true, // not editable inline - uses NodeView

    addAttributes() {
        return {
            code: {
                default: '',
            },
        };
    },

    parseHTML() {
        return [
            {
                tag: 'div[data-type="mermaid-diagram"]',
                getAttrs: (dom) => ({
                    code: dom.getAttribute('data-code') || dom.textContent || '',
                }),
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return ['div', mergeAttributes(
            { 'data-type': 'mermaid-diagram', 'data-code': HTMLAttributes.code },
            HTMLAttributes
        ), HTMLAttributes.code || ''];
    },

    addNodeView() {
        return ReactNodeViewRenderer(MermaidNodeView);
    },

    addCommands() {
        return {
            insertMermaidDiagram: (code) => ({ commands }) => {
                return commands.insertContent({
                    type: this.name,
                    attrs: { code },
                });
            },
        };
    },
});

export default MermaidExtension;

/**
 * Utility: Extract mermaid code blocks from markdown and replace them
 * with mermaid diagram node placeholders.
 * 
 * This function takes raw markdown and processes it so that:
 * - Regular markdown remains as-is for tiptap-markdown to handle
 * - Mermaid code blocks are replaced with HTML div placeholders
 *   that the MermaidExtension parseHTML will recognize
 * 
 * Also handles raw mermaid content (no code fence) that starts with
 * mermaid keywords like "mindmap", "flowchart", "graph", etc.
 */
export function preprocessMermaidContent(markdown) {
    if (!markdown) return markdown;

    // Pattern: ```mermaid ... ``` code blocks
    const fencedPattern = /```mermaid\s*\n([\s\S]*?)```/gi;
    let result = markdown.replace(fencedPattern, (match, code) => {
        const escaped = code.trim()
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
        return `<div data-type="mermaid-diagram" data-code="${escaped}"></div>`;
    });

    // Also detect raw mermaid content (no code fence) — common for mind maps
    // This handles cases where the AI returns just the raw mermaid syntax
    const mermaidKeywords = ['mindmap', 'flowchart', 'graph ', 'graph\n', 'sequenceDiagram', 'classDiagram', 'stateDiagram', 'erDiagram', 'gantt', 'pie', 'journey', 'gitGraph', 'C4Context', 'sankey'];
    const trimmed = result.trim();
    const isRawMermaid = mermaidKeywords.some(kw => trimmed.startsWith(kw));
    
    if (isRawMermaid && !result.includes('data-type="mermaid-diagram"')) {
        const escaped = trimmed
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
        result = `<div data-type="mermaid-diagram" data-code="${escaped}"></div>`;
    }

    return result;
}
