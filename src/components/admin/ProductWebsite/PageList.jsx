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

function PageRow({ page, isActive, onClick, onSetHomepage, onDuplicate, onRename, onEditSlug, onDelete, onSaveAsTemplate, onExport, onImport }) {
    const {
        attributes, listeners, setNodeRef, transform, transition, isDragging,
    } = useSortable({ id: page.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    const [menuOpen, setMenuOpen]       = useState(false);
    const [renaming, setRenaming]       = useState(false);
    const [editingSlug, setEditingSlug] = useState(false);
    const menuBtnRef = useRef(null);

    // Row is in some inline-edit mode whenever either field is open.
    // While editing we suppress the row's click-to-select and hide the
    // actions button so it can't be triggered mid-edit.
    const isEditing = renaming || editingSlug;

    const handleRenameSubmit = (nextTitle) => {
        const trimmed = nextTitle.trim();
        if (trimmed && trimmed !== page.title) {
            onRename(page.id, trimmed);
        }
        setRenaming(false);
    };

    const handleSlugSubmit = (nextSlug) => {
        const cleaned = (nextSlug || '').trim();
        // Empty slug is invalid — cancel rather than wipe.
        if (!cleaned) { setEditingSlug(false); return; }
        if (cleaned === page.slug) { setEditingSlug(false); return; }
        if (typeof onEditSlug === 'function') onEditSlug(page.id, cleaned);
        setEditingSlug(false);
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`group flex items-center gap-1 px-2 py-1 rounded-md select-none
                ${isEditing ? '' : 'cursor-pointer'}
                ${isActive
                    ? 'bg-[var(--accent-primary)]/10 text-[var(--text-primary)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                }`}
            onClick={() => { if (!isEditing) onClick(page.id); }}
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

            {/* page icon + info (or inline rename / slug input) */}
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
                ) : editingSlug ? (
                    // Keep the title visible above the slug input so the
                    // user has context for which page they're editing.
                    <span className="flex flex-col min-w-0 w-full">
                        <span className="text-sm truncate leading-tight">{page.title || '(untitled)'}</span>
                        <SlugInput
                            initial={page.slug || ''}
                            isHomepage={!!page.isHomepage}
                            onConfirm={handleSlugSubmit}
                            onCancel={() => setEditingSlug(false)}
                        />
                    </span>
                ) : (
                    <span className="flex flex-col min-w-0">
                        <span
                            className="text-sm truncate leading-tight"
                            title={page.title || '(untitled)'}
                        >
                            {page.title || '(untitled)'}
                        </span>
                        <span
                            className="text-[10px] text-[var(--text-muted)] truncate leading-tight"
                            title={`/${page.slug}`}
                        >
                            /{page.slug}
                        </span>
                    </span>
                )}
            </span>

            {/* actions menu */}
            {!isEditing && (
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
                            onSetHomepage={()    => { onSetHomepage(page.id); setMenuOpen(false); }}
                            onDuplicate={()      => { onDuplicate(page.id);   setMenuOpen(false); }}
                            onRename={()         => { setMenuOpen(false); setRenaming(true); }}
                            onEditSlug={()       => { setMenuOpen(false); setEditingSlug(true); }}
                            onDelete={()         => { onDelete(page.id);      setMenuOpen(false); }}
                            onSaveAsTemplate={() => { onSaveAsTemplate?.(page); setMenuOpen(false); }}
                            onExport={onExport       ? () => { onExport(page.id); setMenuOpen(false); }   : undefined}
                            onImport={onImport       ? () => { setMenuOpen(false); onImport(); }          : undefined}
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

// ── Inline slug input ─────────────────────────────────────────────────
//
// Mirrors RenameInput but with slug-shaped sanitisation: lowercase,
// spaces → hyphens, anything outside [a-z0-9_-] dropped. Same Enter / Esc
// / blur-to-confirm pattern. Server-side `cmsStore.updatePageMeta` also
// re-normalises and resolves slug collisions, so this client-side filter
// is purely for the typing UX.
function normalizeSlugForInput(raw) {
    return String(raw || '')
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9_-]/g, '');
}

function SlugInput({ initial, isHomepage, onConfirm, onCancel }) {
    const [value, setValue] = useState(initial);
    const inputRef = useRef(null);

    useEffect(() => { inputRef.current?.focus(); inputRef.current?.select(); }, []);

    return (
        <span className="flex flex-col w-full gap-0.5">
            <span className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
                <span className="font-mono">/</span>
                <input
                    ref={inputRef}
                    type="text"
                    value={value}
                    onChange={e => setValue(normalizeSlugForInput(e.target.value))}
                    onClick={e => e.stopPropagation()}
                    onMouseDown={e => e.stopPropagation()}
                    onBlur={() => onConfirm(value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter')  { e.preventDefault(); onConfirm(value); }
                        if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
                    }}
                    placeholder="page-slug"
                    spellCheck={false}
                    className="flex-1 min-w-0 px-1.5 py-0.5 rounded text-[10px] font-mono border bg-[var(--bg-primary)] border-[var(--accent-primary)] text-[var(--text-primary)] focus:outline-none"
                />
            </span>
            {isHomepage ? (
                // Spec: "still allow slug editing but warn the user".
                // Inline warning keeps the affordance one-step (no
                // modal); the user can still cancel via Escape.
                <span className="text-[10px] leading-tight text-amber-500/90">
                    ⚠ Homepage slug. Changing it may break external links.
                </span>
            ) : null}
        </span>
    );
}

// ── Actions menu — rendered in a portal at fixed coords so it escapes
//    the page-list's overflow-y:auto container and doesn't clip. ──────

function PageMenu({ anchorEl, page, onClose, onSetHomepage, onDuplicate, onRename, onEditSlug, onDelete, onSaveAsTemplate, onExport, onImport }) {
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
            <MenuBtn icon="Pencil"   label="Rename page"        onClick={onRename} />
            <MenuBtn icon="Link"     label="Edit slug"          onClick={onEditSlug} />
            <MenuBtn icon="Copy"     label="Duplicate page"     onClick={onDuplicate} />
            <MenuBtn icon="Bookmark" label="Save as template…"  onClick={onSaveAsTemplate} />
            {onExport ? (
                <MenuBtn icon="Download" label="Export page" onClick={onExport} />
            ) : null}
            {onImport ? (
                <MenuBtn icon="Upload"   label="Import page…" onClick={onImport} />
            ) : null}
            <div className="my-1 border-t border-[var(--border-subtle)]" />
            <MenuBtn icon="Trash2"   label="Delete page" onClick={onDelete} danger />
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
//
// Lives inline at the top of the pages list (not a portal-modal). When
// templates exist, a "Start from" picker is appended below the slug
// input — picking a template causes the new page to be seeded with a
// deep copy of the template's blocks (fresh ids generated server-side).

function AddPageDialog({ onConfirm, onCancel, templates = [] }) {
    const [title, setTitle]            = useState('');
    const [slug, setSlug]              = useState('');
    const [templateId, setTemplateId]  = useState('');   // '' = blank
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
        <div className="p-4 bg-[var(--bg-secondary)] border-b border-[var(--border-subtle)] max-h-[60vh] overflow-y-auto">
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

            {/* "Start from" — only when there's at least one saved template.
                Hidden completely otherwise so the empty state stays clean. */}
            {templates.length > 0 ? (
                <>
                    <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-2">
                        Start from
                    </p>
                    <div className="flex flex-col gap-1.5 mb-3">
                        <TemplateCard
                            selected={templateId === ''}
                            onClick={() => setTemplateId('')}
                            title="Blank page"
                            subtitle="No blocks — start from scratch"
                        />
                        {templates.map(t => (
                            <TemplateCard
                                key={t.id}
                                selected={templateId === t.id}
                                onClick={() => setTemplateId(t.id)}
                                title={t.name}
                                subtitle={
                                    t.description
                                        ? `${t.description} · ${t.blockCount} block${t.blockCount === 1 ? '' : 's'}`
                                        : `${t.blockCount} block${t.blockCount === 1 ? '' : 's'}`
                                }
                            />
                        ))}
                    </div>
                </>
            ) : null}

            <div className="flex gap-2">
                <button
                    type="button"
                    onClick={() => onConfirm({ title, slug, templateId: templateId || undefined })}
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

function TemplateCard({ selected, onClick, title, subtitle }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={
                'w-full text-left px-3 py-2 rounded-md border transition-colors ' +
                (selected
                    ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10'
                    : 'border-[var(--border-default)] bg-[var(--bg-tertiary)] hover:border-[var(--accent-primary)]/60')
            }
        >
            <div className="flex items-center gap-2">
                <span
                    className={
                        'w-3 h-3 rounded-full shrink-0 border ' +
                        (selected
                            ? 'bg-[var(--accent-primary)] border-[var(--accent-primary)]'
                            : 'border-[var(--border-default)]')
                    }
                    aria-hidden="true"
                />
                <span className="text-sm text-[var(--text-primary)] font-medium truncate">{title}</span>
            </div>
            {subtitle ? (
                <div className="ml-5 mt-0.5 text-[11px] text-[var(--text-muted)] truncate">{subtitle}</div>
            ) : null}
        </button>
    );
}

// ── Modal overlay primitive ──────────────────────────────────────────
//
// Portals to <body>, dims the rest of the UI, and centers a card that
// scrolls internally on small screens. Used by SaveTemplateDialog and
// TemplatesManagerDialog. Esc + backdrop click close.

function ModalOverlay({ children, onClose, labelledBy }) {
    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);
    return ReactDOM.createPortal(
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            className="fixed inset-0 z-[1100] flex items-start sm:items-center justify-center p-4 overflow-y-auto"
            onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
            style={{ background: 'rgba(0,0,0,0.55)' }}
        >
            <div
                className="w-full max-w-md rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] shadow-xl my-8 max-h-[calc(100vh-4rem)] overflow-y-auto"
                onMouseDown={(e) => e.stopPropagation()}
            >
                {children}
            </div>
        </div>,
        document.body,
    );
}

// ── Save-as-template dialog ──────────────────────────────────────────

export function SaveTemplateDialog({ page, onConfirm, onCancel }) {
    const [name, setName]               = useState(page?.title || '');
    const [description, setDescription] = useState('');
    const [saving, setSaving]           = useState(false);
    const trimmed = name.trim();
    return (
        <ModalOverlay onClose={onCancel} labelledBy="save-tpl-title">
            <div className="p-5">
                <h3 id="save-tpl-title" className="text-sm font-semibold text-[var(--text-primary)] mb-1">
                    Save as template
                </h3>
                <p className="text-xs text-[var(--text-muted)] mb-4">
                    Save this page's blocks as a reusable template. You can apply it from the New page dialog.
                </p>
                <label className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-semibold">
                    Template name
                </label>
                <input
                    autoFocus
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Solution page"
                    className="w-full mt-1 mb-3 px-3 py-2 rounded-md text-sm border bg-[var(--bg-tertiary)] border-[var(--border-default)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                />
                <label className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-semibold">
                    Description (optional)
                </label>
                <input
                    type="text"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Short one-liner shown when picking a template"
                    className="w-full mt-1 mb-4 px-3 py-2 rounded-md text-sm border bg-[var(--bg-tertiary)] border-[var(--border-default)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                />
                <div className="flex gap-2 justify-end">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={saving}
                        className="px-3 py-1.5 text-sm rounded-md border border-[var(--border-default)] text-[var(--text-secondary)]"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        disabled={!trimmed || saving}
                        onClick={async () => {
                            setSaving(true);
                            try { await onConfirm({ name: trimmed, description: description.trim() }); }
                            finally { setSaving(false); }
                        }}
                        className="px-3 py-1.5 text-sm rounded-md bg-[var(--accent-primary)] text-white disabled:opacity-40"
                    >
                        {saving ? 'Saving…' : 'Save template'}
                    </button>
                </div>
            </div>
        </ModalOverlay>
    );
}

// ── Templates manager dialog ─────────────────────────────────────────

export function TemplatesManagerDialog({ templates, onDelete, onClose }) {
    // Inline confirm — clicking Delete reveals an inline "Confirm?" so
    // there's no second modal stacked on top of this one.
    const [confirmId, setConfirmId] = useState(null);
    return (
        <ModalOverlay onClose={onClose} labelledBy="tpl-mgr-title">
            <div className="p-5">
                <div className="flex items-center justify-between mb-1">
                    <h3 id="tpl-mgr-title" className="text-sm font-semibold text-[var(--text-primary)]">
                        Templates
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded"
                        aria-label="Close"
                    >
                        <AppIcon name="X" className="w-4 h-4" />
                    </button>
                </div>
                <p className="text-xs text-[var(--text-muted)] mb-4">
                    Saved page templates. Apply one when creating a new page.
                </p>
                {templates.length === 0 ? (
                    <p className="text-sm text-[var(--text-muted)] text-center py-6">
                        No templates saved yet. Use a page's menu → "Save as template…" to create one.
                    </p>
                ) : (
                    <ul className="flex flex-col divide-y divide-[var(--border-subtle)]">
                        {templates.map(t => (
                            <li key={t.id} className="py-2.5 flex items-start gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm text-[var(--text-primary)] font-medium truncate">{t.name}</div>
                                    {t.description ? (
                                        <div className="text-[11px] text-[var(--text-muted)] truncate">{t.description}</div>
                                    ) : null}
                                    <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
                                        {t.blockCount} block{t.blockCount === 1 ? '' : 's'}
                                        {t.createdAt ? ` · ${formatTemplateDate(t.createdAt)}` : ''}
                                    </div>
                                </div>
                                {confirmId === t.id ? (
                                    <div className="flex items-center gap-1 shrink-0">
                                        <button
                                            type="button"
                                            onClick={async () => { await onDelete(t.id); setConfirmId(null); }}
                                            className="px-2 py-1 text-[11px] rounded bg-red-500/90 text-white"
                                        >
                                            Delete
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setConfirmId(null)}
                                            className="px-2 py-1 text-[11px] rounded border border-[var(--border-default)] text-[var(--text-secondary)]"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => setConfirmId(t.id)}
                                        className="shrink-0 text-[var(--text-muted)] hover:text-red-400 p-1.5 rounded hover:bg-[var(--bg-tertiary)]"
                                        title="Delete template"
                                        aria-label={`Delete template "${t.name}"`}
                                    >
                                        <AppIcon name="Trash2" className="w-4 h-4" />
                                    </button>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </ModalOverlay>
    );
}

function formatTemplateDate(iso) {
    try {
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return '';
        return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch { return ''; }
}

// ── PageList ─────────────────────────────────────────────────────────

export default function PageList({
    pages,
    activePageId,
    onSelect,
    onAdd,
    onDuplicate,
    onDelete,
    onSetHomepage,
    onRename,
    onEditSlug,
    onReorder,
    // Templates plumbing — all optional so callers that haven't wired up
    // templates yet keep working with the old surface.
    templates = [],
    onSaveAsTemplate,
    onDeleteTemplate,
    // Per-page export / import. Both optional so a caller that hasn't
    // wired them up just renders without the affordance. The same hidden
    // input is shared by the header button and the per-row menu item
    // (both flows create a NEW page from the chosen file).
    onExportPage,
    onImportPage,
}) {
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
    const [adding, setAdding]             = useState(false);
    const [managerOpen, setManagerOpen]   = useState(false);
    const importInputRef                  = useRef(null);

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
                <div className="flex items-center gap-1">
                    {/* Templates manager — opens a modal listing every saved
                        template with a per-row delete. Always visible so users
                        can land on the empty state and discover the feature. */}
                    <button
                        type="button"
                        onClick={() => setManagerOpen(true)}
                        className="text-[10px] uppercase tracking-wider px-1.5 py-1 rounded text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] font-semibold"
                        title="Manage templates"
                    >
                        Templates{templates.length > 0 ? ` (${templates.length})` : ''}
                    </button>
                    {onImportPage ? (
                        <button
                            type="button"
                            onClick={() => importInputRef.current?.click()}
                            className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                            title="Import page from JSON file"
                        >
                            <AppIcon name="Upload" className="w-4 h-4" />
                        </button>
                    ) : null}
                    <button
                        type="button"
                        onClick={() => setAdding(v => !v)}
                        className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                        title="Add page"
                    >
                        <AppIcon name="Plus" className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Shared hidden input — both the header Import button and the
                per-row "Import page…" menu item click this. Resetting value
                on every change so the same file can be re-picked. */}
            {onImportPage ? (
                <input
                    ref={importInputRef}
                    type="file"
                    accept="application/json,.json"
                    className="hidden"
                    onChange={async (e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (!file) return;
                        try {
                            // Lazy import so the helper module isn't a hard
                            // dependency of PageList — callers without
                            // onImportPage never load it.
                            const { importPage } = await import('./pageIO');
                            const parsed = await importPage(file);
                            onImportPage(parsed);
                        } catch (err) {
                            alert('Import failed: ' + (err?.message || err));
                        }
                    }}
                />
            ) : null}

            {adding && (
                <AddPageDialog
                    templates={templates}
                    onConfirm={(payload) => { onAdd(payload); setAdding(false); }}
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
                                onEditSlug={onEditSlug}
                                onDelete={onDelete}
                                onSaveAsTemplate={onSaveAsTemplate}
                                onExport={onExportPage}
                                onImport={onImportPage ? () => importInputRef.current?.click() : undefined}
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

            {managerOpen ? (
                <TemplatesManagerDialog
                    templates={templates}
                    onDelete={async (id) => { await onDeleteTemplate?.(id); }}
                    onClose={() => setManagerOpen(false)}
                />
            ) : null}
        </div>
    );
}
