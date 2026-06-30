import { Plus, Trash2, Sparkles } from 'lucide-react';
import React, { useMemo, useRef, useState } from 'react';
import BindingField from './BindingField';
import { partitionInputs, isEmptyBinding } from './partitionInputs';
import CollapsibleSection from '../flow/CollapsibleSection';

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
}) {
    const properties = inputSchema?.properties || null;
    const required = useMemo(() => new Set(inputSchema?.required || []), [inputSchema]);

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
            next[uniqueKey()] = { kind: 'literal', value: '' };
            onChange?.(next);
            return;
        }
        // Tool / AI inputs: hold the new row locally until it has a value, so
        // the autosave's empty-strip can't make it flash-and-vanish.
        setPending(p => [...p, { id: ++pidRef.current, key: uniqueKey(), binding: { kind: 'literal', value: '' } }]);
    };

    const WandButton = onAutoMap ? (
        <button
            type="button"
            onClick={onAutoMap}
            title="Auto-map empty inputs from upstream steps"
            className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition"
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
            />
        );

        return (
            <div className="space-y-3">
                {WandButton && <div className="flex justify-end">{WandButton}</div>}
                {essentialKeys.map(renderField)}
                {advancedKeys.length > 0 && (
                    <CollapsibleSection
                        count={advancedKeys.length}
                        badge={advAutoCount > 0 ? `${advAutoCount} auto` : null}
                    >
                        {advancedKeys.map(renderField)}
                    </CollapsibleSection>
                )}
                {(extras.length > 0 || pending.length > 0) && (
                    <div className="pt-2 border-t border-[var(--border-default)] space-y-2">
                        <div className="text-[10px] uppercase tracking-wide font-semibold text-[var(--text-tertiary)]">
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
                    value={v}
                    onChange={(b) => updateField(k, b)}
                    onRename={(n) => renameField(k, n)}
                    onRemove={() => removeField(k)}
                    onFocusField={onFocusField}
                    previewSample={previewSample}
                    autoMapped={isAuto(k)}
                />
            ))}
            {renderPendingRows()}
            {allowExtraFields && (
                <button
                    type="button"
                    onClick={addField}
                    className="flex items-center gap-1 text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                    <Plus size={12} /> Add field
                </button>
            )}
        </div>
    );
}

function GenericRow({ fieldKey, value, onChange, onRename, onRemove, onFocusField, previewSample, autoMapped = false }) {
    return (
        <div className="rounded border border-[var(--border-default)] bg-[var(--bg-primary)] p-2 space-y-1.5">
            <div className="flex items-center gap-1">
                <input
                    type="text"
                    value={fieldKey}
                    onChange={(e) => onRename(e.target.value)}
                    placeholder="field name"
                    className="flex-1 min-w-0 px-2 py-1 text-xs font-mono rounded border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
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
            <BindingField
                value={value}
                onChange={onChange}
                placeholder="value"
                onFocusField={onFocusField}
                previewSample={previewSample}
            />
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
