import React, { useMemo, useState } from 'react';
import { ArrowLeft, Plus, Search, Pencil, Trash2, FolderOpen } from 'lucide-react';
import { RequireTier } from './LicenseContext';
import { formatRelativeTime } from '../utils/dateFormatters';

// Matches the Studio (Webpages) list-view shell: single-row header, inline
// create+search toolbar, card grid body with a top visual band per card.

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
    const accent = project.color || '#6366f1';
    const icon = project.icon || '📁';

    return (
        <div
            onClick={onSelect}
            className="group rounded-xl border hover:shadow-md cursor-pointer transition-all overflow-hidden flex flex-col"
            style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-primary)' }}
            data-testid={`project-card-${project.id}`}
        >
            {/* Visual band — mirrors WebpagesPage card hero */}
            <div
                className="relative w-full h-24 flex items-center justify-center"
                style={{ background: `${accent}1a` }}
            >
                <span className="text-4xl select-none" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.08))' }}>
                    {icon}
                </span>
                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                    {canEdit && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onEdit?.(); }}
                            className="p-1 rounded-md bg-white/80 hover:bg-white shadow-sm"
                            title="Edit project"
                        >
                            <Pencil className="w-3 h-3" style={{ color: 'var(--text-secondary)' }} />
                        </button>
                    )}
                    {canDelete && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
                            className="p-1 rounded-md bg-white/80 hover:bg-white shadow-sm"
                            title="Delete project"
                        >
                            <Trash2 className="w-3 h-3" style={{ color: '#ef4444' }} />
                        </button>
                    )}
                </div>
            </div>

            <div className="p-3 flex-1 flex flex-col">
                <div className="flex items-start gap-2 mb-1">
                    <span className="text-base shrink-0" aria-hidden>{icon}</span>
                    <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }} title={project.name}>
                            {project.name}
                        </div>
                        {project.description && (
                            <div className="text-[11px] mt-0.5 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                                {project.description}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2 text-[10px] mt-auto pt-2" style={{ color: 'var(--text-tertiary)' }}>
                    <span
                        className="font-medium px-1.5 py-0.5 rounded"
                        style={{
                            background: role === 'owner' ? 'rgba(99,102,241,0.12)' : 'var(--bg-tertiary)',
                            color: role === 'owner' ? '#818cf8' : 'var(--text-muted)',
                        }}
                    >
                        {roleLabel(role)}
                    </span>
                    {project.updatedAt && <span>· {formatRelativeTime(project.updatedAt)}</span>}
                    {(project.knowledgeBaseIds?.length || 0) > 0 && (
                        <span>· {project.knowledgeBaseIds.length} KB{project.knowledgeBaseIds.length === 1 ? '' : 's'}</span>
                    )}
                    {project.extractMemories && (
                        <span style={{ color: '#10b981' }}>· Memories</span>
                    )}
                </div>
            </div>
        </div>
    );
});

const ProjectsPageInner = ({
    projects = [],
    user: _user, // accepted for parent contract; not rendered here
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
        <div className="flex flex-col h-full" style={{ background: 'var(--bg-primary)' }} data-testid="projects-page">
            {/* Header: matches WebpagesPage single-row pattern */}
            <div
                className="shrink-0 px-4 py-3 border-b flex items-center gap-3"
                style={{ borderColor: 'var(--border-subtle)' }}
            >
                {onClose && (
                    <button onClick={onClose} className="p-1 rounded-md hover:bg-[var(--bg-secondary)]" title="Back">
                        <ArrowLeft className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                    </button>
                )}
                <div className="flex-1 flex items-center gap-2">
                    <FolderOpen className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
                    <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Projects</h2>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {filtered.length} of {projects.length}
                    </span>
                </div>
            </div>

            {/* Toolbar: create + search inline, like Webpages */}
            <div
                className="shrink-0 px-4 py-3 border-b flex flex-wrap items-center gap-2"
                style={{ borderColor: 'var(--border-subtle)' }}
            >
                {onCreateProject && (
                    <button
                        onClick={onCreateProject}
                        className="px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1 text-white"
                        style={{ background: 'var(--accent-primary)' }}
                        data-testid="projects-page-create"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        New Project
                    </button>
                )}
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
                    <input
                        type="text"
                        placeholder="Search…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-7 pr-2 py-2 text-sm rounded-lg border outline-none"
                        style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                        data-testid="projects-page-search"
                    />
                </div>
                <div className="flex items-center gap-1.5 ml-auto">
                    {FILTER_OPTIONS.map(f => {
                        const active = filter === f.key;
                        return (
                            <button
                                key={f.key}
                                onClick={() => setFilter(f.key)}
                                className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 border"
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
                    <select
                        value={sortBy}
                        onChange={e => setSortBy(e.target.value)}
                        className="text-xs py-1.5 px-2 rounded-md border focus:outline-none cursor-pointer"
                        style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', borderColor: 'var(--border-subtle)' }}
                        aria-label="Sort projects"
                    >
                        {SORT_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
                    </select>
                </div>
            </div>

            {/* Body — card grid */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                {filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-center py-20">
                        <FolderOpen className="w-12 h-12 mb-3" style={{ color: 'var(--text-tertiary)' }} />
                        <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                            {search.trim() ? 'No matches' : (filter === 'shared' ? 'Nothing shared with you yet' : 'No projects yet')}
                        </h3>
                        <p className="text-sm max-w-sm" style={{ color: 'var(--text-secondary)' }}>
                            {filter === 'shared'
                                ? 'When teammates share projects with you, they’ll appear here.'
                                : (search.trim()
                                    ? 'Try a different search.'
                                    : 'Group your conversations and add custom instructions and knowledge bases.')}
                        </p>
                        {onCreateProject && filter !== 'shared' && !search.trim() && (
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
    );
};

// Licence-gated wrapper. Community-tier sessions see the upgrade panel
// instead of a Projects shell whose /api/projects calls would 403.
export default function ProjectsPage(props) {
    return (
        <RequireTier feature="projects">
            <ProjectsPageInner {...props} />
        </RequireTier>
    );
}
