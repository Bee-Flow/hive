import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '../hooks/useTranslation';
import { API_BASE } from '../utils/helpers';
import {
    Mail, Plus, RefreshCw, Settings, Trash2, ChevronDown, ChevronRight,
    CheckCircle2, XCircle, Clock, AlertTriangle, Loader2, TestTube2,
    Pause, Play, ArrowLeft, FileText, RotateCcw
} from 'lucide-react';

/* ─── Helpers ─── */
const api = async (path, opts = {}) => {
    const res = await fetch(`${API_BASE}/api/email-kb${path}`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...opts.headers },
        ...opts,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
};

const timeAgo = (dateStr) => {
    if (!dateStr) return 'Never';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
};

/* ─── Provider icons ─── */
const ProviderIcon = ({ provider, size = 20 }) => {
    if (provider === 'gmail') {
        return (
            <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
                <path d="M6 10L24 26L42 10" stroke="#EA4335" strokeWidth="3" fill="none"/>
                <rect x="4" y="8" width="40" height="32" rx="4" stroke="#4285F4" strokeWidth="2.5" fill="none"/>
                <path d="M4 12L24 28L44 12" stroke="#FBBC04" strokeWidth="2" fill="none" opacity="0.4"/>
            </svg>
        );
    }
    return (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
            <rect x="4" y="8" width="40" height="32" rx="4" stroke="#0078D4" strokeWidth="2.5" fill="none"/>
            <path d="M6 12L24 26L42 12" stroke="#0078D4" strokeWidth="2.5" fill="none"/>
        </svg>
    );
};

