import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Building2, Save, Upload, Palette, FileText, Check, Lock, KeyRound, AlertTriangle, CreditCard, BarChart3, Zap, MessageSquare, DollarSign, Users, Bot, Database, Shield, Info, Globe, X, Plus, ExternalLink, Loader2, ArrowRight, Sparkles, Clock } from 'lucide-react';
import { API_BASE, authFetch } from '../../utils/helpers';
import { cloudFetch } from '../../utils/cloudFetch';
import InvoicesPanel from '../billing/InvoicesPanel';
import { useTranslation } from '../../hooks/useTranslation';
import GuardrailsPanel from './GuardrailsPanel';
import LicenseKeyActivation from './LicenseKeyActivation';
import { useLicenseContext } from '../LicenseContext';
import { useDeploymentMode } from '../../hooks/useDeploymentMode';
import { COUNTRIES } from './subscriptions/access/countries';

// Map a 3-letter currency code to its glyph for inline display.
const currencySym = (c) => ({ EUR: '€', USD: '$', GBP: '£' }[String(c || 'EUR').toUpperCase()] || (c || '€'));

// Labelled form field wrapper. Defined at module scope (not inside the panel's
// render) so its component identity is stable across renders — otherwise React
// remounts the wrapped input on every keystroke and the field loses focus.
const Field = ({ label, hint, children }) => (
    <div>
        <label className="block text-sm font-medium mb-1.5 text-[var(--text-primary)]">{label}</label>
        {hint && <p className="text-[11px] text-[var(--text-muted)] mb-1.5">{hint}</p>}
        {children}
    </div>
);

// Skeleton loader
const Skeleton = () => (
    <div className="flex h-full animate-pulse">
        <div className="w-56 p-4 border-r border-[var(--border-subtle)] space-y-3">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-10 rounded-lg bg-[var(--bg-tertiary)]" />)}
        </div>
        <div className="flex-1 p-8 space-y-5">
            <div className="h-6 w-40 bg-[var(--bg-tertiary)] rounded-lg" />
            {[1, 2, 3].map(i => (
                <div key={i} className="space-y-1.5">
                    <div className="h-4 w-24 bg-[var(--bg-tertiary)] rounded" />
                    <div className="h-10 w-full bg-[var(--bg-tertiary)] rounded-xl" />
                </div>
            ))}
        </div>
    </div>
);

const AUTH_METHODS = [
    {
        id: 'password',
        nameKey: 'org.password_auth',
        descKey: 'org.password_auth_desc',
        icon: (
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
        ),
        color: '#3b82f6',
    },
    {
        id: 'google',
        nameKey: 'org.google_auth',
        descKey: 'org.google_auth_desc',
        icon: (
            <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
        ),
        color: '#4285F4',
    },
    {
        id: 'microsoft',
        nameKey: 'org.microsoft_auth',
        descKey: 'org.microsoft_auth_desc',
        icon: (
            <svg className="w-5 h-5" viewBox="0 0 24 24">
                <rect x="1" y="1" width="10" height="10" fill="#F25022" />
                <rect x="13" y="1" width="10" height="10" fill="#7FBA00" />
                <rect x="1" y="13" width="10" height="10" fill="#00A4EF" />
                <rect x="13" y="13" width="10" height="10" fill="#FFB900" />
            </svg>
        ),
        color: '#00A4EF',
    },
];

const SECTIONS = [
    { id: 'license', labelKey: 'settings.license_usage', icon: CreditCard, color: '#3b82f6' },
    { id: 'auth', labelKey: 'settings.signin_method', icon: KeyRound, color: '#10b981' },
    { id: 'privacy', labelKey: 'settings.privacy_shield', icon: Shield, color: '#ef4444' },
    { id: 'info', labelKey: 'settings.org_info', icon: Info, color: '#14b8a6' },
];

// ── Allowed Domains editor (tag-input) ──
const AllowedDomainsEditor = ({ domains = [], onChange, t }) => {
    const [inputValue, setInputValue] = useState('');
    const [error, setError] = useState('');
    const inputRef = useRef(null);

    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/;

    const addDomain = () => {
        const domain = inputValue.trim().toLowerCase();
        if (!domain) return;

        if (!domainRegex.test(domain)) {
            setError(`Invalid domain format: "${domain}"`);
            return;
        }
        if (domains.includes(domain)) {
            setError(`Domain "${domain}" is already added`);
            return;
        }

        setError('');
        onChange([...domains, domain]);
        setInputValue('');
        inputRef.current?.focus();
    };

    const removeDomain = (domainToRemove) => {
        onChange(domains.filter(d => d !== domainToRemove));
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addDomain();
        }
        if (e.key === 'Backspace' && !inputValue && domains.length > 0) {
            removeDomain(domains[domains.length - 1]);
        }
    };

    return (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 space-y-3">
            <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-[var(--accent-primary)]" />
                <span className="text-sm font-semibold text-[var(--text-primary)]">
                    {t('org.allowed_domains') || 'Allowed Domains'}
                </span>
            </div>
            <p className="text-xs text-[var(--text-muted)] ml-6">
                {t('org.allowed_domains_desc') || 'Email domains that are allowed to join this organisation via SSO. Users with matching email domains will be automatically linked to this organisation.'}
            </p>

            {/* Domain tags */}
            <div
                className="flex flex-wrap gap-2 min-h-[38px] rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 cursor-text transition-colors focus-within:border-[var(--accent-primary)]"
                onClick={() => inputRef.current?.focus()}
            >
                {domains.map(domain => (
                    <span
                        key={domain}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-[var(--accent-primary)] text-white"
                    >
                        {domain}
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); removeDomain(domain); }}
                            className="ml-0.5 hover:bg-white/20 rounded-full p-0.5 transition-colors"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    </span>
                ))}
                <div className="flex items-center gap-1 flex-1 min-w-[120px]">
                    <input
                        ref={inputRef}
                        type="text"
                        value={inputValue}
                        onChange={(e) => { setInputValue(e.target.value); setError(''); }}
                        onKeyDown={handleKeyDown}
                        placeholder={domains.length === 0 ? 'company.com' : 'Add domain...'}
                        className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none min-w-0"
                    />
                    {inputValue && (
                        <button
                            type="button"
                            onClick={addDomain}
                            className="p-1 rounded-md hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--accent-primary)] transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {error && (
                <p className="text-xs text-red-400 ml-6">{error}</p>
            )}
        </div>
    );
};

// ── Usage bar component ──
const UsageBar = ({ label, icon: Icon, used, limit, unit, color = '#3b82f6', pctLabel, percentOnly = false }) => {
    const isUnlimited = limit === null || limit === undefined || limit === -1;
    const pct = isUnlimited ? 0 : limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
    const isWarning = pct >= 80 && pct < 95;
    const isCritical = pct >= 95;
    const barColor = isCritical ? '#ef4444' : isWarning ? '#f59e0b' : color;

    const formatValue = (val) => {
        if (val === null || val === undefined || val === -1) return '∞';
        if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
        if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
        return val.toLocaleString();
    };

    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
                    <Icon className="w-3.5 h-3.5" style={{ color }} />
                    {label}
                </div>
                {!percentOnly && (
                    <span className="text-xs text-[var(--text-muted)]">
                        {formatValue(used)}{unit ? ` ${unit}` : ''} / {formatValue(limit)}{unit ? ` ${unit}` : ''}
                    </span>
                )}
            </div>
            <div className="h-2 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
                <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                        width: isUnlimited ? '0%' : `${pct}%`,
                        background: isUnlimited ? 'transparent' : barColor,
                    }}
                />
            </div>
            {!isUnlimited && (
                <div className="flex justify-end">
                    <span className={`text-[10px] font-medium ${isCritical ? 'text-red-500' : isWarning ? 'text-amber-500' : 'text-[var(--text-muted)]'}`}>
                        {pctLabel || `${pct}% used`}
                    </span>
                </div>
            )}
        </div>
    );
};

// ── Org Default Language ───────────────────────────────────────────────────
const OrgDefaultLanguage = () => {
    const { t } = useTranslation();
    const [locales, setLocales] = useState([]);
    const [defaultLocale, setDefaultLocale] = useState('en');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        authFetch(`${API_BASE}/api/languages/org/default`)
            .then(r => r.json())
            .then(data => {
                if (data.defaultLocale) setDefaultLocale(data.defaultLocale);
                if (Array.isArray(data.locales)) setLocales(data.locales);
            })
            .catch(e => console.warn('[OrgInfoPanel] load locales failed', e))
            .finally(() => setLoading(false));
    }, []);

    const handleSave = async (code) => {
        setDefaultLocale(code);
        setSaving(true);
        setSaved(false);
        try {
            const res = await authFetch(`${API_BASE}/api/languages/org/default`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ defaultLocale: code }),
            });
            if (res.ok) {
                setSaved(true);
                setTimeout(() => setSaved(false), 2000);
            }
        } catch (e) { console.error(e); }
        setSaving(false);
    };

    if (loading || locales.length <= 1) return null;

    return (
        <div className="space-y-5">
            <div>
                <h2 className="text-lg font-bold text-[var(--text-primary)]">{t('org.default_language')}</h2>
                <p className="text-sm text-[var(--text-muted)] mt-0.5">{t('org.default_language_desc')}</p>
            </div>
            <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
                <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ background: 'rgba(59,130,246,0.1)' }}>
                        <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                        </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-[var(--text-primary)]">{t('org.new_user_language')}</p>
                        <p className="text-[11px] text-[var(--text-muted)] mt-0.5 mb-3">
                            {t('org.new_user_language_desc')}
                        </p>
                        <div className="flex items-center gap-3">
                            <select
                                value={defaultLocale}
                                onChange={e => handleSave(e.target.value)}
                                disabled={saving}
                                className="px-3 py-2 rounded-lg border text-[13px] outline-none focus:border-[var(--accent-primary)] transition-colors min-w-[200px]"
                                style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                            >
                                {locales.map(l => (
                                    <option key={l.code} value={l.code}>{l.name}</option>
                                ))}
                            </select>
                            {saved && (
                                <span className="text-[11px] font-medium flex items-center gap-1" style={{ color: '#059669' }}>
                                    <Check className="w-3.5 h-3.5" /> {t('common.saved')}
                                </span>
                            )}
                            {saving && (
                                <span className="text-[11px] text-[var(--text-muted)]">{t('common.saving')}</span>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            <div className="p-3 rounded-lg text-[12px] flex items-start gap-2"
                style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', color: 'var(--text-secondary)' }}>
                <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: '#3b82f6' }} />
                <span>
                    {t('org.default_language_info')}
                </span>
            </div>
        </div>
    );
};

