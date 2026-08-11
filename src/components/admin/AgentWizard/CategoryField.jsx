import { Plus, X, Settings2, Pencil, Trash2, Check, Loader2 } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import ConfirmDialog from '../../shared/ConfirmDialog';

/**
 * Agent Designer category dropdown + management popover (BFSF-272).
 *
 * Extracted from BuilderSplit (where it was create/select only): the dropdown
 * accumulated duplicates ("Agents for Trainingen" vs "Agents voor Trainingen",
 * two "Sales") with no cleanup path. Adds rename, delete, and a guided
 * in-use flow (unassign the agents, or move them to another category = merge).
 *
 * Contract with the parent (BuilderSplit owns state + bootstrap refresh):
 *   onCreate(name)            → { ok, category?, existed?, error? }
 *   onRename(id, name)        → { ok, category?, error? }
 *   onDelete(id, reassignTo?) → { ok, code?, count?, error? }
 *     reassignTo: undefined (plain delete — 409s when in use),
 *                 'none' (uncategorise agents), '<categoryId>' (merge).
 */
export default function CategoryField({ t, value, categories, onChange, onCreate, onRename, onDelete }) {
    const [creating, setCreating] = useState(false);
    const [draft, setDraft] = useState('');
    const [hint, setHint] = useState(null); // transient inline feedback (replaces alert())
    const [manageOpen, setManageOpen] = useState(false);
    const inputRef = useRef(null);
    const manageRef = useRef(null);
    useEffect(() => { if (creating) inputRef.current?.focus(); }, [creating]);

    // Click-outside closes the manage popover (PublishMenu idiom). The
    // delete ConfirmDialog PORTALS to document.body — technically "outside"
    // the popover — so mousedowns inside any dialog (or its backdrop) must
    // NOT close the popover: closing would unmount the dialog mid-click and
    // make deletion impossible with a mouse.
    useEffect(() => {
        if (!manageOpen) return undefined;
        const onDoc = (e) => {
            if (e.target.closest?.('[role="dialog"], [role="presentation"]')) return;
            if (manageRef.current && !manageRef.current.contains(e.target)) setManageOpen(false);
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [manageOpen]);

    const flashHint = (text) => {
        setHint(text);
        setTimeout(() => setHint(null), 4000);
    };

    const submit = async () => {
        const name = draft.trim();
        if (!name) { setCreating(false); return; }
        const result = await onCreate(name);
        if (result?.ok) {
            setDraft('');
            setCreating(false);
            if (result.existed) {
                flashHint(t('agent_wizard.builder.category_exists_selected', 'Category already exists — selected it.'));
            }
        } else if (result?.error) {
            flashHint(result.error);
        }
    };

    return (
        <div>
            {creating ? (
                <div className="flex gap-1">
                    <input
                        ref={inputRef}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.preventDefault(); submit(); }
                            if (e.key === 'Escape') { setDraft(''); setCreating(false); }
                        }}
                        placeholder={t('agent_wizard.builder.category_new_placeholder', 'New category name')}
                        className="flex-1 min-w-0 bg-[var(--bg-secondary)]/40 border border-[var(--accent)] outline-none rounded-lg px-3 py-2 text-sm text-[var(--text-primary)]"
                    />
                    <button type="button" onClick={submit} className="px-3 py-2 rounded-lg bg-[var(--accent)] text-white text-xs font-medium hover:opacity-90 transition">
                        {t('agent_wizard.builder.category_create', 'Create')}
                    </button>
                    <button type="button" onClick={() => { setDraft(''); setCreating(false); }} className="px-2 py-2 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition">
                        <X size={14} />
                    </button>
                </div>
            ) : (
                <div className="flex gap-1 relative">
                    <select
                        value={value || ''}
                        onChange={(e) => onChange(e.target.value || null)}
                        className="flex-1 min-w-0 bg-[var(--bg-secondary)]/40 border border-transparent hover:bg-[var(--bg-secondary)] focus:border-[var(--accent)] outline-none rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] transition cursor-pointer"
                    >
                        <option value="">{t('agent_wizard.field.category_none')}</option>
                        {categories.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                    <button
                        type="button"
                        onClick={() => setCreating(true)}
                        className="px-2.5 py-2 rounded-lg bg-[var(--bg-secondary)]/40 hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
                        title={t('agent_wizard.builder.category_new', 'New category')}
                    >
                        <Plus size={14} />
                    </button>
                    {categories.length > 0 && (
                        <button
                            type="button"
                            onClick={() => setManageOpen(v => !v)}
                            className={`px-2.5 py-2 rounded-lg transition ${manageOpen
                                ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
                                : 'bg-[var(--bg-secondary)]/40 hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                            title={t('agent_wizard.builder.category_manage', 'Manage categories')}
                            aria-label={t('agent_wizard.builder.category_manage', 'Manage categories')}
                        >
                            <Settings2 size={14} />
                        </button>
                    )}
                    {manageOpen && (
                        <div
                            ref={manageRef}
                            className="absolute right-0 top-full mt-1 z-30 w-80 max-h-80 overflow-y-auto rounded-xl border border-[var(--border-default)] bg-[var(--bg-card,#fff)] shadow-xl p-2"
                        >
                            <div className="px-2 py-1.5 text-xs font-semibold text-[var(--text-secondary)]">
                                {t('agent_wizard.builder.category_manage', 'Manage categories')}
                            </div>
                            {categories.map(c => (
                                <ManageRow
                                    key={c.id}
                                    t={t}
                                    category={c}
                                    others={categories.filter(o => o.id !== c.id)}
                                    onRename={onRename}
                                    onDelete={onDelete}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}
            {hint && <div className="mt-1 text-xs text-[var(--text-tertiary)]">{hint}</div>}
        </div>
    );
}

function ManageRow({ t, category, others, onRename, onDelete }) {
    const [editing, setEditing] = useState(false);
    const [name, setName] = useState(category.name);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    // Guided delete flow: null → not deleting; 'confirm' → simple confirm;
    // { count } → in use, pick unassign vs merge target.
    const [deleting, setDeleting] = useState(null);
    const [mergeTarget, setMergeTarget] = useState('none');
    const editRef = useRef(null);
    useEffect(() => { if (editing) editRef.current?.focus(); }, [editing]);

    const saveRename = async () => {
        const trimmed = name.trim();
        if (!trimmed || trimmed === category.name) { setEditing(false); setName(category.name); return; }
        setBusy(true); setError(null);
        const result = await onRename(category.id, trimmed);
        setBusy(false);
        if (result?.ok) setEditing(false);
        else { setError(result?.error || 'Rename failed'); }
    };

    const requestDelete = async () => {
        setBusy(true); setError(null);
        // First a plain delete: empty categories go instantly; in-use ones
        // 409 with the count → guided step instead of a dead-end error.
        const result = await onDelete(category.id);
        setBusy(false);
        if (result?.ok) { setDeleting(null); return; }
        if (result?.code === 'category_in_use') { setDeleting({ count: result.count }); return; }
        setError(result?.error || 'Delete failed');
        setDeleting(null);
    };

    const confirmGuidedDelete = async () => {
        setBusy(true); setError(null);
        const result = await onDelete(category.id, mergeTarget);
        setBusy(false);
        if (!result?.ok) setError(result?.error || 'Delete failed');
        setDeleting(null);
    };

    return (
        <div className="px-2 py-1.5 rounded-lg hover:bg-[var(--bg-secondary)]/60 group">
            <div className="flex items-center gap-2">
                {editing ? (
                    <>
                        <input
                            ref={editRef}
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') { e.preventDefault(); saveRename(); }
                                if (e.key === 'Escape') { setEditing(false); setName(category.name); setError(null); }
                            }}
                            className="flex-1 min-w-0 bg-[var(--bg-secondary)]/60 border border-[var(--accent)] outline-none rounded px-2 py-1 text-sm text-[var(--text-primary)]"
                        />
                        <button type="button" onClick={saveRename} disabled={busy || !name.trim()} className="p-1 text-[var(--accent)] disabled:opacity-40" aria-label={t('agent_wizard.builder.category_rename', 'Rename')}>
                            {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                        </button>
                    </>
                ) : (
                    <>
                        <span className="flex-1 min-w-0 truncate text-sm text-[var(--text-primary)]">{category.name}</span>
                        <button
                            type="button"
                            onClick={() => setEditing(true)}
                            className="p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] opacity-0 group-hover:opacity-100 transition"
                            title={t('agent_wizard.builder.category_rename', 'Rename')}
                        >
                            <Pencil size={13} />
                        </button>
                        <button
                            type="button"
                            onClick={() => setDeleting('confirm')}
                            className="p-1 text-[var(--text-tertiary)] hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                            title={t('agent_studio.delete', 'Delete')}
                        >
                            <Trash2 size={13} />
                        </button>
                    </>
                )}
            </div>
            {error && <div className="mt-1 text-xs text-red-500">{error}</div>}

            {/* Simple confirm (not yet known to be in use) */}
            <ConfirmDialog
                open={deleting === 'confirm'}
                title={t('agent_wizard.builder.category_delete_confirm_title', 'Delete category?')}
                description={t('agent_wizard.builder.category_delete_confirm_body', 'Delete "{name}"? Agents keep working; the category disappears from the dropdown.', { name: category.name })}
                confirmLabel={t('agent_studio.delete', 'Delete')}
                cancelLabel={t('agent_studio.cancel', 'Cancel')}
                destructive
                onConfirm={requestDelete}
                onCancel={() => setDeleting(null)}
            />

            {/* Guided in-use flow: unassign or merge */}
            {deleting && typeof deleting === 'object' && (
                <div className="mt-2 p-2 rounded-lg border border-amber-500/30 bg-amber-500/5 space-y-2">
                    <div className="text-xs text-[var(--text-secondary)]">
                        {t('agent_wizard.builder.category_in_use', 'In use by {n} agent(s). What should happen to them?', { n: deleting.count })}
                    </div>
                    <label className="flex items-center gap-2 text-xs text-[var(--text-primary)] cursor-pointer">
                        <input type="radio" checked={mergeTarget === 'none'} onChange={() => setMergeTarget('none')} />
                        {t('agent_wizard.builder.category_delete_unassign', 'Remove the category from these agents')}
                    </label>
                    {others.length > 0 && (
                        <label className="flex items-center gap-2 text-xs text-[var(--text-primary)] cursor-pointer">
                            <input type="radio" checked={mergeTarget !== 'none'} onChange={() => setMergeTarget(others[0].id)} />
                            <span>{t('agent_wizard.builder.category_delete_move_to', 'Move them to')}</span>
                            <select
                                value={mergeTarget === 'none' ? '' : mergeTarget}
                                onChange={(e) => setMergeTarget(e.target.value || 'none')}
                                onClick={() => { if (mergeTarget === 'none') setMergeTarget(others[0].id); }}
                                className="flex-1 min-w-0 bg-[var(--bg-secondary)]/60 border border-[var(--border-default)] rounded px-1.5 py-1 text-xs"
                            >
                                {mergeTarget === 'none' && <option value="">…</option>}
                                {others.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                            </select>
                        </label>
                    )}
                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setDeleting(null)} className="px-2.5 py-1 rounded text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]">
                            {t('agent_studio.cancel', 'Cancel')}
                        </button>
                        <button type="button" onClick={confirmGuidedDelete} disabled={busy} className="px-2.5 py-1 rounded text-xs font-medium text-white bg-red-600 hover:bg-red-500 disabled:opacity-50 inline-flex items-center gap-1">
                            {busy && <Loader2 size={11} className="animate-spin" />}
                            {t('agent_studio.delete', 'Delete')}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
