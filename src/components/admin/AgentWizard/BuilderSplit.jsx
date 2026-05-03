import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Plus, Sparkles, Upload, Brain, AppWindow, ArrowLeft, X, Search, ChevronDown, ChevronRight, Image as ImageIcon, Globe, BookOpen, Paperclip, LayoutGrid, ArrowUp, Puzzle as PuzzlePiece, Sliders, Copy, Check, History, Clock, Play, Pause, Trash2 } from 'lucide-react';
import { API_BASE, authFetch } from '../../../utils/helpers';
import useTranslation from '../../../hooks/useTranslation';
import ModelTierSelector from '../../ModelTierSelector';
import VersionHistory from '../../VersionHistory';
import MarkdownRenderer from '../../MarkdownRenderer';
import { INTEGRATION_CATALOG } from '../AgentDesigner/integrations';
import PlanCard from './PlanCard';

export default function BuilderSplit({ agent: initialAgent, plan, history, tier, locale, onBack, onPublished, rightHeaderExtras = null, user = null }) {
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
    // When per-agent memory is enabled, this flag controls whether the agent
    // also reads from the user's general memory. Default true (read but don't
    // write to general memory). False = fully isolated bucket.
    const [useGeneralMemory, setUseGeneralMemory] = useState(initialAgent?.config?.useGeneralMemory !== false);
    const [attachedSkillIds, setAttachedSkillIds] = useState(initialAgent?.config?.attachedSkillIds || []);
    // New agents are created with `enabledIntegrations: []` (none enabled).
    // Legacy agents may have `null`, which historically means "all available
    // are enabled" — we preserve that contract so chat tools don't disappear
    // until the user explicitly customises the list.
    const [enabledIntegrations, setEnabledIntegrations] = useState(
        initialAgent?.config?.enabledIntegrations === undefined ? [] : initialAgent.config.enabledIntegrations
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
    const [bubblePosition, setBubblePosition] = useState(initialAgent?.config?.bubblePosition || 'right');
    const [bubbleIcon, setBubbleIcon] = useState(initialAgent?.config?.bubbleIcon || '💬');

    // Tier (for chat input)
    const [tiers, setTiers] = useState({});
    const [selectedTier, setSelectedTier] = useState('fast');

    // Categories + groups (for selectors)
    const [categories, setCategories] = useState([]);
    const [orgGroups, setOrgGroups] = useState([]);
    const [automations, setAutomations] = useState([]);

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
    const [behaviorPickerOpen, setBehaviorPickerOpen] = useState(false);
    const [versionPickerOpen, setVersionPickerOpen] = useState(false);
    const [routinesPickerOpen, setRoutinesPickerOpen] = useState(false);
    const [routineModal, setRoutineModal] = useState(null); // null | { mode: 'create' } | { mode: 'edit', routine }
    const [agentRoutines, setAgentRoutines] = useState([]);
    const [publishPickerOpen, setPublishPickerOpen] = useState(false);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [skillSearch, setSkillSearch] = useState('');
    const [instructionsEditing, setInstructionsEditing] = useState(false);
    const instructionsTextareaRef = useRef(null);
    const updateBubbleColor = (v) => { setBubbleColor(v); patchConfig({ bubbleColor: v }); };
    const updateBubblePosition = (v) => { setBubblePosition(v); patchConfig({ bubblePosition: v }); };
    const updateBubbleIcon = (v) => { setBubbleIcon(v); patchConfig({ bubbleIcon: v }); };

    const routinesAllowed = Array.isArray(user?.betaFeatures) && user.betaFeatures.includes('agent_routines');
    const refreshAgentRoutines = useCallback(async () => {
        if (!routinesAllowed || !agent?.id) return;
        try {
            const res = await authFetch(`${API_BASE}/api/ai-tasks?agentId=${encodeURIComponent(agent.id)}`);
            if (res.ok) {
                const data = await res.json();
                setAgentRoutines(Array.isArray(data?.tasks) ? data.tasks : []);
            }
        } catch (_) { /* non-fatal */ }
    }, [routinesAllowed, agent?.id]);
    useEffect(() => { refreshAgentRoutines(); }, [refreshAgentRoutines]);
    const handleVersionRestore = async () => {
        if (!agent?.id) return;
        try {
            const res = await authFetch(`${API_BASE}/agents/${agent.id}`);
            if (res.ok) {
                const fresh = await res.json();
                setAgent(fresh);
                setName(fresh.name || '');
                setDescription(fresh.description || '');
                setInstructions(fresh.system_prompt || '');
                setAvatar(fresh.avatar || fresh.config?.avatar || '🤖');
                setModel(fresh.model || '');
                if (fresh.model && fresh.model.startsWith('tier:')) setSelectedTier(fresh.model.slice(5));
            }
        } catch (_) { /* ignore */ }
    };

    const [chat, setChat] = useState(history || []);
    const [chatInput, setChatInput] = useState('');
    const [chatBusy, setChatBusy] = useState(false);
    const chatScrollRef = useRef(null);

    useEffect(() => {
        if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }, [chat]);

    // Eager-load on mount so badge counts ("Browse apps · 7") reflect what
    // the user is actually allowed to use, not the full catalog. Also pull
    // the data needed by the inline collapsible sections (categories for the
    // category dropdown, org groups for publishing, tiers for the model picker).
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const [skillsRes, statusRes, catsRes, groupsRes, tiersRes, autosRes] = await Promise.all([
                    authFetch(`${API_BASE}/api/skills`),
                    authFetch(`${API_BASE}/ai/user-settings`),
                    authFetch(`${API_BASE}/agents/categories`),
                    authFetch(`${API_BASE}/auth/groups`),
                    authFetch(`${API_BASE}/ai/config/tiers-for-user?taskType=direct_chat`),
                    authFetch(`${API_BASE}/automation`).catch(() => ({ ok: false })),
                ]);
                if (cancelled) return;
                setAllSkills(skillsRes.ok ? await skillsRes.json() : []);
                setIntegrationStatus(statusRes.ok ? await statusRes.json() : {});
                setCategories(catsRes.ok ? await catsRes.json() : []);
                setOrgGroups(groupsRes.ok ? await groupsRes.json() : []);
                setTiers(tiersRes.ok ? await tiersRes.json() : {});
                if (autosRes.ok) {
                    try {
                        const data = await autosRes.json();
                        setAutomations(Array.isArray(data?.automations) ? data.automations : []);
                    } catch (_) { setAutomations([]); }
                }
                if (initialAgent?.model && initialAgent.model.startsWith('tier:')) {
                    setSelectedTier(initialAgent.model.slice('tier:'.length));
                }
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
        model: initialAgent?.model || '',
        categoryId: initialAgent?.category_id || null,
        embedEnabled: initialAgent?.embed_enabled === 1 || initialAgent?.embed_enabled === true,
        config: { ...(initialAgent?.config || {}) },
    });
    useEffect(() => { stateRef.current.name = name; }, [name]);
    useEffect(() => { stateRef.current.systemPrompt = instructions; }, [instructions]);
    useEffect(() => { stateRef.current.description = description; }, [description]);
    useEffect(() => {
        if (instructionsEditing && instructionsTextareaRef.current) {
            const el = instructionsTextareaRef.current;
            el.focus();
            const len = el.value.length;
            el.setSelectionRange(len, len);
        }
    }, [instructionsEditing]);

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
            model: stateRef.current.model,
            categoryId: stateRef.current.categoryId,
            embedEnabled: stateRef.current.embedEnabled,
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
            // Refresh the `agent` shell only (id, timestamps, derived fields).
            // Do NOT overwrite `stateRef.current` from the server response — by
            // the time this resolves the user may have typed more, and that
            // newer text lives only in stateRef. Overwriting here silently
            // loses keystrokes typed during the in-flight save.
            setAgent(updated);
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
    const toggleUseGeneralMemory = () => {
        const next = !useGeneralMemory;
        setUseGeneralMemory(next);
        patchConfig({ useGeneralMemory: next });
    };
    const toggleSkill = (id) => {
        const next = attachedSkillIds.includes(id) ? attachedSkillIds.filter(x => x !== id) : [...attachedSkillIds, id];
        setAttachedSkillIds(next);
        patchConfig({ attachedSkillIds: next });
    };
    const toggleIntegration = (id, available) => {
        // null = legacy "all enabled" — materialise the implicit list before toggling.
        const baseList = Array.isArray(enabledIntegrations)
            ? enabledIntegrations
            : available.map(a => a.id);
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

    // Identity / model / category — typed fields debounce, dropdowns/toggles immediate.
    const updateDescription = (v) => { setDescription(v); stateRef.current.description = v; queueSave(false); };
    const updateModel = (tierName) => {
        const v = tierName ? `tier:${tierName}` : '';
        setModel(v);
        setSelectedTier(tierName);
        stateRef.current.config = stateRef.current.config; // no-op; model is top-level not config
        // model is a top-level column on the agent — write through stateRef so the
        // canonical PUT picks it up (the snapshot already merges all top-level fields).
        // Use a manual flush via the queue so it lands immediately.
        const id = agentIdRef.current;
        if (!id) return;
        // Stash the new model on stateRef so flush() picks it up; queueSave dirties.
        stateRef.current.model = v;
        dirtyRef.current = true;
        queueSave(true);
    };
    const updateCategory = (id) => { setCategoryId(id); stateRef.current.categoryId = id; dirtyRef.current = true; queueSave(true); };
    const createCategory = async (name) => {
        const trimmed = name?.trim();
        if (!trimmed) return null;
        try {
            const res = await authFetch(`${API_BASE}/agents/categories`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: trimmed }),
            });
            if (!res.ok) throw new Error(await res.text());
            const created = await res.json();
            setCategories(prev => [...prev, created]);
            updateCategory(created.id);
            return created;
        } catch (err) {
            alert(err.message || 'Failed to create category');
            return null;
        }
    };

    // Behavior toggles
    const toggleAllowCopy = () => {
        const next = !allowCopy;
        setAllowCopy(next);
        patchConfig({ allowCopy: next });
    };
    const toggleDisableExternalTools = () => {
        const next = !disableExternalTools;
        setDisableExternalTools(next);
        patchConfig({ disableExternalTools: next });
    };
    const toggleEmbedEnabled = () => {
        const next = !embedEnabled;
        setEmbedEnabled(next);
        // embed_enabled is a top-level column on the agent table.
        stateRef.current.embedEnabled = next;
        dirtyRef.current = true;
        queueSave(true);
    };

    // Publishing — uses the dedicated PATCH /agents/:id/publish endpoint instead
    // of the canonical PUT, since publish state lives in a column the regular
    // update path doesn't touch.
    const callPublish = async (next, groups) => {
        const id = agentIdRef.current;
        if (!id) return;
        try {
            const res = await authFetch(`${API_BASE}/agents/${id}/publish`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isPublished: next, sharedGroups: groups }),
            });
            if (!res.ok) throw new Error(await res.text());
            setIsPublished(next);
            setSharedGroups(groups);
        } catch (err) {
            console.error('Publish toggle failed:', err);
            alert(err.message);
        }
    };
    const togglePublishedToOrg = () => {
        // "Publish to entire organisation" → empty sharedGroups.
        callPublish(!isPublished, []);
    };
    const togglePublishGroup = (gid) => {
        const next = sharedGroups.includes(gid) ? sharedGroups.filter(x => x !== gid) : [...sharedGroups, gid];
        // Setting any group implies published=true.
        callPublish(true, next);
    };

    // Knowledge — link / unlink an existing KB into the agent's array.
    const toggleKbLink = (kbId) => {
        const next = knowledgeBaseIds.includes(kbId)
            ? knowledgeBaseIds.filter(x => x !== kbId)
            : [...knowledgeBaseIds, kbId];
        setKnowledgeBaseIds(next);
        patchConfig({ knowledge_base_ids: next });
    };
    const [allKbs, setAllKbs] = useState([]);
    const refreshKbs = useCallback(async () => {
        try {
            const res = await authFetch(`${API_BASE}/api/kb`);
            if (res.ok) setAllKbs(await res.json());
        } catch (_) { /* ignore */ }
    }, []);
    useEffect(() => { refreshKbs(); }, [refreshKbs]);
    const createKb = async (name, description) => {
        try {
            const res = await authFetch(`${API_BASE}/api/kb`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, description }),
            });
            if (!res.ok) throw new Error(await res.text());
            const created = await res.json();
            await refreshKbs();
            // Auto-link the new KB.
            const next = [...knowledgeBaseIds, created.id];
            setKnowledgeBaseIds(next);
            patchConfig({ knowledge_base_ids: next });
            return created;
        } catch (err) {
            alert(err.message);
            return null;
        }
    };

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
                    modelTier: selectedTier || tier || 'fast',
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

            // Routine action: when the LLM detected a clear scheduling intent
            // and the user has the agent_routines beta, create the routine
            // for this agent and surface a confirmation in the chat.
            if (updated.routine && routinesAllowed && agent?.id) {
                try {
                    const r = updated.routine;
                    // Compute a sensible nextRunAt the server expects.
                    const now = new Date();
                    let nextRunAt = null;
                    if (r.repeatInterval === 'hourly') {
                        const next = new Date(now);
                        next.setHours(next.getHours() + 1);
                        next.setMinutes(0); next.setSeconds(0); next.setMilliseconds(0);
                        nextRunAt = next.toISOString();
                    } else {
                        const [hh, mm] = (r.timeOfDay || '08:00').split(':').map(n => parseInt(n, 10) || 0);
                        const next = new Date(now);
                        next.setHours(hh, mm, 0, 0);
                        if (next <= now) next.setDate(next.getDate() + 1);
                        if (Array.isArray(r.daysOfWeek) && r.daysOfWeek.length > 0) {
                            const tokens = ['sun','mon','tue','wed','thu','fri','sat'];
                            const allowed = new Set(r.daysOfWeek);
                            for (let i = 0; i < 7; i += 1) {
                                if (allowed.has(tokens[next.getDay()])) break;
                                next.setDate(next.getDate() + 1);
                            }
                        }
                        nextRunAt = next.toISOString();
                    }
                    const createRes = await authFetch(`${API_BASE}/api/ai-tasks`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            agentId: agent.id,
                            title: r.title,
                            prompt: r.prompt,
                            repeatInterval: r.repeatInterval,
                            daysOfWeek: r.daysOfWeek,
                            timeOfDay: r.timeOfDay,
                            timezone: r.timezone || (Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'),
                            nextRunAt,
                        }),
                    });
                    if (createRes.ok) {
                        await refreshAgentRoutines();
                        setChat(prev => [...prev, { role: 'system', content: `⏰ Created routine "${r.title}" — ${r.repeatInterval}${r.timeOfDay ? ` at ${r.timeOfDay}` : ''}.` }]);
                    }
                } catch (_) { /* non-fatal — chat already shows the plan update */ }
            }
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
                    {chat.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-center px-2">
                            <div className="w-10 h-10 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center mb-3">
                                <Sparkles size={18} className="text-[var(--accent)]" />
                            </div>
                            <div className="text-sm font-medium text-[var(--text-primary)] mb-1">
                                {t('agent_wizard.builder.chat_empty_title')}
                            </div>
                            <div className="text-xs text-[var(--text-tertiary)] mb-5 max-w-[260px]">
                                {t('agent_wizard.builder.chat_empty_subtitle')}
                            </div>
                            <div className="flex flex-col gap-2 w-full max-w-[300px]">
                                {[
                                    'agent_wizard.builder.chat_prompt_tone',
                                    'agent_wizard.builder.chat_prompt_steps',
                                    'agent_wizard.builder.chat_prompt_constraint',
                                ].map((key) => (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => setChatInput(t(key))}
                                        className="text-left text-xs px-3 py-2 rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
                                    >
                                        {t(key)}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
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
                        if (m.role === 'system') {
                            return (
                                <div key={i} className="text-xs px-3 py-2 rounded-lg bg-[var(--bg-secondary)] text-[var(--text-secondary)] inline-block">
                                    {m.content}
                                </div>
                            );
                        }
                        return <div key={i} className="text-sm text-[var(--text-secondary)]">{m.content}</div>;
                    })}
                </div>
                <div className="p-3 border-t border-[var(--border-default)]">
                    {/* Visual parity with direct chat InputArea: textarea on top,
                        action icon row + tier pill + send on the bottom. The icons
                        open the same wizard pickers when relevant; placeholder
                        icons (paperclip / globe) are visual-only for parity. */}
                    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 pt-3 pb-2">
                        <textarea
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleRefine(); } }}
                            placeholder={t('agent_wizard.builder.chat_placeholder')}
                            className="w-full bg-transparent outline-none text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] resize-none"
                            rows={1}
                            disabled={chatBusy}
                        />
                        <div className="flex items-center justify-between mt-2">
                            <div className="flex items-center gap-1 text-[var(--text-tertiary)]">
                                <button
                                    onClick={() => setKnowledgeOpen(true)}
                                    className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                                    title={t('agent_wizard.builder.upload_files')}
                                >
                                    <Paperclip size={16} />
                                </button>
                                <button
                                    className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-colors opacity-60 cursor-default"
                                    title="Web"
                                    type="button"
                                >
                                    <Globe size={16} />
                                </button>
                                <button
                                    onClick={() => setKnowledgeOpen(true)}
                                    className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                                    title={t('agent_wizard.builder.upload_files')}
                                >
                                    <BookOpen size={16} />
                                </button>
                                <button
                                    onClick={() => setSkillPickerOpen(v => !v)}
                                    className={`p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-colors ${skillPickerOpen ? 'text-[var(--accent)]' : ''}`}
                                    title={t('agent_wizard.builder.add_skill')}
                                >
                                    <PuzzlePiece size={16} />
                                </button>
                                <button
                                    onClick={() => setAppsPickerOpen(v => !v)}
                                    className={`p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-colors ${appsPickerOpen ? 'text-[var(--accent)]' : ''}`}
                                    title={t('agent_wizard.builder.browse_apps')}
                                >
                                    <LayoutGrid size={16} />
                                </button>
                            </div>
                            <div className="flex items-center gap-2">
                                <ModelTierSelector
                                    tiers={tiers || {}}
                                    value={selectedTier}
                                    // Single source of truth: changing the chat-input pill
                                    // also persists to the agent's saved tier so the two
                                    // selectors stay in lockstep.
                                    onChange={(v) => updateModel(v)}
                                    dropDirection="up"
                                />
                                <button
                                    onClick={handleRefine}
                                    disabled={chatBusy || !chatInput.trim()}
                                    className="w-8 h-8 rounded-full bg-[var(--text-primary)] text-[var(--bg-primary)] flex items-center justify-center disabled:opacity-30"
                                    title={t('agent_wizard.builder.send') || 'Send'}
                                >
                                    {chatBusy ? <span className="text-xs">…</span> : <ArrowUp size={14} />}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Right config panel */}
            <main className="flex-1 overflow-y-auto">
                <div className="flex items-center justify-end gap-3 px-8 py-3 relative">
                    <span className="text-xs text-[var(--text-tertiary)]">
                        {savingState === 'saving' && t('agent_wizard.builder.save_saving')}
                        {savingState === 'saved' && t('agent_wizard.builder.save_saved')}
                        {savingState === 'error' && t('agent_wizard.builder.save_error')}
                    </span>
                    {rightHeaderExtras}
                    <PublishMenu
                        t={t}
                        agent={agent}
                        open={publishPickerOpen}
                        onToggle={() => setPublishPickerOpen(v => !v)}
                        onClose={() => setPublishPickerOpen(false)}
                        isPublished={isPublished}
                        onTogglePublished={togglePublishedToOrg}
                        embedEnabled={embedEnabled}
                        orgGroups={orgGroups}
                        sharedGroups={sharedGroups}
                        onToggleGroup={togglePublishGroup}
                    />
                </div>

                <div className="max-w-4xl mx-auto px-10 pt-8 pb-12">
                    <div className="flex flex-col items-start gap-4 mb-8">
                        <AvatarPicker t={t} avatar={avatar} onChange={updateAvatar} />
                        <input
                            value={name}
                            onChange={(e) => updateName(e.target.value)}
                            onBlur={flushNow}
                            className="w-full text-4xl font-semibold bg-transparent outline-none text-[var(--text-primary)] py-1 -ml-1 px-1 rounded hover:bg-[var(--bg-secondary)]/40 focus:bg-[var(--bg-secondary)]/40 transition truncate"
                            placeholder={t('agent_wizard.builder.name_placeholder')}
                        />
                        {(detailsOpen || description || categoryId) ? (
                            <div className="w-full grid grid-cols-1 sm:grid-cols-[1fr,240px] gap-3">
                                <div>
                                    <div className="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)] mb-1">
                                        {t('agent_wizard.builder.role_description_label') || 'Role description'}
                                    </div>
                                    <input
                                        value={description}
                                        onChange={(e) => updateDescription(e.target.value)}
                                        onBlur={flushNow}
                                        placeholder={t('agent_wizard.field.role_description_placeholder')}
                                        className="w-full bg-[var(--bg-secondary)]/40 border border-transparent hover:bg-[var(--bg-secondary)] focus:border-[var(--accent)] outline-none rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] transition"
                                    />
                                </div>
                                <div>
                                    <div className="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)] mb-1">
                                        {t('agent_wizard.builder.category_label') || 'Category'}
                                    </div>
                                    <CategoryField
                                        t={t}
                                        value={categoryId}
                                        categories={categories}
                                        onChange={updateCategory}
                                        onCreate={createCategory}
                                    />
                                </div>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setDetailsOpen(true)}
                                className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition flex items-center gap-1"
                            >
                                <Plus size={12} />
                                {t('agent_wizard.builder.add_details') || 'Add description & category'}
                            </button>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mb-8 relative">
                        <div className="mr-1">
                            <ModelTierSelector
                                tiers={tiers || {}}
                                value={selectedTier}
                                onChange={(v) => updateModel(v)}
                            />
                        </div>
                        <ActionPill
                            icon={<AppWindow size={14} />}
                            label={t('agent_wizard.builder.browse_apps')}
                            count={enabledIntegrationCount}
                            onClick={() => setAppsPickerOpen(v => !v)}
                            active={appsPickerOpen}
                        />
                        <ActionPill
                            icon={<Sparkles size={14} />}
                            label={t('agent_wizard.builder.add_skill')}
                            count={attachedSkillIds.length}
                            onClick={() => setSkillPickerOpen(v => !v)}
                            active={skillPickerOpen}
                        />
                        <ActionPill
                            icon={<Upload size={14} />}
                            label={t('agent_wizard.builder.upload_files')}
                            count={knowledgeBaseIds.length}
                            onClick={() => setKnowledgeOpen(true)}
                        />
                        {agent?.id && routinesAllowed && (
                            <ActionPill
                                icon={<Clock size={14} />}
                                label={t('routines.title') || 'Routines'}
                                count={agentRoutines.filter(r => r.isActive).length}
                                onClick={() => setRoutinesPickerOpen(v => !v)}
                                active={routinesPickerOpen}
                            />
                        )}
                        {agent?.id && (
                            <ActionPill
                                icon={<History size={14} />}
                                label={t('agent_wizard.section.versions') || 'Version History'}
                                onClick={() => setVersionPickerOpen(v => !v)}
                                active={versionPickerOpen}
                            />
                        )}
                        <ActionPill
                            icon={<Sliders size={14} />}
                            label={t('agent_wizard.builder.behavior') || 'Behavior'}
                            onClick={() => setBehaviorPickerOpen(v => !v)}
                            active={behaviorPickerOpen || memoryEnabled}
                        />

                        {behaviorPickerOpen && (
                            <BehaviorPicker
                                t={t}
                                agent={agent}
                                onClose={() => setBehaviorPickerOpen(false)}
                                allowCopy={allowCopy}
                                onToggleAllowCopy={toggleAllowCopy}
                                disableExternalTools={disableExternalTools}
                                onToggleDisableExternalTools={toggleDisableExternalTools}
                                embedEnabled={embedEnabled}
                                onToggleEmbedEnabled={toggleEmbedEnabled}
                                bubbleColor={bubbleColor}
                                onBubbleColor={updateBubbleColor}
                                bubblePosition={bubblePosition}
                                onBubblePosition={updateBubblePosition}
                                bubbleIcon={bubbleIcon}
                                onBubbleIcon={updateBubbleIcon}
                                memoryEnabled={memoryEnabled}
                                onToggleMemory={toggleMemory}
                                useGeneralMemory={useGeneralMemory}
                                onToggleUseGeneralMemory={toggleUseGeneralMemory}
                            />
                        )}
                        {versionPickerOpen && agent?.id && (
                            <VersionPicker
                                t={t}
                                agentId={agent.id}
                                onClose={() => setVersionPickerOpen(false)}
                                onRestore={handleVersionRestore}
                            />
                        )}
                        {routinesPickerOpen && agent?.id && routinesAllowed && (
                            <RoutinesPicker
                                t={t}
                                agent={agent}
                                routines={agentRoutines}
                                onClose={() => setRoutinesPickerOpen(false)}
                                onCreate={() => { setRoutinesPickerOpen(false); setRoutineModal({ mode: 'create' }); }}
                                onEdit={(r) => { setRoutinesPickerOpen(false); setRoutineModal({ mode: 'edit', routine: r }); }}
                                onToggle={async (r) => {
                                    try {
                                        await authFetch(`${API_BASE}/api/ai-tasks/${r.id}/toggle`, { method: 'POST' });
                                        await refreshAgentRoutines();
                                    } catch (_) { /* non-fatal */ }
                                }}
                                onRunNow={async (r) => {
                                    try {
                                        await authFetch(`${API_BASE}/api/ai-tasks/${r.id}/run-now`, { method: 'POST' });
                                        await refreshAgentRoutines();
                                    } catch (_) { /* non-fatal */ }
                                }}
                                onDelete={async (r) => {
                                    if (!window.confirm(`${t('routines.delete_title')}: "${r.title}"?`)) return;
                                    try {
                                        await authFetch(`${API_BASE}/api/ai-tasks/${r.id}`, { method: 'DELETE' });
                                        await refreshAgentRoutines();
                                    } catch (_) { /* non-fatal */ }
                                }}
                            />
                        )}
                        {skillPickerOpen && (
                            <SkillPicker
                                t={t}
                                skills={allSkills || []}
                                selectedIds={attachedSkillIds}
                                automations={automations}
                                search={skillSearch}
                                onSearch={setSkillSearch}
                                onClose={() => setSkillPickerOpen(false)}
                                onToggle={toggleSkill}
                                onCreate={async ({ name: skillName, description: skillDesc, instructions: skillInstr, automationId: skillAutomationId }) => {
                                    try {
                                        const res = await authFetch(`${API_BASE}/api/skills`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                                name: skillName,
                                                description: skillDesc,
                                                instructions: skillInstr,
                                                isShared: false,
                                                // When the skill is linked to an automation,
                                                // mark it dynamic-activation so the agent calls
                                                // it on demand instead of injecting a body.
                                                dynamicActivation: !!skillAutomationId,
                                                automationId: skillAutomationId || null,
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

                    <div className="mt-10">
                        <div className="text-xs uppercase tracking-wide text-[var(--text-tertiary)] mb-3">{t('agent_wizard.builder.instructions')}</div>
                        {instructionsEditing ? (
                            <textarea
                                ref={instructionsTextareaRef}
                                value={instructions}
                                onChange={(e) => updateInstructions(e.target.value)}
                                onBlur={() => { flushNow(); setInstructionsEditing(false); }}
                                rows={Math.max(12, (instructions.match(/\n/g) || []).length + 2)}
                                placeholder={t('agent_wizard.builder.instructions_placeholder')}
                                className="w-full bg-[var(--bg-secondary)]/50 border border-transparent focus:border-[var(--border-default)] rounded-xl px-4 py-3 text-[15px] leading-7 text-[var(--text-primary)] outline-none resize-y"
                            />
                        ) : (
                            <div
                                role="button"
                                tabIndex={0}
                                onClick={() => setInstructionsEditing(true)}
                                onFocus={() => setInstructionsEditing(true)}
                                className="instructions-view min-h-[12rem] px-4 py-3 -mx-4 cursor-text rounded-xl hover:bg-[var(--bg-secondary)]/40 transition"
                                title={t('agent_wizard.builder.instructions_edit_hint') || 'Click to edit'}
                            >
                                {instructions ? (
                                    <MarkdownRenderer content={instructions} />
                                ) : (
                                    <div className="text-[var(--text-tertiary)] text-[15px] leading-7">
                                        {t('agent_wizard.builder.instructions_placeholder')}
                                    </div>
                                )}
                            </div>
                        )}
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
                    includeSourceReferences={includeSourceReferences}
                    onIncludeSourceReferencesChange={onIncludeSourceReferencesChange}
                    allKbs={allKbs}
                    onToggleKbLink={toggleKbLink}
                    onCreateKb={createKb}
                    onClose={() => setKnowledgeOpen(false)}
                />
            )}
            {routineModal && agent?.id && routinesAllowed && (
                <RoutineModal
                    t={t}
                    agent={agent}
                    initialRoutine={routineModal.mode === 'edit' ? routineModal.routine : null}
                    onClose={() => setRoutineModal(null)}
                    onSaved={async () => {
                        setRoutineModal(null);
                        await refreshAgentRoutines();
                    }}
                />
            )}
        </div>
    );
}

function SkillPicker({ skills, selectedIds, automations = [], search, onSearch, onClose, onToggle, onCreate, t }) {
    const [creating, setCreating] = useState(false);
    const [newName, setNewName] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [newInstr, setNewInstr] = useState('');
    const [newAutomationId, setNewAutomationId] = useState('');
    const [busy, setBusy] = useState(false);
    const filtered = (skills || []).filter(s =>
        !search || (s.name || '').toLowerCase().includes(search.toLowerCase())
    );

    const submit = async () => {
        if (!newName.trim() || busy) return;
        setBusy(true);
        const created = await onCreate({
            name: newName.trim(),
            description: newDesc.trim(),
            instructions: newInstr.trim(),
            automationId: newAutomationId || null,
        });
        setBusy(false);
        if (created) {
            setNewName(''); setNewDesc(''); setNewInstr(''); setNewAutomationId(''); setCreating(false);
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
                                        <div className="text-sm text-[var(--text-primary)] truncate flex items-center gap-1.5">
                                            {s.name}
                                            {s.automationId && (
                                                <span title={t('agent_wizard.skills.linked_automation') || 'Linked to an automation'} className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] flex items-center gap-1">
                                                    <Sparkles size={10} /> Flow
                                                </span>
                                            )}
                                        </div>
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
                    {!newAutomationId && (
                        <textarea
                            value={newInstr}
                            onChange={(e) => setNewInstr(e.target.value)}
                            rows={4}
                            placeholder={t('agent_wizard.skills.field_instructions')}
                            className="w-full bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)] resize-y"
                        />
                    )}
                    {automations && automations.length > 0 && (
                        <div className="space-y-1">
                            <div className="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">
                                {t('agent_wizard.skills.linked_automation_label') || 'Linked automation (optional)'}
                            </div>
                            <select
                                value={newAutomationId}
                                onChange={(e) => setNewAutomationId(e.target.value)}
                                className="w-full bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)] cursor-pointer"
                            >
                                <option value="">{t('agent_wizard.skills.linked_automation_none') || '— No automation, use instructions above —'}</option>
                                {automations.map(a => (
                                    <option key={a.id} value={a.id}>{a.title || '(untitled)'}</option>
                                ))}
                            </select>
                            {newAutomationId && (
                                <div className="text-[11px] text-[var(--text-tertiary)] pl-1">
                                    {t('agent_wizard.skills.linked_automation_help') || 'When the agent activates this skill, the linked automation runs and its result is returned to the agent.'}
                                </div>
                            )}
                        </div>
                    )}
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
    const [search, setSearch] = useState('');
    const [focusedId, setFocusedId] = useState(items[0]?.id || null);
    const filtered = items.filter(it =>
        !search.trim() || it.label.toLowerCase().includes(search.toLowerCase()) || (it.description || '').toLowerCase().includes(search.toLowerCase())
    );
    useEffect(() => {
        if (filtered.length && !filtered.some(it => it.id === focusedId)) {
            setFocusedId(filtered[0].id);
        }
    }, [filtered, focusedId]);
    const focused = items.find(it => it.id === focusedId) || filtered[0] || null;
    const focusedSelected = focused ? isSelected(focused.id) : false;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
            onClick={onClose}
        >
            <div
                className="w-full max-w-3xl h-[560px] rounded-2xl border border-[var(--border-default)] bg-[var(--bg-primary)] shadow-2xl overflow-hidden flex"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Left: search + list */}
                <div className="w-[40%] flex flex-col border-r border-[var(--border-default)]">
                    <div className="p-3">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder={t('agent_wizard.apps.search') || 'Search apps'}
                                className="w-full bg-[var(--bg-secondary)] rounded-full pl-9 pr-3 py-2 text-sm outline-none text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
                                autoFocus
                            />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto px-2 pb-2">
                        {filtered.length === 0 && (
                            <div className="text-xs text-[var(--text-tertiary)] text-center py-6">—</div>
                        )}
                        {filtered.map((item) => {
                            const isFocus = item.id === focusedId;
                            const selected = isSelected(item.id);
                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => setFocusedId(item.id)}
                                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm transition ${isFocus ? 'bg-[var(--bg-secondary)]' : 'hover:bg-[var(--bg-secondary)]/60'}`}
                                >
                                    <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">{item.iconSvg}</div>
                                    <span className="truncate flex-1 text-[var(--text-primary)]">{item.label}</span>
                                    {selected && <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" aria-label="enabled" />}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Right: detail pane */}
                <div className="flex-1 flex flex-col relative">
                    <button
                        onClick={onClose}
                        className="absolute top-3 right-3 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] z-10"
                        aria-label="Close"
                    >
                        <X size={18} />
                    </button>
                    {focused ? (
                        <>
                            <div className="flex-1 overflow-y-auto px-8 pt-10 pb-4">
                                <div className="w-14 h-14 rounded-2xl border border-[var(--border-default)] flex items-center justify-center mb-5">
                                    <div className="w-9 h-9 flex items-center justify-center">{focused.iconSvg}</div>
                                </div>
                                <h3 className="text-2xl font-semibold text-[var(--text-primary)] mb-3">{focused.label}</h3>
                                <p className="text-sm text-[var(--text-secondary)] leading-6">
                                    {focused.description || t('agent_wizard.apps.no_description') || 'No description available.'}
                                </p>
                            </div>
                            <div className="px-8 pb-6 pt-3">
                                <button
                                    type="button"
                                    onClick={() => onToggle(focused.id)}
                                    className={`w-full py-3 rounded-full text-sm font-medium transition ${focusedSelected
                                        ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                                        : 'bg-[var(--text-primary)] text-[var(--bg-primary)] hover:opacity-90'}`}
                                >
                                    {focusedSelected
                                        ? (t('agent_wizard.apps.disable') || 'Disable')
                                        : (t('agent_wizard.apps.enable') || 'Enable')}
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-sm text-[var(--text-tertiary)]">—</div>
                    )}
                </div>
            </div>
        </div>
    );
}

function FilesUploadModal({ t, agent, knowledgeBaseIds, onKnowledgeBaseIdsChange, strictKnowledge, onStrictKnowledgeChange, includeSourceReferences, onIncludeSourceReferencesChange, allKbs, onToggleKbLink, onCreateKb, onClose }) {
    // Primary KB = the auto-created KB at wizard/commit time, or the first linked KB.
    const initialKbId = agent?.config?.wizard?.primaryKbId || knowledgeBaseIds?.[0] || null;
    const [kbId, setKbId] = useState(initialKbId);
    const [docs, setDocs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState(null);
    const [dragOver, setDragOver] = useState(false);

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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <label className="flex items-start gap-3 px-3 py-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] cursor-pointer">
                            <input type="checkbox" checked={!!strictKnowledge} onChange={(e) => onStrictKnowledgeChange(e.target.checked)} className="mt-1" />
                            <div>
                                <div className="text-sm text-[var(--text-primary)]">{t('agent_wizard.files.strict_label')}</div>
                                <div className="text-xs text-[var(--text-tertiary)]">{t('agent_wizard.files.strict_help')}</div>
                            </div>
                        </label>
                        <label className="flex items-start gap-3 px-3 py-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] cursor-pointer">
                            <input type="checkbox" checked={!!includeSourceReferences} onChange={(e) => onIncludeSourceReferencesChange?.(e.target.checked)} className="mt-1" />
                            <div>
                                <div className="text-sm text-[var(--text-primary)]">{t('agent_wizard.knowledge.sources_label')}</div>
                                <div className="text-xs text-[var(--text-tertiary)]">{t('agent_wizard.knowledge.sources_help')}</div>
                            </div>
                        </label>
                    </div>

                    {Array.isArray(allKbs) && (
                        <div>
                            <div className="text-xs uppercase tracking-wide text-[var(--text-tertiary)] mb-2">
                                {t('agent_wizard.knowledge.kbs') || 'Knowledge bases'} ({allKbs.length})
                            </div>
                            <KbList
                                t={t}
                                kbs={allKbs}
                                linkedIds={knowledgeBaseIds}
                                onToggle={onToggleKbLink}
                                onCreate={onCreateKb}
                            />
                        </div>
                    )}

                    <label
                        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={onDrop}
                        className={`block rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition ${dragOver ? 'border-[var(--accent)] bg-[var(--bg-secondary)]' : 'border-[var(--border-default)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)]'}`}
                    >
                        <Upload className="mx-auto mb-2 text-[var(--text-tertiary)]" size={24} />
                        <div className="text-sm text-[var(--text-primary)]">{t('agent_wizard.files.drop_here')}</div>
                        <div className="text-xs text-[var(--text-tertiary)] mt-1">{t('agent_wizard.files.click_or_drag')}</div>
                        <input
                            type="file"
                            multiple
                            className="hidden"
                            onChange={(e) => { uploadFiles(Array.from(e.target.files || [])); e.target.value = ''; }}
                        />
                    </label>

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

function ActionPill({ icon, label, count, onClick, active }) {
    return (
        <button
            onClick={onClick}
            className={`group flex items-center gap-2 pl-3.5 pr-3 py-1.5 rounded-full text-sm transition ${active ? 'bg-[var(--accent)]/10 text-[var(--accent)]' : 'bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'}`}
        >
            <span className={active ? '' : 'text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]'}>{icon}</span>
            <span>{label}</span>
            {(count !== undefined && count !== null && count > 0) && (
                <span className={`ml-0.5 text-xs ${active ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)]'}`}>
                    {count}
                </span>
            )}
        </button>
    );
}

function CopyField({ value, t }) {
    const [copied, setCopied] = useState(false);
    const onCopy = async () => {
        try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch (_) { /* ignore */ }
    };
    return (
        <div className="flex gap-2">
            <input
                readOnly
                value={value}
                onFocus={(e) => e.target.select()}
                className="flex-1 min-w-0 text-xs font-mono px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-default)] text-[var(--text-secondary)] outline-none"
            />
            <button
                type="button"
                onClick={onCopy}
                className="px-3 py-2 text-xs rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] transition flex items-center gap-1.5"
                title={t('agent_wizard.embed.copy') || 'Copy'}
            >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? (t('agent_wizard.embed.copied') || 'Copied') : (t('agent_wizard.embed.copy') || 'Copy')}
            </button>
        </div>
    );
}

