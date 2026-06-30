import React, { useMemo, useState } from 'react';
import { Sparkles, Plus, X, Search, Zap } from 'lucide-react';
import SkillCard from './SkillCard';

const FILTERS = [
    { id: 'all', label: 'All' },
    { id: 'mine', label: 'Mine' },
    { id: 'shared', label: 'Shared' },
    { id: 'attached', label: 'Attached' },
];

export default function SkillsGrid({
    user,
    skills,
    loading,
    error,
    onRetry,
    onCreate,
    onEdit,
    onDelete,
    onClose,
    activeSkillIds = [],
    onToggleSkill,
    attachedCountBySkillId = {},
    showHeader = true,
}) {
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('all');

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return skills.filter(s => {
            if (q && !(s.name.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q))) return false;
            if (filter === 'mine' && s.userId !== user?.id) return false;
            if (filter === 'shared' && !s.isShared) return false;
            if (filter === 'attached' && !(attachedCountBySkillId[s.id] > 0)) return false;
            return true;
        });
    }, [skills, search, filter, user?.id, attachedCountBySkillId]);

    return (
        <div className="h-full flex flex-col overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
            {showHeader && (
                <div className="flex-shrink-0 px-7 pt-5 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div
                                className="w-10 h-10 rounded-xl flex items-center justify-center border-[1.5px]"
                                style={{
                                    background: 'linear-gradient(135deg, rgba(245,158,11,.3) 0%, rgba(251,191,36,.15) 100%)',
                                    borderColor: 'rgba(245,158,11,.25)',
                                }}
                            >
                                <Sparkles size={20} color="#f59e0b" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="m-0 text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Skills</h2>
                                    <span className="text-[10px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded-md text-purple-500 bg-purple-500/10">
                                        beta
                                    </span>
                                </div>
                                <p className="m-0 mt-0.5 text-[13px]" style={{ color: 'var(--text-secondary)' }}>
                                    Reusable instruction packs for consistent AI task execution
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-2 items-center">
                            <button
                                onClick={onCreate}
                                data-tour="skill-create"
                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-semibold text-white shadow-md transition-opacity hover:opacity-90"
                                style={{ background: 'var(--accent-primary)' }}
                            >
                                <Plus size={15} /> New skill
                            </button>
                            {onClose && (
                                <button
                                    onClick={onClose}
                                    className="w-9 h-9 rounded-xl border flex items-center justify-center transition-colors hover:bg-[var(--bg-tertiary)]"
                                    style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)', background: 'transparent' }}
                                >
                                    <X size={16} />
                                </button>
                            )}
                        </div>
                    </div>

                    {activeSkillIds.length > 0 && (
                        <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl mb-3 border"
                            style={{ background: 'rgba(245,158,11,.1)', borderColor: 'rgba(245,158,11,.25)' }}>
                            <Zap size={13} color="#f59e0b" />
                            <span className="text-[12px] font-medium text-amber-600">
                                {activeSkillIds.length} skill{activeSkillIds.length !== 1 ? 's' : ''} active in chat
                            </span>
                        </div>
                    )}

                    <div className="flex items-center gap-3 mb-4">
                        <div className="relative flex-1">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-tertiary)' }} />
                            <input
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search skills..."
                                className="w-full pl-9 pr-3 py-2 text-[13px] rounded-xl border-[1.5px] outline-none transition-colors focus:border-[var(--accent-primary)]"
                                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                            />
                        </div>
                        <div className="flex gap-1 p-1 rounded-xl border" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                            {FILTERS.map(f => (
                                <button
                                    key={f.id}
                                    onClick={() => setFilter(f.id)}
                                    className={`text-[12px] font-medium px-3 py-1 rounded-lg transition-colors ${filter === f.id
                                        ? 'bg-[var(--accent-primary)] text-white'
                                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                                        }`}
                                >
                                    {f.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-auto px-7 py-5">
                {loading && (
                    <div className="flex items-center justify-center h-32">
                        <div className="w-6 h-6 rounded-full border-[2.5px] border-[var(--border-subtle)] border-t-[var(--accent-primary)] animate-spin" />
                    </div>
                )}

                {!loading && error && (
                    <div className="py-5 text-center text-red-500 text-sm">
                        {error} — <button onClick={onRetry} className="underline text-[var(--accent-primary)]">retry</button>
                    </div>
                )}

                {!loading && !error && filtered.length === 0 && (
                    <div className="text-center py-12">
                        <div className="text-5xl mb-3">⚡</div>
                        <h3 className="m-0 mb-2 font-bold text-base" style={{ color: 'var(--text-primary)' }}>
                            {search ? 'No skills match your search' : 'No skills yet'}
                        </h3>
                        <p className="m-0 mb-5 text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                            {search ? 'Try a different search term.' : 'Create your first skill to teach the AI how to handle specific tasks consistently.'}
                        </p>
                        {!search && (
                            <button
                                onClick={onCreate}
                                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-[13px] font-semibold text-white"
                                style={{ background: 'var(--accent-primary)' }}
                            >
                                <Plus size={14} /> Create your first skill
                            </button>
                        )}
                    </div>
                )}

                {!loading && !error && filtered.length > 0 && (
                    <div className="grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                        {filtered.map(skill => (
                            <SkillCard
                                key={skill.id}
                                skill={skill}
                                isOwner={skill.userId === user?.id || user?.isAdmin}
                                isActive={activeSkillIds.includes(skill.id)}
                                onToggle={onToggleSkill}
                                onEdit={onEdit}
                                onDelete={onDelete}
                                attachedAgentCount={attachedCountBySkillId[skill.id] || 0}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
