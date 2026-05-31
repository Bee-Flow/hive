import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Bot, Plus, Play, Pause, Pencil, Trash2, Clock, Repeat, X, ArrowLeft, Check, ChevronDown, Search } from 'lucide-react';
import { API_BASE, authFetch } from '../../../utils/helpers';
import { isImageAvatar, resolveAvatarSrc, pickAgentAvatar, DEFAULT_AGENT_EMOJI } from '../../../utils/agentAvatar';
import MarkdownRenderer from '../../MarkdownRenderer';
import ModelTierSelector from '../../ModelTierSelector';
import { tierLabel } from '../../tierMeta';
import BuilderShell from './Builder/BuilderShell';
import RoutineRow from '../Studio/RoutinesStudio/RoutineRow';
import RoutinesEmptyState from '../Studio/RoutinesStudio/EmptyState';
import QuickSwitcher from '../Studio/RoutinesStudio/QuickSwitcher';
import RoutineEditor from '../Studio/RoutinesStudio/RoutineEditor';
import useAutomationApi from '../../../hooks/useAutomationApi';
import { showToast, ToastHost } from '../guardrails/Toast';

const REPEAT_OPTIONS = [
    { value: '',          label: 'One-time (no repeat)' },
    { value: 'daily',     label: 'Daily' },
    { value: 'weekdays',  label: 'Weekdays (Mon–Fri)' },
    { value: 'weekly',    label: 'Weekly' },
    { value: 'biweekly',  label: 'Every 2 weeks' },
    { value: 'monthly',   label: 'Monthly' },
    { value: 'quarterly', label: 'Every 3 months' },
    { value: 'yearly',    label: 'Yearly' },
];

function repeatLabel(value) {
    const opt = REPEAT_OPTIONS.find(o => o.value === (value || ''));
    return opt ? opt.label : value;
}

function timeAgo(dateStr) {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return `${Math.floor(days / 7)}w ago`;
}

function formatNextRun(dateStr) {
    if (!dateStr) return '—';
    const dt = new Date(dateStr);
    const now = new Date();
    const isToday = dt.toDateString() === now.toDateString();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = dt.toDateString() === tomorrow.toDateString();
    const timeStr = dt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    if (isToday) return `Today at ${timeStr}`;
    if (isTomorrow) return `Tomorrow at ${timeStr}`;
    return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ` at ${timeStr}`;
}

const STATUS_COLORS = {
    pending: { bg: 'var(--bg-secondary)', color: 'var(--text-secondary)', label: '⏳ Pending' },
    running: { bg: 'rgba(245,158,11,0.08)', color: '#f59e0b', label: '⚡ Running' },
    success: { bg: 'rgba(34,197,94,0.08)', color: '#22c55e', label: '✅ Success' },
    error: { bg: 'rgba(239,68,68,0.08)', color: '#ef4444', label: '❌ Error' },
};

// Render an agent avatar that may be either an emoji or an image
// (data: URL, http(s) URL, or app-relative path). Native <option> elements
// can't render images, so the surrounding AgentSelect uses this and a
// custom popover instead of <select>.
function AgentAvatar({ value, size = 20 }) {
    if (isImageAvatar(value)) {
        return (
            <img
                src={resolveAvatarSrc(value)}
                alt=""
                className="rounded object-cover flex-shrink-0"
                style={{ width: size, height: size }}
            />
        );
    }
    return (
        <span
            className="inline-flex items-center justify-center flex-shrink-0"
            style={{ width: size, height: size, fontSize: Math.round(size * 0.85), lineHeight: 1 }}
        >
            {value || DEFAULT_AGENT_EMOJI}
        </span>
    );
}

