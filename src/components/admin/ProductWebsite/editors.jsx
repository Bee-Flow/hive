import React, { useEffect, useState } from 'react';
import { TextField, Toggle, IconField, ImageField, RepeatableList, LinkField, FieldRow, AlignControl, inputCls } from './fields';
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

// Small inline color swatch + hex text input. Used everywhere a compact
// color affordance is needed (size & color rows, per-card title color,
// etc.). The hex input lets users paste a colour code instead of fishing
// around in the native swatch picker. Local `hexInput` state lets the
// user type partial values (e.g. "#F3") without snapping every keystroke
// to the prop value; only a complete `#RRGGBB` commits via onChange.
function ColorSwatch({ value, onChange, title }) {
    const hex = typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000';
    const [hexInput, setHexInput] = useState(typeof value === 'string' ? value : '');

    // Resync local typing state when the prop value changes from outside
    // (the native swatch picker, or another control mutating the same key).
    useEffect(() => {
        setHexInput(typeof value === 'string' ? value : '');
    }, [value]);

    const handleHexChange = (raw) => {
        const cleaned = raw.replace(/[^0-9a-fA-F#]/g, '');
        const withHash = cleaned.startsWith('#') ? cleaned : (cleaned ? `#${cleaned}` : '');
        setHexInput(withHash);
        if (/^#[0-9a-fA-F]{6}$/.test(withHash)) {
            onChange(withHash);
        }
    };

    return (
        <div className="inline-flex items-center gap-1.5">
            <input
                type="color"
                value={hex}
                onChange={(e) => onChange(e.target.value)}
                title={title}
                className="h-7 w-7 rounded border border-[var(--border-default)] bg-[var(--bg-tertiary)] cursor-pointer p-0 shrink-0"
                style={{ minWidth: '28px' }}
            />
            <input
                type="text"
                value={hexInput}
                onChange={(e) => handleHexChange(e.target.value)}
                placeholder="#000000"
                maxLength={7}
                spellCheck={false}
                aria-label={title ? `${title} hex` : 'Color hex'}
                className="w-20 px-1.5 py-1 rounded text-xs font-mono uppercase border border-[var(--border-default)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
            />
        </div>
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

            <CollapsibleCard title="Title" defaultOpen={false}>
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
                <CollapsibleCard title="Lead" defaultOpen={false}>
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
                        <NavDropdownEditor item={item} update={update} pages={pages} />
                    </>
                )}
                />
            </CollapsibleCard>
        </>
    );
}

// ── Nav dropdown editor (mega-menu support) ──────────────────────────
//
// Each top-level nav link can carry either:
//   • children:   flat list (legacy, default — exactly the original shape)
//   • dropdown:   { layout: 'columns', columns: [{ heading, items: [{
//                  label, link, description, icon, openInNewTab }] }] }
//
// Layout is chosen via the segmented control. List mode keeps writing to
// `children` so existing sites keep rendering unchanged. Columns mode
// stores a separate `dropdown` blob — additive, no migration required.

const newColumn = () => ({
    id: `col_${Math.random().toString(36).slice(2, 8)}`,
    heading: '',
    items: [],
});
const newMegaItem = () => ({
    id: `mi_${Math.random().toString(36).slice(2, 8)}`,
    label: 'New item',
    link: { kind: 'external', url: '#' },
    description: '',
    icon: '',
    openInNewTab: false,
});

