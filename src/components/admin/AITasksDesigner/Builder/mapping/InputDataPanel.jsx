import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, GripVertical, Search, Table2, ArrowLeft, X } from 'lucide-react';
import { walkPath } from '../../../../../utils/bindingHelpers';
import { summariseData } from '../flow/dataSummary';
import OutputView from '../OutputView';
import { FieldRow, startPathDrag } from './VariableTree';
import { filterGroups } from './filterFields';

/**
 * The NDV's INPUT column — the upstream data you map FROM.
 *
 * It used to render each upstream step's output as OutputView's table without
 * `fill`, which meant a 288px-tall box with its OWN scroller nested inside the
 * panel's scroller, and `min-w-max` headers that guaranteed a horizontal
 * scrollbar in a 320px column. Two scrollbars per section, in a column too
 * narrow for the table it held (BFSF-329).
 *
 * So the default is now the FIELD TREE: every row truncates, so the panel never
 * scrolls sideways, and each row is drag- and click-to-map exactly like before.
 * The table is one click away per section, because it is the only view where
 * you can map a whole COLUMN (`results[*].subject`) or one specific cell; when
 * it opens it takes over the panel and gets `fill`, so there is one scroller.
 *
 * Props:
 *   groups        — useUpstreamVariables output, TOPOLOGICAL (trigger first,
 *                   nearest step last). Displayed reversed — nearest first is
 *                   what you almost always want — on a COPY, because the array
 *                   order is a contract for chooseNearest/nearestArrayRef.
 *   previewSample — merged real/sample root, for the value column
 *   onPick(path)  — insert this path into the focused parameter
 */
export default function InputDataPanel({ groups = [], previewSample = null, onPick }) {
    const [query, setQuery] = useState('');
    const [tableFor, setTableFor] = useState(null); // group id whose table took over

    // Nearest-first for display only.
    const ordered = useMemo(() => [...groups].reverse(), [groups]);
    const shown = useMemo(() => filterGroups(ordered, query), [ordered, query]);

    const tableGroup = tableFor ? groups.find(g => g.id === tableFor) : null;

    if (!groups.length) {
        return (
            <div className="flex-1 px-4 py-6 text-xs text-[var(--text-tertiary)] italic">
                No upstream data yet. Connect this step to a previous one to see its output here.
            </div>
        );
    }

    if (tableGroup) {
        const value = walkPath(tableGroup.basePath, previewSample);
        return (
            <div className="flex-1 min-h-0 flex flex-col">
                <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-[var(--border-default)] shrink-0">
                    <button
                        type="button"
                        onClick={() => setTableFor(null)}
                        className="inline-flex items-center gap-1 text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    >
                        <ArrowLeft size={12} /> Fields
                    </button>
                    <span className="ml-auto text-[11px] text-[var(--text-primary)] font-medium truncate">{tableGroup.label}</span>
                </div>
                <div className="flex-1 min-h-0 flex flex-col p-2">
                    <OutputView
                        value={value === undefined ? tableGroup.sample : value}
                        basePath={tableGroup.basePath}
                        fill
                        enableDrag
                        onPickPath={onPick}
                        emptyMessage="No data yet — run the upstream step to capture it."
                    />
                </div>
                <PanelHint />
            </div>
        );
    }

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-[var(--border-default)] shrink-0">
                <Search size={12} className="text-[var(--text-tertiary)] shrink-0" />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search fields…"
                    aria-label="Search input fields"
                    className="flex-1 min-w-0 bg-transparent text-xs text-[var(--text-primary)] focus:outline-none"
                />
                {query && (
                    <button
                        type="button"
                        onClick={() => setQuery('')}
                        aria-label="Clear search"
                        className="shrink-0 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                    >
                        <X size={12} />
                    </button>
                )}
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                {shown.length === 0 ? (
                    <div className="px-3 py-4 text-[11px] text-[var(--text-tertiary)] italic">No matches.</div>
                ) : shown.map((g, i) => (
                    <InputNodeSection
                        key={g.id}
                        group={g}
                        previewSample={previewSample}
                        onPick={onPick}
                        // Only the nearest step starts open; the rest are one
                        // click away. A search opens everything that matched.
                        defaultOpen={!!query || i === 0}
                        onOpenTable={() => setTableFor(g.id)}
                    />
                ))}
                <PanelHint />
            </div>
        </div>
    );
}

function PanelHint() {
    return (
        <div className="px-3 py-2 text-[10px] text-[var(--text-tertiary)] shrink-0">
            Drag a value into a field (or the prompt), or click to insert.
            Open <span className="font-medium">Table</span> to map a whole column or one cell.
        </div>
    );
}

function InputNodeSection({ group, previewSample, onPick, defaultOpen, onOpenTable }) {
    const [open, setOpen] = useState(defaultOpen);
    // `defaultOpen` flips when a search starts/ends; a key on the query would
    // remount and lose per-field expansion, so track it explicitly instead.
    const [lastDefault, setLastDefault] = useState(defaultOpen);
    if (lastDefault !== defaultOpen) { setLastDefault(defaultOpen); setOpen(defaultOpen); }

    const value = walkPath(group.basePath, previewSample);
    const data = value === undefined ? group.sample : value;
    // "201 records" beats the word "output": it says what is in there before
    // you expand it.
    const summary = summariseData(data);
    const fields = group.fields || [];

    return (
        <div className="border-b border-[var(--border-default)] last:border-b-0 group/sec">
            <div className="flex items-center">
                <div
                    draggable
                    onDragStart={(e) => startPathDrag(e, group.basePath)}
                    onClick={() => setOpen(o => !o)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(o => !o); } }}
                    title={`Drag to use the whole output (${group.basePath})`}
                    className="flex-1 min-w-0 flex items-center gap-1.5 px-2 py-1.5 text-xs hover:bg-[var(--bg-secondary)] cursor-grab active:cursor-grabbing select-none"
                >
                    <GripVertical size={11} className="shrink-0 text-[var(--text-tertiary)] opacity-0 group-hover/sec:opacity-60" />
                    {open ? <ChevronDown size={12} className="shrink-0 text-[var(--text-tertiary)]" /> : <ChevronRight size={12} className="shrink-0 text-[var(--text-tertiary)]" />}
                    <span className="text-[var(--text-primary)] font-medium truncate">{group.label}</span>
                    <span className="ml-auto text-[10px] text-[var(--text-tertiary)] whitespace-nowrap">{summary?.label || 'output'}</span>
                </div>
                <button
                    type="button"
                    onClick={onOpenTable}
                    title={`Open ${group.label} as a table — map a whole column or a single cell`}
                    aria-label={`Open ${group.label} as a table`}
                    className="shrink-0 mr-1 inline-flex items-center gap-1 px-1.5 py-1 rounded text-[10px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition"
                >
                    <Table2 size={11} /> Table
                </button>
            </div>
            {open && (
                <div className="pb-1">
                    {fields.map(f => (
                        <FieldRow key={f.path} field={f} onInsert={onPick} depth={1} previewSample={previewSample} />
                    ))}
                    {fields.length === 0 && (
                        <div className="px-6 py-1 text-[11px] text-[var(--text-tertiary)] italic">
                            No named fields — open <span className="font-medium">Table</span> to map from the raw output.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
