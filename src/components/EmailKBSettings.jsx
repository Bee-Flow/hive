import React, { useState, useEffect, useCallback } from 'react';
import { Mail, Plus, ArrowLeft, Loader2, AlertTriangle } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import { API_BASE } from '../utils/helpers';
import { api } from './email-kb/utils';
import MailboxList from './email-kb/MailboxList';
import DetailPane from './email-kb/DetailPane';
import ConnectMailboxModal from './email-kb/ConnectMailboxModal';

const SELECTED_KEY = 'emailKB:selectedConnectionId';

const EmailKBSettings = ({ user, onNavigateBack }) => {
    const { t } = useTranslation();
    const [connections, setConnections] = useState([]);
    const [knowledgeBases, setKnowledgeBases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [error, setError] = useState('');
    const [editingConnection, setEditingConnection] = useState(null);
    const [selectedId, setSelectedId] = useState(() => {
        try { return localStorage.getItem(SELECTED_KEY) || null; } catch { return null; }
    });

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

    // Auto-refresh every 30s — skip while user is editing.
    useEffect(() => {
        const interval = setInterval(() => {
            if (!editingConnection) loadData(true);
        }, 30000);
        return () => clearInterval(interval);
    }, [loadData, editingConnection]);

    // Default-select first connection after load
    useEffect(() => {
        if (connections.length === 0) { setSelectedId(null); return; }
        const existing = selectedId && connections.some(c => c.id === selectedId);
        if (!existing) setSelectedId(connections[0].id);
    }, [connections, selectedId]);

    // Persist selection
    useEffect(() => {
        try {
            if (selectedId) localStorage.setItem(SELECTED_KEY, selectedId);
            else localStorage.removeItem(SELECTED_KEY);
        } catch { /* noop */ }
    }, [selectedId]);

    const handleAdd = async (params) => {
        const res = await api('/connections', { method: 'POST', body: JSON.stringify(params) });
        if (res?.id) setSelectedId(res.id);
        await loadData();
    };

    const handleSync = async (_id, opts = {}) => {
        if (opts.sseFinished || opts.sseError) await loadData(true);
    };

    const handleUpdate = async (id, updates) => {
        await api(`/connections/${id}`, { method: 'PATCH', body: JSON.stringify(updates) });
        await loadData();
    };

    const handleDelete = async (id) => {
        await api(`/connections/${id}`, { method: 'DELETE' });
        if (selectedId === id) setSelectedId(null);
        await loadData();
    };

    const oauthProvider = user?.oauthProvider || user?.provider || '';
    const selectedConn = connections.find(c => c.id === selectedId) || null;

    return (
        <div className="flex flex-col h-full bg-[var(--bg-primary)]">
            {/* Header */}
            <div className="flex-shrink-0 px-6 py-4 border-b border-[var(--border-subtle)]">
                <div className="flex items-center gap-3">
                    {onNavigateBack && (
                        <button onClick={onNavigateBack}
                            className="p-1.5 rounded-lg hover:bg-[var(--bg-secondary)] text-[var(--text-tertiary)] transition-colors">
                            <ArrowLeft className="w-4 h-4" />
                        </button>
                    )}
                    <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                            <Mail className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <h1 className="text-[17px] font-bold text-[var(--text-primary)] leading-tight">{t('email_kb.title')}</h1>
                            <p className="text-[12px] text-[var(--text-tertiary)] leading-tight">{t('email_kb.subtitle')}</p>
                        </div>
                    </div>
                    <div className="flex-1" />
                    <button onClick={() => setShowAddModal(true)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-semibold bg-[var(--accent-primary)] text-white hover:opacity-90 shadow-sm transition-all">
                        <Plus className="w-4 h-4" />
                        {t('email_kb.connect_mailbox')}
                    </button>
                </div>
            </div>

            {/* Body */}
            <div className="flex-1 min-h-0 flex">
                {loading ? (
                    <div className="flex-1 flex items-center justify-center">
                        <Loader2 className="w-6 h-6 animate-spin text-[var(--accent-primary)]" />
                    </div>
                ) : error ? (
                    <div className="flex-1 p-6">
                        <div className="flex items-center gap-2 p-4 rounded-xl bg-red-50 border border-red-200 text-[13px] text-red-700 max-w-lg">
                            <AlertTriangle className="w-5 h-5" /> {error}
                        </div>
                    </div>
                ) : connections.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 flex items-center justify-center mb-4">
                            <Mail className="w-8 h-8 text-blue-500/60" />
                        </div>
                        <h3 className="text-[16px] font-semibold text-[var(--text-primary)] mb-1">{t('email_kb.no_connections')}</h3>
                        <p className="text-[13px] text-[var(--text-tertiary)] max-w-sm mb-4">{t('email_kb.no_connections_desc')}</p>
                        <button onClick={() => setShowAddModal(true)}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold bg-[var(--accent-primary)] text-white hover:opacity-90 shadow-lg transition-all">
                            <Plus className="w-4 h-4" />
                            {t('email_kb.connect_mailbox')}
                        </button>
                    </div>
                ) : (
                    <>
                        <MailboxList
                            connections={connections}
                            selectedId={selectedId}
                            onSelect={setSelectedId}
                            onAdd={() => setShowAddModal(true)}
                            t={t}
                        />
                        {selectedConn ? (
                            <DetailPane
                                key={selectedConn.id}
                                conn={selectedConn}
                                knowledgeBases={knowledgeBases}
                                onSync={handleSync}
                                onUpdate={handleUpdate}
                                onDelete={handleDelete}
                                onEditingChange={(isEditing) => setEditingConnection(isEditing ? selectedConn.id : null)}
                                t={t}
                            />
                        ) : (
                            <div className="flex-1 flex items-center justify-center text-[13px] text-[var(--text-tertiary)]">
                                {t('email_kb.no_mailbox_selected')}
                            </div>
                        )}
                    </>
                )}
            </div>

            {showAddModal && (
                <ConnectMailboxModal
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
