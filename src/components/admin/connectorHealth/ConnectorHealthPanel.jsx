import { Activity, AlertTriangle, ChevronRight, Loader2, RefreshCw, Search } from 'lucide-react';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { STATUS_META, STATUS_IDS, statusRank, orgIsBlocked } from './healthMeta';
import OrgHealthDrawer from './OrgHealthDrawer';
import { useTranslation } from '../../../hooks/useTranslation';
import { API_BASE, authFetch } from '../../../utils/helpers';

/**
 * ConnectorHealthPanel — super-admin fleet overview of every Nextcloud-connected
 * organisation: health status, open problems, message activity and user census.
 * Data source: GET /auth/admin/connector-health/fleet (one aggregated call).
 *
 * Row click opens OrgHealthDrawer (problems + event timeline) and pushes
 * admin/security/connector-health/<orgId> so the drill-in is deep-linkable.
 * No export button (project rule for audit/health dashboards).
 */

/** Small status chip — reused by the fleet table and the drawer header. */
export function HealthChip({ health }) {
    const { t } = useTranslation();
    const meta = STATUS_META[health];
    if (!meta) {
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium text-[var(--text-tertiary)] border-[var(--border-default)] bg-[var(--bg-secondary)]">
                {String(health || '—')}
            </span>
        );
    }
    const Icon = meta.Icon;
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium whitespace-nowrap ${meta.chip}`}>
            <Icon size={12} style={{ color: meta.color }} />
            {t(meta.labelKey, meta.fallback)}
        </span>
    );
}

function Stat({ label, value, tone }) {
    const toneColor = tone === 'rose' ? '#ef4444' : tone === 'amber' ? '#f59e0b' : tone === 'green' ? '#22c55e' : 'var(--text-primary)';
    return (
        <div className="flex-1 min-w-[120px] rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-3">
            <div className="text-2xl font-semibold" style={{ color: toneColor }}>{value}</div>
            <div className="text-[11px] uppercase tracking-wider text-[var(--text-tertiary)] mt-0.5">{label}</div>
        </div>
    );
}

export default function ConnectorHealthPanel({ initialOrgId = '', onNavigate }) {
    const { t } = useTranslation();
    const [orgs, setOrgs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadFailed, setLoadFailed] = useState(false);
    const [statusFilter, setStatusFilter] = useState(null); // null = all
    const [query, setQuery] = useState('');
    const [selectedId, setSelectedId] = useState(null);
    const appliedInitial = useRef(false);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadFailed(false);
        try {
            const res = await authFetch(`${API_BASE}/auth/admin/connector-health/fleet`);
            if (!res.ok) { setLoadFailed(true); return; }
            const data = await res.json().catch(() => null);
            if (!data || !Array.isArray(data.orgs)) { setLoadFailed(true); return; }
            setOrgs(data.orgs);
        } catch {
            setLoadFailed(true);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    // Deep-link drill-in: admin/security/connector-health/<orgId> opens the
    // drawer once the fleet has loaded (applied once, so closing stays closed).
    useEffect(() => {
        if (appliedInitial.current || !initialOrgId || orgs.length === 0) return;
        appliedInitial.current = true;
        if (orgs.some(o => o.id === initialOrgId)) setSelectedId(initialOrgId);
    }, [initialOrgId, orgs]);

    const blockedCount = useMemo(() => orgs.filter(orgIsBlocked).length, [orgs]);
    const silentCount = useMemo(() => orgs.filter(o => !o.messagesTotal).length, [orgs]);
    const healthyCount = useMemo(() => orgs.filter(o => o.health === 'ok').length, [orgs]);

    const visible = useMemo(() => {
        let list = orgs;
        if (statusFilter) list = list.filter(o => o.health === statusFilter);
        const q = query.trim().toLowerCase();
        if (q) {
            list = list.filter(o =>
                (o.name || '').toLowerCase().includes(q)
                || (o.ncBaseUrl || '').toLowerCase().includes(q));
        }
        // Worst first: status severity rank, then most recent activity.
        return [...list].sort((a, b) =>
            (statusRank(b.health) - statusRank(a.health))
            || ((Date.parse(b.lastMessageAt || '') || 0) - (Date.parse(a.lastMessageAt || '') || 0)));
    }, [orgs, statusFilter, query]);

    const selectedOrg = useMemo(() => orgs.find(o => o.id === selectedId) || null, [orgs, selectedId]);

    const openOrg = (org) => {
        setSelectedId(org.id);
        if (onNavigate) onNavigate(`admin/security/connector-health/${org.id}`);
    };

    const closeDrawer = () => {
        setSelectedId(null);
        if (onNavigate) onNavigate('admin/security/connector-health');
    };

    if (loading && orgs.length === 0 && !loadFailed) {
        return (
            <div className="flex items-center gap-2 p-4 text-sm text-[var(--text-tertiary)]">
                <Loader2 size={18} className="animate-spin" />
                {t('admin.ch_loading', 'Loading connector health…')}
            </div>
        );
    }

    return (
        <div className="max-w-5xl">
            <div className="flex items-center gap-2.5 mb-1">
                <Activity size={20} style={{ color: '#14b8a6' }} />
                <h2 className="text-lg font-semibold text-[var(--text-primary)] m-0">
                    {t('admin.ch_title', 'Nextcloud connector health')}
                </h2>
            </div>
            <p className="text-sm text-[var(--text-tertiary)] mt-0 mb-4 leading-relaxed">
                {t('admin.ch_desc', 'Per-organisation status of Nextcloud-connected workspaces: why users can or cannot reach AI chat.')}
            </p>

            {loadFailed && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-rose-500/40 bg-rose-500/5 px-4 py-3 mb-4">
                    <div className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
                        <AlertTriangle size={16} className="text-rose-500 shrink-0" />
                        {t('admin.ch_load_failed', 'Failed to load connector health')}
                    </div>
                    <button
                        onClick={load}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20"
                    >
                        <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                        {t('admin.ch_retry', 'Retry')}
                    </button>
                </div>
            )}

            {!loadFailed && (
                <>
                    {/* Stat strip */}
                    <div className="flex flex-wrap gap-3 mb-4">
                        <Stat label={t('admin.ch_stat_total', 'Connected orgs')} value={orgs.length} />
                        <Stat label={t('admin.ch_stat_blocked', 'Blocked')} value={blockedCount} tone={blockedCount > 0 ? 'rose' : undefined} />
                        <Stat label={t('admin.ch_stat_silent', 'Never sent a message')} value={silentCount} tone={silentCount > 0 ? 'amber' : undefined} />
                        <Stat label={t('admin.ch_stat_healthy', 'Healthy')} value={healthyCount} tone="green" />
                    </div>

                    {/* Blocked banner */}
                    {blockedCount > 0 && (
                        <div className="flex items-start gap-3 rounded-xl border border-rose-500/40 bg-rose-500/5 px-4 py-3 mb-4">
                            <AlertTriangle size={18} className="text-rose-500 shrink-0 mt-0.5" />
                            <div className="text-sm text-[var(--text-primary)]">
                                {t('admin.ch_blocked_banner', '{count} organisation(s) cannot send AI messages right now').replace('{count}', String(blockedCount))}
                            </div>
                        </div>
                    )}

                    {/* Filter pills + search */}
                    <div className="flex flex-wrap items-center gap-2 mb-4">
                        <button
                            data-testid="ch-pill-all"
                            onClick={() => setStatusFilter(null)}
                            className={`px-2.5 py-1 rounded-full border text-[11px] font-medium ${statusFilter === null
                                ? 'border-[var(--accent-primary)] text-[var(--accent-primary)] bg-[var(--accent-primary)]/10'
                                : 'border-[var(--border-default)] text-[var(--text-tertiary)] hover:bg-[var(--bg-secondary)]'}`}
                        >
                            {t('admin.ch_filter_all', 'All')}
                        </button>
                        {STATUS_IDS.map(id => (
                            <button
                                key={id}
                                data-testid={`ch-pill-${id}`}
                                onClick={() => setStatusFilter(f => (f === id ? null : id))}
                                className={`px-2.5 py-1 rounded-full border text-[11px] font-medium ${statusFilter === id
                                    ? STATUS_META[id].chip
                                    : 'border-[var(--border-default)] text-[var(--text-tertiary)] hover:bg-[var(--bg-secondary)]'}`}
                            >
                                {t(STATUS_META[id].labelKey, STATUS_META[id].fallback)}
                            </button>
                        ))}
                        <div className="relative ml-auto">
                            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
                            <input
                                type="text"
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                placeholder={t('admin.ch_search_placeholder', 'Search by name or URL…')}
                                className="pl-8 pr-3 py-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
                            />
                        </div>
                    </div>

                    {/* Fleet table */}
                    {visible.length === 0 ? (
                        <div className="p-6 text-center text-sm rounded-xl border border-[var(--border-default)] text-[var(--text-tertiary)] bg-[var(--bg-secondary)]">
                            {orgs.length === 0
                                ? t('admin.ch_empty', 'No Nextcloud-connected organisations yet.')
                                : t('admin.ch_no_match', 'No organisations match the current filters.')}
                        </div>
                    ) : (
                        <div className="rounded-xl border border-[var(--border-default)] overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-[var(--text-tertiary)]" style={{ background: 'var(--bg-tertiary)' }}>
                                        <th className="font-medium px-4 py-2">{t('admin.ch_col_org', 'Organisation')}</th>
                                        <th className="font-medium px-4 py-2">{t('admin.ch_col_status', 'Status')}</th>
                                        <th className="font-medium px-4 py-2">{t('admin.ch_col_problem', 'Top problem')}</th>
                                        <th className="font-medium px-4 py-2">{t('admin.ch_col_messages', 'Messages (30d)')}</th>
                                        <th className="font-medium px-4 py-2">{t('admin.ch_col_users', 'Users')}</th>
                                        <th className="font-medium px-4 py-2">{t('admin.ch_col_last_activity', 'Last activity')}</th>
                                        <th className="px-2 py-2" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {visible.map(org => {
                                        const topProblem = Array.isArray(org.problems) && org.problems.length > 0 ? org.problems[0] : null;
                                        const lastActivity = org.lastMessageAt || org.ncLastSyncAt;
                                        const pending = org.users?.pending || 0;
                                        return (
                                            <tr
                                                key={org.id}
                                                onClick={() => openOrg(org)}
                                                className="border-t border-[var(--border-subtle)] cursor-pointer hover:bg-[var(--bg-secondary)]"
                                            >
                                                <td className="px-4 py-2.5">
                                                    <div className="font-medium text-[var(--text-primary)]">{org.name}</div>
                                                    {org.ncBaseUrl && <div className="text-xs text-[var(--text-tertiary)]">{org.ncBaseUrl}</div>}
                                                </td>
                                                <td className="px-4 py-2.5"><HealthChip health={org.health} /></td>
                                                <td className="px-4 py-2.5 max-w-[260px]">
                                                    {topProblem ? (
                                                        <span className="block truncate text-[var(--text-secondary)]" title={topProblem.message}>
                                                            {topProblem.message}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[var(--text-tertiary)]">—</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-2.5 text-[var(--text-secondary)]" title={t('admin.ch_messages_total', 'Total: {count}').replace('{count}', String(org.messagesTotal ?? 0))}>
                                                    {org.messages30d ?? 0}
                                                </td>
                                                <td className="px-4 py-2.5 text-[var(--text-secondary)] whitespace-nowrap">
                                                    {org.users?.active ?? 0}/{org.users?.total ?? 0}
                                                    {pending > 0 && (
                                                        <span className="ml-1.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                                                            +{pending} {t('admin.ch_pending_short', 'pending')}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-2.5 text-[var(--text-tertiary)] whitespace-nowrap">
                                                    {lastActivity ? new Date(lastActivity).toLocaleString() : '—'}
                                                </td>
                                                <td className="px-2 py-2.5 text-[var(--text-tertiary)]"><ChevronRight size={16} /></td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}

            {selectedOrg && (
                <OrgHealthDrawer org={selectedOrg} onClose={closeDrawer} onNavigate={onNavigate} />
            )}
        </div>
    );
}
