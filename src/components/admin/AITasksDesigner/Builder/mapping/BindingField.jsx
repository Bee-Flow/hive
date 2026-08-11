import { compile as compileExpr } from '@shared/expr/engine.mjs';
import { Braces, ChevronDown, ChevronRight, FunctionSquare, Type } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import previewBinding from './bindingPreview';
import { onBindingDragOver, getBindingDropPath } from './bindingDnd';
import { ExpressionHelpBody } from './ExpressionHelp';
import RefTokenInput from './RefTokenInput';
import useVariablePicker from './useVariablePicker';
import VariablePicker from './VariablePicker';
import { useVariablePickerContext } from './VariablePickerContext';
import { useTranslation } from '../../../../../hooks/useTranslation';
import {
    inputFromBinding,
    bindingFromInput,
    isCleanPath,
    TEMPLATE_RE,
    formatPathForInsert,
    getAutocompleteTokenFromPrefix,
} from '../../../../../utils/bindingHelpers';
import FieldHint from '../flow/FieldHint';
import { denseInputClass, fieldLabelClass, requiredMarkClass, FOCUS_RING, FOCUS_RING_INSET } from '../flow/settings/formStyles';

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
    autoMapped = false,
    // Show the collapsible syntax legend under the field while in expression
    // mode. On by default — a standalone node parameter is exactly where users
    // need it. ConditionBuilder turns it off for its inline row slots: those
    // are a path picker and a value slot, and that component already carries
    // its own syntax help for raw-expression mode.
    showExpressionHelp = true,
}) {
    const seed = inputFromBinding(value);
    const [mode, setMode] = useState(seed.mode);
    const [text, setText] = useState(seed.text);
    const [focused, setFocused] = useState(false);
    const [helpOpen, setHelpOpen] = useState(false);
    const inputRef = useRef(null);
    const { t } = useTranslation();
    const picker = useVariablePicker();
    const pickerCtx = useVariablePickerContext();
    const effectivePreviewSample = previewSample ?? pickerCtx.previewSample;
    const pickerGroups = pickerCtx.groups;
    const stepLabelById = pickerCtx.stepLabelById;

    // The last binding WE emitted. The parent echoes our own value back as a
    // fresh object, and an EMPTY expression round-trips as
    // `{kind:'literal', value:''}` (bindingFromInput has no way to express
    // "expression mode, nothing typed yet"), which the sync effect below then
    // read back as fixed mode. Net effect: clearing an expression field, or any
    // parent re-render while it was empty, silently kicked the user back to
    // plain text (BFSF-321). Skipping the echo keeps the mode the user chose.
    //
    // Fixing this in `bindingFromInput` instead is tempting but wrong: emitting
    // `{kind:'expr', value:''}` would make the runtime's `evaluate('')` throw
    // (see server/automation/bind.js resolveValue).
    const lastEmittedRef = useRef(null);

    // Sync from outside (AI patch / undo / load). Intentional setState
    // from useEffect — we're syncing local UI state with the controlled
    // `value` prop.
    useEffect(() => {
        if (lastEmittedRef.current !== null && deepEqualBinding(value, lastEmittedRef.current)) return;
        lastEmittedRef.current = null;
        const s = inputFromBinding(value);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setMode(s.mode);
        setText(s.text);
    }, [value]);

    const emit = (nextText, nextMode) => {
        setText(nextText);
        const next = bindingFromInput(nextText, nextMode);
        lastEmittedRef.current = next;
        onChange?.(next);
    };

    // Inline autocomplete (expression mode): typing a rooted partial path
    // (`steps.`, `trigger.`, `item.` …) opens the picker pre-filtered; accepting
    // swallows the characters just typed and drops a pill in their place. The
    // LENGTH is recorded rather than a range — focus moves to the picker's
    // search box, so the caret can't be trusted at pick time.
    const autocompleteLength = useRef(0);
    const onEditorInput = () => {
        // Autocomplete in BOTH modes. Fixed mode had none at all — it returned
        // early here — even though `{{…}}` templates are exactly where most
        // users reference upstream data, and TemplateField already did this
        // (BFSF-321). The token rules differ per mode: `{{` opens it in fixed
        // mode, a rooted or root-prefix partial in expression mode.
        const token = getAutocompleteTokenFromPrefix(inputRef.current?.textBeforeCaret() || '', mode);
        if (token) {
            autocompleteLength.current = token.length;
            if (!picker.open) picker.openPicker(inputRef.current?.element, { initialQuery: token.query });
        }
    };

    const toggleMode = () => {
        const next = mode === 'fixed' ? 'expression' : 'fixed';
        setMode(next);
        // Re-emit with the new mode so the binding kind updates — TRANSLATING
        // the text where the two modes spell the same thing differently. A
        // straight re-emit meant flipping `{{steps.x.output.total}}` to
        // expression mode produced "Unexpected character in expression: {",
        // and flipping a bare path back to text silently turned the reference
        // into the literal string "steps.x.output.total" — a value that runs
        // green and is wrong. Only the unambiguous single-reference case is
        // translated; anything else is left exactly as typed.
        emit(translateForMode(text, next), next);
        inputRef.current?.focus();
    };

    const insertPath = (path) => {
        const snippet = formatPathForInsert(path, mode);
        if (snippet) inputRef.current?.insertSnippet(snippet);
    };

    // Expose an `insert(path)` method to the parent via the focus
    // callback. We re-broadcast every time text/mode changes so the
    // captured handle always closes over the latest state.
    const broadcast = () => {
        if (!onFocusField) return;
        onFocusField({
            id: label || placeholder || 'field',
            label: label || placeholder || 'field',
            insert: insertPath,
        });
    };

    const onFocus = () => { setFocused(true); broadcast(); };
    const onBlurDelayed = () => {
        // Don't drop the focused-field handle immediately — clicks on the
        // VariableTree blur the input first. Parent's own click handlers
        // will null it out when needed. Defer the focused flag flip so
        // VariableTree click-to-insert still lands (preview is cosmetic).
        setTimeout(() => setFocused(false), 150);
    };

    // Drag-drop a path from the VariableTree onto the field.
    const onDragOver = onBindingDragOver;
    const onDrop = (e) => {
        const path = getBindingDropPath(e);
        if (path) insertPath(path);
    };

    const binding = bindingFromInput(text, mode);
    const preview = previewBinding(binding, effectivePreviewSample);

    // Parse-check the expression as the user types, using the client-side
    // mirror of the SERVER's evaluator (agent-hub/src/shared/expr — kept
    // byte-identical by sharedExpr.sync.test.js). Anything this rejects the
    // server rejects too, so the user finds out here instead of at save time.
    // Advisory only: a half-typed expression is normal, hence amber not red.
    const exprError = useMemo(() => {
        if (mode !== 'expression') return null;
        const src = String(text || '').trim();
        if (!src) return null;
        try { compileExpr(src); return null; }
        catch (e) { return `${t('routines.builder.expr_invalid', 'Not valid yet')} — ${e.message}`; }
    }, [mode, text, t]);

    const insertFromPicker = (path) => {
        const snippet = formatPathForInsert(path, mode);
        const swallow = autocompleteLength.current;
        autocompleteLength.current = 0;
        if (snippet) {
            if (swallow) inputRef.current?.replacePartial(swallow, snippet);
            else inputRef.current?.insertSnippet(snippet);
        }
        picker.closePicker();
    };

    const inputClass = denseInputClass(`w-full ${mode === 'expression' ? 'font-mono' : ''}`);

    return (
        <div className="space-y-1">
            {label && (
                <div className="flex items-center gap-1">
                    <label className={fieldLabelClass()}>{label}</label>
                    {required && <span className={requiredMarkClass()} title="Required">*</span>}
                    <FieldHint title={label}>{hint}</FieldHint>
                    {autoMapped && (
                        <span
                            className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--accent)]/15 text-[var(--accent)] uppercase tracking-wide"
                            title="Auto-mapped from an upstream step — edit to override"
                        >
                            auto
                        </span>
                    )}
                </div>
            )}
            <div className="group flex items-stretch gap-1">
                <div className="flex-1 min-w-0">
                    <RefTokenInput
                        ref={inputRef}
                        value={text}
                        mode={mode}
                        multiline={multiline}
                        rows={3}
                        onChange={(next) => emit(next, mode)}
                        onInput={onEditorInput}
                        onFocus={onFocus}
                        onBlur={onBlurDelayed}
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
                    onClick={(e) => { autocompleteLength.current = 0; picker.openPicker(e.currentTarget); }}
                    title={t('routines.builder.insert_from_step', 'Insert data from a previous step')}
                    aria-label="Insert variable"
                    aria-haspopup="dialog"
                    aria-expanded={picker.open}
                    className={`shrink-0 px-2 rounded border border-[var(--border-default)] text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] flex items-center justify-center opacity-60 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity ${FOCUS_RING}`}
                >
                    <Braces size={12} />
                </button>
                {/* Mode toggle — a two-segment switch that is ALWAYS present and
                    always shows both options with the current one selected.
                    The previous design had two independent state variables
                    (`mode` and a `showAdvanced` revealed by a "⋯" button)
                    fighting each other: clicking "⋯" added a third button,
                    clicking that one removed two, and nothing ever reset
                    `showAdvanced`. Controls appearing and disappearing read as a
                    rendering bug rather than a mode switch (BFSF-321). */}
                <div
                    role="group"
                    aria-label={t('routines.builder.mode_group', 'Value mode')}
                    className="shrink-0 flex items-center rounded border border-[var(--border-default)] overflow-hidden"
                >
                    <button
                        type="button"
                        onClick={() => { if (mode !== 'fixed') toggleMode(); }}
                        aria-pressed={mode === 'fixed'}
                        title={t('routines.builder.mode_text', 'Plain text — type a value. Use {{ }} to insert data from a previous step.')}
                        className={`px-1.5 py-0.5 text-[11px] flex items-center justify-center transition-colors ${FOCUS_RING_INSET}
                            ${mode === 'fixed'
                                ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
                                : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]'}`}
                    >
                        <Type size={12} />
                    </button>
                    <button
                        type="button"
                        onClick={() => { if (mode !== 'expression') toggleMode(); }}
                        aria-pressed={mode === 'expression'}
                        title={t('routines.builder.mode_expression', 'Expression — compute the value, e.g. steps.s1.output.total > 100')}
                        className={`px-1.5 py-0.5 text-[11px] font-mono border-l border-[var(--border-default)] flex items-center justify-center transition-colors ${FOCUS_RING_INSET}
                            ${mode === 'expression'
                                ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
                                : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]'}`}
                    >
                        <FunctionSquare size={12} />
                    </button>
                </div>
            </div>

            {/* In expression mode the field accepts a restricted grammar most
                users have never seen. Offer the legend inline rather than
                leaving them to guess what is allowed. */}
            {mode === 'expression' && showExpressionHelp && (
                <div className="space-y-1">
                    {exprError && (
                        <div className="text-[10px] text-amber-600 dark:text-amber-400">
                            {exprError}
                        </div>
                    )}
                    <button
                        type="button"
                        onClick={() => setHelpOpen(o => !o)}
                        aria-expanded={helpOpen}
                        className="flex items-center gap-1 text-[10px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                    >
                        {helpOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />} {t('routines.builder.syntax_help', 'Syntax help')}
                    </button>
                    {helpOpen && <ExpressionHelpBody />}
                </div>
            )}
            {preview != null && (focused || binding.kind !== 'literal') && (
                <div className="text-[10px] text-[var(--text-tertiary)] flex items-center gap-1.5">
                    <span className="uppercase tracking-wide">example</span>
                    <span className="font-mono text-[var(--text-secondary)] truncate">{preview}</span>
                </div>
            )}
            <VariablePicker
                {...picker.pickerProps}
                groups={pickerGroups}
                previewSample={effectivePreviewSample}
                onPick={insertFromPicker}
                title={label ? `Insert into ${label}` : 'Insert variable'}
            />
        </div>
    );
}

