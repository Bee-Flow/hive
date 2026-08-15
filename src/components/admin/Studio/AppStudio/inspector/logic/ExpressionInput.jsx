import { AlertTriangle, Braces, FunctionSquare, SlidersHorizontal } from 'lucide-react';
import React from 'react';
import ConditionField from './ConditionField';
import useExpressionEditing, { conditionCanHold, useConditionToggle } from './useExpressionEditing';
import VariablePicker from '../../../../AITasksDesigner/Builder/mapping/VariablePicker';
import { FORMULA_SCOPE_ROOTS } from '../styleKnobMeta';

/**
 * ExpressionInput — the one expression editor App Studio uses everywhere.
 *
 * Before this, two of them existed. FormulaField had a variable picker, live
 * parse errors, an evaluated preview and a condition-builder escape; the filter
 * row's formula field was a bare <input>. Both edit the same restricted
 * expression language against the same scope, so a typo in the second one
 * resolved to `undefined`, the filter entry was dropped, and the list quietly
 * showed the wrong rows with no feedback anywhere.
 *
 * ── VARIANTS ────────────────────────────────────────────────────────
 * `block` (the default, what FormulaField renders) is a textarea with the
 * result and any error on their own lines beneath it.
 *
 * `inline` is one line — for a filter row or a param row, where there is no
 * vertical space at all. The same information is still there, moved into the
 * field: the error becomes an aria-invalid border plus a warning adornment
 * whose tooltip is the message, and the preview becomes a right-aligned
 * `→ value` inside the box. Both keep the `data-formula-error` /
 * `data-formula-preview` hooks so one query finds them in either variant.
 *
 * ── expectsBoolean ──────────────────────────────────────────────────
 * The condition builder is offered only where a boolean is actually wanted
 * (visibleWhen / enabledWhen / a formula validation rule). FormulaField used to
 * offer it wherever it had a definition and a node, which included computed
 * props and chart data — clicking it there rewrote a working value expression
 * into a comparison.
 *
 * `value` is the raw expression string; `onChange` emits the raw string. A
 * caller storing `{kind:'formula', expr}` unwraps and re-wraps around it.
 *
 * No purple: accent, border and text all come from the platform CSS vars.
 */
