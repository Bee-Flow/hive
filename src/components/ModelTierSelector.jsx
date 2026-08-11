import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { TIER_META, customTierMeta, configuredTierKeys } from './tierMeta';
import AppEmoji from './AppEmoji';

// Map a tier key to its catalog id; custom tiers fall back to tier.custom.
const tierCatalogId = (key) => key?.startsWith('custom:') ? 'tier.custom' : (key === 'pro' ? 'tier.deep' : `tier.${key}`);

const PANEL_MIN_WIDTH = 240;

/**
 * `portal` renders the dropdown into document.body at a fixed position anchored
 * to the trigger. Use it inside a SCROLLING/clipping container (e.g. the App
 * Studio inspector), where an absolutely-positioned panel is cut off by the
 * ancestor's overflow. Off by default — every existing call site keeps its
 * current absolute behaviour.
 */
const ModelTierSelector = ({ tiers = {}, value = 'fast', onChange, dropDirection = 'up', variant = 'default', portal = false }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    const panelRef = useRef(null);
    const [pos, setPos] = useState(null);

    useEffect(() => {
        const handler = (e) => {
            if (ref.current && ref.current.contains(e.target)) return;
            // The portalled panel lives outside `ref` — without this it would
            // unmount on mousedown and swallow the option's click.
            if (panelRef.current && panelRef.current.contains(e.target)) return;
            setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Anchor the portalled panel to the trigger; follow scroll/resize.
    useLayoutEffect(() => {
        if (!portal || !open || !ref.current) return undefined;
        const update = () => {
            const r = ref.current.getBoundingClientRect();
            const width = panelRef.current?.offsetWidth || PANEL_MIN_WIDTH;
            // Right-align to the trigger, then CLAMP into the viewport: a
            // trigger near the left edge (the AI builder composer) would
            // otherwise push a right-aligned panel off-screen.
            const left = Math.min(
                Math.max(8, r.right - width),
                Math.max(8, window.innerWidth - width - 8),
            );
            const next = { left };
            if (dropDirection === 'down') next.top = r.bottom + 6;
            else next.bottom = Math.max(8, window.innerHeight - r.top + 6);
            setPos(next);
        };
        update();
        window.addEventListener('resize', update);
        window.addEventListener('scroll', update, true);
        return () => {
            window.removeEventListener('resize', update);
            window.removeEventListener('scroll', update, true);
        };
    }, [portal, open, dropDirection]);

    // Ordered, configured-only tier keys (auto, fast, standard/Flow, swarm,
    // thinking, writer, pro, then custom). Shared with the AI-step settings
    // picker via configuredTierKeys so every tier list stays identical.
    const tierKeys = configuredTierKeys(tiers);

    const currentMeta = TIER_META[value]
        || (value && value.startsWith('custom:') ? customTierMeta(value, tiers[value]) : null)
        || TIER_META.fast;

    // Portalled panels escape the ancestor's overflow; inline ones stay put.
    const renderPanel = (el) => (portal ? createPortal(el, document.body) : el);

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
            {open && (!portal || pos) && renderPanel(
                <div
                    ref={panelRef}
                    className={portal ? 'model-tier-panel' : 'model-tier-panel absolute'}
                    data-surface="opaque"
                    role="listbox"
                    style={{
                        ...(portal
                            ? { position: 'fixed', ...pos, zIndex: 1000 }
                            : {
                                position: 'absolute',
                                ...(dropDirection === 'down'
                                    ? { top: 'calc(100% + 6px)' }
                                    : { bottom: 'calc(100% + 6px)' }),
                                right: 0, zIndex: 100,
                            }),
                        minWidth: `${PANEL_MIN_WIDTH}px`,
                        maxWidth: 'calc(100vw - 16px)', // never wider than the viewport
                        border: '1px solid var(--border-default)',
                        borderRadius: '14px',
                        padding: '6px',
                        boxShadow: 'var(--shadow-popover, 0 12px 36px rgba(15,23,42,0.18))',
                        overflow: 'hidden',
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
