import React, { useMemo } from 'react';
import { Toggle } from './Toggle';

/**
 * Tri-state, org-settings-style card grid for plan-level integrations and
 * beta features.
 *
 *   value === null         → unrestricted (every option auto-included)
 *   value === []           → nothing included
 *   value === [id, …]      → explicit allow-list
 *
 * Visual model mirrors agent-hub/src/components/admin/OrgFeatureTogglesPanel.jsx
 * (lines 214–279). Per-card emerald pill toggle, category headers, optional
 * grouping.
 *
 * Props:
 *   options       - [{ id, label, description?, category? }]
 *   value         - null | string[]   (tri-state, see above)
 *   onChange      - (next: null | string[]) => void
 *   renderIcon    - (id) => ReactNode   for the 32×32 leading icon
 *   grouped       - bool, group cards by `category`
 *   emptyHint     - shown when options.length === 0
 *   restrictLabel - copy for the master toggle (default below)
 */
export function FeatureCardGrid({
    options,
    value,
    onChange,
    renderIcon,
    grouped = true,
    emptyHint,
    restrictLabel = 'Restrict to selected items',
    restrictDescription = 'When off, every option is included automatically.',
}) {
    const restricted = Array.isArray(value);
    const selected = useMemo(
        () => new Set(restricted ? value : options.map(o => o.id)),
        [restricted, value, options]
    );

    const grouping = useMemo(() => {
        if (!grouped) return [['', options]];
        const map = new Map();
        for (const opt of options) {
            const cat = opt.category || 'Other';
            if (!map.has(cat)) map.set(cat, []);
            map.get(cat).push(opt);
        }
        return Array.from(map.entries());
    }, [grouped, options]);

    const setRestricted = next => {
        if (next && !restricted) onChange(options.map(o => o.id));
        else if (!next && restricted) onChange(null);
    };
    const toggleOne = id => {
        if (!restricted) return;
        onChange(selected.has(id) ? value.filter(x => x !== id) : [...value, id]);
    };

    if (options.length === 0 && emptyHint) {
        return (
            <div className="px-3 py-2.5 rounded-lg bg-[var(--bg-tertiary)] text-[12px] text-[var(--text-muted)]">
                {emptyHint}
            </div>
        );
    }

    return (
        <div>
            <div className="mb-4">
                <Toggle
                    checked={restricted}
                    onChange={setRestricted}
                    label={restrictLabel}
                    description={restrictDescription}
                />
                {restricted && (
                    <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                        <span>{value.length} of {options.length} included in this plan.</span>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => onChange(options.map(o => o.id))}
                                className="font-semibold text-blue-400 hover:text-blue-300"
                            >
                                Select all
                            </button>
                            <span className="text-[var(--text-muted)]">·</span>
                            <button
                                type="button"
                                onClick={() => onChange([])}
                                className="font-semibold text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                            >
                                Clear
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <div className={`space-y-4 ${restricted ? '' : 'opacity-70'}`}>
                {grouping.map(([cat, opts]) => (
                    <div key={cat || '_'}>
                        {grouped && cat && (
                            <div className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                                {cat}
                            </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {opts.map(o => (
                                <FeatureCard
                                    key={o.id}
                                    item={o}
                                    selected={selected.has(o.id)}
                                    disabled={!restricted}
                                    icon={renderIcon ? renderIcon(o.id, o) : null}
                                    onToggle={() => toggleOne(o.id)}
                                />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function FeatureCard({ item, selected, disabled, icon, onToggle }) {
    const interactive = !disabled;
    return (
        <div
            role="button"
            tabIndex={interactive ? 0 : -1}
            aria-disabled={disabled}
            onClick={() => interactive && onToggle()}
            onKeyDown={e => {
                if (!interactive) return;
                if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onToggle(); }
            }}
            className={`flex items-center gap-3 p-3 rounded-xl transition-all border ${
                selected
                    ? 'border-emerald-500 bg-emerald-500/[0.04]'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-primary)] opacity-90'
            } ${interactive ? 'cursor-pointer hover:border-emerald-500/60' : 'cursor-not-allowed'}`}
        >
            <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    selected ? 'bg-emerald-500/10 text-emerald-400' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'
                }`}
            >
                {icon || <span className="text-[10px] uppercase font-bold">{(item.label || item.id || '?').slice(0, 2)}</span>}
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-[var(--text-primary)] truncate">{item.label}</p>
                {item.description && (
                    <p className="text-[11px] text-[var(--text-muted)] line-clamp-2 leading-snug">{item.description}</p>
                )}
            </div>
            <label
                className={`relative inline-flex items-center shrink-0 ${interactive ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                onClick={e => e.stopPropagation()}
            >
                <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={selected}
                    disabled={disabled}
                    onChange={() => interactive && onToggle()}
                />
                <div className="w-9 h-5 bg-gray-500/40 rounded-full peer peer-checked:bg-emerald-500 peer-focus:outline-none after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white peer-disabled:opacity-60" />
            </label>
        </div>
    );
}
