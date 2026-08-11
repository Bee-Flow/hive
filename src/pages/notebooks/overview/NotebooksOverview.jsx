import { AlertCircle, ArrowLeft, BookOpen, Plus, Upload } from 'lucide-react';
import React, { useRef, useState } from 'react';
import NewNotebookModal from './NewNotebookModal';
import NotebookCard from './NotebookCard';
import OverviewToolbar from './OverviewToolbar';
import Button from '../../../components/shared/Button';
import ConfirmDialog from '../../../components/shared/ConfirmDialog';
import EmptyState from '../../../components/shared/EmptyState';
import { toast } from '../../../components/shared/Toast';
import useTranslation from '../../../hooks/useTranslation';
import { uploadSourceFile } from '../hooks/notebookApi';

/**
 * NotebooksOverview — the card-grid landing view at /app/notebooks.
 *
 * Layout mirrors AppsHomePage/AppList: header + toolbar + responsive grid with
 * a dashed "New" tile, skeleton while loading, shared EmptyState, retry bar,
 * load-more paging. List state lives in useNotebookList, owned by
 * NotebooksPage so it survives while the editor branch is mounted.
 */

const GRID_CLASSES = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3';
const CARD_STYLE = { borderColor: 'var(--border-subtle)', background: 'var(--bg-card)' };

/** "3 sources" / "1 source" / "no sources" — for the delete confirmation. */
function deleteSourcesPhrase(count, t) {
    if (!count) return t('notebooks.confirm_delete_sources_none', 'no sources');
    if (count === 1) return t('notebooks.confirm_delete_sources_one', '1 source');
    return t('notebooks.confirm_delete_sources_many', { count });
}

function SkeletonGrid() {
    return (
        <div className={GRID_CLASSES} role="status" aria-label="Loading notebooks">
            {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-xl border p-3.5 animate-pulse" style={CARD_STYLE}>
                    <div className="flex items-start gap-2.5 mb-3">
                        <div className="h-9 w-9 rounded-lg" style={{ background: 'var(--bg-secondary)' }} />
                        <div className="flex-1 pt-0.5">
                            <div className="h-3.5 w-2/3 rounded mb-2" style={{ background: 'var(--bg-secondary)' }} />
                            <div className="h-2.5 w-full rounded" style={{ background: 'var(--bg-secondary)' }} />
                        </div>
                    </div>
                    <div className="h-2.5 w-1/3 rounded" style={{ background: 'var(--bg-secondary)' }} />
                </div>
            ))}
            <span className="sr-only">Loading…</span>
        </div>
    );
}

