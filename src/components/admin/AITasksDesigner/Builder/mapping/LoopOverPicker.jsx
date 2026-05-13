import React, { useMemo } from 'react';
import { Repeat } from 'lucide-react';
import { previewValue } from '../../../../../utils/bindingHelpers';

/**
 * Picker for a Loop step's `overRef`. Walks the upstream variable
 * groups and surfaces only ARRAY-typed fields so the user picks
 * something the loop runtime can iterate. Falls back to a raw text
 * input when the user wants a hand-written path (e.g. `vars.<name>`).
 *
 * Also suggests an `itemVar` name based on the array's source key
 * (singularising plurals: `results` → `result`).
 *
 * Props:
 *   overRef        — current path string
 *   itemVar        — current loop variable name
 *   onChange       — ({ overRef, itemVar }) => void  (merged patch)
 *   groups         — upstream variable groups from useUpstreamVariables
 *   onFocusField   — focus broadcaster for the raw text input
 */
export default function LoopOverPicker({
    overRef = '',
    itemVar = 'item',
    onChange,
    groups = [],
    onFocusField,
}) {
    const arrayFields = useMemo(() => collectArrayFields(groups), [groups]);

    const pick = (path, suggestedVar) => {
        const nextItem = (!itemVar || itemVar === 'item') ? (suggestedVar || 'item') : itemVar;
        onChange?.({ overRef: path, itemVar: nextItem });
    };

    const onTypedPath = (e) => {
        onChange?.({ overRef: e.target.value, itemVar });
    };

    const onTypedVar = (e) => {
        onChange?.({ overRef, itemVar: e.target.value.replace(/[^A-Za-z0-9_]/g, '') || 'item' });
    };

    return (
        <div className="space-y-3">
            <div className="space-y-1">
                <label className="text-[11px] font-medium text-[var(--text-secondary)]">Iterate over (array)</label>
                <input
                    type="text"
                    value={overRef}
                    onChange={onTypedPath}
                    onFocus={() => onFocusField?.({
                        id: 'overRef',
                        label: 'iterate over',
                        insert: (path) => { onChange?.({ overRef: path, itemVar }); },
                    })}
                    placeholder="steps.s1.output.results"
                    className="w-full px-2 py-1.5 text-xs font-mono rounded border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                />
                {arrayFields.length > 0 && (
                    <div className="rounded border border-[var(--border-default)] bg-[var(--bg-secondary)]/40 divide-y divide-[var(--border-default)]">
                        <div className="px-2 py-1 text-[10px] uppercase tracking-wide font-semibold text-[var(--text-tertiary)]">
                            Arrays you can iterate
                        </div>
                        {arrayFields.map(f => (
                            <button
                                key={f.path}
                                type="button"
                                onClick={() => pick(f.path, suggestItemVar(f.key))}
                                className={`w-full flex items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-[var(--bg-secondary)] ${overRef === f.path ? 'bg-[var(--bg-secondary)]' : ''}`}
                            >
                                <Repeat size={12} className="shrink-0 text-[var(--text-tertiary)]" />
                                <span className="font-mono text-[var(--text-primary)] truncate">{f.path}</span>
                                <span className="ml-auto text-[10px] text-[var(--text-tertiary)] truncate max-w-[140px]">
                                    {previewValue(f.sample, 24)}
                                </span>
                            </button>
                        ))}
                    </div>
                )}
                {arrayFields.length === 0 && (
                    <div className="text-[10px] text-[var(--text-tertiary)] italic">
                        No upstream arrays detected — type a path manually.
                    </div>
                )}
            </div>
            <div className="space-y-1">
                <label className="text-[11px] font-medium text-[var(--text-secondary)]">Item variable name</label>
                <input
                    type="text"
                    value={itemVar || 'item'}
                    onChange={onTypedVar}
                    placeholder="item"
                    className="w-full px-2 py-1.5 text-xs font-mono rounded border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                />
                <div className="text-[10px] text-[var(--text-tertiary)]">
                    Reference each iteration inside the loop body as <code className="font-mono">loop.{itemVar || 'item'}</code>.
                </div>
            </div>
        </div>
    );
}

function collectArrayFields(groups) {
    const out = [];
    for (const g of groups || []) {
        const sample = g.sample;
        if (!sample || typeof sample !== 'object') continue;
        for (const [k, v] of Object.entries(sample)) {
            if (Array.isArray(v)) {
                out.push({ key: k, path: `${g.basePath}.${k}`, sample: v });
            }
        }
    }
    return out;
}

function suggestItemVar(key) {
    // Strip trailing s/es to singularise loosely; keep at least 2 chars.
    const s = String(key || '').trim();
    if (!s) return 'item';
    if (/ies$/.test(s)) return s.slice(0, -3) + 'y'; // "categories" → "category"
    if (/(s|es)$/.test(s) && s.length > 2) return s.replace(/(es|s)$/, '');
    return s;
}
