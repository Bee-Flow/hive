import React, { useMemo, useState } from 'react';
import { ArrowLeft, Plus, Search, Pencil, Trash2, FolderOpen, Users } from 'lucide-react';

const SORT_OPTIONS = [
    { key: 'recent', label: 'Recently Updated' },
    { key: 'az', label: 'Alphabetical' },
];

const FILTER_OPTIONS = [
    { key: 'all', label: 'All' },
    { key: 'mine', label: 'Mine' },
    { key: 'shared', label: 'Shared with me' },
];

const roleLabel = (perm) => {
    if (perm === 'owner') return 'Owner';
    if (perm === 'editor') return 'Editor';
    return 'Viewer';
};

const ProjectCard = React.memo(({ project, onSelect, onEdit, onDelete }) => {
    const role = project.permission || 'viewer';
    const canEdit = role === 'owner' || role === 'editor';
    const canDelete = role === 'owner';
    return (
        <div
            onClick={onSelect}
            className="group relative p-4 rounded-xl border cursor-pointer transition-shadow duration-150 hover:shadow-md flex flex-col"
            style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)', minHeight: '140px' }}
            data-testid={`project-card-${project.id}`}
        >
            <div className="absolute top-3 right-3 flex items-center gap-1 z-10">
                {canEdit && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onEdit?.(); }}
                        className="p-1.5 rounded-lg transition-opacity opacity-0 group-hover:opacity-100 hover:brightness-90"
                        style={{ background: 'var(--bg-tertiary)' }}
                        title="Edit project"
                    >
                        <Pencil className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                    </button>
                )}
                {canDelete && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
                        className="p-1.5 rounded-lg transition-opacity opacity-0 group-hover:opacity-100 hover:bg-red-500/10"
                        style={{ background: 'var(--bg-tertiary)' }}
                        title="Delete project"
                    >
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    </button>
                )}
            </div>

            <div className="flex items-start gap-3">
                <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: (project.color || '#6366f1') + '22', fontSize: '1.2rem' }}
                >
                    {project.icon || '📁'}
                </div>
                <div className="flex-1 min-w-0 pr-16">
                    <h3 className="font-semibold text-[13px] truncate" style={{ color: 'var(--text-primary)' }} title={project.name}>
                        {project.name}
                    </h3>
                    <p className="text-xs mt-0.5 line-clamp-2 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                        {project.description || 'Group conversations, attach instructions and knowledge bases.'}
                    </p>
                </div>
            </div>

            <div className="mt-auto pt-2 flex items-center gap-1.5">
                <span
                    className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                    style={{
                        background: role === 'owner' ? 'rgba(99,102,241,0.12)' : 'var(--bg-tertiary)',
                        color: role === 'owner' ? '#818cf8' : 'var(--text-muted)',
                    }}
                >
                    {roleLabel(role)}
                </span>
                {(project.knowledgeBaseIds?.length || 0) > 0 && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                        {project.knowledgeBaseIds.length} KB{project.knowledgeBaseIds.length === 1 ? '' : 's'}
                    </span>
                )}
                {project.extractMemories && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}>
                        Memories
                    </span>
                )}
            </div>
        </div>
    );
});

const ProjectsPage = ({
    projects = [],
    user,
    onSelectProject,
    onCreateProject,
    onDeleteProject,
    onClose,
}) => {
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('all');
    const [sortBy, setSortBy] = useState('recent');

    const filtered = useMemo(() => {
        let list = [...projects];
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(p =>
                p.name.toLowerCase().includes(q) ||
                (p.description || '').toLowerCase().includes(q)
            );
        }
        if (filter === 'mine') list = list.filter(p => p.permission === 'owner');
        else if (filter === 'shared') list = list.filter(p => p.permission && p.permission !== 'owner');

        list.sort((a, b) => {
            if (sortBy === 'az') return a.name.localeCompare(b.name);
            return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
        });
        return list;
    }, [projects, search, filter, sortBy]);

    return (
        <div
            className="flex-1 flex flex-col overflow-hidden w-full h-full"
            style={{ background: 'var(--bg-secondary)' }}
            data-testid="projects-page"
        >
            <div className="px-6 pt-5 pb-4 border-b" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)' }}>
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        {onClose && (
                            <button
                                onClick={onClose}
                                className="p-1.5 rounded-lg transition-colors hover:bg-[var(--bg-tertiary)]"
                                style={{ color: 'var(--text-muted)' }}
                                title="Back"
                            >
                                <ArrowLeft className="w-4 h-4" />
                            </button>
                        )}
                        <div>
                            <h1 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                                <FolderOpen className="w-5 h-5" /> Projects
                            </h1>
                            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                {filtered.length} of {projects.length} projects
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {onCreateProject && (
                            <button
                                onClick={onCreateProject}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all hover:bg-[var(--bg-tertiary)]"
                                style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
                                data-testid="projects-page-create"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                New Project
                            </button>
                        )}
                    </div>
                </div>

                <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                    <input
                        type="text"
                        placeholder="Search projects..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 rounded-lg border text-sm focus:outline-none transition-all"
                        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                        data-testid="projects-page-search"
                    />
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto py-1" style={{ scrollbarWidth: 'none' }}>
                    {FILTER_OPTIONS.map(f => {
                        const active = filter === f.key;
                        return (
                            <button
                                key={f.key}
                                onClick={() => setFilter(f.key)}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 border"
                                style={{
                                    background: active ? 'var(--text-primary)' : 'transparent',
                                    color: active ? 'var(--bg-primary)' : 'var(--text-secondary)',
                                    borderColor: active ? 'var(--text-primary)' : 'var(--border-subtle)',
                                }}
                                data-testid={`projects-filter-${f.key}`}
                            >
                                {f.label}
                            </button>
                        );
                    })}
                    <div className="ml-auto flex items-center gap-2">
                        <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>Sort:</span>
                        <select
                            value={sortBy}
                            onChange={e => setSortBy(e.target.value)}
                            className="text-xs py-1 px-2 rounded-md border focus:outline-none cursor-pointer"
                            style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', borderColor: 'var(--border-subtle)' }}
                        >
                            {SORT_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-auto">
                <div className="px-6 py-5">
                    {filtered.length === 0 ? (
                        <div className="py-16 flex flex-col items-center justify-center">
                            <div className="text-3xl mb-3">📁</div>
                            <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                                {search.trim() ? 'No matching projects' : (filter === 'shared' ? 'Nothing shared with you yet' : 'No projects yet')}
                            </h3>
                            <p className="text-xs text-center max-w-xs" style={{ color: 'var(--text-muted)' }}>
                                {filter === 'shared'
                                    ? 'When teammates share projects with you, they’ll appear here.'
                                    : 'Group your conversations and add custom instructions and knowledge bases.'}
                            </p>
                            {onCreateProject && filter !== 'shared' && (
                                <button
                                    onClick={onCreateProject}
                                    className="mt-4 px-4 py-1.5 rounded-lg text-white text-xs font-semibold hover:opacity-90"
                                    style={{ background: 'var(--accent-primary)' }}
                                >
                                    New Project
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                            {filtered.map(p => (
                                <ProjectCard
                                    key={p.id}
                                    project={p}
                                    onSelect={() => onSelectProject?.(p)}
                                    onEdit={() => onSelectProject?.(p)}
                                    onDelete={onDeleteProject ? () => onDeleteProject(p) : undefined}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProjectsPage;
