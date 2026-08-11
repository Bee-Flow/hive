import React from 'react';
import { TextField, IconField, RepeatableList } from '../fields';
import { InlineHint, BackgroundCard } from '../primitives';
import VariantPicker from './VariantPicker';
import { set, SectionHeaderFields } from './shared';

// ── Trust band ────────────────────────────────────────────────────────
//
// Monochrome institutional chips (GDPR / zero-knowledge / fair-code
// register). 'chips' hides sublabels; 'detailed' grows each chip into a
// small card that shows them. A chip with a link renders as an external
// link (new tab) — point it at something verifiable.

export function TrustBandEditor({ data = {}, onChange }) {
    const detailed = data.variant === 'detailed';
    return (
        <>
            <VariantPicker
                type="trust-band"
                value={data.variant}
                onChange={v => onChange(set(data, 'variant', v))}
            />
            <InlineHint>
                Chip labels{detailed ? ' and sublabels' : ''} are editable in the preview.
                {detailed ? '' : ' Sublabels stay hidden on this layout — switch to Detailed to show them.'}
            </InlineHint>
            <SectionHeaderFields data={data} onChange={onChange} showLead={false} persistScope="trust-band" />
            <RepeatableList
                label="Chips"
                items={data.chips || []}
                onChange={v => onChange(set(data, 'chips', v))}
                makeNew={() => ({ icon: 'BadgeCheck', label: 'New claim', sublabel: '', href: '' })}
                itemLabel={(item) => item.label || '(no label)'}
                renderItem={(item, update) => (
                    <>
                        <IconField
                            label="Icon"
                            value={item.icon}
                            onChange={v => update({ ...item, icon: v })}
                        />
                        <TextField
                            label="Label"
                            value={item.label || ''}
                            onChange={v => update({ ...item, label: v })}
                            placeholder="GDPR-compliant"
                        />
                        <TextField
                            label="Sublabel"
                            value={item.sublabel || ''}
                            onChange={v => update({ ...item, sublabel: v })}
                            placeholder="EU data residency"
                        />
                        <TextField
                            label="Link"
                            value={item.href || ''}
                            onChange={v => update({ ...item, href: v })}
                            placeholder="https://…"
                            hint="Optional — a linked claim opens in a new tab. Link to something verifiable."
                        />
                    </>
                )}
                addLabel="Add chip"
            />
            <BackgroundCard data={data} onChange={onChange} persistKey="blk.trust-band.background" />
        </>
    );
}
