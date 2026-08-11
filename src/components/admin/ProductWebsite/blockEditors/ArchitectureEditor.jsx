import React from 'react';
import { InlineHint, BackgroundCard } from '../primitives';
import { set, SectionHeaderFields, GroupedItemsField } from './shared';

// ── Architecture ──────────────────────────────────────────────────────

export function ArchitectureEditor({ data = {}, onChange }) {
    return (
        <>
            <InlineHint>Click layer labels and tags in the preview to edit them.</InlineHint>
            <SectionHeaderFields data={data} onChange={onChange} persistScope="architecture" />
            <GroupedItemsField
                groups={data.layers || []}
                onChange={v => onChange(set(data, 'layers', v))}
                groupLabel="Layer"
                itemKind="string"
                headingKey="label"
                itemsKey="tags"
            />
            <BackgroundCard data={data} onChange={onChange} persistKey="blk.architecture.background" />
        </>
    );
}
