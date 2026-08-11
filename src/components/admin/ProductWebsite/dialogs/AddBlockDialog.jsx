import React, { useEffect, useMemo, useRef, useState } from 'react';
import ModalShell from './ModalShell';
import AppIcon from '../../../AppIcon';
import { BLOCK_CATALOGUE } from '../editors';
import { BLOCK_VARIANTS } from '../blockEditors/catalogue';
import SectionThumb from './SectionThumb';

/**
 * AddBlockDialog — the block picker, lifted out of BlockList onto the
 * shared ModalShell (WS3-P1) so the panel can open it from BOTH entry
 * points with one piece of state (`addBlockRequest` in
 * ProductWebsitePanel):
 *   - the BlockList "+" (insert after the active block), and
 *   - the canvas insert-between "+" zones (explicit index via
 *     cms-insert-at).
 *
 * WS3-P4: tiles render LIVE scaled previews of the real section
 * components (SectionThumb — curated demo content, the site's palette
 * via `design`, SVG-wireframe fallback). Types with layout variants
 * (BLOCK_VARIANTS) grow an expandable strip of per-variant sub-tiles
 * that add the block with that variant pre-selected.
 *
 * Search/category grouping and the arrow-key roving focus are unchanged
 * from the original picker; Enter adds the focused block with its
 * default variant. Escape/backdrop-close come from ModalShell.
 *
 * Props:
 *   onAdd(type, variant?) — user picked a block type (parent closes +
 *                           inserts; `variant` only from a variant tile)
 *   onCancel()            — dismissed without picking
 *   design                — optional site design blob for palette-true thumbs
 */
