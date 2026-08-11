import { Braces, Check, List } from 'lucide-react';
import { onBindingDragOver, getBindingDropPath } from './bindingDnd';
import React, { useEffect, useRef, useState } from 'react';
import RefTokenInput from './RefTokenInput';
import useVariablePicker from './useVariablePicker';
import VariablePicker from './VariablePicker';
import { useVariablePickerContext } from './VariablePickerContext';
import { walkPath, previewValue, getAutocompleteTokenFromPrefix } from '../../../../../utils/bindingHelpers';
import { humanizeExpression } from '../flow/displayHelpers';
import FieldHint from '../flow/FieldHint';
import { useTranslation } from '../../../../../hooks/useTranslation';
import { denseInputClass } from '../flow/settings/formStyles';

/**
 * PathField — the mapping-aware control for configs that store a PLAIN
 * PATH STRING (not a binding object): datetime `input`/`input2`, the
 * collection ops' `arrayRef`, loop `overRef`. A sibling of BindingField
 * that shares the same primitives (RefChips overlay, VariablePicker,
 * drag-drop, focus-broadcast) but with replace-whole-value semantics —
 * a path field holds exactly one path, so picking/dropping REPLACES
 * instead of splicing at the caret.
 *
 * Never normalizes the stored value on mount and never blocks typing —
 * saved automations with odd paths must render byte-identical.
 *
 * Props:
 *   value, onChange(nextPath)    — controlled plain string
 *   expectArray                  — amber soft-warning when the sample at the
 *                                  path isn't a list
 *   allowLiteral='date'          — a fixed parseable date is valid input
 *                                  (suppresses the "no sample" warning)
 *   quickPicks=[{path, sample}]  — inline suggestion list (e.g. upstream arrays)
 *   quickPicksLabel              — heading above them. Defaults to the array
 *                                  wording, which is wrong for any caller
 *                                  whose picks are not lists (the guard step
 *                                  offers scannable TEXT, not arrays).
 *   onFocusField, previewSample  — same contracts as BindingField
 */
