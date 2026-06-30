import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Loader2, Check, AlertTriangle, Lock, Users, ShieldCheck, Sparkles, Settings, Layers, Search } from 'lucide-react';
import { API_BASE, authFetch } from '../../utils/helpers';
import { getIntegrationIcon } from '../../config/integrationIcons';

/**
 * GroupAccessMatrix — the org "Access & Permissions" surface.
 *
 * Scope-based (NOT a wide grid) so it stays usable for orgs with many groups
 * (20+): pick a scope on the left ("All members" or a group — searchable), then
 * toggle that scope's capabilities on the right. Grant-only: a checked toggle
 * GRANTS; there is no per-group "disable". Effective access = All-members grants
 * ∪ the user's groups' grants, capped by the plan/license ceiling (locked rows
 * are outside the ceiling). A group inherits anything granted to All members.
 *
 * `orgId` prop (optional): super-admin Beheerdashboard view → org-scoped
 * endpoints; without it → the caller's own org via the /me endpoints.
 *
 * Emerald + blue only.
 */

// MCP servers are integrations now (kind 'integration', category 'MCP servers')
// — they appear under Integrations, no separate section.
const KIND_SECTIONS = [
    { kind: 'core', label: 'Features', icon: Layers },
    { kind: 'beta', label: 'Beta features', icon: Sparkles },
    { kind: 'integration', label: 'Integrations', icon: Settings },
];

const SAVE_DEBOUNCE_MS = 450;
const EMERALD = '#10b981';
const BLUE = '#3b82f6';
const EVERYONE = '__everyone__';

