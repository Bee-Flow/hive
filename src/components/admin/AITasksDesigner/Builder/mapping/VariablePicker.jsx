import { ChevronDown, ChevronRight, Search, X } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { previewValue, walkPath } from '../../../../../utils/bindingHelpers';
import { filterFields } from './filterFields';
import { startPathDrag } from './bindingDnd';

/**
 * Portal-rendered popover that lists upstream variables, filterable by
 * name/path, with a hover preview of the resolved sample value at the
 * footer. Anchored to a DOM element supplied by the caller; flips above
 * the anchor when there isn't enough room below.
 *
 * Replaces the side-panel `activeFieldRef`/`onFocusField` indirection
 * for per-field insertion: the field owns the picker, so there's no
 * stale-handle window where the previously-focused input has unmounted.
 *
 * Props:
 *   open          — whether the popover is visible
 *   anchorEl      — DOM element to anchor against (typically the {} button)
 *   groups        — variable groups from useUpstreamVariables(...)
 *   onPick(path)  — called with the bare dotted path when the user selects a leaf
 *   onClose()     — called when the user dismisses (Escape, outside click, X button)
 *   previewSample — merged sample-root tree (same one BindingField uses for
 *                   inline previews); enables the footer "preview" line
 *   title         — optional aria/dialog label
 */
export default function VariablePicker({
    open,
    anchorEl,
    groups = [],
    onPick,
    onClose,
    previewSample = null,
    title = 'Insert variable',
    initialQuery = '',
}) {
    const [query, setQuery] = useState('');
    const [hoverField, setHoverField] = useState(null);
    const position = usePopoverPosition(anchorEl, open);

    // Reset query + hover whenever we re-open against a fresh anchor so the
    // user doesn't see stale filter state. Inline autocomplete seeds the
    // query via `initialQuery`; the plain {} button resets it to ''.
    // Intentional setState from useEffect — this is a UI sync (popover
    // lifecycle, not external state).
    useEffect(() => {
        if (open) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setQuery(initialQuery || '');

            setHoverField(null);
        }
    }, [open, anchorEl, initialQuery]);

    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose?.();
            }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    useEffect(() => {
        if (!open) return undefined;
        // Defer one tick so the click that opened us doesn't immediately close us.
        let attached = false;
        const handler = (e) => {
            if (e.target.closest('[data-variable-picker]')) return;
            if (anchorEl && anchorEl.contains(e.target)) return;
            onClose?.();
        };
        const t = setTimeout(() => {
            document.addEventListener('mousedown', handler);
            attached = true;
        }, 0);
        return () => {
            clearTimeout(t);
            if (attached) document.removeEventListener('mousedown', handler);
        };
    }, [open, onClose, anchorEl]);

    const filteredGroups = useMemo(() => {
        if (!query) return groups;
        const q = query.toLowerCase();
        return groups
            .map(g => ({ ...g, fields: filterFields(g.fields || [], q) }))
            .filter(g => (g.fields || []).length > 0 || g.label?.toLowerCase().includes(q));
    }, [groups, query]);

    if (!open) return null;

    const previewLine = hoverField ? resolveLeafPreview(hoverField, previewSample) : null;

    return createPortal(
        <div
            data-variable-picker
            // z-[1200] keeps the picker ABOVE the Node Detail View overlay
            // (z-[1000]) — it's portaled to <body>, so a lower z renders behind
            // the NDV and the {} button appears to "do nothing".
            className="fixed z-[1200] w-[320px] flex flex-col bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-md shadow-lg"
            style={{ left: position.left, top: position.top, maxHeight: position.maxHeight }}
            role="dialog"
            aria-label={title}
        >
            <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border-default)]">
                <Search size={12} className="text-[var(--text-tertiary)]" />
                <input
                    type="text"
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search variables…"
                    className="flex-1 bg-transparent text-xs text-[var(--text-primary)] focus:outline-none"
                />
                <button
                    type="button"
                    onClick={onClose}
                    className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                    aria-label="Close"
                >
                    <X size={12} />
                </button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar py-1">
                {filteredGroups.length === 0 ? (
                    <div className="px-3 py-4 text-[11px] text-[var(--text-tertiary)] italic">
                        {groups.length === 0
                            ? 'No upstream variables yet. Connect this step to a previous one to see its output here.'
                            : 'No matches.'}
                    </div>
                ) : filteredGroups.map(group => (
                    <PickerGroup
                        key={group.id}
                        group={group}
                        onPick={onPick}
                        onHoverField={setHoverField}
                    />
                ))}
            </div>
            <div className="px-3 py-2 border-t border-[var(--border-default)] text-[10px] text-[var(--text-tertiary)] min-h-[28px] flex items-center gap-1.5">
                {previewLine != null ? (
                    <>
                        <span className="uppercase tracking-wide">preview</span>
                        <span
                            className="font-mono text-[var(--text-secondary)] truncate"
                            title={previewLine}
                        >
                            {previewLine}
                        </span>
                    </>
                ) : (
                    <span>Hover a field to preview its sample value.</span>
                )}
            </div>
        </div>,
        document.body,
    );
}

