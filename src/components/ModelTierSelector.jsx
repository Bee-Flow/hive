import React, { useState, useRef, useEffect } from 'react';
import { TIER_META, customTierMeta } from './tierMeta';
import AppEmoji from './AppEmoji';

// Map a tier key to its catalog id; custom tiers fall back to tier.custom.
const tierCatalogId = (key) => key?.startsWith('custom:') ? 'tier.custom' : (key === 'pro' ? 'tier.deep' : `tier.${key}`);

const ModelTierSelector = ({ tiers = {}, value = 'fast', onChange, dropDirection = 'up', variant = 'default' }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Preserve ordering: auto, fast, standard (Flow), swarm, thinking, writer, pro,
    // then custom tiers (filtered server-side by group + task-type permissions
    // and beta-feature gates — Flow + Swarm only appear when their respective
    // beta features are granted to the caller's org).
    const standardKeys = ['auto', 'fast', 'standard', 'swarm', 'thinking', 'writer', 'pro'];
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
                    padding: '6px 12px', borderRadius: '8px',
                    background: variant === 'input' ? 'var(--bg-secondary)' : 'var(--bg-card, #fff)', border: '1px solid var(--border-default)',
                    color: 'var(--text-primary)', cursor: 'pointer',
                    fontSize: '12px', fontWeight: 500, transition: 'all 0.15s',
                    whiteSpace: 'nowrap',
                    height: 'auto'
                }}
                title="Select model tier"
                data-testid="model-tier-trigger"
            >
                {currentMeta.iconSrc
                    ? <img src={currentMeta.iconSrc} alt="" className="w-4 h-4 object-contain" />
                    : <AppEmoji id={tierCatalogId(value)} default={currentMeta.icon} />}
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
                                onClick={() => { onChange?.(key); setOpen(false); }}
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
                                <span style={{ fontSize: '18px', width: '24px', textAlign: 'center', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {meta.iconSrc
                                        ? <img src={meta.iconSrc} alt="" style={{ width: '20px', height: '20px', objectFit: 'contain' }} />
                                        : <AppEmoji id={tierCatalogId(key)} default={meta.icon} />}
                                </span>
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
