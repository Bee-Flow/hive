import { AlertTriangle } from 'lucide-react';
import React, { useState } from 'react';
import { RepeatableList } from '../../../ProductWebsite/fields';
import FormulaField from '../inspector/logic/FormulaField';
import { NumberField, TextField } from '../inspector/panels/kit';

/**
 * App Studio — the field editor for ONE data-model table.
 *
 * Edits the table's display name and its fields (key/name/type + per-type
 * options: required, unique, default, a relation target, or a computed
 * expression). Pure controlled component: every change bubbles the next table
 * object through onChange; the parent (TablesManager) owns the model + Save.
 *
 * Field keys follow the server grammar (KEY_RE: a lowercase letter then
 * letters/digits/underscore) — a key is a real SQLite column name, so it is
 * slugified as the user types and never collides with a system column.
 *
 * Once a field EXISTS server-side its key is frozen: every screen, formula and
 * saved view that already reads the field addresses it by key, and renaming it
 * migrates the column out from under them. `savedTable` (the live table as the
 * server knows it) marks which fields that applies to; renaming stays possible
 * behind an explicit, warned opt-in.
 */

const FIELD_TYPES = [
    { value: 'text', label: 'Text' },
    { value: 'richtext', label: 'Rich text' },
    { value: 'number', label: 'Number' },
    { value: 'date', label: 'Date' },
    { value: 'datetime', label: 'Date & time' },
    { value: 'bool', label: 'Yes / no' },
    { value: 'select', label: 'Select' },
    { value: 'multiselect', label: 'Multi-select' },
    { value: 'relation', label: 'Relation' },
    { value: 'file', label: 'File' },
    { value: 'computed', label: 'Computed' },
];

const SYSTEM_COLUMNS = new Set(['id', 'created_at', 'updated_at', 'created_by', 'org_id']);

function randHex(n) {
    let s = '';
    while (s.length < n) s += Math.floor(Math.random() * 16).toString(16);
    return s.slice(0, n);
}
export function newFieldId() { return `fld_${randHex(6)}`; }

/** Slugify free text into a valid, non-system field key (letters/digits/_). */
export function slugifyKey(input) {
    let k = String(input || '').toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^[^a-z]+/, '').replace(/_+/g, '_').replace(/^_|_$/g, '');
    if (!k) k = `field_${randHex(4)}`;
    if (SYSTEM_COLUMNS.has(k)) k = `${k}_field`;
    return k.slice(0, 63);
}

const CHECK_CLS = 'accent-[var(--accent-primary)]';
const FIELD_CLS =
    'w-full px-3 py-2 rounded-md text-sm border bg-[var(--bg-tertiary)] ' +
    'border-[var(--border-default)] text-[var(--text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-hover)] ' +
    'focus:border-[var(--accent-primary)] transition-colors disabled:opacity-50';

/** A choice as the user reads it — the server stores strings or { value, label }. */
function optionLabel(option) {
    if (option && typeof option === 'object') return String(option.label ?? option.value ?? '');
    return String(option ?? '');
}
function nextOption(option, text) {
    return (option && typeof option === 'object') ? { ...option, value: text, label: text } : text;
}

/** Switching to a choice type seeds a few blank choices to fill in. */
function typePatch(field, type) {
    const patch = { type };
    if ((type === 'select' || type === 'multiselect') && !Array.isArray(field.options)) patch.options = ['', '', ''];
    return patch;
}

