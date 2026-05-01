import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Plus, MessageCircle, Slack, Sparkles, Upload, Brain, AppWindow, ArrowLeft, X, Search } from 'lucide-react';
import { API_BASE, authFetch } from '../../../utils/helpers';
import useTranslation from '../../../hooks/useTranslation';
import { INTEGRATION_CATALOG } from '../AgentDesigner/integrations';
import KnowledgePanel from '../../KnowledgePanel';
import PlanCard from './PlanCard';

export default function BuilderSplit({ agent: initialAgent, plan, history, tier, locale, onBack, onPublished }) {
    const { t } = useTranslation();
    const channelOptions = [
        { id: 'chatgpt', label: t('agent_wizard.builder.channel_chatgpt_label'), sub: t('agent_wizard.builder.channel_chatgpt_sub'), icon: <MessageCircle size={18} /> },
        { id: 'slack', label: t('agent_wizard.builder.channel_slack_label'), sub: t('agent_wizard.builder.channel_slack_sub'), icon: <Slack size={18} /> },
    ];

    const [agent, setAgent] = useState(initialAgent);
    const [name, setName] = useState(initialAgent?.name || plan?.name || t('agent_wizard.builder.name_placeholder'));
    const [avatar, setAvatar] = useState(initialAgent?.config?.avatar || plan?.avatar || '🤖');
    const [instructions, setInstructions] = useState(initialAgent?.system_prompt || plan?.systemPrompt || '');
    const [channels, setChannels] = useState(initialAgent?.config?.wizard?.channels || plan?.channels || ['chatgpt']);

    // Canonical config fields (round-trip with AgentEditorUI)
    const [memoryEnabled, setMemoryEnabled] = useState(!!initialAgent?.config?.memoryEnabled);
    const [attachedSkillIds, setAttachedSkillIds] = useState(initialAgent?.config?.attachedSkillIds || []);
    const [enabledIntegrations, setEnabledIntegrations] = useState(
        initialAgent?.config?.enabledIntegrations === undefined ? null : initialAgent.config.enabledIntegrations
    );
    const [knowledgeBaseIds, setKnowledgeBaseIds] = useState(initialAgent?.config?.knowledge_base_ids || []);
    const [strictKnowledge, setStrictKnowledge] = useState(!!initialAgent?.config?.strictKnowledge);
    const [includeSourceReferences, setIncludeSourceReferences] = useState(!!initialAgent?.config?.includeSourceReferences);

    const [savingState, setSavingState] = useState('idle');

    // Loaded once for pickers
    const [allSkills, setAllSkills] = useState(null);          // null = not loaded, [] = loaded but empty
    const [integrationStatus, setIntegrationStatus] = useState(null);
    const [skillPickerOpen, setSkillPickerOpen] = useState(false);
    const [appsPickerOpen, setAppsPickerOpen] = useState(false);
    const [knowledgeOpen, setKnowledgeOpen] = useState(false);
    const [skillSearch, setSkillSearch] = useState('');

    const [chat, setChat] = useState(history || []);
    const [chatInput, setChatInput] = useState('');
    const [chatBusy, setChatBusy] = useState(false);
    const chatScrollRef = useRef(null);

    useEffect(() => {
        if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }, [chat]);

    // Lazy-load skills + integration status on first picker open
    useEffect(() => {
        if (!skillPickerOpen || allSkills !== null) return;
        (async () => {
            try {
                const res = await authFetch(`${API_BASE}/api/skills`);
                setAllSkills(res.ok ? await res.json() : []);
            } catch (_) { setAllSkills([]); }
        })();
    }, [skillPickerOpen, allSkills]);

    useEffect(() => {
        if (!appsPickerOpen || integrationStatus !== null) return;
        (async () => {
            try {
                const res = await authFetch(`${API_BASE}/ai/user-settings`);
                if (res.ok) setIntegrationStatus(await res.json());
                else setIntegrationStatus({});
            } catch (_) { setIntegrationStatus({}); }
        })();
    }, [appsPickerOpen, integrationStatus]);

    // Debounced auto-save: writes the canonical config shape so the agent round-trips
    // cleanly into AgentEditorUI ([components/admin/AgentEditorUI.jsx]).
    const saveTimer = useRef(null);
    const queueSave = useCallback((patch) => {
        if (!agent?.id) return;
        setSavingState('saving');
        clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(async () => {
            try {
                const res = await authFetch(`${API_BASE}/agents/${agent.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(patch),
                });
                if (!res.ok) throw new Error(await res.text());
                const updated = await res.json();
                setAgent(updated);
                setSavingState('saved');
            } catch (err) {
                console.error('Auto-save failed:', err);
                setSavingState('error');
            }
        }, 600);
    }, [agent?.id]);

    const saveConfig = useCallback((patch) => {
        const nextConfig = { ...(agent?.config || {}), ...patch };
        queueSave({ config: nextConfig });
    }, [agent?.config, queueSave]);

    const updateName = (v) => { setName(v); queueSave({ name: v }); };
    const updateAvatar = (v) => { setAvatar(v); saveConfig({ avatar: v }); };
    const updateInstructions = (v) => { setInstructions(v); queueSave({ systemPrompt: v }); };
    const toggleChannel = (id) => {
        const next = channels.includes(id) ? channels.filter(c => c !== id) : [...channels, id];
        setChannels(next);
        saveConfig({ wizard: { ...(agent?.config?.wizard || {}), channels: next } });
    };
    const toggleMemory = () => {
        const next = !memoryEnabled;
        setMemoryEnabled(next);
        saveConfig({ memoryEnabled: next });
    };
    const toggleSkill = (id) => {
        const next = attachedSkillIds.includes(id) ? attachedSkillIds.filter(x => x !== id) : [...attachedSkillIds, id];
        setAttachedSkillIds(next);
        saveConfig({ attachedSkillIds: next });
    };
    const toggleIntegration = (id, available) => {
        const baseList = enabledIntegrations || available.map(a => a.id);
        const next = baseList.includes(id) ? baseList.filter(x => x !== id) : [...baseList, id];
        setEnabledIntegrations(next);
        saveConfig({ enabledIntegrations: next });
    };
    const onKnowledgeBaseIdsChange = (next) => {
        setKnowledgeBaseIds(next);
        saveConfig({ knowledge_base_ids: next });
    };
    const onStrictKnowledgeChange = (v) => { setStrictKnowledge(v); saveConfig({ strictKnowledge: v }); };
    const onIncludeSourceReferencesChange = (v) => { setIncludeSourceReferences(v); saveConfig({ includeSourceReferences: v }); };

    const handleRefine = async () => {
        const text = chatInput.trim();
        if (!text || chatBusy) return;
        setChat(prev => [...prev, { role: 'user', content: text }]);
        setChatInput('');
        setChatBusy(true);
        try {
            const res = await authFetch(`${API_BASE}/agents/wizard/refine`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: chat[0]?.content || '',
                    plan: { name, description: agent?.description || '', avatar, channels, capabilities: plan?.capabilities || [], systemPrompt: instructions },
                    refinement: text,
                    modelTier: tier,
                    locale,
                }),
            });
            if (!res.ok) throw new Error(await res.text());
            const { plan: updated } = await res.json();
            setName(updated.name);
            setAvatar(updated.avatar || avatar);
            setInstructions(updated.systemPrompt || instructions);
            setChannels(updated.channels || channels);
            queueSave({
                name: updated.name,
                description: updated.description,
                systemPrompt: updated.systemPrompt,
                config: {
                    ...(agent?.config || {}),
                    avatar: updated.avatar || avatar,
                    wizard: { channels: updated.channels, capabilities: updated.capabilities, suggestedSkills: updated.suggestedSkills },
                },
            });
            setChat(prev => [...prev, { role: 'plan', plan: updated }]);
        } catch (err) {
            setChat(prev => [...prev, { role: 'error', content: err.message }]);
        } finally {
            setChatBusy(false);
        }
    };

    // Flush any pending debounced save, then close.
    const handleDone = async () => {
        if (saveTimer.current) {
            clearTimeout(saveTimer.current);
            saveTimer.current = null;
        }
        if (onPublished) onPublished(agent);
    };

    // Filter integration catalog by org/credential gating (mirrors ToolsSection.jsx).
    const availableIntegrations = (() => {
        if (!integrationStatus) return INTEGRATION_CATALOG;
        const status = integrationStatus;
        return INTEGRATION_CATALOG.filter(item => {
            const orgEnabled = status.orgEnabledIntegrations;
            if (orgEnabled && !orgEnabled.includes(item.id)) return false;
            if (item.group === 'google') return !!status.isGoogleUser;
            if (item.id === 'fireflies') return !!status.hasFirefliesKey;
            if (item.id === 'youtrack') return !!status.hasYouTrackConfig;
            if (item.id === 'gamma') return !!status.hasGammaKey;
            if (item.id === 'n8n') return !!status.hasN8nConfig;
            if (item.id === 'linkedin') return !!status.hasLinkedInConfig || !!status.linkedInConnected;
            return true;
        });
    })();

    const skillNamesById = new Map((allSkills || []).map(s => [s.id, s]));
    const enabledIntegrationCount = enabledIntegrations === null
        ? availableIntegrations.length
        : enabledIntegrations.filter(id => availableIntegrations.some(a => a.id === id)).length;

    return (
        <div className="flex h-full bg-[var(--bg-primary)]">
            {/* Left chat panel */}
            <aside className="w-[380px] flex-shrink-0 border-r border-[var(--border-default)] flex flex-col">
                <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-default)]">
                    <button onClick={onBack} className="flex items-center gap-1 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                        <ArrowLeft size={16} /> {t('agent_wizard.back')}
                    </button>
                    <span className="text-xs text-[var(--text-tertiary)]">
                        {savingState === 'saving' && t('agent_wizard.builder.save_saving')}
                        {savingState === 'saved' && t('agent_wizard.builder.save_saved')}
                        {savingState === 'error' && t('agent_wizard.builder.save_error')}
                    </span>
                </div>
                <div ref={chatScrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                    {chat.map((m, i) => {
                        if (m.role === 'user') {
                            return (
                                <div key={i} className="flex justify-end">
                                    <div className="max-w-[80%] rounded-2xl bg-[var(--bg-secondary)] px-4 py-2 text-sm text-[var(--text-primary)]">{m.content}</div>
                                </div>
                            );
                        }
                        if (m.role === 'plan') {
                            return <div key={i}><PlanCard plan={m.plan} onAdjust={() => { }} onBuild={() => { }} busy /></div>;
                        }
                        if (m.role === 'error') {
                            return <div key={i} className="text-xs text-red-500">{m.content}</div>;
                        }
                        return <div key={i} className="text-sm text-[var(--text-secondary)]">{m.content}</div>;
                    })}
                </div>
                <div className="p-3 border-t border-[var(--border-default)]">
                    <div className="flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-2">
                        <Plus size={16} className="text-[var(--text-tertiary)]" />
                        <input
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleRefine(); } }}
                            placeholder={t('agent_wizard.builder.chat_placeholder')}
                            className="flex-1 bg-transparent outline-none text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)]"
                            disabled={chatBusy}
                        />
                        <button
                            onClick={handleRefine}
                            disabled={chatBusy || !chatInput.trim()}
                            className="w-8 h-8 rounded-full bg-[var(--text-primary)] text-[var(--bg-primary)] flex items-center justify-center disabled:opacity-30"
                        >
                            <Send size={14} />
                        </button>
                    </div>
                </div>
            </aside>

            {/* Right config panel */}
            <main className="flex-1 overflow-y-auto">
                <div className="flex items-center justify-end gap-3 px-6 py-3 border-b border-[var(--border-default)]">
                    <span className="text-xs text-[var(--text-tertiary)]">
                        {savingState === 'saving' && t('agent_wizard.builder.save_saving')}
                        {savingState === 'saved' && t('agent_wizard.builder.save_saved')}
                        {savingState === 'error' && t('agent_wizard.builder.save_error')}
                    </span>
                    <button
                        onClick={handleDone}
                        className="px-5 py-2 rounded-full bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90"
                    >
                        {t('agent_wizard.builder.done')}
                    </button>
                </div>

                <div className="max-w-3xl mx-auto px-8 py-8">
                    <div className="flex items-start gap-4 mb-6">
                        <button
                            onClick={() => {
                                const v = window.prompt(t('agent_wizard.builder.avatar_prompt'), avatar);
                                if (v) updateAvatar(v.trim().slice(0, 4));
                            }}
                            className="w-14 h-14 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-default)] text-2xl flex items-center justify-center hover:bg-[var(--bg-tertiary)]"
                        >
                            {avatar}
                        </button>
                        <input
                            value={name}
                            onChange={(e) => updateName(e.target.value)}
                            className="flex-1 text-2xl font-semibold bg-transparent outline-none text-[var(--text-primary)] border-b border-transparent focus:border-[var(--border-default)] py-1"
                            placeholder={t('agent_wizard.builder.name_placeholder')}
                        />
                    </div>

                    <div className="mb-8">
                        <div className="text-sm text-[var(--text-secondary)] mb-2">{t('agent_wizard.builder.channels')}</div>
                        <div className="grid grid-cols-2 gap-3">
                            {channelOptions.map(ch => {
                                const active = channels.includes(ch.id);
                                return (
                                    <button
                                        key={ch.id}
                                        onClick={() => toggleChannel(ch.id)}
                                        className={`flex items-center gap-3 p-4 rounded-xl border text-left transition ${active ? 'border-[var(--accent)] bg-[var(--accent-soft,var(--bg-secondary))]' : 'border-[var(--border-default)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)]'}`}
                                    >
                                        <span className="text-[var(--text-primary)]">{ch.icon}</span>
                                        <div>
                                            <div className="text-sm font-medium text-[var(--text-primary)]">{ch.label}</div>
                                            <div className="text-xs text-[var(--text-tertiary)]">{ch.sub}</div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2 mb-8 relative">
                        <ActionPill
                            icon={<AppWindow size={14} />}
                            label={`${t('agent_wizard.builder.browse_apps')} · ${enabledIntegrationCount}`}
                            onClick={() => setAppsPickerOpen(v => !v)}
                            active={appsPickerOpen}
                        />
                        <ActionPill
                            icon={<Sparkles size={14} />}
                            label={`${t('agent_wizard.builder.add_skill')} · ${attachedSkillIds.length}`}
                            onClick={() => setSkillPickerOpen(v => !v)}
                            active={skillPickerOpen}
                        />
                        <ActionPill
                            icon={<Upload size={14} />}
                            label={`${t('agent_wizard.builder.upload_files')} · ${knowledgeBaseIds.length}`}
                            onClick={() => setKnowledgeOpen(true)}
                        />
                        <ActionPill
                            icon={<Brain size={14} />}
                            label={memoryEnabled ? t('agent_wizard.builder.memory_on') : t('agent_wizard.builder.memory')}
                            onClick={toggleMemory}
                            active={memoryEnabled}
                        />

                        {skillPickerOpen && (
                            <SkillPicker
                                t={t}
                                skills={allSkills || []}
                                selectedIds={attachedSkillIds}
                                search={skillSearch}
                                onSearch={setSkillSearch}
                                onClose={() => setSkillPickerOpen(false)}
                                onToggle={toggleSkill}
                            />
                        )}
                        {appsPickerOpen && (
                            <AppsPicker
                                t={t}
                                items={availableIntegrations}
                                enabled={enabledIntegrations}
                                onClose={() => setAppsPickerOpen(false)}
                                onToggle={(id) => toggleIntegration(id, availableIntegrations)}
                            />
                        )}
                    </div>

                    {attachedSkillIds.length > 0 && (
                        <div className="mb-8">
                            <div className="text-sm text-[var(--text-secondary)] mb-2">{t('agent_wizard.builder.skills')}</div>
                            <div className="flex flex-wrap gap-2">
                                {attachedSkillIds.map((id) => {
                                    const s = skillNamesById.get(id);
                                    return (
                                        <span key={id} className="px-3 py-1 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-default)] text-sm text-[var(--text-primary)] flex items-center gap-2">
                                            <span>{s?.icon || '✨'}</span>
                                            <span>{s?.name || id}</span>
                                            <button onClick={() => toggleSkill(id)} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"><X size={12} /></button>
                                        </span>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div>
                        <div className="text-sm text-[var(--text-secondary)] mb-2">{t('agent_wizard.builder.instructions')}</div>
                        <textarea
                            value={instructions}
                            onChange={(e) => updateInstructions(e.target.value)}
                            rows={10}
                            placeholder={t('agent_wizard.builder.instructions_placeholder')}
                            className="w-full bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)] resize-y"
                        />
                    </div>
                </div>
            </main>

            {knowledgeOpen && agent?.id && (
                <KnowledgeModal onClose={() => setKnowledgeOpen(false)}>
                    <KnowledgePanel
                        agentId={agent.id}
                        API_BASE={API_BASE}
                        knowledgeBaseIds={knowledgeBaseIds}
                        onKnowledgeBaseIdsChange={onKnowledgeBaseIdsChange}
                        strictKnowledge={strictKnowledge}
                        onStrictKnowledgeChange={onStrictKnowledgeChange}
                        includeSourceReferences={includeSourceReferences}
                        onIncludeSourceReferencesChange={onIncludeSourceReferencesChange}
                    />
                </KnowledgeModal>
            )}
        </div>
    );
}

function SkillPicker({ skills, selectedIds, search, onSearch, onClose, onToggle, t }) {
    const filtered = (skills || []).filter(s =>
        !search || (s.name || '').toLowerCase().includes(search.toLowerCase())
    );
    return (
        <div className="absolute z-20 top-full left-0 mt-2 w-[420px] rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)] shadow-lg p-3">
            <div className="flex items-center gap-2 mb-2">
                <Search size={14} className="text-[var(--text-tertiary)]" />
                <input
                    autoFocus
                    value={search}
                    onChange={(e) => onSearch(e.target.value)}
                    placeholder={t('agent_wizard.skills.search')}
                    className="flex-1 bg-transparent outline-none text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)]"
                />
                <button onClick={onClose} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"><X size={14} /></button>
            </div>
            <div className="max-h-64 overflow-y-auto divide-y divide-[var(--border-default)]">
                {filtered.length === 0 && (
                    <div className="text-xs text-[var(--text-tertiary)] py-3 text-center">
                        {t('agent_wizard.skills.empty')}
                    </div>
                )}
                {filtered.map((s) => {
                    const checked = selectedIds.includes(s.id);
                    return (
                        <button
                            key={s.id}
                            onClick={() => onToggle(s.id)}
                            className="w-full flex items-center gap-3 py-2 text-left hover:bg-[var(--bg-secondary)] rounded-lg px-2"
                        >
                            <span className="text-base">{s.icon || '✨'}</span>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm text-[var(--text-primary)] truncate">{s.name}</div>
                                {s.description && <div className="text-xs text-[var(--text-tertiary)] truncate">{s.description}</div>}
                            </div>
                            <span className={`w-4 h-4 rounded-sm border flex items-center justify-center ${checked ? 'bg-[var(--accent)] border-[var(--accent)] text-white' : 'border-[var(--border-default)]'}`}>
                                {checked && '✓'}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

function AppsPicker({ items, enabled, onClose, onToggle, t }) {
    const isSelected = (id) => enabled === null ? true : enabled.includes(id);
    return (
        <div className="absolute z-20 top-full left-0 mt-2 w-[480px] rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)] shadow-lg p-3">
            <div className="flex items-center justify-between mb-2 px-1">
                <div className="text-sm font-medium text-[var(--text-primary)]">{t('agent_wizard.builder.browse_apps')}</div>
                <button onClick={onClose} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"><X size={14} /></button>
            </div>
            <div className="max-h-72 overflow-y-auto grid grid-cols-2 gap-2">
                {items.length === 0 && (
                    <div className="col-span-2 text-xs text-[var(--text-tertiary)] py-3 text-center">—</div>
                )}
                {items.map((item) => {
                    const selected = isSelected(item.id);
                    return (
                        <button
                            key={item.id}
                            onClick={() => onToggle(item.id)}
                            className={`flex items-center gap-3 p-2.5 rounded-lg border text-left transition ${selected ? 'border-[var(--accent)] bg-[var(--bg-secondary)]' : 'border-[var(--border-default)] bg-[var(--bg-secondary)] opacity-60 hover:opacity-100'}`}
                        >
                            <div className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0">
                                {item.iconSvg}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="text-sm text-[var(--text-primary)] truncate">{item.label}</div>
                                <div className="text-[10px] text-[var(--text-tertiary)] truncate">{item.description}</div>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

function KnowledgeModal({ children, onClose }) {
    return (
        <div className="fixed inset-0 z-[1000] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-[var(--bg-primary)] rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-end px-4 py-2 border-b border-[var(--border-default)]">
                    <button onClick={onClose} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"><X size={18} /></button>
                </div>
                <div className="p-4">{children}</div>
            </div>
        </div>
    );
}

function ActionPill({ icon, label, onClick, active }) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm border transition ${active ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--bg-secondary)]' : 'border-[var(--border-default)] text-[var(--text-primary)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)]'}`}
        >
            {icon}{label}
        </button>
    );
}
