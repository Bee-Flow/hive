import { Plus, Trash2, Sparkles, Workflow } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import BindingField from './BindingField';
import { onBindingDragOver, getBindingDropPath } from './bindingDnd';
import { partitionInputs, isEmptyBinding } from './partitionInputs';
import useVariablePicker from './useVariablePicker';
import ValueBuilder from './ValueBuilder';
import VariablePicker from './VariablePicker';
import { useVariablePickerContext } from './VariablePickerContext';
import CollapsibleSection from '../flow/CollapsibleSection';
import { useFormMode } from '../flow/settings/formDensity';
import { expectedShapeFor } from './listShape';
import { suggestKeyFromPath } from '../../../../../utils/bindingHelpers';
import { actionButtonClass, cardClass, rowInputClass, subLabelClass } from '../flow/settings/formStyles';

/**
 * Schema-driven inputs editor for a step's `inputs` map.
 *
 * Two modes:
 *   1. Schema-driven — when `inputSchema?.properties` is provided
 *      (sourced from the catalog's per-tool function definition).
 *      Essential fields (required / populated / common) show by default;
 *      the rest collapse behind a "Show N more options" disclosure.
 *   2. Generic key/value rows — when no schema is available (custom
 *      tools, AI step user-defined inputs). User adds rows manually.
 *
 * Both modes emit the same `inputs` object the runtime resolver
 * expects: `{ [key]: bindingObject }`.
 *
 * Auto-mapping: `autoMappedKeys` marks fields filled by the connect-time
 * auto-mapper so a small "auto" pill is shown; `onAutoMap` (when given)
 * renders a one-click wand button to (re)run mapping over empty fields.
 */