export default function NotebooksOverview({ list, onBack, onOpen, onOpenChat }) {
    const { t } = useTranslation();
    const [showCreate, setShowCreate] = useState(false);
    const [pendingDelete, setPendingDelete] = useState(null);
    const [pageDrag, setPageDrag] = useState(false);
    // dragenter/dragleave fire per child element; the counter turns them into
    // one enter/leave pair for the whole dropzone.
    const dragDepth = useRef(0);
    const dropBusyRef = useRef(false);

    const handleCreate = async (name) => {
        const nb = await list.create(name);
        if (nb) {
            setShowCreate(false);
            onOpen(nb);
        }
    };

    /* ── Page-level drop: file → new notebook named after it ────── */
    const hasFiles = (e) => e.dataTransfer?.types?.includes?.('Files');

    const handlePageDrop = async (file) => {
        if (!file || dropBusyRef.current) return;
        dropBusyRef.current = true;
        try {
            const name = file.name.replace(/\.[^.]+$/, '').trim() || file.name;
            const nb = await list.create(name);
            if (!nb) return;
            try {
                await uploadSourceFile(nb.id, file);
                toast.success(t('notebooks.created_from_file', 'Notebook "{name}" created from your file', { name: nb.name || name }));
            } catch (err) {
                toast.error(err?.message || t('notebooks.upload_failed', 'Upload failed'));
            }
            list.refetch();
        } finally {
            dropBusyRef.current = false;
        }
    };

    /* ── Per-card drop: file(s) → sources on that notebook ──────── */
    const handleCardDrop = async (nb, files) => {
        let ok = 0;
        for (const file of files) {
            try {
                await uploadSourceFile(nb.id, file);
                ok += 1;
            } catch (err) {
                toast.error(err?.message || t('notebooks.upload_failed', 'Upload failed'));
            }
        }
        if (ok === 1) toast.success(t('notebooks.source_added', 'Source added'));
        else if (ok > 1) toast.success(t('notebooks.sources_added', '{count} sources added', { count: ok }));
        list.refetch();
    };

    const onDragEnter = (e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        dragDepth.current += 1;
        setPageDrag(true);
    };
    const onDragOver = (e) => { if (hasFiles(e)) e.preventDefault(); };
    const onDragLeave = () => {
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) setPageDrag(false);
    };
    const onDrop = (e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        dragDepth.current = 0;
        setPageDrag(false);
        handlePageDrop(e.dataTransfer.files?.[0]);
    };

    const isEmpty = !list.loading && !list.error && list.items.length === 0;
    const filtered = !!list.search || list.filter !== 'all';

    return (
        <div className="h-full flex flex-col" style={{ background: 'var(--bg-primary)' }}>
            {/* ── Header ── */}
            <div className="shrink-0 px-6 py-3 border-b flex items-center gap-4" style={{ borderColor: 'var(--border-default)' }}>
                <button
                    onClick={onBack}
                    aria-label={t('notebooks.back', 'Back')}
                    className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
                </button>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <BookOpen className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
                        <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{t('notebooks.title', 'Notebooks')}</h1>
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {t('notebooks.subtitle', 'Upload sources, chat with your documents, and generate content')}
                    </p>
                </div>
                <Button icon={Plus} onClick={() => setShowCreate(true)}>
                    {t('notebooks.new_notebook', 'New notebook')}
                </Button>
            </div>

            {list.error && (
                <div
                    className="shrink-0 px-4 py-2 text-xs flex items-center gap-2"
                    style={{ background: 'rgba(239,68,68,0.1)', color: '#991b1b' }}
                    role="alert"
                >
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {list.error}
                    <button type="button" onClick={list.refetch} className="ml-auto underline font-medium">
                        {t('notebooks.retry', 'Retry')}
                    </button>
                </div>
            )}

            <OverviewToolbar
                search={list.search}
                setSearch={list.setSearch}
                sort={list.sort}
                setSort={list.setSort}
                filter={list.filter}
                setFilter={list.setFilter}
            />

            {/* ── Grid (page-level dropzone) ── */}
            <div
                className="flex-1 overflow-y-auto custom-scrollbar px-6 pb-6 relative"
                onDragEnter={onDragEnter}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
            >
                {pageDrag && (
                    <div
                        className="absolute inset-2 z-20 rounded-xl border-2 border-dashed flex items-center justify-center pointer-events-none"
                        style={{ borderColor: 'var(--accent-primary)' }}
                    >
                        <span
                            className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold shadow-lg"
                            style={{ background: 'var(--bg-secondary)', color: 'var(--accent-primary)' }}
                        >
                            <Upload className="w-4 h-4" />
                            {t('notebooks.drop_to_create', 'Drop a file to create a notebook')}
                        </span>
                    </div>
                )}

                {list.loading && list.items.length === 0 ? (
                    <SkeletonGrid />
                ) : isEmpty ? (
                    filtered ? (
                        <EmptyState
                            icon={<BookOpen className="w-12 h-12" />}
                            title={t('notebooks.no_matches', 'No matches')}
                            description={t('notebooks.no_matches_hint', 'No notebooks match your search or filter. Try different terms, or clear the filter.')}
                        />
                    ) : (
                        <EmptyState
                            icon={<BookOpen className="w-12 h-12" />}
                            title={t('notebooks.create_first', 'Create your first notebook')}
                            description={t('notebooks.empty_hint_first', 'Upload PDFs, documents, and URLs — then chat with your sources and generate summaries, briefings, and more.')}
                            action={{
                                label: t('notebooks.new_notebook', 'New notebook'),
                                onClick: () => setShowCreate(true),
                                icon: <Plus className="w-4 h-4" />,
                            }}
                        />
                    )
                ) : (
                    <>
                        <div className={GRID_CLASSES}>
                            <button
                                type="button"
                                onClick={() => setShowCreate(true)}
                                className="rounded-xl border-2 border-dashed p-3.5 min-h-[8rem] flex flex-col items-center justify-center gap-1.5 transition-colors hover:bg-[var(--bg-secondary)]"
                                style={{ borderColor: 'var(--border-default)', color: 'var(--text-tertiary)' }}
                            >
                                <Plus className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
                                <span className="text-xs font-medium">{t('notebooks.new_notebook', 'New notebook')}</span>
                            </button>
                            {list.items.map((nb) => (
                                <NotebookCard
                                    key={nb.id}
                                    nb={nb}
                                    onOpen={onOpen}
                                    onOpenChat={onOpenChat}
                                    onTogglePin={list.togglePin}
                                    onRename={list.rename}
                                    onDelete={setPendingDelete}
                                    onDropFiles={handleCardDrop}
                                />
                            ))}
                        </div>
                        {list.hasMore && (
                            <div className="flex justify-center mt-4">
                                <Button variant="secondary" onClick={list.loadMore} busy={list.loading}>
                                    {t('notebooks.load_more', 'Load more')}
                                </Button>
                            </div>
                        )}
                    </>
                )}
            </div>

            <NewNotebookModal
                open={showCreate}
                onClose={() => setShowCreate(false)}
                onCreate={handleCreate}
                creating={list.creating}
            />

            {/* ── Delete confirmation ───
                Names what actually goes. The old copy said "and all its sources"
                — the one thing a Chat Notebook usually has none of — while the
                document, the version history and the in-notebook chat all went
                unmentioned (BFSF-309). Sources are notebook-scoped (the
                notebook_sources FK is NOT NULL) so nothing here is shared. */}
            <ConfirmDialog
                open={!!pendingDelete}
                title={t('notebooks.confirm_delete_title', 'Delete notebook?')}
                description={pendingDelete ? t('notebooks.confirm_delete_body', {
                    name: pendingDelete.name,
                    sources: deleteSourcesPhrase(pendingDelete.sourceCount || 0, t),
                }) : ''}
                confirmLabel={t('notebooks.delete', 'Delete')}
                cancelLabel={t('common.cancel', 'Cancel')}
                destructive
                onConfirm={async () => {
                    await list.remove(pendingDelete.id);
                    setPendingDelete(null);
                }}
                onCancel={() => setPendingDelete(null)}
            />
        </div>
    );
}
