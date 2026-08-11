import {
    DndContext,
    DragOverlay,
    KeyboardSensor,
    PointerSensor,
    closestCorners,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { PanelRightClose, PanelRightOpen, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Canvas from './Canvas';
import ComponentRibbon from './ComponentRibbon';
import { computeDragEnd, resolveDrop, screenIdFromScreenTabDroppable } from './dnd';
import { computeDropHint, DropHintContext } from './dropHint';
import { EditorChromeContext } from './EditorChromeContext';
import EditorHeader from './EditorHeader';
import ScreenTabs from './ScreenTabs';
import useEditorHotkeys from './useEditorHotkeys';
import useDraftHistory from '../../../../../hooks/useDraftHistory';
import scopedStorage from '../../../../../utils/scopedStorage';
import PanelResizer from '../../../../shared/PanelResizer';
import toast from '../../../../shared/Toast';
import InspectorPanel from '../inspector/InspectorPanel';
import { APP_COMPONENT_TYPES } from '../runtime/componentRegistry';
import { AppEditorProvider, useAppEditor } from '../state/AppEditorContext';
import { findNode, moveNode } from '../state/definitionOps';
import useAppAutosave from '../state/useAppAutosave';
import { studioAppsApi } from '../studioAppsApi';
import './editor.css';

/**
 * App Studio editor — the shell that owns the editing data flow.
 *
 * Props (contract — a sibling module imports this):
 *   { app, onClose, onAppUpdated?, chatSlot? }
 *
 * Composition:
 *   - AppEditorProvider seeds the reducer store from `app`.
 *   - useDraftHistory owns undo/redo; commitDefinition (= history.commit) is
 *     THE single entry point every edit goes through — header, tabs, palette,
 *     canvas, inspector and hotkeys all receive it as onCommit.
 *   - useAppAutosave debounces saves of the draft; conflicts surface as a
 *     dialog in the header (load latest vs overwrite — never auto-retried).
 *   - One DndContext for palette→canvas and canvas↔canvas drags. onDragOver
 *     applies CROSS-PARENT moves transiently (plain set_definition, no
 *     history); the pre-drag snapshot is restored on drop/cancel and the
 *     final result lands as ONE history commit, so Cmd+Z undoes a whole drag.
 *     The DragOverlay is always a compact chip (icon + label), never the
 *     live component.
 *
 * Layout: LEFT chatSlot (or a slim Sparkles rail until the AI pane lands in
 * a later phase) · CENTER header/tabs/canvas · RIGHT InspectorPanel
 * (edit mode only — preview gives the app the full width).
 */

export default function AppEditorShell({ app, onClose, onAppUpdated, chatSlot }) {
    return (
        <AppEditorProvider app={app}>
            <EditorChrome app={app} onClose={onClose} onAppUpdated={onAppUpdated} chatSlot={chatSlot} />
        </AppEditorProvider>
    );
}

// Inspector column. 260px still fits a label+control row; 560px is where a
// binding editor stops needing its own scrollbar.
const INSPECTOR_WIDTH_KEY = 'appStudioInspectorWidth';
const INSPECTOR_OPEN_KEY = 'appStudioInspectorOpen';
const INSPECTOR_DEFAULT_WIDTH = 320;
const INSPECTOR_MIN_WIDTH = 260;
const INSPECTOR_MAX_WIDTH = 560;

function EditorChrome({ app, onClose, onAppUpdated, chatSlot }) {
    const { definition, version, screenId, mode, streamLock, dispatch } = useAppEditor();

    // Refs for event handlers that must never read a stale render (drag
    // events and async saves fire between renders, after effects).
    const definitionRef = useRef(definition);
    const screenIdRef = useRef(screenId);
    useEffect(() => {
        definitionRef.current = definition;
        screenIdRef.current = screenId;
    });

    // ---- history (undo/redo) ----------------------------------------------
    const apply = useCallback(
        (def) => dispatch({ type: 'set_definition', definition: def }),
        [dispatch],
    );
    const history = useDraftHistory({ currentDraft: definition, apply });
    const commitDefinition = history.commit;

    // Set for the whole duration of a drag (it also drives the DragOverlay chip
    // below); declared up here because autosave has to see it.
    const [activeDrag, setActiveDrag] = useState(null);
    // Where the drag would land, so the canvas can draw a line there. Without
    // it a reorder inside one container showed nothing at all until you let go.
    const [dropHint, setDropHint] = useState(null);

    // ---- autosave + conflicts ----------------------------------------------
    const [conflict, setConflict] = useState(null);
    // What the server said about the LAST save: { warnings, repairs } on a
    // clean save, { errors, warnings } on a 422. The header renders it on the
    // save pill — the server writes these in plain English and dropping them
    // left the user with a bare status and no idea what was touched.
    const [saveNotices, setSaveNotices] = useState(null);
    const { flush, status: saveStatus, error: saveError, markSaved } = useAppAutosave({
        appId: app?.id,
        definition,
        version,
        // Paused during an AI turn: the builder route persists every draft
        // itself, so autosaving mid-stream would double-write (and race the
        // version). BuilderChatPane calls markSaved with the final draft.
        // Paused during a drag as well: onDragOver applies cross-parent
        // reparents TRANSIENTLY, and a drag that outlives the debounce — or one
        // the user cancels — must never be what gets persisted. finishDrag
        // restores the snapshot before the pause lifts, so the save that
        // follows is of the committed result.
        enabled: !!app?.id && !streamLock && !activeDrag,
        onSaved: useCallback((v, notices) => {
            dispatch({ type: 'set_version', version: v });
            setSaveNotices(notices || null);
        }, [dispatch]),
        onConflict: useCallback((payload) => setConflict(payload), []),
        onInvalid: useCallback((payload) => setSaveNotices(payload), []),
    });

    /**
     * Adopt a server-confirmed definition AND clear undo history. Only for a
     * hard reset point — a version RESTORE (EditorHeader.doRestore) or an
     * initial load — where the prior in-memory edits are genuinely gone.
     */
    const { reset: resetHistory } = history;
    const onServerDefinition = useCallback((def, ver) => {
        dispatch({ type: 'set_definition', definition: def, version: ver });
        resetHistory();
        markSaved(def, ver);
    }, [dispatch, resetHistory, markSaved]);

    /**
     * Adopt a server definition WITHOUT clearing undo history — the conflict
     * dialog's "Load latest" promises the user's unsaved changes stay in this
     * tab's undo history, so an undo-after-load must still work. Snapshots are
     * version-independent; autosave re-saves the undone state as a new version.
     */
    const onConflictLoadLatest = useCallback(() => {
        if (!conflict) return;
        dispatch({ type: 'set_definition', definition: conflict.definition, version: conflict.currentVersion });
        markSaved(conflict.definition, conflict.currentVersion);
        setConflict(null);
    }, [conflict, dispatch, markSaved]);

    const overwriteInFlightRef = useRef(false);
    const onConflictOverwrite = useCallback(async () => {
        if (!conflict || overwriteInFlightRef.current) return; // ignore double-clicks
        overwriteInFlightRef.current = true;
        // Snapshot the definition NOW: an edit made during the round-trip must
        // not be marked saved-but-never-saved, so the SAME reference feeds both
        // the save request and markSaved.
        const def = definitionRef.current;
        const baseVersion = conflict.currentVersion;
        setConflict(null);
        try {
            const res = await studioAppsApi.saveDefinition(app.id, def, baseVersion);
            if (res.ok) {
                dispatch({ type: 'set_version', version: res.version });
                markSaved(def, res.version);
            } else if (res.conflict) {
                setConflict({ currentVersion: res.currentVersion, definition: res.definition });
            } else if (res.invalid) {
                const first = Array.isArray(res.errors) && res.errors.length ? res.errors[0] : null;
                toast.error((typeof first === 'string' ? first : first?.message) || 'The app definition is invalid.');
            }
        } catch (err) {
            toast.error(err?.message || 'Saving failed.');
        } finally {
            overwriteInFlightRef.current = false;
        }
    }, [conflict, app?.id, dispatch, markSaved]);

    // ---- command palette (⌘K) ----------------------------------------------
    const [commandOpen, setCommandOpen] = useState(false);

    // ---- hotkeys ------------------------------------------------------------
    useEditorHotkeys({
        enabled: true,
        onUndo: history.undo,
        onRedo: history.redo,
        onFlush: flush,
        onCommit: commitDefinition,
        onCommandPalette: useCallback(() => setCommandOpen((o) => !o), []),
    });

    // ---- drag & drop --------------------------------------------------------
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );
    const dragSnapshotRef = useRef(null);
    // Deferred one-entry history commit, shared by drag&drop and the AI turn:
    // both first restore a pre-change snapshot via plain set_definition, then
    // let the effect below commit the real result AFTER that render — when
    // useDraftHistory sees the snapshot as current — so exactly one history
    // entry captures the whole gesture/turn.
    const pendingCommitRef = useRef(null);

    const handleDragStart = useCallback((event) => {
        dragSnapshotRef.current = definitionRef.current;
        const data = event.active?.data?.current || {};
        const type = data.type === 'palette' ? data.componentType : data.node?.type;
        const entry = APP_COMPONENT_TYPES[type];
        setActiveDrag({ label: entry?.label || type || 'Component', Icon: entry?.icon || null });
    }, []);

    // Transient CROSS-PARENT preview: the node really moves in the draft so
    // the target section/container makes room — but via plain set_definition,
    // never a commit. Same-parent reorders preview only via the DragOverlay
    // (applying them live makes items oscillate under the pointer).
    const handleDragOver = useCallback((event) => {
        if (!dragSnapshotRef.current) return;
        const data = event.active?.data?.current || {};
        const isPalette = data.type === 'palette';
        // The indicator is computed for EVERY drag, including palette ones —
        // "where will this land?" is the question a palette drag asks loudest.
        setDropHint(computeDropHint({
            active: event.active,
            over: event.over,
            definition: definitionRef.current,
            isPalette,
        }));
        if (!event.over) return;
        if (isPalette) return; // palette inserts happen on drop
        // A cross-screen drop is resolved on drop only — never transiently
        // reparent onto a screen the user can't see (the node would vanish
        // mid-drag). The single commit still lands in finishDrag/resolveDrop.
        if (screenIdFromScreenTabDroppable(event.over.id)) return;
        const def = definitionRef.current;
        const res = computeDragEnd({
            active: event.active,
            over: event.over,
            definition: def,
            screenId: screenIdRef.current,
        });
        if (!res || res.op !== 'move') return;
        const found = findNode(def, res.nodeId);
        if (!found || found.parent.id === res.toParentId) return;
        const next = moveNode(def, res.nodeId, {
            toParentId: res.toParentId,
            index: res.index ?? undefined,
        });
        if (next !== def) dispatch({ type: 'set_definition', definition: next });
    }, [dispatch]);

    const finishDrag = useCallback((event, cancelled) => {
        const snapshot = dragSnapshotRef.current;
        // The live draft carries any transient dragOver reparent; capture it
        // BEFORE we restore the snapshot below so resolveDrop can fall back to
        // it when the drop lands on the node itself (see dnd.resolveDrop).
        const liveDefinition = definitionRef.current;
        dragSnapshotRef.current = null;
        setActiveDrag(null);
        setDropHint(null);
        if (!snapshot) return;
        // Restore the pre-drag definition first: transient dragOver moves
        // must never enter history. The effect below runs after this render,
        // when useDraftHistory sees `snapshot` as current, and commits the
        // real result computed against the SNAPSHOT — one history entry.
        dispatch({ type: 'set_definition', definition: snapshot });
        if (cancelled || !event.over) return;
        const resolved = resolveDrop({
            snapshot,
            liveDefinition,
            active: event.active,
            over: event.over,
            screenId: screenIdRef.current,
        });
        if (!resolved) return;
        // A drop on a screen tab moves the node onto another screen — follow it
        // there so the user sees where it landed.
        const toScreen = screenIdFromScreenTabDroppable(event.over.id);
        pendingCommitRef.current = {
            def: resolved.def,
            select: resolved.nodeId,
            pulse: resolved.op === 'insert' ? resolved.nodeId : null,
            screen: toScreen || undefined,
        };
    }, [dispatch]);

    useEffect(() => {
        const pending = pendingCommitRef.current;
        if (!pending) return;
        pendingCommitRef.current = null;
        commitDefinition(pending.def);
        if (pending.select) dispatch({ type: 'select_node', nodeId: pending.select });
        if (pending.pulse) dispatch({ type: 'set_recent_ids', ids: [pending.pulse] });
        // An AI turn may have moved the user to a screen that only exists in
        // the final draft; re-assert it after the snapshot round-trip.
        if (pending.screen) dispatch({ type: 'set_screen', screenId: pending.screen });
    });

    // ---- AI builder turn (chat pane) ----------------------------------------
    // The pre-turn snapshot is captured when streamLock flips on (the pane
    // locks BEFORE the first transient draft lands), so commitTurn can record
    // the whole AI turn as ONE undoable history entry.
    const turnBaseRef = useRef(null);
    useEffect(() => {
        if (streamLock) turnBaseRef.current = definitionRef.current;
    }, [streamLock]);

    const commitTurn = useCallback((finalDef) => {
        if (!finalDef) return;
        const base = turnBaseRef.current;
        turnBaseRef.current = null;
        if (base && base !== finalDef) {
            // Same trick as finishDrag: restore the pre-turn snapshot first
            // (plain set_definition — transient drafts never enter history),
            // then the pending-commit effect above lands the final draft as
            // one history entry against that snapshot.
            dispatch({ type: 'set_definition', definition: base });
            pendingCommitRef.current = { def: finalDef, screen: screenIdRef.current };
        } else {
            commitDefinition(finalDef);
        }
    }, [dispatch, commitDefinition]);

    // appId is exposed here so the inspector's BI "Configure data" builder can
    // reach the data API without threading a prop through every panel.
    // undoTurn = the shell's single history.undo — the chat pane's "Undo turn"
    // affordance reuses it (an AI turn is committed as ONE history entry, so one
    // undo reverts the whole turn).
    const chrome = useMemo(
        () => ({ commitTurn, markSaved, flush, appId: app?.id ?? null, undoTurn: history.undo }),
        [commitTurn, markSaved, flush, app?.id, history.undo],
    );

    // ---- inspector width -----------------------------------------------------
    // A fixed 320px column on a 1920px screen is not a layout decision, it is
    // the absence of one: it is too narrow for a binding editor and too wide
    // for a screen where you are only nudging spans. Collapsing it gives the
    // canvas 320px back, which on a phone-shaped app preview is the difference
    // between seeing the whole screen and scrolling it.
    const [inspectorWidth, setInspectorWidth] = useState(
        () => parseInt(scopedStorage.getItem(INSPECTOR_WIDTH_KEY), 10) || INSPECTOR_DEFAULT_WIDTH,
    );
    const [inspectorOpen, setInspectorOpen] = useState(
        () => scopedStorage.getItem(INSPECTOR_OPEN_KEY) !== '0',
    );
    const persistInspectorWidth = useCallback((w) => {
        scopedStorage.setItem(INSPECTOR_WIDTH_KEY, String(w));
    }, []);
    const toggleInspector = useCallback(() => {
        setInspectorOpen((open) => {
            scopedStorage.setItem(INSPECTOR_OPEN_KEY, open ? '0' : '1');
            return !open;
        });
    }, []);

    // ---- inspector test-action results feed the edit canvas ------------------
    const [testActionState, setTestActionState] = useState({});
    const onTestActionResult = useCallback((actionId, entry) => {
        if (!actionId) return;
        setTestActionState((prev) => ({ ...prev, [actionId]: entry }));
    }, []);

    return (
        <EditorChromeContext.Provider value={chrome}>
        <div
            className="flex h-full min-h-0 w-full"
            style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
        >
            {/* LEFT — AI chat pane (later phase) or its collapsed rail */}
            {chatSlot ? (
                <aside
                    className="flex w-[340px] shrink-0 flex-col border-r min-h-0"
                    style={{ borderColor: 'var(--border-default)' }}
                >
                    {chatSlot}
                </aside>
            ) : (
                <aside
                    className="flex w-10 shrink-0 flex-col items-center border-r pt-3"
                    style={{ borderColor: 'var(--border-default)' }}
                    aria-label="AI assistant (coming soon)"
                >
                    <span
                        className="rounded-md p-1.5"
                        style={{ color: 'var(--text-tertiary)' }}
                        title="AI assistant — coming soon"
                    >
                        <Sparkles className="h-4 w-4" aria-hidden="true" />
                    </span>
                </aside>
            )}

            {/* CENTER — header + tabs + canvas share the DndContext with the palette */}
            <div className="flex min-w-0 flex-1 flex-col min-h-0">
                <DropHintContext.Provider value={dropHint}>
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCorners}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDragEnd={(event) => finishDrag(event, false)}
                    onDragCancel={(event) => finishDrag(event, true)}
                >
                    <EditorHeader
                        app={app}
                        onAppUpdated={onAppUpdated}
                        onClose={onClose}
                        onCommit={commitDefinition}
                        canUndo={history.canUndo}
                        canRedo={history.canRedo}
                        onUndo={history.undo}
                        onRedo={history.redo}
                        saveStatus={saveStatus}
                        saveError={saveError}
                        saveNotices={saveNotices}
                        onFlush={flush}
                        conflict={conflict}
                        onConflictLoadLatest={onConflictLoadLatest}
                        onConflictOverwrite={onConflictOverwrite}
                        onConflictDismiss={() => setConflict(null)}
                        onServerDefinition={onServerDefinition}
                        commandOpen={commandOpen}
                        onCommandOpenChange={setCommandOpen}
                    />
                    {mode === 'edit' ? <ScreenTabs onCommit={commitDefinition} /> : null}
                    {mode === 'edit' ? <ComponentRibbon onCommit={commitDefinition} /> : null}
                    <Canvas app={app} onCommit={commitDefinition} editActionState={testActionState} />
                    <DragOverlay dropAnimation={null}>
                        {activeDrag ? <DragChip label={activeDrag.label} Icon={activeDrag.Icon} /> : null}
                    </DragOverlay>
                </DndContext>
                </DropHintContext.Provider>
            </div>

            {/* RIGHT — inspector (edit mode only; preview gets the full width) */}
            {mode === 'edit' ? (inspectorOpen ? (
                <>
                    <PanelResizer
                        width={inspectorWidth}
                        min={INSPECTOR_MIN_WIDTH}
                        max={INSPECTOR_MAX_WIDTH}
                        defaultWidth={INSPECTOR_DEFAULT_WIDTH}
                        edge="end"
                        onResize={setInspectorWidth}
                        onResizeEnd={persistInspectorWidth}
                        label="Resize the inspector"
                    />
                    <aside
                        aria-label="Inspector"
                        className="shrink-0 overflow-y-auto border-l min-h-0"
                        style={{ width: inspectorWidth, borderColor: 'var(--border-default)' }}
                    >
                        <div className="flex justify-end px-2 pt-2">
                            <button
                                type="button"
                                onClick={toggleInspector}
                                aria-label="Collapse the inspector"
                                title="Collapse the inspector"
                                className="rounded-md p-1 hover:bg-[var(--bg-card-hover)]"
                                style={{ color: 'var(--text-tertiary)' }}
                            >
                                <PanelRightClose className="h-4 w-4" aria-hidden="true" />
                            </button>
                        </div>
                        <InspectorPanel onCommit={commitDefinition} onTestActionResult={onTestActionResult} />
                    </aside>
                </>
            ) : (
                <aside
                    className="flex w-10 shrink-0 flex-col items-center border-l pt-3"
                    style={{ borderColor: 'var(--border-default)' }}
                >
                    <button
                        type="button"
                        onClick={toggleInspector}
                        aria-label="Show the inspector"
                        title="Show the inspector"
                        className="rounded-md p-1.5 hover:bg-[var(--bg-card-hover)]"
                        style={{ color: 'var(--text-tertiary)' }}
                    >
                        <PanelRightOpen className="h-4 w-4" aria-hidden="true" />
                    </button>
                </aside>
            )) : null}
        </div>
        </EditorChromeContext.Provider>
    );
}

function DragChip({ label, Icon }) {
    return (
        <div
            className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium shadow-lg"
            style={{
                background: 'var(--bg-secondary)',
                borderColor: 'var(--accent-primary)',
                color: 'var(--text-primary)',
            }}
        >
            {Icon ? <Icon className="h-3.5 w-3.5" style={{ color: 'var(--accent-primary)' }} aria-hidden="true" /> : null}
            {label}
        </div>
    );
}