function PickerGroup({ group, onPick, onHoverField }) {
    const [open, setOpen] = useState(true);
    return (
        <div className="border-b border-[var(--border-default)] last:border-b-0">
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-[var(--bg-secondary)]"
            >
                {open
                    ? <ChevronDown size={12} className="text-[var(--text-tertiary)]" />
                    : <ChevronRight size={12} className="text-[var(--text-tertiary)]" />}
                <span className="text-[var(--text-primary)] font-medium truncate">{group.label}</span>
                <span
                    className="ml-auto text-[10px] text-[var(--text-tertiary)] font-mono truncate max-w-[140px]"
                    title={group.basePath}
                >
                    {group.basePath}
                </span>
            </button>
            {open && (group.fields || []).length === 0 && (
                <div className="px-6 py-1 text-[11px] text-[var(--text-tertiary)] italic">No fields</div>
            )}
            {open && (group.fields || []).map(f => (
                <PickerLeaf
                    key={f.path}
                    field={f}
                    depth={1}
                    onPick={onPick}
                    onHoverField={onHoverField}
                />
            ))}
        </div>
    );
}

function PickerLeaf({ field, depth, onPick, onHoverField }) {
    const [expanded, setExpanded] = useState(false);
    const hasChildren = Array.isArray(field.children) && field.children.length > 0;
    const indent = 12 + depth * 14;

    const handleClick = (e) => {
        if (hasChildren && e.target.closest('[data-expand-btn]')) {
            setExpanded(o => !o);
            return;
        }
        onPick?.(field.path);
    };

    return (
        <>
            <div
                role="button"
                tabIndex={0}
                // Also a DRAG SOURCE. Every field editor in both builders already
                // accepts an `application/x-binding-path` drop, but the only
                // element that ever produced one was VariableTree's row — a panel
                // App Studio never renders, so its drop targets were unreachable
                // there. One attribute here makes them live in both.
                draggable
                onDragStart={(e) => startPathDrag(e, field.path)}
                onClick={handleClick}
                onMouseEnter={() => onHoverField(field)}
                onMouseLeave={() => onHoverField(null)}
                onFocus={() => onHoverField(field)}
                onBlur={() => onHoverField(null)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onPick?.(field.path);
                    }
                }}
                className="group flex items-center gap-2 py-1 text-[11px] cursor-pointer select-none hover:bg-[var(--bg-secondary)] focus:bg-[var(--bg-secondary)] focus:outline-none"
                style={{ paddingLeft: indent, paddingRight: 8 }}
                title={field.path}
            >
                {hasChildren ? (
                    <button
                        type="button"
                        data-expand-btn
                        onClick={(e) => { e.stopPropagation(); setExpanded(o => !o); }}
                        className="shrink-0 p-0.5 -m-0.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                        aria-label={expanded ? 'Collapse' : 'Expand'}
                    >
                        {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                    </button>
                ) : (
                    <span className="shrink-0 w-3" />
                )}
                <span className="text-[var(--text-primary)] truncate min-w-0">{field.key}</span>
                <span className="ml-auto text-[10px] text-[var(--text-tertiary)] truncate max-w-[120px] font-mono">
                    {previewValue(field.sample, 24)}
                </span>
            </div>
            {hasChildren && expanded && field.children.map(c => (
                <PickerLeaf
                    key={c.path}
                    field={c}
                    depth={depth + 1}
                    onPick={onPick}
                    onHoverField={onHoverField}
                />
            ))}
        </>
    );
}

function resolveLeafPreview(field, sampleRoot) {
    if (!field) return null;
    if (sampleRoot) {
        const v = walkPath(field.path, sampleRoot);
        if (v !== undefined) return previewValue(v, 60);
    }
    if (field.sample !== undefined) return previewValue(field.sample, 60);
    return null;
}

/**
 * Place the popover against its anchor. Same rules AnchoredMenu applies to the
 * field dropdowns (BFSF-328): prefer below, flip only when it truly does not
 * fit AND above is roomier, then cap the height to the room that is actually
 * there so the panel is always fully reachable. It is not AnchoredMenu itself
 * because this popover is a flex column with a sticky search header and a
 * preview footer — it owns its own inner scroller.
 */
function usePopoverPosition(anchorEl, open) {
    const [pos, setPos] = useState({ left: 0, top: 0, maxHeight: 420 });
    useEffect(() => {
        if (!open || !anchorEl) return undefined;
        const update = () => {
            const r = anchorEl.getBoundingClientRect();
            const width = 320;
            const margin = 8;
            const gap = 4;
            const below = window.innerHeight - r.bottom - margin - gap;
            const above = r.top - margin - gap;
            const flip = below < 240 && above > below;
            const maxHeight = Math.max(160, Math.min(420, Math.floor(flip ? above : below)));
            const top = flip
                ? Math.max(margin, Math.round(r.top - gap - maxHeight))
                : Math.round(r.bottom + gap);
            let left = r.left;
            if (left + width > window.innerWidth - margin) left = window.innerWidth - width - margin;
            if (left < margin) left = margin;
            setPos(p => (p.left === left && p.top === top && p.maxHeight === maxHeight ? p : { left, top, maxHeight }));
        };
        update();
        window.addEventListener('resize', update);
        window.addEventListener('scroll', update, true);
        return () => {
            window.removeEventListener('resize', update);
            window.removeEventListener('scroll', update, true);
        };
    }, [anchorEl, open]);
    return pos;
}
