import React, { useState, useEffect } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';

const formatDuration = (log) => {
    if (!log.finished_at || !log.started_at) return '—';
    const sec = Math.round((new Date(log.finished_at) - new Date(log.started_at)) / 1000);
    return sec < 60 ? `${sec}s` : `${Math.floor(sec / 60)}m ${sec % 60}s`;
};

const parseOutcomes = (raw) => {
    if (!raw) return null;
    if (typeof raw === 'string') {
        try { return JSON.parse(raw); } catch { return null; }
    }
    return raw;
};

const Bar = ({ value, total, color }) => {
    const pct = total > 0 ? Math.max(2, Math.round((value / total) * 100)) : 0;
    return (
        <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
            <div className={`h-full ${color}`} style={{ width: value === 0 ? '0%' : `${pct}%` }} />
        </div>
    );
};

const OutcomesBreakdown = ({ outcomes, t }) => {
    const ingested = outcomes.ingested?.count ?? 0;
    const skipped  = outcomes.skipped?.count ?? 0;
    const failed   = outcomes.failed?.count ?? 0;
    const total    = ingested + skipped + failed;
    const byReason = outcomes.skipped?.byReason || {};

    if (total === 0) return null;

    const skipReasonLabel = (reason) => {
        const key = `email_kb.skip_reason_${reason}`;
        const translated = t(key);
        return translated === key ? reason : translated;
    };

    return (
        <div className="space-y-2 text-[11px]">
            <div className="text-[10px] uppercase tracking-wide font-semibold text-[var(--text-tertiary)]">
                {t('email_kb.outcomes_title')}
            </div>
            <div className="flex items-center gap-3">
                <span className="w-20 text-[var(--text-secondary)]">{t('email_kb.outcome_ingested')}</span>
                <Bar value={ingested} total={total} color="bg-emerald-500" />
                <span className="w-10 text-right tabular-nums text-emerald-600 font-medium">{ingested}</span>
            </div>
            <div className="flex items-center gap-3">
                <span className="w-20 text-[var(--text-secondary)]">{t('email_kb.outcome_skipped')}</span>
                <Bar value={skipped} total={total} color="bg-amber-500" />
                <span className="w-10 text-right tabular-nums text-amber-600 font-medium">{skipped}</span>
            </div>
            {Object.keys(byReason).length > 0 && (
                <ul className="pl-20 space-y-0.5 text-[10px] text-[var(--text-tertiary)]">
                    {Object.entries(byReason)
                        .sort((a, b) => b[1] - a[1])
                        .map(([reason, count]) => (
                            <li key={reason} className="flex justify-between">
                                <span className="truncate">└─ {skipReasonLabel(reason)}</span>
                                <span className="tabular-nums">{count}</span>
                            </li>
                        ))}
                </ul>
            )}
            <div className="flex items-center gap-3">
                <span className="w-20 text-[var(--text-secondary)]">{t('email_kb.outcome_failed')}</span>
                <Bar value={failed} total={total} color="bg-red-500" />
                <span className="w-10 text-right tabular-nums text-red-500 font-medium">{failed}</span>
            </div>
        </div>
    );
};

const HistoryTab = ({ controller, t }) => {
    const { logs, logsLoaded, loadLogs } = controller;
    const [expandedLogId, setExpandedLogId] = useState(null);

    useEffect(() => {
        if (!logsLoaded) loadLogs();
    }, [logsLoaded, loadLogs]);

    if (!logsLoaded) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-5 h-5 animate-spin text-[var(--accent-primary)]" />
            </div>
        );
    }

    if (logs.length === 0) {
        return (
            <div className="p-6 text-center text-[13px] text-[var(--text-tertiary)] italic">
                {t('email_kb.no_history')}
            </div>
        );
    }

    return (
        <div className="p-6 overflow-y-auto">
            <div className="rounded-xl border border-[var(--border-subtle)] overflow-hidden">
                <table className="w-full text-[12px]">
                    <thead className="bg-[var(--bg-secondary)] text-[var(--text-tertiary)]">
                        <tr>
                            <th className="text-left px-3 py-2 font-medium">{t('email_kb.history_date')}</th>
                            <th className="text-center px-3 py-2 font-medium">{t('email_kb.duration')}</th>
                            <th className="text-center px-3 py-2 font-medium">{t('email_kb.fetched')}</th>
                            <th className="text-center px-3 py-2 font-medium">{t('email_kb.created')}</th>
                            <th className="text-center px-3 py-2 font-medium">{t('email_kb.skipped')}</th>
                            <th className="text-center px-3 py-2 font-medium">{t('email_kb.errors')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {logs.map(log => {
                            const hasErrors = log.errors > 0;
                            const outcomes = parseOutcomes(log.outcomes);
                            const hasOutcomes = outcomes && (
                                (outcomes.ingested?.count ?? 0) +
                                (outcomes.skipped?.count ?? 0) +
                                (outcomes.failed?.count ?? 0)
                            ) > 0;
                            const expandable = log.error_details || hasOutcomes;
                            const isExpanded = expandedLogId === log.id;
                            return (
                                <React.Fragment key={log.id}>
                                    <tr
                                        className={`border-t border-[var(--border-subtle)] hover:bg-[var(--bg-secondary)] ${hasErrors ? 'bg-red-50/30' : ''} ${expandable ? 'cursor-pointer' : ''}`}
                                        onClick={() => expandable && setExpandedLogId(isExpanded ? null : log.id)}
                                    >
                                        <td className="px-3 py-2 text-[var(--text-secondary)]">
                                            <span className="inline-flex items-center gap-1.5">
                                                {expandable && <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-0' : '-rotate-90'}`} />}
                                                {new Date(log.started_at).toLocaleString()}
                                            </span>
                                        </td>
                                        <td className="text-center px-3 py-2 text-[var(--text-tertiary)] tabular-nums">
                                            {formatDuration(log)}
                                        </td>
                                        <td className="text-center px-3 py-2 text-[var(--text-primary)] font-medium tabular-nums">{log.emails_fetched}</td>
                                        <td className="text-center px-3 py-2 text-emerald-600 font-medium tabular-nums">{log.articles_created}</td>
                                        <td className="text-center px-3 py-2 text-amber-600 font-medium tabular-nums">{log.articles_skipped}</td>
                                        <td className="text-center px-3 py-2 text-red-500 font-medium tabular-nums">
                                            {log.errors}
                                        </td>
                                    </tr>
                                    {isExpanded && expandable && (
                                        <tr>
                                            <td colSpan={6} className="px-4 py-3 bg-[var(--bg-secondary)] border-t border-[var(--border-subtle)]">
                                                {hasOutcomes && <OutcomesBreakdown outcomes={outcomes} t={t} />}
                                                {log.error_details && (
                                                    <div className={hasOutcomes ? 'mt-3 pt-3 border-t border-[var(--border-subtle)]' : ''}>
                                                        <div className="text-[10px] uppercase tracking-wide font-semibold text-red-600 mb-1">
                                                            {t('email_kb.error_details')}
                                                        </div>
                                                        <div className="text-[10px] text-red-700 font-mono whitespace-pre-wrap max-h-40 overflow-y-auto">{log.error_details}</div>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default HistoryTab;
