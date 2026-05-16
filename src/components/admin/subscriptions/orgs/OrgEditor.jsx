import React, { useState } from 'react';
import { ArrowLeft, Save, Trash2, Shield, CalendarPlus, Clock } from 'lucide-react';
import { Button } from '../ui/Button';
import { IconButton } from '../ui/IconButton';
import { Card } from '../ui/Card';
import { Banner } from '../ui/Banner';
import { Field, Select, Textarea } from '../ui/Input';
import { LimitField } from '../ui/LimitField';
import { UsageBar } from '../ui/UsageBar';
import { LIMIT_FIELDS, AGENT_TYPES } from '../constants';
import { NumberInput } from '../ui/Input';
import { useToast } from '../ui/Toast';

function AgentTypeOverrides({ values = {}, planDefaults, onChange }) {
    const updateType = (key, val) => {
        const next = { ...values };
        if (val == null) delete next[key];
        else next[key] = val;
        onChange(Object.keys(next).length > 0 ? next : null);
    };

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 p-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-default)]">
            {AGENT_TYPES.map(t => (
                <Field key={t.key} label={
                    <span className="inline-flex items-center gap-2">
                        <span className={`inline-block w-2 h-2 rounded-full ${t.dot}`} />
                        {t.label}
                    </span>
                }>
                    <NumberInput
                        value={values?.[t.key] ?? null}
                        onChange={v => updateType(t.key, v)}
                        placeholder={planDefaults?.[t.key] != null ? `Plan: ${planDefaults[t.key].toLocaleString()}` : 'Unlimited'}
                    />
                </Field>
            ))}
        </div>
    );
}

