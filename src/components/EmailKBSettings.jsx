import React, { useState, useEffect, useCallback } from 'react';
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
                </div>
            )}
        </div>
    );
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
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ── Main EmailKBSettings component ───────────────────────────────── */
export default function EmailKBSettings({ user, onNavigateBack }) {
    const { t } = useTranslation();
    const [connections, setConnections] = useState([]);
    const [knowledgeBases, setKnowledgeBases] = useState([]);
    const [loading, setLoading] = useState(true);
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
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

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
            )}

            <style>{`
                @keyframes emailKBModalIn {
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
