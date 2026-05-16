/**
 * MermaidBlock — Premium React component for rendering Mermaid diagrams.
 *
 * Features:
 * - Calm blue-teal theme aligned with Studio
 * - SVG post-processing: drop-shadows, rounded corners, glow effects
 * - Glassmorphism container with animated loading skeleton
 * - Fullscreen modal for large diagrams
 * - Smooth fade-in animation on render
 * - SVG export for PDF/Word
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import mermaid from 'mermaid';
import { Code, Eye, Maximize2, Minimize2, X, Download, Copy, Check, Loader2 } from 'lucide-react';

let blockCounter = 0;

/* ── Premium Theme Configuration ──────────────────────── */
const MERMAID_CONFIG = {
    startOnLoad: false,
    theme: 'base',
    themeVariables: {
        darkMode: false,
        background: '#ffffff',

        // Core palette — calm blue-teal (Studio-aligned)
        primaryColor: '#eff6ff',
        primaryTextColor: '#1e3a8a',
        primaryBorderColor: '#3b82f6',

        secondaryColor: '#ecfdf5',
        secondaryTextColor: '#064e3b',
        secondaryBorderColor: '#34d399',

        tertiaryColor: '#f0fdf4',
        tertiaryTextColor: '#14532d',
        tertiaryBorderColor: '#86efac',

        // Edges & labels
        lineColor: '#3b82f6',
        textColor: '#1e293b',
        edgeLabelBackground: '#ffffff',

        // Flowchart nodes
        mainBkg: '#eff6ff',
        nodeBorder: '#3b82f6',
        nodeTextColor: '#1e3a8a',

        // Clusters / subgraphs
        clusterBkg: '#f0f9ff',
        clusterBorder: '#7dd3fc',

        // Title
        titleColor: '#1e3a8a',

        // Sequence diagram
        actorTextColor: '#1e3a8a',
        actorBorder: '#3b82f6',
        actorBkg: '#eff6ff',
        signalColor: '#1d4ed8',
        labelBoxBkgColor: '#eff6ff',

        // Notes
        noteBkgColor: '#fffbeb',
        noteTextColor: '#78350f',
        noteBorderColor: '#f59e0b',

        // Misc
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        fontSize: '15px',
    },
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    fontSize: 15,
    flowchart: {
        htmlLabels: true,
        curve: 'basis',
        padding: 18,
        nodeSpacing: 50,
        rankSpacing: 60,
        diagramPadding: 16,
    },
    sequence: {
        diagramMarginX: 20,
        diagramMarginY: 16,
        actorMargin: 60,
        messageMargin: 40,
        boxMargin: 8,
        boxTextMargin: 6,
        noteMargin: 12,
        mirrorActors: false,
    },
    mindmap: { padding: 20 },
    gantt: { fontSize: 13 },
};

