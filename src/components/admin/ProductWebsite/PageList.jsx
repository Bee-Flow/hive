import React, { useState } from 'react';
import {
    DndContext,
    closestCenter,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    SortableContext,
    useSortable,
    verticalListSortingStrategy,
    arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import AppIcon from '../../AppIcon';

// ── Single draggable page row ────────────────────────────────────────

function PageRow({ page, isActive, onClick, onSetHomepage, onDuplicate, onDelete }) {
    const {
        attributes, listeners, setNodeRef, transform, transition, isDragging,
    } = useSortable({ id: page.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    const [menuOpen, setMenuOpen] = useState(false);

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`group flex items-center gap-1 px-2 py-1.5 rounded-md cursor-pointer select-none
                ${isActive
                    ? 'bg-[var(--accent-primary)]/10 text-[var(--text-primary)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                }`}
            onClick={() => onClick(page.id)}
        >
            {/* drag handle */}
            <span
                {...attributes}
                {...listeners}
                className="text-[var(--text-muted)] cursor-grab active:cursor-grabbing p-0.5 shrink-0"
                onClick={e => e.stopPropagation()}
                title="Drag to reorder"
            >
                <AppIcon name="GripVertical" className="w-3.5 h-3.5" />
            </span>

            {/* page icon + info */}
            <span className="flex items-center gap-1.5 flex-1 min-w-0">
                {page.isHomepage
                    ? <AppIcon name="Home" className="w-3.5 h-3.5 shrink-0 text-[var(--accent-primary)]" />
                    : <AppIcon name="FileText" className="w-3.5 h-3.5 shrink-0 text-[var(--text-muted)]" />
                }
                <span className="flex flex-col min-w-0">
                    <span className="text-sm truncate leading-tight">{page.title || '(untitled)'}</span>
                    <span className="text-[10px] text-[var(--text-muted)] truncate leading-tight">
                        /{page.slug}
                    </span>
                </span>
            </span>

            {/* actions menu */}
            <div className="relative shrink-0" onClick={e => e.stopPropagation()}>
                <button
                    type="button"
                    className={`w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--bg-tertiary)]
                        text-[var(--text-muted)] hover:text-[var(--text-secondary)]
                        ${menuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                    onClick={() => setMenuOpen(v => !v)}
                    title="Page actions"
                >
                    <AppIcon name="MoreVertical" className="w-3.5 h-3.5" />
                </button>
                {menuOpen && (
                    <PageMenu
                        page={page}
                        onClose={() => setMenuOpen(false)}
                        onSetHomepage={() => { onSetHomepage(page.id); setMenuOpen(false); }}
                        onDuplicate={() => { onDuplicate(page.id); setMenuOpen(false); }}
                        onDelete={() => { onDelete(page.id); setMenuOpen(false); }}
                    />
                )}
            </div>
        </div>
    );
}

function PageMenu({ page, onClose, onSetHomepage, onDuplicate, onDelete }) {
    // Close on outside click
    React.useEffect(() => {
        const handler = () => onClose();
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [onClose]);

    return (
        <div
            className="absolute right-0 top-7 z-50 w-44 rounded-md shadow-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] py-1 text-sm"
            onMouseDown={e => e.stopPropagation()}
        >
            {!page.isHomepage && (
                <MenuBtn icon="Home" label="Set as homepage" onClick={onSetHomepage} />
            )}
            <MenuBtn icon="Copy" label="Duplicate page" onClick={onDuplicate} />
            <div className="my-1 border-t border-[var(--border-subtle)]" />
            <MenuBtn icon="Trash2" label="Delete page" onClick={onDelete} danger />
        </div>
    );
}

function MenuBtn({ icon, label, onClick, danger }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--bg-tertiary)] transition-colors
                ${danger ? 'text-red-400' : 'text-[var(--text-primary)]'}`}
        >
            <AppIcon name={icon} className="w-3.5 h-3.5 shrink-0" />
            {label}
        </button>
    );
}

// ── Add page dialog ──────────────────────────────────────────────────

function AddPageDialog({ onConfirm, onCancel }) {
    const [title, setTitle] = useState('');
    const [slug, setSlug]   = useState('');
    const slugAuto = React.useRef(true);

    const deriveSlug = (t) =>
        t.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9_-]/g, '').slice(0, 64);

    const handleTitleChange = (v) => {
        setTitle(v);
        if (slugAuto.current) setSlug(deriveSlug(v));
    };
    const handleSlugChange = (v) => {
        slugAuto.current = false;
        setSlug(v.toLowerCase().replace(/[^a-z0-9_-]/g, ''));
    };

    return (
        <div className="p-4 bg-[var(--bg-secondary)] border-b border-[var(--border-subtle)]">
            <p className="text-xs font-semibold text-[var(--text-secondary)] mb-3">New page</p>
            <input
                autoFocus
                type="text"
                placeholder="Page title"
                value={title}
                onChange={e => handleTitleChange(e.target.value)}
                className="w-full px-3 py-2 mb-2 rounded-md text-sm border bg-[var(--bg-tertiary)] border-[var(--border-default)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
            />
            <input
                type="text"
                placeholder="slug (auto)"
                value={slug}
                onChange={e => handleSlugChange(e.target.value)}
                className="w-full px-3 py-2 mb-3 rounded-md text-sm border bg-[var(--bg-tertiary)] border-[var(--border-default)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] font-mono"
            />
            <div className="flex gap-2">
                <button
                    type="button"
                    onClick={() => onConfirm({ title, slug })}
                    disabled={!title.trim()}
                    className="flex-1 px-3 py-1.5 text-sm rounded-md bg-[var(--accent-primary)] text-white disabled:opacity-40"
                >
                    Add page
                </button>
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-3 py-1.5 text-sm rounded-md border border-[var(--border-default)] text-[var(--text-secondary)]"
                >
                    Cancel
                </button>
            </div>
        </div>
    );
}

