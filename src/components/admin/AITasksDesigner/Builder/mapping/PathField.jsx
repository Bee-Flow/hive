import { Check, List } from 'lucide-react';
import { onBindingDragOver, getBindingDropPath } from './bindingDnd';
import InsertDataButton from './InsertDataButton';
import React, { useEffect, useRef, useState } from 'react';
import RefTokenInput from './RefTokenInput';
import useVariablePicker from './useVariablePicker';
import VariablePicker from './VariablePicker';
import { useVariablePickerContext } from './VariablePickerContext';
import { walkPath, previewValue, getAutocompleteTokenFromPrefix } from '../../../../../utils/bindingHelpers';
import { humanizeExpression } from '../flow/displayHelpers';
import FieldHint from '../flow/FieldHint';
import { useTranslation } from '../../../../../hooks/useTranslation';
import { describeListPath } from './listShape';
import { denseInputClass, AMBER_NOTE } from '../flow/settings/formStyles';

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
    // ONE footer line, merged — a second slot would stack two bands for one
    // fact. The display never normalises the stored value.
    const trimmed = text.trim();
    let footer = null;
    if (trimmed) {
        const resolved = effectivePreviewSample ? walkPath(trimmed, effectivePreviewSample) : undefined;
        if (resolved !== undefined) {
            if (expectArray && trimmed.includes('[*]')) {
                // A [*] column IS a list, so the not-a-list warning misses the
                // real trap: repeating over a column merges every row's values
                // into one flat list. Say that, with the resolved example on
                // the same line.
                footer = {
                    tone: 'warn',
                    text: `${t('routines.builder.path_column_merges', 'This path takes one value from every row and merges them into one list.')} — ${previewValue(resolved, 40)}`,
                };
            } else if (expectArray && !Array.isArray(resolved)) {
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
                <InsertDataButton
                    onClick={(e) => picker.openPicker(e.currentTarget)}
                    open={picker.open}
                />
            </div>
            {footer && (
                <div className={`flex items-center gap-1.5 ${footer.tone === 'warn' ? AMBER_NOTE : 'text-[10px] text-[var(--text-tertiary)]'}`}>
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
                        // Column paths read as "step ▸ Field (inside each row)"
                        // and count via walkPath — q.sample for a [*] path is
                        // the first ELEMENT, so its length lied about the list.
                        const friendly = q.path.includes('[*]')
                            ? describeListPath(q.path, stepLabelById, t)
                            : humanizeExpression(q.path, stepLabelById).replace(/[‹›]/g, '');
                        const resolved = effectivePreviewSample ? walkPath(q.path, effectivePreviewSample) : undefined;
                        const preview = Array.isArray(resolved)
                            ? `${resolved.length} item${resolved.length === 1 ? '' : 's'}`
                            : previewValue(resolved !== undefined ? resolved : q.sample, 24);
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
                                <span className="ml-auto text-[10px] text-[var(--text-tertiary)] truncate max-w-[120px]">{preview}</span>
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
