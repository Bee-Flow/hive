import React, { useState, useEffect } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';

const formatDuration = (log) => {
    if (!log.finished_at || !log.started_at) return '—';
    const sec = Math.round((new Date(log.finished_at) - new Date(log.started_at)) / 1000);
    return sec < 60 ? `${sec}s` : `${Math.floor(sec / 60)}m ${sec % 60}s`;
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
                            return (
                                <React.Fragment key={log.id}>
                                    <tr
                                        className={`border-t border-[var(--border-subtle)] hover:bg-[var(--bg-secondary)] ${hasErrors ? 'bg-red-50/30' : ''} ${log.error_details ? 'cursor-pointer' : ''}`}
                                        onClick={() => log.error_details && setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                                    >
                                        <td className="px-3 py-2 text-[var(--text-secondary)]">
                                            {new Date(log.started_at).toLocaleString()}
                                        </td>
                                        <td className="text-center px-3 py-2 text-[var(--text-tertiary)] tabular-nums">
                                            {formatDuration(log)}
                                        </td>
                                        <td className="text-center px-3 py-2 text-[var(--text-primary)] font-medium tabular-nums">{log.emails_fetched}</td>
                                        <td className="text-center px-3 py-2 text-emerald-600 font-medium tabular-nums">{log.articles_created}</td>
                                        <td className="text-center px-3 py-2 text-amber-600 font-medium tabular-nums">{log.articles_skipped}</td>
                                        <td className="text-center px-3 py-2 text-red-500 font-medium tabular-nums">
                                            {log.errors}
                                            {log.error_details && <ChevronDown className={`w-3 h-3 inline ml-0.5 transition-transform ${expandedLogId === log.id ? 'rotate-180' : ''}`} />}
                                        </td>
                                    </tr>
                                    {expandedLogId === log.id && log.error_details && (
                                        <tr>
                                            <td colSpan={6} className="px-3 py-2 bg-red-50/50 border-t border-red-200/50">
                                                <div className="text-[10px] text-red-700 font-mono whitespace-pre-wrap max-h-40 overflow-y-auto">{log.error_details}</div>
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