/* ── SVG Post-Processing ──────────────────────────────── */
function postProcessSVG(svgElement) {
    if (!svgElement) return;

    // Style: max-width responsive
    svgElement.style.maxWidth = '100%';
    svgElement.style.height = 'auto';

    // Add drop-shadow filter definition to SVG
    let defs = svgElement.querySelector('defs');
    if (!defs) {
        defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        svgElement.prepend(defs);
    }

    // Premium drop-shadow filter
    if (!defs.querySelector('#premium-shadow')) {
        const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
        filter.setAttribute('id', 'premium-shadow');
        filter.setAttribute('x', '-10%');
        filter.setAttribute('y', '-10%');
        filter.setAttribute('width', '130%');
        filter.setAttribute('height', '140%');
        filter.innerHTML = `
            <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="rgba(59, 130, 246, 0.15)" flood-opacity="1"/>
        `;
        defs.appendChild(filter);
    }

    // Subtle glow filter for highlighted elements
    if (!defs.querySelector('#node-glow')) {
        const glow = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
        glow.setAttribute('id', 'node-glow');
        glow.setAttribute('x', '-20%');
        glow.setAttribute('y', '-20%');
        glow.setAttribute('width', '150%');
        glow.setAttribute('height', '150%');
        glow.innerHTML = `
            <feGaussianBlur stdDeviation="2" result="blur"/>
            <feMerge>
                <feMergeNode in="blur"/>
                <feMergeNode in="SourceGraphic"/>
            </feMerge>
        `;
        defs.appendChild(glow);
    }

    // Apply shadows and rounded corners to nodes
    const nodeRects = svgElement.querySelectorAll('.node rect, .node polygon, .node circle, .node ellipse');
    nodeRects.forEach(el => {
        el.style.filter = 'url(#premium-shadow)';
        if (el.tagName === 'rect') {
            // Soft rounded corners
            if (!el.getAttribute('rx') || parseFloat(el.getAttribute('rx')) < 6) {
                el.setAttribute('rx', '8');
                el.setAttribute('ry', '8');
            }
        }
    });

    // Style cluster/subgraph backgrounds
    const clusterRects = svgElement.querySelectorAll('.cluster rect');
    clusterRects.forEach(el => {
        el.setAttribute('rx', '12');
        el.setAttribute('ry', '12');
        el.style.filter = 'url(#premium-shadow)';
    });

    // Thicker, smoother edge lines
    const edges = svgElement.querySelectorAll('.edge-pattern, .flowchart-link, path.path');
    edges.forEach(el => {
        const currentStrokeWidth = el.getAttribute('stroke-width');
        if (!currentStrokeWidth || parseFloat(currentStrokeWidth) < 1.8) {
            el.setAttribute('stroke-width', '1.8');
        }
    });

    // Better arrowhead markers
    const markers = svgElement.querySelectorAll('marker polygon, marker path');
    markers.forEach(el => {
        if (!el.style.fill || el.style.fill === '#333') {
            el.style.fill = '#3b82f6';
        }
    });

    // Enhance edge labels
    const edgeLabels = svgElement.querySelectorAll('.edgeLabel rect, .labelBkg');
    edgeLabels.forEach(el => {
        el.setAttribute('rx', '6');
        el.setAttribute('ry', '6');
    });

    // Actor styling for sequence diagrams
    const actors = svgElement.querySelectorAll('.actor');
    actors.forEach(el => {
        if (el.tagName === 'rect') {
            el.setAttribute('rx', '10');
            el.setAttribute('ry', '10');
            el.style.filter = 'url(#premium-shadow)';
        }
    });

    // Note styling for sequence diagrams
    const notes = svgElement.querySelectorAll('.note rect');
    notes.forEach(el => {
        el.setAttribute('rx', '8');
        el.setAttribute('ry', '8');
    });
}

/* ── Export helpers ────────────────────────────────────── */

/**
 * Render mermaid code to SVG string (for export).
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
            ctx.fillStyle = '#ffffff';
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

/* ── Main Component ───────────────────────────────────── */