export default function GroupAccessMatrix({ orgId: orgIdProp = null, kinds = null, hideLocked = false, heading, subtitle }) {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [message, setMessage] = useState(null);

    const [everyone, setEveryone] = useState(() => new Set());
    const [groupGrants, setGroupGrants] = useState({});
    const [scope, setScope] = useState(EVERYONE);
    const [groupQuery, setGroupQuery] = useState('');

    const everyoneTimer = useRef(null);
    const groupTimers = useRef({});

    const readPath = orgIdProp
        ? `${API_BASE}/auth/organizations/${encodeURIComponent(orgIdProp)}/group-access`
        : `${API_BASE}/auth/me/group-access`;
    const orgWritePath = orgIdProp
        ? `${API_BASE}/auth/organizations/${encodeURIComponent(orgIdProp)}/org-access`
        : `${API_BASE}/auth/me/org-access`;

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await authFetch(readPath);
            if (!res.ok) { setMessage({ type: 'error', text: `Failed to load (${res.status})` }); setLoading(false); return; }
            const j = await res.json();
            setData(j);
            setEveryone(new Set(j.everyone || []));
            const gg = {};
            for (const g of (j.groups || [])) gg[g.id] = new Set(g.granted || []);
            setGroupGrants(gg);
        } catch (e) {
            setMessage({ type: 'error', text: e.message || 'Failed to load' });
        } finally { setLoading(false); }
    }, [readPath]);

    useEffect(() => { load(); }, [load]);
    useEffect(() => { if (!message) return; const t = setTimeout(() => setMessage(null), 3500); return () => clearTimeout(t); }, [message]);
    useEffect(() => () => {
        if (everyoneTimer.current) clearTimeout(everyoneTimer.current);
        Object.values(groupTimers.current).forEach(t => t && clearTimeout(t));
    }, []);

    const ceiling = useMemo(() => new Set(data?.ceiling || []), [data]);
    const groups = data?.groups || [];

    const saveEveryone = (nextSet) => {
        if (everyoneTimer.current) clearTimeout(everyoneTimer.current);
        everyoneTimer.current = setTimeout(async () => {
            try {
                const res = await authFetch(orgWritePath, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ granted: [...nextSet] }) });
                if (!res.ok) throw new Error('Save failed');
                setMessage({ type: 'ok', text: 'Saved' });
            } catch (e) { setMessage({ type: 'error', text: e.message || 'Save failed' }); load(); }
        }, SAVE_DEBOUNCE_MS);
    };

    const saveGroup = (groupId, nextSet) => {
        if (groupTimers.current[groupId]) clearTimeout(groupTimers.current[groupId]);
        groupTimers.current[groupId] = setTimeout(async () => {
            try {
                const res = await authFetch(`${API_BASE}/auth/groups/${encodeURIComponent(groupId)}/access`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ granted: [...nextSet] }) });
                if (!res.ok) throw new Error('Save failed');
                setMessage({ type: 'ok', text: 'Saved' });
            } catch (e) { setMessage({ type: 'error', text: e.message || 'Save failed' }); load(); }
        }, SAVE_DEBOUNCE_MS);
    };

    const betaReadOnly = (cap) => cap.kind === 'beta' && data?.betaGoverned;
    const isEveryoneScope = scope === EVERYONE;

    const toggle = (cap) => {
        if (!ceiling.has(cap.id) || betaReadOnly(cap)) return;
        if (isEveryoneScope) {
            setEveryone(prev => { const n = new Set(prev); n.has(cap.id) ? n.delete(cap.id) : n.add(cap.id); saveEveryone(n); return n; });
        } else {
            setGroupGrants(prev => {
                const cur = new Set(prev[scope] || []);
                cur.has(cap.id) ? cur.delete(cap.id) : cur.add(cap.id);
                const next = { ...prev, [scope]: cur };
                saveGroup(scope, cur);
                return next;
            });
        }
    };

    // Count of capabilities granted for a scope (for the sidebar badges).
    const grantCount = useCallback((scopeId) => {
        if (scopeId === EVERYONE) return everyone.size;
        const own = (groupGrants[scopeId] || new Set()).size;
        return own; // own grants; inherited-from-everyone shown separately
    }, [everyone, groupGrants]);

    const filteredGroups = useMemo(() => {
        const q = groupQuery.trim().toLowerCase();
        return q ? groups.filter(g => g.name.toLowerCase().includes(q)) : groups;
    }, [groups, groupQuery]);

    const capabilitiesByKind = useMemo(() => {
        const map = { core: [], beta: [], integration: [] };
        for (const c of (data?.capabilities || [])) (map[c.kind] || (map[c.kind] = [])).push(c);
        for (const k of Object.keys(map)) map[k].sort((a, b) => (a.category || '').localeCompare(b.category || '') || a.name.localeCompare(b.name));
        return map;
    }, [data]);

    if (loading) return <div className="p-6"><Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--text-muted)' }} /></div>;
    if (!data || !data.orgId) {
        return (
            <div className="rounded-2xl p-5 text-sm" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                Your account is not bound to an organisation, so there is nothing to manage here.
            </div>
        );
    }

    const activeGroup = isEveryoneScope ? null : groups.find(g => g.id === scope);
    const scopeAccent = isEveryoneScope ? BLUE : EMERALD;

    const Toggle = ({ checked, readOnly, accent, onToggle }) => (
        <label className="relative inline-flex items-center flex-shrink-0" style={{ cursor: readOnly ? 'default' : 'pointer' }} onClick={e => e.stopPropagation()}>
            <input type="checkbox" checked={checked} disabled={readOnly} onChange={onToggle} className="sr-only peer" />
            <div className="w-9 h-5 rounded-full transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:shadow-sm after:transition-transform peer-checked:after:translate-x-4"
                style={{ background: checked ? accent : 'var(--border-default, #d1d5db)', opacity: readOnly ? 0.55 : 1 }} />
        </label>
    );

    const ScopeButton = ({ id, label, icon, accent, count }) => {
        const active = scope === id;
        return (
            <button onClick={() => setScope(id)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors"
                style={{ background: active ? 'var(--bg-primary)' : 'transparent', border: `1px solid ${active ? accent : 'transparent'}` }}>
                <span className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: active ? `${accent}1a` : 'var(--bg-primary)', color: accent }}>{icon}</span>
                <span className="flex-1 min-w-0 truncate text-sm" style={{ color: 'var(--text-primary)', fontWeight: active ? 600 : 400 }}>{label}</span>
                {count > 0 ? <span className="text-[11px] px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>{count}</span> : null}
            </button>
        );
    };

    const CapabilityCard = ({ cap }) => {
        const locked = !ceiling.has(cap.id);
        const ro = betaReadOnly(cap);
        let checked, readOnly, inherited = false;
        if (isEveryoneScope) {
            checked = ro ? true : everyone.has(cap.id);
            readOnly = ro;
        } else {
            inherited = everyone.has(cap.id) || ro;
            checked = inherited || (groupGrants[scope] || new Set()).has(cap.id);
            readOnly = inherited; // granted to all → group inherits, can't un-inherit here
        }
        const icon = cap.kind === 'integration' ? getIntegrationIcon(cap.id) : <Sparkles className="w-4 h-4" style={{ color: scopeAccent }} />;
        return (
            <div className="flex items-center gap-3 p-3 rounded-xl transition-all"
                style={{ border: `1px solid ${checked && !locked ? scopeAccent : 'var(--border-subtle)'}`, background: checked && !locked ? `${scopeAccent}0a` : 'var(--bg-primary)', opacity: locked ? 0.55 : 1, cursor: locked || readOnly ? 'default' : 'pointer' }}
                onClick={() => !locked && !readOnly && toggle(cap)}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--bg-secondary)' }}>{icon}</div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }} title={cap.name}>{cap.name}</p>
                        {locked ? <Lock className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--text-muted)' }} /> : null}
                    </div>
                    {inherited && !isEveryoneScope ? (
                        <p className="text-[11px]" style={{ color: BLUE }}>Granted to all members</p>
                    ) : cap.description ? (
                        <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }} title={cap.description}>{cap.description}</p>
                    ) : null}
                </div>
                {locked
                    ? <Lock className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
                    : <Toggle checked={checked} readOnly={readOnly} accent={scopeAccent} onToggle={() => toggle(cap)} />}
            </div>
        );
    };

    return (
        <section className="rounded-2xl p-5" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
            <header className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5" style={{ color: EMERALD }} />
                    <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{heading || 'Access & Permissions'}</h2>
                </div>
                {message ? (
                    <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: message.type === 'ok' ? EMERALD : '#dc2626' }}>
                        {message.type === 'ok' ? <Check className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}{message.text}
                    </span>
                ) : null}
            </header>
            {subtitle ? (
                <p className="text-sm mb-4" style={{ color: 'var(--text-muted)', maxWidth: 760 }}>{subtitle}</p>
            ) : (
                <p className="text-sm mb-4" style={{ color: 'var(--text-muted)', maxWidth: 760 }}>
                    Pick <strong>All members</strong> or a <strong>group</strong>, then grant the features and integrations it should have.
                    A user gets a capability if it's granted to All members <em>or</em> any group they belong to. Locked items
                    (<Lock className="w-3 h-3 inline -mt-0.5" />) are outside your organisation's access.
                </p>
            )}

            <div className="flex flex-col md:flex-row gap-5">
                {/* ── Scope sidebar ───────────────────────────────────── */}
                <div className="md:w-60 flex-shrink-0">
                    <ScopeButton id={EVERYONE} label="All members" accent={BLUE} count={grantCount(EVERYONE)} icon={<Users className="w-3.5 h-3.5" />} />
                    <div className="my-2 flex items-center gap-2 px-1">
                        <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Groups</span>
                        <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>({groups.length})</span>
                    </div>
                    {groups.length > 6 ? (
                        <div className="relative mb-2">
                            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                            <input value={groupQuery} onChange={e => setGroupQuery(e.target.value)} placeholder="Search groups…"
                                className="w-full text-sm rounded-lg pl-8 pr-2 py-1.5 outline-none"
                                style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }} />
                        </div>
                    ) : null}
                    {groups.length === 0 ? (
                        <p className="text-[12px] px-1 py-2" style={{ color: 'var(--text-muted)' }}>
                            No groups yet. Create groups under <strong>Users &amp; Groups</strong> to grant capabilities per team.
                        </p>
                    ) : (
                        <div className="space-y-0.5 md:max-h-[460px] md:overflow-y-auto pr-1">
                            {filteredGroups.map(g => (
                                <ScopeButton key={g.id} id={g.id} label={g.name} accent={EMERALD} count={grantCount(g.id)} icon={<Users className="w-3.5 h-3.5" />} />
                            ))}
                            {filteredGroups.length === 0 ? <p className="text-[12px] px-2 py-2" style={{ color: 'var(--text-muted)' }}>No groups match “{groupQuery}”.</p> : null}
                        </div>
                    )}
                </div>

                {/* ── Capabilities for the selected scope ─────────────── */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: `${scopeAccent}1a`, color: scopeAccent }}><Users className="w-3.5 h-3.5" /></span>
                        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{isEveryoneScope ? 'All members' : activeGroup?.name}</h3>
                        {!isEveryoneScope ? <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>grants stack on top of All members</span> : null}
                        {data.betaGoverned ? <span className="text-[11px] ml-auto" style={{ color: 'var(--text-muted)' }}>Beta features follow your subscription</span> : null}
                    </div>
                    {(() => {
                        const sections = KIND_SECTIONS
                            .filter(s => !kinds || kinds.includes(s.kind))
                            .map(section => ({
                                section,
                                caps: (capabilitiesByKind[section.kind] || []).filter(c => !hideLocked || ceiling.has(c.id)),
                            }))
                            .filter(x => x.caps.length > 0);
                        if (sections.length === 0) {
                            return (
                                <p className="text-sm rounded-xl px-4 py-3" style={{ color: 'var(--text-muted)', background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)' }}>
                                    {kinds && kinds.length === 1 && kinds[0] === 'integration'
                                        ? "Your subscription doesn't include any integrations yet."
                                        : 'Nothing to grant here yet.'}
                                </p>
                            );
                        }
                        return sections.map(({ section, caps }) => {
                            const SectionIcon = section.icon;
                            return (
                                <div key={section.kind} className="mb-5">
                                    <div className="flex items-center gap-1.5 mb-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                                        <SectionIcon className="w-3.5 h-3.5" /> {section.label}
                                    </div>
                                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                                        {caps.map(cap => <CapabilityCard key={cap.id} cap={cap} />)}
                                    </div>
                                </div>
                            );
                        });
                    })()}
                </div>
            </div>
        </section>
    );
}