/* ─── Status badge ─── */
const SyncStatusBadge = ({ status, t }) => {
    const styles = {
        idle: { bg: 'bg-emerald-500/10', text: 'text-emerald-600', icon: CheckCircle2, label: t('email_kb.sync_status_idle') },
        syncing: { bg: 'bg-blue-500/10', text: 'text-blue-600', icon: Loader2, label: t('email_kb.sync_status_syncing') },
        error: { bg: 'bg-red-500/10', text: 'text-red-600', icon: XCircle, label: t('email_kb.sync_status_error') },
    };
    const s = styles[status] || styles.idle;
    const Icon = s.icon;
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${s.bg} ${s.text}`}>
            <Icon className={`w-3 h-3 ${status === 'syncing' ? 'animate-spin' : ''}`} />
            {s.label}
        </span>
    );
};

/* ─── Connection Card ─── */
const ConnectionCard = ({ conn, onSync, onTest, onDelete, onUpdate, onEditingChange, knowledgeBases, t }) => {
    const [expanded, setExpanded] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [syncProgress, setSyncProgress] = useState(null); // { processed, total, recent:[{bucket, reason, subject, at}] }
    const [syncConflict, setSyncConflict] = useState(null); // { retryAfterSeconds }
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState(null);
    const [showSettings, setShowSettings] = useState(false);
    const [showLogs, setShowLogs] = useState(false);
    const [logs, setLogs] = useState([]);
    const defaultPc = { language: '', article: { modelTier: 'fast', systemPrompt: '' }, category: { modelTier: 'fast', systemPrompt: '' }, merge: { modelTier: 'fast', systemPrompt: '' } };
    const [settings, setSettings] = useState({
        sync_interval_minutes: conn.sync_interval_minutes || 60,
        group_threads: conn.group_threads,
        process_attachments: conn.process_attachments,
        enabled: conn.enabled,
        folder_filter: conn.folder_filter || ['INBOX'],
        sender_blacklist: conn.sender_blacklist || [],
        knowledge_base_id: conn.knowledge_base_id,
        ai_system_prompt: conn.ai_system_prompt || '',
        redact_pii: conn.redact_pii !== false,
        max_emails_per_sync: conn.max_emails_per_sync || 50,
        sync_after_date: conn.sync_after_date || '',
        pipeline_config: { ...defaultPc, ...conn.pipeline_config, article: { ...defaultPc.article, ...conn.pipeline_config?.article }, category: { ...defaultPc.category, ...conn.pipeline_config?.category }, merge: { ...defaultPc.merge, ...conn.pipeline_config?.merge } },
    });
    const [senderInput, setSenderInput] = useState('');
    const [folderInput, setFolderInput] = useState('');
    const [expandedLogId, setExpandedLogId] = useState(null);

    const handleSync = async () => {
        setSyncing(true);
        setSyncProgress({ processed: 0, total: null, recent: [] });
        setSyncConflict(null);

        // Open SSE stream BEFORE triggering the sync so we don't miss sync_started.
        const streamUrl = `${API_BASE}/api/email-kb/connections/${conn.id}/sync/stream`;
        const es = new EventSource(streamUrl, { withCredentials: true });

        const finishOk = () => {
            try { es.close(); } catch { /* noop */ }
            setSyncing(false);
            setSyncProgress(null);
            onSync?.(conn.id, { sseFinished: true }); // parent refreshes list
        };

        es.addEventListener('sync_fetch_complete', (ev) => {
            try {
                const data = JSON.parse(ev.data);
                setSyncProgress(p => ({ ...(p || { processed: 0, recent: [] }), total: data.total }));
            } catch { /* ignore */ }
        });

        es.addEventListener('email_processed', (ev) => {
            try {
                const data = JSON.parse(ev.data);
                setSyncProgress(p => {
                    const recent = [...(p?.recent || []), {
                        bucket: data.bucket,
                        reason: data.detail?.reason,
                        subject: data.detail?.subject || data.detail?.category || data.detail?.messageId || '',
                        at: data.at,
                    }].slice(-5);
                    return { processed: data.processed ?? (p?.processed || 0) + 1, total: data.total ?? p?.total ?? null, recent };
                });
            } catch { /* ignore */ }
        });

        es.addEventListener('sync_completed', () => finishOk());

        es.onerror = () => {
            // Connection error (e.g. server restart, auth expiry). Close + fall
            // back to polling via parent refresh after a short beat.
            try { es.close(); } catch { /* noop */ }
            setSyncing(false);
            setSyncProgress(null);
            onSync?.(conn.id, { sseError: true });
        };

        try {
            const resp = await fetch(`${API_BASE}/api/email-kb/connections/${conn.id}/sync`, {
                method: 'POST',
                credentials: 'include',
            });
            if (resp.status === 409) {
                const body = await resp.json().catch(() => ({}));
                setSyncConflict({ retryAfterSeconds: body.retryAfterSeconds || 60 });
                try { es.close(); } catch { /* noop */ }
                setSyncing(false);
                setSyncProgress(null);
                return;
            }
            if (!resp.ok) {
                const body = await resp.json().catch(() => ({}));
                throw new Error(body.error || `Sync failed (${resp.status})`);
            }
        } catch (err) {
            console.error('[EmailKB] Sync trigger failed:', err);
            try { es.close(); } catch { /* noop */ }
            setSyncing(false);
            setSyncProgress(null);
        }
    };

    const handleTest = async () => {
        setTesting(true);
        setTestResult(null);
        try {
            const result = await api(`/connections/${conn.id}/test`, { method: 'POST' });
            setTestResult(result);
        } catch (err) {
            setTestResult({ error: err.message });
        } finally {
            setTesting(false);
        }
    };

    const handleLoadLogs = async () => {
        try {
            const data = await api(`/connections/${conn.id}/logs`);
            setLogs(data.logs || []);
        } catch (err) {
            console.error('Failed to load logs:', err);
        }
    };

    const handleSaveSettings = async () => {
        await onUpdate(conn.id, settings);
        setShowSettings(false);
        onEditingChange?.(false);
    };

    const addBlacklistEntry = () => {
        const entry = senderInput.trim().toLowerCase();
        if (entry && !settings.sender_blacklist.includes(entry)) {
            setSettings(s => ({ ...s, sender_blacklist: [...s.sender_blacklist, entry] }));
            setSenderInput('');
        }
    };

    const removeBlacklistEntry = (email) => {
        setSettings(s => ({ ...s, sender_blacklist: s.sender_blacklist.filter(e => e !== email) }));
    };

    const addFolderEntry = () => {
        const entry = folderInput.trim();
        if (entry && !settings.folder_filter.includes(entry)) {
            setSettings(s => ({ ...s, folder_filter: [...s.folder_filter, entry] }));
            setFolderInput('');
        }
    };

    const removeFolderEntry = (folder) => {
        setSettings(s => ({ ...s, folder_filter: s.folder_filter.filter(f => f !== folder) }));
    };

    return (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] overflow-hidden transition-all hover:shadow-md">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={() => setExpanded(v => !v)}>
                <ProviderIcon provider={conn.provider} size={24} />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="text-[14px] font-semibold text-[var(--text-primary)] truncate">{conn.email_address}</span>
                        <SyncStatusBadge status={conn.sync_status} t={t} />
                        {!conn.enabled && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 font-medium">{t('email_kb.disabled')}</span>
                        )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-[11px] text-[var(--text-tertiary)]">
                        <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {t('email_kb.last_sync')}: {timeAgo(conn.last_sync_at)}
                        </span>
                        <span>{conn.total_articles_created} {t('email_kb.articles_created').toLowerCase()}</span>
                        <span>{conn.total_emails_processed} {t('email_kb.emails_processed').toLowerCase()}</span>
                    </div>
                </div>
                {expanded ? <ChevronDown className="w-4 h-4 text-[var(--text-tertiary)]" /> : <ChevronRight className="w-4 h-4 text-[var(--text-tertiary)]" />}
            </div>

            {/* Expanded content */}
            {expanded && (
                <div className="border-t border-[var(--border-subtle)] px-4 py-3 space-y-3">
                    {/* Action buttons */}
                    <div className="flex flex-wrap gap-2">
                        <button onClick={handleSync} disabled={syncing || conn.sync_status === 'syncing'}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium bg-[var(--accent-primary)] text-white hover:opacity-90 disabled:opacity-50 transition-all">
                            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                            {syncing ? t('email_kb.syncing') : t('email_kb.sync_now')}
                        </button>
                        <button onClick={handleTest} disabled={testing}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-50 transition-all border border-[var(--border-subtle)]">
                            <TestTube2 className={`w-3.5 h-3.5 ${testing ? 'animate-pulse' : ''}`} />
                            {testing ? t('email_kb.testing') : t('email_kb.test_connection')}
                        </button>
                        <button onClick={() => onUpdate(conn.id, { enabled: !conn.enabled })}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all border border-[var(--border-subtle)]">
                            {conn.enabled ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                            {conn.enabled ? t('email_kb.disabled') : t('email_kb.enabled')}
                        </button>
                        <button onClick={() => { setShowSettings(v => { const next = !v; onEditingChange?.(next); return next; }); setShowLogs(false); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all border border-[var(--border-subtle)]">
                            <Settings className="w-3.5 h-3.5" />
                            {t('email_kb.connection_settings')}
                        </button>
                        <button onClick={() => { setShowLogs(v => !v); setShowSettings(false); if (!showLogs) handleLoadLogs(); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all border border-[var(--border-subtle)]">
                            <Clock className="w-3.5 h-3.5" />
                            {t('email_kb.sync_history')}
                        </button>
                        <button onClick={() => { if (confirm(t('email_kb.delete_confirm'))) onDelete(conn.id); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-red-500 hover:bg-red-50 transition-all border border-red-200">
                            <Trash2 className="w-3.5 h-3.5" />
                            {t('email_kb.delete_connection')}
                        </button>
                    </div>

                    {/* Error display */}
                    {conn.sync_error && (
                        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-[12px] text-red-700">
                            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            <span className="flex-1">{conn.sync_error}</span>
                            <button
                                onClick={handleSync}
                                disabled={syncing}
                                className="flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-white border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50"
                            >
                                <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
                                {t('email_kb.retry') || 'Retry'}
                            </button>
                        </div>
                    )}

                    {/* Conflict: another sync is already running */}
                    {syncConflict && (
                        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-[12px] text-amber-800">
                            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            <span>
                                {t('email_kb.sync_in_progress') || 'Sync already in progress'} —
                                {' '}{t('email_kb.retry_in') || 'retry in'} {syncConflict.retryAfterSeconds}s.
                            </span>
                        </div>
                    )}

                    {/* Live sync progress */}
                    {syncProgress && (
                        <div className="p-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[12px] space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="font-medium text-[var(--text-primary)]">
                                    {t('email_kb.syncing') || 'Syncing'}…
                                </span>
                                <span className="text-[var(--text-tertiary)]">
                                    {syncProgress.processed}{syncProgress.total != null ? ` / ${syncProgress.total}` : ''}
                                </span>
                            </div>
                            <div className="h-1.5 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
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
                                <ul className="space-y-0.5 text-[11px] text-[var(--text-tertiary)]">
                                    {syncProgress.recent.map((r, i) => (
                                        <li key={i} className="flex items-center gap-1.5 truncate">
                                            <span className={
                                                r.bucket === 'ingested' ? 'text-emerald-500' :
                                                r.bucket === 'failed' ? 'text-red-500' :
                                                'text-amber-500'
                                            }>●</span>
                                            <span className="truncate">{r.subject || r.reason || r.bucket}</span>
                                            {r.bucket === 'skipped' && r.reason && (
                                                <span className="flex-shrink-0 text-[10px] text-[var(--text-tertiary)]">({r.reason})</span>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}

                    {/* Test result preview */}
                    {testResult && (
                        <div className={`p-3 rounded-lg border text-[12px] ${testResult.error ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
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
                                </div>
                            )}
                        </div>
                    )}

                    {/* Settings panel — timeline layout */}
                    {showSettings && (
                        <div className="p-4 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] space-y-5">
                            <h4 className="text-[13px] font-semibold text-[var(--text-primary)]">{t('email_kb.connection_settings')}</h4>

                            {/* ── Connection Settings ── */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[11px] font-medium text-[var(--text-secondary)] mb-1 block">{t('email_kb.target_kb')}</label>
                                    <select value={settings.knowledge_base_id} onChange={e => setSettings(s => ({ ...s, knowledge_base_id: e.target.value }))}
                                        className="w-full px-3 py-1.5 rounded-lg text-[12px] bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)]">
                                        {(knowledgeBases || []).map(kb => <option key={kb.id} value={kb.id}>{kb.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[11px] font-medium text-[var(--text-secondary)] mb-1 block">{t('email_kb.language')}</label>
                                    <select value={settings.pipeline_config.language} onChange={e => setSettings(s => ({ ...s, pipeline_config: { ...s.pipeline_config, language: e.target.value } }))}
                                        className="w-full px-3 py-1.5 rounded-lg text-[12px] bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)]">
                                        <option value="">{t('email_kb.language_auto')}</option>
                                        <option value="Nederlands">Nederlands</option>
                                        <option value="English">English</option>
                                        <option value="Deutsch">Deutsch</option>
                                        <option value="Fran\u00e7ais">Fran\u00e7ais</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="text-[11px] font-medium text-[var(--text-secondary)] mb-1 block">{t('email_kb.sync_interval')}</label>
                                    <div className="flex items-center gap-2">
                                        <input type="range" min="15" max="120" step="15" value={settings.sync_interval_minutes}
                                            onChange={e => setSettings(s => ({ ...s, sync_interval_minutes: parseInt(e.target.value) }))}
                                            className="flex-1 accent-[var(--accent-primary)]" />
                                        <span className="text-[11px] text-[var(--text-primary)] w-12 text-right">{settings.sync_interval_minutes}m</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[11px] font-medium text-[var(--text-secondary)] mb-1 block">{t('email_kb.sync_after_date')}</label>
                                    <input type="date" value={settings.sync_after_date || ''} onChange={e => setSettings(s => ({ ...s, sync_after_date: e.target.value || '' }))}
                                        className="w-full px-2 py-1.5 rounded-lg text-[11px] bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]" />
                                </div>
                                <div>
                                    <label className="text-[11px] font-medium text-[var(--text-secondary)] mb-1 block">{t('email_kb.max_emails')}</label>
                                    <input type="number" min="1" max="500" value={settings.max_emails_per_sync}
                                        onChange={e => setSettings(s => ({ ...s, max_emails_per_sync: Math.max(1, Math.min(500, parseInt(e.target.value) || 50)) }))}
                                        className="w-full px-2 py-1.5 rounded-lg text-[11px] bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]" />
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                {[['group_threads', t('email_kb.group_threads')], ['process_attachments', t('email_kb.process_attachments')], ['redact_pii', t('email_kb.redact_pii')]].map(([key, label]) => (
                                    <label key={key} className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={!!settings[key]} onChange={e => setSettings(s => ({ ...s, [key]: e.target.checked }))}
                                            className="w-3.5 h-3.5 rounded accent-[var(--accent-primary)]" />
                                        <span className="text-[11px] text-[var(--text-primary)]">{label}</span>
                                    </label>
                                ))}
                            </div>
                            {/* Folder filter + blacklist */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[11px] font-medium text-[var(--text-secondary)] mb-1 block">{t('email_kb.folder_filter')}</label>
                                    <div className="flex gap-1 mb-1">
                                        <input value={folderInput} onChange={e => setFolderInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addFolderEntry()}
                                            placeholder={conn.provider === 'gmail' ? 'SENT, INBOX' : 'Inbox, SentItems'}
                                            className="flex-1 px-2 py-1 rounded text-[11px] bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]" />
                                        <button onClick={addFolderEntry} className="px-2 py-1 rounded text-[10px] bg-[var(--accent-primary)] text-white"><Plus className="w-3 h-3" /></button>
                                    </div>
                                    <div className="flex flex-wrap gap-1">{settings.folder_filter.map(f => (
                                        <span key={f} className="inline-flex items-center gap-0.5 px-1.5 py-px rounded-full text-[10px] bg-blue-500/10 text-blue-600">{f}<button onClick={() => removeFolderEntry(f)}>×</button></span>
                                    ))}</div>
                                </div>
                                <div>
                                    <label className="text-[11px] font-medium text-[var(--text-secondary)] mb-1 block">{t('email_kb.sender_blacklist')}</label>
                                    <div className="flex gap-1 mb-1">
                                        <input value={senderInput} onChange={e => setSenderInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addBlacklistEntry()}
                                            placeholder="noreply@example.com"
                                            className="flex-1 px-2 py-1 rounded text-[11px] bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]" />
                                        <button onClick={addBlacklistEntry} className="px-2 py-1 rounded text-[10px] bg-[var(--accent-primary)] text-white"><Plus className="w-3 h-3" /></button>
                                    </div>
                                    <div className="flex flex-wrap gap-1">{settings.sender_blacklist.map(e => (
                                        <span key={e} className="inline-flex items-center gap-0.5 px-1.5 py-px rounded-full text-[10px] bg-red-500/10 text-red-600">{e}<button onClick={() => removeBlacklistEntry(e)}>×</button></span>
                                    ))}</div>
                                </div>
                            </div>

                            {/* ── Ingestion Mode ── */}
                            <div className="border-t border-[var(--border-subtle)] pt-4">
                                <h4 className="text-[12px] font-semibold text-[var(--text-primary)] mb-2">Ingestion mode</h4>
                                <div className="text-[10px] text-[var(--text-tertiary)] mb-3">
                                    How emails are stored in the KB. Affects how well the agent can retrieve them.
                                </div>
                                {(() => {
                                    const effectiveMode = settings.pipeline_config.ingestion_mode || 'category_merge';
                                    const setMode = (mode) => setSettings(s => ({ ...s, pipeline_config: { ...s.pipeline_config, ingestion_mode: mode } }));
                                    return (
                                        <div className="space-y-2">
                                            <label className="flex items-start gap-2 p-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] cursor-pointer hover:border-[var(--border-default)]">
                                                <input type="radio" name="ingestion_mode" className="mt-1" checked={effectiveMode === 'per_email'} onChange={() => setMode('per_email')} />
                                                <div>
                                                    <div className="text-[11px] font-semibold text-[var(--text-primary)]">Per-email archive (recommended)</div>
                                                    <div className="text-[10px] text-[var(--text-tertiary)] mt-0.5">
                                                        Each email becomes its own KB document — sender, subject, date and body are all searchable.
                                                        Best for questions like "what did Ewoud say about X?".
                                                        Skips the AI article / category-merge stages below.
                                                    </div>
                                                </div>
                                            </label>
                                            <label className="flex items-start gap-2 p-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] cursor-pointer hover:border-[var(--border-default)]">
                                                <input type="radio" name="ingestion_mode" className="mt-1" checked={effectiveMode === 'category_merge'} onChange={() => setMode('category_merge')} />
                                                <div>
                                                    <div className="text-[11px] font-semibold text-[var(--text-primary)]">Category summary (legacy)</div>
                                                    <div className="text-[10px] text-[var(--text-tertiary)] mt-0.5">
                                                        Emails are AI-rewritten and merged into one FAQ-style document per category.
                                                        Good for a clean support overview, weak for searching specific messages.
                                                    </div>
                                                </div>
                                            </label>
                                            {effectiveMode === 'per_email' && (
                                                <div className="text-[10px] text-amber-600 dark:text-amber-400 p-2 bg-amber-50 dark:bg-amber-900/20 rounded">
                                                    Note: switching from Category summary to Per-email won't delete old category documents. Remove them from the KB manually to fully migrate, then trigger a full re-sync.
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* ── Pipeline Timeline (advanced, collapsed by default) ── */}
                            <details className="border-t border-[var(--border-subtle)] pt-4 group">
                                <summary className="cursor-pointer list-none flex items-center justify-between gap-2 mb-3 select-none">
                                    <div>
                                        <h4 className="text-[12px] font-semibold text-[var(--text-primary)]">{t('email_kb.pipeline_config')}</h4>
                                        <div className="text-[10px] text-[var(--text-tertiary)] mt-0.5">
                                            {t('email_kb.pipeline_config_hint') || 'Advanced: model tiers, batching, custom prompts'}
                                        </div>
                                    </div>
                                    <ChevronDown className="w-4 h-4 text-[var(--text-tertiary)] transition-transform group-open:rotate-180" />
                                </summary>
                                {settings.pipeline_config.ingestion_mode === 'per_email' && (
                                    <div className="text-[10px] text-[var(--text-tertiary)] mb-3 p-2 bg-[var(--bg-tertiary)] rounded">
                                        Per-email mode skips stages 2–4 (AI article / categorization / merge). Only cleanup + ingestion run.
                                    </div>
                                )}
                                <div className="relative pl-6">
                                    {/* Vertical timeline line */}
                                    <div className="absolute left-[9px] top-2 bottom-2 w-px bg-[var(--border-subtle)]" />

                                    {/* Stage 1: Cleanup (no config) */}
                                    <div className="relative mb-4">
                                        <div className="absolute -left-6 top-1 w-[18px] h-[18px] rounded-full bg-[var(--bg-tertiary)] border-2 border-[var(--border-subtle)] flex items-center justify-center text-[9px]">1</div>
                                        <div className="text-[11px] font-medium text-[var(--text-tertiary)]">{t('email_kb.stage_cleanup')}</div>
                                        <div className="text-[10px] text-[var(--text-tertiary)]">{t('email_kb.stage_cleanup_desc')}</div>
                                    </div>

                                    {/* Stage 2: Article Generation */}
                                    {(() => { const stageKey = 'article'; const pc = settings.pipeline_config; return (
                                    <div className="relative mb-4">
                                        <div className="absolute -left-6 top-1 w-[18px] h-[18px] rounded-full bg-blue-500/20 border-2 border-blue-500/40 flex items-center justify-center text-[9px] text-blue-600 font-bold">2</div>
                                        <div className="p-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] space-y-2">
                                            <div className="flex items-center justify-between gap-2">
                                                <div>
                                                    <div className="text-[11px] font-semibold text-[var(--text-primary)]">{t('email_kb.stage_article')}</div>
                                                    <div className="text-[10px] text-[var(--text-tertiary)]">{t('email_kb.stage_article_desc')}</div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="flex flex-col items-end">
                                                        <label className="text-[9px] text-[var(--text-tertiary)] leading-tight" title="Number of emails processed in parallel. Default: 8 for fast models, 3 for deep_thinking. Max 10.">Parallel</label>
                                                        <input
                                                            type="number" min="1" max="10"
                                                            placeholder={pc[stageKey].modelTier === 'deep_thinking' ? '3' : pc[stageKey].modelTier === 'fast' ? '8' : '5'}
                                                            value={pc[stageKey].concurrency ?? ''}
                                                            onChange={e => {
                                                                const raw = e.target.value;
                                                                if (raw === '') {
                                                                    setSettings(s => ({ ...s, pipeline_config: { ...s.pipeline_config, [stageKey]: { ...s.pipeline_config[stageKey], concurrency: undefined } } }));
                                                                    return;
                                                                }
                                                                const n = Math.max(1, Math.min(10, parseInt(raw) || 1));
                                                                setSettings(s => ({ ...s, pipeline_config: { ...s.pipeline_config, [stageKey]: { ...s.pipeline_config[stageKey], concurrency: n } } }));
                                                            }}
                                                            className="w-14 px-2 py-1 rounded text-[11px] bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-right"
                                                        />
                                                    </div>
                                                    <div className="flex flex-col items-end">
                                                        <label className="text-[9px] text-[var(--text-tertiary)] leading-tight" title="Emails sent to the LLM in ONE call (batched prompt). 1 = no batching (safe). 2–5 = ~2× faster for category_merge mode, but may reduce article quality on very long emails. Ignored in per-email mode.">Batch</label>
                                                        <input
                                                            type="number" min="1" max="5"
                                                            value={pc[stageKey].batch_size ?? 1}
                                                            onChange={e => {
                                                                const n = Math.max(1, Math.min(5, parseInt(e.target.value) || 1));
                                                                setSettings(s => ({ ...s, pipeline_config: { ...s.pipeline_config, [stageKey]: { ...s.pipeline_config[stageKey], batch_size: n } } }));
                                                            }}
                                                            className="w-12 px-2 py-1 rounded text-[11px] bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-right"
                                                        />
                                                    </div>
                                                    <select value={pc[stageKey].modelTier} onChange={e => setSettings(s => ({ ...s, pipeline_config: { ...s.pipeline_config, [stageKey]: { ...s.pipeline_config[stageKey], modelTier: e.target.value } } }))}
                                                        className="px-2 py-1 rounded text-[11px] bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)]">
                                                        <option value="fast">{t('email_kb.tier_fast')}</option>
                                                        <option value="thinking">{t('email_kb.tier_thinking')}</option>
                                                        <option value="writer">{t('email_kb.tier_writer')}</option>
                                                        <option value="deep_thinking">{t('email_kb.tier_deep_thinking')}</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <details className="text-[10px]">
                                                <summary className="cursor-pointer text-[var(--text-tertiary)] hover:text-[var(--accent-primary)]">{t('email_kb.custom_prompt')}</summary>
                                                <textarea value={pc[stageKey].systemPrompt} onChange={e => setSettings(s => ({ ...s, pipeline_config: { ...s.pipeline_config, [stageKey]: { ...s.pipeline_config[stageKey], systemPrompt: e.target.value } } }))}
                                                    placeholder={t('email_kb.custom_prompt_placeholder')} rows={3}
                                                    className="w-full mt-1.5 px-2 py-1.5 rounded text-[11px] bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)] resize-y font-mono" />
                                                {pc[stageKey].systemPrompt && <button onClick={() => setSettings(s => ({ ...s, pipeline_config: { ...s.pipeline_config, [stageKey]: { ...s.pipeline_config[stageKey], systemPrompt: '' } } }))}
                                                    className="flex items-center gap-1 mt-1 text-[var(--text-tertiary)] hover:text-[var(--accent-primary)]"><RotateCcw className="w-3 h-3" />{t('email_kb.reset_prompt')}</button>}
                                            </details>
                                        </div>
                                    </div>
                                    ); })()}

                                    {/* Stage 3: Categorization */}
                                    {(() => { const stageKey = 'category'; const pc = settings.pipeline_config; return (
                                    <div className="relative mb-4">
                                        <div className="absolute -left-6 top-1 w-[18px] h-[18px] rounded-full bg-amber-500/20 border-2 border-amber-500/40 flex items-center justify-center text-[9px] text-amber-600 font-bold">3</div>
                                        <div className="p-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] space-y-2">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <div className="text-[11px] font-semibold text-[var(--text-primary)]">{t('email_kb.stage_category')}</div>
                                                    <div className="text-[10px] text-[var(--text-tertiary)]">{t('email_kb.stage_category_desc')}</div>
                                                </div>
                                                <select value={pc[stageKey].modelTier} onChange={e => setSettings(s => ({ ...s, pipeline_config: { ...s.pipeline_config, [stageKey]: { ...s.pipeline_config[stageKey], modelTier: e.target.value } } }))}
                                                    className="px-2 py-1 rounded text-[11px] bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)]">
                                                    <option value="fast">{t('email_kb.tier_fast')}</option>
                                                    <option value="thinking">{t('email_kb.tier_thinking')}</option>
                                                    <option value="writer">{t('email_kb.tier_writer')}</option>
                                                    <option value="deep_thinking">{t('email_kb.tier_deep_thinking')}</option>
                                                </select>
                                            </div>
                                            <details className="text-[10px]">
                                                <summary className="cursor-pointer text-[var(--text-tertiary)] hover:text-[var(--accent-primary)]">{t('email_kb.custom_prompt')}</summary>
                                                <textarea value={pc[stageKey].systemPrompt} onChange={e => setSettings(s => ({ ...s, pipeline_config: { ...s.pipeline_config, [stageKey]: { ...s.pipeline_config[stageKey], systemPrompt: e.target.value } } }))}
                                                    placeholder={t('email_kb.custom_prompt_placeholder')} rows={3}
                                                    className="w-full mt-1.5 px-2 py-1.5 rounded text-[11px] bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)] resize-y font-mono" />
                                                {pc[stageKey].systemPrompt && <button onClick={() => setSettings(s => ({ ...s, pipeline_config: { ...s.pipeline_config, [stageKey]: { ...s.pipeline_config[stageKey], systemPrompt: '' } } }))}
                                                    className="flex items-center gap-1 mt-1 text-[var(--text-tertiary)] hover:text-[var(--accent-primary)]"><RotateCcw className="w-3 h-3" />{t('email_kb.reset_prompt')}</button>}
                                            </details>
                                        </div>
                                    </div>
                                    ); })()}

                                    {/* Stage 4: Category Merge */}
                                    {(() => { const stageKey = 'merge'; const pc = settings.pipeline_config; return (
                                    <div className="relative mb-4">
                                        <div className="absolute -left-6 top-1 w-[18px] h-[18px] rounded-full bg-purple-500/20 border-2 border-purple-500/40 flex items-center justify-center text-[9px] text-purple-600 font-bold">4</div>
                                        <div className="p-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] space-y-2">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <div className="text-[11px] font-semibold text-[var(--text-primary)]">{t('email_kb.stage_merge')}</div>
                                                    <div className="text-[10px] text-[var(--text-tertiary)]">{t('email_kb.stage_merge_desc')}</div>
                                                </div>
                                                <select value={pc[stageKey].modelTier} onChange={e => setSettings(s => ({ ...s, pipeline_config: { ...s.pipeline_config, [stageKey]: { ...s.pipeline_config[stageKey], modelTier: e.target.value } } }))}
                                                    className="px-2 py-1 rounded text-[11px] bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)]">
                                                    <option value="fast">{t('email_kb.tier_fast')}</option>
                                                    <option value="thinking">{t('email_kb.tier_thinking')}</option>
                                                    <option value="writer">{t('email_kb.tier_writer')}</option>
                                                    <option value="deep_thinking">{t('email_kb.tier_deep_thinking')}</option>
                                                </select>
                                            </div>
                                            <details className="text-[10px]">
                                                <summary className="cursor-pointer text-[var(--text-tertiary)] hover:text-[var(--accent-primary)]">{t('email_kb.custom_prompt')}</summary>
                                                <textarea value={pc[stageKey].systemPrompt} onChange={e => setSettings(s => ({ ...s, pipeline_config: { ...s.pipeline_config, [stageKey]: { ...s.pipeline_config[stageKey], systemPrompt: e.target.value } } }))}
                                                    placeholder={t('email_kb.custom_prompt_placeholder')} rows={3}
                                                    className="w-full mt-1.5 px-2 py-1.5 rounded text-[11px] bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)] resize-y font-mono" />
                                                {pc[stageKey].systemPrompt && <button onClick={() => setSettings(s => ({ ...s, pipeline_config: { ...s.pipeline_config, [stageKey]: { ...s.pipeline_config[stageKey], systemPrompt: '' } } }))}
                                                    className="flex items-center gap-1 mt-1 text-[var(--text-tertiary)] hover:text-[var(--accent-primary)]"><RotateCcw className="w-3 h-3" />{t('email_kb.reset_prompt')}</button>}
                                            </details>
                                        </div>
                                    </div>
                                    ); })()}

                                    {/* Stage 5: Ingestion (no config) */}
                                    <div className="relative">
                                        <div className="absolute -left-6 top-1 w-[18px] h-[18px] rounded-full bg-emerald-500/20 border-2 border-emerald-500/40 flex items-center justify-center text-[9px] text-emerald-600 font-bold">5</div>
                                        <div className="text-[11px] font-medium text-[var(--text-tertiary)]">{t('email_kb.stage_ingest')}</div>
                                        <div className="text-[10px] text-[var(--text-tertiary)]">{t('email_kb.stage_ingest_desc')}</div>
                                    </div>
                                </div>
                            </details>

                            {/* Save */}
                            <div className="flex justify-end">
                                <button onClick={handleSaveSettings}
                                    className="px-4 py-1.5 rounded-lg text-[12px] font-medium bg-[var(--accent-primary)] text-white hover:opacity-90 transition-all">
                                    Save Settings
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Sync logs */}
                    {showLogs && (
                        <div className="space-y-1.5">
                            <h4 className="text-[12px] font-semibold text-[var(--text-primary)]">{t('email_kb.sync_history')}</h4>
                            {logs.length === 0 ? (
                                <p className="text-[11px] text-[var(--text-tertiary)] italic">{t('email_kb.never_synced')}</p>
                            ) : (
                                <div className="max-h-48 overflow-y-auto rounded-lg border border-[var(--border-subtle)]">
                                    <table className="w-full text-[11px]">
                                        <thead className="bg-[var(--bg-secondary)] text-[var(--text-tertiary)] sticky top-0">
                                            <tr>
                                                <th className="text-left px-2 py-1.5 font-medium">Date</th>
                                                <th className="text-center px-2 py-1.5 font-medium">{t('email_kb.duration')}</th>
                                                <th className="text-center px-2 py-1.5 font-medium">{t('email_kb.fetched')}</th>
                                                <th className="text-center px-2 py-1.5 font-medium">{t('email_kb.created')}</th>
                                                <th className="text-center px-2 py-1.5 font-medium">{t('email_kb.skipped')}</th>
                                                <th className="text-center px-2 py-1.5 font-medium">{t('email_kb.errors')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {logs.map(log => {
                                                const hasErrors = log.errors > 0;
                                                const duration = log.finished_at && log.started_at
                                                    ? Math.round((new Date(log.finished_at) - new Date(log.started_at)) / 1000)
                                                    : null;
                                                return (
                                                    <React.Fragment key={log.id}>
                                                        <tr
                                                            className={`border-t border-[var(--border-subtle)] hover:bg-[var(--bg-secondary)] ${hasErrors ? 'bg-red-50/30' : ''} ${log.error_details ? 'cursor-pointer' : ''}`}
                                                            onClick={() => log.error_details && setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                                                        >
                                                            <td className="px-2 py-1.5 text-[var(--text-secondary)]">
                                                                {new Date(log.started_at).toLocaleString()}
                                                            </td>
                                                            <td className="text-center px-2 py-1.5 text-[var(--text-tertiary)]">
                                                                {duration !== null ? (duration < 60 ? `${duration}s` : `${Math.floor(duration / 60)}m ${duration % 60}s`) : '—'}
                                                            </td>
                                                            <td className="text-center px-2 py-1.5 text-[var(--text-primary)] font-medium">{log.emails_fetched}</td>
                                                            <td className="text-center px-2 py-1.5 text-emerald-600 font-medium">{log.articles_created}</td>
                                                            <td className="text-center px-2 py-1.5 text-amber-600 font-medium">{log.articles_skipped}</td>
                                                            <td className="text-center px-2 py-1.5 text-red-500 font-medium">
                                                                {log.errors}
                                                                {log.error_details && <ChevronDown className={`w-3 h-3 inline ml-0.5 transition-transform ${expandedLogId === log.id ? 'rotate-180' : ''}`} />}
                                                            </td>
                                                        </tr>
                                                        {expandedLogId === log.id && log.error_details && (
                                                            <tr>
                                                                <td colSpan={6} className="px-3 py-2 bg-red-50/50 border-t border-red-200/50">
                                                                    <div className="text-[10px] text-red-700 font-mono whitespace-pre-wrap max-h-32 overflow-y-auto">{log.error_details}</div>
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </React.Fragment>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

/* ─── Add Connection Modal ─── */
const AddConnectionModal = ({ onClose, onAdd, knowledgeBases, onKBCreated, oauthProvider, t }) => {
    const [provider, setProvider] = useState(oauthProvider === 'microsoft' ? 'outlook' : oauthProvider === 'google' ? 'gmail' : '');
    const [kbId, setKbId] = useState(knowledgeBases?.[0]?.id || '');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [creatingKB, setCreatingKB] = useState(false);
    const [newKBName, setNewKBName] = useState('');

    const canConnectGmail = oauthProvider === 'google';
    const canConnectOutlook = oauthProvider === 'microsoft';

    const handleCreateKB = async () => {
        if (!newKBName.trim()) return;
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`${API_BASE}/api/kb`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newKBName.trim() }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
            setKbId(data.id);
            setCreatingKB(false);
            setNewKBName('');
            if (onKBCreated) onKBCreated(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async () => {
        if (!provider || !kbId) return;
        setLoading(true);
        setError('');
        try {
            await onAdd({ provider, knowledgeBaseId: kbId });
            onClose();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
            <div className="w-full max-w-md bg-[var(--bg-primary)] rounded-2xl border border-[var(--border-subtle)] shadow-2xl p-6 space-y-5"
                onClick={e => e.stopPropagation()} style={{ animation: 'emailKBModalIn .2s ease-out' }}>
                <h3 className="text-[16px] font-bold text-[var(--text-primary)]">Connect Email Account</h3>

                {/* Provider selection */}
                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={() => canConnectGmail && setProvider('gmail')}
                        disabled={!canConnectGmail}
                        className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                            provider === 'gmail'
                                ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/5 shadow-sm'
                                : canConnectGmail ? 'border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/50' : 'border-[var(--border-subtle)] opacity-40 cursor-not-allowed'
                        }`}
                    >
                        <ProviderIcon provider="gmail" size={32} />
                        <span className="text-[13px] font-semibold text-[var(--text-primary)]">{t('email_kb.connect_gmail')}</span>
                        {!canConnectGmail && <span className="text-[10px] text-[var(--text-tertiary)]">{t('email_kb.login_required_google')}</span>}
                    </button>
                    <button
                        onClick={() => canConnectOutlook && setProvider('outlook')}
                        disabled={!canConnectOutlook}
                        className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                            provider === 'outlook'
                                ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/5 shadow-sm'
                                : canConnectOutlook ? 'border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/50' : 'border-[var(--border-subtle)] opacity-40 cursor-not-allowed'
                        }`}
                    >
                        <ProviderIcon provider="outlook" size={32} />
                        <span className="text-[13px] font-semibold text-[var(--text-primary)]">{t('email_kb.connect_outlook')}</span>
                        {!canConnectOutlook && <span className="text-[10px] text-[var(--text-tertiary)]">{t('email_kb.login_required_microsoft')}</span>}
                    </button>
                </div>

                {/* Target KB */}
                <div>
                    <label className="text-[12px] font-medium text-[var(--text-secondary)] mb-1.5 block">{t('email_kb.target_kb')}</label>
                    <p className="text-[10px] text-[var(--text-tertiary)] mb-1.5">{t('email_kb.target_kb_desc')}</p>
                    {creatingKB ? (
                        <div className="flex gap-2">
                            <input
                                value={newKBName}
                                onChange={e => setNewKBName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleCreateKB()}
                                placeholder="Knowledge base name..."
                                autoFocus
                                className="flex-1 px-3 py-2 rounded-lg text-[13px] bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
                            />
                            <button onClick={handleCreateKB} disabled={!newKBName.trim() || loading}
                                className="px-3 py-2 rounded-lg text-[12px] font-medium bg-[var(--accent-primary)] text-white hover:opacity-90 disabled:opacity-50">
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create'}
                            </button>
                            <button onClick={() => { setCreatingKB(false); setNewKBName(''); }}
                                className="px-2 py-2 rounded-lg text-[12px] text-[var(--text-tertiary)] hover:bg-[var(--bg-secondary)]">
                                Cancel
                            </button>
                        </div>
                    ) : (
                        <div className="flex gap-2">
                            <select value={kbId} onChange={e => setKbId(e.target.value)}
                                className="flex-1 px-3 py-2 rounded-lg text-[13px] bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)]">
                                {(knowledgeBases || []).map(kb => (
                                    <option key={kb.id} value={kb.id}>{kb.name}</option>
                                ))}
                            </select>
                            <button onClick={() => setCreatingKB(true)}
                                className="flex items-center gap-1 px-3 py-2 rounded-lg text-[12px] font-medium text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/5 border border-[var(--border-subtle)] transition-all whitespace-nowrap">
                                <Plus className="w-3.5 h-3.5" /> New
                            </button>
                        </div>
                    )}
                </div>

                {error && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-[12px] text-red-700">
                        <XCircle className="w-4 h-4 flex-shrink-0" /> {error}
                    </div>
                )}

                <div className="flex justify-end gap-2">
                    <button onClick={onClose}
                        className="px-4 py-2 rounded-lg text-[13px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition-all">
                        Cancel
                    </button>
                    <button onClick={handleSubmit} disabled={!provider || !kbId || loading || creatingKB}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium bg-[var(--accent-primary)] text-white hover:opacity-90 disabled:opacity-50 transition-all">
                        {loading && !creatingKB ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        Connect
                    </button>
                </div>
            </div>
        </div>
    );
};

/* ─── Main Page ─── */
const EmailKBSettings = ({ user, onNavigateBack }) => {
    const { t } = useTranslation();
    const [connections, setConnections] = useState([]);
    const [knowledgeBases, setKnowledgeBases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [error, setError] = useState('');
    const [editingConnection, setEditingConnection] = useState(null); // tracks which card has settings open

    const loadData = useCallback(async (isAutoRefresh = false) => {
        if (!isAutoRefresh) setLoading(true);
        try {
            const [connData, kbRes] = await Promise.all([
                api('/connections'),
                fetch(`${API_BASE}/api/kb`, { credentials: 'include' }).then(r => r.json()),
            ]);
            setConnections(connData.connections || []);
            setKnowledgeBases(Array.isArray(kbRes) ? kbRes : kbRes.knowledgeBases || []);
        } catch (err) {
            if (!isAutoRefresh) setError(err.message);
        } finally {
            if (!isAutoRefresh) setLoading(false);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    // Auto-refresh every 30s — skip when user is editing settings to avoid losing unsaved changes
    useEffect(() => {
        const interval = setInterval(() => {
            if (!editingConnection) loadData(true);
        }, 30000);
        return () => clearInterval(interval);
    }, [loadData, editingConnection]);

    const handleAdd = async (params) => {
        await api('/connections', { method: 'POST', body: JSON.stringify(params) });
        await loadData();
    };

    // ConnectionCard now owns the POST + SSE stream; the parent's role is just
    // to refresh the list when SSE reports the sync finished (or errored).
    const handleSync = async (_id, opts = {}) => {
        if (opts.sseFinished || opts.sseError) {
            await loadData();
        }
    };

    const handleUpdate = async (id, updates) => {
        await api(`/connections/${id}`, { method: 'PATCH', body: JSON.stringify(updates) });
        await loadData();
    };

    const handleDelete = async (id) => {
        await api(`/connections/${id}`, { method: 'DELETE' });
        await loadData();
    };

    const oauthProvider = user?.oauthProvider || user?.provider || '';

    return (
        <div className="flex flex-col h-full bg-[var(--bg-primary)]">
            {/* Header */}
            <div className="flex-shrink-0 px-6 py-5 border-b border-[var(--border-subtle)]">
                <div className="flex items-center gap-3 mb-2">
                    {onNavigateBack && (
                        <button onClick={onNavigateBack} className="p-1.5 rounded-lg hover:bg-[var(--bg-secondary)] text-[var(--text-tertiary)] transition-colors">
                            <ArrowLeft className="w-4 h-4" />
                        </button>
                    )}
                    <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                            <Mail className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <h1 className="text-[18px] font-bold text-[var(--text-primary)]">{t('email_kb.title')}</h1>
                            <p className="text-[12px] text-[var(--text-tertiary)]">{t('email_kb.subtitle')}</p>
                        </div>
                    </div>
                    <div className="flex-1" />
                    <button onClick={() => setShowAddModal(true)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-semibold bg-[var(--accent-primary)] text-white hover:opacity-90 shadow-sm transition-all">
                        <Plus className="w-4 h-4" />
                        Connect Mailbox
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-6 h-6 animate-spin text-[var(--accent-primary)]" />
                    </div>
                ) : error ? (
                    <div className="flex items-center gap-2 p-4 rounded-xl bg-red-50 border border-red-200 text-[13px] text-red-700">
                        <AlertTriangle className="w-5 h-5" /> {error}
                    </div>
                ) : connections.length === 0 ? (
                    /* Empty state */
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 flex items-center justify-center mb-4">
                            <Mail className="w-8 h-8 text-blue-500/60" />
                        </div>
                        <h3 className="text-[16px] font-semibold text-[var(--text-primary)] mb-1">{t('email_kb.no_connections')}</h3>
                        <p className="text-[13px] text-[var(--text-tertiary)] max-w-sm mb-4">{t('email_kb.no_connections_desc')}</p>
                        <button onClick={() => setShowAddModal(true)}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold bg-[var(--accent-primary)] text-white hover:opacity-90 shadow-lg transition-all">
                            <Plus className="w-4 h-4" />
                            Connect Your First Mailbox
                        </button>
                    </div>
                ) : (
                    /* Connection list */
                    <div className="space-y-3 max-w-3xl">
                        {connections.map(conn => (
                            <ConnectionCard
                                key={conn.id}
                                conn={conn}
                                onSync={handleSync}
                                onTest={() => {}}
                                onEditingChange={(isEditing) => setEditingConnection(isEditing ? conn.id : null)}
                                onDelete={handleDelete}
                                onUpdate={handleUpdate}
                                knowledgeBases={knowledgeBases}
                                t={t}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Add connection modal */}
            {showAddModal && (
                <AddConnectionModal
                    onClose={() => setShowAddModal(false)}
                    onAdd={handleAdd}
                    knowledgeBases={knowledgeBases}
                    onKBCreated={(newKB) => setKnowledgeBases(prev => [newKB, ...prev])}
                    oauthProvider={oauthProvider}
                    t={t}
                />
            )}

            <style>{`
                @keyframes emailKBModalIn {
                    from { opacity: 0; transform: translateY(8px) scale(0.97); }
                    to   { opacity: 1; transform: translateY(0) scale(1); }
                }
            `}</style>
        </div>
    );
};

export default EmailKBSettings;