function CategoryField({ t, value, categories, onChange, onCreate }) {
    const [creating, setCreating] = useState(false);
    const [draft, setDraft] = useState('');
    const inputRef = useRef(null);
    useEffect(() => { if (creating) inputRef.current?.focus(); }, [creating]);
    const submit = async () => {
        const name = draft.trim();
        if (!name) { setCreating(false); return; }
        const created = await onCreate(name);
        if (created) { setDraft(''); setCreating(false); }
    };
    if (creating) {
        return (
            <div className="flex gap-1">
                <input
                    ref={inputRef}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); submit(); }
                        if (e.key === 'Escape') { setDraft(''); setCreating(false); }
                    }}
                    placeholder={t('agent_wizard.builder.category_new_placeholder') || 'New category name'}
                    className="flex-1 min-w-0 bg-[var(--bg-secondary)]/40 border border-[var(--accent)] outline-none rounded-lg px-3 py-2 text-sm text-[var(--text-primary)]"
                />
                <button type="button" onClick={submit} className="px-3 py-2 rounded-lg bg-[var(--accent)] text-white text-xs font-medium hover:opacity-90 transition">
                    {t('agent_wizard.builder.category_create') || 'Create'}
                </button>
                <button type="button" onClick={() => { setDraft(''); setCreating(false); }} className="px-2 py-2 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition">
                    <X size={14} />
                </button>
            </div>
        );
    }
    return (
        <div className="flex gap-1">
            <select
                value={value || ''}
                onChange={(e) => onChange(e.target.value || null)}
                className="flex-1 min-w-0 bg-[var(--bg-secondary)]/40 border border-transparent hover:bg-[var(--bg-secondary)] focus:border-[var(--accent)] outline-none rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] transition cursor-pointer"
            >
                <option value="">{t('agent_wizard.field.category_none')}</option>
                {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                ))}
            </select>
            <button
                type="button"
                onClick={() => setCreating(true)}
                className="px-2.5 py-2 rounded-lg bg-[var(--bg-secondary)]/40 hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
                title={t('agent_wizard.builder.category_new') || 'New category'}
            >
                <Plus size={14} />
            </button>
        </div>
    );
}

