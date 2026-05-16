import React, { useState } from 'react';
import { CalendarPlus, CheckCircle, Clock } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Field, Select } from '../ui/Input';
import { Button } from '../ui/Button';
import { Banner } from '../ui/Banner';
import { useToast } from '../ui/Toast';

export function QuickAssignDialog({ org, plans, onClose, onSave, onStartTrial }) {
    const [planId, setPlanId]     = useState(plans.find(p => p.is_default)?.id || '');
    const [status, setStatus]     = useState('active');
    const [trialBusy, setTrialBusy] = useState(false);
    const [busy, setBusy]         = useState(false);
    const toast = useToast();

    const selectedPlan = plans.find(p => p.id === planId);
    const trialEligible = !org.trial_used_at
        && selectedPlan
        && selectedPlan.trial_days > 0
        && !!selectedPlan.stripe_price_id;

    const startTrial = async () => {
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

    const handleAssign = async () => {
        setBusy(true);
        try {
            await onSave({ plan_id: planId || null, status });
            toast.success('Subscription assigned.');
        } catch (e) {
            toast.error(e.message || 'Assign failed');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal
            open
            onClose={busy || trialBusy ? undefined : onClose}
            title="Assign subscription"
            subtitle={<>for <strong className="text-[var(--text-primary)]">{org.name}</strong></>}
            width="max-w-md"
            footer={
                <>
                    <Button variant="ghost" onClick={onClose} disabled={busy || trialBusy}>Cancel</Button>
                    {trialEligible && (
                        <Button variant="secondary" icon={CalendarPlus} onClick={startTrial} busy={trialBusy}>
                            {trialBusy ? 'Starting…' : 'Start trial'}
                        </Button>
                    )}
                    <Button variant="primary" icon={CheckCircle} onClick={handleAssign} busy={busy}>
                        {busy ? 'Assigning…' : 'Assign'}
                    </Button>
                </>
            }
        >
            <div className="space-y-3">
                <Field label="Plan">
                    <Select value={planId} onChange={e => setPlanId(e.target.value)}>
                        <option value="">No plan (custom limits)</option>
                        {plans.map(p => (
                            <option key={p.id} value={p.id}>
                                {p.name}{p.is_default ? ' ★' : ''}{p.trial_days > 0 ? ` · ${p.trial_days}d trial` : ''}
                            </option>
                        ))}
                    </Select>
                </Field>
                <Field label="Status">
                    <Select value={status} onChange={e => setStatus(e.target.value)}>
                        <option value="active">Active</option>
                        <option value="suspended">Suspended</option>
                    </Select>
                </Field>

                {trialEligible && (
                    <Banner tone="teal" icon={CalendarPlus} title={`${selectedPlan.trial_days}-day Stripe trial available`}>
                        One-time per organization. Use “Start trial” to activate via Stripe instead of a direct assign.
                    </Banner>
                )}
                {org.trial_used_at && (
                    <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                        <Clock className="w-3.5 h-3.5" /> Trial used on {new Date(org.trial_used_at).toLocaleDateString()}
                    </div>
                )}
            </div>
        </Modal>
    );
}
