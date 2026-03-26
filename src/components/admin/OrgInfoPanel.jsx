import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Building2, Save, Upload, Palette, FileText, Check, Lock, KeyRound, AlertTriangle, CreditCard, BarChart3, Zap, MessageSquare, DollarSign, Users, Bot, Database, Shield, Info } from 'lucide-react';
import { API_BASE, authFetch } from '../../utils/helpers';
import GuardrailsPanel from './GuardrailsPanel';

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
        name: 'Username & Password',
        description: 'Users sign in with a username and password.',
        icon: (
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
        ),
        color: '#6366f1',
    },
    {
        id: 'google',
        name: 'Sign in with Google',
        description: 'Users sign in using their Google account.',
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
        name: 'Sign in with Microsoft',
        description: 'Users sign in using their Microsoft account.',
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
    { id: 'license', label: 'License & Usage', icon: CreditCard, color: '#3b82f6' },
    { id: 'auth', label: 'Sign-in Method', icon: KeyRound, color: '#10b981' },
    { id: 'privacy', label: 'Privacy Shield', icon: Shield, color: '#ef4444' },
    { id: 'info', label: 'Organisation Info', icon: Info, color: '#8b5cf6' },
];

// ── Usage bar component ──
const UsageBar = ({ label, icon: Icon, used, limit, unit, color = '#8b5cf6' }) => {
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
                <span className="text-xs text-[var(--text-muted)]">
                    {formatValue(used)}{unit ? ` ${unit}` : ''} / {formatValue(limit)}{unit ? ` ${unit}` : ''}
                </span>
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
                        {pct}% used
                    </span>
                </div>
            )}
        </div>
    );
};

