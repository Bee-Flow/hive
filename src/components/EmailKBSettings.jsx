import React, { useState, useEffect, useCallback } from 'react';
<<<<<<< test2
import { Mail, Plus, X, Trash2, Play, Settings, Clock, RefreshCw, AlertTriangle, CheckCircle, ChevronDown, ChevronUp, ArrowLeft } from 'lucide-react';
import { API_BASE, authFetch } from '../utils/helpers';
import useTranslation from '../hooks/useTranslation';

const EMAIL_KB_API = `${API_BASE}/api/email-kb`;
const KB_API = `${API_BASE}/api/kb`;

/* ── Status badge ─────────────────────────────────────────────────── */
function StatusBadge({ status, t }) {
    const cfg = {
        idle:    { bg: 'rgba(34,197,94,.1)',  color: '#22c55e', icon: <CheckCircle size={12} />, label: t('email_kb.status_idle') },
        syncing: { bg: 'rgba(59,130,246,.1)', color: '#3b82f6', icon: <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} />, label: t('email_kb.status_syncing') },
        error:   { bg: 'rgba(239,68,68,.1)',  color: '#ef4444', icon: <AlertTriangle size={12} />, label: t('email_kb.status_error') },
    }[status] || { bg: 'var(--bg-tertiary)', color: 'var(--text-tertiary)', icon: null, label: status };

    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: cfg.bg, color: cfg.color }}>
            {cfg.icon} {cfg.label}
        </span>
    );
}

/* ── Connection card ──────────────────────────────────────────────── */
function ConnectionCard({ conn, t, onSync, onDelete, onToggle, onShowSettings, onShowHistory }) {
    const [confirmDelete, setConfirmDelete] = useState(false);
    const providerIcon = conn.provider === 'gmail' ? '📧' : '📬';
    const providerLabel = conn.provider === 'gmail' ? t('email_kb.provider_gmail') : t('email_kb.provider_outlook');

    return (
        <div style={{
            borderRadius: 16, border: '1.5px solid var(--border-subtle)', background: 'var(--bg-primary)',
            transition: 'all .2s ease', overflow: 'hidden',
        }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px' }}>
                <div style={{
                    width: 42, height: 42, borderRadius: 12,
                    background: conn.provider === 'gmail' ? 'rgba(234,67,53,.08)' : 'rgba(0,120,212,.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0,
                }}>
                    {providerIcon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{conn.email_address}</span>
                        <StatusBadge status={conn.sync_status || 'idle'} t={t} />
                    </div>
                    <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                        {providerLabel} · {conn.last_sync_at ? `${t('email_kb.last_sync')}: ${new Date(conn.last_sync_at).toLocaleString()}` : t('email_kb.never_synced')}
                    </p>
                </div>
                {/* Enable/Disable toggle */}
                <button onClick={() => onToggle(conn.id, !conn.enabled)} title={conn.enabled ? t('email_kb.pause') : t('email_kb.resume')}
                    style={{
                        height: 28, padding: '0 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                        background: conn.enabled ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                        color: conn.enabled ? '#fff' : 'var(--text-secondary)',
                        fontSize: 11, fontWeight: 600, transition: 'all .15s',
                    }}>
                    {conn.enabled ? t('email_kb.pause') : t('email_kb.resume')}
                </button>
            </div>

            {/* Stats row */}
            <div style={{ display: 'flex', gap: 16, padding: '0 16px 10px', fontSize: 12, color: 'var(--text-secondary)' }}>
                <span>📊 {conn.total_emails_processed || 0} {t('email_kb.emails_processed')}</span>
                <span>📝 {conn.total_articles_created || 0} {t('email_kb.articles_created')}</span>
            </div>

            {/* Error message */}
            {conn.sync_error && (
                <div style={{ margin: '0 16px 10px', padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', fontSize: 12, color: '#ef4444' }}>
                    {conn.sync_error}
                </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 6, padding: '8px 16px 14px', borderTop: '1px solid var(--border-subtle)' }}>
                <ActionBtn icon={<Play size={13} />} label={t('email_kb.sync_now')} onClick={() => onSync(conn.id)} disabled={conn.sync_status === 'syncing' || !conn.enabled} />
                <ActionBtn icon={<Settings size={13} />} label={t('email_kb.settings')} onClick={() => onShowSettings(conn)} />
                <ActionBtn icon={<Clock size={13} />} label={t('email_kb.sync_history')} onClick={() => onShowHistory(conn.id)} />
                {confirmDelete ? (
                    <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
                        <button onClick={() => onDelete(conn.id)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, background: '#ef4444', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}>{t('email_kb.delete_connection')}</button>
                        <button onClick={() => setConfirmDelete(false)} style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: 'none', cursor: 'pointer' }}>{t('email_kb.cancel')}</button>
                    </div>
                ) : (
                    <ActionBtn icon={<Trash2 size={13} />} label={t('email_kb.delete_connection')} onClick={() => setConfirmDelete(true)} style={{ marginLeft: 'auto' }} danger />
                )}
            </div>
        </div>
    );
}

function ActionBtn({ icon, label, onClick, disabled, danger, style }) {
    return (
        <button onClick={onClick} disabled={disabled} style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8,
            border: '1px solid var(--border-subtle)', background: 'transparent', cursor: disabled ? 'not-allowed' : 'pointer',
            color: danger ? '#ef4444' : 'var(--text-secondary)', fontSize: 12, fontWeight: 500,
            opacity: disabled ? 0.5 : 1, transition: 'all .15s', ...style,
        }}>
            {icon} {label}
        </button>
    );
}

