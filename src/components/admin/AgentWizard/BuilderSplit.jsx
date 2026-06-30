import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, Sparkles, Upload, AppWindow, ArrowLeft, X, ArrowUp, Check, Clock, Settings2, Loader2 } from 'lucide-react';
import { API_BASE, authFetch, parseSaveError } from '../../../utils/helpers';
import { pickAgentAvatar, DEFAULT_AGENT_EMOJI } from '../../../utils/agentAvatar';
import useTranslation from '../../../hooks/useTranslation';
import beeFlowIcon from '../../../assets/BeeFlow-logo-Icon-2026.svg';
import ModelTierSelector from '../../ModelTierSelector';
import MarkdownRenderer from '../../MarkdownRenderer';
import { INTEGRATION_CATALOG } from '../AgentDesigner/integrations';
import PlanCard from './PlanCard';
import { computeRoutineNextRun } from '../../../utils/routineSchedule';
import { useAgentEditorBootstrap } from './AgentEditorBootstrapContext';
import { useCan } from '../../Gate';
import { RoutinesPicker, RoutineModal } from './pickers/RoutinePickers';
import AvatarPicker from './pickers/AvatarPicker';
import PublishMenu from './pickers/PublishMenu';
import FilesUploadModal from './pickers/FilesUploadModal';
import SkillPicker from './pickers/SkillPicker';
import AppsPicker from './pickers/AppsPicker';
import AdvancedDrawer from './pickers/AdvancedDrawer';