const OrgInfoPanel = ({ user, activeSection, onSave: parentOnSave, onStateChange }) => {
    const [organizations, setOrganizations] = useState([]);
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);
    const [orgData, setOrgData] = useState(null);
    const [hasChanges, setHasChanges] = useState(false);
    const [subscription, setSubscription] = useState(null);
    const [subLoading, setSubLoading] = useState(false);
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
            const res = await authFetch(`${API_BASE}/api/subscriptions/orgs/${orgId}`);
            if (res.ok) {
                const data = await res.json();
                setSubscription(data);
            } else {
                setSubscription(null);
            }
        } catch (err) {
            console.error('Failed to fetch subscription:', err);
            setSubscription(null);
        } finally {
            setSubLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    useEffect(() => {
        if (orgData?.id) {
            fetchSubscription(orgData.id);
        }
    }, [orgData?.id, fetchSubscription]);

    useEffect(() => {
        if (orgData && originalDataRef.current) {
            setHasChanges(JSON.stringify(orgData) !== originalDataRef.current);
        }
    }, [orgData]);

    useEffect(() => {
        if (message) {
            const t = setTimeout(() => setMessage(null), 3000);
            return () => clearTimeout(t);
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
                    <p className="text-sm font-medium">No organisation found</p>
                    <p className="text-xs mt-1">Ask your administrator to add you to an organisation.</p>
                </div>
            </div>
        );
    }

    const Field = ({ label, hint, children }) => (
        <div>
            <label className="block text-sm font-medium mb-1.5 text-[var(--text-primary)]">{label}</label>
            {hint && <p className="text-[11px] text-[var(--text-muted)] mb-1.5">{hint}</p>}
            {children}
        </div>
    );

    const inputClass = "w-full px-3 py-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm outline-none focus:border-[var(--accent-primary)] transition-colors";

    // Extract subscription info
    const sub = subscription;
    const limits = sub?.effective_limits || {};
    const usage = sub?.current_usage || {};

    return (
        <div className="flex-1 overflow-y-auto p-6">

                {/* ── License & Usage ── */}
                {activeSection === 'license' && (
                    <div className="max-w-xl mx-auto space-y-6 animate-fadeIn">
                        <div>
                            <h2 className="text-lg font-bold text-[var(--text-primary)]">License & Usage</h2>
                            <p className="text-sm text-[var(--text-muted)] mt-0.5">Your current plan and usage for this billing period</p>
                        </div>

                        {subLoading ? (
                            <div className="space-y-4 animate-pulse">
                                <div className="h-28 rounded-2xl bg-[var(--bg-tertiary)]" />
                                <div className="h-40 rounded-2xl bg-[var(--bg-tertiary)]" />
                            </div>
                        ) : !sub ? (
                            <div className="p-8 rounded-2xl border-2 border-dashed border-[var(--border-subtle)] text-center">
                                <CreditCard className="w-10 h-10 mx-auto mb-3 text-[var(--text-muted)] opacity-40" />
                                <p className="text-sm font-medium text-[var(--text-primary)]">No license assigned</p>
                                <p className="text-xs text-[var(--text-muted)] mt-1">Contact your administrator to set up a plan for your organisation.</p>
                            </div>
                        ) : (
                            <>
                                {/* Plan Card */}
                                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] overflow-hidden">
                                    <div className="p-5 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.06), rgba(139, 92, 246, 0.06))' }}>
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>
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
                                                    Billing cycle started {sub.billing_cycle_start ? new Date(sub.billing_cycle_start).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}
                                                </p>
                                            </div>
                                        </div>
                                        {limits.max_cost_per_month != null && limits.max_cost_per_month !== -1 && (
                                            <div className="text-right">
                                                <div className="text-xl font-bold text-[var(--text-primary)]">€{Number(limits.max_cost_per_month).toFixed(2)}</div>
                                                <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">cost cap / month</div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Quick stats */}
                                    <div className="grid grid-cols-3 divide-x divide-[var(--border-subtle)] border-t border-[var(--border-subtle)]">
                                        <div className="p-4 text-center">
                                            <div className="text-lg font-bold text-[var(--text-primary)]">{usage.messages?.toLocaleString() || 0}</div>
                                            <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mt-0.5">Messages</div>
                                        </div>
                                        <div className="p-4 text-center">
                                            <div className="text-lg font-bold text-[var(--text-primary)]">
                                                {usage.tokens >= 1_000_000 ? `${(usage.tokens / 1_000_000).toFixed(1)}M` : usage.tokens >= 1_000 ? `${(usage.tokens / 1_000).toFixed(1)}K` : (usage.tokens || 0).toLocaleString()}
                                            </div>
                                            <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mt-0.5">Tokens</div>
                                        </div>
                                        <div className="p-4 text-center">
                                            <div className="text-lg font-bold text-[var(--text-primary)]">€{Number(usage.cost || 0).toFixed(2)}</div>
                                            <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mt-0.5">Cost</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Usage Bars */}
                                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-4">
                                    <div className="flex items-center gap-2 mb-1">
                                        <BarChart3 className="w-4 h-4 text-[var(--text-muted)]" />
                                        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Usage this period</h3>
                                    </div>

                                    <UsageBar
                                        label="Messages"
                                        icon={MessageSquare}
                                        used={usage.messages || 0}
                                        limit={limits.max_messages_per_month}
                                        color="#3b82f6"
                                    />
                                    <UsageBar
                                        label="Cost"
                                        icon={DollarSign}
                                        used={usage.cost || 0}
                                        limit={limits.max_cost_per_month}
                                        unit="€"
                                        color="#10b981"
                                    />
                                    <UsageBar
                                        label="Tokens"
                                        icon={Zap}
                                        used={usage.tokens || 0}
                                        limit={limits.max_tokens_per_month}
                                        color="#8b5cf6"
                                    />
                                </div>

                                {/* Plan limits grid */}
                                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
                                    <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Plan limits</h3>
                                    <div className="grid grid-cols-2 gap-3">
                                        {[
                                            { label: 'Users', icon: Users, val: limits.max_users, color: '#6366f1' },
                                            { label: 'Agents', icon: Bot, val: limits.max_agents, color: '#f59e0b' },
                                            { label: 'Knowledge Sources', icon: Database, val: limits.max_knowledge_sources, color: '#10b981' },
                                            { label: 'Messages / month', icon: MessageSquare, val: limits.max_messages_per_month, color: '#3b82f6' },
                                        ].map(item => {
                                            const Icon = item.icon;
                                            const isUnlimited = item.val === null || item.val === undefined || item.val === -1;
                                            return (
                                                <div key={item.label} className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
                                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${item.color}10` }}>
                                                        <Icon className="w-4 h-4" style={{ color: item.color }} />
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-bold text-[var(--text-primary)]">
                                                            {isUnlimited ? '∞' : item.val?.toLocaleString()}
                                                        </div>
                                                        <div className="text-[10px] text-[var(--text-muted)]">{item.label}</div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Per-type limits */}
                                    {limits.max_messages_by_type && Object.keys(limits.max_messages_by_type).length > 0 && (
                                        <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
                                            <h4 className="text-xs font-medium text-[var(--text-muted)] mb-2">Message limits by type</h4>
                                            <div className="flex flex-wrap gap-2">
                                                {Object.entries(limits.max_messages_by_type).map(([type, val]) => (
                                                    <span key={type} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
                                                        <span className="font-medium capitalize">{type.replace(/_/g, ' ')}</span>
                                                        <span className="text-[var(--text-muted)]">
                                                            {val === null || val === -1 ? '∞' : val}
                                                        </span>
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {sub.notes && (
                                        <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
                                            <p className="text-xs text-[var(--text-muted)]">
                                                <span className="font-medium text-[var(--text-secondary)]">Notes: </span>
                                                {sub.notes}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* ── Sign-in Method ── */}
                {activeSection === 'auth' && (
                    <div className="max-w-xl mx-auto space-y-5 animate-fadeIn">
                        <div>
                            <h2 className="text-lg font-bold text-[var(--text-primary)]">Sign-in Method</h2>
                            <p className="text-sm text-[var(--text-muted)] mt-0.5">Choose how users will sign into your organisation</p>
                        </div>

                        {isAuthLocked && (
                            <div className="flex gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.15)' }}>
                                <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Sign-in method is locked</p>
                                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                                        Your conversations are protected using a unique key derived from your sign-in method.
                                        Changing how users log in would make existing conversations unreadable, so the
                                        sign-in method cannot be changed after it has been set.
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
                                                <span className="text-sm font-semibold text-[var(--text-primary)]">{method.name}</span>
                                                {isSelected && isAuthLocked && (
                                                    <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium bg-green-500/15 text-green-500">
                                                        <Lock className="w-2.5 h-2.5" />Active
                                                    </span>
                                                )}
                                                {isSelected && !isAuthLocked && (
                                                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-blue-500/15 text-blue-500">Selected</span>
                                                )}
                                            </div>
                                            <p className="text-xs text-[var(--text-muted)] mt-0.5">{method.description}</p>
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
                                    <strong style={{ color: 'var(--text-primary)' }}>Choose carefully:</strong> Once saved, this
                                    cannot be changed. Each user's data is protected with a unique key that is tied to
                                    how they sign in. Switching later would make existing conversations unreadable.
                                </p>
                            </div>
                        )}

                        {/* Auto-approve SSO toggle */}
                        {orgData.authMethod && orgData.authMethod !== 'password' && (
                            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <Users className="w-4 h-4 text-[var(--accent-primary)]" />
                                            <span className="text-sm font-semibold text-[var(--text-primary)]">Auto-approve SSO users</span>
                                        </div>
                                        <p className="text-xs text-[var(--text-muted)] mt-1 ml-6">
                                            When enabled, users with a matching email domain will be automatically added with default permissions.
                                            When disabled, they will be added as pending and require admin approval.
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setOrgData(p => ({ ...p, autoApproveSSO: !p.autoApproveSSO }))}
                                        className={`relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0 ml-4 ${orgData.autoApproveSSO ? 'bg-[var(--accent-primary)]' : 'bg-[var(--border-default)]'}`}
                                    >
                                        <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${orgData.autoApproveSSO ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── Organisation Info (Branding + Legal combined) ── */}
                {activeSection === 'info' && (
                    <div className="max-w-xl mx-auto space-y-8 animate-fadeIn">
                        {/* ── Branding section ── */}
                        <div className="space-y-5">
                            <div>
                                <h2 className="text-lg font-bold text-[var(--text-primary)]">Branding</h2>
                                <p className="text-sm text-[var(--text-muted)] mt-0.5">Logo, name, and public-facing details</p>
                            </div>
                            <Field label="Logo" hint="Displayed in the UI header and exports. PNG or SVG, max 500×200px.">
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
                                            Upload Logo
                                            <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden" onChange={handleLogoUpload} />
                                        </label>
                                        {orgData.logo && (
                                            <button onClick={handleLogoRemove} className="text-xs text-[var(--text-muted)] hover:text-red-500 transition-colors text-left">
                                                Remove logo
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </Field>
                            <Field label="Company Name">
                                <input type="text" value={orgData.name} onChange={e => setOrgData(p => ({ ...p, name: e.target.value }))} className={inputClass} placeholder="Bee Flow B.V." />
                            </Field>
                            <Field label="Tagline" hint="Shown below the company name in headers and exports.">
                                <input type="text" value={orgData.tagline} onChange={e => setOrgData(p => ({ ...p, tagline: e.target.value }))} className={inputClass} placeholder="Your Processes, Pollinated with Intelligence." />
                            </Field>
                            <Field label="Description">
                                <input type="text" value={orgData.description} onChange={e => setOrgData(p => ({ ...p, description: e.target.value }))} className={inputClass} placeholder="Brief description of your organisation" />
                            </Field>
                            <div className="grid grid-cols-2 gap-4">
                                <Field label="Email">
                                    <input type="email" value={orgData.email} onChange={e => setOrgData(p => ({ ...p, email: e.target.value }))} className={inputClass} placeholder="info@company.com" />
                                </Field>
                                <Field label="Phone">
                                    <input type="tel" value={orgData.phone} onChange={e => setOrgData(p => ({ ...p, phone: e.target.value }))} className={inputClass} placeholder="+1 555 123 4567" />
                                </Field>
                            </div>
                            <Field label="Website">
                                <input type="url" value={orgData.website} onChange={e => setOrgData(p => ({ ...p, website: e.target.value }))} className={inputClass} placeholder="https://beeflow.nl" />
                            </Field>
                        </div>

                        {/* ── Divider ── */}
                        <div className="border-t border-[var(--border-subtle)]" />

                        {/* ── Legal & Invoicing section ── */}
                        <div className="space-y-5">
                            <div>
                                <h2 className="text-lg font-bold text-[var(--text-primary)]">Legal & Invoicing</h2>
                                <p className="text-sm text-[var(--text-muted)] mt-0.5">Address, registration, and compliance details</p>
                            </div>
                            <Field label="Address">
                                <input type="text" value={orgData.address} onChange={e => setOrgData(p => ({ ...p, address: e.target.value }))} className={inputClass} placeholder="123 Main Street, City, Country" />
                            </Field>
                            <div className="grid grid-cols-2 gap-4">
                                <Field label="Chamber of Commerce (KVK)">
                                    <input type="text" value={orgData.kvk} onChange={e => setOrgData(p => ({ ...p, kvk: e.target.value }))} className={inputClass} placeholder="97632430" />
                                </Field>
                                <Field label="VAT Number">
                                    <input type="text" value={orgData.vat} onChange={e => setOrgData(p => ({ ...p, vat: e.target.value }))} className={inputClass} placeholder="NL123456789B01" />
                                </Field>
                            </div>
                        </div>
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
