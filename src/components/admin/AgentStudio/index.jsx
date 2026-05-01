import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Sparkles, Trash2 } from 'lucide-react';
import { API_BASE, authFetch } from '../../../utils/helpers';
import useTranslation from '../../../hooks/useTranslation';
import AgentWizard from '../AgentWizard';
import BuilderSplit from '../AgentWizard/BuilderSplit';

// Unified agent editor: agent list (left) + wizard-style split (right).
// Replaces the legacy AgentDesigner as the primary entry point. The legacy
// form is still reachable via "Advanced settings" for fields that aren't yet
// surfaced by the studio (guardrails, embedding, bubble widget, sharing).
export default function AgentStudio({ user, initialAgentId = null, onClose, onNavigate, hasPermission = () => true, systemMode = false }) {
    const { t } = useTranslation();

    const [agents, setAgents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedAgent, setSelectedAgent] = useState(null);
    // mode: 'idle' (no agent + show wizard landing), 'wizard' (creating with AI),
    //       'edit' (editing selected agent in BuilderSplit)
    const [mode, setMode] = useState('idle');

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

    // Auto-select agent passed in via URL once agents have loaded.
    useEffect(() => {
        if (!initialAgentId || agents.length === 0) return;
        const found = agents.find(a => a.id === initialAgentId);
        if (found) { setSelectedAgent(found); setMode('edit'); }
    }, [initialAgentId, agents]);

    const startWizard = () => { setSelectedAgent(null); setMode('wizard'); };

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
                        enabledIntegrations: null,
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

    const deleteAgent = async (a) => {
        if (!a?.id) return;
        if (!window.confirm(t('agent_studio.delete_confirm', { name: a.name }))) return;
        try {
            const res = await authFetch(`${API_BASE}/agents/${a.id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error(await res.text());
            if (selectedAgent?.id === a.id) { setSelectedAgent(null); setMode('idle'); }
            await fetchAgents();
        } catch (err) { alert(err.message); }
    };

    return (
        <div className="flex h-full bg-[var(--bg-primary)]">
            {/* Agent list sidebar */}
            <aside className="w-64 flex-shrink-0 border-r border-[var(--border-default)] flex flex-col">
                <div className="px-4 py-3 border-b border-[var(--border-default)] flex items-center justify-between">
                    <span className="text-sm font-semibold text-[var(--text-primary)]">{systemMode ? t('agent_studio.title_system') : t('agent_studio.title')}</span>
                    {!systemMode && hasPermission('manage_agents') && (
                        <div className="flex items-center gap-1">
                            <button
                                onClick={startWizard}
                                title={t('agent_studio.create_with_ai')}
                                className="px-2 py-1 rounded-lg hover:bg-[var(--bg-secondary)] flex items-center gap-1 text-[11px] text-[var(--text-tertiary)]"
                            >
                                <Sparkles size={14} /> AI
                            </button>
                            <button
                                onClick={createEmpty}
                                title={t('agent_studio.create_empty')}
                                className="p-1 rounded-lg hover:bg-[var(--bg-secondary)] text-[var(--text-tertiary)]"
                            >
                                <Plus size={16} />
                            </button>
                        </div>
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
                                        onClick={(e) => { e.stopPropagation(); deleteAgent(a); }}
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

            {/* Content */}
            <section className="flex-1 min-w-0 flex flex-col">
                {mode === 'idle' && (
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
                {mode === 'wizard' && (
                    <AgentWizard
                        user={user}
                        onClose={() => setMode('idle')}
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
        </div>
    );
}
