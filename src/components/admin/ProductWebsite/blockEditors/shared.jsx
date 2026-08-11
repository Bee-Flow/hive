import React from 'react';
import { TextField, IconField, RepeatableList, LinkField, FieldRow } from '../fields';
import {
    CollapsibleCard,
    ColorSwatch,
    PxSizeInput,
    FontRow,
    FieldSelect,
    CtaStyleSelect,
    MonoTextarea,
} from '../primitives';

/**
 * Shared editor helpers used by multiple block editors. Module-private to
 * the blockEditors/ split — nothing outside this directory imports these.
 */

// Immutable single-key write on a block's content blob.
export const set = (data, key, value) => ({ ...(data || {}), [key]: value });

// SectionHeaderFields — the eyebrow / title / lead group shared by
// every "list-section" block (Features, Steps, Security, Integrations,
// Architecture, Tech Stats, Social Proof). Each subsection is a
// CollapsibleCard with text + font/size/color triplet. The data writes
// to `eyebrow` / `title` / `lead` plus `*Style.{fontFamily,fontSize,color}`
// sub-objects — additive to any block that didn't have *Style before,
// so existing renderers keep working until they pick up the styles in a
// later wire-up pass.
//
// `showLead` defaults to true; pass false for blocks that don't have a
// `lead` field in their stored shape (e.g. Tech Stats, Social Proof).
//
// `persistScope` (optional, the block type) turns on progressive
// disclosure: the Title card opens by default, the others stay closed,
// and each card persists its open state under `blk.<type>.sh-<slug>`.
// Default null = no persistence, all cards closed (previous behavior).
export function SectionHeaderFields({ data = {}, onChange, showLead = true, persistScope = null }) {
    const eyebrowStyle = data.eyebrowStyle || {};
    const titleStyle   = data.titleStyle   || {};
    const leadStyle    = data.leadStyle    || {};
    const setEyebrowStyle = (patch) => onChange(set(data, 'eyebrowStyle', { ...eyebrowStyle, ...patch }));
    const setTitleStyle   = (patch) => onChange(set(data, 'titleStyle',   { ...titleStyle,   ...patch }));
    const setLeadStyle    = (patch) => onChange(set(data, 'leadStyle',    { ...leadStyle,    ...patch }));
    const persistKeyFor = (slug) => (persistScope ? `blk.${persistScope}.sh-${slug}` : null);

    return (
        <>
            <CollapsibleCard title="Eyebrow" defaultOpen={false} persistKey={persistKeyFor('eyebrow')}>
                <TextField
                    label="Text"
                    value={data.eyebrow || ''}
                    onChange={v => onChange(set(data, 'eyebrow', v))}
                    placeholder="Small label above the title"
                    align={data.eyebrowAlign || data.align || 'left'}
                    onAlignChange={v => onChange(set(data, 'eyebrowAlign', v))}
                />
                <FontRow
                    label="Font"
                    value={eyebrowStyle.fontFamily || ''}
                    onChange={v => setEyebrowStyle({ fontFamily: v })}
                    sample={data.eyebrow || 'Eyebrow preview'}
                    weight={600}
                />
                <FieldRow label="Size & color">
                    <div className="flex items-center gap-2">
                        <PxSizeInput
                            value={Number.isFinite(eyebrowStyle.fontSize) ? eyebrowStyle.fontSize : 0}
                            onChange={v => setEyebrowStyle({ fontSize: v })}
                            min={8}
                            max={48}
                            ariaLabel="Eyebrow size in pixels"
                        />
                        <ColorSwatch
                            value={eyebrowStyle.color || ''}
                            onChange={v => setEyebrowStyle({ color: v })}
                            title="Eyebrow color"
                        />
                    </div>
                </FieldRow>
            </CollapsibleCard>

            <CollapsibleCard title="Title" defaultOpen={!!persistScope} persistKey={persistKeyFor('title')}>
                <TextField
                    label="Text"
                    value={data.title || ''}
                    onChange={v => onChange(set(data, 'title', v))}
                    placeholder="Section heading"
                    align={data.titleAlign || data.align || 'left'}
                    onAlignChange={v => onChange(set(data, 'titleAlign', v))}
                />
                <FontRow
                    label="Font"
                    value={titleStyle.fontFamily || ''}
                    onChange={v => setTitleStyle({ fontFamily: v })}
                    sample={data.title || 'The quick brown fox jumps'}
                    weight={700}
                />
                <FieldRow label="Size & color">
                    <div className="flex items-center gap-2">
                        <PxSizeInput
                            value={Number.isFinite(titleStyle.fontSize) ? titleStyle.fontSize : 0}
                            onChange={v => setTitleStyle({ fontSize: v })}
                            min={12}
                            max={128}
                            ariaLabel="Title size in pixels"
                        />
                        <ColorSwatch
                            value={titleStyle.color || ''}
                            onChange={v => setTitleStyle({ color: v })}
                            title="Title color"
                        />
                    </div>
                </FieldRow>
            </CollapsibleCard>

            {showLead ? (
                <CollapsibleCard title="Lead" defaultOpen={false} persistKey={persistKeyFor('lead')}>
                    <TextField
                        label="Text"
                        value={data.lead || ''}
                        onChange={v => onChange(set(data, 'lead', v))}
                        placeholder="Short paragraph below the title."
                        align={data.leadAlign || data.align || 'left'}
                        onAlignChange={v => onChange(set(data, 'leadAlign', v))}
                    />
                    <FontRow
                        label="Font"
                        value={leadStyle.fontFamily || ''}
                        onChange={v => setLeadStyle({ fontFamily: v })}
                        sample={data.lead || 'The quick brown fox jumps over the lazy dog.'}
                        weight={400}
                    />
                    <FieldRow label="Size & color">
                        <div className="flex items-center gap-2">
                            <PxSizeInput
                                value={Number.isFinite(leadStyle.fontSize) ? leadStyle.fontSize : 0}
                                onChange={v => setLeadStyle({ fontSize: v })}
                                min={10}
                                max={48}
                                ariaLabel="Lead size in pixels"
                            />
                            <ColorSwatch
                                value={leadStyle.color || ''}
                                onChange={v => setLeadStyle({ color: v })}
                                title="Lead color"
                            />
                        </div>
                    </FieldRow>
                </CollapsibleCard>
            ) : null}
        </>
    );
}

