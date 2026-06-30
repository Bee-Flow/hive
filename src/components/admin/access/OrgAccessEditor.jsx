import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Check, AlertTriangle, Lock, Layers, Sparkles, Settings, ListChecks } from 'lucide-react';
import { API_BASE, authFetch } from '../../../utils/helpers';
import { getIntegrationIcon } from '../../../config/integrationIcons';

/**
 * OrgAccessEditor — the super-admin "Organisation access" menu: which
 * capabilities (within the plan/license ceiling) this organisation MAY use.
 * It is NOT a grant — it's the upper bound the org-admin distributes within.
 * Anything not allowed here shows locked in the org-admin's Grants matrix.
 *
 * `unrestricted` = the org may use everything its ceiling allows (the default).
 * Switch it off to pick a subset. Super-admin only. Emerald + blue only.
 */

// MCP servers are integrations now — they appear under Integrations.
const KIND_SECTIONS = [
    { kind: 'core', label: 'Features', icon: Layers },
    { kind: 'beta', label: 'Beta features', icon: Sparkles },
    { kind: 'integration', label: 'Integrations', icon: Settings },
];
const EMERALD = '#10b981';
const BLUE = '#3b82f6';
const SAVE_DEBOUNCE_MS = 450;

export default function OrgAccessEditor({ orgId, onChanged }) {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [available, setAvailable] = useState(() => new Set());
    const [unrestricted, setUnrestricted] = useState(true);
    const [message, setMessage] = useState(null);
    const saveTimer = useRef(null);

    const path = `${API_BASE}/auth/organizations/${encodeURIComponent(orgId)}/org-availability`;

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await authFetch(path);
            if (!res.ok) { setMessage({ type: 'error', text: `Failed to load (${res.status})` }); return; }
            const j = await res.json();
            setData(j);
            setUnrestricted(!!j.unrestricted);
            setAvailable(new Set(j.unrestricted ? (j.ceiling || []) : (j.available || [])));
        } catch (e) {
            setMessage({ type: 'error', text: e.message || 'Failed to load' });
        } finally { setLoading(false); }
    }, [path]);

    useEffect(() => { load(); }, [load]);
    useEffect(() => { if (!message) return; const t = setTimeout(() => setMessage(null), 3000); return () => clearTimeout(t); }, [message]);
    useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

    const ceiling = useMemo(() => (data?.ceiling || []), [data]);
    const capsByKind = useMemo(() => {
        const map = { core: [], beta: [], integration: [] };
        for (const c of (data?.capabilities || [])) {
            if (!ceiling.includes(c.id)) continue; // only show what the plan/license allows
            (map[c.kind] || (map[c.kind] = [])).push(c);
        }
        for (const k of Object.keys(map)) map[k].sort((a, b) => (a.category || '').localeCompare(b.category || '') || a.name.localeCompare(b.name));
        return map;
    }, [data, ceiling]);

    const save = (payload) => {
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(async () => {
            try {
                const res = await authFetch(path, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                if (!res.ok) throw new Error('Save failed');
                setMessage({ type: 'ok', text: 'Saved' });
                onChanged?.();
            } catch (e) { setMessage({ type: 'error', text: e.message || 'Save failed' }); load(); }
        }, SAVE_DEBOUNCE_MS);
    };

    const setUnrestrictedMode = (val) => {
        setUnrestricted(val);
        if (val) {
            setAvailable(new Set(ceiling));
            save({ unrestricted: true });
        } else {
            // Switch to a subset starting from everything currently allowed (no-op
            // until the super-admin removes some), so nothing is lost on toggle.
            const next = new Set(ceiling);
            setAvailable(next);
            save({ available: [...next] });
        }
    };

    const toggle = (capId) => {
        if (unrestricted) return;
        setAvailable(prev => {
            const n = new Set(prev);
            n.has(capId) ? n.delete(capId) : n.add(capId);
            save({ available: [...n] });
            return n;
        });
    };

    if (loading) return <div className="p-4"><Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--text-muted)' }} /></div>;
    if (!data) return null;

    return (
        <section className="rounded-2xl p-5" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
            <header className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                    <ListChecks className="w-5 h-5" style={{ color: EMERALD }} />
                    <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Organisation access</h2>
                </div>
                {message ? (
                    <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: message.type === 'ok' ? EMERALD : '#dc2626' }}>
                        {message.type === 'ok' ? <Check className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}{message.text}
                    </span>
                ) : null}
            </header>
            <p className="text-sm mb-4" style={{ color: 'var(--text-muted)', maxWidth: 760 }}>
                Which capabilities this organisation may use, within your {data.mode === 'cloud' ? 'subscription plan' : 'licence'}.
                Org-admins can only distribute what's allowed here — everything else is locked for them.
            </p>

            {/* Unrestricted master toggle */}
            <label className="flex items-center gap-3 p-3 rounded-xl mb-4 cursor-pointer" style={{ border: `1px solid ${unrestricted ? BLUE : 'var(--border-subtle)'}`, background: unrestricted ? `${BLUE}0a` : 'var(--bg-primary)' }}>
                <input type="checkbox" checked={unrestricted} onChange={e => setUnrestrictedMode(e.target.checked)} className="sr-only peer" />
                <span className="relative inline-flex items-center flex-shrink-0">
                    <span className="w-9 h-5 rounded-full transition-colors block" style={{ background: unrestricted ? BLUE : 'var(--border-default, #d1d5db)' }} />
                    <span className="absolute top-[2px] left-[2px] bg-white rounded-full h-4 w-4 shadow-sm transition-transform" style={{ transform: unrestricted ? 'translateX(16px)' : 'none' }} />
                </span>
                <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Allow everything the {data.mode === 'cloud' ? 'plan' : 'licence'} permits</p>
                    <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Turn off to restrict this organisation to a subset.</p>
                </div>
            </label>

            {KIND_SECTIONS.map(section => {
                const caps = capsByKind[section.kind] || [];
                if (caps.length === 0) return null;
                const SectionIcon = section.icon;
                return (
                    <div key={section.kind} className="mb-5" style={{ opacity: unrestricted ? 0.6 : 1 }}>
                        <div className="flex items-center gap-1.5 mb-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                            <SectionIcon className="w-3.5 h-3.5" /> {section.label}
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                            {caps.map(cap => {
                                const checked = available.has(cap.id);
                                const icon = cap.kind === 'integration' ? getIntegrationIcon(cap.id) : <SectionIcon className="w-4 h-4" style={{ color: EMERALD }} />;
                                return (
                                    <div key={cap.id}
                                        className="flex items-center gap-3 p-3 rounded-xl transition-all"
                                        style={{ border: `1px solid ${checked ? EMERALD : 'var(--border-subtle)'}`, background: checked ? `${EMERALD}0a` : 'var(--bg-primary)', cursor: unrestricted ? 'default' : 'pointer' }}
                                        onClick={() => toggle(cap.id)}>
                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--bg-secondary)' }}>{icon}</div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }} title={cap.name}>{cap.name}</p>
                                            {cap.description ? <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }} title={cap.description}>{cap.description}</p> : null}
                                        </div>
                                        {unrestricted
                                            ? <Lock className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
                                            : (
                                                <span className="relative inline-flex items-center flex-shrink-0" onClick={e => e.stopPropagation()}>
                                                    <input type="checkbox" checked={checked} onChange={() => toggle(cap.id)} className="sr-only peer" />
                                                    <span className="w-9 h-5 rounded-full transition-colors block" style={{ background: checked ? EMERALD : 'var(--border-default, #d1d5db)' }} />
                                                    <span className="absolute top-[2px] left-[2px] bg-white rounded-full h-4 w-4 shadow-sm transition-transform" style={{ transform: checked ? 'translateX(16px)' : 'none' }} />
                                                </span>
                                            )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </section>
    );
}
