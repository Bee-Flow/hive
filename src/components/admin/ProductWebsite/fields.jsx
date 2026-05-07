import React, { createContext, useContext, useRef, useState } from 'react';
import { API_BASE, authFetch } from '../../../utils/helpers';
import AppIcon from '../../AppIcon';

/**
 * Optional context for "+ Create new page…" inside any LinkField. The
 * provider value is `async ({title, slug}) => ({id, slug, title})` and is
 * supplied once at the top of the editor by ProductWebsitePanel. When a
 * LinkField finds a value here it appends a sentinel option to the
 * internal-page selector that lets the user spin up a page without
 * leaving whatever they're editing. We use Context (rather than threading
 * the callback through every editor's props) so the existing 12+ editor
 * components don't all need new prop signatures.
 */
export const CreatePageContext = createContext(null);

// Shared input class to match other admin panels.
const inputClass =
    'w-full px-3 py-2 rounded-md text-sm border bg-[var(--bg-tertiary)] ' +
    'border-[var(--border-default)] text-[var(--text-primary)] ' +
    'focus:outline-none focus:border-[var(--accent-primary)] transition-colors';

export function FieldRow({ label, hint, children }) {
    return (
        <div className="flex flex-col gap-1.5 mb-3">
            {label ? (
                <label className="text-xs font-medium text-[var(--text-secondary)]">{label}</label>
            ) : null}
            {children}
            {hint ? <span className="text-xs text-[var(--text-muted)]">{hint}</span> : null}
        </div>
    );
}

export function TextField({ value, onChange, placeholder, label, hint }) {
    return (
        <FieldRow label={label} hint={hint}>
            <input
                type="text"
                className={inputClass}
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
            />
        </FieldRow>
    );
}

export function TextArea({ value, onChange, placeholder, label, hint, rows = 3 }) {
    return (
        <FieldRow label={label} hint={hint}>
            <textarea
                className={inputClass}
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                rows={rows}
            />
        </FieldRow>
    );
}