// Custom replacement for <select> that supports image avatars in both the
// trigger and the option rows. Closes on outside click; falls back to a
// generic 🤖 emoji when an agent has no avatar.
function AgentSelect({ value, onChange, agents, placeholder }) {
    const [open, setOpen] = useState(false);
    const wrapRef = useRef(null);
    useEffect(() => {
        if (!open) return;
        const onDoc = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [open]);

    const selected = agents.find(a => a.id === value) || null;
    const triggerLabel = selected
        ? (selected.name || '(untitled)')
        : (placeholder || '— No agent —');
    const triggerAvatar = selected ? (pickAgentAvatar(selected) || DEFAULT_AGENT_EMOJI) : null;

    return (
        <div ref={wrapRef} className="relative">
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className="w-full px-3.5 py-2.5 rounded-xl border bg-[var(--bg-card)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--text-primary)] transition-colors cursor-pointer flex items-center gap-2"
                style={{ borderColor: 'var(--border-subtle, rgba(0,0,0,0.08))' }}
            >
                {triggerAvatar && <AgentAvatar value={triggerAvatar} size={20} />}
                <span className="flex-1 text-left truncate">{triggerLabel}</span>
                <ChevronDown size={14} className={`text-[var(--text-tertiary)] transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
                <div
                    className="absolute left-0 right-0 top-full mt-1 z-30 rounded-xl border bg-[var(--bg-card)] shadow-lg max-h-64 overflow-auto"
                    style={{ borderColor: 'var(--border-subtle, rgba(0,0,0,0.08))' }}
                >
                    <button
                        type="button"
                        onClick={() => { onChange(''); setOpen(false); }}
                        className="w-full px-3.5 py-2 text-left text-[13px] hover:bg-[var(--bg-secondary)] transition-colors flex items-center gap-2"
                    >
                        <span className="w-5 h-5 inline-flex items-center justify-center text-[var(--text-tertiary)]">—</span>
                        <span className="flex-1 text-[var(--text-secondary)]">{placeholder || 'No agent (general prompt)'}</span>
                        {!value && <Check size={14} className="text-emerald-500" />}
                    </button>
                    {agents.map(a => {
                        const av = pickAgentAvatar(a) || DEFAULT_AGENT_EMOJI;
                        const isSelected = a.id === value;
                        return (
                            <button
                                key={a.id}
                                type="button"
                                onClick={() => { onChange(a.id); setOpen(false); }}
                                className="w-full px-3.5 py-2 text-left text-[13px] hover:bg-[var(--bg-secondary)] transition-colors flex items-center gap-2"
                            >
                                <AgentAvatar value={av} size={20} />
                                <span className="flex-1 truncate">{a.name || '(untitled)'}</span>
                                {isSelected && <Check size={14} className="text-emerald-500" />}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default function AITasksDesigner({ initialTaskId = null, onClose, onNavigate, modelTiers = {}, embedded = false, user = null, onEditingChange }) {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(false);
    const [maxTasks, setMaxTasks] = useState(10);
    const [resultModal, setResultModal] = useState(null);
    const [pendingDeleteTask, setPendingDeleteTask] = useState(null);

    // Sub-tab: prompt tasks (legacy) or automations (new conversational builder)
    const [subTab, setSubTab] = useState('prompt'); // 'prompt' | 'automations' (kept for back-compat with legacy non-embedded view)
    const [segment, setSegment] = useState('automation'); // 'automation' | 'prompt_task' — controls which list shows in the unified sidebar
    const [builderAutomationId, setBuilderAutomationId] = useState(null); // null = list, string = open builder
    const [openingBuilder, setOpeningBuilder] = useState(false);
    // Automation list — fetched up here so the sidebar shares one source of truth
    // and we can power Cmd/Ctrl+K + the right-pane builder from the same data.
    const automationApi = useAutomationApi();
    const [automations, setAutomations] = useState([]);
    const [automationsLoading, setAutomationsLoading] = useState(false);
    const [pendingDeleteAutomation, setPendingDeleteAutomation] = useState(null);
    const [presetChatInput, setPresetChatInput] = useState(''); // seeded from EmptyState examples
    const [quickSwitcherOpen, setQuickSwitcherOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    // Signal upward (Studio → AgentHub) when the BuilderShell is open so the
    // outer chrome can collapse for a fullscreen edit, mirroring AgentStudio.
    const automationEditing = ((embedded && segment === 'automation') || subTab === 'automations') && (builderAutomationId !== null || openingBuilder);
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
    const routinesAllowed = Array.isArray(user?.betaFeatures) && user.betaFeatures.includes('agent_routines');

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
    const automationsAllowedForGate = !!(
        user?.isAdmin
        || (user?.permissions || []).includes('all')
        || (Array.isArray(user?.betaFeatures) && user.betaFeatures.includes('automations'))
    );
    useEffect(() => {
        if (subTab === 'automations' && !automationsAllowedForGate) {
            setSubTab('prompt');
        }
    }, [subTab, automationsAllowedForGate]);

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

    useEffect(() => {
        if (!initialTaskId) return;
        if (initialTaskId === 'new') {
            startNewTask();
            return;
        }
        if (tasks.length === 0) return;
        const task = tasks.find(t => t.id === initialTaskId);
        if (!task) return;
        startEditTask(task);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialTaskId, tasks.length]);

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
        if (builderAutomationId === null && !openingBuilder) fetchAutomations();
    }, [builderAutomationId, openingBuilder, fetchAutomations]);

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
        const automationsAllowed = !!(
            user?.isAdmin
            || (user?.permissions || []).includes('all')
            || (Array.isArray(user?.betaFeatures) && user.betaFeatures.includes('automations'))
        );
        // When the user can't see Automations at all, force the sidebar to
        // show the Prompt Tasks segment regardless of the persisted choice.
        const effectiveSegment = automationsAllowed ? segment : 'prompt_task';
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
                                    onSelect={() => { setBuilderAutomationId(a.id); }}
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
            const builderOpen = (builderAutomationId !== null || openingBuilder) && automationsAllowed;
            if (builderOpen) {
                rightPane = (
                    <RoutineEditor
                        // `key` forces a fresh mount when the user switches
                        // between automations in the sidebar — without it the
                        // editor (and the BuilderShell it embeds) reuses
                        // internal state from the previously-opened automation,
                        // which made the second click look like a no-op.
                        key={builderAutomationId || 'new'}
                        automationId={builderAutomationId || null}
                        onBack={() => { setBuilderAutomationId(null); setOpeningBuilder(false); setPresetChatInput(''); }}
                        user={user}
                        agents={agents}
                        initialChatInput={presetChatInput}
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
                        onCreateAutomation={() => { setBuilderAutomationId(''); setPresetChatInput(''); }}
                        onUseExample={(text) => { setPresetChatInput(text); setBuilderAutomationId(''); }}
                        onOpenAutomation={(id) => { setBuilderAutomationId(id); }}
                        onPickTemplate={onPickTemplate}
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

function ListView({ loading, activeTasks, inactiveTasks, modelTiers, onEdit, onToggle, onRequestDelete, onRunNow, onOpenResult, onCreate, canCreate }) {
    if (loading && activeTasks.length === 0 && inactiveTasks.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-[var(--text-muted)] text-[13px]">
                <div style={{
                    width: 32, height: 32,
                    border: '2px solid var(--border-default)',
                    borderTopColor: 'var(--text-primary)',
                    borderRadius: '50%',
                    animation: 'aiTaskSpin 0.8s linear infinite',
                    marginBottom: 12,
                }} />
                Loading AI tasks...
            </div>
        );
    }

    if (activeTasks.length === 0 && inactiveTasks.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-24 px-8 text-center">
                <div className="w-16 h-16 rounded-2xl mb-4 flex items-center justify-center" style={{ background: 'var(--bg-secondary)' }}>
                    <Bot className="w-8 h-8" style={{ color: 'var(--text-primary)', opacity: 0.5 }} />
                </div>
                <h2 className="text-[17px] font-bold text-[var(--text-primary)] mb-2">No routines yet</h2>
                <p className="text-[13px] text-[var(--text-muted)] max-w-md mb-6 leading-relaxed">
                    Schedule recurring AI workflows — like a weekly news digest or daily lead report.
                    Results land in your notifications when they're ready.
                </p>
                <button
                    onClick={onCreate}
                    disabled={!canCreate}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[14px] font-semibold text-white transition-all disabled:opacity-50"
                    style={{ background: 'var(--text-primary)', boxShadow: '0 4px 14px rgba(0,0,0,0.15)' }}
                >
                    <Plus className="w-4 h-4" />
                    Create your first task
                </button>
            </div>
        );
    }

    return (
        <div className="px-6 py-5 max-w-4xl mx-auto w-full">
            {activeTasks.length > 0 && (
                <>
                    <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-primary)' }}>
                        Active
                    </div>
                    <div className="space-y-2 mb-6">
                        {activeTasks.map((t, i) => (
                            <TaskCard key={t.id} task={t} index={i} modelTiers={modelTiers}
                                onEdit={onEdit} onToggle={onToggle} onRequestDelete={onRequestDelete}
                                onRunNow={onRunNow} onOpenResult={onOpenResult} />
                        ))}
                    </div>
                </>
            )}
            {inactiveTasks.length > 0 && (
                <>
                    <div className="text-[10px] font-bold uppercase tracking-widest mb-2 text-[var(--text-muted)]">
                        Paused
                    </div>
                    <div className="space-y-2">
                        {inactiveTasks.map((t, i) => (
                            <TaskCard key={t.id} task={t} index={i} modelTiers={modelTiers}
                                onEdit={onEdit} onToggle={onToggle} onRequestDelete={onRequestDelete}
                                onRunNow={onRunNow} onOpenResult={onOpenResult} />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

function TaskCard({ task, index, modelTiers, onEdit, onToggle, onRequestDelete, onRunNow, onOpenResult }) {
    const t = task;
    const status = STATUS_COLORS[t.lastStatus] || STATUS_COLORS.pending;
    const tierShort = tierLabel(t.modelTier, modelTiers);

    return (
        <div
            className="group rounded-xl border bg-[var(--bg-card)] hover:bg-[var(--bg-tertiary)] transition-all"
            style={{
                borderColor: 'var(--border-subtle, rgba(0,0,0,0.06))',
                animation: `aiTaskFadeIn 0.2s ease ${index * 0.03}s both`,
                opacity: t.isActive ? 1 : 0.65,
            }}
        >
            <div className="flex items-start gap-3 p-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{
                        background: t.isActive ? 'var(--bg-secondary)' : 'rgba(0,0,0,0.04)',
                        border: `1px solid ${t.isActive ? 'var(--border-default)' : 'rgba(0,0,0,0.06)'}`,
                    }}
                >
                    <Bot className="w-[18px] h-[18px]" style={{ color: t.isActive ? 'var(--text-primary)' : '#94a3b8' }} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-semibold text-[var(--text-primary)] leading-snug mb-1">
                        {t.title}
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                        <span className="text-[10px] px-2 py-0.5 rounded-md font-semibold" style={{ background: status.bg, color: status.color }}>
                            {status.label}
                        </span>
                        {t.repeatInterval && (
                            <span className="text-[10px] px-2 py-0.5 rounded-md font-semibold inline-flex items-center gap-1" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                                <Repeat className="w-2.5 h-2.5" />
                                {repeatLabel(t.repeatInterval)}
                            </span>
                        )}
                        <span className="text-[10px] px-2 py-0.5 rounded-md font-semibold text-[var(--text-muted)]" style={{ background: 'rgba(0,0,0,0.04)' }}>
                            {tierShort}
                        </span>
                    </div>
                    {t.nextRunAt && t.isActive && (
                        <div className="text-[11px] text-[var(--text-muted)] inline-flex items-center gap-1 font-medium">
                            <Clock className="w-3 h-3" />
                            Next: {formatNextRun(t.nextRunAt)}
                        </div>
                    )}
                    {t.runCount > 0 && (
                        <div className="text-[11px] text-[var(--text-muted)] mt-1">
                            Ran {t.runCount} time{t.runCount !== 1 ? 's' : ''}{t.lastRunAt && ` • last ${timeAgo(t.lastRunAt)}`}
                        </div>
                    )}
                    <div className="text-[12px] text-[var(--text-secondary)] mt-2 line-clamp-2 whitespace-pre-wrap break-words">
                        {t.prompt}
                    </div>

                    <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                        <button
                            onClick={() => onRunNow(t.id)}
                            disabled={t.lastStatus === 'running'}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold disabled:opacity-50"
                            style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                        >
                            <Play className="w-3 h-3" />
                            Run Now
                        </button>
                        <button
                            onClick={() => onEdit(t)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold"
                            style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                        >
                            <Pencil className="w-3 h-3" />
                            Edit
                        </button>
                        <button
                            onClick={() => onToggle(t.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold"
                            style={{
                                background: t.isActive ? 'rgba(245,158,11,0.08)' : 'rgba(34,197,94,0.08)',
                                color: t.isActive ? '#f59e0b' : '#22c55e',
                            }}
                        >
                            {t.isActive ? <><Pause className="w-3 h-3" />Pause</> : <><Play className="w-3 h-3" />Resume</>}
                        </button>
                        {t.lastResult && (
                            <button
                                onClick={() => onOpenResult({ title: t.title, content: t.lastResult })}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold"
                                style={{ background: 'rgba(34,197,94,0.08)', color: '#22c55e' }}
                            >
                                View result ↗
                            </button>
                        )}
                    </div>
                </div>
                <button
                    onClick={() => onRequestDelete(t)}
                    className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity p-1.5 rounded-md text-[var(--text-muted)] hover:text-red-500 hover:bg-red-50"
                    title="Delete task"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}

function EditorView({
    title, setTitle, prompt, setPrompt,
    date, setDate, time, setTime,
    repeatInterval, setRepeatInterval, tier, setTier,
    modelTiers,
    agentId, setAgentId, agents = [], routinesAllowed = false,
    canSave, isNewMode, onSave, onCancel, nextRunPreview,
}) {
    return (
        <div className="px-6 py-6 max-w-4xl mx-auto w-full">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Form column */}
                <div className="lg:col-span-2 space-y-5">
                    <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                            Task name
                        </label>
                        <input
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="e.g. Weekly AI News Digest"
                            autoFocus
                            className="w-full px-3.5 py-2.5 rounded-xl border bg-[var(--bg-card)] text-[14px] text-[var(--text-primary)] outline-none focus:border-[var(--text-primary)] transition-colors"
                            style={{ borderColor: 'var(--border-subtle, rgba(0,0,0,0.08))' }}
                        />
                    </div>

                    <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                            Prompt
                        </label>
                        <textarea
                            value={prompt}
                            onChange={e => setPrompt(e.target.value)}
                            placeholder="What should the AI do? Be specific.&#10;&#10;e.g. Search for the top 5 AI news stories from the past week and summarize each with a source link, formatted as a markdown bulleted list."
                            rows={10}
                            className="w-full px-3.5 py-2.5 rounded-xl border bg-[var(--bg-card)] text-[14px] text-[var(--text-primary)] outline-none focus:border-[var(--text-primary)] transition-colors resize-y leading-relaxed"
                            style={{ borderColor: 'var(--border-subtle, rgba(0,0,0,0.08))', fontFamily: 'inherit' }}
                        />
                    </div>

                    {routinesAllowed && setAgentId && (
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                                Run as agent
                            </label>
                            <AgentSelect
                                value={agentId || ''}
                                onChange={(next) => {
                                    setAgentId(next);
                                    // Linking to an agent inherits its model,
                                    // so reset any custom routine-tier override.
                                    if (next && setTier) setTier('auto');
                                }}
                                agents={agents}
                                placeholder="No agent (general prompt)"
                            />
                            <div className="mt-1 text-[11px] text-[var(--text-tertiary)]">
                                {agentId
                                    ? 'The prompt runs through this agent — it can use the agent\'s skills, knowledge, and integrations.'
                                    : 'No agent selected — the prompt runs as a generic LLM call without agent skills.'}
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                                Date
                            </label>
                            <input
                                type="date"
                                value={date}
                                onChange={e => setDate(e.target.value)}
                                className="w-full px-3.5 py-2.5 rounded-xl border bg-[var(--bg-card)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--text-primary)] transition-colors"
                                style={{ borderColor: 'var(--border-subtle, rgba(0,0,0,0.08))' }}
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                                Time
                            </label>
                            <input
                                type="time"
                                value={time}
                                onChange={e => setTime(e.target.value)}
                                className="w-full px-3.5 py-2.5 rounded-xl border bg-[var(--bg-card)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--text-primary)] transition-colors"
                                style={{ borderColor: 'var(--border-subtle, rgba(0,0,0,0.08))' }}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                                Repeat
                            </label>
                            <select
                                value={repeatInterval}
                                onChange={e => setRepeatInterval(e.target.value)}
                                className="w-full px-3.5 py-2.5 rounded-xl border bg-[var(--bg-card)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--text-primary)] transition-colors cursor-pointer"
                                style={{ borderColor: 'var(--border-subtle, rgba(0,0,0,0.08))' }}
                            >
                                {REPEAT_OPTIONS.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                                Model tier
                            </label>
                            {agentId ? (
                                <div
                                    className="px-3.5 py-2.5 rounded-xl text-[13px] text-[var(--text-tertiary)] italic border bg-[var(--bg-secondary)]"
                                    style={{ borderColor: 'var(--border-subtle, rgba(0,0,0,0.08))' }}
                                    title="The linked agent provides the model. Change it in the agent editor."
                                >
                                    Inherited from agent
                                </div>
                            ) : (
                                <ModelTierSelector
                                    tiers={modelTiers || {}}
                                    value={tier}
                                    onChange={setTier}
                                    dropDirection="down"
                                />
                            )}
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2">
                        <button
                            onClick={onCancel}
                            className="px-4 py-2 rounded-lg text-[13px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={onSave}
                            disabled={!canSave}
                            className="px-5 py-2 rounded-lg text-[13px] font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
                            style={{
                                background: canSave ? 'var(--text-primary)' : 'rgba(0,0,0,0.15)',
                                boxShadow: canSave ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
                            }}
                        >
                            <Check className="w-4 h-4" />
                            {isNewMode ? 'Create Task' : 'Save Changes'}
                        </button>
                    </div>
                </div>

                {/* Help / preview column */}
                <aside className="space-y-4">
                    {nextRunPreview && (
                        <div className="rounded-xl p-4 border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                            <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-primary)' }}>
                                Next run
                            </div>
                            <div className="text-[14px] font-semibold text-[var(--text-primary)] inline-flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5" style={{ color: 'var(--text-primary)' }} />
                                {nextRunPreview}
                            </div>
                            <div className="text-[11px] text-[var(--text-muted)] mt-1">
                                {repeatInterval ? `Then repeats: ${repeatLabel(repeatInterval).toLowerCase()}.` : 'Runs once, then stops.'}
                            </div>
                        </div>
                    )}
                    <div className="rounded-xl p-4 border bg-[var(--bg-card)]" style={{ borderColor: 'var(--border-subtle, rgba(0,0,0,0.06))' }}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">
                            Tips
                        </div>
                        <ul className="text-[12px] text-[var(--text-secondary)] space-y-2 leading-relaxed list-disc pl-4">
                            <li>Be specific: tell the AI exactly what output format you want.</li>
                            <li>Pick a model tier — hover the picker for what each one's best at.</li>
                            <li>Results appear in Notifications and stay accessible for 30 days.</li>
                            <li>Pause a task any time — it won't run again until resumed.</li>
                        </ul>
                    </div>
                </aside>
            </div>
        </div>
    );
}
