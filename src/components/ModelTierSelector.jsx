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
            {/* Compact pill trigger. Borderless on hover/open — looks like an
                interactive pill rather than a form control. */}
            <button
                onClick={() => setOpen(!open)}
                className="model-tier-trigger"
                data-open={open ? '1' : '0'}
                style={{
                    display: 'inline-flex', alignItems: 'center', gap: '7px',
                    padding: '6px 10px 6px 12px', borderRadius: '9999px',
                    background: variant === 'input' ? 'var(--bg-secondary)' : 'var(--bg-card, #fff)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)', cursor: 'pointer',
                    fontSize: '12px', fontWeight: 500,
                    transition: 'background 0.15s, border-color 0.15s, box-shadow 0.15s',
                    whiteSpace: 'nowrap',
                    boxShadow: open ? 'var(--shadow-sm)' : 'none',
                }}
                title="Select model tier"
                data-testid="model-tier-trigger"
            >
                {currentMeta.iconSrc ? (
                    <img src={currentMeta.iconSrc} alt="" className="w-4 h-4 object-contain" />
                ) : currentMeta.Icon ? (
                    <currentMeta.Icon className="w-3.5 h-3.5" style={{ color: 'var(--accent-primary)' }} />
                ) : (
                    <AppEmoji id={tierCatalogId(value)} default={currentMeta.emoji} />
                )}
                <span>{currentMeta.label}</span>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
                    style={{
                        opacity: 0.55,
                        transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.18s ease',
                    }}>
                    <path d="M2 4L5 7L8 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </button>

            {/* Dropdown panel — inner padding so the rounded hover bg paints
                fully inside the panel's rounded corners, and a single,
                quietly-strong selected state (no double-indicator). */}
            {open && (
                <div
                    className="model-tier-panel absolute"
                    data-surface="opaque"
                    role="listbox"
                    style={{
                        ...(dropDirection === 'down'
                            ? { top: 'calc(100% + 6px)' }
                            : { bottom: 'calc(100% + 6px)' }),
                        right: 0, minWidth: '240px',
                        border: '1px solid var(--border-default)',
                        borderRadius: '14px',
                        padding: '6px',
                        boxShadow: 'var(--shadow-popover, 0 12px 36px rgba(15,23,42,0.18))',
                        overflow: 'hidden', zIndex: 100,
                        animation: 'modelTierPanelIn 140ms cubic-bezier(0.22, 1, 0.36, 1) both',
                        transformOrigin: dropDirection === 'down' ? 'top right' : 'bottom right',
                    }}
                >
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
                                role="option"
                                aria-selected={isSelected}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '10px',
                                    width: '100%', padding: '8px 10px',
                                    background: isSelected ? 'var(--bg-tertiary)' : 'transparent',
                                    borderRadius: '9px',
                                    border: 'none', cursor: 'pointer',
                                    color: 'var(--text-primary)',
                                    textAlign: 'left',
                                    transition: 'background 0.12s ease',
                                }}
                                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
                                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                            >
                                {/* Icon in a soft tinted square — gives the popover a tactile,
                                    iOS-style rhythm and lets the accent show through on the
                                    selected row without painting a hard border. */}
                                <span
                                    aria-hidden="true"
                                    style={{
                                        width: '28px', height: '28px',
                                        borderRadius: '7px',
                                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                        background: isSelected
                                            ? 'color-mix(in srgb, var(--accent-primary) 16%, transparent)'
                                            : 'var(--bg-secondary)',
                                        flexShrink: 0,
                                        transition: 'background 0.12s ease',
                                    }}
                                >
                                    {meta.iconSrc ? (
                                        <img src={meta.iconSrc} alt="" style={{ width: '16px', height: '16px', objectFit: 'contain' }} />
                                    ) : meta.Icon ? (
                                        <meta.Icon
                                            className="w-4 h-4"
                                            style={{ color: isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)' }}
                                        />
                                    ) : (
                                        <AppEmoji id={tierCatalogId(key)} default={meta.emoji} />
                                    )}
                                </span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{
                                        fontSize: '13px', fontWeight: 600,
                                        color: 'var(--text-primary)',
                                        lineHeight: 1.25,
                                        display: 'flex', alignItems: 'center', gap: '6px',
                                    }}>
                                        <span>{meta.label}</span>
                                        {meta.beta && (
                                            <span
                                                className="text-[9px] px-1 py-px rounded font-medium flex-shrink-0"
                                                style={{
                                                    background: 'color-mix(in srgb, var(--accent-primary) 12%, transparent)',
                                                    color: 'var(--accent-primary)',
                                                }}
                                            >
                                                beta
                                            </span>
                                        )}
                                    </div>
                                    <div style={{
                                        fontSize: '11.5px',
                                        color: 'var(--text-muted)',
                                        lineHeight: 1.3,
                                        marginTop: '1px',
                                    }}>
                                        {meta.desc}
                                    </div>
                                </div>
                                {isSelected && (
                                    <svg
                                        width="16" height="16" viewBox="0 0 16 16" fill="none"
                                        style={{ flexShrink: 0, color: 'var(--accent-primary)' }}
                                        aria-hidden="true"
                                    >
                                        <path d="M4 8L7 11L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
