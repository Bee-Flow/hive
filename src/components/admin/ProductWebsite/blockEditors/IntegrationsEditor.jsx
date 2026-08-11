import React from 'react';
import { TextField, IconField, ImageField, RepeatableList } from '../fields';
import { InlineHint, BackgroundCard } from '../primitives';
import { set, SectionHeaderFields } from './shared';

// ── Integrations ──────────────────────────────────────────────────────

// Categories editor is inlined (rather than the shared GroupedItemsField)
// because integration items grew a `logoSrc` slot: a real logo image that
// renders as a 20px grayscale mark on the chip (color on hover — same
// recipe as the social-proof wall), falling back to the Lucide `icon`,
// then label-only. Storage shape is unchanged apart from the additive
// `logoSrc` key: categories[] of { heading, items: [{ icon, label }] }.

export function IntegrationsEditor({ data = {}, onChange }) {
    return (
        <>
            <InlineHint>Category headings and tool names are editable in the preview.</InlineHint>
            <SectionHeaderFields data={data} onChange={onChange} persistScope="integrations" />
            <RepeatableList
                label="Categories"
                items={data.categories || []}
                onChange={v => onChange(set(data, 'categories', v))}
                makeNew={() => ({ heading: 'New category', items: [] })}
                itemLabel={(g) => g?.heading || '(no heading)'}
                collapsible
                renderItem={(group, updateGroup) => (
                    <>
                        <TextField
                            label="Category name"
                            value={group?.heading || ''}
                            onChange={v => updateGroup({ ...group, heading: v })}
                            align={group?.headingAlign || 'left'}
                            onAlignChange={v => updateGroup({ ...group, headingAlign: v })}
                        />
                        <RepeatableList
                            label="Items"
                            items={group?.items || []}
                            onChange={v => updateGroup({ ...group, items: v })}
                            makeNew={() => ({ icon: 'Plug', label: 'New item', logoSrc: '' })}
                            itemLabel={(it) => it?.label || '(no label)'}
                            renderItem={(it, updateItem) => (
                                <>
                                    <ImageField
                                        label="Logo image (optional)"
                                        value={it?.logoSrc || ''}
                                        onChange={v => updateItem({ ...(it || {}), logoSrc: v })}
                                    />
                                    <IconField
                                        label="Icon (fallback)"
                                        value={it?.icon}
                                        onChange={v => updateItem({ ...(it || {}), icon: v })}
                                    />
                                    <TextField
                                        label="Label"
                                        value={it?.label || ''}
                                        onChange={v => updateItem({ ...(it || {}), label: v })}
                                    />
                                </>
                            )}
                            addLabel="Add item"
                        />
                    </>
                )}
                addLabel="Add category"
            />
            <BackgroundCard data={data} onChange={onChange} persistKey="blk.integrations.background" />
        </>
    );
}
