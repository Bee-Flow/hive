import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Braces, ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
import BindingField from './BindingField';
import { ExpressionHelpBody } from './ExpressionHelp';
import FieldPicker from './FieldPicker';
import useVariablePicker from './useVariablePicker';
import VariablePicker from './VariablePicker';
import { useVariablePickerContext } from './VariablePickerContext';
import { walkPath, insertAtCursor } from '../../../../../utils/bindingHelpers';
import { denseInputClass } from '../flow/settings/formStyles';
import {
    inferType,
    operatorsForType,
    isUnaryOp,
    serializeRows,
    parseExprToRows,
    emptyRow,
} from '../utils/conditionModel';

/**
 * Clickable, datatype-aware condition editor — shared by the condition,
 * filter and switch step editors.
 *
 * Visual mode (default): one or more rows of [field] [operator] [value],
 * joined by AND / OR. The field is picked with a BindingField (variable
 * picker), the operator list adapts to the field's inferred datatype, and
 * the whole thing serialises to the restricted-JS `expr` string the server
 * evaluates (comparators + the whitelisted `contains/startsWith/…` helpers).
 *
 * Advanced raw mode: a plain textarea. Anything the model can't represent
 * (mixed AND/OR, unusual grammar) keeps the user in raw mode without losing
 * their expression.
 *
 * Props:
 *   value         — current raw expression string (the step's `expr`)
 *   onChange      — (next: string) => void
 *   onFocusField  — focus broadcaster forwarded to nested BindingFields
 *   previewSample — merged sample tree, used to infer field datatypes
 *   context       — 'condition' | 'filter' | 'switch' (tunes hints only)
 *
 * Two OPTIONAL props keep the technical surface out of the Condition node's form
 * without changing this component for its other caller (App Studio's
 * ConditionField), which passes neither:
 *   fieldOptions   — [{path,label,sample,group}]: render the left-hand side as
 *                    a FieldPicker (names, not paths). `fieldBase` is the root
 *                    a free-typed name resolves against.
 *   showSerialized — false hides the generated-expression line beneath the
 *                    rows (the Filter form shows it under Advanced instead).
 */
// A bare `true`/`false` is what a freshly-created condition/filter step
// defaults to (see DiagramPane.jsx's buildStepFromPayload) — "not configured
// yet", not a real condition. Treat it like an empty value (open the visual
// builder with a blank row) instead of dropping to the raw textarea; leaving
// the row empty and saving still correctly surfaces the usual
// condition.expr_missing/filter.expr_missing validation error.
function isTrivialValue(v) {
    return /^(true|false)$/.test(String(v ?? '').trim());
}

