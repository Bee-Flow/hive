import React, { useState, useRef, useEffect } from 'react';

const TIER_META = {
    auto: { icon: '🔀', label: 'Auto', desc: 'Optimal choice', color: '#6366f1' },
    fast: { icon: '⚡', label: 'Fast', desc: 'Quick answers', color: '#10b981' },
    thinking: { icon: '🧠', label: 'Think', desc: 'Complex problems', color: '#8b5cf6' },
    writer: { icon: '✍️', label: 'Write', desc: 'Long-form content', color: '#ec4899' },
    pro: { icon: '✨', label: 'Deep Thinking', desc: 'Advanced reasoning', color: '#f59e0b' }
};

const ModelTierSelector = ({ tiers = {}, value = 'fast', onChange, dropDirection = 'up' }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const current = TIER_META[value] || TIER_META.fast;
    const tierKeys = Object.keys(TIER_META);

    return (
        <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
            {/* Compact pill trigger */}
            <button
                onClick={() => setOpen(!open)}
                style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '8px 12px', borderRadius: '8px',
                    background: 'var(--bg-secondary)', border: '1px solid var(--border-default)',
                    color: 'var(--text-primary)', cursor: 'pointer',
                    fontSize: '13px', fontWeight: 500, transition: 'all 0.15s',
                    whiteSpace: 'nowrap',
                    height: '36px'
                }}
                title="Select model tier"
            >
                <span>{current.icon}</span>
                <span>{current.label}</span>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ opacity: 0.5 }}>
                    <path d="M2 4L5 7L8 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </button>

            {/* Dropdown panel */}
            {open && (
                <div style={{
                    position: 'absolute',
                    ...(dropDirection === 'down'
                        ? { top: '100%', marginTop: '6px' }
                        : { bottom: '100%', marginBottom: '6px' }),
                    right: 0, left: 0, minWidth: '220px',
                    background: 'var(--bg-secondary)', border: '1px solid var(--border-default)',
                    borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                    overflow: 'hidden', zIndex: 100
                }}>


                    {tierKeys.map(key => {
                        const meta = TIER_META[key];
                        const tierConfig = tiers[key] || {};
                        const isSelected = value === key;
                        const isConfigured = key === 'auto' || !!tierConfig.modelId;

                        return (
                            <button
                                key={key}
                                onClick={() => { onChange(key); setOpen(false); }}
                                disabled={!isConfigured}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '10px',
                                    width: '100%', padding: '10px 12px',
                                    background: isSelected ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                                    border: 'none', cursor: isConfigured ? 'pointer' : 'default',
                                    color: isConfigured ? 'var(--text-primary)' : 'var(--text-muted)',
                                    textAlign: 'left', transition: 'background 0.1s',
                                    opacity: isConfigured ? 1 : 0.4
                                }}
                                onMouseEnter={e => { if (isConfigured && !isSelected) e.target.style.background = 'var(--bg-tertiary)'; }}
                                onMouseLeave={e => { if (!isSelected) e.target.style.background = 'transparent'; }}
                            >
                                <span style={{ fontSize: '18px', width: '24px', textAlign: 'center' }}>{meta.icon}</span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '13px', fontWeight: 600 }}>{meta.label}</div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                        {isConfigured ? meta.desc : 'Not configured'}
                                    </div>
                                </div>
                                {isSelected && (
                                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                        <path d="M4 8L7 11L12 5" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default ModelTierSelector;
