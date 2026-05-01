import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { ChevronDown, ChevronUp, X, Search, Heart, EyeOff, Pencil, BookOpen, Globe, Mail, FileText, Database, Plus } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import scopedStorage from '../utils/scopedStorage';

const STATIC_CATEGORIES_BEFORE_KEYS = [
    { key: 'all', tKey: 'kb_store.tab_all' },
    { key: 'mine', tKey: 'kb_store.tab_mine' },
    { key: 'published', tKey: 'kb_store.tab_published' },
];

const STATIC_CATEGORIES_AFTER_KEYS = [
    { key: 'favorites', tKey: 'kb_store.tab_favorites' },
];

const SOURCE_CHIPS = [
    { key: 'file', label: 'Documents', match: ['file', 'pdf', 'docx', 'xlsx', 'csv', 'text'] },
    { key: 'url', label: 'Web pages', match: ['url', 'web', 'sitemap'] },
    { key: 'email', label: 'Email', match: ['email', 'mail'] },
];

const SORT_OPTIONS = [
    { key: 'top', label: 'Recommended' },
    { key: 'recent', label: 'Recently Updated' },
    { key: 'most_docs', label: 'Most Documents' },
    { key: 'az', label: 'Alphabetical' },
];

const isImageIcon = (i) => typeof i === 'string' && (i.startsWith('data:') || i.startsWith('http'));

