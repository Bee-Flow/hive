import React from 'react';
import { TextField, IconField, ImageField, RepeatableList, FieldRow, Toggle } from '../fields';
import { InlineHint, ColorSwatch, BackgroundCard, SegmentedControl } from '../primitives';
import VariantPicker from './VariantPicker';
import { set, SectionHeaderFields, CardActionFields } from './shared';

// ── Features ──────────────────────────────────────────────────────────

export function FeaturesEditor({ data = {}, onChange }) {
    const isBento = data.variant === 'bento';
    return (
        <>
            <VariantPicker
                type="features"
                value={data.variant}
                onChange={v => onChange(set(data, 'variant', v))}
            />
            {isBento ? (
                <Toggle
                    label="Spotlight hover"
                    value={data.spotlight === true}
                    onChange={v => onChange(set(data, 'spotlight', v))}
                />
            ) : null}
            <InlineHint>Eyebrow, title, lead, and each card's title and body are editable in the preview.</InlineHint>
            <SectionHeaderFields data={data} onChange={onChange} persistScope="features" />
            <RepeatableList
                label="Feature cards"
                items={data.items || []}
                onChange={v => onChange(set(data, 'items', v))}
                makeNew={() => ({ icon: 'Sparkles', title: 'New feature', body: '', popupEmbed: '', cardAction: 'none', cardUrl: '', span: 1, media: { src: '', srcDark: '', alt: '', frame: 'hairline', kind: 'image' } })}
                itemLabel={(item) => item.title || '(no title)'}
                // Deep-clone via JSON so future nested fields (e.g. a per-card
                // style sub-object) can't share references between the source
                // and its duplicate. Appending " (copy)" gives the user an
                // obvious visual cue for which card is the clone.
                duplicateItem={(item) => ({
                    ...JSON.parse(JSON.stringify(item)),
                    title: `${item.title || 'Feature'} (copy)`,
                })}
                renderItem={(item, update) => (
                    <>
                        {isBento ? (
                            <>
                                <FieldRow label="Card width" hint="Wide cards anchor the bento grid — usually just the first one.">
                                    <SegmentedControl
                                        value={Number(item.span) === 2 ? '2' : '1'}
                                        onChange={v => update({ ...item, span: Number(v) })}
                                        options={[
                                            { value: '1', label: 'Normal' },
                                            { value: '2', label: 'Wide' },
                                        ]}
                                    />
                                </FieldRow>
                                <FieldRow label="Card media" hint="A UI fragment or mini-diagram turns an icon card into a product card.">
                                    <ImageField
                                        value={item.media?.src || ''}
                                        onChange={v => update({ ...item, media: { ...(item.media || {}), src: v, frame: item.media?.frame || 'hairline', kind: 'image' } })}
                                    />
                                </FieldRow>
                            </>
                        ) : null}
                        <IconField label="Icon" value={item.icon} onChange={v => update({ ...item, icon: v })} />
                        {/* Card title + body — also inline-editable in the
                            preview, but the editor needs explicit inputs so
                            users can fill them in before the card is
                            rendered (newly added cards start empty and
                            have nothing to click in the preview). */}
                        <TextField
                            label="Title"
                            value={item.title || ''}
                            onChange={v => update({ ...item, title: v })}
                            placeholder="Feature title"
                            align={item.titleAlign || 'left'}
                            onAlignChange={v => update({ ...item, titleAlign: v })}
                        />
                        <TextField
                            label="Body"
                            value={item.body ?? item.description ?? ''}
                            onChange={v => update({ ...item, body: v })}
                            placeholder="Describe this feature"
                            align={item.bodyAlign || 'left'}
                            onAlignChange={v => update({ ...item, bodyAlign: v })}
                        />
                        {/* Per-card text colors. Single hex string, no
                            sub-object — matches the spec for these two
                            fields specifically. Empty = inherit. */}
                        <FieldRow label="Title color">
                            <ColorSwatch
                                value={item.titleColor || ''}
                                onChange={v => update({ ...item, titleColor: v })}
                                title="Card title color"
                            />
                        </FieldRow>
                        <FieldRow label="Body color">
                            <ColorSwatch
                                value={item.bodyColor || ''}
                                onChange={v => update({ ...item, bodyColor: v })}
                                title="Card body color"
                            />
                        </FieldRow>
                        {/* Card action — none/link/popup. Drives the
                            renderer's per-card behaviour: link wraps the
                            card in an <a>; popup opens a modal with a
                            sandboxed iframe; none leaves the card static. */}
                        <CardActionFields item={item} update={update} />
                    </>
                )}
                addLabel="Add card"
            />
            <BackgroundCard data={data} onChange={onChange} persistKey="blk.features.background" />
        </>
    );
}
