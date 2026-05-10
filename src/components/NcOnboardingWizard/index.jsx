import React, { useState, useEffect } from 'react';
import { Cloud, Users, Shield, CheckCircle2, ChevronRight, ChevronLeft, Loader2, Server, Tag, Star } from 'lucide-react';
import { API_BASE, authFetch } from '../../utils/helpers';

/**
 * Bee Flow ↔ Nextcloud App Store onboarding wizard.
 *
 * Mounted by App.jsx when /auth/user reports `ncOnboardingNeeded: true`
 * (org has nc_instance_id but nc_onboarding_completed_at is NULL and the
 * caller is the org admin). Submitting writes every choice in one POST and
 * flips the onboarding flag — only after that does connectorJwt unblock
 * auto-provisioning for everyone else.
 */

// 'subscription' is auto-skipped when deployment === 'self-hosted' (admin
// running their own Bee Flow stack doesn't need a hosted plan).
const STEPS = ['welcome', 'deployment', 'subscription', 'sync', 'shield', 'done'];

// Categories the Local PII detector (Transformers.js, OpenAI Privacy Filter)
// actually emits — see server/core/localPiiDetection.js LABEL_TO_CATEGORY.
// The wizard runs against a fresh App Store install where Azure isn't
// configured yet, so only these are available. Customers who later wire
// up Azure PII can toggle the broader category set via the Privacy
// Shield admin panel.
const PII_CATEGORIES = [
    { id: 'Person', label: 'Names', icon: '👤' },
    { id: 'Email', label: 'Email addresses', icon: '📧' },
    { id: 'PhoneNumber', label: 'Phone numbers', icon: '📱' },
    { id: 'Address', label: 'Physical addresses', icon: '🏠' },
    { id: 'DateOfBirth', label: 'Date of birth', icon: '📅' },
    { id: 'BankAccountNumber', label: 'Bank account numbers', icon: '🏦' },
    { id: 'URL', label: 'URLs', icon: '🔗' },
    { id: 'AzureStorageAccountKey', label: 'Storage / API secrets', icon: '🔑' },
];

const DEFAULT_PII = ['Person', 'Email', 'PhoneNumber', 'Address', 'BankAccountNumber'];

