import { FunctionSquare, List, Plus, Repeat, Tag, Workflow, X, Zap } from 'lucide-react';
import React, { useMemo, useRef, useState } from 'react';
import BindingField from './BindingField';
import previewBinding from './bindingPreview';
import { onBindingDragOver, getBindingDropPath } from './bindingDnd';
import useVariablePicker from './useVariablePicker';
import { buildValue, describeDataPath, parseValue, VALUE_TRANSFORMS } from './valueParts';
import VariablePicker from './VariablePicker';
import { useVariablePickerContext } from './VariablePickerContext';
import { controlSurfaceClass, denseInputClass } from '../flow/settings/formStyles';

/**
 * VISUAL value editor — the plain-language alternative to BindingField.
 *
 * BindingField is a text box over the raw binding: to reference an earlier
 * step you type (or drop) `{{steps.act_4d4307a.output.total}}`, and to change
 * that value you type `lower(...)` in a second, differently-behaving mode. Both
 * halves show the user an internal step id and a small language nobody
 * announced. This editor shows the same binding as things you can point at:
 *
 *   [gmail search ▸ Total ✕]  adjust: (lowercase ▾)
 *   [Order #][gmail search ▸ Id ✕]           ← several parts = joined text
 *
 * Everything it writes is an ordinary binding (see valueParts.js) — a ref, a
 * literal, a `{{ }}` template, or a one-call expression — so the AI builder,
 * the validator and the runtime see nothing new, and a value built here can
 * still be opened in the raw editor.
 *
 * Values it cannot represent (hand-written expressions) are never rewritten:
 * they render read-only with the step NAMES resolved, plus a way into the raw
 * editor. `allowRaw` (the inspector's full density) decides whether that
 * escape is offered up front.
 */
