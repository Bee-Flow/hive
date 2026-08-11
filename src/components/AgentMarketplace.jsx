import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { getAgentInitials, getAgentColor } from '../utils/helpers';
import { isImageAvatar, resolveAvatarSrc, pickAgentAvatar } from '../utils/agentAvatar';
import { ChevronDown, ChevronUp, X, Search, Heart, EyeOff, Pencil } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import scopedStorage from '../utils/scopedStorage';

const STATIC_CATEGORIES_BEFORE_KEYS = [
    { key: 'popular', tKey: 'store.tab_popular' },
    { key: 'lastused', tKey: 'store.tab_last_used' },
];

const STATIC_CATEGORIES_AFTER_KEYS = [
    { key: 'favorites', tKey: 'store.tab_favorites' },
    { key: 'all', tKey: 'store.tab_all' },
];

const JOB_CHIPS = [
    { key: 'research', label: 'Research', keywords: ['research', 'search', 'query', 'pubmed', 'arxiv', 'lookup'] },
    { key: 'coding', label: 'Coding', keywords: ['coding', 'script', 'python', 'terminal', 'code', 'develop'] },
    { key: 'writing', label: 'Writing', keywords: ['writing', 'content', 'create', 'author', 'edit', 'draft'] },
    { key: 'data', label: 'Data & APIs', keywords: ['data', 'api', 'sql', 'fetch', 'spreadsheet', 'csv'] },
];

const SORT_OPTIONS = [
    { key: 'top', label: 'Recommended' },
    { key: 'popular', label: 'Most Used' },
    { key: 'newest', label: 'Recently Updated' },
    { key: 'az', label: 'Alphabetical' },
];

const STATIC_TYPE_MAP = {};

const getAgentType = (a) => {
    if (a.category_id) return `cat_${a.category_id}`;
    return 'agent';
};

// Filter to only normal org-created agents — hide system/swarm agents and
// research agents. System agents (owner_id === 'system') power internal
// pipelines like memory extraction, conversation-starter generation, prompt
// design etc.; they have no user-facing chat surface and showing them in the
// marketplace just confuses users (and globally-scoped admins, who would
// otherwise see them on every install).
const isNormalAgent = (a) => {
    if (!a) return false;
    if (a._type === 'research') return false;
    if (a.owner_id === 'system' || a.owner_id === 'swarm') return false;
    return true;
};

