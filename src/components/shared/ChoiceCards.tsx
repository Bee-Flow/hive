import React, { useRef } from 'react';

/**
 * ChoiceCards — a radio group rendered as description cards.
 *
 * `SegmentedControl` is the right shape when the options are one or two words.
 * When each option needs a sentence explaining its consequence ("Replace
 * sensitive values with placeholders before the AI sees them" vs "Reject the
 * message before it leaves the organisation") a pill row cannot carry it, and
 * every place that needed one grew its own `<button>` grid instead.
 *
 * ── Why a shared component rather than a fourth copy ──────────────────────
 * There were already two prior arts — `admin/subscriptions/ui/Choice.jsx` and
 * `appearance-studio/shared/PresetCard.jsx` — and NEITHER has radio semantics.
 * They render plain buttons whose only selected-state signal is colour, so a
 * screen-reader user is told "button, Tokenize & round-trip" with no way to
 * know it is the current choice, or even that the options are mutually
 * exclusive. That is the defect this component exists to stop copying.
 *
 * Semantics follow the ARIA APG radiogroup pattern, mirroring
 * `SegmentedControl.tsx`:
 *   - one tab stop for the whole group (roving tabindex), not one per card;
 *   - arrows / Home / End move between ENABLED options, wrapping;
 *   - selection follows focus, as APG specifies for a radio group;
 *   - `aria-checked` carries the state that colour alone used to carry.
 *
 * Note the `activeIdx` fallback: when nothing is selected — which really
 * happens, e.g. a stored value whose licence has since lapsed — the first
 * enabled card takes the tab stop, so the group cannot become unreachable by
 * keyboard at exactly the moment the user needs to fix it.
 */

export interface ChoiceCardOption<TValue extends string> {
    value: TValue;
    label: React.ReactNode;
    description?: React.ReactNode;
    /** Lucide component (or any icon component). Rendered decoratively. */
    Icon?: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
    /** Small pill after the label — "Recommended", "Enterprise", … */
    badge?: React.ReactNode;
    disabled?: boolean;
    /** Shown under the card when it is disabled; explains what would unlock it. */
    lockedNotice?: React.ReactNode;
}

export interface ChoiceCardsProps<TValue extends string> {
    value: TValue | null | undefined;
    onChange: (next: TValue) => void;
    options: readonly ChoiceCardOption<TValue>[];
    /** Accessible name for the group. Required in practice — the cards alone never say what is being chosen. */
    ariaLabel?: string;
    disabled?: boolean;
    columns?: 1 | 2 | 3;
    className?: string;
}

// A literal map, not `grid-cols-${n}`. Tailwind's scanner only sees class
// names that appear literally in the source, so the interpolated form in
// `Choice.jsx` silently produces no grid at all at build time.
const GRID: Record<number, string> = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-3',
};

export default function ChoiceCards<TValue extends string>({
    value,
    onChange,
    options,
    ariaLabel,
    disabled = false,
    columns = 2,
    className = '',
}: ChoiceCardsProps<TValue>) {
    const refs = useRef<Record<string, HTMLButtonElement | null>>({});
    const enabled = options.filter(o => !o.disabled && !disabled);

    const selectedIdx = options.findIndex(o => o.value === value);
    const firstEnabledIdx = options.findIndex(o => !o.disabled && !disabled);
    const activeIdx = selectedIdx >= 0 ? selectedIdx : Math.max(0, firstEnabledIdx);

    const onKeyDown = (e: React.KeyboardEvent, idx: number) => {
        if (enabled.length === 0) return;
        const pos = enabled.findIndex(o => o.value === options[idx].value);
        const from = pos >= 0 ? pos : 0;
        let next = from;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (from + 1) % enabled.length;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (from - 1 + enabled.length) % enabled.length;
        else if (e.key === 'Home') next = 0;
        else if (e.key === 'End') next = enabled.length - 1;
        else return;
        e.preventDefault();
        const target = enabled[next];
        onChange(target.value);
        refs.current[target.value]?.focus();
    };

    return (
        <div
            role="radiogroup"
            aria-label={ariaLabel}
            className={`grid gap-2 ${GRID[columns]} ${className}`}
        >
            {options.map((opt, idx) => {
                const selected = opt.value === value;
                const off = disabled || !!opt.disabled;
                return (
                    <div key={opt.value}>
                        <button
                            type="button"
                            role="radio"
                            ref={(el) => { refs.current[opt.value] = el; }}
                            aria-checked={selected}
                            tabIndex={idx === activeIdx ? 0 : -1}
                            disabled={off}
                            onClick={() => onChange(opt.value)}
                            onKeyDown={(e) => onKeyDown(e, idx)}
                            className="w-full h-full text-left px-3 py-2.5 rounded-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                            style={{
                                background: selected ? 'rgba(16,185,129,0.10)' : 'var(--bg-primary)',
                                border: `1.5px solid ${selected ? '#10B981' : 'var(--border-subtle)'}`,
                            }}
                        >
                            <span
                                className="text-xs font-medium flex items-center gap-1.5"
                                style={{ color: selected ? '#10B981' : 'var(--text-primary)' }}
                            >
                                {opt.Icon && <opt.Icon className="w-4 h-4 shrink-0" aria-hidden="true" />}
                                <span>{opt.label}</span>
                                {opt.badge && (
                                    <span
                                        className="text-[9px] px-1.5 py-px rounded-full"
                                        style={{ background: 'rgba(16,185,129,0.15)', color: '#10B981' }}
                                    >{opt.badge}</span>
                                )}
                            </span>
                            {opt.description && (
                                <span
                                    className="text-[10px] mt-0.5 leading-relaxed block"
                                    style={{ color: 'var(--text-muted)' }}
                                >{opt.description}</span>
                            )}
                        </button>
                        {off && opt.lockedNotice && (
                            <p className="text-[10px] mt-1 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                                {opt.lockedNotice}
                            </p>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