export default function ValueBuilder({
    value,
    onChange,
    placeholder = 'Type a value…',
    previewSample = null,
    onFocusField = null,
    allowRaw = true,
    label = null,
}) {
    const pickerCtx = useVariablePickerContext();
    const picker = useVariablePicker();
    const [rawOpen, setRawOpen] = useState(false);
    // Which part the open picker will write into (-1 = append a new one).
    const pickTarget = useRef(-1);

    const parsed = useMemo(() => parseValue(value), [value]);
    const sampleRoot = previewSample ?? pickerCtx.previewSample;
    const example = previewBinding(value, sampleRoot, { raw: false });

    const parts = parsed.parts;
    const emit = (nextParts, nextTransform = parsed.transform) => {
        // A transform belongs to a single picked value; joining parts drops it
        // (the control that sets it is hidden in that shape anyway).
        const dataCount = nextParts.filter(p => p.type === 'data').length;
        const keep = dataCount === 1 && nextParts.length === 1 ? nextTransform : null;
        onChange?.(buildValue(nextParts, keep));
    };

    const openPicker = (el, index) => { pickTarget.current = index; picker.openPicker(el); };
    const onPick = (path) => {
        const clean = String(path || '').trim();
        picker.closePicker();
        if (!clean) return;
        const index = pickTarget.current;
        pickTarget.current = -1;
        const next = [...parts];
        if (index >= 0 && next[index]) next[index] = { type: 'data', path: clean };
        else next.push({ type: 'data', path: clean });
        emit(next);
    };

    const setText = (index, text) => {
        const next = [...parts];
        if (next[index]) next[index] = { type: 'text', text };
        else next.push({ type: 'text', text });
        emit(next);
    };
    const removeAt = (index) => emit(parts.filter((_, i) => i !== index));
    const addText = () => emit([...parts, { type: 'text', text: '' }]);

    // Click-to-insert / drag-from-the-tree land as a new data part rather than
    // as text spliced at a caret — there is no raw text to splice into here.
    const broadcast = () => onFocusField?.({
        id: label || 'value',
        label: label || 'value',
        insert: (path) => { pickTarget.current = -1; onPick(path); },
    });
    const onDrop = (e) => {
        const path = getBindingDropPath(e);
        if (!path) return;
        pickTarget.current = -1;
        onPick(path);
    };

    const pickerNode = (
        <VariablePicker
            {...picker.pickerProps}
            groups={pickerCtx.groups}
            previewSample={sampleRoot}
            onPick={onPick}
            title={label ? `Pick data for ${label}` : 'Pick data from a step'}
        />
    );

    if (rawOpen) {
        return (
            <div className="space-y-1">
                <BindingField
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder}
                    onFocusField={onFocusField}
                    previewSample={sampleRoot}
                />
                <button
                    type="button"
                    onClick={() => setRawOpen(false)}
                    className="text-[10px] text-[var(--accent)] hover:underline"
                >
                    Back to the simple editor
                </button>
            </div>
        );
    }

    if (!parsed.supported) {
        return (
            <div className="space-y-1">
                <div className="rounded border border-[var(--border-default)] bg-[var(--bg-secondary)]/50 px-2 py-1.5">
                    <div className="text-[10px] uppercase tracking-wide text-[var(--text-tertiary)] mb-0.5">Custom formula</div>
                    <FormulaChips text={parsed.text} stepLabelById={pickerCtx.stepLabelById} />
                </div>
                {example != null && <ExampleLine value={example} />}
                <div className="flex items-center gap-3 text-[10px]">
                    <button type="button" onClick={() => setRawOpen(true)} className="text-[var(--accent)] hover:underline">
                        Edit the formula
                    </button>
                    <button
                        type="button"
                        onClick={() => onChange?.({ kind: 'literal', value: '' })}
                        className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                    >
                        Replace it
                    </button>
                </div>
                {pickerNode}
            </div>
        );
    }

    const dataParts = parts.filter(p => p.type === 'data');
    const showTransform = parts.length === 1 && dataParts.length === 1;
    // A JSON pick is the whole value (see buildValue) — nothing to combine it
    // with, so the add buttons stand down rather than offering a dead end.
    const jsonOnly = parts.length === 1 && parts[0].type === 'json';
    // An empty value still renders ONE text box — as an element of the same
    // list, so typing the first character doesn't swap a single child for an
    // array and remount the input out from under the caret.
    const viewParts = parts.length ? parts : [{ type: 'text', text: '' }];

    return (
        <div className="space-y-1" onDragOver={onBindingDragOver} onDrop={onDrop}>
            {viewParts.map((part, i) => (part.type === 'text' ? (
                <TextPart
                    key={`t${i}`}
                    text={part.text}
                    placeholder={placeholder}
                    onChange={(t) => setText(i, t)}
                    onFocus={broadcast}
                    onRemove={viewParts.length > 1 ? () => removeAt(i) : null}
                />
            ) : (
                <DataPart
                    key={`d${i}`}
                    path={part.path}
                    jsonPath={part.type === 'json' ? part.jsonPath : null}
                    stepLabelById={pickerCtx.stepLabelById}
                    onChange={part.type === 'json' ? null : (e) => openPicker(e.currentTarget, i)}
                    onRemove={() => removeAt(i)}
                />
            )))}

            <div className="flex items-center gap-3 flex-wrap">
                {!jsonOnly && (
                    <button
                        type="button"
                        onClick={(e) => openPicker(e.currentTarget, -1)}
                        className="flex items-center gap-1 text-[11px] text-[var(--accent)] hover:underline"
                    >
                        {/* The first pick is the headline action; once something
                            is bound, picking again APPENDS — so it reads as an add. */}
                        <Workflow size={11} /> {dataParts.length ? 'Add data' : 'Use data from a step'}
                    </button>
                )}
                {dataParts.length > 0 && (
                    <button
                        type="button"
                        onClick={addText}
                        className="flex items-center gap-1 text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    >
                        <Plus size={11} /> Add text
                    </button>
                )}
                {allowRaw && (
                    <button
                        type="button"
                        onClick={() => setRawOpen(true)}
                        title="Write this value as a formula"
                        aria-label="Write this value as a formula"
                        className="ml-auto flex items-center gap-1 text-[10px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                    >
                        <FunctionSquare size={11} /> Formula
                    </button>
                )}
            </div>

            {showTransform && (
                <label className="flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)]">
                    Adjust it:
                    <select
                        aria-label="Adjust the value"
                        value={parsed.transform || ''}
                        onChange={(e) => emit(parts, e.target.value || null)}
                        className={controlSurfaceClass('px-1.5 py-0.5 text-[11px]')}
                    >
                        <option value="">use it as it is</option>
                        {VALUE_TRANSFORMS.map(t => (
                            <option key={t.id} value={t.id} title={t.hint}>{t.label}</option>
                        ))}
                    </select>
                </label>
            )}

            {example != null && <ExampleLine value={example} />}
            {pickerNode}
        </div>
    );
}

