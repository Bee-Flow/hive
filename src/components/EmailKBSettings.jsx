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
const ConnectionCard = ({ conn, onSync, onTest, onDelete, onUpdate, knowledgeBases, t }) => {
    const [expanded, setExpanded] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState(null);
    const [showSettings, setShowSettings] = useState(false);
    const [showLogs, setShowLogs] = useState(false);
    const [logs, setLogs] = useState([]);
    const [settings, setSettings] = useState({
        sync_interval_minutes: conn.sync_interval_minutes || 60,
        group_threads: conn.group_threads,
        process_attachments: conn.process_attachments,
        enabled: conn.enabled,
        folder_filter: conn.folder_filter || ['INBOX'],
        sender_blacklist: conn.sender_blacklist || [],
        knowledge_base_id: conn.knowledge_base_id,
        ai_system_prompt: conn.ai_system_prompt || '',
    });
    const [senderInput, setSenderInput] = useState('');
    const [folderInput, setFolderInput] = useState('');
    const [expandedLogId, setExpandedLogId] = useState(null);

    const handleSync = async () => {
        setSyncing(true);
        try { await onSync(conn.id); } finally { setTimeout(() => setSyncing(false), 2000); }
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
                        <button onClick={() => { setShowSettings(v => !v); setShowLogs(false); }}
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
                            <span>{conn.sync_error}</span>
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

                    {/* Settings panel */}
                    {showSettings && (
                        <div className="p-4 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] space-y-4">
                            <h4 className="text-[13px] font-semibold text-[var(--text-primary)]">{t('email_kb.connection_settings')}</h4>

                            {/* Target KB */}
                            <div>
                                <label className="text-[11px] font-medium text-[var(--text-secondary)] mb-1 block">{t('email_kb.target_kb')}</label>
                                <select
                                    value={settings.knowledge_base_id}
                                    onChange={e => setSettings(s => ({ ...s, knowledge_base_id: e.target.value }))}
                                    className="w-full px-3 py-1.5 rounded-lg text-[12px] bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
                                >
                                    {(knowledgeBases || []).map(kb => (
                                        <option key={kb.id} value={kb.id}>{kb.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Sync interval */}
                            <div>
                                <label className="text-[11px] font-medium text-[var(--text-secondary)] mb-1 block">{t('email_kb.sync_interval')}</label>
                                <div className="flex items-center gap-2">
                                    <input type="range" min="15" max="120" step="15" value={settings.sync_interval_minutes}
                                        onChange={e => setSettings(s => ({ ...s, sync_interval_minutes: parseInt(e.target.value) }))}
                                        className="flex-1 accent-[var(--accent-primary)]" />
                                    <span className="text-[12px] font-medium text-[var(--text-primary)] w-16 text-right">{settings.sync_interval_minutes} {t('email_kb.minutes')}</span>
                                </div>
                            </div>

                            {/* Toggles */}
                            <div className="grid grid-cols-2 gap-3">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={settings.group_threads}
                                        onChange={e => setSettings(s => ({ ...s, group_threads: e.target.checked }))}
                                        className="w-4 h-4 rounded accent-[var(--accent-primary)]" />
                                    <div>
                                        <div className="text-[12px] font-medium text-[var(--text-primary)]">{t('email_kb.group_threads')}</div>
                                        <div className="text-[10px] text-[var(--text-tertiary)]">{t('email_kb.group_threads_desc')}</div>
                                    </div>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={settings.process_attachments}
                                        onChange={e => setSettings(s => ({ ...s, process_attachments: e.target.checked }))}
                                        className="w-4 h-4 rounded accent-[var(--accent-primary)]" />
                                    <div>
                                        <div className="text-[12px] font-medium text-[var(--text-primary)]">{t('email_kb.process_attachments')}</div>
                                        <div className="text-[10px] text-[var(--text-tertiary)]">{t('email_kb.process_attachments_desc')}</div>
                                    </div>
                                </label>
                            </div>

                            {/* Sender blacklist */}
                            <div>
                                <label className="text-[11px] font-medium text-[var(--text-secondary)] mb-1 block">{t('email_kb.sender_blacklist')}</label>
                                <p className="text-[10px] text-[var(--text-tertiary)] mb-1.5">{t('email_kb.sender_blacklist_desc')}</p>
                                <div className="flex gap-1.5 mb-2">
                                    <input value={senderInput} onChange={e => setSenderInput(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && addBlacklistEntry()}
                                        placeholder="noreply@example.com"
                                        className="flex-1 px-2.5 py-1.5 rounded-lg text-[12px] bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]" />
                                    <button onClick={addBlacklistEntry}
                                        className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-[var(--accent-primary)] text-white hover:opacity-90">
                                        <Plus className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                    {settings.sender_blacklist.map(email => (
                                        <span key={email} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-red-500/10 text-red-600">
                                            {email}
                                            <button onClick={() => removeBlacklistEntry(email)} className="hover:text-red-800">×</button>
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* Folder filter */}
                            <div>
                                <label className="text-[11px] font-medium text-[var(--text-secondary)] mb-1 block">{t('email_kb.folder_filter')}</label>
                                <p className="text-[10px] text-[var(--text-tertiary)] mb-1.5">{t('email_kb.folder_filter_desc')}</p>
                                <div className="flex gap-1.5 mb-2">
                                    <input value={folderInput} onChange={e => setFolderInput(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && addFolderEntry()}
                                        placeholder={conn.provider === 'gmail' ? 'INBOX, SENT, Label_123' : 'Inbox, SentItems, Drafts'}
                                        className="flex-1 px-2.5 py-1.5 rounded-lg text-[12px] bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]" />
                                    <button onClick={addFolderEntry}
                                        className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-[var(--accent-primary)] text-white hover:opacity-90">
                                        <Plus className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                    {settings.folder_filter.map(folder => (
                                        <span key={folder} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-blue-500/10 text-blue-600">
                                            {folder}
                                            <button onClick={() => removeFolderEntry(folder)} className="hover:text-blue-800">×</button>
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* Custom AI prompt */}
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-[11px] font-medium text-[var(--text-secondary)] flex items-center gap-1">
                                        <FileText className="w-3 h-3" />
                                        {t('email_kb.custom_prompt')}
                                    </label>
                                    {settings.ai_system_prompt && (
                                        <button onClick={() => setSettings(s => ({ ...s, ai_system_prompt: '' }))}
                                            className="flex items-center gap-1 text-[10px] text-[var(--text-tertiary)] hover:text-[var(--accent-primary)] transition-colors">
                                            <RotateCcw className="w-3 h-3" />
                                            {t('email_kb.reset_prompt')}
                                        </button>
                                    )}
                                </div>
                                <p className="text-[10px] text-[var(--text-tertiary)] mb-1.5">{t('email_kb.custom_prompt_desc')}</p>
                                <textarea
                                    value={settings.ai_system_prompt}
                                    onChange={e => setSettings(s => ({ ...s, ai_system_prompt: e.target.value }))}
                                    placeholder={t('email_kb.custom_prompt_placeholder')}
                                    rows={4}
                                    className="w-full px-3 py-2 rounded-lg text-[12px] bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)] resize-y font-mono"
                                />
                            </div>

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
const AddConnectionModal = ({ onClose, onAdd, knowledgeBases, oauthProvider, t }) => {
    const [provider, setProvider] = useState(oauthProvider === 'microsoft' ? 'outlook' : oauthProvider === 'google' ? 'gmail' : '');
    const [kbId, setKbId] = useState(knowledgeBases?.[0]?.id || '');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const canConnectGmail = oauthProvider === 'google';
    const canConnectOutlook = oauthProvider === 'microsoft';

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
                    <select value={kbId} onChange={e => setKbId(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg text-[13px] bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)]">
                        {(knowledgeBases || []).map(kb => (
                            <option key={kb.id} value={kb.id}>{kb.name}</option>
                        ))}
                    </select>
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
                    <button onClick={handleSubmit} disabled={!provider || !kbId || loading}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium bg-[var(--accent-primary)] text-white hover:opacity-90 disabled:opacity-50 transition-all">
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
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

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [connData, kbRes] = await Promise.all([
                api('/connections'),
                fetch(`${API_BASE}/api/kb`, { credentials: 'include' }).then(r => r.json()),
            ]);
            setConnections(connData.connections || []);
            setKnowledgeBases(kbRes.knowledgeBases || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    // Auto-refresh every 30s to pick up sync state changes
    useEffect(() => {
        const interval = setInterval(loadData, 30000);
        return () => clearInterval(interval);
    }, [loadData]);

    const handleAdd = async (params) => {
        await api('/connections', { method: 'POST', body: JSON.stringify(params) });
        await loadData();
    };

    const handleSync = async (id) => {
        await api(`/connections/${id}/sync`, { method: 'POST' });
        setTimeout(loadData, 3000);
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
