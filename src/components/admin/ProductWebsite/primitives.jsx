import React, { useState } from 'react';
import { FieldRow, inputCls } from './fields';
import { GOOGLE_FONTS, fontStack } from './googleFonts';
import AppIcon from '../../AppIcon';
import ColorControl from './controls/ColorControl';
// Self-hosted Fontshare @font-face — needed so FontRow's dropdown previews
// render in the chosen face. Same CSS file DesignEditor and the preview
// iframe import; loading it here keeps font previews working for every
// consumer of FontRow regardless of which module loads first.
import '../../../marketing/self-hosted-fonts.css';

/**
 * primitives.jsx — shared micro-widgets for the CMS admin panels.
 *
 * These used to live as (near-)duplicate private components inside
 * editors.jsx / DesignEditor.jsx / BlockStyleEditor.jsx / CookieBannerEditor.
 * One copy each now lives here; the block editors under ./blockEditors/ and
 * the site-level editors import from this module.
 */

export const InlineHint = ({ children }) => (
    <p className="text-xs text-[var(--text-muted)] italic mb-3 leading-relaxed">✎ {children}</p>
);

// Section-level collapsible card. Mirrors the row-level collapse pattern
// used by RepeatableList (chevron, clickable header) without dragging that
// component's repeat-list machinery in.
//
// `persistKey` (optional) persists the open state in localStorage under
// `cms.ui.card.<persistKey>` — read lazily on mount, written on toggle,
// best-effort (storage failures fall back to `defaultOpen`). Without a
// persistKey the card is plain local state, exactly as before.
export function CollapsibleCard({ title, defaultOpen = false, persistKey = null, children }) {
    const storageKey = persistKey ? `cms.ui.card.${persistKey}` : null;
    const [open, setOpen] = useState(() => {
        if (storageKey) {
            try {
                const stored = window.localStorage.getItem(storageKey);
                if (stored === '1') return true;
                if (stored === '0') return false;
            } catch { /* storage unavailable — fall back to defaultOpen */ }
        }
        return defaultOpen;
    });
    const toggle = () => {
        const next = !open;
        if (storageKey) {
            try { window.localStorage.setItem(storageKey, next ? '1' : '0'); } catch { /* best-effort */ }
        }
        setOpen(next);
    };
    return (
        <div className="rounded-md border border-[var(--border-subtle)] mb-3">
            <button
                type="button"
                onClick={toggle}
                className="flex w-full items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                aria-expanded={open}
            >
                <span
                    className="shrink-0 inline-block transition-transform"
                    style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}
                    aria-hidden="true"
                >▾</span>
                <span className="truncate">{title}</span>
            </button>
            {open ? <div className="px-3 pb-3">{children}</div> : null}
        </div>
    );
}

// Labelled horizontal divider — label + h-px line. Shared by the Design
// tab and the per-block Style tab (previously two identical local copies).
export function SectionDivider({ label }) {
    return (
        <div className="flex items-center gap-2 mt-4 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">{label}</span>
            <div className="flex-1 h-px bg-[var(--border-subtle)]" />
        </div>
    );
}

// Small inline color swatch + hex text input. Used everywhere a compact
// color affordance is needed (size & color rows, per-card title color,
// etc.). Thin wrapper over the unified ColorControl (compact mode) — same
// prop signature and commit rule as before: partial hex stays local, only
// a complete `#RRGGBB` commits via onChange.
export function ColorSwatch({ value, onChange, title }) {
    return <ColorControl compact value={value} onChange={onChange} title={title} />;
}

// Compact px-size input — narrow numeric field used by chrome typography
// controls. Empty value (and value of 0) display as "inherit" placeholder
// so users can see they're falling back to the page CSS / Design tab.
export function PxSizeInput({ value, onChange, min = 8, max = 96, ariaLabel }) {
    const numeric = Number.isFinite(value) && value > 0 ? value : '';
    return (
        <input
            type="number"
            min={min}
            max={max}
            step={1}
            value={numeric}
            placeholder="inherit"
            aria-label={ariaLabel}
            onChange={(e) => onChange(Number(e.target.value) || 0)}
            className={inputCls + ' shrink-0'}
            style={{ width: '70px' }}
        />
    );
}

// Wide color row — swatch + full-width hex text input inside a FieldRow.
// Thin wrapper over the unified ColorControl; used by the Design tab where
// the value is always a complete site color. (Commit rule is now the shared
// complete-#RRGGBB one — partial typing no longer writes invalid values.)
export function ColorRow({ label, value, onChange, hint }) {
    return <ColorControl label={label} hint={hint} value={value} onChange={onChange} />;
}

// Font picker + live sample preview. The curated library comes from
// ./googleFonts (Google + self-hosted Fontshare faces).
export function FontRow({ label, value, onChange, sample, weight }) {
    const stack = fontStack(value);
    return (
        <FieldRow label={label}>
            <select
                value={value || 'Inter'}
                onChange={(e) => onChange(e.target.value)}
                className="w-full px-2 py-1.5 rounded text-sm border border-[var(--border-default)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                style={{ fontFamily: stack }}
            >
                {GOOGLE_FONTS.map((f) => (
                    <option key={f} value={f} style={{ fontFamily: fontStack(f) }}>
                        {f}
                    </option>
                ))}
            </select>
            <div
                className="mt-2 px-3 py-2 rounded border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] text-[var(--text-primary)]"
                style={{ fontFamily: stack, fontWeight: weight, fontSize: '0.95rem', lineHeight: 1.4 }}
            >
                {sample}
            </div>
        </FieldRow>
    );
}