const ROUTINE_DOW_TOKENS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const ROUTINE_DOW_LABELS = { sun: 'Sun', mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat' };
function formatRoutineNextRun(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    const now = new Date();
    const diffMs = d - now;
    const sameDay = d.toDateString() === now.toDateString();
    const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = d.toDateString() === tomorrow.toDateString();
    const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    if (diffMs < 0) return `Overdue (${d.toLocaleString()})`;
    if (sameDay) return `Today at ${time}`;
    if (isTomorrow) return `Tomorrow at ${time}`;
    return d.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function RoutinesPicker({ t, agent, routines, onClose, onCreate, onEdit, onToggle, onRunNow, onDelete }) {
    const popoverRef = useRef(null);
    useEffect(() => {
        const onDoc = (e) => { if (!popoverRef.current?.contains(e.target)) onClose(); };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [onClose]);
    return (
        <div
            ref={popoverRef}
            className="absolute z-30 top-full left-0 mt-2 w-[440px] max-h-[70vh] overflow-y-auto rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)] shadow-xl"
        >
            <div className="px-4 py-3 border-b border-[var(--border-default)] flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[var(--text-primary)]">{t('routines.title') || 'Routines'}</span>
                    <span className="text-[10px] uppercase tracking-wide font-medium px-1.5 py-0.5 rounded-full bg-[var(--accent)]/15 text-[var(--accent)]">
                        {t('routines.beta_badge') || 'Beta'}
                    </span>
                </div>
                <button onClick={onClose} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"><X size={14} /></button>
            </div>
            <div className="p-3">
                <button
                    type="button"
                    onClick={onCreate}
                    className="w-full mb-2 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[var(--accent)]/10 hover:bg-[var(--accent)]/20 text-[var(--accent)] text-sm font-medium transition"
                >
                    <Plus size={14} /> {t('routines.new') || 'New routine'}
                </button>
                {routines.length === 0 ? (
                    <div className="text-xs text-[var(--text-tertiary)] py-6 text-center">
                        {t('routines.no_routines_for_agent') || 'No routines yet for this agent.'}
                    </div>
                ) : (
                    <div className="divide-y divide-[var(--border-default)]">
                        {routines.map((r) => (
                            <div key={r.id} className="py-2 flex items-start gap-2">
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm text-[var(--text-primary)] truncate">{r.title}</div>
                                    <div className="text-[11px] text-[var(--text-tertiary)] truncate">
                                        {r.isActive
                                            ? `${t('routines.scheduled_for') || 'Scheduled for'}: ${formatRoutineNextRun(r.nextRunAt)}`
                                            : (t('routines.paused') || 'Paused')}
                                    </div>
                                </div>
                                <div className="flex items-center gap-0.5 flex-shrink-0">
                                    <button onClick={() => onRunNow(r)} title={t('routines.run_now') || 'Run now'} className="p-1.5 rounded hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition">
                                        <Play size={13} />
                                    </button>
                                    <button onClick={() => onToggle(r)} title={r.isActive ? 'Pause' : 'Resume'} className="p-1.5 rounded hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition">
                                        {r.isActive ? <Pause size={13} /> : <Play size={13} />}
                                    </button>
                                    <button onClick={() => onEdit(r)} title={t('routines.edit') || 'Edit'} className="p-1.5 rounded hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition">
                                        <Sliders size={13} />
                                    </button>
                                    <button onClick={() => onDelete(r)} title="Delete" className="p-1.5 rounded hover:bg-red-500/10 text-[var(--text-tertiary)] hover:text-red-500 transition">
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function RoutineModal({ t, agent, initialRoutine, onClose, onSaved }) {
    const isEdit = !!initialRoutine;
    // `mode` maps directly to the server's repeatInterval value, plus 'hourly'
    // which the UI special-cases (hours-N input instead of day picker).
    const [mode, setMode] = useState(() => initialRoutine?.repeatInterval || 'daily');
    const [title, setTitle] = useState(initialRoutine?.title || '');
    const [prompt, setPrompt] = useState(initialRoutine?.prompt || '');
    const [hours, setHours] = useState(1);
    const [daysOfWeek, setDaysOfWeek] = useState(() => {
        if (Array.isArray(initialRoutine?.daysOfWeek) && initialRoutine.daysOfWeek.length > 0) return initialRoutine.daysOfWeek;
        return ['mon', 'tue', 'wed', 'thu', 'fri'];
    });
    // Day of month for Monthly mode (1-28 to dodge Feb edge cases).
    const [dayOfMonth, setDayOfMonth] = useState(() => {
        if (initialRoutine?.repeatInterval === 'monthly' && initialRoutine?.nextRunAt) {
            return new Date(initialRoutine.nextRunAt).getDate();
        }
        return 1;
    });
    const [time, setTime] = useState(initialRoutine?.timeOfDay || '08:00');
    const [timezone, setTimezone] = useState(initialRoutine?.timezone || (Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'));
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    // 'daily' / 'weekdays' / 'weekly' / 'biweekly' all use the day-of-week picker.
    const usesDayPicker = mode === 'daily' || mode === 'weekdays' || mode === 'weekly' || mode === 'biweekly';
    const usesDayOfMonth = mode === 'monthly';

    const toggleDay = (d) => {
        setDaysOfWeek(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
    };

    // Compute the next run as an ISO timestamp the server expects.
    const computeNextRun = () => {
        const now = new Date();
        if (mode === 'hourly') {
            const next = new Date(now);
            next.setHours(next.getHours() + Number(hours || 1));
            next.setMinutes(0); next.setSeconds(0); next.setMilliseconds(0);
            return next.toISOString();
        }
        const [hh, mm] = (time || '08:00').split(':').map(n => parseInt(n, 10));
        if (usesDayOfMonth) {
            const next = new Date(now.getFullYear(), now.getMonth(), Math.max(1, Math.min(28, Number(dayOfMonth) || 1)), hh || 0, mm || 0, 0, 0);
            if (next <= now) next.setMonth(next.getMonth() + 1);
            return next.toISOString();
        }
        // Day-of-week modes — pick the next occurrence at `time` on a permitted day.
        const allowedTokens = mode === 'weekdays' ? ['mon','tue','wed','thu','fri'] : daysOfWeek;
        const next = new Date(now);
        next.setHours(hh || 0, mm || 0, 0, 0);
        if (next <= now) next.setDate(next.getDate() + 1);
        if (Array.isArray(allowedTokens) && allowedTokens.length > 0) {
            const allowed = new Set(allowedTokens);
            for (let i = 0; i < 7; i += 1) {
                if (allowed.has(ROUTINE_DOW_TOKENS[next.getDay()])) break;
                next.setDate(next.getDate() + 1);
            }
        }
        return next.toISOString();
    };

    const submit = async () => {
        setError(null);
        if (!title.trim()) { setError('Title is required'); return; }
        if (!prompt.trim()) { setError('Prompt is required'); return; }
        setBusy(true);
        try {
            const body = {
                title: title.trim(),
                prompt: prompt.trim(),
                repeatInterval: mode,
                // Only send the day picker payload for modes that consume it.
                // Weekdays mode is encoded by `repeatInterval='weekdays'` server-side
                // so we leave daysOfWeek null to avoid ambiguity.
                daysOfWeek: (mode === 'daily' || mode === 'weekly' || mode === 'biweekly') ? daysOfWeek : null,
                timeOfDay: mode === 'hourly' ? null : time,
                timezone,
                nextRunAt: computeNextRun(),
            };
            if (!isEdit) body.agentId = agent.id;
            const url = isEdit
                ? `${API_BASE}/api/ai-tasks/${initialRoutine.id}`
                : `${API_BASE}/api/ai-tasks`;
            const res = await authFetch(url, {
                method: isEdit ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!res.ok) throw new Error(await res.text());
            onSaved();
        } catch (err) {
            setError(err.message || 'Save failed');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
            <div
                className="w-full max-w-md rounded-2xl border border-[var(--border-default)] bg-[var(--bg-primary)] shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-default)]">
                    <span className="text-base font-semibold text-[var(--text-primary)]">
                        {isEdit ? (t('routines.edit') || 'Edit routine') : (t('routines.new') || 'New routine')}
                    </span>
                    <button onClick={onClose} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"><X size={18} /></button>
                </div>
                <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
                    {/* Repeat cadence picker — drives which body fields show. */}
                    <div>
                        <div className="text-xs uppercase tracking-wide text-[var(--text-tertiary)] mb-1.5">
                            {t('routines.repeat') || 'Repeat'}
                        </div>
                        <select
                            value={mode}
                            onChange={(e) => setMode(e.target.value)}
                            className="w-full bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--text-primary)] cursor-pointer"
                        >
                            <option value="hourly">Hourly</option>
                            <option value="daily">Daily</option>
                            <option value="weekdays">Weekdays (Mon–Fri)</option>
                            <option value="weekly">Weekly</option>
                            <option value="biweekly">Every 2 weeks</option>
                            <option value="monthly">Monthly</option>
                        </select>
                    </div>

                    {/* Hourly mode */}
                    {mode === 'hourly' && (
                        <div>
                            <div className="text-xs uppercase tracking-wide text-[var(--text-tertiary)] mb-1.5">
                                {t('routines.run_every') || 'Run every'}
                            </div>
                            <select
                                value={hours}
                                onChange={(e) => setHours(parseInt(e.target.value, 10))}
                                className="w-full bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--text-primary)] cursor-pointer"
                            >
                                {[1, 2, 3, 4, 6, 8, 12, 24].map(n => (
                                    <option key={n} value={n}>{n === 1 ? (t('routines.hour_one') || '1 hour') : `${n} hours`}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Day-of-week picker — only for cadences that select specific weekdays.
                        Weekdays mode is implicit (Mon–Fri) and skips the picker. */}
                    {usesDayPicker && mode !== 'weekdays' && (
                        <div>
                            <div className="text-xs uppercase tracking-wide text-[var(--text-tertiary)] mb-1.5">
                                {mode === 'daily' ? (t('routines.run_every') || 'Run every') : 'Day of week'}
                            </div>
                            <div className="flex gap-1">
                                {ROUTINE_DOW_TOKENS.map(d => {
                                    const active = daysOfWeek.includes(d);
                                    return (
                                        <button
                                            key={d}
                                            type="button"
                                            onClick={() => toggleDay(d)}
                                            className={`flex-1 py-1.5 rounded-full text-xs font-medium transition border ${active
                                                ? 'bg-[var(--text-primary)] text-[var(--bg-primary)] border-transparent'
                                                : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] border-[var(--border-default)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]'}`}
                                        >
                                            {ROUTINE_DOW_LABELS[d]}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Day-of-month — only for Monthly mode. Capped at 28 so every month fires. */}
                    {usesDayOfMonth && (
                        <div>
                            <div className="text-xs uppercase tracking-wide text-[var(--text-tertiary)] mb-1.5">
                                Day of month
                            </div>
                            <select
                                value={dayOfMonth}
                                onChange={(e) => setDayOfMonth(parseInt(e.target.value, 10))}
                                className="w-full bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--text-primary)] cursor-pointer"
                            >
                                {Array.from({ length: 28 }, (_, i) => i + 1).map(n => (
                                    <option key={n} value={n}>Day {n}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Time + timezone — shown for every non-hourly cadence. */}
                    {mode !== 'hourly' && (
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <div className="text-xs uppercase tracking-wide text-[var(--text-tertiary)] mb-1.5">
                                    {t('routines.time') || 'Time'}
                                </div>
                                <input
                                    type="time"
                                    value={time}
                                    onChange={(e) => setTime(e.target.value)}
                                    className="w-full bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--text-primary)]"
                                />
                            </div>
                            <div>
                                <div className="text-xs uppercase tracking-wide text-[var(--text-tertiary)] mb-1.5">
                                    {t('routines.timezone') || 'Timezone'}
                                </div>
                                <input
                                    type="text"
                                    value={timezone}
                                    onChange={(e) => setTimezone(e.target.value)}
                                    className="w-full bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--text-primary)]"
                                />
                            </div>
                        </div>
                    )}

                    <div>
                        <div className="text-xs uppercase tracking-wide text-[var(--text-tertiary)] mb-1.5">
                            {t('routines.task_name') || 'Routine name'}
                        </div>
                        <input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder={`e.g. Daily standup brief`}
                            className="w-full bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                        />
                    </div>
                    <div>
                        <div className="text-xs uppercase tracking-wide text-[var(--text-tertiary)] mb-1.5">
                            {t('routines.additional_instructions_optional') || 'Additional instructions (optional)'}
                        </div>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            rows={4}
                            placeholder={(t('routines.placeholder_what_should_agent_do') || 'What should {agent} do?').replace('{agent}', agent?.name || 'this agent')}
                            className="w-full bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)] resize-y"
                        />
                    </div>

                    {error && <div className="text-xs text-red-500">{error}</div>}
                </div>
                <div className="px-5 py-4 border-t border-[var(--border-default)] flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-full text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={submit}
                        disabled={busy}
                        className="px-5 py-2 rounded-full bg-[var(--text-primary)] text-[var(--bg-primary)] text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
                    >
                        {busy ? '…' : (isEdit ? 'Save changes' : (t('routines.add') || 'Add routine'))}
                    </button>
                </div>
            </div>
        </div>
    );
}

function VersionPicker({ t, agentId, onClose, onRestore }) {
    const popoverRef = useRef(null);
    useEffect(() => {
        const onDoc = (e) => { if (!popoverRef.current?.contains(e.target)) onClose(); };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [onClose]);
    return (
        <div
            ref={popoverRef}
            className="absolute z-30 top-full left-0 mt-2 w-[420px] max-h-[70vh] overflow-y-auto rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)] shadow-xl"
        >
            <div className="px-4 py-3 border-b border-[var(--border-default)] flex items-center justify-between">
                <span className="text-sm font-medium text-[var(--text-primary)]">{t('agent_wizard.section.versions') || 'Version History'}</span>
                <button onClick={onClose} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"><X size={14} /></button>
            </div>
            <div className="p-4">
                <VersionHistory agentId={agentId} onRestore={onRestore} />
            </div>
        </div>
    );
}

function BehaviorPicker({
    t, agent, onClose,
    allowCopy, onToggleAllowCopy,
    disableExternalTools, onToggleDisableExternalTools,
    embedEnabled, onToggleEmbedEnabled,
    bubbleColor, onBubbleColor,
    bubblePosition, onBubblePosition,
    bubbleIcon, onBubbleIcon,
    memoryEnabled, onToggleMemory,
    useGeneralMemory, onToggleUseGeneralMemory,
}) {
    const popoverRef = useRef(null);
    useEffect(() => {
        const onDoc = (e) => { if (!popoverRef.current?.contains(e.target)) onClose(); };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [onClose]);

    const publicUrl = agent?.id ? `${window.location.origin}/chat/${agent.id}` : '';
    const iframeSnippet = agent?.id
        ? `<iframe src="${publicUrl}" width="400" height="600" style="border:none;border-radius:12px;"></iframe>`
        : '';
    const ICONS = ['💬', '🐝', '🤖', '❓', '👋', '✨'];

    return (
        <div
            ref={popoverRef}
            className="absolute z-30 top-full left-0 mt-2 w-[460px] max-h-[70vh] overflow-y-auto rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)] shadow-xl"
        >
            <div className="px-4 py-3 border-b border-[var(--border-default)] flex items-center justify-between">
                <span className="text-sm font-medium text-[var(--text-primary)]">{t('agent_wizard.section.behavior') || 'Behavior'}</span>
                <button onClick={onClose} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"><X size={14} /></button>
            </div>
            <div className="p-4 space-y-4">
                <ToggleRow
                    label={t('agent_wizard.builder.memory') || 'Memory'}
                    help={t('agent_wizard.builder.memory_explainer')}
                    checked={memoryEnabled}
                    onChange={() => onToggleMemory()}
                />
                {memoryEnabled && (
                    <div className="pl-7 -mt-1">
                        <ToggleRow
                            label={t('agent_wizard.builder.memory_use_general_label')}
                            help={t('agent_wizard.builder.memory_use_general_help')}
                            checked={useGeneralMemory}
                            onChange={() => onToggleUseGeneralMemory()}
                        />
                    </div>
                )}
                <div className="border-t border-[var(--border-default)] -mx-4" />
                <ToggleRow
                    label={t('agent_wizard.behavior.allow_copy_label')}
                    help={t('agent_wizard.behavior.allow_copy_help')}
                    checked={allowCopy}
                    onChange={() => onToggleAllowCopy()}
                />
                <ToggleRow
                    label={t('agent_wizard.behavior.disable_external_label')}
                    help={t('agent_wizard.behavior.disable_external_help')}
                    checked={disableExternalTools}
                    onChange={() => onToggleDisableExternalTools()}
                />
                <ToggleRow
                    label={t('agent_wizard.behavior.embed_label')}
                    help={t('agent_wizard.behavior.embed_help')}
                    checked={embedEnabled}
                    onChange={() => onToggleEmbedEnabled()}
                />
                {embedEnabled && (
                    <div className="space-y-3 border-t border-[var(--border-default)] -mx-4 px-4 pt-4">
                        {agent?.id ? (
                            <>
                                <div>
                                    <div className="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)] mb-1.5">
                                        {t('agent_wizard.embed.public_url') || 'Public URL'}
                                    </div>
                                    <CopyField value={publicUrl} t={t} />
                                </div>
                                <div>
                                    <div className="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)] mb-1.5">
                                        {t('agent_wizard.embed.iframe') || 'Iframe snippet'}
                                    </div>
                                    <CopyField value={iframeSnippet} t={t} />
                                </div>
                            </>
                        ) : (
                            <div className="text-xs text-[var(--text-tertiary)] italic">
                                Save the agent first to get the embed URL.
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <div className="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)] mb-1.5">
                                    {t('agent_wizard.embed.bubble_color') || 'Bubble color'}
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="color"
                                        value={bubbleColor}
                                        onChange={(e) => onBubbleColor(e.target.value)}
                                        className="w-8 h-8 rounded-lg border-0 cursor-pointer p-0"
                                    />
                                    <input
                                        type="text"
                                        value={bubbleColor}
                                        onChange={(e) => onBubbleColor(e.target.value)}
                                        className="flex-1 min-w-0 text-xs font-mono px-2 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-default)] outline-none text-[var(--text-secondary)]"
                                    />
                                </div>
                            </div>
                            <div>
                                <div className="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)] mb-1.5">
                                    {t('agent_wizard.embed.position') || 'Position'}
                                </div>
                                <div className="flex gap-1">
                                    {['left', 'right'].map(pos => (
                                        <button
                                            key={pos}
                                            type="button"
                                            onClick={() => onBubblePosition(pos)}
                                            className={`flex-1 px-2 py-1.5 text-xs rounded-lg transition ${bubblePosition === pos
                                                ? 'bg-[var(--accent)]/10 text-[var(--accent)] font-medium'
                                                : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'}`}
                                        >
                                            {pos === 'left' ? '◀ Left' : 'Right ▶'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div>
                            <div className="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)] mb-1.5">
                                {t('agent_wizard.embed.icon') || 'Icon'}
                            </div>
                            <div className="flex gap-1">
                                {ICONS.map(icon => (
                                    <button
                                        key={icon}
                                        type="button"
                                        onClick={() => onBubbleIcon(icon)}
                                        className={`w-9 h-9 rounded-lg text-base flex items-center justify-center transition ${bubbleIcon === icon
                                            ? 'ring-2 ring-[var(--accent)] bg-[var(--bg-secondary)]'
                                            : 'bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)]'}`}
                                    >
                                        {icon}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function PublishMenu({ t, agent, open, onToggle, onClose, isPublished, onTogglePublished, embedEnabled, orgGroups, sharedGroups, onToggleGroup }) {
    const popoverRef = useRef(null);
    const triggerRef = useRef(null);
    useEffect(() => {
        if (!open) return;
        const onDoc = (e) => {
            if (popoverRef.current?.contains(e.target)) return;
            if (triggerRef.current?.contains(e.target)) return;
            onClose();
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [open, onClose]);

    const stateLabel = isPublished
        ? (t('agent_wizard.publish.update') || 'Update')
        : (t('agent_wizard.publish.publish') || 'Publish');

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                onClick={onToggle}
                className={`flex items-center gap-1.5 px-5 py-2 rounded-full text-sm font-semibold transition shadow-sm ${isPublished
                    ? 'bg-[var(--accent)]/15 text-[var(--accent)] ring-1 ring-[var(--accent)]/40 hover:bg-[var(--accent)]/25'
                    : 'bg-[var(--accent)] text-white hover:opacity-90 ring-1 ring-[var(--accent)]'}`}
            >
                {!isPublished && <Globe size={14} />}
                {stateLabel}
                <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
                <div
                    ref={popoverRef}
                    className="absolute z-30 right-8 top-full mt-1 w-[320px] rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)] shadow-xl overflow-hidden"
                >
                    <div className="px-4 py-3 border-b border-[var(--border-default)]">
                        <div className="text-sm font-medium text-[var(--text-primary)]">
                            {t('agent_wizard.section.publishing') || 'Publish'}
                        </div>
                        <div className="text-xs text-[var(--text-tertiary)] mt-0.5">
                            {isPublished
                                ? (t('agent_wizard.publish.live_help') || 'This agent is live in your workspace.')
                                : (t('agent_wizard.publish.draft_help') || 'Only you can use this agent right now.')}
                        </div>
                    </div>
                    <div className="p-3 space-y-3">
                        <ToggleRow
                            label={t('agent_wizard.publishing.published_label')}
                            help={t('agent_wizard.publishing.published_help')}
                            checked={isPublished}
                            onChange={onTogglePublished}
                        />
                        {isPublished && (
                            <div>
                                <div className="text-xs uppercase tracking-wide text-[var(--text-tertiary)] mb-1.5">
                                    {t('agent_wizard.publishing.groups')}
                                </div>
                                {orgGroups.length === 0 && (
                                    <div className="text-xs text-[var(--text-tertiary)]">{t('agent_wizard.publishing.no_groups')}</div>
                                )}
                                <div className="space-y-1 max-h-40 overflow-y-auto">
                                    {orgGroups.map(g => {
                                        const checked = sharedGroups.includes(g.id);
                                        return (
                                            <label key={g.id} className="flex items-center gap-2 text-sm cursor-pointer">
                                                <input type="checkbox" checked={checked} onChange={() => onToggleGroup(g.id)} />
                                                <span className="text-[var(--text-primary)]">{g.name}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                        {embedEnabled && agent?.id && (
                            <div className="text-[11px] text-[var(--text-tertiary)] pt-2 border-t border-[var(--border-default)]">
                                {t('agent_wizard.publish.embed_hint') || 'Web embed is on — manage it in Behavior.'}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}

// Avatar picker — emoji input + image upload.
// Supports emoji glyph or data:/http URL (rendered as <img>). Mirrors the
// behaviour of [AgentDesigner/sections/IdentitySection.jsx:127-146].
const AVATAR_EMOJI_CATEGORIES = {
    tech:    { label: '🤖', emojis: ['🤖','🧠','💡','🔧','🛠️','⚙️','📊','📈','📉','🎯','🚀','⚡','🔥','💥','✨','🌟','⭐','🏆','📝','✏️','📌','📎','🗂️','📂','📁','🔒','🔑','🛡️','💻','⌨️','🖥️','📱','🖨️','🔍','🔬','📡','💾','🌐','🧰','📚'] },
    smileys: { label: '😀', emojis: ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','😊','😇','🥰','😍','🤩','😘','😋','😎','🥸','🤓','🧐','🤨','😏','😌','😴','🥳','🤠','😈','👽','💀','👻','😺','🙃','😉','🤗','🤔','🤫','🤭','🤐','😶','🙄'] },
    people:  { label: '👤', emojis: ['👋','🤚','✋','👌','✌️','🤞','🤟','🤘','👍','👎','👏','🙌','👐','🤝','🙏','💪','👨‍💻','👩‍💻','👨‍🔬','👩‍🔬','👨‍🎨','👩‍🎨','🧑‍🚀','🧑‍🍳','🧑‍🏫','🧑‍⚕️','🧑‍🎓','👮','🕵️','🧙','🦸','🥷','💼','🎩','👑','🦾','🫶','🫡','🫰','🫵'] },
    nature:  { label: '🌿', emojis: ['🐶','🐱','🦊','🐻','🐼','🐨','🦁','🐯','🐮','🐷','🐸','🐵','🐔','🐧','🐦','🦆','🦅','🦉','🐺','🦄','🐝','🦋','🐢','🐍','🐬','🐳','🦈','🌳','🌲','🌴','🌵','🌷','🌹','🌻','🌼','🍀','🍁','🌍','🌙','☀️'] },
    food:    { label: '🍔', emojis: ['🍏','🍎','🍌','🍇','🍓','🍒','🥑','🥦','🥕','🌽','🍞','🥐','🥨','🧀','🥚','🍳','🥞','🥓','🍔','🍟','🍕','🌭','🥪','🌮','🌯','🥗','🍜','🍝','🍣','🍱','🍙','🍩','🍪','🎂','🍰','🍫','🍿','☕','🍵','🥤'] },
    objects: { label: '💡', emojis: ['📞','📟','📠','🔋','🔌','💡','🔦','🕯️','🧯','🛢️','💸','💵','💴','💶','💷','🪙','💳','🧾','💎','⚖️','🪜','🧰','🔧','🔨','⛏️','🔩','⚙️','🧲','🔫','💣','🧨','🪓','🔪','🗡️','⚔️','🛡️','🚬','⚰️','🪦','🧪'] },
    travel:  { label: '✈️', emojis: ['🚗','🚕','🚌','🏎️','🚓','🚑','🚒','🚜','🏍️','🚲','🛴','🚂','🚆','🚇','✈️','🛫','🚀','🛸','🚁','⛵','🚢','🏠','🏢','🏥','🏨','🏫','🏭','🗼','🗽','⛪','🕌','⛲','🌍','🌎','🌏','🗺️','🏝️','🏔️','⛰️','🌋'] },
    symbols: { label: '⚡', emojis: ['❤️','🧡','💛','💚','💙','💜','🤍','🖤','💔','❣️','💕','💞','💓','💖','💘','💝','💟','☮️','✝️','☪️','🕉️','☸️','✡️','☯️','♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓','✅','❌','⚠️','♻️'] },
};
const isImageAvatar = (a) => !!a && (a.startsWith('data:') || a.startsWith('http'));
function AvatarPicker({ avatar, onChange, t }) {
    const [open, setOpen] = useState(false);
    const [category, setCategory] = useState('tech');
    const popoverRef = useRef(null);
    const triggerRef = useRef(null);
    const isImage = isImageAvatar(avatar);

    useEffect(() => {
        if (!open) return;
        const onDoc = (e) => {
            if (popoverRef.current?.contains(e.target)) return;
            if (triggerRef.current?.contains(e.target)) return;
            setOpen(false);
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [open]);

    const onFile = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 512 * 1024) { alert(t('agent_wizard.avatar.too_large') || 'Image must be under 512KB'); e.target.value = ''; return; }
        const reader = new FileReader();
        reader.onload = (ev) => { onChange(ev.target.result); setOpen(false); };
        reader.readAsDataURL(file);
        e.target.value = '';
    };
    const pickEmoji = (em) => { onChange(em); setOpen(false); };

    return (
        <div className="relative">
            <button
                ref={triggerRef}
                type="button"
                onClick={() => setOpen(v => !v)}
                className="w-16 h-16 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-default)] text-3xl flex items-center justify-center overflow-hidden hover:bg-[var(--bg-tertiary)] transition"
                title={t('agent_wizard.avatar.title') || 'Avatar'}
            >
                {isImage
                    ? <img src={avatar} alt="" className="w-full h-full object-cover" />
                    : <span>{avatar || '🤖'}</span>}
            </button>
            {open && (
                <div
                    ref={popoverRef}
                    className="absolute z-30 top-full left-0 mt-2 w-[360px] rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)] shadow-xl overflow-hidden"
                >
                    {/* Category tabs */}
                    <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-[var(--border-default)]">
                        {Object.entries(AVATAR_EMOJI_CATEGORIES).map(([key, cat]) => (
                            <button
                                key={key}
                                type="button"
                                onClick={() => setCategory(key)}
                                className={`flex-1 py-1.5 rounded-md text-base transition ${category === key ? 'bg-[var(--bg-tertiary)]' : 'hover:bg-[var(--bg-secondary)]'}`}
                                title={key}
                            >
                                {cat.label}
                            </button>
                        ))}
                    </div>
                    {/* Emoji grid */}
                    <div className="p-2 max-h-64 overflow-y-auto">
                        <div className="grid grid-cols-8 gap-0.5">
                            {(AVATAR_EMOJI_CATEGORIES[category]?.emojis || []).map((em) => (
                                <button
                                    key={em}
                                    type="button"
                                    onClick={() => pickEmoji(em)}
                                    className={`w-9 h-9 rounded-lg flex items-center justify-center text-xl hover:bg-[var(--bg-tertiary)] transition ${avatar === em ? 'bg-[var(--bg-tertiary)] ring-2 ring-[var(--accent)]' : ''}`}
                                >
                                    {em}
                                </button>
                            ))}
                        </div>
                    </div>
                    {/* Upload + reset row — <label> wrapping the file input is the
                        most reliable cross-browser pattern (see legacy
                        KnowledgeBasesSection.jsx:621). */}
                    <div className="flex items-center gap-2 px-3 py-2 border-t border-[var(--border-default)]">
                        <label className="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] transition cursor-pointer text-center flex items-center justify-center gap-1.5">
                            <ImageIcon size={13} />
                            {t('agent_wizard.avatar.upload') || 'Upload image'}
                            <input
                                type="file"
                                accept="image/png,image/jpeg,image/svg+xml,image/webp,image/gif"
                                className="hidden"
                                onChange={onFile}
                            />
                        </label>
                        {isImage && (
                            <button
                                type="button"
                                onClick={() => { onChange('🤖'); setOpen(false); }}
                                className="px-3 py-1.5 text-xs rounded-lg text-[var(--text-tertiary)] hover:text-red-500 hover:bg-[var(--bg-secondary)] transition"
                            >
                                {t('agent_wizard.avatar.reset') || 'Remove'}
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

function CollapsibleSection({ title, open, onToggle, children }) {
    return (
        <div className="border-t border-[var(--border-default)] first:border-t-0">
            <button
                onClick={onToggle}
                className="w-full flex items-center justify-between px-1 py-4 hover:opacity-80 transition text-left"
            >
                <span className="text-[15px] font-medium text-[var(--text-primary)]">{title}</span>
                <ChevronRight
                    size={18}
                    className={`text-[var(--text-tertiary)] transition-transform ${open ? 'rotate-90' : ''}`}
                />
            </button>
            {open && <div className="px-1 pb-5">{children}</div>}
        </div>
    );
}

function Field({ label, children }) {
    return (
        <div>
            <div className="text-xs uppercase tracking-wide text-[var(--text-tertiary)] mb-1.5">{label}</div>
            {children}
        </div>
    );
}

function ToggleRow({ label, help, checked, onChange }) {
    return (
        <label className="flex items-start gap-3 cursor-pointer">
            <input
                type="checkbox"
                checked={!!checked}
                onChange={(e) => onChange(e.target.checked)}
                className="mt-1"
            />
            <div className="flex-1">
                <div className="text-sm text-[var(--text-primary)]">{label}</div>
                {help && <div className="text-xs text-[var(--text-tertiary)]">{help}</div>}
            </div>
        </label>
    );
}

function KbList({ kbs, linkedIds, onToggle, onCreate, t }) {
    const [creating, setCreating] = useState(false);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [busy, setBusy] = useState(false);
    const submit = async () => {
        if (!name.trim() || busy) return;
        setBusy(true);
        const created = await onCreate(name.trim(), description.trim());
        setBusy(false);
        if (created) { setName(''); setDescription(''); setCreating(false); }
    };
    return (
        <div>
            <div className="flex items-center justify-between mb-2">
                <div className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">
                    {t('agent_wizard.knowledge.kbs')} ({kbs.length})
                </div>
                <button
                    onClick={() => setCreating(v => !v)}
                    className="text-xs text-[var(--accent)] hover:underline"
                >
                    + {t('agent_wizard.knowledge.create_kb')}
                </button>
            </div>
            {creating && (
                <div className="mb-3 p-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] space-y-2">
                    <input
                        autoFocus
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={t('agent_wizard.knowledge.kb_name')}
                        className="w-full bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                    />
                    <input
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder={t('agent_wizard.knowledge.kb_description')}
                        className="w-full bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                    />
                    <div className="flex justify-end gap-2">
                        <button onClick={() => setCreating(false)} className="px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                            {t('agent_studio.cancel')}
                        </button>
                        <button onClick={submit} disabled={!name.trim() || busy} className="px-3 py-1.5 rounded-full text-xs bg-[var(--accent)] text-white disabled:opacity-50">
                            {busy ? '…' : t('agent_wizard.knowledge.create_kb')}
                        </button>
                    </div>
                </div>
            )}
            {kbs.length === 0 && (
                <div className="text-xs text-[var(--text-tertiary)] py-2">{t('agent_wizard.knowledge.no_kbs')}</div>
            )}
            <div className="divide-y divide-[var(--border-default)] border-t border-b border-[var(--border-default)]">
                {kbs.map(kb => {
                    const linked = linkedIds.includes(kb.id);
                    return (
                        <div key={kb.id} className="flex items-center gap-3 py-2 px-1">
                            <div className="flex-1 min-w-0">
                                <div className="text-sm text-[var(--text-primary)] truncate">{kb.name}</div>
                                {(kb.docs_count != null || kb.doc_count != null) && (
                                    <div className="text-[11px] text-[var(--text-tertiary)]">
                                        {(kb.docs_count ?? kb.doc_count ?? 0)} docs
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={() => onToggle(kb.id)}
                                className={`px-3 py-1 rounded-full text-xs border transition ${linked
                                    ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--bg-secondary)]'
                                    : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'}`}
                            >
                                {linked ? `✓ ${t('agent_wizard.knowledge.linked')}` : `+ ${t('agent_wizard.knowledge.link')}`}
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
