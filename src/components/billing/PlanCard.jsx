import React from 'react';
import { Check, Loader2 } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { formatPrice } from './planModel';
import { BILLING_ACTION } from './billingTheme';

/**
 * The plan card. One component for every place a plan is shown: the billing
 * page, org settings, consumer settings and the signup wizard's plan step.
 *
 * There used to be four of these with four different price formatters and four
 * takes on the palette. Colour here is deliberate rather than uniform: state
 * colours come from real theme tokens (`--success` for the plan you're on), and
 * the call to action uses BILLING_ACTION — see billingTheme.js for why the
 * neutral `--accent-primary` grey is wrong for a conversion button.
 *
 * `variant` changes density, not identity:
 *   settings  — default, inside a settings panel
 *   marketing — larger type, for a full-width pricing layout
 *   compact   — tight, for the signup wizard where vertical space is scarce
 */
export default function PlanCard({
    plan,
    variant = 'settings',
    current = false,
    selected = false,
    highlighted = false,
    busy = false,
    disabled = false,
    ctaLabel,
    onSelect,
    seats,
    footnote,
}) {
    const { t } = useTranslation();
    if (!plan) return null;

    const price = formatPrice(plan, t);
    const interactive = typeof onSelect === 'function' && !disabled && !busy;
    const pad = variant === 'marketing' ? 'p-6' : variant === 'compact' ? 'p-3.5' : 'p-5';
    const amountSize = variant === 'marketing' ? 'text-3xl' : variant === 'compact' ? 'text-xl' : 'text-2xl';

    // `selected` is the wizard's "I picked this"; `current` is "you are on this
    // plan already". Both draw an emphasised border, in different colours.
    const accent = selected || current || highlighted;

    return (
        <div
            role={interactive ? 'button' : undefined}
            tabIndex={interactive ? 0 : undefined}
            aria-pressed={interactive ? selected : undefined}
            aria-busy={busy || undefined}
            onClick={interactive ? () => onSelect(plan) : undefined}
            onKeyDown={interactive ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(plan); }
            } : undefined}
            className={[
                'relative flex flex-col min-w-0 rounded-2xl border transition-colors',
                pad,
                interactive ? 'cursor-pointer' : '',
                disabled ? 'opacity-50' : '',
            ].filter(Boolean).join(' ')}
            style={{
                background: 'var(--bg-secondary)',
                // Being ON a plan is a success state; being selected/highlighted
                // is an action state. They are different colours on purpose.
                borderColor: current ? 'var(--success)'
                    : accent ? BILLING_ACTION
                        : 'var(--border-subtle)',
                boxShadow: accent ? `0 0 0 1px ${current ? 'var(--success)' : BILLING_ACTION}` : undefined,
            }}
        >
            {current && (
                <span
                    className="absolute -top-2.5 right-4 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide"
                    style={{ background: 'var(--success)', color: '#fff' }}
                >
                    {t('billing.current_plan', 'Current plan')}
                </span>
            )}

            <h3 className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                {plan.name}
            </h3>
            {plan.description && variant !== 'compact' && (
                <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {plan.description}
                </p>
            )}

            <div className="mt-3 flex items-baseline gap-1 flex-wrap">
                <span className={`${amountSize} font-bold`} style={{ color: 'var(--text-primary)' }}>
                    {price.amount}
                </span>
                {price.period && (
                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{price.period}</span>
                )}
            </div>

            {price.metered && (
                <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {t('billing.metered_note', 'Billed on actual usage')}
                </p>
            )}
            {plan.perSeat && seats > 0 && (
                <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {t('billing.seats_summary', '{seats} seats currently in use').replace('{seats}', String(seats))}
                </p>
            )}
            {plan.trialDays > 0 && !current && (
                <p className="mt-1 text-xs font-medium" style={{ color: 'var(--accent-primary)' }}>
                    {t('billing.trial_days', '{days}-day free trial').replace('{days}', String(plan.trialDays))}
                </p>
            )}

            {plan.features.length > 0 && variant !== 'compact' && (
                <ul className="mt-3 space-y-1.5 flex-1">
                    {plan.features.map((f, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                            <Check className="w-3.5 h-3.5 mt-px shrink-0" style={{ color: 'var(--accent-primary)' }} aria-hidden />
                            <span className="min-w-0">{typeof f === 'string' ? f : f?.label}</span>
                        </li>
                    ))}
                </ul>
            )}

            {footnote && (
                <p className="mt-3 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>{footnote}</p>
            )}

            {onSelect && (
                <button
                    type="button"
                    disabled={disabled || busy || current}
                    onClick={(e) => { e.stopPropagation(); onSelect(plan); }}
                    className="mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                    style={current
                        ? { background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }
                        : { background: BILLING_ACTION, color: '#fff' }}
                >
                    {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />}
                    {current
                        ? t('billing.your_plan', 'Your plan')
                        : (ctaLabel || (plan.isFree
                            ? t('billing.choose_plan', 'Choose plan')
                            : t('billing.subscribe', 'Subscribe')))}
                </button>
            )}
        </div>
    );
}
