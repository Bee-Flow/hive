import React, { useEffect, useState } from 'react';
import { CreditCard, Settings, Shield, Euro, ExternalLink, CheckCircle, Loader2 } from 'lucide-react';
import { SectionHeader } from '../ui/SectionHeader';
import { Card, CardHeader } from '../ui/Card';
import { Toggle } from '../ui/Toggle';
import { Field, Select } from '../ui/Input';
import { Banner } from '../ui/Banner';
import { Badge, Dot } from '../ui/Badge';
import { Spinner } from '../ui/Spinner';
import { apiJson } from '../hooks/useApi';
import { useToast } from '../ui/Toast';
import { StripeKeyField } from './StripeKeyField';

const TAX_COUNTRIES = [
    { value: 'NL', label: '🇳🇱 Netherlands' },
    { value: 'DE', label: '🇩🇪 Germany' },
    { value: 'BE', label: '🇧🇪 Belgium' },
    { value: 'FR', label: '🇫🇷 France' },
    { value: 'IE', label: '🇮🇪 Ireland' },
    { value: 'ES', label: '🇪🇸 Spain' },
    { value: 'IT', label: '🇮🇹 Italy' },
    { value: 'AT', label: '🇦🇹 Austria' },
    { value: 'SE', label: '🇸🇪 Sweden' },
    { value: 'FI', label: '🇫🇮 Finland' },
];

