import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { API_BASE, authFetch } from '../../../utils/helpers';
import useTranslation from '../../../hooks/useTranslation';
import AgentWizard from '../AgentWizard';
import BuilderSplit from '../AgentWizard/BuilderSplit';

// Unified agent editor: agent list (left) + wizard-style split (right).
// Replaces the legacy AgentDesigner as the primary entry point. The legacy
// form is still reachable via "Advanced settings" for fields that aren't yet
// surfaced by the studio (guardrails, embedding, bubble widget, sharing).
export default function AgentStudio({ user, initialAgentId = null, onClose, onNavigate, hasPermission = () => true, systemMode = false, onEditingChange }) {
    const { t } = useTranslation();

    const [agents, setAgents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedAgent, setSelectedAgent] = useState(null);
    // mode: 'idle' (no agent + show wizard landing), 'wizard' (creating with AI),
    //       'edit' (editing selected agent in BuilderSplit)
    const [mode, setMode] = useState('idle');
    const [pendingDelete, setPendingDelete] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState(null);

    const fetchAgents = useCallback(async () => {
        setLoading(true);
        try {
            const endpoint = systemMode ? `${API_BASE}/agents/system` : `${API_BASE}/agents/all`;
            const res = await authFetch(endpoint);
            if (res.ok) setAgents(await res.json());
        } catch (e) { console.error('Failed to load agents', e); }
        finally { setLoading(false); }
    }, [systemMode]);

    useEffect(() => { fetchAgents(); }, [fetchAgents]);

    const isEditing = mode === 'edit' && !!selectedAgent;
    useEffect(() => {
        onEditingChange?.(isEditing);
        return () => { onEditingChange?.(false); };
    }, [isEditing, onEditingChange]);

    // Auto-select agent passed in via URL once agents have loaded.
    useEffect(() => {
        if (!initialAgentId || agents.length === 0) return;
        const found = agents.find(a => a.id === initialAgentId);
        if (found) { setSelectedAgent(found); setMode('edit'); }
    }, [initialAgentId, agents]);

    const createEmpty = async () => {
        try {
            const res = await authFetch(`${API_BASE}/agents`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: t('agent_studio.untitled'),
                    description: '',
                    systemPrompt: '',
                    config: {
                        avatar: '🤖',
                        enabledIntegrations: [],
                        knowledge_base_ids: [],
                        attachedSkillIds: [],
                        memoryEnabled: false,
                    },
                }),
            });
            if (!res.ok) throw new Error(await res.text());
            const agent = await res.json();
            await fetchAgents();
            setSelectedAgent(agent);
            setMode('edit');
        } catch (err) {
            console.error('Create empty agent failed', err);
            alert(err.message);
        }
    };

    const selectAgent = (a) => { setSelectedAgent(a); setMode('edit'); };

    // Open the in-app confirmation modal. The actual delete happens in confirmDelete().
    const requestDelete = (a) => {
        if (!a?.id) return;
        setDeleteError(null);
        setPendingDelete(a);
    };

    const confirmDelete = async () => {
        const a = pendingDelete;
        if (!a?.id || deleting) return;
        setDeleting(true);
        setDeleteError(null);
        try {
            const res = await authFetch(`${API_BASE}/agents/${a.id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error(await res.text());
            if (selectedAgent?.id === a.id) { setSelectedAgent(null); setMode('idle'); }
            await fetchAgents();
            setPendingDelete(null);
        } catch (err) {
            setDeleteError(err.message);
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="flex h-full bg-[var(--bg-primary)]">
            {/* Agent list sidebar — hidden in fullscreen edit mode */}
            {!isEditing && (
            <aside className="w-64 flex-shrink-0 border-r border-[var(--border-default)] flex flex-col">
                <div className="px-4 py-3 border-b border-[var(--border-default)] flex items-center justify-between">
                    <span className="text-sm font-semibold text-[var(--text-primary)]">{systemMode ? t('agent_studio.title_system') : t('agent_studio.title')}</span>
                    {!systemMode && hasPermission('manage_agents') && (
                        <button
                            onClick={createEmpty}
                            title={t('agent_studio.create_empty')}
                            className="p-1 rounded-lg hover:bg-[var(--bg-secondary)] text-[var(--text-tertiary)]"
                        >
                            <Plus size={16} />
                        </button>
                    )}
                </div>
                <div className="flex-1 overflow-y-auto p-1.5">
                    {loading && <div className="text-xs text-[var(--text-tertiary)] p-3">…</div>}
                    {!loading && agents.length === 0 && (
                        <div className="text-xs text-[var(--text-tertiary)] p-4 text-center">{t('agent_studio.empty')}</div>
                    )}
                    {agents.map((a) => {
                        const sel = selectedAgent?.id === a.id;
                        return (
                            <div
                                key={a.id}
                                onClick={() => selectAgent(a)}
                                className={`group flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer text-sm transition ${sel ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'}`}
                            >
                                <span className="text-base flex-shrink-0">{a.avatar || a.config?.avatar || '🤖'}</span>
                                <span className="truncate flex-1">{a.name}</span>
                                {!systemMode && hasPermission('manage_agents') && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); requestDelete(a); }}
                                        className="opacity-0 group-hover:opacity-100 text-[var(--text-tertiary)] hover:text-red-500"
                                        title={t('agent_studio.delete')}
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </aside>
            )}

            {/* Content */}
            <section className="flex-1 min-w-0 flex flex-col">
                {(mode === 'idle' || mode === 'wizard') && (
                    <AgentWizard
                        user={user}
                        onClose={onClose}
                        onSwitchToManual={createEmpty}
                        onPublished={async (newAgent) => {
                            await fetchAgents();
                            if (newAgent?.id) { setSelectedAgent(newAgent); setMode('edit'); }
                            else setMode('idle');
                        }}
                    />
                )}
                {mode === 'edit' && selectedAgent && (
                    <BuilderSplit
                        key={selectedAgent.id}
                        agent={selectedAgent}
                        user={user}
                        plan={null}
                        history={[]}
                        onBack={() => { setSelectedAgent(null); setMode('idle'); }}
                        onPublished={async (updated) => {
                            await fetchAgents();
                            if (updated) setSelectedAgent(updated);
                        }}
                    />
                )}
            </section>

            {pendingDelete && (
                <div
                    className="fixed inset-0 z-[1000] bg-black/50 flex items-center justify-center p-4"
                    onClick={() => !deleting && setPendingDelete(null)}
                >
                    <div
                        className="bg-[var(--bg-primary)] rounded-xl w-full max-w-md shadow-xl border border-[var(--border-default)]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-start justify-between px-5 py-4 border-b border-[var(--border-default)]">
                            <div className="text-sm font-semibold text-[var(--text-primary)]">{t('agent_studio.delete_title')}</div>
                            <button
                                onClick={() => !deleting && setPendingDelete(null)}
                                className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                                disabled={deleting}
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <div className="px-5 py-4 text-sm text-[var(--text-secondary)]">
                            {t('agent_studio.delete_confirm', { name: pendingDelete.name })}
                        </div>
                        {deleteError && (
                            <div className="px-5 pb-2 text-xs text-red-500">{deleteError}</div>
                        )}
                        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--border-default)]">
                            <button
                                onClick={() => setPendingDelete(null)}
                                disabled={deleting}
                                className="px-4 py-2 rounded-full text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] disabled:opacity-50"
                            >
                                {t('agent_studio.cancel')}
                            </button>
                            <button
                                onClick={confirmDelete}
                                disabled={deleting}
                                className="px-4 py-2 rounded-full text-sm bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
                            >
                                {deleting ? '…' : t('agent_studio.delete')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
