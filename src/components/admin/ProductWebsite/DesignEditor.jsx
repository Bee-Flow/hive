import React, { useEffect } from 'react';
import AppIcon from '../../AppIcon';
import { Toggle, ImageField, FieldRow } from './fields';
import { GOOGLE_FONTS, buildFontsHrefs, fontStack } from './googleFonts';
import { SectionDivider, ColorRow, FontRow, SegmentedControl, FieldSelect } from './primitives';
import { THEME_PRESETS, applyPreset } from './themePresets';
import { contrastRatio } from './controls/colorUtils';
// Self-hosted Fontshare @font-face — needed here so the picker's
// dropdown previews render in the chosen face. Same CSS file the
// iframe imports via ProductWebsite.jsx.
import '../../../marketing/self-hosted-fonts.css';

// ColorRow / FontRow used to be defined here; they now live in
// ./primitives. Re-export so existing imports from this module
// (editors barrel, other panels) keep resolving.
export { ColorRow, FontRow } from './primitives';

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

// Mirrors DESIGN_DEFAULTS in server/i18n/defaults/cmsDefaults.js — keep
// the two in sync (the server back-fills missing fields from its copy).
const FALLBACK_DESIGN = {
    colors: {
        primary:       '#F5A623',
        secondary:     '#1F2937',
        accent:        '#FFD166',
        background:    '#FAF8F4',
        surface:       '#F3EFE7',
        textPrimary:   '#1C1917',
        textSecondary: '#57534E',
    },
    darkColors: {
        background:    '#101012',
        surface:       '#17171B',
        textPrimary:   '#F4F2EE',
        textSecondary: '#A6A29A',
        primary:       '',
        accent:        '',
    },
    fonts:    { heading: 'Fraunces', body: 'Inter', mono: 'IBM Plex Mono' },
    logo:     '',
    favicon:  '',
    radius:   12,
    theme:    'light',
    gradient: false,
    preset:   'custom',
    typography: { displaySize: 'lg', headingWeight: 600, bodySize: 16 },
    motion:   'full',
    grain:    false,
    // Identity values — these emit no CSS at all (see SHAPE_MAPS in
    // marketing/ProductWebsite.jsx), so a site without them renders
    // exactly as it did before the theme system existed.
    components: {
        buttonShape: 'soft', buttonSize: 'md', buttonTextColor: 'light',
        navStyle: 'bar', navHeight: 'default', logoSize: 'md',
        cardStyle: 'hairline', cardPadding: 'default', shadow: 'soft',
    },
    layout: { containerWidth: 'default', sectionRhythm: 'default' },
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
    const setDarkColor = (key, value) =>
        onChange({ ...d, darkColors: { ...(d.darkColors || {}), [key]: value } });
    const setFont = (key, value) =>
        onChange({ ...d, fonts: { ...d.fonts, [key]: value } });
    const setTypography = (key, value) =>
        onChange({ ...d, typography: { ...(d.typography || {}), [key]: value } });
    const setComponent = (key, value) =>
        onChange({ ...d, components: { ...(d.components || {}), [key]: value } });
    const setLayout = (key, value) =>
        onChange({ ...d, layout: { ...(d.layout || {}), [key]: value } });
    const setRadius   = (value) => onChange({ ...d, radius: value });
    const setTheme    = (isDark) => onChange({ ...d, theme: isDark ? 'dark' : 'light' });
    const setGradient = (on) => onChange({ ...d, gradient: !!on });
    const setLogo     = (value) => onChange({ ...d, logo: value });
    const setFavicon  = (value) => onChange({ ...d, favicon: value });

    const dk = d.darkColors || {};
    const ty = d.typography || {};
    const cp = d.components || {};
    const ly = d.layout || {};

    const handlePreset = (preset) => {
        // One object write → one history entry + one 'site' save; the
        // confirm matters because this replaces 10+ fields at once.
        if (!window.confirm(`Apply the "${preset.label}" theme? This replaces your colors, fonts, and typography (logo and favicon are kept). You can undo with Ctrl+Z.`)) return;
        onChange(applyPreset(d, preset));
    };

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

                <SectionDivider label="Theme presets" />
                <div className="grid grid-cols-2 gap-2 mb-3">
                    {THEME_PRESETS.map(p => (
                        <PresetCard
                            key={p.id}
                            preset={p}
                            active={d.preset === p.id}
                            onApply={() => handlePreset(p)}
                        />
                    ))}
                </div>

                <SectionDivider label="Brand colors" />
                <ColorRow label="Primary"        value={d.colors.primary}       onChange={v => setColor('primary',       v)} hint="Buttons, links, accents" />
                <ColorRow label="Secondary"      value={d.colors.secondary}     onChange={v => setColor('secondary',     v)} hint="Strong contrast / dark blocks" />
                <ColorRow label="Accent"         value={d.colors.accent}        onChange={v => setColor('accent',        v)} hint="Highlights, badges" />
                <ColorRow label="Background"     value={d.colors.background}    onChange={v => setColor('background',    v)} hint="Page background" />
                <ColorRow label="Surface"        value={d.colors.surface}       onChange={v => setColor('surface',       v)} hint="Cards, alternating sections" />
                <ColorRow label="Text"           value={d.colors.textPrimary}   onChange={v => setColor('textPrimary',   v)} hint="Body copy" />
                <ContrastBadge fg={d.colors.textPrimary} bg={d.colors.background} label="Body text on background" />
                <ColorRow label="Text secondary" value={d.colors.textSecondary} onChange={v => setColor('textSecondary', v)} hint="Muted / supporting copy" />
                <ContrastBadge fg={d.colors.textSecondary} bg={d.colors.background} label="Muted text on background" />
                <ContrastBadge fg="#FFFFFF" bg={d.colors.primary} label="Button text on primary" />

                <SectionDivider label="Dark mode palette" />
                <p className="text-[11px] text-[var(--text-muted)] mb-2">
                    Used while the site (or a visitor) is in dark mode. Brand colors above stay the same in both modes.
                </p>
                <ColorRow label="Background"     value={dk.background    || ''} onChange={v => setDarkColor('background',    v)} hint="Dark page background" />
                <ColorRow label="Surface"        value={dk.surface       || ''} onChange={v => setDarkColor('surface',       v)} hint="Dark cards / bands" />
                <ColorRow label="Text"           value={dk.textPrimary   || ''} onChange={v => setDarkColor('textPrimary',   v)} hint="Dark-mode body copy" />
                <ContrastBadge fg={dk.textPrimary} bg={dk.background} label="Dark body text on dark background" />
                <ColorRow label="Text secondary" value={dk.textSecondary || ''} onChange={v => setDarkColor('textSecondary', v)} hint="Dark-mode muted copy" />
                {/* These two were already in the schema, sanitized and honored
                    by the renderer, but had no control until now. */}
                <ColorRow label="Primary override" value={dk.primary || ''} onChange={v => setDarkColor('primary', v)} hint="Optional. Leave empty to reuse the light-mode Primary in dark mode." />
                <ColorRow label="Accent override"  value={dk.accent  || ''} onChange={v => setDarkColor('accent',  v)} hint="Optional. Leave empty to reuse the light-mode Accent." />

                <SectionDivider label="Fonts" />
                <FontRow label="Heading font" value={d.fonts.heading} onChange={v => setFont('heading', v)} sample="The quick brown fox jumps" weight={600} />
                <FontRow label="Body font"    value={d.fonts.body}    onChange={v => setFont('body',    v)} sample="The quick brown fox jumps over the lazy dog. 0123456789" weight={400} />
                <FontRow label="Mono font"    value={d.fonts.mono || 'IBM Plex Mono'} onChange={v => setFont('mono', v)} sample="01 — PRIVATE BY DESIGN" weight={500} />
                <TypeScalePreview design={d} />

                <SectionDivider label="Typography" />
                <FieldRow label="Hero display size" hint="Caps how large the hero headline can grow on wide screens.">
                    <SegmentedControl
                        value={ty.displaySize || 'lg'}
                        onChange={v => setTypography('displaySize', v)}
                        options={[
                            { value: 'md', label: '64px' },
                            { value: 'lg', label: '80px' },
                            { value: 'xl', label: '96px' },
                        ]}
                    />
                </FieldRow>
                <FieldRow label="Heading weight" hint="Premium sites keep headings at 500–600, never heavy bold.">
                    <SegmentedControl
                        value={String(ty.headingWeight || 600)}
                        onChange={v => setTypography('headingWeight', Number(v))}
                        options={[
                            { value: '500', label: '500' },
                            { value: '600', label: '600' },
                            { value: '700', label: '700' },
                        ]}
                    />
                </FieldRow>
                <FieldRow label="Body size">
                    <SegmentedControl
                        value={String(ty.bodySize || 16)}
                        onChange={v => setTypography('bodySize', Number(v))}
                        options={[
                            { value: '16', label: '16px' },
                            { value: '17', label: '17px' },
                            { value: '18', label: '18px' },
                        ]}
                    />
                </FieldRow>

                <SectionDivider label="Motion & texture" />
                <FieldSelect
                    label="Motion level"
                    value={['none', 'subtle', 'full'].includes(d.motion) ? d.motion : 'full'}
                    options={[
                        { value: 'full',   label: 'Full — reveals, ambience, marquee' },
                        { value: 'subtle', label: 'Subtle — quiet reveals only' },
                        { value: 'none',   label: 'None — completely static' },
                    ]}
                    onChange={v => onChange({ ...d, motion: v })}
                />
                <FieldRow label="Grain texture" hint="A barely-visible film-grain overlay — adds tactility to flat color fields.">
                    <Toggle label={d.grain ? 'On' : 'Off'} value={d.grain === true} onChange={v => onChange({ ...d, grain: v === true })} />
                </FieldRow>

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

                <SectionDivider label="Buttons" />
                <FieldRow label="Shape" hint="Sharp also flattens shadows and pills across the site — the whole flat idiom, not just square corners.">
                    <SegmentedControl
                        value={cp.buttonShape || 'soft'}
                        onChange={v => setComponent('buttonShape', v)}
                        options={[
                            { value: 'pill',    label: 'Pill' },
                            { value: 'soft',    label: 'Soft' },
                            { value: 'rounded', label: 'Rounded' },
                            { value: 'sharp',   label: 'Sharp' },
                        ]}
                    />
                </FieldRow>
                <FieldRow label="Size">
                    <SegmentedControl
                        value={cp.buttonSize || 'md'}
                        onChange={v => setComponent('buttonSize', v)}
                        options={[
                            { value: 'sm', label: 'Small' },
                            { value: 'md', label: 'Medium' },
                            { value: 'lg', label: 'Large' },
                        ]}
                    />
                </FieldRow>
                <FieldRow label="Label color" hint="White fails contrast on light brand colors like amber. 'Auto' picks black or white from your Primary's brightness.">
                    <SegmentedControl
                        value={cp.buttonTextColor || 'light'}
                        onChange={v => setComponent('buttonTextColor', v)}
                        options={[
                            { value: 'light', label: 'White' },
                            { value: 'dark',  label: 'Black' },
                            { value: 'auto',  label: 'Auto' },
                        ]}
                    />
                </FieldRow>
                <ContrastBadge
                    fg={cp.buttonTextColor === 'dark' ? '#0B0B0C' : '#FFFFFF'}
                    bg={d.colors.primary}
                    label="Button label on primary"
                />

                <SectionDivider label="Navigation" />
                <FieldRow label="Style" hint="Floating detaches the bar into a rounded pill and swaps the underline hover for a chip.">
                    <SegmentedControl
                        value={cp.navStyle || 'bar'}
                        onChange={v => setComponent('navStyle', v)}
                        options={[
                            { value: 'bar',      label: 'Bar' },
                            { value: 'floating', label: 'Floating' },
                            { value: 'bordered', label: 'Bordered' },
                        ]}
                    />
                </FieldRow>
                <FieldRow label="Height">
                    <SegmentedControl
                        value={cp.navHeight || 'default'}
                        onChange={v => setComponent('navHeight', v)}
                        options={[
                            { value: 'compact', label: '60px' },
                            { value: 'default', label: '72px' },
                            { value: 'tall',    label: '88px' },
                        ]}
                    />
                </FieldRow>
                <FieldRow label="Logo size">
                    <SegmentedControl
                        value={cp.logoSize || 'md'}
                        onChange={v => setComponent('logoSize', v)}
                        options={[
                            { value: 'sm', label: 'Small' },
                            { value: 'md', label: 'Medium' },
                            { value: 'lg', label: 'Large' },
                        ]}
                    />
                </FieldRow>

                <SectionDivider label="Cards" />
                <FieldRow label="Style" hint="Hairline = 1px border, no shadow. Flat = filled, borderless. Elevated = shadowed.">
                    <SegmentedControl
                        value={cp.cardStyle || 'hairline'}
                        onChange={v => setComponent('cardStyle', v)}
                        options={[
                            { value: 'hairline', label: 'Hairline' },
                            { value: 'soft',     label: 'Soft' },
                            { value: 'flat',     label: 'Flat' },
                            { value: 'elevated', label: 'Elevated' },
                        ]}
                    />
                </FieldRow>
                <FieldRow label="Padding">
                    <SegmentedControl
                        value={cp.cardPadding || 'default'}
                        onChange={v => setComponent('cardPadding', v)}
                        options={[
                            { value: 'compact', label: 'Compact' },
                            { value: 'default', label: 'Default' },
                            { value: 'roomy',   label: 'Roomy' },
                        ]}
                    />
                </FieldRow>
                <FieldRow label="Shadow depth">
                    <SegmentedControl
                        value={cp.shadow || 'soft'}
                        onChange={v => setComponent('shadow', v)}
                        options={[
                            { value: 'none',   label: 'None' },
                            { value: 'soft',   label: 'Soft' },
                            { value: 'medium', label: 'Medium' },
                            { value: 'strong', label: 'Strong' },
                        ]}
                    />
                </FieldRow>

                <SectionDivider label="Layout" />
                <FieldRow label="Content width" hint="The max width every section aligns to.">
                    <SegmentedControl
                        value={ly.containerWidth || 'default'}
                        onChange={v => setLayout('containerWidth', v)}
                        options={[
                            { value: 'narrow',  label: '1120' },
                            { value: 'default', label: '1280' },
                            { value: 'wide',    label: '1440' },
                            { value: 'full',    label: '1760' },
                        ]}
                    />
                </FieldRow>
                <FieldRow label="Section rhythm" hint="Site-wide vertical spacing between sections. Individual sections can still override this in their Style tab.">
                    <SegmentedControl
                        value={ly.sectionRhythm || 'default'}
                        onChange={v => setLayout('sectionRhythm', v)}
                        options={[
                            { value: 'tight',   label: 'Tight' },
                            { value: 'default', label: 'Default' },
                            { value: 'airy',    label: 'Airy' },
                        ]}
                    />
                </FieldRow>
            </div>
        </div>
    );
}

