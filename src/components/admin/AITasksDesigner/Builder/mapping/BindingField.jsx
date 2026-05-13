import React, { useEffect, useRef, useState } from 'react';
import { FunctionSquare, Type } from 'lucide-react';
import {
    inputFromBinding,
    bindingFromInput,
    insertAtCursor,
    formatPathForInsert,
    walkPath,
    previewValue,
} from '../../../../../utils/bindingHelpers';

/**
 * Single mapping-aware field. The user sees one input and one mode
 * toggle ("=" / "Aa") — the binding kinds (literal/ref/template/expr)
 * are inferred automatically:
 *
 *   fixed (Aa):
 *     - plain text                       → { kind: 'literal' }
 *     - text containing "{{...}}"        → { kind: 'template' }
 *
 *   expression (=):
 *     - clean dotted path                → { kind: 'ref' }
 *     - anything else                    → { kind: 'expr' }
 *
 * Focus-broadcast: when this field is focused, it calls
 * `onFocusField({ label, insert })`. The parent (StepInspector) parks
 * that handle and forwards click-to-insert / drag-to-insert from the
 * VariableTree by calling `insert(path)`. The handle does the cursor-
 * aware splice and emits onChange in one shot.
 *
 * Preview: `previewSample` (a runtime-resolved root sample tree) lets us
 * show "preview: <value>" beneath the field. The parent passes the
 * merged sample tree (trigger sample + upstream step samples + loop) so
 * walkPath() can resolve any bound path locally.
 */
export default function BindingField({
    value,
    onChange,
    label,
    hint = null,
    required = false,
    placeholder = '',
    onFocusField,
    previewSample = null,
    multiline = false,
}) {
    const seed = inputFromBinding(value);
    const [mode, setMode] = useState(seed.mode);
    const [text, setText] = useState(seed.text);
    const inputRef = useRef(null);

    // Sync from outside (AI patch / undo / load). Intentional setState
    // from useEffect — we're syncing local UI state with the controlled
    // `value` prop.
    useEffect(() => {
        const s = inputFromBinding(value);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setMode(s.mode);
        setText(s.text);
    }, [value]);

    const emit = (nextText, nextMode) => {
        setText(nextText);
        const next = bindingFromInput(nextText, nextMode);
        onChange?.(next);
    };

    const onTextChange = (e) => emit(e.target.value, mode);

    const toggleMode = () => {
        const next = mode === 'fixed' ? 'expression' : 'fixed';
        setMode(next);
        // Re-emit with the new mode so the binding kind updates.
        emit(text, next);
        inputRef.current?.focus();
    };

    // Expose an `insert(path)` method to the parent via the focus
    // callback. We re-broadcast every time text/mode changes so the
    // captured handle always closes over the latest state.
    const broadcast = () => {
        if (!onFocusField) return;
        onFocusField({
            id: label || placeholder || 'field',
            label: label || placeholder || 'field',
            insert: (path) => {
                const snippet = formatPathForInsert(path, mode);
                if (!snippet) return;
                const result = insertAtCursor(inputRef.current, snippet);
                if (result != null) emit(result, mode);
            },
        });
    };

    const onFocus = () => broadcast();
    const onBlurDelayed = () => {
        // Don't drop the focused-field handle immediately — clicks on the
        // VariableTree blur the input first. Parent's own click handlers
        // will null it out when needed.
    };

    // Drag-drop a path from the VariableTree onto the field.
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
        const snippet = formatPathForInsert(path, mode);
        const result = insertAtCursor(inputRef.current, snippet);
        if (result != null) emit(result, mode);
    };

    const binding = bindingFromInput(text, mode);
    const preview = resolveBindingPreview(binding, previewSample);

    const inputClass = `w-full px-2 py-1.5 text-xs rounded border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] ${mode === 'expression' ? 'font-mono' : ''}`;

    return (
        <div className="space-y-1">
            {label && (
                <div className="flex items-baseline gap-1">
                    <label className="text-[11px] font-medium text-[var(--text-secondary)]">{label}</label>
                    {required && <span className="text-[10px] text-red-500">required</span>}
                </div>
            )}
            <div className="flex items-stretch gap-1">
                {multiline ? (
                    <textarea
                        ref={inputRef}
                        rows={3}
                        value={text}
                        onChange={onTextChange}
                        onFocus={onFocus}
                        onBlur={onBlurDelayed}
                        onDragOver={onDragOver}
                        onDrop={onDrop}
                        placeholder={placeholder}
                        className={inputClass}
                    />
                ) : (
                    <input
                        ref={inputRef}
                        type="text"
                        value={text}
                        onChange={onTextChange}
                        onFocus={onFocus}
                        onBlur={onBlurDelayed}
                        onDragOver={onDragOver}
                        onDrop={onDrop}
                        placeholder={placeholder}
                        className={inputClass}
                    />
                )}
                <button
                    type="button"
                    onClick={toggleMode}
                    title={mode === 'expression' ? 'Switch to fixed text' : 'Switch to expression (=)'}
                    aria-label={mode === 'expression' ? 'Switch to fixed text' : 'Switch to expression'}
                    className={`shrink-0 px-2 rounded border text-[11px] font-mono flex items-center justify-center
                        ${mode === 'expression'
                            ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/10'
                            : 'border-[var(--border-default)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]'}`}
                >
                    {mode === 'expression' ? <FunctionSquare size={12} /> : <Type size={12} />}
                </button>
            </div>
            {hint && <div className="text-[10px] text-[var(--text-tertiary)]">{hint}</div>}
            {preview != null && (
                <div className="text-[10px] text-[var(--text-tertiary)] flex items-center gap-1.5">
                    <span className="uppercase tracking-wide">preview</span>
                    <span className="font-mono text-[var(--text-secondary)] truncate">{preview}</span>
                </div>
            )}
        </div>
    );
}

/**
 * Resolve the displayed preview line for a binding using the sample
 * root tree provided by the parent. Returns:
 *   - the literal value (formatted) for literal bindings
 *   - the resolved sample for ref bindings
 *   - the template with paths substituted for template bindings
 *   - the raw expr text for expression bindings (we don't evaluate JS
 *     in the inspector — that would require shipping the sandbox to the
 *     client)
 */
function resolveBindingPreview(binding, sampleRoot) {
    if (!binding) return null;
    if (binding.kind === 'literal') {
        if (binding.value == null || binding.value === '') return null;
        return previewValue(binding.value, 60);
    }
    if (binding.kind === 'ref') {
        if (!binding.path) return null;
        if (!sampleRoot) return binding.path;
        const v = walkPath(binding.path, sampleRoot);
        if (v === undefined) return `(no sample for ${binding.path})`;
        return previewValue(v, 60);
    }
    if (binding.kind === 'template') {
        if (!binding.value) return null;
        if (!sampleRoot) return binding.value;
        const filled = String(binding.value).replace(/\{\{\s*([^}]+?)\s*\}\}/g, (full, expr) => {
            const v = walkPath(expr.trim(), sampleRoot);
            if (v === undefined) return full;
            return previewValue(v, 24);
        });
        return previewValue(filled, 60);
    }
    if (binding.kind === 'expr') {
        if (!binding.value) return null;
        return `expr: ${binding.value}`;
    }
    return null;
}