export default function ToolInputForm({
    inputs = {},
    onChange,
    inputSchema = null,
    onFocusField,
    previewSample = null,
    allowExtraFields = true,
    autoMappedKeys = [],
    onAutoMap = null,
    // When true, a row whose value is cleared is KEPT (with an empty literal)
    // instead of being deleted. Used by the Set / layer_output editors, where
    // the keys are the user's own named fields — emptying a value must not
    // remove the field. Tool-param editors leave this off so clearing a value
    // omits the param.
    keepEmptyFields = false,
    // Generic rows only. `visualValues` swaps the raw BindingField for the
    // point-and-click ValueBuilder (Edit data), and the two labels name the
    // slots — an unlabelled "field" box next to an unlabelled value box told
    // the user nothing about what either one does.
    visualValues = false,
    nameLabel = null,
    valueLabel = null,
    namePlaceholder = 'field name',
    valuePlaceholder = 'value',
    // Offer the "write it as a formula" escape up front (full density only).
    allowRawValues = true,
    // (forEach|null) => void — lets a list pick offer "run once per row".
    // Threaded per parameter with the schema-derived expectShape; custom rows
    // have no schema, so expectedShapeFor(undefined) === 'unknown' and the
    // chooser never fires there.
    onRequestForEach = null,
}) {
    const properties = inputSchema?.properties || null;
    const required = useMemo(() => new Set(inputSchema?.required || []), [inputSchema]);

    // The advanced-fields disclosure follows the form MODE: switching to All
    // options opens it (on the transition, not at mount), so "show me
    // everything" means everything — not "everything except the fields behind
    // this second click". The user's own toggle still works both ways.
    const formMode = useFormMode();
    const [advFieldsOpen, setAdvFieldsOpen] = useState(false);
    const prevModeRef = useRef(formMode);
    useEffect(() => {
        if (prevModeRef.current === 'simple' && formMode === 'advanced') setAdvFieldsOpen(true);
        prevModeRef.current = formMode;
    }, [formMode]);

    // Locally suppress the "auto" pill once the user edits that field. Resets
    // when the step changes (SettingsForm re-keys this subtree by step.id).
    const [consumed, setConsumed] = useState(() => new Set());
    const isAuto = (key) => autoMappedKeys.includes(key) && !consumed.has(key);

    // Newly-added custom rows are held LOCALLY until they have a name + value.
    // For tool/AI inputs (keepEmptyFields=false) `buildPatch`'s sanitizeInputs
    // strips empty bindings on autosave, so an empty row written straight into
    // `inputs` would flash and vanish on the next save round-trip. Keeping it
    // local until it's non-empty fixes that. (Set / layer_output use
    // keepEmptyFields and persist empty named fields, so they add directly.)
    const [pending, setPending] = useState([]); // [{ id, key, binding }]
    const [focusKey, setFocusKey] = useState(null); // name input to select on mount
    const pidRef = useRef(0);
    const uniqueKey = (base = 'field') => {
        const taken = new Set([...Object.keys(inputs || {}), ...pending.map(p => p.key)]);
        let k = base, n = 1;
        while (taken.has(k)) k = `${base}${++n}`;
        return k;
    };
    const updatePending = (id, patch) => setPending(p => p.map(r => (r.id === id ? { ...r, ...patch } : r)));
    const removePending = (id) => setPending(p => p.filter(r => r.id !== id));
    // Commit a local row into `inputs` once it has a key + a non-empty value.
    // Called on blur (focus left the row) so we never remount mid-edit.
    const commitPending = (id) => {
        const row = pending.find(r => r.id === id);
        if (!row) return;
        const key = (row.key || '').trim();
        if (!key || isEmptyBinding(row.binding)) return; // not ready — keep editing
        let finalKey = key, n = 1;
        const taken = new Set(Object.keys(inputs || {}));
        while (taken.has(finalKey)) finalKey = `${key}${++n}`;
        onChange?.({ ...(inputs || {}), [finalKey]: row.binding });
        removePending(id);
    };
    const renderPendingRows = () => pending.map(row => (
        <div
            key={`pending-${row.id}`}
            onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) commitPending(row.id); }}
        >
            <GenericRow
                fieldKey={row.key}
                value={row.binding}
                onChange={(b) => updatePending(row.id, { binding: b })}
                onRename={(k) => updatePending(row.id, { key: k })}
                onRemove={() => removePending(row.id)}
                onFocusField={onFocusField}
                previewSample={previewSample}
            />
        </div>
    ));

    const updateField = (key, binding) => {
        if (autoMappedKeys.includes(key)) setConsumed(s => new Set(s).add(key));
        const next = { ...(inputs || {}) };
        if (isEmptyBinding(binding) && !keepEmptyFields) {
            delete next[key];
        } else {
            // Keep the user's named field even when empty (Set / layer_output):
            // normalise to an empty literal so it persists through save.
            next[key] = binding || { kind: 'literal', value: '' };
        }
        onChange?.(next);
    };

    const renameField = (oldKey, newKey) => {
        const cleaned = String(newKey || '').trim();
        if (!cleaned || cleaned === oldKey) return;
        const next = {};
        for (const [k, v] of Object.entries(inputs || {})) {
            next[k === oldKey ? cleaned : k] = v;
        }
        onChange?.(next);
    };

    const removeField = (key) => {
        const next = { ...(inputs || {}) };
        delete next[key];
        onChange?.(next);
    };

    const addField = () => {
        if (keepEmptyFields) {
            // Set / layer_output: empty NAMED fields are valid and persist.
            const next = { ...(inputs || {}) };
            const key = uniqueKey();
            next[key] = { kind: 'literal', value: '' };
            // Focus + select the generated name so the first thing the user
            // types replaces it. Without this the row reads as a box labelled
            // "field" whose meaning nobody explained.
            setFocusKey(key);
            onChange?.(next);
            return;
        }
        // Tool / AI inputs: hold the new row locally until it has a value, so
        // the autosave's empty-strip can't make it flash-and-vanish.
        setPending(p => [...p, { id: ++pidRef.current, key: uniqueKey(), binding: { kind: 'literal', value: '' } }]);
    };

    // "Add field from a previous step" (Set / layer_output only): pick an
    // upstream value and land a named ref field in one click — name suggested
    // from the path's last segment, value already bound.
    const upstreamPicker = useVariablePicker();
    const upstreamCtx = useVariablePickerContext();
    const addFieldFromUpstream = (path) => {
        const key = uniqueKey(suggestKeyFromPath(path));
        onChange?.({ ...(inputs || {}), [key]: { kind: 'ref', path: String(path || '').trim() } });
        upstreamPicker.closePicker();
    };
    const AddFromStepButton = keepEmptyFields ? (
        <>
            <button
                type="button"
                onClick={(e) => upstreamPicker.openPicker(e.currentTarget)}
                className="flex items-center gap-1 text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
                <Workflow size={12} /> Add field from a previous step
            </button>
            <VariablePicker
                {...upstreamPicker.pickerProps}
                groups={upstreamCtx.groups}
                previewSample={previewSample ?? upstreamCtx.previewSample}
                onPick={addFieldFromUpstream}
                title="Add field from a previous step"
            />
        </>
    ) : null;

    const WandButton = onAutoMap ? (
        <button
            type="button"
            onClick={onAutoMap}
            title="Auto-map empty inputs from upstream steps"
            className={actionButtonClass()}
        >
            <Sparkles size={12} /> Auto-map
        </button>
    ) : null;

    if (properties) {
        const { essentialKeys, advancedKeys } = partitionInputs(properties, required, inputs);
        const knownKeys = new Set(Object.keys(properties));
        const extras = Object.keys(inputs || {}).filter(k => !knownKeys.has(k));
        const advAutoCount = advancedKeys.filter(isAuto).length;

        const renderField = (key) => (
            <BindingField
                key={key}
                label={properties[key]?.title || key}
                hint={properties[key]?.description}
                required={required.has(key)}
                placeholder={describeExample(properties[key])}
                value={(inputs || {})[key] ?? null}
                onChange={(b) => updateField(key, b)}
                onFocusField={onFocusField}
                previewSample={previewSample}
                multiline={isMultilineProp(properties[key])}
                autoMapped={isAuto(key)}
                expectShape={expectedShapeFor(properties[key])}
                onRequestForEach={onRequestForEach}
            />
        );

        return (
            <div className="space-y-3">
                {WandButton && <div className="flex justify-end">{WandButton}</div>}
                {essentialKeys.map(renderField)}
                {advancedKeys.length > 0 && (
                    <CollapsibleSection
                        variant="disclosure"
                        count={advancedKeys.length}
                        countNoun="field"
                        badge={advAutoCount > 0 ? `${advAutoCount} auto` : null}
                        open={advFieldsOpen}
                        onToggle={setAdvFieldsOpen}
                    >
                        {advancedKeys.map(renderField)}
                    </CollapsibleSection>
                )}
                {(extras.length > 0 || pending.length > 0) && (
                    <div className="pt-2 border-t border-[var(--border-default)] space-y-2">
                        <div className={subLabelClass()}>
                            Extra inputs (not in tool schema)
                        </div>
                        {extras.map(k => (
                            <GenericRow
                                key={k}
                                fieldKey={k}
                                value={inputs[k]}
                                onChange={(b) => updateField(k, b)}
                                onRename={(n) => renameField(k, n)}
                                onRemove={() => removeField(k)}
                                onFocusField={onFocusField}
                                previewSample={previewSample}
                            />
                        ))}
                        {renderPendingRows()}
                    </div>
                )}
                {allowExtraFields && (
                    <button
                        type="button"
                        onClick={addField}
                        className="flex items-center gap-1 text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    >
                        <Plus size={12} /> Add custom field
                    </button>
                )}
            </div>
        );
    }

    // Generic mode — no schema.
    const entries = Object.entries(inputs || {});
    return (
        <div className="space-y-2">
            {WandButton && <div className="flex justify-end">{WandButton}</div>}
            {entries.length === 0 && pending.length === 0 && (
                <div className="text-[11px] text-[var(--text-tertiary)] italic">
                    No inputs yet. Add a field below.
                </div>
            )}
            {entries.map(([k, v]) => (
                <GenericRow
                    key={k}
                    fieldKey={k}
                    siblingKeys={entries.map(([ek]) => ek).filter(ek => ek !== k)}
                    value={v}
                    visual={visualValues}
                    nameLabel={nameLabel}
                    valueLabel={valueLabel}
                    namePlaceholder={namePlaceholder}
                    valuePlaceholder={valuePlaceholder}
                    allowRaw={allowRawValues}
                    autoFocusName={k === focusKey}
                    onChange={(b) => updateField(k, b)}
                    onRename={(n) => renameField(k, n)}
                    // A path dropped/typed into the NAME slot means "bind this
                    // value": name = last segment, value = ref to the path
                    // (only when the row's value is still empty — never
                    // clobber a configured binding).
                    onAdoptPath={(path, suggested) => {
                        const nextKey = suggested && !Object.prototype.hasOwnProperty.call(inputs || {}, suggested) ? suggested : `${suggested || 'field'}_2`;
                        const cur = (inputs || {})[k];
                        const next = {};
                        for (const [ek, ev] of Object.entries(inputs || {})) {
                            if (ek === k) next[nextKey] = isEmptyBinding(cur) ? { kind: 'ref', path } : ev;
                            else next[ek] = ev;
                        }
                        onChange?.(next);
                    }}
                    onRemove={() => removeField(k)}
                    onFocusField={onFocusField}
                    previewSample={previewSample}
                    autoMapped={isAuto(k)}
                />
            ))}
            {renderPendingRows()}
            {allowExtraFields && (
                <div className="flex items-center gap-3 flex-wrap">
                    <button
                        type="button"
                        onClick={addField}
                        className="flex items-center gap-1 text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    >
                        <Plus size={12} /> Add field
                    </button>
                    {AddFromStepButton}
                </div>
            )}
        </div>
    );
}

