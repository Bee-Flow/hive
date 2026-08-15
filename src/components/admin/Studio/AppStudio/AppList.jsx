import {
    AlertCircle,
    ExternalLink,
    FolderOpen,
    LayoutGrid,
    Loader2,
    MoreVertical,
    Pencil,
    Plus,
    Sparkles,
    Trash2,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { studioAppsApi } from './studioAppsApi';
import AppIcon from '../../../AppIcon';
import ConfirmDialog from '../../../shared/ConfirmDialog';
import EmptyState from '../../../shared/EmptyState';
import IconButton from '../../../shared/IconButton';
import Modal from '../../../shared/Modal';
import Tabs from '../../../shared/Tabs';
import toast from '../../../shared/Toast';

/**
 * App Studio — the Apps gallery (Studio section landing view).
 *
 * Merges listAccessible() + listMine() (deduped by id, owned first). Owner
 * cards open the editor via onOpen(app) and carry a kebab (Open / Rename /
 * Delete); shared (non-owner) cards are plain anchors to the end-user run
 * view at /app/apps/<id>. "New app" opens a two-tab modal: start blank or
 * pick from the server template gallery.
 *
 * Props:
 *   onOpen(app, openOptions?) — open an app in the editor (owner cards + fresh
 *     creations). openOptions is optional; a "Remix with AI" template card
 *     passes { remix:true, templateId, prompt } so the editor can focus the AI
 *     builder with a prefilled prompt. Plain opens omit it.
 */

// Default accent matches APP_COLOR_PRESETS[0] in runtime/themeVars.js (teal).
const DEFAULT_ACCENT = '#0F766E';

// `${hex}1a` = ~10% alpha soft tint, same trick as the webpages gallery.
function accentTile(accentColor) {
    const accent = /^#[0-9a-fA-F]{6}$/.test(accentColor || '') ? accentColor : DEFAULT_ACCENT;
    return { background: `${accent}1a`, color: accent };
}

function formatUpdated(iso) {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function PublishedBadge() {
    return (
        <span
            className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
            style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#059669' }}
        >
            Published
        </span>
    );
}

// Amber "Storage NN%" pill for owner cards whose per-app SQLite DB is above 80%
// of the cap — an unobtrusive nudge to prune/split before writes start 409ing.
// dbRatio (0–1) is computed server-side (GET /mine), so no cap constant here.
const STORAGE_PILL_THRESHOLD = 0.8;

function StoragePill({ ratio }) {
    if (typeof ratio !== 'number' || !(ratio > STORAGE_PILL_THRESHOLD)) return null;
    const pct = Math.min(100, Math.round(ratio * 100));
    return (
        <span
            className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
            style={{ background: 'rgba(245, 158, 11, 0.14)', color: '#b45309' }}
            title={`Storage ${pct}% of the app's database limit`}
        >
            Storage {pct}%
        </span>
    );
}

// Small "Update beschikbaar" pill-button on OWNER cards whose source template
// carries a newer registry version while the app is still untouched since
// install. templateUpgrade { available, fromVersion, toVersion } is computed
// server-side on GET /mine (registry version newer + install-hash pristine),
// so this renders purely on that flag. stopPropagation on click AND keydown —
// the whole card is itself a click/Enter target that opens the editor.
function TemplateUpdatePill({ app, onUpgrade }) {
    if (!app.templateUpgrade?.available || !onUpgrade) return null;
    const { fromVersion, toVersion } = app.templateUpgrade;
    return (
        <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onUpgrade(app); }}
            onKeyDown={(e) => e.stopPropagation()}
            className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold transition-opacity hover:opacity-80"
            style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#2563eb' }}
            title={`Nieuwe templateversie beschikbaar (v${fromVersion} → v${toVersion})`}
        >
            Update beschikbaar
        </button>
    );
}

