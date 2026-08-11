import { Plus, Sparkles, Upload, AppWindow, ArrowLeft, X, ArrowUp, Check, Clock, Settings2, Loader2 } from 'lucide-react';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAgentEditorBootstrap } from './AgentEditorBootstrapContext';
import AdvancedDrawer from './pickers/AdvancedDrawer';
import AppsPicker from './pickers/AppsPicker';
import AvatarPicker from './pickers/AvatarPicker';
import FilesUploadModal from './pickers/FilesUploadModal';
import PublishMenu from './pickers/PublishMenu';
import PlanCard from './PlanCard';
import beeFlowIcon from '../../../assets/BeeFlow-logo-Icon-2026.svg';
import useTranslation from '../../../hooks/useTranslation';
import { pickAgentAvatar, DEFAULT_AGENT_EMOJI } from '../../../utils/agentAvatar';
import { API_BASE, authFetch, parseSaveError } from '../../../utils/helpers';
import { computeRoutineNextRun } from '../../../utils/routineSchedule';
import { useCan } from '../../Gate';
import MarkdownRenderer from '../../MarkdownRenderer';
import ModelTierSelector from '../../ModelTierSelector';
import { configuredTierKeys } from '../../tierMeta';
import { INTEGRATION_CATALOG } from '../AgentDesigner/integrations';
import { filterAvailableIntegrations } from '../AgentDesigner/integrationAvailability';
import { RoutinesPicker, RoutineModal } from './pickers/RoutinePickers';
import SkillPicker from './pickers/SkillPicker';
import CategoryField from './CategoryField';
import { saveAgent } from './state/agentSaveApi';
import useAgentAutosave from './state/useAgentAutosave';
import { buildRefineContext, mergeRefinedPlan } from './state/refineMerge';
import AgentConflictModal from './AgentConflictModal';

