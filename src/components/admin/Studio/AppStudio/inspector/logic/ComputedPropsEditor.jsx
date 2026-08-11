import { Plus, X } from 'lucide-react';
import React, { useState } from 'react';
import FormulaField from './FormulaField';
import { useCatalogComponents } from '../panels/SpecPanel';
import IconButton from '../../../../../shared/IconButton';
import { INPUT_CLS } from '../panels/kit';
import { getComponentEntry } from '../../runtime/componentRegistry';

/**
 * ComputedPropsEditor — the "Computed values" block of the Logic section. Each
 * row overrides ONE component prop with a formula (node.computed[propKey] =
 * { kind:'formula', expr }, the shape canonicalize.js keeps — a bare expression
 * string is DROPPED on save), evaluated at render time. The prop picker is
 * sourced from the catalog spec for the node's type (so only real props are
 * offered); a row's formula uses the shared Studio scope for its picker +
 * live-eval.
 *
 * `value` IS node.computed; onChange emits the next map. An empty map clears
 * node.computed upstream (definitionOps.setNodeComputed).
 */

/** The expression behind a computed entry (legacy bare strings included). */
function exprOf(entry) {
    if (typeof entry === 'string') return entry;
    if (entry && typeof entry === 'object') return entry.expr || '';
    return '';
}

export default function ComputedPropsEditor({ node, value, onChange, definition = null, disabled = false }) {
    const computed = value && typeof value === 'object' ? value : {};
    const catalog = useCatalogComponents();
    // Rows whose formula is still blank stay here: an empty expression is a
    // hard validation error server-side, so it must never reach node.computed.
    const [blankKeys, setBlankKeys] = useState([]);

    // Props eligible to compute: everything the type declares MINUS binding
    // props (those have their own richer editor) and props already computed.
    const specProps = catalog?.[node?.type]?.props
        || inferProps(getComponentEntry(node?.type)?.defaultProps);
    const entries = [
        ...Object.entries(computed).map(([k, v]) => [k, exprOf(v)]),
        ...blankKeys.filter((k) => !(k in computed)).map((k) => [k, '']),
    ];
    const bound = new Set(entries.map(([k]) => k));
    const available = Object.entries(specProps)
        .filter(([k, fs]) => fs?.type !== 'binding' && !bound.has(k))
        .map(([k]) => k);

    const setKey = (key, expr) => {
        if (expr.trim()) {
            setBlankKeys((ks) => ks.filter((k) => k !== key));
            onChange({ ...computed, [key]: { kind: 'formula', expr } });
            return;
        }
        setBlankKeys((ks) => (ks.includes(key) ? ks : [...ks, key]));
        if (key in computed) {
            const next = { ...computed };
            delete next[key];
            onChange(next);
        }
    };
    const renameKey = (oldKey, newKey) => {
        if (!newKey || newKey === oldKey) return;
        setBlankKeys((ks) => ks.map((k) => (k === oldKey ? newKey : k)));
        if (!(oldKey in computed)) return;
        const next = {};
        for (const [k, v] of Object.entries(computed)) next[k === oldKey ? newKey : k] = v;
        onChange(next);
    };
    const removeKey = (key) => {
        setBlankKeys((ks) => ks.filter((k) => k !== key));
        if (!(key in computed)) return;
        const next = { ...computed };
        delete next[key];
        onChange(next);
    };
    const addRow = () => {
        const key = available[0];
        if (!key) return;
        setBlankKeys((ks) => [...ks, key]);
    };

    return (
        <div className="flex flex-col gap-2">
            {entries.map(([key, expr]) => (
                <div key={key} className="rounded-md border border-[var(--border-subtle)] p-2.5 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                        <select
                            className={INPUT_CLS}
                            value={key}
                            onChange={(e) => renameKey(key, e.target.value)}
                            disabled={disabled}
                            aria-label="Computed property"
                        >
                            <option value={key}>{humanize(key)}</option>
                            {available.map((k) => <option key={k} value={k}>{humanize(k)}</option>)}
                        </select>
                        <IconButton ariaLabel={`Remove computed ${key}`} onClick={() => removeKey(key)} disabled={disabled} variant="danger" size="sm">
                            <X />
                        </IconButton>
                    </div>
                    <FormulaField
                        value={expr}
                        onChange={(next) => setKey(key, next)}
                        definition={definition}
                        node={node}
                        placeholder="e.g. item.status == 'done' ? 'Done' : 'Open'"
                        disabled={disabled}
                    />
                </div>
            ))}

            {available.length ? (
                <button
                    type="button"
                    onClick={addRow}
                    disabled={disabled}
                    className="px-3 py-1.5 text-xs rounded-md border border-dashed border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-1"
                >
                    <Plus size={12} /> Compute a value
                </button>
            ) : entries.length === 0 ? (
                <p className="text-[11px] text-[var(--text-muted)]">This component has no computable properties.</p>
            ) : null}
        </div>
    );
}

function inferProps(defaultProps) {
    const out = {};
    for (const [key, v] of Object.entries(defaultProps || {})) {
        const isBinding = v && typeof v === 'object' && !Array.isArray(v) && 'kind' in v;
        out[key] = { type: isBinding ? 'binding' : 'string' };
    }
    return out;
}

function humanize(key) {
    const words = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
    return words.charAt(0).toUpperCase() + words.slice(1);
}
