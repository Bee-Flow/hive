import React, { useMemo, useState } from 'react';
import BindingField from './BindingField';
import {
    parseSimpleCondition,
    buildConditionExpr,
    bindingFromInput,
} from '../../../../../utils/bindingHelpers';

/**
 * Condition step expression editor.
 *
 * Visual mode (default): three slots — left-path picker (BindingField in
 * expression mode), operator dropdown, right-value (BindingField). The
 * generated expression is emitted as a single string for the `expr`
 * field on the condition step.
 *
 * Advanced raw mode: a textarea with the same expression. Toggling
 * raw→visual attempts to parse the expression; if it can't be expressed
 * as `<path> <op> <literal/path>`, visual mode is locked and the user
 * stays in raw.
 *
 * Props:
 *   value         — current raw expression string (the condition step's
 *                   `expr` field on the step definition)
 *   onChange      — (next: string) => void
 *   onFocusField  — focus broadcaster (forwarded to nested BindingFields)
 *   previewSample — merged sample tree for previews
 */
export default function ConditionBuilder({ value = '', onChange, onFocusField, previewSample = null }) {
    const parsed = useMemo(() => parseSimpleCondition(value), [value]);
    const canUseVisual = parsed !== null || !value;
    const [rawMode, setRawMode] = useState(!canUseVisual);

    // Visual slots — derived from parsed when possible, otherwise empty.
    const leftBinding = parsed ? { kind: 'ref', path: parsed.leftPath } : (value ? null : { kind: 'literal', value: '' });
    const op = parsed?.op || '==';
    const rightBinding = parsed ? rightToBinding(parsed.rightRaw) : { kind: 'literal', value: '' };

    if (rawMode) {
        return (
            <div className="space-y-1">
                <textarea
                    rows={3}
                    value={value || ''}
                    onChange={(e) => onChange?.(e.target.value)}
                    placeholder="steps.s1.output.amount > 1000"
                    onFocus={() => onFocusField?.({
                        id: 'expression',
                        label: 'condition expression',
                        insert: (path) => insertIntoTextarea(value, onChange, path),
                    })}
                    className="w-full px-2 py-1.5 text-xs font-mono rounded border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                />
                <div className="flex items-center justify-between gap-2 pt-1">
                    <div className="text-[10px] text-[var(--text-tertiary)]">
                        Restricted JS. Example: <code>steps.x.output.amount &gt; 1000</code>
                    </div>
                    {canUseVisual && (
                        <button
                            type="button"
                            onClick={() => setRawMode(false)}
                            className="text-[10px] text-[var(--accent)] hover:underline"
                        >
                            Use visual builder
                        </button>
                    )}
                </div>
            </div>
        );
    }

    const updateLeft = (b) => {
        const leftPath = bindingToPath(b);
        if (!leftPath) {
            // Force expression mode on left field — but user typed
            // something we can't reduce. Switch to raw mode and emit raw.
            setRawMode(true);
            onChange?.(value);
            return;
        }
        onChange?.(buildConditionExpr(leftPath, op, rightBinding));
    };

    const updateOp = (nextOp) => {
        const leftPath = parsed?.leftPath || bindingToPath(leftBinding) || '';
        if (!leftPath) return;
        onChange?.(buildConditionExpr(leftPath, nextOp, rightBinding));
    };

    const updateRight = (b) => {
        const leftPath = parsed?.leftPath || bindingToPath(leftBinding) || '';
        if (!leftPath) return;
        onChange?.(buildConditionExpr(leftPath, op, b));
    };

    return (
        <div className="space-y-2">
            <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-start">
                <BindingField
                    label="Field"
                    placeholder="steps.s1.output.amount"
                    value={leftBinding}
                    onChange={updateLeft}
                    onFocusField={onFocusField}
                    previewSample={previewSample}
                />
                <div className="pt-5">
                    <select
                        value={op}
                        onChange={(e) => updateOp(e.target.value)}
                        className="px-2 py-1.5 text-xs rounded border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                    >
                        <option value="==">==</option>
                        <option value="!=">!=</option>
                        <option value="===">===</option>
                        <option value="!==">!==</option>
                        <option value=">">&gt;</option>
                        <option value=">=">&gt;=</option>
                        <option value="<">&lt;</option>
                        <option value="<=">&lt;=</option>
                    </select>
                </div>
                <BindingField
                    label="Value"
                    placeholder="1000"
                    value={rightBinding}
                    onChange={updateRight}
                    onFocusField={onFocusField}
                    previewSample={previewSample}
                />
            </div>
            <div className="flex items-center justify-between gap-2">
                <div className="text-[10px] text-[var(--text-tertiary)] font-mono truncate">
                    {value || <span className="italic">no expression</span>}
                </div>
                <button
                    type="button"
                    onClick={() => setRawMode(true)}
                    className="text-[10px] text-[var(--accent)] hover:underline shrink-0"
                >
                    Write raw expression
                </button>
            </div>
        </div>
    );
}

function bindingToPath(b) {
    if (!b) return '';
    if (b.kind === 'ref') return b.path || '';
    return '';
}

function rightToBinding(rawText) {
    if (typeof rawText !== 'string') return { kind: 'literal', value: '' };
    const trimmed = rawText.trim();
    // Try JSON literal first.
    if (/^(true|false|null)$/.test(trimmed)) {
        return { kind: 'literal', value: trimmed === 'null' ? null : trimmed === 'true' };
    }
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
        return { kind: 'literal', value: Number(trimmed) };
    }
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
        try { return { kind: 'literal', value: JSON.parse(trimmed.replace(/'/g, '"')) }; }
        catch (_) { return { kind: 'literal', value: trimmed.slice(1, -1) }; }
    }
    // Otherwise treat as expression-mode input — bindingFromInput will
    // detect ref-vs-expr.
    return bindingFromInput(trimmed, 'expression');
}

function insertIntoTextarea(currentValue, onChange, path) {
    // Without a ref we can't know the cursor in a not-yet-rendered field;
    // append for now. Refs are tricky to thread through useState; the
    // visual builder is the primary path so this raw-mode insert is a
    // best-effort fallback.
    const next = (currentValue || '') + path;
    onChange?.(next);
}

