import React, { useMemo, useState } from 'react';
import { Sparkles, Plus, Search, Users, Lock, Edit2, Check } from 'lucide-react';
import { useSkills } from '../../hooks/useSkills';
import SkillFormModal from '../skills/SkillFormModal';

export default function AgentSkillsTab({ user, attachedSkillIds = [], onChangeAttached }) {
    const { skills, loading, error, refresh, create, update } = useSkills();
    const [search, setSearch] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editingSkill, setEditingSkill] = useState(null);
    const [saving, setSaving] = useState(false);

    const attachedSet = useMemo(() => new Set(attachedSkillIds), [attachedSkillIds]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return skills;
        return skills.filter(s => s.name.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q));
    }, [skills, search]);

    const toggle = (id) => {
        const next = attachedSet.has(id)
            ? attachedSkillIds.filter(x => x !== id)
            : [...attachedSkillIds, id];
        onChangeAttached(next);
    };

    const handleSave = async (form) => {
        setSaving(true);
        try {
            if (editingSkill) {
                await update(editingSkill.id, form);
            } else {
                const created = await create(form);
                if (created?.id) onChangeAttached([...attachedSkillIds, created.id]);
            }
            setShowForm(false);
            setEditingSkill(null);
        } catch (err) {
            alert(err.message || 'Failed to save skill');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="max-w-2xl space-y-4">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <Sparkles size={16} color="#f59e0b" />
                        <h3 className="text-sm font-semibold m-0" style={{ color: 'var(--text-primary)' }}>
                            Attached skills
                        </h3>
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded text-purple-500 bg-purple-500/10 uppercase tracking-wider">beta</span>
                    </div>
                    <p className="text-xs m-0 mt-1" style={{ color: 'var(--text-muted)' }}>
                        Skills attached here are always active when anyone chats with this agent.
                    </p>
                </div>
                <button
                    onClick={() => { setEditingSkill(null); setShowForm(true); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
                    style={{ background: 'var(--accent-primary)' }}
                >
                    <Plus size={13} /> New skill
                </button>
            </div>

            <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-tertiary)' }} />
                <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search skills..."
                    className="w-full pl-9 pr-3 py-2 text-[13px] rounded-lg border outline-none transition-colors focus:border-[var(--accent-primary)]"
                    style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                />
            </div>

            {loading && (
                <div className="flex items-center justify-center py-10">
                    <div className="w-5 h-5 rounded-full border-[2.5px] border-[var(--border-subtle)] border-t-[var(--accent-primary)] animate-spin" />
                </div>
            )}

            {error && (
                <div className="py-3 text-center text-red-500 text-sm">
                    {error} — <button onClick={refresh} className="underline text-[var(--accent-primary)]">retry</button>
                </div>
            )}

            {!loading && !error && filtered.length === 0 && (
                <div className="py-8 text-center rounded-xl border" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                    <div className="text-3xl mb-2">⚡</div>
                    <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        {search ? 'No skills match your search' : 'No skills yet'}
                    </div>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                        {search ? 'Try a different search term.' : 'Create one to get started.'}
                    </p>
                </div>
            )}

            {!loading && !error && filtered.length > 0 && (
                <div className="rounded-xl border divide-y overflow-hidden"
                    style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                    {filtered.map(skill => {
                        const attached = attachedSet.has(skill.id);
                        const isOwner = skill.userId === user?.id || user?.isAdmin;
                        return (
                            <div
                                key={skill.id}
                                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--bg-tertiary)] cursor-pointer"
                                onClick={() => toggle(skill.id)}
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
                                        {skill.isShared ? (
                                            <Users size={10} style={{ color: 'var(--text-tertiary)' }} />
                                        ) : (
                                            <Lock size={10} style={{ color: 'var(--text-tertiary)' }} />
                                        )}
                                    </div>
                                    {skill.description && (
                                        <div className="text-[11px] truncate" style={{ color: 'var(--text-tertiary)' }}>
                                            {skill.description}
                                        </div>
                                    )}
                                </div>
                                {isOwner && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setEditingSkill(skill); setShowForm(true); }}
                                        className="w-7 h-7 rounded-md flex items-center justify-center transition-colors hover:bg-[var(--bg-primary)]"
                                        style={{ color: 'var(--text-tertiary)' }}
                                        title="Edit skill"
                                    >
                                        <Edit2 size={13} />
                                    </button>
                                )}
                                <label
                                    className="relative inline-flex items-center cursor-pointer flex-shrink-0"
                                    onClick={e => e.stopPropagation()}
                                >
                                    <input
                                        type="checkbox"
                                        checked={attached}
                                        onChange={() => toggle(skill.id)}
                                        className="sr-only peer"
                                    />
                                    <div className="w-9 h-5 bg-gray-300 rounded-full peer after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white peer-checked:bg-emerald-500" />
                                </label>
                            </div>
                        );
                    })}
                </div>
            )}

            {attachedSkillIds.length > 0 && (
                <div className="flex items-center gap-2 text-[12px] pt-1" style={{ color: 'var(--text-secondary)' }}>
                    <Check size={13} className="text-emerald-500" />
                    {attachedSkillIds.length} skill{attachedSkillIds.length !== 1 ? 's' : ''} attached
                </div>
            )}

            {showForm && (
                <SkillFormModal
                    skill={editingSkill}
                    onSave={handleSave}
                    onCancel={() => { setShowForm(false); setEditingSkill(null); }}
                    saving={saving}
                    user={user}
                />
            )}
        </div>
    );
}
