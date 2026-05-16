import React from 'react';
import { CalendarPlus, AlertTriangle } from 'lucide-react';
import { Field, NumberInput } from '../../ui/Input';
import { Toggle } from '../../ui/Toggle';
import { Banner } from '../../ui/Banner';
import { Card } from '../../ui/Card';
import { StatGrid, StatRow } from '../../ui/StatRow';
import { LIMIT_FIELDS } from '../../constants';

export function TrialSection({ form, update }) {
    const trialEnabled = (form.trial_days || 0) > 0;
    const meteredBlocked = form.billing_model === 'metered';

    return (
        <div className="space-y-5">
            <div>
                <h3 className="text-[15px] font-bold text-[var(--text-primary)] mb-1">Trial</h3>
                <p className="text-[12px] text-[var(--text-muted)]">Offer a free trial period that converts to the paid plan when it ends.</p>
            </div>

            <Banner tone="teal" icon={CalendarPlus}>
                Trial of <em className="not-italic font-semibold">{form.name || 'this plan'}</em> inherits all limits and features from the
                paid plan — admin only sets how long it lasts. After the trial ends, the same plan continues as paid.
            </Banner>

            {meteredBlocked && (
                <Banner tone="warning" icon={AlertTriangle}>
                    Trials aren't available for pay-as-you-go plans — Stripe requires a payment method up front.
                </Banner>
            )}

            <Toggle
                checked={trialEnabled}
                disabled={meteredBlocked}
                onChange={checked => update('trial_days', checked ? (form.trial_days > 0 ? form.trial_days : 14) : 0)}
                icon={CalendarPlus}
                iconClass="text-emerald-400"
                label="Offer a free trial for this plan"
                description={meteredBlocked ? 'Pay-as-you-go plans cannot offer a trial.' : 'Stripe will hold off charging until the trial period ends.'}
            />

            {trialEnabled && !meteredBlocked && (
                <>
                    <Field label="Trial duration (days)" hint="length of the free period before Stripe starts charging">
                        <NumberInput
                            value={form.trial_days}
                            onChange={v => update('trial_days', v == null ? 0 : Math.max(1, v))}
                            min={1}
                            max={365}
                            placeholder="14"
                        />
                    </Field>

                    <Card className="!p-4">
                        <div className="text-[12px] font-bold text-[var(--text-secondary)] mb-2">Limits during trial (inherited)</div>
                        <StatGrid>
                            {LIMIT_FIELDS.map(f => (
                                <StatRow
                                    key={f.key}
                                    label={f.label}
                                    value={form[f.key]}
                                    unit={f.type === 'currency' ? '€' : ''}
                                />
                            ))}
                        </StatGrid>
                        <div className="mt-3 text-[11px] text-[var(--text-muted)]">
                            To change these, jump to the <strong>Limits</strong> section.
                        </div>
                    </Card>

                    <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                        To auto-grant this trial on every new {form.plan_type === 'consumer' ? 'personal account' : 'organization'} signup, pick this plan in the <strong>Trial offers</strong> panel on the Plans list. Each {form.plan_type === 'consumer' ? 'user' : 'org'} can only use a trial once.
                    </p>
                </>
            )}
        </div>
    );
}
