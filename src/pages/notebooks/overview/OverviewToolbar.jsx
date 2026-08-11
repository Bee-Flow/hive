import { ArrowUpDown, Check, Search, X } from 'lucide-react';
import React, { useRef, useState } from 'react';
import AnchoredMenu from '../../../components/shared/AnchoredMenu';
import Button from '../../../components/shared/Button';
import useTranslation from '../../../hooks/useTranslation';

/**
 * OverviewToolbar — search + sort + filter controls for the notebooks grid.
 * Fully controlled by useNotebookList (the page owns the hook so the state
 * survives while the editor branch is mounted).
 */

const SORTS = ['activity', 'name', 'created', 'words'];
const FILTERS = ['all', 'pinned', 'sources', 'chat', 'empty', 'processing'];

export default function OverviewToolbar({ search, setSearch, sort, setSort, filter, setFilter }) {
    const { t } = useTranslation();
    const [sortOpen, setSortOpen] = useState(false);
    const sortBtnRef = useRef(null);

    const sortLabels = {
        activity: t('notebooks.sort_activity', 'Recent activity'),
        name: t('notebooks.sort_name', 'Name'),
        created: t('notebooks.sort_created', 'Created'),
        words: t('notebooks.sort_words', 'Word count'),
    };
    const filterLabels = {
        all: t('notebooks.filter_all', 'All'),
        pinned: t('notebooks.filter_pinned', 'Pinned'),
        sources: t('notebooks.filter_sources', 'Has sources'),
        chat: t('notebooks.filter_chat', 'Has chat'),
        empty: t('notebooks.filter_empty', 'Empty'),
        processing: t('notebooks.filter_processing', 'Processing'),
    };

    return (
        <div className="shrink-0 px-6 py-3 flex flex-col gap-2.5">
            <div className="flex items-center gap-2">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={t('notebooks.search_placeholder', 'Search…')}
                        aria-label={t('notebooks.search_placeholder', 'Search…')}
                        className="w-full pl-8 pr-8 py-1.5 text-sm rounded-lg border focus:outline-none focus:ring-1"
                        style={{
                            borderColor: 'var(--border-default)',
                            background: 'var(--bg-secondary)',
                            color: 'var(--text-primary)',
                            '--tw-ring-color': 'var(--accent-primary)',
                        }}
                    />
                    {search && (
                        <button
                            type="button"
                            onClick={() => setSearch('')}
                            aria-label={t('common.clear', 'Clear')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-[var(--bg-tertiary)]"
                            style={{ color: 'var(--text-muted)' }}
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>

                <span ref={sortBtnRef}>
                    <Button
                        variant="ghost"
                        size="sm"
                        icon={ArrowUpDown}
                        onClick={() => setSortOpen((v) => !v)}
                        aria-haspopup="menu"
                        aria-expanded={sortOpen}
                    >
                        {sortLabels[sort] || sortLabels.activity}
                    </Button>
                </span>
                <AnchoredMenu
                    open={sortOpen}
                    onClose={() => setSortOpen(false)}
                    anchorRef={sortBtnRef}
                    align="right"
                    minWidth={170}
                    role="menu"
                    className="py-1"
                >
                    {SORTS.map((s) => (
                        <button
                            key={s}
                            type="button"
                            role="menuitemradio"
                            aria-checked={sort === s}
                            onClick={() => { setSort(s); setSortOpen(false); }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-white/5 transition-colors"
                            style={{ color: 'var(--text-primary)' }}
                        >
                            <Check className={`w-3.5 h-3.5 shrink-0 ${sort === s ? '' : 'invisible'}`} style={{ color: 'var(--accent-primary)' }} />
                            {sortLabels[s]}
                        </button>
                    ))}
                </AnchoredMenu>
            </div>

            {/* Filter pills — a wrapping row, not a SegmentedControl, so narrow
                viewports keep every filter reachable. */}
            <div className="flex items-center gap-1.5 flex-wrap">
                {FILTERS.map((f) => {
                    const active = filter === f;
                    return (
                        <button
                            key={f}
                            type="button"
                            onClick={() => setFilter(f)}
                            aria-pressed={active}
                            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${active ? '' : 'hover:bg-[var(--bg-tertiary)]'}`}
                            style={active
                                ? { background: 'var(--accent-primary)', borderColor: 'var(--accent-primary)', color: 'white' }
                                : { background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
                        >
                            {filterLabels[f]}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
