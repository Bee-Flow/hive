import React, { useState } from 'react';
import {
    migrateLegacyContent,
    makeColumn,
    makeElement,
} from '../../../../marketing/sections/contentMigration';
import { TextField, Toggle, ImageField, RepeatableList, LinkField, FieldRow, inputCls } from '../fields';
import {
    InlineHint,
    CollapsibleCard,
    StyleTriplet,
    FieldSelect,
    CtaStyleSelect,
    BackgroundVariantSelect,
    SegmentedControl,
} from '../primitives';

// ── Content (generic flexible block) ─────────────────────────────────

// Layout, element, and migration helpers live in the marketing-side
// module so the editor and the renderer share one source of truth on
// shape conversion + defaults.

export const COLUMN_LAYOUTS = [
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

// Content keeps its own background vocabulary (none/light/dark/primary),
// distinct from the shared default/surface/primary/dark variant scale.
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
            <CollapsibleCard title="Layout" defaultOpen={true} persistKey="blk.content.layout">
                <FieldRow label="Column layout">
                    <SegmentedControl
                        options={COLUMN_LAYOUTS}
                        value={c.columnLayout}
                        onChange={handleLayoutChange}
                    />
                </FieldRow>
                <FieldSelect
                    label="Vertical align"
                    value={c.verticalAlign || 'top'}
                    options={VALIGNS}
                    onChange={v => setField('verticalAlign', v)}
                />
                <BackgroundVariantSelect
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

export function ColumnPanel({ col, colIdx, pages, onChange }) {
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

export function ElementFields({ el, pages, update }) {
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
                            value={el.headingStyle}
                            onChange={v => update({ ...el, headingStyle: v })}
                            sample={el.heading || 'Heading preview'}
                            weight={700}
                            min={12} max={96}
                        />
                        <StyleTriplet
                            label="Subheading"
                            value={el.subheadingStyle}
                            onChange={v => update({ ...el, subheadingStyle: v })}
                            sample={el.subheading || 'Subheading preview'}
                            weight={500}
                            min={10} max={48}
                        />
                        <StyleTriplet
                            label="Body"
                            value={el.bodyStyle}
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
                    {/* Premium frame — routes through FramedMedia. Framed
                        images use the frame's own box (aspect-ratio crop is
                        skipped) and win over the lightbox toggle. */}
                    <FieldSelect
                        label="Frame"
                        value={el.frame || ''}
                        options={[
                            { value: '',         label: 'None' },
                            { value: 'hairline', label: 'Hairline frame' },
                            { value: 'browser',  label: 'Browser window' },
                        ]}
                        onChange={v => update({ ...el, frame: v })}
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
                    <CtaStyleSelect
                        value={el.style || 'primary'}
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