/**
 * Names JavaScript must never see as assigned object keys: `__proto__`
 * assignment doesn't create an own property, so the field silently vanishes
 * from the step output while everything validates green. Mirrors the server's
 * parse_json name guard.
 */
const RESERVED_FIELD_NAMES = new Set(['__proto__', 'constructor', 'prototype']);

/** Does this look like a binding path rather than a field name? */
const looksLikePath = (s) => /[.\s[\]]/.test(s);

/**
 * Field-NAME input that commits on blur/Enter instead of per keystroke
 * (node-audit B12 + user report).
 *
 * The old live-controlled input had three failure modes:
 *   - every keystroke renamed the map key → the row remounted and focus was
 *     lost after each character;
 *   - a native TEXT DROP from the variable tree landed the FULL PATH as the
 *     field name (`steps.act_x.output.results[*].subject`) — dots make the
 *     output key unbindable downstream;
 *   - `__proto__` as a name made the field silently vanish at run time.
 *
 * Dropping/typing a path now does what the user meant: the name becomes the
 * path's last segment (suggestKeyFromPath) and — for a drop on an empty row —
 * the VALUE gets bound to that path.
 */
function FieldNameInput({ fieldKey, siblingKeys = [], onCommit, onAdoptPath = null, placeholder = 'field name', autoFocus = false }) {
    const [text, setText] = useState(fieldKey);
    const [error, setError] = useState(null);
    const ref = useRef(null);
    React.useEffect(() => { setText(fieldKey); setError(null); }, [fieldKey]);
    // A freshly added row lands with a generated name ("field"): select it so
    // the first keystroke replaces it instead of appending to it.
    React.useEffect(() => { if (autoFocus) ref.current?.select(); }, [autoFocus]);

    const commit = (raw) => {
        let cleaned = String(raw ?? text ?? '').trim();
        if (cleaned === fieldKey) { setText(fieldKey); setError(null); return; }
        if (!cleaned) { setText(fieldKey); setError('Name required — reverted.'); return; }
        if (looksLikePath(cleaned)) {
            // A pasted/typed path: keep the meaningful tail as the name.
            const suggested = suggestKeyFromPath(cleaned);
            if (onAdoptPath && /^(trigger|steps|vars|secrets|loop)[.[]/.test(cleaned)) {
                onAdoptPath(cleaned, suggested);
                setError(null);
                return;
            }
            cleaned = suggested;
        }
        if (RESERVED_FIELD_NAMES.has(cleaned)) { setError(`“${cleaned}” is a reserved name.`); return; }
        if (siblingKeys.includes(cleaned)) { setError(`A field named “${cleaned}” already exists.`); return; }
        setError(null);
        if (cleaned !== fieldKey) onCommit(cleaned);
        setText(cleaned);
    };

    return (
        <div className="flex-1 min-w-0">
            <input
                ref={ref}
                type="text"
                value={text}
                onChange={(e) => { setText(e.target.value); if (error) setError(null); }}
                onBlur={() => commit()}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }}
                onDragOver={onBindingDragOver}
                onDrop={(e) => {
                    const path = getBindingDropPath(e);
                    if (path) commit(path);
                }}
                placeholder={placeholder}
                aria-invalid={!!error}
                className={rowInputClass('w-full font-mono', { invalid: !!error })}
            />
            {error && <div className="mt-0.5 text-[10px] text-red-500">{error}</div>}
        </div>
    );
}

