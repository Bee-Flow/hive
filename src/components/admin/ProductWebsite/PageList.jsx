import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
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

function PageRow({ page, isActive, onClick, onSetHomepage, onDuplicate, onRename, onDelete }) {
    const {
        attributes, listeners, setNodeRef, transform, transition, isDragging,
    } = useSortable({ id: page.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    const [menuOpen, setMenuOpen] = useState(false);
    const [renaming, setRenaming] = useState(false);
    const menuBtnRef = useRef(null);

    const handleRenameSubmit = (nextTitle) => {
        const trimmed = nextTitle.trim();
        if (trimmed && trimmed !== page.title) {
            onRename(page.id, trimmed);
        }
        setRenaming(false);
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`group flex items-center gap-1 px-2 py-1.5 rounded-md select-none
                ${renaming ? '' : 'cursor-pointer'}
                ${isActive
                    ? 'bg-[var(--accent-primary)]/10 text-[var(--text-primary)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                }`}
            onClick={() => { if (!renaming) onClick(page.id); }}
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

            {/* page icon + info (or inline rename input) */}
            <span className="flex items-center gap-1.5 flex-1 min-w-0">
                {page.isHomepage
                    ? <AppIcon name="Home" className="w-3.5 h-3.5 shrink-0 text-[var(--accent-primary)]" />
                    : <AppIcon name="FileText" className="w-3.5 h-3.5 shrink-0 text-[var(--text-muted)]" />
                }
                {renaming ? (
                    <RenameInput
                        initial={page.title || ''}
                        onConfirm={handleRenameSubmit}
                        onCancel={() => setRenaming(false)}
                    />
                ) : (
                    <span className="flex flex-col min-w-0">
                        <span className="text-sm truncate leading-tight">{page.title || '(untitled)'}</span>
                        <span className="text-[10px] text-[var(--text-muted)] truncate leading-tight">
                            /{page.slug}
                        </span>
                    </span>
                )}
            </span>

            {/* actions menu */}
            {!renaming && (
                <div className="relative shrink-0" onClick={e => e.stopPropagation()}>
                    <button
                        ref={menuBtnRef}
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
                            anchorEl={menuBtnRef.current}
                            page={page}
                            onClose={() => setMenuOpen(false)}
                            onSetHomepage={() => { onSetHomepage(page.id); setMenuOpen(false); }}
                            onDuplicate={()  => { onDuplicate(page.id);   setMenuOpen(false); }}
                            onRename={()     => { setMenuOpen(false); setRenaming(true); }}
                            onDelete={()     => { onDelete(page.id);      setMenuOpen(false); }}
                        />
                    )}
                </div>
            )}
        </div>
    );
}

// ── Inline rename input (Enter to save, Escape to cancel) ─────────────

function RenameInput({ initial, onConfirm, onCancel }) {
    const [value, setValue] = useState(initial);
    const inputRef = useRef(null);

    useEffect(() => { inputRef.current?.focus(); inputRef.current?.select(); }, []);

    return (
        <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={e => setValue(e.target.value)}
            onClick={e => e.stopPropagation()}
            onMouseDown={e => e.stopPropagation()}
            onBlur={() => onConfirm(value)}
            onKeyDown={(e) => {
                if (e.key === 'Enter')  { e.preventDefault(); onConfirm(value); }
                if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
            }}
            className="flex-1 min-w-0 px-1.5 py-0.5 rounded text-sm border bg-[var(--bg-primary)] border-[var(--accent-primary)] text-[var(--text-primary)] focus:outline-none"
        />
    );
}

// ── Actions menu — rendered in a portal at fixed coords so it escapes
//    the page-list's overflow-y:auto container and doesn't clip. ──────

function PageMenu({ anchorEl, page, onClose, onSetHomepage, onDuplicate, onRename, onDelete }) {
    const [coords, setCoords] = useState(null);

    // Compute menu coordinates from the button's viewport rect. Anchored to
    // the right edge so the menu unfolds left/down. Flip up if there isn't
    // enough room below; clamp to viewport so it can't run off-screen.
    useEffect(() => {
        if (!anchorEl) return;
        const MENU_W = 176;
        const MENU_H_EST = 140;     // approximate, only used to decide flip
        const rect = anchorEl.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const flipUp = spaceBelow < MENU_H_EST + 8;
        const top = flipUp
            ? Math.max(8, rect.top - MENU_H_EST - 4)
            : rect.bottom + 4;
        const left = Math.min(
            Math.max(8, rect.right - MENU_W),
            window.innerWidth - MENU_W - 8,
        );
        setCoords({ top, left });
    }, [anchorEl]);

    // Close on outside click. Use mousedown so the click that opens a menu
    // on a different row doesn't immediately close it. Skip clicks inside
    // the menu itself (the menu stops propagation on mousedown).
    useEffect(() => {
        const handler = () => onClose();
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [onClose]);

    if (!coords) return null;

    return ReactDOM.createPortal(
        <div
            style={{
                position: 'fixed',
                top: coords.top,
                left: coords.left,
                width: 176,
                zIndex: 1000,
            }}
            className="rounded-md shadow-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] py-1 text-sm"
            onMouseDown={e => e.stopPropagation()}
        >
            {!page.isHomepage && (
                <MenuBtn icon="Home" label="Set as homepage" onClick={onSetHomepage} />
            )}
            <MenuBtn icon="Pencil" label="Rename page"    onClick={onRename} />
            <MenuBtn icon="Copy"   label="Duplicate page" onClick={onDuplicate} />
            <div className="my-1 border-t border-[var(--border-subtle)]" />
            <MenuBtn icon="Trash2" label="Delete page" onClick={onDelete} danger />
        </div>,
        document.body,
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

export default function PageList({ pages, activePageId, onSelect, onAdd, onDuplicate, onDelete, onSetHomepage, onRename, onReorder }) {
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
                                onRename={onRename}
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