export function StripeView() {
    const toast = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [config, setConfig] = useState({
        hasStripeSecretKey: false,
        hasStripeWebhookSecret: false,
        stripePublishableKey: '',
        stripeEnabled: false,
        stripeTaxEnabled: false,
        stripeTaxCountry: 'NL',
    });
    const [secretKey, setSecretKey]         = useState('');
    const [webhookSecret, setWebhookSecret] = useState('');
    const [publishableKey, setPublishableKey] = useState('');

    const load = async () => {
        try {
            const data = await apiJson('/ai/config');
            setConfig({
                hasStripeSecretKey:     !!data.hasStripeSecretKey,
                hasStripeWebhookSecret: !!data.hasStripeWebhookSecret,
                stripePublishableKey:   data.stripePublishableKey || '',
                stripeEnabled:          !!data.stripeEnabled,
                stripeTaxEnabled:       !!data.stripeTaxEnabled,
                stripeTaxCountry:       data.stripeTaxCountry || 'NL',
            });
            setPublishableKey(data.stripePublishableKey || '');
        } catch (e) { /* ignore */ }
        finally { setLoading(false); }
    };

    useEffect(() => { load(); }, []);

    const saveField = async (payload) => {
        setSaving(true);
        try {
            await apiJson('/ai/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            toast.success('Saved.');
            await load();
        } catch (e) { toast.error(e.message || 'Failed to save'); }
        finally { setSaving(false); }
    };

    const deleteKey = async (keyName) => {
        setSaving(true);
        try {
            await apiJson(`/ai/config/key/${keyName}`, { method: 'DELETE' });
            toast.success('Key removed.');
            await load();
        } catch (e) { toast.error('Failed to remove key'); }
        finally { setSaving(false); }
    };

    if (loading) return <Spinner label="Loading Stripe settings…" />;

    const webhookURL = `${window.location.origin}/api/stripe/webhook`;

    return (
        <div className="px-6 py-6 max-w-2xl mx-auto">
            <SectionHeader
                title="Stripe Payment Integration"
                description="Connect Stripe to enable subscription billing for your plans."
            />

            {/* Connection status */}
            <Card className="mb-4" accent={config.stripeEnabled ? 'emerald' : undefined}>
                <CardHeader
                    icon={Settings}
                    iconClass="text-blue-400"
                    title="Connection status"
                    action={
                        <div className="flex items-center gap-2">
                            <span className={`text-[11px] font-bold uppercase tracking-wider ${config.stripeEnabled ? 'text-emerald-400' : 'text-[var(--text-muted)]'}`}>
                                {config.stripeEnabled ? 'Enabled' : 'Disabled'}
                            </span>
                            <Toggle
                                checked={config.stripeEnabled}
                                disabled={!config.hasStripeSecretKey && !config.stripeEnabled}
                                onChange={v => saveField({ stripeEnabled: v })}
                            />
                        </div>
                    }
                />
                <div className="flex flex-col gap-1.5 text-[12.5px]">
                    {[
                        { ok: config.hasStripeSecretKey,    label: 'Secret key' },
                        { ok: !!config.stripePublishableKey, label: 'Publishable key' },
                        { ok: config.hasStripeWebhookSecret, label: 'Webhook secret' },
                    ].map(row => (
                        <div key={row.label} className="flex items-center gap-2">
                            <Dot tone={row.ok ? 'success' : 'danger'} />
                            <span className="text-[var(--text-secondary)]">{row.label}</span>
                            <span className={`ml-auto font-semibold ${row.ok ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {row.ok ? 'Configured' : 'Not configured'}
                            </span>
                        </div>
                    ))}
                </div>
            </Card>

            {/* API keys */}
            <Card className="mb-4">
                <CardHeader
                    icon={Shield}
                    iconClass="text-blue-400"
                    title="API keys"
                    subtitle={
                        <>Get your keys from the{' '}
                            <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 font-semibold inline-flex items-center gap-0.5">
                                Stripe Dashboard <ExternalLink className="w-3 h-3" />
                            </a>
                        </>
                    }
                />
                <StripeKeyField
                    label="Secret key"
                    type="password"
                    configured={config.hasStripeSecretKey}
                    placeholderConfigured="••••••••••••••••••"
                    placeholderEmpty="sk_live_… or sk_test_…"
                    value={secretKey}
                    onChange={setSecretKey}
                    onSave={() => { saveField({ stripeSecretKey: secretKey }); setSecretKey(''); }}
                    onClear={() => deleteKey('stripe_secret_key')}
                    busy={saving}
                />
                <StripeKeyField
                    label="Publishable key"
                    type="text"
                    configured={!!config.stripePublishableKey}
                    placeholderConfigured="pk_live_… or pk_test_…"
                    placeholderEmpty="pk_live_… or pk_test_…"
                    value={publishableKey}
                    onChange={setPublishableKey}
                    onSave={() => saveField({ stripePublishableKey: publishableKey })}
                    busy={saving}
                />
                <StripeKeyField
                    label="Webhook signing secret"
                    type="password"
                    configured={config.hasStripeWebhookSecret}
                    placeholderConfigured="••••••••••••••••••"
                    placeholderEmpty="whsec_…"
                    value={webhookSecret}
                    onChange={setWebhookSecret}
                    onSave={() => { saveField({ stripeWebhookSecret: webhookSecret }); setWebhookSecret(''); }}
                    onClear={() => deleteKey('stripe_webhook_secret')}
                    busy={saving}
                />
            </Card>

            {/* Tax & Region */}
            <Card className="mb-4">
                <CardHeader
                    icon={Euro}
                    iconClass="text-emerald-400"
                    title="Tax & region (EU compliance)"
                    subtitle={
                        <>Configure Stripe Tax for automatic VAT calculation.{' '}
                            <a href="https://stripe.com/tax" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 font-semibold inline-flex items-center gap-0.5">
                                Learn more <ExternalLink className="w-3 h-3" />
                            </a>
                        </>
                    }
                />
                <Toggle
                    checked={config.stripeTaxEnabled}
                    onChange={v => saveField({ stripeTaxEnabled: v })}
                    label="Enable Stripe Tax"
                    description="Automatically calculate and collect VAT on subscriptions."
                />
                <div className="mt-3">
                    <Field label="Tax nexus country" hint="where your business is registered for VAT">
                        <Select
                            value={config.stripeTaxCountry}
                            onChange={e => saveField({ stripeTaxCountry: e.target.value })}
                            className="max-w-xs"
                        >
                            {TAX_COUNTRIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </Select>
                    </Field>
                </div>
            </Card>

            {/* Setup checklist */}
            <Card>
                <CardHeader title="Setup checklist" />
                <ol className="list-none p-0 m-0 space-y-2 text-[12.5px] text-[var(--text-secondary)]">
                    {[
                        { done: config.hasStripeSecretKey, label: <>Add <strong>Secret Key</strong> and <strong>Publishable Key</strong> from Stripe Dashboard → API keys</> },
                        { done: config.hasStripeWebhookSecret, label: (
                            <>
                                Create a <strong>Webhook endpoint</strong> in Stripe Dashboard pointing to:{' '}
                                <code className="ml-1 px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] text-[11px] text-blue-400">{webhookURL}</code>
                            </>
                        )},
                        { done: config.hasStripeWebhookSecret, label: (
                            <>
                                Subscribe to events:{' '}
                                {['checkout.session.completed','customer.subscription.updated','customer.subscription.deleted','invoice.payment_failed'].map((ev, i, arr) => (
                                    <React.Fragment key={ev}>
                                        <code className="px-1 py-0.5 rounded bg-[var(--bg-tertiary)] text-[10.5px]">{ev}</code>{i < arr.length - 1 ? ', ' : ''}
                                    </React.Fragment>
                                ))}
                            </>
                        )},
                        { done: config.stripeEnabled, label: <><strong>Enable</strong> Stripe payments using the toggle above</> },
                        { done: false, label: <>Set a <strong>price</strong> on your subscription plans in the Plans tab</> },
                    ].map((item, i) => (
                        <li key={i} className="flex items-start gap-2.5">
                            {item.done
                                ? <CheckCircle className="shrink-0 w-4 h-4 mt-0.5 text-emerald-400" />
                                : <span className="shrink-0 w-4 h-4 mt-0.5 rounded border border-[var(--border-default)]" />}
                            <span className={item.done ? 'text-emerald-300' : ''}>{item.label}</span>
                        </li>
                    ))}
                </ol>
            </Card>
        </div>
    );
}
