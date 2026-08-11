import { Braces } from 'lucide-react';
import { onBindingDragOver, getBindingDropPath } from './bindingDnd';
import React, { useEffect, useRef, useState } from 'react';
import RefTokenInput from './RefTokenInput';
import useVariablePicker from './useVariablePicker';
import VariablePicker from './VariablePicker';
import { useVariablePickerContext } from './VariablePickerContext';
import { walkPath, previewValue, getAutocompleteTokenFromPrefix } from '../../../../../utils/bindingHelpers';
import { denseInputClass } from '../flow/settings/formStyles';

/**
 * Multi-line string field with `{{path}}` interpolation. Unlike
 * BindingField (which produces a `{kind, value/path}` binding object),
 * TemplateField produces a plain string — used for raw string slots
 * like the AI step's prompt and the Notification body/title where the
 * runtime resolver interpolates `{{path}}` directly via the
 * `template`-kind code path inside `resolveValue`.
 *
 * Variable tree clicks/drops insert `{{path}}` at the caret — as a PILL. The
 * editing surface is RefTokenInput, so a reference reads "gmail read ▸ Output"
 * while you type, not `{{steps.act_f9aaff0e.output.results[*].output}}`.
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
 *   multiline       — false renders a one-line <input> instead of a
 *                     textarea, for slots that sit in a tight row
 *   inline          — put the {} button beside the field instead of in a
 *                     header row above it (same reason)
 *   ariaLabel       — accessible name for the control itself, for slots
 *                     whose visible label lives outside this component
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
    multiline = true,
    inline = false,
    ariaLabel = null,
}) {
    const [text, setText] = useState(value || '');
    const inputRef = useRef(null);
    const picker = useVariablePicker();
    const pickerCtx = useVariablePickerContext();
    const effectivePreviewSample = previewSample ?? pickerCtx.previewSample;
    const pickerGroups = pickerCtx.groups;
    const stepLabelById = pickerCtx.stepLabelById;

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setText(value || '');
    }, [value]);

    const emit = (next) => {
        setText(next);
        onChange?.(next);
    };

    // Inline autocomplete: typing an unclosed `{{partial` opens the picker
    // pre-filtered to the partial; picking swallows those characters and drops a
    // pill in their place. The LENGTH is recorded here rather than a range —
    // focus moves to the picker's search box, so the caret can't be trusted at
    // pick time.
    const autocompleteLength = useRef(0);
    const onInput = () => {
        const token = getAutocompleteTokenFromPrefix(inputRef.current?.textBeforeCaret() || '', 'fixed');
        if (token) {
            autocompleteLength.current = token.length;
            if (!picker.open) picker.openPicker(inputRef.current?.element, { initialQuery: token.query });
        }
    };

    const insertPath = (path) => inputRef.current?.insertSnippet(`{{${path}}}`);

    const onFocus = () => {
        if (!onFocusField) return;
        onFocusField({
            id: label || placeholder || 'template',
            label: label || placeholder || 'template',
            insert: insertPath,
        });
    };

    const onDragOver = onBindingDragOver;
    const onDrop = (e) => {
        const path = getBindingDropPath(e);
        if (path) insertPath(path);
    };

    const preview = renderPreview(text, effectivePreviewSample);

    const insertFromPicker = (path) => {
        const swallow = autocompleteLength.current;
        autocompleteLength.current = 0;
        if (swallow) inputRef.current?.replacePartial(swallow, `{{${path}}}`);
        else insertPath(path);
        picker.closePicker();
    };

    const control = (
        <div className={inline ? 'flex-1 min-w-0' : ''}>
            <RefTokenInput
                ref={inputRef}
                value={text}
                mode="fixed"
                multiline={multiline}
                rows={rows}
                onChange={emit}
                onInput={onInput}
                onFocus={onFocus}
                onDragOver={onDragOver}
                onDrop={onDrop}
                placeholder={placeholder}
                ariaLabel={ariaLabel}
                stepLabelById={stepLabelById}
                className={denseInputClass('w-full')}
            />
        </div>
    );

    const insertButton = (
        <button
            type="button"
            onClick={(e) => { autocompleteLength.current = 0; picker.openPicker(e.currentTarget); }}
            title="Insert variable from upstream"
            aria-label="Insert variable"
            aria-haspopup="dialog"
            aria-expanded={picker.open}
            className={`shrink-0 inline-flex items-center gap-1 rounded border border-[var(--border-default)] text-[10px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] ${
                inline ? 'px-1.5 self-stretch' : 'px-1.5 py-0.5'
            }`}
        >
            <Braces size={11} />
            {!inline && <span>Insert</span>}
        </button>
    );

    return (
        <div className="space-y-1">
            {inline ? (
                <div className="flex items-stretch gap-1">
                    {control}
                    {insertButton}
                </div>
            ) : (
                <>
                    <div className="flex items-center justify-between gap-2">
                        {label
                            ? <div className="text-[11px] font-medium text-[var(--text-secondary)]">{label}</div>
                            : <span />}
                        {insertButton}
                    </div>
                    {control}
                </>
            )}
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
                    <div className="uppercase tracking-wide">example</div>
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