function GenericRow({
    fieldKey, siblingKeys = [], value, onChange, onRename, onAdoptPath = null, onRemove,
    onFocusField, previewSample, autoMapped = false,
    visual = false, nameLabel = null, valueLabel = null,
    namePlaceholder = 'field name', valuePlaceholder = 'value',
    allowRaw = true, autoFocusName = false,
}) {
    const slotLabel = (text) => (
        <div className={`${subLabelClass()} mb-0.5`}>{text}</div>
    );
    return (
        <div className={cardClass()}>
            <div>
                {nameLabel && slotLabel(nameLabel)}
                <div className="flex items-center gap-1">
                    <FieldNameInput
                        fieldKey={fieldKey}
                        siblingKeys={siblingKeys}
                        onCommit={onRename}
                        onAdoptPath={onAdoptPath}
                        placeholder={namePlaceholder}
                        autoFocus={autoFocusName}
                    />
                    {autoMapped && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--accent)]/15 text-[var(--accent)] uppercase tracking-wide" title="Auto-mapped">auto</span>
                    )}
                    <button
                        type="button"
                        onClick={onRemove}
                        title="Remove field"
                        aria-label="Remove field"
                        className="shrink-0 p-1 rounded text-[var(--text-tertiary)] hover:text-red-500 hover:bg-[var(--bg-secondary)]"
                    >
                        <Trash2 size={12} />
                    </button>
                </div>
            </div>
            <div>
                {valueLabel && slotLabel(valueLabel)}
                {visual ? (
                    <ValueBuilder
                        value={value}
                        onChange={onChange}
                        placeholder={valuePlaceholder}
                        onFocusField={onFocusField}
                        previewSample={previewSample}
                        allowRaw={allowRaw}
                        label={fieldKey}
                    />
                ) : (
                    <BindingField
                        value={value}
                        onChange={onChange}
                        placeholder={valuePlaceholder}
                        onFocusField={onFocusField}
                        previewSample={previewSample}
                    />
                )}
            </div>
        </div>
    );
}

function describeExample(prop) {
    if (!prop) return '';
    if (prop.example != null) return String(prop.example);
    if (prop.default != null) return String(prop.default);
    if (prop.enum && prop.enum.length) return `one of: ${prop.enum.slice(0, 3).join(', ')}${prop.enum.length > 3 ? '…' : ''}`;
    if (prop.type === 'string') return '';
    if (prop.type === 'number' || prop.type === 'integer') return 'e.g. 42';
    if (prop.type === 'boolean') return 'true / false';
    if (prop.type === 'array') return '[…]';
    if (prop.type === 'object') return '{…}';
    return '';
}

function isMultilineProp(prop) {
    if (!prop) return false;
    if (prop.format === 'multiline' || prop.format === 'textarea') return true;
    // Heuristic: long descriptions or fields named like "body"/"message"/"prompt"
    const name = (prop.title || '').toLowerCase();
    if (/body|message|prompt|content|description|notes/.test(name)) return true;
    return false;
}