/**
 * Rewrite the field text when the user flips the mode switch, for the one
 * shape both modes can express: a single reference.
 *   text  -> expression:  `{{ steps.a.output.x }}`  ->  `steps.a.output.x`
 *   expression -> text:   `steps.a.output.x`        ->  `{{steps.a.output.x}}`
 * Everything else (mixed templates, computed expressions) is returned as-is.
 */
export function translateForMode(text, nextMode) {
    const s = String(text ?? '');
    if (nextMode === 'expression') {
        const m = /^\s*\{\{\s*([^}]+?)\s*\}\}\s*$/.exec(s);
        return m ? m[1] : s;
    }
    const bare = s.trim();
    if (!bare || TEMPLATE_RE.test(s)) return s;
    const root = bare.split(/[.[]/)[0];
    return isCleanPath(bare) && WRAPPABLE_ROOTS.has(root) ? `{{${bare}}}` : s;
}

// Roots whose values a `{{ }}` interpolation can reach at run time. `item` and
// `_index` are the per-row scope of a list-mode Edit data step.
const WRAPPABLE_ROOTS = new Set(['trigger', 'steps', 'vars', 'secrets', 'loop', 'item', '_index']);

/**
 * Structural equality for two binding objects. Used to recognise the parent
 * echoing back the value this field just emitted, so the sync effect doesn't
 * clobber the user's chosen mode (see `lastEmittedRef`). Bindings are small,
 * JSON-shaped, and key order is fixed by `bindingFromInput`, so a stringify
 * comparison is both correct and cheap here.
 */
function deepEqualBinding(a, b) {
    if (a === b) return true;
    try { return JSON.stringify(a) === JSON.stringify(b); }
    catch { return false; }
}

