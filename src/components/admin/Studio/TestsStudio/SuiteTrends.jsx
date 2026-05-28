import React, { useEffect, useState } from 'react';
import { TrendingUp, AlertTriangle, Loader2 } from 'lucide-react';
import { API_BASE, authFetch } from '../../../../utils/helpers';

/**
 * SuiteTrends — pass/fail + duration history and flakiness for one suite.
 * Inline SVG bars (no chart lib) to match the lightweight admin aesthetic.
 * Pulls GET /api/tests/suites/:id/trends and /flakiness.
 */
export default function SuiteTrends({ suiteId, refreshKey }) {
    const [trends, setTrends] = useState(null);
    const [flaky, setFlaky] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!suiteId) return;
        let alive = true;
        setLoading(true);
        (async () => {
            try {
                const [tRes, fRes] = await Promise.all([
                    authFetch(`${API_BASE}/api/tests/suites/${suiteId}/trends`),
                    authFetch(`${API_BASE}/api/tests/suites/${suiteId}/flakiness`),
                ]);
                if (!alive) return;
                if (tRes.ok) setTrends((await tRes.json()).trends || []);
                if (fRes.ok) setFlaky((await fRes.json()).flakiness || []);
            } catch (_) { /* ignore */ }
            finally { if (alive) setLoading(false); }
        })();
        return () => { alive = false; };
    }, [suiteId, refreshKey]);

    if (loading) {
        return <div className="text-xs text-[var(--text-tertiary)] flex items-center gap-1.5"><Loader2 className="animate-spin" size={12} /> Loading insights…</div>;
    }

    const runs = trends || [];
    if (runs.length === 0) {
        return <div className="text-xs text-[var(--text-tertiary)] italic">No completed runs yet — trends appear after the first run.</div>;
    }

    const maxDur = Math.max(1, ...runs.map(r => r.durationMs || 0));
    const passed = runs.filter(r => r.status === 'passed').length;
    const passRate = Math.round((passed / runs.length) * 100);
    const flakyTests = (flaky || []).filter(f => f.flaky);

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
                <div>
                    <div className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">Pass rate</div>
                    <div className={`text-xl font-semibold ${passRate >= 80 ? 'text-emerald-500' : passRate >= 50 ? 'text-amber-500' : 'text-red-500'}`}>{passRate}%</div>
                </div>
                <div>
                    <div className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">Runs</div>
                    <div className="text-xl font-semibold">{runs.length}</div>
                </div>
            </div>

            {/* Outcome + duration bars, oldest → newest */}
            <div>
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] mb-1.5">
                    <TrendingUp size={12} /> Run history
                </div>
                <div className="flex items-end gap-1 h-20 border-b border-[var(--border-default)] pb-0.5">
                    {runs.map(r => {
                        const h = Math.max(8, Math.round(((r.durationMs || 0) / maxDur) * 72));
                        const color = r.status === 'passed' ? 'bg-emerald-500'
                            : r.status === 'failed' ? 'bg-red-500'
                            : r.status === 'cancelled' ? 'bg-[var(--text-tertiary)]'
                            : 'bg-amber-500';
                        return (
                            <div
                                key={r.id}
                                className={`flex-1 min-w-[3px] max-w-[14px] rounded-t ${color}`}
                                style={{ height: `${h}px` }}
                                title={`${r.status} • ${formatDur(r.durationMs)} • ${r.passed}✓/${r.failed}✗`}
                            />
                        );
                    })}
                </div>
                <div className="flex justify-between text-[9px] text-[var(--text-tertiary)] mt-1">
                    <span>oldest</span><span>latest • bar height = duration</span>
                </div>
            </div>

            {/* Flakiness */}
            <div>
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] mb-1.5">
                    <AlertTriangle size={12} /> Flaky tests
                </div>
                {flakyTests.length === 0 ? (
                    <div className="text-xs text-[var(--text-tertiary)] italic">No flaky tests detected — outcomes are stable.</div>
                ) : (
                    <ul className="flex flex-col gap-1">
                        {flakyTests.slice(0, 8).map((f, i) => (
                            <li key={i} className="flex items-center justify-between text-xs px-3 py-1.5 rounded border border-amber-500/30 bg-amber-500/5">
                                <span className="truncate mr-2">{f.name}</span>
                                <span className="flex-shrink-0 flex items-center gap-2 text-[10px] text-[var(--text-tertiary)]">
                                    <span className="text-emerald-500">{f.passed}✓</span>
                                    <span className="text-red-500">{f.failed}✗</span>
                                    <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400">{f.flipRate}% flip</span>
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}

function formatDur(ms) {
    if (!ms || ms <= 0) return '0s';
    const s = Math.round(ms / 1000);
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
}
