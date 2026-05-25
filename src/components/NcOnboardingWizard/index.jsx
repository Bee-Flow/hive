import React, { useState, useEffect } from 'react';
import { Cloud, Users, Shield, CheckCircle2, ChevronRight, ChevronLeft, Loader2, Server, Tag, Star, Building2, Key, CreditCard } from 'lucide-react';
import { API_BASE, authFetch } from '../../utils/helpers';
import beeFlowLogo from '../../assets/bee-flow-logo.svg';

/**
 * Bee Flow ↔ Nextcloud App Store onboarding wizard.
 *
 * Mounted by App.jsx when /auth/user reports `ncOnboardingNeeded: true`
 * (org has nc_instance_id but nc_onboarding_completed_at is NULL and the
 * caller is the org admin). Submitting writes every choice in one POST and
 * flips the onboarding flag — only after that does connectorJwt unblock
 * auto-provisioning for everyone else.
 *
 * If the admin picks a paid plan, "Finish setup" redirects to Stripe; the
 * webhook activates the subscription server-side. Self-hosted + paid is a
 * supported combination — the resulting license JWT is delivered out-of-band
 * and pasted into the customer's own License & Usage panel.
 */

const STEPS = ['welcome', 'org', 'deployment', 'subscription', 'sync', 'shield', 'done'];

// Categories the Local PII detector (Transformers.js, OpenAI Privacy Filter)
// actually emits — see server/core/localPiiDetection.js LABEL_TO_CATEGORY.
const PII_CATEGORIES = [
    { id: 'Person', label: 'Names', icon: '👤' },
    { id: 'Email', label: 'Email addresses', icon: '📧' },
    { id: 'PhoneNumber', label: 'Phone numbers', icon: '📱' },
    { id: 'Address', label: 'Physical addresses', icon: '🏠' },
    { id: 'DateOfBirth', label: 'Date of birth', icon: '📅' },
    { id: 'BankAccountNumber', label: 'Bank account numbers', icon: '🏦' },
    { id: 'URL', label: 'URLs', icon: '🔗' },
    { id: 'ApiKeyOrSecret', label: 'API keys / secrets', icon: '🔑' },
];

const DEFAULT_PII = ['Person', 'Email', 'PhoneNumber', 'Address', 'BankAccountNumber'];

