import React from 'react';
import { TextField, ImageField, RepeatableList, FieldRow } from '../fields';
import { InlineHint, BackgroundCard } from '../primitives';
import VariantPicker from './VariantPicker';
import { set, SectionHeaderFields } from './shared';

// ── Testimonials ──────────────────────────────────────────────────────
//
// Quantified social proof: name + role + company always, optional metric
// per item ('case' layout leads with it), NEVER star ratings. 'spotlight'
// renders only the first item — oversized photo (avatarSrc) + quote.

export function TestimonialsEditor({ data = {}, onChange }) {
    const isCase = data.variant === 'case';
    const isSpotlight = data.variant === 'spotlight';
    return (
        <>
            <VariantPicker
                type="testimonials"
                value={data.variant}
                onChange={v => onChange(set(data, 'variant', v))}
            />
            <InlineHint>
                Quotes, names, roles and companies are editable in the preview.
                {isSpotlight ? ' Spotlight shows only the first testimonial — give it a large photo.' : ''}
                {isCase ? ' Case cards lead with the metric — a hard number sells better than adjectives.' : ''}
            </InlineHint>
            <SectionHeaderFields data={data} onChange={onChange} showLead={false} persistScope="testimonials" />
            <RepeatableList
                label="Testimonials"
                items={data.items || []}
                onChange={v => onChange(set(data, 'items', v))}
                makeNew={() => ({ quote: '', name: '', role: '', company: '', avatarSrc: '', logoSrc: '', metric: { number: '', label: '' } })}
                itemLabel={(item) => item.name || '(no name)'}
                renderItem={(item, update) => (
                    <>
                        <TextField
                            label="Quote"
                            value={item.quote || ''}
                            onChange={v => update({ ...item, quote: v })}
                            placeholder="What did they say?"
                        />
                        <TextField
                            label="Name"
                            value={item.name || ''}
                            onChange={v => update({ ...item, name: v })}
                            placeholder="Jane Jansen"
                        />
                        <TextField
                            label="Role"
                            value={item.role || ''}
                            onChange={v => update({ ...item, role: v })}
                            placeholder="Head of Operations"
                        />
                        <TextField
                            label="Company"
                            value={item.company || ''}
                            onChange={v => update({ ...item, company: v })}
                            placeholder="Company name"
                        />
                        <FieldRow
                            label="Photo"
                            hint={isSpotlight
                                ? 'The spotlight layout renders this large — use a real photo, landscape or square.'
                                : 'Shown as a 28px round avatar; empty = an initial chip.'}
                        >
                            <ImageField
                                value={item.avatarSrc || ''}
                                onChange={v => update({ ...item, avatarSrc: v })}
                            />
                        </FieldRow>
                        <FieldRow label="Company logo" hint="Optional — rendered small and monochrome next to the attribution.">
                            <ImageField
                                value={item.logoSrc || ''}
                                onChange={v => update({ ...item, logoSrc: v })}
                            />
                        </FieldRow>
                        {isCase ? (
                            <>
                                <TextField
                                    label="Metric"
                                    value={item.metric?.number || ''}
                                    onChange={v => update({ ...item, metric: { ...(item.metric || {}), number: v } })}
                                    placeholder="2.4×"
                                />
                                <TextField
                                    label="Metric label"
                                    value={item.metric?.label || ''}
                                    onChange={v => update({ ...item, metric: { ...(item.metric || {}), label: v } })}
                                    placeholder="faster reporting"
                                />
                            </>
                        ) : null}
                    </>
                )}
                addLabel="Add testimonial"
            />
            <BackgroundCard data={data} onChange={onChange} persistKey="blk.testimonials.background" />
        </>
    );
}