/* ── Settings sub-panel ───────────────────────────────────────────── */
function SettingsPanel({ conn, knowledgeBases, t, onSave, onClose }) {
    const [form, setForm] = useState({
        sync_interval_minutes: conn.sync_interval_minutes || 30,
        group_threads: !!conn.group_threads,
        process_attachments: !!conn.process_attachments,
        knowledge_base_id: conn.knowledge_base_id || '',
        sender_blacklist: (conn.sender_blacklist || []).join(', '),
    });
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        await onSave(conn.id, {
            ...form,
            sender_blacklist: form.sender_blacklist.split(',').map(s => s.trim()).filter(Boolean),
        });
        setSaving(false);
        onClose();
    };

    const field = (label, children) => (
        <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>{label}</label>
            {children}
        </div>
    );

    return (
        <div style={{ padding: '20px 28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <button onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 13 }}>
                    <ArrowLeft size={14} /> {t('email_kb.back')}
                </button>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{t('email_kb.settings')} — {conn.email_address}</h3>
            </div>

            {field(t('email_kb.sync_interval'),
                <select value={form.sync_interval_minutes} onChange={e => setForm(f => ({ ...f, sync_interval_minutes: +e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 10, border: '1.5px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13 }}>
                    {[15, 30, 60, 120].map(v => <option key={v} value={v}>{v} min</option>)}
                </select>
            )}

            {field(t('email_kb.target_kb'),
                <select value={form.knowledge_base_id} onChange={e => setForm(f => ({ ...f, knowledge_base_id: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 10, border: '1.5px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13 }}>
                    <option value="">{t('email_kb.select_kb')}</option>
                    {knowledgeBases.map(kb => <option key={kb.id} value={kb.id}>{kb.name}</option>)}
                </select>
            )}

            {field(t('email_kb.group_threads'),
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.group_threads} onChange={e => setForm(f => ({ ...f, group_threads: e.target.checked }))} />
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{t('email_kb.group_threads_desc')}</span>
                </label>
            )}

            {field(t('email_kb.process_attachments'),
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.process_attachments} onChange={e => setForm(f => ({ ...f, process_attachments: e.target.checked }))} />
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{t('email_kb.process_attachments')}</span>
                </label>
            )}

            {field(t('email_kb.sender_blacklist'),
                <>
                    <input value={form.sender_blacklist} onChange={e => setForm(f => ({ ...f, sender_blacklist: e.target.value }))}
                        placeholder="spam@example.com, noreply@..."
                        style={{ width: '100%', padding: '8px 12px', borderRadius: 10, border: '1.5px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' }} />
                    <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-tertiary)' }}>{t('email_kb.sender_blacklist_desc')}</p>
                </>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
                <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 10, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13 }}>{t('email_kb.cancel')}</button>
                <button onClick={handleSave} disabled={saving} style={{
                    padding: '8px 22px', borderRadius: 10, border: 'none', background: 'var(--accent-primary)', color: '#fff',
                    cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, opacity: saving ? 0.6 : 1,
                }}>{saving ? '...' : t('email_kb.save')}</button>
            </div>
        </div>
    );
}

/* ── History sub-panel ────────────────────────────────────────────── */
function HistoryPanel({ connectionId, t, onClose }) {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            setLoading(true);
            try {
                const res = await authFetch(`${EMAIL_KB_API}/connections/${connectionId}/logs`);
                if (res.ok) { const data = await res.json(); setLogs(data.logs || []); }
            } catch (_) {}
            setLoading(false);
        })();
    }, [connectionId]);

    return (
        <div style={{ padding: '20px 28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <button onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 13 }}>
                    <ArrowLeft size={14} /> {t('email_kb.back')}
                </button>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{t('email_kb.sync_history')}</h3>
            </div>

            {loading && <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>Loading...</div>}

            {!loading && logs.length === 0 && (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)', fontSize: 14 }}>{t('email_kb.no_history')}</div>
            )}

            {!loading && logs.length > 0 && (
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid var(--border-subtle)' }}>
                                {[t('email_kb.history_date'), t('email_kb.history_fetched'), t('email_kb.history_created'), t('email_kb.history_skipped'), t('email_kb.history_errors')].map(h => (
                                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {logs.map(log => (
                                <tr key={log.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                    <td style={{ padding: '8px 10px', color: 'var(--text-primary)' }}>{new Date(log.started_at).toLocaleString()}</td>
                                    <td style={{ padding: '8px 10px' }}>{log.emails_fetched}</td>
                                    <td style={{ padding: '8px 10px', color: '#22c55e', fontWeight: 600 }}>{log.articles_created}</td>
                                    <td style={{ padding: '8px 10px', color: 'var(--text-tertiary)' }}>{log.articles_skipped}</td>
                                    <td style={{ padding: '8px 10px', color: log.errors > 0 ? '#ef4444' : 'var(--text-tertiary)', fontWeight: log.errors > 0 ? 600 : 400 }}>{log.errors}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
=======
import { useTranslation } from '../hooks/useTranslation';
import { API_BASE } from '../utils/helpers';
import {
    Mail, Plus, RefreshCw, Settings, Trash2, ChevronDown, ChevronRight,
    CheckCircle2, XCircle, Clock, AlertTriangle, Loader2, TestTube2,
    Pause, Play, ArrowLeft
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
        sync_interval_minutes: conn.sync_interval_minutes,
        group_threads: conn.group_threads,
        process_attachments: conn.process_attachments,
        enabled: conn.enabled,
        folder_filter: conn.folder_filter || ['INBOX'],
        sender_blacklist: conn.sender_blacklist || [],
    });
    const [senderInput, setSenderInput] = useState('');

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
                                    value={conn.knowledge_base_id}
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
                                                <th className="text-center px-2 py-1.5 font-medium">{t('email_kb.fetched')}</th>
                                                <th className="text-center px-2 py-1.5 font-medium">{t('email_kb.created')}</th>
                                                <th className="text-center px-2 py-1.5 font-medium">{t('email_kb.skipped')}</th>
                                                <th className="text-center px-2 py-1.5 font-medium">{t('email_kb.errors')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {logs.map(log => (
                                                <tr key={log.id} className="border-t border-[var(--border-subtle)] hover:bg-[var(--bg-secondary)]">
                                                    <td className="px-2 py-1.5 text-[var(--text-secondary)]">
                                                        {new Date(log.started_at).toLocaleString()}
                                                    </td>
                                                    <td className="text-center px-2 py-1.5 text-[var(--text-primary)] font-medium">{log.emails_fetched}</td>
                                                    <td className="text-center px-2 py-1.5 text-emerald-600 font-medium">{log.articles_created}</td>
                                                    <td className="text-center px-2 py-1.5 text-amber-600 font-medium">{log.articles_skipped}</td>
                                                    <td className="text-center px-2 py-1.5 text-red-500 font-medium">{log.errors}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
>>>>>>> main
                </div>
            )}
        </div>
    );
<<<<<<< test2
}

/* ── Add Connection Modal ─────────────────────────────────────────── */
function AddConnectionModal({ knowledgeBases, t, onAdd, onCancel }) {
    const [provider, setProvider] = useState('');
    const [kbId, setKbId] = useState('');
    const [adding, setAdding] = useState(false);

    const handleAdd = async () => {
        if (!provider || !kbId) return;
        setAdding(true);
        await onAdd(provider, kbId);
        setAdding(false);
    };

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
            onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
            <div style={{
                background: 'var(--bg-secondary)', borderRadius: 20, border: '1px solid var(--border-subtle)',
                boxShadow: '0 32px 80px rgba(0,0,0,.25)', width: '100%', maxWidth: 440, padding: 28,
                animation: 'emailKBModalIn .18s cubic-bezier(.21,1.02,.73,1) both',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{t('email_kb.connect_mailbox')}</h3>
                    <button onClick={onCancel} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'var(--bg-tertiary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                        <X size={16} />
                    </button>
                </div>

                <div style={{ marginBottom: 20 }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>{t('email_kb.select_provider')}</label>
                    <div style={{ display: 'flex', gap: 10 }}>
                        {[{ id: 'gmail', label: t('email_kb.provider_gmail'), icon: '📧', color: 'rgba(234,67,53,.1)', border: 'rgba(234,67,53,.4)' },
                          { id: 'outlook', label: t('email_kb.provider_outlook'), icon: '📬', color: 'rgba(0,120,212,.1)', border: 'rgba(0,120,212,.4)' }].map(p => (
                            <button key={p.id} onClick={() => setProvider(p.id)} style={{
                                flex: 1, padding: '14px 16px', borderRadius: 12,
                                border: `2px solid ${provider === p.id ? p.border : 'var(--border-subtle)'}`,
                                background: provider === p.id ? p.color : 'transparent',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, transition: 'all .15s',
                            }}>
                                <span style={{ fontSize: 24 }}>{p.icon}</span>
                                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{p.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div style={{ marginBottom: 24 }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>{t('email_kb.target_kb')}</label>
                    <select value={kbId} onChange={e => setKbId(e.target.value)} style={{
                        width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--border-subtle)',
                        background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: 13,
                    }}>
                        <option value="">{t('email_kb.select_kb')}</option>
                        {knowledgeBases.map(kb => <option key={kb.id} value={kb.id}>{kb.name}</option>)}
                    </select>
                </div>

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button onClick={onCancel} style={{ padding: '8px 18px', borderRadius: 10, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13 }}>{t('email_kb.cancel')}</button>
                    <button onClick={handleAdd} disabled={!provider || !kbId || adding} style={{
                        padding: '8px 22px', borderRadius: 10, border: 'none', background: 'var(--accent-primary)', color: '#fff',
                        cursor: !provider || !kbId || adding ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600,
                        opacity: !provider || !kbId || adding ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                        <Plus size={14} /> {adding ? '...' : t('email_kb.connect_mailbox')}
=======
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
>>>>>>> main
                    </button>
                </div>
            </div>
        </div>
    );
<<<<<<< test2
}

/* ── Main EmailKBSettings component ───────────────────────────────── */
export default function EmailKBSettings({ user, onNavigateBack }) {
=======
};

/* ─── Main Page ─── */
const EmailKBSettings = ({ user, onNavigateBack }) => {
>>>>>>> main
    const { t } = useTranslation();
    const [connections, setConnections] = useState([]);
    const [knowledgeBases, setKnowledgeBases] = useState([]);
    const [loading, setLoading] = useState(true);
<<<<<<< test2
    const [error, setError] = useState(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [settingsConn, setSettingsConn] = useState(null);
    const [historyConnId, setHistoryConnId] = useState(null);

    const loadConnections = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await authFetch(`${EMAIL_KB_API}/connections`);
            if (!res.ok) throw new Error('Failed to load connections');
            const data = await res.json();
            setConnections(data.connections || []);
=======
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
>>>>>>> main
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

<<<<<<< test2
    const loadKBs = useCallback(async () => {
        try {
            const res = await authFetch(`${KB_API}/list`);
            if (res.ok) {
                const data = await res.json();
                setKnowledgeBases(data.knowledgeBases || data || []);
            }
        } catch (_) {}
    }, []);

    useEffect(() => { loadConnections(); loadKBs(); }, [loadConnections, loadKBs]);

    // Auto-refresh every 30s
    useEffect(() => {
        const interval = setInterval(loadConnections, 30000);
        return () => clearInterval(interval);
    }, [loadConnections]);

    const handleAdd = async (provider, kbId) => {
        try {
            const res = await authFetch(`${EMAIL_KB_API}/connections`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ provider, knowledgeBaseId: kbId }),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to create connection');
            }
            setShowAddModal(false);
            await loadConnections();
        } catch (err) {
            alert(err.message);
        }
    };

    const handleSync = async (id) => {
        try {
            await authFetch(`${EMAIL_KB_API}/connections/${id}/sync`, { method: 'POST' });
            setTimeout(loadConnections, 1000);
        } catch (_) {}
    };

    const handleDelete = async (id) => {
        try {
            await authFetch(`${EMAIL_KB_API}/connections/${id}`, { method: 'DELETE' });
            await loadConnections();
        } catch (_) {}
    };

    const handleToggle = async (id, enabled) => {
        try {
            await authFetch(`${EMAIL_KB_API}/connections/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled }),
            });
            await loadConnections();
        } catch (_) {}
    };

    const handleSaveSettings = async (id, updates) => {
        try {
            await authFetch(`${EMAIL_KB_API}/connections/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            });
            await loadConnections();
        } catch (_) {}
    };

    // Sub-panels
    if (settingsConn) return <SettingsPanel conn={settingsConn} knowledgeBases={knowledgeBases} t={t} onSave={handleSaveSettings} onClose={() => setSettingsConn(null)} />;
    if (historyConnId) return <HistoryPanel connectionId={historyConnId} t={t} onClose={() => setHistoryConnId(null)} />;

    return (
        <>
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', overflow: 'hidden' }}>
                {/* Header */}
                <div style={{ padding: '20px 28px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                            {onNavigateBack && (
                                <button onClick={onNavigateBack} style={{ width: 34, height: 34, borderRadius: 10, border: '1px solid var(--border-subtle)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', marginRight: 4 }}>
                                    <ArrowLeft size={16} />
                                </button>
                            )}
                            <div style={{
                                width: 40, height: 40, borderRadius: 12,
                                background: 'linear-gradient(135deg, rgba(59,130,246,.3) 0%, rgba(99,102,241,.15) 100%)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                border: '1.5px solid rgba(59,130,246,.25)',
                            }}>
                                <Mail size={20} color="#3b82f6" />
                            </div>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{t('email_kb.title')}</h2>
                                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.04em', padding: '2px 7px', borderRadius: 6, background: 'rgba(168,85,247,.12)', color: '#a855f7', textTransform: 'uppercase' }}>beta</span>
                                </div>
                                <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>{t('email_kb.subtitle')}</p>
                            </div>
                        </div>
                        <button onClick={() => setShowAddModal(true)} style={{
                            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 11,
                            border: 'none', background: 'var(--accent-primary)', color: '#fff',
                            fontSize: 13, fontWeight: 600, cursor: 'pointer',
                            boxShadow: '0 2px 8px rgba(245,158,11,.3)', transition: 'opacity .15s',
                        }}
                            onMouseEnter={e => e.currentTarget.style.opacity = '.88'}
                            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                        >
                            <Plus size={15} /> {t('email_kb.connect_mailbox')}
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflow: 'auto', padding: '16px 28px 28px' }}>
                    {loading && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120 }}>
                            <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2.5px solid var(--border-subtle)', borderTopColor: 'var(--accent-primary)', animation: 'spin 0.7s linear infinite' }} />
                        </div>
                    )}

                    {!loading && error && (
                        <div style={{ padding: '20px 0', textAlign: 'center', color: '#ef4444', fontSize: 14 }}>
                            {error} — <button onClick={loadConnections} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: 14, textDecoration: 'underline' }}>retry</button>
                        </div>
                    )}

                    {!loading && !error && connections.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '48px 0' }}>
                            <div style={{ fontSize: 48, marginBottom: 12 }}>📧</div>
                            <h3 style={{ margin: '0 0 8px', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>{t('email_kb.no_connections')}</h3>
                            <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 400, marginInline: 'auto' }}>{t('email_kb.no_connections_desc')}</p>
                            <button onClick={() => setShowAddModal(true)} style={{
                                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 20px', borderRadius: 11,
                                border: 'none', background: 'var(--accent-primary)', color: '#fff',
                                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                            }}>
                                <Plus size={14} /> {t('email_kb.connect_mailbox')}
                            </button>
                        </div>
                    )}

                    {!loading && !error && connections.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {connections.map(conn => (
                                <ConnectionCard key={conn.id} conn={conn} t={t}
                                    onSync={handleSync} onDelete={handleDelete} onToggle={handleToggle}
                                    onShowSettings={setSettingsConn} onShowHistory={setHistoryConnId}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {showAddModal && (
                <AddConnectionModal knowledgeBases={knowledgeBases} t={t} onAdd={handleAdd} onCancel={() => setShowAddModal(false)} />
=======
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

    const oauthProvider = user?.oauthProvider || '';

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
>>>>>>> main
            )}

            <style>{`
                @keyframes emailKBModalIn {
<<<<<<< test2
                    from { opacity: 0; transform: scale(.96) translateY(8px); }
                    to   { opacity: 1; transform: scale(1) translateY(0); }
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </>
    );
}
=======
                    from { opacity: 0; transform: translateY(8px) scale(0.97); }
                    to   { opacity: 1; transform: translateY(0) scale(1); }
                }
            `}</style>
        </div>
    );
};

export default EmailKBSettings;
>>>>>>> main