export function Toggle({ value, onChange, label }) {
    return (
        <label className="flex items-center justify-between gap-3 mb-3 cursor-pointer">
            <span className="text-sm text-[var(--text-primary)]">{label}</span>
            <span
                onClick={() => onChange(!value)}
                className={`relative w-10 h-5 rounded-full transition-colors ${value ? 'bg-[var(--accent-primary)]' : 'bg-[var(--border-default)]'}`}
            >
                <span
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${value ? 'translate-x-[22px]' : 'translate-x-0.5'}`}
                />
            </span>
        </label>
    );
}

export function IconField({ value, onChange, label }) {
    return (
        <FieldRow label={label} hint="Lucide icon name (PascalCase) — e.g. ShieldCheck, Mail, Brain">
            <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-md flex items-center justify-center bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-[var(--accent-primary)]">
                    {value ? <AppIcon name={value} className="w-5 h-5" /> : <span className="text-xs text-[var(--text-muted)]">?</span>}
                </div>
                <input
                    type="text"
                    className={inputClass}
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder="ShieldCheck"
                />
            </div>
        </FieldRow>
    );
}

export function ImageField({ value, onChange, label }) {
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState(null);

    const handleFile = async (file) => {
        if (!file) return;
        setUploading(true);
        setError(null);
        try {
            const fd = new FormData();
            fd.append('file', file);
            const res = await authFetch(`${API_BASE}/api/cms/admin/upload`, {
                method: 'POST',
                body: fd,
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || `Upload failed (${res.status})`);
            }
            const data = await res.json();
            onChange(data.url);
        } catch (err) {
            setError(err.message);
        } finally {
            setUploading(false);
        }
    };

    return (
        <FieldRow label={label}>
            <div className="flex items-start gap-3">
                <div className="w-16 h-16 rounded-md bg-[var(--bg-tertiary)] border border-[var(--border-default)] overflow-hidden flex items-center justify-center text-xs text-[var(--text-muted)]">
                    {value ? <img src={value} alt="" className="w-full h-full object-contain" /> : '—'}
                </div>
                <div className="flex-1 flex flex-col gap-2">
                    <input
                        type="text"
                        className={inputClass}
                        value={value || ''}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder="https://… or /api/cms/asset/cms/…"
                    />
                    <div className="flex items-center gap-2">
                        <label className="px-3 py-1.5 text-xs rounded-md cursor-pointer bg-[var(--bg-tertiary)] border border-[var(--border-default)] hover:border-[var(--accent-primary)] transition-colors">
                            {uploading ? 'Uploading…' : 'Upload image'}
                            <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                disabled={uploading}
                                onChange={(e) => handleFile(e.target.files?.[0])}
                            />
                        </label>
                        {value ? (
                            <button
                                type="button"
                                onClick={() => onChange('')}
                                className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                            >
                                Remove
                            </button>
                        ) : null}
                    </div>
                    {error ? <span className="text-xs text-red-400">{error}</span> : null}
                </div>
            </div>
        </FieldRow>
    );
}

/**
 * RepeatableList — generic add/remove/reorder for an array field.
 * `renderItem(item, update)` is responsible for rendering one row's fields.
 */
export function RepeatableList({ items = [], onChange, renderItem, makeNew, label, addLabel = 'Add item', itemLabel, collapsible = false }) {
    const update = (idx, next) => {
        const copy = [...items];
        copy[idx] = next;
        onChange(copy);
    };
    const remove = (idx) => onChange(items.filter((_, i) => i !== idx));
    const move = (idx, dir) => {
        const j = idx + dir;
        if (j < 0 || j >= items.length) return;
        const copy = [...items];
        [copy[idx], copy[j]] = [copy[j], copy[idx]];
        onChange(copy);
    };

    // Collapse state — UI-only, NOT persisted. Keyed by item.id so that
    // reordering / removing a row keeps the right rows collapsed. New
    // rows added via "+ Add …" auto-expand once on next render so the
    // user can fill in fields immediately. Falls back to index-keying
    // when the caller's items don't expose stable ids.
    const keyFor = (item, idx) => (item && item.id) ? `id:${item.id}` : `idx:${idx}`;
    const [collapsedMap, setCollapsedMap] = useState({});
    // Auto-collapse any item key we haven't seen yet (default: collapsed).
    // Done in an effect to avoid mutating state during render.
    React.useEffect(() => {
        if (!collapsible) return;
        setCollapsedMap(prev => {
            const next = { ...prev };
            let changed = false;
            const seenKeys = new Set();
            items.forEach((item, idx) => {
                const k = keyFor(item, idx);
                seenKeys.add(k);
                if (!(k in next)) { next[k] = true; changed = true; }
            });
            // Drop entries for keys that no longer exist — keeps the map
            // from growing forever as users add/remove rows.
            for (const k of Object.keys(next)) {
                if (!seenKeys.has(k)) { delete next[k]; changed = true; }
            }
            return changed ? next : prev;
        });
    }, [items, collapsible]);
    const toggleCollapsed = (key) => setCollapsedMap(prev => ({ ...prev, [key]: !prev[key] }));
    // When the user clicks "+ Add …" we want the new row to start expanded
    // (otherwise they'd have to click the chevron just to type a label).
    const handleAdd = () => {
        const newItem = makeNew ? makeNew() : {};
        if (collapsible) {
            const k = newItem && newItem.id ? `id:${newItem.id}` : `idx:${items.length}`;
            setCollapsedMap(prev => ({ ...prev, [k]: false }));
        }
        onChange([...items, newItem]);
    };

    return (
        <div className="mb-3">
            {label ? (
                <div className="text-xs font-medium text-[var(--text-secondary)] mb-2">{label}</div>
            ) : null}
            <div className="flex flex-col gap-3">
                {items.map((item, idx) => {
                    // Optional caller-supplied label (e.g. the link's own label
                    // or the column's heading) so users can tell rows apart at
                    // a glance instead of just seeing "#1 / #2 / #3".
                    const customLabel = typeof itemLabel === 'function'
                        ? (itemLabel(item, idx) || '').toString().trim()
                        : '';
                    const rowKey = keyFor(item, idx);
                    // Collapsible mode treats unseen keys as collapsed too,
                    // so the very first render (before the effect runs) shows
                    // existing rows collapsed instead of flashing them open.
                    const isCollapsed = collapsible && (collapsedMap[rowKey] ?? true);
                    return (
                    <div
                        key={idx}
                        className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-3"
                    >
                        <div className="flex items-center justify-between mb-2 gap-2 min-w-0">
                            <span
                                className={`text-xs text-[var(--text-muted)] truncate min-w-0 flex items-center gap-1.5 ${collapsible ? 'cursor-pointer select-none' : ''}`}
                                onClick={collapsible ? () => toggleCollapsed(rowKey) : undefined}
                                role={collapsible ? 'button' : undefined}
                                aria-expanded={collapsible ? !isCollapsed : undefined}
                            >
                                {collapsible ? (
                                    <span
                                        className="shrink-0 inline-block transition-transform"
                                        style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
                                        aria-hidden="true"
                                    >▾</span>
                                ) : null}
                                <span className="shrink-0">#{idx + 1}</span>
                                {customLabel ? (
                                    <span className="text-[var(--text-secondary)] font-medium truncate">{customLabel}</span>
                                ) : null}
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                                <button type="button" onClick={() => move(idx, -1)} disabled={idx === 0}
                                        className="px-2 py-0.5 text-xs rounded hover:bg-[var(--bg-tertiary)] disabled:opacity-30">↑</button>
                                <button type="button" onClick={() => move(idx,  1)} disabled={idx === items.length - 1}
                                        className="px-2 py-0.5 text-xs rounded hover:bg-[var(--bg-tertiary)] disabled:opacity-30">↓</button>
                                <button type="button" onClick={() => remove(idx)}
                                        className="px-2 py-0.5 text-xs rounded text-red-400 hover:bg-red-500/10">Remove</button>
                            </div>
                        </div>
                        {!isCollapsed && renderItem(item, (next) => update(idx, next), idx)}
                    </div>
                    );
                })}
            </div>
            <button
                type="button"
                onClick={handleAdd}
                className="mt-2 px-3 py-1.5 text-xs rounded-md border border-dashed border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)] transition-colors"
            >
                + {addLabel}
            </button>
        </div>
    );
}

export const inputCls = inputClass;

/**
 * LinkField — edit a Link value object:
 *   { kind: 'page',     pageId, anchor? }
 *   { kind: 'external', url, newTab? }
 *   { kind: 'anchor',   anchor }
 *   { kind: 'app',      path }
 *
 * `pages` is the public page list [ { id, slug, title, isHomepage } ]
 * from the admin payload, used to populate the internal-page dropdown.
 */
export function LinkField({ label, value, onChange, pages = [], hint }) {
    const link = value && typeof value === 'object' ? value : { kind: 'external', url: '' };
    const kind = link.kind || 'external';

    const set = (patch) => onChange({ ...link, ...patch });

    // Detect a dangling page reference: link kind is 'page' but the
    // pageId no longer exists in the current site (page was deleted or
    // the user switched sites). Surfaced as an inline warning so users
    // notice the link is broken before publishing.
    const linkedPage = kind === 'page'
        ? pages.find(p => p.id === link.pageId)
        : null;
    const brokenPage = kind === 'page' && pages.length > 0 && link.pageId && !linkedPage;

    return (
        <FieldRow label={label} hint={hint}>
            {/* kind selector */}
            <select
                className={inputClass}
                value={kind}
                onChange={e => {
                    const next = e.target.value;
                    if (next === 'page')     onChange({ kind: 'page', pageId: pages[0]?.id || '' });
                    if (next === 'anchor')   onChange({ kind: 'anchor', anchor: '' });
                    if (next === 'external') onChange({ kind: 'external', url: '' });
                    if (next === 'app')      onChange({ kind: 'app', path: '/app' });
                }}
            >
                <option value="page">Internal page</option>
                <option value="anchor">Anchor on this page</option>
                <option value="external">External URL</option>
                <option value="app">App route</option>
            </select>

            {/* kind-specific fields */}
            {kind === 'page' && (
                <PageSelector
                    link={link}
                    set={set}
                    pages={pages}
                    brokenPage={brokenPage}
                    linkedPage={linkedPage}
                />
            )}
            {kind === 'anchor' && (
                <input
                    type="text"
                    className={`${inputClass} mt-1.5`}
                    placeholder="section-id (without #)"
                    value={link.anchor || ''}
                    onChange={e => set({ anchor: e.target.value.replace(/^#/, '') })}
                />
            )}
            {kind === 'external' && (
                <div className="flex flex-col gap-1.5 mt-1.5">
                    <input
                        type="url"
                        className={inputClass}
                        placeholder="https://…"
                        value={link.url || ''}
                        onChange={e => set({ url: e.target.value })}
                    />
                    <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer">
                        <input
                            type="checkbox"
                            checked={!!link.newTab}
                            onChange={e => set({ newTab: e.target.checked })}
                            className="accent-[var(--accent-primary)]"
                        />
                        Open in new tab
                    </label>
                </div>
            )}
            {kind === 'app' && (
                <input
                    type="text"
                    className={`${inputClass} mt-1.5`}
                    placeholder="/app"
                    value={link.path || ''}
                    onChange={e => set({ path: e.target.value })}
                />
            )}
        </FieldRow>
    );
}

/**
 * Internal-page selector pulled out of LinkField so the inline-create flow
 * (the "+ Create new page…" sentinel + form) can own its local state without
 * cluttering the LinkField body. The selector falls back to plain-select
 * behaviour when no CreatePageContext is available — every other call site
 * (existing block editors, footer/header link rows, etc.) just keeps working.
 */
const NEW_PAGE_SENTINEL = '__cms_new_page__';

function PageSelector({ link, set, pages, brokenPage, linkedPage }) {
    const onCreatePage = useContext(CreatePageContext);
    // The "+ Create new page…" branch keeps a snapshot of the previously
    // selected pageId so Cancel can restore it. We capture on focus, not
    // on render, since the link.pageId we'd capture in render gets stomped
    // when the user picks the sentinel.
    const previousPageIdRef = useRef(link.pageId || '');
    const [creating, setCreating] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [createError, setCreateError] = useState(null);
    const [newTitle, setNewTitle] = useState('');
    const [newSlug, setNewSlug] = useState('');
    const slugAuto = useRef(true);

    const deriveSlug = (t) =>
        String(t || '').toLowerCase().trim()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9_-]/g, '')
            .slice(0, 64);

    const handleSelectChange = (e) => {
        const value = e.target.value;
        if (value === NEW_PAGE_SENTINEL) {
            // Remember what the link pointed at before so Cancel can revert.
            previousPageIdRef.current = link.pageId || '';
            slugAuto.current = true;
            setNewTitle('');
            setNewSlug('');
            setCreateError(null);
            setCreating(true);
            return;
        }
        set({ pageId: value });
    };

    const submitNew = async () => {
        if (!onCreatePage || submitting) return;
        const title = newTitle.trim();
        if (!title) return;
        setSubmitting(true);
        setCreateError(null);
        try {
            const result = await onCreatePage({ title, slug: newSlug.trim() || undefined });
            if (!result?.id) throw new Error('Page creation returned no id');
            // Point the link at the freshly-created page. The new page now
            // appears in the `pages` prop on the next render (parent reloaded
            // its payload as part of handleAddPage), so the dropdown will
            // automatically show it as selected.
            set({ pageId: result.id });
            setCreating(false);
        } catch (err) {
            setCreateError(err?.message || 'Failed to create page');
        } finally {
            setSubmitting(false);
        }
    };

    const cancelNew = () => {
        setCreating(false);
        setCreateError(null);
        // Restore the prior pageId so the select doesn't stay on the sentinel.
        if (previousPageIdRef.current && previousPageIdRef.current !== link.pageId) {
            set({ pageId: previousPageIdRef.current });
        }
    };

    // While the inline form is open, force the select to show the sentinel
    // so the picker visually reflects the in-progress flow instead of the
    // stale previous selection.
    const selectValue = creating
        ? NEW_PAGE_SENTINEL
        : (link.pageId || '');

    return (
        <div className="flex flex-col gap-1.5 mt-1.5">
            <select
                className={`${inputClass} ${brokenPage ? 'border-red-500/50 focus:border-red-500' : ''}`}
                value={selectValue}
                onChange={handleSelectChange}
            >
                {pages.length === 0 && !creating && <option value="">— no pages —</option>}
                {/* If pageId is dangling, surface it in the dropdown so
                    the user can see what's set and pick a replacement. */}
                {brokenPage && (
                    <option value={link.pageId}>
                        ⚠ Missing page ({link.pageId})
                    </option>
                )}
                {pages.map(p => (
                    <option key={p.id} value={p.id}>
                        {p.title || p.slug} (/{p.slug}{p.isHomepage ? ' · home' : ''})
                    </option>
                ))}
                {/* "+ Create new page…" only appears when a CreatePageContext
                    provider is available (i.e. inside the Product Website
                    editor). External / unrelated reuses of LinkField stay
                    unaffected. */}
                {onCreatePage && (
                    <option value={NEW_PAGE_SENTINEL}>+ Create new page…</option>
                )}
            </select>
            {brokenPage && !creating && (
                <span className="text-xs text-red-400">
                    This link points to a page that no longer exists. Pick another page above.
                </span>
            )}
            {linkedPage && !creating && (
                <span className="text-xs text-[var(--text-muted)]">
                    → {linkedPage.isHomepage ? '/' : `/${linkedPage.slug}`}
                    {link.anchor ? `#${link.anchor}` : ''}
                </span>
            )}
            {creating && (
                <div className="rounded-md border border-dashed border-[var(--accent-primary)]/40 bg-[var(--bg-tertiary)] p-2 flex flex-col gap-1.5">
                    <label className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
                        New page title
                    </label>
                    <input
                        autoFocus
                        type="text"
                        className={inputClass}
                        placeholder="e.g. Pricing"
                        value={newTitle}
                        onChange={e => {
                            setNewTitle(e.target.value);
                            if (slugAuto.current) setNewSlug(deriveSlug(e.target.value));
                        }}
                        onKeyDown={e => {
                            if (e.key === 'Enter') { e.preventDefault(); submitNew(); }
                            if (e.key === 'Escape') { e.preventDefault(); cancelNew(); }
                        }}
                    />
                    <label className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
                        Slug
                    </label>
                    <input
                        type="text"
                        className={`${inputClass} font-mono`}
                        placeholder="auto"
                        value={newSlug}
                        onChange={e => {
                            slugAuto.current = false;
                            setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''));
                        }}
                    />
                    {createError && (
                        <span className="text-xs text-red-400">{createError}</span>
                    )}
                    <div className="flex gap-1.5 justify-end">
                        <button
                            type="button"
                            onClick={cancelNew}
                            disabled={submitting}
                            className="text-xs px-2 py-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={submitNew}
                            disabled={submitting || !newTitle.trim()}
                            className="text-xs px-3 py-1 rounded bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary)]/90 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {submitting ? 'Creating…' : 'Create page'}
                        </button>
                    </div>
                </div>
            )}
            <input
                type="text"
                className={inputClass}
                placeholder="#section-anchor (optional)"
                value={link.anchor || ''}
                onChange={e => set({ anchor: e.target.value.replace(/^#/, '') })}
            />
        </div>
    );
}
