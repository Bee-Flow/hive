import React, { useEffect } from 'react';
import AppIcon from '../../AppIcon';
import { Toggle, ImageField, FieldRow } from './fields';
import { GOOGLE_FONTS, buildFontsHrefs, fontStack } from './googleFonts';

/**
 * Design tab — site-wide branding controls.
 *
 * Edits flow back to the parent through `onChange(nextDesign)`. The
 * panel merges the result into `site.design` and pushes through the
 * shared `scheduleSave('site', ...)` flow, so design saves coalesce
 * with chrome saves into a single SiteDoc PUT (no race window).
 *
 * Default values come from the backend payload, so this component
 * never needs to invent a starting design — but we apply a light
 * fallback locally so the controls still render if the prop is null.
 */

const FALLBACK_DESIGN = {
    colors: {
        primary:       '#F5A623',
        secondary:     '#1F2937',
        accent:        '#FFD166',
        background:    '#FFFFFF',
        surface:       '#F7F8FA',
        textPrimary:   '#0F172A',
        textSecondary: '#475569',
    },
    fonts:    { heading: 'Inter', body: 'Inter' },
    logo:     '',
    favicon:  '',
    radius:   12,
    theme:    'light',
    gradient: false,
};

export default function DesignEditor({ design, onChange }) {
    const d = design || FALLBACK_DESIGN;

    // Preload the curated font library at regular + semibold weights in
    // the parent window so the in-panel previews render in the chosen
    // face. The iframe loads its own (larger) bundle of weights
    // independently. One <link> per source (Google + Fontshare) because
    // the CDNs use different URL formats.
    useEffect(() => {
        const hrefs = buildFontsHrefs(GOOGLE_FONTS, [400, 600]);
        for (const { id, href } of hrefs) {
            if (document.getElementById(id)) continue;
            const link = document.createElement('link');
            link.id = id;
            link.rel = 'stylesheet';
            link.href = href;
            document.head.appendChild(link);
        }
        // Don't remove on unmount — keeps fonts cached across tab switches.
    }, []);

    const setColor = (key, value) =>
        onChange({ ...d, colors: { ...d.colors, [key]: value } });
    const setFont = (key, value) =>
        onChange({ ...d, fonts: { ...d.fonts, [key]: value } });
    const setRadius   = (value) => onChange({ ...d, radius: value });
    const setTheme    = (isDark) => onChange({ ...d, theme: isDark ? 'dark' : 'light' });
    const setGradient = (on) => onChange({ ...d, gradient: !!on });
    const setLogo     = (value) => onChange({ ...d, logo: value });
    const setFavicon  = (value) => onChange({ ...d, favicon: value });

    return (
        <div className="flex-1 overflow-y-auto">
            <div className="px-4 pt-4 pb-6">
                <div className="flex items-center gap-2 mb-1">
                    <AppIcon name="Palette" className="w-4 h-4 text-[var(--accent-primary)]" />
                    <span className="text-sm font-semibold text-[var(--text-primary)]">Design</span>
                </div>
                <p className="text-xs text-[var(--text-muted)] mb-4">
                    Site-wide brand colors, fonts, and shape. Applied to every page in this site.
                </p>

                <SectionDivider label="Brand colors" />
                <ColorRow label="Primary"        value={d.colors.primary}       onChange={v => setColor('primary',       v)} hint="Buttons, links, accents" />
                <ColorRow label="Secondary"      value={d.colors.secondary}     onChange={v => setColor('secondary',     v)} hint="Strong contrast / dark blocks" />
                <ColorRow label="Accent"         value={d.colors.accent}        onChange={v => setColor('accent',        v)} hint="Highlights, badges" />
                <ColorRow label="Background"     value={d.colors.background}    onChange={v => setColor('background',    v)} hint="Page background" />
                <ColorRow label="Surface"        value={d.colors.surface}       onChange={v => setColor('surface',       v)} hint="Cards, alternating sections" />
                <ColorRow label="Text"           value={d.colors.textPrimary}   onChange={v => setColor('textPrimary',   v)} hint="Body copy" />
                <ColorRow label="Text secondary" value={d.colors.textSecondary} onChange={v => setColor('textSecondary', v)} hint="Muted / supporting copy" />

                <SectionDivider label="Fonts" />
                <FontRow label="Heading font" value={d.fonts.heading} onChange={v => setFont('heading', v)} sample="The quick brown fox jumps" weight={600} />
                <FontRow label="Body font"    value={d.fonts.body}    onChange={v => setFont('body',    v)} sample="The quick brown fox jumps over the lazy dog. 0123456789" weight={400} />

                <SectionDivider label="Logo & favicon" />
                <FieldRow label="Logo" hint="Replaces the letter-circle in the header (PNG/SVG, transparent background recommended)">
                    <ImageField value={d.logo} onChange={setLogo} />
                </FieldRow>
                <FieldRow label="Favicon" hint="Browser tab icon (PNG or ICO, square)">
                    <ImageField value={d.favicon} onChange={setFavicon} />
                </FieldRow>

                <SectionDivider label="Shape & theme" />
                <RadiusRow value={d.radius} onChange={setRadius} />
                <FieldRow label="Use gradient on primary" hint="When on, buttons and accents fade from Primary → Accent. When off, they're a flat solid Primary.">
                    <Toggle label={d.gradient ? 'Gradient' : 'Solid'} value={!!d.gradient} onChange={setGradient} />
                </FieldRow>
                <FieldRow label="Theme base" hint="Dark mode swaps Background, Surface, and Text colors with a dark layout palette. Your Primary, Secondary, and Accent stay as set.">
                    <Toggle label={d.theme === 'dark' ? 'Dark' : 'Light'} value={d.theme === 'dark'} onChange={setTheme} />
                </FieldRow>
            </div>
        </div>
    );
}

// ── small UI atoms (kept local so the panel stays as the only consumer) ──

function SectionDivider({ label }) {
    return (
        <div className="flex items-center gap-2 mt-4 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">{label}</span>
            <div className="flex-1 h-px bg-[var(--border-subtle)]" />
        </div>
    );
}

export function ColorRow({ label, value, onChange, hint }) {
    const hex = typeof value === 'string' ? value : '';
    const safeHex = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : '#000000';
    return (
        <FieldRow label={label} hint={hint}>
            <div className="flex items-center gap-2">
                <input
                    type="color"
                    value={safeHex}
                    onChange={(e) => onChange(e.target.value)}
                    className="h-8 w-10 rounded border border-[var(--border-default)] bg-[var(--bg-tertiary)] cursor-pointer"
                    title={label}
                />
                <input
                    type="text"
                    value={hex}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder="#RRGGBB"
                    className="flex-1 px-2 py-1.5 rounded text-xs font-mono border border-[var(--border-default)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                    spellCheck={false}
                />
            </div>
        </FieldRow>
    );
}

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

function RadiusRow({ value, onChange }) {
    const v = typeof value === 'number' ? value : 12;
    return (
        <FieldRow label={`Border radius — ${v}px`} hint="Affects buttons, cards, and inputs across the site.">
            <div className="flex items-center gap-3">
                <input
                    type="range"
                    min="0"
                    max="24"
                    step="1"
                    value={v}
                    onChange={(e) => onChange(parseInt(e.target.value, 10))}
                    className="flex-1 accent-[var(--accent-primary)]"
                />
                <span
                    className="shrink-0 inline-block bg-[var(--accent-primary)]"
                    style={{ width: 28, height: 28, borderRadius: `${v}px` }}
                    title={`${v}px preview`}
                />
            </div>
        </FieldRow>
    );
}
