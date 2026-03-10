import React, { useState, useRef, useEffect } from 'react';
import { MISTRAL_MODEL_META, CAT_COLORS, getModelMeta } from '../utils/modelMeta.js';

const CAT_ICONS = {
    Generalist: '🧠',
    Reasoning: '💡',
    Coding: '⌨️',
    Vision: '👁️',
    Audio: '🎤',
    Embedding: '🔗',
    OCR: '📄',
    Moderation: '🛡️',
};

const CAT_TEXT_COLORS = {
    Generalist: '#60a5fa',
    Reasoning: '#c084fc',
    Coding: '#34d399',
    Vision: '#fbbf24',
    Audio: '#f472b6',
    Embedding: '#9ca3af',
    OCR: '#fb923c',
    Moderation: '#f87171',
};

export default function ModelSelector({ models, value, onChange, defaultLabel = 'Default (Recommended)', compact = false }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const ref = useRef(null);
    const searchRef = useRef(null);
    const panelRef = useRef(null);

    // Close on outside click
    useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        if (open) document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    // Focus search on open
    useEffect(() => {
        if (open && searchRef.current) {
            setTimeout(() => searchRef.current?.focus(), 50);
        }
    }, [open]);

    // Position panel to ensure it's visible
    useEffect(() => {
        if (open && panelRef.current && ref.current) {
            const panel = panelRef.current;
            const trigger = ref.current;
            const rect = trigger.getBoundingClientRect();
            const viewportHeight = window.innerHeight;
            const spaceBelow = viewportHeight - rect.bottom;
            const panelHeight = Math.min(460, viewportHeight * 0.7);

            if (spaceBelow < panelHeight && rect.top > panelHeight) {
                panel.style.bottom = '100%';
                panel.style.top = 'auto';
                panel.style.marginBottom = '4px';
            } else {
                panel.style.top = '100%';
                panel.style.bottom = 'auto';
                panel.style.marginTop = '4px';
            }
        }
    }, [open]);

    const selectedModel = models.find(m => m.id === value);
    const selectedMeta = selectedModel ? (MISTRAL_MODEL_META[selectedModel.id] || getModelMeta(selectedModel.id)) : null;

    const filtered = models.filter(m => {
        if (!search) return true;
        const q = search.toLowerCase();
        const meta = MISTRAL_MODEL_META[m.id] || getModelMeta(m.id);
        return (
            m.id.toLowerCase().includes(q) ||
            (m.displayName || m.name || '').toLowerCase().includes(q) ||
            (meta?.desc || '').toLowerCase().includes(q) ||
            (meta?.cat || '').toLowerCase().includes(q)
        );
    });

    // Group by category
    const grouped = {};
    filtered.forEach(m => {
        const meta = MISTRAL_MODEL_META[m.id] || getModelMeta(m.id);
        const cat = meta?.cat || 'Other';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(m);
    });

    const handleSelect = (modelId) => {
        onChange(modelId);
        setOpen(false);
        setSearch('');
    };

    const formatPrice = (meta) => {
        if (!meta) return null;
        if (meta.price) return meta.price;
        if (meta.input !== undefined && meta.output !== undefined) {
            return `$${meta.input} / $${meta.output}`;
        }
        if (meta.input !== undefined) return `$${meta.input}/M`;
        return null;
    };

    return (
        <div ref={ref} style={{ position: 'relative' }}>
            {/* Trigger Button */}
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="w-full text-left transition-all"
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: compact ? '8px 12px' : '10px 14px',
                    borderRadius: '12px',
                    border: '1px solid',
                    borderColor: open ? 'var(--accent-primary)' : 'var(--border-default)',
                    background: 'var(--bg-tertiary)',
                    cursor: 'pointer',
                    minHeight: compact ? '40px' : '48px',
                    boxShadow: open ? '0 0 0 2px rgba(99, 102, 241, 0.15)' : 'none',
                }}
            >
                {selectedModel ? (
                    <>
                        <div style={{
                            width: '32px', height: '32px', borderRadius: '8px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '16px', flexShrink: 0,
                            background: CAT_COLORS[selectedMeta?.cat] || 'rgba(107, 114, 128, 0.15)',
                        }}>
                            {CAT_ICONS[selectedMeta?.cat] || '⚙️'}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {selectedModel.displayName || selectedModel.name}
                            </div>
                            {!compact && selectedMeta?.desc && (
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {selectedMeta.desc}
                                </div>
                            )}
                        </div>
                        {selectedMeta?.cat && (
                            <span style={{
                                fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '6px',
                                background: CAT_COLORS[selectedMeta.cat] || 'rgba(107, 114, 128, 0.15)',
                                color: CAT_TEXT_COLORS[selectedMeta.cat] || '#9ca3af',
                                whiteSpace: 'nowrap', flexShrink: 0,
                            }}>
                                {selectedMeta.cat}
                            </span>
                        )}
                    </>
                ) : (
                    <>
                        <div style={{
                            width: '32px', height: '32px', borderRadius: '8px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '16px', flexShrink: 0,
                            background: 'rgba(107, 114, 128, 0.1)',
                        }}>✨</div>
                        <div style={{ flex: 1, fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                            {defaultLabel}
                        </div>
                    </>
                )}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                    <polyline points="6 9 12 15 18 9" />
                </svg>
            </button>

            {/* Dropdown Panel */}
            {open && (
                <div
                    ref={panelRef}
                    style={{
                        position: 'absolute',
                        left: 0, right: 0,
                        zIndex: 50,
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-default)',
                        borderRadius: '14px',
                        boxShadow: '0 20px 50px -10px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255,255,255,0.05)',
                        overflow: 'hidden',
                        animation: 'modelSelectorFadeIn 0.15s ease-out',
                    }}
                >
                    {/* Search */}
                    <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
                        <div style={{ position: 'relative' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                            </svg>
                            <input
                                ref={searchRef}
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search models..."
                                style={{
                                    width: '100%', padding: '8px 10px 8px 32px', borderRadius: '8px',
                                    border: '1px solid var(--border-subtle)', background: 'var(--bg-primary)',
                                    color: 'var(--text-primary)', fontSize: '13px', outline: 'none',
                                    boxSizing: 'border-box',
                                }}
                            />
                        </div>
                    </div>

                    {/* Default option */}
                    <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
                        <button
                            type="button"
                            onClick={() => handleSelect('')}
                            style={{
                                width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                                padding: '10px 14px', border: 'none', cursor: 'pointer', textAlign: 'left',
                                background: value === '' ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                                borderLeft: value === '' ? '3px solid var(--accent-primary)' : '3px solid transparent',
                                transition: 'background 0.15s',
                            }}
                            onMouseEnter={e => { if (value !== '') e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                            onMouseLeave={e => { if (value !== '') e.currentTarget.style.background = 'transparent'; }}
                        >
                            <div style={{
                                width: '36px', height: '36px', borderRadius: '10px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '18px', background: 'rgba(107, 114, 128, 0.1)', flexShrink: 0,
                            }}>✨</div>
                            <div>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{defaultLabel}</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Uses the system default model</div>
                            </div>
                        </button>

                        {/* Model cards grouped by category */}
                        {Object.entries(grouped).map(([cat, catModels]) => (
                            <div key={cat}>
                                <div style={{
                                    padding: '6px 14px', fontSize: '10px', fontWeight: 700,
                                    textTransform: 'uppercase', letterSpacing: '0.08em',
                                    color: CAT_TEXT_COLORS[cat] || 'var(--text-muted)',
                                    background: 'var(--bg-primary)',
                                    borderTop: '1px solid var(--border-subtle)',
                                    borderBottom: '1px solid var(--border-subtle)',
                                    display: 'flex', alignItems: 'center', gap: '6px',
                                }}>
                                    <span>{CAT_ICONS[cat] || '⚙️'}</span>
                                    {cat}
                                </div>
                                {catModels.map(m => {
                                    const meta = MISTRAL_MODEL_META[m.id] || getModelMeta(m.id);
                                    const isSelected = value === m.id;
                                    const price = formatPrice(meta);
                                    return (
                                        <button
                                            key={m.id}
                                            type="button"
                                            onClick={() => handleSelect(m.id)}
                                            style={{
                                                width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                                                padding: '10px 14px', border: 'none', cursor: 'pointer', textAlign: 'left',
                                                background: isSelected ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                                                borderLeft: isSelected ? '3px solid var(--accent-primary)' : '3px solid transparent',
                                                transition: 'background 0.15s',
                                            }}
                                            onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                                            onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                                        >
                                            <div style={{
                                                width: '36px', height: '36px', borderRadius: '10px',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '16px', flexShrink: 0,
                                                background: CAT_COLORS[meta?.cat] || 'rgba(107, 114, 128, 0.1)',
                                            }}>
                                                {CAT_ICONS[meta?.cat] || '⚙️'}
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{
                                                    fontSize: '13px', fontWeight: 600,
                                                    color: isSelected ? 'var(--accent-primary)' : 'var(--text-primary)',
                                                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                                }}>
                                                    {m.displayName || m.name || m.id}
                                                </div>
                                                {meta?.desc && (
                                                    <div style={{
                                                        fontSize: '11px', color: 'var(--text-muted)',
                                                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                                    }}>
                                                        {meta.desc}
                                                    </div>
                                                )}
                                            </div>
                                            {price && (
                                                <span style={{
                                                    fontSize: '10px', fontWeight: 600, padding: '2px 6px',
                                                    borderRadius: '6px', whiteSpace: 'nowrap', flexShrink: 0,
                                                    background: 'rgba(16, 185, 129, 0.1)', color: '#34d399',
                                                }}>
                                                    {price}
                                                </span>
                                            )}
                                            {isSelected && (
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ color: 'var(--accent-primary)', flexShrink: 0 }}>
                                                    <polyline points="20 6 9 17 4 12" />
                                                </svg>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        ))}

                        {filtered.length === 0 && search && (
                            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                                No models matching "{search}"
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Animation keyframes (injected once) */}
            <style>{`
                @keyframes modelSelectorFadeIn {
                    from { opacity: 0; transform: translateY(-4px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}
