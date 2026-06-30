import React, { useEffect, useState, useCallback, useRef } from 'react';
import { BarChart3, History, Loader2 } from 'lucide-react';
import useTranslation from '../../../../hooks/useTranslation';
import { API_BASE, authFetch } from '../../../../utils/helpers';
import { SvgAreaChart } from '../../MonitoringPanel/shared';

// Explicit, non-purple chart color (the strict UI ban rules out the default indigo).
const CHART_COLOR = '#10b981';

function fmtDuration(secs) {
    if (secs == null) return '—';
    if (secs < 3600) return `${Math.round(secs / 60)}m`;
    if (secs < 86400) return `${(secs / 3600).toFixed(1)}h`;
    return `${(secs / 86400).toFixed(1)}d`;
}
function fmtPct(rate) {
    if (rate == null) return '—';
    return `${Math.round(rate * 100)}%`;
}
function fmtAge(iso) {
    if (!iso) return '—';
    const secs = (Date.now() - new Date(iso).getTime()) / 1000;
    if (secs < 0) return '—';
    return fmtDuration(secs);
}

function Stat({ label, value, sub }) {
    return (
        <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)' }}>
            <div className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>{value}</div>
            <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{label}</div>
            {sub && <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{sub}</div>}
        </div>
    );
}

function Section({ title, children }) {
    return (
        <div className="mb-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>{title}</h4>
            {children}
        </div>
    );
}

// ── Historical response-time scan (aggregate-only, on-demand) ──────────────────
function ScanSection({ inboxId, t }) {
    const [scan, setScan] = useState(null);
    const [busy, setBusy] = useState(false);
    const pollRef = useRef(null);

    const fetchScan = useCallback(async () => {
        try {
            const res = await authFetch(`${API_BASE}/api/support-inbox/inboxes/${inboxId}/scan`);
            if (res.ok) setScan(await res.json());
        } catch (_) {}
    }, [inboxId]);

    useEffect(() => { fetchScan(); }, [fetchScan]);

    // Poll while a scan is queued/running (SSE also fires, but polling keeps this
    // panel self-contained).
    useEffect(() => {
        const status = scan?.scan_status;
        if (status === 'queued' || status === 'running') {
            pollRef.current = setTimeout(fetchScan, 3000);
            return () => clearTimeout(pollRef.current);
        }
        return undefined;
    }, [scan, fetchScan]);

    const run = async () => {
        setBusy(true);
        try {
            const res = await authFetch(`${API_BASE}/api/support-inbox/inboxes/${inboxId}/scan`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
            });
            const d = await res.json().catch(() => ({}));
            if (res.ok) setScan(s => ({ ...(s || {}), scan_status: d.inbox?.scan_status || 'queued' }));
            else window.alert(d.error || t('support.scan.failed', 'Could not start scan'));
        } finally { setBusy(false); }
    };

    const running = scan?.scan_status === 'queued' || scan?.scan_status === 'running';
    const result = scan?.scan_result;
    const fr = result?.firstResponse || {};
    const progress = scan?.scan_progress || {};

    return (
        <Section title={t('support.scan.title', 'Historical response times')}>
            <div className="rounded-lg border p-4 flex flex-col gap-3" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)' }}>
                <div className="flex items-center justify-between gap-3">
                    <div className="text-xs text-[var(--text-secondary)]">
                        {t('support.scan.note', 'Scan past mailbox history to learn how fast questions were answered before Bee Flow. Reads aggregate stats only — no tickets are created.')}
                    </div>
                    <button onClick={run} disabled={busy || running}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border border-[var(--border-default)] hover:bg-[var(--bg-secondary)] disabled:opacity-60 flex-shrink-0">
                        {running ? <Loader2 size={13} className="animate-spin" /> : <History size={13} />}
                        {running ? t('support.scan.running', 'Scanning…') : t('support.scan.run', 'Run scan')}
                    </button>
                </div>

                {running && (
                    <div className="text-xs text-[var(--text-tertiary)]">
                        {t('support.scan.progress', 'Scanned {n} threads', { n: progress.processedThreads || 0 })}
                        {progress.pairsFound != null ? ` · ${progress.pairsFound} ${t('support.scan.pairs', 'matched')}` : ''}
                    </div>
                )}

                {scan?.scan_status === 'error' && (
                    <div className="text-xs" style={{ color: '#dc2626' }}>{progress.error || t('support.scan.error', 'Scan failed.')}</div>
                )}

                {result && !running && (
                    <>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <Stat label={t('support.scan.median', 'Median first response')} value={fmtDuration(fr.p50Secs)} />
                            <Stat label={t('support.scan.p90', '90th percentile')} value={fmtDuration(fr.p90Secs)} />
                            <Stat label={t('support.scan.avg', 'Average')} value={fmtDuration(fr.avgSecs)} />
                            <Stat label={t('support.scan.pairs_found', 'Answered threads')} value={result.pairsFound} sub={`${result.noReply} ${t('support.scan.no_reply', 'never answered')}`} />
                        </div>
                        <div className="text-[11px] text-[var(--text-tertiary)]">
                            {t('support.scan.summary', 'Scanned {threads} threads over ~{days} days.', { threads: result.threadsScanned, days: result.windowDays })}
                            {result.truncated ? ` ${t('support.scan.truncated', '(capped — older history not fully scanned)')}` : ''}
                        </div>
                    </>
                )}
            </div>
        </Section>
    );
}

