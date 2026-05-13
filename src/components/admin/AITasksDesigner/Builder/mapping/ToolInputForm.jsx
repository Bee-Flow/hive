import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import BindingField from './BindingField';

/**
 * Schema-driven inputs editor for a step's `inputs` map.
 *
 * Two modes:
 *   1. Schema-driven — when `inputSchema?.properties` is provided
 *      (sourced from the catalog's per-tool function definition).
 *      Each property becomes a labelled BindingField; required flag,
 *      description, and example placeholder come from the schema.
 *   2. Generic key/value rows — when no schema is available (custom
 *      tools, AI step user-defined inputs). User adds rows manually.
 *
 * Both modes emit the same `inputs` object the runtime resolver
 * expects: `{ [key]: bindingObject }`.
 */
export default function ToolInputForm({
    inputs = {},
    onChange,
    inputSchema = null,
    onFocusField,
    previewSample = null,
    allowExtraFields = true,
}) {
    const properties = inputSchema?.properties || null;
    const required = new Set(inputSchema?.required || []);

    const updateField = (key, binding) => {
        const next = { ...(inputs || {}) };
        if (isEmptyBinding(binding)) {
            delete next[key];
        } else {
            next[key] = binding;
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
        const next = { ...(inputs || {}) };
        let k = 'field';
        let n = 1;
        while (k in next) { k = `field${++n}`; }
        next[k] = { kind: 'literal', value: '' };
        onChange?.(next);
    };

    if (properties) {
        const knownKeys = new Set(Object.keys(properties));
        const extras = Object.keys(inputs || {}).filter(k => !knownKeys.has(k));
        return (
            <div className="space-y-3">
                {Object.entries(properties).map(([key, prop]) => (
                    <BindingField
                        key={key}
                        label={prop.title || key}
                        hint={prop.description}
                        required={required.has(key)}
                        placeholder={describeExample(prop)}
                        value={(inputs || {})[key] ?? null}
                        onChange={(b) => updateField(key, b)}
                        onFocusField={onFocusField}
                        previewSample={previewSample}
                        multiline={isMultilineProp(prop)}
                    />
                ))}
                {extras.length > 0 && (
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
            {entries.length === 0 && (
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
                />
            ))}
            <button
                type="button"
                onClick={addField}
                className="flex items-center gap-1 text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
                <Plus size={12} /> Add field
            </button>
        </div>
    );
}

function GenericRow({ fieldKey, value, onChange, onRename, onRemove, onFocusField, previewSample }) {
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

function isEmptyBinding(b) {
    if (b == null) return true;
    if (typeof b !== 'object') return false;
    if (b.kind === 'literal' && (b.value == null || b.value === '')) return true;
    return false;
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