export default function BuilderSplit({ agent: initialAgent, plan, history, tier, locale, onBack, onPublished, onDirtyChange, rightHeaderExtras = null, user = null, initialRefinement = null }) {
    const { t } = useTranslation();

    const [agent, setAgent] = useState(initialAgent);
    const [name, setName] = useState(initialAgent?.name || plan?.name || t('agent_wizard.builder.name_placeholder'));
    const [avatar, setAvatar] = useState(pickAgentAvatar(initialAgent) || plan?.avatar || DEFAULT_AGENT_EMOJI);
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
    // Default bubble color is a neutral mid-grey — the original `#6366F1`
    // (indigo) is on the user-banned-purple list. Users can still pick any
    // color via the bubble color picker; we just don't *default* to purple.
    const [bubbleColor, setBubbleColor] = useState(initialAgent?.config?.bubbleColor || '#6b7280');
    const [bubblePosition, setBubblePosition] = useState(initialAgent?.config?.bubblePosition || 'right');
    const [bubbleIcon, setBubbleIcon] = useState(initialAgent?.config?.bubbleIcon || '💬');

    // Tier (for chat input)
    const [tiers, setTiers] = useState({});
    const [selectedTier, setSelectedTier] = useState('fast');
    // Separate tier for the chat/refine panel — does not affect the saved agent model.
    const [chatTier, setChatTier] = useState('fast');

    // Categories + groups (for selectors)
    const [categories, setCategories] = useState([]);
    const [orgGroups, setOrgGroups] = useState([]);
    const [automations, setAutomations] = useState([]);

    const [savingState, setSavingState] = useState(() => initialAgent?.updated_at ? 'saved' : 'idle');
    const [savedAt, setSavedAt] = useState(() => initialAgent?.updated_at ? new Date(initialAgent.updated_at) : null);
    // Mirror of dirtyRef as state, so the parent's onDirtyChange callback fires
    // synchronously when the user edits an unsaved draft (where auto-save is
    // disabled and dirtyRef wouldn't otherwise propagate up).
    const [dirty, setDirty] = useState(false);
    // Last save-error message (server response body or fetch error). Surfaced
    // in the save-state pill's title / tooltip so users see what went wrong
    // instead of a silent "Save error" with no context.
    const [saveErrorMsg, setSaveErrorMsg] = useState('');
    // Plan-limit warning (e.g. "reached its limit of 5 agents"). Surfaced as a
    // prominent dismissible banner with an upgrade CTA — never just a console
    // error — so the user understands why the save was blocked.
    const [limitWarning, setLimitWarning] = useState(null);

    // Section open/closed state for the inline accordion.
    const [openSection, setOpenSection] = useState(null); // 'identity'|'model'|'knowledge'|'behavior'|'publishing'|'guardrails'|'embed'|null
    const toggleSection = (s) => setOpenSection(prev => prev === s ? null : s);

    // Loaded once for pickers
    const [allSkills, setAllSkills] = useState(null);          // null = not loaded, [] = loaded but empty
    const [integrationStatus, setIntegrationStatus] = useState(null);
    const [skillPickerOpen, setSkillPickerOpen] = useState(false);
    const [appsPickerOpen, setAppsPickerOpen] = useState(false);
    const [knowledgeOpen, setKnowledgeOpen] = useState(false);
    const [routinesPickerOpen, setRoutinesPickerOpen] = useState(false);
    const [routineModal, setRoutineModal] = useState(null); // null | { mode: 'create' } | { mode: 'edit', routine }
    const [agentRoutines, setAgentRoutines] = useState([]);
    const [routineDeleteTarget, setRoutineDeleteTarget] = useState(null);
    const [routineDeleting, setRoutineDeleting] = useState(false);
    const [publishPickerOpen, setPublishPickerOpen] = useState(false);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [advancedOpen, setAdvancedOpen] = useState(false);
    const [skillSearch, setSkillSearch] = useState('');
    const [instructionsEditing, setInstructionsEditing] = useState(false);
    const instructionsTextareaRef = useRef(null);

    // Single ref on the action bar — all dropdown pickers are positioned
    // relative to it (top-full left-0), so one outside-click handler covers them all.
    const actionBarRef = useRef(null);

    // Mounted flag so async handlers can skip setState after unmount. Pair with
    // an AbortController fired on unmount so any new fetch initiated by the
    // editor (auto-save, draft create, knowledge picker bootstrap) can be wired
    // through it. Existing call sites that don't pass `signal:` still bail via
    // the mounted check before calling setState.
    const mountedRef = useRef(true);
    const unmountAbortRef = useRef(null);
    useEffect(() => {
        mountedRef.current = true;
        unmountAbortRef.current = new AbortController();
        return () => {
            mountedRef.current = false;
            try { unmountAbortRef.current?.abort(); } catch (_) { /* noop */ }
        };
    }, []);

    useEffect(() => {
        const onDoc = (e) => {
            if (skillPickerOpen && actionBarRef.current && !actionBarRef.current.contains(e.target)) {
                setSkillPickerOpen(false);
            }
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [skillPickerOpen]);

    const updateBubbleColor = (v) => { setBubbleColor(v); patchConfig({ bubbleColor: v }); };
    const updateBubblePosition = (v) => { setBubblePosition(v); patchConfig({ bubblePosition: v }); };
    const updateBubbleIcon = (v) => { setBubbleIcon(v); patchConfig({ bubbleIcon: v }); };

    // Unified entitlements check (false while the snapshot loads — the
    // routines panel pops in once it resolves; refreshAgentRoutines re-fires
    // via its dependency when the flag flips true).
    const routinesAllowed = useCan('agent_routines');
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
                setAvatar(pickAgentAvatar(fresh) || DEFAULT_AGENT_EMOJI);
                setModel(fresh.model || '');
                if (fresh.model && fresh.model.startsWith('tier:')) setSelectedTier(fresh.model.slice(5));

                // Mirror the restored values into stateRef so the next save
                // sends the restored snapshot, not the pre-restore one. Also
                // clear the dirty flag so a queued autosave doesn't re-PUT
                // stale data on top of the restore.
                stateRef.current.name = fresh.name || '';
                stateRef.current.description = fresh.description || '';
                stateRef.current.systemPrompt = fresh.system_prompt || '';
                stateRef.current.model = fresh.model || '';
                stateRef.current.categoryId = fresh.category_id || null;
                stateRef.current.embedEnabled = fresh.embed_enabled === 1 || fresh.embed_enabled === true;
                stateRef.current.config = { ...(fresh.config || {}) };
                dirtyRef.current = false;
                if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
                setSavingState('saved'); setSavedAt(new Date());
            }
        } catch (_) { /* ignore */ }
    };

    const [chat, setChat] = useState(history || []);
    const [chatInput, setChatInput] = useState('');
    const [chatBusy, setChatBusy] = useState(false);
    const chatScrollRef = useRef(null);

    // Stick to the bottom only when the user was already at (or near) the
    // bottom. If they've scrolled up to read history, don't yank them back —
    // that's why a user reading a long previous answer would lose their place
    // every time a new chunk streamed in.
    useEffect(() => {
        const el = chatScrollRef.current;
        if (!el) return;
        const STICK_THRESHOLD_PX = 80;
        const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        if (distanceFromBottom <= STICK_THRESHOLD_PX) {
            el.scrollTop = el.scrollHeight;
        }
    }, [chat]);

    // Bootstrap data (skills, integration status, categories, org groups,
    // tiers, automations). When mounted under AgentStudio the data comes from
    // the shared AgentEditorBootstrapProvider — one fetch per session, not
    // one per agent switch. When mounted standalone (the wizard landing
    // path), the context returns empty defaults and we fall back to the local
    // fetch below.
    const bootstrap = useAgentEditorBootstrap();
    const usingProvider = bootstrap.loaded || bootstrap.allSkills !== null;
    useEffect(() => {
        if (!usingProvider) return;
        setAllSkills(bootstrap.allSkills);
        setIntegrationStatus(bootstrap.integrationStatus);
        setCategories(bootstrap.categories);
        setOrgGroups(bootstrap.orgGroups);
        setTiers(bootstrap.tiers);
        setAutomations(bootstrap.automations);
    }, [usingProvider, bootstrap.allSkills, bootstrap.integrationStatus, bootstrap.categories, bootstrap.orgGroups, bootstrap.tiers, bootstrap.automations]);

    useEffect(() => {
        // Sync the chat-input tier pill with the agent's persisted tier on mount
        // (and on agent switch — useEffect re-runs when initialAgent.id changes
        // because BuilderSplit is keyed by it in AgentStudio).
        if (initialAgent?.model && initialAgent.model.startsWith('tier:')) {
            setSelectedTier(initialAgent.model.slice('tier:'.length));
        }
    }, [initialAgent?.id, initialAgent?.model]);

    // Standalone fallback — only fires when we're NOT under the provider.
    // Uses the same 6-request bootstrap so the legacy wizard landing keeps working.
    useEffect(() => {
        if (usingProvider) return;
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
            } catch (_) {
                if (!cancelled) {
                    setAllSkills([]);
                    setIntegrationStatus({});
                }
            }
        })();
        return () => { cancelled = true; };
    }, [usingProvider]);

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
        avatar: pickAgentAvatar(initialAgent) || plan?.avatar || DEFAULT_AGENT_EMOJI,
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
    const dirtyRef = useRef(false);
    // Promise queue for serialized saves. Every flush() call chains onto the
    // tail so two callers can't double-POST. The previous polling-loop
    // implementation could allow two callers to both pass `while (inflightRef)`
    // and race. The chain pattern is self-serializing without a busy wait.
    const saveChainRef = useRef(Promise.resolve());
    const inflightRef = useRef(false); // exposed to handleDone / beforeunload only

    const flush = useCallback(() => {
        const id = agentIdRef.current;
        if (!id) return saveChainRef.current;
        if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }

        // Snapshot the dirty state at *enqueue* time. If multiple flushes are
        // queued in rapid succession, only the first does work and the rest
        // see dirtyRef cleared and no-op. That's the desired coalescing.
        const next = saveChainRef.current.then(async () => {
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
                // Top-level avatar so the agents column reflects the picker
                // — without this, the marketplace card kept rendering initials
                // because `agent.avatar` stayed NULL even though config.avatar
                // was set.
                avatar: stateRef.current.avatar,
                config: { ...stateRef.current.config },
            };
            try {
                const res = await authFetch(`${API_BASE}/agents/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(snapshot),
                    signal: unmountAbortRef.current?.signal,
                });
                if (!res.ok) {
                    const info = await parseSaveError(res);
                    if (info.isLimit) {
                        if (!mountedRef.current) return;
                        setLimitWarning({ message: info.message, resource: info.resource });
                        setSavingState('error');
                        setSaveErrorMsg(info.message);
                        dirtyRef.current = true;
                        return;
                    }
                    throw new Error(info.message);
                }
                const updated = await res.json();
                if (!mountedRef.current) return;
                // Refresh the `agent` shell only (id, timestamps, derived fields).
                // Do NOT overwrite `stateRef.current` from the server response — by
                // the time this resolves the user may have typed more, and that
                // newer text lives only in stateRef. Overwriting here silently
                // loses keystrokes typed during the in-flight save.
                setAgent(updated);
                setSavingState('saved'); setSavedAt(new Date());
                setSaveErrorMsg('');
                if (!dirtyRef.current) setDirty(false);
            } catch (err) {
                if (err?.name === 'AbortError' || !mountedRef.current) return;
                console.error('Auto-save failed:', err);
                setSavingState('error');
                // Surface the server's reason in the indicator's tooltip so the
                // user can act on it (e.g., a 403 on a tier they don't have).
                setSaveErrorMsg(String(err?.message || err || 'Unknown error').slice(0, 500));
                // Mark dirty again so a retry happens on next change.
                dirtyRef.current = true;
            } finally {
                inflightRef.current = false;
            }
        });
        saveChainRef.current = next.catch(() => { /* swallow so the chain survives */ });
        return saveChainRef.current;
    }, []);

    const queueSave = useCallback((immediate = false) => {
        dirtyRef.current = true;
        setDirty(true);
        // Without a persisted agent id we're in draft mode — there's no save
        // target yet. The user must explicitly press "Save" to create it. We
        // still mark the draft dirty so the unsaved-changes guard fires.
        if (!agentIdRef.current) return;
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

    useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);

    // Explicit first-save for drafts. Until this runs, the agent only exists
    // in memory — POST creates it on the server, then the editor switches to
    // its normal auto-save behaviour.
    const saveDraft = useCallback(async () => {
        if (agentIdRef.current) return;
        setSavingState('saving');
        try {
            const res = await authFetch(`${API_BASE}/agents`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: stateRef.current.name,
                    description: stateRef.current.description,
                    systemPrompt: stateRef.current.systemPrompt,
                    model: stateRef.current.model,
                    categoryId: stateRef.current.categoryId,
                    embedEnabled: stateRef.current.embedEnabled,
                    avatar: stateRef.current.avatar,
                    config: { ...stateRef.current.config },
                }),
            });
            if (!res.ok) {
                const info = await parseSaveError(res);
                if (info.isLimit) {
                    setLimitWarning({ message: info.message, resource: info.resource });
                    setSavingState('error');
                    setSaveErrorMsg(info.message);
                    return;
                }
                throw new Error(info.message);
            }
            const created = await res.json();
            setAgent(created);
            agentIdRef.current = created.id;
            dirtyRef.current = false;
            setDirty(false);
            setSavingState('saved');
            setSavedAt(new Date());
            setSaveErrorMsg('');
            setLimitWarning(null);
            if (onPublished) onPublished(created);
        } catch (err) {
            console.error('Save draft failed:', err);
            setSavingState('error');
            setSaveErrorMsg(String(err?.message || err || 'Unknown error').slice(0, 500));
        }
    }, [onPublished]);

    // Best-effort flush of any pending auto-save when the tab is being closed.
    // We deliberately don't preventDefault / set returnValue here — the unsaved
    // changes UX is handled in-app via the parent's confirmation modal, not
    // the browser's native "Leave site?" dialog.
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
    // Avatar is now written only to the canonical top-level column. Reads still
    // fall through to config.avatar via pickAgentAvatar so legacy agents keep
    // displaying until the one-shot backfill migration lands.
    const updateAvatar = (v) => {
        setAvatar(v);
        stateRef.current.avatar = v;
        queueSave(true);
    };
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
        // model is a top-level agent column (not under config). Stash it on
        // stateRef so flush() picks it up, then queue an immediate save.
        if (!agentIdRef.current) return;
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
    // Persist `embedEnabled`. Going embed-OFF is silent (defensive). Going
    // embed-ON exposes the agent on the public /chat/<id> route, so we gate
    // it behind a confirmation modal — the actual flip happens via
    // `confirmEnableEmbed` after the user accepts.
    const [pendingEmbedEnable, setPendingEmbedEnable] = useState(false);
    const persistEmbedEnabled = useCallback((next) => {
        setEmbedEnabled(next);
        stateRef.current.embedEnabled = next;
        dirtyRef.current = true;
        queueSave(true);
    }, [queueSave]);
    const toggleEmbedEnabled = () => {
        const next = !embedEnabled;
        if (next) {
            setPendingEmbedEnable(true);
        } else {
            persistEmbedEnabled(false);
        }
    };
    const confirmEnableEmbed = () => {
        persistEmbedEnabled(true);
        setPendingEmbedEnable(false);
    };
    const cancelEnableEmbed = () => setPendingEmbedEnable(false);

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
            if (!res.ok) {
                // Surface the real reason in the save banner. The old path did
                // `throw new Error(await res.text())` then `alert(err.message)`,
                // so a bodyless proxy error (e.g. NC session-bridge failure)
                // produced a BLANK popup and the share silently never applied
                // (BFSF-220). parseSaveError falls back to "Save failed (<status>)".
                const info = await parseSaveError(res);
                setSaveErrorMsg(info.message);
                return;  // don't flip optimistic state on failure
            }
            setIsPublished(next);
            setSharedGroups(groups);
            setSaveErrorMsg('');
        } catch (err) {
            console.error('Publish toggle failed:', err);
            setSaveErrorMsg(String(err?.message || err || 'Failed to update publish settings').slice(0, 500));
        }
    };
    const togglePublishedToOrg = () => {
        // "Publish to entire organisation" → empty sharedGroups.
        callPublish(!isPublished, []);
    };
    // Explicit setters for the three publish modes — used by the menu so the
    // user can switch directly between Personal / Entire Org / Specific
    // Groups without first toggling the master switch off and on.
    const setPublishPersonal = () => callPublish(false, []);
    const setPublishEntireOrg = () => callPublish(true, []);
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

    const handleRefine = async (overrideText = null) => {
        // Callers pass either a string (programmatic refine from the wizard
        // hand-off) or nothing (button/Enter). React event objects and similar
        // non-string values get treated as "no override" so we fall back to
        // the live chatInput.
        const usingOverride = typeof overrideText === 'string';
        const text = (usingOverride ? overrideText : chatInput).trim();
        if (!text || chatBusy) return;
        setChat(prev => [...prev, { role: 'user', content: text }]);
        if (!usingOverride) setChatInput('');
        setChatBusy(true);
        try {
            const res = await authFetch(`${API_BASE}/agents/wizard/refine`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: chat[0]?.content || '',
                    plan: { name, description: agent?.description || '', avatar, capabilities: plan?.capabilities || [], systemPrompt: instructions },
                    refinement: text,
                    modelTier: chatTier || tier || 'fast',
                    locale,
                }),
            });
            if (!res.ok) throw new Error(await res.text());
            const { plan: updated } = await res.json();
            const nextAvatar = updated.avatar || avatar;
            setName(updated.name);
            setAvatar(nextAvatar);
            setInstructions(updated.systemPrompt || instructions);
            stateRef.current.name = updated.name;
            stateRef.current.description = updated.description || stateRef.current.description;
            stateRef.current.systemPrompt = updated.systemPrompt || stateRef.current.systemPrompt;
            stateRef.current.avatar = nextAvatar;
            stateRef.current.config = {
                ...stateRef.current.config,
                wizard: { capabilities: updated.capabilities, suggestedSkills: updated.suggestedSkills },
            };
            queueSave();

            // Apply the remaining plan fields the AI filled in. Previously only
            // name/avatar/description/instructions landed on the form, leaving
            // Apps, Skills and the model tier empty even though the AI proposed
            // them (BFSF-201).
            if (Array.isArray(updated.enabledIntegrations)) {
                const apps = updated.enabledIntegrations.filter(id => availableIntegrations.some(a => a.id === id));
                setEnabledIntegrations(apps);
                patchConfig({ enabledIntegrations: apps });
            }
            if (typeof updated.model === 'string' && ['fast', 'smart', 'thinking'].includes(updated.model)) {
                updateModel(updated.model);
            }
            if (Array.isArray(updated.skills) && updated.skills.length > 0) {
                try {
                    const attach = new Set(attachedSkillIds);
                    for (const s of updated.skills) {
                        if (s.id && (allSkills || []).some(x => x.id === s.id)) {
                            attach.add(s.id); // reuse an existing skill
                        } else if (!s.id && s.name) {
                            const sres = await authFetch(`${API_BASE}/api/skills`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ name: s.name, description: s.description || '', instructions: s.instructions || '', isShared: false, dynamicActivation: false, automationId: null }),
                            });
                            if (sres.ok) {
                                const created = await sres.json();
                                if (created?.id) { setAllSkills(prev => [...(prev || []), created]); attach.add(created.id); }
                            }
                        }
                    }
                    const nextSkills = Array.from(attach);
                    setAttachedSkillIds(nextSkills);
                    patchConfig({ attachedSkillIds: nextSkills });
                } catch (_) { /* non-fatal — partial skill application is acceptable */ }
            }

            setChat(prev => [...prev, { role: 'plan', plan: updated }]);

            // Routine action: when the LLM detected a clear scheduling intent
            // and the user has the agent_routines beta, create the routine
            // for this agent and surface a confirmation in the chat.
            if (updated.routine && routinesAllowed && agent?.id) {
                try {
                    const r = updated.routine;
                    const tz = r.timezone || (Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
                    const nextRunAt = computeRoutineNextRun(r, tz);
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

    // When the wizard handed us off mid-conversation (user typed a refine
    // message on the landing screen), auto-fire it here so the response
    // appears in the builder chat — not back in the wizard.
    const initialRefinementFiredRef = useRef(false);
    useEffect(() => {
        if (initialRefinementFiredRef.current) return;
        if (typeof initialRefinement !== 'string' || !initialRefinement.trim()) return;
        initialRefinementFiredRef.current = true;
        handleRefine(initialRefinement);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialRefinement]);

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
    // `agent-search` (Web Search) is a built-in platform capability with no
    // per-org credentials — bypass the org-enabled gate so every agent can opt
    // into it.
    const ALWAYS_AVAILABLE = new Set(['agent-search']);
    const availableIntegrations = (() => {
        if (!integrationStatus) return INTEGRATION_CATALOG;
        const status = integrationStatus;
        return INTEGRATION_CATALOG.filter(item => {
            if (ALWAYS_AVAILABLE.has(item.id)) return true;
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
    // Apps are off by default (R4). Legacy `null` rows have been backfilled
    // server-side, so `enabledIntegrations` is always an array here.
    const enabledIntegrationCount = Array.isArray(enabledIntegrations)
        ? enabledIntegrations.filter(id => availableIntegrations.some(a => a.id === id)).length
        : 0;

    const [chatWidth, setChatWidth] = useState(460);
    const isDragging = useRef(false);
    const dragStartX = useRef(0);
    const dragStartW = useRef(0);

    const onDragStart = (e) => {
        isDragging.current = true;
        dragStartX.current = e.clientX;
        dragStartW.current = chatWidth;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        const onMove = (ev) => {
            if (!isDragging.current) return;
            const delta = ev.clientX - dragStartX.current;
            setChatWidth(Math.min(600, Math.max(240, dragStartW.current + delta)));
        };
        const onUp = () => {
            isDragging.current = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    };

    return (
        <div className="flex h-full">
            {/* Plan-limit warning — a prominent, dismissible banner shown when a
                save is blocked by the org's subscription limits (e.g. max agents).
                Replaces the silent console error so the user can act on it. */}
            {limitWarning && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-[min(560px,92vw)]">
                    <div className="rounded-xl border border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 shadow-lg px-4 py-3 flex items-start gap-3">
                        <Sparkles className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-semibold text-[var(--text-primary)]">
                                {t('agent_wizard.limit_reached_title', 'Plan limit reached')}
                            </p>
                            <p className="text-[12px] text-[var(--text-secondary)] mt-0.5">{limitWarning.message}</p>
                            <a
                                href="/app/settings/organisation/license"
                                className="inline-flex items-center gap-1 mt-2 px-3 py-1.5 rounded-md text-[12px] font-semibold bg-amber-500 text-white hover:bg-amber-600"
                            >
                                {t('agent_wizard.view_plans', 'View plans & upgrade')}
                            </a>
                        </div>
                        <button onClick={() => setLimitWarning(null)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] shrink-0" aria-label="Dismiss">
                            <X size={16} />
                        </button>
                    </div>
                </div>
            )}
            {/* Left chat panel — glass chrome tier so the wallpaper subtly
                shows through under the refine-this-agent rail. */}
            <aside
                style={{ width: chatWidth }}
                className="flex-shrink-0 border-r border-[var(--border-default)] flex flex-col min-w-[240px] max-w-[600px] bg-[var(--bg-secondary)]"
                data-surface="subtle"
            >
                <div className="flex items-center px-4 py-3">
                    <button onClick={onBack} className="flex items-center gap-1 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                        <ArrowLeft size={16} /> {t('agent_wizard.back')}
                    </button>
                </div>
                <div ref={chatScrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                    {chat.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-center px-3">
                            <img src={beeFlowIcon} alt="Bee Flow" className="w-12 h-12 mb-4" />
                            <div className="text-base font-semibold text-[var(--text-primary)] mb-2">
                                Refine this agent
                            </div>
                            <div className="text-sm text-[var(--text-secondary)] mb-6 max-w-[280px] leading-relaxed">
                                Tell me what to change — I'll update the instructions, knowledge, or behaviour.
                            </div>
                            <div className="flex flex-col gap-2 w-full max-w-[320px]">
                                {[
                                    'agent_wizard.builder.chat_prompt_tone',
                                    'agent_wizard.builder.chat_prompt_steps',
                                    'agent_wizard.builder.chat_prompt_constraint',
                                ].map((key) => (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => setChatInput(t(key))}
                                        className="text-left text-sm px-4 py-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-card,#fff)] hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] transition shadow-sm"
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
                                    <div className="max-w-[80%] rounded-2xl bg-[var(--user-bubble-bg,#e8e8eb)] px-4 py-2 text-[15px] text-[var(--user-bubble-fg,#000)]">{m.content}</div>
                                </div>
                            );
                        }
                        if (m.role === 'plan') {
                            // Plan card in the chat scrollback is read-only — the agent
                            // already exists, so the Build button would be a no-op.
                            return <div key={i}><PlanCard plan={m.plan} hideActions /></div>;
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
                        return (
                            <div key={i} className="text-[15px] leading-7 text-[var(--text-primary)] prose prose-sm max-w-none">
                                <MarkdownRenderer content={m.content || ''} />
                            </div>
                        );
                    })}
                </div>
                <div className="p-3">
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
                        <div className="flex items-center justify-end gap-2 mt-2">
                            <ModelTierSelector
                                tiers={tiers || {}}
                                value={chatTier}
                                onChange={setChatTier}
                                dropDirection="up"
                                variant="input"
                            />
                            <button
                                onClick={handleRefine}
                                disabled={chatBusy || !chatInput.trim()}
                                className="p-2 bg-[var(--text-primary)] text-white rounded-full hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm active:scale-95 transform duration-100"
                                title={t('agent_wizard.builder.send') || 'Send'}
                                aria-label="Send"
                            >
                                {chatBusy ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowUp className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>
                    <div className="text-[11px] text-center text-[var(--text-tertiary)] mt-2">
                        AI can make mistakes. Please verify important information.
                    </div>
                </div>
            </aside>

            {/* Drag handle */}
            <div
                onMouseDown={onDragStart}
                className="w-1 flex-shrink-0 cursor-col-resize hover:bg-[var(--accent)]/40 active:bg-[var(--accent)]/60 transition-colors z-10"
            />

            {/* Right config panel */}
            <main className="flex-1 overflow-y-auto">
                <div className="flex items-center justify-end gap-3 px-8 py-3 relative">
                    {agent?.id ? (
                        <SaveStateIndicator t={t} state={savingState} savedAt={savedAt} errorMsg={saveErrorMsg} onRetry={flush} />
                    ) : (
                        <>
                            <span className="text-xs text-[var(--text-tertiary)]">
                                {t('agent_wizard.builder.draft_label') || 'Draft — not saved yet'}
                            </span>
                            <button
                                type="button"
                                onClick={saveDraft}
                                disabled={savingState === 'saving'}
                                className="px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white text-xs font-medium hover:opacity-90 disabled:opacity-50 transition"
                            >
                                {savingState === 'saving'
                                    ? (t('agent_wizard.builder.saving') || 'Saving…')
                                    : (t('agent_wizard.builder.save_draft') || 'Save')}
                            </button>
                        </>
                    )}
                    {rightHeaderExtras}
                    {agent?.id && (
                        <PublishMenu
                            t={t}
                            agent={agent}
                            open={publishPickerOpen}
                            onToggle={() => setPublishPickerOpen(v => !v)}
                            onClose={() => setPublishPickerOpen(false)}
                            isPublished={isPublished}
                            onTogglePublished={togglePublishedToOrg}
                            onSetPersonal={setPublishPersonal}
                            onSetEntireOrg={setPublishEntireOrg}
                            embedEnabled={embedEnabled}
                            orgGroups={orgGroups}
                            sharedGroups={sharedGroups}
                            onToggleGroup={togglePublishGroup}
                        />
                    )}
                </div>

                <div className="max-w-4xl mx-auto px-10 pt-8 pb-12">
                    {/* Header block — avatar + name + action bar as one unit */}
                    <div className="mb-8">
                        <div className="flex items-center gap-4 mb-4">
                            <AvatarPicker t={t} avatar={avatar} onChange={updateAvatar} size="lg" />
                            <input
                                value={name}
                                onChange={(e) => updateName(e.target.value)}
                                onBlur={flushNow}
                                className="flex-1 text-3xl font-semibold bg-transparent outline-none text-[var(--text-primary)] py-1 px-2 rounded-lg hover:bg-[var(--bg-secondary)] focus:bg-[var(--bg-secondary)] transition"
                                placeholder={t('agent_wizard.builder.name_placeholder')}
                            />
                        </div>

                    <div ref={actionBarRef} className="flex flex-wrap items-center gap-2 relative">
                        <div className="mr-1">
                            <ModelTierSelector
                                tiers={tiers || {}}
                                value={selectedTier}
                                onChange={(v) => updateModel(v)}
                                dropDirection="down"
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
                            icon={<Upload size={14} />}
                            label={t('agent_wizard.builder.upload_files')}
                            count={knowledgeBaseIds.length}
                            onClick={() => setKnowledgeOpen(true)}
                        />
                        <ActionPill
                            icon={<Sparkles size={14} />}
                            label={t('agent_wizard.builder.skills') || 'Skills'}
                            count={attachedSkillIds.length}
                            onClick={() => setSkillPickerOpen(v => !v)}
                            active={skillPickerOpen}
                        />
                        {agent?.id && routinesAllowed && (
                            <ActionPill
                                icon={<Clock size={14} />}
                                label={t('routines.title') || 'Routines'}
                                count={agentRoutines.filter(r => r.isActive).length}
                                onClick={() => setRoutinesPickerOpen(v => !v)}
                                active={routinesPickerOpen}
                                popoverTrigger="routines"
                            />
                        )}
                        <button
                            type="button"
                            onClick={() => setAdvancedOpen(true)}
                            className={`flex items-center justify-center w-8 h-8 rounded-lg border transition-all ${advancedOpen || memoryEnabled || embedEnabled
                                ? 'border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent)]'
                                : 'border-[var(--border-default)] bg-[var(--bg-card,#fff)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]'}`}
                            title={t('agent_wizard.builder.advanced_settings') || 'Advanced settings'}
                            aria-label={t('agent_wizard.builder.advanced_settings') || 'Advanced settings'}
                        >
                            <Settings2 size={14} />
                        </button>

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
                                onDelete={(r) => {
                                    // Route through the in-app modal so the
                                    // styling, focus management and i18n match
                                    // the rest of the studio. window.confirm
                                    // can also be disabled by some browsers.
                                    setRoutineDeleteTarget(r);
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
                    </div>{/* end header card */}

                    {(detailsOpen || description || categoryId) ? (
                        <div className="mb-8 space-y-3">
                            <div>
                                <div className="text-[13px] font-medium text-[var(--text-secondary)] mb-1">
                                    {t('agent_wizard.builder.role_description_label') || 'Role description'}
                                </div>
                                <div className="relative -mx-4">
                                    <textarea
                                        value={description}
                                        onChange={(e) => {
                                            updateDescription(e.target.value.slice(0, 300));
                                            e.target.style.height = 'auto';
                                            e.target.style.height = e.target.scrollHeight + 'px';
                                        }}
                                        onFocus={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                                        onBlur={flushNow}
                                        placeholder={t('agent_wizard.field.role_description_placeholder')}
                                        rows={2}
                                        className="w-full bg-transparent border-none outline-none rounded-xl px-4 py-3 pb-6 text-[15px] leading-6 text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]/40 focus:bg-[var(--bg-secondary)]/40 transition resize-none overflow-hidden"
                                    />
                                    <span className="absolute bottom-1.5 right-3 text-[10px] text-[var(--text-tertiary)] pointer-events-none">{description.length}/300</span>
                                </div>
                            </div>
                            <div>
                                <div className="text-[13px] font-medium text-[var(--text-secondary)] mb-1">
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
                            className="mb-8 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition flex items-center gap-1"
                        >
                            <Plus size={12} />
                            {t('agent_wizard.builder.add_details') || 'Add description & category'}
                        </button>
                    )}

                    <div className="mb-2">
                        <div className="text-[13px] font-medium text-[var(--text-secondary)] mb-1">
                            {t('agent_wizard.builder.instructions')}
                        </div>
                        {instructionsEditing ? (
                            <InstructionsEditor
                                ref={instructionsTextareaRef}
                                initialValue={instructions}
                                placeholder={t('agent_wizard.builder.instructions_placeholder')}
                                onCommit={updateInstructions}
                                onBlurEnd={() => { flushNow(); setInstructionsEditing(false); }}
                            />
                        ) : (
                            <div
                                role="button"
                                tabIndex={0}
                                onClick={() => setInstructionsEditing(true)}
                                onFocus={() => setInstructionsEditing(true)}
                                className="instructions-view min-h-[10rem] px-4 py-3 -mx-4 cursor-text rounded-xl hover:bg-[var(--bg-secondary)]/40 transition"
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
            {pendingEmbedEnable && (
                <EnableEmbedConfirmModal
                    t={t}
                    agent={agent}
                    onConfirm={confirmEnableEmbed}
                    onCancel={cancelEnableEmbed}
                />
            )}
            {routineDeleteTarget && (
                <div
                    className="fixed inset-0 z-[1100] bg-black/50 flex items-center justify-center p-4"
                    onClick={() => { if (!routineDeleting) setRoutineDeleteTarget(null); }}
                    role="alertdialog"
                    aria-modal="true"
                >
                    <div
                        className="bg-[var(--bg-primary)] rounded-xl w-full max-w-md shadow-xl border border-[var(--border-default)]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="px-5 py-4 border-b border-[var(--border-default)] text-sm font-semibold text-[var(--text-primary)]">
                            {t('routines.delete_title') || 'Delete routine'}
                        </div>
                        <div className="px-5 py-4 text-sm text-[var(--text-secondary)]">
                            {(t('routines.delete_body') || 'Delete "{title}"?').replace('{title}', routineDeleteTarget.title || '')}
                        </div>
                        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--border-default)]">
                            <button
                                onClick={() => setRoutineDeleteTarget(null)}
                                disabled={routineDeleting}
                                className="px-4 py-2 rounded-full text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] disabled:opacity-50"
                            >
                                {t('agent_studio.cancel') || 'Cancel'}
                            </button>
                            <button
                                onClick={async () => {
                                    if (routineDeleting) return;
                                    setRoutineDeleting(true);
                                    try {
                                        await authFetch(`${API_BASE}/api/ai-tasks/${routineDeleteTarget.id}`, { method: 'DELETE' });
                                        await refreshAgentRoutines();
                                    } catch (_) { /* non-fatal */ }
                                    finally {
                                        if (mountedRef.current) {
                                            setRoutineDeleting(false);
                                            setRoutineDeleteTarget(null);
                                        }
                                    }
                                }}
                                disabled={routineDeleting}
                                className="px-4 py-2 rounded-full text-sm bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
                            >
                                {routineDeleting ? (t('agent_studio.deleting') || 'Deleting…') : (t('agent_studio.delete') || 'Delete')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <AdvancedDrawer
                open={advancedOpen}
                onClose={() => setAdvancedOpen(false)}
                t={t}
                agent={agent}
                onVersionRestore={handleVersionRestore}
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
        </div>
    );
}




// `popoverTrigger` (optional): when this pill is the toggle for a popover, set
// to a unique name that matches the popover's `triggerName` prop. The popover's
// outside-click handler then ignores clicks on this trigger so toggling
// works correctly (without it, the document mousedown listener and the
// trigger's onClick race and the popover stays open on close-click).
// Memoized instructions textarea. The parent's `instructions` state lives in
// BuilderSplit (~127 hooks), so updating it on every keystroke causes the
// entire editor to rerender. This child holds its own local string and only
// commits to the parent on a 250ms debounce + on blur — keystrokes stay
// scoped to this component, BuilderSplit only sees settled values.
const InstructionsEditor = React.memo(React.forwardRef(function InstructionsEditor(
    { initialValue, placeholder, onCommit, onBlurEnd },
    forwardedRef,
) {
    const [value, setValue] = useState(initialValue || '');
    const onCommitRef = useRef(onCommit);
    useEffect(() => { onCommitRef.current = onCommit; }, [onCommit]);

    // Keep the local buffer aligned if the parent rewrites instructions
    // (e.g., wizard refine response or version restore). Don't blow away
    // in-flight keystrokes — only sync when the prop genuinely differs from
    // the last committed value.
    const lastInitialRef = useRef(initialValue);
    useEffect(() => {
        if (initialValue !== lastInitialRef.current) {
            lastInitialRef.current = initialValue;
            setValue(initialValue || '');
        }
    }, [initialValue]);

    // Single source of debouncing lives in the parent (queueSave 350 ms). A
    // second debounce here just produced out-of-order saves on rapid typing —
    // the parent's stale-buffer commit would race the editor's later one.
    // Forward every keystroke immediately; the parent coalesces.
    const handleChange = (e) => {
        const next = e.target.value;
        setValue(next);
        lastInitialRef.current = next;
        onCommitRef.current?.(next);
    };

    const handleBlur = () => {
        onBlurEnd?.();
    };

    return (
        <textarea
            ref={forwardedRef}
            value={value}
            onChange={handleChange}
            onBlur={handleBlur}
            rows={Math.max(12, (value.match(/\n/g) || []).length + 2)}
            placeholder={placeholder}
            className="w-full bg-[var(--bg-secondary)]/50 border border-transparent focus:border-[var(--border-default)] rounded-xl px-4 py-3 text-[15px] leading-7 text-[var(--text-primary)] outline-none resize-y"
        />
    );
}));

// Confirmation modal shown before flipping `embedEnabled` to true. Without
// this, the toggle silently makes the agent reachable at the public
// /chat/<id> URL — users may not realise that's what just happened.
function EnableEmbedConfirmModal({ t, agent, onConfirm, onCancel }) {
    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onCancel(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onCancel]);
    const url = agent?.id ? `${window.location.origin}/chat/${agent.id}` : '';
    return (
        <div className="fixed inset-0 z-[1100] bg-black/50 flex items-center justify-center p-4" onClick={onCancel}>
            <div className="bg-[var(--bg-primary)] rounded-xl w-full max-w-md shadow-xl border border-[var(--border-default)]" onClick={(e) => e.stopPropagation()}>
                <div className="px-5 py-4 border-b border-[var(--border-default)] text-sm font-semibold text-[var(--text-primary)]">
                    {t('agent_wizard.embed.confirm_title') || 'Make this agent public?'}
                </div>
                <div className="px-5 py-4 text-sm text-[var(--text-secondary)] space-y-3">
                    <p>{t('agent_wizard.embed.confirm_body') || 'Anyone who knows the URL will be able to chat with this agent without an account. The agent will run with its full configuration: system prompt, attached skills, and knowledge bases.'}</p>
                    {url && (
                        <div className="text-xs px-3 py-2 rounded-lg bg-[var(--bg-secondary)] text-[var(--text-tertiary)] break-all font-mono">{url}</div>
                    )}
                </div>
                <div className="flex justify-end gap-2 px-5 py-3 border-t border-[var(--border-default)]">
                    <button onClick={onCancel} className="px-4 py-2 rounded-full text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition">
                        {t('agent_wizard.embed.confirm_cancel') || 'Cancel'}
                    </button>
                    <button onClick={onConfirm} className="px-4 py-2 rounded-full text-sm bg-[var(--text-primary)] text-[var(--bg-primary)] hover:opacity-90 transition">
                        {t('agent_wizard.embed.confirm_enable') || 'Enable public access'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// Compact save-state pill for the editor header. State machine:
//   - idle:    nothing rendered (no churn before the first save)
//   - saving:  spinner + label
//   - saved:   check + label
//   - error:   warning icon, full server message in `title` tooltip,
//              click to retry the save
function SaveStateIndicator({ t, state, savedAt, errorMsg, onRetry }) {
    if (!state || state === 'idle') return null;

    if (state === 'saving') {
        return (
            <span className="inline-flex items-center gap-1.5 text-xs text-[var(--text-tertiary)]">
                <span className="w-3 h-3 inline-block rounded-full border border-[var(--text-tertiary)] border-t-transparent animate-spin" />
                Saving…
            </span>
        );
    }
    if (state === 'saved') {
        let timeStr = '';
        if (savedAt) {
            const now = new Date();
            const isToday = savedAt.toDateString() === now.toDateString();
            const time = savedAt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
            if (isToday) {
                timeStr = time;
            } else {
                const date = savedAt.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' });
                timeStr = `${date} · ${time}`;
            }
        }
        return (
            <span className="inline-flex items-center gap-1.5 text-xs text-[var(--text-tertiary)]">
                <Check size={12} className="text-emerald-500" />
                Saved{timeStr ? ` · ${timeStr}` : ''}
            </span>
        );
    }
    // error
    const tooltip = errorMsg
        ? `${t('agent_wizard.builder.save_error') || 'Save failed'}: ${errorMsg}`
        : (t('agent_wizard.builder.save_error') || 'Save failed');
    return (
        <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600 cursor-pointer"
            title={tooltip}
        >
            <span aria-hidden="true">!</span>
            {t('agent_wizard.builder.save_error') || 'Save failed'}
            <span className="underline">{t('agent_wizard.builder.save_retry') || 'retry'}</span>
        </button>
    );
}

function ActionPill({ icon, label, count, onClick, active, popoverTrigger }) {
    return (
        <button
            onClick={onClick}
            data-popover-trigger={popoverTrigger || undefined}
            className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${active ? 'border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent)]' : 'border-[var(--border-default)] bg-[var(--bg-card,#fff)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]'}`}
        >
            <span className={active ? '' : 'text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]'}>{icon}</span>
            <span>{label}</span>
            {(count !== undefined && count !== null && count > 0) && (
                <span className={`ml-0.5 text-[10px] font-semibold ${active ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)]'}`}>
                    {count}
                </span>
            )}
        </button>
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

// Routine-picker constants and components moved to ./pickers/RoutinePickers.jsx