const NcOnboardingWizard = ({ user, orgName, onComplete }) => {
    const orgId = user?.organizationId;
    const [stepIdx, setStepIdx] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    const [deploymentMode, setDeploymentMode] = useState('cloud');
    const [selectedPlanId, setSelectedPlanId] = useState(null);
    const [plans, setPlans] = useState([]);
    const [plansLoading, setPlansLoading] = useState(true);

    const [syncMode, setSyncMode] = useState('mirror_all');
    const [syncGroups, setSyncGroups] = useState([]);
    const [excludedGroups, setExcludedGroups] = useState(['admin']);
    const [newUserDefaultStatus, setNewUserDefaultStatus] = useState('active');
    const [shieldEnabled, setShieldEnabled] = useState(true);
    const [shieldAction, setShieldAction] = useState('tokenize');
    const [shieldCategories, setShieldCategories] = useState(DEFAULT_PII);

    const [groups, setGroups] = useState([]);
    const [groupsLoading, setGroupsLoading] = useState(true);

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
        authFetch(`${API_BASE}/api/billing/offered-plans`).then(r => r.ok ? r.json() : { plans: [] }).then(j => {
            if (cancelled) return;
            const list = j.plans || [];
            setPlans(list);
            // Pre-select the nc_recommended plan if one exists, else the default.
            const ncPick = list.find(p => p.ncRecommended) || list.find(p => p.isDefault) || list[0];
            if (ncPick) setSelectedPlanId(ncPick.id);
            setPlansLoading(false);
        }).catch(() => { if (!cancelled) setPlansLoading(false); });
        return () => { cancelled = true; };
    }, []);

    const step = STEPS[stepIdx];

    // Skip subscription step when admin chose self-hosted.
    const skipNext = (idx, dir) => {
        let i = idx;
        while (i >= 0 && i < STEPS.length) {
            if (STEPS[i] === 'subscription' && deploymentMode === 'self-hosted') {
                i += dir;
                continue;
            }
            return i;
        }
        return idx;
    };
    const next = () => setStepIdx(i => skipNext(Math.min(i + 1, STEPS.length - 1), +1));
    const prev = () => setStepIdx(i => skipNext(Math.max(i - 1, 0), -1));

    const canAdvance = () => {
        if (step === 'subscription' && plans.length > 0 && !selectedPlanId) return false;
        if (step === 'sync' && syncMode === 'selective_groups' && syncGroups.length === 0) return false;
        if (step === 'shield' && shieldEnabled && shieldCategories.length === 0) return false;
        return true;
    };

    const toggle = (list, setter, val) => {
        setter(list.includes(val) ? list.filter(x => x !== val) : [...list, val]);
    };

    const handleFinish = async () => {
        if (!orgId) return;
        setSubmitting(true);
        setError(null);
        try {
            const res = await authFetch(`${API_BASE}/auth/admin/${orgId}/nc-onboarding/complete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    deploymentMode,
                    selectedPlanId: deploymentMode === 'cloud' ? (selectedPlanId || null) : null,
                    syncMode,
                    syncGroups: syncMode === 'selective_groups' ? syncGroups : [],
                    excludedGroups,
                    newUserDefaultStatus,
                    privacyShield: {
                        enabled: shieldEnabled,
                        localPiiEnabled: true,
                        piiDetectionAction: shieldAction,
                        piiDetectionCategories: shieldCategories,
                    },
                }),
            });
            if (!res.ok) {
                const j = await res.json().catch(() => ({}));
                throw new Error(j.error || `HTTP ${res.status}`);
            }
            onComplete?.();
        } catch (e) {
            setError(e.message);
            setSubmitting(false);
        }
    };

    // ── Step renderers ────────────────────────────────────────────────────
    const renderDeployment = () => (
        <div className="space-y-4">
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                How will Bee Flow run for your team?
            </p>
            {[
                {
                    v: 'cloud', t: 'Bee Flow Cloud', icon: Cloud,
                    d: 'Hosted by Bee Flow B.V. on EU infrastructure. Zero ops — updates, backups and uptime are managed for you. Pick a subscription on the next step.',
                },
                {
                    v: 'self-hosted', t: 'Self-hosted', icon: Server,
                    d: 'Run the Bee Flow server on your own infrastructure. No subscription required for the Community tier. After finishing, redeploy this connector with BEEFLOW_API_BASE_URL pointing at your installation.',
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
        return (
            <div className="space-y-4">
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Pick a starting subscription. You can upgrade or cancel anytime under <span className="font-medium">Settings → Organisation → License & Usage</span>; nothing is charged from this wizard.
                </p>
                {plansLoading ? (
                    <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>
                ) : plans.length === 0 ? (
                    <div className="rounded-xl border p-4 text-sm" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                        No subscription plans are configured yet. Your administrator can set them up later — Bee Flow will start on the free Community tier in the meantime.
                    </div>
                ) : (
                    <div className="space-y-2">
                        {plans.map(p => {
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
                        })}
                    </div>
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
                            <img src="bee-flow-logo.svg" alt="Bee Flow" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1">
                            <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                                {step === 'welcome' && `Welcome to Bee Flow${orgName ? ` for ${orgName}` : ''}`}
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
                                <div><span className="font-medium">Deployment:</span> {deploymentMode === 'cloud' ? 'Bee Flow Cloud' : 'Self-hosted'}</div>
                                {deploymentMode === 'cloud' && selectedPlanId && (
                                    <div><span className="font-medium">Subscription:</span> {plans.find(p => p.id === selectedPlanId)?.name || selectedPlanId}</div>
                                )}
                                <div><span className="font-medium">Sync mode:</span> {syncMode}{syncMode === 'selective_groups' ? ` (${syncGroups.length} groups)` : ''}</div>
                                <div><span className="font-medium">Excluded groups:</span> {excludedGroups.length === 0 ? 'none' : excludedGroups.join(', ')}</div>
                                <div><span className="font-medium">Default user status:</span> {newUserDefaultStatus}</div>
                                <div><span className="font-medium">Privacy Shield:</span> {shieldEnabled ? `${shieldAction} • ${shieldCategories.length} categories` : 'disabled'}</div>
                            </div>
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
                                {submitting ? 'Finishing…' : 'Finish setup'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NcOnboardingWizard;
