import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Plus, CheckCircle, Copy, Mail, Save } from 'lucide-react';
import { Button } from '../ui/Button';
import { IconButton } from '../ui/IconButton';
import { Card } from '../ui/Card';
import { Banner } from '../ui/Banner';
import { Field, Input, Select, Textarea } from '../ui/Input';
import { useToast } from '../ui/Toast';
import { apiJson } from '../hooks/useApi';
import { TIER_PRESETS, EXPIRY_PRESETS } from '../constants';

const STEPS = [
    { id: 'org',     label: 'Organization' },
    { id: 'details', label: 'Tier & expiry' },
    { id: 'review',  label: 'Review & deliver' },
];

export function GrantWizard({ orgs, tiers, onBack, onCreated }) {
    const toast = useToast();
    const [step, setStep] = useState(0);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [result, setResult] = useState(null);
    const [form, setForm] = useState({
        scope: 'organization',
        organizationId: '',
        tier: 'enterprise',
        expiresAt: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
        billingInterval: 'yearly',
        notes: '',
        showAdvanced: false,
        featuresOverride: '',
        limitsOverrideJson: '',
        maxSeats: '',
        deliverEmail: '',
    });
    const update = (k, v) => setForm(f => ({ ...f, [k]: v }));
    const selectedOrg = orgs.find(o => o.id === form.organizationId);
    const isServerScope = form.scope === 'server';

    const applyExpiry = (days) => update('expiresAt', new Date(Date.now() + days * 86400000).toISOString().slice(0, 10));

    const canNext =
        (step === 0 && (isServerScope || form.organizationId)) ||
        (step === 1 && form.tier && form.expiresAt) ||
        step === 2;

    const submit = async () => {
        setError(null);
        setBusy(true);
        try {
            const body = {
                scope: form.scope,
                organizationId: isServerScope ? null : form.organizationId,
                tier: form.tier,
                expiresAt: new Date(form.expiresAt + 'T23:59:59Z').toISOString(),
                billingInterval: form.billingInterval,
                notes: form.notes || null,
            };
            if (form.deliverEmail.trim()) body.deliverEmail = form.deliverEmail.trim();
            if (form.showAdvanced) {
                if (form.featuresOverride.trim()) {
                    body.featuresOverride = form.featuresOverride.split(',').map(s => s.trim()).filter(Boolean);
                }
                if (form.limitsOverrideJson.trim()) {
                    try { body.limitsOverride = JSON.parse(form.limitsOverrideJson); }
                    catch { throw new Error('Limits override must be valid JSON, e.g. {"max_users":50}'); }
                }
                if (form.maxSeats) body.maxSeats = parseInt(form.maxSeats, 10);
            }
            const res = await apiJson('/api/admin/licenses/grant', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            setResult({ blob: res.blob, delivery: res.emailDelivery || null });
            toast.success('License granted.');
        } catch (e) {
            setError(e.message);
        } finally {
            setBusy(false);
        }
    };

    const copyBlob = async () => {
        if (!result?.blob) return;
        try { await navigator.clipboard.writeText(result.blob); toast.success('Blob copied to clipboard.'); }
        catch { window.prompt('Copy this blob:', result.blob); }
    };

    const finish = () => {
        onCreated();
    };

    return (
        <div className="absolute inset-0 flex flex-col bg-[var(--bg-primary)]">
            <header className="shrink-0 flex items-center gap-3 px-6 py-3 border-b border-[var(--border-default)] bg-[var(--bg-secondary)]">
                <IconButton icon={ArrowLeft} size="sm" onClick={onBack} title="Back to grants" />
                <div className="min-w-0">
                    <div className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-semibold">Issue admin license</div>
                    <h1 className="text-[16px] font-bold text-[var(--text-primary)] truncate">
                        {isServerScope ? 'Server license (no org)' : (selectedOrg?.name || 'Pick organization')}
                    </h1>
                </div>
                <div className="ml-auto hidden sm:flex items-center gap-2">
                    {STEPS.map((s, idx) => (
                        <div key={s.id} className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-full inline-flex items-center justify-center text-[11px] font-bold ${
                                idx <  step ? 'bg-emerald-500 text-white' :
                                idx === step ? 'bg-blue-500 text-white' :
                                               'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
                            }`}>
                                {idx < step ? <CheckCircle className="w-3.5 h-3.5" /> : idx + 1}
                            </div>
                            <span className={`text-[12px] ${idx === step ? 'font-semibold text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>{s.label}</span>
                            {idx < STEPS.length - 1 && <span className="text-[var(--text-muted)]">→</span>}
                        </div>
                    ))}
                </div>
            </header>

            <div className="flex-1 overflow-y-auto">
                <div className="max-w-xl mx-auto px-6 py-8 pb-32 space-y-5">
                    {error && <Banner tone="danger">{error}</Banner>}

                    {step === 0 && (
                        <>
                            <Field label="Scope" hint="A server license is not bound to an org — the receiver re-binds on import.">
                                <div className="flex flex-col gap-2">
                                    <label className="flex items-start gap-2 cursor-pointer p-2 rounded-md border border-[var(--border-default)] hover:bg-[var(--bg-tertiary)]">
                                        <input
                                            type="radio"
                                            name="grant-scope"
                                            value="organization"
                                            checked={form.scope === 'organization'}
                                            onChange={() => update('scope', 'organization')}
                                            className="mt-0.5"
                                        />
                                        <span className="text-[13px]">
                                            <span className="block font-semibold text-[var(--text-primary)]">Bind to organisation</span>
                                            <span className="block text-[12px] text-[var(--text-muted)]">Standard grant for a specific org on this install.</span>
                                        </span>
                                    </label>
                                    <label className="flex items-start gap-2 cursor-pointer p-2 rounded-md border border-[var(--border-default)] hover:bg-[var(--bg-tertiary)]">
                                        <input
                                            type="radio"
                                            name="grant-scope"
                                            value="server"
                                            checked={form.scope === 'server'}
                                            onChange={() => update('scope', 'server')}
                                            className="mt-0.5"
                                        />
                                        <span className="text-[13px]">
                                            <span className="block font-semibold text-[var(--text-primary)]">Server license (no org)</span>
                                            <span className="block text-[12px] text-[var(--text-muted)]">Issue an unbound blob to hand to another install — they bind it locally.</span>
                                        </span>
                                    </label>
                                </div>
                            </Field>
                            {!isServerScope && (
                                <Field label="Organization">
                                    <Select value={form.organizationId} onChange={e => update('organizationId', e.target.value)}>
                                        <option value="">— Select organization —</option>
                                        {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                                    </Select>
                                </Field>
                            )}
                        </>
                    )}

                    {step === 1 && (
                        <>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                                <Field label="Tier">
                                    <Select value={form.tier} onChange={e => update('tier', e.target.value)}>
                                        {(tiers || TIER_PRESETS).map(t => <option key={t} value={t}>{t}</option>)}
                                    </Select>
                                </Field>
                                <Field label="Billing interval">
                                    <Select value={form.billingInterval} onChange={e => update('billingInterval', e.target.value)}>
                                        <option value="monthly">Monthly</option>
                                        <option value="yearly">Yearly</option>
                                    </Select>
                                </Field>
                            </div>

                            <Field label="Expires on">
                                <Input type="date" value={form.expiresAt} onChange={e => update('expiresAt', e.target.value)} />
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                    {EXPIRY_PRESETS.map(p => (
                                        <button
                                            key={p.label}
                                            type="button"
                                            onClick={() => applyExpiry(p.days)}
                                            className="px-2.5 py-1 text-[11px] font-semibold rounded-md border border-[var(--border-default)] bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]"
                                        >
                                            {p.label}
                                        </button>
                                    ))}
                                </div>
                            </Field>

                            <Field label="Notes" hint="audit log only">
                                <Textarea
                                    value={form.notes}
                                    onChange={e => update('notes', e.target.value)}
                                    placeholder="e.g. Comp for partner X — internal trial through end of Q2"
                                    rows={2}
                                />
                            </Field>

                            <Field label="Email blob to customer" hint="optional, requires service email configured">
                                <Input
                                    type="email"
                                    value={form.deliverEmail}
                                    onChange={e => update('deliverEmail', e.target.value)}
                                    placeholder="customer@example.com"
                                />
                            </Field>

                            <details
                                className="mt-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-tertiary)]"
                                open={form.showAdvanced}
                            >
                                <summary
                                    className="px-3 py-2 text-[12.5px] font-semibold cursor-pointer text-[var(--text-secondary)]"
                                    onClick={e => { e.preventDefault(); update('showAdvanced', !form.showAdvanced); }}
                                >
                                    Advanced overrides
                                </summary>
                                {form.showAdvanced && (
                                    <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-[var(--border-default)]">
                                        <Field label="Features override" hint="comma-separated; blank = tier defaults" className="sm:col-span-2">
                                            <Input
                                                value={form.featuresOverride}
                                                onChange={e => update('featuresOverride', e.target.value)}
                                                placeholder="automations, multi_user, kb_unlimited"
                                            />
                                        </Field>
                                        <Field label="Limits override (JSON)" hint="merged into tier defaults">
                                            <Input
                                                value={form.limitsOverrideJson}
                                                onChange={e => update('limitsOverrideJson', e.target.value)}
                                                placeholder='{"max_users":100,"max_agents":50}'
                                            />
                                        </Field>
                                        <Field label="Max seats">
                                            <Input
                                                type="number"
                                                min="0"
                                                value={form.maxSeats}
                                                onChange={e => update('maxSeats', e.target.value)}
                                                placeholder="(empty = no cap)"
                                            />
                                        </Field>
                                    </div>
                                )}
                            </details>
                        </>
                    )}

                    {step === 2 && !result && (
                        <Card>
                            <div className="text-[12px] uppercase tracking-wider font-bold text-[var(--text-muted)] mb-3">Review</div>
                            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
                                <dt className="text-[var(--text-muted)]">Scope</dt>
                                <dd className="text-[var(--text-primary)] font-semibold">{isServerScope ? 'Server license (no org)' : 'Organisation'}</dd>
                                {!isServerScope && (
                                    <>
                                        <dt className="text-[var(--text-muted)]">Organization</dt>
                                        <dd className="text-[var(--text-primary)] font-semibold">{selectedOrg?.name}</dd>
                                    </>
                                )}
                                <dt className="text-[var(--text-muted)]">Tier</dt><dd className="text-[var(--text-primary)] font-semibold capitalize">{form.tier}</dd>
                                <dt className="text-[var(--text-muted)]">Billing</dt><dd className="text-[var(--text-primary)] font-semibold capitalize">{form.billingInterval}</dd>
                                <dt className="text-[var(--text-muted)]">Expires</dt><dd className="text-[var(--text-primary)] font-semibold">{new Date(form.expiresAt).toLocaleDateString()}</dd>
                                {form.deliverEmail && (<><dt className="text-[var(--text-muted)]">Email to</dt><dd className="text-[var(--text-primary)]">{form.deliverEmail}</dd></>)}
                                {form.notes && (<><dt className="text-[var(--text-muted)]">Notes</dt><dd className="text-[var(--text-primary)]">{form.notes}</dd></>)}
                            </dl>
                        </Card>
                    )}

                    {result && (
                        <Banner tone="success" icon={CheckCircle} title="License granted — copy the blob to re-import on another install:">
                            <div className="mt-2 flex items-center gap-2">
                                <code className="flex-1 p-2 rounded bg-[var(--bg-tertiary)] text-[10.5px] break-all text-[var(--text-secondary)]">{result.blob}</code>
                                <Button size="sm" icon={Copy} onClick={copyBlob}>Copy</Button>
                            </div>
                            {result.delivery && (
                                <div className={`mt-2 text-[11.5px] inline-flex items-center gap-1.5 ${result.delivery.success ? 'text-emerald-300' : 'text-amber-300'}`}>
                                    <Mail className="w-3.5 h-3.5" />
                                    {result.delivery.success
                                        ? `Emailed to customer (message id: ${result.delivery.messageId || 'n/a'})`
                                        : `Email delivery failed: ${result.delivery.error || 'unknown error'} — copy the blob and send manually.`}
                                </div>
                            )}
                        </Banner>
                    )}
                </div>
            </div>

            <footer className="shrink-0 border-t border-[var(--border-default)] bg-[var(--bg-secondary)] px-6 py-3 flex items-center justify-between gap-3">
                <Button variant="ghost" onClick={onBack}>Cancel</Button>
                <div className="flex items-center gap-2">
                    {step > 0 && !result && <Button variant="secondary" icon={ArrowLeft} onClick={() => setStep(s => s - 1)}>Back</Button>}
                    {step < 2 && !result && (
                        <Button
                            variant="primary"
                            iconRight={<ArrowRight className="w-4 h-4" />}
                            onClick={() => setStep(s => s + 1)}
                            disabled={!canNext}
                        >
                            Next
                        </Button>
                    )}
                    {step === 2 && !result && (
                        <Button variant="primary" icon={Plus} onClick={submit} busy={busy}>
                            {busy ? 'Granting…' : 'Grant license'}
                        </Button>
                    )}
                    {result && (
                        <Button variant="primary" icon={Save} onClick={finish}>Done</Button>
                    )}
                </div>
            </footer>
        </div>
    );
}
