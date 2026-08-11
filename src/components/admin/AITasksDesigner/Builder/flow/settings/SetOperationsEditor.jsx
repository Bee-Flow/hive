import { Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { cardClass, inputClass, FormRow } from './formPrimitives';
import { SET_OP_DEFS, SET_OP_TITLES, columnsAfterOps } from '../setOperations';
import { humanizeFieldKey } from '../displayHelpers';
import FieldKeyCombobox from '../../mapping/FieldKeyCombobox';
import AnchoredMenu from '../../../../../shared/AnchoredMenu';

/**
 * The "Table tools" editor for the Edit data (set) step — one card per
 * whole-table operation, applied top to bottom AFTER the per-row fields.
 *
 * Ordering is semantic (rename-before-keep, sort-before-number), so cards
 * reorder with ▲▼ chevrons instead of delete-and-re-add. Each card's column
 * pickers offer the columns that exist AT THAT POINT in the pipeline
 * (source columns + computed fields + everything earlier ops added/renamed) —
 * which makes the top-to-bottom execution order tangible.
 *
 * Props:
 *   ops           — draft.operations (already-sanitised shapes are fine;
 *                   half-configured rows are legal and survive autosave)
 *   onChange(next)— replace the whole array
 *   baseColumns   — column names BEFORE any operation (source element keys +
 *                   the Fields section's keys)
 *   columnSamples — {col: sampleValue} for the pickers' preview column
 */
export default function SetOperationsEditor({ ops = [], onChange, baseColumns = [], columnSamples = {}, onFocusField = null }) {
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef(null);
    const closeMenu = useCallback(() => setMenuOpen(false), []);

    const update = (i, patch) => onChange(ops.map((o, j) => (j === i ? { ...o, ...patch } : o)));
    const remove = (i) => onChange(ops.filter((_, j) => j !== i));
    const move = (i, dir) => {
        const j = i + dir;
        if (j < 0 || j >= ops.length) return;
        const next = ops.slice();
        [next[i], next[j]] = [next[j], next[i]];
        onChange(next);
    };
    const add = (def) => { onChange([...ops, def.makeDefault()]); setMenuOpen(false); };

    const optionsAt = (i) => columnsAfterOps(baseColumns, ops, i)
        .map(k => ({ key: k, sample: columnSamples[k] }));

    return (
        <div className="space-y-2">
            {ops.length === 0 && (
                <div className="text-[11px] text-[var(--text-tertiary)] italic">
                    Nothing yet — number the rows, give matching rows a shared ID, rename, keep/remove or sort.
                </div>
            )}
            {ops.map((o, i) => (
                <OpCard
                    key={i}
                    op={o}
                    index={i}
                    count={ops.length}
                    options={optionsAt(i)}
                    onChange={(patch) => update(i, patch)}
                    onRemove={() => remove(i)}
                    onMove={(dir) => move(i, dir)}
                    onFocusField={onFocusField}
                />
            ))}
            <div className="relative" ref={menuRef}>
                <button
                    type="button"
                    onClick={() => setMenuOpen(o => !o)}
                    className="flex items-center gap-1 text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] px-2 py-1 rounded transition"
                >
                    <Plus size={12} /> Add a table tool
                </button>
                {/* Portalled + height-capped: this menu had neither a max-height
                    nor an escape from the modal's clip chain, so the last table
                    tools were unreachable near the bottom of the form. */}
                <AnchoredMenu open={menuOpen} onClose={closeMenu} anchorRef={menuRef} align="left" width={288} role="menu" className="py-1">
                    {SET_OP_DEFS.map(def => (
                        <button
                            key={def.op}
                            type="button"
                            onClick={() => add(def)}
                            className="w-full px-3 py-1.5 text-left hover:bg-[var(--bg-tertiary)] transition"
                        >
                            <div className="text-xs text-[var(--text-primary)]">{def.title}</div>
                            <div className="text-[10px] text-[var(--text-tertiary)]">{def.hint}</div>
                        </button>
                    ))}
                </AnchoredMenu>
            </div>
        </div>
    );
}

function OpCard({ op, index, count, options, onChange, onRemove, onMove, onFocusField }) {
    const existing = options.map(o => o.key);
    // Writing into a column that already exists replaces its values — legal
    // and sometimes wanted, but never silently.
    const collision = (name) => (name && existing.includes(name)
        ? `Replaces the existing “${humanizeFieldKey(name)}” values on every row.`
        : null);

    return (
        <div className={cardClass()}>
            <div className="flex items-center gap-1">
                <span className="flex-1 text-xs font-medium text-[var(--text-primary)]">{SET_OP_TITLES[op.op] || op.op}</span>
                <button
                    type="button" onClick={() => onMove(-1)} disabled={index === 0}
                    title="Run earlier" aria-label="Move operation up"
                    className="p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-30"
                >
                    <ChevronUp size={12} />
                </button>
                <button
                    type="button" onClick={() => onMove(1)} disabled={index === count - 1}
                    title="Run later" aria-label="Move operation down"
                    className="p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-30"
                >
                    <ChevronDown size={12} />
                </button>
                <button
                    type="button" onClick={onRemove}
                    title="Remove this operation" aria-label="Remove operation"
                    className="p-1 rounded text-[var(--text-tertiary)] hover:text-red-500 hover:bg-red-500/10"
                >
                    <Trash2 size={12} />
                </button>
            </div>

            {op.op === 'rowId' && (
                <>
                    <MiniRow label="Put the number in">
                        <NameInput value={op.target || ''} onCommit={(v) => onChange({ target: v })} placeholder="id" warning={collision(op.target)} />
                    </MiniRow>
                    <MiniRow label="Start at">
                        <input
                            type="number"
                            value={op.start ?? 1}
                            onChange={(e) => onChange({ start: e.target.value === '' ? '' : Number(e.target.value) })}
                            className={inputClass()}
                        />
                    </MiniRow>
                </>
            )}

            {op.op === 'groupId' && (
                <>
                    <MiniRow label="Rows match when these are equal">
                        <KeyList keys={op.keys || []} options={options} onChange={(keys) => onChange({ keys })} onFocusField={onFocusField} addLabel="Add another column" />
                    </MiniRow>
                    <MiniRow label="Put the shared ID in">
                        <NameInput value={op.target || ''} onCommit={(v) => onChange({ target: v })} placeholder="groupId" warning={collision(op.target)} />
                    </MiniRow>
                    <p className="text-[10px] text-[var(--text-tertiary)]">
                        Rows with the same value(s) get the same number, in order of first appearance. Text matches ignore upper/lower case.
                    </p>
                </>
            )}

            {op.op === 'rename' && (
                <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                        <FieldKeyCombobox value={op.from || ''} onChange={(v) => onChange({ from: v })} options={options} placeholder="current name" label="Rename" onFocusField={onFocusField} />
                    </div>
                    <span className="text-[var(--text-tertiary)] text-xs shrink-0">→</span>
                    <div className="flex-1 min-w-0">
                        <NameInput value={op.to || ''} onCommit={(v) => onChange({ to: v })} placeholder="new name" warning={op.to !== op.from ? collision(op.to) : null} />
                    </div>
                </div>
            )}

            {(op.op === 'keep' || op.op === 'remove') && (
                <MiniRow label={op.op === 'keep' ? 'Keep only these fields' : 'Remove these fields'}>
                    <KeyList keys={op.keys || []} options={options} onChange={(keys) => onChange({ keys })} onFocusField={onFocusField} addLabel="Add a column" />
                </MiniRow>
            )}

            {op.op === 'sort' && (
                <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                        <FieldKeyCombobox value={op.key || ''} onChange={(v) => onChange({ key: v })} options={options} placeholder="column to sort by" label="Sort by" onFocusField={onFocusField} />
                    </div>
                    <select
                        value={op.direction === 'desc' ? 'desc' : 'asc'}
                        onChange={(e) => onChange({ direction: e.target.value })}
                        className={`${inputClass()} !w-auto shrink-0`}
                    >
                        <option value="asc">A → Z / low → high</option>
                        <option value="desc">Z → A / high → low</option>
                    </select>
                </div>
            )}
        </div>
    );
}

function MiniRow({ label, children }) {
    return (
        <div className="space-y-0.5">
            <div className="text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">{label}</div>
            {children}
        </div>
    );
}

/**
 * Column-name input that commits on blur/Enter — the CaseNameInput pattern.
 * Live-controlled names would feed the 600 ms autosave half-typed states;
 * committing whole names keeps every flushed patch clean. Incomplete ('') is
 * fine — the validator marks it as a completeness problem, never a lost row.
 */
function NameInput({ value, onCommit, placeholder, warning = null }) {
    const [text, setText] = useState(value || '');
    useEffect(() => { setText(value || ''); }, [value]);
    const commit = () => { const v = text.trim(); if (v !== (value || '')) onCommit(v); };
    return (
        <div className="min-w-0">
            <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }}
                placeholder={placeholder}
                className={inputClass()}
            />
            {warning && <div className="mt-0.5 text-[10px] text-amber-600 dark:text-amber-400">{warning}</div>}
        </div>
    );
}

