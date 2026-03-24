/**
 * MermaidBlock — A React component for rendering Mermaid diagrams inside TipTap code blocks.
 * Shows the rendered diagram with a toggle to view/edit the raw code.
 * Supports SVG export for PDF/Word.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import mermaid from 'mermaid';
import { Code, Eye, Maximize2, X, Download, Copy, Check } from 'lucide-react';

let blockCounter = 0;

const MERMAID_CONFIG = {
    startOnLoad: false,
    theme: 'dark',
    themeVariables: {
        darkMode: true,
        background: '#1e1e2e',
        primaryColor: '#818cf8',
        primaryTextColor: '#e2e8f0',
        primaryBorderColor: '#6366f1',
        secondaryColor: '#a78bfa',
        secondaryTextColor: '#e2e8f0',
        secondaryBorderColor: '#7c3aed',
        tertiaryColor: '#2a2a3e',
        tertiaryTextColor: '#e2e8f0',
        tertiaryBorderColor: '#3a3a4e',
        lineColor: '#94a3b8',
        textColor: '#e2e8f0',
        mainBkg: '#2a2a3e',
        nodeBorder: '#6366f1',
        clusterBkg: '#1e1e2e',
        clusterBorder: '#3a3a4e',
        titleColor: '#e2e8f0',
        edgeLabelBackground: '#1e1e2e',
        nodeTextColor: '#e2e8f0',
    },
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: 14,
    flowchart: { htmlLabels: true, curve: 'basis', padding: 15 },
    mindmap: { padding: 20 },
};

/**
 * Render mermaid code to SVG string (for export).
 * Returns the SVG string or null on failure.
 */
export async function renderMermaidToSVG(code) {
    try {
        mermaid.initialize({ ...MERMAID_CONFIG, fontSize: 16 });
        const id = `mermaid-export-${Date.now()}-${blockCounter++}`;
        const { svg } = await mermaid.render(id, code.trim());
        return svg;
    } catch (err) {
        console.error('[MermaidBlock] Export render error:', err);
        return null;
    }
}

/**
 * Convert SVG string to a PNG data URL for export embedding.
 */
export function svgToPngDataUrl(svgString, width = 1200) {
    return new Promise((resolve) => {
        const img = new Image();
        const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);

        img.onload = () => {
            const canvas = document.createElement('canvas');
            const scale = width / img.width;
            canvas.width = width;
            canvas.height = img.height * scale;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#1e1e2e';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(url);
            resolve(canvas.toDataURL('image/png'));
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            resolve(null);
        };

        img.src = url;
    });
}

