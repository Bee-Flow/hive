import React, { useState, useRef, useEffect } from 'react';

const TIER_META = {
    auto: { icon: '🔀', label: 'Auto', desc: 'Optimal choice', color: '#6366f1' },
    fast: { icon: '⚡', label: 'Fast', desc: 'Quick answers', color: '#10b981' },
    thinking: { icon: '🧠', label: 'Think', desc: 'Complex problems', color: '#8b5cf6' },
    writer: { icon: '✍️', label: 'Write', desc: 'Long-form content', color: '#ec4899' },
    pro: { icon: '✨', label: 'Deep Thinking', desc: 'Advanced reasoning', color: '#f59e0b' }
};

// Build a TIER_META entry from a custom tier config the server returned.
function customTierMeta(key, cfg) {
    return {
        icon: cfg?.icon || '✨',
        label: cfg?.label || key.replace(/^custom:/, ''),
        desc: cfg?.description || 'Custom tier',
        color: '#eab308',
    };
}

const ModelTierSelector = ({ tiers = {}, value = 'fast', onChange, dropDirection = 'up' }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Preserve ordering: auto, fast, thinking, writer, pro, then any custom tiers
    // the server included (filtered server-side by group + task-type permissions).
    const standardKeys = ['auto', 'fast', 'thinking', 'writer', 'pro'];
    const customKeys = Object.keys(tiers).filter(k => k.startsWith('custom:'));
    const tierKeys = [...standardKeys, ...customKeys];

    const currentMeta = TIER_META[value]
        || (value && value.startsWith('custom:') ? customTierMeta(value, tiers[value]) : null)
        || TIER_META.fast;

    return (
        <div ref={ref} style={{ position: 'relative', display: 'inline-block' }} data-testid="model-tier-selector">
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
                data-testid="model-tier-trigger"
            >
                <span>{currentMeta.icon}</span>
                <span>{currentMeta.label}</span>
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
                        const tierConfig = tiers[key] || {};
                        const meta = TIER_META[key] || (key.startsWith('custom:') ? customTierMeta(key, tierConfig) : null);
                        if (!meta) return null;
                        const isSelected = value === key;
                        // A standard tier must have a configured modelId; auto is always valid;
                        // a custom tier is only included in the server payload when permitted, so show it.
                        const isConfigured = key === 'auto' || key.startsWith('custom:') || !!tierConfig.modelId;

                        // Hide unconfigured tiers entirely
                        if (!isConfigured) return null;

                        return (
                            <button
                                key={key}
                                onClick={() => { onChange(key); setOpen(false); }}
                                data-testid={`model-tier-${key}`}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '10px',
                                    width: '100%', padding: '10px 12px',
                                    background: isSelected ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                                    border: 'none', cursor: 'pointer',
                                    color: 'var(--text-primary)',
                                    textAlign: 'left', transition: 'background 0.1s',
                                }}
                                onMouseEnter={e => { if (!isSelected) e.target.style.background = 'var(--bg-tertiary)'; }}
                                onMouseLeave={e => { if (!isSelected) e.target.style.background = 'transparent'; }}
                            >
                                <span style={{ fontSize: '18px', width: '24px', textAlign: 'center' }}>{meta.icon}</span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '13px', fontWeight: 600 }}>{meta.label}</div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                        {meta.desc}
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
