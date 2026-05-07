import React, { useState } from 'react';
import { TextField, Toggle, IconField, ImageField, RepeatableList, LinkField, FieldRow, inputCls } from './fields';

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

// ── Header ────────────────────────────────────────────────────────────

export function HeaderEditor({ data = {}, pages = [], onChange }) {
    const nav = data.nav || [];
    const logo = data.logo || {};
    const ctas = Array.isArray(data.ctas) ? data.ctas : [];

    const updateLogo = (patch) => onChange(set(data, 'logo', { ...logo, ...patch }));

    return (
        <>
            <InlineHint>Click logo text, link labels, and button labels in the preview to edit them inline.</InlineHint>

            {/* ── Logo & brand ──────────────────────────────────────── */}
            <div className="rounded-md border border-[var(--border-subtle)] p-3 mb-3">
                <div className="text-xs font-semibold text-[var(--text-secondary)] mb-2">Logo & brand</div>
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
                <FieldRow label="Title color">
                    <input
                        type="color"
                        className={inputCls + ' h-9 p-1 cursor-pointer'}
                        value={logo.textColor || '#000000'}
                        onChange={e => updateLogo({ textColor: e.target.value })}
                    />
                </FieldRow>
                <FieldRow label="Title size">
                    <select
                        className={inputCls}
                        value={logo.fontSize || 'medium'}
                        onChange={e => updateLogo({ fontSize: e.target.value })}
                    >
                        <option value="small">Small (14px)</option>
                        <option value="medium">Medium (18px)</option>
                        <option value="large">Large (24px)</option>
                    </select>
                </FieldRow>
            </div>

            {/* ── Header action buttons (multi-CTA) ─────────────────── */}
            <RepeatableList
                label="Header buttons"
                items={ctas}
                onChange={v => onChange(set(data, 'ctas', v))}
                makeNew={() => ({
                    id: `cta_${Math.random().toString(36).slice(2, 8)}`,
                    label: 'Get started',
                    link: { kind: 'app', path: '/app' },
                    style: 'primary',
                })}
                itemLabel={(c) => c.label}
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
                    </>
                )}
                addLabel="Add button"
            />

            {/* ── Nav links (collapsible rows) ──────────────────────── */}
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
        </>
    );
}

// ── Hero ──────────────────────────────────────────────────────────────

export function HeroEditor({ data = {}, pages = [], onChange }) {
    const badge     = data.badge || {};
    const primary   = data.primaryCta || {};
    const secondary = data.secondaryCta || {};
    const mockup    = data.mockup || {};
    return (
        <>
            <InlineHint>Click eyebrow, title segments, lead, badge text, CTA labels, and chat bubbles to edit inline.</InlineHint>

            <RepeatableList
                label="Title segments"
                items={data.titleParts || []}
                onChange={v => onChange(set(data, 'titleParts', v))}
                makeNew={() => ({ text: '', gradient: false })}
                renderItem={(item, update) => (
                    <Toggle label="Gradient fill" value={!!item.gradient} onChange={v => update({ ...item, gradient: v })} />
                )}
                addLabel="Add segment"
            />

            <div className="rounded-md border border-[var(--border-subtle)] p-3 mb-3">
                <div className="text-xs font-semibold text-[var(--text-secondary)] mb-2">Badge</div>
                <IconField label="Icon" value={badge.icon} onChange={v => onChange(set(data, 'badge', { ...badge, icon: v }))} />
            </div>

            <div className="rounded-md border border-[var(--border-subtle)] p-3 mb-3">
                <div className="text-xs font-semibold text-[var(--text-secondary)] mb-2">Primary CTA</div>
                <LinkField
                    label="Destination"
                    value={primary.link}
                    pages={pages}
                    onChange={v => onChange(set(data, 'primaryCta', { ...primary, link: v }))}
                />
            </div>

            <div className="rounded-md border border-[var(--border-subtle)] p-3 mb-3">
                <div className="text-xs font-semibold text-[var(--text-secondary)] mb-2">Secondary CTA</div>
                <LinkField
                    label="Destination"
                    value={secondary.link}
                    pages={pages}
                    onChange={v => onChange(set(data, 'secondaryCta', { ...secondary, link: v }))}
                />
            </div>

            <RepeatableList
                label="Mockup chat bubbles"
                items={mockup.chatBubbles || []}
                onChange={v => onChange(set(data, 'mockup', { ...mockup, chatBubbles: v }))}
                makeNew={() => ({ role: 'user', text: '' })}
                renderItem={(item, update) => (
                    <FieldSelect
                        label="Speaker"
                        value={item.role}
                        options={[{ value: 'user', label: 'User' }, { value: 'ai', label: 'AI' }]}
                        onChange={v => update({ ...item, role: v })}
                    />
                )}
                addLabel="Add bubble"
            />
        </>
    );
}

