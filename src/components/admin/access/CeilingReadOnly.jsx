import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Layers, Sparkles, Settings, Lock, Info } from 'lucide-react';
import { API_BASE, authFetch } from '../../../utils/helpers';
import { getIntegrationIcon } from '../../../config/integrationIcons';

/**
 * CeilingReadOnly — the org-admin view of the ceiling. The ceiling (what the
 * subscription plan on cloud / license tier on self-hosted permits) is not
 * editable by an org-admin, so this just lists what's inside it, grouped by
 * kind. Distribution within the ceiling happens in the Grants section.
 *
 * Reuses the existing group-access payload ({ ceiling, capabilities, mode }).
 * Emerald + blue only.
 */

// MCP servers are integrations now — they appear under Integrations.
const KIND_SECTIONS = [
    { kind: 'core', label: 'Features', icon: Layers },
    { kind: 'beta', label: 'Beta features', icon: Sparkles },
    { kind: 'integration', label: 'Integrations', icon: Settings },
];
const BLUE = '#3b82f6';

export default function CeilingReadOnly({ orgId = null }) {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);

    const readPath = orgId
        ? `${API_BASE}/auth/organizations/${encodeURIComponent(orgId)}/group-access`
        : `${API_BASE}/auth/me/group-access`;

    useEffect(() => {
        let alive = true;
        (async () => {
            setLoading(true);
            try {
                const res = await authFetch(readPath);
                if (!res.ok) { if (alive) setError(`Failed to load (${res.status})`); return; }
                const j = await res.json();
                if (alive) setData(j);
            } catch (e) {
                if (alive) setError(e.message || 'Failed to load');
            } finally { if (alive) setLoading(false); }
        })();
        return () => { alive = false; };
    }, [readPath]);

    const byKind = useMemo(() => {
        const ceiling = new Set(data?.ceiling || []);
        const map = { core: [], beta: [], integration: [] };
        for (const c of (data?.capabilities || [])) {
            if (!ceiling.has(c.id)) continue;
            (map[c.kind] || (map[c.kind] = [])).push(c);
        }
        for (const k of Object.keys(map)) map[k].sort((a, b) => a.name.localeCompare(b.name));
        return map;
    }, [data]);

    if (loading) return <div className="p-6"><Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--text-muted)' }} /></div>;
    if (error) return <div className="rounded-2xl p-5 text-sm" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', color: '#dc2626' }}>{error}</div>;

    const mode = data?.mode;

    return (
        <section className="rounded-2xl p-5" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
            <div className="flex items-start gap-2 mb-4">
                <Info className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: BLUE }} />
                <p className="text-sm" style={{ color: 'var(--text-muted)', maxWidth: 720 }}>
                    These are the capabilities your organisation has access to (set by your administrator, within your
                    {mode === 'cloud' ? ' subscription plan' : ' licence'}). To distribute them to members or groups,
                    use <strong>Grants</strong>.
                </p>
            </div>

            {KIND_SECTIONS.map(section => {
                const caps = byKind[section.kind] || [];
                const SectionIcon = section.icon;
                return (
                    <div key={section.kind} className="mb-5">
                        <div className="flex items-center gap-1.5 mb-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                            <SectionIcon className="w-3.5 h-3.5" /> {section.label} <span style={{ opacity: 0.6 }}>({caps.length})</span>
                        </div>
                        {caps.length === 0 ? (
                            <p className="text-[12px] px-1 py-1 flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                                <Lock className="w-3 h-3" /> Your organisation has no access in this category.
                            </p>
                        ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                                {caps.map(cap => {
                                    const icon = cap.kind === 'integration' ? getIntegrationIcon(cap.id) : <SectionIcon className="w-4 h-4" style={{ color: BLUE }} />;
                                    return (
                                        <div key={cap.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ border: '1px solid var(--border-subtle)', background: 'var(--bg-primary)' }}>
                                            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--bg-secondary)' }}>{icon}</div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }} title={cap.name}>{cap.name}</p>
                                                {cap.description ? <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }} title={cap.description}>{cap.description}</p> : null}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            })}
        </section>
    );
}
