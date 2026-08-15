import React from 'react';

/**
 * SegmentedControl — pill-style choice group. Replaces the local
 * `SegmentedControl` previously nested inside the admin theme panel and the
 * 6+ ad-hoc `<button>` rows scattered across Glass settings.
 *
 * Each option's value can be a string OR number — the consumer's value type
 * is preserved through the generic.
 */

export interface SegmentedOption<TValue> {
    value: TValue;
    label: React.ReactNode;
    icon?: React.ReactNode;
    disabled?: boolean;
}

export interface SegmentedControlProps<TValue> {
    value: TValue;
    onChange: (next: TValue) => void;
    options: readonly SegmentedOption<TValue>[];
    disabled?: boolean;
    size?: 'sm' | 'md';
    /** Fills the row width with equal-flex segments instead of natural width. */
    fullWidth?: boolean;
    ariaLabel?: string;
    className?: string;
}

export default function SegmentedControl<TValue extends string | number>({
    value,
    onChange,
    options,
    disabled = false,
    size = 'md',
    fullWidth = false,
    ariaLabel,
    className = '',
}: SegmentedControlProps<TValue>) {
    const pad = size === 'sm' ? 'px-3 py-1.5 text-[12px]' : 'px-4 py-2 text-sm';
    return (
        <div
            role="radiogroup"
            aria-label={ariaLabel}
            className={
                'inline-flex items-center gap-1 p-1 rounded-xl border ' +
                (fullWidth ? 'flex w-full ' : '') +
                className
            }
            style={{
                borderColor: 'var(--border-subtle)',
                background: 'var(--bg-tertiary)',
            }}
        >
            {options.map((opt) => {
                const active = value === opt.value;
                const optDisabled = disabled || !!opt.disabled;
                return (
                    <button
                        key={String(opt.value)}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        disabled={optDisabled}
                        onClick={() => onChange(opt.value)}
                        className={
                            'rounded-lg font-medium transition-all whitespace-nowrap inline-flex items-center justify-center gap-1.5 ' +
                            pad +
                            (fullWidth ? ' flex-1' : '') +
                            (optDisabled ? ' opacity-50 cursor-not-allowed' : ' cursor-pointer')
                        }
                        style={{
                            background: active ? 'var(--bg-card)' : 'transparent',
                            // Inactive segments are still choices the user is
                            // being offered — tertiary made them read as
                            // disabled next to the one active pill.
                            color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                            boxShadow: active
                                ? '0 1px 2px rgba(0,0,0,0.06), 0 0 0 1px var(--border-default) inset'
                                : 'none',
                        }}
                    >
                        {opt.icon}
                        <span>{opt.label}</span>
                    </button>
                );
            })}
        </div>
    );
}
