import React, { useState } from 'react';
import { TextField, Toggle, IconField, ImageField, RepeatableList, LinkField, FieldRow, inputCls } from './fields';
// Reused for per-block text styling (Social Proof eyebrow / title).
// FontRow + ColorRow are the same components the site-wide Design tab
// uses, so the affordance is consistent across the editor.
import { FontRow, ColorRow } from './DesignEditor';

/**
 * Block editors — structural controls only. Text is edited inline via
 * the preview iframe (EditableText → postMessage → panel).
 *
 * Each editor receives:
 *   data    — block.content for block editors, site.header/footer for chrome
 *   pages   — public page index [ { id, slug, title, isHomepage } ]
 *   onChange(nextData) — called on every structural change
 */

const set = (data, key, value) => ({ ...(data || {}), [key]: value });

const InlineHint = ({ children }) => (
    <p className="text-xs text-[var(--text-muted)] italic mb-3 leading-relaxed">✎ {children}</p>
);

// Section-level collapsible card. Mirrors the row-level collapse pattern
// used by RepeatableList (chevron, clickable header, default-expanded)
// without dragging that component's repeat-list machinery in. Used by
// the chrome editors (HeaderEditor / FooterEditor) to fold long sections.
function CollapsibleCard({ title, defaultOpen = true, children }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="rounded-md border border-[var(--border-subtle)] mb-3">
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className="flex w-full items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                aria-expanded={open}
            >
                <span
                    className="shrink-0 inline-block transition-transform"
                    style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}
                    aria-hidden="true"
                >▾</span>
                <span className="truncate">{title}</span>
            </button>
            {open ? <div className="px-3 pb-3">{children}</div> : null}
        </div>
    );
}

// Small inline color swatch — used when a full ColorRow (with hex input +
// label + hint) would be visually heavy. Mirrors `<input type="color">`
// in dimensions to the rest of the compact field controls (height ~28px).
function ColorSwatch({ value, onChange, title }) {
    const hex = typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000';
    return (
        <input
            type="color"
            value={hex}
            onChange={(e) => onChange(e.target.value)}
            title={title}
            className="h-7 w-7 rounded border border-[var(--border-default)] bg-[var(--bg-tertiary)] cursor-pointer p-0 shrink-0"
            style={{ minWidth: '28px' }}
        />
    );
}

// Compact px-size input — narrow numeric field used by chrome typography
// controls. Empty value (and value of 0) display as "inherit" placeholder
// so users can see they're falling back to the page CSS / Design tab.
function PxSizeInput({ value, onChange, min = 8, max = 96, ariaLabel }) {
    const numeric = Number.isFinite(value) && value > 0 ? value : '';
    return (
        <input
            type="number"
            min={min}
            max={max}
            step={1}
            value={numeric}
            placeholder="inherit"
            aria-label={ariaLabel}
            onChange={(e) => onChange(Number(e.target.value) || 0)}
            className={inputCls + ' shrink-0'}
            style={{ width: '70px' }}
        />
    );
}

