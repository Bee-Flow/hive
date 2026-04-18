import React, { useEffect, useRef } from 'react';
import {
    FileText, Mail, Clock, Activity, DollarSign, RefreshCw, TestTube2, Pause, Play, Trash2,
    AlertTriangle, XCircle, CheckCircle2
} from 'lucide-react';
import StatCard from '../StatCard';
import SyncStatusBadge from '../SyncStatusBadge';
import { timeAgo } from '../utils';
import useConnectionCost from '../hooks/useConnectionCost';

const formatCost = (usd) => {
    if (usd == null) return '—';
    if (usd < 0.01) return '<$0.01';
    if (usd < 10) return `$${usd.toFixed(2)}`;
    return `$${usd.toFixed(0)}`;
};

const OverviewTab = ({ conn, controller, onUpdate, onDelete, t }) => {
    const { cost, loading: costLoading, refetch: refetchCost } = useConnectionCost(conn.id);
    const prevSyncing = useRef(false);
    useEffect(() => {
        // When a sync that was running completes, refresh the cost estimate.
        const isSyncing = !!controller.syncProgress;
        if (prevSyncing.current && !isSyncing) refetchCost();
        prevSyncing.current = isSyncing;
    }, [controller.syncProgress, refetchCost]);

    const {
        syncing, syncProgress, syncConflict, startSync,
        testing, testResult, runTest, clearTestResult,
    } = controller;

    const statusLabel = t(`email_kb.sync_status_${conn.sync_status || 'idle'}`);

    return (
        <div className="p-6 space-y-4 overflow-y-auto">
            {/* Stats */}
            <div className="flex gap-3 flex-wrap">
                <StatCard icon={FileText} label={t('email_kb.stat_articles')} value={conn.total_articles_created ?? 0} accent="text-emerald-500" />
                <StatCard icon={Mail}     label={t('email_kb.stat_emails')}   value={conn.total_emails_processed ?? 0} accent="text-blue-500" />
                <StatCard icon={Clock}    label={t('email_kb.stat_last_sync')} value={timeAgo(conn.last_sync_at)} accent="text-amber-500" />
                <StatCard icon={Activity} label={t('email_kb.stat_status')}   value={statusLabel} accent="text-purple-500">
                    {!conn.enabled && <span className="text-amber-600">{t('email_kb.disabled')}</span>}
                </StatCard>
                <StatCard
                    icon={DollarSign}
                    label={t('email_kb.stat_cost')}
                    value={costLoading ? t('email_kb.cost_loading') : formatCost(cost)}
                    accent="text-green-500"
                />
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
                <button onClick={startSync} disabled={syncing || conn.sync_status === 'syncing'}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-semibold bg-[var(--accent-primary)] text-white hover:opacity-90 disabled:opacity-50 shadow-sm transition-all">
                    <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                    {syncing ? t('email_kb.syncing') : t('email_kb.sync_now')}
                </button>
                <button onClick={runTest} disabled={testing}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-50 border border-[var(--border-subtle)] transition-all">
                    <TestTube2 className={`w-4 h-4 ${testing ? 'animate-pulse' : ''}`} />
                    {testing ? t('email_kb.testing') : t('email_kb.test_connection')}
                </button>
                <button onClick={() => onUpdate(conn.id, { enabled: !conn.enabled })}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] transition-all">
                    {conn.enabled ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    {conn.enabled ? t('email_kb.pause') : t('email_kb.resume')}
                </button>
                <div className="flex-1" />
                <button onClick={() => { if (confirm(t('email_kb.delete_confirm'))) onDelete(conn.id); }}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium text-red-500 hover:bg-red-50 border border-red-200 transition-all">
                    <Trash2 className="w-4 h-4" />
                    {t('email_kb.delete_connection')}
                </button>
            </div>

            {/* Error banner */}
            {conn.sync_error && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-[12px] text-red-700">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span className="flex-1">{conn.sync_error}</span>
                    <button onClick={startSync} disabled={syncing}
                        className="flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-white border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50">
                        <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
                        {t('email_kb.retry')}
                    </button>
                </div>
            )}

            {syncConflict && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-[12px] text-amber-800">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{t('email_kb.sync_in_progress')} — {t('email_kb.retry_in')} {syncConflict.retryAfterSeconds}s.</span>
                </div>
            )}

            {/* Live sync progress */}
            {syncProgress && (
                <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] space-y-2.5">
                    <div className="flex items-center justify-between text-[12px]">
                        <span className="flex items-center gap-1.5 font-semibold text-[var(--text-primary)]">
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-[var(--accent-primary)]" />
                            {t('email_kb.syncing')}
                        </span>
                        <span className="text-[var(--text-tertiary)] tabular-nums">
                            {syncProgress.processed}{syncProgress.total != null ? ` / ${syncProgress.total}` : ''}
                        </span>
                    </div>
                    <div className="h-2 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
                        <div
                            className="h-full bg-[var(--accent-primary)] transition-all duration-200"
                            style={{
                                width: syncProgress.total
                                    ? `${Math.min(100, Math.round((syncProgress.processed / syncProgress.total) * 100))}%`
                                    : '10%',
                            }}
                        />
                    </div>
                    {syncProgress.recent.length > 0 && (
                        <ul className="space-y-1 text-[11px] text-[var(--text-tertiary)]">
                            {syncProgress.recent.map((r, i) => (
                                <li key={i} className="flex items-center gap-1.5 truncate">
                                    <span className={
                                        r.bucket === 'ingested' ? 'text-emerald-500' :
                                        r.bucket === 'failed'   ? 'text-red-500' : 'text-amber-500'
                                    }>●</span>
                                    <span className="truncate">{r.subject || r.reason || r.bucket}</span>
                                    {r.bucket === 'skipped' && r.reason && (
                                        <span className="flex-shrink-0 text-[10px]">({r.reason})</span>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            {/* Test result */}
            {testResult && (
                <div className={`p-4 rounded-xl border text-[12px] relative ${testResult.error ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
                    <button onClick={clearTestResult}
                        className="absolute top-2 right-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
                        <XCircle className="w-4 h-4" />
                    </button>
                    {testResult.error ? (
                        <div className="flex items-center gap-2"><XCircle className="w-4 h-4" /> {testResult.error}</div>
                    ) : (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 font-semibold">
                                <CheckCircle2 className="w-4 h-4" /> {t('email_kb.test_success')}
                            </div>
                            {testResult.originalSubject && <div><strong>Subject:</strong> {testResult.originalSubject}</div>}
                            {testResult.preview?.title && <div><strong>Article:</strong> {testResult.preview.title}</div>}
                            {testResult.preview?.category && <div><strong>Category:</strong> {testResult.preview.category}</div>}
                            {testResult.preview?.article && (
                                <details className="mt-2">
                                    <summary className="cursor-pointer text-emerald-600 hover:underline">Preview generated article</summary>
                                    <pre className="mt-2 p-2 bg-white rounded border text-[11px] whitespace-pre-wrap overflow-auto max-h-60">{testResult.preview.article}</pre>
                                </details>
                            )}
                            {testResult.pii && (
                                <details className="mt-2">
                                    <summary className="cursor-pointer text-emerald-600 hover:underline">
                                        PII redaction · {Object.entries(testResult.pii.counts || {})
                                            .filter(([, n]) => n > 0)
                                            .map(([k, n]) => `${n} ${k}`)
                                            .join(', ') || 'no matches'}
                                    </summary>
                                    <div className="mt-2 grid grid-cols-2 gap-2">
                                        <div>
                                            <div className="text-[10px] font-semibold mb-1">Before</div>
                                            <pre className="p-2 bg-white rounded border text-[11px] whitespace-pre-wrap overflow-auto max-h-48 text-[var(--text-primary)]">{testResult.pii.before}</pre>
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-semibold mb-1">After</div>
                                            <pre className="p-2 bg-white rounded border text-[11px] whitespace-pre-wrap overflow-auto max-h-48 text-[var(--text-primary)]">{testResult.pii.after}</pre>
                                        </div>
                                    </div>
                                </details>
                            )}
                            {Array.isArray(testResult.attachments) && testResult.attachments.length > 0 && (
                                <details className="mt-2">
                                    <summary className="cursor-pointer text-emerald-600 hover:underline">
                                        Attachments ({testResult.attachments.length})
                                    </summary>
                                    <ul className="mt-2 space-y-1">
                                        {testResult.attachments.map((a, i) => (
                                            <li key={i} className="p-2 rounded border bg-white text-[11px] text-[var(--text-primary)]">
                                                <div className="flex items-center gap-2">
                                                    <span>📎</span>
                                                    <span className="font-medium truncate">{a.filename}</span>
                                                    <span className="text-[10px] text-[var(--text-muted)]">{Math.ceil((a.bytes || 0) / 1024)} KB</span>
                                                    <span className={`text-[10px] px-1 rounded ${a.kind === 'text' ? 'bg-emerald-100 text-emerald-700' : a.kind === 'failed' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                                                        {a.kind}{a.reason ? `: ${a.reason}` : ''}
                                                    </span>
                                                </div>
                                                {a.preview && (
                                                    <pre className="mt-1 text-[10px] whitespace-pre-wrap text-[var(--text-tertiary)] max-h-24 overflow-auto">{a.preview}</pre>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                </details>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Connection info footer */}
            <div className="text-[11px] text-[var(--text-tertiary)] pt-2">
                Provider: <span className="text-[var(--text-secondary)] font-medium capitalize">{conn.provider}</span>
                {' · '}
                Syncs every <span className="text-[var(--text-secondary)] font-medium">{conn.sync_interval_minutes || 60}m</span>
            </div>
        </div>
    );
};

export default OverviewTab;
