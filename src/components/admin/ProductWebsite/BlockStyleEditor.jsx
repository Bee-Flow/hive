import React from 'react';
import AppIcon from '../../AppIcon';
import { FieldRow } from './fields';

/**
 * Per-block style overrides — Style sub-tab in pane B.
 *
 * Data shape (block.style):
 *   {
 *     colorOverrides: {
 *       primary, secondary, accent, background, surface, text, textSecondary
 *     },                              // missing/empty = inherit site.design
 *     spacing: { paddingTop, paddingBottom },   // CSS values, e.g. '4rem'
 *     backgroundImage: 'url-or-asset-key',
 *     backgroundOverlay: 'rgba(0,0,0,0.5)',     // single CSS color string
 *     maxWidth: 'narrow' | 'medium' | 'wide' | 'full',
 *     align:    'left' | 'center' | 'right',
 *     cssClass: '',
 *   }
 *
 * Default (everything missing) = no inline style + no extra classes →
 * identical visual to no Style tab interaction.
 *
 * Hidden state lives on `block.enabled` (single source of truth, also driven
 * by the BlockList toggle). The "Hide this block" checkbox here calls
 * onToggleEnabled to flip it.
 */

const COLOR_TOKENS = [
    { key: 'primary',       label: 'Primary',        hint: 'CTAs, links, accents',          designKey: 'primary' },
    { key: 'secondary',     label: 'Secondary',      hint: 'Strong contrast / dark blocks', designKey: 'secondary' },
    { key: 'accent',        label: 'Accent',         hint: 'Highlights, badges',            designKey: 'accent' },
    { key: 'background',    label: 'Background',     hint: 'Block bg',                      designKey: 'background' },
    { key: 'surface',       label: 'Surface',        hint: 'Cards inside this block',       designKey: 'surface' },
    { key: 'text',          label: 'Text',           hint: 'Body copy',                     designKey: 'textPrimary' },
    { key: 'textSecondary', label: 'Text secondary', hint: 'Muted / supporting',            designKey: 'textSecondary' },
];

const SPACING_PRESETS = ['2rem', '4rem', '6rem', '8rem'];

const MAX_WIDTHS = [
    { value: 'narrow', label: 'Narrow' },
    { value: 'medium', label: 'Medium' },
    { value: 'wide',   label: 'Wide'   },
    { value: 'full',   label: 'Full'   },
];

const ALIGNS = [
    { value: 'left',   icon: 'AlignLeft',   label: 'Left'   },
    { value: 'center', icon: 'AlignCenter', label: 'Center' },
    { value: 'right',  icon: 'AlignRight',  label: 'Right'  },
];