export default function InsightsPanel({ inboxes = [], activeInbox }) {
    const { t } = useTranslation();
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [names, setNames] = useState({});
    // Scans are per-inbox: use the selected inbox, or the only one when "all".
    const scanInboxId = activeInbox && activeInbox !== 'all'
        ? activeInbox
        : (inboxes.length === 1 ? inboxes[0].id : null);

    const fetchInsights = useCallback(async () => {
        try {
            setError(null);
            const params = new URLSearchParams();
            if (activeInbox && activeInbox !== 'all') params.set('inbox', activeInbox);
            const res = await authFetch(`${API_BASE}/api/support-inbox/insights?${params.toString()}`);
            if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Failed'); }
            setData(await res.json());
        } catch (e) { setError(e.message); }
    }, [activeInbox]);

    useEffect(() => { fetchInsights(); }, [fetchInsights]);
    useEffect(() => {
        authFetch(`${API_BASE}/api/support-inbox/teammates`).then(r => r.ok ? r.json() : { teammates: [] })
            .then(d => { const m = {}; (d.teammates || []).forEach(tm => { m[tm.id] = tm.name || tm.email || tm.id; }); setNames(m); })
            .catch(() => {});
    }, []);

    if (error) return <div className="p-6 text-sm" style={{ color: '#dc2626' }}>{error}</div>;
    if (!data || !data.handling) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center gap-2 p-8">
                <BarChart3 size={28} className="text-[var(--text-tertiary)]" />
                <div className="text-sm text-[var(--text-tertiary)]">{t('support.insights.no_data', 'No support activity yet.')}</div>
            </div>
        );
    }

    const { csat, handling, volume, busiestHours, agents } = data;
    const maxHour = Math.max(...(busiestHours || []).map(h => h.count), 1);

    return (
        <div className="max-w-3xl mx-auto p-5 overflow-y-auto h-full">
            <h3 className="text-base font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <BarChart3 size={16} /> {t('support.insights.title', 'Support insights')}
            </h3>

            {scanInboxId
                ? <ScanSection inboxId={scanInboxId} t={t} />
                : (
                    <Section title={t('support.scan.title', 'Historical response times')}>
                        <div className="rounded-lg border p-4 text-xs text-[var(--text-tertiary)]" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)' }}>
                            {t('support.scan.select_inbox', 'Select a single inbox above to run a historical response-time scan.')}
                        </div>
                    </Section>
                )}

            <Section title={t('support.insights.response_times', 'Response & resolution')}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Stat label={t('support.insights.first_response_p50', 'First response (median)')} value={fmtDuration(handling.p50FirstResponseSecs)} />
                    <Stat label={t('support.insights.first_response_p90', 'First response (90th pct)')} value={fmtDuration(handling.p90FirstResponseSecs)} />
                    <Stat label={t('support.insights.resolution_p50', 'Resolution (median)')} value={fmtDuration(handling.p50ResolutionSecs)} />
                    <Stat label={t('support.insights.resolution_p90', 'Resolution (90th pct)')} value={fmtDuration(handling.p90ResolutionSecs)} />
                </div>
            </Section>

            <Section title={t('support.insights.workload', 'Workload')}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Stat label={t('support.insights.open_backlog', 'Open backlog')} value={handling.openBacklog} />
                    <Stat label={t('support.insights.oldest_waiting', 'Oldest waiting')} value={fmtAge(handling.oldestWaitingAt)} />
                    <Stat label={t('support.insights.within_sla', 'First response within SLA')} value={fmtPct(handling.firstResponseWithinSlaRate)} />
                    <Stat label={t('support.insights.ai_handled', 'AI-handled')} value={fmtPct(handling.aiHandledRate)} sub={`${handling.aiResolved} / ${handling.total}`} />
                </div>
            </Section>

            <Section title={t('support.insights.outcomes', 'Outcomes')}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Stat label={t('support.insights.ai_resolved', 'AI-resolved')} value={handling.aiResolved} />
                    <Stat label={t('support.insights.staff_resolved', 'Staff-resolved')} value={handling.staffResolved} />
                    <Stat label={t('support.insights.sla_breaches', 'SLA breaches')} value={handling.slaBreaches} sub={`${t('support.insights.of', 'of')} ${handling.total}`} />
                    <Stat label={t('support.insights.csat', 'CSAT (30d)')} value={csat.avg30d != null ? `${csat.avg30d}/5` : '—'} sub={`${csat.responses} ${t('support.insights.ratings', 'ratings')}`} />
                </div>
            </Section>

            {volume && volume.length > 1 && (
                <Section title={t('support.insights.volume', 'Ticket volume (30 days)')}>
                    <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)' }}>
                        <SvgAreaChart data={volume} yKey="total" color={CHART_COLOR} height={120}
                            formatY={(v) => `${v}`} formatLabel={(d) => d.period} />
                    </div>
                </Section>
            )}

            {busiestHours && busiestHours.length > 0 && (
                <Section title={t('support.insights.busiest_hours', 'Busiest hours (UTC)')}>
                    <div className="rounded-lg border p-3 flex items-end gap-1" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)', height: 110 }}>
                        {Array.from({ length: 24 }, (_, h) => {
                            const found = busiestHours.find(b => b.hour === h);
                            const count = found ? found.count : 0;
                            return (
                                <div key={h} className="flex-1 flex flex-col items-center justify-end h-full" title={`${h}:00 — ${count}`}>
                                    <div className="w-full rounded-t" style={{ height: `${(count / maxHour) * 100}%`, background: CHART_COLOR, minHeight: count ? 2 : 0 }} />
                                    {h % 6 === 0 && <span className="text-[9px] mt-0.5 text-[var(--text-tertiary)]">{h}</span>}
                                </div>
                            );
                        })}
                    </div>
                </Section>
            )}

            {agents && agents.length > 0 && (
                <Section title={t('support.insights.agent_leaderboard', 'Teammate leaderboard')}>
                    <div className="rounded-lg border divide-y" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)' }}>
                        {agents.map(a => (
                            <div key={a.userId} className="flex items-center justify-between px-3 py-2 text-sm" style={{ borderColor: 'var(--border-default)' }}>
                                <span className="text-[var(--text-primary)] truncate">{names[a.userId] || a.userId}</span>
                                <span className="flex items-center gap-4 text-xs text-[var(--text-secondary)]">
                                    <span>{a.resolved} {t('support.insights.resolved_count', 'resolved')}</span>
                                    <span title={t('support.insights.first_response_p50', 'First response (median)')}>{fmtDuration(a.p50FirstResponseSecs)}</span>
                                </span>
                            </div>
                        ))}
                    </div>
                </Section>
            )}
        </div>
    );
}
