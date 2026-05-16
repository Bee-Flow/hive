import React from 'react';

/**
 * Toggle — iOS-style switch with optional title + description on the left.
 *
 * Supersedes the 50+ hand-rolled "label + hidden checkbox + peer-classed
 * div" rows scattered across admin panels (BehaviorSection, AITasksDesigner,
 * IntegrationsAdminPanel, GuardrailsPanel, etc.). Existing `ConfigToggle`
 * is a different visual idiom (visible checkbox row) and continues to be
 * used where that style is intentional.
 *
 * Two render modes:
 *   1. With `label` → full row pattern: { title, description? } | switch
 *   2. Without `label` → bare switch for inline use (table cells, headers)
 *
 * Color names are listed explicitly so Tailwind's content scanner picks
 * them up — `peer-checked:bg-${color}-500` does not work with a dynamic
 * suffix.
 */

export type ToggleColor = 'emerald' | 'amber' | 'rose' | 'sky';
export type ToggleSize = 'sm' | 'md' | 'lg';

export interface ToggleProps {
    checked: boolean;
    onChange: (next: boolean) => void;
    label?: React.ReactNode;
    description?: React.ReactNode;
    color?: ToggleColor;
    disabled?: boolean;
    size?: ToggleSize;
    id?: string;
    /** Falls back to `label` (when it's a string) for screen readers. */
    ariaLabel?: string;
    /** Extra classes applied to the outer wrapper (row mode) or the label (bare mode). */
    className?: string;
}

// Tailwind needs the literal class strings in the source to keep them in the
// final CSS. Keep these maps in one place per visual concern.
const COLOR_ON: Record<ToggleColor, string> = {
    emerald: 'peer-checked:bg-emerald-500',
    amber: 'peer-checked:bg-amber-500',
    rose: 'peer-checked:bg-rose-500',
    sky: 'peer-checked:bg-sky-500',
};

const SIZE_TRACK: Record<ToggleSize, string> = {
    sm: 'w-9 h-5',
    md: 'w-11 h-6',
    lg: 'w-14 h-7',
};

const SIZE_KNOB: Record<ToggleSize, string> = {
    sm: 'after:h-4 after:w-4',
    md: 'after:h-5 after:w-5',
    lg: 'after:h-6 after:w-6',
};

function Switch({
    checked,
    onChange,
    color = 'emerald',
    size = 'md',
    disabled = false,
    id,
    ariaLabel,
}: Pick<ToggleProps, 'checked' | 'onChange' | 'color' | 'size' | 'disabled' | 'id' | 'ariaLabel'>) {
    const trackBase =
        'bg-[var(--bg-tertiary)] peer-focus:outline-none rounded-full peer ' +
        "peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] " +
        'after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 ' +
        'after:border after:rounded-full after:transition-all';
    return (
        <span className={`relative inline-flex items-center ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
            <input
                id={id}
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={(e) => onChange(e.target.checked)}
                aria-label={ariaLabel}
                className="sr-only peer"
            />
            <span
                aria-hidden="true"
                className={`${SIZE_TRACK[size]} ${SIZE_KNOB[size]} ${trackBase} ${COLOR_ON[color]}`}
            />
        </span>
    );
}

export default function Toggle({
    checked,
    onChange,
    label,
    description,
    color = 'emerald',
    size = 'md',
    disabled = false,
    id,
    ariaLabel,
    className = '',
}: ToggleProps) {
    // Bare switch — no label/description, just the control.
    if (label == null && description == null) {
        return (
            <label className={className}>
                <Switch
                    checked={checked}
                    onChange={onChange}
                    color={color}
                    size={size}
                    disabled={disabled}
                    id={id}
                    ariaLabel={ariaLabel}
                />
            </label>
        );
    }

    const computedAria = ariaLabel ?? (typeof label === 'string' ? label : undefined);
    const rowClasses =
        'flex items-center justify-between p-4 rounded-xl bg-white/5 border border-transparent ' +
        'hover:border-[var(--border-subtle)] transition-colors ' +
        (disabled ? 'opacity-60' : '') +
        (className ? ` ${className}` : '');

    return (
        <label htmlFor={id} className={rowClasses}>
            <div className="min-w-0 mr-4">
                {label != null && (
                    <h4 className="text-sm font-medium text-primary truncate">{label}</h4>
                )}
                {description != null && (
                    <p className="text-xs text-muted mt-0.5">{description}</p>
                )}
            </div>
            <Switch
                checked={checked}
                onChange={onChange}
                color={color}
                size={size}
                disabled={disabled}
                id={id}
                ariaLabel={computedAria}
            />
        </label>
    );
}
