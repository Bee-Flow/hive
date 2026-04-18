import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, Plus, Lock, Users, Link2, Puzzle } from 'lucide-react';
import SkillFormModal from './SkillFormModal';
import { useSkills } from '../../hooks/useSkills';

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
    onToggleSkill,
    buttonClassName,
}) {
    const { skills, loading, refresh, create } = useSkills();
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);
    const popoverRef = useRef(null);

    useEffect(() => {
        if (!open) return;
        const close = (e) => { if (popoverRef.current && !popoverRef.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
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

    if (!loading && skills.length === 0) return null;

    const canActivateMore = activeCount < SKILL_CAP;

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

    return (
        <div className="relative" ref={popoverRef}>
            <button
                onClick={() => { setOpen(v => !v); setSearch(''); if (!skills.length) refresh(); }}
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
