import {
    AlertTriangle, Braces, Check, Command, Database, Eye, History, Loader2, Pencil, Redo2, ShieldCheck, Undo2, UploadCloud, X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CommandPalette from './CommandPalette';
import PublishModal from './PublishModal';
import VariablesManager from '../variables/VariablesManager';
import AppIcon from '../../../../AppIcon';
import ConfirmDialog from '../../../../shared/ConfirmDialog';
import IconButton from '../../../../shared/IconButton';
import Modal from '../../../../shared/Modal';
import SegmentedControl from '../../../../shared/SegmentedControl';
import Tabs from '../../../../shared/Tabs';
import toast from '../../../../shared/Toast';
import AccessMatrix from '../rbac/AccessMatrix';
import RolesManager from '../rbac/RolesManager';
import RowRuleEditor from '../rbac/RowRuleEditor';
import { useAppEditor } from '../state/AppEditorContext';
import { listDefinitionRoles, listVariables } from '../state/definitionOps';
import { studioAppsApi } from '../studioAppsApi';
import TablesManager from '../tables/TablesManager';
import { isMac, modKeyLabel } from '../../../../../utils/platform';

/** Focus the AI builder composer (the chat pane tags its textarea). No-op if absent. */
function focusAiComposer() {
    if (typeof document === 'undefined') return;
    const el = document.querySelector('[data-app-ai-composer]');
    if (el && typeof el.focus === 'function') el.focus();
}

// Sentinel role keys and other internal markers (e.g. the "hidden from
// everyone" key) are implementation detail — an entry whose text leaks one is
// dropped rather than shown, since it means nothing to the person reading it.
const INTERNAL_TOKEN_RE = /__[A-Za-z0-9_]+__/;

/**
 * Flatten one save reply — { warnings, repairs } or { errors, warnings } — into
 * the list the save pill shows. Server entries are { code, path, message, hint? };
 * repairs carry no hint. Entries without a message have nothing to say.
 */
function toSaveNotices(payload) {
    const out = [];
    const take = (list, kind) => {
        for (const raw of Array.isArray(list) ? list : []) {
            const entry = typeof raw === 'string' ? { message: raw } : (raw || {});
            const message = typeof entry.message === 'string' ? entry.message.trim() : '';
            const hint = typeof entry.hint === 'string' ? entry.hint.trim() : '';
            if (!message) continue;
            if (INTERNAL_TOKEN_RE.test(message) || INTERNAL_TOKEN_RE.test(hint)) continue;
            out.push({ kind, message, hint, path: typeof entry.path === 'string' ? entry.path : '' });
        }
    };
    take(payload?.errors, 'error');
    take(payload?.warnings, 'warning');
    take(payload?.repairs, 'repair');
    return out;
}

const PATH_STEP_RE = /(screens|sections|children)\[(\d+)\]/g;

/**
 * Resolve a server path ("screens[0].sections[1].children[2].props.text") to the
 * screen and component it points at, so "Show me" can go there. Returns null
 * when the path names neither (a stale index, or app-level paths like meta.name).
 */
function resolvePathTarget(definition, path) {
    if (!definition || !path) return null;
    let screen = null;
    let node = null;
    let cursor = null;
    for (const [, kind, index] of path.matchAll(PATH_STEP_RE)) {
        const i = Number(index);
        if (kind === 'screens') {
            screen = definition.screens?.[i] || null;
            cursor = screen;
        } else if (kind === 'sections') {
            cursor = screen?.sections?.[i] || null;
        } else {
            node = cursor?.children?.[i] || null;
            cursor = node;
        }
        if (!cursor) return null;
    }
    if (!screen?.id) return null;
    return { screenId: screen.id, nodeId: node?.id || null };
}

/**
 * App Studio editor — the top bar: app name (inline-editable), the Add
 * palette, Edit|Preview toggle, undo/redo, the autosave status pill,
 * version history, Publish and Close. The conflict dialog ("changed in
 * another tab") also renders here — the shell owns the conflict state and
 * hands down the two resolutions.
 *
 * All editing controls disable under streamLock; Preview/Close stay live so
 * the user is never trapped while the AI streams.
 */

export default function EditorHeader({
    app,
    onAppUpdated,
    onClose,
    onCommit,
    canUndo,
    canRedo,
    onUndo,
    onRedo,
    saveStatus,
    saveError,
    saveNotices,
    onFlush,
    conflict,
    onConflictLoadLatest,
    onConflictOverwrite,
    onConflictDismiss,
    onServerDefinition,
    commandOpen = false,
    onCommandOpenChange,
}) {
    const { definition, version, screenId, mode, streamLock, previewRole, dispatch } = useAppEditor();

    // ---- roles (RBAC authoring + view-as-role preview) ---------------------
    // The view-as selector + banner read the definition's mirrored role list
    // ([{ id, name }]); the authoritative model roles are loaded (via useQuery)
    // only inside the modal, so the header itself needs no data fetch.
    const roles = listDefinitionRoles(definition);
    const variableCount = listVariables(definition).length;
    const [rolesOpen, setRolesOpen] = useState(false);
    const [variablesOpen, setVariablesOpen] = useState(false);
    const [rolesTab, setRolesTab] = useState('roles');
    const [rolesDirty, setRolesDirty] = useState({ roles: false, rules: false });
    const [rolesCloseConfirm, setRolesCloseConfirm] = useState(false);
    const setPreviewRole = (roleKey) => dispatch({ type: 'set_preview_role', role: roleKey || null });

    // ---- inline name -------------------------------------------------------
    const [editingName, setEditingName] = useState(false);
    const [nameDraft, setNameDraft] = useState(app?.name || '');
    const nameInputRef = useRef(null);
    useEffect(() => {
        if (editingName) nameInputRef.current?.select();
    }, [editingName]);

    const commitName = async () => {
        setEditingName(false);
        const name = nameDraft.trim();
        if (!name || name === app?.name) {
            setNameDraft(app?.name || '');
            return;
        }
        try {
            const updated = await studioAppsApi.updateApp(app.id, { name });
            onAppUpdated?.(updated?.app || updated || { ...app, name });
        } catch (err) {
            setNameDraft(app?.name || '');
            toast.error(err?.message || 'Could not rename the app.');
        }
    };

    // ---- tables (data model designer) --------------------------------------
    const [tablesOpen, setTablesOpen] = useState(false);

    // ---- what the last save reported ---------------------------------------
    // Each entry keeps the node it points at so "Show me" can jump there; a
    // path that no longer resolves (the user deleted it since) just loses the
    // affordance.
    const notices = useMemo(
        () => toSaveNotices(saveNotices).map((n) => ({ ...n, target: resolvePathTarget(definition, n.path) })),
        [saveNotices, definition],
    );
    const [noticesOpen, setNoticesOpen] = useState(false);
    useEffect(() => {
        if (!notices.length) setNoticesOpen(false);
    }, [notices]);

    const showNotice = (entry) => {
        if (!entry.target) return;
        dispatch({ type: 'set_screen', screenId: entry.target.screenId });
        if (entry.target.nodeId) dispatch({ type: 'select_node', nodeId: entry.target.nodeId });
        setNoticesOpen(false);
    };

    // ---- publish -----------------------------------------------------------
    // The audience picker (Private / Entire org / Specific groups) lives in
    // PublishModal; it builds the PATCH payload and reports the updated app back
    // through onAppUpdated. The header only owns open/close.
    const [publishOpen, setPublishOpen] = useState(false);
    // 'behind'  — live app is on an older version than this canvas
    // 'current' — live app matches this canvas
    // 'unknown' — never published, or the row predates publishedVersion; claiming
    //             "up to date" on a guess would be worse than saying nothing.
    const publishedVersion = app?.publishedVersion ?? app?.published_version ?? null;
    const publishState = (!(app?.isPublished ?? app?.is_published) || publishedVersion == null)
        ? 'unknown'
        : (Number(publishedVersion) === Number(version) ? 'current' : 'behind');

    // ---- version history ---------------------------------------------------
    const [versionsOpen, setVersionsOpen] = useState(false);
    const [versions, setVersions] = useState(null); // null = loading
    const [restoringId, setRestoringId] = useState(null);
    useEffect(() => {
        if (!versionsOpen) return undefined;
        let alive = true;
        setVersions(null);
        studioAppsApi.listVersions(app.id)
            .then((res) => { if (alive) setVersions(res?.versions || (Array.isArray(res) ? res : [])); })
            .catch((err) => {
                if (!alive) return;
                setVersions([]);
                toast.error(err?.message || 'Could not load versions.');
            });
        return () => { alive = false; };
    }, [versionsOpen, app?.id]);

    const doRestore = async (versionEntry) => {
        const versionId = versionEntry.id ?? versionEntry.versionId ?? versionEntry.version;
        setRestoringId(versionId);
        try {
            await studioAppsApi.restoreVersion(app.id, versionId);
            const fresh = await studioAppsApi.getApp(app.id);
            const freshApp = fresh?.app || fresh;
            // The app row exposes the optimistic-concurrency version as
            // `definitionVersion` (studioApps.js → sanitizeAppRow); `version` is
            // only there for callers that already normalised it. Handing over
            // undefined leaves autosave on a stale baseVersion → conflict loop.
            onServerDefinition?.(freshApp.definition, freshApp.version ?? freshApp.definitionVersion);
            onAppUpdated?.(freshApp);
            setVersionsOpen(false);
            toast.success('Version restored.');
        } catch (err) {
            toast.error(err?.message || 'Restore failed.');
        } finally {
            setRestoringId(null);
        }
    };

    // ---- close -------------------------------------------------------------
    // The flush RESOLVES on failure (autosave turns every error into a status,
    // it never rejects), so closing has to read the result — a `finally` would
    // throw away work that never reached the server.
    const [closing, setClosing] = useState(false);
    const handleClose = async () => {
        if (closing) return;
        setClosing(true);
        try {
            const res = await onFlush?.();
            if (res && res.ok === false) {
                toast.error(`${res.error || 'Saving failed.'} Your changes are still here — the editor stays open.`);
                return;
            }
            onClose?.();
        } finally {
            setClosing(false);
        }
    };

    // Roles and row rules live in each panel's local draft until its own Save
    // button runs, so closing the modal mid-edit is a silent discard.
    const requestRolesClose = () => {
        if (rolesDirty.roles || rolesDirty.rules) setRolesCloseConfirm(true);
        else setRolesOpen(false);
    };

    // ---- command palette actions (all setters are declared by now) ---------
    const commandActions = useMemo(() => {
        const acts = [];
        acts.push({
            id: 'cmd-mode',
            group: 'View',
            label: mode === 'edit' ? 'Switch to Preview' : 'Switch to Edit',
            run: () => dispatch({ type: 'set_mode', mode: mode === 'edit' ? 'preview' : 'edit' }),
        });
        for (const s of definition?.screens || []) {
            acts.push({ id: `cmd-screen-${s.id}`, group: 'Go to screen', label: `Go to ${s.name || 'screen'}`, run: () => dispatch({ type: 'set_screen', screenId: s.id }) });
        }
        acts.push({ id: 'cmd-data', group: 'Data', label: 'Open Tables', run: () => setTablesOpen(true) });
        acts.push({ id: 'cmd-ai', group: 'AI', label: 'Ask the AI builder', hint: 'chat', run: focusAiComposer });
        acts.push({ id: 'cmd-variables', group: 'App', label: 'Open Variables', run: () => setVariablesOpen(true) });
    acts.push({ id: 'cmd-roles', group: 'App', label: 'Open Roles & access', run: () => setRolesOpen(true) });
        acts.push({ id: 'cmd-publish', group: 'App', label: 'Publish app', run: () => setPublishOpen(true) });
        acts.push({ id: 'cmd-role-owner', group: 'Preview as', label: 'View as Owner (full view)', run: () => setPreviewRole(null) });
        for (const r of roles) {
            acts.push({ id: `cmd-role-${r.id}`, group: 'Preview as', label: `View as ${r.name || r.id}`, run: () => setPreviewRole(r.id) });
        }
        return acts;
    // setTablesOpen/setRolesOpen/setPublishOpen are stable useState setters;
    // setPreviewRole/dispatch close over `dispatch` (stable). deps cover
    // everything that changes the LIST of actions.
    }, [mode, definition, roles, dispatch]); // eslint-disable-line react-hooks/exhaustive-deps

    const closeCommand = useCallback(() => onCommandOpenChange?.(false), [onCommandOpenChange]);

    const onMac = isMac();
    const paletteShortcut = onMac ? `${modKeyLabel()}K` : `${modKeyLabel()}+K`;

    return (
        <>
        <header
            className="relative flex items-center gap-2 border-b px-3 py-2 shrink-0"
            style={{ borderColor: 'var(--border-default)', background: 'var(--bg-primary)' }}
        >
            {/* App identity + rename */}
            <span
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
                style={{ background: 'var(--bg-tertiary)', color: 'var(--accent-primary)' }}
            >
                <AppIcon name={definition?.meta?.icon || app?.icon || 'LayoutGrid'} className="h-4 w-4" />
            </span>
            {editingName ? (
                <input
                    ref={nameInputRef}
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onBlur={commitName}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') commitName();
                        else if (e.key === 'Escape') {
                            setNameDraft(app?.name || '');
                            setEditingName(false);
                        }
                    }}
                    aria-label="App name"
                    className="w-48 rounded border px-2 py-1 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-hover)]"
                    style={{
                        background: 'var(--bg-secondary)',
                        borderColor: 'var(--accent-primary)',
                        color: 'var(--text-primary)',
                    }}
                />
            ) : (
                <button
                    type="button"
                    onClick={() => !streamLock && setEditingName(true)}
                    title="Rename app"
                    className="group inline-flex min-w-0 items-center gap-1.5 rounded px-1 py-0.5 text-sm font-semibold hover:bg-[var(--bg-tertiary)]"
                    style={{ color: 'var(--text-primary)' }}
                >
                    <span className="truncate max-w-[14rem]">{app?.name || 'Untitled app'}</span>
                    <Pencil
                        className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                        style={{ color: 'var(--text-tertiary)' }}
                        aria-hidden="true"
                    />
                </button>
            )}

            {/* Command palette launcher — the hotkey takes ⌘ OR Ctrl, so the
                label must name the key THIS keyboard has. */}
            <button
                type="button"
                onClick={() => onCommandOpenChange?.(true)}
                title={`Command palette (${paletteShortcut})`}
                aria-label="Open command palette"
                className="inline-flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs font-medium hover:bg-[var(--bg-tertiary)]"
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-tertiary)' }}
            >
                {onMac ? <Command className="h-3.5 w-3.5" aria-hidden="true" /> : null}
                {onMac ? 'K' : paletteShortcut}
            </button>

            {/* Mode toggle — centered */}
            <div className="flex flex-1 justify-center">
                <SegmentedControl
                    size="sm"
                    ariaLabel="Editor mode"
                    value={mode}
                    onChange={(next) => dispatch({ type: 'set_mode', mode: next })}
                    options={[
                        { value: 'edit', label: 'Edit', icon: <Pencil className="h-3 w-3" aria-hidden="true" />, disabled: streamLock && mode !== 'edit' },
                        { value: 'preview', label: 'Preview', icon: <Eye className="h-3 w-3" aria-hidden="true" /> },
                    ]}
                />
            </div>

            {/* Save status pill + what the server reported about that save */}
            <div className="relative shrink-0">
                <SaveStatusPill
                    status={saveStatus}
                    error={saveError}
                    onRetry={onFlush}
                    noticeCount={notices.length}
                    noticesOpen={noticesOpen}
                    onToggleNotices={() => setNoticesOpen((open) => !open)}
                />
                {noticesOpen ? (
                    <SaveNoticesPanel
                        notices={notices}
                        onShow={showNotice}
                        onClose={() => setNoticesOpen(false)}
                    />
                ) : null}
            </div>

            {/* Undo / redo */}
            <IconButton ariaLabel="Undo" size="md" disabled={!canUndo || streamLock} onClick={onUndo}>
                <Undo2 />
            </IconButton>
            <IconButton ariaLabel="Redo" size="md" disabled={!canRedo || streamLock} onClick={onRedo}>
                <Redo2 />
            </IconButton>

            {/* Version history */}
            <IconButton
                ariaLabel="Version history"
                size="md"
                disabled={streamLock}
                onClick={() => setVersionsOpen(true)}
            >
                <History />
            </IconButton>

            {/* View as role */}
            <label className="inline-flex items-center gap-1.5 text-xs" title="Preview which screens and components a role sees">
                <Eye className="h-3.5 w-3.5" style={{ color: previewRole ? 'var(--accent-primary)' : 'var(--text-tertiary)' }} aria-hidden="true" />
                <span style={{ color: 'var(--text-tertiary)' }}>Viewing as:</span>
                <select
                    value={previewRole || 'owner'}
                    onChange={(e) => setPreviewRole(e.target.value === 'owner' ? null : e.target.value)}
                    aria-label="View as role"
                    className="rounded border px-1.5 py-1 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-hover)]"
                    style={{
                        background: 'var(--bg-secondary)',
                        borderColor: previewRole ? 'var(--accent-primary)' : 'var(--border-default)',
                        color: 'var(--text-primary)',
                    }}
                >
                    <option value="owner">Owner (full view)</option>
                    {roles.map((r) => <option key={r.id} value={r.id}>{r.name || r.id}</option>)}
                </select>
            </label>

            {/* Data (tables designer) */}
            <button
                type="button"
                disabled={streamLock}
                onClick={() => setTablesOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-[var(--bg-tertiary)] disabled:opacity-50"
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
            >
                <Database className="h-3.5 w-3.5" style={{ color: 'var(--accent-primary)' }} aria-hidden="true" />
                Data
            </button>

            {/* Variables (the app's shared named values) */}
            <button
                type="button"
                disabled={streamLock}
                onClick={() => setVariablesOpen(true)}
                title="The named values your screens and actions share"
                className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-[var(--bg-tertiary)] disabled:opacity-50"
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
            >
                <Braces className="h-3.5 w-3.5" style={{ color: 'var(--accent-primary)' }} aria-hidden="true" />
                Variables
                {variableCount ? (
                    <span className="rounded-full px-1.5 text-[10px]" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                        {variableCount}
                    </span>
                ) : null}
            </button>

            {/* Roles (RBAC authoring) */}
            <button
                type="button"
                disabled={streamLock}
                onClick={() => setRolesOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-[var(--bg-tertiary)] disabled:opacity-50"
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
            >
                <ShieldCheck className="h-3.5 w-3.5" style={{ color: 'var(--accent-primary)' }} aria-hidden="true" />
                Roles
            </button>

            {/* Publish */}
            <button
                type="button"
                disabled={streamLock}
                onClick={() => setPublishOpen(true)}
                title={publishState === 'behind'
                    ? 'The version people use is older than what you see here — publish to make these changes live.'
                    : publishState === 'current'
                        ? 'Everything on this canvas is live.'
                        : 'Choose who can use this app'}
                className={publishState === 'current'
                    ? 'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-[var(--bg-tertiary)] disabled:opacity-50'
                    : 'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50'}
                style={publishState === 'current'
                    ? { borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }
                    : { background: 'var(--accent-primary)' }}
            >
                {publishState === 'current'
                    ? <Check className="h-3.5 w-3.5" style={{ color: '#10b981' }} aria-hidden="true" />
                    : <UploadCloud className="h-3.5 w-3.5" aria-hidden="true" />}
                {publishState === 'current' ? 'Published — up to date' : null}
                {publishState === 'behind' ? 'Publish changes' : null}
                {publishState === 'unknown' ? 'Publish' : null}
                {publishState === 'behind' ? (
                    <span className="h-1.5 w-1.5 rounded-full bg-white" aria-hidden="true" />
                ) : null}
            </button>

            {/* Close */}
            <IconButton ariaLabel="Close editor" size="md" onClick={handleClose}>
                <X />
            </IconButton>

            {/* ---- Publish modal ---- */}
            {/* Mounted only while open: PublishModal runs react-query
                (useOrgDirectory) for the group picker, so keeping it out of the
                tree until needed avoids requiring a QueryClient for the whole
                editor chrome (same rationale as TablesManager below). */}
            {publishOpen ? (
                <PublishModal
                    open={publishOpen}
                    onClose={() => setPublishOpen(false)}
                    app={app}
                    onPublished={onAppUpdated}
                    // The live draft, not app.definition — publish validates what
                    // the canvas holds, so a blocker's path resolves against it.
                    definition={definition}
                    onRevealNode={({ nodeId, screenId }) => {
                        if (screenId) dispatch({ type: 'set_screen', screenId });
                        if (nodeId) dispatch({ type: 'select_node', nodeId });
                    }}
                />
            ) : null}

            {/* ---- Version history modal ---- */}
            <Modal
                open={versionsOpen}
                onClose={() => setVersionsOpen(false)}
                title="Version history"
                description="Restoring creates a new version — nothing is lost."
                size="lg"
            >
                {versions === null ? (
                    <div className="flex items-center gap-2 py-6 text-sm" style={{ color: 'var(--text-tertiary)' }}>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        Loading versions…
                    </div>
                ) : versions.length === 0 ? (
                    <p className="py-6 text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>
                        No saved versions yet — versions appear when the app is published or restored.
                    </p>
                ) : (
                    <ul className="divide-y" style={{ borderColor: 'var(--border-default)' }}>
                        {versions.map((entry) => {
                            const versionId = entry.id ?? entry.versionId ?? entry.version;
                            const createdAt = entry.createdAt || entry.created_at;
                            return (
                                <li key={versionId} className="flex items-center gap-3 py-2.5">
                                    <div className="min-w-0 flex-1">
                                        <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                                            {entry.label || `Version ${entry.version ?? versionId}`}
                                        </div>
                                        <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                                            {createdAt ? new Date(createdAt).toLocaleString() : ''}
                                            {entry.createdByName ? ` · ${entry.createdByName}` : ''}
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        disabled={restoringId != null}
                                        onClick={() => doRestore(entry)}
                                        className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-[var(--bg-tertiary)] disabled:opacity-50"
                                        style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                    >
                                        {restoringId === versionId
                                            ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                                            : <History className="h-3 w-3" aria-hidden="true" />}
                                        Restore
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </Modal>

            {/* ---- Autosave conflict dialog ---- */}
            {/* Two real choices, so a Modal with explicit buttons: Escape/backdrop
                merely dismisses — the conflict resurfaces on the next save attempt,
                and dismissal must never silently overwrite someone's work. */}
            <Modal
                open={!!conflict}
                onClose={() => onConflictDismiss?.()}
                title="This app changed in another tab"
                description="Someone (or another tab) saved a newer version while you were editing."
                size="md"
                footer={(
                    <>
                        <button
                            type="button"
                            onClick={onConflictOverwrite}
                            className="rounded-lg bg-white/5 px-4 py-2 text-sm hover:bg-[var(--bg-card-hover)]"
                            style={{ color: 'var(--text-primary)' }}
                        >
                            Overwrite with mine
                        </button>
                        <button
                            type="button"
                            onClick={onConflictLoadLatest}
                            className="rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
                            style={{ background: 'var(--accent-primary)' }}
                        >
                            Load latest
                        </button>
                    </>
                )}
            >
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <strong>Load latest</strong> replaces your canvas with the newer version (your unsaved
                    changes are kept in this tab&rsquo;s undo history). <strong>Overwrite with mine</strong> saves
                    your canvas over the newer version.
                </p>
            </Modal>

            {/* ---- Variables modal ----
                Unlike the roles panel this stages nothing: every edit commits
                straight through definitionOps and onCommit, so it undoes with
                ⌘Z like any other change and there is no unsaved-work branch. */}
            <Modal
                open={variablesOpen}
                onClose={() => setVariablesOpen(false)}
                title="Variables"
                description="Named values your screens and actions share — formulas read them as vars.&lt;name&gt;."
                size="lg"
            >
                {variablesOpen ? (
                    <VariablesManager
                        definition={definition}
                        onCommit={onCommit}
                        disabled={streamLock}
                        onRevealNode={({ nodeId, screenId: target }) => {
                            if (target) dispatch({ type: 'set_screen', screenId: target });
                            if (nodeId) dispatch({ type: 'select_node', nodeId });
                            setVariablesOpen(false);
                        }}
                    />
                ) : null}
            </Modal>

            {/* ---- Roles / access modal ----
                Panels stay MOUNTED and are toggled with `hidden`: RolesManager and
                RowRuleEditor hold their edits in local draft state that only "Save"
                persists, so unmounting a tab (or the modal) silently threw that work
                away. They report through onDirtyChange so closing can be guarded. */}
            <Modal
                open={rolesOpen}
                onClose={requestRolesClose}
                title="Roles &amp; access"
                description="Decide who gets which role, what each role sees, and which rows they can touch."
                size="xl"
            >
                <div className="flex flex-col gap-4">
                    <Tabs
                        value={rolesTab}
                        onChange={setRolesTab}
                        ariaLabel="Roles and access"
                        items={[
                            { id: 'roles', label: 'Roles' },
                            { id: 'access', label: 'Screen access' },
                            { id: 'rules', label: 'Row rules' },
                        ]}
                    />
                    <div hidden={rolesTab !== 'roles'}>
                        <RolesManager
                            appId={app?.id}
                            definition={definition}
                            onCommit={onCommit}
                            onDirtyChange={(d) => setRolesDirty((prev) => ({ ...prev, roles: d }))}
                        />
                    </div>
                    <div hidden={rolesTab !== 'access'}>
                        <AccessMatrix appId={app?.id} definition={definition} onCommit={onCommit} />
                    </div>
                    <div hidden={rolesTab !== 'rules'}>
                        <RowRuleEditor
                            appId={app?.id}
                            onDirtyChange={(d) => setRolesDirty((prev) => ({ ...prev, rules: d }))}
                        />
                    </div>
                </div>
            </Modal>

            <ConfirmDialog
                open={rolesCloseConfirm}
                title="Close without saving?"
                description="Your changes to roles and row rules have not been saved yet. Closing now discards them."
                confirmLabel="Discard changes"
                cancelLabel="Keep editing"
                destructive
                onConfirm={() => { setRolesCloseConfirm(false); setRolesOpen(false); }}
                onCancel={() => setRolesCloseConfirm(false)}
            />

            {/* ---- Tables (data model designer) ---- */}
            {/* Mounted only while open: TablesManager runs react-query (useAppTables),
                so keeping it out of the tree until needed avoids requiring a
                QueryClient for the whole editor chrome. */}
            {tablesOpen ? (
                <TablesManager
                    open={tablesOpen}
                    onClose={() => setTablesOpen(false)}
                    appId={app?.id}
                    definition={definition}
                    screenId={screenId}
                    onCommit={onCommit}
                    dispatch={dispatch}
                />
            ) : null}

            {/* ---- Command palette (⌘K) ---- */}
            <CommandPalette open={!!commandOpen} onClose={closeCommand} actions={commandActions} />
        </header>

        {/* View-as-role banner — a subtle strip while previewing a role. */}
        {previewRole ? (
            <div
                className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 border-b px-3 py-1.5 text-xs"
                data-preview-role-banner={previewRole}
                style={{
                    borderColor: 'var(--border-default)',
                    background: 'color-mix(in srgb, var(--accent-primary) 10%, transparent)',
                    color: 'var(--text-secondary)',
                }}
            >
                <Eye className="h-3.5 w-3.5" style={{ color: 'var(--accent-primary)' }} aria-hidden="true" />
                <span>
                    Previewing as <strong style={{ color: 'var(--text-primary)' }}>
                        {roles.find((r) => r.id === previewRole)?.name || previewRole}
                    </strong> — screens and components hidden from this role are hidden here.
                    Lists and tables still show everything you can see; each person only gets their
                    own rows once they open the app themselves.
                </span>
                <button
                    type="button"
                    onClick={() => setPreviewRole(null)}
                    className="font-semibold underline underline-offset-2"
                    style={{ color: 'var(--accent-primary)' }}
                >
                    Exit preview
                </button>
            </div>
        ) : null}
        </>
    );
}

/**
 * The pill stays SILENT when the last save had nothing to report — a green
 * "Saved" that fades out. It only turns into a button (and outlives the fade)
 * when the server actually said something, so it can never nag.
 */
function SaveStatusPill({ status, error, onRetry, noticeCount, noticesOpen, onToggleNotices }) {
    if (status === 'saving') {
        return (
            <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium"
                style={{ color: 'var(--text-tertiary)' }}
                role="status"
            >
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                Saving…
            </span>
        );
    }
    if (status === 'error') {
        return (
            <span
                className="inline-flex max-w-64 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium"
                style={{ borderColor: 'color-mix(in srgb, var(--error) 40%, transparent)', color: 'var(--error)', background: 'color-mix(in srgb, var(--error) 8%, transparent)' }}
                role="status"
            >
                <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span className="truncate" title={error || 'Saving failed'}>{error || 'Saving failed'}</span>
                {/* The line above is the FIRST of several — offer the rest. */}
                {noticeCount > 1 ? (
                    <button
                        type="button"
                        onClick={onToggleNotices}
                        aria-expanded={noticesOpen}
                        className="shrink-0 font-semibold underline underline-offset-2"
                    >
                        All {noticeCount}
                    </button>
                ) : null}
                <button type="button" onClick={onRetry} className="shrink-0 font-semibold underline underline-offset-2">
                    Retry
                </button>
            </span>
        );
    }
    if (noticeCount > 0) {
        return (
            <button
                type="button"
                onClick={onToggleNotices}
                aria-expanded={noticesOpen}
                className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium"
                style={{ borderColor: 'rgba(245, 158, 11, 0.4)', color: '#d97706', background: 'rgba(245, 158, 11, 0.08)' }}
            >
                <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
                {status === 'saved' ? 'Saved · ' : ''}
                {noticeCount === 1 ? '1 thing to check' : `${noticeCount} things to check`}
            </button>
        );
    }
    if (status === 'saved') {
        return (
            <span
                className="ase-saved-fade inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium"
                style={{ color: 'var(--text-tertiary)' }}
                role="status"
            >
                <Check className="h-3 w-3" style={{ color: '#10b981' }} aria-hidden="true" />
                Saved
            </span>
        );
    }
    return null;
}

/** The list behind the pill: one row per server entry, in the server's words. */
function SaveNoticesPanel({ notices, onShow, onClose }) {
    return (
        <div
            role="dialog"
            aria-label="What the last save reported"
            className="absolute right-0 top-full z-30 mt-1 w-80 rounded-lg border p-2 shadow-lg"
            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}
        >
            <div className="flex items-center justify-between gap-2 px-1 pb-1.5">
                <span className="text-[11px] font-semibold" style={{ color: 'var(--text-tertiary)' }}>
                    From the last save
                </span>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="rounded p-0.5 hover:bg-[var(--bg-tertiary)]"
                    style={{ color: 'var(--text-tertiary)' }}
                >
                    <X className="h-3 w-3" aria-hidden="true" />
                </button>
            </div>
            <ul className="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
                {notices.map((entry, i) => (
                    <li
                        key={`${entry.kind}-${entry.path}-${i}`}
                        className="rounded-md px-2 py-1.5"
                        style={{ background: 'var(--bg-tertiary)' }}
                    >
                        <div className="text-xs" style={{ color: 'var(--text-primary)' }}>{entry.message}</div>
                        {entry.hint ? (
                            <div className="mt-0.5 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>{entry.hint}</div>
                        ) : null}
                        {entry.target ? (
                            <button
                                type="button"
                                onClick={() => onShow(entry)}
                                className="mt-1 text-[11px] font-semibold underline underline-offset-2"
                                style={{ color: 'var(--accent-primary)' }}
                            >
                                Show me
                            </button>
                        ) : null}
                    </li>
                ))}
            </ul>
        </div>
    );
}
