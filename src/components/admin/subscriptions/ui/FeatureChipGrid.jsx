import React from 'react';
import { Check } from 'lucide-react';
import { FEATURE_OPTIONS } from '../constants';

/**
 * Reproduces the original FeatureCheckboxes semantics:
 *   selected.length === 0  →  ALL features allowed
 *   selected               →  explicit allow-list
 */
export function FeatureChipGrid({ selected = [], onChange }) {
    const allOn = selected.length === 0;

    const toggle = id => {
        if (allOn) {
            // Start opting out
            onChange(FEATURE_OPTIONS.filter(o => o.id !== id).map(o => o.id));
            return;
        }
        const has = selected.includes(id);
        const next = has ? selected.filter(x => x !== id) : [...selected, id];
        // If user re-enables everything, collapse back to "all"
        onChange(next.length === FEATURE_OPTIONS.length ? [] : next);
    };

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
            {FEATURE_OPTIONS.map(f => {
                const on = allOn || selected.includes(f.id);
                return (
                    <button
                        key={f.id}
                        type="button"
                        onClick={() => toggle(f.id)}
                        className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-[12.5px] font-medium border transition-colors ${
                            on
                                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-200'
                                : 'bg-[var(--bg-tertiary)] border-[var(--border-default)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                        }`}
                    >
                        <span className={`w-4 h-4 rounded inline-flex items-center justify-center border ${
                            on ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-[var(--border-default)]'
                        }`}>
                            {on && <Check className="w-3 h-3" />}
                        </span>
                        <span className="truncate">{f.label}</span>
                    </button>
                );
            })}
        </div>
    );
}