// CtaButtonField — shared button editor used by CtaBanner / CTA /
// MediaText. Stores `{label, link, style}` on whatever object the
// caller passes via `value`; the caller decides whether to wrap this
// in a CollapsibleCard. Hero CTAs intentionally keep their own
// enabled-toggle structure; Header chrome CTAs have per-label F/S/C
// fields that aren't covered here.
export function CtaButtonField({ value = {}, onChange, pages = [] /* label kept for callers; not rendered */, label: _label = 'CTA' }) {
    const setField = (key, v) => onChange({ ...value, [key]: v });
    return (
        <>
            <TextField
                label="Button label"
                value={value.label || ''}
                onChange={v => setField('label', v)}
            />
            <LinkField
                label="Destination"
                value={value.link}
                pages={pages}
                onChange={v => setField('link', v)}
            />
            <CtaStyleSelect
                value={value.style || 'primary'}
                onChange={v => setField('style', v)}
            />
        </>
    );
}

// GroupedItemsField — reusable nested-RepeatableList editor for blocks
// that store "groups of items" (Integrations categories → tools,
// Architecture layers → tags). Storage keys vary per block: Integrations
// uses `heading` + `items[]` of `{icon, label}`; Architecture uses
// `label` + `tags[]` of bare strings. Callers pass `headingKey` and
// `itemsKey` so this helper writes to the right keys without changing
// any persisted data shape.
export function GroupedItemsField({
    groups = [],
    onChange,
    groupLabel = 'Group',
    itemKind = 'string',     // 'string' | 'icon-label'
    headingKey = 'heading',
    itemsKey = 'items',
}) {
    const newGroup = () => ({
        [headingKey]: `New ${groupLabel.toLowerCase()}`,
        [itemsKey]: [],
    });
    const newItem = () => itemKind === 'icon-label'
        ? { icon: 'Plug', label: 'New item' }
        : 'tag';

    const innerLabel    = itemKind === 'icon-label' ? 'Items' : 'Tags';
    const innerAddLabel = itemKind === 'icon-label' ? 'Add item' : 'Add tag';

    return (
        <RepeatableList
            label={`${groupLabel}s`}
            items={groups}
            onChange={onChange}
            makeNew={newGroup}
            itemLabel={(g) => g?.[headingKey] || `(no ${headingKey})`}
            collapsible
            renderItem={(group, updateGroup) => (
                <>
                    <TextField
                        label={`${groupLabel} name`}
                        value={group?.[headingKey] || ''}
                        onChange={v => updateGroup({ ...group, [headingKey]: v })}
                        align={group?.[`${headingKey}Align`] || 'left'}
                        onAlignChange={v => updateGroup({ ...group, [`${headingKey}Align`]: v })}
                    />
                    <RepeatableList
                        label={innerLabel}
                        items={group?.[itemsKey] || []}
                        onChange={v => updateGroup({ ...group, [itemsKey]: v })}
                        makeNew={newItem}
                        itemLabel={(it) => itemKind === 'icon-label'
                            ? (it?.label || '(no label)')
                            : (it || '(empty)')}
                        renderItem={(it, updateItem) => (
                            itemKind === 'icon-label' ? (
                                <>
                                    <IconField
                                        label="Icon"
                                        value={it?.icon}
                                        onChange={v => updateItem({ ...(it || {}), icon: v })}
                                    />
                                    <TextField
                                        label="Label"
                                        value={it?.label || ''}
                                        onChange={v => updateItem({ ...(it || {}), label: v })}
                                    />
                                </>
                            ) : (
                                // Bare string item — update(newString)
                                // replaces it in place in the array.
                                <TextField
                                    label="Text"
                                    value={it || ''}
                                    onChange={updateItem}
                                    placeholder="e.g. Postgres"
                                />
                            )
                        )}
                        addLabel={innerAddLabel}
                    />
                </>
            )}
            addLabel={`Add ${groupLabel.toLowerCase()}`}
        />
    );
}