const formatNum = (n) => {
    const v = Number(n) || 0;
    if (v >= 1000) return (v / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return String(v);
};

const KBCard = React.memo(({ kbId, name, icon, description, categoryLabel, isPublished, isFavorite, isOwner, docCount, chunkCount, onSelect, onToggleFavorite, onUnpublish, onEdit }) => (
    <div
        onClick={onSelect}
        className="group relative p-4 rounded-xl border cursor-pointer transition-shadow duration-150 hover:shadow-md flex flex-col"
        style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)', minHeight: '140px' }}
        data-testid={`kb-card-${kbId}`}
    >
        <div className="absolute top-3 right-3 flex items-center gap-1 z-10">
            {isOwner && onEdit && (
                <button
                    onClick={(e) => { e.stopPropagation(); onEdit(); }}
                    className="p-1.5 rounded-lg transition-opacity opacity-0 group-hover:opacity-100 hover:brightness-90"
                    style={{ background: 'var(--bg-tertiary)' }}
                    title="Edit knowledge base"
                    data-testid={`kb-edit-${kbId}`}
                >
                    <Pencil className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                </button>
            )}
            {isOwner && onUnpublish && isPublished && (
                <button
                    onClick={(e) => { e.stopPropagation(); onUnpublish(kbId); }}
                    className="p-1.5 rounded-lg transition-opacity opacity-0 group-hover:opacity-100"
                    style={{ background: 'var(--bg-tertiary)' }}
                    title="Unpublish knowledge base"
                >
                    <EyeOff className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                </button>
            )}
            {onToggleFavorite && (
                <button
                    onClick={(e) => { e.stopPropagation(); onToggleFavorite(kbId); }}
                    className={`p-1.5 rounded-lg transition-opacity ${isFavorite ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                    style={{ background: 'var(--bg-tertiary)' }}
                >
                    <Heart className={`w-3.5 h-3.5 ${isFavorite ? 'text-red-500 fill-red-500' : ''}`} style={isFavorite ? {} : { color: 'var(--text-muted)' }} />
                </button>
            )}
        </div>

        <div className="flex items-start gap-3">
            <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 overflow-hidden"
                style={{ background: 'var(--bg-tertiary)', color: 'var(--accent-primary)', fontSize: icon && !isImageIcon(icon) ? '1.2rem' : undefined }}
            >
                {isImageIcon(icon)
                    ? <img src={icon} alt="" className="w-full h-full object-cover" />
                    : (icon || <BookOpen className="w-5 h-5" />)}
            </div>
            <div className="flex-1 min-w-0 pr-16">
                <h3 className="font-semibold text-[13px] truncate" style={{ color: 'var(--text-primary)' }} title={name}>{name}</h3>
                <p className="text-xs mt-0.5 line-clamp-2 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {description || 'Knowledge base — add documents to ground answers.'}
                </p>
            </div>
        </div>

        <div className="mt-auto pt-2 flex items-center gap-1.5">
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                {categoryLabel}
            </span>
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }} title="Documents · chunks">
                {formatNum(docCount)} docs · {formatNum(chunkCount)} chunks
            </span>
            {isPublished && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}>
                    Published
                </span>
            )}
        </div>
    </div>
));

const KBMarketplace = ({
    kbs = [],
    favorites = [],
    categories = [],
    onToggleFavorite,
    onSelectKB,
    onClose,
    onUnpublishKB,
    onEditKB,
    user,
}) => {
    const { t } = useTranslation();
    const [search, setSearch] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [activeCategory, setActiveCategory] = useState('all');
    const [activeSources, setActiveSources] = useState([]);
    const [sortBy, setSortBy] = useState('top');
    const [recents, setRecents] = useState(() => scopedStorage.getJSON('kb_marketplace_recents', []));

    // Only show categories that contain at least one KB the user can see.
    const usedCategoryIds = useMemo(() => {
        const ids = new Set();
        for (const kb of kbs) if (kb.category_id) ids.add(kb.category_id);
        return ids;
    }, [kbs]);

    const CATEGORIES = useMemo(() => {
        const before = STATIC_CATEGORIES_BEFORE_KEYS.map(c => ({ key: c.key, label: t(c.tKey) || c.key }));
        const after = STATIC_CATEGORIES_AFTER_KEYS.map(c => ({ key: c.key, label: t(c.tKey) || c.key }));
        const dynamicCats = categories
            .filter(c => usedCategoryIds.has(c.id))
            .map(c => ({ key: `cat_${c.id}`, label: `${c.icon || ''} ${c.name}`.trim() }));
        return [...before, ...dynamicCats, ...after];
    }, [categories, usedCategoryIds, t]);

    const TYPE_MAP = useMemo(() => {
        const map = {};
        categories.forEach(c => { map[`cat_${c.id}`] = c.name; });
        return map;
    }, [categories]);

    // If the active category chip disappears (its category no longer has any KBs),
    // fall back to 'all' so the user isn't stuck on an empty filter.
    useEffect(() => {
        if (!CATEGORIES.find(c => c.key === activeCategory)) {
            setActiveCategory('all');
        }
    }, [CATEGORIES, activeCategory]);

    const handleSelect = useCallback((kb) => {
        const r = scopedStorage.getJSON('kb_marketplace_recents', []);
        const updated = [kb.id, ...r.filter(id => id !== kb.id)].slice(0, 8);
        scopedStorage.setJSON('kb_marketplace_recents', updated);
        setRecents(updated);
        onSelectKB?.(kb);
    }, [onSelectKB]);

    const toggleSource = useCallback((key) => {
        setActiveSources(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
    }, []);

    const filtered = useMemo(() => {
        let list = [...kbs];
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(kb => kb.name.toLowerCase().includes(q) || (kb.description || '').toLowerCase().includes(q));
        }
        if (activeCategory === 'mine') list = list.filter(kb => user && kb.tenant_id === user.id);
        else if (activeCategory === 'published') list = list.filter(kb => !!kb.is_published);
        else if (activeCategory === 'favorites') list = list.filter(kb => favorites.includes(kb.id));
        else if (activeCategory.startsWith('cat_')) list = list.filter(kb => kb.category_id && `cat_${kb.category_id}` === activeCategory);

        if (activeSources.length > 0) {
            list = list.filter(kb => {
                const dom = dominantSourceType(kb);
                return activeSources.some(sk => SOURCE_CHIPS.find(c => c.key === sk).match.includes(dom));
            });
        }

        list.sort((a, b) => {
            if (sortBy === 'recent') return new Date(b.updated_at || 0) - new Date(a.updated_at || 0);
            if (sortBy === 'most_docs') return (b.document_count || 0) - (a.document_count || 0);
            if (sortBy === 'top') {
                const d = (favorites.includes(a.id) ? 0 : 1) - (favorites.includes(b.id) ? 0 : 1);
                return d !== 0 ? d : a.name.localeCompare(b.name);
            }
            return a.name.localeCompare(b.name);
        });
        return list;
    }, [kbs, search, activeCategory, favorites, sortBy, activeSources, user]);

    const hasActiveFilters = activeCategory !== 'all' || activeSources.length > 0;
    const isSearching = search.trim().length > 0;

    const cardData = useMemo(() => filtered.map(kb => {
        const isOwner = user && (kb.tenant_id === user.id || user.isAdmin || (user.permissions || []).includes('all'));
        return {
            id: kb.id,
            name: kb.name,
            icon: kb.icon,
            description: kb.description,
            categoryLabel: kb.category_id ? (TYPE_MAP[`cat_${kb.category_id}`] || t('kb_store.badge_kb') || 'Knowledge Base') : (t('kb_store.badge_kb') || 'Knowledge Base'),
            isPublished: !!kb.is_published,
            isFavorite: favorites.includes(kb.id),
            isOwner,
            docCount: kb.document_count || 0,
            chunkCount: kb.total_chunks || 0,
            kb,
        };
    }), [filtered, favorites, TYPE_MAP, user, t]);

    const canManageKBs = user && (
        user.isAdmin ||
        (user.permissions || []).includes('all') ||
        (user.permissions || []).includes('manage_knowledge') ||
        user.orgRole === 'admin' ||
        user.orgRole === 'org_admin'
    );

    return (
        <div className="flex-1 flex flex-col overflow-hidden w-full h-full" style={{ background: 'var(--bg-secondary)' }} data-testid="kb-marketplace">
            <div className="px-6 pt-5 pb-4 border-b" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)' }}>
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{t('kb_store.title') || 'Knowledge Bases'}</h1>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            {t('kb_store.count', { visible: filtered.length, total: kbs.length }) || `${filtered.length} of ${kbs.length} knowledge bases`}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {canManageKBs && onEditKB && (
                            <button
                                onClick={() => onEditKB()}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all hover:bg-[var(--bg-tertiary)]"
                                style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
                                data-testid="kb-marketplace-create"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                {t('kb_store.kb_editor') || 'New Knowledge Base'}
                            </button>
                        )}
                        {onClose && (
                            <button onClick={onClose} className="p-2 rounded-lg transition-colors" style={{ color: 'var(--text-muted)' }}>
                                <X className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                </div>

                <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                    <input
                        type="text"
                        placeholder={t('kb_store.search_placeholder') || 'Search knowledge bases...'}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 rounded-lg border text-sm focus:outline-none transition-all"
                        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                        data-testid="kb-marketplace-search"
                    />
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto py-1" style={{ scrollbarWidth: 'none' }}>
                    {CATEGORIES.map(cat => {
                        const active = activeCategory === cat.key;
                        return (
                            <button
                                key={cat.key}
                                onClick={() => { setActiveCategory(cat.key); setActiveSources([]); }}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 border"
                                style={{
                                    background: active ? 'var(--text-primary)' : 'transparent',
                                    color: active ? 'var(--bg-primary)' : 'var(--text-secondary)',
                                    borderColor: active ? 'var(--text-primary)' : 'var(--border-subtle)',
                                }}
                                data-testid={`kb-marketplace-category-${cat.key}`}
                            >{cat.label}</button>
                        );
                    })}
                </div>

                <button
                    onClick={() => setShowFilters(!showFilters)}
                    className="flex items-center gap-1 text-[11px] font-medium mt-2 px-1 rounded transition-colors"
                    style={{ color: hasActiveFilters ? 'var(--accent-primary)' : 'var(--text-muted)' }}
                >
                    {showFilters ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    {t('kb_store.advanced') || 'Advanced'}
                </button>

                {showFilters && (
                    <div className="mt-2 space-y-2 pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                        <div className="flex flex-wrap gap-1.5">
                            <span className="text-[10px] font-medium self-center mr-1" style={{ color: 'var(--text-muted)' }}>Sources:</span>
                            {SOURCE_CHIPS.map(s => {
                                const active = activeSources.includes(s.key);
                                return (
                                    <button
                                        key={s.key}
                                        onClick={() => toggleSource(s.key)}
                                        className="px-2.5 py-1 rounded-md text-xs font-medium transition-all border"
                                        style={{
                                            background: active ? 'var(--text-primary)' : 'transparent',
                                            color: active ? 'var(--bg-primary)' : 'var(--text-secondary)',
                                            borderColor: active ? 'var(--text-primary)' : 'var(--border-subtle)',
                                        }}
                                    >{s.label}</button>
                                );
                            })}
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>Sort:</span>
                            <select
                                value={sortBy}
                                onChange={e => setSortBy(e.target.value)}
                                className="text-xs py-1 px-2 rounded-md border focus:outline-none cursor-pointer"
                                style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', borderColor: 'var(--border-subtle)' }}
                            >
                                {SORT_OPTIONS.map(opt => <option key={opt.key} value={opt.key}>{opt.label}</option>)}
                            </select>
                            {hasActiveFilters && (
                                <button
                                    onClick={() => { setActiveCategory('all'); setActiveSources([]); setSortBy('top'); }}
                                    className="text-xs ml-auto hover:underline"
                                    style={{ color: 'var(--text-muted)' }}
                                >Reset</button>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-auto">
                <div className="px-6 py-5 space-y-5">
                    <div>
                        <h2 className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
                            {isSearching ? (t('kb_store.results') || 'Results') : (CATEGORIES.find(c => c.key === activeCategory)?.label || (t('kb_store.title') || 'Knowledge Bases'))}
                            <span className="font-normal ml-1 normal-case tracking-normal">({filtered.length})</span>
                        </h2>

                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                            {cardData.map(d => (
                                <KBCard
                                    key={d.id}
                                    kbId={d.id}
                                    name={d.name}
                                    icon={d.icon}
                                    description={d.description}
                                    categoryLabel={d.categoryLabel}
                                    isPublished={d.isPublished}
                                    isFavorite={d.isFavorite}
                                    isOwner={d.isOwner}
                                    docCount={d.docCount}
                                    chunkCount={d.chunkCount}
                                    onSelect={() => handleSelect(d.kb)}
                                    onToggleFavorite={onToggleFavorite}
                                    onUnpublish={onUnpublishKB}
                                    onEdit={d.isOwner && onEditKB ? () => onEditKB(d.kb) : undefined}
                                />
                            ))}
                        </div>

                        {filtered.length === 0 && (
                            <div className="py-16 flex flex-col items-center justify-center">
                                <div className="text-3xl mb-3">📚</div>
                                <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                                    {t('kb_store.no_kbs') || 'No knowledge bases yet'}
                                </h3>
                                <p className="text-xs text-center max-w-xs" style={{ color: 'var(--text-muted)' }}>
                                    {t('kb_store.no_kbs_hint') || 'Create your first KB and add documents to ground your agents.'}
                                </p>
                                {canManageKBs && onEditKB && (
                                    <button
                                        onClick={() => onEditKB()}
                                        className="mt-4 px-4 py-1.5 rounded-lg text-white text-xs font-semibold hover:opacity-90"
                                        style={{ background: 'var(--accent-primary)' }}
                                    >
                                        {t('kb_store.kb_editor') || 'New Knowledge Base'}
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default KBMarketplace;
