import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Bot, Plus, Play, Pause, Pencil, Trash2, Clock, Repeat, X, Sparkles, Zap, ArrowLeft, Check } from 'lucide-react';
import { API_BASE, authFetch } from '../../../utils/helpers';
import MarkdownRenderer from '../../MarkdownRenderer';

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
    pending: { bg: 'rgba(99,102,241,0.08)', color: '#6366f1', label: '⏳ Pending' },
    running: { bg: 'rgba(245,158,11,0.08)', color: '#f59e0b', label: '⚡ Running' },
    success: { bg: 'rgba(34,197,94,0.08)', color: '#22c55e', label: '✅ Success' },
    error: { bg: 'rgba(239,68,68,0.08)', color: '#ef4444', label: '❌ Error' },
};

const TIER_LABELS = {
    fast: '⚡ Fast (quick lookups)',
    smart: '🧠 Smart (analysis)',
    thinking: '💎 Thinking (deep research)',
};

export default function AITasksDesigner({ initialTaskId = null, onClose }) {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(false);
    const [maxTasks, setMaxTasks] = useState(10);
    const [resultModal, setResultModal] = useState(null);

    // Editor view state — null means list view
    const [editingTaskId, setEditingTaskId] = useState(null); // string = edit, 'new' = create
    const [title, setTitle] = useState('');
    const [prompt, setPrompt] = useState('');
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [repeatInterval, setRepeatInterval] = useState('weekly');
    const [tier, setTier] = useState('fast');

    const fetchTasks = useCallback(async () => {
        setLoading(true);
        try {
            const res = await authFetch(`${API_BASE}/api/ai-tasks`);
            if (res.ok) {
                const data = await res.json();
                setTasks(data.tasks || []);
                if (data.maxTasks) setMaxTasks(data.maxTasks);
            }
        } catch (err) { /* silent */ }
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchTasks();
    }, [fetchTasks]);

    // Open editor for a specific task ID passed via URL on mount
    useEffect(() => {
        if (!initialTaskId) return;
        if (initialTaskId === 'new') {
            startNewTask();
            return;
        }
        // Wait until tasks are loaded, then populate the editor
        if (tasks.length === 0) return;
        const task = tasks.find(t => t.id === initialTaskId);
        if (task) startEditTask(task);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialTaskId, tasks.length]);

    const resetForm = () => {
        setTitle(''); setPrompt(''); setDate(''); setTime('');
        setRepeatInterval('weekly'); setTier('fast');
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
        setRepeatInterval(task.repeatInterval || 'weekly');
        setTier(task.modelTier || 'fast');
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

    const deleteTask = async (id) => {
        try {
            await authFetch(`${API_BASE}/api/ai-tasks/${id}`, { method: 'DELETE' });
            setTasks(prev => prev.filter(t => t.id !== id));
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

    const activeTasks = useMemo(() => tasks.filter(t => t.isActive), [tasks]);
    const inactiveTasks = useMemo(() => tasks.filter(t => !t.isActive), [tasks]);
    const editing = editingTaskId !== null;
    const isNewMode = editingTaskId === 'new';
    const canSave = title.trim() && prompt.trim() && date && time;

    // Compute a friendly preview of when the task will next run
    const nextRunPreview = useMemo(() => {
        if (!date || !time) return null;
        try {
            return formatNextRun(new Date(`${date}T${time}`).toISOString());
        } catch {
            return null;
        }
    }, [date, time]);

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
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.15)' }}>
                    <Bot className="w-[18px] h-[18px]" style={{ color: '#8b5cf6' }} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-[15px] font-bold text-[var(--text-primary)] leading-tight">
                        {editing ? (isNewMode ? 'New AI Task' : 'Edit AI Task') : 'AI Tasks'}
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
                        style={{ background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', boxShadow: tasks.length >= maxTasks ? 'none' : '0 2px 8px rgba(139,92,246,0.25)' }}
                    >
                        <Plus className="w-4 h-4" />
                        New AI Task
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
                        canSave={canSave} isNewMode={isNewMode}
                        onSave={saveTask} onCancel={resetForm}
                        nextRunPreview={nextRunPreview}
                    />
                ) : (
                    <ListView
                        loading={loading}
                        activeTasks={activeTasks}
                        inactiveTasks={inactiveTasks}
                        onEdit={startEditTask}
                        onToggle={toggleTask}
                        onDelete={deleteTask}
                        onRunNow={runTaskNow}
                        onOpenResult={(data) => setResultModal(data)}
                        onCreate={startNewTask}
                        canCreate={tasks.length < maxTasks}
                    />
                )}
            </div>

            {/* Result Modal */}
            {resultModal && (
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
                            background: 'linear-gradient(135deg, rgba(139,92,246,0.04), rgba(99,102,241,0.02))',
                        }}>
                            <div style={{
                                width: 36, height: 36, borderRadius: 10,
                                background: 'rgba(139,92,246,0.08)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                border: '1px solid rgba(139,92,246,0.15)', flexShrink: 0,
                            }}>
                                <Bot style={{ width: 18, height: 18, color: '#8b5cf6' }} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{
                                    fontSize: 15, fontWeight: 700, color: 'var(--text-primary, #0f172a)',
                                    lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                }}>{resultModal.title}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted, #94a3b8)', fontWeight: 500, marginTop: 2 }}>
                                    AI Task Result
                                </div>
                            </div>
                            <button
                                onClick={() => openInDirectChat(resultModal.title, resultModal.content)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 6,
                                    padding: '8px 14px', borderRadius: 10,
                                    fontSize: 13, fontWeight: 600,
                                    border: 'none', cursor: 'pointer',
                                    background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                                    color: '#fff', boxShadow: '0 2px 8px rgba(139,92,246,0.3)',
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
            )}

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
        </div>
    );
}

