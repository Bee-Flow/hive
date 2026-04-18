import React, { useState } from 'react';
import { Plus, Loader2, XCircle, Info } from 'lucide-react';
import { API_BASE } from '../../utils/helpers';
import ProviderIcon from './ProviderIcon';

const ConnectMailboxModal = ({ onClose, onAdd, knowledgeBases, onKBCreated, oauthProvider, t }) => {
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
        setLoading(true); setError('');
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
            onKBCreated?.(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async () => {
        if (!provider || !kbId) return;
        setLoading(true); setError('');
        try {
            await onAdd({ provider, knowledgeBaseId: kbId });
            onClose();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const providerTile = (key, label, canConnect, loginHint) => (
        <button
            onClick={() => canConnect && setProvider(key)}
            disabled={!canConnect}
            className={`flex flex-col items-center gap-2.5 p-5 rounded-xl border-2 transition-all ${
                provider === key
                    ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/5 shadow-md'
                    : canConnect
                        ? 'border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/50 hover:bg-[var(--bg-secondary)]'
                        : 'border-[var(--border-subtle)] opacity-40 cursor-not-allowed'
            }`}
        >
            <ProviderIcon provider={key} size={36} />
            <span className="text-[13px] font-semibold text-[var(--text-primary)]">{label}</span>
            {!canConnect && <span className="text-[10px] text-[var(--text-tertiary)] text-center">{loginHint}</span>}
        </button>
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
            <div className="w-full max-w-lg bg-[var(--bg-primary)] rounded-2xl border border-[var(--border-subtle)] shadow-2xl p-6 space-y-5"
                onClick={e => e.stopPropagation()}
                style={{ animation: 'emailKBModalIn .2s ease-out' }}>
                <div>
                    <h3 className="text-[17px] font-bold text-[var(--text-primary)]">{t('email_kb.connect_modal_title')}</h3>
                    <p className="text-[12px] text-[var(--text-tertiary)] mt-1">{t('email_kb.connect_modal_helper')}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    {providerTile('gmail',   t('email_kb.connect_gmail'),   canConnectGmail,   t('email_kb.login_required_google'))}
                    {providerTile('outlook', t('email_kb.connect_outlook'), canConnectOutlook, t('email_kb.login_required_microsoft'))}
                </div>

                <div>
                    <label className="text-[12px] font-medium text-[var(--text-secondary)] mb-1 block">{t('email_kb.target_kb')}</label>
                    <p className="text-[11px] text-[var(--text-tertiary)] mb-2">{t('email_kb.target_kb_desc')}</p>
                    {creatingKB ? (
                        <div className="flex gap-2">
                            <input
                                value={newKBName}
                                onChange={e => setNewKBName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleCreateKB()}
                                placeholder="Knowledge base name…"
                                autoFocus
                                className="flex-1 px-3 py-2 rounded-lg text-[13px] bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
                            />
                            <button onClick={handleCreateKB} disabled={!newKBName.trim() || loading}
                                className="px-3 py-2 rounded-lg text-[12px] font-medium bg-[var(--accent-primary)] text-white hover:opacity-90 disabled:opacity-50">
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create'}
                            </button>
                            <button onClick={() => { setCreatingKB(false); setNewKBName(''); }}
                                className="px-2 py-2 rounded-lg text-[12px] text-[var(--text-tertiary)] hover:bg-[var(--bg-secondary)]">
                                {t('email_kb.cancel')}
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

                <div className="flex items-start gap-2 p-3 rounded-lg bg-[var(--bg-secondary)] text-[11px] text-[var(--text-tertiary)]">
                    <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <span>{t('email_kb.connect_modal_helper')}</span>
                </div>

                {error && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-[12px] text-red-700">
                        <XCircle className="w-4 h-4 flex-shrink-0" /> {error}
                    </div>
                )}

                <div className="flex justify-end gap-2 pt-1">
                    <button onClick={onClose}
                        className="px-4 py-2 rounded-lg text-[13px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition-all">
                        {t('email_kb.cancel')}
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

export default ConnectMailboxModal;