/** One combobox per key + add/remove — composite keys and keep/remove lists. */
function KeyList({ keys, options, onChange, onFocusField, addLabel }) {
    const rows = keys.length ? keys : [''];
    const setAt = (i, v) => {
        const next = rows.slice();
        next[i] = v;
        onChange(next.filter((k, j) => k || j === i)); // keep the row being edited
    };
    const removeAt = (i) => onChange(rows.filter((_, j) => j !== i));
    return (
        <div className="space-y-1">
            {rows.map((k, i) => (
                <div key={i} className="flex items-center gap-1">
                    <div className="flex-1 min-w-0">
                        <FieldKeyCombobox value={k} onChange={(v) => setAt(i, v)} options={options} placeholder="column" label="Column" onFocusField={onFocusField} />
                    </div>
                    {rows.length > 1 && (
                        <button
                            type="button" onClick={() => removeAt(i)}
                            className="p-1 rounded text-[var(--text-tertiary)] hover:text-red-500 hover:bg-red-500/10"
                            aria-label="Remove column"
                        >
                            <Trash2 size={12} />
                        </button>
                    )}
                </div>
            ))}
            <button
                type="button"
                onClick={() => onChange([...rows, ''])}
                className="flex items-center gap-1 text-[10px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] px-1 py-0.5 rounded transition"
            >
                <Plus size={10} /> {addLabel}
            </button>
        </div>
    );
}