export default function BuilderSplit({ agent: initialAgent, plan, history, tier, locale, onBack, onPublished, onDirtyChange, rightHeaderExtras = null, user = null, initialRefinement = null, readOnly = false }) {
    const { t } = useTranslation();

    const [agent, setAgent] = useState(initialAgent);
    // BFSF-271: read-only mode. `readOnly` comes from the server's per-agent
    // can_edit verdict; `forcedReadOnly` flips on when a save is rejected with
    // code 'agent_not_editable' (stale client) so we never retry-loop a 403.
    const [forcedReadOnly, setForcedReadOnly] = useState(false);
    const ro = readOnly || forcedReadOnly;
    const roRef = useRef(ro);
    roRef.current = ro;
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
    // Optimistic-concurrency version token. Seeded from the loaded agent's `rev`;
    // advanced on every successful save. null = unguarded (first save of an agent
    // loaded before the rev column existed) — the response returns a real rev.
    const [baseVersion, setBaseVersion] = useState(() => Number.isInteger(initialAgent?.rev) ? initialAgent.rev : null);
    // A refine is applying the AI's plan — locks the instructions editor and
    // marks the whole refine as one atomic operation (one save at the end).
    const [refining, setRefining] = useState(false);
    // A save came back 409: the agent changed elsewhere. Holds the server's copy
    // so the user can reconcile (load latest vs overwrite mine).
    const [conflict, setConflict] = useState(null); // null | { currentVersion, agent }
    const [conflictBusy, setConflictBusy] = useState(false);

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
                setDirty(false);
                // Adopt the restored version so the next autosave uses it as the
                // CAS base (a stale pending save can't clobber the restore).
                setBaseVersion(Number.isInteger(fresh.rev) ? fresh.rev : null);
                hookMarkSaved(fresh, fresh.rev);
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

    // Local dirty flag — drives the parent's unsaved-changes guard and the
    // best-effort beforeunload beacon. The autosave hook keeps its OWN dirty
    // flag for the save loop; this one is UX-only.
    const dirtyRef = useRef(false);

    // The full canonical snapshot the autosave hook persists on each save.
    const getSnapshot = useCallback(() => ({
        name: stateRef.current.name,
        description: stateRef.current.description,
        systemPrompt: stateRef.current.systemPrompt,
        model: stateRef.current.model,
        categoryId: stateRef.current.categoryId,
        embedEnabled: stateRef.current.embedEnabled,
        // Top-level avatar so the agents column reflects the picker (the
        // marketplace card reads agent.avatar, not config.avatar).
        avatar: stateRef.current.avatar,
        config: { ...stateRef.current.config },
    }), []);

    const autosave = useAgentAutosave({
        agentId: agent?.id,
        getSnapshot,
        baseVersion,
        enabled: !!agent?.id && !ro,
        saveFn: saveAgent,
        onError: (err) => {
            // Permission 403 → flip into read-only instead of retrying
            // (server rejects every subsequent save anyway).
            if (err?.code === 'agent_not_editable' && mountedRef.current) {
                setForcedReadOnly(true);
            }
        },
        onSaved: (updated, version, meta) => {
            // Refresh the `agent` shell only (id, timestamps, derived fields).
            // Do NOT copy the response into stateRef — by the time it resolves
            // the user may have typed more, and that newer text lives only in
            // stateRef; overwriting would silently lose keystrokes.
            if (updated && mountedRef.current) setAgent(updated);
            if (Number.isInteger(version)) setBaseVersion(version);
            dirtyRef.current = false; setDirty(false);
            setLimitWarning(null);
            const warnings = meta?.warnings || [];
            if (warnings.length && mountedRef.current) {
                setChat(prev => [...prev, { role: 'system', content: `⚠️ ${warnings.length} ${warnings.length === 1 ? 'reference' : 'references'} couldn't be linked and ${warnings.length === 1 ? 'was' : 'were'} skipped.` }]);
            }
        },
        onConflict: ({ currentVersion, agent: serverAgent }) => {
            if (mountedRef.current) setConflict({ currentVersion, agent: serverAgent });
        },
        onLimit: ({ message, resource }) => {
            if (mountedRef.current) setLimitWarning({ message, resource });
        },
    });
    const { queueSave: hookQueueSave, flush: hookFlush, markSaved: hookMarkSaved, status: autosaveStatus, error: autosaveError, savedAt: autosaveSavedAt } = autosave;

    // Mirror the hook's save status into the pill state. The initial 'saved'
    // (for an already-persisted agent) survives until the hook transitions.
    useEffect(() => {
        if (autosaveStatus && autosaveStatus !== 'idle') setSavingState(autosaveStatus);
        setSaveErrorMsg(autosaveError || '');
    }, [autosaveStatus, autosaveError]);
    useEffect(() => { if (autosaveSavedAt) setSavedAt(autosaveSavedAt); }, [autosaveSavedAt]);

    // Public save helpers used by the ~20 edit handlers below. queueSave also
    // marks the local dirty flag for the parent's unsaved-changes guard.
    const queueSave = useCallback((immediate = false) => {
        // Read-only: belt-and-braces so any edit handler that slipped through
        // the disabled UI can never mark dirty or fire a save.
        if (roRef.current) return;
        dirtyRef.current = true;
        setDirty(true);
        hookQueueSave(immediate);
    }, [hookQueueSave]);
    const flush = useCallback(() => hookFlush(), [hookFlush]);

    // ── Conflict (409) reconcile ──────────────────────────────────
    // Load latest: re-fetch the server copy and rehydrate (discards local
    // unsaved edits — the modal warns about this). Reuses handleVersionRestore.
    const handleConflictLoadLatest = async () => {
        if (conflictBusy) return;
        setConflictBusy(true);
        try { await handleVersionRestore(); } finally {
            if (mountedRef.current) { setConflict(null); setConflictBusy(false); }
        }
    };
    // Overwrite: re-send the local snapshot with the server's current version as
    // the CAS base. If it conflicts again, re-open with the newer version.
    const handleConflictOverwrite = async () => {
        if (conflictBusy || !agentIdRef.current || !conflict) return;
        setConflictBusy(true);
        try {
            const res = await saveAgent(agentIdRef.current, getSnapshot(), conflict.currentVersion);
            if (!mountedRef.current) return;
            if (res.ok) {
                if (res.updated) setAgent(res.updated);
                if (Number.isInteger(res.version)) setBaseVersion(res.version);
                hookMarkSaved(res.updated, res.version);
                dirtyRef.current = false; setDirty(false);
                setConflict(null);
            } else if (res.conflict) {
                setConflict({ currentVersion: res.currentVersion, agent: res.agent });
            } else if (res.limit) {
                setLimitWarning({ message: res.message, resource: res.resource });
                setConflict(null);
            }
        } catch (err) {
            if (mountedRef.current) {
                setSavingState('error');
                setSaveErrorMsg(String(err?.message || err || 'Save failed').slice(0, 500));
                setConflict(null);
            }
        } finally {
            if (mountedRef.current) setConflictBusy(false);
        }
    };
    const handleConflictDismiss = () => { if (!conflictBusy) setConflict(null); };

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
            // Seed the concurrency token so post-create autosaves use CAS.
            setBaseVersion(Number.isInteger(created.rev) ? created.rev : 1);
            hookMarkSaved(created, created.rev);
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
            if (roRef.current) return; // read-only sessions never save
            if (agentIdRef.current && dirtyRef.current) {
                // Best-effort last save on tab close. Deliberately WITHOUT a
                // baseVersion so it lands unguarded (a 409 has no UI to reconcile
                // against during unload).
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
        // stateRef so the save picks it up (also for drafts, so the first POST
        // includes it), then queue an immediate save (a no-op without an id).
        stateRef.current.model = v;
        queueSave(true);
    };
    const updateCategory = (id) => { setCategoryId(id); stateRef.current.categoryId = id; dirtyRef.current = true; queueSave(true); };
    // BFSF-272: category CRUD for the CategoryField manage popover. Every
    // mutation also refreshes the bootstrap provider — its mirror effect
    // (setCategories(bootstrap.categories) above) would otherwise resurrect
    // deleted/renamed rows on the next re-fire. Errors return inline
    // (rendered by CategoryField) instead of alert().
    const createCategory = async (name) => {
        const trimmed = name?.trim();
        if (!trimmed) return { ok: false, error: 'Name is required' };
        try {
            const res = await authFetch(`${API_BASE}/agents/categories`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: trimmed }),
            });
            if (!res.ok) throw new Error(await res.text());
            const created = await res.json();
            // Idempotent create: `existing: true` = case-insensitive duplicate —
            // select the existing row, never append a doppelgänger option.
            setCategories(prev => (prev.some(c => c.id === created.id) ? prev : [...prev, created]));
            updateCategory(created.id);
            bootstrap.refreshCategories?.();
            return { ok: true, category: created, existed: !!created.existing };
        } catch (err) {
            return { ok: false, error: err.message || 'Failed to create category' };
        }
    };
    const renameCategory = async (id, name) => {
        try {
            const res = await authFetch(`${API_BASE}/agents/categories/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) return { ok: false, error: data.error || 'Rename failed', code: data.code };
            setCategories(prev => prev.map(c => (c.id === id ? { ...c, ...data } : c)));
            bootstrap.refreshCategories?.();
            return { ok: true, category: data };
        } catch (err) {
            return { ok: false, error: err.message || 'Rename failed' };
        }
    };
    const deleteCategory = async (id, reassignTo) => {
        try {
            // On the DEFINITIVE call (reassignTo set): if the open agent uses
            // this category, move it locally FIRST and flush the save. The
            // server-side reassign bumps `rev` on every agent still in the
            // category — pre-moving keeps this editor's baseVersion current
            // so the next autosave doesn't hit a spurious 409 conflict modal.
            // (Not on the bare first attempt: that may 409 with "in use" and
            // the user could still cancel.)
            if (reassignTo && stateRef.current.categoryId === id) {
                updateCategory(reassignTo !== 'none' ? reassignTo : null);
                try { await flush(); } catch (_) { /* best-effort */ }
            }
            const qs = reassignTo ? `?reassignTo=${encodeURIComponent(reassignTo)}` : '';
            const res = await authFetch(`${API_BASE}/agents/categories/${id}${qs}`, { method: 'DELETE' });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) return { ok: false, error: data.error || 'Delete failed', code: data.code, count: data.count };
            setCategories(prev => prev.filter(c => c.id !== id));
            // Bare-delete success while a DRAFT (unpersisted) agent still
            // points at the category — clear the dangling local selection.
            if (stateRef.current.categoryId === id) {
                updateCategory(null);
            }
            bootstrap.refreshCategories?.();
            return { ok: true };
        } catch (err) {
            return { ok: false, error: err.message || 'Delete failed' };
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
        setRefining(true);
        // Close the instructions editor so its buffer can't race the refined
        // value (every keystroke is already mirrored into stateRef, so nothing
        // is lost). Flush any pending manual edit first so the refine's own save
        // is the only one that fires during this operation.
        setInstructionsEditing(false);
        if (dirtyRef.current) { try { await flush(); } catch (_) { /* best effort */ } }
        try {
            // Send the AI the CURRENT curated config and tell it to preserve it.
            const attachedSkills = (attachedSkillIds || []).map(id => {
                const s = skillNamesById.get(id);
                return { id, name: s?.name || '' };
            });
            const ctx = buildRefineContext({
                name,
                description,
                avatar,
                systemPrompt: stateRef.current.systemPrompt,
                capabilities: plan?.capabilities || stateRef.current.config?.wizard?.capabilities || [],
                model: stateRef.current.model,
                enabledIntegrations: stateRef.current.config?.enabledIntegrations || [],
                attachedSkills,
                knowledge_base_ids: stateRef.current.config?.knowledge_base_ids || [],
            });
            const res = await authFetch(`${API_BASE}/agents/wizard/refine`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: chat[0]?.content || '',
                    plan: ctx.plan,
                    current: ctx.current,
                    refinement: text,
                    modelTier: chatTier || tier || 'fast',
                    locale,
                }),
            });
            if (!res.ok) {
                // Structured, actionable error — a malformed model output (422)
                // is retryable; anything else surfaces the server reason. No
                // state was mutated, so the save pill stays coherent.
                let msg;
                try {
                    const body = await res.json();
                    msg = body?.reason === 'plan_parse_failed'
                        ? t('agent_wizard.builder.refine_parse_error', 'The assistant returned malformed output. Please try again.')
                        : (body?.error || `Refine failed (${res.status})`);
                } catch (_) { msg = `Refine failed (${res.status})`; }
                setChat(prev => [...prev, { role: 'error', content: msg }]);
                return;
            }
            const { plan: updated, preserved } = await res.json();

            // Resolve skills BEFORE the single save so attachedSkillIds are
            // valid. Base off stateRef (not the stale attachedSkillIds closure).
            const attach = new Set(stateRef.current.config?.attachedSkillIds || []);
            if (Array.isArray(updated.skills) && updated.skills.length > 0) {
                for (const s of updated.skills) {
                    if (s.id && (allSkills || []).some(x => x.id === s.id)) {
                        attach.add(s.id); // reuse an existing skill
                    } else if (!s.id && s.name) {
                        try {
                            const sres = await authFetch(`${API_BASE}/api/skills`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ name: s.name, description: s.description || '', instructions: s.instructions || '', isShared: false, dynamicActivation: false, automationId: null }),
                            });
                            if (sres.ok) {
                                const created = await sres.json();
                                if (created?.id) { setAllSkills(prev => [...(prev || []), created]); attach.add(created.id); }
                            }
                        } catch (_) { /* non-fatal — a failed skill is simply not attached */ }
                    }
                }
            }
            const resolvedSkillIds = Array.from(attach);

            // Fold the whole plan into ONE canonical snapshot: preserve & patch.
            const merged = mergeRefinedPlan(
                {
                    name,
                    description,
                    systemPrompt: stateRef.current.systemPrompt,
                    avatar,
                    model: stateRef.current.model,
                    config: stateRef.current.config,
                },
                updated,
                preserved,
                {
                    availableIntegrationIds: availableIntegrations.map(a => a.id),
                    selectableTierKeys: configuredTierKeys(tiers),
                    resolvedSkillIds,
                },
            );

            // Apply to stateRef (the canonical source the save reads) AND to
            // React state, in one synchronous block.
            stateRef.current.name = merged.name;
            stateRef.current.description = merged.description;
            stateRef.current.systemPrompt = merged.systemPrompt;
            stateRef.current.avatar = merged.avatar;
            stateRef.current.model = merged.model;
            stateRef.current.config = merged.config;
            setName(merged.name);
            setDescription(merged.description);
            setInstructions(merged.systemPrompt);
            setAvatar(merged.avatar);
            setModel(merged.model);
            if (typeof merged.model === 'string' && merged.model.startsWith('tier:')) setSelectedTier(merged.model.slice(5));
            setEnabledIntegrations(merged.config.enabledIntegrations || []);
            setAttachedSkillIds(merged.config.attachedSkillIds || []);
            setKnowledgeBaseIds(merged.config.knowledge_base_ids || []);

            // ONE atomic save of the merged snapshot.
            queueSave(true);

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
            setRefining(false);
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
        await flush();
        if (onPublished) onPublished(agent);
    };

    // Filter integration catalog by org/credential gating (shared with the
    // skill editor — see AgentDesigner/integrationAvailability.js).
    const availableIntegrations = filterAvailableIntegrations(INTEGRATION_CATALOG, integrationStatus);

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
                shows through under the refine-this-agent rail. Hidden in
                read-only mode: refining mutates the agent (BFSF-271). */}
            {!ro && (
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
                                title={t('agent_wizard.builder.send', 'Send')}
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
            )}

            {/* Drag handle */}
            {!ro && (
            <div
                onMouseDown={onDragStart}
                className="w-1 flex-shrink-0 cursor-col-resize hover:bg-[var(--accent)]/40 active:bg-[var(--accent)]/60 transition-colors z-10"
            />
            )}

            {/* Right config panel */}
            <main className="flex-1 overflow-y-auto">
                <div className="flex items-center justify-end gap-3 px-8 py-3 relative">
                    {/* Read-only: the refine rail (and its Back button) is hidden,
                        so surface Back here; no save/publish controls. */}
                    {ro && (
                        <>
                            <button
                                type="button"
                                onClick={onBack}
                                className="mr-auto flex items-center gap-1 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                            >
                                <ArrowLeft size={16} /> {t('agent_wizard.back')}
                            </button>
                            <span
                                role="status"
                                className="text-xs px-2.5 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/5 text-[var(--text-secondary)]"
                            >
                                {t('agent_studio.read_only_banner', "Read-only — you don't have permission to edit this agent.")}
                            </span>
                        </>
                    )}
                    {!ro && (agent?.id ? (
                        <SaveStateIndicator t={t} state={savingState} savedAt={savedAt} errorMsg={saveErrorMsg} onRetry={flush} />
                    ) : (
                        <>
                            <span className="text-xs text-[var(--text-tertiary)]">
                                {t('agent_wizard.builder.draft_label', 'Draft — not saved yet')}
                            </span>
                            <button
                                type="button"
                                onClick={saveDraft}
                                disabled={savingState === 'saving'}
                                className="px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white text-xs font-medium hover:opacity-90 disabled:opacity-50 transition"
                            >
                                {savingState === 'saving'
                                    ? (t('agent_wizard.builder.saving', 'Saving…'))
                                    : (t('agent_wizard.builder.save_draft', 'Save'))}
                            </button>
                        </>
                    ))}
                    {rightHeaderExtras}
                    {agent?.id && !ro && (
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
                        {/* `inert` (React 19 native) blocks pointer AND keyboard
                            for the whole subtree without touching the layout —
                            unlike fieldset[disabled], whose display:contents is
                            not honoured by browsers (fieldsets always generate
                            their own block box, which would break these flex
                            rows for EVERYONE, read-only or not). */}
                        <div className="flex items-center gap-4 mb-4" inert={ro || undefined}>
                            <AvatarPicker t={t} avatar={avatar} onChange={updateAvatar} size="lg" />
                            <input
                                value={name}
                                onChange={(e) => updateName(e.target.value)}
                                onBlur={flushNow}
                                className="flex-1 text-3xl font-semibold bg-transparent outline-none text-[var(--text-primary)] py-1 px-2 rounded-lg hover:bg-[var(--bg-secondary)] focus:bg-[var(--bg-secondary)] transition"
                                placeholder={t('agent_wizard.builder.name_placeholder')}
                            />
                        </div>

                    <div ref={actionBarRef} inert={ro || undefined} className={`flex flex-wrap items-center gap-2 relative ${ro ? 'opacity-60' : ''}`}>
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
                            label={t('agent_wizard.builder.skills', 'Skills')}
                            count={attachedSkillIds.length}
                            onClick={() => setSkillPickerOpen(v => !v)}
                            active={skillPickerOpen}
                        />
                        {agent?.id && routinesAllowed && (
                            <ActionPill
                                icon={<Clock size={14} />}
                                label={t('routines.title', 'Routines')}
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
                            title={t('agent_wizard.builder.advanced_settings', 'Advanced settings')}
                            aria-label={t('agent_wizard.builder.advanced_settings', 'Advanced settings')}
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
                        <div className="mb-8 space-y-3" inert={ro || undefined}>
                            <div>
                                <div className="text-[13px] font-medium text-[var(--text-secondary)] mb-1">
                                    {t('agent_wizard.builder.role_description_label', 'Role description')}
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
                                    {t('agent_wizard.builder.category_label', 'Category')}
                                </div>
                                <CategoryField
                                    t={t}
                                    value={categoryId}
                                    categories={categories}
                                    onChange={updateCategory}
                                    onCreate={createCategory}
                                    onRename={renameCategory}
                                    onDelete={deleteCategory}
                                />
                            </div>
                        </div>
                    ) : (!ro && (
                        <button
                            type="button"
                            onClick={() => setDetailsOpen(true)}
                            className="mb-8 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition flex items-center gap-1"
                        >
                            <Plus size={12} />
                            {t('agent_wizard.builder.add_details', 'Add description & category')}
                        </button>
                    ))}

                    <div className="mb-2">
                        <div className="flex items-center gap-2 mb-1">
                            <div className="text-[13px] font-medium text-[var(--text-secondary)]">
                                {t('agent_wizard.builder.instructions')}
                            </div>
                            {refining && (
                                <span className="inline-flex items-center gap-1 text-[11px] text-[var(--text-tertiary)]">
                                    <Loader2 size={11} className="animate-spin" />
                                    {t('agent_wizard.builder.updating', 'Updating…')}
                                </span>
                            )}
                        </div>
                        {instructionsEditing && !refining && !ro ? (
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
                                tabIndex={(refining || ro) ? -1 : 0}
                                onClick={(refining || ro) ? undefined : () => setInstructionsEditing(true)}
                                onFocus={(refining || ro) ? undefined : () => setInstructionsEditing(true)}
                                aria-disabled={refining || ro || undefined}
                                className={`instructions-view min-h-[10rem] px-4 py-3 -mx-4 rounded-xl transition ${refining ? 'opacity-60 cursor-default' : ro ? 'cursor-default' : 'cursor-text hover:bg-[var(--bg-secondary)]/40'}`}
                                title={(refining || ro) ? undefined : t('agent_wizard.builder.instructions_edit_hint', 'Click to edit')}
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

            {/* BFSF-270: no `agent?.id` gate — for unsaved drafts the pill used
                to flip knowledgeOpen and render NOTHING (a silent no-op). The
                server never required a saved agent: uploads are KB-scoped and
                the KB link is staged in stateRef.current.config, which the
                draft's first save persists. */}
            {knowledgeOpen && (
                <FilesUploadModal
                    t={t}
                    agent={agent}
                    agentName={name}
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
            {conflict && (
                <AgentConflictModal
                    t={t}
                    busy={conflictBusy}
                    onLoadLatest={handleConflictLoadLatest}
                    onOverwrite={handleConflictOverwrite}
                    onDismiss={handleConflictDismiss}
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
                            {t('routines.delete_title', 'Delete routine')}
                        </div>
                        <div className="px-5 py-4 text-sm text-[var(--text-secondary)]">
                            {(t('routines.delete_body', 'Delete "{title}"?')).replace('{title}', routineDeleteTarget.title || '')}
                        </div>
                        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--border-default)]">
                            <button
                                onClick={() => setRoutineDeleteTarget(null)}
                                disabled={routineDeleting}
                                className="px-4 py-2 rounded-full text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] disabled:opacity-50"
                            >
                                {t('agent_studio.cancel', 'Cancel')}
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
                                {routineDeleting ? (t('agent_studio.deleting', 'Deleting…')) : (t('agent_studio.delete', 'Delete'))}
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
                    {t('agent_wizard.embed.confirm_title', 'Make this agent public?')}
                </div>
                <div className="px-5 py-4 text-sm text-[var(--text-secondary)] space-y-3">
                    <p>{t('agent_wizard.embed.confirm_body', 'Anyone who knows the URL will be able to chat with this agent without an account. The agent will run with its full configuration: system prompt, attached skills, and knowledge bases.')}</p>
                    {url && (
                        <div className="text-xs px-3 py-2 rounded-lg bg-[var(--bg-secondary)] text-[var(--text-tertiary)] break-all font-mono">{url}</div>
                    )}
                </div>
                <div className="flex justify-end gap-2 px-5 py-3 border-t border-[var(--border-default)]">
                    <button onClick={onCancel} className="px-4 py-2 rounded-full text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition">
                        {t('agent_wizard.embed.confirm_cancel', 'Cancel')}
                    </button>
                    <button onClick={onConfirm} className="px-4 py-2 rounded-full text-sm bg-[var(--text-primary)] text-[var(--bg-primary)] hover:opacity-90 transition">
                        {t('agent_wizard.embed.confirm_enable', 'Enable public access')}
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
        ? `${t('agent_wizard.builder.save_error', 'Save failed')}: ${errorMsg}`
        : (t('agent_wizard.builder.save_error', 'Save failed'));
    return (
        <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600 cursor-pointer"
            title={tooltip}
        >
            <span aria-hidden="true">!</span>
            {t('agent_wizard.builder.save_error', 'Save failed')}
            <span className="underline">{t('agent_wizard.builder.save_retry', 'retry')}</span>
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



// Routine-picker constants and components moved to ./pickers/RoutinePickers.jsx



