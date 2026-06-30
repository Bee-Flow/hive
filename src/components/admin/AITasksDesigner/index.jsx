import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Bot, Plus, Play, Pause, X, ArrowLeft, Search } from 'lucide-react';
import { API_BASE, authFetch } from '../../../utils/helpers';
import MarkdownRenderer from '../../MarkdownRenderer';
import BuilderShell from './Builder/BuilderShell';
import RoutineRow from '../Studio/RoutinesStudio/RoutineRow';
import RoutinesEmptyState from '../Studio/RoutinesStudio/EmptyState';
import QuickSwitcher from '../Studio/RoutinesStudio/QuickSwitcher';
import useAutomationApi from '../../../hooks/useAutomationApi';
import { showToast, ToastHost } from '../guardrails/Toast';
import { useEntitlements } from '../../EntitlementsContext';
import { formatNextRun, buildMessageFromSuggestion } from './taskFormatters';
import ListView from './ListView';
import EditorView from './EditorView';

export default function AITasksDesigner({ initialTaskId = null, initialStepId = null, initialFlowletKey = null, onClose, onNavigate, modelTiers = {}, embedded = false, user = null, onEditingChange }) {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(false);
    const [maxTasks, setMaxTasks] = useState(10);
    const [resultModal, setResultModal] = useState(null);
    const [pendingDeleteTask, setPendingDeleteTask] = useState(null);

    // Sub-tab: prompt tasks (legacy) or automations (new conversational builder)
    const [subTab, setSubTab] = useState('prompt'); // 'prompt' | 'automations' (kept for back-compat with legacy non-embedded view)
    const [segment, setSegment] = useState('automation'); // 'automation' | 'prompt_task' — controls which list shows in the unified sidebar
    const [builderAutomationId, setBuilderAutomationId] = useState(null); // null = list, string = open builder
    // Which tab the builder opens on (e.g. 'history' from a "View executions"
    // affordance). Consumed once on mount, then cleared.
    const [builderInitialTab, setBuilderInitialTab] = useState(null);
    const [openingBuilder, setOpeningBuilder] = useState(false);
    // A brand-new automation has no id in `builderAutomationId` (it stays '')
    // until BuilderShell lazily creates the row server-side. `liveAutomationId`
    // carries the id it reports back so the URL/refresh path can pick it up.
    const [liveAutomationId, setLiveAutomationId] = useState(null);
    // Automation list — fetched up here so the sidebar shares one source of truth
    // and we can power Cmd/Ctrl+K + the right-pane builder from the same data.
    const automationApi = useAutomationApi();
    const [automations, setAutomations] = useState([]);
    const [automationsLoading, setAutomationsLoading] = useState(false);
    const [pendingDeleteAutomation, setPendingDeleteAutomation] = useState(null);
    const [presetChatInput, setPresetChatInput] = useState(''); // seeded from EmptyState examples
    const [autoSendInput, setAutoSendInput] = useState(null); // "Build it directly" — auto-fire this spec in a fresh builder
    // Reusable Steps (kind='block') — own builder + own list. Always available
    // wherever automations are (no separate feature flag).
    const [builderStepId, setBuilderStepId] = useState(null); // null=list · ''=new · id=editing
    const [steps, setSteps] = useState([]);
    const [stepsLoading, setStepsLoading] = useState(false);
    const [quickSwitcherOpen, setQuickSwitcherOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    // Signal upward (Studio → AgentHub) when the BuilderShell is open so the
    // outer chrome can collapse for a fullscreen edit, mirroring AgentStudio.
    const automationEditing = ((embedded && segment === 'automation') || subTab === 'automations') && (builderAutomationId !== null || openingBuilder || builderStepId !== null);
    // Editor view state — null means list/idle view
    const [editingTaskId, setEditingTaskId] = useState(null); // string = edit, 'new' = create
    const [title, setTitle] = useState('');
    const [prompt, setPrompt] = useState('');
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [repeatInterval, setRepeatInterval] = useState('weekly');
    const [tier, setTier] = useState('auto');
    const [agentId, setAgentId] = useState('');
    const [agents, setAgents] = useState([]);
    // Unified entitlements snapshot — replaces the legacy user?.betaFeatures
    // reads so the UI matches the server's requireCapability gating exactly
    // (super-admins are granted every beta by the resolver itself).
    const ent = useEntitlements();
    const routinesAllowed = !ent.loading && ent.can('agent_routines');

    // The id of the routine/automation currently open in the editor. Drives the
    // URL path so a refresh (or browser back/forward) reopens it. For automations
    // the builder id wins; a brand-new draft falls back to the id BuilderShell
    // reports once it lazily creates the row. For prompt tasks it's the task being
    // edited (never the 'new' sentinel — that has no persistable id yet).
    const selectedRoutineId =
        segment === 'automation'
            ? (builderAutomationId || liveAutomationId || null)
            : (editingTaskId && editingTaskId !== 'new' ? editingTaskId : null);

    // Editing-signal: only the Automations builder requests fullscreen chrome
    // collapse. Editing a regular routine keeps the Studio top-tabs visible
    // so users don't lose their place — routines is a section inside Studio,
    // not a separate screen.
    const taskEditing = subTab === 'prompt' && editingTaskId !== null;
    useEffect(() => {
        onEditingChange?.(automationEditing);
        return () => { onEditingChange?.(false); };
    }, [automationEditing, onEditingChange]);

    const fetchTasks = useCallback(async () => {
        setLoading(true);
        try {
            const res = await authFetch(`${API_BASE}/api/ai-tasks`);
            if (res.ok) {
                const data = await res.json();
                setTasks(data.tasks || []);
                if (data.maxTasks) setMaxTasks(data.maxTasks);
            } else {
                console.error('[AITasksDesigner] fetchTasks failed:', res.status, res.statusText);
            }
        } catch (err) {
            // Promoted from a silent catch — at minimum surface in devtools
            // so a misconfigured route shows up during QA.
            console.error('[AITasksDesigner] fetchTasks error:', err);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchTasks();
    }, [fetchTasks]);

    // Snap sub-tab back to 'prompt' when the user loses access to the
    // Automations beta. Replaces the old `setTimeout(setSubTab, 0)` in
    // render which was a setState-in-render anti-pattern.
    const automationsAllowed = !ent.loading && ent.can('automations');
    useEffect(() => {
        // Don't snap on the pre-load snapshot — a deep-link into Automations
        // would be bounced to 'prompt' before entitlements resolve.
        if (ent.loading) return;
        if (subTab === 'automations' && !automationsAllowed) {
            setSubTab('prompt');
        }
    }, [subTab, automationsAllowed, ent.loading]);

    // Load the user's own agents so a routine can be (re)assigned to one. Only
    // fetch when the beta is enabled — otherwise the selector stays hidden.
    useEffect(() => {
        if (!routinesAllowed) return;
        (async () => {
            try {
                const res = await authFetch(`${API_BASE}/agents/all`);
                if (res.ok) setAgents(await res.json());
                else console.error('[AITasksDesigner] agents/all failed:', res.status);
            } catch (err) { console.error('[AITasksDesigner] agents/all error:', err); }
        })();
    }, [routinesAllowed]);

    // ── URL ↔ open-routine sync ───────────────────────────────────────────
    // The path encodes what's open so a refresh — and browser back/forward —
    // restores it: /app/studio/routines/<id> for an automation, and
    // /app/studio/routines/<id>/<flowletKey> when drilled into a flowlet.
    // `lastRouteRef` holds that descriptor ('<id>' | '<id>/<flowlet>' | 'new'
    // | null) and is the shared reconciliation point: the push paths record
    // what they sent; the reconcile effect reads it to tell its own echo apart
    // from a genuine external change (deep link / back-forward).
    const lastRouteRef = useRef(null);

    // Reconcile local state → what the URL points at. Runs on first load and on
    // browser back/forward; a no-op for the echo of our own pushes. The flowlet
    // scope reaches BuilderShell via the `initialFlowletKey` prop — here we only
    // open the right automation/task and record the descriptor.
    useEffect(() => {
        if (initialTaskId === 'new') {
            if (lastRouteRef.current === 'new') return;
            lastRouteRef.current = 'new';
            setSegment('prompt_task');
            startNewTask();
            return;
        }
        const urlId = initialTaskId || null;
        const urlScope = initialFlowletKey || null;
        const urlKey = urlId ? (urlScope ? `${urlId}/${urlScope}` : urlId) : null;
        if (urlKey === lastRouteRef.current) return;
        if (urlId) {
            // Prefer an automation match (the visual builder); fall back to a
            // prompt task. Ids don't collide across the two, so order is safe.
            const auto = automations.find(a => a.id === urlId);
            if (auto) {
                lastRouteRef.current = urlKey;
                setSegment('automation');
                setBuilderAutomationId(urlId);
                return;
            }
            const task = tasks.find(t => t.id === urlId);
            if (task) {
                lastRouteRef.current = urlId; // prompt tasks have no flowlet scope
                setSegment('prompt_task');
                startEditTask(task);
                return;
            }
            return; // not loaded yet (or stale id) — retry when the lists update
        }
        // urlId is null → the URL points at the bare list; close any open editor.
        lastRouteRef.current = null;
        setBuilderAutomationId(null);
        setOpeningBuilder(false);
        if (editingTaskId !== null) resetForm();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialTaskId, initialFlowletKey, automations, tasks]);

    // Push the OPEN ROUTINE (id) to the URL when it changes. Compares only the
    // id portion of the descriptor so a flowlet drill (same id, see
    // handleScopeChange below) isn't clobbered back to the root path. Only in
    // the embedded Studio shell, which owns the onNavigate → history bridge.
    useEffect(() => {
        if (!embedded || !onNavigate) return;
        // A Step builder owns the URL while open — let the step push effect drive
        // it instead of clobbering it back to the routine path.
        if (builderStepId !== null) return;
        const currentId = lastRouteRef.current ? lastRouteRef.current.split('/')[0] : null;
        if (selectedRoutineId === currentId) return;
        // A different routine opened/closed — drop any flowlet scope (it belongs
        // to the routine we're leaving), landing on the bare id or the list.
        lastRouteRef.current = selectedRoutineId || null;
        onNavigate(selectedRoutineId ? `studio/routines/${selectedRoutineId}` : 'studio/routines');
    }, [embedded, onNavigate, selectedRoutineId, builderStepId]);

    // Adopt a deep-linked Step id on mount (refresh / back into the Step builder).
    const stepUrlAdoptedRef = useRef(false);
    useEffect(() => {
        if (stepUrlAdoptedRef.current) return;
        if (initialStepId) { setBuilderStepId(initialStepId); setSegment('automation'); }
        stepUrlAdoptedRef.current = true;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialStepId]);

    // Push the OPEN STEP id to the URL (under /steps/), or land on the routines
    // list when the Step builder closes.
    useEffect(() => {
        if (!embedded || !onNavigate) return;
        if (builderStepId === null) return; // closed → the routine effect takes over
        const want = builderStepId ? `steps/${builderStepId}` : null;
        if (!want || want === lastRouteRef.current) return;
        lastRouteRef.current = want;
        onNavigate(`studio/routines/${want}`);
    }, [embedded, onNavigate, builderStepId]);

    // Push the FLOWLET scope to the URL. Called by BuilderShell whenever the
    // user drills into / out of a flowlet. Imperative (not an effect) so the id
    // portion stays put and there's no lag while BuilderShell settles its scope.
    const handleScopeChange = useCallback((scopeKey) => {
        if (!embedded || !onNavigate) return;
        const id = builderAutomationId || liveAutomationId;
        if (!id) return; // no automation to anchor the scope to yet
        const key = scopeKey ? `${id}/${scopeKey}` : id;
        if (key === lastRouteRef.current) return;
        lastRouteRef.current = key;
        onNavigate(scopeKey ? `studio/routines/${id}/${scopeKey}` : `studio/routines/${id}`);
    }, [embedded, onNavigate, builderAutomationId, liveAutomationId]);

    // `liveAutomationId` only bridges the gap while a brand-new draft has no id
    // in `builderAutomationId` yet. Clear it whenever builderAutomationId changes
    // (open another, or close) so a stale id can't linger in the path.
    useEffect(() => {
        setLiveAutomationId(null);
    }, [builderAutomationId]);

    const resetForm = () => {
        setTitle(''); setPrompt(''); setDate(''); setTime('');
        setRepeatInterval('weekly'); setTier('auto');
        setAgentId('');
        setEditingTaskId(null);
    };

    const startNewTask = () => {
        resetForm();
        setEditingTaskId('new');
    };

    const startEditTask = (task) => {
        setEditingTaskId(task.id);
        setTitle(task.title || '');
        setPrompt(task.prompt || '');
        if (task.nextRunAt) {
            const d = new Date(task.nextRunAt);
            setDate(d.toLocaleDateString('sv-SE'));
            setTime(d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
        } else {
            setDate(''); setTime('');
        }
        setRepeatInterval(task.repeatInterval || '');
        setTier(task.modelTier || 'auto');
        setAgentId(task.agentId || '');
    };

    const saveTask = async () => {
        if (!title.trim() || !prompt.trim() || !date || !time) return;
        const nextRunAt = new Date(`${date}T${time}`).toISOString();
        const body = {
            title: title.trim(),
            prompt: prompt.trim(),
            nextRunAt,
            repeatInterval: repeatInterval || null,
            modelTier: tier,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
            ...(routinesAllowed ? { agentId: agentId || null } : {}),
        };
        try {
            const isNew = editingTaskId === 'new';
            const res = await authFetch(
                isNew ? `${API_BASE}/api/ai-tasks` : `${API_BASE}/api/ai-tasks/${editingTaskId}`,
                {
                    method: isNew ? 'POST' : 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                }
            );
            if (res.ok) {
                await fetchTasks();
                resetForm();
            } else {
                const err = await res.json().catch(() => ({}));
                alert(err.error || 'Failed to save task');
            }
        } catch (err) { console.error('Save AI task failed:', err); }
    };

    const toggleTask = async (id) => {
        try {
            const res = await authFetch(`${API_BASE}/api/ai-tasks/${id}/toggle`, { method: 'POST' });
            if (res.ok) fetchTasks();
        } catch (err) { console.error('Toggle AI task failed:', err); }
    };

    const requestDeleteTask = (task) => {
        setPendingDeleteTask(task);
    };

    const confirmDeleteTask = async () => {
        if (!pendingDeleteTask) return;
        try {
            await authFetch(`${API_BASE}/api/ai-tasks/${pendingDeleteTask.id}`, { method: 'DELETE' });
            setTasks(prev => prev.filter(t => t.id !== pendingDeleteTask.id));
            if (editingTaskId === pendingDeleteTask.id) resetForm();
            setPendingDeleteTask(null);
        } catch (err) { console.error('Delete AI task failed:', err); }
    };

    const runTaskNow = async (id) => {
        try {
            const res = await authFetch(`${API_BASE}/api/ai-tasks/${id}/run-now`, { method: 'POST' });
            if (res.ok) fetchTasks();
        } catch (err) { console.error('Run AI task failed:', err); }
    };

    const openInDirectChat = useCallback((title, content) => {
        setResultModal(null);
        window.dispatchEvent(new CustomEvent('openDirectChatWithContext', {
            detail: { title, content }
        }));
    }, []);

    // ── Automations data + actions ───────────────────────────────────────
    const fetchAutomations = useCallback(async () => {
        setAutomationsLoading(true);
        try {
            const r = await automationApi.listAutomations();
            setAutomations(r.automations || []);
        } catch (err) {
            console.warn('[AITasksDesigner] fetchAutomations failed:', err.message);
        }
        setAutomationsLoading(false);
    }, [automationApi]);

    useEffect(() => { fetchAutomations(); }, [fetchAutomations]);

    // Refresh the automation list whenever the builder closes — covers the
    // case where the user finalised a draft, renamed via the inline title,
    // toggled active, etc. and the sidebar should show the new state.
    useEffect(() => {
        if (builderAutomationId === null && !openingBuilder) { fetchAutomations(); }
    }, [builderAutomationId, openingBuilder, fetchAutomations]);

    // ── Reusable Steps (kind='block') ──────────────────────────────────────
    const fetchSteps = useCallback(async () => {
        setStepsLoading(true);
        try {
            const r = await automationApi.listSteps();
            setSteps(r.steps || []);
        } catch (err) {
            console.warn('[AITasksDesigner] fetchSteps failed:', err.message);
        }
        setStepsLoading(false);
    }, [automationApi]);

    useEffect(() => { fetchSteps(); }, [fetchSteps]);
    // Refresh the Step list when the Step builder closes.
    useEffect(() => {
        if (builderStepId === null) fetchSteps();
    }, [builderStepId, fetchSteps]);

    const onDeleteStep = useCallback(async (step) => {
        if (!step?.id) return;
        if (typeof window !== 'undefined' && !window.confirm(`Delete the Step "${step.title || 'Untitled'}"? This can't be undone.`)) return;
        try {
            await automationApi.deleteStep(step.id);
            if (builderStepId === step.id) setBuilderStepId(null);
            await fetchSteps();
        } catch (err) {
            if (err?.status === 409) {
                alert('This Step is still used by one or more automations. Remove it there first.');
            } else {
                alert(`Could not delete the Step: ${err.message}`);
            }
        }
    }, [automationApi, fetchSteps, builderStepId]);

    // Poll active runs every 5s so the sidebar can show a live ● dot on
    // any automation currently executing. n8n-style ambient awareness so
    // the user knows their scheduled flows ran without opening each one.
    const [activeRunIds, setActiveRunIds] = useState(new Set());
    useEffect(() => {
        let alive = true;
        const tick = async () => {
            try {
                const r = await automationApi.getActiveRuns?.();
                if (!alive || !r) return;
                setActiveRunIds(new Set((r.active || []).map(x => x.automationId)));
            } catch (_) { /* silent — non-critical */ }
        };
        tick();
        const handle = setInterval(tick, 5000);
        return () => { alive = false; clearInterval(handle); };
    }, [automationApi]);

    // Per-row in-flight dedupe for the active/pause toggle. Without this,
    // a rapid double-click fires two PATCHes against the same automation
    // (the second sees the post-first state and immediately reverses it).
    // The ref-based check survives stale React state and the toast
    // surfaces failures the user used to only see in console.warn.
    const togglePendingRef = useRef(new Set());
    const toggleAutomation = useCallback(async (a) => {
        if (togglePendingRef.current.has(a.id)) return;
        togglePendingRef.current.add(a.id);
        try {
            if (a.isActive) await automationApi.deactivate(a.id);
            else await automationApi.activate(a.id);
            await fetchAutomations();
        } catch (err) {
            console.warn('[AITasksDesigner] toggleAutomation failed:', err.message);
            showToast('error', `Could not ${a.isActive ? 'pause' : 'activate'} “${a.title || a.id}”: ${err.message}`);
        } finally {
            togglePendingRef.current.delete(a.id);
        }
    }, [automationApi, fetchAutomations]);

    const requestDeleteAutomation = useCallback((a) => setPendingDeleteAutomation(a), []);
    const confirmDeleteAutomation = useCallback(async () => {
        if (!pendingDeleteAutomation) return;
        try {
            await automationApi.deleteAutomation(pendingDeleteAutomation.id);
            if (builderAutomationId === pendingDeleteAutomation.id) {
                setBuilderAutomationId(null);
                setOpeningBuilder(false);
            }
            await fetchAutomations();
        } catch (err) { console.warn('[AITasksDesigner] deleteAutomation failed:', err.message); }
        setPendingDeleteAutomation(null);
    }, [pendingDeleteAutomation, automationApi, fetchAutomations, builderAutomationId]);

    /** Duplicate an automation by reading its definition + creating a copy.
     *  No server-side helper needed — everything's already in the existing
     *  list/get/create endpoints. The new draft inherits the definition
     *  but flips `isDraft:true,isActive:false` so the copy is editable. */
    const duplicateAutomation = useCallback(async (a) => {
        try {
            const full = await automationApi.getAutomation(a.id);
            const src = full.automation || full;
            const created = await automationApi.createAutomation({
                title: `${src.title || 'Untitled'} (copy)`,
                description: src.description || null,
                definition: src.definition || {},
            });
            await fetchAutomations();
            const newId = created?.automation?.id || created?.id;
            if (newId) {
                setSegment('automation');
                setBuilderAutomationId(newId);
            }
        } catch (err) {
            console.warn('[AITasksDesigner] duplicateAutomation failed:', err.message);
        }
    }, [automationApi, fetchAutomations]);

    const exportAutomationJson = useCallback(async (a) => {
        try {
            const full = await automationApi.getAutomation(a.id);
            const blob = new Blob([JSON.stringify(full.automation || full, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${(a.title || 'automation').replace(/[^a-z0-9-_]+/gi, '_')}.json`;
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (err) { console.warn('[AITasksDesigner] exportAutomationJson failed:', err.message); }
    }, [automationApi]);

    const copyAutomationId = useCallback(async (a) => {
        try { await navigator.clipboard.writeText(a.id); }
        catch (err) { console.warn('[AITasksDesigner] copyAutomationId failed:', err.message); }
    }, []);

    // ── Cmd/Ctrl+K — quick switcher ──────────────────────────────────────
    useEffect(() => {
        if (!embedded) return;
        const onKey = (e) => {
            const isModK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k';
            if (!isModK) return;
            // Only intercept when no other modifier surface owns it (ignore
            // shift/alt combinations to leave room for browser shortcuts).
            if (e.shiftKey || e.altKey) return;
            e.preventDefault();
            setQuickSwitcherOpen(true);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [embedded]);

    const quickSwitcherItems = useMemo(() => {
        const a = automations.map(it => ({
            id: it.id,
            kind: 'automation',
            kindLabel: 'Automation',
            title: it.title || 'Untitled automation',
            subtitle: it.triggerType + (it.scheduleCron ? ` · ${it.scheduleCron}` : ''),
        }));
        const t = tasks.map(it => ({
            id: it.id,
            kind: 'prompt_task',
            kindLabel: 'Routine',
            title: it.title || 'Untitled routine',
            subtitle: it.repeatInterval || 'one-time',
        }));
        return [...a, ...t];
    }, [automations, tasks]);

    const onPickFromSwitcher = useCallback((item) => {
        setQuickSwitcherOpen(false);
        if (item.kind === 'automation') {
            setSegment('automation');
            setBuilderAutomationId(item.id);
        } else {
            setSegment('prompt_task');
            const task = tasks.find(t => t.id === item.id);
            if (task) startEditTask(task);
        }
    }, [tasks]);

    const activeTasks = useMemo(() => tasks.filter(t => t.isActive), [tasks]);
    const inactiveTasks = useMemo(() => tasks.filter(t => !t.isActive), [tasks]);
    const editing = editingTaskId !== null;
    const isNewMode = editingTaskId === 'new';
    const canSave = title.trim() && prompt.trim() && date && time;

    const nextRunPreview = useMemo(() => {
        if (!date || !time) return null;
        try {
            return formatNextRun(new Date(`${date}T${time}`).toISOString());
        } catch {
            return null;
        }
    }, [date, time]);

    const deleteModal = pendingDeleteTask && (
        <div
            className="fixed inset-0 z-[1000] bg-black/50 flex items-center justify-center p-4"
            onClick={() => setPendingDeleteTask(null)}
        >
            <div
                className="bg-[var(--bg-primary)] rounded-xl w-full max-w-md shadow-xl border border-[var(--border-default)]"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between px-5 py-4 border-b border-[var(--border-default)]">
                    <div className="text-sm font-semibold text-[var(--text-primary)]">Delete routine</div>
                    <button onClick={() => setPendingDeleteTask(null)} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
                        <X size={18} />
                    </button>
                </div>
                <div className="px-5 py-4 text-sm text-[var(--text-secondary)]">
                    Delete "<strong>{pendingDeleteTask.title}</strong>"? This cannot be undone.
                </div>
                <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--border-default)]">
                    <button
                        onClick={() => setPendingDeleteTask(null)}
                        className="px-4 py-2 rounded-full text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={confirmDeleteTask}
                        className="px-4 py-2 rounded-full text-sm bg-red-500 text-white hover:bg-red-600"
                    >
                        Delete
                    </button>
                </div>
            </div>
        </div>
    );

    const resultModalEl = resultModal && (
        <div
            onClick={() => setResultModal(null)}
            style={{
                position: 'fixed', inset: 0, zIndex: 2000,
                background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
                animation: 'aiTaskResultBgIn 0.2s ease',
            }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    width: '100%', maxWidth: 720, maxHeight: '85vh',
                    background: 'var(--bg-card, #ffffff)', borderRadius: 20,
                    boxShadow: '0 25px 80px rgba(0,0,0,0.25), 0 8px 24px rgba(0,0,0,0.12)',
                    display: 'flex', flexDirection: 'column', overflow: 'hidden',
                    animation: 'aiTaskResultIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                    border: '1px solid var(--border-subtle, rgba(0,0,0,0.06))',
                }}
            >
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '16px 20px',
                    borderBottom: '1px solid var(--border-subtle, rgba(0,0,0,0.06))',
                    background: 'var(--bg-secondary)',
                }}>
                    <div style={{
                        width: 36, height: 36, borderRadius: 10,
                        background: 'var(--bg-secondary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: '1px solid var(--border-default)', flexShrink: 0,
                    }}>
                        <Bot style={{ width: 18, height: 18, color: 'var(--text-primary)' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                            fontSize: 15, fontWeight: 700, color: 'var(--text-primary, #0f172a)',
                            lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>{resultModal.title}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted, #94a3b8)', fontWeight: 500, marginTop: 2 }}>
                            Routine result
                        </div>
                    </div>
                    <button
                        onClick={() => openInDirectChat(resultModal.title, resultModal.content)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '8px 14px', borderRadius: 10,
                            fontSize: 13, fontWeight: 600,
                            border: 'none', cursor: 'pointer',
                            background: 'var(--text-primary)',
                            color: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                            flexShrink: 0,
                        }}
                    >
                        💬 Discuss in Chat
                    </button>
                    <button
                        onClick={() => setResultModal(null)}
                        style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            padding: 6, borderRadius: 8,
                            color: 'var(--text-muted, #94a3b8)', flexShrink: 0,
                        }}
                    >
                        <X style={{ width: 18, height: 18 }} />
                    </button>
                </div>
                <div style={{
                    flex: 1, overflowY: 'auto',
                    padding: '20px 24px',
                    fontSize: 14, lineHeight: 1.7,
                    color: 'var(--text-primary, #0f172a)',
                }}>
                    <MarkdownRenderer content={resultModal.content} />
                </div>
            </div>
        </div>
    );

    const styles = (
        <style>{`
            @keyframes aiTaskFadeIn {
                from { opacity: 0; transform: translateY(4px); }
                to { opacity: 1; transform: translateY(0); }
            }
            @keyframes aiTaskSpin { to { transform: rotate(360deg); } }
            @keyframes aiTaskResultBgIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes aiTaskResultIn {
                from { opacity: 0; transform: translateY(12px) scale(0.96); }
                to { opacity: 1; transform: translateY(0) scale(1); }
            }
        `}</style>
    );

    // ── Embedded studio layout (the redesigned sidebar+detail shell) ─────
    if (embedded) {
        // When the user can't see Automations at all, force the sidebar to
        // show the Prompt Tasks segment regardless of the persisted choice.
        const effectiveSegment = !automationsAllowed ? 'prompt_task' : segment;
        const showSegmented = automationsAllowed;

        // Filter the active list by the search query (case-insensitive
        // match on title; cheap enough to do every render). Power-user
        // search is also via Cmd/Ctrl+K — this input is the discoverable
        // route for everyone else.
        const q = searchQuery.trim().toLowerCase();
        const visibleAutomations = q
            ? automations.filter(a => (a.title || '').toLowerCase().includes(q))
            : automations;
        const visibleTasks = q
            ? tasks.filter(t => (t.title || '').toLowerCase().includes(q))
            : tasks;

        // The sidebar's plus button creates the right thing per segment.
        const onPlus = () => {
            if (effectiveSegment === 'automation') {
                if (!automationsAllowed) return;
                setBuilderAutomationId('');
                setPresetChatInput('');
            } else {
                startNewTask();
            }
        };

        const sidebar = (
            <aside className="w-[264px] flex-shrink-0 border-r border-[var(--border-default)] flex flex-col bg-[var(--bg-primary)]">
                {/* Sidebar header — title + plus, mirrors SkillsStudio */}
                <div className="px-4 py-3 border-b border-[var(--border-default)] flex items-center justify-between">
                    {/* Visual-only BETA badge — decorative, intentionally NOT gated on
                        user.betaFeatures (access gating lives elsewhere). Amber house
                        style mirrors the Tests Studio badge; no purple per brand rule. */}
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[var(--text-primary)]">Routines</span>
                        <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500 border border-amber-500/30">BETA</span>
                    </div>
                    <button
                        onClick={onPlus}
                        data-tour="routine-create"
                        title={effectiveSegment === 'automation' ? 'New automation' : 'New routine'}
                        className="p-1 rounded-lg hover:bg-[var(--bg-secondary)] text-[var(--text-tertiary)]"
                    >
                        <Plus size={16} />
                    </button>
                </div>

                {/* Segmented control — only shown when both segments are
                    available. Makes the page feel native to the studio:
                    one shell, one list, two filters. */}
                {showSegmented && (
                    <div className="px-2 pt-2">
                        <div className="flex items-center bg-[var(--bg-secondary)] rounded-lg p-0.5 text-xs font-medium">
                            <button
                                onClick={() => { setSegment('automation'); }}
                                className={`flex-1 px-2 py-1 rounded-md transition ${
                                    effectiveSegment === 'automation'
                                        ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm'
                                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                }`}
                            >
                                Automations
                            </button>
                            <button
                                onClick={() => { setSegment('prompt_task'); }}
                                className={`flex-1 px-2 py-1 rounded-md transition ${
                                    effectiveSegment === 'prompt_task'
                                        ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm'
                                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                }`}
                            >
                                Prompt Tasks
                            </button>
                        </div>
                    </div>
                )}

                {/* Search — debounced filter on the visible list. */}
                <div className="px-2 pt-2">
                    <div className="relative">
                        <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] pointer-events-none" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Filter…"
                            className="w-full bg-[var(--bg-secondary)] border border-transparent focus:border-[var(--border-default)] rounded-md pl-7 pr-2 py-1 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none transition"
                        />
                    </div>
                    <div className="text-[10px] text-[var(--text-tertiary)] mt-1 px-1">
                        Tip: ⌘K for quick switch
                    </div>
                </div>

                {/* List body */}
                <div className="flex-1 overflow-y-auto p-1.5 mt-1">
                    {effectiveSegment === 'automation' ? (
                        <>
                            {automationsLoading && automations.length === 0 && (
                                <div className="text-xs text-[var(--text-tertiary)] p-3">Loading…</div>
                            )}
                            {!automationsLoading && visibleAutomations.length === 0 && (
                                <div className="text-xs text-[var(--text-tertiary)] p-4 text-center">
                                    {q ? 'No matches.' : 'No automations yet.'}
                                </div>
                            )}
                            {visibleAutomations.map((a) => (
                                <RoutineRow
                                    key={a.id}
                                    routine={a}
                                    kind="automation"
                                    selected={builderAutomationId === a.id}
                                    liveRunning={activeRunIds.has(a.id)}
                                    onSelect={() => { setBuilderInitialTab(null); setBuilderAutomationId(a.id); }}
                                    onOpenRuns={() => { setBuilderInitialTab('history'); setBuilderAutomationId(a.id); }}
                                    onToggleActive={() => toggleAutomation(a)}
                                    onDuplicate={() => duplicateAutomation(a)}
                                    onExportJson={() => exportAutomationJson(a)}
                                    onCopyId={() => copyAutomationId(a)}
                                    onDelete={() => requestDeleteAutomation(a)}
                                />
                            ))}
                        </>
                    ) : (
                        <>
                            {loading && tasks.length === 0 && (
                                <div className="text-xs text-[var(--text-tertiary)] p-3">Loading…</div>
                            )}
                            {!loading && visibleTasks.length === 0 && (
                                <div className="text-xs text-[var(--text-tertiary)] p-4 text-center">
                                    {q ? 'No matches.' : 'No routines yet.'}
                                </div>
                            )}
                            {visibleTasks.map((t) => (
                                <RoutineRow
                                    key={t.id}
                                    routine={t}
                                    kind="prompt_task"
                                    selected={editingTaskId === t.id}
                                    onSelect={() => startEditTask(t)}
                                    onDelete={() => requestDeleteTask(t)}
                                />
                            ))}
                        </>
                    )}
                </div>
            </aside>
        );

        // Right pane: empty state, Automations builder, or Prompt Task editor.
        let rightPane;
        if (effectiveSegment === 'automation') {
            const stepBuilderOpen = builderStepId !== null && automationsAllowed;
            const builderOpen = (builderAutomationId !== null || openingBuilder) && automationsAllowed;
            if (stepBuilderOpen) {
                rightPane = (
                    <BuilderShell
                        key={'step:' + (builderStepId || 'new')}
                        mode="step"
                        automationId={builderStepId || null}
                        initialTab={builderInitialTab}
                        onBack={() => { setBuilderStepId(null); setBuilderInitialTab(null); }}
                        onAutomationIdResolved={(id) => { if (id) setBuilderStepId(id); }}
                        onPublished={() => { fetchSteps(); }}
                        user={user}
                    />
                );
            } else if (builderOpen) {
                rightPane = (
                    <BuilderShell
                        // `key` forces a fresh mount when the user switches
                        // between automations in the sidebar — without it the
                        // builder reuses internal state from the previously-
                        // opened automation, which made the second click look
                        // like a no-op.
                        key={builderAutomationId || 'new'}
                        automationId={builderAutomationId || null}
                        initialTab={builderInitialTab}
                        onBack={() => { setBuilderAutomationId(null); setBuilderInitialTab(null); setOpeningBuilder(false); setPresetChatInput(''); setAutoSendInput(null); }}
                        // Carry the lazily-created id up so the URL/refresh path
                        // can reopen a brand-new automation. Never changes the
                        // BuilderShell `key`, so it doesn't remount mid-build.
                        onAutomationIdResolved={setLiveAutomationId}
                        // Flowlet (layer) scope ↔ URL. initialFlowletKey restores
                        // the drilled-into flowlet on refresh/back; onScopeChange
                        // pushes the scope into the path as the user navigates.
                        initialScopeKey={initialFlowletKey}
                        onScopeChange={handleScopeChange}
                        user={user}
                        initialChatInput={presetChatInput}
                        autoSendInput={autoSendInput}
                    />
                );
            } else {
                const onPickTemplate = async (templateId) => {
                    try {
                        const r = await automationApi.getTemplate(templateId);
                        const tmpl = r?.template;
                        if (!tmpl) return;
                        const created = await automationApi.createAutomation({
                            title: tmpl.title,
                            description: tmpl.description || null,
                            definition: tmpl.definition || {},
                        });
                        await fetchAutomations();
                        const newId = created?.automation?.id || created?.id;
                        if (newId) {
                            setSegment('automation');
                            setBuilderAutomationId(newId);
                        }
                    } catch (err) {
                        console.warn('[AITasksDesigner] template pick failed:', err.message);
                        alert(`Could not load template: ${err.message}`);
                    }
                };
                rightPane = (
                    <RoutinesEmptyState
                        segment="automation"
                        onCreateAutomation={() => { setBuilderAutomationId(''); setPresetChatInput(''); setAutoSendInput(null); }}
                        onUseExample={(text) => { setAutoSendInput(null); setPresetChatInput(text); setBuilderAutomationId(''); }}
                        onOpenAutomation={(id) => { setBuilderAutomationId(id); }}
                        onPickTemplate={onPickTemplate}
                        // "Build it directly" — open a fresh builder and auto-fire the spec,
                        // grounded with the scan's observed evidence so the builder has full context.
                        onBuildSuggestion={(s) => { setPresetChatInput(''); setAutoSendInput(buildMessageFromSuggestion(s)); setBuilderAutomationId(''); }}
                        // "Ask for changes" — prefill the grounded spec so the user can edit before sending.
                        onAskSuggestion={(s) => { setAutoSendInput(null); setPresetChatInput(buildMessageFromSuggestion(s)); setBuilderAutomationId(''); }}
                        // Reusable Steps tab.
                        steps={steps}
                        stepsLoading={stepsLoading}
                        onCreateStep={() => { setBuilderInitialTab(null); setBuilderStepId(''); }}
                        onOpenStep={(id) => { setBuilderInitialTab(null); setBuilderStepId(id); }}
                        onOpenStepRuns={(id) => { setBuilderInitialTab('history'); setBuilderStepId(id); }}
                        onDeleteStep={onDeleteStep}
                    />
                );
            }
        } else {
            const currentTask = editingTaskId && editingTaskId !== 'new'
                ? tasks.find(t => t.id === editingTaskId) || null
                : null;
            if (!editing) {
                rightPane = (
                    <RoutinesEmptyState
                        segment="prompt_task"
                        onCreateTask={startNewTask}
                    />
                );
            } else {
                rightPane = (
                    <div className="overflow-y-auto h-full">
                        {/* Task action bar for existing tasks (kept from previous design — quick run/pause/result). */}
                        {currentTask && (
                            <div className="flex items-center gap-2 px-6 pt-5 pb-1 flex-wrap">
                                <button
                                    onClick={() => runTaskNow(currentTask.id)}
                                    disabled={currentTask.lastStatus === 'running'}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold disabled:opacity-50"
                                    style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                                >
                                    <Play size={12} /> Run Now
                                </button>
                                <button
                                    onClick={() => toggleTask(currentTask.id)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold"
                                    style={{
                                        background: currentTask.isActive ? 'rgba(245,158,11,0.08)' : 'rgba(34,197,94,0.08)',
                                        color: currentTask.isActive ? '#f59e0b' : '#22c55e',
                                    }}
                                >
                                    {currentTask.isActive ? <><Pause size={12} /> Pause</> : <><Play size={12} /> Resume</>}
                                </button>
                                {currentTask.lastResult && (
                                    <button
                                        onClick={() => setResultModal({ title: currentTask.title, content: currentTask.lastResult })}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold"
                                        style={{ background: 'rgba(34,197,94,0.08)', color: '#22c55e' }}
                                    >
                                        View last result ↗
                                    </button>
                                )}
                            </div>
                        )}
                        <EditorView
                            title={title} setTitle={setTitle}
                            prompt={prompt} setPrompt={setPrompt}
                            date={date} setDate={setDate}
                            time={time} setTime={setTime}
                            repeatInterval={repeatInterval} setRepeatInterval={setRepeatInterval}
                            tier={tier} setTier={setTier}
                            modelTiers={modelTiers}
                            agentId={agentId} setAgentId={setAgentId}
                            agents={agents} routinesAllowed={routinesAllowed}
                            canSave={canSave} isNewMode={isNewMode}
                            onSave={saveTask} onCancel={resetForm}
                            nextRunPreview={nextRunPreview}
                        />
                    </div>
                );
            }
        }

        // Confirm-delete modal for an automation (parallels the prompt-task one).
        const deleteAutomationModal = pendingDeleteAutomation && (
            <div
                className="fixed inset-0 z-[1000] bg-black/50 flex items-center justify-center p-4"
                onClick={() => setPendingDeleteAutomation(null)}
            >
                <div
                    className="bg-[var(--bg-primary)] rounded-xl w-full max-w-md shadow-xl border border-[var(--border-default)]"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex items-start justify-between px-5 py-4 border-b border-[var(--border-default)]">
                        <div className="text-sm font-semibold text-[var(--text-primary)]">Delete automation</div>
                        <button onClick={() => setPendingDeleteAutomation(null)} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
                            <X size={18} />
                        </button>
                    </div>
                    <div className="px-5 py-4 text-sm text-[var(--text-secondary)]">
                        Delete "<strong>{pendingDeleteAutomation.title || 'Untitled'}</strong>"? This removes the definition and all run history. Cannot be undone.
                    </div>
                    <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--border-default)]">
                        <button
                            onClick={() => setPendingDeleteAutomation(null)}
                            className="px-4 py-2 rounded-full text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={confirmDeleteAutomation}
                            className="px-4 py-2 rounded-full text-sm bg-red-500 text-white hover:bg-red-600"
                        >
                            Delete
                        </button>
                    </div>
                </div>
            </div>
        );

        return (
            <div className="flex h-full bg-[var(--bg-primary)]">
                {/* Sidebar collapses while the BuilderShell is in fullscreen
                    chrome-collapse mode so the user can use every pixel for
                    the diagram. They get back via the back arrow inside the
                    builder header. */}
                {!automationEditing && sidebar}
                <section className="flex-1 min-w-0 overflow-hidden">
                    {rightPane}
                </section>
                <QuickSwitcher
                    open={quickSwitcherOpen}
                    items={quickSwitcherItems}
                    onPick={onPickFromSwitcher}
                    onClose={() => setQuickSwitcherOpen(false)}
                />
                {deleteModal}
                {deleteAutomationModal}
                {resultModalEl}
                {styles}
                {/* Surfaces toggle failures and any other transient errors
                    raised via showToast inside this view. */}
                <ToastHost />
            </div>
        );
    }

    // ── Legacy standalone layout ─────────────────────────────────────────────
    return (
        <div className="flex-1 flex flex-col h-full bg-[var(--bg-primary)] overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 px-6 h-14 border-b border-[var(--border-subtle)] bg-[var(--bg-card)] flex-shrink-0">
                {editing && (
                    <button
                        onClick={resetForm}
                        className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)]"
                        title="Back to list"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </button>
                )}
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-default)' }}>
                    <Bot className="w-[18px] h-[18px]" style={{ color: 'var(--text-primary)' }} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-[15px] font-bold text-[var(--text-primary)] leading-tight">
                        {editing ? (isNewMode ? 'New routine' : 'Edit routine') : 'Routines'}
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)] font-medium">
                        {editing ? 'Schedule a recurring AI workflow' : `${tasks.length}/${maxTasks} tasks`}
                    </div>
                </div>
                {!editing && (
                    <button
                        onClick={startNewTask}
                        disabled={tasks.length >= maxTasks}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ background: 'var(--text-primary)', boxShadow: tasks.length >= maxTasks ? 'none' : '0 2px 8px rgba(0,0,0,0.1)' }}
                    >
                        <Plus className="w-4 h-4" />
                        New routine
                    </button>
                )}
                {onClose && (
                    <button
                        onClick={onClose}
                        className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] ml-1"
                        title="Close"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto">
                {editing ? (
                    <EditorView
                        title={title} setTitle={setTitle}
                        prompt={prompt} setPrompt={setPrompt}
                        date={date} setDate={setDate}
                        time={time} setTime={setTime}
                        repeatInterval={repeatInterval} setRepeatInterval={setRepeatInterval}
                        tier={tier} setTier={setTier}
                        modelTiers={modelTiers}
                        agentId={agentId} setAgentId={setAgentId}
                        agents={agents} routinesAllowed={routinesAllowed}
                        canSave={canSave} isNewMode={isNewMode}
                        onSave={saveTask} onCancel={resetForm}
                        nextRunPreview={nextRunPreview}
                    />
                ) : (
                    <ListView
                        loading={loading}
                        activeTasks={activeTasks}
                        inactiveTasks={inactiveTasks}
                        modelTiers={modelTiers}
                        onEdit={startEditTask}
                        onToggle={toggleTask}
                        onRequestDelete={requestDeleteTask}
                        onRunNow={runTaskNow}
                        onOpenResult={(data) => setResultModal(data)}
                        onCreate={startNewTask}
                        canCreate={tasks.length < maxTasks}
                    />
                )}
            </div>

            {deleteModal}
            {resultModalEl}
            {styles}
        </div>
    );
}