export default function BlockStyleEditor({ style, enabled = true, design, onChange, onToggleEnabled }) {
    const s = style || {};
    const overrides = s.colorOverrides || {};
    const spacing   = s.spacing || {};
    const siteColors = design?.colors || {};

    const setOverride = (key, value) => {
        const next = { ...overrides };
        if (value === null || value === undefined || value === '') delete next[key];
        else next[key] = value;
        onChange({ ...s, colorOverrides: next });
    };
    const setSpacing = (key, value) => {
        const next = { ...spacing };
        if (!value) delete next[key];
        else next[key] = value;
        onChange({ ...s, spacing: next });
    };
    const setBgImage   = (url)  => onChange({ ...s, backgroundImage:   url || null });
    const setBgOverlay = (rgba) => onChange({ ...s, backgroundOverlay: rgba || null });
    const setMaxWidth  = (v)    => onChange({ ...s, maxWidth: v });
    const setAlign     = (v)    => onChange({ ...s, align: v });
    const setCssClass  = (v)    => onChange({ ...s, cssClass: v });

    return (
        <div className="px-4 pt-3 pb-6">
            <SectionDivider label="Visibility" />
            <label className="flex items-center gap-2 mb-3 cursor-pointer">
                <input
                    type="checkbox"
                    checked={!enabled}
                    onChange={() => onToggleEnabled()}
                    className="accent-[var(--accent-primary)]"
                />
                <span className="text-sm text-[var(--text-secondary)]">
                    Hide this block <span className="text-[10px] text-[var(--text-muted)]">(stays in the page list)</span>
                </span>
            </label>

            <SectionDivider label="Color overrides" />
            <p className="text-xs text-[var(--text-muted)] -mt-2 mb-3 leading-relaxed">
                Each token defaults to the site's Design palette. Set one to override
                only this block — children inherit through CSS variables.
            </p>
            {COLOR_TOKENS.map(t => (
                <ColorOverrideRow
                    key={t.key}
                    label={t.label}
                    hint={t.hint}
                    value={overrides[t.key] ?? null}
                    inheritFrom={siteColors[t.designKey]}
                    onChange={(v) => setOverride(t.key, v)}
                />
            ))}

            <SectionDivider label="Spacing" />
            <SpacingRow label="Padding top"    value={spacing.paddingTop}    onChange={(v) => setSpacing('paddingTop',    v)} />
            <SpacingRow label="Padding bottom" value={spacing.paddingBottom} onChange={(v) => setSpacing('paddingBottom', v)} />

            <SectionDivider label="Background image" />
            <BackgroundImageField
                url={s.backgroundImage || ''}
                overlay={s.backgroundOverlay || ''}
                onChangeUrl={setBgImage}
                onChangeOverlay={setBgOverlay}
            />

            <SectionDivider label="Layout" />
            <FieldRow label="Max width">
                <SegmentedControl options={MAX_WIDTHS} value={s.maxWidth || 'full'} onChange={setMaxWidth} />
            </FieldRow>
            <FieldRow label="Text align">
                <SegmentedControl options={ALIGNS} value={s.align || 'left'} onChange={setAlign} iconOnly />
            </FieldRow>

            <SectionDivider label="Advanced" />
            <FieldRow
                label={
                    <span className="flex items-center gap-1.5">
                        Custom CSS class
                        <span className="text-[10px] text-amber-400" title="Admin-only — applies a raw class name to the block wrapper">⚠ Advanced</span>
                    </span>
                }
                hint="Space-separated class names. Use only if you've added matching CSS rules elsewhere."
            >
                <input
                    type="text"
                    value={s.cssClass || ''}
                    onChange={(e) => setCssClass(e.target.value)}
                    placeholder="my-custom-class"
                    spellCheck={false}
                    className="w-full px-2 py-1.5 rounded text-xs font-mono border border-[var(--border-default)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                />
            </FieldRow>

            {hasAnyOverride(s) && (
                <button
                    type="button"
                    onClick={() => onChange({})}
                    className="mt-4 w-full text-xs text-[var(--text-muted)] hover:text-red-400 underline-offset-2 hover:underline"
                >
                    Reset all style overrides
                </button>
            )}
        </div>
    );
}

// ── helpers ────────────────────────────────────────────────────────

function hasAnyOverride(s) {
    if (!s) return false;
    if (s.colorOverrides && Object.keys(s.colorOverrides).length) return true;
    if (s.spacing && Object.keys(s.spacing).length) return true;
    if (s.backgroundImage || s.backgroundOverlay) return true;
    if (s.maxWidth) return true;
    if (s.align) return true;
    if (s.cssClass) return true;
    return false;
}

function SectionDivider({ label }) {
    return (
        <div className="flex items-center gap-2 mt-4 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">{label}</span>
            <div className="flex-1 h-px bg-[var(--border-subtle)]" />
        </div>
    );
}