export default function MermaidBlock({ code, onCodeChange, editable = true }) {
    const [showCode, setShowCode] = useState(false);
    const [error, setError] = useState(null);
    const [ready, setReady] = useState(false);
    const [hovered, setHovered] = useState(false);
    const [copied, setCopied] = useState(false);
    const containerRef = useRef(null);
    const idRef = useRef(`mermaid-block-${Date.now()}-${blockCounter++}`);
    const textareaRef = useRef(null);

    // Render the mermaid diagram
    useEffect(() => {
        if (!containerRef.current || !code?.trim() || showCode) return;

        mermaid.initialize(MERMAID_CONFIG);
        setError(null);
        setReady(false);

        const id = idRef.current;

        const renderDiagram = async () => {
            try {
                // Need a fresh unique ID each render
                const renderId = `${id}-${Date.now()}`;
                const { svg } = await mermaid.render(renderId, code.trim());
                if (containerRef.current) {
                    containerRef.current.innerHTML = svg;
                    const svgEl = containerRef.current.querySelector('svg');
                    if (svgEl) {
                        svgEl.style.maxWidth = '100%';
                        svgEl.style.height = 'auto';
                    }
                    setReady(true);
                }
            } catch (err) {
                console.error('[MermaidBlock] Render error:', err);
                setError(err.message || 'Failed to render diagram');
                // Clean up error elements
                const errorEl = document.getElementById('d' + id);
                if (errorEl) errorEl.remove();
            }
        };

        renderDiagram();

        return () => {
            if (containerRef.current) {
                containerRef.current.innerHTML = '';
            }
        };
    }, [code, showCode]);

    const handleCopy = useCallback(() => {
        navigator.clipboard.writeText(code || '');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, [code]);

    const handleDownloadSVG = useCallback(() => {
        const svgEl = containerRef.current?.querySelector('svg');
        if (!svgEl) return;
        const svgData = new XMLSerializer().serializeToString(svgEl);
        const blob = new Blob([svgData], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'diagram.svg';
        a.click();
        URL.revokeObjectURL(url);
    }, []);

    return (
        <div
            className="notebook-mermaid-block"
            style={{
                margin: '12px 0',
                borderRadius: '12px',
                border: '1px solid var(--border-subtle, #2a2a3e)',
                background: 'var(--bg-tertiary, #1e1e2e)',
                overflow: 'hidden',
            }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            contentEditable={false}
        >
            {/* ── Header toolbar ── */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 10px',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    background: 'rgba(255,255,255,0.03)',
                }}
            >
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted, #888)', flex: 1, display: 'flex', alignItems: 'center', gap: '5px' }}>
                    📊 Mermaid Diagram
                </span>

                <button
                    onClick={() => setShowCode(!showCode)}
                    title={showCode ? 'Show diagram' : 'Show code'}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '4px',
                        padding: '3px 8px', borderRadius: '6px',
                        background: showCode ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255,255,255,0.06)',
                        border: 'none',
                        color: showCode ? '#818cf8' : 'var(--text-muted, #888)',
                        cursor: 'pointer', fontSize: '10px', fontWeight: 600,
                        transition: 'all 0.15s',
                    }}
                >
                    {showCode ? <><Eye size={11} /> Diagram</> : <><Code size={11} /> Code</>}
                </button>

                <button
                    onClick={handleCopy}
                    title="Copy code"
                    style={{
                        display: 'flex', alignItems: 'center', gap: '4px',
                        padding: '3px 8px', borderRadius: '6px',
                        background: 'rgba(255,255,255,0.06)',
                        border: 'none',
                        color: copied ? '#22c55e' : 'var(--text-muted, #888)',
                        cursor: 'pointer', fontSize: '10px', fontWeight: 600,
                        transition: 'all 0.15s',
                    }}
                >
                    {copied ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
                </button>

                {!showCode && (
                    <button
                        onClick={handleDownloadSVG}
                        title="Download SVG"
                        style={{
                            display: 'flex', alignItems: 'center', gap: '4px',
                            padding: '3px 8px', borderRadius: '6px',
                            background: 'rgba(255,255,255,0.06)',
                            border: 'none',
                            color: 'var(--text-muted, #888)',
                            cursor: 'pointer', fontSize: '10px', fontWeight: 600,
                            transition: 'all 0.15s',
                        }}
                    >
                        <Download size={11} /> SVG
                    </button>
                )}
            </div>

            {/* ── Code view ── */}
            {showCode ? (
                <div style={{ padding: '12px 16px' }}>
                    <textarea
                        ref={textareaRef}
                        value={code || ''}
                        onChange={e => onCodeChange?.(e.target.value)}
                        readOnly={!editable}
                        spellCheck={false}
                        style={{
                            width: '100%',
                            minHeight: '120px',
                            background: 'rgba(0,0,0,0.2)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '8px',
                            padding: '10px 12px',
                            color: '#e2e8f0',
                            fontFamily: "'Fira Code', 'Monaco', monospace",
                            fontSize: '12px',
                            lineHeight: '1.5',
                            resize: 'vertical',
                            outline: 'none',
                        }}
                    />
                </div>
            ) : (
                /* ── Diagram view ── */
                <div style={{ padding: '16px', textAlign: 'center' }}>
                    {error ? (
                        <div style={{
                            padding: '12px 16px',
                            borderRadius: '8px',
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            color: '#f87171',
                            fontSize: '12px',
                            textAlign: 'left',
                        }}>
                            <div style={{ fontWeight: 600, marginBottom: '4px' }}>⚠️ Diagram Error</div>
                            <div style={{ opacity: 0.8, fontFamily: 'monospace', fontSize: '11px', whiteSpace: 'pre-wrap' }}>{error}</div>
                            <button
                                onClick={() => setShowCode(true)}
                                style={{
                                    marginTop: '8px', padding: '4px 12px', borderRadius: '6px',
                                    background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.3)',
                                    color: '#818cf8', cursor: 'pointer', fontSize: '11px', fontWeight: 600,
                                }}
                            >
                                Edit Code
                            </button>
                        </div>
                    ) : (
                        <div
                            ref={containerRef}
                            style={{
                                width: '100%',
                                minHeight: '80px',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                opacity: ready ? 1 : 0.3,
                                transition: 'opacity 0.3s ease',
                            }}
                        />
                    )}
                </div>
            )}
        </div>
    );
}
