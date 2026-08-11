import React from 'react';
import { TextField, Toggle } from '../fields';
import { InlineHint, CollapsibleCard, BackgroundCard } from '../primitives';
import { set, CtaButtonField } from './shared';

// ── CTA ───────────────────────────────────────────────────────────────

export function CTAEditor({ data = {}, pages = [], onChange }) {
    const button = data.button || {};
    const hasSecondary = !!data.secondaryCta;
    return (
        <>
            <InlineHint>Title, lead, and button label are editable in the preview.</InlineHint>
            <Toggle
                label="Hexagon motif backdrop"
                value={data.showMotif !== false}
                onChange={v => onChange(set(data, 'showMotif', v))}
            />
            <CollapsibleCard title="Text" defaultOpen={true} persistKey="blk.cta.text">
                <TextField
                    label="Title"
                    value={data.title || ''}
                    onChange={v => onChange(set(data, 'title', v))}
                    placeholder="Call to action title"
                    align={data.titleAlign || data.align || 'left'}
                    onAlignChange={v => onChange(set(data, 'titleAlign', v))}
                />
                <TextField
                    label="Lead"
                    value={data.lead || ''}
                    onChange={v => onChange(set(data, 'lead', v))}
                    placeholder="Supporting line"
                    align={data.leadAlign || data.align || 'left'}
                    onAlignChange={v => onChange(set(data, 'leadAlign', v))}
                />
            </CollapsibleCard>
            <CtaButtonField
                value={button}
                pages={pages}
                onChange={v => onChange(set(data, 'button', v))}
                label="Button"
            />
            <CollapsibleCard title="Secondary button (ghost)" persistKey="blk.cta.secondary">
                <Toggle
                    label="Show secondary button"
                    value={hasSecondary}
                    onChange={v => onChange(set(data, 'secondaryCta',
                        v ? { label: 'Learn more', link: { kind: 'anchor', anchor: '' } } : null))}
                />
                {hasSecondary ? (
                    <CtaButtonField
                        value={data.secondaryCta}
                        pages={pages}
                        onChange={v => onChange(set(data, 'secondaryCta', v))}
                        label="Secondary button"
                    />
                ) : null}
            </CollapsibleCard>
            <BackgroundCard data={data} onChange={onChange} persistKey="blk.cta.background" />
        </>
    );
}
