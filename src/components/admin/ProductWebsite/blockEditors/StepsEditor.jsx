import React from 'react';
import { TextField, ImageField, RepeatableList, FieldRow } from '../fields';
import { InlineHint, ColorSwatch, BackgroundCard } from '../primitives';
import VariantPicker from './VariantPicker';
import { set, SectionHeaderFields } from './shared';

// ── Steps ─────────────────────────────────────────────────────────────

export function StepsEditor({ data = {}, onChange }) {
    const chapters = data.variant === 'chapters';
    return (
        <>
            <VariantPicker
                type="steps"
                value={data.variant}
                onChange={v => onChange(set(data, 'variant', v))}
            />
            <InlineHint>Click any step's number, title, body, or example in the preview to edit.</InlineHint>
            <SectionHeaderFields data={data} onChange={onChange} persistScope="steps" />
            <RepeatableList
                label="Steps"
                items={data.items || []}
                onChange={v => onChange(set(data, 'items', v))}
                makeNew={() => ({ number: '', title: 'New step', body: '', example: '', media: { src: '', srcDark: '', alt: '', frame: 'hairline', kind: 'image' } })}
                itemLabel={(item) => item.title || '(no title)'}
                renderItem={(item, update) => (
                    <>
                        <TextField
                            label="Number"
                            value={item.number || ''}
                            onChange={v => update({ ...item, number: v })}
                            placeholder="e.g. 1"
                        />
                        <TextField
                            label="Title"
                            value={item.title || ''}
                            onChange={v => update({ ...item, title: v })}
                            align={item.titleAlign || 'left'}
                            onAlignChange={v => update({ ...item, titleAlign: v })}
                        />
                        <TextField
                            label="Body"
                            value={item.body || ''}
                            onChange={v => update({ ...item, body: v })}
                            placeholder="Describe what happens in this step."
                            align={item.bodyAlign || 'left'}
                            onAlignChange={v => update({ ...item, bodyAlign: v })}
                        />
                        <TextField
                            label="Example"
                            value={item.example || ''}
                            onChange={v => update({ ...item, example: v })}
                            placeholder="Optional caption / example"
                            align={item.exampleAlign || 'left'}
                            onAlignChange={v => update({ ...item, exampleAlign: v })}
                        />
                        {chapters ? (
                            <FieldRow label="Screenshot" hint="Chapters alternate sides automatically. A real product shot per chapter is what makes this layout work.">
                                <ImageField
                                    value={item.media?.src || ''}
                                    onChange={v => update({ ...item, media: { ...(item.media || {}), src: v, frame: item.media?.frame || 'hairline', kind: 'image' } })}
                                />
                            </FieldRow>
                        ) : null}
                        {/* Per-step title color — single hex string. */}
                        <FieldRow label="Title color">
                            <ColorSwatch
                                value={item.titleColor || ''}
                                onChange={v => update({ ...item, titleColor: v })}
                                title="Step title color"
                            />
                        </FieldRow>
                    </>
                )}
                addLabel="Add step"
            />
            <BackgroundCard data={data} onChange={onChange} persistKey="blk.steps.background" />
        </>
    );
}