/* ── Agent Card ── */
const AgentCard = React.memo(({ agentId, name, avatar, description, typeLabel, isFavorite, isOwner, onSelect, onToggleFavorite, onUnpublish, onEdit }) => (
    <div
        onClick={onSelect}
        className="group relative p-4 rounded-xl border cursor-pointer transition-shadow duration-150 hover:shadow-md flex flex-col"
        style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)', minHeight: '130px' }}
        data-testid={`agent-card-${agentId}`}
    >
        <div className="absolute top-3 right-3 flex items-center gap-1 z-10">
            {isOwner && onEdit && (
                <button
                    onClick={(e) => { e.stopPropagation(); onEdit(); }}
                    className="p-1.5 rounded-lg transition-opacity opacity-0 group-hover:opacity-100 hover:brightness-90"
                    style={{ background: 'var(--bg-tertiary)' }}
                    title="Edit agent"
                    data-testid={`agent-edit-${agentId}`}
                >
                    <Pencil className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                </button>
            )}
            {isOwner && onUnpublish && (
                <button
                    onClick={(e) => { e.stopPropagation(); onUnpublish(agentId); }}
                    className="p-1.5 rounded-lg transition-opacity opacity-0 group-hover:opacity-100"
                    style={{ background: 'var(--bg-tertiary)' }}
                    title="Unpublish agent"
                >
                    <EyeOff className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                </button>
            )}
            <button
                onClick={(e) => { e.stopPropagation(); onToggleFavorite(agentId); }}
                className={`p-1.5 rounded-lg transition-opacity ${isFavorite ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                style={{ background: 'var(--bg-tertiary)' }}
            >
                <Heart className={`w-3.5 h-3.5 ${isFavorite ? 'text-red-500 fill-red-500' : ''}`} style={isFavorite ? {} : { color: 'var(--text-muted)' }} />
            </button>
        </div>

        <div className="flex items-start gap-3">
            {(() => {
                const isImg = isImageAvatar(avatar);
                return (
                    <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 overflow-hidden"
                        style={{
                            background: avatar && !isImg ? 'transparent' : (!avatar ? getAgentColor(name) : 'transparent'),
                            color: avatar ? undefined : 'white',
                            fontSize: avatar && !isImg ? '1.2rem' : undefined,
                        }}
                    >
                        {isImg
                            ? <img src={resolveAvatarSrc(avatar)} alt="" className="w-full h-full object-cover" />
                            : (avatar || getAgentInitials(name))}
                    </div>
                );
            })()}
            <div className="flex-1 min-w-0 pr-16">
                <h3 className="font-semibold text-[13px] truncate" style={{ color: 'var(--text-primary)' }} title={name}>{name}</h3>
                <p className="text-xs mt-0.5 line-clamp-2 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {description || 'AI agent ready to assist.'}
                </p>
            </div>
        </div>
    </div>
));


/* ── Main Store ── */
const API = (import.meta.env.VITE_API_URL || '') + '/api/usage';

const AgentMarketplace = ({ agents = [], favorites = [], categories = [], onToggleFavorite, onSelect, onClose, onUnpublish, onEditAgent, user }) => {
    const { t } = useTranslation();
    const [search, setSearch] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [activeCategory, setActiveCategory] = useState('popular');
    const [activeJobs, setActiveJobs] = useState([]);
    const [sortBy, setSortBy] = useState('top');
    const [usageByAgent, setUsageByAgent] = useState({});
    const [recents, setRecents] = useState(() => scopedStorage.getJSON('agent_marketplace_recents', []));

    // Build category list dynamically: static before + dynamic org categories + static after
    const CATEGORIES = useMemo(() => {
        const before = STATIC_CATEGORIES_BEFORE_KEYS.map(c => ({ key: c.key, label: t(c.tKey) }));
        const after = STATIC_CATEGORIES_AFTER_KEYS.map(c => ({ key: c.key, label: t(c.tKey) }));
        const dynamicCats = categories.map(c => ({ key: `cat_${c.id}`, label: `${c.icon || ''} ${c.name}`.trim() }));
        return [...before, ...dynamicCats, ...after];
    }, [categories, t]);

    // Build a type map that includes dynamic categories
    const TYPE_MAP = useMemo(() => {
        const map = { ...STATIC_TYPE_MAP };
        categories.forEach(c => { map[`cat_${c.id}`] = c.name; });
        return map;
    }, [categories]);

    // BFSF-272: categories are deletable/mergeable now — when the active chip's
    // category vanishes, fall back to 'popular' instead of filtering to a
    // silently empty list (KBsStudio pattern).
    useEffect(() => {
        if (!activeCategory.startsWith('cat_')) return;
        if (!categories.some(c => `cat_${c.id}` === activeCategory)) {
            setActiveCategory('popular');
        }
    }, [categories, activeCategory]);

    // Fetch popularity data from monitoring API
    useEffect(() => {
        fetch(`${API}/agents`)
            .then(r => r.ok ? r.json() : [])
            .then(data => {
                const map = {};
                (Array.isArray(data) ? data : []).forEach(d => { if (d.agent_id) map[d.agent_id] = d.calls || 0; });
                setUsageByAgent(map);
            })
            .catch(() => { });
    }, []);

    const handleSelect = useCallback((agent) => {
        const r = scopedStorage.getJSON('agent_marketplace_recents', []);
        const updated = [agent.id, ...r.filter(id => id !== agent.id)].slice(0, 8);
        scopedStorage.setJSON('agent_marketplace_recents', updated);
        setRecents(updated);
        onSelect(agent);
    }, [onSelect]);

    const toggleJob = useCallback((key) => {
        setActiveJobs(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
    }, []);

    const filtered = useMemo(() => {
        let list = agents.filter(isNormalAgent);
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(a => a.name.toLowerCase().includes(q) || (a.description || '').toLowerCase().includes(q));
        }
        if (activeCategory === 'favorites') list = list.filter(a => favorites.includes(a.id));
        else if (activeCategory === 'popular') {
            list = [...list].sort((a, b) => {
                const diff = (usageByAgent[b.id] || 0) - (usageByAgent[a.id] || 0);
                if (diff !== 0) return diff;
                const favDiff = (favorites.includes(a.id) ? 0 : 1) - (favorites.includes(b.id) ? 0 : 1);
                if (favDiff !== 0) return favDiff;
                return a.name.localeCompare(b.name);
            }).slice(0, 6);
        }
        else if (activeCategory === 'lastused') list = list.filter(a => recents.includes(a.id)).slice(0, 6);
        else if (activeCategory !== 'all') list = list.filter(a => getAgentType(a) === activeCategory);

        if (activeJobs.length > 0) {
            list = list.filter(agent => {
                const text = `${agent.name} ${agent.description} ${(agent.tools || []).join(' ')}`.toLowerCase();
                return activeJobs.every(jk => JOB_CHIPS.find(j => j.key === jk).keywords.some(k => text.includes(k)));
            });
        }
        const sorted = [...list];
        sorted.sort((a, b) => {
            if (sortBy === 'popular' || activeCategory === 'popular') {
                return (usageByAgent[b.id] || 0) - (usageByAgent[a.id] || 0);
            }
            if (activeCategory === 'lastused') {
                return recents.indexOf(a.id) - recents.indexOf(b.id);
            }
            if (sortBy === 'top') {
                const d = (favorites.includes(a.id) ? 0 : 1) - (favorites.includes(b.id) ? 0 : 1);
                return d !== 0 ? d : a.name.localeCompare(b.name);
            }
            if (sortBy === 'newest') return new Date(b.updated_at || 0) - new Date(a.updated_at || 0);
            return a.name.localeCompare(b.name);
        });
        return sorted;
    }, [agents, search, activeCategory, favorites, sortBy, activeJobs, usageByAgent, recents]);


    // Eligible-for-marketplace total. Used as the denominator in "X of Y agents"
    // so the count doesn't claim there are 12 agents when 9 of them are hidden
    // system/swarm entries that the user can't actually see.
    const marketplaceAgents = useMemo(() => agents.filter(isNormalAgent), [agents]);
    const favoriteAgents = useMemo(() => marketplaceAgents.filter(a => favorites.includes(a.id)), [marketplaceAgents, favorites]);

    const hasActiveFilters = activeCategory !== 'all' || activeJobs.length > 0;
    const isSearching = search.trim().length > 0;

    const cardData = useMemo(() => filtered.map(a => {
        // BFSF-271: prefer the server's per-agent edit verdict (can_edit on
        // /agents/published rows) over the local owner heuristic — the server
        // is the single policy source. Fall back to the heuristic for rows
        // from older servers that don't carry the field yet.
        const isOwner = typeof a.can_edit === 'boolean'
            ? a.can_edit
            : !!(user && (a.owner_id === user.id || user.isAdmin || (user.permissions || []).includes('all')));
        const avatar = pickAgentAvatar(a);
        return {
            id: a.id, name: a.name, avatar, description: a.description,
            typeLabel: TYPE_MAP[getAgentType(a)] || t('store.badge_agent'), isFavorite: favorites.includes(a.id), isOwner, agent: a,
        };
    }), [filtered, favorites, TYPE_MAP, user]);
    // Permission check: can this user edit/create agents?
    const canManageAgents = user && (
        user.isAdmin ||
        (user.permissions || []).includes('all') ||
        (user.permissions || []).includes('org_admin') ||
        (user.permissions || []).some?.(p => p.startsWith?.('admin_')) ||
        user.orgRole === 'admin' ||
        user.orgRole === 'org_admin'
    );

    return (
        <div className="flex-1 flex flex-col overflow-hidden w-full h-full" style={{ background: 'var(--bg-secondary)' }} data-testid="agent-marketplace">
            {/* Header */}
            <div className="px-6 pt-5 pb-4 border-b" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)' }}>
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{t('store.title')}</h1>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{t('store.count', { visible: filtered.length, total: marketplaceAgents.length })}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {canManageAgents && onEditAgent && (
                                <button
                                    onClick={() => onEditAgent()}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all hover:bg-[var(--bg-tertiary)]"
                                    style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
                                    data-testid="marketplace-agent-editor"
                                >
                                    <Pencil className="w-3.5 h-3.5" />
                                    {t('store.agent_editor')}
                                </button>
                            )}
                        <button onClick={onClose} className="p-2 rounded-lg transition-colors" style={{ color: 'var(--text-muted)' }}>
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                    <input
                        type="text" placeholder={t('store.search_placeholder')} value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 rounded-lg border text-sm focus:outline-none transition-all"
                        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                        data-testid="marketplace-search"
                    />
                </div>

                {/* Category chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto py-1" style={{ scrollbarWidth: 'none' }}>
                    {CATEGORIES.map(cat => {
                        const active = activeCategory === cat.key;
                        return (
                            <button key={cat.key}
                                onClick={() => { setActiveCategory(cat.key); setActiveJobs([]); }}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 border"
                                style={{
                                    background: active ? 'var(--text-primary)' : 'transparent',
                                    color: active ? 'var(--bg-primary)' : 'var(--text-secondary)',
                                    borderColor: active ? 'var(--text-primary)' : 'var(--border-subtle)',
                                }}
                                data-testid={`marketplace-category-${cat.key}`}
                            >{cat.label}</button>
                        );
                    })}
                </div>

                {/* Advanced toggle */}
                <button onClick={() => setShowFilters(!showFilters)}
                    className="flex items-center gap-1 text-[11px] font-medium mt-2 px-1 rounded transition-colors"
                    style={{ color: hasActiveFilters ? 'var(--accent-primary)' : 'var(--text-muted)' }}
                >
                    {showFilters ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    {t('store.advanced')}
                </button>

                {showFilters && (
                    <div className="mt-2 space-y-2 pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                        <div className="flex flex-wrap gap-1.5">
                            <span className="text-[10px] font-medium self-center mr-1" style={{ color: 'var(--text-muted)' }}>Type:</span>
                            {JOB_CHIPS.map(job => {
                                const active = activeJobs.includes(job.key);
                                return (
                                    <button key={job.key} onClick={() => toggleJob(job.key)}
                                        className="px-2.5 py-1 rounded-md text-xs font-medium transition-all border"
                                        style={{
                                            background: active ? 'var(--text-primary)' : 'transparent',
                                            color: active ? 'var(--bg-primary)' : 'var(--text-secondary)',
                                            borderColor: active ? 'var(--text-primary)' : 'var(--border-subtle)',
                                        }}
                                    >{job.label}</button>
                                );
                            })}
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>Sort:</span>
                            <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                                className="text-xs py-1 px-2 rounded-md border focus:outline-none cursor-pointer"
                                style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', borderColor: 'var(--border-subtle)' }}
                            >
                                {SORT_OPTIONS.map(opt => <option key={opt.key} value={opt.key}>{opt.label}</option>)}
                            </select>
                            {hasActiveFilters && (
                                <button onClick={() => { setActiveCategory('popular'); setActiveJobs([]); setSortBy('top'); }}
                                    className="text-xs ml-auto hover:underline" style={{ color: 'var(--text-muted)' }}>Reset</button>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto">
                <div className="px-6 py-5 space-y-5">




                    {/* Grid */}
                    <div>
                        <h2 className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
                            {isSearching ? t('store.results') : activeCategory === 'all' ? t('store.all_agents') : CATEGORIES.find(c => c.key === activeCategory)?.label || t('store.badge_agent')}
                            <span className="font-normal ml-1 normal-case tracking-normal">({filtered.length})</span>
                        </h2>

                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                            {cardData.map(d => (
                                <AgentCard key={d.id} agentId={d.id} name={d.name} avatar={d.avatar}
                                    description={d.description} typeLabel={d.typeLabel} isFavorite={d.isFavorite}
                                    isOwner={d.isOwner}
                                    onSelect={() => handleSelect(d.agent)} onToggleFavorite={onToggleFavorite}
                                    onUnpublish={onUnpublish}
                                    onEdit={d.isOwner && onEditAgent ? () => onEditAgent(d.agent) : undefined}
                                />
                            ))}
                        </div>

                        {filtered.length === 0 && (
                            <div className="py-16 flex flex-col items-center justify-center">
                                <div className="text-3xl mb-3">📭</div>
                                <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{t('store.no_agents')}</h3>
                                <p className="text-xs text-center max-w-xs" style={{ color: 'var(--text-muted)' }}>{t('store.no_agents_hint')}</p>
                                <button onClick={() => { setActiveCategory('popular'); setActiveJobs([]); setSearch(''); }}
                                    className="mt-4 px-4 py-1.5 rounded-lg text-white text-xs font-semibold hover:opacity-90"
                                    style={{ background: 'var(--accent-primary)' }}>{t('store.clear_filters')}</button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AgentMarketplace;