function SegmentedControl({ options, value, onChange, iconOnly }) {
    return (
        <div className="inline-flex rounded-md border border-[var(--border-default)] bg-[var(--bg-tertiary)] overflow-hidden">
            {options.map((opt) => {
                const active = opt.value === value;
                return (
                    <button
                        key={opt.value}
                        type="button"
                        onClick={() => onChange(opt.value)}
                        title={opt.label}
                        className={`px-3 py-1.5 text-xs font-medium transition-colors
                            ${active
                                ? 'bg-[var(--accent-primary)] text-white'
                                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)]'
                            }`}
                    >
                        {opt.icon
                            ? <span className="inline-flex items-center gap-1.5">
                                  <AppIcon name={opt.icon} className="w-3.5 h-3.5" />
                                  {!iconOnly && opt.label}
                              </span>
                            : opt.label}
                    </button>
                );
            })}
        </div>
    );
}

// ── Color override row ─────────────────────────────────────────────

function ColorOverrideRow({ label, hint, value, inheritFrom, onChange }) {
    const isOverridden = typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
    const swatchValue  = isOverridden ? value : (inheritFrom || '#000000');
    return (
        <FieldRow label={label} hint={hint}>
            <div className="flex items-center gap-2">
                <input
                    type="color"
                    value={swatchValue}
                    onChange={(e) => onChange(e.target.value)}
                    className={`h-8 w-10 rounded border cursor-pointer bg-[var(--bg-tertiary)]
                        ${isOverridden ? 'border-[var(--accent-primary)]' : 'border-[var(--border-default)]'}`}
                    title={isOverridden ? 'Block override' : 'Click to override (currently inherited)'}
                />
                <input
                    type="text"
                    value={isOverridden ? value : ''}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={inheritFrom ? `inherit ${inheritFrom}` : '#RRGGBB'}
                    spellCheck={false}
                    className="flex-1 px-2 py-1.5 rounded text-xs font-mono border border-[var(--border-default)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                />
                {isOverridden && (
                    <button
                        type="button"
                        onClick={() => onChange(null)}
                        className="text-xs text-[var(--text-muted)] hover:text-red-400 px-1"
                        title="Reset to inherited"
                    >
                        Reset
                    </button>
                )}
            </div>
        </FieldRow>
    );
}

// ── Spacing row (text input + preset chips) ─────────────────────────

function SpacingRow({ label, value, onChange }) {
    const v = value || '';
    return (
        <FieldRow label={label}>
            <div className="flex items-center gap-2 flex-wrap">
                <input
                    type="text"
                    value={v}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder="default"
                    spellCheck={false}
                    className="w-24 px-2 py-1.5 rounded text-xs font-mono border border-[var(--border-default)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                />
                <div className="inline-flex rounded-md border border-[var(--border-default)] bg-[var(--bg-tertiary)] overflow-hidden">
                    {SPACING_PRESETS.map(p => (
                        <button
                            key={p}
                            type="button"
                            onClick={() => onChange(p)}
                            className={`px-2 py-1 text-[10px] font-mono transition-colors
                                ${v === p
                                    ? 'bg-[var(--accent-primary)] text-white'
                                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]'
                                }`}
                        >
                            {p}
                        </button>
                    ))}
                </div>
                {v && (
                    <button
                        type="button"
                        onClick={() => onChange(null)}
                        className="text-xs text-[var(--text-muted)] hover:text-red-400"
                        title="Reset to default"
                    >
                        ×
                    </button>
                )}
            </div>
        </FieldRow>
    );
}

// ── Background image with overlay ──────────────────────────────────

