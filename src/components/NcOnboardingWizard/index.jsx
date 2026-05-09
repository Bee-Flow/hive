import React, { useState, useEffect } from 'react';
import { Cloud, Users, Shield, CheckCircle2, ChevronRight, ChevronLeft, Loader2 } from 'lucide-react';
import { API_BASE, authFetch } from '../../utils/helpers';

/**
 * Bee Flow ↔ Nextcloud App Store onboarding wizard.
 *
 * Mounted by App.jsx when /auth/user reports `ncOnboardingNeeded: true`
 * (org has nc_instance_id but nc_onboarding_completed_at is NULL and the
 * caller is the org admin). Four required steps. Submitting writes every
 * choice in one POST and flips the onboarding flag — only after that does
 * connectorJwt unblock auto-provisioning for everyone else.
 */

const STEPS = ['welcome', 'sync', 'shield', 'done'];

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

    const step = STEPS[stepIdx];
    const next = () => setStepIdx(i => Math.min(i + 1, STEPS.length - 1));
    const prev = () => setStepIdx(i => Math.max(i - 1, 0));

    const canAdvance = () => {
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
                                Bee Flow is now connected to your Nextcloud instance. We'll walk you through three quick decisions about how Bee Flow handles your team and their data.
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
