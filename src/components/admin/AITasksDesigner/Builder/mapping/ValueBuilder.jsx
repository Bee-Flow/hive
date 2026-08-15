import { FunctionSquare, List, Plus, Repeat, Tag, Workflow, X, Zap } from 'lucide-react';
import React, { useMemo, useRef, useState } from 'react';
import BindingField from './BindingField';
import previewBinding from './bindingPreview';
import { onBindingDragOver, getBindingDropPath } from './bindingDnd';
import ListPickChooser from './ListPickChooser';
import { pathListShape } from './listShape';
import useVariablePicker from './useVariablePicker';
import { buildValue, describeDataPath, parseValue, VALUE_TRANSFORMS } from './valueParts';
import VariablePicker from './VariablePicker';
import { useVariablePickerContext } from './VariablePickerContext';
import { useTranslation } from '../../../../../hooks/useTranslation';
import { controlSurfaceClass, denseInputClass, listBadgeClass, AMBER_NOTE } from '../flow/settings/formStyles';

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
    // 'list' | 'scalar' | 'unknown' — what the parameter's schema wants
    // (listShape.expectedShapeFor). The chooser gate is POSITIVE: it opens
    // only for 'scalar', so schema-less surfaces (App Studio, custom rows,
    // Set fields) behave exactly as before.
    expectShape = 'unknown',
    // (forEach|null) => void — offered as "run this step once per row".
    // Absent (or the step is in list mode): the choice is simply not shown.
    onRequestForEach = null,
}) {
    const { t } = useTranslation();
    const pickerCtx = useVariablePickerContext();
    const picker = useVariablePicker();
    const [rawOpen, setRawOpen] = useState(false);
    // Which part the open picker will write into (-1 = append a new one).
    const pickTarget = useRef(-1);
    // The list chooser: a pick that resolved to a list, awaiting the user's
    // answer. { path, shape, anchorEl, index } | null.
    const [listPick, setListPick] = useState(null);
    // What to restore if the user presses Undo after a foreach choice.
    const undoRef = useRef(null);
    const [foreachNote, setForeachNote] = useState(null); // { runs } | null

    const parsed = useMemo(() => parseValue(value), [value]);
    const sampleRoot = previewSample ?? pickerCtx.previewSample;
    const example = previewBinding(value, sampleRoot, { raw: false });

    const parts = parsed.parts;
    const emit = (nextParts, nextTransform = parsed.transform, nextArg = parsed.transformArg) => {
        // A transform belongs to a single picked value; joining parts drops it
        // (the control that sets it is hidden in that shape anyway).
        const dataCount = nextParts.filter(p => p.type === 'data').length;
        const keep = dataCount === 1 && nextParts.length === 1 ? nextTransform : null;
        onChange?.(buildValue(nextParts, keep, keep ? nextArg : null));
    };

    const openPicker = (el, index) => { pickTarget.current = index; picker.openPicker(el); };
    // The pick pipeline. `opts.raw` (Alt held, or "insert it as it is") skips
    // the chooser; everything 'unknown' skips it too — the gate is positive.
    const proposePick = (path, anchorEl, opts = {}) => {
        const clean = String(path || '').trim();
        if (!clean) return;
        const index = pickTarget.current;
        pickTarget.current = -1;
        const shape = !opts.raw && expectShape === 'scalar' ? pathListShape(clean, sampleRoot) : null;
        if (shape) {
            setListPick({ path: clean, shape, anchorEl: anchorEl || null, index });
            return;
        }
        insertPath(clean, index);
    };
    const insertPath = (path, index) => {
        const next = [...parts];
        if (index >= 0 && next[index]) next[index] = { type: 'data', path };
        else next.push({ type: 'data', path });
        emit(next);
    };
    const onPick = (path, opts = {}) => {
        const anchor = picker.pickerProps?.anchorEl || null;
        picker.closePicker();
        proposePick(path, anchor, opts);
    };

    const onListChoice = (choice) => {
        const pick = listPick;
        setListPick(null);
        if (!pick || !choice) return;
        if (choice.mode === 'foreach' && onRequestForEach) {
            undoRef.current = { value, forEach: null };
            onRequestForEach(choice.forEach);
            onChange?.(choice.binding);
            const runs = pick.shape.rows ?? pick.shape.count;
            setForeachNote({ runs });
            return;
        }
        // first/last/join/count/each — a plain binding, emitted verbatim.
        onChange?.(choice.binding);
    };
    const undoForeach = () => {
        const undo = undoRef.current;
        undoRef.current = null;
        setForeachNote(null);
        if (!undo) return;
        onRequestForEach?.(null);
        onChange?.(undo.value ?? { kind: 'literal', value: '' });
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
    // The handle carries `opts` so an Alt-click in the Input tree bypasses the
    // list chooser ({ raw: true }).
    const broadcast = () => onFocusField?.({
        id: label || 'value',
        label: label || 'value',
        insert: (path, opts) => { pickTarget.current = -1; proposePick(path, null, opts); },
    });
    const onDrop = (e) => {
        const path = getBindingDropPath(e);
        if (!path) return;
        pickTarget.current = -1;
        proposePick(path, e.currentTarget, { raw: e.altKey });
    };

    const pickerNode = (
        <>
            <VariablePicker
                {...picker.pickerProps}
                groups={pickerCtx.groups}
                previewSample={sampleRoot}
                onPick={onPick}
                title={label ? `Pick data for ${label}` : 'Pick data from a step'}
            />
            <ListPickChooser
                open={!!listPick}
                anchorEl={listPick?.anchorEl}
                path={listPick?.path}
                shape={listPick?.shape}
                sampleRoot={sampleRoot}
                stepLabelById={pickerCtx.stepLabelById}
                expectShape={expectShape}
                allowForEach={!!onRequestForEach}
                fieldLabel={label}
                onChoose={onListChoice}
                onCancel={() => setListPick(null)}
            />
        </>
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
                    transform={showTransform ? parsed.transform : null}
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

            {showTransform && (() => {
                // A list-resolving pick reads "Use it as:" and sorts the list
                // choices first — `for` orders and annotates, it NEVER removes
                // an entry (sample data is often missing or wrong).
                const pickedShape = pathListShape(dataParts[0]?.path, sampleRoot);
                const ordered = pickedShape
                    ? [...VALUE_TRANSFORMS].sort((a, b) => (a.for === 'list' ? 0 : 1) - (b.for === 'list' ? 0 : 1))
                    : VALUE_TRANSFORMS;
                return (
                    <label className="flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)] flex-wrap">
                        {pickedShape
                            ? t('routines.builder.use_it_as', 'Use it as:')
                            : 'Adjust it:'}
                        <select
                            aria-label="Adjust the value"
                            value={parsed.transform || ''}
                            onChange={(e) => emit(parts, e.target.value || null, parsed.transformArg)}
                            className={controlSurfaceClass('px-1.5 py-0.5 text-[11px]')}
                        >
                            <option value="">use it as it is</option>
                            {ordered.map(tr => (
                                <option key={tr.id} value={tr.id} title={tr.hint}>{tr.label}</option>
                            ))}
                        </select>
                        {parsed.transform === 'join' && (
                            <span className="flex items-center gap-1">
                                {t('routines.builder.separated_by', 'Separated by')}
                                <select
                                    aria-label={t('routines.builder.separated_by', 'Separated by')}
                                    value={JOIN_SEPARATORS.some(s => s.value === (parsed.transformArg ?? ', ')) ? (parsed.transformArg ?? ', ') : '__other__'}
                                    onChange={(e) => { if (e.target.value !== '__other__') emit(parts, 'join', e.target.value); }}
                                    className={controlSurfaceClass('px-1.5 py-0.5 text-[11px]')}
                                >
                                    {JOIN_SEPARATORS.map(s => (
                                        <option key={s.label} value={s.value}>{s.label}</option>
                                    ))}
                                    {!JOIN_SEPARATORS.some(s => s.value === (parsed.transformArg ?? ', ')) && (
                                        <option value="__other__">{JSON.stringify(parsed.transformArg)}</option>
                                    )}
                                </select>
                            </span>
                        )}
                        {pickedShape && !parsed.transform && (
                            <span className={listBadgeClass()} title={pickedShape.explainEn}>
                                {pickedShape.count != null ? `${t('routines.builder.list_word', 'list')} · ${pickedShape.count}` : t('routines.builder.list_word', 'list')}
                            </span>
                        )}
                    </label>
                );
            })()}

            {foreachNote && (
                <div className={`${AMBER_NOTE} flex items-center gap-2`}>
                    {t('routines.builder.foreach_set_note', 'This step now runs once per row — {n} runs.', { n: foreachNote.runs ?? '?' })}
                    <button type="button" onClick={undoForeach} className="underline hover:no-underline">
                        {t('routines.builder.undo', 'Undo')}
                    </button>
                </div>
            )}

            {example != null && <ExampleLine value={example} />}
            {pickerNode}
        </div>
    );
}

// The separators the inline join editor offers — same wording as the chooser.
const JOIN_SEPARATORS = [
    { value: ', ', label: 'a comma and a space' },
    { value: ',', label: 'a comma' },
    { value: '; ', label: 'a semicolon' },
    { value: ' ', label: 'a space' },
    { value: '\n', label: 'a new line' },
];

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

// What a transformed chip says after its name — the chip itself is the only
// place the eye lands, so the transform must be visible ON it, not only in
// the dropdown below.
const TRANSFORM_SUFFIX = {
    join: '· joined',
    first: '· first of the list',
    last: '· last of the list',
    count: '· how many',
};

function DataPart({ path, stepLabelById, onChange, onRemove, jsonPath = null, transform = null }) {
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
                {TRANSFORM_SUFFIX[transform] && (
                    <span className="opacity-70 truncate">{TRANSFORM_SUFFIX[transform]}</span>
                )}
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
