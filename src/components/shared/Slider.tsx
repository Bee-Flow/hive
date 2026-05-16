import React from 'react';

/**
 * Slider — accent-coloured range input with a label, value pill and optional
 * suffix/formatter. Replaces the ad-hoc `<input type="range">` + value `<span>`
 * blocks that used to live inline in admin panels.
 */

export interface SliderProps {
    value: number;
    onChange: (next: number) => void;
    min: number;
    max: number;
    step?: number;
    label?: React.ReactNode;
    hint?: React.ReactNode;
    suffix?: string;
    /** Optional custom formatter for the value pill. Defaults to `${value}${suffix}`. */
    valueFormatter?: (value: number) => string;
    disabled?: boolean;
    id?: string;
    className?: string;
    /** Extra content rendered between the value pill and the slider — e.g. radius chips. */
    trailing?: React.ReactNode;
}

export default function Slider({
    value,
    onChange,
    min,
    max,
    step = 1,
    label,
    hint,
    suffix = '',
    valueFormatter,
    disabled = false,
    id,
    className = '',
    trailing,
}: SliderProps) {
    const display = valueFormatter
        ? valueFormatter(value)
        : `${typeof value === 'number' && step < 1 ? value.toFixed(2) : value}${suffix}`;

    return (
        <div className={className}>
            {(label != null || hint != null) && (
                <div className="flex items-baseline justify-between gap-3 mb-2">
                    {label != null && (
                        <label htmlFor={id} className="text-sm font-medium text-[var(--text-primary)]">
                            {label}
                        </label>
                    )}
                    {hint != null && (
                        <span className="text-[11px] text-[var(--text-muted)]">{hint}</span>
                    )}
                </div>
            )}
            <div className="flex items-center gap-3">
                <input
                    id={id}
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    onChange={(e) => onChange(Number(e.target.value))}
                    disabled={disabled}
                    className="flex-1"
                    style={{ accentColor: 'var(--accent-primary)' }}
                />
                <span
                    className="text-xs font-mono tabular-nums px-2 py-1 rounded-md min-w-[3.5rem] text-center"
                    style={{
                        background: 'var(--bg-tertiary)',
                        color: 'var(--text-secondary)',
                    }}
                >
                    {display}
                </span>
                {trailing}
            </div>
        </div>
    );
}