export default function PathField({
    value = '',
    onChange,
    label,
    hint = null,
    required = false,
    placeholder = 'steps.step1.output.items',
    expectArray = false,
    allowLiteral = null,
    quickPicks = null,
    quickPicksLabel = null,
    onFocusField,
    previewSample = null,
}) {
    const { t } = useTranslation();
    const [text, setText] = useState(String(value ?? ''));
    const inputRef = useRef(null);
    const picker = useVariablePicker();
    const pickerCtx = useVariablePickerContext();
    const effectivePreviewSample = previewSample ?? pickerCtx.previewSample;
    const stepLabelById = pickerCtx.stepLabelById;

    // Sync from outside (AI patch / undo / load).
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setText(String(value ?? ''));
    }, [value]);

    const emit = (next) => {
        setText(next);
        onChange?.(next);
    };

    const replaceWith = (path) => {
        const cleaned = String(path || '').trim();
        if (!cleaned) return;
        emit(cleaned);
    };

    const broadcast = () => {
        if (!onFocusField) return;
        onFocusField({
            id: label || placeholder || 'path',
            label: label || placeholder || 'path',
            insert: (path) => replaceWith(path),
        });
    };

    const onFocus = () => { broadcast(); };

    const onDragOver = onBindingDragOver;
    const onDrop = (e) => {
        const path = getBindingDropPath(e);
        if (!path) return;
        replaceWith(path);
    };

    const pickFromPicker = (path) => {
        replaceWith(path);
        picker.closePicker();
    };

    // ── Footer: sample preview + soft warnings (never block typing) ──
    const trimmed = text.trim();
    let footer = null;
    if (trimmed) {
        const resolved = effectivePreviewSample ? walkPath(trimmed, effectivePreviewSample) : undefined;
        if (resolved !== undefined) {
            if (expectArray && !Array.isArray(resolved)) {
                footer = { tone: 'warn', text: t('routines.builder.path_not_list', "This isn't a list in the sample data — pick a field that holds multiple items.") };
            } else {
                footer = { tone: 'ok', text: previewValue(resolved, 60) };
            }
        } else if (allowLiteral === 'date' && !Number.isNaN(Date.parse(trimmed))) {
            footer = { tone: 'ok', text: t('routines.builder.path_literal_date', 'Fixed date') + `: ${previewValue(trimmed, 40)}` };
        } else if (effectivePreviewSample) {
            footer = { tone: 'warn', text: t('routines.builder.path_no_sample', 'No sample data found at this path — check it after a test run.') };
        }
    }

    const inputClass = denseInputClass('w-full font-mono');

    return (
        <div className="space-y-1">
            {label && (
                <div className="flex items-center gap-1">
                    <label className="text-[11px] font-medium text-[var(--text-secondary)]">{label}</label>
                    {required && <span className="text-red-500 text-[12px] leading-none" title="Required">*</span>}
                    <FieldHint title={label}>{hint}</FieldHint>
                </div>
            )}
            <div className="group flex items-stretch gap-1">
                <div className="flex-1 min-w-0">
                    <RefTokenInput
                        ref={inputRef}
                        value={text}
                        mode="expression"
                        onChange={emit}
                        onInput={() => {
                            // Inline autocomplete: a rooted partial path opens the
                            // picker pre-filtered; picking replaces the whole value
                            // (a path field holds exactly one path).
                            const token = getAutocompleteTokenFromPrefix(inputRef.current?.textBeforeCaret() || '', 'expression');
                            if (token && !picker.open) picker.openPicker(inputRef.current?.element, { initialQuery: token.query });
                        }}
                        onFocus={onFocus}
                        onDragOver={onDragOver}
                        onDrop={onDrop}
                        placeholder={placeholder}
                        ariaLabel={label || placeholder || undefined}
                        stepLabelById={stepLabelById}
                        className={inputClass}
                    />
                </div>
                <button
                    type="button"
                    onClick={(e) => picker.openPicker(e.currentTarget)}
                    title={t('routines.builder.insert_from_step', 'Insert data from a previous step')}
                    aria-label="Insert variable"
                    aria-haspopup="dialog"
                    aria-expanded={picker.open}
                    className="shrink-0 px-2 rounded border border-[var(--border-default)] text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] flex items-center justify-center opacity-60 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity"
                >
                    <Braces size={12} />
                </button>
            </div>
            {footer && (
                <div className={`text-[10px] flex items-center gap-1.5 ${footer.tone === 'warn' ? 'text-amber-500' : 'text-[var(--text-tertiary)]'}`}>
                    <span className="uppercase tracking-wide">{footer.tone === 'warn' ? '!' : t('routines.builder.example', 'example')}</span>
                    <span className={`truncate ${footer.tone === 'warn' ? '' : 'font-mono text-[var(--text-secondary)]'}`}>{footer.text}</span>
                </div>
            )}
            {Array.isArray(quickPicks) && quickPicks.length > 0 && (
                <div className="rounded border border-[var(--border-default)] bg-[var(--bg-secondary)]/40 divide-y divide-[var(--border-default)]">
                    <div className="px-2 py-1 text-[10px] uppercase tracking-wide font-semibold text-[var(--text-tertiary)]">
                        {quickPicksLabel || t('routines.builder.lists_detected', 'Lists found in previous steps')}
                    </div>
                    {quickPicks.map(q => {
                        const selected = trimmed === q.path;
                        const friendly = humanizeExpression(q.path, stepLabelById).replace(/[‹›]/g, '');
                        return (
                            <button
                                key={q.path}
                                type="button"
                                onClick={() => replaceWith(q.path)}
                                title={q.path}
                                className={`w-full flex items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-[var(--bg-secondary)] ${selected ? 'bg-[var(--bg-secondary)]' : ''}`}
                            >
                                <List size={12} className="shrink-0 text-[var(--text-tertiary)]" />
                                <span className="text-[var(--text-primary)] truncate">{friendly}</span>
                                <span className="ml-auto text-[10px] text-[var(--text-tertiary)] truncate max-w-[120px]">{previewValue(q.sample, 24)}</span>
                                {selected && <Check size={12} className="shrink-0 text-[var(--accent)]" />}
                            </button>
                        );
                    })}
                </div>
            )}
            <VariablePicker
                {...picker.pickerProps}
                groups={pickerCtx.groups}
                previewSample={effectivePreviewSample}
                onPick={pickFromPicker}
                title={label ? `Insert into ${label}` : 'Insert variable'}
            />
        </div>
    );
}
