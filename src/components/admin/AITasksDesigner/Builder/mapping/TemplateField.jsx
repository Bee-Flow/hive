import { Braces } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import useVariablePicker from './useVariablePicker';
import VariablePicker from './VariablePicker';
import { useVariablePickerContext } from './VariablePickerContext';
import { insertAtCursor, walkPath, previewValue } from '../../../../../utils/bindingHelpers';

/**
 * Multi-line string field with `{{path}}` interpolation. Unlike
 * BindingField (which produces a `{kind, value/path}` binding object),
 * TemplateField produces a plain string — used for raw string slots
 * like the AI step's prompt and the Notification body/title where the
 * runtime resolver interpolates `{{path}}` directly via the
 * `template`-kind code path inside `resolveValue`.
 *
 * Variable tree clicks/drops insert `{{path}}` at the caret.
 *
 * Props:
 *   value           — current string
 *   onChange        — (next: string) => void
 *   label / hint    — optional descriptions
 *   placeholder     — input placeholder
 *   rows            — textarea row count (default 4)
 *   onFocusField    — registers an `insert` handle with the parent so
 *                     the VariableTree can splice into this field
 *   previewSample   — merged sample tree for resolving `{{path}}`
 *                     occurrences in the preview line below
 */
export default function TemplateField({
    value = '',
    onChange,
    label = null,
    hint = null,
    placeholder = '',
    rows = 4,
    onFocusField,
    previewSample = null,
}) {
    const [text, setText] = useState(value || '');
    const inputRef = useRef(null);
    const picker = useVariablePicker();
    const pickerCtx = useVariablePickerContext();
    const effectivePreviewSample = previewSample ?? pickerCtx.previewSample;
    const pickerGroups = pickerCtx.groups;

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setText(value || '');
    }, [value]);

    const emit = (next) => {
        setText(next);
        onChange?.(next);
    };

    const onTextChange = (e) => emit(e.target.value);

    const onFocus = () => {
        if (!onFocusField) return;
        onFocusField({
            id: label || placeholder || 'template',
            label: label || placeholder || 'template',
            insert: (path) => {
                const snippet = `{{${path}}}`;
                const result = insertAtCursor(inputRef.current, snippet);
                if (result != null) emit(result);
            },
        });
    };

    const onDragOver = (e) => {
        if (e.dataTransfer?.types?.includes('application/x-binding-path')) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        }
    };
    const onDrop = (e) => {
        const path = e.dataTransfer.getData('application/x-binding-path') || e.dataTransfer.getData('text/plain');
        if (!path) return;
        e.preventDefault();
        const snippet = `{{${path}}}`;
        const result = insertAtCursor(inputRef.current, snippet);
        if (result != null) emit(result);
    };

    const preview = renderPreview(text, effectivePreviewSample);

    const insertFromPicker = (path) => {
        const snippet = `{{${path}}}`;
        inputRef.current?.focus();
        const result = insertAtCursor(inputRef.current, snippet);
        if (result != null) emit(result);
        picker.closePicker();
    };

    return (
        <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
                {label
                    ? <div className="text-[11px] font-medium text-[var(--text-secondary)]">{label}</div>
                    : <span />}
                <button
                    type="button"
                    onClick={(e) => picker.openPicker(e.currentTarget)}
                    title="Insert variable from upstream"
                    aria-label="Insert variable"
                    aria-haspopup="dialog"
                    aria-expanded={picker.open}
                    className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-[var(--border-default)] text-[10px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
                >
                    <Braces size={11} />
                    <span>Insert</span>
                </button>
            </div>
            <textarea
                ref={inputRef}
                rows={rows}
                value={text}
                onChange={onTextChange}
                onFocus={onFocus}
                onDragOver={onDragOver}
                onDrop={onDrop}
                placeholder={placeholder}
                className="w-full px-2 py-1.5 text-xs rounded border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
            {hint && <div className="text-[10px] text-[var(--text-tertiary)]">{hint}</div>}
            <VariablePicker
                {...picker.pickerProps}
                groups={pickerGroups}
                previewSample={effectivePreviewSample}
                onPick={insertFromPicker}
                title={label ? `Insert into ${label}` : 'Insert variable'}
            />

            {preview != null && (
                <div className="text-[10px] text-[var(--text-tertiary)] space-y-0.5">
                    <div className="uppercase tracking-wide">preview</div>
                    <div className="font-mono text-[var(--text-secondary)] whitespace-pre-wrap break-words bg-[var(--bg-secondary)] rounded px-2 py-1">
                        {preview}
                    </div>
                </div>
            )}
        </div>
    );
}

function renderPreview(text, sampleRoot) {
    if (!text) return null;
    if (!/\{\{[^}]+\}\}/.test(text)) return null; // no interpolation, no preview
    if (!sampleRoot) return text;
    return String(text).replace(/\{\{\s*([^}]+?)\s*\}\}/g, (full, expr) => {
        const v = walkPath(expr.trim(), sampleRoot);
        if (v === undefined) return full;
        return previewValue(v, 30);
    });
}
