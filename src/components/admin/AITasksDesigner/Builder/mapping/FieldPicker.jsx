import { ChevronDown, FunctionSquare, Search } from 'lucide-react';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { onBindingDragOver, getBindingDropPath } from './bindingDnd';
import { humanizeFieldKey } from '../flow/displayHelpers';
import { previewValue } from '../../../../../utils/bindingHelpers';
import { denseInputClass } from '../flow/settings/formStyles';
import AnchoredMenu from '../../../../shared/AnchoredMenu';

/**
 * Pick a data field by its NAME.
 *
 * The Condition node's condition rows used to be raw path inputs: a non-technical
 * author had to know that "the subject of each mail" is spelled
 * `item.subject`. This control lists the fields that actually exist in the
 * sample data — "Subject", "From", "Date" — with an example value next to
 * each, and stores the path invisibly.
 *
 * Free typing stays possible (there is no sample before the first test run):
 * an unmatched name resolves against `fallbackBase`, so typing "subject"
 * yields `item.subject`. `onUseExpression` adds the escape hatch for authors
 * who do want to write an expression.
 *
 * Props:
 *   value          — binding ({kind:'ref', path}) or null
 *   onChange(b)    — emits a {kind:'ref'} binding
 *   options        — [{ path, label?, sample?, group? }] (see upstream.js helpers)
 *   fallbackBase   — root a free-typed name is appended to ('item' in list mode)
 *   onUseExpression — when set, renders the "use an expression" row
 */
