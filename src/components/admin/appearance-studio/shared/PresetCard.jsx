import { Check } from 'lucide-react';
import React from 'react';
import PresetSwatch from '../../../appearance/PresetSwatch';

/**
 * PresetCard — preset tile used by the Look editor's preset grid. Wraps the
 * shared PresetSwatch with a header row (icon + label + selected check) and
 * a one-line hint. Pure presentational; the parent owns selection state.
 */
export default function PresetCard({
    id,
    label,
    hint,
    Icon,
    selected,
    disabled = false,
    onSelect,
}) {
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={() => onSelect(id)}
            aria-pressed={selected}
            className="text-left p-3 rounded-xl border transition-all"
            style={{
                borderColor: selected ? 'var(--accent-primary)' : 'var(--border-default)',
                background: selected ? 'var(--bg-card-hover)' : 'var(--bg-card)',
                boxShadow: selected
                    ? '0 0 0 2px color-mix(in srgb, var(--accent-primary) 18%, transparent), 0 1px 2px rgba(0,0,0,0.04)'
                    : 'none',
                opacity: disabled ? 0.5 : 1,
                cursor: disabled ? 'not-allowed' : 'pointer',
            }}
        >
            <PresetSwatch preset={id} />
            <div className="flex items-center gap-2 mt-2">
                {Icon && (
                    <Icon
                        className="w-4 h-4"
                        style={{ color: selected ? 'var(--accent-primary)' : 'var(--text-muted)' }}
                    />
                )}
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {label}
                </span>
                {selected && (
                    <Check
                        className="w-3.5 h-3.5 ml-auto"
                        style={{ color: 'var(--accent-primary)' }}
                    />
                )}
            </div>
            {hint && (
                <p className="text-[11px] mt-1 leading-snug" style={{ color: 'var(--text-muted)' }}>
                    {hint}
                </p>
            )}
        </button>
    );
}