function BackgroundImageField({ url, overlay, onChangeUrl, onChangeOverlay }) {
    const { hex: overlayHex, opacity: overlayOpacity } = parseRgbaOverlay(overlay);
    return (
        <>
            <FieldRow label="Image URL or asset key" hint="A CMS asset key (cms/...) or full https URL.">
                <div className="flex items-start gap-2">
                    {url ? (
                        <div className="w-12 h-12 shrink-0 rounded border border-[var(--border-default)] overflow-hidden bg-[var(--bg-tertiary)] flex items-center justify-center">
                            <img src={resolveAssetUrl(url)} alt="" className="w-full h-full object-cover" />
                        </div>
                    ) : null}
                    <input
                        type="text"
                        value={url}
                        onChange={(e) => onChangeUrl(e.target.value)}
                        onPaste={(e) => {
                            // Force-handle paste: read clipboard text directly
                            // and fire the change. Some browsers don't reliably
                            // synthesize React's onChange after paste when the
                            // clipboard came from formatted-text sources (Google
                            // Docs, etc.) — this guarantees the URL lands.
                            const txt = e.clipboardData?.getData('text');
                            if (txt) {
                                e.preventDefault();
                                onChangeUrl(txt.trim());
                            }
                        }}
                        placeholder="https://… or cms/file.jpg"
                        spellCheck={false}
                        className="flex-1 px-2 py-1.5 rounded text-xs font-mono border border-[var(--border-default)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                    />
                </div>
            </FieldRow>
            {url && (
                <>
                    <FieldRow label="Overlay color" hint="Tints the image so foreground text stays readable.">
                        <div className="flex items-center gap-2">
                            <input
                                type="color"
                                value={overlayHex || '#000000'}
                                onChange={(e) => onChangeOverlay(composeRgba(e.target.value, overlayOpacity))}
                                className="h-8 w-10 rounded border border-[var(--border-default)] bg-[var(--bg-tertiary)] cursor-pointer"
                            />
                            <input
                                type="text"
                                value={overlay || ''}
                                onChange={(e) => onChangeOverlay(e.target.value)}
                                placeholder="rgba(0,0,0,0.5)"
                                spellCheck={false}
                                className="flex-1 px-2 py-1.5 rounded text-xs font-mono border border-[var(--border-default)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                            />
                            {overlay && (
                                <button
                                    type="button"
                                    onClick={() => onChangeOverlay(null)}
                                    className="text-xs text-[var(--text-muted)] hover:text-red-400"
                                    title="Remove overlay"
                                >
                                    ×
                                </button>
                            )}
                        </div>
                    </FieldRow>
                    <FieldRow label={`Overlay opacity — ${Math.round(overlayOpacity * 100)}%`}>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            step="1"
                            value={Math.round(overlayOpacity * 100)}
                            onChange={(e) => onChangeOverlay(composeRgba(overlayHex || '#000000', parseInt(e.target.value, 10) / 100))}
                            className="w-full accent-[var(--accent-primary)]"
                        />
                    </FieldRow>
                </>
            )}
        </>
    );
}

// Convert "rgba(r,g,b,a)" → { hex, opacity }; defaults to black/0.5.
function parseRgbaOverlay(rgba) {
    if (!rgba || typeof rgba !== 'string') return { hex: '', opacity: 0.5 };
    const m = rgba.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)$/i);
    if (!m) return { hex: '', opacity: 0.5 };
    const r = parseInt(m[1], 10);
    const g = parseInt(m[2], 10);
    const b = parseInt(m[3], 10);
    const a = m[4] != null ? parseFloat(m[4]) : 1;
    const hex = '#' + [r, g, b].map(n => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0')).join('');
    return { hex, opacity: Math.max(0, Math.min(1, a)) };
}

function composeRgba(hex, opacity) {
    const m = (hex || '').match(/^#([0-9a-fA-F]{6})$/);
    if (!m) return null;
    const h = m[1];
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    const a = Math.max(0, Math.min(1, typeof opacity === 'number' ? opacity : 0.5));
    return `rgba(${r}, ${g}, ${b}, ${Math.round(a * 100) / 100})`;
}

// Mirror of the iframe-side helper — turn a "cms/<key>" into the asset URL.
function resolveAssetUrl(urlOrKey) {
    if (!urlOrKey) return '';
    if (urlOrKey.startsWith('http://') || urlOrKey.startsWith('https://') || urlOrKey.startsWith('/')) return urlOrKey;
    if (urlOrKey.startsWith('cms/')) {
        return `/api/cms/asset/${urlOrKey.split('/').map(encodeURIComponent).join('/')}`;
    }
    return urlOrKey;
}
