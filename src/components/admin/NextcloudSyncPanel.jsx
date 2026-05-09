import React, { useState, useEffect, useCallback } from 'react';
import { Cloud, RefreshCw, Users, AlertTriangle, Check, Loader2 } from 'lucide-react';
import { API_BASE, authFetch } from '../../utils/helpers';

/**
 * Org-admin UI for Nextcloud user/group sync.
 *
 * The org is auto-bound to a NC instance during connector bootstrap. This
 * panel lets the admin pick the sync mode, exclude specific NC groups,
 * and force an on-demand re-sync.
 */
const NextcloudSyncPanel = ({ user }) => {
    // The user prop may be a stale snapshot from initial App mount. If we
    // can't see an org id on it, re-fetch /auth/user once before deciding
    // to show "no org" — the connector flow auto-provisions on first hit.
    const [orgId, setOrgId] = useState(user?.organizationId || null);
    useEffect(() => {
        if (orgId) return;
        let cancelled = false;
        authFetch(`${API_BASE}/auth/user`).then(r => r.ok ? r.json() : null).then(j => {
            if (cancelled) return;
            const fresh = j?.user?.organizationId;
            if (fresh) setOrgId(fresh);
        }).catch(() => {});
        return () => { cancelled = true; };
    }, [orgId]);
    const [config, setConfig] = useState(null);
    const [groups, setGroups] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [message, setMessage] = useState(null);

    const load = useCallback(async () => {
        if (!orgId) return;
        try {
            const [cfgRes, grpRes, usersRes] = await Promise.all([
                authFetch(`${API_BASE}/auth/admin/${orgId}/nc-sync`),
                authFetch(`${API_BASE}/auth/admin/${orgId}/nc-sync/groups`),
                authFetch(`${API_BASE}/auth/admin/${orgId}/nc-sync/users`),
            ]);
            if (cfgRes.ok) setConfig(await cfgRes.json());
            if (grpRes.ok) setGroups((await grpRes.json()).groups || []);
            if (usersRes.ok) setUsers((await usersRes.json()).users || []);
        } catch (err) {
            console.error('[NcSync] load:', err);
        } finally { setLoading(false); }
    }, [orgId]);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        if (message) {
            const t = setTimeout(() => setMessage(null), 4000);
            return () => clearTimeout(t);
        }
    }, [message]);

    const update = (patch) => setConfig(c => ({ ...c, ...patch }));
    const toggleGroup = (key, group) => {
        const list = config[key] || [];
        const next = list.includes(group) ? list.filter(g => g !== group) : [...list, group];
        update({ [key]: next });
    };

    const handleSave = async () => {
        if (!config) return;
        setSaving(true);
        try {
            const res = await authFetch(`${API_BASE}/auth/admin/${orgId}/nc-sync`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mode: config.mode,
                    syncGroups: config.syncGroups,
                    excludedGroups: config.excludedGroups,
                    newUserDefaultStatus: config.newUserDefaultStatus,
                }),
            });
            if (!res.ok) throw new Error('Save failed');
            setMessage({ type: 'ok', text: 'Settings saved' });
        } catch (e) {
            setMessage({ type: 'error', text: e.message });
        } finally { setSaving(false); }
    };

    const handleSyncNow = async () => {
        setSyncing(true);
        try {
            const res = await authFetch(`${API_BASE}/auth/admin/${orgId}/nc-sync/run`, { method: 'POST' });
            const j = await res.json();
            if (!res.ok) throw new Error(j.error || 'Sync failed');
            setMessage({ type: 'ok', text: `Sync done: created ${j.created || 0}, deactivated ${j.deactivated || 0}` });
            await load();
        } catch (e) {
            setMessage({ type: 'error', text: e.message });
        } finally { setSyncing(false); }
    };

    if (loading) return <div className="p-6"><Loader2 className="animate-spin" /></div>;
    if (!config) return <div className="p-6 text-sm" style={{ color: 'var(--text-muted)' }}>Nextcloud sync is only available for organisations bound to a Nextcloud instance.</div>;

    // Format relative timestamp for "Last sync" — < 1 min ago, 30 min ago,
    // 4 hr ago, 2 days ago, etc. Falls back to absolute date if older than 7d.
    const formatLastSync = (iso) => {
        if (!iso) return 'never';
        const ms = Date.now() - new Date(iso).getTime();
        if (ms < 60_000) return 'just now';
        if (ms < 3600_000) return `${Math.floor(ms / 60_000)} min ago`;
        if (ms < 86400_000) return `${Math.floor(ms / 3600_000)} hr ago`;
        if (ms < 7 * 86400_000) return `${Math.floor(ms / 86400_000)} d ago`;
        return new Date(iso).toLocaleDateString();
    };
    const modeLabel = ({ mirror_all: 'Mirror everything', selective_groups: 'Selective groups', manual: 'Manual only' })[config.mode] || config.mode;
    const activeUsers = users.filter(u => u.status === 'active').length;
    const isFresh = config.lastSyncAt && (Date.now() - new Date(config.lastSyncAt).getTime() < 30 * 60_000);

    return (
        <div className="space-y-6 p-6 max-w-3xl">
            <header className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Cloud className="w-5 h-5" style={{ color: '#0082C9' }} />
                    <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Nextcloud Sync</h2>
                </div>
                <button onClick={handleSyncNow} disabled={syncing || config.mode === 'manual'}
                    title={config.mode === 'manual' ? 'Sync mode is set to Manual — change to mirror or selective to enable.' : 'Run a full diff sync now'}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg text-white disabled:opacity-50 transition-opacity"
                    style={{ background: 'var(--accent-primary)' }}>
                    {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    Sync now
                </button>
            </header>

            {/* Connection-health stat row — at-a-glance status of the NC binding. */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="rounded-xl px-3 py-2.5" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                    <div className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-muted)' }}>Instance</div>
                    <div className="text-[12px] font-medium truncate" title={config.ncBaseUrl} style={{ color: 'var(--text-primary)' }}>
                        {config.ncBaseUrl ? config.ncBaseUrl.replace(/^https?:\/\//, '') : '—'}
                    </div>
                </div>
                <div className="rounded-xl px-3 py-2.5" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                    <div className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-muted)' }}>Sync mode</div>
                    <div className="text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>{modeLabel}</div>
                </div>
                <div className="rounded-xl px-3 py-2.5" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                    <div className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-muted)' }}>Active users</div>
                    <div className="text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>{activeUsers} <span className="opacity-60 font-normal">/ {users.length}</span></div>
                </div>
                <div className="rounded-xl px-3 py-2.5" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                    <div className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-muted)' }}>Last sync</div>
                    <div className="text-[12px] font-medium flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: isFresh ? '#10b981' : config.lastSyncAt ? '#f59e0b' : 'var(--text-muted)' }} />
                        {formatLastSync(config.lastSyncAt)}
                    </div>
                </div>
            </div>

            <section className="border rounded p-4 space-y-3">
                <h3 className="font-medium">Sync mode</h3>
                {[
                    { v: 'mirror_all', t: 'Mirror everything', d: 'Every Nextcloud user is automatically created in Bee Flow.' },
                    { v: 'selective_groups', t: 'Selective groups', d: 'Only users in the chosen NC groups are mirrored.' },
                    { v: 'manual', t: 'Manual only', d: 'New NC users are not auto-created — invite manually.' },
                ].map(opt => (
                    <label key={opt.v} className="flex items-start gap-2">
                        <input type="radio" name="mode" value={opt.v} checked={config.mode === opt.v}
                            onChange={() => update({ mode: opt.v })} className="mt-1" />
                        <div>
                            <div className="text-sm font-medium">{opt.t}</div>
                            <div className="text-xs text-gray-600">{opt.d}</div>
                        </div>
                    </label>
                ))}
            </section>

            <section className="border rounded p-4 space-y-3">
                <h3 className="font-medium">New user default status</h3>
                <select value={config.newUserDefaultStatus} onChange={e => update({ newUserDefaultStatus: e.target.value })}
                    className="border rounded px-2 py-1 text-sm">
                    <option value="active">Active immediately (recommended)</option>
                    <option value="pending">Pending — admin must approve</option>
                </select>
            </section>

            {config.mode === 'selective_groups' && (
                <section className="border rounded p-4 space-y-2">
                    <h3 className="font-medium">Groups to mirror</h3>
                    <p className="text-xs text-gray-600">Only members of these NC groups are synced.</p>
                    <div className="grid grid-cols-2 gap-1 max-h-40 overflow-y-auto">
                        {groups.map(g => (
                            <label key={g} className="flex items-center gap-2 text-sm">
                                <input type="checkbox" checked={config.syncGroups?.includes(g)}
                                    onChange={() => toggleGroup('syncGroups', g)} />
                                {g}
                            </label>
                        ))}
                    </div>
                </section>
            )}

            <section className="border rounded p-4 space-y-2">
                <h3 className="font-medium">Excluded groups</h3>
                <p className="text-xs text-gray-600">Members of these NC groups are NEVER mirrored, even under "mirror everything".</p>
                <div className="grid grid-cols-2 gap-1 max-h-40 overflow-y-auto">
                    {groups.map(g => (
                        <label key={g} className="flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={config.excludedGroups?.includes(g)}
                                onChange={() => toggleGroup('excludedGroups', g)} />
                            {g}
                        </label>
                    ))}
                </div>
            </section>

            <section className="border rounded p-4">
                <h3 className="font-medium flex items-center gap-2"><Users className="w-4 h-4" /> Synced users ({users.length})</h3>
                <ul className="text-sm mt-2 max-h-48 overflow-y-auto divide-y">
                    {users.map(u => (
                        <li key={u.id} className="py-1.5 flex items-center justify-between">
                            <span>{u.displayName} <span className="text-gray-500">({u.email})</span></span>
                            <span className={`text-xs px-2 py-0.5 rounded ${u.status === 'active' ? 'bg-green-100 text-green-700' : u.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>{u.status}</span>
                        </li>
                    ))}
                </ul>
            </section>

            <div className="flex items-center gap-3">
                <button onClick={handleSave} disabled={saving}
                    className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50">
                    {saving ? 'Saving...' : 'Save'}
                </button>
                {message && (
                    <span className={`text-sm flex items-center gap-1 ${message.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>
                        {message.type === 'error' ? <AlertTriangle className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                        {message.text}
                    </span>
                )}
            </div>
        </div>
    );
};

export default NextcloudSyncPanel;