// ── small UI atoms (kept local so the panel stays as the only consumer) ──

// Pure-CSS mini site painted from the preset's own values — honest
// preview, no iframe. Dark presets preview their dark palette.
function PresetCard({ preset, active, onApply }) {
    const p = preset.design;
    const dark = p.theme === 'dark';
    const bg      = dark ? p.darkColors.background   : p.colors.background;
    const surface = dark ? p.darkColors.surface      : p.colors.surface;
    const text    = dark ? p.darkColors.textPrimary  : p.colors.textPrimary;
    const muted   = dark ? p.darkColors.textSecondary : p.colors.textSecondary;
    const line = (w, c, h = 5) => (
        <div style={{ width: w, height: h, borderRadius: 3, background: c }} />
    );

    // Preview the SHAPE decisions too, not just color + heading font —
    // otherwise eight themes look nearly identical in the gallery.
    const comp = p.components || {};
    const btnRadius = { pill: 999, soft: 8, rounded: 3, sharp: 0 }[comp.buttonShape] ?? 8;
    const cardRadius = comp.cardStyle === 'soft' ? 7 : comp.buttonShape === 'sharp' ? 0 : 4;
    const floating = comp.navStyle === 'floating';
    const cardBorder = comp.cardStyle === 'flat' ? 'none' : `1px solid ${muted}33`;
    const cardShadow = comp.cardStyle === 'elevated' ? `0 2px 5px ${muted}44` : 'none';
    const btnFg = comp.buttonTextColor === 'dark' ? '#0B0B0C' : '#fff';

    return (
        <button
            type="button"
            onClick={onApply}
            title={preset.description}
            className={`text-left rounded-lg border transition-colors ${active
                ? 'border-[var(--accent-primary)] ring-1 ring-[var(--accent-primary)]'
                : 'border-[var(--border-default)] hover:border-[var(--text-muted)]'}`}
        >
            <div style={{ background: bg, borderRadius: '7px 7px 0 0', padding: 10 }}>
                {/* mini header — floating themes show a detached inset pill */}
                <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    marginBottom: 8,
                    ...(floating ? {
                        background: surface,
                        border: `1px solid ${muted}33`,
                        borderRadius: 999,
                        padding: '3px 6px',
                        margin: '0 3px 8px',
                    } : {}),
                    ...(comp.navStyle === 'bordered' ? {
                        borderBottom: `1px solid ${muted}44`,
                        paddingBottom: 5,
                    } : {}),
                }}>
                    {line(20, text, 4)}
                    <div style={{
                        width: 20, height: 7,
                        borderRadius: Math.min(btnRadius, 4),
                        background: p.gradient
                            ? `linear-gradient(135deg, ${p.colors.primary}, ${p.colors.accent})`
                            : p.colors.primary,
                    }} />
                </div>
                {/* mini hero */}
                <div style={{ fontFamily: fontStack(p.fonts.heading), color: text, fontSize: 11, fontWeight: p.typography.headingWeight, lineHeight: 1.15, marginBottom: 5 }}>
                    Your AI. Your rules.
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 6 }}>
                    {line('80%', muted, 3)}
                    {line('62%', muted, 3)}
                </div>
                {/* mini CTA — carries the button shape + label color */}
                <div style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    height: 13, padding: '0 9px', marginBottom: 7,
                    borderRadius: btnRadius,
                    background: p.gradient
                        ? `linear-gradient(135deg, ${p.colors.primary}, ${p.colors.accent})`
                        : p.colors.primary,
                    color: btnFg, fontSize: 7, fontWeight: 600,
                    fontFamily: fontStack(p.fonts.body),
                }}>
                    Get started
                </div>
                {/* mini cards — carry the card recipe */}
                <div style={{ display: 'flex', gap: 4 }}>
                    <div style={{ flex: 1, height: 16, borderRadius: cardRadius, background: surface, border: cardBorder, boxShadow: cardShadow }} />
                    <div style={{ flex: 1, height: 16, borderRadius: cardRadius, background: surface, border: cardBorder, boxShadow: cardShadow }} />
                </div>
            </div>
            <div className="px-2.5 py-1.5 text-[11px] font-medium text-[var(--text-primary)] flex items-center justify-between">
                {preset.label}
                {active ? <span className="text-[10px] text-[var(--accent-primary)]">Active</span> : null}
            </div>
        </button>
    );
}

