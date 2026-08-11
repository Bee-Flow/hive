import React from 'react';
import { TextField, RepeatableList } from '../fields';
import { InlineHint, StyleTriplet, BackgroundCard } from '../primitives';
import { set, SectionHeaderFields } from './shared';

// ── Tech Stats ────────────────────────────────────────────────────────

export function TechStatsEditor({ data = {}, onChange }) {
    return (
        <>
            <InlineHint>Click any number or label in the preview to edit.</InlineHint>
            {/* Stats blocks don't store a `lead` field — skip that subsection. */}
            <SectionHeaderFields data={data} onChange={onChange} showLead={false} persistScope="techStats" />
            <RepeatableList
                label="Stats"
                items={data.stats || []}
                onChange={v => onChange(set(data, 'stats', v))}
                makeNew={() => ({ number: '0', label: 'New metric' })}
                itemLabel={(item) => item.label || '(no label)'}
                renderItem={(item, update) => (
                    <>
                        <TextField
                            label="Number"
                            value={item.number || ''}
                            onChange={v => update({ ...item, number: v })}
                            placeholder="e.g. 99%"
                            align={item.numberAlign || 'left'}
                            onAlignChange={v => update({ ...item, numberAlign: v })}
                        />
                        <TextField
                            label="Label"
                            value={item.label || ''}
                            onChange={v => update({ ...item, label: v })}
                            placeholder="e.g. Uptime"
                            align={item.labelAlign || 'left'}
                            onAlignChange={v => update({ ...item, labelAlign: v })}
                        />
                        {/* Per-stat number typography. The big number is
                            the visual centrepiece of a stat; lets users
                            scale + colour it independently of the label. */}
                        <StyleTriplet
                            label="Number style"
                            value={item.numberStyle}
                            onChange={v => update({ ...item, numberStyle: v })}
                            sample={item.number || '99%'}
                            weight={800}
                            min={16} max={160}
                        />
                    </>
                )}
                addLabel="Add stat"
            />
            <BackgroundCard data={data} onChange={onChange} persistKey="blk.techStats.background" />
        </>
    );
}