const OrgInfoPanel = ({ user, activeSection, onSave: parentOnSave, onStateChange }) => {
    const { t } = useTranslation();
    const licenseCtx = useLicenseContext();
    const hasActiveLicenseKey = licenseCtx?.source === 'license_key';
    const { isCloud, isSelfHosted } = useDeploymentMode();
    // Licence-key management belongs to the admin dashboard, not to per-org
    // settings. On cloud, org settings shows the Stripe subscription ONLY —
    // never a licence-key card (even for Full-tier internal/operator orgs;
    // they manage their key under Admin → Server licence / License keys). On
    // self-hosted there are no subscriptions, so licence keys ARE the org's
    // paid-access mechanism and stay visible here.
    const showLicenseActivation = isSelfHosted;
    const deploymentMode = user?.featureFlags?.deploymentMode || 'cloud';
    const ncOrg = user?.ncOrg || null;
    const isNcOrg = !!ncOrg?.instanceId;
    const [organizations, setOrganizations] = useState([]);
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);
    const [orgData, setOrgData] = useState(null);
    const [hasChanges, setHasChanges] = useState(false);
    const [subscription, setSubscription] = useState(null);
    const [subLoading, setSubLoading] = useState(false);
    const [availablePlans, setAvailablePlans] = useState([]);
    const [stripeEnabled, setStripeEnabled] = useState(false);
    const [checkoutLoading, setCheckoutLoading] = useState(null);
    const [portalLoading, setPortalLoading] = useState(false);
    // Inline plan-picker shown when an already-subscribed org wants to
    // upgrade. Drives /api/subscriptions/orgs/:orgId/upgrade — no Stripe
    // redirect; the subscription stays the same and Stripe pro-rates.
    const [showChangePlan, setShowChangePlan] = useState(false);
    const [cancelBusy, setCancelBusy] = useState(false);
    // Subscription actions (upgrade/downgrade/cancel/checkout/portal) surface
    // their result HERE — kept separate from `message` so they never appear in
    // the org-info save bar (which only handles form saves + the usage toggle).
    const [subMessage, setSubMessage] = useState(null);
    // Change-plan confirmation flow: the selected target plan + the prorated
    // cost preview fetched from /preview-change before we commit the switch.
    const [changeTarget, setChangeTarget] = useState(null);
    const [changePreview, setChangePreview] = useState(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [changeBusy, setChangeBusy] = useState(false);
    // In-app cancel confirmation (replaces the native window.confirm dialog).
    const [showCancelConfirm, setShowCancelConfirm] = useState(false);
    // True between landing on ?checkout=success and the webhook flipping
    // status to active/trialing. Drives a "Subscription activating…" banner
    // so the user never sees stale "no subscription" copy after paying.
    const [checkoutSettling, setCheckoutSettling] = useState(false);
    const originalDataRef = useRef(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [orgsRes, groupsRes] = await Promise.all([
                authFetch(`${API_BASE}/auth/organizations`),
                authFetch(`${API_BASE}/auth/groups`),
            ]);
            let orgs = [];
            let grps = [];
            if (orgsRes.ok) orgs = await orgsRes.json();
            if (groupsRes.ok) grps = await groupsRes.json();
            setOrganizations(orgs);
            setGroups(grps);

            if (orgs.length > 0) {
                // Prefer the user's directly-assigned organizationId
                let myOrg = null;
                if (user?.organizationId) {
                    myOrg = orgs.find(o => o.id === user.organizationId);
                }
                // Self-heal: cached user prop may predate an org rename or
                // NC-bootstrap re-binding (or simply be empty for a fresh
                // session). Always re-query /auth/user when we got orgs back
                // but couldn't match against user.organizationId — the SaaS
                // is the authority for the current binding.
                if (!myOrg) {
                    try {
                        const fresh = await authFetch(`${API_BASE}/auth/user`).then(r => r.ok ? r.json() : null);
                        const freshOrgId = fresh?.user?.organizationId;
                        if (freshOrgId) {
                            myOrg = orgs.find(o => o.id === freshOrgId);
                        }
                    } catch (_) { /* best-effort */ }
                }
                // Fallback: detect from group membership
                if (!myOrg) {
                    const userGroups = user?.groups || [];
                    const userOrgIds = new Set();
                    for (const gid of userGroups) {
                        const g = grps.find(gr => gr.id === gid);
                        if (g?.organizationId) userOrgIds.add(g.organizationId);
                    }
                    myOrg = orgs.find(o => userOrgIds.has(o.id));
                }
                // Final fallback for global admins: show first org
                if (!myOrg && (user?.role === 'admin')) {
                    myOrg = orgs[0];
                }
                if (!myOrg) {
                    setLoading(false);
                    return;
                }
                const data = {
                    id: myOrg.id,
                    name: myOrg.name || '',
                    description: myOrg.description || '',
                    tagline: myOrg.tagline || '',
                    address: myOrg.address || '',
                    billingLine2: myOrg.billingLine2 || '',
                    billingPostalCode: myOrg.billingPostalCode || '',
                    billingCity: myOrg.billingCity || '',
                    billingCountry: myOrg.billingCountry || '',
                    email: myOrg.email || '',
                    phone: myOrg.phone || '',
                    website: myOrg.website || '',
                    kvk: myOrg.kvk || '',
                    vat: myOrg.vat || '',
                    logo: myOrg.logo || '',
                    footerText: myOrg.footerText || '',
                    defaultGroups: myOrg.defaultGroups || [],
                    allowSignup: !!myOrg.allowSignup,
                    authMethod: myOrg.authMethod || null,
                    autoApproveSSO: !!myOrg.autoApproveSSO,
                    // Default to pooled (true) when the column is null on
                    // pre-migration orgs — matches the server-side default.
                    usagePooled: myOrg.usagePooled === undefined ? true : !!myOrg.usagePooled,
                    allowedDomains: Array.isArray(myOrg.allowedDomains) ? myOrg.allowedDomains : [],
                };
                setOrgData(data);
                originalDataRef.current = JSON.stringify(data);
                setHasChanges(false);
            }
        } catch (err) {
            console.error('Failed to fetch org data:', err);
        } finally {
            setLoading(false);
        }
    }, [user]);

    // Fetch subscription data
    const fetchSubscription = useCallback(async (orgId) => {
        if (!orgId) return;
        setSubLoading(true);
        try {
            const res = await cloudFetch(deploymentMode, `${API_BASE}/api/subscriptions/orgs/${orgId}`);
            if (res?.ok) {
                const data = await res.json();
                setSubscription(data);
            } else {
                // 403 = user not in org or no subscription assigned — expected, handle silently.
                // skipped = self-hosted (no /api/subscriptions mount).
                setSubscription(null);
            }
        } catch (err) {
            // Network error — not a 403, log it
            console.warn('[OrgInfoPanel] Failed to fetch subscription:', err);
            setSubscription(null);
        } finally {
            setSubLoading(false);
        }
    }, [deploymentMode]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Fetch available Stripe plans and status
    const fetchStripePlans = useCallback(async () => {
        try {
            const [statusRes, plansRes] = await Promise.all([
                cloudFetch(deploymentMode, `${API_BASE}/api/stripe/status`),
                cloudFetch(deploymentMode, `${API_BASE}/api/stripe/plans`),
            ]);
            if (statusRes?.ok) {
                const statusData = await statusRes.json();
                setStripeEnabled(statusData.enabled);
            }
            if (plansRes?.ok) {
                const plansData = await plansRes.json();
                setAvailablePlans(plansData);
            }
        } catch (err) {
            console.warn('[OrgInfoPanel] Failed to fetch Stripe plans:', err);
        }
    }, [deploymentMode]);

    useEffect(() => {
        if (orgData?.id) {
            fetchSubscription(orgData.id);
        }
        fetchStripePlans();
    }, [orgData?.id, fetchSubscription, fetchStripePlans]);

    // Handle Stripe checkout return URLs. The success branch polls every
    // 1.5s for up to 30s until the subscription flips to active/trialing —
    // the previous single-setTimeout left the UI showing "no subscription"
    // when the webhook took longer than 2s, which is the common path on
    // first-checkout (Stripe issues the event after the redirect).
    useEffect(() => {
        if (!orgData?.id) return;
        const params = new URLSearchParams(window.location.search);
        const status = params.get('checkout');
        if (status === 'cancelled') {
            setMessage({ type: 'error', text: 'Checkout was cancelled. No changes were made.' });
            window.history.replaceState({}, '', window.location.pathname);
            return;
        }
        if (status !== 'success') return;

        const sessionId = params.get('session_id');
        let cancelled = false;
        setCheckoutSettling(true);
        const deadline = Date.now() + 30000;
        (async () => {
            while (!cancelled && Date.now() < deadline) {
                await new Promise(r => setTimeout(r, 1500));
                try {
                    // Reconcile straight from the Stripe session so activation
                    // doesn't depend on the webhook landing in time (or at all).
                    if (sessionId) {
                        await cloudFetch(deploymentMode, `${API_BASE}/api/stripe/sessions/${encodeURIComponent(sessionId)}`).catch(() => {});
                    }
                    const res = await cloudFetch(deploymentMode, `${API_BASE}/api/subscriptions/orgs/${orgData.id}`);
                    if (res?.ok) {
                        const fresh = await res.json();
                        if (fresh && (fresh.status === 'active' || fresh.status === 'trialing')) {
                            if (cancelled) return;
                            setSubscription(fresh);
                            setCheckoutSettling(false);
                            setMessage({ type: 'success', text: '🎉 Subscription activated!' });
                            window.history.replaceState({}, '', window.location.pathname);
                            return;
                        }
                    }
                } catch (_) { /* keep polling */ }
            }
            if (!cancelled) {
                setCheckoutSettling(false);
                setMessage({
                    type: 'error',
                    text: 'Payment received, but activation is taking longer than expected. Refresh in a minute or email info@beeflow.nl.'
                });
                window.history.replaceState({}, '', window.location.pathname);
            }
        })();
        return () => { cancelled = true; };
    }, [orgData?.id]);

    const handleCheckout = async (planId) => {
        setCheckoutLoading(planId);
        try {
            const res = await cloudFetch(deploymentMode, `${API_BASE}/api/stripe/checkout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ planId, origin: window.location.origin }),
            });
            const data = res?.skipped ? {} : await res.json();
            if (res.ok && data.url) {
                window.location.href = data.url;
            } else {
                setSubMessage({ type: 'error', text: data.error || 'Failed to start checkout' });
            }
        } catch {
            setSubMessage({ type: 'error', text: 'Failed to connect to payment service' });
        } finally {
            setCheckoutLoading(null);
        }
    };

    // Step 1 of a plan change: select a target and fetch the prorated cost
    // preview. Opens the confirmation modal once the preview resolves.
    const handleSelectChange = async (plan) => {
        if (!orgData?.id) return;
        setChangeTarget(plan);
        setChangePreview(null);
        setPreviewLoading(true);
        try {
            const res = await cloudFetch(deploymentMode, `${API_BASE}/api/subscriptions/orgs/${orgData.id}/preview-change`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ planId: plan.id }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || data.error || 'Could not preview this change');
            setChangePreview(data);
        } catch (e) {
            setSubMessage({ type: 'error', text: e.message });
            setChangeTarget(null);
        } finally {
            setPreviewLoading(false);
        }
    };

    // Step 2: commit. Same endpoint handles both directions — upgrades apply
    // now (prorated), downgrades are scheduled at period end by the server.
    const handleConfirmChange = async () => {
        if (!orgData?.id || !changeTarget) return;
        setChangeBusy(true);
        try {
            const res = await cloudFetch(deploymentMode, `${API_BASE}/api/subscriptions/orgs/${orgData.id}/upgrade`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ planId: changeTarget.id }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                const friendly = data.message
                    || ({
                        payment_required: 'Your card was declined. Update your payment method via "Manage Billing".',
                        interval_mismatch: 'Switching between monthly and yearly billing is not available here. Contact info@beeflow.nl.',
                    }[data.error])
                    || data.error
                    || 'Plan change failed';
                throw new Error(friendly);
            }
            setSubscription(data);
            const msg = changeTarget.direction === 'downgrade'
                ? t('org.downgrade_scheduled_msg', 'Downgrade scheduled for the end of this period.')
                : t('org.upgrade_done_msg', 'Plan upgraded. Stripe invoiced the prorated difference.');
            setSubMessage({ type: 'success', text: msg });
            setShowChangePlan(false);
            setChangeTarget(null);
            setChangePreview(null);
        } catch (e) {
            setSubMessage({ type: 'error', text: e.message });
        } finally {
            setChangeBusy(false);
        }
    };

    const handleCancelDowngrade = async () => {
        if (!orgData?.id) return;
        setCancelBusy(true);
        try {
            const res = await cloudFetch(deploymentMode, `${API_BASE}/api/subscriptions/orgs/${orgData.id}/cancel-downgrade`, { method: 'POST' });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || data.error || 'Could not cancel the scheduled change');
            setSubscription(data);
            setSubMessage({ type: 'success', text: t('org.downgrade_cancelled_msg', 'Scheduled downgrade cancelled — you stay on your current plan.') });
        } catch (e) {
            setSubMessage({ type: 'error', text: e.message });
        } finally {
            setCancelBusy(false);
        }
    };

    // Opens the in-app confirmation modal (no native window.confirm).
    const handleCancelSubscription = () => setShowCancelConfirm(true);

    const doCancelSubscription = async () => {
        if (!orgData?.id) return;
        setCancelBusy(true);
        try {
            const res = await cloudFetch(deploymentMode, `${API_BASE}/api/subscriptions/orgs/${orgData.id}/cancel`, { method: 'POST' });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || data.error || 'Cancel failed');
            setSubscription(data);
            setSubMessage({ type: 'success', text: t('org.cancel_scheduled_msg', 'Cancellation scheduled.') });
        } catch (e) {
            setSubMessage({ type: 'error', text: e.message });
        } finally {
            setCancelBusy(false);
            setShowCancelConfirm(false);
        }
    };

    const handleReactivateSubscription = async () => {
        if (!orgData?.id) return;
        setCancelBusy(true);
        try {
            const res = await cloudFetch(deploymentMode, `${API_BASE}/api/subscriptions/orgs/${orgData.id}/reactivate`, { method: 'POST' });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || data.error || 'Reactivate failed');
            setSubscription(data);
            setSubMessage({ type: 'success', text: 'Subscription will continue.' });
        } catch (e) {
            setSubMessage({ type: 'error', text: e.message });
        } finally {
            setCancelBusy(false);
        }
    };

    const handleManageBilling = async () => {
        setPortalLoading(true);
        try {
            const res = await cloudFetch(deploymentMode, `${API_BASE}/api/stripe/portal`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ origin: window.location.origin }),
            });
            const data = res?.skipped ? {} : await res.json();
            if (res.ok && data.url) {
                window.location.href = data.url;
            } else {
                setSubMessage({ type: 'error', text: data.error || 'Failed to open billing portal' });
            }
        } catch {
            setSubMessage({ type: 'error', text: 'Failed to connect to billing portal' });
        } finally {
            setPortalLoading(false);
        }
    };

    // BFSF-251: jump to the org Users panel where seats are added (inviting a
    // user is what adds a billed seat on per-seat plans). Mirrors the app's own
    // back/forward routing — pushState the canonical settings URL, then fire a
    // popstate so the AdvancedSettings shell switches to the Users sub-tab.
    const goToUsersPanel = () => {
        const url = '/app/settings/organisation/users';
        try {
            if (window.location.pathname !== url) window.history.pushState({}, '', url);
            window.dispatchEvent(new PopStateEvent('popstate'));
        } catch {
            window.location.href = url;
        }
    };

    useEffect(() => {
        if (orgData && originalDataRef.current) {
            setHasChanges(JSON.stringify(orgData) !== originalDataRef.current);
        }
    }, [orgData]);

    useEffect(() => {
        if (message) {
            const timer = setTimeout(() => setMessage(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [message]);

    const handleSave = async () => {
        if (!orgData?.id) return;
        setSaving(true);
        try {
            const res = await authFetch(`${API_BASE}/auth/organizations/${orgData.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orgData),
            });
            if (res.ok) {
                setMessage({ type: 'success', text: 'Changes saved' });
                originalDataRef.current = JSON.stringify(orgData);
                setHasChanges(false);
                if (parentOnSave) parentOnSave();
            } else {
                const data = await res.json();
                setMessage({ type: 'error', text: data.error || 'Failed to save' });
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'Connection error' });
        } finally {
            setSaving(false);
        }
    };

    // Notify parent of save state
    useEffect(() => {
        if (onStateChange) onStateChange({ hasChanges, saving, message, handleSave });
    }, [hasChanges, saving, message]);

    const handleLogoUpload = async (e) => {
        const file = e.target.files[0];
        if (!file || !orgData?.id) return;
        const formData = new FormData();
        formData.append('logo', file);
        try {
            const res = await authFetch(`${API_BASE}/auth/organizations/${orgData.id}/logo`, {
                method: 'POST',
                body: formData,
            });
            if (res.ok) {
                const data = await res.json();
                setOrgData(p => ({ ...p, logo: data.logo }));
                setMessage({ type: 'success', text: 'Logo uploaded' });
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'Upload failed' });
        }
    };

    const handleLogoRemove = async () => {
        if (!orgData?.id) return;
        try {
            await authFetch(`${API_BASE}/auth/organizations/${orgData.id}/logo`, { method: 'DELETE' });
            setOrgData(p => ({ ...p, logo: '' }));
            setMessage({ type: 'success', text: 'Logo removed' });
        } catch (err) {
            setMessage({ type: 'error', text: 'Failed to remove logo' });
        }
    };

    const isAuthLocked = !!orgData?.authMethod;

    if (loading) return <Skeleton />;

    if (!orgData) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center text-[var(--text-muted)]">
                    <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-medium">{t('org.no_org')}</p>
                    <p className="text-xs mt-1">{t('org.no_org_desc')}</p>
                </div>
            </div>
        );
    }

    const inputClass = "w-full px-3 py-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm outline-none focus:border-[var(--accent-primary)] transition-colors";

    // Extract subscription info
    const sub = subscription;
    const limits = sub?.effective_limits || {};
    const usage = sub?.current_usage || {};

    // Member-facing org view always shows marked-up cost — message/token
    // counts are deliberately hidden. The upgrade CTA fires when AI usage
    // cost approaches the plan's cost cap (if one is set).
    const orgCostPct = (limits.max_cost_per_month && limits.max_cost_per_month !== -1)
        ? Math.min(100, Math.round(((usage.cost || 0) / limits.max_cost_per_month) * 100))
        : 0;
    const showOrgUpgradeCta = orgCostPct >= 80;

    return (
        <div className="flex-1 overflow-y-auto p-6">

                {/* ── License & Usage ── */}
                {activeSection === 'license' && (
                    <div className="max-w-xl mx-auto space-y-6 animate-fadeIn">
                        <div>
                            {/* Heading reflects whether this org is on a real paid subscription:
                                "Subscription & Usage" when it is, "License & Usage" otherwise. */}
                            <h2 className="text-lg font-bold text-[var(--text-primary)]">
                                {(sub?.stripe_subscription_id || (sub?.billing?.subscription_total || 0) > 0)
                                    ? t('org.subscription_usage', 'Subscription & Usage')
                                    : t('org.license_usage')}
                            </h2>
                            <p className="text-sm text-[var(--text-muted)] mt-0.5">{t('org.license_subtitle')}</p>
                        </div>

                        {/* Subscription action result (upgrade/downgrade/cancel/checkout) —
                            rendered inline here, never in the org-info save bar. */}
                        {subMessage && (
                            <div className={`rounded-xl px-4 py-2.5 text-[12.5px] font-medium flex items-center gap-2 ${subMessage.type === 'success' ? 'bg-green-500/10 text-green-600 border border-green-500/30' : 'bg-red-500/10 text-red-500 border border-red-500/30'}`}>
                                <span>{subMessage.type === 'success' ? '✓' : '⚠'}</span>
                                <span className="flex-1">{subMessage.text}</span>
                                <button onClick={() => setSubMessage(null)} className="opacity-60 hover:opacity-100">✕</button>
                            </div>
                        )}

                        {/* License key activation (self-hosted; or cloud Full-tier internal orgs) */}
                        {showLicenseActivation && <LicenseKeyActivation />}

                        {/* Server-wide licence in effect: the whole install runs at the
                            licence tier, so this org needs no Stripe subscription. Hide the
                            cloud subscription/usage/plans dashboard entirely and show a
                            read-only note instead. Suppressed when LicenseKeyActivation is
                            already rendering its own server-override banner (self-hosted). */}
                        {licenseCtx?.serverOverride && !showLicenseActivation && (
                            <div className="rounded-2xl border px-5 py-4 flex items-start gap-3"
                                style={{ borderColor: 'rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.06)' }}>
                                <Shield className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'rgb(59,130,246)' }} />
                                <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                    <div className="font-semibold mb-0.5" style={{ color: 'var(--text-primary)' }}>
                                        {t('license.server_override_title', 'Tier is managed server-wide')}
                                    </div>
                                    <div>
                                        {t('org.server_license_no_subscription',
                                           'This installation is covered by a server-wide licence, so your organisation does not need a subscription. Usage and billing are managed by the platform operator.')}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Post-checkout settling spinner. Drives the polling loop that waits
                            for the Stripe webhook to flip status → active/trialing. */}
                        {!licenseCtx?.serverOverride && checkoutSettling && (
                            <div
                                className="rounded-2xl border px-4 py-3 flex items-center gap-3"
                                style={{ borderColor: 'rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.06)' }}
                            >
                                <Loader2 className="w-4 h-4 animate-spin shrink-0" style={{ color: '#3b82f6' }} />
                                <div className="flex-1 min-w-0">
                                    <p className="text-[13px] font-semibold text-[var(--text-primary)]">
                                        {t('org.activating_subscription', 'Activating your subscription…')}
                                    </p>
                                    <p className="text-[11.5px] text-[var(--text-muted)]">
                                        {t('org.activating_subscription_hint', 'Payment received — confirming with Stripe.')}
                                    </p>
                                </div>
                            </div>
                        )}

                        {!licenseCtx?.serverOverride && (subLoading ? (
                            <div className="space-y-4 animate-pulse">
                                <div className="h-28 rounded-2xl bg-[var(--bg-tertiary)]" />
                                <div className="h-40 rounded-2xl bg-[var(--bg-tertiary)]" />
                            </div>
                        ) : !sub && hasActiveLicenseKey ? (
                            // License-key activation already shown above; the legacy
                            // Stripe "No subscription" placeholder would just confuse
                            // self-hosted users who paid via license key.
                            null
                        ) : !sub ? (
                            <div className="space-y-5">
                                <div className="p-6 rounded-2xl border-2 border-dashed border-[var(--border-subtle)] text-center">
                                    <CreditCard className="w-10 h-10 mx-auto mb-3 text-[var(--text-muted)] opacity-40" />
                                    <p className="text-sm font-medium text-[var(--text-primary)]">{t('org.no_license')}</p>
                                    <p className="text-xs text-[var(--text-muted)] mt-1">{t('org.no_license_desc')}</p>
                                </div>

                                {/* Available plans from Stripe — cloud only; self-hosted uses license keys */}
                                {isCloud && availablePlans.length > 0 ? (
                                    <div>
                                        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                                            <Zap className="w-4 h-4" style={{ color: '#3b82f6' }} />
                                            {t('org.choose_plan', 'Choose a Plan')}
                                        </h3>
                                        <div className="grid gap-3">
                                            {availablePlans.map(plan => {
                                                const currencySymbol = (plan.currency || 'eur').toUpperCase() === 'EUR' ? '€' : (plan.currency || 'eur').toUpperCase() === 'GBP' ? '£' : '$';
                                                return (
                                                    <div key={plan.id} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 hover:border-[var(--accent-primary)] transition-colors">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <h4 className="text-sm font-bold text-[var(--text-primary)]">{plan.name}</h4>
                                                                    {plan.trial_days > 0 && (
                                                                        <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold bg-green-500/15 text-green-500">
                                                                            {plan.trial_days}d free trial
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {plan.description && <p className="text-[11px] text-[var(--text-muted)] mb-2">{plan.description}</p>}
                                                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-[var(--text-muted)]">
                                                                    {plan.max_users && plan.max_users !== -1 && <span>{plan.max_users} users</span>}
                                                                    {plan.max_agents && plan.max_agents !== -1 && <span>{plan.max_agents} agents</span>}
                                                                    {plan.max_knowledge_sources && plan.max_knowledge_sources !== -1 && <span>{plan.max_knowledge_sources} KB sources</span>}
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-3 ml-4">
                                                                <div className="text-right">
                                                                    <div className="text-lg font-bold text-[var(--text-primary)]">{currencySymbol}{plan.price.toFixed(2)}</div>
                                                                    <div className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider">/ {plan.billing_interval || 'month'}</div>
                                                                </div>
                                                                <button
                                                                    onClick={() => handleCheckout(plan.id)}
                                                                    disabled={checkoutLoading === plan.id || !plan.has_stripe_price}
                                                                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                                                                    style={{ background: '#3b82f6' }}
                                                                >
                                                                    {checkoutLoading === plan.id ? (
                                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                    ) : (
                                                                        <ArrowRight className="w-3.5 h-3.5" />
                                                                    )}
                                                                    {t('org.subscribe', 'Subscribe')}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ) : isCloud ? (
                                    <div className="p-5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] text-center">
                                        <p className="text-sm text-[var(--text-primary)]">{t('org.no_plans_configured', 'No plans are available right now.')}</p>
                                        <p className="text-xs text-[var(--text-muted)] mt-1">
                                            {t('org.contact_for_plan', 'Reach out to')} <a href="mailto:info@beeflow.nl" className="text-[#3b82f6] hover:underline">info@beeflow.nl</a> {t('org.to_get_started', 'to get started.')}
                                        </p>
                                    </div>
                                ) : null}
                            </div>
                        ) : (
                            <>
                                {/* Plan Card */}
                                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] overflow-hidden">
                                    <div className="p-5 flex items-center justify-between" style={{ background: 'rgba(59, 130, 246, 0.06)' }}>
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: '#3b82f6' }}>
                                                <Zap className="w-6 h-6 text-white" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="text-lg font-bold text-[var(--text-primary)]">{sub.plan_name || 'Custom'}</h3>
                                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider ${sub.status === 'active' ? 'bg-green-500/15 text-green-500'
                                                        : sub.status === 'suspended' ? 'bg-red-500/15 text-red-500'
                                                            : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
                                                        }`}>
                                                        {sub.status}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                                                    {t('org.billing_started').replace('{date}', sub.billing_cycle_start ? new Date(sub.billing_cycle_start).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A')}
                                                </p>
                                            </div>
                                        </div>
                                        {/* Change plan / Manage Billing actions. The toggle shows when the
                                            sub is Stripe-managed, the server offers a changeable plan (up or
                                            down), and we're not mid-cancellation. */}
                                        {isCloud && sub.stripe_subscription_id && Array.isArray(sub.changeable_plans) && sub.changeable_plans.length > 0 && !sub.cancel_at_period_end && !sub.pending_plan_id && (
                                            <button
                                                onClick={() => setShowChangePlan(v => !v)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all hover:opacity-80"
                                                style={{ borderColor: 'rgba(59,130,246,0.3)', color: '#3b82f6', background: 'rgba(59,130,246,0.05)' }}
                                            >
                                                <Zap className="w-3 h-3" />
                                                {showChangePlan
                                                    ? t('org.change_plan_close', 'Close')
                                                    : t('org.change_plan', 'Change plan')}
                                            </button>
                                        )}
                                        {/* BFSF-241: only show the Stripe Customer Portal link for a real
                                            paying relationship. Free/trial/no-invoice customers got an
                                            empty "no invoice history" portal showing global payment
                                            methods (Pix/Kakao/Amazon) that don't match our checkout.
                                            Includes previously-paid states (paused/disputed) so paying
                                            customers keep portal access; excludes trialing/free. */}
                                        {sub.stripe_customer_id && ['paid', 'past_due', 'paused', 'disputed'].includes(sub.payment_status) && (
                                            <button
                                                onClick={handleManageBilling}
                                                disabled={portalLoading}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all hover:opacity-80"
                                                style={{ borderColor: 'rgba(59,130,246,0.3)', color: '#3b82f6', background: 'rgba(59,130,246,0.05)' }}
                                            >
                                                {portalLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ExternalLink className="w-3 h-3" />}
                                                {t('org.manage_billing', 'Manage Billing')}
                                            </button>
                                        )}
                                        {limits.max_cost_per_month != null && limits.max_cost_per_month !== -1 && (
                                            <div className="text-right">
                                                <div className="text-xl font-bold text-[var(--text-primary)]">€{Number(limits.max_cost_per_month).toFixed(2)}</div>
                                                <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">{t('org.cost_cap_month')}</div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Quick stats — AI usage shown as % of the cost cap (the actual
                                        € amount is intentionally hidden for fixed-plan customers; the
                                        cap itself and the subscription price remain in € below). */}
                                    <div className="border-t border-[var(--border-subtle)]">
                                        <div className="p-4 text-center">
                                            <div className="text-2xl font-bold text-[var(--text-primary)]">
                                                {(limits.max_cost_per_month && limits.max_cost_per_month !== -1) ? `${orgCostPct}%` : '—'}
                                            </div>
                                            <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mt-0.5">
                                                {(limits.max_cost_per_month && limits.max_cost_per_month !== -1)
                                                    ? t('org.ai_usage_of_cap', 'AI usage of cap this period')
                                                    : t('org.ai_usage_this_period', 'AI usage this period')}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Invoices — in-app list with Stripe PDF downloads */}
                                {sub.stripe_customer_id && (
                                    <InvoicesPanel
                                        fetcher={async () => {
                                            const res = await cloudFetch(deploymentMode, `${API_BASE}/api/stripe/invoices`);
                                            if (!res.ok) throw new Error('Failed to load invoices');
                                            const data = await res.json();
                                            return data.invoices || [];
                                        }}
                                        pdfFetcher={(invoiceId) => cloudFetch(deploymentMode, `${API_BASE}/api/stripe/invoices/${invoiceId}/pdf`)}
                                    />
                                )}

                                {/* Inline Change Plan picker. Drives the in-app plan-change endpoint
                                    — no new Stripe Checkout session. Server provides changeable_plans
                                    (both directions, same scope + interval). Selecting one opens a
                                    confirmation modal with the prorated cost preview. */}
                                {showChangePlan && isCloud && sub.stripe_subscription_id && Array.isArray(sub.changeable_plans) && sub.changeable_plans.length > 0 && !sub.cancel_at_period_end && !sub.pending_plan_id && (
                                    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-3">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Zap className="w-4 h-4" style={{ color: '#3b82f6' }} />
                                            <h3 className="text-sm font-semibold text-[var(--text-primary)]">{t('org.change_plan', 'Change plan')}</h3>
                                        </div>
                                        <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                                            {t('org.change_plan_hint', 'Upgrades take effect immediately (prorated). Downgrades take effect at the end of your current billing period.')}
                                        </p>
                                        <div className="grid gap-3">
                                            {sub.changeable_plans.map(plan => {
                                                const sym = (plan.currency || 'eur').toUpperCase() === 'EUR' ? '€' : (plan.currency || 'eur').toUpperCase() === 'GBP' ? '£' : '$';
                                                const isDown = plan.direction === 'downgrade';
                                                return (
                                                    <div key={plan.id} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 hover:border-[var(--accent-primary)] transition-colors">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <h4 className="text-sm font-bold text-[var(--text-primary)]">{plan.name}</h4>
                                                                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider ${isDown ? 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]' : 'bg-blue-500/15 text-blue-500'}`}>
                                                                        {isDown ? t('org.downgrade', 'Downgrade') : t('org.upgrade', 'Upgrade')}
                                                                    </span>
                                                                </div>
                                                                {plan.description && <p className="text-[11px] text-[var(--text-muted)] mb-2">{plan.description}</p>}
                                                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-[var(--text-muted)]">
                                                                    {plan.max_users && plan.max_users !== -1 && <span>{plan.max_users} users</span>}
                                                                    {plan.max_agents && plan.max_agents !== -1 && <span>{plan.max_agents} agents</span>}
                                                                    {plan.max_knowledge_sources && plan.max_knowledge_sources !== -1 && <span>{plan.max_knowledge_sources} KB sources</span>}
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-3 ml-4">
                                                                <div className="text-right">
                                                                    <div className="text-lg font-bold text-[var(--text-primary)]">{sym}{Number(plan.price).toFixed(2)}</div>
                                                                    <div className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider">/ {plan.billing_interval || 'month'}</div>
                                                                </div>
                                                                <button
                                                                    onClick={() => handleSelectChange(plan)}
                                                                    disabled={previewLoading || !plan.has_stripe_price}
                                                                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                                                                    style={{ background: isDown ? '#64748b' : '#3b82f6' }}
                                                                >
                                                                    {(previewLoading && changeTarget?.id === plan.id) ? (
                                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                    ) : (
                                                                        <ArrowRight className="w-3.5 h-3.5" />
                                                                    )}
                                                                    {isDown ? t('org.downgrade', 'Downgrade') : t('org.upgrade_button', 'Upgrade')}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Scheduled-downgrade banner. The org keeps its current (higher) plan
                                    until pending_plan_effective, then the schedule flips it down.
                                    The Undo button releases the Stripe schedule. */}
                                {sub.pending_plan_id && (
                                    <div
                                        className="rounded-2xl border px-4 py-3 flex items-center gap-3"
                                        style={{ borderColor: 'rgba(100,116,139,0.35)', background: 'rgba(100,116,139,0.06)' }}
                                    >
                                        <Clock className="w-4 h-4 shrink-0" style={{ color: '#64748b' }} />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[13px] font-semibold text-[var(--text-primary)]">
                                                {t('org.downgrade_scheduled', 'Downgrade to')} {sub.pending_plan_name || t('org.a_lower_plan', 'a lower plan')} {t('org.downgrade_scheduled_on', 'on')} {sub.pending_plan_effective ? new Date(sub.pending_plan_effective).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' }) : t('org.period_end', 'the end of this period')}.
                                            </p>
                                            <p className="text-[11.5px] text-[var(--text-muted)]">
                                                {t('org.downgrade_keeps_access', 'You keep your current plan until then.')}
                                            </p>
                                        </div>
                                        <button
                                            onClick={handleCancelDowngrade}
                                            disabled={cancelBusy}
                                            className="shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-all hover:opacity-80 disabled:opacity-50"
                                            style={{ borderColor: 'rgba(100,116,139,0.35)', color: '#64748b', background: 'rgba(100,116,139,0.05)' }}
                                        >
                                            {cancelBusy ? <Loader2 className="w-3 h-3 animate-spin inline" /> : t('org.keep_current_plan', 'Keep current plan')}
                                        </button>
                                    </div>
                                )}

                                {/* Highest-plan message: only when there's a paying sub and the
                                    server has no changeable plans (and we're not mid-cancel/pending). */}
                                {isCloud && sub.stripe_subscription_id && (sub.billing?.subscription_total || 0) > 0 && Array.isArray(sub.changeable_plans) && sub.changeable_plans.length === 0 && !sub.cancel_at_period_end && !sub.pending_plan_id && (
                                    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 py-3 text-[12px] text-[var(--text-muted)]">
                                        {t('org.on_highest_plan', "You're on the highest plan — contact")} <a href="mailto:info@beeflow.nl" className="text-[#3b82f6] hover:underline">info@beeflow.nl</a> {t('org.for_custom_pricing', 'for custom pricing.')}
                                    </div>
                                )}

                                {/* Subscribe-to-paid section for orgs on a free/manual (non-Stripe)
                                    plan. Routes through Stripe Checkout, which establishes the
                                    stripe_subscription_id so upgrades/downgrades/billing work after. */}
                                {isCloud && !sub.stripe_subscription_id && availablePlans.length > 0 && (
                                    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-3">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Zap className="w-4 h-4" style={{ color: '#3b82f6' }} />
                                            <h3 className="text-sm font-semibold text-[var(--text-primary)]">{t('org.upgrade_to_paid', 'Upgrade to a paid plan')}</h3>
                                        </div>
                                        <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                                            {t('org.upgrade_to_paid_hint', "You're on a free plan. Subscribe to unlock higher usage and more features — you'll be taken to secure Stripe checkout.")}
                                        </p>
                                        {/* BFSF-243: recurring-billing (automatische incasso) disclosure */}
                                        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2">
                                            <CreditCard className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
                                            <p className="text-[11px] leading-snug text-[var(--text-secondary)]">
                                                {t('billing.recurring_notice', 'This is a recurring monthly subscription. Your selected payment method is charged automatically each billing period (automatische incasso) until you cancel.')}
                                            </p>
                                        </div>
                                        <div className="grid gap-3">
                                            {availablePlans.map(plan => {
                                                const sym = (plan.currency || 'eur').toUpperCase() === 'EUR' ? '€' : (plan.currency || 'eur').toUpperCase() === 'GBP' ? '£' : '$';
                                                return (
                                                    <div key={plan.id} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 hover:border-[var(--accent-primary)] transition-colors">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <h4 className="text-sm font-bold text-[var(--text-primary)]">{plan.name}</h4>
                                                                    {plan.trial_days > 0 && (
                                                                        <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold bg-green-500/15 text-green-500">{plan.trial_days}d free trial</span>
                                                                    )}
                                                                </div>
                                                                {plan.description && <p className="text-[11px] text-[var(--text-muted)] mb-2">{plan.description}</p>}
                                                            </div>
                                                            <div className="flex items-center gap-3 ml-4">
                                                                <div className="text-right">
                                                                    <div className="text-lg font-bold text-[var(--text-primary)]">{sym}{Number(plan.price).toFixed(2)}</div>
                                                                    <div className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider">/ {plan.billing_interval || 'month'}{plan.per_seat ? ` ${t('org.per_seat', '/ seat')}` : ''}</div>
                                                                </div>
                                                                <button
                                                                    onClick={() => handleCheckout(plan.id)}
                                                                    disabled={checkoutLoading === plan.id}
                                                                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                                                                    style={{ background: '#3b82f6' }}
                                                                >
                                                                    {checkoutLoading === plan.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
                                                                    {t('org.subscribe', 'Subscribe')}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Scheduled-cancel banner. Shown when Stripe (or this user) has set
                                    cancel_at_period_end=true. The org keeps access until cancel_at;
                                    the Reactivate button calls /reactivate to clear the flag. */}
                                {sub.cancel_at_period_end && (
                                    <div
                                        className="rounded-2xl border px-4 py-3 flex items-center gap-3"
                                        style={{ borderColor: 'rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.06)' }}
                                    >
                                        <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: '#3b82f6' }} />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[13px] font-semibold text-[var(--text-primary)]">
                                                {t('org.cancel_scheduled', 'Subscription cancels on')} {sub.cancel_at ? new Date(sub.cancel_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' }) : 'the end of this period'}.
                                            </p>
                                            <p className="text-[11.5px] text-[var(--text-muted)]">
                                                {t('org.cancel_keeps_access', 'You keep access until that date.')}
                                            </p>
                                        </div>
                                        <button
                                            onClick={handleReactivateSubscription}
                                            disabled={cancelBusy}
                                            className="shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-all hover:opacity-80 disabled:opacity-50"
                                            style={{ borderColor: 'rgba(59,130,246,0.3)', color: '#3b82f6', background: 'rgba(59,130,246,0.05)' }}
                                        >
                                            {cancelBusy ? <Loader2 className="w-3 h-3 animate-spin inline" /> : t('org.keep_subscription', 'Keep subscription')}
                                        </button>
                                    </div>
                                )}

                                {/* Subscription billing card */}
                                {sub.billing && Number(sub.billing.subscription_total) > 0 && (
                                    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
                                        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                                            <CreditCard className="w-4 h-4 text-[var(--text-muted)]" />
                                            {t('org.subscription', 'Subscription')}
                                        </h3>
                                        <div className="flex items-baseline justify-between">
                                            <span className="text-[12px] text-[var(--text-muted)]">{t('org.billed_per_cycle', 'Billed per cycle')}</span>
                                            <span className="text-2xl font-bold text-[var(--text-primary)]">
                                                {currencySym(sub.billing.plan_currency)}{Number(sub.billing.subscription_total).toFixed(2)}
                                                <span className="ml-1 text-[11px] font-normal text-[var(--text-muted)]">/ {sub.billing.billing_interval === 'yearly' ? t('org.year', 'year') : t('org.month', 'month')}</span>
                                            </span>
                                        </div>
                                        {sub.billing.per_seat && (
                                            <div className="mt-2 pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between text-[12px]">
                                                <span className="text-[var(--text-muted)]">
                                                    {sub.billing.seat_quantity} × {currencySym(sub.billing.plan_currency)}{Number(sub.billing.plan_price).toFixed(2)} {t('org.per_seat', '/ seat')}
                                                </span>
                                                <span className="text-[var(--text-secondary)] font-medium">
                                                    {sub.billing.seat_quantity} {sub.billing.seat_quantity === 1 ? t('org.seat', 'seat') : t('org.seats', 'seats')}
                                                </span>
                                            </div>
                                        )}
                                        {/* Cancel-at-period-end action. Muted — destructive but reversible
                                            (the Reactivate banner appears on success). Hidden during the
                                            scheduled-cancel window since the banner has its own undo CTA. */}
                                        {sub.stripe_subscription_id && sub.status === 'active' && !sub.cancel_at_period_end && (
                                            <div className="mt-3 pt-3 border-t border-[var(--border-subtle)] flex justify-end">
                                                <button
                                                    onClick={handleCancelSubscription}
                                                    disabled={cancelBusy}
                                                    className="text-[11.5px] font-medium text-[#64748b] hover:text-[var(--text-primary)] disabled:opacity-50 transition-colors"
                                                >
                                                    {cancelBusy ? <Loader2 className="w-3 h-3 animate-spin inline" /> : t('org.cancel_subscription', 'Cancel subscription')}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Upgrade CTA — surfaces when AI usage cost approaches the plan cap */}
                                {showOrgUpgradeCta && (
                                    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 flex items-center gap-3">
                                        <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[13px] font-semibold text-[var(--text-primary)]">
                                                You've used {orgCostPct}% of your AI usage budget this period.
                                            </p>
                                            <p className="text-[11.5px] text-[var(--text-muted)]">Upgrade to a higher plan for more AI usage.</p>
                                        </div>
                                        <a
                                            href="/app/admin/subscriptions"
                                            className="shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                                        >
                                            Upgrade plan
                                        </a>
                                    </div>
                                )}

                                {/* Usage Bars — AI usage shown as % of cap only (no € amount). */}
                                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-4">
                                    <div className="flex items-center gap-2 mb-1">
                                        <BarChart3 className="w-4 h-4 text-[var(--text-muted)]" />
                                        <h3 className="text-sm font-semibold text-[var(--text-primary)]">{t('org.usage_this_period')}</h3>
                                    </div>

                                    <UsageBar
                                        label={t('org.ai_usage', 'AI usage')}
                                        icon={DollarSign}
                                        used={usage.cost || 0}
                                        limit={limits.max_cost_per_month}
                                        color="#10b981"
                                        percentOnly
                                    />
                                </div>

                                {/* Plan limits grid — only renders concrete caps; ∞ tiles are hidden,
                                    and the whole card collapses when no limits are set and there are no notes. */}
                                {(() => {
                                    const limitItems = [
                                        { key: 'users', label: t('org.users'), icon: Users, val: limits.max_users, color: '#3b82f6' },
                                        { key: 'agents', label: t('org.agents'), icon: Bot, val: limits.max_agents, color: '#f59e0b' },
                                        { key: 'knowledge', label: t('org.knowledge_sources'), icon: Database, val: limits.max_knowledge_sources, color: '#10b981' },
                                    ].filter(it => it.val !== null && it.val !== undefined && it.val !== -1);
                                    if (limitItems.length === 0 && !sub.notes) return null;
                                    return (
                                        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
                                            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">{t('org.plan_limits')}</h3>
                                            {limitItems.length > 0 && (
                                                <div className="grid grid-cols-2 gap-3">
                                                    {limitItems.map(item => {
                                                        const Icon = item.icon;
                                                        return (
                                                            <div key={item.label} className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
                                                                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${item.color}10` }}>
                                                                    <Icon className="w-4 h-4" style={{ color: item.color }} />
                                                                </div>
                                                                <div>
                                                                    <div className="text-sm font-bold text-[var(--text-primary)]">
                                                                        {Number(item.val).toLocaleString()}
                                                                    </div>
                                                                    <div className="text-[10px] text-[var(--text-muted)]">{item.label}</div>
                                                                </div>
                                                                {/* BFSF-251: direct seat/user add from the Gebruikers card */}
                                                                {item.key === 'users' && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={goToUsersPanel}
                                                                        className="ml-auto inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold border transition-all hover:opacity-80"
                                                                        style={{ borderColor: 'rgba(59,130,246,0.3)', color: '#3b82f6', background: 'rgba(59,130,246,0.05)' }}
                                                                    >
                                                                        <Plus className="w-3 h-3" /> {t('org.add_user', 'Add user')}
                                                                    </button>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                            {/* BFSF-251: per-seat plans bill each invited user; surface how the
                                                proration works so adding a seat isn't a surprise on the invoice. */}
                                            {sub.billing?.per_seat && (
                                                <div className="mt-3 flex items-start gap-2 text-[11px] text-[var(--text-muted)]">
                                                    <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                                    <span>{t('org.add_user_hint', 'Inviting a user adds a seat to your plan. Extra seats are billed per user per month and prorated for the current period.')} {t('org.seats_proration_note', 'Stripe prorates the difference on your next invoice.')}</span>
                                                </div>
                                            )}
                                            {sub.notes && (
                                                <div className={limitItems.length > 0 ? 'mt-4 pt-4 border-t border-[var(--border-subtle)]' : ''}>
                                                    <p className="text-xs text-[var(--text-muted)]">
                                                        <span className="font-medium text-[var(--text-secondary)]">{t('org.notes')}: </span>
                                                        {sub.notes}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}
                            </>
                        ))}

                        {/* ── AI usage sharing (moved here from Org Info) ──
                            Only shown when a subscription with a real cost
                            budget is bound to the org; the toggle merely splits
                            that budget, so it's meaningless (and hidden) on the
                            free Community / no-subscription tier. */}
                        {!licenseCtx?.serverOverride && orgData && subscription
                            && limits.max_cost_per_month != null && limits.max_cost_per_month !== -1 && (
                            <div className="space-y-3 pt-2">
                                <div>
                                    <h3 className="text-sm font-semibold text-[var(--text-primary)]">{t('org.share_usage', 'AI usage sharing')}</h3>
                                    <p className="text-[12px] text-[var(--text-muted)] mt-0.5">{t('org.share_usage_desc', 'Choose whether your team shares one AI-usage budget, or whether each user gets their own slice.')}</p>
                                </div>
                                <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] flex items-start gap-3">
                                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'rgba(16,185,129,0.12)' }}>
                                        <Users className="w-4 h-4" style={{ color: '#10b981' }} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[13px] font-medium text-[var(--text-primary)]">{t('org.share_usage_label', 'Share AI usage across the organisation')}</p>
                                        <p className="text-[11px] text-[var(--text-muted)] mt-0.5 mb-3">{t('org.share_usage_explainer', 'When on, every user shares the plan\'s cost budget. When off, the budget is divided equally between active users so each user gets their own slice for the period.')}</p>
                                        <label className="inline-flex items-center gap-3 cursor-pointer select-none">
                                            <span className="relative inline-flex h-5 w-9 items-center">
                                                <input
                                                    type="checkbox"
                                                    checked={!!orgData.usagePooled}
                                                    onChange={e => setOrgData(p => ({ ...p, usagePooled: e.target.checked }))}
                                                    className="sr-only peer"
                                                />
                                                <span className="absolute inset-0 rounded-full bg-[var(--bg-tertiary)] border border-[var(--border-default)] peer-checked:bg-emerald-500 peer-checked:border-emerald-500 transition-colors" />
                                                <span className="absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
                                            </span>
                                            <span className="text-[12px] text-[var(--text-secondary)]">
                                                {orgData.usagePooled
                                                    ? t('org.share_usage_on', 'Pooled across the organisation')
                                                    : t('org.share_usage_off', 'Each user has their own budget')}
                                            </span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ── Change-plan confirmation modal ── */}
                        {changeTarget && changePreview && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }} onClick={() => { if (!changeBusy) { setChangeTarget(null); setChangePreview(null); } }}>
                                <div className="w-full max-w-md rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-4" onClick={e => e.stopPropagation()}>
                                    <div className="flex items-center gap-2">
                                        <Zap className="w-4 h-4" style={{ color: changePreview.direction === 'downgrade' ? '#64748b' : '#3b82f6' }} />
                                        <h3 className="text-sm font-bold text-[var(--text-primary)]">
                                            {changePreview.direction === 'downgrade' ? t('org.confirm_downgrade', 'Confirm downgrade') : t('org.confirm_upgrade', 'Confirm upgrade')} — {changeTarget.name}
                                        </h3>
                                    </div>
                                    {(() => {
                                        const sym = (changePreview.currency || 'EUR').toUpperCase() === 'EUR' ? '€' : (changePreview.currency || 'EUR').toUpperCase() === 'GBP' ? '£' : '$';
                                        const renewal = `${sym}${Number(changePreview.next_renewal_total || 0).toFixed(2)} / ${(changeTarget.billing_interval === 'yearly' ? t('org.year', 'year') : t('org.month', 'month'))}`;
                                        if (changePreview.direction === 'downgrade') {
                                            const date = changePreview.effective ? new Date(changePreview.effective).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' }) : t('org.period_end', 'the end of this period');
                                            return (
                                                <div className="rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-4 space-y-2 text-[13px]">
                                                    <div className="flex justify-between"><span className="text-[var(--text-muted)]">{t('org.takes_effect', 'Takes effect')}</span><span className="font-semibold text-[var(--text-primary)]">{date}</span></div>
                                                    <div className="flex justify-between"><span className="text-[var(--text-muted)]">{t('org.charge_today', 'Charge today')}</span><span className="font-semibold text-[var(--text-primary)]">{sym}0.00</span></div>
                                                    <div className="flex justify-between"><span className="text-[var(--text-muted)]">{t('org.then', 'Then')}</span><span className="font-semibold text-[var(--text-primary)]">{renewal}</span></div>
                                                </div>
                                            );
                                        }
                                        const charge = Number(changePreview.proration_amount || 0);
                                        return (
                                            <div className="rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-4 space-y-2 text-[13px]">
                                                <div className="flex justify-between"><span className="text-[var(--text-muted)]">{t('org.prorated_charge_today', 'Prorated charge today')}</span><span className="font-semibold text-[var(--text-primary)]">{sym}{charge.toFixed(2)}</span></div>
                                                <div className="flex justify-between"><span className="text-[var(--text-muted)]">{t('org.then', 'Then')}</span><span className="font-semibold text-[var(--text-primary)]">{renewal}</span></div>
                                                {changePreview.per_seat && changePreview.seat_quantity > 0 && (
                                                    <div className="flex justify-between text-[11px] pt-1 border-t border-[var(--border-subtle)]"><span className="text-[var(--text-muted)]">{changePreview.seat_quantity} {t('org.seats', 'seats')}</span><span className="text-[var(--text-muted)]">{t('org.billed_per_seat', 'billed per seat')}</span></div>
                                                )}
                                            </div>
                                        );
                                    })()}
                                    <div className="flex justify-end gap-2">
                                        <button onClick={() => { setChangeTarget(null); setChangePreview(null); }} disabled={changeBusy} className="px-3 py-1.5 rounded-lg text-[12px] font-semibold border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] disabled:opacity-50">
                                            {t('org.cancel', 'Cancel')}
                                        </button>
                                        <button onClick={handleConfirmChange} disabled={changeBusy} className="px-4 py-1.5 rounded-lg text-[12px] font-semibold text-white disabled:opacity-50" style={{ background: changePreview.direction === 'downgrade' ? '#64748b' : '#3b82f6' }}>
                                            {changeBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin inline" /> : t('org.confirm', 'Confirm')}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ── Cancel-subscription confirmation modal (in-app, not window.confirm) ── */}
                        {showCancelConfirm && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }} onClick={() => { if (!cancelBusy) setShowCancelConfirm(false); }}>
                                <div className="w-full max-w-md rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-4" onClick={e => e.stopPropagation()}>
                                    <div className="flex items-center gap-2">
                                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                                        <h3 className="text-sm font-bold text-[var(--text-primary)]">{t('org.cancel_subscription', 'Cancel subscription')}</h3>
                                    </div>
                                    <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">
                                        {t('org.cancel_confirm_body', 'Cancel your subscription at the end of the current billing period? You keep full access until then, and no further payments will be taken.')}
                                    </p>
                                    <div className="flex justify-end gap-2">
                                        <button onClick={() => setShowCancelConfirm(false)} disabled={cancelBusy} className="px-3 py-1.5 rounded-lg text-[12px] font-semibold border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] disabled:opacity-50">
                                            {t('org.keep_subscription', 'Keep subscription')}
                                        </button>
                                        <button onClick={doCancelSubscription} disabled={cancelBusy} className="px-4 py-1.5 rounded-lg text-[12px] font-semibold text-white bg-red-500 hover:bg-red-600 disabled:opacity-50">
                                            {cancelBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin inline" /> : t('org.cancel_subscription_confirm', 'Cancel subscription')}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── Sign-in Method ── */}
                {activeSection === 'auth' && (
                    <div className="max-w-xl mx-auto space-y-5 animate-fadeIn">
                        <div>
                            <h2 className="text-lg font-bold text-[var(--text-primary)]">{t('org.signin_title')}</h2>
                            <p className="text-sm text-[var(--text-muted)] mt-0.5">{t('org.signin_subtitle')}</p>
                        </div>

                        {isAuthLocked && (
                            <div className="flex gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.15)' }}>
                                <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{t('org.signin_locked')}</p>
                                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                                        {t('org.signin_locked_desc')}
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="grid gap-3">
                            {AUTH_METHODS.map(method => {
                                const isSelected = orgData.authMethod === method.id;
                                const isDisabledChoice = isAuthLocked && !isSelected;
                                return (
                                    <button
                                        key={method.id}
                                        onClick={() => { if (!isAuthLocked) setOrgData(p => ({ ...p, authMethod: method.id })); }}
                                        disabled={isDisabledChoice}
                                        className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border-2 text-left transition-all ${isSelected ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/5'
                                            : isDisabledChoice ? 'border-[var(--border-subtle)] opacity-40 cursor-not-allowed'
                                                : 'border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/40 hover:bg-[var(--bg-secondary)] cursor-pointer'
                                            }`}
                                    >
                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: isSelected ? `${method.color}15` : 'var(--bg-tertiary)' }}>
                                            <div style={{ color: isSelected ? method.color : 'var(--text-muted)' }}>{method.icon}</div>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-semibold text-[var(--text-primary)]">{t(method.nameKey)}</span>
                                                {isSelected && isAuthLocked && (
                                                    <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium bg-green-500/15 text-green-500">
                                                        <Lock className="w-2.5 h-2.5" />{t('org.active')}
                                                    </span>
                                                )}
                                                {isSelected && !isAuthLocked && (
                                                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-blue-500/15 text-blue-500">{t('org.selected')}</span>
                                                )}
                                            </div>
                                            <p className="text-xs text-[var(--text-muted)] mt-0.5">{t(method.descKey)}</p>
                                        </div>
                                        <div className="shrink-0">
                                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-[var(--accent-primary)]' : 'border-[var(--border-subtle)]'}`}>
                                                {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-[var(--accent-primary)]" />}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {!isAuthLocked && (
                            <div className="flex gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(59, 130, 246, 0.06)', border: '1px solid rgba(59, 130, 246, 0.12)' }}>
                                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--text-muted)' }} />
                                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                                    <strong style={{ color: 'var(--text-primary)' }}>{t('org.choose_carefully')}</strong> {t('org.choose_carefully_desc')}
                                </p>
                            </div>
                        )}

                        {/* Allowed Domains (self-hosted org-management feature) */}
                        {isSelfHosted && (
                            <AllowedDomainsEditor
                                domains={orgData.allowedDomains || []}
                                onChange={(domains) => setOrgData(p => ({ ...p, allowedDomains: domains }))}
                                t={t}
                            />
                        )}
                    </div>
                )}

                {/* ── Organisation Info (Branding + Legal combined) ── */}
                {activeSection === 'info' && (
                    <div className="max-w-xl mx-auto space-y-8 animate-fadeIn">
                        {/* NC binding banner — read-only summary of which Nextcloud
                            instance owns this org's identity. Reminds admins that
                            users come from NC and points them to the Sync panel. */}
                        {isNcOrg && (
                            <div
                                className="rounded-2xl p-4 flex items-start gap-3"
                                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}
                            >
                                <div
                                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                                    style={{ background: 'rgba(0, 130, 201, 0.12)' }}
                                >
                                    <svg viewBox="0 0 24 24" width="18" height="18" fill="#0082C9">
                                        <path d="M12.018 6.537a5.5 5.5 0 00-5.142 3.547 3.62 3.62 0 100 3.832 5.498 5.498 0 0010.284 0 3.62 3.62 0 100-3.832 5.5 5.5 0 00-5.142-3.547zm0 1.987a3.518 3.518 0 11-.001 7.035 3.518 3.518 0 010-7.035z" />
                                    </svg>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[13px] font-semibold mb-0.5" style={{ color: 'var(--text-primary)' }}>
                                        Provisioned through Nextcloud
                                    </p>
                                    <p className="text-[12px] mb-2" style={{ color: 'var(--text-muted)' }}>
                                        User accounts and authentication are managed by your Nextcloud instance. Sign-in method and allowed-domain settings are not shown here.
                                    </p>
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                        {ncOrg.baseUrl && (
                                            <span><span className="opacity-70">Instance:</span> <code className="px-1 rounded" style={{ background: 'var(--bg-tertiary)' }}>{ncOrg.baseUrl}</code></span>
                                        )}
                                        {ncOrg.adminUid && (
                                            <span><span className="opacity-70">Bootstrap admin:</span> <code className="px-1 rounded" style={{ background: 'var(--bg-tertiary)' }}>{ncOrg.adminUid}</code></span>
                                        )}
                                        <span><span className="opacity-70">Sync:</span> {(ncOrg.syncMode || 'mirror_all').replace('_', ' ')}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                        {/* ── Branding section ── */}
                        <div className="space-y-5">
                            <div>
                                <h2 className="text-lg font-bold text-[var(--text-primary)]">{t('org.branding')}</h2>
                                <p className="text-sm text-[var(--text-muted)] mt-0.5">{t('org.branding_subtitle')}</p>
                            </div>
                            <Field label={t('org.logo')} hint={t('org.logo_hint')}>
                                <div className="flex items-center gap-4">
                                    {orgData.logo ? (
                                        <img
                                            src={orgData.logo.startsWith('/') ? `${API_BASE}${orgData.logo}` : orgData.logo}
                                            alt="Logo"
                                            className="w-20 h-20 object-contain rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] p-2"
                                        />
                                    ) : (
                                        <div className="w-20 h-20 rounded-xl border-2 border-dashed border-[var(--border-subtle)] flex items-center justify-center bg-[var(--bg-tertiary)]">
                                            <Building2 className="w-8 h-8 text-[var(--text-muted)] opacity-40" />
                                        </div>
                                    )}
                                    <div className="flex flex-col gap-2">
                                        <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-[var(--accent-primary)] text-white hover:opacity-90 transition-opacity">
                                            <Upload className="w-4 h-4" />
                                            {t('org.upload_logo')}
                                            <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden" onChange={handleLogoUpload} />
                                        </label>
                                        {orgData.logo && (
                                            <button onClick={handleLogoRemove} className="text-xs text-[var(--text-muted)] hover:text-red-500 transition-colors text-left">
                                                {t('org.remove_logo')}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </Field>
                            <Field label={t('org.company_name')}>
                                <input type="text" value={orgData.name} onChange={e => setOrgData(p => ({ ...p, name: e.target.value }))} className={inputClass} placeholder={t('org.placeholder_company_name')} />
                            </Field>
                            <Field label={t('org.tagline')} hint={t('org.tagline_hint')}>
                                <input type="text" value={orgData.tagline} onChange={e => setOrgData(p => ({ ...p, tagline: e.target.value }))} className={inputClass} placeholder={t('org.placeholder_tagline')} />
                            </Field>
                            <Field label={t('org.description')}>
                                <input type="text" value={orgData.description} onChange={e => setOrgData(p => ({ ...p, description: e.target.value }))} className={inputClass} placeholder={t('org.placeholder_description')} />
                            </Field>
                            <div className="grid grid-cols-2 gap-4">
                                <Field label={t('org.email')}>
                                    <input type="email" value={orgData.email} onChange={e => setOrgData(p => ({ ...p, email: e.target.value }))} className={inputClass} placeholder={t('org.placeholder_email')} />
                                </Field>
                                <Field label={t('org.phone')}>
                                    <input type="tel" value={orgData.phone} onChange={e => setOrgData(p => ({ ...p, phone: e.target.value }))} className={inputClass} placeholder={t('org.placeholder_phone')} />
                                </Field>
                            </div>
                            <Field label={t('org.website')}>
                                <input type="url" value={orgData.website} onChange={e => setOrgData(p => ({ ...p, website: e.target.value }))} className={inputClass} placeholder={t('org.placeholder_website')} />
                            </Field>
                        </div>

                        {(
                            <>
                                {/* ── Divider ── */}
                                <div className="border-t border-[var(--border-subtle)]" />

                                {/* ── Legal & Invoicing section ── */}
                                <div className="space-y-5">
                                    <div>
                                        <h2 className="text-lg font-bold text-[var(--text-primary)]">{t('org.legal_invoicing')}</h2>
                                        <p className="text-sm text-[var(--text-muted)] mt-0.5">{t('org.legal_subtitle')}</p>
                                    </div>
                                    <Field label={t('org.street')} hint={t('org.billing_address_hint')}>
                                        <input type="text" value={orgData.address} onChange={e => setOrgData(p => ({ ...p, address: e.target.value }))} className={inputClass} placeholder={t('org.placeholder_street')} />
                                    </Field>
                                    <Field label={t('org.address_line2')}>
                                        <input type="text" value={orgData.billingLine2} onChange={e => setOrgData(p => ({ ...p, billingLine2: e.target.value }))} className={inputClass} placeholder={t('org.placeholder_line2')} />
                                    </Field>
                                    <div className="grid grid-cols-2 gap-4">
                                        <Field label={t('org.postal_code')}>
                                            <input type="text" value={orgData.billingPostalCode} onChange={e => setOrgData(p => ({ ...p, billingPostalCode: e.target.value }))} className={inputClass} placeholder={t('org.placeholder_postal_code')} />
                                        </Field>
                                        <Field label={t('org.city')}>
                                            <input type="text" value={orgData.billingCity} onChange={e => setOrgData(p => ({ ...p, billingCity: e.target.value }))} className={inputClass} placeholder={t('org.placeholder_city')} />
                                        </Field>
                                    </div>
                                    <Field label={t('org.country')}>
                                        <select value={orgData.billingCountry} onChange={e => setOrgData(p => ({ ...p, billingCountry: e.target.value }))} className={inputClass}>
                                            <option value="">{t('org.select_country')}</option>
                                            {COUNTRIES.map(c => (
                                                <option key={c.code} value={c.code}>{c.name}</option>
                                            ))}
                                        </select>
                                    </Field>
                                    <div className="grid grid-cols-2 gap-4">
                                        <Field label={t('org.kvk')}>
                                            <input type="text" value={orgData.kvk} onChange={e => setOrgData(p => ({ ...p, kvk: e.target.value }))} className={inputClass} placeholder={t('org.placeholder_kvk')} />
                                        </Field>
                                        <Field label={t('org.vat')}>
                                            <input type="text" value={orgData.vat} onChange={e => setOrgData(p => ({ ...p, vat: e.target.value }))} className={inputClass} placeholder={t('org.placeholder_vat')} />
                                        </Field>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* ── Divider ── */}
                        <div className="border-t border-[var(--border-subtle)]" />

                        {/* ── Default Language for New Users ── */}
                        <OrgDefaultLanguage />
                        {/* AI usage sharing moved to the License & Usage section. */}
                    </div>
                )}
                {/* ── Privacy Shield ── */}
                {activeSection === 'privacy' && (
                    <div className="max-w-3xl mx-auto animate-fadeIn">
                        <GuardrailsPanel orgShieldOnly={true} />
                    </div>
                )}
        </div>
    );
};
export { SECTIONS };
export default OrgInfoPanel;
