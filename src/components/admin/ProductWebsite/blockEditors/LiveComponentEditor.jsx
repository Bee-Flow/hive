import React from 'react';
import { TextField, Toggle, LinkField, FieldRow } from '../fields';
import {
    InlineHint,
    CollapsibleCard,
    StyleTriplet,
    FieldSelect,
    CtaStyleSelect,
    MonoTextarea,
} from '../primitives';
import { set } from './shared';

// ── Live Component ────────────────────────────────────────────────────
//
// Single textarea — the user pastes a full HTML document (or just a
// snippet with <style>/<script> tags). The renderer drops it into an
// `srcDoc` iframe sandboxed to `allow-scripts` only, so untrusted code
// can't reach back into the parent page.

export function LiveComponentEditor({ data = {}, pages = [], onChange }) {
    const setField = (key, value) => onChange(set(data, key, value));
    const layout   = data.layout || 'full';
    const cta      = data.cta || {};
    const ctaOn    = cta.enabled !== false;
    const setCta   = (patch) => onChange(set(data, 'cta', { ...cta, ...patch }));

    // Font-weight options for the Heading / Body typography cards. The
    // shared StyleTriplet only covers font / size / color, so weight is a
    // sibling FieldSelect that writes `fontWeight` onto the same *Style
    // blob. '' (Default) = inherit — the renderer skips it like the other
    // empty StyleTriplet fields.
    const WEIGHT_OPTIONS = [
        { value: '',    label: 'Default (inherit)' },
        { value: '300', label: 'Light (300)' },
        { value: '400', label: 'Regular (400)' },
        { value: '500', label: 'Medium (500)' },
        { value: '600', label: 'Semibold (600)' },
        { value: '700', label: 'Bold (700)' },
        { value: '800', label: 'Extrabold (800)' },
    ];
    const weightValue = (s) => (s && s.fontWeight ? String(s.fontWeight) : '');
    const setWeight   = (key, s, v) => setField(key, { ...(s || {}), fontWeight: Number(v) || 0 });

    return (
        <>
            <InlineHint>
                Paste any self-contained HTML / CSS / JS snippet — useful for
                AI-built animations or custom widgets that don't fit the other
                blocks. Runs in a sandboxed iframe.
            </InlineHint>

            {/* Layout picker — always visible, no collapse. */}
            <FieldRow label="Layout">
                <LayoutPicker value={layout} onChange={v => setField('layout', v)} />
            </FieldRow>

            <CollapsibleCard title="Component" defaultOpen={true} persistKey="blk.live-component.component">
                <FieldRow label="Code" hint="Paste full HTML including <style> and <script> tags.">
                    <MonoTextarea
                        rows={16}
                        minHeight={320}
                        value={data.code || ''}
                        onChange={v => setField('code', v)}
                        placeholder={'<!-- Paste your HTML/CSS/JS here -->'}
                    />
                </FieldRow>
            </CollapsibleCard>

            {layout === 'two-components' ? (
                <CollapsibleCard title="Second component" persistKey="blk.live-component.second-component">
                    <FieldRow label="Code" hint="Paste full HTML including <style> and <script> tags.">
                        <MonoTextarea
                            rows={16}
                            minHeight={320}
                            value={data.codeRight || ''}
                            onChange={v => setField('codeRight', v)}
                            placeholder={'<!-- Paste your HTML/CSS/JS here -->'}
                        />
                    </FieldRow>
                </CollapsibleCard>
            ) : null}

            {layout === 'component-text' ? (
                <CollapsibleCard title="Text" persistKey="blk.live-component.text">
                    <TextField
                        label="Heading"
                        value={data.heading || ''}
                        onChange={v => setField('heading', v)}
                        placeholder="Section heading"
                        align={data.headingAlign || 'left'}
                        onAlignChange={v => setField('headingAlign', v)}
                    />
                    <TextField
                        label="Body"
                        value={data.body || ''}
                        onChange={v => setField('body', v)}
                        placeholder="Short paragraph next to the component."
                        align={data.bodyAlign || 'left'}
                        onAlignChange={v => setField('bodyAlign', v)}
                    />
                </CollapsibleCard>
            ) : null}

            {layout === 'component-cta' ? (
                <CollapsibleCard title="CTA" persistKey="blk.live-component.cta">
                    <TextField
                        label="Heading"
                        value={data.heading || ''}
                        onChange={v => setField('heading', v)}
                        placeholder="Section heading"
                        align={data.headingAlign || 'left'}
                        onAlignChange={v => setField('headingAlign', v)}
                    />
                    <Toggle
                        label="Show CTA"
                        value={ctaOn}
                        onChange={v => setCta({ enabled: v })}
                    />
                    {ctaOn ? (
                        <>
                            <TextField
                                label="Label"
                                value={cta.label || ''}
                                onChange={v => setCta({ label: v })}
                                placeholder="Get started"
                            />
                            <LinkField
                                label="Destination"
                                value={cta.link}
                                pages={pages}
                                onChange={v => setCta({ link: v })}
                            />
                            <CtaStyleSelect
                                value={cta.style || 'primary'}
                                onChange={v => setCta({ style: v })}
                            />
                        </>
                    ) : null}
                </CollapsibleCard>
            ) : null}

            {/* Typography for the Heading / Body shown in the
                component-text and component-cta layouts. Mirrors the
                Content block's "Text styles" card — StyleTriplet covers
                font / size / color; font weight is an extra sibling
                control since StyleTriplet itself doesn't expose it. */}
            {(layout === 'component-text' || layout === 'component-cta') ? (
                <CollapsibleCard title="Text styles" defaultOpen={false} persistKey="blk.live-component.text-styles">
                    <StyleTriplet
                        label="Heading"
                        value={data.headingStyle}
                        onChange={v => setField('headingStyle', v)}
                        sample={data.heading || 'Heading preview'}
                        weight={700}
                        min={12} max={96}
                    />
                    <FieldSelect
                        label="Heading weight"
                        value={weightValue(data.headingStyle)}
                        options={WEIGHT_OPTIONS}
                        onChange={v => setWeight('headingStyle', data.headingStyle, v)}
                    />
                    {layout === 'component-text' ? (
                        <>
                            <StyleTriplet
                                label="Body"
                                value={data.bodyStyle}
                                onChange={v => setField('bodyStyle', v)}
                                sample={data.body || 'The quick brown fox jumps over the lazy dog.'}
                                weight={400}
                                min={10} max={32}
                            />
                            <FieldSelect
                                label="Body weight"
                                value={weightValue(data.bodyStyle)}
                                options={WEIGHT_OPTIONS}
                                onChange={v => setWeight('bodyStyle', data.bodyStyle, v)}
                            />
                        </>
                    ) : null}
                </CollapsibleCard>
            ) : null}
        </>
    );
}