// ── Social Proof ──────────────────────────────────────────────────────

export function SocialProofEditor({ data = {}, onChange }) {
    return (
        <>
            <InlineHint>Click the eyebrow text to edit. Logos with no image fall back to text.</InlineHint>
            <RepeatableList
                label="Logos"
                items={data.logos || []}
                onChange={v => onChange(set(data, 'logos', v))}
                makeNew={() => ({ src: '', alt: 'New logo' })}
                renderItem={(item, update) => (
                    <ImageField label="Logo image (optional)" value={item.src} onChange={v => update({ ...item, src: v })} />
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
            <div className="rounded-md border border-[var(--border-subtle)] p-3 mb-3">
                <div className="text-xs font-semibold text-[var(--text-secondary)] mb-2">Layout</div>
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
            </div>

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
                <div className="rounded-md border border-[var(--border-subtle)] p-3 mb-3">
                    <LinkField
                        label="Destination"
                        value={data.cta?.link}
                        pages={pages}
                        onChange={v => updateCta('link', v)}
                    />
                </div>
            ) : null}

            <div className="rounded-md border border-[var(--border-subtle)] p-3 mb-3">
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
            </div>

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
            <RepeatableList
                label="Feature cards"
                items={data.items || []}
                onChange={v => onChange(set(data, 'items', v))}
                makeNew={() => ({ icon: 'Sparkles', title: 'New feature', body: '', techTag: '' })}
                renderItem={(item, update) => (
                    <IconField label="Icon" value={item.icon} onChange={v => update({ ...item, icon: v })} />
                )}
                addLabel="Add card"
            />
        </>
    );
}

// ── Steps ─────────────────────────────────────────────────────────────

export function StepsEditor({ data = {}, onChange }) {
    return (
        <>
            <InlineHint>Click any step's number, title, body, or example in the preview to edit.</InlineHint>
            <RepeatableList
                label="Steps"
                items={data.items || []}
                onChange={v => onChange(set(data, 'items', v))}
                makeNew={() => ({ number: '', title: 'New step', body: '', example: '' })}
                renderItem={() => null}
                addLabel="Add step"
            />
        </>
    );
}

// ── Security ──────────────────────────────────────────────────────────

export function SecurityEditor({ data = {}, onChange }) {
    return (
        <>
            <InlineHint>Click any card's title, summary, or detail bullet to edit.</InlineHint>
            <RepeatableList
                label="Security cards"
                items={data.cards || []}
                onChange={v => onChange(set(data, 'cards', v))}
                makeNew={() => ({ icon: 'ShieldCheck', title: 'New card', summary: '', details: [] })}
                renderItem={(item, update) => (
                    <>
                        <IconField label="Icon" value={item.icon} onChange={v => update({ ...item, icon: v })} />
                        <RepeatableList
                            label="Detail bullets"
                            items={item.details || []}
                            onChange={v => update({ ...item, details: v })}
                            makeNew={() => 'New detail'}
                            renderItem={() => null}
                            addLabel="Add detail"
                        />
                    </>
                )}
                addLabel="Add card"
            />
        </>
    );
}

// ── Integrations ──────────────────────────────────────────────────────

export function IntegrationsEditor({ data = {}, onChange }) {
    return (
        <>
            <InlineHint>Category headings and tool names are editable in the preview.</InlineHint>
            <RepeatableList
                label="Categories"
                items={data.categories || []}
                onChange={v => onChange(set(data, 'categories', v))}
                makeNew={() => ({ heading: 'New category', items: [] })}
                renderItem={(cat, updateCat) => (
                    <RepeatableList
                        label="Tools"
                        items={cat.items || []}
                        onChange={v => updateCat({ ...cat, items: v })}
                        makeNew={() => ({ icon: 'Plug', label: 'Tool' })}
                        renderItem={(it, updIt) => (
                            <IconField label="Icon" value={it.icon} onChange={v => updIt({ ...it, icon: v })} />
                        )}
                        addLabel="Add tool"
                    />
                )}
                addLabel="Add category"
            />
        </>
    );
}

// ── Architecture ──────────────────────────────────────────────────────

