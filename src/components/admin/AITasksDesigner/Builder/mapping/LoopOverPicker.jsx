import { Repeat, ChevronRight, ChevronDown, Check } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { collectArrayPaths, suggestItemVar } from './upstream';
import { previewValue, walkPath } from '../../../../../utils/bindingHelpers';
import { useVariablePickerContext } from './VariablePickerContext';
import { useTranslation } from '../../../../../hooks/useTranslation';
import { humanizeExpression } from '../flow/displayHelpers';
import { describeListPath } from './listShape';
import { denseInputClass } from '../flow/settings/formStyles';

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
    const { stepLabelById, previewSample } = useVariablePickerContext();
    const { t } = useTranslation();
    // Same source as CollectionArrayRefField's quick-picks: group fields
    // (incl. `[*]` children) PLUS arrays present only in real-run/pinned
    // output — so "Lists you can repeat over" and the source-list picker
    // never disagree about which lists exist.
    const arrayFields = useMemo(() => collectArrayPaths(groups, previewSample), [groups, previewSample]);
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
                            // Column paths read as "step ▸ Field (inside each
                            // row)"; counts resolve through walkPath — a [*]
                            // path's f.sample is the first ELEMENT, so its
                            // length was the first row's size, not the list's.
                            const friendly = f.path.includes('[*]')
                                ? describeListPath(f.path, stepLabelById, t)
                                : humanizeExpression(f.path, stepLabelById).replace(/[‹›]/g, '');
                            const resolved = previewSample ? walkPath(f.path, previewSample) : undefined;
                            const preview = Array.isArray(resolved)
                                ? `${resolved.length} item${resolved.length === 1 ? '' : 's'}`
                                : previewValue(resolved !== undefined ? resolved : f.sample, 24);
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
                                    <span className="ml-auto text-[10px] text-[var(--text-tertiary)] truncate max-w-[120px]">{preview}</span>
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
                    className={denseInputClass('w-full')}
                />
                {/* `loop.` is not decoration — it is the binding. This line
                    used to say the item arrives as plain `item`, so anyone who
                    followed it wrote `item.x` in a body step and got nothing
                    back, silently. The canvas node and the loop settings panel
                    both said `loop.item` correctly; only the picker, the one
                    place you are actually naming the thing, did not. */}
                <div className="text-[10px] text-[var(--text-tertiary)]">
                    Each item is available to the steps below as <span className="font-medium font-mono">loop.{itemVar || 'item'}</span>.
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
                        className={denseInputClass('w-full font-mono')}
                    />
                </div>
            )}
        </div>
    );
}