// ── PageList ─────────────────────────────────────────────────────────

export default function PageList({ pages, activePageId, onSelect, onAdd, onDuplicate, onDelete, onSetHomepage, onReorder }) {
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
    const [adding, setAdding] = useState(false);

    const handleDragEnd = (event) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIdx = pages.findIndex(p => p.id === active.id);
            const newIdx = pages.findIndex(p => p.id === over.id);
            onReorder(arrayMove(pages, oldIdx, newIdx).map(p => p.id));
        }
    };

    return (
        <div className="flex flex-col h-full">
            <div className="px-4 py-2 flex items-center justify-between border-b border-[var(--border-subtle)] shrink-0">
                <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold">
                    Pages
                </span>
                <button
                    type="button"
                    onClick={() => setAdding(v => !v)}
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                    title="Add page"
                >
                    <AppIcon name="Plus" className="w-4 h-4" />
                </button>
            </div>

            {adding && (
                <AddPageDialog
                    onConfirm={({ title, slug }) => { onAdd({ title, slug }); setAdding(false); }}
                    onCancel={() => setAdding(false)}
                />
            )}

            <div className="flex-1 overflow-y-auto px-2 py-2">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={pages.map(p => p.id)} strategy={verticalListSortingStrategy}>
                        {pages.map(page => (
                            <PageRow
                                key={page.id}
                                page={page}
                                isActive={page.id === activePageId}
                                onClick={onSelect}
                                onSetHomepage={onSetHomepage}
                                onDuplicate={onDuplicate}
                                onDelete={onDelete}
                            />
                        ))}
                    </SortableContext>
                </DndContext>
                {pages.length === 0 && (
                    <p className="text-xs text-[var(--text-muted)] text-center py-6">
                        No pages yet. Add one above.
                    </p>
                )}
            </div>
        </div>
    );
}