// Card action fields (none / link / popup) — shared by the two card-style
// editor blocks (Features / Security), which had byte-identical copies.
export function CardActionFields({ item, update }) {
    return (
        <>
            <FieldSelect
                label="Card action"
                value={item.cardAction || 'none'}
                options={[
                    { value: 'none',  label: 'None — static card' },
                    { value: 'link',  label: 'Link — open URL' },
                    { value: 'popup', label: 'Popup — open iframe' },
                ]}
                onChange={v => update({ ...item, cardAction: v })}
            />
            {(item.cardAction || 'none') === 'link' ? (
                <TextField
                    label="URL"
                    value={item.cardUrl || ''}
                    onChange={v => update({ ...item, cardUrl: v })}
                    placeholder="https://…"
                />
            ) : null}
            {(item.cardAction || 'none') === 'popup' ? (
                <FieldRow
                    label="Popup HTML (optional)"
                    hint="Clicking the card opens a modal containing this HTML in a sandboxed iframe."
                >
                    <MonoTextarea
                        rows={6}
                        value={item.popupEmbed || ''}
                        onChange={v => update({ ...item, popupEmbed: v })}
                        placeholder={'<!-- Paste HTML / CSS / JS shown when the card is clicked -->'}
                    />
                </FieldRow>
            ) : null}
        </>
    );
}

// Grayscale + sepia tint control for the Social Proof logo strip.
// Maps a 0–80 slider value to the `--logo-tint` CSS variable read by the
// renderer's filter rule: `filter: grayscale(1) sepia(<value>%)`. The
// three reference swatches below the slider are pure visual hints.
export function LogoTintControl({ value, onChange }) {
    const v = Math.max(0, Math.min(80, Number(value) || 0));
    const SWATCHES = [
        { tint: 0,  label: 'Cool'    },
        { tint: 30, label: 'Neutral' },
        { tint: 60, label: 'Warm'    },
    ];
    return (
        <FieldRow label={`Logo tint — ${v}`} hint="Adds warmth to the default grayscale. 0 = cool grey, 80 = warm sepia. Hover a logo to see its full color.">
            <div className="flex flex-col gap-2">
                <input
                    type="range"
                    min={0}
                    max={80}
                    step={1}
                    value={v}
                    onChange={(e) => onChange(Number(e.target.value))}
                    className="w-full accent-[var(--accent-primary)]"
                    aria-label="Logo tint"
                />
                <div className="flex items-center gap-3">
                    {SWATCHES.map(s => (
                        <div key={s.tint} className="flex items-center gap-1.5">
                            <span
                                className="inline-block rounded-sm border border-[var(--border-subtle)]"
                                style={{
                                    width: 22,
                                    height: 14,
                                    background: '#888',
                                    filter: `grayscale(1) sepia(${s.tint}%)`,
                                }}
                                aria-hidden="true"
                            />
                            <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                                {s.label}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </FieldRow>
    );
}