export function OrgEditor({ orgSub, plans, onBack, onSave, onRemove, onStartTrial }) {
    const [form, setForm] = useState({
        plan_id:                orgSub?.plan_id || '',
        status:                 orgSub?.status || 'active',
        max_messages_per_month: orgSub?.max_messages_per_month ?? null,
        max_messages_by_type:   orgSub?.max_messages_by_type   || null,
        max_tokens_per_month:   orgSub?.max_tokens_per_month   ?? null,
        max_cost_per_month:     orgSub?.max_cost_per_month     ?? null,
        max_users:              orgSub?.max_users              ?? null,
        max_agents:             orgSub?.max_agents             ?? null,
        max_knowledge_sources:  orgSub?.max_knowledge_sources  ?? null,
        allowed_features:       orgSub?.allowed_features       || null,
        notes:                  orgSub?.notes                  || '',
    });
    const [saving, setSaving]       = useState(false);
    const [trialBusy, setTrialBusy] = useState(false);
    const toast = useToast();

    const update = (key, val) => setForm(f => ({ ...f, [key]: val }));
    const selectedPlan = plans.find(p => p.id === form.plan_id);
    const trialUsedAt  = orgSub?.org_trial_used_at || null;
    const hasActiveSub = ['active', 'trialing'].includes(orgSub?.status);
    const trialEligible = !trialUsedAt
        && !hasActiveSub
        && selectedPlan
        && selectedPlan.trial_days > 0
        && !!selectedPlan.stripe_price_id;

    const handleStartTrial = async () => {
        if (!selectedPlan) return;
        setTrialBusy(true);
        try {
            await onStartTrial(selectedPlan.id);
            toast.success('Trial started.');
        } catch (e) {
            toast.error(e.message || 'Failed to start trial');
        } finally {
            setTrialBusy(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await onSave(form);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="absolute inset-0 flex flex-col bg-[var(--bg-primary)]">
            <header className="shrink-0 flex items-center gap-3 px-6 py-3 border-b border-[var(--border-default)] bg-[var(--bg-secondary)]">
                <IconButton icon={ArrowLeft} size="sm" onClick={onBack} title="Back to orgs" />
                <div className="min-w-0">
                    <div className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-semibold">Organization subscription</div>
                    <h1 className="text-[16px] font-bold text-[var(--text-primary)] truncate">{orgSub?.org_name || 'Organization'}</h1>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto">
                <div className="max-w-2xl mx-auto px-6 py-6 pb-32 space-y-6">
                    {orgSub?.current_usage && (
                        <Card>
                            <div className="text-[12px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3">Current month usage</div>
                            <UsageBar label="Messages" current={orgSub.current_usage.messages} limit={orgSub.effective_limits?.max_messages_per_month} />
                            <UsageBar label="Tokens"   current={orgSub.current_usage.tokens}   limit={orgSub.effective_limits?.max_tokens_per_month} />
                            <UsageBar label="Cost"     current={orgSub.current_usage.cost}     limit={orgSub.effective_limits?.max_cost_per_month} unit="€" />
                        </Card>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                        <Field label="Plan">
                            <Select value={form.plan_id} onChange={e => update('plan_id', e.target.value)}>
                                <option value="">No plan (custom)</option>
                                {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </Select>
                        </Field>
                        <Field label="Status">
                            <Select value={form.status} onChange={e => update('status', e.target.value)}>
                                <option value="active">Active</option>
                                <option value="suspended">Suspended</option>
                                <option value="cancelled">Cancelled</option>
                                {orgSub?.status === 'trialing' && <option value="trialing">Trialing</option>}
                            </Select>
                        </Field>
                    </div>

                    {trialEligible && (
                        <Banner tone="teal" icon={CalendarPlus} title={`${selectedPlan.trial_days}-day Stripe trial available`}>
                            <div className="flex items-center justify-between gap-3">
                                <span>One-time per organization. No payment method required up front — Stripe will auto-cancel if no card is added before the trial ends.</span>
                                <Button variant="secondary" size="sm" icon={CalendarPlus} onClick={handleStartTrial} busy={trialBusy}>
                                    {trialBusy ? 'Starting…' : 'Start trial'}
                                </Button>
                            </div>
                        </Banner>
                    )}
                    {trialUsedAt && (
                        <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                            <Clock className="w-3.5 h-3.5" /> Trial used on {new Date(trialUsedAt).toLocaleDateString()}
                        </div>
                    )}

                    <div>
                        <h3 className="flex items-center gap-2 text-[13px] font-semibold text-[var(--text-primary)] mb-3">
                            <Shield className="w-4 h-4 text-teal-400" />
                            Limit overrides
                            <span className="font-normal text-[11px] text-[var(--text-muted)]">— toggle Override to set per-org caps</span>
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                            {LIMIT_FIELDS.map(f => (
                                <LimitField
                                    key={f.key}
                                    field={f}
                                    value={form[f.key]}
                                    onChange={v => update(f.key, v)}
                                    planDefault={selectedPlan?.[f.key]}
                                    showOverride
                                />
                            ))}
                        </div>
                    </div>

                    <div>
                        <h3 className="text-[13px] font-semibold text-[var(--text-primary)] mb-2">Per agent-type overrides</h3>
                        <AgentTypeOverrides
                            values={form.max_messages_by_type || {}}
                            planDefaults={selectedPlan?.max_messages_by_type}
                            onChange={v => update('max_messages_by_type', v)}
                        />
                    </div>

                    <Field label="Notes" hint="internal, not visible to the org">
                        <Textarea
                            value={form.notes}
                            onChange={e => update('notes', e.target.value)}
                            placeholder="Internal notes about this subscription"
                            rows={2}
                        />
                    </Field>
                </div>
            </div>

            <footer className="shrink-0 border-t border-[var(--border-default)] bg-[var(--bg-secondary)] px-6 py-3 flex items-center justify-between gap-3">
                <Button variant="danger" icon={Trash2} onClick={onRemove} size="sm">Remove subscription</Button>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" onClick={onBack}>Cancel</Button>
                    <Button variant="primary" icon={Save} onClick={handleSave} busy={saving}>
                        {saving ? 'Saving…' : 'Save changes'}
                    </Button>
                </div>
            </footer>
        </div>
    );
}
