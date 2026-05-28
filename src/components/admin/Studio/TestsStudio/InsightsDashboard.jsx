import React, { useEffect, useState } from 'react';
import { Plus, Activity, CheckCircle2, ListChecks, Zap, Loader2, Compass } from 'lucide-react';
import { API_BASE, authFetch } from '../../../../utils/helpers';

/**
 * InsightsDashboard — the Tests Studio landing view when no suite is selected.
 * Surfaces account-wide health: suite count, run volume, 30-day pass rate,
 * in-flight runs, and a recent-activity feed. Pulls from
 * GET /api/tests/insights/overview.
 */
export default function InsightsDashboard({ onCreate, onExplore, onOpenRun }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const res = await authFetch(`${API_BASE}/api/tests/insights/overview`);
                if (res.ok && alive) setData(await res.json());
            } catch (_) { /* ignore */ }
            finally { if (alive) setLoading(false); }
        })();
        return () => { alive = false; };
    }, []);

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center text-[var(--text-tertiary)]">
                <Loader2 className="animate-spin" size={18} />
            </div>
        );
    }

    const stats = data || { suiteCount: 0, runs7d: 0, runs30d: 0, passRate30d: null, activeCount: 0, recent: [] };
    const empty = stats.suiteCount === 0 && stats.runs30d === 0;

    return (
        <div className="h-full overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-5">
                <div>
                    <h2 className="text-base font-semibold">Tests overview</h2>
                    <p className="text-xs text-[var(--text-tertiary)]">Health across all your Playwright suites and runs.</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={onExplore}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border border-[var(--border-default)] hover:border-[var(--accent-primary)]"
                    >
                        <Compass size={13} /> Ad-hoc explore
                    </button>
                    <button
                        onClick={onCreate}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded text-white font-semibold"
                        style={{ background: 'var(--accent-primary)' }}
                    >
                        <Plus size={13} /> New suite
                    </button>
                </div>
            </div>

            {empty ? (
                <div className="rounded-lg border border-dashed border-[var(--border-default)] p-10 text-center">
                    <div className="text-sm font-semibold mb-1">Generate Playwright tests from your sources</div>
                    <p className="max-w-md mx-auto text-xs text-[var(--text-tertiary)] mb-4">
                        Pick AI conversations, GitHub commits or files, YouTrack issues, or paste a spec. Generate a
                        suite, run it against a URL, or explore a site live with a browser-driving agent.
                    </p>
                    <button
                        onClick={onCreate}
                        className="px-4 py-2 text-sm rounded text-white font-semibold"
                        style={{ background: 'var(--accent-primary)' }}
                    >
                        <Plus size={14} className="inline mr-1" /> Create your first suite
                    </button>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                        <StatCard icon={ListChecks} label="Test suites" value={stats.suiteCount} />
                        <StatCard icon={Activity} label="Runs (7d)" value={stats.runs7d} sub={`${stats.runs30d} in 30d`} />
                        <StatCard
                            icon={CheckCircle2}
                            label="Pass rate (30d)"
                            value={stats.passRate30d == null ? '—' : `${stats.passRate30d}%`}
                            tone={stats.passRate30d == null ? 'neutral' : stats.passRate30d >= 80 ? 'good' : stats.passRate30d >= 50 ? 'warn' : 'bad'}
                        />
                        <StatCard icon={Zap} label="In flight" value={stats.activeCount} tone={stats.activeCount > 0 ? 'warn' : 'neutral'} />
                    </div>

                    <h3 className="text-xs font-semibold text-[var(--text-secondary)] mb-2">Recent activity</h3>
                    {stats.recent.length === 0 ? (
                        <div className="text-xs text-[var(--text-tertiary)] italic">No runs yet.</div>
                    ) : (
                        <ul className="flex flex-col gap-1">
                            {stats.recent.map(r => (
                                <li key={r.id}>
                                    <button
                                        onClick={() => onOpenRun?.(r.id)}
                                        className="w-full text-left text-xs px-3 py-2 rounded border border-[var(--border-default)] hover:border-[var(--accent-primary)] flex items-center justify-between gap-3"
                                    >
                                        <span className="flex items-center gap-2 min-w-0">
                                            <StatusDot status={r.status} />
                                            <span className="font-mono text-[10px] text-[var(--text-tertiary)]">{r.id.slice(0, 8)}</span>
                                            <span className="truncate">{r.targetUrl}</span>
                                        </span>
                                        <span className="flex items-center gap-2 flex-shrink-0 text-[var(--text-tertiary)]">
                                            <span className="px-1.5 py-0.5 rounded bg-[var(--bg-secondary)]">{r.mode}</span>
                                            <span>{formatRelative(r.createdAt)}</span>
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </>
            )}
        </div>
    );
}

function StatCard({ icon: Icon, label, value, sub, tone = 'neutral' }) {
    const toneClass = {
        good: 'text-emerald-500',
        warn: 'text-amber-500',
        bad: 'text-red-500',
        neutral: 'text-[var(--text-primary)]',
    }[tone];
    return (
        <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] mb-1">
                <Icon size={12} /> {label}
            </div>
            <div className={`text-2xl font-semibold ${toneClass}`}>{value}</div>
            {sub && <div className="text-[10px] text-[var(--text-tertiary)] mt-0.5">{sub}</div>}
        </div>
    );
}

export function StatusDot({ status }) {
    const color = status === 'passed' ? 'bg-emerald-500'
        : status === 'failed' ? 'bg-red-500'
        : status === 'running' || status === 'queued' ? 'bg-amber-500'
        : status === 'error' ? 'bg-amber-600'
        : 'bg-[var(--text-tertiary)]';
    return <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${color}`} title={status} />;
}

function formatRelative(iso) {
    if (!iso) return '';
    const then = new Date(iso).getTime();
    const diff = Date.now() - then;
    const m = Math.round(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.round(h / 24);
    return `${d}d ago`;
}