export default function FieldPicker({
    value = null,
    onChange,
    options = [],
    placeholder = 'Choose a field',
    fallbackBase = 'item',
    onFocusField = null,
    onUseExpression = null,
    emptyHint = 'No sample data yet — type a field name.',
}) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const searchRef = useRef(null);
    const anchorRef = useRef(null);
    const close = useCallback(() => setOpen(false), []);

    const path = value?.kind === 'ref' ? String(value.path || '') : '';
    const current = useMemo(() => options.find(o => o.path === path) || null, [options, path]);
    const currentLabel = current?.label || (path ? humanizeFieldKey(lastSegment(path)) : '');
    const currentSample = current?.sample;

    const emit = (nextPath) => {
        onChange?.({ kind: 'ref', path: nextPath });
        setOpen(false);
        setQuery('');
    };

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return options;
        return options.filter(o =>
            (o.label || '').toLowerCase().includes(q) || (o.path || '').toLowerCase().includes(q));
    }, [options, query]);

    // Group headings keep "fields of each item" apart from "‹gmail search›".
    const sections = useMemo(() => {
        const map = new Map();
        for (const o of filtered) {
            const key = o.group || '';
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(o);
        }
        return [...map.entries()].map(([group, items]) => ({ group, items }));
    }, [filtered]);

    const typed = query.trim();
    const canUseTyped = typed && !filtered.some(o => (o.label || '').toLowerCase() === typed.toLowerCase());

    const onDrop = (e) => {
        const dropped = getBindingDropPath(e);
        if (dropped) emit(dropped);
    };

    const openList = () => {
        setOpen(true);
        // The NDV's Input panel maps click-to-insert through this handle.
        onFocusField?.({ id: 'field', label: 'field', insert: (p) => emit(p) });
        setTimeout(() => searchRef.current?.focus(), 0);
    };

    return (
        <div className="relative" ref={anchorRef}>
            <button
                type="button"
                onClick={() => (open ? setOpen(false) : openList())}
                onDragOver={onBindingDragOver}
                onDrop={onDrop}
                aria-haspopup="listbox"
                aria-expanded={open}
                className={denseInputClass('w-full flex items-center gap-1.5 text-left hover:bg-[var(--bg-tertiary)]')}
            >
                <span className={`truncate ${currentLabel ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'}`}>
                    {currentLabel || placeholder}
                </span>
                {currentSample !== undefined && currentSample !== null && (
                    <span className="ml-auto shrink-0 max-w-[45%] truncate text-[10px] text-[var(--text-tertiary)]">
                        {previewValue(currentSample, 24)}
                    </span>
                )}
                <ChevronDown size={12} className="shrink-0 text-[var(--text-tertiary)]" />
            </button>

            {/* Portalled: the node-config modal is a clip chain, so an
                `absolute` panel was cut off at the bottom of the form and its
                click-away backdrop stole every press on the modal's scrollbar
                (BFSF-328). AnchoredMenu measures, flips and stays reachable. */}
            <AnchoredMenu open={open} onClose={close} anchorRef={anchorRef} align="stretch" maxHeight={320}>
                <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-[var(--border-default)] sticky top-0 bg-[var(--bg-primary)] z-10">
                    <Search size={12} className="text-[var(--text-tertiary)] shrink-0" />
                    <input
                        ref={searchRef}
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                if (filtered.length) emit(filtered[0].path);
                                else if (canUseTyped) emit(`${fallbackBase}.${typed}`);
                            }
                        }}
                        placeholder="Search fields…"
                        className="flex-1 min-w-0 bg-transparent text-xs text-[var(--text-primary)] focus:outline-none"
                    />
                </div>
                <div>
                    {options.length === 0 && !typed && (
                        <div className="px-2 py-2 text-[11px] text-[var(--text-tertiary)] italic">{emptyHint}</div>
                    )}
                    {sections.map(({ group, items }) => (
                        <div key={group || '__none'}>
                            {group && (
                                <div className="px-2 py-1 text-[10px] uppercase tracking-wide font-semibold text-[var(--text-tertiary)] bg-[var(--bg-secondary)]/60">
                                    {group}
                                </div>
                            )}
                            {items.map(o => (
                                <button
                                    key={o.path}
                                    type="button"
                                    // mouseDown (not click) so the preventDefault
                                    // keeps the search box from blurring the list
                                    // shut before the pick lands — which also
                                    // meant Enter on a focused option did
                                    // nothing, so the list needs its own key
                                    // handler rather than relying on the
                                    // synthetic click.
                                    onMouseDown={(e) => { e.preventDefault(); emit(o.path); }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            emit(o.path);
                                        }
                                    }}
                                    className={`w-full flex items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-[var(--bg-secondary)] ${o.path === path ? 'bg-[var(--bg-secondary)]' : ''}`}
                                >
                                    <span className="truncate text-[var(--text-primary)]">{o.label || humanizeFieldKey(lastSegment(o.path))}</span>
                                    {o.sample !== undefined && o.sample !== null && (
                                        <span className="ml-auto shrink-0 max-w-[45%] truncate text-[10px] text-[var(--text-tertiary)]">
                                            {previewValue(o.sample, 24)}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    ))}
                    {canUseTyped && (
                        <button
                            type="button"
                            onMouseDown={(e) => { e.preventDefault(); emit(`${fallbackBase}.${typed}`); }}
                            className="w-full flex items-center gap-2 px-2 py-1.5 text-left text-xs border-t border-[var(--border-default)] hover:bg-[var(--bg-secondary)]"
                        >
                            <span className="text-[var(--text-secondary)]">Use “{typed}”</span>
                        </button>
                    )}
                </div>
                {onUseExpression && (
                    <button
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); setOpen(false); onUseExpression(); }}
                        className="w-full flex items-center gap-1.5 px-2 py-1.5 text-left text-[11px] border-t border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] sticky bottom-0 bg-[var(--bg-primary)]"
                    >
                        <FunctionSquare size={12} /> Use an expression instead
                    </button>
                )}
            </AnchoredMenu>
        </div>
    );
}

/** `steps.g1.output.results[*].subject` → `subject`. */
function lastSegment(path) {
    const cleaned = String(path || '').replace(/\[(?:\*|\d+)\]/g, '');
    return cleaned.split('.').filter(Boolean).pop() || '';
}
