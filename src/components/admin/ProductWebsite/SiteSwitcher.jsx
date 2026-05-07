import React, { useEffect, useRef, useState } from 'react';
import AppIcon from '../../AppIcon';

/**
 * Site/project switcher — sits at the top of the website-builder panel.
 *
 * Closed: a button showing the active site's name + chevron.
 * Open:   a popover listing every site, each with a hover row-menu
 *         (Rename / Delete) plus a "+ New site" footer.
 *
 * All API calls are owned by the parent (ProductWebsitePanel). This
 * component just renders + dispatches handler props.
 */
export default function SiteSwitcher({
    sites,
    activeSiteId,
    liveSiteId,
    onSelect,
    onCreate,
    onRename,
    onDelete,
}) {
    const [open, setOpen] = useState(false);
    const [creating, setCreating] = useState(false);
    const [renamingId, setRenamingId] = useState(null);
    const rootRef = useRef(null);

    const activeSite = sites.find(s => s.id === activeSiteId);

    // Click-outside to close.
    useEffect(() => {
        if (!open) return;
        const onDoc = (e) => {
            if (rootRef.current && !rootRef.current.contains(e.target)) {
                setOpen(false);
                setCreating(false);
                setRenamingId(null);
            }
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [open]);

    const handlePick = (siteId) => {
        if (siteId !== activeSiteId) onSelect(siteId);
        setOpen(false);
    };

    const handleCreateConfirm = async (name) => {
        const created = await onCreate(name);
        setCreating(false);
        if (created?.id) {
            setOpen(false);
        }
    };

    const handleRenameConfirm = async (siteId, name) => {
        await onRename(siteId, name);
        setRenamingId(null);
    };

    const handleDelete = async (site) => {
        const ok = window.confirm(
            `Delete site "${site.name}"? This permanently removes all of its pages, blocks, and content.`
        );
        if (!ok) return;
        await onDelete(site.id);
    };

    return (
        <div ref={rootRef} className="relative">
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md border border-[var(--border-default)] bg-[var(--bg-tertiary)] text-sm text-[var(--text-primary)] hover:border-[var(--accent-primary)]/60 transition-colors"
                title="Switch site"
            >
                <span className="flex items-center gap-2 min-w-0">
                    <AppIcon name="Globe" className="w-3.5 h-3.5 shrink-0 text-[var(--text-muted)]" />
                    <span className="truncate font-medium">
                        {activeSite ? activeSite.name : 'Select a site'}
                    </span>
                    {activeSite && activeSite.id === liveSiteId && (
                        <span
                            className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"
                            title="This site is live"
                        />
                    )}
                </span>
                <AppIcon name={open ? 'ChevronUp' : 'ChevronDown'} className="w-3.5 h-3.5 shrink-0 text-[var(--text-muted)]" />
            </button>

            {open && (
                <div
                    className="absolute z-30 mt-1 left-0 right-0 rounded-md border border-[var(--border-default)] bg-[var(--bg-secondary)] shadow-lg overflow-hidden"
                    style={{ minWidth: 220 }}
                >
                    {/* Site list */}
                    <ul className="max-h-72 overflow-y-auto py-1">
                        {sites.length === 0 && (
                            <li className="px-3 py-2 text-xs text-[var(--text-muted)] italic">
                                No sites yet
                            </li>
                        )}
                        {sites.map(site => (
                            <SiteRow
                                key={site.id}
                                site={site}
                                isActive={site.id === activeSiteId}
                                isLive={site.id === liveSiteId}
                                isRenaming={renamingId === site.id}
                                onPick={() => handlePick(site.id)}
                                onStartRename={() => setRenamingId(site.id)}
                                onCancelRename={() => setRenamingId(null)}
                                onConfirmRename={(name) => handleRenameConfirm(site.id, name)}
                                onDelete={() => handleDelete(site)}
                            />
                        ))}
                    </ul>

                    {/* Create footer */}
                    <div className="border-t border-[var(--border-subtle)]">
                        {creating ? (
                            <CreateSiteForm
                                onConfirm={handleCreateConfirm}
                                onCancel={() => setCreating(false)}
                            />
                        ) : (
                            <button
                                type="button"
                                onClick={() => setCreating(true)}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--accent-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                            >
                                <AppIcon name="Plus" className="w-3.5 h-3.5" />
                                New site
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Row with hover menu + inline rename ─────────────────────────

function SiteRow({ site, isActive, isLive, isRenaming, onPick, onStartRename, onCancelRename, onConfirmRename, onDelete }) {
    if (isRenaming) {
        return (
            <li>
                <RenameInline
                    initial={site.name}
                    onConfirm={onConfirmRename}
                    onCancel={onCancelRename}
                />
            </li>
        );
    }
    return (
        <li className="group">
            <div
                className={`flex items-center gap-2 px-3 py-2 cursor-pointer text-sm
                    ${isActive
                        ? 'bg-[var(--accent-primary)]/10 text-[var(--text-primary)]'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                    }`}
                onClick={onPick}
            >
                <AppIcon
                    name={isActive ? 'Check' : 'Globe'}
                    className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-[var(--accent-primary)]' : 'text-[var(--text-muted)]'}`}
                />
                <span className="truncate flex-1">{site.name}</span>
                {isLive && (
                    <span
                        className="flex items-center gap-1 shrink-0 px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-[10px] font-medium text-emerald-400"
                        title="Currently live at the public URL"
                    >
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Live
                    </span>
                )}
                <span className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                    <IconBtn name="Pencil" title="Rename" onClick={(e) => { e.stopPropagation(); onStartRename(); }} />
                    <IconBtn name="Trash2" title="Delete" danger onClick={(e) => { e.stopPropagation(); onDelete(); }} />
                </span>
            </div>
        </li>
    );
}

function IconBtn({ name, title, onClick, danger }) {
    return (
        <button
            type="button"
            title={title}
            onClick={onClick}
            className={`p-1 rounded hover:bg-[var(--bg-primary)]
                ${danger ? 'text-[var(--text-muted)] hover:text-red-400' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
        >
            <AppIcon name={name} className="w-3 h-3" />
        </button>
    );
}

// ── Inline rename input ─────────────────────────────────────────

function RenameInline({ initial, onConfirm, onCancel }) {
    const [name, setName] = useState(initial || '');
    const inputRef = useRef(null);

    useEffect(() => { inputRef.current?.focus(); inputRef.current?.select(); }, []);

    const submit = () => {
        const trimmed = name.trim();
        if (!trimmed || trimmed === initial) { onCancel(); return; }
        onConfirm(trimmed);
    };

    return (
        <div className="flex items-center gap-1 px-2 py-1.5 bg-[var(--bg-tertiary)]">
            <input
                ref={inputRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') submit();
                    if (e.key === 'Escape') onCancel();
                }}
                className="flex-1 px-2 py-1 rounded text-xs border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
            />
            <button
                type="button"
                onClick={submit}
                className="text-xs text-[var(--accent-primary)] hover:text-[var(--accent-primary)]/80 px-1"
            >
                Save
            </button>
            <button
                type="button"
                onClick={onCancel}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] px-1"
            >
                Cancel
            </button>
        </div>
    );
}

// ── Create-site inline form ─────────────────────────────────────

function CreateSiteForm({ onConfirm, onCancel }) {
    const [name, setName] = useState('');
    const inputRef = useRef(null);

    useEffect(() => { inputRef.current?.focus(); }, []);

    const submit = () => {
        const trimmed = name.trim();
        if (!trimmed) return;
        onConfirm(trimmed);
    };

    return (
        <div className="px-3 py-2 bg-[var(--bg-tertiary)]">
            <label className="block text-[10px] uppercase tracking-wide text-[var(--text-muted)] mb-1">
                Site name
            </label>
            <input
                ref={inputRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Acme Bakery"
                onKeyDown={(e) => {
                    if (e.key === 'Enter') submit();
                    if (e.key === 'Escape') onCancel();
                }}
                className="w-full px-2 py-1.5 rounded text-xs border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
            />
            <div className="flex justify-end gap-1 mt-2">
                <button
                    type="button"
                    onClick={onCancel}
                    className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] px-2 py-1"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={submit}
                    disabled={!name.trim()}
                    className="text-xs px-2 py-1 rounded bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary)]/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Create
                </button>
            </div>
        </div>
    );
}