export default function AddBlockDialog({ onAdd, onCancel, design = null }) {
    const [query, setQuery] = useState('');
    const [focusIdx, setFocusIdx] = useState(0);
    // Block type whose variant strip is expanded (one at a time).
    const [expandedType, setExpandedType] = useState(null);
    const searchRef = useRef(null);

    useEffect(() => { searchRef.current?.focus(); }, []);

    // Flat, search-filtered list (order = catalogue order) — the keyboard
    // roving index walks this list; the grid below groups it by category.
    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        const all = Object.values(BLOCK_CATALOGUE);
        if (!q) return all;
        return all.filter(m =>
            m.label.toLowerCase().includes(q)
            || m.type.toLowerCase().includes(q)
            || (m.category || '').toLowerCase().includes(q));
    }, [query]);
    useEffect(() => { setFocusIdx(0); }, [query]);

    const categories = useMemo(() => {
        const out = new Map();
        filtered.forEach((meta) => {
            if (!out.has(meta.category)) out.set(meta.category, []);
            out.get(meta.category).push(meta);
        });
        return out;
    }, [filtered]);

    // Arrows move the focus ring; Enter adds the focused block. Handled at
    // the dialog level so it works while typing in search. Escape is
    // ModalShell's job (document-level listener).
    const COLS = 3;
    const onKeyDown = (e) => {
        if (!filtered.length) return;
        const move = (delta) => {
            e.preventDefault();
            setFocusIdx(i => Math.max(0, Math.min(filtered.length - 1, i + delta)));
        };
        if (e.key === 'ArrowRight') move(1);
        else if (e.key === 'ArrowLeft') move(-1);
        else if (e.key === 'ArrowDown') move(COLS);
        else if (e.key === 'ArrowUp') move(-COLS);
        else if (e.key === 'Enter') {
            e.preventDefault();
            const meta = filtered[Math.min(focusIdx, filtered.length - 1)];
            if (meta) onAdd(meta.type);
        }
    };

    return (
        <ModalShell onClose={onCancel} labelledBy="add-block-dialog-title" width="lg">
            {/* Fixed-height column: sticky header + internally scrolling grid
                (the old picker's min(560px, 86vh) card, adapted to the
                shell's own max-height). */}
            <div
                className="flex flex-col overflow-hidden"
                style={{ height: 'min(560px, 78vh)' }}
                onKeyDown={onKeyDown}
            >
                {/* Header + search */}
                <div className="px-4 py-3 border-b border-[var(--border-subtle)] shrink-0">
                    <div className="flex items-center justify-between mb-2">
                        <span id="add-block-dialog-title" className="text-sm font-semibold text-[var(--text-primary)]">
                            Add block
                        </span>
                        <button
                            type="button"
                            onClick={onCancel}
                            className="w-7 h-7 inline-flex items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
                            title="Close"
                            aria-label="Close add block dialog"
                        >
                            <AppIcon name="X" className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="relative">
                        <AppIcon name="Search" className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                        <input
                            ref={searchRef}
                            type="text"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            placeholder="Search blocks… (↑↓←→ to browse, Enter to add)"
                            className="w-full pl-8 pr-3 py-1.5 rounded-md text-sm border bg-[var(--bg-tertiary)] border-[var(--border-default)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                        />
                    </div>
                </div>
                {/* Body — categories + live-thumbnail grid */}
                <div className="flex-1 overflow-y-auto p-4">
                    {filtered.length === 0 ? (
                        <p className="text-xs text-[var(--text-muted)] text-center py-10">
                            No blocks match "{query}".
                        </p>
                    ) : [...categories.entries()].map(([cat, items]) => (
                        <div key={cat} className="mb-4 last:mb-0">
                            <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-2 px-1">{cat}</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 items-start">
                                {items.map(meta => {
                                    const idx = filtered.indexOf(meta);
                                    const focused = idx === focusIdx;
                                    const variants = BLOCK_VARIANTS[meta.type] || null;
                                    const expanded = expandedType === meta.type;
                                    return (
                                        <div
                                            key={meta.type}
                                            className={`flex flex-col rounded-md overflow-hidden border transition-colors
                                                ${focused
                                                    ? 'border-[var(--accent-primary)] bg-[var(--bg-tertiary)]'
                                                    : 'border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/40 hover:bg-[var(--bg-tertiary)]'}`}
                                        >
                                            <button
                                                type="button"
                                                onClick={() => onAdd(meta.type)}
                                                onMouseEnter={() => setFocusIdx(idx)}
                                                className="flex flex-col text-left w-full"
                                            >
                                                <SectionThumb type={meta.type} design={design} />
                                                <span className="flex items-center gap-1.5 px-2.5 py-2 text-xs text-[var(--text-secondary)]">
                                                    <AppIcon name={meta.icon} className="w-3.5 h-3.5 shrink-0 text-[var(--accent-primary)]" />
                                                    <span className="truncate font-medium">{meta.label}</span>
                                                </span>
                                            </button>
                                            {variants ? (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={() => setExpandedType(expanded ? null : meta.type)}
                                                        aria-expanded={expanded}
                                                        className="flex items-center gap-1 px-2.5 pb-1.5 text-[10px] text-[var(--text-muted)] hover:text-[var(--accent-primary)] text-left"
                                                    >
                                                        <AppIcon
                                                            name="ChevronRight"
                                                            className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`}
                                                        />
                                                        {variants.length} layouts
                                                    </button>
                                                    {expanded ? (
                                                        <div className="grid grid-cols-2 gap-1.5 px-2 pb-2">
                                                            {variants.map(v => (
                                                                <button
                                                                    key={v}
                                                                    type="button"
                                                                    onClick={() => onAdd(meta.type, v)}
                                                                    title={`Add ${meta.label} — ${v} layout`}
                                                                    className="flex flex-col rounded border border-[var(--border-subtle)] overflow-hidden text-left hover:border-[var(--accent-primary)] transition-colors"
                                                                >
                                                                    <SectionThumb type={meta.type} variant={v} design={design} />
                                                                    <span className="px-1.5 py-1 text-[10px] capitalize text-[var(--text-secondary)] truncate">
                                                                        {v}
                                                                    </span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    ) : null}
                                                </>
                                            ) : null}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </ModalShell>
    );
}
