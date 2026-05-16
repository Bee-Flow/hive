import React from 'react';
import { Euro, TrendingUp, Info, Users } from 'lucide-react';
import { Field, Input, Select, NumberInput } from '../../ui/Input';
import { ChoiceCards } from '../../ui/Choice';
import { Banner } from '../../ui/Banner';
import { Toggle } from '../../ui/Toggle';
import { CURRENCY_SYMBOL } from '../../constants';

export function PricingSection({ form, update }) {
    const sym = CURRENCY_SYMBOL[form.currency] || '€';
    const metered = form.billing_model === 'metered';
    const isOrg = (form.plan_type || 'organization') === 'organization';
    const perSeat = isOrg && !metered && !!form.per_seat;

    return (
        <div className="space-y-5">
            <div>
                <h3 className="text-[15px] font-bold text-[var(--text-primary)] mb-1">Pricing &amp; billing</h3>
                <p className="text-[12px] text-[var(--text-muted)]">Configuration that's pushed to Stripe when you sync.</p>
            </div>

            <Field label="Billing model">
                <ChoiceCards
                    value={form.billing_model}
                    onChange={v => {
                        update('billing_model', v);
                        if (v === 'metered') update('per_seat', false);
                    }}
                    options={[
                        { value: 'fixed',   label: 'Fixed monthly',  description: 'Flat recurring price',         icon: Euro,        accent: 'blue' },
                        { value: 'metered', label: 'Pay-as-you-go',  description: 'Per-call usage + markup %',    icon: TrendingUp,  accent: 'emerald' },
                    ]}
                />
            </Field>

            {isOrg && !metered && (
                <Toggle
                    checked={!!form.per_seat}
                    onChange={v => update('per_seat', v)}
                    label="Bill per seat"
                    description="When enabled, the price above is per active user per month. Stripe is invoiced with quantity = seat count, and the org-wide message cap is computed as per-seat cap × seat count."
                    icon={Users}
                />
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                {!metered && (
                    <Field label={perSeat ? `Price per seat (${sym})` : 'Price'} hint={perSeat ? 'Billed monthly × active seat count' : null}>
                        <NumberInput
                            value={form.price}
                            onChange={v => update('price', v)}
                            placeholder="0.00 (free)"
                            step="0.01"
                            min="0"
                            allowDecimal
                        />
                    </Field>
                )}
                {metered && (
                    <Field label="Markup %" hint="on top of raw AI provider cost">
                        <NumberInput
                            value={form.markup_percent ?? 0}
                            onChange={v => update('markup_percent', v ?? 0)}
                            placeholder="20"
                            step="0.1"
                            min="0"
                            max="1000"
                            allowDecimal
                        />
                    </Field>
                )}
                <Field label="Currency">
                    <Select value={form.currency} onChange={e => update('currency', e.target.value)}>
                        <option value="EUR">EUR (€)</option>
                        <option value="USD">USD ($)</option>
                        <option value="GBP">GBP (£)</option>
                    </Select>
                </Field>
                <Field label="Billing interval">
                    <Select value={form.billing_interval} onChange={e => update('billing_interval', e.target.value)}>
                        <option value="monthly">Monthly</option>
                        <option value="yearly">Yearly</option>
                    </Select>
                </Field>
                <Field label="Sort order" hint="lower numbers appear first">
                    <NumberInput
                        value={form.sort_order}
                        onChange={v => update('sort_order', v ?? 0)}
                        min="0"
                        placeholder="0"
                    />
                </Field>
            </div>

            {metered && (
                <Banner tone="success" icon={Info}>
                    Example: a {sym}1.00 raw call bills at{' '}
                    <strong>{sym}{(1 * (1 + (Number(form.markup_percent) || 0) / 100)).toFixed(4)}</strong>.{' '}
                    Subscribers are billed by Stripe at the end of each {form.billing_interval === 'yearly' ? 'year' : 'month'} for the
                    summed marked-up cost of their AI calls. A payment method is required up front — trials are not supported on PAYG plans.
                </Banner>
            )}
        </div>
    );
}
