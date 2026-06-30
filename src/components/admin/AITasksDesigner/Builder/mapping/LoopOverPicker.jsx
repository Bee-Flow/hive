import { Repeat, ChevronRight, ChevronDown, Check } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { suggestItemVar } from './upstream';
import { previewValue } from '../../../../../utils/bindingHelpers';
import { useVariablePickerContext } from './VariablePickerContext';
import { humanizeExpression } from '../flow/displayHelpers';

/**
 * Picker for a Loop / forEach step's `overRef`. Surfaces the upstream
 * ARRAY fields as friendly choices (step name → field) instead of raw
 * `steps.<id>.output…` paths, so non-technical users can pick what to
 * iterate. The raw path stays editable under "Advanced" for power users.
 *
 * Props:
 *   overRef, itemVar, onChange({overRef,itemVar}), groups, onFocusField
 */
export default function LoopOverPicker({
    overRef = '',
    itemVar = 'item',
    onChange,
    groups = [],
    onFocusField,
}) {
    const { stepLabelById } = useVariablePickerContext();
    const arrayFields = useMemo(() => collectArrayFields(groups), [groups]);
    const [advanced, setAdvanced] = useState(false);

    const pick = (path, suggestedVar) => {
        const nextItem = (!itemVar || itemVar === 'item') ? (suggestedVar || 'item') : itemVar;
        onChange?.({ overRef: path, itemVar: nextItem });
    };
    const onTypedPath = (e) => onChange?.({ overRef: e.target.value, itemVar });
    const onTypedVar = (e) => onChange?.({ overRef, itemVar: e.target.value.replace(/[^A-Za-z0-9_]/g, '') || 'item' });

    const friendlyOver = overRef ? humanizeExpression(overRef, stepLabelById).replace(/[‹›]/g, '') : '';

    return (
        <div className="space-y-3">
            <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-[var(--text-secondary)]">Run this step for each…</label>

                {overRef && (
                    <div className="flex items-center gap-2 px-2 py-1.5 rounded border border-[var(--accent)]/40 bg-[var(--accent)]/5 text-xs">
                        <Repeat size={12} className="shrink-0 text-[var(--accent)]" />
                        <span className="truncate text-[var(--text-primary)]" title={overRef}>{friendlyOver || 'item'}</span>
                    </div>
                )}

                {arrayFields.length > 0 ? (
                    <div className="rounded border border-[var(--border-default)] bg-[var(--bg-secondary)]/40 divide-y divide-[var(--border-default)]">
                        <div className="px-2 py-1 text-[10px] uppercase tracking-wide font-semibold text-[var(--text-tertiary)]">
                            Lists you can repeat over
                        </div>
                        {arrayFields.map(f => {
                            const selected = overRef === f.path;
                            const friendly = humanizeExpression(f.path, stepLabelById).replace(/[‹›]/g, '');
                            return (
                                <button
                                    key={f.path}
                                    type="button"
                                    onClick={() => pick(f.path, suggestItemVar(f.key))}
                                    title={f.path}
                                    className={`w-full flex items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-[var(--bg-secondary)] ${selected ? 'bg-[var(--bg-secondary)]' : ''}`}
                                >
                                    <Repeat size={12} className="shrink-0 text-[var(--text-tertiary)]" />
                                    <span className="text-[var(--text-primary)] truncate">{friendly}</span>
                                    <span className="ml-auto text-[10px] text-[var(--text-tertiary)] truncate max-w-[120px]">{previewValue(f.sample, 24)}</span>
                                    {selected && <Check size={12} className="shrink-0 text-[var(--accent)]" />}
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-[10px] text-[var(--text-tertiary)] italic">
                        No upstream lists detected — open Advanced to enter one by hand.
                    </div>
                )}
            </div>

            <div className="space-y-1">
                <label className="text-[11px] font-medium text-[var(--text-secondary)]">Name each item</label>
                <input
                    type="text"
                    value={itemVar || 'item'}
                    onChange={onTypedVar}
                    placeholder="item"
                    className="w-full px-2 py-1.5 text-xs rounded border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                />
                <div className="text-[10px] text-[var(--text-tertiary)]">
                    Each item is available to the steps below as <span className="font-medium">{itemVar || 'item'}</span>.
                </div>
            </div>

            <button
                type="button"
                onClick={() => setAdvanced(a => !a)}
                className="flex items-center gap-1 text-[10px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            >
                {advanced ? <ChevronDown size={11} /> : <ChevronRight size={11} />} Advanced
            </button>
            {advanced && (
                <div className="space-y-1">
                    <label className="text-[10px] text-[var(--text-tertiary)]">List path (expression)</label>
                    <input
                        type="text"
                        value={overRef}
                        onChange={onTypedPath}
                        onFocus={() => onFocusField?.({ id: 'overRef', label: 'iterate over', insert: (path) => onChange?.({ overRef: path, itemVar }) })}
                        placeholder="steps.s1.output.results"
                        className="w-full px-2 py-1.5 text-xs font-mono rounded border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                    />
                </div>
            )}
        </div>
    );
}

function collectArrayFields(groups) {
    const out = [];
    const seen = new Set();
    for (const g of groups || []) {
        for (const f of (g.fields || [])) {
            if (Array.isArray(f.sample) && !seen.has(f.path)) {
                seen.add(f.path);
                out.push({ key: f.key, path: f.path, sample: f.sample });
            }
        }
    }
    return out;
}