export default function ExpressionInput({
    value = '',
    onChange,
    variant = 'block',
    label = null,
    placeholder = 'e.g. form.quantity > 0',
    // FieldLabel is a <span>, so the control's name has to come from here. It
    // defaults to the visible label when there is one: in the computed-props and
    // validation editors two of these sit under each other, and "Formula" twice
    // tells a screen-reader user nothing about which is which.
    ariaLabel = null,
    previewSample = null,
    definition = null,
    node = null,
    rows = 2,
    disabled = false,
    expectsBoolean = false,
    showPicker = true,
    roots = FORMULA_SCOPE_ROOTS,
}) {
    const {
        fieldRef, picker, pickerProps, groups, sample, evalInfo,
        openPicker, closePicker, insertPath, handleInput, handleDragOver, handleDrop,
    } = useExpressionEditing({ value, onChange, previewSample, roots, disabled });

    const canUseCondition = expectsBoolean && !!(definition && node) && variant === 'block';
    // Where a boolean is wanted and the clickable builder can hold what is
    // already there, that is what opens. It used to open on the monospace
    // textarea every time, with the builder behind a link at the bottom — so
    // the first thing a bookkeeper met when asked "when should this show?" was
    // an empty code box, and the answer to "can I do this without writing
    // code" was no until they found the link. The escape to a formula stays one
    // click away, and an expression the builder CANNOT hold still opens raw
    // rather than being mangled into rows.
    const { asCondition, setAsCondition } = useConditionToggle(
        () => canUseCondition && conditionCanHold(value),
    );
    const name = ariaLabel || label || 'Formula';

    if (asCondition && canUseCondition) {
        return (
            <div className="space-y-1.5">
                {label && <FieldLabel>{label}</FieldLabel>}
                <ConditionField
                    value={value}
                    onChange={onChange}
                    definition={definition}
                    node={node}
                    previewSample={previewSample}
                    disabled={disabled}
                />
                <div className="flex justify-end">
                    <ToggleLink onClick={() => setAsCondition(false)} icon={FunctionSquare} disabled={disabled}>
                        Write a formula
                    </ToggleLink>
                </div>
            </div>
        );
    }

    const pickerButton = showPicker ? (
        <button
            type="button"
            onClick={(e) => openPicker(e.currentTarget)}
            disabled={disabled}
            title="Insert a variable"
            aria-label="Insert a variable"
            className="shrink-0 px-2 rounded border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] flex items-center justify-center transition-colors disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-hover)]"
        >
            <Braces size={12} />
        </button>
    ) : null;

    const pickerPopover = showPicker ? (
        <VariablePicker
            {...pickerProps}
            groups={groups}
            previewSample={sample}
            onPick={(path) => { insertPath(path); closePicker(); }}
            onClose={closePicker}
            title="Insert a variable"
        />
    ) : null;

    const shared = {
        ref: fieldRef,
        value: value || '',
        disabled,
        onChange: handleInput,
        onDragOver: handleDragOver,
        onDrop: handleDrop,
        placeholder,
        'aria-label': name,
        'aria-invalid': evalInfo.error ? 'true' : undefined,
        spellCheck: false,
    };

    if (variant === 'inline') {
        return (
            <div className="flex items-stretch gap-1.5 min-w-0">
                <div className="relative flex-1 min-w-0">
                    <input
                        type="text"
                        {...shared}
                        className={`w-full px-2 py-1 pr-16 text-xs font-mono rounded-md border bg-[var(--bg-secondary)] text-[var(--text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-hover)] disabled:opacity-50 ${
                            evalInfo.error ? 'border-[var(--error)]' : 'border-[var(--border-default)]'
                        }`}
                    />
                    {/* One line, so the feedback lives INSIDE the box: an error
                        adornment on the right, or the resolved value when there
                        is room for it. */}
                    {evalInfo.error ? (
                        <span
                            data-formula-error="true"
                            title={evalInfo.error}
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[var(--error)] pointer-events-auto"
                        >
                            <AlertTriangle size={13} aria-hidden="true" />
                            <span className="sr-only">{evalInfo.error}</span>
                        </span>
                    ) : evalInfo.preview != null ? (
                        <span
                            data-formula-preview="true"
                            title={evalInfo.preview}
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 max-w-[45%] truncate text-[10px] font-mono text-[var(--text-secondary)] pointer-events-none"
                        >
                            → {evalInfo.preview}
                        </span>
                    ) : null}
                </div>
                {pickerButton}
                {pickerPopover}
            </div>
        );
    }

    return (
        <div className="space-y-1.5">
            {label && <FieldLabel>{label}</FieldLabel>}
            <div className="group flex items-stretch gap-1">
                <textarea
                    {...shared}
                    rows={rows}
                    className={`w-full px-2 py-1.5 text-xs font-mono rounded border bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-hover)] disabled:opacity-50 ${
                        evalInfo.error ? 'border-[var(--error)]' : 'border-[var(--border-default)]'
                    }`}
                />
                {pickerButton}
            </div>

            {evalInfo.error ? (
                <div
                    className="text-[11px] text-[var(--error)] font-mono truncate"
                    title={evalInfo.error}
                    data-formula-error="true"
                >
                    {evalInfo.error}
                </div>
            ) : evalInfo.preview != null ? (
                <div className="text-[11px] text-[var(--text-secondary)] flex items-center gap-1.5" data-formula-preview="true">
                    <span className="uppercase tracking-wide text-[var(--text-tertiary)]">result</span>
                    <span className="font-mono truncate">{evalInfo.preview}</span>
                </div>
            ) : null}

            {canUseCondition && (
                <div className="flex justify-end">
                    <ToggleLink onClick={() => setAsCondition(true)} icon={SlidersHorizontal} disabled={disabled}>
                        Use the condition builder
                    </ToggleLink>
                </div>
            )}

            {pickerPopover}
        </div>
    );
}

function FieldLabel({ children }) {
    return <span className="text-[11px] font-medium text-[var(--text-secondary)]">{children}</span>;
}

/**
 * The two mode switches. Shaped as a control rather than tinted with --accent,
 * which is an admin-configurable neutral grey by default and lands around 2.4:1
 * on the inspector panel.
 */
function ToggleLink({ onClick, icon: Icon, children, disabled = false }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-hover)]"
        >
            <Icon size={11} /> {children}
        </button>
    );
}
