import React from 'react';
import { TextField, Toggle } from '../fields';
import {
    InlineHint,
    CollapsibleCard,
    StyleTriplet,
    FieldSelect,
    BackgroundVariantSelect,
} from '../primitives';
import { set, CtaButtonField } from './shared';

// ── CTA Banner ───────────────────────────────────────────────────────

export function CtaBannerEditor({ data = {}, pages = [], onChange }) {
    const setField = (key, value) => onChange(set(data, key, value));
    const primary  = data.primaryCta || { label: '', link: { kind: 'external', url: '' } };
    const showSecondary = !!data.secondaryCta;

    const toggleSecondary = (next) => setField('secondaryCta',
        next ? { label: 'Learn more', link: { kind: 'anchor', anchor: '' } } : null);

    return (
        <>
            <InlineHint>Click heading and subheading in the preview to edit inline.</InlineHint>

            <CollapsibleCard title="Text" defaultOpen={true} persistKey="blk.cta-banner.text">
                <TextField
                    label="Heading"
                    value={data.heading || ''}
                    onChange={v => setField('heading', v)}
                    placeholder="Heading"
                    align={data.headingAlign || data.align || 'left'}
                    onAlignChange={v => setField('headingAlign', v)}
                />
                <TextField
                    label="Subheading"
                    value={data.subheading || ''}
                    onChange={v => setField('subheading', v)}
                    placeholder="Subheading"
                    align={data.subheadingAlign || data.align || 'left'}
                    onAlignChange={v => setField('subheadingAlign', v)}
                />
            </CollapsibleCard>

            <FieldSelect
                label="Layout"
                value={data.layout || 'centered'}
                options={[
                    { value: 'centered', label: 'Centered' },
                    { value: 'split',    label: 'Split (heading left, CTAs right)' },
                ]}
                onChange={v => setField('layout', v)}
            />

            <BackgroundVariantSelect
                label="Background"
                value={data.backgroundVariant || 'primary'}
                onChange={v => setField('backgroundVariant', v)}
            />

            <CollapsibleCard title="Primary CTA" persistKey="blk.cta-banner.primary-cta">
                <CtaButtonField
                    value={primary}
                    pages={pages}
                    onChange={v => setField('primaryCta', v)}
                    label="Primary CTA"
                />
            </CollapsibleCard>

            <Toggle label="Show secondary CTA" value={showSecondary} onChange={toggleSecondary} />

            {showSecondary ? (
                <CollapsibleCard title="Secondary CTA" persistKey="blk.cta-banner.secondary-cta">
                    <CtaButtonField
                        value={data.secondaryCta || {}}
                        pages={pages}
                        onChange={v => setField('secondaryCta', v)}
                        label="Secondary CTA"
                    />
                </CollapsibleCard>
            ) : null}

            {/* Text styles — heading + subheading only (CTA Banner has
                no body paragraph; its text is just headline + tagline). */}
            <CollapsibleCard title="Text styles" defaultOpen={false} persistKey="blk.cta-banner.text-styles">
                <StyleTriplet
                    label="Heading"
                    value={data.headingStyle}
                    onChange={v => setField('headingStyle', v)}
                    sample={data.heading || 'Heading preview'}
                    weight={700}
                    min={12} max={96}
                />
                <StyleTriplet
                    label="Subheading"
                    value={data.subheadingStyle}
                    onChange={v => setField('subheadingStyle', v)}
                    sample={data.subheading || 'Subheading preview'}
                    weight={500}
                    min={10} max={48}
                />
            </CollapsibleCard>
        </>
    );
}