// StyleTriplet — Font + Size + Color trio for one *Style sub-object.
// Edits a `{ fontFamily, fontSize, color }` blob: `onChange` receives the
// whole merged blob. Empty / 0 values mean "inherit" — the renderer skips
// inline styles for those, so old blocks without these keys render
// identically to today.
export function StyleTriplet({
    label,
    value = {},
    onChange,
    sample,
    weight = 500,
    min = 8,
    max = 96,
}) {
    const setStyle = (patch) => onChange({ ...value, ...patch });
    return (
        <>
            <FontRow
                label={`${label} font`}
                value={value.fontFamily || ''}
                onChange={v => setStyle({ fontFamily: v })}
                sample={sample || `${label} preview`}
                weight={weight}
            />
            <FieldRow label={`${label} size & color`}>
                <div className="flex items-center gap-2">
                    <PxSizeInput
                        value={Number.isFinite(value.fontSize) ? value.fontSize : 0}
                        onChange={v => setStyle({ fontSize: v })}
                        min={min}
                        max={max}
                        ariaLabel={`${label} size in pixels`}
                    />
                    <ColorSwatch
                        value={value.color || ''}
                        onChange={v => setStyle({ color: v })}
                        title={`${label} color`}
                    />
                </div>
            </FieldRow>
        </>
    );
}

// Labelled <select> with an optional hint line (FieldRow-style).
export function FieldSelect({ value, onChange, options, label, hint }) {
    return (
        <div className="flex flex-col gap-1.5 mb-3">
            {label ? <label className="text-xs font-medium text-[var(--text-secondary)]">{label}</label> : null}
            <select
                className="w-full px-3 py-2 rounded-md text-sm border bg-[var(--bg-tertiary)] border-[var(--border-default)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                value={value || ''}
                onChange={e => onChange(e.target.value)}
            >
                {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {hint ? <span className="text-xs text-[var(--text-muted)]">{hint}</span> : null}
        </div>
    );
}

// The one CTA style vocabulary — primary / secondary / ghost / link.
// Previously duplicated as two CTA_STYLE_OPTIONS consts and three raw
// inline <select> copies across editors.jsx.
export const CTA_STYLE_OPTIONS = [
    { value: 'primary',   label: 'Primary (filled)' },
    { value: 'secondary', label: 'Secondary (outlined)' },
    { value: 'ghost',     label: 'Ghost (no border)' },
    { value: 'link',      label: 'Link (underlined)' },
];

// Callers pass the resolved value including their own fallback
// (`cta.style || 'primary'`, Hero's secondary uses `|| 'secondary'`).
export function CtaStyleSelect({ label = 'Style', value, onChange }) {
    return <FieldSelect label={label} value={value} options={CTA_STYLE_OPTIONS} onChange={onChange} />;
}

// Standard block background vocabulary (`data.backgroundVariant`).
// ContentEditor keeps its different none/light/dark/primary vocabulary by
// passing its own `options`.
export const BACKGROUND_VARIANT_OPTIONS = [
    { value: 'default', label: 'Default (page bg)' },
    { value: 'surface', label: 'Surface (alt bg)' },
    { value: 'primary', label: 'Primary (brand color)' },
    { value: 'dark',    label: 'Dark (secondary color)' },
];

export function BackgroundVariantSelect({ label = 'Variant', value, onChange, options = BACKGROUND_VARIANT_OPTIONS }) {
    return <FieldSelect label={label} value={value} options={options} onChange={onChange} />;
}

// BackgroundCard — the standard background-variant picker, wrapped in
// a CollapsibleCard. Defaults to closed because the user only opens it
// occasionally. Block-side storage: `data.backgroundVariant`. Renderer
// behaviour unchanged — every block that already reads this field keeps
// working; blocks that didn't have it before treat it as the no-op
// default until their renderer picks it up in a later pass.
export function BackgroundCard({ data = {}, onChange, persistKey = null }) {
    return (
        <CollapsibleCard title="Background" defaultOpen={false} persistKey={persistKey}>
            <BackgroundVariantSelect
                label="Variant"
                value={data.backgroundVariant || 'default'}
                onChange={v => onChange({ ...(data || {}), backgroundVariant: v })}
            />
        </CollapsibleCard>
    );
}

// Compact joined segmented control. Options: [{ value, label, icon?, hint? }].
// `icon` renders an AppIcon (with `iconOnly` hiding the label); `hint`
// becomes the button tooltip (falls back to the label).
export function SegmentedControl({ options, value, onChange, iconOnly }) {
    return (
        <div className="inline-flex rounded-md border border-[var(--border-default)] bg-[var(--bg-tertiary)] overflow-hidden">
            {options.map((opt) => {
                const active = opt.value === value;
                return (
                    <button
                        key={opt.value}
                        type="button"
                        onClick={() => onChange(opt.value)}
                        title={opt.hint || opt.label}
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

// Monospace code textarea — used for popup-embed HTML and Live Component
// code fields. `minHeight` optional (Live Component uses 320).
const MONO_TEXTAREA_STYLE = {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    fontSize: 12.5,
    lineHeight: 1.5,
    whiteSpace: 'pre',
};

export function MonoTextarea({ value, onChange, rows = 6, minHeight = null, placeholder, ariaLabel }) {
    return (
        <textarea
            rows={rows}
            className={inputCls + ' resize-y'}
            style={minHeight ? { ...MONO_TEXTAREA_STYLE, minHeight } : MONO_TEXTAREA_STYLE}
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            aria-label={ariaLabel}
            spellCheck={false}
        />
    );
}

// Short random id minting for repeat-list items (`cta_x1y2z3`, `nav_…`).
// Same recipe the editors used inline everywhere.
export const mintId = (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