const NcOnboardingWizard = ({ user, orgName, onComplete }) => {
    const orgId = user?.organizationId;
    const [stepIdx, setStepIdx] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    // Organisation form. Pre-fill happens once on mount via GET /auth/organizations/:id.
    const [org, setOrg] = useState({
        name: '', email: '', tagline: '', description: '',
        address: '', phone: '', website: '', kvk: '', vat: '',
    });

    const [deploymentMode, setDeploymentMode] = useState('cloud');
    const [selectedPlanId, setSelectedPlanId] = useState(null); // null = Community/free
    const [plans, setPlans] = useState([]);
    const [plansLoading, setPlansLoading] = useState(true);
    // From /api/billing/offered-plans — false on self-hosted, blocks any
    // attempt to redirect the admin to Stripe checkout.
    const [stripeEnabled, setStripeEnabled] = useState(false);

    const [syncMode, setSyncMode] = useState('mirror_all');
    const [syncGroups, setSyncGroups] = useState([]);
    const [excludedGroups, setExcludedGroups] = useState(['admin']);
    const [newUserDefaultStatus, setNewUserDefaultStatus] = useState('active');
    const [shieldEnabled, setShieldEnabled] = useState(true);
    const [shieldAction, setShieldAction] = useState('tokenize');
    const [shieldCategories, setShieldCategories] = useState(DEFAULT_PII);

    const [groups, setGroups] = useState([]);
    const [groupsLoading, setGroupsLoading] = useState(true);

    // Pre-fill organisation form. Falls back to NC bootstrap data (orgName
    // prop, user.email) when the org row's fields are still empty.
    useEffect(() => {
        if (!orgId) return;
        let cancelled = false;
        authFetch(`${API_BASE}/auth/organizations/${orgId}`).then(r => r.ok ? r.json() : null).then(j => {
            if (cancelled) return;
            setOrg({
                name: j?.name || orgName || '',
                email: j?.email || user?.email || '',
                tagline: j?.tagline || '',
                description: j?.description || '',
                address: j?.address || '',
                phone: j?.phone || '',
                website: j?.website || '',
                kvk: j?.kvk || '',
                vat: j?.vat || '',
            });
        }).catch(() => { /* leave defaults */ });
        return () => { cancelled = true; };
    }, [orgId, orgName, user?.email]);

    useEffect(() => {
        if (!orgId) return;
        let cancelled = false;
        authFetch(`${API_BASE}/auth/admin/${orgId}/nc-sync/groups`).then(r => r.ok ? r.json() : { groups: [] }).then(j => {
            if (!cancelled) { setGroups(j.groups || []); setGroupsLoading(false); }
        }).catch(() => { if (!cancelled) setGroupsLoading(false); });
        return () => { cancelled = true; };
    }, [orgId]);

    useEffect(() => {
        let cancelled = false;
        // The public /pricing page links here as `/app?plan=<id>`. If that
        // id matches a real offered plan, jump straight to it — the visitor
        // told us which one they want and pretending otherwise just makes
        // them click twice. If the id doesn't match (plan unpublished
        // between page-view and signup, typo'd URL, etc.) we fall through
        // to the existing default-selection logic below.
        const requestedPlanId = (new URLSearchParams(window.location.search).get('plan') || '').trim();
        authFetch(`${API_BASE}/api/billing/offered-plans`).then(r => r.ok ? r.json() : { plans: [] }).then(j => {
            if (cancelled) return;
            const list = j.plans || [];
            setPlans(list);
            setStripeEnabled(!!j.stripeEnabled);
            if (requestedPlanId) {
                const match = list.find(p => p.id === requestedPlanId);
                if (match) setSelectedPlanId(match.id);
            }
            // Default selection (when no `?plan=` match): Community (null).
            // Admin opts in to a paid plan by clicking a card — no pre-
            // selection so they can't pay by accident.
            setPlansLoading(false);
        }).catch(() => { if (!cancelled) setPlansLoading(false); });
        return () => { cancelled = true; };
    }, []);

    const step = STEPS[stepIdx];
    const next = () => setStepIdx(i => Math.min(i + 1, STEPS.length - 1));
    const prev = () => setStepIdx(i => Math.max(i - 1, 0));

    const canAdvance = () => {
        if (step === 'org' && !org.name.trim()) return false;
        // Cloud mode is the hosted offering — Community is hidden and the
        // admin must pick a paid plan before continuing.
        if (step === 'subscription' && deploymentMode === 'cloud' && !selectedPlanId) return false;
        if (step === 'sync' && syncMode === 'selective_groups' && syncGroups.length === 0) return false;
        if (step === 'shield' && shieldEnabled && shieldCategories.length === 0) return false;
        return true;
    };

    // When the admin switches between deployment modes, reset the plan
    // selection so a stale "Community" pick from self-hosted doesn't block
    // cloud's gate (and vice-versa).
    useEffect(() => {
        if (deploymentMode === 'cloud') {
            // Pre-select the NC-recommended plan if there is one; otherwise the
            // admin will need to click a plan card before advancing.
            if (selectedPlanId === null) {
                const pick = plans.find(p => p.ncRecommended) || plans.find(p => Number(p.price) > 0) || null;
                if (pick) setSelectedPlanId(pick.id);
            }
        }
        // Self-hosted leaves the previous selection alone — Community (null)
        // is a valid choice and is shown again as a card.
    }, [deploymentMode, plans]); // eslint-disable-line react-hooks/exhaustive-deps

    const toggle = (list, setter, val) => {
        setter(list.includes(val) ? list.filter(x => x !== val) : [...list, val]);
    };

    const selectedPlan = selectedPlanId ? plans.find(p => p.id === selectedPlanId) : null;
    const isPaid = !!(selectedPlan && Number(selectedPlan.price) > 0);

    const handleFinish = async () => {
        if (!orgId) return;
        setSubmitting(true);
        setError(null);
        try {
            // 1. Persist org details (mirrors OrgInfoPanel's PUT).
            const orgRes = await authFetch(`${API_BASE}/auth/organizations/${orgId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: org.name.trim(),
                    email: org.email.trim(),
                    tagline: org.tagline.trim(),
                    description: org.description.trim(),
                    address: org.address.trim(),
                    phone: org.phone.trim(),
                    website: org.website.trim(),
                    kvk: org.kvk.trim(),
                    vat: org.vat.trim(),
                }),
            });
            if (!orgRes.ok) {
                const j = await orgRes.json().catch(() => ({}));
                throw new Error(`Could not save organisation: ${j.error || orgRes.status}`);
            }

            // 2. Persist wizard outputs (deployment + plan + sync + shield).
            const res = await authFetch(`${API_BASE}/auth/admin/${orgId}/nc-onboarding/complete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    deploymentMode,
                    selectedPlanId: selectedPlanId || null,
                    syncMode,
                    syncGroups: syncMode === 'selective_groups' ? syncGroups : [],
                    excludedGroups,
                    newUserDefaultStatus,
                    privacyShield: {
                        enabled: shieldEnabled,
                        piiDetectionAction: shieldAction,
                        piiDetectionCategories: shieldCategories,
                    },
                }),
            });
            if (!res.ok) {
                const j = await res.json().catch(() => ({}));
                throw new Error(j.error || `HTTP ${res.status}`);
            }

            // 3. If a paid plan is selected, redirect to Stripe-hosted checkout.
            //    Webhook activates the subscription + issues the license JWT.
            //    Self-hosted installs and trial-only flows skip Stripe entirely
            //    — the wizard finishes locally; the admin can attach a license
            //    later via Settings → License & Usage.
            const stripeAvailable = stripeEnabled && deploymentMode === 'cloud';
            if (isPaid && stripeAvailable) {
                const origin = window.location.origin;
                const co = await authFetch(`${API_BASE}/api/stripe/checkout`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        planId: selectedPlanId,
                        origin,
                        successUrl: `${origin}/app/settings/organisation/license?wizard=complete&session_id={CHECKOUT_SESSION_ID}`,
                    }),
                });
                const j = await co.json().catch(() => ({}));
                if (!co.ok || !j.url) {
                    // Wizard is already persisted; the admin can pay later via
                    // License & Usage. Surface the error and exit to dashboard.
                    setError(j.error || 'Could not start checkout. Your setup is saved — you can pay later in Settings → License & Usage.');
                    setSubmitting(false);
                    return;
                }
                window.location.href = j.url;
                return;
            }

            onComplete?.();
        } catch (e) {
            setError(e.message);
            setSubmitting(false);
        }
    };

    // ── Step renderers ────────────────────────────────────────────────────
    const renderOrg = () => (
        <div className="space-y-3">
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Tell us a bit about your organisation. We pre-filled what Nextcloud already knows; the rest is optional and can be edited later.
            </p>
            <div>
                <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Organisation name *</label>
                <input value={org.name} onChange={e => setOrg({ ...org, name: e.target.value })}
                    className="w-full mt-1 px-3 py-2 rounded-lg border text-sm"
                    style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }} />
            </div>
            <div>
                <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Billing email</label>
                <input type="email" value={org.email} onChange={e => setOrg({ ...org, email: e.target.value })}
                    placeholder="finance@example.com"
                    className="w-full mt-1 px-3 py-2 rounded-lg border text-sm"
                    style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }} />
            </div>
            <div>
                <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Tagline</label>
                <input value={org.tagline} onChange={e => setOrg({ ...org, tagline: e.target.value })}
                    placeholder="One line that describes your team"
                    className="w-full mt-1 px-3 py-2 rounded-lg border text-sm"
                    style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }} />
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Phone</label>
                    <input value={org.phone} onChange={e => setOrg({ ...org, phone: e.target.value })}
                        className="w-full mt-1 px-3 py-2 rounded-lg border text-sm"
                        style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }} />
                </div>
                <div>
                    <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Website</label>
                    <input value={org.website} onChange={e => setOrg({ ...org, website: e.target.value })}
                        placeholder="https://"
                        className="w-full mt-1 px-3 py-2 rounded-lg border text-sm"
                        style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }} />
                </div>
            </div>
            <div>
                <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Address</label>
                <input value={org.address} onChange={e => setOrg({ ...org, address: e.target.value })}
                    className="w-full mt-1 px-3 py-2 rounded-lg border text-sm"
                    style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }} />
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Chamber of Commerce (KVK)</label>
                    <input value={org.kvk} onChange={e => setOrg({ ...org, kvk: e.target.value })}
                        className="w-full mt-1 px-3 py-2 rounded-lg border text-sm"
                        style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }} />
                </div>
                <div>
                    <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>VAT</label>
                    <input value={org.vat} onChange={e => setOrg({ ...org, vat: e.target.value })}
                        className="w-full mt-1 px-3 py-2 rounded-lg border text-sm"
                        style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }} />
                </div>
            </div>
        </div>
    );

    const renderDeployment = () => (
        <div className="space-y-4">
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                How will Bee Flow run for your team?
            </p>
            {[
                {
                    v: 'cloud', t: 'Bee Flow Cloud', icon: Cloud,
                    d: 'Hosted by Bee Flow B.V. on EU infrastructure. Zero ops — updates, backups and uptime are managed for you.',
                },
                {
                    v: 'self-hosted', t: 'Self-hosted', icon: Server,
                    d: 'Run the Bee Flow server on your own infrastructure. Community tier is free; paid tiers issue a license key you activate on your install.',
                },
            ].map(opt => {
                const Icon = opt.icon;
                const active = deploymentMode === opt.v;
                return (
                    <button
                        key={opt.v}
                        type="button"
                        onClick={() => setDeploymentMode(opt.v)}
                        className="w-full flex items-start gap-3 p-4 rounded-xl border text-left"
                        style={{
                            borderColor: active ? 'var(--accent-primary)' : 'var(--border-subtle)',
                            background: active ? 'var(--bg-tertiary)' : 'transparent',
                        }}
                    >
                        <Icon className="w-5 h-5 mt-0.5" style={{ color: active ? 'var(--accent-primary)' : 'var(--text-secondary)' }} />
                        <div className="flex-1">
                            <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{opt.t}</div>
                            <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{opt.d}</div>
                        </div>
                    </button>
                );
            })}
        </div>
    );

    const renderSubscription = () => {
        const fmtPrice = (p) => {
            if (p.price == null || p.price === 0) return 'Free';
            const sym = p.currency === 'USD' ? '$' : p.currency === 'GBP' ? '£' : '€';
            return `${sym}${p.price}/${p.billingInterval === 'yearly' ? 'yr' : 'mo'}`;
        };
        const communityActive = selectedPlanId === null;
        const isCloud = deploymentMode === 'cloud';
        return (
            <div className="space-y-3">
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {isCloud
                        ? <>Bee Flow Cloud is a paid service. Pick the plan that fits your team — you'll complete payment via Stripe on the next step.</>
                        : <>Pick a starting subscription. You can upgrade or cancel anytime under <span className="font-medium">Settings → Organisation → License & Usage</span>.</>}
                </p>

                {/* Community / free card — only on self-hosted (cloud is paid-only). */}
                {!isCloud && (
                    <button
                        type="button"
                        onClick={() => setSelectedPlanId(null)}
                        className="w-full text-left p-4 rounded-xl border"
                        style={{
                            borderColor: communityActive ? 'var(--accent-primary)' : 'var(--border-subtle)',
                            background: communityActive ? 'var(--bg-tertiary)' : 'transparent',
                        }}
                    >
                        <div className="flex items-baseline justify-between gap-3">
                            <div>
                                <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Community</div>
                                <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                                    Single-user chat, local knowledge base, no payment required.
                                </div>
                            </div>
                            <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Free</div>
                        </div>
                    </button>
                )}

                {plansLoading ? (
                    <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin" /></div>
                ) : plans.length === 0 ? (
                    <div className="rounded-xl border p-3 text-xs" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                        No paid plans are configured yet. Your administrator can add them in <span className="font-medium">Admin → Subscriptions</span>.
                    </div>
                ) : (
                    plans.map(p => {
                        const active = selectedPlanId === p.id;
                        return (
                            <button
                                key={p.id}
                                type="button"
                                onClick={() => setSelectedPlanId(p.id)}
                                className="w-full text-left p-4 rounded-xl border"
                                style={{
                                    borderColor: active ? 'var(--accent-primary)' : 'var(--border-subtle)',
                                    background: active ? 'var(--bg-tertiary)' : 'transparent',
                                }}
                            >
                                {p.ncRecommended && (
                                    <div className="mb-2">
                                        <span
                                            className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                                            style={{ background: '#0082C9', color: '#fff' }}
                                        >
                                            <Star className="w-2.5 h-2.5" /> Recommended for Nextcloud
                                        </span>
                                    </div>
                                )}
                                <div className="flex items-baseline justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{p.name}</div>
                                        {p.tagline && (
                                            <div className="text-xs mt-0.5 inline-flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                                                <Tag className="w-3 h-3" /> {p.tagline}
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-sm font-semibold whitespace-nowrap shrink-0" style={{ color: 'var(--text-primary)' }}>
                                        {fmtPrice(p)}
                                        {p.trialDays > 0 && <span className="ml-2 text-[10px] font-medium" style={{ color: '#22c55e' }}>{p.trialDays}d trial</span>}
                                    </div>
                                </div>
                                {p.description && (
                                    <div className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>{p.description}</div>
                                )}
                                <div className="flex flex-wrap gap-1 mt-2">
                                    {p.maxUsers != null && p.maxUsers > 0 && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                                            Up to {p.maxUsers} users
                                        </span>
                                    )}
                                    {p.maxAgents != null && p.maxAgents > 0 && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                                            {p.maxAgents} agents
                                        </span>
                                    )}
                                    {(p.allowedFeatures || []).slice(0, 3).map(f => (
                                        <span key={f} className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                                            {f}
                                        </span>
                                    ))}
                                </div>
                            </button>
                        );
                    })
                )}
            </div>
        );
    };

    return (
        <div className="h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(160deg, var(--bg-primary) 0%, var(--bg-secondary) 50%, var(--bg-tertiary) 100%)' }}>
            <div className="w-full max-w-2xl">
                <div className="backdrop-blur-xl rounded-3xl p-8 shadow-2xl border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)' }}>
                    {/* Header */}
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 rounded-2xl overflow-hidden ring-2 ring-[var(--border-subtle)]">
                            <img src={beeFlowLogo} alt="Bee Flow" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1">
                            <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                                {step === 'welcome' && `Welcome to Bee Flow${orgName ? ` for ${orgName}` : ''}`}
                                {step === 'org' && 'Organisation details'}
                                {step === 'deployment' && 'Choose your deployment'}
                                {step === 'subscription' && 'Pick your subscription'}
                                {step === 'sync' && 'Nextcloud user sync'}
                                {step === 'shield' && 'Privacy Shield'}
                                {step === 'done' && 'You\'re ready'}
                            </h1>
                            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Step {stepIdx + 1} of {STEPS.length}</p>
                        </div>
                    </div>

                    {/* Progress bar */}
                    <div className="flex gap-1 mb-8">
                        {STEPS.map((s, i) => (
                            <div key={s} className="flex-1 h-1.5 rounded-full" style={{ background: i <= stepIdx ? 'var(--accent-primary)' : 'var(--border-subtle)' }} />
                        ))}
                    </div>

                    {/* Step content */}
                    {step === 'welcome' && (
                        <div className="space-y-4">
                            <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
                                Bee Flow is now connected to your Nextcloud instance. We'll walk you through a few quick decisions about how Bee Flow runs and how it handles your team and their data.
                            </p>
                            <div className="rounded-xl border p-4 space-y-2 text-sm" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-tertiary)' }}>
                                <div><span className="font-medium">Organisation:</span> {orgName || 'Nextcloud'}</div>
                                <div><span className="font-medium">Administrator:</span> {user?.email}</div>
                                <div className="text-xs pt-2" style={{ color: 'var(--text-secondary)' }}>
                                    No credentials, app passwords, or OAuth clients required — Nextcloud handles authentication, and Bee Flow uses the AppAPI shared secret to act on each user's behalf.
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 'org' && renderOrg()}
                    {step === 'deployment' && renderDeployment()}
                    {step === 'subscription' && renderSubscription()}

                    {step === 'sync' && (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Who gets a Bee Flow account?</h3>
                                {[
                                    { v: 'mirror_all', t: 'Everyone in Nextcloud', d: 'All NC users automatically get a Bee Flow account when they first click the icon.' },
                                    { v: 'selective_groups', t: 'Only specific groups', d: 'Only members of the groups you pick are mirrored.' },
                                    { v: 'manual', t: 'Manual only', d: 'You invite people one by one via the admin UI.' },
                                ].map(opt => (
                                    <label key={opt.v} className="flex items-start gap-3 p-3 rounded-xl border cursor-pointer" style={{ borderColor: syncMode === opt.v ? 'var(--accent-primary)' : 'var(--border-subtle)', background: syncMode === opt.v ? 'var(--bg-tertiary)' : 'transparent' }}>
                                        <input type="radio" name="sm" value={opt.v} checked={syncMode === opt.v} onChange={() => setSyncMode(opt.v)} className="mt-1" />
                                        <div>
                                            <div className="text-sm font-medium">{opt.t}</div>
                                            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{opt.d}</div>
                                        </div>
                                    </label>
                                ))}
                            </div>

                            {syncMode === 'selective_groups' && (
                                <div className="rounded-xl border p-3" style={{ borderColor: 'var(--border-subtle)' }}>
                                    <div className="text-xs font-medium mb-2">Groups to sync (≥1 required)</div>
                                    {groupsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                                        <div className="grid grid-cols-2 gap-1 max-h-32 overflow-y-auto">
                                            {groups.map(g => (
                                                <label key={g} className="flex items-center gap-2 text-xs">
                                                    <input type="checkbox" checked={syncGroups.includes(g)} onChange={() => toggle(syncGroups, setSyncGroups, g)} />{g}
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="rounded-xl border p-3" style={{ borderColor: 'var(--border-subtle)' }}>
                                <div className="text-xs font-medium mb-2">Excluded groups (members never mirrored)</div>
                                {groupsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                                    <div className="grid grid-cols-2 gap-1 max-h-32 overflow-y-auto">
                                        {groups.map(g => (
                                            <label key={g} className="flex items-center gap-2 text-xs">
                                                <input type="checkbox" checked={excludedGroups.includes(g)} onChange={() => toggle(excludedGroups, setExcludedGroups, g)} />{g}
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div>
                                <h3 className="text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>New user default status</h3>
                                <div className="flex gap-2">
                                    {[
                                        { v: 'active', t: 'Active immediately', d: 'Recommended for most teams' },
                                        { v: 'pending', t: 'Pending approval', d: 'Admin reviews each new user' },
                                    ].map(opt => (
                                        <button key={opt.v} type="button" onClick={() => setNewUserDefaultStatus(opt.v)}
                                            className="flex-1 p-3 rounded-xl border text-left text-sm"
                                            style={{ borderColor: newUserDefaultStatus === opt.v ? 'var(--accent-primary)' : 'var(--border-subtle)', background: newUserDefaultStatus === opt.v ? 'var(--bg-tertiary)' : 'transparent' }}>
                                            <div className="font-medium">{opt.t}</div>
                                            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{opt.d}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 'shield' && (
                        <div className="space-y-4">
                            <label className="flex items-start gap-3 p-3 rounded-xl border cursor-pointer" style={{ borderColor: shieldEnabled ? 'var(--accent-primary)' : 'var(--border-subtle)', background: shieldEnabled ? 'var(--bg-tertiary)' : 'transparent' }}>
                                <input type="checkbox" checked={shieldEnabled} onChange={e => setShieldEnabled(e.target.checked)} className="mt-1" />
                                <div>
                                    <div className="text-sm font-medium">Enable Privacy Shield</div>
                                    <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Detects PII (emails, phone numbers, IBANs, etc.) before messages reach the AI. Runs locally, in-process — no third-party services.</div>
                                </div>
                            </label>

                            {shieldEnabled && (
                                <>
                                    <div>
                                        <h3 className="text-sm font-medium mb-2">Action on detection</h3>
                                        <div className="flex gap-2">
                                            {[
                                                { v: 'tokenize', t: 'Tokenize & round-trip', d: 'Replace with [email_1] before sending; restore in response' },
                                                { v: 'block', t: 'Block the message', d: 'Reject and ask user to rephrase' },
                                            ].map(opt => (
                                                <button key={opt.v} type="button" onClick={() => setShieldAction(opt.v)}
                                                    className="flex-1 p-3 rounded-xl border text-left text-sm"
                                                    style={{ borderColor: shieldAction === opt.v ? 'var(--accent-primary)' : 'var(--border-subtle)', background: shieldAction === opt.v ? 'var(--bg-tertiary)' : 'transparent' }}>
                                                    <div className="font-medium">{opt.t}</div>
                                                    <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{opt.d}</div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="text-sm font-medium mb-2">Categories to detect ({shieldCategories.length}/{PII_CATEGORIES.length})</h3>
                                        <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 rounded-xl border" style={{ borderColor: 'var(--border-subtle)' }}>
                                            {PII_CATEGORIES.map(c => (
                                                <label key={c.id} className="flex items-center gap-2 text-xs">
                                                    <input type="checkbox" checked={shieldCategories.includes(c.id)} onChange={() => toggle(shieldCategories, setShieldCategories, c.id)} />
                                                    <span>{c.icon} {c.label}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {step === 'done' && (
                        <div className="space-y-4">
                            <p className="text-sm" style={{ color: 'var(--text-primary)' }}>Review your choices and finish setup. You can change any of this later under Settings → Organisation.</p>
                            <div className="rounded-xl border p-4 space-y-2 text-sm" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-tertiary)' }}>
                                <div><span className="font-medium">Organisation:</span> {org.name || '—'}</div>
                                <div><span className="font-medium">Deployment:</span> {deploymentMode === 'cloud' ? 'Bee Flow Cloud' : 'Self-hosted'}</div>
                                <div><span className="font-medium">Subscription:</span> {selectedPlan ? selectedPlan.name : 'Community (free)'}</div>
                                <div><span className="font-medium">Sync mode:</span> {syncMode}{syncMode === 'selective_groups' ? ` (${syncGroups.length} groups)` : ''}</div>
                                <div><span className="font-medium">Privacy Shield:</span> {shieldEnabled ? `${shieldAction} • ${shieldCategories.length} categories` : 'disabled'}</div>
                            </div>
                            {isPaid && (
                                <div className="rounded-xl border p-4 space-y-2" style={{ borderColor: 'rgba(59,130,246,0.4)', background: 'rgba(59,130,246,0.08)', color: 'var(--text-primary)' }}>
                                    <div className="inline-flex items-center gap-2 text-sm font-semibold">
                                        <CreditCard className="w-4 h-4" style={{ color: '#3b82f6' }} />
                                        Pay with Stripe
                                    </div>
                                    <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                        {selectedPlan?.name} — {(() => {
                                            const sym = selectedPlan?.currency === 'USD' ? '$' : selectedPlan?.currency === 'GBP' ? '£' : '€';
                                            return `${sym}${selectedPlan?.price}/${selectedPlan?.billingInterval === 'yearly' ? 'year' : 'month'}`;
                                        })()}
                                        {selectedPlan?.trialDays > 0 && <span className="ml-1" style={{ color: '#22c55e' }}>• {selectedPlan.trialDays}-day free trial</span>}
                                    </div>
                                    <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                        Clicking <span className="font-medium">Continue to payment</span> opens Stripe's hosted checkout in this tab. Your wizard answers are already saved — if you cancel checkout you can pay later under Settings → License & Usage.
                                    </div>
                                    {deploymentMode === 'self-hosted' && (
                                        <div className="inline-flex items-start gap-1 pt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                                            <Key className="w-3 h-3 mt-0.5 shrink-0" />
                                            <span>After payment you'll receive a license key — paste it into <span className="font-medium">Settings → License & Usage</span> on your own Bee Flow installation to activate {selectedPlan?.name}.</span>
                                        </div>
                                    )}
                                </div>
                            )}
                            {error && (
                                <div className="text-sm text-red-500 p-3 rounded-xl border border-red-500/30 bg-red-500/10">{error}</div>
                            )}
                        </div>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between mt-8">
                        <button type="button" onClick={prev} disabled={stepIdx === 0 || submitting}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-30"
                            style={{ color: 'var(--text-secondary)' }}>
                            <ChevronLeft className="w-4 h-4" /> Back
                        </button>
                        {step !== 'done' ? (
                            <button type="button" onClick={next} disabled={!canAdvance()}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-30"
                                style={{ background: 'var(--accent-primary)', color: 'white' }}>
                                Next <ChevronRight className="w-4 h-4" />
                            </button>
                        ) : (
                            <button type="button" onClick={handleFinish} disabled={submitting}
                                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium disabled:opacity-50"
                                style={{ background: 'var(--accent-primary)', color: 'white' }}>
                                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                {(() => {
                                    const willGoToStripe = isPaid && stripeEnabled && deploymentMode === 'cloud';
                                    if (submitting) return willGoToStripe ? 'Redirecting…' : 'Finishing…';
                                    return willGoToStripe ? 'Continue to payment' : 'Finish setup';
                                })()}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NcOnboardingWizard;