// Advisory WCAG contrast hint — warns, never blocks.
function ContrastBadge({ fg, bg, label }) {
    const ratio = contrastRatio(fg, bg);
    if (ratio === null) return null;
    const rounded = Math.round(ratio * 10) / 10;
    const good = ratio >= 4.5;
    const okLarge = ratio >= 3;
    const tone = good ? 'text-emerald-600' : okLarge ? 'text-amber-500' : 'text-red-500';
    const verdict = good ? 'AA' : okLarge ? 'AA (large text only)' : 'Low contrast';
    return (
        <div className={`-mt-1 mb-2 text-[10px] ${tone}`} title={label}>
            {verdict} · {rounded}:1{good ? '' : ` — ${label} may be hard to read`}
        </div>
    );
}

// One-glance pairing check: display / heading / body / eyebrow samples in
// the chosen faces on the chosen background.
function TypeScalePreview({ design }) {
    const bg = design.theme === 'dark'
        ? (design.darkColors?.background || '#101012')
        : design.colors.background;
    const text = design.theme === 'dark'
        ? (design.darkColors?.textPrimary || '#F4F2EE')
        : design.colors.textPrimary;
    const muted = design.theme === 'dark'
        ? (design.darkColors?.textSecondary || '#A6A29A')
        : design.colors.textSecondary;
    const weight = design.typography?.headingWeight || 600;
    return (
        <div className="rounded-md border border-[var(--border-default)] overflow-hidden mb-2">
            <div style={{ background: bg, padding: '12px 14px' }}>
                <div style={{ fontFamily: fontStack(design.fonts.heading), fontWeight: weight, fontSize: 22, lineHeight: 1.1, letterSpacing: '-0.02em', color: text }}>
                    Display headline
                </div>
                <div style={{ fontFamily: fontStack(design.fonts.heading), fontWeight: weight, fontSize: 14, marginTop: 6, color: text }}>
                    Section heading
                </div>
                <div style={{ fontFamily: fontStack(design.fonts.body), fontSize: 11, lineHeight: 1.5, marginTop: 6, color: muted }}>
                    Body copy set in the paragraph face, sized for reading.
                </div>
                <div style={{ fontFamily: fontStack(design.fonts.mono || 'IBM Plex Mono'), fontSize: 8.5, letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 7, color: muted }}>
                    01 — Eyebrow label
                </div>
            </div>
        </div>
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
