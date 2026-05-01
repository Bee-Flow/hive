import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Plus, Sparkles, Upload, Brain, AppWindow, ArrowLeft, X, Search, ChevronDown, ChevronRight, Image as ImageIcon, Globe, BookOpen } from 'lucide-react';
import { API_BASE, authFetch } from '../../../utils/helpers';
import useTranslation from '../../../hooks/useTranslation';
import ModelTierSelector from '../../ModelTierSelector';
import { INTEGRATION_CATALOG } from '../AgentDesigner/integrations';
import PlanCard from './PlanCard';

export default function BuilderSplit({ agent: initialAgent, plan, history, tier, locale, onBack, onPublished, rightHeaderExtras = null }) {
    const { t } = useTranslation();

    const [agent, setAgent] = useState(initialAgent);
    const [name, setName] = useState(initialAgent?.name || plan?.name || t('agent_wizard.builder.name_placeholder'));
    const [avatar, setAvatar] = useState(initialAgent?.avatar || initialAgent?.config?.avatar || plan?.avatar || '🤖');
    const [description, setDescription] = useState(initialAgent?.description || plan?.description || '');
    const [instructions, setInstructions] = useState(initialAgent?.system_prompt || plan?.systemPrompt || '');
    const [model, setModel] = useState(initialAgent?.model || '');
    const [categoryId, setCategoryId] = useState(initialAgent?.category_id || null);
    const [starterPrompts, setStarterPrompts] = useState(() => {
        const sp = initialAgent?.starter_prompts;
        if (Array.isArray(sp)) return sp;
        if (typeof sp === 'string') { try { return JSON.parse(sp); } catch (_) { return []; } }
        return [];
    });
    const [isPublished, setIsPublished] = useState(initialAgent?.is_published === 1 || initialAgent?.is_published === true);
    const [sharedGroups, setSharedGroups] = useState(() => {
        const g = initialAgent?.shared_groups;
        if (Array.isArray(g)) return g;
        if (typeof g === 'string') { try { return JSON.parse(g); } catch (_) { return []; } }
        return [];
    });

    // Canonical config fields (round-trip with AgentEditorUI)
    const [memoryEnabled, setMemoryEnabled] = useState(!!initialAgent?.config?.memoryEnabled);
    const [attachedSkillIds, setAttachedSkillIds] = useState(initialAgent?.config?.attachedSkillIds || []);
    const [enabledIntegrations, setEnabledIntegrations] = useState(
        initialAgent?.config?.enabledIntegrations === undefined ? null : initialAgent.config.enabledIntegrations
    );
    const [knowledgeBaseIds, setKnowledgeBaseIds] = useState(initialAgent?.config?.knowledge_base_ids || []);
    const [strictKnowledge, setStrictKnowledge] = useState(!!initialAgent?.config?.strictKnowledge);
    const [includeSourceReferences, setIncludeSourceReferences] = useState(!!initialAgent?.config?.includeSourceReferences);
    // Behavior toggles
    const [allowCopy, setAllowCopy] = useState(initialAgent?.config?.allowCopy !== false);
    const [embedEnabled, setEmbedEnabled] = useState(initialAgent?.embed_enabled === 1 || initialAgent?.embed_enabled === true);
    const [threadsEnabled, setThreadsEnabled] = useState(initialAgent?.threads_enabled !== 0 && initialAgent?.threads_enabled !== false);
    const [workspaceEnabled, setWorkspaceEnabled] = useState(initialAgent?.workspace_enabled === 1 || initialAgent?.workspace_enabled === true);
    const [disableExternalTools, setDisableExternalTools] = useState(initialAgent?.config?.disableExternalTools === true);
    // Guardrails
    const [enableGuardrails, setEnableGuardrails] = useState(initialAgent?.config?.enableGuardrails === true);
    const [llamaGuardEnabled, setLlamaGuardEnabled] = useState(initialAgent?.config?.llamaGuardEnabled === true);
    const [webSearchGuardEnabled, setWebSearchGuardEnabled] = useState(initialAgent?.config?.webSearchGuardEnabled === true);
    // Bubble widget (subset of most-used)
    const [bubbleColor, setBubbleColor] = useState(initialAgent?.config?.bubbleColor || '#6366F1');
    const [bubblePosition, setBubblePosition] = useState(initialAgent?.config?.bubblePosition || 'bottom-right');

    // Tier (for chat input)
    const [tiers, setTiers] = useState({});
    const [selectedTier, setSelectedTier] = useState('fast');

    // Categories + groups (for selectors)
    const [categories, setCategories] = useState([]);
    const [orgGroups, setOrgGroups] = useState([]);

    const [savingState, setSavingState] = useState('idle');

    // Section open/closed state for the inline accordion.
    const [openSection, setOpenSection] = useState(null); // 'identity'|'model'|'knowledge'|'behavior'|'publishing'|'guardrails'|'embed'|null
    const toggleSection = (s) => setOpenSection(prev => prev === s ? null : s);

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

    // Eager-load on mount so badge counts ("Browse apps · 7") reflect what
    // the user is actually allowed to use, not the full catalog.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const [skillsRes, statusRes] = await Promise.all([
                    authFetch(`${API_BASE}/api/skills`),
                    authFetch(`${API_BASE}/ai/user-settings`),
                ]);
                if (cancelled) return;
                setAllSkills(skillsRes.ok ? await skillsRes.json() : []);
                setIntegrationStatus(statusRes.ok ? await statusRes.json() : {});
            } catch (_) {
                if (!cancelled) {
                    setAllSkills([]);
                    setIntegrationStatus({});
                }
            }
        })();
        return () => { cancelled = true; };
    }, []);

    // ── Save pipeline ─────────────────────────────────────────────
    // The PUT /agents/:id endpoint writes columns from whatever it receives
    // and falls back to NULL for description / systemPrompt when absent.
    // So every save MUST send the full canonical state. We keep the latest
    // values in a ref to coalesce rapid edits without stale closures.
    const stateRef = useRef({
        name,
        description: initialAgent?.description || plan?.description || '',
        systemPrompt: instructions,
        config: { ...(initialAgent?.config || {}) },
    });
    // Keep description in sync if initialAgent updates after mount
    useEffect(() => { stateRef.current.name = name; }, [name]);
    useEffect(() => { stateRef.current.systemPrompt = instructions; }, [instructions]);

    const agentIdRef = useRef(agent?.id);
    useEffect(() => { agentIdRef.current = agent?.id; }, [agent?.id]);

    const saveTimer = useRef(null);
    const inflightRef = useRef(false);
    const dirtyRef = useRef(false);

    const flush = useCallback(async () => {
        const id = agentIdRef.current;
        if (!id) return;
        if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
        // Serialize: if a save is in progress, wait for it before issuing another.
        // This prevents lost updates when the user changes things rapidly.
        while (inflightRef.current) {
            await new Promise(r => setTimeout(r, 50));
        }
        if (!dirtyRef.current) return;
        dirtyRef.current = false;
        inflightRef.current = true;
        const snapshot = {
            name: stateRef.current.name,
            description: stateRef.current.description,
            systemPrompt: stateRef.current.systemPrompt,
            config: { ...stateRef.current.config },
        };
        try {
            const res = await authFetch(`${API_BASE}/agents/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(snapshot),
            });
            if (!res.ok) throw new Error(await res.text());
            const updated = await res.json();
            setAgent(updated);
            stateRef.current = {
                name: updated.name || snapshot.name,
                description: updated.description || snapshot.description,
                systemPrompt: updated.system_prompt || snapshot.systemPrompt,
                config: updated.config || snapshot.config,
            };
            setSavingState('saved');
        } catch (err) {
            console.error('Auto-save failed:', err);
            setSavingState('error');
            // Mark dirty again so a retry happens on next change.
            dirtyRef.current = true;
        } finally {
            inflightRef.current = false;
            // If something was changed while we were saving, schedule another flush.
            if (dirtyRef.current) flush();
        }
    }, []);

    const queueSave = useCallback((immediate = false) => {
        if (!agentIdRef.current) return;
        dirtyRef.current = true;
        setSavingState('saving');
        if (saveTimer.current) clearTimeout(saveTimer.current);
        if (immediate) {
            saveTimer.current = null;
            flush();
        } else {
            // Short debounce — keystrokes settle quickly, but we still want
            // unfocused changes (toggles) to land near-instantly via `immediate`.
            saveTimer.current = setTimeout(() => { saveTimer.current = null; flush(); }, 350);
        }
    }, [flush]);

    // Save before the user navigates away. sendBeacon-style fallback ensures
    // a quick toggle right before close still reaches the server.
    useEffect(() => {
        const onBeforeUnload = () => {
            if (saveTimer.current && agentIdRef.current && dirtyRef.current) {
                clearTimeout(saveTimer.current);
                saveTimer.current = null;
                const snapshot = {
                    name: stateRef.current.name,
                    description: stateRef.current.description,
                    systemPrompt: stateRef.current.systemPrompt,
                    config: stateRef.current.config,
                };
                try {
                    navigator.sendBeacon(
                        `${API_BASE}/agents/${agentIdRef.current}`,
                        new Blob([JSON.stringify(snapshot)], { type: 'application/json' })
                    );
                } catch (_) { /* ignore */ }
            }
        };
        window.addEventListener('beforeunload', onBeforeUnload);
        return () => window.removeEventListener('beforeunload', onBeforeUnload);
    }, []);

    const patchConfig = useCallback((patch, { immediate = true } = {}) => {
        stateRef.current.config = { ...stateRef.current.config, ...patch };
        queueSave(immediate);
    }, [queueSave]);

    // Typing: debounced.
    const updateName = (v) => { setName(v); stateRef.current.name = v; queueSave(false); };
    const updateInstructions = (v) => { setInstructions(v); stateRef.current.systemPrompt = v; queueSave(false); };
    // Discrete actions: save immediately so a quick navigation still persists.
    const updateAvatar = (v) => { setAvatar(v); patchConfig({ avatar: v }); };
    const toggleMemory = () => {
        const next = !memoryEnabled;
        setMemoryEnabled(next);
        patchConfig({ memoryEnabled: next });
    };
    const toggleSkill = (id) => {
        const next = attachedSkillIds.includes(id) ? attachedSkillIds.filter(x => x !== id) : [...attachedSkillIds, id];
        setAttachedSkillIds(next);
        patchConfig({ attachedSkillIds: next });
    };
    const toggleIntegration = (id, available) => {
        const baseList = enabledIntegrations || available.map(a => a.id);
        const next = baseList.includes(id) ? baseList.filter(x => x !== id) : [...baseList, id];
        setEnabledIntegrations(next);
        patchConfig({ enabledIntegrations: next });
    };
    const onKnowledgeBaseIdsChange = (next) => {
        setKnowledgeBaseIds(next);
        patchConfig({ knowledge_base_ids: next });
    };
    const onStrictKnowledgeChange = (v) => { setStrictKnowledge(v); patchConfig({ strictKnowledge: v }); };
    const onIncludeSourceReferencesChange = (v) => { setIncludeSourceReferences(v); patchConfig({ includeSourceReferences: v }); };

    // Flush on blur for typed fields — guarantees the change lands as soon
    // as the user leaves the field, even if they click immediately to nav away.
    const flushNow = () => { if (dirtyRef.current) flush(); };

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
                    plan: { name, description: agent?.description || '', avatar, capabilities: plan?.capabilities || [], systemPrompt: instructions },
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
            stateRef.current.name = updated.name;
            stateRef.current.description = updated.description || stateRef.current.description;
            stateRef.current.systemPrompt = updated.systemPrompt || stateRef.current.systemPrompt;
            stateRef.current.config = {
                ...stateRef.current.config,
                avatar: updated.avatar || avatar,
                wizard: { capabilities: updated.capabilities, suggestedSkills: updated.suggestedSkills },
            };
            queueSave();
            setChat(prev => [...prev, { role: 'plan', plan: updated }]);
        } catch (err) {
            setChat(prev => [...prev, { role: 'error', content: err.message }]);
        } finally {
            setChatBusy(false);
        }
    };

    // Flush any pending or in-flight save, then close.
    const handleDone = async () => {
        if (saveTimer.current) {
            clearTimeout(saveTimer.current);
            saveTimer.current = null;
        }
        if (dirtyRef.current || inflightRef.current) await flush();
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
                    {rightHeaderExtras}
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
                            onBlur={flushNow}
                            className="flex-1 text-2xl font-semibold bg-transparent outline-none text-[var(--text-primary)] border-b border-transparent focus:border-[var(--border-default)] py-1"
                            placeholder={t('agent_wizard.builder.name_placeholder')}
                        />
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
                                onCreate={async ({ name: skillName, description: skillDesc, instructions: skillInstr }) => {
                                    try {
                                        const res = await authFetch(`${API_BASE}/api/skills`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                                name: skillName,
                                                description: skillDesc,
                                                instructions: skillInstr,
                                                isShared: false,
                                            }),
                                        });
                                        if (!res.ok) throw new Error(await res.text());
                                        const created = await res.json();
                                        setAllSkills(prev => [...(prev || []), created]);
                                        const next = [...attachedSkillIds, created.id];
                                        setAttachedSkillIds(next);
                                        patchConfig({ attachedSkillIds: next });
                                        return created;
                                    } catch (err) {
                                        console.error('Create skill failed:', err);
                                        alert(err.message);
                                        return null;
                                    }
                                }}
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
                            onBlur={flushNow}
                            rows={10}
                            placeholder={t('agent_wizard.builder.instructions_placeholder')}
                            className="w-full bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)] resize-y"
                        />
                    </div>
                </div>
            </main>

            {knowledgeOpen && agent?.id && (
                <FilesUploadModal
                    t={t}
                    agent={agent}
                    knowledgeBaseIds={knowledgeBaseIds}
                    onKnowledgeBaseIdsChange={onKnowledgeBaseIdsChange}
                    strictKnowledge={strictKnowledge}
                    onStrictKnowledgeChange={onStrictKnowledgeChange}
                    onClose={() => setKnowledgeOpen(false)}
                />
            )}
        </div>
    );
}

function SkillPicker({ skills, selectedIds, search, onSearch, onClose, onToggle, onCreate, t }) {
    const [creating, setCreating] = useState(false);
    const [newName, setNewName] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [newInstr, setNewInstr] = useState('');
    const [busy, setBusy] = useState(false);
    const filtered = (skills || []).filter(s =>
        !search || (s.name || '').toLowerCase().includes(search.toLowerCase())
    );

    const submit = async () => {
        if (!newName.trim() || busy) return;
        setBusy(true);
        const created = await onCreate({ name: newName.trim(), description: newDesc.trim(), instructions: newInstr.trim() });
        setBusy(false);
        if (created) {
            setNewName(''); setNewDesc(''); setNewInstr(''); setCreating(false);
        }
    };

    return (
        <div className="absolute z-20 top-full left-0 mt-2 w-[460px] rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)] shadow-lg p-3">
            {!creating && (
                <>
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
                    <button
                        onClick={() => { setCreating(true); setNewName(search); }}
                        className="w-full flex items-center gap-2 py-2 px-2 mb-1 rounded-lg text-sm text-[var(--accent)] hover:bg-[var(--bg-secondary)]"
                    >
                        <Plus size={14} /> {t('agent_wizard.skills.create_new')}
                    </button>
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
                </>
            )}
            {creating && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <div className="text-sm font-medium text-[var(--text-primary)]">{t('agent_wizard.skills.create_new')}</div>
                        <button onClick={() => setCreating(false)} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"><X size={14} /></button>
                    </div>
                    <input
                        autoFocus
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder={t('agent_wizard.skills.field_name')}
                        className="w-full bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                    />
                    <input
                        value={newDesc}
                        onChange={(e) => setNewDesc(e.target.value)}
                        placeholder={t('agent_wizard.skills.field_description')}
                        className="w-full bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                    />
                    <textarea
                        value={newInstr}
                        onChange={(e) => setNewInstr(e.target.value)}
                        rows={4}
                        placeholder={t('agent_wizard.skills.field_instructions')}
                        className="w-full bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)] resize-y"
                    />
                    <div className="flex justify-end gap-2 pt-1">
                        <button onClick={() => setCreating(false)} className="px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                            {t('agent_wizard.skills.cancel')}
                        </button>
                        <button onClick={submit} disabled={!newName.trim() || busy} className="px-3 py-1.5 rounded-full text-sm bg-[var(--accent)] text-white disabled:opacity-50">
                            {busy ? t('agent_wizard.busy') : t('agent_wizard.skills.create_attach')}
                        </button>
                    </div>
                </div>
            )}
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

function FilesUploadModal({ t, agent, knowledgeBaseIds, onKnowledgeBaseIdsChange, strictKnowledge, onStrictKnowledgeChange, onClose }) {
    // Primary KB = the auto-created KB at wizard/commit time, or the first linked KB.
    const initialKbId = agent?.config?.wizard?.primaryKbId || knowledgeBaseIds?.[0] || null;
    const [kbId, setKbId] = useState(initialKbId);
    const [docs, setDocs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState(null);
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = useRef(null);

    const ensureKB = useCallback(async () => {
        if (kbId) return kbId;
        // Lazily create one if commit didn't (older agents, KB feature was disabled, etc.).
        try {
            const res = await authFetch(`${API_BASE}/api/kb`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: agent?.name || 'Knowledge', description: `Auto-generated for agent "${agent?.name}"` }),
            });
            if (!res.ok) throw new Error(await res.text());
            const created = await res.json();
            setKbId(created.id);
            const next = Array.from(new Set([...(knowledgeBaseIds || []), created.id]));
            onKnowledgeBaseIdsChange(next);
            return created.id;
        } catch (err) {
            setError(err.message);
            return null;
        }
    }, [kbId, agent?.name, agent?.id, knowledgeBaseIds, onKnowledgeBaseIdsChange]);

    const loadDocs = useCallback(async (id) => {
        if (!id) return;
        setLoading(true);
        try {
            const res = await authFetch(`${API_BASE}/api/kb/${id}/documents?limit=200`);
            if (res.ok) {
                const data = await res.json();
                setDocs(data.items || data.documents || data || []);
            }
        } catch (_) { /* ignore */ } finally { setLoading(false); }
    }, []);

    useEffect(() => { if (kbId) loadDocs(kbId); }, [kbId, loadDocs]);

    const uploadFiles = async (files) => {
        if (!files || files.length === 0) return;
        setError(null);
        setUploading(true);
        try {
            const id = await ensureKB();
            if (!id) return;
            for (const file of files) {
                const fd = new FormData();
                fd.append('file', file);
                const res = await authFetch(`${API_BASE}/api/kb/${id}/ingest/file`, {
                    method: 'POST',
                    body: fd,
                });
                if (!res.ok) {
                    const txt = await res.text();
                    throw new Error(`${file.name}: ${txt}`);
                }
            }
            await loadDocs(id);
        } catch (err) {
            setError(err.message);
        } finally {
            setUploading(false);
        }
    };

    const onDrop = (e) => {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer?.files?.length) uploadFiles(Array.from(e.dataTransfer.files));
    };

    const deleteDoc = async (docId) => {
        if (!kbId) return;
        try {
            const res = await authFetch(`${API_BASE}/api/kb/${kbId}/documents/${docId}`, { method: 'DELETE' });
            if (!res.ok) throw new Error(await res.text());
            await loadDocs(kbId);
        } catch (err) { setError(err.message); }
    };

    return (
        <div className="fixed inset-0 z-[1000] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-[var(--bg-primary)] rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border-default)]">
                    <div>
                        <div className="text-sm font-semibold text-[var(--text-primary)]">{t('agent_wizard.files.title')}</div>
                        <div className="text-xs text-[var(--text-tertiary)]">{t('agent_wizard.files.subtitle')}</div>
                    </div>
                    <button onClick={onClose} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"><X size={18} /></button>
                </div>

                <div className="p-5 space-y-4">
                    <label className="flex items-start gap-3 px-3 py-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] cursor-pointer">
                        <input type="checkbox" checked={!!strictKnowledge} onChange={(e) => onStrictKnowledgeChange(e.target.checked)} className="mt-1" />
                        <div>
                            <div className="text-sm text-[var(--text-primary)]">{t('agent_wizard.files.strict_label')}</div>
                            <div className="text-xs text-[var(--text-tertiary)]">{t('agent_wizard.files.strict_help')}</div>
                        </div>
                    </label>

                    <div
                        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={onDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition ${dragOver ? 'border-[var(--accent)] bg-[var(--bg-secondary)]' : 'border-[var(--border-default)] bg-[var(--bg-secondary)]'}`}
                    >
                        <Upload className="mx-auto mb-2 text-[var(--text-tertiary)]" size={24} />
                        <div className="text-sm text-[var(--text-primary)]">{t('agent_wizard.files.drop_here')}</div>
                        <div className="text-xs text-[var(--text-tertiary)] mt-1">{t('agent_wizard.files.click_or_drag')}</div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            className="hidden"
                            onChange={(e) => { uploadFiles(Array.from(e.target.files || [])); e.target.value = ''; }}
                        />
                    </div>

                    {uploading && <div className="text-xs text-[var(--text-secondary)]">{t('agent_wizard.files.uploading')}</div>}
                    {error && <div className="text-xs text-red-500">{error}</div>}

                    <div>
                        <div className="text-xs uppercase tracking-wide text-[var(--text-tertiary)] mb-2">
                            {t('agent_wizard.files.documents')} {!loading && `(${docs.length})`}
                        </div>
                        {loading && <div className="text-xs text-[var(--text-tertiary)]">…</div>}
                        {!loading && docs.length === 0 && (
                            <div className="text-xs text-[var(--text-tertiary)] py-3 text-center">{t('agent_wizard.files.no_documents')}</div>
                        )}
                        <div className="divide-y divide-[var(--border-default)]">
                            {docs.map((d) => (
                                <div key={d.id} className="flex items-center gap-3 py-2 text-sm text-[var(--text-primary)]">
                                    <div className="flex-1 min-w-0">
                                        <div className="truncate">{d.title || d.source_url || d.id}</div>
                                        <div className="text-[11px] text-[var(--text-tertiary)]">
                                            {d.chunk_count != null ? `${d.chunk_count} chunks` : ''}
                                        </div>
                                    </div>
                                    <button onClick={() => deleteDoc(d.id)} className="text-[var(--text-tertiary)] hover:text-red-500"><X size={14} /></button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
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
