import React from 'react';
import { TextField, RepeatableList } from '../fields';
import { InlineHint } from '../primitives';
import { set, SectionHeaderFields } from './shared';

// ── Comparison table ──────────────────────────────────────────────────
//
// Rows are { aspect, left, right } and `left` is always our side
// (leftLabel), so neither the renderer nor a translator has to guess
// which column belongs to the product.

export function CompareTableEditor({ data = {}, onChange }) {
    return (
        <>
            <InlineHint>Left column is your product; right column is the one being compared.</InlineHint>
            <SectionHeaderFields data={data} onChange={onChange} persistScope="compare-table" />
            <TextField
                label="Left column heading"
                value={data.leftLabel || ''}
                onChange={v => onChange(set(data, 'leftLabel', v))}
                placeholder="Bee Flow"
            />
            <TextField
                label="Right column heading"
                value={data.rightLabel || ''}
                onChange={v => onChange(set(data, 'rightLabel', v))}
                placeholder="The other product"
            />
            <RepeatableList
                label="Rows"
                items={data.rows || []}
                onChange={v => onChange(set(data, 'rows', v))}
                makeNew={() => ({ aspect: '', left: '', right: '' })}
                itemLabel={(item) => item.aspect || '(no aspect)'}
                renderItem={(item, update) => (
                    <>
                        <TextField
                            label="Aspect"
                            value={item.aspect || ''}
                            onChange={v => update({ ...item, aspect: v })}
                            placeholder="e.g. Deployment"
                        />
                        <TextField
                            label="Left cell (us)"
                            value={item.left || ''}
                            onChange={v => update({ ...item, left: v })}
                            placeholder="What we do"
                        />
                        <TextField
                            label="Right cell (them)"
                            value={item.right || ''}
                            onChange={v => update({ ...item, right: v })}
                            placeholder="What they do — their docs are authoritative"
                        />
                    </>
                )}
                addLabel="Add row"
            />
            <TextField
                label="Footnote"
                value={data.footnote || ''}
                onChange={v => onChange(set(data, 'footnote', v))}
                placeholder="e.g. Their column is drawn from public documentation."
            />
        </>
    );
}
