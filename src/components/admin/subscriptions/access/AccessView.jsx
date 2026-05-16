import React, { useEffect, useState } from 'react';
import { ShieldCheck, Building2, Users, Clock, Save, AlertTriangle, CheckCircle, Trash2, Info } from 'lucide-react';
import { SectionHeader } from '../ui/SectionHeader';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Toggle, Checkbox } from '../ui/Toggle';
import { Banner } from '../ui/Banner';
import { Badge } from '../ui/Badge';
import { Spinner } from '../ui/Spinner';
import { EmptyState } from '../ui/EmptyState';
import { useToast } from '../ui/Toast';
import { apiJson } from '../hooks/useApi';

const LOGIN_METHODS = [
    { id: 'password',  label: 'Username & Password' },
    { id: 'google',    label: 'Google SSO' },
    { id: 'microsoft', label: 'Microsoft SSO' },
];

export function AccessView() {
    const toast = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [allowOrgSignups,      setAllowOrgSignups]      = useState(true);
    const [allowConsumerSignups, setAllowConsumerSignups] = useState(true);
    const [consumerLoginMethods, setConsumerLoginMethods] = useState(['password', 'google', 'microsoft']);
    const [waitlistEnabled, setWaitlistEnabled] = useState(false);
    const [waitlistUsers, setWaitlistUsers]     = useState([]);

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const data = await apiJson('/auth/admin/signup-settings');
                if (!alive) return;
                setAllowOrgSignups(data.allowOrgSignups !== false);
                setAllowConsumerSignups(data.allowConsumerSignups !== false);
                setWaitlistEnabled(!!data.waitlistEnabled);
                if (Array.isArray(data.consumerLoginMethods)) setConsumerLoginMethods(data.consumerLoginMethods);
            } catch (e) {
                console.warn('Failed to fetch signup settings:', e);
            } finally {
                if (alive) setLoading(false);
            }
            try {
                const list = await apiJson('/auth/admin/waitlist');
                if (alive) setWaitlistUsers(list);
            } catch (e) { /* ignore */ }
        })();
        return () => { alive = false; };
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            await apiJson('/auth/admin/signup-settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ allowOrgSignups, allowConsumerSignups, waitlistEnabled, consumerLoginMethods }),
            });
            toast.success('Signup settings saved.');
        } catch (e) {
            toast.error(e.message || 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    const approve = async (u) => {
        try {
            await apiJson(`/auth/admin/waitlist/${u.id}/approve`, { method: 'POST' });
            setWaitlistUsers(prev => prev.filter(w => w.id !== u.id));
            toast.success(`${u.displayName || u.username} approved.`);
        } catch (e) { toast.error('Failed to approve.'); }
    };
    const reject = async (u) => {
        if (!window.confirm(`Reject and delete ${u.displayName || u.username}?`)) return;
        try {
            await apiJson(`/auth/admin/waitlist/${u.id}/reject`, { method: 'POST' });
            setWaitlistUsers(prev => prev.filter(w => w.id !== u.id));
            toast.success(`${u.displayName || u.username} rejected.`);
        } catch (e) { toast.error('Failed to reject.'); }
    };

    if (loading) return <Spinner label="Loading settings…" />;

    return (
        <div className="px-6 py-6 max-w-3xl mx-auto">
            <SectionHeader
                title="Access Control"
                description="Control which types of accounts can be created on this platform."
            />

            <Card className="space-y-3 !p-5 mb-4">
                <Toggle
                    checked={allowOrgSignups}
                    onChange={setAllowOrgSignups}
                    icon={Building2}
                    iconClass="text-sky-400"
                    label="Organization signups"
                    description="Allow users to register and create new organizations."
                />

                <div className="rounded-lg overflow-hidden">
                    <Toggle
                        checked={allowConsumerSignups}
                        onChange={setAllowConsumerSignups}
                        icon={Users}
                        iconClass="text-emerald-400"
                        label="Consumer signups"
                        description="Allow users to register personal (non-organization) accounts."
                    />

                    {allowConsumerSignups && (
                        <div className="-mt-1 pt-1">
                            <div className="px-3 py-3 border border-t-0 border-[var(--border-default)] rounded-b-lg bg-[var(--bg-tertiary)]/70">
                                <p className="text-[12px] font-semibold text-[var(--text-secondary)] mb-2">Allowed login methods</p>
                                <div className="flex flex-col gap-2 pl-1">
                                    {LOGIN_METHODS.map(m => (
                                        <Checkbox
                                            key={m.id}
                                            checked={consumerLoginMethods.includes(m.id)}
                                            onChange={on => setConsumerLoginMethods(prev => on ? [...prev, m.id] : prev.filter(x => x !== m.id))}
                                            label={m.label}
                                        />
                                    ))}
                                </div>
                                {consumerLoginMethods.length === 0 && (
                                    <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-rose-400">
                                        <AlertTriangle className="w-3 h-3" /> At least one login method must be enabled.
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <Toggle
                    checked={waitlistEnabled}
                    onChange={setWaitlistEnabled}
                    icon={Clock}
                    iconClass="text-amber-400"
                    label="Waitlist mode"
                    description="Require admin approval for new account registrations. Invited users bypass the waitlist."
                />
            </Card>

            {!allowOrgSignups && !allowConsumerSignups && (
                <Banner tone="danger" icon={AlertTriangle} title="All signups are disabled" className="mb-4">
                    No new users will be able to create accounts. The “Create Account” button will be hidden from the login
                    page. Invited users can still join existing organizations.
                </Banner>
            )}

            <Banner tone="info" icon={Info} className="mb-5">
                These settings take effect immediately. The <strong>ALLOW_SIGNUPS</strong> environment variable acts as a global override —
                if set to <code className="px-1 py-px rounded bg-[var(--bg-tertiary)] text-[11px]">false</code>, both toggles above are ignored.
            </Banner>

            <div className="flex justify-end mb-8">
                <Button icon={Save} onClick={handleSave} busy={saving}>
                    {saving ? 'Saving…' : 'Save changes'}
                </Button>
            </div>

            {(waitlistEnabled || waitlistUsers.length > 0) && (
                <div>
                    <div className="flex items-end justify-between gap-4 mb-3">
                        <div>
                            <h3 className="flex items-center gap-2 text-[16px] font-bold text-[var(--text-primary)]">
                                <Clock className="w-4 h-4 text-amber-400" />
                                Waitlist queue
                                {waitlistUsers.length > 0 && <Badge tone="warning" size="sm">{waitlistUsers.length}</Badge>}
                            </h3>
                            <p className="text-[12px] text-[var(--text-muted)]">Users waiting for account approval.</p>
                        </div>
                    </div>

                    {waitlistUsers.length === 0 ? (
                        <EmptyState
                            icon={CheckCircle}
                            title="No users in the waitlist"
                            description="When waitlist mode is on, new signups appear here for approval."
                        />
                    ) : (
                        <Card padded={false}>
                            {waitlistUsers.map((u, idx) => (
                                <div
                                    key={u.id}
                                    className={`flex items-center justify-between gap-3 px-4 py-3 ${idx < waitlistUsers.length - 1 ? 'border-b border-[var(--border-default)]' : ''}`}
                                >
                                    <div className="min-w-0">
                                        <div className="text-[13px] font-semibold text-[var(--text-primary)] truncate">{u.displayName || u.username}</div>
                                        <div className="flex flex-wrap gap-x-3 mt-0.5 text-[11.5px] text-[var(--text-muted)]">
                                            {u.email && <span>{u.email}</span>}
                                            {u.createdAt && <span>Signed up {new Date(u.createdAt).toLocaleDateString()}</span>}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button size="sm" variant="success" icon={CheckCircle} onClick={() => approve(u)}>Approve</Button>
                                        <Button size="sm" variant="danger" icon={Trash2} onClick={() => reject(u)}>Reject</Button>
                                    </div>
                                </div>
                            ))}
                        </Card>
                    )}
                </div>
            )}
        </div>
    );
}
