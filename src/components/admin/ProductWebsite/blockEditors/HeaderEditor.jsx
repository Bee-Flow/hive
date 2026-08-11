import React from 'react';
import { TextField, Toggle, ImageField, RepeatableList, LinkField, FieldRow } from '../fields';
import {
    InlineHint,
    CollapsibleCard,
    ColorSwatch,
    PxSizeInput,
    FontRow,
    CtaStyleSelect,
    SegmentedControl,
    mintId,
} from '../primitives';
import { set } from './shared';

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
            <CollapsibleCard title="Logo & brand" defaultOpen={true} persistKey="blk.header.logo-brand">
                <ImageField
                    label="Logo image (optional)"
                    value={logo.src || ''}
                    onChange={v => updateLogo({ src: v || '' })}
                />
                <TextField
                    label="Logo link URL"
                    value={logo.url !== undefined ? logo.url : '/'}
                    onChange={v => updateLogo({ url: v })}
                    placeholder="/"
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
                    color as a small swatch (replaces the wide bar).
                    Stored shape is flat (titleSize / textColor on logo),
                    not a *Style blob — intentionally not a StyleTriplet. */}
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
                <Toggle
                    label={'Show "." after brand name'}
                    value={logo.showDot === true}
                    onChange={v => updateLogo({ showDot: v })}
                />
            </CollapsibleCard>

            {/* ── Header action buttons (multi-CTA) ─────────────────── */}
            <CollapsibleCard title="Header buttons" persistKey="blk.header.buttons">
                <RepeatableList
                    items={ctas}
                    onChange={v => onChange(set(data, 'ctas', v))}
                    makeNew={() => ({
                        id: mintId('cta'),
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
                            <CtaStyleSelect
                                value={item.style || 'primary'}
                                onChange={v => update({ ...item, style: v })}
                            />
                            {/* Per-button label typography — empty values
                                = inherit page CSS / Design tab. Flat shape
                                (labelFont/labelSize/labelColor), so this
                                stays hand-rolled instead of StyleTriplet. */}
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
            <CollapsibleCard title="Navigation" persistKey="blk.header.navigation">
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
                makeNew={() => ({ id: mintId('nav'), label: 'New link', link: { kind: 'external', url: '#' } })}
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
    id: mintId('col'),
    heading: '',
    items: [],
});
const newMegaItem = () => ({
    id: mintId('mi'),
    label: 'New item',
    link: { kind: 'external', url: '#' },
    description: '',
    icon: '',
    openInNewTab: false,
});

const DROPDOWN_LAYOUT_OPTIONS = [
    { value: 'list',    label: 'List' },
    { value: 'columns', label: 'Columns' },
];

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
                        id: c.id || mintId('mi'),
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

    return (
        <CollapsibleCard
            title={`Dropdown  (${itemCount} ${itemCount === 1 ? 'item' : 'items'})`}
            defaultOpen={false}
        >
            <FieldRow label="Layout">
                <SegmentedControl
                    options={DROPDOWN_LAYOUT_OPTIONS}
                    value={layout}
                    onChange={setLayout}
                />
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
                        id: mintId('nav'),
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