export default function MermaidBlock({ code, onCodeChange, editable = true }) {
    const [showCode, setShowCode] = useState(false);
    const [error, setError] = useState(null);
    const [ready, setReady] = useState(false);
    const [hovered, setHovered] = useState(false);
    const [copied, setCopied] = useState(false);
    const [fullscreen, setFullscreen] = useState(false);
    const containerRef = useRef(null);
    const fullscreenContainerRef = useRef(null);
    const idRef = useRef(`mermaid-block-${Date.now()}-${blockCounter++}`);
    const textareaRef = useRef(null);

    // Render the mermaid diagram
    useEffect(() => {
        if (!containerRef.current || !code?.trim() || showCode) return;

        mermaid.initialize(MERMAID_CONFIG);
        setError(null);
        setReady(false);

        const id = idRef.current;

        let cancelled = false;
        const renderDiagram = async () => {
            try {
                const renderId = `${id}-${Date.now()}`;
                // Race mermaid.render against a 5 s timeout — pathological inputs
                // can hang the editor's main thread otherwise.
                const result = await Promise.race([
                    mermaid.render(renderId, code.trim()),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Mermaid render timed out after 5 s')), 5000)),
                ]);
                if (cancelled) return;
                const { svg } = result;
                if (containerRef.current) {
                    containerRef.current.innerHTML = svg;
                    const svgEl = containerRef.current.querySelector('svg');
                    if (svgEl) {
                        postProcessSVG(svgEl);
                    }
                    setReady(true);
                }
            } catch (err) {
                if (cancelled) return;
                console.error('[MermaidBlock] Render error:', err);
                setError(err.message || 'Failed to render diagram');
                const errorEl = document.getElementById('d' + id);
                if (errorEl) errorEl.remove();
            }
        };

        renderDiagram();

        return () => {
            cancelled = true;
            if (containerRef.current) {
                containerRef.current.innerHTML = '';
            }
        };
    }, [code, showCode]);

    // Render fullscreen version
    useEffect(() => {
        if (!fullscreen || !fullscreenContainerRef.current || !code?.trim()) return;

        mermaid.initialize({ ...MERMAID_CONFIG, fontSize: 18 });

        const renderFullscreen = async () => {
            try {
                const renderId = `mermaid-fs-${Date.now()}-${blockCounter++}`;
                const { svg } = await mermaid.render(renderId, code.trim());
                if (fullscreenContainerRef.current) {
                    fullscreenContainerRef.current.innerHTML = svg;
                    const svgEl = fullscreenContainerRef.current.querySelector('svg');
                    if (svgEl) {
                        postProcessSVG(svgEl);
                        svgEl.style.maxHeight = '85vh';
                    }
                }
            } catch (err) {
                console.error('[MermaidBlock] Fullscreen render error:', err);
            }
        };

        renderFullscreen();

        return () => {
            if (fullscreenContainerRef.current) {
                fullscreenContainerRef.current.innerHTML = '';
            }
        };
    }, [fullscreen, code]);

    // Close fullscreen on Escape
    useEffect(() => {
        if (!fullscreen) return;
        const handleKey = (e) => { if (e.key === 'Escape') setFullscreen(false); };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [fullscreen]);

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

    /* ── Toolbar button helper ── */
    const ToolbarBtn = ({ onClick, title, active, children }) => (
        <button
            onClick={onClick}
            title={title}
            className="mermaid-toolbar-btn"
            style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                padding: '4px 10px', borderRadius: '20px',
                background: active
                    ? 'rgba(59, 130, 246, 0.18)'
                    : 'rgba(255, 255, 255, 0.6)',
                border: `1px solid ${active ? 'rgba(59, 130, 246, 0.3)' : 'rgba(0, 0, 0, 0.06)'}`,
                color: active ? '#1d4ed8' : '#64748b',
                cursor: 'pointer', fontSize: '11px', fontWeight: 600,
                transition: 'all 0.2s ease',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
            }}
        >
            {children}
        </button>
    );

    return (
        <>
            <div
                className="notebook-mermaid-block"
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                contentEditable={false}
            >
                {/* ── Glassmorphism Header ── */}
                <div className="mermaid-block-header">
                    <span className="mermaid-block-title">
                        <span className="mermaid-block-icon">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 3v18h18" /><path d="M18 17V9" /><path d="M13 17V5" /><path d="M8 17v-3" />
                            </svg>
                        </span>
                        Diagram
                    </span>

                    <div className="mermaid-toolbar">
                        <ToolbarBtn onClick={() => setShowCode(!showCode)} title={showCode ? 'Show diagram' : 'Show code'} active={showCode}>
                            {showCode ? <><Eye size={12} /> Preview</> : <><Code size={12} /> Code</>}
                        </ToolbarBtn>

                        <ToolbarBtn onClick={handleCopy} title="Copy code" active={copied}>
                            {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /></>}
                        </ToolbarBtn>

                        {!showCode && (
                            <>
                                <ToolbarBtn onClick={handleDownloadSVG} title="Download SVG">
                                    <Download size={12} />
                                </ToolbarBtn>
                                <ToolbarBtn onClick={() => setFullscreen(true)} title="Fullscreen">
                                    <Maximize2 size={12} />
                                </ToolbarBtn>
                            </>
                        )}
                    </div>
                </div>

                {/* ── Code Editor ── */}
                {showCode ? (
                    <div style={{ padding: '14px 16px' }}>
                        <textarea
                            ref={textareaRef}
                            value={code || ''}
                            onChange={e => onCodeChange?.(e.target.value)}
                            readOnly={!editable}
                            spellCheck={false}
                            className="mermaid-code-editor"
                        />
                    </div>
                ) : (
                    /* ── Diagram Render Area ── */
                    <div className="mermaid-diagram-area">
                        {error ? (
                            <div className="mermaid-error">
                                <div style={{ fontWeight: 600, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ fontSize: '14px' }}>⚠️</span> Diagram Error
                                </div>
                                <div style={{ opacity: 0.8, fontFamily: "'Fira Code', monospace", fontSize: '11px', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                                    {error}
                                </div>
                                <button onClick={() => setShowCode(true)} className="mermaid-error-btn">
                                    Edit Code
                                </button>
                            </div>
                        ) : (
                            <>
                                {/* Loading skeleton */}
                                {!ready && (
                                    <div className="mermaid-skeleton">
                                        <Loader2 size={20} className="mermaid-skeleton-spinner" style={{ animation: 'spin 1s linear infinite', color: 'var(--accent-primary)' }} />
                                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>Rendering diagram…</span>
                                    </div>
                                )}
                                <div
                                    ref={containerRef}
                                    className="mermaid-svg-container"
                                    style={{
                                        opacity: ready ? 1 : 0,
                                        transform: ready ? 'translateY(0)' : 'translateY(4px)',
                                        transition: 'opacity 0.4s ease, transform 0.4s ease',
                                    }}
                                />
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* ── Fullscreen Modal ── */}
            {fullscreen && (
                <div className="mermaid-fullscreen-overlay" onClick={() => setFullscreen(false)}>
                    <div className="mermaid-fullscreen-modal" onClick={e => e.stopPropagation()}>
                        <div className="mermaid-fullscreen-header">
                            <span className="mermaid-block-title" style={{ color: '#f8fafc' }}>
                                <span className="mermaid-block-icon" style={{ background: 'rgba(59,130,246,0.3)', color: '#93c5fd' }}>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M3 3v18h18" /><path d="M18 17V9" /><path d="M13 17V5" /><path d="M8 17v-3" />
                                    </svg>
                                </span>
                                Diagram — Fullscreen
                            </span>
                            <div style={{ display: 'flex', gap: '6px' }}>
                                <button
                                    onClick={handleDownloadSVG}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '5px',
                                        padding: '6px 14px', borderRadius: '20px',
                                        background: 'rgba(255,255,255,0.08)',
                                        border: '1px solid rgba(255,255,255,0.12)',
                                        color: '#cbd5e1', cursor: 'pointer', fontSize: '12px', fontWeight: 500,
                                    }}
                                >
                                    <Download size={13} /> SVG
                                </button>
                                <button
                                    onClick={() => setFullscreen(false)}
                                    style={{
                                        display: 'flex', alignItems: 'center',
                                        padding: '6px 8px', borderRadius: '10px',
                                        background: 'rgba(255,255,255,0.08)',
                                        border: '1px solid rgba(255,255,255,0.12)',
                                        color: '#cbd5e1', cursor: 'pointer',
                                    }}
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>
                        <div className="mermaid-fullscreen-content">
                            <div
                                ref={fullscreenContainerRef}
                                style={{
                                    width: '100%',
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    minHeight: '300px',
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