export function ArchitectureEditor({ data = {}, onChange }) {
    return (
        <>
            <InlineHint>Click layer labels and tags in the preview to edit them.</InlineHint>
            <RepeatableList
                label="Layers"
                items={data.layers || []}
                onChange={v => onChange(set(data, 'layers', v))}
                makeNew={() => ({ label: 'New layer', tags: [] })}
                renderItem={(layer, updateLayer) => (
                    <RepeatableList
                        label="Tags"
                        items={layer.tags || []}
                        onChange={v => updateLayer({ ...layer, tags: v })}
                        makeNew={() => 'tag'}
                        renderItem={() => null}
                        addLabel="Add tag"
                    />
                )}
                addLabel="Add layer"
            />
        </>
    );
}

// ── Tech Stats ────────────────────────────────────────────────────────

export function TechStatsEditor({ data = {}, onChange }) {
    return (
        <>
            <InlineHint>Click any number or label in the preview to edit.</InlineHint>
            <RepeatableList
                label="Stats"
                items={data.stats || []}
                onChange={v => onChange(set(data, 'stats', v))}
                makeNew={() => ({ number: '0', label: 'New metric' })}
                renderItem={() => null}
                addLabel="Add stat"
            />
        </>
    );
}

// ── CTA ───────────────────────────────────────────────────────────────

export function CTAEditor({ data = {}, pages = [], onChange }) {
    const button = data.button || {};
    return (
        <>
            <InlineHint>Title, lead, and button label are editable in the preview.</InlineHint>
            <LinkField
                label="Button destination"
                value={button.link}
                pages={pages}
                onChange={v => onChange(set(data, 'button', { ...button, link: v }))}
            />
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

            <div className="rounded-md border border-[var(--border-subtle)] p-3 mb-3">
                <div className="text-xs font-semibold text-[var(--text-secondary)] mb-2">Primary CTA</div>
                <TextField
                    label="Button label"
                    value={primary.label || ''}
                    onChange={v => updatePrimary('label', v)}
                />
                <LinkField
                    label="Destination"
                    value={primary.link}
                    pages={pages}
                    onChange={v => updatePrimary('link', v)}
                />
            </div>

            <Toggle label="Show secondary CTA" value={showSecondary} onChange={toggleSecondary} />

            {showSecondary ? (
                <div className="rounded-md border border-[var(--border-subtle)] p-3 mb-3">
                    <div className="text-xs font-semibold text-[var(--text-secondary)] mb-2">Secondary CTA</div>
                    <TextField
                        label="Button label"
                        value={data.secondaryCta?.label || ''}
                        onChange={v => updateSecondary('label', v)}
                    />
                    <LinkField
                        label="Destination"
                        value={data.secondaryCta?.link}
                        pages={pages}
                        onChange={v => updateSecondary('link', v)}
                    />
                </div>
            ) : null}
        </>
    );
}

// ── Footer ────────────────────────────────────────────────────────────

export function FooterEditor({ data = {}, pages = [], onChange }) {
    const themeSwitcherEnabled = !!data.themeSwitcher?.enabled;
    return (
        <>
            <InlineHint>Brand text, blurb, column headings, link labels, and copyright are editable in the preview.</InlineHint>
            <Toggle
                label="Show theme switcher"
                value={themeSwitcherEnabled}
                onChange={v => onChange(set(data, 'themeSwitcher', { ...(data.themeSwitcher || {}), enabled: v }))}
            />
            <RepeatableList
                label="Columns"
                items={data.columns || []}
                onChange={v => onChange(set(data, 'columns', v))}
                makeNew={() => ({ id: `fcol_${Math.random().toString(36).slice(2,8)}`, heading: 'New column', links: [] })}
                itemLabel={(c) => c.heading}
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
                            itemLabel={(l) => l.label}
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
            <RepeatableList
                label="Social links"
                items={data.socials || []}
                onChange={v => onChange(set(data, 'socials', v))}
                makeNew={() => ({ id: `soc_${Math.random().toString(36).slice(2,8)}`, platform: 'github', link: { kind: 'external', url: '' } })}
                itemLabel={(s) => s.platform}
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
        badge: { text: '', icon: '' },
        titleParts: [{ text: 'Your headline here', gradient: false }],
        lead: 'Describe your product or service',
        primaryCta:   { label: 'Get started', link: { kind: 'anchor', anchor: '' } },
        secondaryCta: { label: 'Learn more',  link: { kind: 'anchor', anchor: '' } },
        mockup: { chatBubbles: [] },
    },
    socialProof: {
        eyebrow: 'Add your client logos',
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
