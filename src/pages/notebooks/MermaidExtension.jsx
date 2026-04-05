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

/* ── Encoding helpers ────────────────────────────────── */
function encodeForAttr(str) {
    // Use btoa-safe encoding: encode to base64 so it NEVER breaks HTML attributes
    try {
        return btoa(unescape(encodeURIComponent(str)));
    } catch {
        // Fallback: HTML entity escape
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
}

function decodeFromAttr(str) {
    if (!str) return '';
    // Try base64 first (new format)
    try {
        const decoded = decodeURIComponent(escape(atob(str)));
        // Verify it looks like valid decoded content (not garbage)
        if (decoded && !decoded.includes('\ufffd')) return decoded;
    } catch {
        // Not base64 — try HTML entity decode (legacy format)
    }
    // Legacy: HTML entity encoded
    return str
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');
}

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
                    code: decodeFromAttr(dom.getAttribute('data-code')) || dom.textContent || '',
                }),
            },
            // Fallback: catch <pre><code class="language-mermaid"> blocks
            // that were saved as regular code blocks before preprocessing
            {
                tag: 'pre',
                getAttrs: (dom) => {
                    const code = dom.querySelector('code');
                    if (!code) return false;
                    const cls = code.getAttribute('class') || '';
                    if (!cls.includes('language-mermaid')) return false;
                    return { code: code.textContent || '' };
                },
                // Higher priority so it's tried before StarterKit's codeBlock
                priority: 60,
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        const encoded = encodeForAttr(HTMLAttributes.code || '');
        return ['div', mergeAttributes(
            { 'data-type': 'mermaid-diagram', 'data-code': encoded },
            { ...HTMLAttributes, code: undefined } // don't emit raw `code` as an attr
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
 * Utility: Extract mermaid code blocks from markdown/HTML and replace them
 * with mermaid diagram node placeholders.
 * 
 * This function takes raw markdown/HTML and processes it so that:
 * - Regular markdown remains as-is for tiptap-markdown to handle
 * - Mermaid code blocks are replaced with HTML div placeholders
 *   that the MermaidExtension parseHTML will recognize
 * 
 * Uses base64 encoding for data-code attributes to avoid HTML escaping issues.
 */
export function preprocessMermaidContent(markdown) {
    if (!markdown) return markdown;

    // Pattern 1: ```mermaid ... ``` markdown code blocks
    const fencedPattern = /```mermaid\s*\n([\s\S]*?)```/gi;
    let result = markdown.replace(fencedPattern, (match, code) => {
        const encoded = encodeForAttr(code.trim());
        return `<div data-type="mermaid-diagram" data-code="${encoded}"></div>`;
    });

    // Pattern 2: <pre><code class="language-mermaid">...</code></pre> HTML blocks
    const htmlPrePattern = /<pre[^>]*>\s*<code[^>]*class="[^"]*language-mermaid[^"]*"[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi;
    result = result.replace(htmlPrePattern, (match, code) => {
        const decoded = code.trim()
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'");
        const encoded = encodeForAttr(decoded);
        return `<div data-type="mermaid-diagram" data-code="${encoded}"></div>`;
    });

    // Pattern 3: <pre><code>mermaidContent...</code></pre> without explicit class
    // Detects mermaid by keyword OR by syntax patterns
    const mermaidKeywords = ['mindmap', 'flowchart', 'graph ', 'graph\n', 'sequenceDiagram', 'classDiagram', 'stateDiagram', 'erDiagram', 'gantt', 'pie', 'journey', 'gitGraph', 'C4Context', 'sankey', 'block-beta', 'xychart-beta', 'timeline'];
    
    const mermaidSyntaxPatterns = [
        /-->/,
        /==>/,
        /-\.->/, 
        /-->>/,
        /\w+\s*--\s*\w+/,
        /\w+\[["'].*["']\]/,
        /\w+\(["'].*["']\)/,
        /\bparticipant\b/i,
        /\bactor\b/i,
        /\bsubgraph\b/i,
        /\bclassDef\b/,
        /\bnote\s+(left|right|over)\b/i,
        /^style\s+\w+\s+fill:/m,
    ];
    
    const htmlPreNoClassPattern = /<pre[^>]*>\s*<code[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi;
    result = result.replace(htmlPreNoClassPattern, (match, code) => {
        const decoded = code.trim()
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'");
        const startsWithKeyword = mermaidKeywords.some(kw => decoded.startsWith(kw));
        const hasMermaidSyntax = !startsWithKeyword && mermaidSyntaxPatterns.filter(p => p.test(decoded)).length >= 2;
        
        if (!startsWithKeyword && !hasMermaidSyntax) return match;
        const encoded = encodeForAttr(decoded);
        return `<div data-type="mermaid-diagram" data-code="${encoded}"></div>`;
    });

    // Pattern 4: Raw mermaid content (no code fence, no HTML)
    const trimmed = result.trim();
    const isRawMermaid = mermaidKeywords.some(kw => trimmed.startsWith(kw));
    
    if (isRawMermaid && !result.includes('data-type="mermaid-diagram"')) {
        const encoded = encodeForAttr(trimmed);
        result = `<div data-type="mermaid-diagram" data-code="${encoded}"></div>`;
    }

    return result;
}