function NavDropdownEditor({ item, update, pages }) {
    const layout = item.dropdown?.layout === 'columns' ? 'columns' : 'list';
    const columns = Array.isArray(item.dropdown?.columns) ? item.dropdown.columns : [];
    const children = Array.isArray(item.children) ? item.children : [];

    const itemCount = layout === 'columns'
        ? columns.reduce((sum, c) => sum + (Array.isArray(c.items) ? c.items.length : 0), 0)
        : children.length;

    const setLayout = (next) => {
        if (next === layout) return;
        if (next === 'columns') {
            // Lazy-migrate: fold any existing flat children into a single
            // column so the user sees their work, not an empty editor.
            const seeded = columns.length > 0
                ? columns
                : [{
                    ...newColumn(),
                    items: children.map(c => ({
                        id: c.id || `mi_${Math.random().toString(36).slice(2, 8)}`,
                        label: c.label || '',
                        link: c.link,
                        description: '',
                        icon: '',
                        openInNewTab: false,
                    })),
                }];
            update({ ...item, dropdown: { layout: 'columns', columns: seeded } });
        } else {
            // Keep the columns blob around so toggling back doesn't lose
            // work, but mark layout=list so the renderer falls back to
            // `children` (the legacy source of truth for list mode).
            update({ ...item, dropdown: { ...(item.dropdown || {}), layout: 'list' } });
        }
    };

    const SegBtn = ({ value, label }) => (
        <button
            type="button"
            onClick={() => setLayout(value)}
            className={
                'px-3 py-1.5 text-xs transition-colors ' +
                (layout === value
                    ? 'bg-[var(--accent-primary)] text-white'
                    : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]')
            }
        >
            {label}
        </button>
    );

    return (
        <CollapsibleCard
            title={`Dropdown  (${itemCount} ${itemCount === 1 ? 'item' : 'items'})`}
            defaultOpen={false}
        >
            <FieldRow label="Layout">
                <div className="inline-flex rounded-md border border-[var(--border-subtle)] overflow-hidden">
                    <SegBtn value="list"    label="List" />
                    <SegBtn value="columns" label="Columns" />
                </div>
            </FieldRow>

            {layout === 'columns' ? (
                <RepeatableList
                    label="Columns"
                    items={columns}
                    onChange={v => update({ ...item, dropdown: { layout: 'columns', columns: v } })}
                    makeNew={newColumn}
                    itemLabel={(col) => col.heading || '(no heading)'}
                    collapsible
                    renderItem={(col, updCol) => (
                        <>
                            <TextField
                                label="Section heading"
                                value={col.heading || ''}
                                onChange={v => updCol({ ...col, heading: v })}
                                placeholder="Optional — e.g. Features, Channels"
                            />
                            <RepeatableList
                                label="Items"
                                items={col.items || []}
                                onChange={v => updCol({ ...col, items: v })}
                                makeNew={newMegaItem}
                                itemLabel={(mi) => mi.label || '(no label)'}
                                collapsible
                                renderItem={(mi, updMi) => (
                                    <>
                                        <TextField
                                            label="Label"
                                            value={mi.label || ''}
                                            onChange={v => updMi({ ...mi, label: v })}
                                        />
                                        <LinkField
                                            label="Link"
                                            value={mi.link}
                                            pages={pages}
                                            onChange={v => updMi({ ...mi, link: v })}
                                        />
                                        <TextField
                                            label="Description"
                                            value={mi.description || ''}
                                            onChange={v => updMi({ ...mi, description: v })}
                                            placeholder="Optional one-liner shown under the label"
                                        />
                                        <TextField
                                            label="Icon"
                                            value={mi.icon || ''}
                                            onChange={v => updMi({ ...mi, icon: v })}
                                            placeholder="Optional emoji (e.g. 🚀) or short text"
                                        />
                                        <Toggle
                                            label="Open in new tab"
                                            value={!!mi.openInNewTab}
                                            onChange={v => updMi({ ...mi, openInNewTab: v })}
                                        />
                                    </>
                                )}
                                addLabel="Add item"
                            />
                        </>
                    )}
                    addLabel="Add column"
                />
            ) : (
                <RepeatableList
                    label="Dropdown children (optional)"
                    items={children}
                    onChange={v => update({ ...item, children: v })}
                    makeNew={() => ({
                        id: `nav_${Math.random().toString(36).slice(2, 8)}`,
                        label: 'Child link',
                        link: { kind: 'external', url: '#' },
                    })}
                    itemLabel={(child) => child.label}
                    renderItem={(child, updChild) => (
                        <>
                            <TextField label="Label" value={child.label} onChange={v => updChild({ ...child, label: v })} />
                            <LinkField label="Link"  value={child.link}  pages={pages} onChange={v => updChild({ ...child, link: v })} />
                        </>
                    )}
                    addLabel="Add child"
                />
            )}
        </CollapsibleCard>
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
            <CollapsibleCard title="Badge" defaultOpen={true}>
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
                            align={data.badgeAlign || data.align || 'left'}
                            onAlignChange={v => onChange(set(data, 'badgeAlign', v))}
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
            </CollapsibleCard>

            {/* ── Headline ────────────────────────────────────────── */}
            <CollapsibleCard title="Headline" defaultOpen={true}>
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
                <FieldRow label="Alignment">
                    <AlignControl
                        value={data.titleAlign || data.align || 'left'}
                        onChange={v => onChange(set(data, 'titleAlign', v))}
                    />
                </FieldRow>
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
            </CollapsibleCard>

            {/* ── Lead ────────────────────────────────────────────── */}
            <CollapsibleCard title="Lead paragraph" defaultOpen={true}>
                <Toggle
                    label="Show lead"
                    value={leadOn}
                    onChange={v => onChange(set(data, 'leadEnabled', v))}
                />
                {leadOn ? (
                    <>
                        <TextField
                            label="Text"
                            value={data.lead || ''}
                            onChange={v => onChange(set(data, 'lead', v))}
                            placeholder="Short paragraph below the headline."
                            align={data.leadAlign || data.align || 'left'}
                            onAlignChange={v => onChange(set(data, 'leadAlign', v))}
                        />
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
            </CollapsibleCard>

            {/* ── Primary CTA ─────────────────────────────────────── */}
            <CollapsibleCard title="Primary CTA" defaultOpen={true}>
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
            </CollapsibleCard>

            {/* ── Secondary CTA ───────────────────────────────────── */}
            <CollapsibleCard title="Secondary CTA" defaultOpen={true}>
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
            </CollapsibleCard>

            {/* ── Mockup ──────────────────────────────────────────── */}
            <CollapsibleCard title="Mockup" defaultOpen={true}>
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
            </CollapsibleCard>

            {/* ── Background ──────────────────────────────────────── */}
            <CollapsibleCard title="Background" defaultOpen={true}>
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
            </CollapsibleCard>
        </>
    );
}

// ── Social Proof ──────────────────────────────────────────────────────

// Grayscale + sepia tint control for the Social Proof logo strip.
// Maps a 0–80 slider value to the `--logo-tint` CSS variable read by the
// renderer's filter rule: `filter: grayscale(1) sepia(<value>%)`. The
// three reference swatches below the slider are pure visual hints.
function LogoTintControl({ value, onChange }) {
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

export function SocialProofEditor({ data = {}, onChange }) {
    // Eyebrow + Title (style controls + text fields) come from the
    // shared header helper. Social Proof has no `lead`, so showLead
    // is disabled — the helper skips that subsection entirely.
    return (
        <>
            <InlineHint>Click the eyebrow and title text in the preview to edit them inline. Style each independently below.</InlineHint>

            <SectionHeaderFields data={data} onChange={onChange} showLead={false} />

            {/* ── Logos ───────────────────────────────────────── */}
            <CollapsibleCard title={`Logos (${(data.logos || []).length})`} defaultOpen={true}>
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
                <LogoTintControl
                    value={Number.isFinite(data.logoTint) ? data.logoTint : 0}
                    onChange={v => onChange(set(data, 'logoTint', v))}
                />
            </CollapsibleCard>
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
                        align={el.headingAlign || el.align || 'left'}
                        onAlignChange={v => update({ ...el, headingAlign: v })}
                    />
                    <TextField
                        label="Subheading"
                        value={el.subheading || ''}
                        onChange={v => update({ ...el, subheading: v })}
                        placeholder="Optional subheading"
                        align={el.subheadingAlign || el.align || 'left'}
                        onAlignChange={v => update({ ...el, subheadingAlign: v })}
                    />
                    <TextField
                        label="Body"
                        value={el.body || ''}
                        onChange={v => update({ ...el, body: v })}
                        placeholder="Write paragraph text. Line breaks are preserved."
                        align={el.bodyAlign || el.align || 'left'}
                        onAlignChange={v => update({ ...el, bodyAlign: v })}
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
                    <Toggle
                        label="Full width image"
                        value={!!el.fullBleed}
                        onChange={v => update({ ...el, fullBleed: v })}
                    />
                    <Toggle
                        label="Click to enlarge (lightbox)"
                        value={!!el.lightbox}
                        onChange={v => update({ ...el, lightbox: v })}
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
                    {/* Source toggle: external embed (YouTube/Vimeo iframe)
                        vs. self-hosted file upload (MP4/WebM, looped + muted
                        like the Media + Text 'video-silent' kind). Both paths
                        write the resulting address to el.url so the renderer
                        only has one field to read. */}
                    <FieldSelect
                        label="Source"
                        value={el.source === 'upload' ? 'upload' : 'embed'}
                        options={[
                            { value: 'embed',  label: 'External URL (YouTube / Vimeo)' },
                            { value: 'upload', label: 'Upload file (MP4 / WebM)' },
                        ]}
                        onChange={v => update({ ...el, source: v, url: '' })}
                    />
                    {el.source === 'upload' ? (
                        <ImageField
                            label="Video file"
                            value={el.url || ''}
                            onChange={v => update({ ...el, url: v })}
                            accept="video/mp4,video/webm"
                            previewKind="video"
                            uploadLabel="Upload video"
                            placeholder="https://… or /api/cms/asset/cms/…"
                        />
                    ) : (
                        <TextField
                            label="Video URL"
                            value={el.url || ''}
                            onChange={v => update({ ...el, url: v })}
                            placeholder="YouTube or Vimeo URL"
                        />
                    )}
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
    const cta      = data.cta || {};

    // Per-field style blobs — same `*Style.{fontFamily,fontSize,color}`
    // shape Hero uses (badgeStyle/titleStyle/leadStyle). Keeping the
    // storage shape stable means existing pages don't need migration and
    // the renderer's inlineTextStyle() reads keep working unchanged.
    const headingStyle    = data.headingStyle    || {};
    const subheadingStyle = data.subheadingStyle || {};
    const bodyStyle       = data.bodyStyle       || {};
    const ctaStyle        = data.ctaStyle        || {};

    const setHeadingStyle    = (patch) => onChange(set(data, 'headingStyle',    { ...headingStyle,    ...patch }));
    const setSubheadingStyle = (patch) => onChange(set(data, 'subheadingStyle', { ...subheadingStyle, ...patch }));
    const setBodyStyle       = (patch) => onChange(set(data, 'bodyStyle',       { ...bodyStyle,       ...patch }));
    const setCtaStyle        = (patch) => onChange(set(data, 'ctaStyle',        { ...ctaStyle,        ...patch }));

    const showSubheading = data.subheading !== null && data.subheading !== undefined;
    const showCta        = !!data.cta;

    const toggleSubheading = (next) => setField('subheading', next ? '' : null);
    const toggleCta        = (next) => setField('cta',
        next ? { label: 'Learn more', link: { kind: 'anchor', anchor: '' } } : null);

    const updateMedia = (key, value) => setField('media', { ...media, [key]: value });
    const updateCta   = (key, value) => setField('cta',   { ...cta, [key]: value });

    return (
        <>
            <InlineHint>Click the heading, subheading, body, and CTA label in the preview to edit them inline. Use the panels below for structure and styling.</InlineHint>

            {/* ── Heading ─────────────────────────────────────────── */}
            <CollapsibleCard title="Heading" defaultOpen={true}>
                <TextField
                    label="Text"
                    value={data.heading || ''}
                    onChange={v => setField('heading', v)}
                    placeholder="Heading"
                    align={data.headingAlign || data.align || 'left'}
                    onAlignChange={v => setField('headingAlign', v)}
                />
                <FontRow
                    label="Font"
                    value={headingStyle.fontFamily || ''}
                    onChange={v => setHeadingStyle({ fontFamily: v })}
                    sample={data.heading || 'Heading preview'}
                    weight={700}
                />
                <FieldRow label="Size (px)">
                    <input
                        type="number"
                        min={12}
                        max={96}
                        step={1}
                        className={inputCls}
                        value={Number.isFinite(headingStyle.fontSize) && headingStyle.fontSize > 0 ? headingStyle.fontSize : ''}
                        placeholder="inherit"
                        onChange={e => setHeadingStyle({ fontSize: Number(e.target.value) || 0 })}
                    />
                </FieldRow>
                <ColorRow
                    label="Color"
                    value={headingStyle.color || ''}
                    onChange={v => setHeadingStyle({ color: v })}
                />
            </CollapsibleCard>

            {/* ── Subheading ──────────────────────────────────────── */}
            <CollapsibleCard title="Subheading" defaultOpen={false}>
                <Toggle
                    label="Show subheading"
                    value={showSubheading}
                    onChange={toggleSubheading}
                />
                {showSubheading ? (
                    <>
                        <TextField
                            label="Text"
                            value={data.subheading || ''}
                            onChange={v => setField('subheading', v)}
                            placeholder="Subheading"
                            align={data.subheadingAlign || data.align || 'left'}
                            onAlignChange={v => setField('subheadingAlign', v)}
                        />
                        <FontRow
                            label="Font"
                            value={subheadingStyle.fontFamily || ''}
                            onChange={v => setSubheadingStyle({ fontFamily: v })}
                            sample={data.subheading || 'Subheading preview'}
                            weight={500}
                        />
                        <FieldRow label="Size (px)">
                            <input
                                type="number"
                                min={10}
                                max={48}
                                step={1}
                                className={inputCls}
                                value={Number.isFinite(subheadingStyle.fontSize) && subheadingStyle.fontSize > 0 ? subheadingStyle.fontSize : ''}
                                placeholder="inherit"
                                onChange={e => setSubheadingStyle({ fontSize: Number(e.target.value) || 0 })}
                            />
                        </FieldRow>
                        <ColorRow
                            label="Color"
                            value={subheadingStyle.color || ''}
                            onChange={v => setSubheadingStyle({ color: v })}
                        />
                    </>
                ) : null}
            </CollapsibleCard>

            {/* ── Body ────────────────────────────────────────────── */}
            <CollapsibleCard title="Body" defaultOpen={false}>
                <TextField
                    label="Text"
                    value={data.body || ''}
                    onChange={v => setField('body', v)}
                    placeholder="Body text"
                    align={data.bodyAlign || data.align || 'left'}
                    onAlignChange={v => setField('bodyAlign', v)}
                />
                <FontRow
                    label="Font"
                    value={bodyStyle.fontFamily || ''}
                    onChange={v => setBodyStyle({ fontFamily: v })}
                    sample={data.body || 'The quick brown fox jumps over the lazy dog.'}
                    weight={400}
                />
                <FieldRow label="Size (px)">
                    <input
                        type="number"
                        min={10}
                        max={32}
                        step={1}
                        className={inputCls}
                        value={Number.isFinite(bodyStyle.fontSize) && bodyStyle.fontSize > 0 ? bodyStyle.fontSize : ''}
                        placeholder="inherit"
                        onChange={e => setBodyStyle({ fontSize: Number(e.target.value) || 0 })}
                    />
                </FieldRow>
                <ColorRow
                    label="Color"
                    value={bodyStyle.color || ''}
                    onChange={v => setBodyStyle({ color: v })}
                />
            </CollapsibleCard>

            {/* ── CTA ─────────────────────────────────────────────── */}
            <CollapsibleCard title="CTA" defaultOpen={false}>
                <Toggle
                    label="Show CTA"
                    value={showCta}
                    onChange={toggleCta}
                />
                {showCta ? (
                    <>
                        <TextField
                            label="Label"
                            value={cta.label || ''}
                            onChange={v => updateCta('label', v)}
                            placeholder="Learn more"
                        />
                        <LinkField
                            label="Destination"
                            value={cta.link}
                            pages={pages}
                            onChange={v => updateCta('link', v)}
                        />
                        <FieldRow label="Style">
                            <select
                                className={inputCls}
                                value={cta.style || 'primary'}
                                onChange={e => updateCta('style', e.target.value)}
                            >
                                <option value="primary">Primary (filled)</option>
                                <option value="secondary">Secondary (outlined)</option>
                                <option value="ghost">Ghost (no border)</option>
                                <option value="link">Link (underlined)</option>
                            </select>
                        </FieldRow>
                        <FontRow
                            label="Font"
                            value={ctaStyle.fontFamily || ''}
                            onChange={v => setCtaStyle({ fontFamily: v })}
                            sample={cta.label || 'Button label'}
                            weight={600}
                        />
                        <FieldRow label="Size (px)">
                            <input
                                type="number"
                                min={10}
                                max={32}
                                step={1}
                                className={inputCls}
                                value={Number.isFinite(ctaStyle.fontSize) && ctaStyle.fontSize > 0 ? ctaStyle.fontSize : ''}
                                placeholder="inherit"
                                onChange={e => setCtaStyle({ fontSize: Number(e.target.value) || 0 })}
                            />
                        </FieldRow>
                        <ColorRow
                            label="Color"
                            value={ctaStyle.color || ''}
                            onChange={v => setCtaStyle({ color: v })}
                        />
                    </>
                ) : null}
            </CollapsibleCard>

            {/* ── Media ───────────────────────────────────────────── */}
            <CollapsibleCard title="Media" defaultOpen={false}>
                <FieldSelect
                    label="Media type"
                    value={media.kind || 'image'}
                    options={[
                        { value: 'image',        label: 'Image' },
                        { value: 'gif',          label: 'GIF / Animation' },
                        { value: 'video',        label: 'Video (embed URL)' },
                        { value: 'video-silent', label: 'Video loop (no audio)' },
                    ]}
                    onChange={v => updateMedia('kind', v)}
                />
                {media.kind === 'gif' ? (
                    <>
                        <ImageField
                            label="GIF / animation"
                            value={media.src || ''}
                            onChange={v => updateMedia('src', v)}
                            accept="image/gif,image/webp,image/apng,image/png,image/jpeg"
                            uploadLabel="Upload GIF"
                            placeholder="https://… or /api/cms/asset/cms/…"
                        />
                        <TextField
                            label="Alt text"
                            value={media.alt || ''}
                            onChange={v => updateMedia('alt', v)}
                            placeholder="Describe the animation"
                        />
                    </>
                ) : media.kind === 'video-silent' ? (
                    <>
                        <ImageField
                            label="Video"
                            value={media.src || ''}
                            onChange={v => updateMedia('src', v)}
                            accept="video/mp4,video/webm"
                            previewKind="video"
                            uploadLabel="Upload video"
                            placeholder="https://… or /api/cms/asset/cms/…"
                        />
                        <TextField
                            label="Alt text"
                            value={media.alt || ''}
                            onChange={v => updateMedia('alt', v)}
                            placeholder="Describe the video"
                        />
                    </>
                ) : media.kind === 'video' ? (
                    <TextField
                        label="Video embed URL"
                        value={media.src || ''}
                        onChange={v => updateMedia('src', v)}
                        placeholder="https://www.youtube.com/embed/… or https://player.vimeo.com/video/…"
                        hint="Use the embed URL, not the public watch URL."
                    />
                ) : (
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
                )}
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
            </CollapsibleCard>

            <BackgroundCard data={data} onChange={onChange} />
        </>
    );
}

// ── Features ──────────────────────────────────────────────────────────

export function FeaturesEditor({ data = {}, onChange }) {
    return (
        <>
            <InlineHint>Eyebrow, title, lead, and each card's title and body are editable in the preview.</InlineHint>
            <SectionHeaderFields data={data} onChange={onChange} />
            <RepeatableList
                label="Feature cards"
                items={data.items || []}
                onChange={v => onChange(set(data, 'items', v))}
                makeNew={() => ({ icon: 'Sparkles', title: 'New feature', body: '', popupEmbed: '', cardAction: 'none', cardUrl: '' })}
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
                                <textarea
                                    rows={6}
                                    className={inputCls + ' resize-y'}
                                    style={{
                                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                                        fontSize: 12.5,
                                        lineHeight: 1.5,
                                        whiteSpace: 'pre',
                                    }}
                                    value={item.popupEmbed || ''}
                                    onChange={e => update({ ...item, popupEmbed: e.target.value })}
                                    placeholder={'<!-- Paste HTML / CSS / JS shown when the card is clicked -->'}
                                    spellCheck={false}
                                />
                            </FieldRow>
                        ) : null}
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
                makeNew={() => ({ icon: 'ShieldCheck', title: 'New card', summary: '', details: [], cardAction: 'none', cardUrl: '', popupEmbed: '' })}
                itemLabel={(item) => item.title || '(no title)'}
                renderItem={(item, update) => (
                    <>
                        <IconField label="Icon" value={item.icon} onChange={v => update({ ...item, icon: v })} />
                        <TextField
                            label="Title"
                            value={item.title || ''}
                            onChange={v => update({ ...item, title: v })}
                            placeholder="Card title"
                            align={item.titleAlign || 'left'}
                            onAlignChange={v => update({ ...item, titleAlign: v })}
                        />
                        <TextField
                            label="Summary"
                            value={item.summary || ''}
                            onChange={v => update({ ...item, summary: v })}
                            placeholder="Short summary"
                            align={item.summaryAlign || 'left'}
                            onAlignChange={v => update({ ...item, summaryAlign: v })}
                        />
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
                        {/* Card action — same toggle as the Features block.
                            none/link/popup drives the renderer's per-card
                            behaviour: link wraps in an <a>; popup opens a
                            sandboxed iframe modal; none leaves the card
                            static. */}
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
                                <textarea
                                    rows={6}
                                    className={inputCls + ' resize-y'}
                                    style={{
                                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                                        fontSize: 12.5,
                                        lineHeight: 1.5,
                                        whiteSpace: 'pre',
                                    }}
                                    value={item.popupEmbed || ''}
                                    onChange={e => update({ ...item, popupEmbed: e.target.value })}
                                    placeholder={'<!-- Paste HTML / CSS / JS shown when the card is clicked -->'}
                                    spellCheck={false}
                                />
                            </FieldRow>
                        ) : null}
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
            <CollapsibleCard title="Text" defaultOpen={true}>
                <TextField
                    label="Title"
                    value={data.title || ''}
                    onChange={v => onChange(set(data, 'title', v))}
                    placeholder="Call to action title"
                    align={data.titleAlign || data.align || 'left'}
                    onAlignChange={v => onChange(set(data, 'titleAlign', v))}
                />
                <TextField
                    label="Lead"
                    value={data.lead || ''}
                    onChange={v => onChange(set(data, 'lead', v))}
                    placeholder="Supporting line"
                    align={data.leadAlign || data.align || 'left'}
                    onAlignChange={v => onChange(set(data, 'leadAlign', v))}
                />
            </CollapsibleCard>
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

            <CollapsibleCard title="Text" defaultOpen={true}>
                <TextField
                    label="Heading"
                    value={data.heading || ''}
                    onChange={v => setField('heading', v)}
                    placeholder="Heading"
                    align={data.headingAlign || data.align || 'left'}
                    onAlignChange={v => setField('headingAlign', v)}
                />
                <TextField
                    label="Subheading"
                    value={data.subheading || ''}
                    onChange={v => setField('subheading', v)}
                    placeholder="Subheading"
                    align={data.subheadingAlign || data.align || 'left'}
                    onAlignChange={v => setField('subheadingAlign', v)}
                />
            </CollapsibleCard>

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

// ── Live Component ────────────────────────────────────────────────────
//
// Single textarea — the user pastes a full HTML document (or just a
// snippet with <style>/<script> tags). The renderer drops it into an
// `srcDoc` iframe sandboxed to `allow-scripts` only, so untrusted code
// can't reach back into the parent page.

export function LiveComponentEditor({ data = {}, pages = [], onChange }) {
    const setField = (key, value) => onChange(set(data, key, value));
    const layout   = data.layout || 'full';
    const cta      = data.cta || {};
    const ctaOn    = cta.enabled !== false;
    const setCta   = (patch) => onChange(set(data, 'cta', { ...cta, ...patch }));
    const CTA_STYLE_OPTIONS = [
        { value: 'primary',   label: 'Primary (filled)' },
        { value: 'secondary', label: 'Secondary (outlined)' },
        { value: 'ghost',     label: 'Ghost (no border)' },
        { value: 'link',      label: 'Link (underlined)' },
    ];

    // Font-weight options for the Heading / Body typography cards. The
    // shared StyleTriplet only covers font / size / color, so weight is a
    // sibling FieldSelect that writes `fontWeight` onto the same *Style
    // blob. '' (Default) = inherit — the renderer skips it like the other
    // empty StyleTriplet fields.
    const WEIGHT_OPTIONS = [
        { value: '',    label: 'Default (inherit)' },
        { value: '300', label: 'Light (300)' },
        { value: '400', label: 'Regular (400)' },
        { value: '500', label: 'Medium (500)' },
        { value: '600', label: 'Semibold (600)' },
        { value: '700', label: 'Bold (700)' },
        { value: '800', label: 'Extrabold (800)' },
    ];
    const weightValue = (s) => (s && s.fontWeight ? String(s.fontWeight) : '');
    const setWeight   = (key, s, v) => setField(key, { ...(s || {}), fontWeight: Number(v) || 0 });

    const codeTextareaStyle = {
        minHeight: 320,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fontSize: 12.5,
        lineHeight: 1.5,
        whiteSpace: 'pre',
    };

    return (
        <>
            <InlineHint>
                Paste any self-contained HTML / CSS / JS snippet — useful for
                AI-built animations or custom widgets that don't fit the other
                blocks. Runs in a sandboxed iframe.
            </InlineHint>

            {/* Layout picker — always visible, no collapse. */}
            <FieldRow label="Layout">
                <LayoutPicker value={layout} onChange={v => setField('layout', v)} />
            </FieldRow>

            <CollapsibleCard title="Component" defaultOpen={true}>
                <FieldRow label="Code" hint="Paste full HTML including <style> and <script> tags.">
                    <textarea
                        rows={16}
                        className={inputCls + ' resize-y'}
                        style={codeTextareaStyle}
                        value={data.code || ''}
                        onChange={e => setField('code', e.target.value)}
                        placeholder={'<!-- Paste your HTML/CSS/JS here -->'}
                        spellCheck={false}
                    />
                </FieldRow>
            </CollapsibleCard>

            {layout === 'two-components' ? (
                <CollapsibleCard title="Second component" defaultOpen={true}>
                    <FieldRow label="Code" hint="Paste full HTML including <style> and <script> tags.">
                        <textarea
                            rows={16}
                            className={inputCls + ' resize-y'}
                            style={codeTextareaStyle}
                            value={data.codeRight || ''}
                            onChange={e => setField('codeRight', e.target.value)}
                            placeholder={'<!-- Paste your HTML/CSS/JS here -->'}
                            spellCheck={false}
                        />
                    </FieldRow>
                </CollapsibleCard>
            ) : null}

            {layout === 'component-text' ? (
                <CollapsibleCard title="Text" defaultOpen={true}>
                    <TextField
                        label="Heading"
                        value={data.heading || ''}
                        onChange={v => setField('heading', v)}
                        placeholder="Section heading"
                        align={data.headingAlign || 'left'}
                        onAlignChange={v => setField('headingAlign', v)}
                    />
                    <TextField
                        label="Body"
                        value={data.body || ''}
                        onChange={v => setField('body', v)}
                        placeholder="Short paragraph next to the component."
                        align={data.bodyAlign || 'left'}
                        onAlignChange={v => setField('bodyAlign', v)}
                    />
                </CollapsibleCard>
            ) : null}

            {layout === 'component-cta' ? (
                <CollapsibleCard title="CTA" defaultOpen={true}>
                    <TextField
                        label="Heading"
                        value={data.heading || ''}
                        onChange={v => setField('heading', v)}
                        placeholder="Section heading"
                        align={data.headingAlign || 'left'}
                        onAlignChange={v => setField('headingAlign', v)}
                    />
                    <Toggle
                        label="Show CTA"
                        value={ctaOn}
                        onChange={v => setCta({ enabled: v })}
                    />
                    {ctaOn ? (
                        <>
                            <TextField
                                label="Label"
                                value={cta.label || ''}
                                onChange={v => setCta({ label: v })}
                                placeholder="Get started"
                            />
                            <LinkField
                                label="Destination"
                                value={cta.link}
                                pages={pages}
                                onChange={v => setCta({ link: v })}
                            />
                            <FieldSelect
                                label="Style"
                                value={cta.style || 'primary'}
                                options={CTA_STYLE_OPTIONS}
                                onChange={v => setCta({ style: v })}
                            />
                        </>
                    ) : null}
                </CollapsibleCard>
            ) : null}

            {/* Typography for the Heading / Body shown in the
                component-text and component-cta layouts. Mirrors the
                Content block's "Text styles" card — StyleTriplet covers
                font / size / color; font weight is an extra sibling
                control since StyleTriplet itself doesn't expose it. */}
            {(layout === 'component-text' || layout === 'component-cta') ? (
                <CollapsibleCard title="Text styles" defaultOpen={false}>
                    <StyleTriplet
                        label="Heading"
                        style={data.headingStyle}
                        onChange={v => setField('headingStyle', v)}
                        sample={data.heading || 'Heading preview'}
                        weight={700}
                        min={12} max={96}
                    />
                    <FieldSelect
                        label="Heading weight"
                        value={weightValue(data.headingStyle)}
                        options={WEIGHT_OPTIONS}
                        onChange={v => setWeight('headingStyle', data.headingStyle, v)}
                    />
                    {layout === 'component-text' ? (
                        <>
                            <StyleTriplet
                                label="Body"
                                style={data.bodyStyle}
                                onChange={v => setField('bodyStyle', v)}
                                sample={data.body || 'The quick brown fox jumps over the lazy dog.'}
                                weight={400}
                                min={10} max={32}
                            />
                            <FieldSelect
                                label="Body weight"
                                value={weightValue(data.bodyStyle)}
                                options={WEIGHT_OPTIONS}
                                onChange={v => setWeight('bodyStyle', data.bodyStyle, v)}
                            />
                        </>
                    ) : null}
                </CollapsibleCard>
            ) : null}
        </>
    );
}

// 2×2 layout picker — each option is a tile with a tiny SVG diagram of
// what that layout produces. Selected option gets an amber border + tint
// so the user can see at a glance which mode is active. Click sets
// `data.layout` via the parent's setField callback.
function LayoutPicker({ value, onChange }) {
    const OPTIONS = [
        { id: 'full',            label: 'Full width',     diagram: <DiagramFull /> },
        { id: 'two-components',  label: 'Two components', diagram: <DiagramTwo /> },
        { id: 'component-text',  label: 'Component + text', diagram: <DiagramText /> },
        { id: 'component-cta',   label: 'Component + CTA',  diagram: <DiagramCta /> },
    ];
    return (
        <div className="grid grid-cols-2 gap-2 w-full">
            {OPTIONS.map(opt => {
                const selected = value === opt.id;
                return (
                    <button
                        key={opt.id}
                        type="button"
                        onClick={() => onChange(opt.id)}
                        className={
                            'flex flex-col items-center gap-1.5 p-2 rounded-md border transition-colors text-left ' +
                            (selected
                                ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10'
                                : 'border-[var(--border-default)] bg-[var(--bg-tertiary)] hover:border-[var(--accent-primary)]/60')
                        }
                        aria-pressed={selected}
                    >
                        <div
                            className="w-full flex items-center justify-center rounded"
                            style={{
                                height: 44,
                                background: selected ? 'rgba(245, 166, 35, 0.06)' : 'var(--bg-secondary, #ffffff)',
                                border: '1px solid var(--border-subtle, rgba(15,23,42,0.08))',
                            }}
                        >
                            {opt.diagram}
                        </div>
                        <span className="text-[11px] text-[var(--text-secondary)] leading-tight">{opt.label}</span>
                    </button>
                );
            })}
        </div>
    );
}

// Tiny SVG diagrams for the layout picker. Same viewBox so they line
// up at the same scale. Kept inline because they're trivial and only
// the picker uses them.
const DIAGRAM_FILL_FRAME = 'rgba(15,23,42,0.18)';
const DIAGRAM_FILL_TEXT  = 'rgba(15,23,42,0.32)';
const DIAGRAM_FILL_CTA   = '#F5A623';
function DiagramFull() {
    return (
        <svg viewBox="0 0 60 30" width="56" height="28" aria-hidden="true">
            <rect x="2" y="4" width="56" height="22" rx="3" fill={DIAGRAM_FILL_FRAME} />
        </svg>
    );
}
function DiagramTwo() {
    return (
        <svg viewBox="0 0 60 30" width="56" height="28" aria-hidden="true">
            <rect x="2"  y="4" width="26" height="22" rx="3" fill={DIAGRAM_FILL_FRAME} />
            <rect x="32" y="4" width="26" height="22" rx="3" fill={DIAGRAM_FILL_FRAME} />
        </svg>
    );
}
function DiagramText() {
    return (
        <svg viewBox="0 0 60 30" width="56" height="28" aria-hidden="true">
            <rect x="2" y="4" width="26" height="22" rx="3" fill={DIAGRAM_FILL_FRAME} />
            <rect x="32" y="7"  width="24" height="3" rx="1.5" fill={DIAGRAM_FILL_TEXT} />
            <rect x="32" y="13" width="22" height="2" rx="1"   fill={DIAGRAM_FILL_TEXT} opacity="0.75" />
            <rect x="32" y="17" width="20" height="2" rx="1"   fill={DIAGRAM_FILL_TEXT} opacity="0.65" />
            <rect x="32" y="21" width="18" height="2" rx="1"   fill={DIAGRAM_FILL_TEXT} opacity="0.55" />
        </svg>
    );
}
function DiagramCta() {
    return (
        <svg viewBox="0 0 60 30" width="56" height="28" aria-hidden="true">
            <rect x="2"  y="4"  width="26" height="22" rx="3"   fill={DIAGRAM_FILL_FRAME} />
            <rect x="32" y="9"  width="20" height="3"  rx="1.5" fill={DIAGRAM_FILL_TEXT} />
            <rect x="32" y="17" width="14" height="6"  rx="3"   fill={DIAGRAM_FILL_CTA} />
        </svg>
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

// ── Pricing ───────────────────────────────────────────────────────────
//
// Dynamic pricing block. Plans come from the subscription database via
// `GET /api/billing/public-plans`. The admin picks an audience
// (`planType`: organization or consumer); the marketing block fetches
// and renders matching plans live. To show both audiences on one page,
// drop two pricing blocks — one per audience — onto the page.
//
// Editor exposes only: heading/subheading + audience + monthly/yearly
// toggle controls + CTA / empty-state copy. Plan content itself is
// managed at /app/admin/subscriptions and is NOT editable here.

const PRICING_PLAN_TYPES = [
    { value: 'organization', label: 'Organisations' },
    { value: 'consumer',     label: 'Consumers' },
];

const PRICING_INTERVAL_OPTIONS = [
    { value: 'monthly', label: 'Monthly' },
    { value: 'yearly',  label: 'Yearly' },
];

export function PricingEditor({ data = {}, onChange }) {
    const setField = (key, value) => onChange(set(data, key, value));

    const planType        = data.planType === 'consumer' ? 'consumer' : 'organization';
    const enableToggle    = data.enableToggle !== false;
    const defaultInterval = data.defaultInterval === 'yearly' ? 'yearly' : 'monthly';

    // Live preview of which plans the visitor will see, given the
    // currently-selected planType. Refetched on Refresh — admins can
    // change plans in /app/admin/subscriptions and confirm here without
    // reopening the editor.
    const [preview, setPreview] = React.useState({ loading: true, error: null, plans: [] });
    const reloadPreview = React.useCallback(() => {
        setPreview(p => ({ ...p, loading: true, error: null }));
        fetch('/api/billing/public-plans', { credentials: 'include' })
            .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
            .then(payload => {
                const plans = Array.isArray(payload?.plans) ? payload.plans : [];
                setPreview({ loading: false, error: null, plans });
            })
            .catch(err => setPreview({ loading: false, error: err.message || 'Failed', plans: [] }));
    }, []);
    React.useEffect(() => { reloadPreview(); }, [reloadPreview]);
    const matchingPlans = preview.plans.filter(p => p?.planType === planType);

    return (
        <>
            <InlineHint>
                Pricing cards are pulled live from your published subscription
                plans. Manage plans at <a href="/app/admin/subscriptions" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline' }}>/app/admin/subscriptions</a>.
                For both audiences on one page, add a second pricing block
                with the other audience.
            </InlineHint>

            <CollapsibleCard title="Heading" defaultOpen={true}>
                <TextField
                    label="Heading"
                    value={data.heading || ''}
                    onChange={v => setField('heading', v)}
                    placeholder="Pricing"
                />
                <TextField
                    label="Subheading"
                    value={data.subheading || ''}
                    onChange={v => setField('subheading', v)}
                    placeholder="Short line that sits under the heading."
                />
            </CollapsibleCard>

            <CollapsibleCard title="Audience" defaultOpen={true}>
                <FieldSelect
                    label="Show plans for"
                    value={planType}
                    options={PRICING_PLAN_TYPES}
                    onChange={v => setField('planType', v)}
                />

                {/* Live preview list — tells the admin exactly which plans
                    will show up for this audience right now. */}
                <div className="mt-3 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-3">
                    <div className="flex items-center justify-between mb-2">
                        <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                            Plans the visitor will see
                        </div>
                        <button
                            type="button"
                            onClick={reloadPreview}
                            className="text-xs underline text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        >
                            Refresh
                        </button>
                    </div>
                    {preview.loading ? (
                        <div className="text-xs text-[var(--text-muted)]">Loading…</div>
                    ) : preview.error ? (
                        <div className="text-xs text-red-500">Failed: {preview.error}</div>
                    ) : matchingPlans.length === 0 ? (
                        <div className="text-xs text-[var(--text-muted)]">
                            No public plans for this audience. Create one at /app/admin/subscriptions.
                        </div>
                    ) : (
                        <ul className="text-xs text-[var(--text-secondary)] space-y-1 list-disc pl-4">
                            {matchingPlans.map(p => (
                                <li key={p.id}>
                                    <strong>{p.name}</strong>
                                    {p.price != null ? ` — ${p.currency || 'EUR'} ${p.price} / ${p.billingInterval || '—'}` : ' — Custom pricing'}
                                    {p.trialDays > 0 ? ` · ${p.trialDays}d trial` : ''}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </CollapsibleCard>

            <CollapsibleCard title="Billing interval toggle" defaultOpen={true}>
                <Toggle
                    label="Show monthly/yearly toggle to visitors"
                    value={enableToggle}
                    onChange={v => setField('enableToggle', v)}
                />
                {enableToggle ? (
                    <>
                        <FieldSelect
                            label="Default side"
                            value={defaultInterval}
                            options={PRICING_INTERVAL_OPTIONS}
                            onChange={v => setField('defaultInterval', v)}
                        />
                        <TextField
                            label="Monthly label"
                            value={data.toggleLabelMonthly || ''}
                            onChange={v => setField('toggleLabelMonthly', v)}
                            placeholder="Maandelijks"
                        />
                        <TextField
                            label="Yearly label"
                            value={data.toggleLabelYearly || ''}
                            onChange={v => setField('toggleLabelYearly', v)}
                            placeholder="Jaarlijks"
                        />
                    </>
                ) : (
                    <FieldSelect
                        label="Show only this interval"
                        value={defaultInterval}
                        options={PRICING_INTERVAL_OPTIONS}
                        onChange={v => setField('defaultInterval', v)}
                    />
                )}
            </CollapsibleCard>

            <CollapsibleCard title="Call to action" defaultOpen={false}>
                <TextField
                    label="Button label"
                    value={data.ctaLabel || ''}
                    onChange={v => setField('ctaLabel', v)}
                    placeholder="Kies plan"
                    hint="Buttons link to /app/billing?plan=<id>. The plan id is added automatically per card."
                />
                <TextField
                    label="Empty-state text"
                    value={data.emptyText || ''}
                    onChange={v => setField('emptyText', v)}
                    placeholder="Geen plannen beschikbaar"
                    hint="Shown when no public plans match the selected audience and interval."
                />
            </CollapsibleCard>
        </>
    );
}

// ── Catalogue + registries ────────────────────────────────────────────
//
// BLOCK_CATALOGUE   used by BlockList (add picker) and BlockRow (labels/icons)
// BLOCK_EDITORS     used by ProductWebsitePanel to render the active editor
// BLOCK_DEFAULTS    used by the panel when creating a new block

export function CustomerSupportEditor({ data = {}, onChange }) {
    const setField = (key, value) => onChange(set(data, key, value));
    return (
        <>
            <InlineHint>Click the title and intro in the preview to edit them inline.</InlineHint>

            <FieldSelect
                label="Background"
                value={data.backgroundVariant || 'surface'}
                options={[
                    { value: 'default', label: 'Default (page bg)' },
                    { value: 'surface', label: 'Surface (alt bg)' },
                    { value: 'primary', label: 'Primary (brand color)' },
                    { value: 'dark',    label: 'Dark (secondary color)' },
                ]}
                onChange={v => setField('backgroundVariant', v)}
            />

            <CollapsibleCard title="Text" defaultOpen={true}>
                <TextField label="Title" value={data.title || ''} onChange={v => setField('title', v)} placeholder="Talk to us" />
                <TextField label="Intro" value={data.lead || ''} onChange={v => setField('lead', v)} placeholder="Short intro under the title" />
            </CollapsibleCard>

            <CollapsibleCard title="Form fields" defaultOpen={false}>
                <TextField label="Name label"          value={data.nameLabel || ''}          onChange={v => setField('nameLabel', v)}          placeholder="Your name" />
                <TextField label="Name placeholder"    value={data.namePlaceholder || ''}    onChange={v => setField('namePlaceholder', v)}    placeholder="Jane Doe" />
                <TextField label="Email label"         value={data.emailLabel || ''}         onChange={v => setField('emailLabel', v)}         placeholder="Email" />
                <TextField label="Email placeholder"   value={data.emailPlaceholder || ''}   onChange={v => setField('emailPlaceholder', v)}   placeholder="you@company.com" />
                <TextField label="Subject label"       value={data.subjectLabel || ''}       onChange={v => setField('subjectLabel', v)}       placeholder="Subject" />
                <TextField label="Subject placeholder" value={data.subjectPlaceholder || ''} onChange={v => setField('subjectPlaceholder', v)} placeholder="How can we help?" />
                <TextField label="Message label"       value={data.messageLabel || ''}       onChange={v => setField('messageLabel', v)}       placeholder="Message" />
                <TextField label="Message placeholder" value={data.messagePlaceholder || ''} onChange={v => setField('messagePlaceholder', v)} placeholder="Tell us about your team…" />
                <TextField label="Submit button"       value={data.submitLabel || ''}        onChange={v => setField('submitLabel', v)}        placeholder="Send to Bee Flow" />
            </CollapsibleCard>

            <CollapsibleCard title="Confirmation message" defaultOpen={false}>
                <TextField
                    label="Success title"
                    value={data.successTitle || ''}
                    onChange={v => setField('successTitle', v)}
                    placeholder="Thanks — we've got your message"
                />
                <TextField
                    label="Success body"
                    value={data.successBody || ''}
                    onChange={v => setField('successBody', v)}
                    placeholder="What the visitor sees after submitting"
                    hint="Shown while the AI prepares its first reply."
                />
            </CollapsibleCard>
        </>
    );
}

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
    'live-component': { type: 'live-component', label: 'Live Component', icon: 'Code',         category: 'Content' },
    pricing:      { type: 'pricing',      label: 'Pricing',        icon: 'CreditCard',       category: 'Conversion' },
    'customer-support': { type: 'customer-support', label: 'Customer Support', icon: 'LifeBuoy', category: 'Conversion' },
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
    'live-component': { component: LiveComponentEditor, label: 'Live Component', icon: 'Code'        },
    pricing:      { component: PricingEditor,      label: 'Pricing',        icon: 'CreditCard'        },
    'customer-support': { component: CustomerSupportEditor, label: 'Customer Support', icon: 'LifeBuoy' },
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
    // Live Component — user pastes raw HTML/CSS/JS into one of four
    // layout modes. The renderer reads `layout` to pick the column
    // structure and falls back to 'full' for blocks that pre-date the
    // multi-layout upgrade. CTA mirrors the Hero pattern: nested
    // { enabled, label, link, style } blob so the LinkField gives users
    // anchor / external-URL / internal-page destinations consistently.
    'live-component': {
        layout:    'full',
        code:      '',
        codeRight: '',
        heading:   '',
        body:      '',
        cta: {
            enabled: true,
            label:   'Get started',
            link:    { kind: 'external', url: '', newTab: false },
            style:   'primary',
        },
    },
    // Pricing — dynamic. Plans come from /api/billing/public-plans;
    // the admin chooses an audience (planType) and the toggle defaults
    // here. Kept in sync with server/i18n/defaults/cmsDefaults.js.
    pricing: {
        heading: 'Pricing',
        subheading: '',
        planType: 'organization',
        enableToggle: true,
        defaultInterval: 'monthly',
        toggleLabelMonthly: 'Maandelijks',
        toggleLabelYearly: 'Jaarlijks',
        ctaLabel: 'Kies plan',
        emptyText: 'Geen plannen beschikbaar',
    },
    // Customer Support — public AI-first support form. Submits to
    // POST /api/support/threads (source: 'marketing'); the AI replies inline
    // and a human takes over on escalation. Kept in sync with cmsDefaults.js.
    'customer-support': {
        title: 'Talk to us',
        lead: 'Question about pricing, custom deployments, or anything else? Send us a note — our AI assistant replies within seconds, and a human picks it up if needed.',
        nameLabel: 'Your name',
        namePlaceholder: 'Jane Doe',
        emailLabel: 'Email',
        emailPlaceholder: 'you@company.com',
        subjectLabel: 'Subject',
        subjectPlaceholder: 'How can we help?',
        messageLabel: 'Message',
        messagePlaceholder: "Tell us about your team, what you're trying to do, and any constraints.",
        submitLabel: 'Send to Bee Flow',
        successTitle: "Thanks — we've got your message",
        successBody: "Our AI assistant is looking through our knowledge base right now and you'll receive an email reply within a few minutes. If it can't fully resolve your question, a Bee Flow teammate will take over.",
        backgroundVariant: 'surface',
    },
};

// Legacy aliases — kept so AdminDashboard and any other import that uses
// the old names doesn't break before it's updated.
export const SECTION_EDITORS = BLOCK_EDITORS;
export const SECTION_ORDER   = Object.keys(BLOCK_CATALOGUE);