function ListView({ loading, activeTasks, inactiveTasks, onEdit, onToggle, onDelete, onRunNow, onOpenResult, onCreate, canCreate }) {
    if (loading && activeTasks.length === 0 && inactiveTasks.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-[var(--text-muted)] text-[13px]">
                <div style={{
                    width: 32, height: 32,
                    border: '2px solid rgba(139,92,246,0.2)',
                    borderTopColor: '#8b5cf6',
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
                <div className="w-16 h-16 rounded-2xl mb-4 flex items-center justify-center" style={{ background: 'rgba(139,92,246,0.08)' }}>
                    <Bot className="w-8 h-8" style={{ color: '#8b5cf6', opacity: 0.5 }} />
                </div>
                <h2 className="text-[17px] font-bold text-[var(--text-primary)] mb-2">No AI Tasks yet</h2>
                <p className="text-[13px] text-[var(--text-muted)] max-w-md mb-6 leading-relaxed">
                    Schedule recurring AI workflows — like a weekly news digest or daily lead report.
                    Results land in your notifications when they're ready.
                </p>
                <button
                    onClick={onCreate}
                    disabled={!canCreate}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[14px] font-semibold text-white transition-all disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', boxShadow: '0 4px 14px rgba(139,92,246,0.3)' }}
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
                    <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#8b5cf6' }}>
                        Active
                    </div>
                    <div className="space-y-2 mb-6">
                        {activeTasks.map((t, i) => (
                            <TaskCard key={t.id} task={t} index={i}
                                onEdit={onEdit} onToggle={onToggle} onDelete={onDelete}
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
                            <TaskCard key={t.id} task={t} index={i}
                                onEdit={onEdit} onToggle={onToggle} onDelete={onDelete}
                                onRunNow={onRunNow} onOpenResult={onOpenResult} />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

function TaskCard({ task, index, onEdit, onToggle, onDelete, onRunNow, onOpenResult }) {
    const t = task;
    const status = STATUS_COLORS[t.lastStatus] || STATUS_COLORS.pending;
    const tierShort = { fast: '⚡ Fast', smart: '🧠 Smart', thinking: '💎 Thinking' }[t.modelTier] || t.modelTier;

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
                        background: t.isActive ? 'rgba(139,92,246,0.08)' : 'rgba(0,0,0,0.04)',
                        border: `1px solid ${t.isActive ? 'rgba(139,92,246,0.15)' : 'rgba(0,0,0,0.06)'}`,
                    }}
                >
                    <Bot className="w-[18px] h-[18px]" style={{ color: t.isActive ? '#8b5cf6' : '#94a3b8' }} />
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
                            <span className="text-[10px] px-2 py-0.5 rounded-md font-semibold inline-flex items-center gap-1" style={{ background: 'rgba(139,92,246,0.06)', color: '#8b5cf6' }}>
                                <Repeat className="w-2.5 h-2.5" />
                                {t.repeatInterval}
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
                            style={{ background: 'rgba(139,92,246,0.08)', color: '#8b5cf6' }}
                        >
                            <Play className="w-3 h-3" />
                            Run Now
                        </button>
                        <button
                            onClick={() => onEdit(t)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold"
                            style={{ background: 'rgba(99,102,241,0.08)', color: '#6366f1' }}
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
                    onClick={() => {
                        if (window.confirm(`Delete "${t.title}"?`)) onDelete(t.id);
                    }}
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
                            className="w-full px-3.5 py-2.5 rounded-xl border bg-[var(--bg-card)] text-[14px] text-[var(--text-primary)] outline-none focus:border-[#8b5cf6] transition-colors"
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
                            className="w-full px-3.5 py-2.5 rounded-xl border bg-[var(--bg-card)] text-[14px] text-[var(--text-primary)] outline-none focus:border-[#8b5cf6] transition-colors resize-y leading-relaxed"
                            style={{ borderColor: 'var(--border-subtle, rgba(0,0,0,0.08))', fontFamily: 'inherit' }}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                                Date
                            </label>
                            <input
                                type="date"
                                value={date}
                                onChange={e => setDate(e.target.value)}
                                className="w-full px-3.5 py-2.5 rounded-xl border bg-[var(--bg-card)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[#8b5cf6] transition-colors"
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
                                className="w-full px-3.5 py-2.5 rounded-xl border bg-[var(--bg-card)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[#8b5cf6] transition-colors"
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
                                className="w-full px-3.5 py-2.5 rounded-xl border bg-[var(--bg-card)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[#8b5cf6] transition-colors cursor-pointer"
                                style={{ borderColor: 'var(--border-subtle, rgba(0,0,0,0.08))' }}
                            >
                                <option value="daily">Daily</option>
                                <option value="weekly">Weekly</option>
                                <option value="monthly">Monthly</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                                Model tier
                            </label>
                            <select
                                value={tier}
                                onChange={e => setTier(e.target.value)}
                                className="w-full px-3.5 py-2.5 rounded-xl border bg-[var(--bg-card)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[#8b5cf6] transition-colors cursor-pointer"
                                style={{ borderColor: 'var(--border-subtle, rgba(0,0,0,0.08))' }}
                            >
                                {Object.entries(TIER_LABELS).map(([k, v]) => (
                                    <option key={k} value={k}>{v}</option>
                                ))}
                            </select>
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
                                background: canSave ? 'linear-gradient(135deg, #8b5cf6, #7c3aed)' : 'rgba(139,92,246,0.3)',
                                boxShadow: canSave ? '0 2px 8px rgba(139,92,246,0.25)' : 'none',
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
                        <div className="rounded-xl p-4 border" style={{ background: 'rgba(139,92,246,0.04)', borderColor: 'rgba(139,92,246,0.15)' }}>
                            <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#8b5cf6' }}>
                                Next run
                            </div>
                            <div className="text-[14px] font-semibold text-[var(--text-primary)] inline-flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5" style={{ color: '#8b5cf6' }} />
                                {nextRunPreview}
                            </div>
                            <div className="text-[11px] text-[var(--text-muted)] mt-1">
                                Then repeats {repeatInterval}.
                            </div>
                        </div>
                    )}
                    <div className="rounded-xl p-4 border bg-[var(--bg-card)]" style={{ borderColor: 'var(--border-subtle, rgba(0,0,0,0.06))' }}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2 inline-flex items-center gap-1.5">
                            <Sparkles className="w-3 h-3" /> Tips
                        </div>
                        <ul className="text-[12px] text-[var(--text-secondary)] space-y-2 leading-relaxed list-disc pl-4">
                            <li>Be specific: tell the AI exactly what output format you want.</li>
                            <li>Use <strong>Fast</strong> for quick lookups, <strong>Smart</strong> for analysis, <strong>Thinking</strong> for deep research.</li>
                            <li>Results appear in Notifications and stay accessible for 30 days.</li>
                            <li>Pause a task any time — it won't run again until resumed.</li>
                        </ul>
                    </div>
                </aside>
            </div>
        </div>
    );
}