function CardBody({ app, onUpgrade }) {
    return (
        <>
            <div className="flex items-start gap-2.5 mb-2">
                <span
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg shrink-0"
                    style={accentTile(app.accentColor)}
                >
                    <AppIcon name={app.icon || 'LayoutGrid'} className="w-4.5 h-4.5" />
                </span>
                <div className="flex-1 min-w-0 pt-0.5">
                    <div className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                        {app.name}
                    </div>
                    {app.description ? (
                        <div className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                            {app.description}
                        </div>
                    ) : null}
                </div>
            </div>
            <div className="flex items-center gap-2 text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                {app.isPublished ? <PublishedBadge /> : null}
                <StoragePill ratio={app.usage?.dbRatio} />
                <TemplateUpdatePill app={app} onUpgrade={onUpgrade} />
                {formatUpdated(app.updatedAt) ? <span>Updated {formatUpdated(app.updatedAt)}</span> : null}
            </div>
        </>
    );
}

const CARD_CLASSES = 'group relative rounded-xl border p-3.5 transition-all hover:shadow-md text-left';
const CARD_STYLE = { borderColor: 'var(--border-subtle)', background: 'var(--bg-card)' };

function SkeletonGrid() {
    return (
        <div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3"
            role="status"
            aria-label="Loading apps"
        >
            {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className={`${CARD_CLASSES} animate-pulse`} style={CARD_STYLE}>
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

// ── Template gallery (inside the New-app modal) ─────────────────────

function TemplateGallery({ templates, loading, error, creatingId, remixingId, onPick, onRemix, onRetry }) {
    if (loading) {
        return (
            <div className="flex items-center justify-center py-10" role="status" aria-label="Loading templates">
                <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--accent-primary)' }} />
            </div>
        );
    }
    if (error) {
        return (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
                <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>{error}</div>
                <button
                    type="button"
                    onClick={onRetry}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white/5 hover:bg-[var(--bg-card-hover)]"
                    style={{ color: 'var(--text-primary)' }}
                >
                    Try again
                </button>
            </div>
        );
    }
    if (!templates || templates.length === 0) {
        return (
            <div className="py-8 text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>
                No templates available yet.
            </div>
        );
    }
    // A busy op anywhere in the gallery locks every card (one create at a time).
    const anyBusy = !!creatingId || !!remixingId;
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {templates.map((tpl) => {
                const picking = creatingId === tpl.id;
                const remixing = remixingId === tpl.id;
                return (
                    <div
                        key={tpl.id}
                        className="rounded-xl border overflow-hidden transition-all hover:shadow-md"
                        style={CARD_STYLE}
                    >
                        {/* Primary action: use the template as-is (create + open). */}
                        <button
                            type="button"
                            onClick={() => onPick(tpl)}
                            disabled={anyBusy}
                            aria-busy={picking}
                            className="w-full p-3 text-left disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            <div className="flex items-start gap-2.5">
                                <span
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg shrink-0"
                                    style={accentTile(null)}
                                >
                                    {picking
                                        ? <Loader2 className="w-4 h-4 animate-spin" />
                                        : <AppIcon name={tpl.icon || 'LayoutGrid'} className="w-4 h-4" />}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <span className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                                            {tpl.title}
                                        </span>
                                        {tpl.category ? (
                                            <span
                                                className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium shrink-0 bg-white/5"
                                                style={{ color: 'var(--text-secondary)' }}
                                            >
                                                {tpl.category}
                                            </span>
                                        ) : null}
                                    </div>
                                    <div className="text-xs line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                                        {tpl.description}
                                    </div>
                                </div>
                            </div>
                        </button>
                        {/* Secondary action: create from the template, then open the
                            editor with the AI builder ready to adapt it (remix). */}
                        <div
                            className="flex justify-end px-3 pb-2.5 -mt-1 border-t pt-2"
                            style={{ borderColor: 'var(--border-subtle)' }}
                        >
                            <button
                                type="button"
                                onClick={() => onRemix(tpl)}
                                disabled={anyBusy}
                                aria-busy={remixing}
                                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors hover:bg-[var(--bg-tertiary)] disabled:opacity-60 disabled:cursor-not-allowed"
                                style={{ color: 'var(--accent-primary)' }}
                            >
                                {remixing
                                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    : <Sparkles className="w-3.5 h-3.5" />}
                                Remix with AI
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ── New-app modal ───────────────────────────────────────────────────

// A failed template fetch leaves `templates` null, which is the very condition
// the load effect fires on — so the attempt count, not the state, is what ends
// the loop. One silent retry covers a blip; after that the error state with
// "Try again" takes over.
const MAX_TEMPLATE_ATTEMPTS = 2;

function NewAppModal({ open, onClose, onCreated }) {
    const [tab, setTab] = useState('blank');
    const [name, setName] = useState('');
    const [creating, setCreating] = useState(false);
    const [creatingTemplateId, setCreatingTemplateId] = useState(null);
    const [remixingTemplateId, setRemixingTemplateId] = useState(null);
    const [templates, setTemplates] = useState(null);
    const [templatesLoading, setTemplatesLoading] = useState(false);
    const [templatesError, setTemplatesError] = useState(null);

    // Reset per open so a re-opened modal starts fresh.
    useEffect(() => {
        if (!open) return;
        setTab('blank');
        setName('');
        setCreating(false);
        setCreatingTemplateId(null);
        setRemixingTemplateId(null);
    }, [open]);

    const templateAttemptsRef = useRef(0);

    const loadTemplates = useCallback(async () => {
        templateAttemptsRef.current += 1;
        setTemplatesLoading(true);
        setTemplatesError(null);
        try {
            const res = await studioAppsApi.listTemplates();
            setTemplates(res?.templates || []);
        } catch (err) {
            setTemplatesError(err?.message || 'Could not load templates.');
        } finally {
            setTemplatesLoading(false);
        }
    }, []);

    // A deliberate user retry starts the budget over.
    const retryTemplates = useCallback(() => {
        templateAttemptsRef.current = 0;
        loadTemplates();
    }, [loadTemplates]);

    // Fetch the gallery once per modal lifetime (templates are static).
    useEffect(() => {
        if (!open || templates !== null || templatesLoading) return;
        if (templateAttemptsRef.current >= MAX_TEMPLATE_ATTEMPTS) return;
        loadTemplates();
    }, [open, templates, templatesLoading, loadTemplates]);

    // `openOptions` (optional) rides through onCreated → the editor open, so a
    // remix can ask the shell to focus the AI builder with a prefilled prompt.
    const create = useCallback(async (body, setBusy, openOptions) => {
        setBusy(true);
        try {
            const res = await studioAppsApi.createApp(body);
            const app = res?.app;
            if (!app?.id) throw new Error('Create returned no app');
            // A data-backed template installs tables, seed rows and connectors
            // AFTER the app row exists, and that half can fail on its own. It
            // used to fail silently, leaving an app with every screen and no
            // data behind them — which reads as a broken template rather than a
            // failed step. Say it, and keep the app: the screens are still there
            // and the data can be installed again.
            if (res?.dataInstall && res.dataInstall.ok === false) {
                toast.error(`App created, but its tables and connections did not install: ${res.dataInstall.error}`);
            } else {
                toast.success('App created.');
            }
            onCreated(app, openOptions);
        } catch (err) {
            toast.error(err?.message || 'Could not create the app.');
            setBusy(false);
        }
    }, [onCreated]);

    const busy = creating || !!creatingTemplateId || !!remixingTemplateId;

    const handleCreateBlank = (e) => {
        e.preventDefault();
        if (busy) return;
        const trimmed = name.trim();
        create(trimmed ? { name: trimmed } : {}, setCreating);
    };

    const handlePickTemplate = (tpl) => {
        if (busy) return;
        const trimmed = name.trim();
        create(
            trimmed ? { templateId: tpl.id, name: trimmed } : { templateId: tpl.id },
            (b) => setCreatingTemplateId(b ? tpl.id : null),
        );
    };

    // Remix = create from the template, then open the editor with the AI builder
    // focused and a prefilled prompt. The builder consumes context.templateId
    // (the AI sibling wave) so it can adapt the just-installed app.
    const handleRemixTemplate = (tpl) => {
        if (busy) return;
        const trimmed = name.trim();
        const prompt = `Help me remix the "${tpl.title}" template. ${tpl.description || ''} `
            + 'I want to adapt it to my needs — suggest what to change and build it with me.';
        create(
            trimmed ? { templateId: tpl.id, name: trimmed } : { templateId: tpl.id },
            (b) => setRemixingTemplateId(b ? tpl.id : null),
            { remix: true, templateId: tpl.id, prompt: prompt.trim() },
        );
    };

    return (
        <Modal
            open={open}
            onClose={() => { if (!busy) onClose(); }}
            title="New app"
            description="Start from scratch or pick a template — the AI can build the rest with you."
            size="lg"
        >
            <Tabs
                value={tab}
                onChange={setTab}
                ariaLabel="How to start"
                size="sm"
                className="mb-4"
                items={[
                    { id: 'blank', label: 'Start blank' },
                    { id: 'template', label: 'From template' },
                ]}
            />

            <div className="mb-4">
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                    {tab === 'blank' ? 'Name' : 'Name (optional — templates bring their own)'}
                </label>
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Vacation requests"
                    maxLength={120}
                    className="w-full px-3 py-2 text-sm rounded-lg border outline-none focus:ring-2"
                    style={{
                        borderColor: 'var(--border-subtle)',
                        background: 'var(--bg-primary)',
                        color: 'var(--text-primary)',
                    }}
                />
            </div>

            {tab === 'blank' ? (
                <form onSubmit={handleCreateBlank} className="flex justify-end">
                    <button
                        type="submit"
                        disabled={busy}
                        className="px-4 py-2 rounded-lg text-sm font-medium text-white flex items-center gap-1.5 disabled:opacity-50"
                        style={{ background: 'var(--accent-primary)' }}
                    >
                        {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                        Create app
                    </button>
                </form>
            ) : (
                <TemplateGallery
                    templates={templates}
                    loading={templatesLoading}
                    error={templatesError}
                    creatingId={creatingTemplateId}
                    remixingId={remixingTemplateId}
                    onPick={handlePickTemplate}
                    onRemix={handleRemixTemplate}
                    onRetry={retryTemplates}
                />
            )}
        </Modal>
    );
}

// ── Owner kebab menu ────────────────────────────────────────────────

function OwnerMenu({ app, onOpen, onRename, onDelete }) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef(null);

    useEffect(() => {
        if (!open) return undefined;
        const onDocMouseDown = (e) => {
            if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', onDocMouseDown);
        return () => document.removeEventListener('mousedown', onDocMouseDown);
    }, [open]);

    const item = (label, Icon, onClick, danger = false) => (
        <button
            type="button"
            role="menuitem"
            onClick={(e) => { e.stopPropagation(); setOpen(false); onClick(); }}
            className={
                'w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left transition-colors ' +
                (danger ? 'text-rose-500 hover:bg-rose-500/10' : 'hover:bg-[var(--bg-tertiary)]')
            }
            style={danger ? undefined : { color: 'var(--text-primary)' }}
        >
            <Icon className="w-3.5 h-3.5 shrink-0" />
            {label}
        </button>
    );

    return (
        <div
            ref={rootRef}
            className="absolute top-2 right-2"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
        >
            <IconButton
                ariaLabel={`Actions for ${app.name}`}
                title="App actions"
                size="sm"
                onClick={() => setOpen((v) => !v)}
                className={open ? '' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity'}
            >
                <MoreVertical />
            </IconButton>
            {open && (
                <div
                    role="menu"
                    className="absolute right-0 mt-1 w-36 py-1 rounded-lg border shadow-lg z-20"
                    style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}
                >
                    {item('Open', FolderOpen, onOpen)}
                    {item('Rename', Pencil, onRename)}
                    {item('Delete', Trash2, onDelete, true)}
                </div>
            )}
        </div>
    );
}

// ── The gallery ─────────────────────────────────────────────────────

export default function AppList({ onOpen }) {
    const [apps, setApps] = useState([]);
    const [ownedIds, setOwnedIds] = useState(() => new Set());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [showCreate, setShowCreate] = useState(false);
    const [renameTarget, setRenameTarget] = useState(null);
    const [renameValue, setRenameValue] = useState('');
    const [renameBusy, setRenameBusy] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [upgradeTarget, setUpgradeTarget] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [accessible, mine] = await Promise.all([
                studioAppsApi.listAccessible(),
                studioAppsApi.listMine(),
            ]);
            const mineApps = mine?.apps || [];
            const owned = new Set(mineApps.map((a) => a.id));
            const byUpdated = (a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
            const shared = (accessible?.apps || []).filter((a) => !owned.has(a.id));
            setApps([...[...mineApps].sort(byUpdated), ...shared.sort(byUpdated)]);
            setOwnedIds(owned);
        } catch (err) {
            setError(err?.message || 'Could not load your apps.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const startRename = (app) => {
        setRenameTarget(app);
        setRenameValue(app.name || '');
    };

    const submitRename = async (e) => {
        e?.preventDefault?.();
        if (!renameTarget || renameBusy) return;
        const trimmed = renameValue.trim();
        if (!trimmed || trimmed === renameTarget.name) { setRenameTarget(null); return; }
        setRenameBusy(true);
        try {
            const res = await studioAppsApi.updateApp(renameTarget.id, { name: trimmed });
            const updated = res?.app || { ...renameTarget, name: trimmed };
            setApps((prev) => prev.map((a) => (a.id === renameTarget.id ? { ...a, ...updated } : a)));
            setRenameTarget(null);
            toast.success('App renamed.');
        } catch (err) {
            toast.error(err?.message || 'Could not rename the app.');
        } finally {
            setRenameBusy(false);
        }
    };

    // Template upgrade — confirmed first (the definition is replaced), then
    // the list reloads so the pill disappears and the card shows the result.
    const confirmUpgrade = async () => {
        if (!upgradeTarget) return;
        try {
            await studioAppsApi.templateUpgrade(upgradeTarget.id);
            toast.success('App bijgewerkt naar de nieuwste templateversie.');
            load();
        } catch (err) {
            toast.error(err?.message || 'Kon de app niet bijwerken.');
        } finally {
            setUpgradeTarget(null);
        }
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        try {
            await studioAppsApi.deleteApp(deleteTarget.id);
            setApps((prev) => prev.filter((a) => a.id !== deleteTarget.id));
            toast.success('App deleted.');
        } catch (err) {
            toast.error(err?.message || 'Could not delete the app.');
        } finally {
            setDeleteTarget(null);
        }
    };

    // openOptions (e.g. { remix, templateId, prompt }) is forwarded to the
    // opener so a remix can focus the AI builder with a prefilled prompt. Plain
    // opens keep the single-arg onOpen(app) signature.
    const handleCreated = (app, openOptions) => {
        setShowCreate(false);
        if (openOptions) onOpen?.(app, openOptions);
        else onOpen?.(app);
    };

    const isEmpty = !loading && !error && apps.length === 0;

    return (
        <div className="flex flex-col h-full" style={{ background: 'var(--bg-primary)' }}>
            {/* Toolbar */}
            <div
                className="shrink-0 px-4 py-3 border-b flex items-center gap-3"
                style={{ borderColor: 'var(--border-subtle)' }}
            >
                <div className="flex-1 flex items-center gap-2 min-w-0">
                    <LayoutGrid className="w-5 h-5 shrink-0" style={{ color: 'var(--accent-primary)' }} />
                    <h2 className="text-lg font-semibold truncate" style={{ color: 'var(--text-primary)' }}>Apps</h2>
                </div>
                <button
                    type="button"
                    onClick={() => setShowCreate(true)}
                    className="px-3 py-2 rounded-lg text-sm font-medium text-white flex items-center gap-1.5"
                    style={{ background: 'var(--accent-primary)' }}
                >
                    <Plus className="w-3.5 h-3.5" />
                    New app
                </button>
            </div>

            {error && (
                <div
                    className="shrink-0 px-4 py-2 text-xs flex items-center gap-2"
                    style={{ background: 'rgba(239,68,68,0.1)', color: '#991b1b' }}
                    role="alert"
                >
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
                    <button type="button" onClick={load} className="ml-auto underline font-medium">Retry</button>
                </div>
            )}

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                {loading ? (
                    <SkeletonGrid />
                ) : isEmpty ? (
                    <EmptyState
                        icon={<LayoutGrid className="w-12 h-12" />}
                        title="Build your first app"
                        description="Turn a routine into a small internal tool — a form, a dashboard, a tracker — without writing code. Describe what you need and the AI can build it for you."
                        action={{
                            label: 'New app',
                            onClick: () => setShowCreate(true),
                            icon: <Plus className="w-4 h-4" />,
                        }}
                    />
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {apps.map((app) => {
                            const owned = ownedIds.has(app.id);
                            if (!owned) {
                                // Shared with me — open the end-user run view
                                // at /app/apps/:id (AppRunPage).
                                return (
                                    <a
                                        key={app.id}
                                        href={`/app/apps/${app.id}`}
                                        className={`${CARD_CLASSES} block no-underline`}
                                        style={CARD_STYLE}
                                    >
                                        <CardBody app={app} />
                                        <span
                                            className="absolute top-2 right-2 inline-flex items-center gap-1 text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                                            style={{ color: 'var(--text-secondary)' }}
                                        >
                                            Open <ExternalLink className="w-3 h-3" />
                                        </span>
                                    </a>
                                );
                            }
                            return (
                                <div
                                    key={app.id}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => onOpen?.(app)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            onOpen?.(app);
                                        }
                                    }}
                                    className={`${CARD_CLASSES} cursor-pointer`}
                                    style={CARD_STYLE}
                                >
                                    <CardBody app={app} onUpgrade={setUpgradeTarget} />
                                    <OwnerMenu
                                        app={app}
                                        onOpen={() => onOpen?.(app)}
                                        onRename={() => startRename(app)}
                                        onDelete={() => setDeleteTarget(app)}
                                    />
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <NewAppModal
                open={showCreate}
                onClose={() => setShowCreate(false)}
                onCreated={handleCreated}
            />

            <Modal
                open={!!renameTarget}
                onClose={() => { if (!renameBusy) setRenameTarget(null); }}
                title="Rename app"
                size="sm"
                footer={
                    <>
                        <button
                            type="button"
                            onClick={() => setRenameTarget(null)}
                            disabled={renameBusy}
                            className="px-4 py-2 rounded-lg text-sm bg-white/5 hover:bg-[var(--bg-card-hover)] disabled:opacity-50"
                            style={{ color: 'var(--text-primary)' }}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={submitRename}
                            disabled={renameBusy || !renameValue.trim()}
                            className="px-4 py-2 rounded-lg text-sm font-medium text-white flex items-center gap-1.5 disabled:opacity-50"
                            style={{ background: 'var(--accent-primary)' }}
                        >
                            {renameBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            Save
                        </button>
                    </>
                }
            >
                <form onSubmit={submitRename}>
                    <input
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        aria-label="App name"
                        maxLength={120}
                        autoFocus
                        className="w-full px-3 py-2 text-sm rounded-lg border outline-none focus:ring-2"
                        style={{
                            borderColor: 'var(--border-subtle)',
                            background: 'var(--bg-primary)',
                            color: 'var(--text-primary)',
                        }}
                    />
                </form>
            </Modal>

            <ConfirmDialog
                open={!!upgradeTarget}
                title={`“${upgradeTarget?.name || 'App'}” bijwerken?`}
                description="De app wordt bijgewerkt naar de nieuwste templateversie. Je gegevens blijven staan."
                confirmLabel="Bijwerken"
                onConfirm={confirmUpgrade}
                onCancel={() => setUpgradeTarget(null)}
            />

            <ConfirmDialog
                open={!!deleteTarget}
                title={`Delete “${deleteTarget?.name || 'app'}”?`}
                description="This permanently deletes the app and its version history for everyone it is shared with. This cannot be undone."
                confirmLabel="Delete"
                destructive
                onConfirm={confirmDelete}
                onCancel={() => setDeleteTarget(null)}
            />
        </div>
    );
}