function ExampleLine({ value }) {
    return (
        <div className="text-[10px] text-[var(--text-tertiary)] flex items-center gap-1.5">
            <span className="uppercase tracking-wide">example</span>
            <span className="font-mono text-[var(--text-secondary)] truncate">{value}</span>
        </div>
    );
}

function TextPart({ text, placeholder, onChange, onFocus, onRemove = null }) {
    return (
        <div className="flex items-center gap-1">
            <input
                type="text"
                value={text}
                onChange={(e) => onChange(e.target.value)}
                onFocus={onFocus}
                placeholder={placeholder}
                className={denseInputClass('flex-1 min-w-0')}
            />
            {onRemove && (
                <button
                    type="button"
                    onClick={onRemove}
                    aria-label="Remove this text"
                    className="shrink-0 p-1 rounded text-[var(--text-tertiary)] hover:text-red-500 hover:bg-[var(--bg-secondary)]"
                >
                    <X size={12} />
                </button>
            )}
        </div>
    );
}

const SOURCE_ICON = { steps: Workflow, trigger: Zap, loop: Repeat, item: List, vars: Tag };

function DataPart({ path, stepLabelById, onChange, onRemove, jsonPath = null }) {
    const { name, suffix, missing, source } = describeDataPath(path, stepLabelById);
    const Icon = SOURCE_ICON[source] || Workflow;
    return (
        <div className="flex items-center gap-1">
            <span
                title={jsonPath ? `parseJson(${path}, "${jsonPath}")` : path}
                className={`inline-flex items-center gap-1 min-w-0 rounded px-2 py-1 text-[11px] border ${
                    missing
                        ? 'border-dashed border-[var(--border-default)] bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]'
                        : 'border-[var(--accent)]/40 bg-[var(--accent)]/15 text-[var(--accent)]'
                }`}
            >
                <Icon size={11} className="shrink-0 opacity-70" />
                <span className="font-medium truncate">{name}</span>
                {suffix && <span className="opacity-70 truncate">▸ {suffix}</span>}
                {jsonPath != null && (
                    <span className="opacity-70 truncate">· from the JSON{jsonPath ? `: ${jsonPath}` : ''}</span>
                )}
            </span>
            {onChange && (
                <button
                    type="button"
                    onClick={onChange}
                    className="shrink-0 text-[10px] text-[var(--accent)] hover:underline"
                >
                    change
                </button>
            )}
            <button
                type="button"
                onClick={onRemove}
                aria-label="Remove this value"
                className="shrink-0 p-1 rounded text-[var(--text-tertiary)] hover:text-red-500 hover:bg-[var(--bg-secondary)]"
            >
                <X size={12} />
            </button>
        </div>
    );
}

/**
 * Read-only render of a formula with its step references resolved to names.
 * Deliberately NOT RefChips: that component only knows the `steps.`/`trigger.`/
 * `loop.` roots, so a list-mode `item.subject` would come out raw. Here every
 * pickable path goes through describeDataPath.
 */
const FORMULA_PATH = /(?<![A-Za-z0-9_$."'])(?:steps|trigger|loop|vars|item|_index)(?:\.[A-Za-z0-9_$]+|\[[^\]]*\])*/g;

function FormulaChips({ text, stepLabelById }) {
    const source = String(text || '');
    const nodes = [];
    let last = 0;
    let m;
    FORMULA_PATH.lastIndex = 0;
    while ((m = FORMULA_PATH.exec(source))) {
        if (m.index > last) nodes.push({ text: source.slice(last, m.index) });
        nodes.push({ path: m[0] });
        last = m.index + m[0].length;
    }
    if (last < source.length) nodes.push({ text: source.slice(last) });

    return (
        <div className="text-[11px] leading-[1.6] break-words text-[var(--text-primary)]">
            {nodes.map((n, i) => {
                if (n.text != null) return <span key={i} className="font-mono opacity-70">{n.text}</span>;
                const { name, suffix } = describeDataPath(n.path, stepLabelById);
                return (
                    <span
                        key={i}
                        title={n.path}
                        className="inline-flex items-center gap-1 align-middle mx-0.5 rounded px-1.5 py-0.5 border border-[var(--accent)]/40 bg-[var(--accent)]/15 text-[var(--accent)]"
                    >
                        <span className="font-medium">{name}</span>
                        {suffix && <span className="opacity-70">▸ {suffix}</span>}
                    </span>
                );
            })}
        </div>
    );
}