// ── Shared editor helpers ───────────────────────────────────────────
//
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
function SectionHeaderFields({ data = {}, onChange, showLead = true }) {
    const eyebrowStyle = data.eyebrowStyle || {};
    const titleStyle   = data.titleStyle   || {};
    const leadStyle    = data.leadStyle    || {};
    const setEyebrowStyle = (patch) => onChange(set(data, 'eyebrowStyle', { ...eyebrowStyle, ...patch }));
    const setTitleStyle   = (patch) => onChange(set(data, 'titleStyle',   { ...titleStyle,   ...patch }));
    const setLeadStyle    = (patch) => onChange(set(data, 'leadStyle',    { ...leadStyle,    ...patch }));

    return (
        <>
            <CollapsibleCard title="Eyebrow" defaultOpen={false}>
                <TextField
                    label="Text"
                    value={data.eyebrow || ''}
                    onChange={v => onChange(set(data, 'eyebrow', v))}
                    placeholder="Small label above the title"
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

            <CollapsibleCard title="Title" defaultOpen={false}>
                <TextField
                    label="Text"
                    value={data.title || ''}
                    onChange={v => onChange(set(data, 'title', v))}
                    placeholder="Section heading"
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
                <CollapsibleCard title="Lead" defaultOpen={false}>
                    <FieldRow label="Text">
                        <textarea
                            rows={3}
                            className={inputCls + ' resize-y'}
                            value={data.lead || ''}
                            onChange={e => onChange(set(data, 'lead', e.target.value))}
                            placeholder="Short paragraph below the title."
                        />
                    </FieldRow>
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
function CtaButtonField({ value = {}, onChange, pages = [] /* label kept for callers; not rendered */, label: _label = 'CTA' }) {
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
            <FieldRow label="Style">
                <select
                    className={inputCls}
                    value={value.style || 'primary'}
                    onChange={e => setField('style', e.target.value)}
                >
                    <option value="primary">Primary (filled)</option>
                    <option value="secondary">Secondary (outlined)</option>
                    <option value="ghost">Ghost (no border)</option>
                    <option value="link">Link (underlined)</option>
                </select>
            </FieldRow>
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
function GroupedItemsField({
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

// StyleTriplet — Font + Size + Color trio for one *Style sub-object.
// Used by the "Text styles" cards in MediaText / Content text element /
// CtaBanner, and by per-item style controls. Empty / 0 values mean
// "inherit" — the renderer skips inline styles for those, so old blocks
// without these keys render identically to today.
function StyleTriplet({
    label,
    style = {},
    onChange,
    sample,
    weight = 500,
    min = 8,
    max = 96,
}) {
    const setStyle = (patch) => onChange({ ...style, ...patch });
    return (
        <>
            <FontRow
                label={`${label} font`}
                value={style.fontFamily || ''}
                onChange={v => setStyle({ fontFamily: v })}
                sample={sample || `${label} preview`}
                weight={weight}
            />
            <FieldRow label={`${label} size & color`}>
                <div className="flex items-center gap-2">
                    <PxSizeInput
                        value={Number.isFinite(style.fontSize) ? style.fontSize : 0}
                        onChange={v => setStyle({ fontSize: v })}
                        min={min}
                        max={max}
                        ariaLabel={`${label} size in pixels`}
                    />
                    <ColorSwatch
                        value={style.color || ''}
                        onChange={v => setStyle({ color: v })}
                        title={`${label} color`}
                    />
                </div>
            </FieldRow>
        </>
    );
}

// BackgroundCard — the standard background-variant picker, wrapped in
// a CollapsibleCard. Defaults to closed because the user only opens it
// occasionally. Block-side storage: `data.backgroundVariant`. Renderer
// behaviour unchanged — every block that already reads this field keeps
// working; blocks that didn't have it before treat it as the no-op
// default until their renderer picks it up in a later pass.
function BackgroundCard({ data, onChange }) {
    return (
        <CollapsibleCard title="Background" defaultOpen={false}>
            <FieldSelect
                label="Variant"
                value={data.backgroundVariant || 'default'}
                options={[
                    { value: 'default', label: 'Default (page bg)' },
                    { value: 'surface', label: 'Surface (alt bg)' },
                    { value: 'primary', label: 'Primary (brand color)' },
                    { value: 'dark',    label: 'Dark (secondary color)' },
                ]}
                onChange={v => onChange(set(data, 'backgroundVariant', v))}
            />
        </CollapsibleCard>
    );
}

// ── Header ────────────────────────────────────────────────────────────

export function HeaderEditor({ data = {}, pages = [], onChange }) {
    const nav = data.nav || [];
    const logo = data.logo || {};
    const ctas = Array.isArray(data.ctas) ? data.ctas : [];
    // Master nav-link styling. `data.nav` is already the array of items
    // so the style fields live on a sibling `navStyle` blob (matching
    // the existing *Style naming used by Hero / SocialProof).
    const navStyle = data.navStyle || {};

    const updateLogo     = (patch) => onChange(set(data, 'logo',     { ...logo,     ...patch }));
    const updateNavStyle = (patch) => onChange(set(data, 'navStyle', { ...navStyle, ...patch }));

    return (
        <>
            <InlineHint>Click logo text, link labels, and button labels in the preview to edit them inline.</InlineHint>

            {/* ── Logo & brand ──────────────────────────────────────── */}
            <CollapsibleCard title="Logo & brand">
                <ImageField
                    label="Logo image (optional)"
                    value={logo.src || ''}
                    onChange={v => updateLogo({ src: v || '' })}
                />
                <TextField
                    label="Brand title"
                    value={logo.text !== undefined ? logo.text : (data.logoText || '')}
                    onChange={v => updateLogo({ text: v })}
                />
                <FontRow
                    label="Title font"
                    value={logo.titleFont || ''}
                    onChange={v => updateLogo({ titleFont: v })}
                    sample={logo.text || data.logoText || 'Brand title preview'}
                    weight={700}
                />
                {/* Title size + color share a row — size as a compact
                    px input (replaces the wide t-shirt-size dropdown),
                    color as a small swatch (replaces the wide bar). */}
                <FieldRow label="Title size & color">
                    <div className="flex items-center gap-2">
                        <PxSizeInput
                            value={Number.isFinite(logo.titleSize) ? logo.titleSize : 0}
                            onChange={v => updateLogo({ titleSize: v })}
                            min={10}
                            max={72}
                            ariaLabel="Title size in pixels"
                        />
                        <ColorSwatch
                            value={logo.textColor || ''}
                            onChange={v => updateLogo({ textColor: v })}
                            title="Title color"
                        />
                    </div>
                </FieldRow>
            </CollapsibleCard>

            {/* ── Header action buttons (multi-CTA) ─────────────────── */}
            <CollapsibleCard title="Header buttons">
                <RepeatableList
                    items={ctas}
                    onChange={v => onChange(set(data, 'ctas', v))}
                    makeNew={() => ({
                        id: `cta_${Math.random().toString(36).slice(2, 8)}`,
                        label: 'Get started',
                        link: { kind: 'app', path: '/app' },
                        style: 'primary',
                    })}
                    itemLabel={(c) => c.label || '(no label)'}
                    collapsible
                    renderItem={(item, update) => (
                        <>
                            <TextField
                                label="Label"
                                value={item.label}
                                onChange={v => update({ ...item, label: v })}
                            />
                            <LinkField
                                label="Link"
                                value={item.link}
                                pages={pages}
                                onChange={v => update({ ...item, link: v })}
                            />
                            <FieldRow label="Style">
                                <select
                                    className={inputCls}
                                    value={item.style || 'primary'}
                                    onChange={e => update({ ...item, style: e.target.value })}
                                >
                                    <option value="primary">Primary (filled)</option>
                                    <option value="secondary">Secondary (outlined)</option>
                                    <option value="ghost">Ghost (no border)</option>
                                    <option value="link">Link (underlined)</option>
                                </select>
                            </FieldRow>
                            {/* Per-button label typography — empty values
                                = inherit page CSS / Design tab. Renderer
                                wire-up is part of the later pass. */}
                            <FontRow
                                label="Label font"
                                value={item.labelFont || ''}
                                onChange={v => update({ ...item, labelFont: v })}
                                sample={item.label || 'Button label'}
                                weight={600}
                            />
                            <FieldRow label="Label size & color">
                                <div className="flex items-center gap-2">
                                    <PxSizeInput
                                        value={Number.isFinite(item.labelSize) ? item.labelSize : 0}
                                        onChange={v => update({ ...item, labelSize: v })}
                                        min={10}
                                        max={48}
                                        ariaLabel="Button label size in pixels"
                                    />
                                    <ColorSwatch
                                        value={item.labelColor || ''}
                                        onChange={v => update({ ...item, labelColor: v })}
                                        title="Button label color"
                                    />
                                </div>
                            </FieldRow>
                        </>
                    )}
                    addLabel="Add button"
                />
            </CollapsibleCard>

            {/* ── Navigation — master link style + the list ─────────── */}
            <CollapsibleCard title="Navigation">
                {/* Master link style — applied to every nav link and
                    every dropdown child. No per-link overrides. */}
                <FontRow
                    label="Link font"
                    value={navStyle.fontFamily || ''}
                    onChange={v => updateNavStyle({ fontFamily: v })}
                    sample="Pricing  ·  Docs  ·  Blog"
                    weight={500}
                />
                <FieldRow label="Link size & color">
                    <div className="flex items-center gap-2">
                        <PxSizeInput
                            value={Number.isFinite(navStyle.fontSize) ? navStyle.fontSize : 0}
                            onChange={v => updateNavStyle({ fontSize: v })}
                            min={10}
                            max={32}
                            ariaLabel="Nav link size in pixels"
                        />
                        <ColorSwatch
                            value={navStyle.color || ''}
                            onChange={v => updateNavStyle({ color: v })}
                            title="Nav link color"
                        />
                    </div>
                </FieldRow>
                <RepeatableList
                    label="Nav links"
                    items={nav}
                onChange={v => onChange(set(data, 'nav', v))}
                makeNew={() => ({ id: `nav_${Math.random().toString(36).slice(2,8)}`, label: 'New link', link: { kind: 'external', url: '#' } })}
                itemLabel={(item) => item.label}
                collapsible
                renderItem={(item, update) => (
                    <>
                        <TextField
                            label="Label"
                            value={item.label}
                            onChange={v => update({ ...item, label: v })}
                        />
                        <LinkField
                            label="Link"
                            value={item.link}
                            pages={pages}
                            onChange={v => update({ ...item, link: v })}
                        />
                        <RepeatableList
                            label="Dropdown children (optional)"
                            items={item.children || []}
                            onChange={v => update({ ...item, children: v })}
                            makeNew={() => ({ id: `nav_${Math.random().toString(36).slice(2,8)}`, label: 'Child link', link: { kind: 'external', url: '#' } })}
                            itemLabel={(child) => child.label}
                            renderItem={(child, updChild) => (
                                <>
                                    <TextField label="Label" value={child.label} onChange={v => updChild({ ...child, label: v })} />
                                    <LinkField label="Link" value={child.link} pages={pages} onChange={v => updChild({ ...child, link: v })} />
                                </>
                            )}
                            addLabel="Add child"
                        />
                    </>
                )}
                />
            </CollapsibleCard>
        </>
    );
}

// ── Hero ──────────────────────────────────────────────────────────────

export function HeroEditor({ data = {}, pages = [], onChange }) {
    const badge       = data.badge       || {};
    const badgeStyle  = data.badgeStyle  || {};
    const titleStyle  = data.titleStyle  || {};
    const leadStyle   = data.leadStyle   || {};
    const primary     = data.primaryCta  || {};
    const secondary   = data.secondaryCta|| {};
    const mockup      = data.mockup      || {};

    // Helpers — each one lets a card's contents read/write a sub-object
    // without re-implementing the spread on every onChange.
    const setBadge        = (patch) => onChange(set(data, 'badge',        { ...badge,       ...patch }));
    const setBadgeStyle   = (patch) => onChange(set(data, 'badgeStyle',   { ...badgeStyle,  ...patch }));
    const setTitleStyle   = (patch) => onChange(set(data, 'titleStyle',   { ...titleStyle,  ...patch }));
    const setLeadStyle    = (patch) => onChange(set(data, 'leadStyle',    { ...leadStyle,   ...patch }));
    const setPrimary      = (patch) => onChange(set(data, 'primaryCta',   { ...primary,     ...patch }));
    const setSecondary    = (patch) => onChange(set(data, 'secondaryCta', { ...secondary,   ...patch }));
    const setMockup       = (patch) => onChange(set(data, 'mockup',       { ...mockup,      ...patch }));

    // `enabled` defaults to true for old blocks that never stored the
    // field, so the toggles all start in the "on" position.
    const badgeOn     = badge.enabled     !== false;
    const leadOn      = data.leadEnabled  !== false;
    const primaryOn   = primary.enabled   !== false;
    const secondaryOn = secondary.enabled !== false;
    const mockupOn    = mockup.enabled    !== false;

    const CTA_STYLE_OPTIONS = [
        { value: 'primary',   label: 'Primary (filled)' },
        { value: 'secondary', label: 'Secondary (outlined)' },
        { value: 'ghost',     label: 'Ghost (no border)' },
        { value: 'link',      label: 'Link (underlined)' },
    ];

    return (
        <>
            <InlineHint>Click the badge, title segments, lead, CTA labels, and chat bubbles in the preview to edit them inline. Use the panels below for structure and styling.</InlineHint>

            {/* ── Badge ───────────────────────────────────────────── */}
            <div className="rounded-md border border-[var(--border-subtle)] p-3 mb-3">
                <div className="text-xs font-semibold text-[var(--text-secondary)] mb-2">Badge</div>
                <Toggle
                    label="Show badge"
                    value={badgeOn}
                    onChange={v => setBadge({ enabled: v })}
                />
                {badgeOn ? (
                    <>
                        <TextField
                            label="Text"
                            value={badge.text || ''}
                            onChange={v => setBadge({ text: v })}
                            placeholder="e.g. New · v2.0"
                        />
                        <IconField
                            label="Icon"
                            value={badge.icon}
                            onChange={v => setBadge({ icon: v })}
                        />
                        <FontRow
                            label="Font"
                            value={badgeStyle.fontFamily || ''}
                            onChange={v => setBadgeStyle({ fontFamily: v })}
                            sample="New · just shipped"
                            weight={500}
                        />
                        <FieldRow label="Size (px)">
                            <input
                                type="number"
                                min={8}
                                max={48}
                                step={1}
                                className={inputCls}
                                value={Number.isFinite(badgeStyle.fontSize) && badgeStyle.fontSize > 0 ? badgeStyle.fontSize : ''}
                                placeholder="inherit"
                                onChange={e => setBadgeStyle({ fontSize: Number(e.target.value) || 0 })}
                            />
                        </FieldRow>
                        <ColorRow
                            label="Color"
                            value={badgeStyle.color || ''}
                            onChange={v => setBadgeStyle({ color: v })}
                        />
                    </>
                ) : null}
            </div>

            {/* ── Headline ────────────────────────────────────────── */}
            <div className="rounded-md border border-[var(--border-subtle)] p-3 mb-3">
                <div className="text-xs font-semibold text-[var(--text-secondary)] mb-2">Headline</div>
                <RepeatableList
                    label="Title segments"
                    items={data.titleParts || []}
                    onChange={v => onChange(set(data, 'titleParts', v))}
                    makeNew={() => ({ text: '', gradient: false })}
                    itemLabel={(it) => it.text || '(empty segment)'}
                    collapsible
                    renderItem={(item, update) => (
                        <>
                            <TextField
                                label="Text"
                                value={item.text || ''}
                                onChange={v => update({ ...item, text: v })}
                                placeholder="Segment text"
                            />
                            <Toggle
                                label="Gradient fill"
                                value={!!item.gradient}
                                onChange={v => update({ ...item, gradient: v })}
                            />
                        </>
                    )}
                    addLabel="Add segment"
                />
                <FontRow
                    label="Font"
                    value={titleStyle.fontFamily || ''}
                    onChange={v => setTitleStyle({ fontFamily: v })}
                    sample="The quick brown fox jumps"
                    weight={800}
                />
                <FieldRow label="Size (px)">
                    <input
                        type="number"
                        min={16}
                        max={160}
                        step={1}
                        className={inputCls}
                        value={Number.isFinite(titleStyle.fontSize) && titleStyle.fontSize > 0 ? titleStyle.fontSize : ''}
                        placeholder="inherit"
                        onChange={e => setTitleStyle({ fontSize: Number(e.target.value) || 0 })}
                    />
                </FieldRow>
                <ColorRow
                    label="Color"
                    value={titleStyle.color || ''}
                    onChange={v => setTitleStyle({ color: v })}
                />
            </div>

            {/* ── Lead ────────────────────────────────────────────── */}
            <div className="rounded-md border border-[var(--border-subtle)] p-3 mb-3">
                <div className="text-xs font-semibold text-[var(--text-secondary)] mb-2">Lead paragraph</div>
                <Toggle
                    label="Show lead"
                    value={leadOn}
                    onChange={v => onChange(set(data, 'leadEnabled', v))}
                />
                {leadOn ? (
                    <>
                        <FieldRow label="Text">
                            <textarea
                                rows={3}
                                className={inputCls + ' resize-y'}
                                value={data.lead || ''}
                                onChange={e => onChange(set(data, 'lead', e.target.value))}
                                placeholder="Short paragraph below the headline."
                            />
                        </FieldRow>
                        <FontRow
                            label="Font"
                            value={leadStyle.fontFamily || ''}
                            onChange={v => setLeadStyle({ fontFamily: v })}
                            sample="The quick brown fox jumps over the lazy dog."
                            weight={400}
                        />
                        <FieldRow label="Size (px)">
                            <input
                                type="number"
                                min={12}
                                max={48}
                                step={1}
                                className={inputCls}
                                value={Number.isFinite(leadStyle.fontSize) && leadStyle.fontSize > 0 ? leadStyle.fontSize : ''}
                                placeholder="inherit"
                                onChange={e => setLeadStyle({ fontSize: Number(e.target.value) || 0 })}
                            />
                        </FieldRow>
                        <ColorRow
                            label="Color"
                            value={leadStyle.color || ''}
                            onChange={v => setLeadStyle({ color: v })}
                        />
                    </>
                ) : null}
            </div>

            {/* ── Primary CTA ─────────────────────────────────────── */}
            <div className="rounded-md border border-[var(--border-subtle)] p-3 mb-3">
                <div className="text-xs font-semibold text-[var(--text-secondary)] mb-2">Primary CTA</div>
                <Toggle
                    label="Show primary CTA"
                    value={primaryOn}
                    onChange={v => setPrimary({ enabled: v })}
                />
                {primaryOn ? (
                    <>
                        <TextField
                            label="Label"
                            value={primary.label || ''}
                            onChange={v => setPrimary({ label: v })}
                            placeholder="Get started"
                        />
                        <LinkField
                            label="Destination"
                            value={primary.link}
                            pages={pages}
                            onChange={v => setPrimary({ link: v })}
                        />
                        <FieldSelect
                            label="Style"
                            value={primary.style || 'primary'}
                            options={CTA_STYLE_OPTIONS}
                            onChange={v => setPrimary({ style: v })}
                        />
                    </>
                ) : null}
            </div>

            {/* ── Secondary CTA ───────────────────────────────────── */}
            <div className="rounded-md border border-[var(--border-subtle)] p-3 mb-3">
                <div className="text-xs font-semibold text-[var(--text-secondary)] mb-2">Secondary CTA</div>
                <Toggle
                    label="Show secondary CTA"
                    value={secondaryOn}
                    onChange={v => setSecondary({ enabled: v })}
                />
                {secondaryOn ? (
                    <>
                        <TextField
                            label="Label"
                            value={secondary.label || ''}
                            onChange={v => setSecondary({ label: v })}
                            placeholder="Learn more"
                        />
                        <LinkField
                            label="Destination"
                            value={secondary.link}
                            pages={pages}
                            onChange={v => setSecondary({ link: v })}
                        />
                        <FieldSelect
                            label="Style"
                            value={secondary.style || 'secondary'}
                            options={CTA_STYLE_OPTIONS}
                            onChange={v => setSecondary({ style: v })}
                        />
                    </>
                ) : null}
            </div>

            {/* ── Mockup ──────────────────────────────────────────── */}
            <div className="rounded-md border border-[var(--border-subtle)] p-3 mb-3">
                <div className="text-xs font-semibold text-[var(--text-secondary)] mb-2">Mockup</div>
                <Toggle
                    label="Show mockup"
                    value={mockupOn}
                    onChange={v => setMockup({ enabled: v })}
                />
                {mockupOn ? (
                    <RepeatableList
                        label="Chat bubbles"
                        items={mockup.chatBubbles || []}
                        onChange={v => setMockup({ chatBubbles: v })}
                        makeNew={() => ({ role: 'user', text: '' })}
                        itemLabel={(b) => b.text || '(empty)'}
                        collapsible
                        renderItem={(item, update) => (
                            <>
                                <FieldSelect
                                    label="Speaker"
                                    value={item.role}
                                    options={[{ value: 'user', label: 'User' }, { value: 'ai', label: 'AI' }]}
                                    onChange={v => update({ ...item, role: v })}
                                />
                                <FieldRow label="Text">
                                    <textarea
                                        rows={2}
                                        className={inputCls + ' resize-y'}
                                        value={item.text || ''}
                                        onChange={e => update({ ...item, text: e.target.value })}
                                        placeholder="Bubble text"
                                    />
                                </FieldRow>
                            </>
                        )}
                        addLabel="Add bubble"
                    />
                ) : null}
            </div>

            {/* ── Background ──────────────────────────────────────── */}
            <div className="rounded-md border border-[var(--border-subtle)] p-3 mb-3">
                <div className="text-xs font-semibold text-[var(--text-secondary)] mb-2">Background</div>
                <FieldSelect
                    label="Variant"
                    value={data.backgroundVariant || 'default'}
                    options={[
                        { value: 'default', label: 'Default (page bg)' },
                        { value: 'surface', label: 'Surface (alt bg)'  },
                        { value: 'primary', label: 'Primary (brand)'   },
                        { value: 'dark',    label: 'Dark (secondary)'  },
                    ]}
                    onChange={v => onChange(set(data, 'backgroundVariant', v))}
                />
            </div>
        </>
    );
}

// ── Social Proof ──────────────────────────────────────────────────────

export function SocialProofEditor({ data = {}, onChange }) {
    // Eyebrow + Title (style controls + text fields) come from the
    // shared header helper. Social Proof has no `lead`, so showLead
    // is disabled — the helper skips that subsection entirely.
    return (
        <>
            <InlineHint>Click the eyebrow and title text in the preview to edit them inline. Style each independently below.</InlineHint>

            <SectionHeaderFields data={data} onChange={onChange} showLead={false} />

            {/* ── Logos ───────────────────────────────────────── */}
            <RepeatableList
                label="Logos"
                items={data.logos || []}
                onChange={v => onChange(set(data, 'logos', v))}
                makeNew={() => ({ src: '', alt: 'New logo' })}
                itemLabel={(item) => item.alt}
                renderItem={(item, update) => (
                    <>
                        <ImageField label="Logo image (optional)" value={item.src} onChange={v => update({ ...item, src: v })} />
                        <TextField label="Alt text" value={item.alt || ''} onChange={v => update({ ...item, alt: v })} placeholder="Used as the logo's accessible name" />
                    </>
                )}
                addLabel="Add logo"
            />
        </>
    );
}

// ── Content (generic flexible block) ─────────────────────────────────

// Layout, element, and migration helpers live in the marketing-side
// module so the editor and the renderer share one source of truth on
// shape conversion + defaults.
import {
    migrateLegacyContent,
    makeColumn,
    makeElement,
} from '../../../marketing/sections/contentMigration';

const COLUMN_LAYOUTS = [
    { value: '1',   label: '1',         hint: 'Single column' },
    { value: '2',   label: '1 │ 1', hint: 'Two equal columns' },
    { value: '3',   label: '1│ 1│ 1', hint: 'Three equal columns' },
    { value: '1-2', label: '1 │ 2', hint: 'Narrow | Wide' },
    { value: '2-1', label: '2 │ 1', hint: 'Wide | Narrow' },
];

const VALIGNS = [
    { value: 'top',    label: 'Top'    },
    { value: 'center', label: 'Center' },
    { value: 'bottom', label: 'Bottom' },
];

const BACKGROUNDS = [
    { value: 'none',    label: 'None (page bg)' },
    { value: 'light',   label: 'Light surface'  },
    { value: 'dark',    label: 'Dark'           },
    { value: 'primary', label: 'Brand primary'  },
];

const ALIGNS = [
    { value: 'left',   label: 'Left'   },
    { value: 'center', label: 'Center' },
    { value: 'right',  label: 'Right'  },
];

const ELEMENT_KINDS = [
    { value: 'text',   label: 'Text',   icon: 'Type'    },
    { value: 'image',  label: 'Image',  icon: 'Image'   },
    { value: 'video',  label: 'Video',  icon: 'Video'   },
    { value: 'iframe', label: 'Embed',  icon: 'Globe'   },
    { value: 'cta',    label: 'Button', icon: 'Square'  },
];

// How many columns each layout token lays out. Used when the user picks a
// new layout so we add/remove columns to match — preserving content where
// possible and warning before dropping a non-empty column.
const COLUMN_COUNT_FOR_LAYOUT = {
    '1': 1, '2': 2, '3': 3, '1-2': 2, '2-1': 2,
};

export function ContentEditor({ data = {}, pages = [], onChange }) {
    // Always read through the migration helper. If `data` is already in
    // the new shape, this is a no-op; if it's legacy, the editor sees the
    // converted shape and the very next user edit persists it.
    const c = migrateLegacyContent(data);
    const setField = (key, value) => onChange({ ...c, [key]: value });

    const handleLayoutChange = (nextLayout) => {
        const targetCount = COLUMN_COUNT_FOR_LAYOUT[nextLayout] || 1;
        const current = Array.isArray(c.columns) ? c.columns : [];
        let nextColumns;
        if (targetCount === current.length) {
            nextColumns = current;
        } else if (targetCount > current.length) {
            // Pad with empty columns so the user can immediately fill them.
            nextColumns = current.slice();
            while (nextColumns.length < targetCount) nextColumns.push(makeColumn());
        } else {
            // Dropping columns — warn if the to-be-removed ones aren't empty.
            const dropped = current.slice(targetCount);
            const hasContent = dropped.some(col => Array.isArray(col?.elements) && col.elements.length > 0);
            if (hasContent) {
                const labels = dropped
                    .map((_, i) => `Column ${targetCount + i + 1}`)
                    .join(', ');
                // eslint-disable-next-line no-alert
                const ok = window.confirm(`${labels} contain elements. Remove anyway?`);
                if (!ok) return;
            }
            nextColumns = current.slice(0, targetCount);
        }
        onChange({ ...c, columnLayout: nextLayout, columns: nextColumns });
    };

    const updateColumn = (idx, nextCol) => {
        const cols = c.columns.slice();
        cols[idx] = nextCol;
        onChange({ ...c, columns: cols });
    };

    return (
        <>
            <InlineHint>
                Each column holds a stack of elements (text, image, video, embed, button).
                Click any text in the preview to edit it inline.
            </InlineHint>

            {/* ── Layout ─────────────────────────────────────────── */}
            <CollapsibleCard title="Layout" defaultOpen={true}>
                <FieldRow label="Column layout">
                    <div className="flex flex-wrap gap-1.5">
                        {COLUMN_LAYOUTS.map(opt => (
                            <button
                                key={opt.value}
                                type="button"
                                title={opt.hint}
                                onClick={() => handleLayoutChange(opt.value)}
                                className={`px-2.5 py-1.5 text-xs rounded-md border font-mono transition-colors
                                    ${c.columnLayout === opt.value
                                        ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
                                        : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)]/60'}
                                `}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </FieldRow>
                <FieldSelect
                    label="Vertical align"
                    value={c.verticalAlign || 'top'}
                    options={VALIGNS}
                    onChange={v => setField('verticalAlign', v)}
                />
                <FieldSelect
                    label="Background"
                    value={c.background || 'none'}
                    options={BACKGROUNDS}
                    onChange={v => setField('background', v)}
                />
            </CollapsibleCard>

            {/* ── Columns ────────────────────────────────────────── */}
            <div className="text-xs font-semibold text-[var(--text-secondary)] mb-2">Columns</div>
            {c.columns.map((col, colIdx) => (
                <ColumnPanel
                    key={col.id || colIdx}
                    col={col}
                    colIdx={colIdx}
                    pages={pages}
                    onChange={(nextCol) => updateColumn(colIdx, nextCol)}
                />
            ))}
        </>
    );
}

// ── Column panel ───────────────────────────────────────────────────────

function ColumnPanel({ col, colIdx, pages, onChange }) {
    const [open, setOpen] = useState(true);
    const elements = Array.isArray(col?.elements) ? col.elements : [];

    const updateElements = (next) => onChange({ ...col, elements: next });
    const addElement = (kind) => {
        updateElements([...elements, makeElement(kind)]);
    };

    return (
        <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-3 mb-3">
            <button
                type="button"
                onClick={() => setOpen(v => !v)}
                className="flex w-full items-center justify-between text-xs text-[var(--text-secondary)] mb-2"
            >
                <span className="flex items-center gap-1.5">
                    <span style={{ transform: open ? 'rotate(0)' : 'rotate(-90deg)' }} aria-hidden>▾</span>
                    <span className="font-medium">Column {colIdx + 1}</span>
                    <span className="text-[var(--text-muted)]">· {elements.length} element{elements.length === 1 ? '' : 's'}</span>
                </span>
            </button>

            {open ? (
                <>
                    <RepeatableList
                        items={elements}
                        onChange={updateElements}
                        makeNew={() => makeElement('text')}
                        itemLabel={(el) => {
                            const k = ELEMENT_KINDS.find(x => x.value === el?.kind);
                            return k ? k.label : (el?.kind || 'Element');
                        }}
                        collapsible
                        addLabel="Add element"
                        renderItem={(el, update) => (
                            <ElementFields el={el} pages={pages} update={update} />
                        )}
                    />

                    {/* Quick-add buttons next to "+ Add element" — saves a
                        click + a kind change on the first new element. */}
                    <div className="flex flex-wrap gap-1.5 mt-1">
                        {ELEMENT_KINDS.map(k => (
                            <button
                                key={k.value}
                                type="button"
                                onClick={() => addElement(k.value)}
                                className="px-2 py-1 text-[11px] rounded-md border border-dashed border-[var(--border-default)] text-[var(--text-muted)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)] transition-colors"
                            >
                                + {k.label}
                            </button>
                        ))}
                    </div>
                </>
            ) : null}
        </div>
    );
}

// ── Element field renderer (per-kind) ──────────────────────────────────

function ElementFields({ el, pages, update }) {
    const setKind = (nextKind) => {
        if (nextKind === el.kind) return;
        // Preserve the id when changing kind so RepeatableList's collapse
        // state for this row stays attached, but otherwise reset to the
        // new kind's defaults — fields don't share semantics across kinds.
        const fresh = makeElement(nextKind);
        update({ ...fresh, id: el.id });
    };

    return (
        <>
            <FieldSelect
                label="Element type"
                value={el.kind || 'text'}
                options={ELEMENT_KINDS.map(k => ({ value: k.value, label: k.label }))}
                onChange={setKind}
            />

            {el.kind === 'text' ? (
                <>
                    <TextField
                        label="Heading"
                        value={el.heading || ''}
                        onChange={v => update({ ...el, heading: v })}
                        placeholder="Optional heading"
                    />
                    <TextField
                        label="Subheading"
                        value={el.subheading || ''}
                        onChange={v => update({ ...el, subheading: v })}
                        placeholder="Optional subheading"
                    />
                    <FieldRow label="Body">
                        <textarea
                            rows={4}
                            className={inputCls + ' resize-y'}
                            value={el.body || ''}
                            onChange={e => update({ ...el, body: e.target.value })}
                            placeholder="Write paragraph text. Line breaks are preserved."
                        />
                    </FieldRow>
                    <FieldSelect
                        label="Align"
                        value={el.align || 'left'}
                        options={ALIGNS}
                        onChange={v => update({ ...el, align: v })}
                    />
                    {/* Per-text-element typography. Stored under
                        element.headingStyle / subheadingStyle / bodyStyle. */}
                    <CollapsibleCard title="Text styles" defaultOpen={false}>
                        <StyleTriplet
                            label="Heading"
                            style={el.headingStyle}
                            onChange={v => update({ ...el, headingStyle: v })}
                            sample={el.heading || 'Heading preview'}
                            weight={700}
                            min={12} max={96}
                        />
                        <StyleTriplet
                            label="Subheading"
                            style={el.subheadingStyle}
                            onChange={v => update({ ...el, subheadingStyle: v })}
                            sample={el.subheading || 'Subheading preview'}
                            weight={500}
                            min={10} max={48}
                        />
                        <StyleTriplet
                            label="Body"
                            style={el.bodyStyle}
                            onChange={v => update({ ...el, bodyStyle: v })}
                            sample={el.body || 'The quick brown fox jumps over the lazy dog.'}
                            weight={400}
                            min={10} max={32}
                        />
                    </CollapsibleCard>
                </>
            ) : null}

            {el.kind === 'image' ? (
                <>
                    <ImageField
                        label="Image"
                        value={el.src || ''}
                        onChange={v => update({ ...el, src: v })}
                    />
                    <TextField
                        label="Alt text"
                        value={el.alt || ''}
                        onChange={v => update({ ...el, alt: v })}
                        placeholder="Describe the image"
                    />
                    <FieldSelect
                        label="Aspect ratio"
                        value={el.aspectRatio || 'auto'}
                        options={[
                            { value: 'auto', label: 'Auto (intrinsic)' },
                            { value: '16/9', label: '16:9' },
                            { value: '4/3',  label: '4:3'  },
                            { value: '1/1',  label: '1:1'  },
                            { value: '3/4',  label: '3:4'  },
                        ]}
                        onChange={v => update({ ...el, aspectRatio: v })}
                    />
                    <Toggle
                        label="Rounded corners"
                        value={!!el.rounded}
                        onChange={v => update({ ...el, rounded: v })}
                    />
                    <TextField
                        label="Caption"
                        value={el.caption || ''}
                        onChange={v => update({ ...el, caption: v })}
                        placeholder="Optional caption"
                    />
                </>
            ) : null}

            {el.kind === 'video' ? (
                <>
                    <TextField
                        label="Video URL"
                        value={el.url || ''}
                        onChange={v => update({ ...el, url: v })}
                        placeholder="YouTube or Vimeo URL"
                    />
                    <FieldSelect
                        label="Aspect ratio"
                        value={el.aspectRatio || '16/9'}
                        options={[
                            { value: '16/9', label: '16:9' },
                            { value: '4/3',  label: '4:3'  },
                            { value: '1/1',  label: '1:1'  },
                        ]}
                        onChange={v => update({ ...el, aspectRatio: v })}
                    />
                    <TextField
                        label="Caption"
                        value={el.caption || ''}
                        onChange={v => update({ ...el, caption: v })}
                        placeholder="Optional caption"
                    />
                </>
            ) : null}

            {el.kind === 'iframe' ? (
                <>
                    <TextField
                        label="Embed URL"
                        value={el.src || ''}
                        onChange={v => update({ ...el, src: v })}
                        placeholder="https://… (chat agent, Calendly, Map, …)"
                    />
                    <FieldRow label="Height (px)">
                        <input
                            type="number"
                            min={120}
                            max={2000}
                            step={20}
                            className={inputCls}
                            value={Number.isFinite(el.height) ? el.height : 480}
                            onChange={e => update({ ...el, height: Number(e.target.value) || 480 })}
                        />
                    </FieldRow>
                    <TextField
                        label="Accessible label"
                        value={el.label || ''}
                        onChange={v => update({ ...el, label: v })}
                        placeholder="Used as the iframe title attribute"
                    />
                    <Toggle
                        label="Allow scrolling"
                        value={!!el.scrolling}
                        onChange={v => update({ ...el, scrolling: v })}
                    />
                </>
            ) : null}

            {el.kind === 'cta' ? (
                <>
                    <TextField
                        label="Label"
                        value={el.label || ''}
                        onChange={v => update({ ...el, label: v })}
                    />
                    <LinkField
                        label="Link"
                        value={el.link}
                        pages={pages}
                        onChange={v => update({ ...el, link: v })}
                    />
                    <FieldSelect
                        label="Style"
                        value={el.style || 'primary'}
                        options={[
                            { value: 'primary',   label: 'Primary (filled)' },
                            { value: 'secondary', label: 'Secondary (outlined)' },
                            { value: 'ghost',     label: 'Ghost (no border)' },
                            { value: 'link',      label: 'Link (underlined)' },
                        ]}
                        onChange={v => update({ ...el, style: v })}
                    />
                    <FieldSelect
                        label="Align"
                        value={el.align || 'left'}
                        options={ALIGNS}
                        onChange={v => update({ ...el, align: v })}
                    />
                </>
            ) : null}
        </>
    );
}

// ── Media + Text ─────────────────────────────────────────────────────

export function MediaTextEditor({ data = {}, pages = [], onChange }) {
    const setField = (key, value) => onChange(set(data, key, value));
    const media    = data.media || { kind: 'image', src: '', alt: '' };

    const showSubheading = data.subheading !== null && data.subheading !== undefined;
    const showCta        = !!data.cta;

    const toggleSubheading = (next) => setField('subheading', next ? '' : null);
    const toggleCta        = (next) => setField('cta',
        next ? { label: 'Learn more', link: { kind: 'anchor', anchor: '' } } : null);

    const updateMedia = (key, value) => setField('media', { ...media, [key]: value });
    const updateCta   = (key, value) => setField('cta',   { ...(data.cta || {}), [key]: value });

    return (
        <>
            <InlineHint>
                Click the heading, subheading, body, and CTA label in the preview to edit them.
                Media (image / video) and the layout knobs live below.
            </InlineHint>

            <Toggle label="Show subheading" value={showSubheading} onChange={toggleSubheading} />
            <Toggle label="Show CTA"        value={showCta}        onChange={toggleCta} />

            {showCta ? (
                <CollapsibleCard title="CTA" defaultOpen={true}>
                    <CtaButtonField
                        value={data.cta || {}}
                        pages={pages}
                        onChange={v => setField('cta', v)}
                        label="CTA"
                    />
                </CollapsibleCard>
            ) : null}

            <CollapsibleCard title="Media" defaultOpen={true}>
                <FieldSelect
                    label="Media type"
                    value={media.kind || 'image'}
                    options={[
                        { value: 'image', label: 'Image' },
                        { value: 'video', label: 'Video (embed URL)' },
                    ]}
                    onChange={v => updateMedia('kind', v)}
                />

                {media.kind === 'image' ? (
                    <>
                        <ImageField
                            label="Image"
                            value={media.src || ''}
                            onChange={v => updateMedia('src', v)}
                        />
                        <TextField
                            label="Alt text"
                            value={media.alt || ''}
                            onChange={v => updateMedia('alt', v)}
                            placeholder="Describe the image"
                        />
                    </>
                ) : (
                    <TextField
                        label="Video embed URL"
                        value={media.src || ''}
                        onChange={v => updateMedia('src', v)}
                        placeholder="https://www.youtube.com/embed/… or https://player.vimeo.com/video/…"
                        hint="Use the embed URL, not the public watch URL."
                    />
                )}
            </CollapsibleCard>

            <FieldSelect
                label="Media position"
                value={data.mediaPosition || 'left'}
                options={[
                    { value: 'left',  label: 'Left' },
                    { value: 'right', label: 'Right' },
                ]}
                onChange={v => setField('mediaPosition', v)}
            />

            <FieldSelect
                label="Media size"
                value={data.mediaSize || 'half'}
                options={[
                    { value: 'half',       label: 'Half (50 / 50)' },
                    { value: 'third',      label: 'One third (33 / 67)' },
                    { value: 'two-thirds', label: 'Two thirds (66 / 34)' },
                ]}
                onChange={v => setField('mediaSize', v)}
            />

            {/* Text styles — heading / subheading / body. Empty values
                = inherit page CSS / Design tab. */}
            <CollapsibleCard title="Text styles" defaultOpen={false}>
                <StyleTriplet
                    label="Heading"
                    style={data.headingStyle}
                    onChange={v => setField('headingStyle', v)}
                    sample={data.heading || 'Heading preview'}
                    weight={700}
                    min={12} max={96}
                />
                <StyleTriplet
                    label="Subheading"
                    style={data.subheadingStyle}
                    onChange={v => setField('subheadingStyle', v)}
                    sample={data.subheading || 'Subheading preview'}
                    weight={500}
                    min={10} max={48}
                />
                <StyleTriplet
                    label="Body"
                    style={data.bodyStyle}
                    onChange={v => setField('bodyStyle', v)}
                    sample={data.body || 'The quick brown fox jumps over the lazy dog.'}
                    weight={400}
                    min={10} max={32}
                />
            </CollapsibleCard>

            <FieldSelect
                label="Background"
                value={data.backgroundVariant || 'default'}
                options={[
                    { value: 'default', label: 'Default (page bg)' },
                    { value: 'surface', label: 'Surface (alt bg)' },
                    { value: 'primary', label: 'Primary (brand color)' },
                    { value: 'dark',    label: 'Dark (secondary color)' },
                ]}
                onChange={v => setField('backgroundVariant', v)}
            />
        </>
    );
}

// ── Features ──────────────────────────────────────────────────────────

export function FeaturesEditor({ data = {}, onChange }) {
    return (
        <>
            <InlineHint>Eyebrow, title, lead, and each card's title / body / tag are editable in the preview.</InlineHint>
            <SectionHeaderFields data={data} onChange={onChange} />
            <RepeatableList
                label="Feature cards"
                items={data.items || []}
                onChange={v => onChange(set(data, 'items', v))}
                makeNew={() => ({ icon: 'Sparkles', title: 'New feature', body: '', techTag: '' })}
                itemLabel={(item) => item.title || '(no title)'}
                renderItem={(item, update) => (
                    <>
                        <IconField label="Icon" value={item.icon} onChange={v => update({ ...item, icon: v })} />
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
                    </>
                )}
                addLabel="Add card"
            />
            <BackgroundCard data={data} onChange={onChange} />
        </>
    );
}

// ── Steps ─────────────────────────────────────────────────────────────

export function StepsEditor({ data = {}, onChange }) {
    return (
        <>
            <InlineHint>Click any step's number, title, body, or example in the preview to edit.</InlineHint>
            <SectionHeaderFields data={data} onChange={onChange} />
            <RepeatableList
                label="Steps"
                items={data.items || []}
                onChange={v => onChange(set(data, 'items', v))}
                makeNew={() => ({ number: '', title: 'New step', body: '', example: '' })}
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
                        />
                        <FieldRow label="Body">
                            <textarea
                                rows={3}
                                className={inputCls + ' resize-y'}
                                value={item.body || ''}
                                onChange={e => update({ ...item, body: e.target.value })}
                                placeholder="Describe what happens in this step."
                            />
                        </FieldRow>
                        <TextField
                            label="Example"
                            value={item.example || ''}
                            onChange={v => update({ ...item, example: v })}
                            placeholder="Optional caption / example"
                        />
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
            <BackgroundCard data={data} onChange={onChange} />
        </>
    );
}

// ── Security ──────────────────────────────────────────────────────────

export function SecurityEditor({ data = {}, onChange }) {
    return (
        <>
            <InlineHint>Click any card's title, summary, or detail bullet to edit.</InlineHint>
            <SectionHeaderFields data={data} onChange={onChange} />
            <RepeatableList
                label="Security cards"
                items={data.cards || []}
                onChange={v => onChange(set(data, 'cards', v))}
                makeNew={() => ({ icon: 'ShieldCheck', title: 'New card', summary: '', details: [] })}
                itemLabel={(item) => item.title || '(no title)'}
                renderItem={(item, update) => (
                    <>
                        <IconField label="Icon" value={item.icon} onChange={v => update({ ...item, icon: v })} />
                        <RepeatableList
                            label="Detail bullets"
                            items={item.details || []}
                            onChange={v => update({ ...item, details: v })}
                            makeNew={() => 'New detail'}
                            renderItem={(detail, updateDetail) => (
                                // Detail bullets are bare strings in the
                                // array — update(newString) replaces the
                                // string in place at this index.
                                <TextField
                                    label="Text"
                                    value={detail || ''}
                                    onChange={updateDetail}
                                    placeholder="Bullet text"
                                />
                            )}
                            addLabel="Add detail"
                        />
                    </>
                )}
                addLabel="Add card"
            />
            <BackgroundCard data={data} onChange={onChange} />
        </>
    );
}

// ── Integrations ──────────────────────────────────────────────────────

export function IntegrationsEditor({ data = {}, onChange }) {
    return (
        <>
            <InlineHint>Category headings and tool names are editable in the preview.</InlineHint>
            <SectionHeaderFields data={data} onChange={onChange} />
            <GroupedItemsField
                groups={data.categories || []}
                onChange={v => onChange(set(data, 'categories', v))}
                groupLabel="Category"
                itemKind="icon-label"
                headingKey="heading"
                itemsKey="items"
            />
            <BackgroundCard data={data} onChange={onChange} />
        </>
    );
}

// ── Architecture ──────────────────────────────────────────────────────

export function ArchitectureEditor({ data = {}, onChange }) {
    return (
        <>
            <InlineHint>Click layer labels and tags in the preview to edit them.</InlineHint>
            <SectionHeaderFields data={data} onChange={onChange} />
            <GroupedItemsField
                groups={data.layers || []}
                onChange={v => onChange(set(data, 'layers', v))}
                groupLabel="Layer"
                itemKind="string"
                headingKey="label"
                itemsKey="tags"
            />
            <BackgroundCard data={data} onChange={onChange} />
        </>
    );
}

// ── Tech Stats ────────────────────────────────────────────────────────

export function TechStatsEditor({ data = {}, onChange }) {
    return (
        <>
            <InlineHint>Click any number or label in the preview to edit.</InlineHint>
            {/* Stats blocks don't store a `lead` field — skip that subsection. */}
            <SectionHeaderFields data={data} onChange={onChange} showLead={false} />
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
                        />
                        <TextField
                            label="Label"
                            value={item.label || ''}
                            onChange={v => update({ ...item, label: v })}
                            placeholder="e.g. Uptime"
                        />
                        {/* Per-stat number typography. The big number is
                            the visual centrepiece of a stat; lets users
                            scale + colour it independently of the label. */}
                        <StyleTriplet
                            label="Number style"
                            style={item.numberStyle}
                            onChange={v => update({ ...item, numberStyle: v })}
                            sample={item.number || '99%'}
                            weight={800}
                            min={16} max={160}
                        />
                    </>
                )}
                addLabel="Add stat"
            />
            <BackgroundCard data={data} onChange={onChange} />
        </>
    );
}

// ── CTA ───────────────────────────────────────────────────────────────

export function CTAEditor({ data = {}, pages = [], onChange }) {
    const button = data.button || {};
    return (
        <>
            <InlineHint>Title, lead, and button label are editable in the preview.</InlineHint>
            <CtaButtonField
                value={button}
                pages={pages}
                onChange={v => onChange(set(data, 'button', v))}
                label="Button"
            />
            <BackgroundCard data={data} onChange={onChange} />
        </>
    );
}

// ── CTA Banner ───────────────────────────────────────────────────────

export function CtaBannerEditor({ data = {}, pages = [], onChange }) {
    const setField = (key, value) => onChange(set(data, key, value));
    const primary  = data.primaryCta || { label: '', link: { kind: 'external', url: '' } };
    const showSecondary = !!data.secondaryCta;

    const toggleSecondary = (next) => setField('secondaryCta',
        next ? { label: 'Learn more', link: { kind: 'anchor', anchor: '' } } : null);

    const updatePrimary   = (key, value) => setField('primaryCta',   { ...primary,                    [key]: value });
    const updateSecondary = (key, value) => setField('secondaryCta', { ...(data.secondaryCta || {}),  [key]: value });

    return (
        <>
            <InlineHint>Click heading and subheading in the preview to edit inline.</InlineHint>

            <FieldSelect
                label="Layout"
                value={data.layout || 'centered'}
                options={[
                    { value: 'centered', label: 'Centered' },
                    { value: 'split',    label: 'Split (heading left, CTAs right)' },
                ]}
                onChange={v => setField('layout', v)}
            />

            <FieldSelect
                label="Background"
                value={data.backgroundVariant || 'primary'}
                options={[
                    { value: 'default', label: 'Default (page bg)' },
                    { value: 'surface', label: 'Surface (alt bg)' },
                    { value: 'primary', label: 'Primary (brand color)' },
                    { value: 'dark',    label: 'Dark (secondary color)' },
                ]}
                onChange={v => setField('backgroundVariant', v)}
            />

            <CollapsibleCard title="Primary CTA" defaultOpen={true}>
                <CtaButtonField
                    value={primary}
                    pages={pages}
                    onChange={v => setField('primaryCta', v)}
                    label="Primary CTA"
                />
            </CollapsibleCard>

            <Toggle label="Show secondary CTA" value={showSecondary} onChange={toggleSecondary} />

            {showSecondary ? (
                <CollapsibleCard title="Secondary CTA" defaultOpen={true}>
                    <CtaButtonField
                        value={data.secondaryCta || {}}
                        pages={pages}
                        onChange={v => setField('secondaryCta', v)}
                        label="Secondary CTA"
                    />
                </CollapsibleCard>
            ) : null}

            {/* Text styles — heading + subheading only (CTA Banner has
                no body paragraph; its text is just headline + tagline). */}
            <CollapsibleCard title="Text styles" defaultOpen={false}>
                <StyleTriplet
                    label="Heading"
                    style={data.headingStyle}
                    onChange={v => setField('headingStyle', v)}
                    sample={data.heading || 'Heading preview'}
                    weight={700}
                    min={12} max={96}
                />
                <StyleTriplet
                    label="Subheading"
                    style={data.subheadingStyle}
                    onChange={v => setField('subheadingStyle', v)}
                    sample={data.subheading || 'Subheading preview'}
                    weight={500}
                    min={10} max={48}
                />
            </CollapsibleCard>
        </>
    );
}

// ── Footer ────────────────────────────────────────────────────────────

export function FooterEditor({ data = {}, pages = [], onChange }) {
    const themeSwitcherEnabled = !!data.themeSwitcher?.enabled;
    // Master footer-link styling. Sibling to columns/socials so it
    // applies across all footer link labels (both inside columns and
    // socials when wired). Matches the *Style naming used elsewhere.
    const linkStyle = data.linkStyle || {};
    const updateLinkStyle = (patch) => onChange(set(data, 'linkStyle', { ...linkStyle, ...patch }));

    return (
        <>
            <InlineHint>Brand text, blurb, column headings, link labels, and copyright are editable in the preview.</InlineHint>

            {/* Outer "Footer" card wraps the entire editor body. The
                SectionDivider above (rendered by SiteChromeEditor) is
                redundant — flagged for cleanup in a follow-up pass. */}
            <CollapsibleCard title="Footer">
                <Toggle
                    label="Show theme switcher"
                    value={themeSwitcherEnabled}
                    onChange={v => onChange(set(data, 'themeSwitcher', { ...(data.themeSwitcher || {}), enabled: v }))}
                />

                {/* ── Master link style (no per-link overrides) ─── */}
                <CollapsibleCard title="Link style">
                    <FontRow
                        label="Link font"
                        value={linkStyle.fontFamily || ''}
                        onChange={v => updateLinkStyle({ fontFamily: v })}
                        sample="Pricing  ·  Docs  ·  Blog"
                        weight={500}
                    />
                    <FieldRow label="Link color">
                        <ColorSwatch
                            value={linkStyle.color || ''}
                            onChange={v => updateLinkStyle({ color: v })}
                            title="Footer link color"
                        />
                    </FieldRow>
                </CollapsibleCard>

                {/* ── Columns ───────────────────────────────────── */}
                <CollapsibleCard title="Columns">
                    <RepeatableList
                        items={data.columns || []}
                        onChange={v => onChange(set(data, 'columns', v))}
                        makeNew={() => ({ id: `fcol_${Math.random().toString(36).slice(2,8)}`, heading: 'New column', links: [] })}
                        itemLabel={(c) => c.heading || '(no heading)'}
                        collapsible
                        renderItem={(col, updateCol) => (
                            <>
                                <TextField
                                    label="Heading"
                                    value={col.heading || ''}
                                    onChange={v => updateCol({ ...col, heading: v })}
                                />
                                <RepeatableList
                                    label="Links"
                                    items={col.links || []}
                                    onChange={v => updateCol({ ...col, links: v })}
                                    makeNew={() => ({ id: `fl_${Math.random().toString(36).slice(2,8)}`, label: 'New link', link: { kind: 'external', url: '#' } })}
                                    itemLabel={(l) => l.label || '(no label)'}
                                    collapsible
                                    renderItem={(l, updL) => (
                                        <>
                                            <TextField
                                                label="Label"
                                                value={l.label || ''}
                                                onChange={v => updL({ ...l, label: v })}
                                            />
                                            <LinkField
                                                label="Link"
                                                value={l.link}
                                                pages={pages}
                                                onChange={v => updL({ ...l, link: v })}
                                            />
                                        </>
                                    )}
                                    addLabel="Add link"
                                />
                            </>
                        )}
                        addLabel="Add column"
                    />
                </CollapsibleCard>

                {/* ── Social links ──────────────────────────────── */}
                <CollapsibleCard title="Social links">
                    <RepeatableList
                        items={data.socials || []}
                        onChange={v => onChange(set(data, 'socials', v))}
                        makeNew={() => ({ id: `soc_${Math.random().toString(36).slice(2,8)}`, platform: 'github', link: { kind: 'external', url: '' } })}
                        itemLabel={(s) => s.platform || '(no platform)'}
                        collapsible
                        renderItem={(s, updS) => (
                            <>
                                <FieldSelect
                                    label="Platform"
                                    value={s.platform}
                                    options={[
                                        { value: 'github',   label: 'GitHub' },
                                        { value: 'twitter',  label: 'Twitter / X' },
                                        { value: 'linkedin', label: 'LinkedIn' },
                                        { value: 'other',    label: 'Other' },
                                    ]}
                                    onChange={v => updS({ ...s, platform: v })}
                                />
                                <LinkField
                                    label="URL"
                                    value={s.link}
                                    pages={pages}
                                    onChange={v => updS({ ...s, link: v })}
                                />
                            </>
                        )}
                        addLabel="Add social"
                    />
                </CollapsibleCard>
            </CollapsibleCard>
        </>
    );
}

// ── shared internal ───────────────────────────────────────────────────

function FieldSelect({ value, onChange, options, label }) {
    return (
        <div className="flex flex-col gap-1.5 mb-3">
            {label ? <label className="text-xs font-medium text-[var(--text-secondary)]">{label}</label> : null}
            <select
                className="w-full px-3 py-2 rounded-md text-sm border bg-[var(--bg-tertiary)] border-[var(--border-default)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                value={value || ''}
                onChange={e => onChange(e.target.value)}
            >
                {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
        </div>
    );
}

// ── Catalogue + registries ────────────────────────────────────────────
//
// BLOCK_CATALOGUE   used by BlockList (add picker) and BlockRow (labels/icons)
// BLOCK_EDITORS     used by ProductWebsitePanel to render the active editor
// BLOCK_DEFAULTS    used by the panel when creating a new block

export const BLOCK_CATALOGUE = {
    hero:         { type: 'hero',         label: 'Hero',           icon: 'Megaphone',   category: 'Above the fold' },
    socialProof:  { type: 'socialProof',  label: 'Social proof',   icon: 'Users',       category: 'Above the fold' },
    content:      { type: 'content',      label: 'Content',        icon: 'Type',             category: 'Content' },
    'media-text': { type: 'media-text',   label: 'Media + Text',   icon: 'LayoutPanelLeft',  category: 'Content' },
    features:     { type: 'features',     label: 'Features',       icon: 'Sparkles',         category: 'Content' },
    steps:        { type: 'steps',        label: 'How it works',   icon: 'ListOrdered', category: 'Content' },
    security:     { type: 'security',     label: 'Security',       icon: 'ShieldCheck', category: 'Content' },
    integrations: { type: 'integrations', label: 'Integrations',   icon: 'Plug',        category: 'Content' },
    architecture: { type: 'architecture', label: 'Architecture',   icon: 'Boxes',       category: 'Content' },
    techStats:    { type: 'techStats',    label: 'Stats',          icon: 'BarChart3',   category: 'Content' },
    cta:          { type: 'cta',          label: 'Call to action', icon: 'Target',           category: 'Conversion' },
    'cta-banner': { type: 'cta-banner',   label: 'CTA Banner',     icon: 'Rocket',           category: 'Conversion' },
};

export const BLOCK_EDITORS = {
    hero:         { component: HeroEditor,         label: 'Hero',           icon: 'Megaphone'   },
    socialProof:  { component: SocialProofEditor,  label: 'Social proof',   icon: 'Users'       },
    content:      { component: ContentEditor,      label: 'Content',        icon: 'Type'             },
    'media-text': { component: MediaTextEditor,    label: 'Media + Text',   icon: 'LayoutPanelLeft'  },
    features:     { component: FeaturesEditor,     label: 'Features',       icon: 'Sparkles'         },
    steps:        { component: StepsEditor,        label: 'How it works',   icon: 'ListOrdered' },
    security:     { component: SecurityEditor,     label: 'Security',       icon: 'ShieldCheck' },
    integrations: { component: IntegrationsEditor, label: 'Integrations',   icon: 'Plug'        },
    architecture: { component: ArchitectureEditor, label: 'Architecture',   icon: 'Boxes'       },
    techStats:    { component: TechStatsEditor,    label: 'Stats',          icon: 'BarChart3'   },
    cta:          { component: CTAEditor,          label: 'Call to action', icon: 'Target'           },
    'cta-banner': { component: CtaBannerEditor,    label: 'CTA Banner',     icon: 'Rocket'           },
};

// Brand-neutral placeholder content used when the user clicks "+ Add block"
// in the panel. Kept in sync with server/i18n/defaults/cmsDefaults.js so a
// block created via the panel matches one created server-side.
export const BLOCK_DEFAULTS = {
    hero: {
        eyebrow: '',
        // Each toggle-able piece carries an `enabled: true` so the panel's
        // "Show …" toggles can flip it off. Old hero blocks stored without
        // this field render as before because the renderer treats missing
        // `enabled` as truthy via `!== false`.
        badge: { enabled: true, text: '', icon: '' },
        // Per-text styling — empty strings / 0 = inherit the page CSS and
        // the Design tab, so blocks stored without these keys read as
        // undefined and the renderer skips inline-style application.
        badgeStyle: { fontFamily: '', fontSize: 0, color: '' },
        titleParts: [{ text: 'Your headline here', gradient: false }],
        titleStyle: { fontFamily: '', fontSize: 0, color: '' },
        lead: 'Describe your product or service',
        leadStyle: { fontFamily: '', fontSize: 0, color: '' },
        // CTAs grew an explicit `style` field (matching site-chrome /
        // multi-CTA patterns) and an `enabled` toggle. Defaults preserve
        // the original visual: primary = filled orange, secondary = outline.
        primaryCta:   { enabled: true, label: 'Get started', style: 'primary',   link: { kind: 'anchor', anchor: '' } },
        secondaryCta: { enabled: true, label: 'Learn more',  style: 'secondary', link: { kind: 'anchor', anchor: '' } },
        mockup: { enabled: true, chatBubbles: [] },
        // 'default' / 'surface' / 'primary' / 'dark' — same scale as
        // Media + Text and Content blocks. Default keeps the page bg.
        backgroundVariant: 'default',
    },
    socialProof: {
        eyebrow: 'Add your client logos',
        title: '',
        // Empty strings = inherit the page CSS / Design tab. Old blocks
        // saved without these keys read as `undefined` and the renderer
        // skips inline-style application, so backwards-compat is free.
        eyebrowStyle: { fontFamily: '', fontSize: 14, color: '' },
        titleStyle:   { fontFamily: '', fontSize: 32, color: '' },
        logos: [],
    },
    content: {
        // New flexible Content block — column + elements system. The editor
        // and renderer accept the legacy flat shape too via
        // migrateLegacyContent(), so existing blocks keep rendering until
        // they're saved (the next save persists the new shape).
        columnLayout: '1',
        verticalAlign: 'top',
        background: 'none',
        columns: [
            {
                id: 'col_default',
                elements: [
                    {
                        id: 'el_default',
                        kind: 'text',
                        heading: 'Your heading here',
                        subheading: '',
                        body: 'Add your content here.',
                        align: 'left',
                    },
                ],
            },
        ],
    },
    'media-text': {
        heading:           'Your heading here',
        subheading:        null,
        body:              'Add your content here.',
        cta:               null,                       // { label, link: { kind, ... } }
        media: {
            kind: 'image',                              // 'image' | 'video'
            src:  '',
            alt:  '',
        },
        mediaPosition:     'left',                     // 'left' | 'right'
        mediaSize:         'half',                     // 'half' | 'third' | 'two-thirds'
        backgroundVariant: 'default',                  // 'default' | 'surface' | 'primary' | 'dark'
    },
    features: {
        eyebrow: 'Features',
        title: 'What we offer',
        lead: '',
        items: [
            { icon: 'Star',   title: 'Feature 1', body: 'Describe this feature', techTag: '' },
            { icon: 'Zap',    title: 'Feature 2', body: 'Describe this feature', techTag: '' },
            { icon: 'Shield', title: 'Feature 3', body: 'Describe this feature', techTag: '' },
        ],
    },
    steps: {
        eyebrow: '',
        title: 'How it works',
        lead: '',
        items: [
            { number: '1', title: 'Step 1', body: 'Describe what happens in this step', example: '' },
            { number: '2', title: 'Step 2', body: 'Describe what happens in this step', example: '' },
            { number: '3', title: 'Step 3', body: 'Describe what happens in this step', example: '' },
        ],
    },
    security: {
        eyebrow: '',
        title: 'Security',
        lead: '',
        cards: [
            { icon: 'Lock',        title: 'Data encryption', summary: 'Describe your encryption story', details: [] },
            { icon: 'KeyRound',    title: 'Access control',  summary: 'Describe your access controls',  details: [] },
            { icon: 'ShieldCheck', title: 'Compliance',      summary: 'Describe your compliance posture', details: [] },
        ],
    },
    integrations: {
        eyebrow: '',
        title: 'Integrations',
        lead: 'Add your integrations',
        categories: [],
    },
    architecture: {
        eyebrow: '',
        title: 'Architecture',
        lead: 'Describe your architecture',
        layers: [{ label: 'Layer 1', tags: [] }],
    },
    techStats: {
        eyebrow: '',
        title: 'Key numbers',
        stats: [
            { number: '100+', label: 'Customers' },
            { number: '99%',  label: 'Uptime' },
            { number: '24/7', label: 'Support' },
        ],
    },
    cta: {
        title: 'Ready to get started?',
        lead: 'Contact us today',
        button: { label: 'Get started', link: { kind: 'anchor', anchor: '' } },
    },
    'cta-banner': {
        heading:           'Ready to get started?',
        subheading:        'Join thousands of teams already using the platform.',
        layout:            'centered',                  // 'centered' | 'split'
        backgroundVariant: 'primary',                   // 'default' | 'surface' | 'primary' | 'dark'
        primaryCta: {
            label: 'Get started',
            link: { kind: 'external', url: '', newTab: false },
        },
        secondaryCta:      null,                        // null | { label, link: { kind, ... } }
    },
};

// Legacy aliases — kept so AdminDashboard and any other import that uses
// the old names doesn't break before it's updated.
export const SECTION_EDITORS = BLOCK_EDITORS;
export const SECTION_ORDER   = Object.keys(BLOCK_CATALOGUE);
