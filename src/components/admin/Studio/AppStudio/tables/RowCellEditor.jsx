import React, { useState } from 'react';
import { boolValue, dateInputValue, listValue, optionPairs } from './rowValues';
import { importableFields } from './spreadsheetPaste';

/**
 * App Studio — the editor for ONE cell of ONE row, chosen by the column's type.
 *
 * A column the designer declared as a choice edits as a dropdown, a yes/no as a
 * checkbox and a date as a date picker — a text box for all of them would let a
 * value in that the column cannot hold. A typed value commits on blur or Enter
 * and Escape leaves it as it was (the idiom the runtime's data grid uses for
 * its inline edits); `live` commits every keystroke instead, which is what the
 * not-yet-sent draft row needs.
 */

const CELL_CLS = 'w-full rounded-md px-2 py-1 text-sm border bg-[var(--bg-primary)] '
    + 'border-[var(--border-default)] text-[var(--text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-hover)] '
    + 'focus:border-[var(--accent-primary)]';

const INPUT_TYPE = { number: 'number', date: 'date', datetime: 'datetime-local' };

/** The label a relation cell shows for a row of the table it points at. */
function relationLabel(record, targetTable) {
    const textField = importableFields(targetTable?.fields)
        .find((f) => (f.type === 'text' || f.type === 'select') && record?.[f.key]);
    if (textField) return String(record[textField.key]);
    return String(record?.id ?? '');
}

function ChoiceCell({ field, value, onCommit, disabled, autoFocus, ariaLabel }) {
    const options = optionPairs(field);
    const current = value == null ? '' : String(value);
    // A value that is no longer among the choices stays visible instead of
    // silently resetting to blank the next time the cell is touched.
    const extra = current && !options.some((o) => o.value === current) ? [{ value: current, label: current }] : [];
    return (
        <select
            className={CELL_CLS}
            value={current}
            autoFocus={autoFocus}
            disabled={disabled}
            aria-label={ariaLabel}
            onChange={(e) => onCommit(e.target.value === '' ? null : e.target.value)}
        >
            <option value="">—</option>
            {[...options, ...extra].map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
    );
}

/**
 * Ticking a choice must not end the edit — a multi-select cell collects its
 * choices locally and hands the whole list over at once (onDone), unless the
 * caller wants every tick (onChange, the draft row).
 */
function MultiChoiceCell({ field, value, onChange, onDone, disabled, ariaLabel }) {
    const options = optionPairs(field);
    const [picked, setPicked] = useState(() => listValue(value).map(String));
    const toggle = (v) => {
        const next = picked.includes(v) ? picked.filter((x) => x !== v) : [...picked, v];
        setPicked(next);
        onChange?.(next);
    };
    return (
        <div
            className="flex flex-col gap-1 rounded-md border p-1.5"
            style={{ borderColor: 'var(--border-default)', background: 'var(--bg-primary)' }}
            role="group"
            aria-label={ariaLabel}
        >
            {options.length === 0 ? (
                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>This column has no choices yet.</span>
            ) : options.map((o) => (
                <label key={o.value} className="inline-flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: 'var(--text-primary)' }}>
                    <input
                        type="checkbox"
                        className="accent-[var(--accent-primary)]"
                        checked={picked.includes(o.value)}
                        disabled={disabled}
                        onChange={() => toggle(o.value)}
                    />
                    {o.label}
                </label>
            ))}
            {onDone ? (
                <button
                    type="button"
                    onClick={() => onDone(picked)}
                    className="mt-0.5 self-start rounded-md border px-2 py-0.5 text-xs"
                    style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                >
                    Done
                </button>
            ) : null}
        </div>
    );
}

function TypedCell({ field, value, onCommit, onCancel, disabled, live, autoFocus, label }) {
    const [draft, setDraft] = useState(() => (field.type === 'date' || field.type === 'datetime'
        ? dateInputValue(value, field.type)
        : (value ?? '')));

    const numeric = (raw) => {
        if (raw === '' || raw == null) return null;
        const n = Number(raw);
        return Number.isFinite(n) ? n : null;
    };
    const emit = (raw) => onCommit(field.type === 'number' ? numeric(raw) : (raw === '' ? null : raw));

    return (
        <input
            className={CELL_CLS}
            type={INPUT_TYPE[field.type] || 'text'}
            value={draft ?? ''}
            autoFocus={autoFocus}
            disabled={disabled}
            aria-label={label}
            spellCheck={false}
            onChange={(e) => {
                setDraft(e.target.value);
                if (live) emit(e.target.value);
            }}
            onBlur={live ? undefined : () => emit(draft)}
            onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); }
                if (e.key === 'Escape') { e.preventDefault(); onCancel?.(); }
            }}
        />
    );
}

export default function RowCellEditor({
    field, value, onCommit, onCancel, relationRows, relationTable,
    disabled = false, live = false, autoFocus = false,
}) {
    const label = `${field.name || field.key}`;

    if (field.type === 'bool') {
        return (
            <input
                type="checkbox"
                className="accent-[var(--accent-primary)]"
                checked={boolValue(value)}
                disabled={disabled}
                aria-label={label}
                onChange={(e) => onCommit(e.target.checked)}
            />
        );
    }
    if (field.type === 'select') {
        return <ChoiceCell field={field} value={value} onCommit={onCommit} disabled={disabled} autoFocus={autoFocus} ariaLabel={label} />;
    }
    if (field.type === 'multiselect') {
        return (
            <MultiChoiceCell
                field={field}
                value={value}
                onChange={live ? onCommit : null}
                onDone={live ? null : onCommit}
                disabled={disabled}
                ariaLabel={label}
            />
        );
    }
    if (field.type === 'relation') {
        const choices = (relationRows || []).map((r) => ({ value: String(r.id), label: relationLabel(r, relationTable) }));
        return (
            <ChoiceCell
                field={{ ...field, options: choices }}
                value={value}
                onCommit={onCommit}
                disabled={disabled}
                autoFocus={autoFocus}
                ariaLabel={label}
            />
        );
    }
    return (
        <TypedCell
            field={field}
            value={value}
            onCommit={onCommit}
            onCancel={onCancel}
            disabled={disabled}
            live={live}
            autoFocus={autoFocus}
            label={label}
        />
    );
}
