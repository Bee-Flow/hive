import React, { useState } from 'react';
import { ExternalLink, ChevronDown, ChevronRight, Lightbulb, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';

/**
 * ResearchRenderer — Renders structured deep research reports.
 * Triggered when a message contains a ```json-research code block.
 *
 * ═══════════════════════════════════════════════════════════════
 *  AGENT INSTRUCTIONS — Structured Research Output Format
 * ═══════════════════════════════════════════════════════════════
 *
 * To produce a rich visual report, output a fenced code block with
 * the language tag `json-research` containing a JSON object:
 *
 *   ```json-research
 *   { "title": "...", "blocks": [ ... ] }
 *   ```
 *
 * ── Root Object ──────────────────────────────────────────────
 *   title   (string)  Report title (shown if no hero block)
 *   blocks  (array)   Ordered list of block objects (see below)
 *
 * ── Block Types ──────────────────────────────────────────────
 *
 *  hero       Title banner with optional background image.
 *             Fields: title, subtitle?, image? (URL), date?
 *
 *  markdown   Rich text content (full Markdown supported).
 *  | text     Fields: content (Markdown string)
 *
 *  image      Standalone image with optional caption.
 *             Fields: src|url, alt?, caption?, credit?, height?, fit?
 *
 *  sources    Collapsible list of reference links.
 *             Fields: items[] → { url, title? }
 *
 *  callout    Highlighted info/warning/tip/success box.
 *             Fields: variant ("info"|"warning"|"success"|"tip"),
 *                     title?, content (text)
 *
 *  stats      Row of key metric cards (max 4 columns).
 *             Fields: items[] → { value, label, color? (CSS gradient) }
 *
 *  columns    Multi-column layout (max 3). Nests child blocks.
 *             Fields: columns? (number), children[] (block objects)
 *
 *  section    Titled wrapper that groups child blocks.
 *             Fields: title, children[]|blocks[] (block objects)
 *
 *  divider    Horizontal rule separator. No fields needed.
 *
 * ── Full Example ─────────────────────────────────────────────
 *
 *   ```json-research
 *   {
 *     "title": "AI in Healthcare: Risks & Opportunities",
 *     "blocks": [
 *       { "type": "hero", "title": "AI in Healthcare", "subtitle": "A comprehensive analysis", "date": "February 2026" },
 *       { "type": "stats", "items": [
 *         { "value": "78%", "label": "Adoption Rate" },
 *         { "value": "$45B", "label": "Market Size" },
 *         { "value": "2.3x", "label": "Efficiency Gain" }
 *       ]},
 *       { "type": "section", "title": "Key Findings", "children": [
 *         { "type": "markdown", "content": "## Diagnostic Accuracy\nAI models now match specialist-level accuracy in **radiology** and **pathology**." },
 *         { "type": "callout", "variant": "warning", "title": "Bias Risk", "content": "Training data imbalances can lead to misdiagnosis in underrepresented populations." }
 *       ]},
 *       { "type": "columns", "children": [
 *         { "type": "callout", "variant": "success", "title": "Benefits", "content": "Faster diagnosis, reduced costs, 24/7 availability" },
 *         { "type": "callout", "variant": "warning", "title": "Risks", "content": "Data privacy, algorithmic bias, over-reliance" }
 *       ]},
 *       { "type": "divider" },
 *       { "type": "sources", "items": [
 *         { "url": "https://example.com/study", "title": "WHO AI Health Report 2025" }
 *       ]}
 *     ]
 *   }
 *   ```
 *
 * ── Guidelines ───────────────────────────────────────────────
 *  • Start with a hero block for visual impact.
 *  • Use stats early to surface key numbers.
 *  • Group related content under section blocks.
 *  • Use callouts sparingly for warnings, tips, and highlights.
 *  • Always include a sources block at the end with reference URLs.
 *  • Use divider blocks between major sections for readability.
 *  • The markdown block supports full Markdown: headers, lists,
 *    bold, italic, code, tables, and links.
 *  • Keep the JSON valid — no trailing commas, no comments.
 * ═══════════════════════════════════════════════════════════════
 */
const ResearchRenderer = ({ data }) => {
    const [collapsedSources, setCollapsedSources] = useState(false);

    if (!data || !data.blocks) return null;

    const getFavicon = (url) => {
        try {
            const domain = new URL(url).hostname;
            return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
        } catch {
            return null;
        }
    };

    const getDomain = (url) => {
        try {
            return new URL(url).hostname.replace('www.', '');
        } catch {
            return url;
        }
    };

    const renderBlock = (block, index) => {
        if (!block || !block.type) return null;
        const key = block.id || `block-${index}`;

        switch (block.type) {
            // ====== HERO ======
            case 'hero':
                return (
                    <div key={key} style={{
                        position: 'relative',
                        borderRadius: '1rem',
                        overflow: 'hidden',
                        marginBottom: '1.5rem',
                        minHeight: block.image ? '200px' : 'auto',
                        background: block.image
                            ? 'transparent'
                            : 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)'
                    }}>
                        {block.image && (
                            <>
                                <img
                                    src={block.image}
                                    alt=""
                                    style={{
                                        width: '100%',
                                        height: '240px',
                                        objectFit: 'cover',
                                        display: 'block'
                                    }}
                                />
                                <div style={{
                                    position: 'absolute',
                                    inset: 0,
                                    background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.1) 100%)'
                                }} />
                            </>
                        )}
                        <div style={{
                            position: block.image ? 'absolute' : 'relative',
                            bottom: 0, left: 0, right: 0,
                            padding: '2rem',
                        }}>
                            <h1 style={{
                                fontSize: '1.75rem',
                                fontWeight: '800',
                                color: '#fff',
                                margin: 0,
                                lineHeight: 1.2,
                                textShadow: block.image ? '0 2px 8px rgba(0,0,0,0.5)' : 'none'
                            }}>
                                {block.title || data.title}
                            </h1>
                            {block.subtitle && (
                                <p style={{
                                    fontSize: '1rem',
                                    color: 'rgba(255,255,255,0.75)',
                                    margin: '0.5rem 0 0',
                                    fontWeight: '400',
                                    lineHeight: 1.5
                                }}>
                                    {block.subtitle}
                                </p>
                            )}
                            {block.date && (
                                <span style={{
                                    display: 'inline-block',
                                    marginTop: '0.75rem',
                                    fontSize: '0.75rem',
                                    color: 'rgba(255,255,255,0.5)',
                                    fontWeight: '500'
                                }}>
                                    {block.date}
                                </span>
                            )}
                        </div>
                    </div>
                );

            // ====== MARKDOWN ======
            case 'markdown':
            case 'text':
                return (
                    <div key={key} style={{ marginBottom: '1.25rem' }}>
                        <MarkdownRenderer content={block.content || block.text || ''} />
                    </div>
                );

            // ====== IMAGE ======
            case 'image':
                return (
                    <figure key={key} style={{ margin: '1.5rem 0' }}>
                        <img
                            src={block.src || block.url}
                            alt={block.alt || block.caption || ''}
                            style={{
                                width: '100%',
                                maxWidth: '100%',
                                height: block.height || 'auto',
                                objectFit: block.fit || 'cover',
                                borderRadius: '0.75rem',
                                boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                                display: 'block'
                            }}
                        />
                        {(block.caption || block.credit) && (
                            <figcaption style={{
                                marginTop: '0.5rem',
                                fontSize: '0.8rem',
                                color: 'var(--text-muted, #888)',
                                textAlign: 'center',
                                fontStyle: 'italic'
                            }}>
                                {block.caption}
                                {block.credit && (
                                    <span style={{ opacity: 0.7 }}> — {block.credit}</span>
                                )}
                            </figcaption>
                        )}
                    </figure>
                );

            // ====== SOURCES ======
            case 'sources':
                const sources = block.items || [];
                if (sources.length === 0) return null;
                return (
                    <div key={key} style={{ marginBottom: '1.25rem' }}>
                        <button
                            onClick={() => setCollapsedSources(!collapsedSources)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                                fontWeight: '600',
                                color: 'var(--text-primary, #fff)',
                                padding: '0.5rem 0',
                                marginBottom: '0.5rem'
                            }}
                        >
                            {collapsedSources
                                ? <ChevronRight className="w-4 h-4" />
                                : <ChevronDown className="w-4 h-4" />}
                            📚 Sources ({sources.length})
                        </button>
                        {!collapsedSources && (
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                                gap: '0.75rem'
                            }}>
                                {sources.map((src, i) => (
                                    <a
                                        key={i}
                                        href={src.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.75rem',
                                            padding: '0.75rem 1rem',
                                            borderRadius: '0.75rem',
                                            background: 'var(--bg-tertiary, rgba(255,255,255,0.05))',
                                            border: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
                                            textDecoration: 'none',
                                            transition: 'all 0.15s ease',
                                            cursor: 'pointer'
                                        }}
                                        onMouseEnter={e => {
                                            e.currentTarget.style.background = 'var(--bg-secondary, rgba(255,255,255,0.08))';
                                            e.currentTarget.style.borderColor = 'var(--accent-primary, #6366f1)';
                                            e.currentTarget.style.transform = 'translateY(-1px)';
                                        }}
                                        onMouseLeave={e => {
                                            e.currentTarget.style.background = 'var(--bg-tertiary, rgba(255,255,255,0.05))';
                                            e.currentTarget.style.borderColor = 'var(--border-subtle, rgba(255,255,255,0.1))';
                                            e.currentTarget.style.transform = 'translateY(0)';
                                        }}
                                    >
                                        {getFavicon(src.url) && (
                                            <img
                                                src={getFavicon(src.url)}
                                                alt=""
                                                style={{ width: 20, height: 20, borderRadius: 4, flexShrink: 0 }}
                                                onError={e => e.target.style.display = 'none'}
                                            />
                                        )}
                                        <div style={{ minWidth: 0, flex: 1 }}>
                                            <div style={{
                                                fontSize: '0.8rem',
                                                fontWeight: '500',
                                                color: 'var(--text-primary, #fff)',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap'
                                            }}>
                                                {src.title || getDomain(src.url)}
                                            </div>
                                            <div style={{
                                                fontSize: '0.7rem',
                                                color: 'var(--text-muted, #888)',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap'
                                            }}>
                                                {getDomain(src.url)}
                                            </div>
                                        </div>
                                        <ExternalLink style={{ width: 14, height: 14, color: 'var(--text-muted, #888)', flexShrink: 0 }} />
                                    </a>
                                ))}
                            </div>
                        )}
                    </div>
                );

            // ====== CALLOUT ======
            case 'callout':
                const calloutStyles = {
                    info: { bg: 'rgba(59, 130, 246, 0.1)', border: 'rgba(59, 130, 246, 0.3)', color: '#60a5fa', icon: <Info className="w-5 h-5" /> },
                    warning: { bg: 'rgba(245, 158, 11, 0.1)', border: 'rgba(245, 158, 11, 0.3)', color: '#fbbf24', icon: <AlertTriangle className="w-5 h-5" /> },
                    success: { bg: 'rgba(16, 185, 129, 0.1)', border: 'rgba(16, 185, 129, 0.3)', color: '#34d399', icon: <CheckCircle className="w-5 h-5" /> },
                    tip: { bg: 'rgba(139, 92, 246, 0.1)', border: 'rgba(139, 92, 246, 0.3)', color: '#a78bfa', icon: <Lightbulb className="w-5 h-5" /> }
                };
                const cs = calloutStyles[block.variant] || calloutStyles.info;
                return (
                    <div key={key} style={{
                        display: 'flex',
                        gap: '0.75rem',
                        padding: '1rem 1.25rem',
                        borderRadius: '0.75rem',
                        background: cs.bg,
                        border: `1px solid ${cs.border}`,
                        marginBottom: '1.25rem',
                        alignItems: 'flex-start'
                    }}>
                        <div style={{ color: cs.color, flexShrink: 0, marginTop: '2px' }}>
                            {cs.icon}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            {block.title && (
                                <div style={{
                                    fontWeight: '600',
                                    fontSize: '0.9rem',
                                    color: cs.color,
                                    marginBottom: '0.25rem'
                                }}>
                                    {block.title}
                                </div>
                            )}
                            <div style={{
                                fontSize: '0.85rem',
                                color: 'var(--text-secondary, #ccc)',
                                lineHeight: 1.6
                            }}>
                                {block.content || block.text}
                            </div>
                        </div>
                    </div>
                );

            // ====== STATS ======
            case 'stats':
                return (
                    <div key={key} style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(${Math.min(block.items?.length || 3, 4)}, 1fr)`,
                        gap: '0.75rem',
                        marginBottom: '1.5rem'
                    }}>
                        {(block.items || []).map((stat, i) => (
                            <div key={i} style={{
                                background: 'var(--bg-tertiary, rgba(255,255,255,0.05))',
                                borderRadius: '0.75rem',
                                padding: '1.25rem 1rem',
                                textAlign: 'center',
                                border: '1px solid var(--border-subtle, rgba(255,255,255,0.08))'
                            }}>
                                <div style={{
                                    fontSize: '1.5rem',
                                    fontWeight: '800',
                                    background: stat.color || 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                    lineHeight: 1.2
                                }}>
                                    {stat.value}
                                </div>
                                <div style={{
                                    fontSize: '0.75rem',
                                    color: 'var(--text-muted, #888)',
                                    marginTop: '0.35rem',
                                    fontWeight: '500',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px'
                                }}>
                                    {stat.label}
                                </div>
                            </div>
                        ))}
                    </div>
                );

            // ====== COLUMNS ======
            case 'columns':
                const colCount = block.columns || block.children?.length || 2;
                return (
                    <div key={key} style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(${Math.min(colCount, 3)}, 1fr)`,
                        gap: block.gap || '1.25rem',
                        marginBottom: '1.25rem'
                    }}>
                        {(block.children || []).map((child, i) => (
                            <div key={i}>{renderBlock(child, `${index}-col-${i}`)}</div>
                        ))}
                    </div>
                );

            // ====== DIVIDER ======
            case 'divider':
                return (
                    <hr key={key} style={{
                        border: 'none',
                        height: '1px',
                        background: 'linear-gradient(90deg, transparent, var(--border-subtle, rgba(255,255,255,0.15)), transparent)',
                        margin: '1.5rem 0'
                    }} />
                );

            // ====== SECTION (titled wrapper) ======
            case 'section':
                return (
                    <div key={key} style={{ marginBottom: '1.5rem' }}>
                        {block.title && (
                            <h2 style={{
                                fontSize: '1.25rem',
                                fontWeight: '700',
                                color: 'var(--text-primary, #fff)',
                                marginBottom: '1rem',
                                paddingBottom: '0.5rem',
                                borderBottom: '2px solid transparent',
                                borderImage: 'linear-gradient(90deg, #8b5cf6, #6366f1, transparent) 1'
                            }}>
                                {block.title}
                            </h2>
                        )}
                        {(block.children || block.blocks || []).map((child, i) => renderBlock(child, `${index}-sec-${i}`))}
                    </div>
                );

            default:
                // Fallback: if block has content, render as markdown
                if (block.content || block.text) {
                    return (
                        <div key={key} style={{ marginBottom: '1rem' }}>
                            <MarkdownRenderer content={block.content || block.text} />
                        </div>
                    );
                }
                return null;
        }
    };

    return (
        <div style={{
            width: '100%',
            maxWidth: '100%',
            overflow: 'hidden',
            whiteSpace: 'normal',
            fontFamily: 'var(--font-family, sans-serif)',
            margin: '0.5rem 0',
            borderRadius: '1rem',
            background: 'var(--bg-primary, #0a0a1a)',
            border: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
            padding: '1.5rem',
            boxSizing: 'border-box'
        }}>
            {/* If no hero block, show a simple title */}
            {data.title && !data.blocks.some(b => b.type === 'hero') && (
                <h1 style={{
                    fontSize: '1.5rem',
                    fontWeight: '800',
                    color: 'var(--text-primary, #fff)',
                    marginBottom: '1.5rem',
                    paddingBottom: '0.75rem',
                    borderBottom: '2px solid transparent',
                    borderImage: 'linear-gradient(90deg, #8b5cf6, #6366f1, transparent) 1'
                }}>
                    {data.title}
                </h1>
            )}

            {data.blocks.map((block, i) => renderBlock(block, i))}
        </div>
    );
};

export default ResearchRenderer;
