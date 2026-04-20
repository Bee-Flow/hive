import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, Plus, Lock, Users, Link2, Puzzle, RefreshCw, Trash2, ChevronDown, ChevronUp, X } from 'lucide-react';
import SkillFormModal from './SkillFormModal';
import { useSkills } from '../../hooks/useSkills';
import { API_BASE, authFetch } from '../../utils/helpers';

export const SKILL_CAP = 5;

/**
 * SkillsPopover — composer-anchored popover that mirrors the Apps popover.
 *
 * Props:
 *   user                   — current user, for ownership checks on create
 *   activeSkillIds         — session-active skill IDs (toggled by user, capped)
 *   attachedSkillIds       — IDs attached to the selected agent (locked on)
 *   onToggleSkill(id)      — toggle an id in activeSkillIds
 *   buttonClassName        — override for trigger button class (default matches Apps button)
 */
export default function SkillsPopover({
    user,
    activeSkillIds = [],
    attachedSkillIds = [],
    directMode = false,
    directConversationId = null,
    directSessionSkills = [],
    directActivatedSessionSkillIds = [],
    onToggleSkill,
    buttonClassName,
}) {
    const { skills, loading, refresh, create } = useSkills();
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);
    const [sessionSkills, setSessionSkills] = useState([]);
    const [importingSkillId, setImportingSkillId] = useState(null);
    const [importedSessionSkillIds, setImportedSessionSkillIds] = useState([]);
    const [expandedSessionSkillId, setExpandedSessionSkillId] = useState(null);
    const [regenerating, setRegenerating] = useState(false);
    const [deletingSessionSkillId, setDeletingSessionSkillId] = useState(null);
    const popoverRef = useRef(null);

    useEffect(() => {
        setSessionSkills(Array.isArray(directSessionSkills) ? directSessionSkills : []);
    }, [directSessionSkills]);

    useEffect(() => {
        if (!open) return;
        const close = (e) => {
            const root = popoverRef.current;
            if (!root) return;
            const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
            const clickedInside = root.contains(e.target) || path.includes(root);
            if (clickedInside) return;
            setOpen(false);
        };
        // Capture phase + composedPath support prevents false "outside click"
        // closes when events originate from/through shadow DOM.
        document.addEventListener('pointerdown', close, true);
        return () => document.removeEventListener('pointerdown', close, true);
    }, [open]);

    const attachedSet = useMemo(() => new Set(attachedSkillIds), [attachedSkillIds]);
    const activeCount = useMemo(() => {
        const ids = new Set([...activeSkillIds, ...attachedSkillIds]);
        return ids.size;
    }, [activeSkillIds, attachedSkillIds]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return skills;
        return skills.filter(s => s.name.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q));
    }, [skills, search]);

    const filteredSessionSkills = useMemo(() => {
        const q = search.trim().toLowerCase();
        const source = Array.isArray(sessionSkills) ? sessionSkills : [];
        const sorted = [...source].sort((a, b) => (a.order || 0) - (b.order || 0));
        if (!q) return sorted;
        return sorted.filter(s => (s.name || '').toLowerCase().includes(q) || (s.description || '').toLowerCase().includes(q));
    }, [sessionSkills, search]);

    const activatedSessionSet = useMemo(
        () => new Set(Array.isArray(directActivatedSessionSkillIds) ? directActivatedSessionSkillIds : []),
        [directActivatedSessionSkillIds]
    );
    const sessionSkillById = useMemo(
        () => new Map((sessionSkills || []).map(s => [s.id, s])),
        [sessionSkills]
    );

    const canActivateMore = activeCount < SKILL_CAP;

    const refreshSessionSkills = async () => {
        if (!directMode || !directConversationId) return;
        try {
            const res = await authFetch(`${API_BASE}/ai/direct/conversations/${directConversationId}/session-skills`);
            if (!res.ok) return;
            const data = await res.json();
            setSessionSkills(Array.isArray(data.skills) ? data.skills : []);
        } catch (_) { /* ignore */ }
    };

    const handleCreate = async (form) => {
        setSaving(true);
        try {
            const created = await create(form);
            setShowForm(false);
            if (created?.id && !activeSkillIds.includes(created.id) && canActivateMore) {
                onToggleSkill?.(created.id);
            }
        } catch (err) {
            alert(err.message || 'Failed to create skill');
        } finally {
            setSaving(false);
        }
    };

    const handleRegenerateSessionSkills = async () => {
        if (!directConversationId || regenerating) return;
        if (sessionSkills.length > 0) {
            const ok = window.confirm('Replace the current chat-local skills with a new set? Activated skills will reset.');
            if (!ok) return;
        }
        setRegenerating(true);
        try {
            const res = await authFetch(`${API_BASE}/ai/direct/conversations/${directConversationId}/session-skills/regenerate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Failed to regenerate skills');
            }
            const data = await res.json();
            if (Array.isArray(data.skills)) setSessionSkills(data.skills);
            setExpandedSessionSkillId(null);
        } catch (err) {
            alert(err.message || 'Failed to regenerate session skills');
        } finally {
            setRegenerating(false);
        }
    };

    const handleDeleteSessionSkill = async (skillId) => {
        if (!directConversationId || !skillId || deletingSessionSkillId) return;
        setDeletingSessionSkillId(skillId);
        try {
            const res = await authFetch(`${API_BASE}/ai/direct/conversations/${directConversationId}/session-skills/${skillId}`, {
                method: 'DELETE',
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Failed to delete skill');
            }
            const data = await res.json();
            if (Array.isArray(data.skills)) setSessionSkills(data.skills);
            if (expandedSessionSkillId === skillId) setExpandedSessionSkillId(null);
        } catch (err) {
            alert(err.message || 'Failed to delete session skill');
        } finally {
            setDeletingSessionSkillId(null);
        }
    };

    const handleImportSessionSkill = async (skillId) => {
        if (!directConversationId || !skillId) return;
        setImportingSkillId(skillId);
        try {
            const res = await authFetch(`${API_BASE}/ai/direct/conversations/${directConversationId}/session-skills/${skillId}/import`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isShared: false, dynamicActivation: true }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Failed to import skill');
            }
            setImportedSessionSkillIds(prev => prev.includes(skillId) ? prev : [...prev, skillId]);
            await refresh();
        } catch (err) {
            alert(err.message || 'Failed to import session skill');
        } finally {
            setImportingSkillId(null);
        }
    };

    return (
        <div className="relative" ref={popoverRef}>
            <button
                onClick={() => {
                    setOpen(v => !v);
                    setSearch('');
                    if (!skills.length) refresh();
                    if (directMode && directConversationId) refreshSessionSkills();
                }}
                title="Skills"
                className={
                    buttonClassName ||
                    `p-2 rounded-lg transition-colors flex items-center gap-1 ${open ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'}`
                }
            >
                <Puzzle className="w-5 h-5" />
                {activeCount > 0 && (
                    <span className="text-[10px] font-semibold px-1 rounded bg-[var(--accent-primary)] text-white">
                        {activeCount}
                    </span>
                )}
            </button>

            {open && (
                <div
                    className="absolute bottom-full left-0 mb-2 w-80 rounded-xl border shadow-2xl overflow-hidden z-50"
                    style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)', animation: 'appsOverlayIn .15s ease-out' }}
                >
                    <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                        <div className="flex items-center justify-between mb-1">
                            <h3 className="text-sm font-semibold flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                                <Sparkles size={14} /> Skills
                            </h3>
                            <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                                {activeCount}/{SKILL_CAP} active
                            </span>
                        </div>
                        <p className="text-[11px] mb-2.5" style={{ color: 'var(--text-tertiary)' }}>
                            Toggle reusable instruction packs for this chat
                        </p>
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search skills..."
                            autoFocus
                            className="w-full px-3 py-1.5 text-sm rounded-lg border outline-none transition-colors focus:border-[var(--accent-primary)]"
                            style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                        />
                    </div>

                    <div className="p-1.5 max-h-72 overflow-y-auto">
                        {loading && filtered.length === 0 ? (
                            <div className="text-center py-6 text-sm" style={{ color: 'var(--text-tertiary)' }}>Loading…</div>
                        ) : filtered.length === 0 ? (
                            <div className="text-center py-6 text-sm" style={{ color: 'var(--text-tertiary)' }}>No skills found</div>
                        ) : filtered.map(skill => {
                            const isAttached = attachedSet.has(skill.id);
                            const isActive = isAttached || activeSkillIds.includes(skill.id);
                            const disabled = !isActive && !canActivateMore;
                            return (
                                <div
                                    key={skill.id}
                                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group ${disabled ? 'opacity-50' : 'cursor-pointer hover:bg-[var(--bg-tertiary)]'}`}
                                    onClick={() => {
                                        if (disabled) return;
                                        if (isAttached) return;
                                        onToggleSkill?.(skill.id);
                                    }}
                                    title={isAttached ? 'Attached by this agent — always on' : disabled ? `Maximum ${SKILL_CAP} skills active` : undefined}
                                >
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-[16px]"
                                        style={{ background: 'var(--bg-tertiary)' }}>
                                        {skill.icon || '⚡'}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                                                {skill.name}
                                            </span>
                                            {isAttached && (
                                                <span className="flex items-center gap-0.5 text-[9px] px-1 py-0.5 rounded text-emerald-600 bg-emerald-500/10" title="Attached by agent">
                                                    <Link2 size={8} />
                                                </span>
                                            )}
                                            {!isAttached && (skill.isShared ? (
                                                <Users size={9} style={{ color: 'var(--text-tertiary)' }} />
                                            ) : (
                                                <Lock size={9} style={{ color: 'var(--text-tertiary)' }} />
                                            ))}
                                        </div>
                                        {skill.description && (
                                            <div className="text-[11px] truncate" style={{ color: 'var(--text-tertiary)' }}>
                                                {skill.description}
                                            </div>
                                        )}
                                    </div>
                                    <label
                                        className={`relative inline-flex items-center flex-shrink-0 ${isAttached ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                                        onClick={e => e.stopPropagation()}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isActive}
                                            onChange={() => { if (!isAttached && (isActive || canActivateMore)) onToggleSkill?.(skill.id); }}
                                            disabled={isAttached}
                                            className="sr-only peer"
                                        />
                                        <div className={`w-9 h-5 rounded-full peer after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white peer-checked:bg-emerald-500 ${isAttached ? 'bg-emerald-500/60' : 'bg-gray-300'}`} />
                                    </label>
                                </div>
                            );
                        })}

                        {directMode && (
                            <div className="mt-2 border-t pt-2" style={{ borderColor: 'var(--border-subtle)' }}>
                                <div className="flex items-center justify-between px-3 pb-1">
                                    <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
                                        Chat-Local Skills
                                    </div>
                                    {directConversationId && (
                                        <button
                                            onClick={handleRegenerateSessionSkills}
                                            disabled={regenerating}
                                            className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded hover:bg-[var(--bg-tertiary)] transition-colors disabled:opacity-60"
                                            style={{ color: 'var(--text-secondary)' }}
                                            title="Regenerate the chat-local skill set"
                                        >
                                            <RefreshCw size={10} className={regenerating ? 'animate-spin' : ''} />
                                            {regenerating ? 'Regenerating…' : 'Regenerate'}
                                        </button>
                                    )}
                                </div>
                                {directConversationId && filteredSessionSkills.length === 0 && (
                                    <div className="px-3 py-2 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                                        No temporary skills yet for this direct chat.
                                    </div>
                                )}
                                {!directConversationId && (
                                    <div className="px-3 py-2 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                                        Send the first message to generate temporary skills.
                                    </div>
                                )}
                                {directConversationId && filteredSessionSkills.map(skill => {
                                    const importing = importingSkillId === skill.id;
                                    const imported = importedSessionSkillIds.includes(skill.id);
                                    const deleting = deletingSessionSkillId === skill.id;
                                    const expanded = expandedSessionSkillId === skill.id;
                                    const isActivated = activatedSessionSet.has(skill.id);
                                    const unmetDeps = (skill.dependsOn || []).filter(depId => !activatedSessionSet.has(depId));
                                    const blocked = unmetDeps.length > 0 && !isActivated;
                                    const blockedByNames = unmetDeps.map(id => sessionSkillById.get(id)?.name || id);
                                    const stepNum = skill.order;
                                    return (
                                        <div
                                            key={`session-${skill.id}`}
                                            className="rounded-lg mb-1"
                                            style={{ background: 'var(--bg-tertiary)' }}
                                        >
                                            <div className="flex items-center gap-2 px-3 py-2">
                                                <button
                                                    onClick={() => setExpandedSessionSkillId(expanded ? null : skill.id)}
                                                    className="w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold bg-white/40 hover:bg-white/60 transition-colors"
                                                    title={expanded ? 'Hide details' : `Step ${stepNum}`}
                                                    style={{ color: 'var(--text-primary)' }}
                                                >
                                                    {stepNum || <ChevronDown size={13} />}
                                                </button>
                                                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpandedSessionSkillId(expanded ? null : skill.id)}>
                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                        <span className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{skill.name}</span>
                                                        {isActivated && (
                                                            <span className="flex-shrink-0 text-[9px] px-1 py-0.5 rounded bg-emerald-500/15 text-emerald-600" title="Activated in this conversation">
                                                                active
                                                            </span>
                                                        )}
                                                        {blocked && (
                                                            <span className="flex-shrink-0 text-[9px] px-1 py-0.5 rounded bg-amber-500/15 text-amber-600 truncate" title={`Depends on: ${blockedByNames.join(', ')}`}>
                                                                blocked by {blockedByNames.join(', ')}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {skill.description && (
                                                        <div className="text-[10px] truncate" style={{ color: 'var(--text-tertiary)' }}>{skill.description}</div>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={() => handleImportSessionSkill(skill.id)}
                                                    disabled={importing || imported}
                                                    className="px-2 py-1 text-[10px] rounded border transition-colors disabled:opacity-60"
                                                    style={{ borderColor: 'var(--border-subtle)', color: 'var(--accent-primary)' }}
                                                    title="Import into skill library"
                                                >
                                                    {imported ? 'Imported' : importing ? 'Importing…' : 'Import'}
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteSessionSkill(skill.id)}
                                                    disabled={deleting}
                                                    className="p-1 rounded hover:bg-red-500/15 hover:text-red-500 transition-colors disabled:opacity-50"
                                                    style={{ color: 'var(--text-tertiary)' }}
                                                    title="Delete from this conversation"
                                                >
                                                    {deleting ? <RefreshCw size={11} className="animate-spin" /> : <Trash2 size={11} />}
                                                </button>
                                            </div>
                                            {expanded && (
                                                <div className="px-3 pb-2 space-y-1.5 text-[10.5px]" style={{ color: 'var(--text-secondary)' }}>
                                                    {skill.instructions && (
                                                        <div><span className="font-semibold uppercase tracking-wide text-[9px]" style={{ color: 'var(--text-tertiary)' }}>Instructions</span><div className="whitespace-pre-wrap">{skill.instructions}</div></div>
                                                    )}
                                                    {skill.workflow && (
                                                        <div><span className="font-semibold uppercase tracking-wide text-[9px]" style={{ color: 'var(--text-tertiary)' }}>Workflow</span><div className="whitespace-pre-wrap">{skill.workflow}</div></div>
                                                    )}
                                                    {skill.rules && (
                                                        <div><span className="font-semibold uppercase tracking-wide text-[9px]" style={{ color: 'var(--text-tertiary)' }}>Rules</span><div className="whitespace-pre-wrap">{skill.rules}</div></div>
                                                    )}
                                                    {skill.examples && (
                                                        <div><span className="font-semibold uppercase tracking-wide text-[9px]" style={{ color: 'var(--text-tertiary)' }}>Examples</span><div className="whitespace-pre-wrap">{skill.examples}</div></div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <button
                        onClick={() => setShowForm(true)}
                        className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 text-[12px] font-medium border-t transition-colors hover:bg-[var(--bg-tertiary)]"
                        style={{ color: 'var(--accent-primary)', borderColor: 'var(--border-subtle)' }}
                    >
                        <Plus size={13} /> Create new skill
                    </button>
                </div>
            )}

            {showForm && (
                <SkillFormModal
                    skill={null}
                    onSave={handleCreate}
                    onCancel={() => setShowForm(false)}
                    saving={saving}
                />
            )}
        </div>
    );
}
