import React, { useEffect, useState } from 'react';
import { CalendarPlus, Building2, Users, Save } from 'lucide-react';
import { Card, CardHeader } from '../ui/Card';
import { Field, Select } from '../ui/Input';
import { Button } from '../ui/Button';
import { apiJson } from '../hooks/useApi';
import { useToast } from '../ui/Toast';

export function TrialOffersPanel({ plans }) {
    const [cfg, setCfg] = useState({ default_org_trial_plan_id: '', default_consumer_trial_plan_id: '' });
    const [loaded, setLoaded] = useState(false);
    const [busy, setBusy] = useState(false);
    const toast = useToast();

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const data = await apiJson('/api/subscriptions/trial-config');
                if (!alive) return;
                setCfg({
                    default_org_trial_plan_id:      data.default_org_trial_plan_id      || '',
                    default_consumer_trial_plan_id: data.default_consumer_trial_plan_id || '',
                });
            } catch (e) {
                console.warn('Failed to load trial config:', e);
            } finally {
                if (alive) setLoaded(true);
            }
        })();
        return () => { alive = false; };
    }, []);

    const eligible = (planType) => plans.filter(p =>
        (p.plan_type || 'organization') === planType
        && p.trial_days > 0
        && !!p.stripe_price_id
    );
    const orgOptions      = eligible('organization');
    const consumerOptions = eligible('consumer');

    const orgPlan      = plans.find(p => p.id === cfg.default_org_trial_plan_id);
    const consumerPlan = plans.find(p => p.id === cfg.default_consumer_trial_plan_id);

    const save = async () => {
        setBusy(true);
        try {
            await apiJson('/api/subscriptions/trial-config', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(cfg),
            });
            toast.success('Trial offers saved.');
        } catch (e) {
            toast.error(e.message || 'Save failed');
        } finally {
            setBusy(false);
        }
    };

    if (!loaded) return null;

    return (
        <Card className="!p-5 mb-6" accent="emerald">
            <CardHeader
                icon={CalendarPlus}
                iconClass="text-emerald-400"
                title="Trial offers"
                subtitle="Pick the plans that new organizations and personal accounts get as a free trial on signup. Trial length comes from the plan itself. Each org / user can only use a trial once."
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <Field
                    label={
                        <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--text-secondary)]">
                            <Building2 className="w-3.5 h-3.5 text-sky-400" /> Organization trial plan
                        </span>
                    }
                >
                    <Select
                        value={cfg.default_org_trial_plan_id}
                        onChange={e => setCfg(c => ({ ...c, default_org_trial_plan_id: e.target.value }))}
                    >
                        <option value="">— No auto-trial for new orgs —</option>
                        {orgOptions.map(p => (
                            <option key={p.id} value={p.id}>{p.name} · {p.trial_days}d trial</option>
                        ))}
                    </Select>
                    {orgPlan && (
                        <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                            New orgs receive a {orgPlan.trial_days}-day trial of <strong>{orgPlan.name}</strong>.
                        </p>
                    )}
                    {orgOptions.length === 0 && (
                        <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                            No org plans with trial_days {'>'} 0 and a Stripe price yet. Edit a plan to enable.
                        </p>
                    )}
                </Field>

                <Field
                    label={
                        <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--text-secondary)]">
                            <Users className="w-3.5 h-3.5 text-emerald-400" /> Personal-account trial plan
                        </span>
                    }
                >
                    <Select
                        value={cfg.default_consumer_trial_plan_id}
                        onChange={e => setCfg(c => ({ ...c, default_consumer_trial_plan_id: e.target.value }))}
                    >
                        <option value="">— No auto-trial for new personal accounts —</option>
                        {consumerOptions.map(p => (
                            <option key={p.id} value={p.id}>{p.name} · {p.trial_days}d trial</option>
                        ))}
                    </Select>
                    {consumerPlan && (
                        <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                            New personal accounts receive a {consumerPlan.trial_days}-day trial of <strong>{consumerPlan.name}</strong>.
                        </p>
                    )}
                    {consumerOptions.length === 0 && (
                        <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                            No consumer plans with trial_days {'>'} 0 and a Stripe price yet.
                        </p>
                    )}
                </Field>
            </div>

            <Button onClick={save} busy={busy} icon={Save} variant="secondary">
                {busy ? 'Saving…' : 'Save trial offers'}
            </Button>
        </Card>
    );
}
