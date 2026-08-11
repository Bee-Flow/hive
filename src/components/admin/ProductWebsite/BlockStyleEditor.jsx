import React from 'react';
import BackgroundControl from './controls/BackgroundControl';
import ColorControl from './controls/ColorControl';
import SpacingStepper from './controls/SpacingStepper';
import { getCapabilities } from './controls/styleCapabilities';
import { FieldRow, Toggle } from './fields';
import { SectionDivider, SegmentedControl } from './primitives';

/**
 * Per-block style overrides — Style sub-tab in pane B.
 *
 * Data shape (block.style):
 *   {
 *     colorOverrides: {
 *       primary, secondary, accent, background, surface, text, textSecondary
 *     },                              // missing/empty = inherit site.design
 *     spacing: { paddingTop, paddingBottom },   // CSS values, e.g. '3rem'
 *     backgroundImage: 'url-or-asset-key',
 *     backgroundOverlay: 'rgba(0,0,0,0.5)',     // single CSS color string
 *     maxWidth: 'narrow' | 'medium' | 'wide' | 'full',
 *     align:    'left' | 'center' | 'right',
 *     cssClass: '',
 *     // v2 knobs — capability-gated per block type (controls/styleCapabilities;
 *     // ALL capability flags ship OFF until WS1-P5 renderer support lands):
 *     columns: 2 | 3 | 4,             // missing = block's default grid
 *     reveal:  'on' | 'off',          // missing = site motion default
 *     glow:    true,                  // missing = no glow
 *   }
 *
 * Default (everything missing) = no inline style + no extra classes →
 * identical visual to no Style tab interaction.
 *
 * Hidden state lives on `block.enabled` (single source of truth, also driven
 * by the BlockList toggle). The "Hide this block" checkbox here calls
 * onToggleEnabled to flip it.
 *
 * `blockType` (threaded from PageInspector's activeBlock.type) selects which
 * v2 knobs render via getCapabilities().
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

// '' = Auto (removes the key → block's own default grid).
const COLUMN_OPTIONS = [
    { value: '', label: 'Auto', hint: 'Block default' },
    { value: 2,  label: '2',    hint: '2 columns' },
    { value: 3,  label: '3',    hint: '3 columns' },
    { value: 4,  label: '4',    hint: '4 columns' },
];

export default function BlockStyleEditor({ style, enabled = true, design, blockType, onChange, onToggleEnabled }) {
    const s = style || {};
    const overrides = s.colorOverrides || {};
    const spacing   = s.spacing || {};
    const siteColors = design?.colors || {};
    const caps = getCapabilities(blockType);

    const setOverride = (key, value) => {
        const next = { ...overrides };
        if (value === null || value === undefined || value === '') delete next[key];
        else next[key] = value;
        onChange({ ...s, colorOverrides: next });
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
                <ColorControl
                    key={t.key}
                    label={t.label}
                    hint={t.hint}
                    value={overrides[t.key] ?? ''}
                    inheritFrom={siteColors[t.designKey] || ''}
                    onChange={(v) => setOverride(t.key, v)}
                />
            ))}

            <SectionDivider label="Spacing" />
            <SpacingStepper
                spacing={spacing}
                onChange={(nextSpacing) => onChange({ ...s, spacing: nextSpacing })}
            />

            <SectionDivider label="Background" />
            <BackgroundControl
                image={s.backgroundImage || ''}
                overlay={s.backgroundOverlay || ''}
                onChangeImage={setBgImage}
                onChangeOverlay={setBgOverlay}
            />

            <SectionDivider label="Layout" />
            <FieldRow label="Max width">
                <SegmentedControl options={MAX_WIDTHS} value={s.maxWidth || 'full'} onChange={setMaxWidth} />
            </FieldRow>
            <FieldRow label="Text align">
                <SegmentedControl options={ALIGNS} value={s.align || 'left'} onChange={setAlign} iconOnly />
            </FieldRow>
            <CapabilityKnobs caps={caps} style={s} onChange={onChange} />

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

// The v2 knobs (columns / reveal / glow) — rendered only for block types
// whose capability flag is on (controls/styleCapabilities; all OFF until
// WS1-P5 renderer support lands). Columns rides at the end of the Layout
// section; Motion gets its own divider.
function CapabilityKnobs({ caps, style: s, onChange }) {
    const setColumns = (v) => {
        const next = { ...s };
        if (!v) delete next.columns;
        else next.columns = v;
        onChange(next);
    };
    const setReveal = (on) => onChange({ ...s, reveal: on ? 'on' : 'off' });
    const setGlow = (on) => {
        const next = { ...s };
        if (on) next.glow = true;
        else delete next.glow;
        onChange(next);
    };
    return (
        <>
            {caps.columns ? (
                <FieldRow label="Columns" hint="Grid columns for this block's cards.">
                    <SegmentedControl options={COLUMN_OPTIONS} value={s.columns || ''} onChange={setColumns} />
                </FieldRow>
            ) : null}
            {caps.motion ? (
                <>
                    <SectionDivider label="Motion" />
                    <Toggle label="Reveal on scroll" value={s.reveal === 'on'} onChange={setReveal} />
                    <Toggle label="Accent glow" value={!!s.glow} onChange={setGlow} />
                </>
            ) : null}
        </>
    );
}

function hasAnyOverride(s) {
    if (!s) return false;
    if (s.colorOverrides && Object.keys(s.colorOverrides).length) return true;
    if (s.spacing && Object.keys(s.spacing).length) return true;
    if (s.backgroundImage || s.backgroundOverlay) return true;
    if (s.maxWidth) return true;
    if (s.align) return true;
    if (s.cssClass) return true;
    if (s.columns) return true;
    if (s.reveal) return true;
    if (s.glow) return true;
    return false;
}

// SectionDivider + SegmentedControl come from ./primitives. Color override
// rows are the unified ColorControl (./controls/ColorControl); spacing is
// the SpacingStepper rhythm scale (./controls/SpacingStepper); background
// is BackgroundControl (./controls/BackgroundControl — the shared
// ImageField + one alpha ColorControl composing rgba via controls/colorUtils,
// plus the reserved band-variant slot). All of them write the exact same
// storage format the old free-text controls did.