export default function ConditionBuilder({
    value = '', onChange, onFocusField, previewSample = null, context = 'condition',
    fieldOptions = null, fieldBase = 'item', showSerialized = true,
    // Example paths for the two free-text boxes. App Studio has no 
    // root, so the routines-shaped defaults below sent a Studio author off
    // writing an expression that could never resolve.
    placeholders = null,
}) {
    // Parse once for the initial state; subsequent external changes are
    // reconciled in the effect below.
    const initial = useMemo(() => (isTrivialValue(value) ? null : parseExprToRows(value)), []); // eslint-disable-line react-hooks/exhaustive-deps
    const [rows, setRows] = useState(() => (initial?.rows?.length ? initial.rows : [emptyRow()]));
    const [join, setJoin] = useState(() => initial?.join || '&&');
    const [rawMode, setRawMode] = useState(() => !!value && !isTrivialValue(value) && !initial);
    // Rows the user opted OUT of the friendly field picker for (the "use an
    // expression instead" escape). Per-row, so one computed left-hand side
    // doesn't drag the rest of the form back to raw paths.
    const [rawFieldRows, setRawFieldRows] = useState(() => new Set());
    const lastEmit = useRef(value);

    // Re-hydrate when `value` changes from OUTSIDE this component (switching
    // steps, an AI edit, a restore). We skip our own emits via `lastEmit`.
    useEffect(() => {
        if (value === lastEmit.current) return;
        const trivial = isTrivialValue(value);
        const parsed = trivial ? null : parseExprToRows(value);
        if (value && !trivial && !parsed) {
            setRawMode(true);
        } else {
            setRows(parsed?.rows?.length ? parsed.rows : [emptyRow()]);
            setJoin(parsed?.join || '&&');
            setRawMode(false);
        }
        lastEmit.current = value;
    }, [value]);

    const emit = (nextRows, nextJoin) => {
        const expr = serializeRows(nextRows, nextJoin);
        lastEmit.current = expr;
        onChange?.(expr);
    };
    const updateRow = (i, patch) => {
        const next = rows.slice();
        next[i] = { ...next[i], ...patch };
        setRows(next);
        emit(next, join);
    };
    const addRow = () => { const next = [...rows, emptyRow()]; setRows(next); emit(next, join); };
    const removeRow = (i) => {
        const next = rows.filter((_, k) => k !== i);
        const safe = next.length ? next : [emptyRow()];
        setRows(safe);
        emit(safe, join);
    };
    const changeJoin = (j) => { setJoin(j); emit(rows, j); };

    const canUseVisual = !value || !!parseExprToRows(value);

    if (rawMode) {
        return (
            <RawExpression
                value={value}
                context={context}
                placeholders={placeholders}
                onChange={(next) => { lastEmit.current = next; onChange?.(next); }}
                onFocusField={onFocusField}
                canUseVisual={canUseVisual}
                onUseVisual={() => {
                    const parsed = parseExprToRows(value);
                    setRows(parsed?.rows?.length ? parsed.rows : [emptyRow()]);
                    setJoin(parsed?.join || '&&');
                    setRawMode(false);
                }}
            />
        );
    }

    const fieldText = (r) => (r.field?.kind === 'ref' ? r.field.path : r.field?.kind === 'expr' ? r.field.value : '') || '';
    // The wildcard warning steers users away from comparing a whole array to
    // a scalar — doesn't apply to 'truthy' ("has a value"), where checking a
    // list is non-empty is exactly the point.
    const hasWildcard = rows.some((r) => r.op !== 'truthy' && fieldText(r).includes('[*]'));

    return (
        <div className="space-y-2">
            {rows.length > 1 && (
                <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
                    <span>Match</span>
                    <div className="inline-flex rounded border border-[var(--border-default)] overflow-hidden">
                        {[['&&', 'all'], ['||', 'any']].map(([j, lbl]) => (
                            <button
                                key={j}
                                type="button"
                                onClick={() => changeJoin(j)}
                                className={`px-2 py-0.5 text-[11px] ${join === j ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'}`}
                            >
                                {lbl}
                            </button>
                        ))}
                    </div>
                    <span>of these conditions:</span>
                </div>
            )}

            <div className="space-y-1.5">
                {rows.map((row, i) => {
                    const path = row.field?.kind === 'ref' ? row.field.path : '';
                    const type = path && previewSample ? inferType(walkPath(path, previewSample)) : 'unknown';
                    const ops = operatorsForType(type, row.op);
                    const unary = isUnaryOp(row.op);
                    return (
                        <div key={i} className="flex items-start gap-1.5">
                            <div className="grid grid-cols-[1fr_auto_1fr] gap-1.5 items-start flex-1 min-w-0">
                                {fieldOptions && !rawFieldRows.has(i) ? (
                                    <FieldPicker
                                        value={row.field}
                                        onChange={(b) => updateRow(i, { field: b })}
                                        options={fieldOptions}
                                        fallbackBase={fieldBase}
                                        onFocusField={onFocusField}
                                        onUseExpression={() => setRawFieldRows(s => new Set(s).add(i))}
                                    />
                                ) : (
                                    <BindingField
                                        placeholder={placeholders?.field || (context === 'filter' ? 'item.amount' : 'field (e.g. steps.step1.output.total)')}
                                        value={row.field}
                                        onChange={(b) => updateRow(i, { field: b })}
                                        onFocusField={onFocusField}
                                        previewSample={previewSample}
                                        showExpressionHelp={false}
                                    />
                                )}
                                <select
                                    value={row.op}
                                    onChange={(e) => updateRow(i, { op: e.target.value })}
                                    className={denseInputClass()}
                                    title={`Field type: ${type}`}
                                >
                                    {ops.map((o) => (
                                        <option key={o.key} value={o.key}>{o.label}</option>
                                    ))}
                                </select>
                                {unary ? (
                                    <div className="text-[10px] text-[var(--text-tertiary)] italic pt-1.5">no value needed</div>
                                ) : (
                                    <ValueSlot
                                        type={type}
                                        value={row.value}
                                        onChange={(b) => updateRow(i, { value: b })}
                                        onFocusField={onFocusField}
                                        previewSample={previewSample}
                                    />
                                )}
                            </div>
                            {rows.length > 1 && (
                                <button
                                    type="button"
                                    onClick={() => removeRow(i)}
                                    className="mt-1.5 p-1 rounded text-[var(--text-tertiary)] hover:text-red-500 hover:bg-red-500/10"
                                    title="Remove condition"
                                >
                                    <Trash2 size={12} />
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>

            {hasWildcard && (
                <div className="text-[10px] text-amber-600 dark:text-amber-400">
                    {context === 'filter'
                        ? 'Inside a filter the current element is bound as `item` — reference `item.<field>` instead of a list path with [*].'
                        : 'This field points at a list (contains `[*]`). Add a Filter step to work through items one at a time.'}
                </div>
            )}

            <div className="flex items-center justify-between gap-2">
                <button
                    type="button"
                    onClick={addRow}
                    className="inline-flex items-center gap-1 text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] px-2 py-1 rounded transition"
                >
                    <Plus size={12} /> Add condition
                </button>
                <button
                    type="button"
                    onClick={() => setRawMode(true)}
                    className="text-[10px] text-[var(--accent)] hover:underline shrink-0"
                >
                    Write raw expression
                </button>
            </div>

            {showSerialized && value && (
                <div className="text-[10px] text-[var(--text-tertiary)] font-mono truncate" title={value}>{value}</div>
            )}
        </div>
    );
}

const slotInputClass = denseInputClass('w-full');

/**
 * Typed right-hand-side slot. When the LEFT field's inferred datatype is
 * known and the current value is a plain literal, render the matching
 * control (number / true-false / date) instead of a free-text BindingField.
 * A small {} button swaps to the full BindingField for variable values.
 * Storage stays a literal binding, so serialisation/round-trip (JSON
 * literals via renderBindingValue / valueRawToBinding) is unchanged.
 */
function ValueSlot({ type, value, onChange, onFocusField, previewSample }) {
    const [useBinding, setUseBinding] = useState(false);
    const isLiteral = !value || value.kind == null || value.kind === 'literal';
    const typed = !useBinding && isLiteral && (type === 'number' || type === 'boolean' || type === 'date');

    if (!typed) {
        return (
            <BindingField
                placeholder="value"
                value={value}
                onChange={onChange}
                onFocusField={onFocusField}
                previewSample={previewSample}
                showExpressionHelp={false}
            />
        );
    }

    const v = value?.kind === 'literal' ? value.value : '';
    const swapButton = (
        <button
            type="button"
            onClick={() => setUseBinding(true)}
            title="Use a variable instead"
            aria-label="Use a variable instead"
            className="shrink-0 px-2 rounded border border-[var(--border-default)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] flex items-center justify-center"
        >
            <Braces size={12} />
        </button>
    );

    if (type === 'number') {
        return (
            <div className="flex items-stretch gap-1">
                <input
                    type="number"
                    value={v === '' || v == null ? '' : v}
                    onChange={(e) => onChange({ kind: 'literal', value: e.target.value === '' ? '' : Number(e.target.value) })}
                    placeholder="number"
                    className={slotInputClass}
                />
                {swapButton}
            </div>
        );
    }
    if (type === 'boolean') {
        return (
            <div className="flex items-stretch gap-1">
                <select
                    value={v === true ? 'true' : v === false ? 'false' : ''}
                    onChange={(e) => onChange({ kind: 'literal', value: e.target.value === '' ? '' : e.target.value === 'true' })}
                    className={slotInputClass}
                >
                    <option value="">(choose)</option>
                    <option value="true">true</option>
                    <option value="false">false</option>
                </select>
                {swapButton}
            </div>
        );
    }
    // date — ISO string literal; keep a time picker when the saved value has one.
    const str = typeof v === 'string' ? v : '';
    const hasTime = /T\d{2}:\d{2}/.test(str);
    return (
        <div className="flex items-stretch gap-1">
            <input
                type={hasTime ? 'datetime-local' : 'date'}
                value={hasTime ? str.slice(0, 16) : str.slice(0, 10)}
                onChange={(e) => onChange({ kind: 'literal', value: e.target.value })}
                className={slotInputClass}
            />
            {swapButton}
        </div>
    );
}

/**
 * Raw-expression mode: the plain textarea plus (new) a caret-aware {}
 * variable insert and a collapsible syntax-help panel driven by the FE
 * mirror of the server whitelist (exprFunctions.js). Saved raw exprs open
 * here exactly as before — textarea + "Use visual builder" escape are
 * unchanged.
 */
function RawExpression({ value, context, onChange, onFocusField, canUseVisual, onUseVisual, placeholders = null }) {
    const [showHelp, setShowHelp] = useState(false);
    const taRef = useRef(null);
    const picker = useVariablePicker();
    const pickerCtx = useVariablePickerContext();

    const insertAt = (path) => {
        const result = insertAtCursor(taRef.current, path);
        if (result != null) onChange(result);
    };

    return (
        <div className="space-y-1">
            <div className="group flex items-stretch gap-1">
                <textarea
                    ref={taRef}
                    rows={3}
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholders?.raw || (context === 'filter' ? 'item.amount > 1000' : 'steps.step1.output.amount > 1000')}
                    onFocus={() => onFocusField?.({
                        id: 'expression',
                        label: 'condition expression',
                        insert: insertAt,
                    })}
                    className={denseInputClass('w-full font-mono')}
                />
                <button
                    type="button"
                    onClick={(e) => picker.openPicker(e.currentTarget)}
                    title="Insert data from a previous step"
                    aria-label="Insert variable"
                    className="shrink-0 px-2 rounded border border-[var(--border-default)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] flex items-center justify-center opacity-60 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity"
                >
                    <Braces size={12} />
                </button>
            </div>
            <div className="flex items-center justify-between gap-2 pt-1">
                <button
                    type="button"
                    onClick={() => setShowHelp(h => !h)}
                    className="flex items-center gap-1 text-[10px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                >
                    {showHelp ? <ChevronDown size={11} /> : <ChevronRight size={11} />} Syntax help
                </button>
                {canUseVisual && (
                    <button
                        type="button"
                        onClick={onUseVisual}
                        className="text-[10px] text-[var(--accent)] hover:underline"
                    >
                        Use visual builder
                    </button>
                )}
            </div>
            {showHelp && <ExpressionHelpBody />}
            <VariablePicker
                {...picker.pickerProps}
                groups={pickerCtx.groups}
                previewSample={pickerCtx.previewSample}
                onPick={(path) => { insertAt(path); picker.closePicker(); }}
                title="Insert variable"
            />
        </div>
    );
}