// 2×2 layout picker — each option is a tile with a tiny SVG diagram of
// what that layout produces. Selected option gets an amber border + tint
// so the user can see at a glance which mode is active. Click sets
// `data.layout` via the parent's setField callback.
function LayoutPicker({ value, onChange }) {
    const OPTIONS = [
        { id: 'full',            label: 'Full width',     diagram: <DiagramFull /> },
        { id: 'two-components',  label: 'Two components', diagram: <DiagramTwo /> },
        { id: 'component-text',  label: 'Component + text', diagram: <DiagramText /> },
        { id: 'component-cta',   label: 'Component + CTA',  diagram: <DiagramCta /> },
    ];
    return (
        <div className="grid grid-cols-2 gap-2 w-full">
            {OPTIONS.map(opt => {
                const selected = value === opt.id;
                return (
                    <button
                        key={opt.id}
                        type="button"
                        onClick={() => onChange(opt.id)}
                        className={
                            'flex flex-col items-center gap-1.5 p-2 rounded-md border transition-colors text-left ' +
                            (selected
                                ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10'
                                : 'border-[var(--border-default)] bg-[var(--bg-tertiary)] hover:border-[var(--accent-primary)]/60')
                        }
                        aria-pressed={selected}
                    >
                        <div
                            className="w-full flex items-center justify-center rounded"
                            style={{
                                height: 44,
                                background: selected ? 'rgba(245, 166, 35, 0.06)' : 'var(--bg-secondary, #ffffff)',
                                border: '1px solid var(--border-subtle, rgba(15,23,42,0.08))',
                            }}
                        >
                            {opt.diagram}
                        </div>
                        <span className="text-[11px] text-[var(--text-secondary)] leading-tight">{opt.label}</span>
                    </button>
                );
            })}
        </div>
    );
}

// Tiny SVG diagrams for the layout picker. Same viewBox so they line
// up at the same scale. Kept inline because they're trivial and only
// the picker uses them.
const DIAGRAM_FILL_FRAME = 'rgba(15,23,42,0.18)';
const DIAGRAM_FILL_TEXT  = 'rgba(15,23,42,0.32)';
const DIAGRAM_FILL_CTA   = '#F5A623';
function DiagramFull() {
    return (
        <svg viewBox="0 0 60 30" width="56" height="28" aria-hidden="true">
            <rect x="2" y="4" width="56" height="22" rx="3" fill={DIAGRAM_FILL_FRAME} />
        </svg>
    );
}
function DiagramTwo() {
    return (
        <svg viewBox="0 0 60 30" width="56" height="28" aria-hidden="true">
            <rect x="2"  y="4" width="26" height="22" rx="3" fill={DIAGRAM_FILL_FRAME} />
            <rect x="32" y="4" width="26" height="22" rx="3" fill={DIAGRAM_FILL_FRAME} />
        </svg>
    );
}
function DiagramText() {
    return (
        <svg viewBox="0 0 60 30" width="56" height="28" aria-hidden="true">
            <rect x="2" y="4" width="26" height="22" rx="3" fill={DIAGRAM_FILL_FRAME} />
            <rect x="32" y="7"  width="24" height="3" rx="1.5" fill={DIAGRAM_FILL_TEXT} />
            <rect x="32" y="13" width="22" height="2" rx="1"   fill={DIAGRAM_FILL_TEXT} opacity="0.75" />
            <rect x="32" y="17" width="20" height="2" rx="1"   fill={DIAGRAM_FILL_TEXT} opacity="0.65" />
            <rect x="32" y="21" width="18" height="2" rx="1"   fill={DIAGRAM_FILL_TEXT} opacity="0.55" />
        </svg>
    );
}
function DiagramCta() {
    return (
        <svg viewBox="0 0 60 30" width="56" height="28" aria-hidden="true">
            <rect x="2"  y="4"  width="26" height="22" rx="3"   fill={DIAGRAM_FILL_FRAME} />
            <rect x="32" y="9"  width="20" height="3"  rx="1.5" fill={DIAGRAM_FILL_TEXT} />
            <rect x="32" y="17" width="14" height="6"  rx="3"   fill={DIAGRAM_FILL_CTA} />
        </svg>
    );
}
