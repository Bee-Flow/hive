import React from 'react';
import { TextField, TextArea, IconField, RepeatableList, LinkField, Toggle } from '../fields';
import { InlineHint, BackgroundCard, FieldSelect, SectionDivider, mintId } from '../primitives';
import { set, SectionHeaderFields } from './shared';

// ── Roadmap ───────────────────────────────────────────────────────────
//
// Items are typed in any order and grouped into status buckets by the
// renderer. Nothing here sorts them, and nothing should: locale overrides
// address array items by numeric index, so reordering the list in the
// default locale drags every translation onto the wrong item.
//
// `status` is on the translation denylist in BOTH server/core/cmsTranslate.js
// and ../translatable.js — if it ever came off, the AI translator would turn
// 'beta' into 'bèta' and the item would fall out of every bucket.

const STATUS_OPTIONS = [
    { value: 'shipped',   label: 'Available now' },
    { value: 'beta',      label: 'In beta' },
    { value: 'building',  label: 'In development' },
    { value: 'exploring', label: 'Exploring' },
];

export function RoadmapEditor({ data = {}, onChange }) {
    const labels = data.statusLabels || {};
    const setLabel = (key, value) =>
        onChange(set(data, 'statusLabels', { ...labels, [key]: value }));

    return (
        <>
            <InlineHint>
                Items are grouped by status when the page renders — the order you type them in
                does not matter, so you can add one anywhere without disturbing translations.
            </InlineHint>
            <SectionHeaderFields data={data} onChange={onChange} persistScope="roadmap" />

            <RepeatableList
                label="Items"
                items={data.items || []}
                onChange={v => onChange(set(data, 'items', v))}
                makeNew={() => ({ id: mintId('rm'), title: 'New item', body: '', status: 'building', icon: '', note: '' })}
                itemLabel={(item) => {
                    const s = STATUS_OPTIONS.find(o => o.value === item.status);
                    return `${item.title || '(untitled)'}${s ? ` — ${s.label}` : ''}`;
                }}
                renderItem={(item, update) => (
                    <>
                        <TextField
                            label="Title"
                            value={item.title || ''}
                            onChange={v => update({ ...item, title: v })}
                            placeholder="What the thing is called"
                        />
                        <FieldSelect
                            label="Status"
                            value={item.status || 'building'}
                            options={STATUS_OPTIONS}
                            onChange={v => update({ ...item, status: v })}
                            hint="Decides which group it appears under."
                        />
                        <TextArea
                            label="Description"
                            value={item.body || ''}
                            onChange={v => update({ ...item, body: v })}
                            placeholder="One or two sentences on what it does."
                            rows={3}
                        />
                        <TextField
                            label="Caveat"
                            value={item.note || ''}
                            onChange={v => update({ ...item, note: v })}
                            placeholder="e.g. Enterprise plan, opt-in · Dutch law only"
                            hint="The honest small print — which plan it needs, what it does not cover. Shown under the description."
                        />
                        <IconField label="Icon" value={item.icon} onChange={v => update({ ...item, icon: v })} />
                        <LinkField
                            label="Link (optional)"
                            value={item.link}
                            onChange={v => update({ ...item, link: v })}
                        />
                        <TextField
                            label="Link label"
                            value={item.linkLabel || ''}
                            onChange={v => update({ ...item, linkLabel: v })}
                            placeholder="Read more"
                        />
                    </>
                )}
                addLabel="Add roadmap item"
            />

            <SectionDivider label="Group names" />
            <InlineHint>
                What each group is called on the page. These are translated per language; the
                statuses behind them are not.
            </InlineHint>
            {STATUS_OPTIONS.map(o => (
                <TextField
                    key={o.value}
                    label={o.label}
                    value={labels[o.value] || ''}
                    onChange={v => setLabel(o.value, v)}
                    placeholder={o.label}
                />
            ))}
            <Toggle
                label="Show the status key"
                checked={data.showLegend !== false}
                onChange={v => onChange(set(data, 'showLegend', v))}
            />

            <SectionDivider label="Disclaimer" />
            <TextArea
                label="Disclaimer"
                value={data.disclaimer || ''}
                onChange={v => onChange(set(data, 'disclaimer', v))}
                placeholder="This page describes what we are working on, not what we promise to deliver or when."
                rows={2}
            />

            <BackgroundCard data={data} onChange={onChange} persistKey="blk.roadmap.background" />
        </>
    );
}
