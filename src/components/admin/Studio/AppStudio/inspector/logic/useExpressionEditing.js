import { parseExpr, tryEvaluate } from '@shared/expr/engine.mjs';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
    getAutocompleteToken, insertAtCursor, previewValue, replaceRange,
} from '../../../../../../utils/bindingHelpers';
import { onBindingDragOver, getBindingDropPath } from '../../../../AITasksDesigner/Builder/mapping/bindingDnd';
import useVariablePicker from '../../../../AITasksDesigner/Builder/mapping/useVariablePicker';
import { useVariablePickerContext } from '../../../../AITasksDesigner/Builder/mapping/VariablePickerContext';
import { parseExprToRows } from '../../../../AITasksDesigner/Builder/utils/conditionModel';

/**
 * The behaviour behind every App Studio expression field, with no JSX.
 *
 * Two presentations need all of this and share none of their layout: the block
 * editor (a textarea with a result line under it) and the inline one (a
 * single-line input inside a filter row, where there is no vertical space for
 * anything). Keeping the behaviour here is what stops them drifting the way
 * FormulaField and the filter row's bare <input> did — same job, one with a
 * picker, live validation and a preview, the other with nothing.
 *
 * What it owns:
 *   - the variable picker (shared with the routine builder), opened from a
 *     button OR by typing a rooted prefix;
 *   - accepting a path dropped from that picker's leaves;
 *   - live parse + evaluation against the preview sample, through the SAME
 *     engine the runtime uses, so the preview can never disagree with the app.
 *
 * `value` is always the raw expression STRING. Callers holding a
 * `{kind:'formula', expr}` unwrap on the way in and re-wrap on the way out —
 * this hook never sees the envelope.
 */
export default function useExpressionEditing({
    value,
    onChange,
    previewSample = null,
    roots = null,
    disabled = false,
} = {}) {
    const fieldRef = useRef(null);
    const picker = useVariablePicker();
    const pickerCtx = useVariablePickerContext();
    const sample = previewSample ?? pickerCtx.previewSample;

    // The typed characters an accepted suggestion should swallow. Set when
    // autocomplete opened the picker; null when the {} button did, in which
    // case a pick INSERTS at the caret instead of replacing.
    const pendingToken = useRef(null);

    const emit = useCallback((next) => {
        if (next != null) onChange?.(next);
    }, [onChange]);

    /** Put `path` where the caret was, or over the partial token being typed. */
    const insertPath = useCallback((path) => {
        const el = fieldRef.current;
        if (!el) return;
        const token = pendingToken.current;
        pendingToken.current = null;
        const next = token
            ? replaceRange(el, token.start, token.end, path)
            : insertAtCursor(el, path);
        emit(next);
    }, [emit]);

    const openPicker = useCallback((anchor) => {
        pendingToken.current = null;
        picker.openPicker(anchor);
    }, [picker]);

    /**
     * After every keystroke, decide whether the caret sits inside a partial
     * rooted path. `roots` comes from the server catalog, so what completes is
     * what the engine actually accepts.
     */
    const handleInput = useCallback((e) => {
        emit(e.target.value);
        if (disabled) return;
        const hit = getAutocompleteToken(e.target, 'expression', roots || undefined);
        if (!hit) {
            pendingToken.current = null;
            if (picker.open) picker.closePicker();
            return;
        }
        pendingToken.current = hit;
        picker.openPicker(e.target, { initialQuery: hit.query });
    }, [emit, disabled, roots, picker]);

    const handleDragOver = onBindingDragOver;

    const handleDrop = useCallback((e) => {
        const path = getBindingDropPath(e);
        if (!path) return;
        pendingToken.current = null;
        emit(insertAtCursor(fieldRef.current, path));
    }, [emit]);

    const closePicker = useCallback(() => {
        pendingToken.current = null;
        picker.closePicker();
    }, [picker]);

    /**
     * Parse first, evaluate second — a parse error is the author's mistake and
     * names itself; an eval error is usually just "the sample has no value
     * there yet", which is not worth shouting about but is worth showing.
     */
    const evalInfo = useMemo(() => {
        const src = String(value ?? '').trim();
        if (!src) return { error: null, preview: null };
        try { parseExpr(src); } catch (e) {
            return { error: e?.message || 'Invalid expression', preview: null };
        }
        const r = tryEvaluate(src, sample || {});
        if (r.error) return { error: r.error, preview: null };
        return { error: null, preview: previewValue(r.value, 60) };
    }, [value, sample]);

    return {
        fieldRef,
        picker,
        pickerProps: picker.pickerProps,
        groups: pickerCtx.groups,
        sample,
        evalInfo,
        openPicker,
        closePicker,
        insertPath,
        handleInput,
        handleDragOver,
        handleDrop,
    };
}

/**
 * A tiny state helper the two presentations share: whether the field is
 * currently showing the clickable condition builder instead of the raw
 * expression. Kept out of the hook above so a caller that never offers the
 * builder (an inline filter row) pays nothing for it.
 *
 * `initial` may be a function, evaluated once on mount (React's lazy
 * useState) — deciding the opening mode means parsing the expression, and
 * that must not run on every keystroke, nor flip the mode out from under
 * somebody mid-edit.
 */
export function useConditionToggle(initial = false) {
    const [asCondition, setAsCondition] = useState(initial);
    return { asCondition, setAsCondition };
}

/**
 * Can the clickable builder hold this expression?
 *
 * `parseExprToRows` is the same predicate ConditionBuilder uses to decide
 * whether to drop into its own raw textarea, so asking it here means the two
 * never disagree: a field that opens in the builder is one the builder can
 * actually render.
 *
 * Empty counts as yes — an unset "Only show when" should open on
 * [field][is][value], which is the whole question being asked. A bare
 * `true`/`false` counts as yes too, for the same reason ConditionBuilder
 * treats it as trivial: it is "not configured yet", not a real condition.
 */
export function conditionCanHold(expr) {
    const src = String(expr ?? '').trim();
    if (!src) return true;
    if (/^(true|false)$/.test(src)) return true;
    try { return !!parseExprToRows(src); } catch { return false; }
}