function FieldEditor({ field, update, tables, currentTableId, saved, disabled }) {
    const set = (patch) => update({ ...field, ...patch });
    // While a key is still auto-derived (blank or matches the name's slug), keep
    // deriving it from the name; once the user edits the key explicitly, leave it.
    // A saved field's key is frozen — its name is then just a label.
    const keyIsAuto = !saved && (!field.key || field.key === slugifyKey(field.name));
    const [renaming, setRenaming] = useState(false);

    return (
        <div className="flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-2">
                <TextField
                    label="Name"
                    value={field.name}
                    onChange={(v) => set({ name: v, key: keyIsAuto ? slugifyKey(v) : field.key })}
                    placeholder="Amount"
                    disabled={disabled}
                />
                {saved && !renaming ? (
                    <div className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-[var(--text-secondary)]">Column name</span>
                        <div className="flex items-center gap-2">
                            <code className="min-w-0 flex-1 truncate rounded-md px-3 py-2 text-sm" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>{field.key}</code>
                            <button
                                type="button"
                                onClick={() => setRenaming(true)}
                                disabled={disabled}
                                className="shrink-0 rounded-md border px-2 py-1 text-xs disabled:opacity-50"
                                style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                            >
                                Change…
                            </button>
                        </div>
                        <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>Fixed — the app already refers to this field by this name.</span>
                    </div>
                ) : (
                    <TextField
                        label="Column name"
                        value={field.key}
                        onChange={(v) => set({ key: slugifyKey(v) })}
                        hint={saved ? undefined : 'Used inside the app'}
                        placeholder="amount"
                        disabled={disabled}
                    />
                )}
            </div>

            {saved && renaming ? (
                <p
                    className="flex items-start gap-1.5 rounded-md border px-2 py-1.5 text-xs"
                    style={{ borderColor: 'rgba(217, 119, 6, 0.4)', background: 'rgba(217, 119, 6, 0.1)', color: '#d97706' }}
                >
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>
                        Changing this stops every form, list and chart that already uses this field from finding it —
                        you will have to point each of them at the new name yourself.
                    </span>
                </p>
            ) : null}

            <label className="flex flex-col gap-1 text-xs font-medium text-[var(--text-secondary)]">
                Type
                <select
                    className={FIELD_CLS}
                    value={field.type || 'text'}
                    onChange={(e) => set(typePatch(field, e.target.value))}
                    disabled={disabled}
                    aria-label="Field type"
                >
                    {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
            </label>

            {field.type === 'select' || field.type === 'multiselect' ? (
                <RepeatableList
                    items={Array.isArray(field.options) ? field.options : []}
                    onChange={(next) => set({ options: next })}
                    makeNew={() => ''}
                    label="Choices"
                    addLabel="Add choice"
                    itemLabel={(o) => optionLabel(o)}
                    renderItem={(option, updateOption, idx) => (
                        <input
                            className={FIELD_CLS}
                            value={optionLabel(option)}
                            onChange={(e) => updateOption(nextOption(option, e.target.value))}
                            placeholder="In progress"
                            disabled={disabled}
                            aria-label={`Choice ${idx + 1}`}
                            spellCheck={false}
                        />
                    )}
                />
            ) : null}

            <div className="flex items-center gap-4 text-xs text-[var(--text-secondary)]">
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" className={CHECK_CLS} checked={!!field.required} disabled={disabled}
                        onChange={(e) => set({ required: e.target.checked })} />
                    Required
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" className={CHECK_CLS} checked={!!field.unique} disabled={disabled}
                        onChange={(e) => set({ unique: e.target.checked })} />
                    Unique
                </label>
            </div>

            {field.type === 'relation' ? (
                <label className="flex flex-col gap-1 text-xs font-medium text-[var(--text-secondary)]">
                    Related table
                    <select
                        className={FIELD_CLS}
                        value={field.relation?.table || ''}
                        onChange={(e) => set({ relation: { table: e.target.value } })}
                        disabled={disabled}
                        aria-label="Related table"
                    >
                        <option value="">Choose a table…</option>
                        {(tables || []).filter((t) => t.id !== currentTableId).map((t) => (
                            <option key={t.id} value={t.id}>{t.name || t.key}</option>
                        ))}
                    </select>
                </label>
            ) : field.type === 'computed' ? (
                <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-[var(--text-secondary)]">Computed expression</span>
                    <FormulaField
                        value={field.computed?.expr || ''}
                        onChange={(expr) => set({ computed: { ...(field.computed || {}), expr } })}
                        placeholder="e.g. price * quantity"
                        disabled={disabled}
                    />
                </div>
            ) : field.type !== 'bool' && field.type !== 'file' ? (
                field.type === 'number' ? (
                    <NumberField
                        label="Default"
                        value={field.default ?? null}
                        onChange={(v) => set({ default: v })}
                        disabled={disabled}
                    />
                ) : (
                    <TextField
                        label="Default"
                        value={field.default ?? ''}
                        onChange={(v) => set({ default: v || null })}
                        disabled={disabled}
                    />
                )
            ) : null}
        </div>
    );
}

export default function TableDesigner({ table, tables, savedTable = null, onChange, disabled = false }) {
    if (!table) return null;
    const set = (patch) => onChange({ ...table, ...patch });
    const fields = Array.isArray(table.fields) ? table.fields : [];
    const savedFieldIds = new Set((Array.isArray(savedTable?.fields) ? savedTable.fields : []).map((f) => f.id));

    return (
        <div className="flex flex-col gap-3">
            <TextField
                label="Table name"
                value={table.name}
                onChange={(v) => set({ name: v })}
                hint={`Stored as: ${table.key || '—'}`}
                placeholder="Invoices"
                disabled={disabled}
            />

            <RepeatableList
                items={fields}
                onChange={(next) => set({ fields: next })}
                makeNew={() => ({ id: newFieldId(), key: '', name: '', type: 'text', required: false, unique: false })}
                label="Fields"
                addLabel="Add field"
                collapsible
                itemLabel={(f) => f.name || f.key}
                renderItem={(field, update) => (
                    <FieldEditor
                        field={field}
                        update={update}
                        tables={tables}
                        currentTableId={table.id}
                        saved={savedFieldIds.has(field.id)}
                        disabled={disabled}
                    />
                )}
            />
        </div>
    );
}
