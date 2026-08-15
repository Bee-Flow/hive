import { useDroppable } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import { MousePointerClick, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { buildNode, sectionDroppableId } from './dnd';
import { useEditorChrome } from './EditorChromeContext';
import EditorNodeWrapper from './EditorNodeWrapper';
import Marquee from './Marquee';
import toast from '../../../../shared/Toast';
import AppDataScope from '../runtime/AppDataScope';
import AppRenderer from '../runtime/AppRenderer';
import AppShell from '../runtime/AppShell';
import AppFontLoader from '../runtime/AppFontLoader';
import { APP_COMPONENT_TYPES } from '../runtime/componentRegistry';
import { buildScope } from '../runtime/RuntimeContext';
import useActionRunner from '../runtime/useActionRunner';
import useConfirmDialog from '../runtime/useConfirmDialog';
import { useAppEditor } from '../state/AppEditorContext';
import { findScreen, insertNode } from '../state/definitionOps';
import './editor.css';

/**
 * App Studio editor — the canvas: a scrollable neutral surface around the
 * shared runtime renderer.
 *
 *   edit mode    — AppRenderer with NodeWrapper=EditorNodeWrapper inside ONE
 *                  SortableContext per screen (see dnd.js for the design
 *                  note). Actions are stubbed: navigate really switches the
 *                  canvas screen; run_automation explains itself in a toast.
 *                  Empty sections get a droppable "drag here" placeholder,
 *                  PORTALED into the renderer's own <section> element so it
 *                  sits exactly where dropped components will land — the
 *                  runtime stays editor-free that way.
 *   preview mode — the real thing: AppShell chrome + run-mode renderer with
 *                  useActionRunner against the DRAFT definition, so preview
 *                  actions actually execute.
 *
 * While streamLock is on, a translucent overlay (opacity transition only)
 * blocks all canvas interaction and shows an "AI is editing…" chip.
 */

const EMPTY_ACTION_STATE = {};

// The quickest way out of a blank page, straight on the placeholder. They add
// through exactly the same path as click-to-add in the ribbon.
const STARTER_CHIPS = ['heading', 'text', 'button'];

function SectionDropZone({ sectionId, container, onAddStarter, disabled }) {
    const { setNodeRef, isOver } = useDroppable({
        id: sectionDroppableId(sectionId),
        data: { type: 'section', sectionId },
    });
    return createPortal(
        <div
            ref={setNodeRef}
            data-section-dropzone={sectionId}
            className="flex flex-col items-center justify-center gap-3 border border-dashed px-4 py-8 text-sm select-none"
            style={{
                gridColumn: '1 / -1',
                borderRadius: 'var(--app-radius, 8px)',
                borderColor: isOver ? 'var(--editor-accent)' : 'var(--border-default)',
                background: isOver ? 'color-mix(in srgb, var(--editor-accent) 8%, transparent)' : 'transparent',
                color: 'var(--text-tertiary)',
            }}
        >
            <span className="flex items-center gap-2 text-center">
                <MousePointerClick className="w-4 h-4 shrink-0" aria-hidden="true" />
                Drag a component from the strip above — or just click one to drop it here
            </span>
            <span className="flex flex-wrap items-center justify-center gap-1.5">
                {STARTER_CHIPS.filter((type) => APP_COMPONENT_TYPES[type]).map((type) => (
                    <button
                        key={type}
                        type="button"
                        disabled={disabled}
                        onClick={() => onAddStarter(sectionId, type)}
                        className="rounded-full border px-2.5 py-1 text-xs font-medium hover:bg-[var(--bg-tertiary)] disabled:opacity-50"
                        style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                    >
                        Add {APP_COMPONENT_TYPES[type].label.toLowerCase()}
                    </button>
                ))}
            </span>
        </div>,
        container,
    );
}

/**
 * The canvas surface itself — split out so it renders INSIDE AppDataScope and
 * can read the sampled/live `dataState` from the render-prop. The scope state
 * (forms/screenParams) and the preview action runner moved UP into Canvas
 * (Wave 2B2 — dynamic binding filters need the live scope ABOVE the data
 * layer); this body mirrors the data-scope values back to that runner and
 * keeps everything else (selection, dnd, resize, streamLock) unchanged.
 */
function CanvasBody({
    appId, onCommit, editActionState, dataState, refresh, onDataState, refreshRef,
    actionState, runAction, vars, setVar, forms, screenParams, registerFormValue,
    onNavigate, confirmDialog,
}) {
    const {
        definition, screenId, selectedNodeId, selectedNodeIds, mode, streamLock, recentlyAddedIds,
        previewRole, previewUser, dispatch,
    } = useAppEditor();

    const screen = findScreen(definition, screenId) || definition?.screens?.[0] || null;

    // Mirror the data-scope values up to the action runner hosted in Canvas —
    // same bridge as AppRunPage's RunBody (sequences read them via refs,
    // asynchronously, so the one-commit lag is never observable).
    useEffect(() => { onDataState(dataState); }, [onDataState, dataState]);
    useEffect(() => { refreshRef.current = refresh; }, [refreshRef, refresh]);

    const onSelectNode = useCallback(
        (nodeId) => dispatch({ type: 'select_node', nodeId }),
        [dispatch],
    );

    // Edit-mode action stub: navigation is useful while building, everything
    // with side effects only explains itself.
    const definitionRef = useRef(definition);
    useEffect(() => {
        definitionRef.current = definition;
    });
    const editRunAction = useCallback((actionId) => {
        const action = definitionRef.current?.actions?.[actionId];
        if (!action) return;
        if (action.kind === 'navigate' && action.screenId) {
            dispatch({ type: 'set_screen', screenId: action.screenId });
        } else if (action.kind === 'run_automation') {
            toast.info('Runs routine when the app is used');
        }
    }, [dispatch]);

    // Stable wrapper component so the renderer never remounts cells.
    const NodeWrapper = useMemo(() => {
        function CanvasNodeWrapper(props) {
            return <EditorNodeWrapper {...props} onCommit={onCommit} />;
        }
        return CanvasNodeWrapper;
    }, [onCommit]);

    // One SortableContext per screen: every node id in render order.
    const sortableIds = useMemo(() => {
        const ids = [];
        const walk = (children) => {
            for (const child of children || []) {
                ids.push(child.id);
                if (Array.isArray(child.children)) walk(child.children);
            }
        };
        for (const section of screen?.sections || []) walk(section.children);
        return ids;
    }, [screen]);

    // Empty-section drop zones are portaled into the renderer's real
    // <section data-section-id> elements so they align with the grid.
    const surfaceRef = useRef(null);
    const [sectionEls, setSectionEls] = useState(() => new Map());
    useLayoutEffect(() => {
        if (mode !== 'edit') {
            setSectionEls((prev) => (prev.size ? new Map() : prev));
            return;
        }
        const root = surfaceRef.current;
        if (!root) return;
        const next = new Map();
        for (const el of root.querySelectorAll('[data-section-id]')) {
            next.set(el.getAttribute('data-section-id'), el);
        }
        setSectionEls((prev) => {
            if (prev.size === next.size && [...next].every(([k, v]) => prev.get(k) === v)) return prev;
            return next;
        });
    }, [definition, screenId, mode]);

    const emptySections = mode === 'edit'
        ? (screen?.sections || []).filter((s) => !(s.children || []).length)
        : [];

    // Same insert path as the ribbon's click-to-add, aimed at the empty section
    // the placeholder is sitting in.
    const addStarter = useCallback((sectionId, type) => {
        if (streamLock) return;
        const node = buildNode(type);
        if (!node) return;
        const { def, nodeId } = insertNode(definitionRef.current, { parentId: sectionId, node });
        if (!nodeId) return;
        onCommit?.(def);
        dispatch({ type: 'select_node', nodeId });
        dispatch({ type: 'set_recent_ids', ids: [nodeId] });
    }, [streamLock, onCommit, dispatch]);

    return (
        <div className="relative flex-1 min-h-0">
            {mode === 'edit' ? (
                <div
                    ref={surfaceRef}
                    className="h-full overflow-y-auto px-6 py-6"
                    style={{ background: 'var(--bg-secondary)' }}
                    // Node cells no longer stop pointer propagation (that also
                    // stopped document-level menu-closing handlers), so filter
                    // out anything that started on a cell — same
                    // `closest('[data-node-id]')` guard the Marquee uses. The
                    // Marquee overlay owns drag-to-select on this same surface;
                    // a plain click that starts and ends here clears everything.
                    onPointerDown={(selectedNodeId || (selectedNodeIds && selectedNodeIds.size))
                        ? (e) => {
                            if (e.target?.closest?.('[data-node-id]')) return;
                            dispatch({ type: 'clear_selection' });
                        }
                        : undefined}
                >
                    <Marquee surfaceRef={surfaceRef} />
                    <SortableContext items={sortableIds} strategy={rectSortingStrategy}>
                        <AppRenderer
                            definition={definition}
                            screenId={screenId}
                            mode="edit"
                            NodeWrapper={NodeWrapper}
                            onSelectNode={onSelectNode}
                            selectedNodeId={selectedNodeId}
                            selectedNodeIds={selectedNodeIds}
                            recentlyAddedIds={recentlyAddedIds}
                            actionState={editActionState}
                            dataState={dataState}
                            runAction={editRunAction}
                            previewRole={previewRole}
                            currentUser={previewUser}
                        />
                    </SortableContext>
                    {emptySections.map((section) => {
                        const container = sectionEls.get(section.id);
                        return container
                            ? (
                                <SectionDropZone
                                    key={section.id}
                                    sectionId={section.id}
                                    container={container}
                                    onAddStarter={addStarter}
                                    disabled={streamLock}
                                />
                            )
                            : null;
                    })}
                </div>
            ) : (
                <div className="h-full min-h-0">
                    {/* Preview == production: the same AppShell, with the
                        preview user standing in for the viewer (UserMenu hides
                        when there is none) and no onExit (the "Alle apps" link
                        is a run-view affordance). */}
                    <AppFontLoader definition={definition} />
                    <AppShell
                        definition={definition}
                        screenId={screenId}
                        onNavigate={onNavigate}
                        viewer={previewUser || null}
                        appId={appId}
                    >
                        <AppRenderer
                            definition={definition}
                            screenId={screenId}
                            mode="run"
                            actionState={actionState}
                            dataState={dataState}
                            runAction={runAction}
                            previewRole={previewRole}
                            currentUser={previewUser}
                            vars={vars}
                            setVar={setVar}
                            forms={forms}
                            screenParams={screenParams}
                            registerFormValue={registerFormValue}
                        />
                    </AppShell>
                    {confirmDialog}
                </div>
            )}

            {/* streamLock overlay — always mounted, opacity transition only. */}
            <div
                aria-hidden={!streamLock}
                data-stream-lock={streamLock || undefined}
                className={`absolute inset-0 z-30 flex items-start justify-center transition-opacity duration-300 ${streamLock ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                style={{ background: 'color-mix(in srgb, var(--bg-primary) 55%, transparent)' }}
            >
                <div
                    className="mt-16 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm shadow-sm"
                    style={{
                        background: 'var(--bg-secondary)',
                        borderColor: 'var(--border-default)',
                        color: 'var(--text-primary)',
                    }}
                >
                    <Sparkles className="w-4 h-4" style={{ color: 'var(--editor-accent)' }} aria-hidden="true" />
                    AI is editing…
                </div>
            </div>
        </div>
    );
}

/**
 * App Studio editor — the canvas. Wraps the surface in AppDataScope so bound
 * grids/charts/relation inputs show REAL records while editing (a small sampled
 * page) and the LIVE result in preview. A screen with no data bindings fetches
 * nothing, so fixtures/tests stay network-free.
 *
 * The scope state (forms/screenParams) and the preview action runner live
 * HERE, above AppDataScope, because dynamic binding filters resolve against
 * the live scope and `vars` is runner state — the exact mirror of
 * AppRunPage.RunSurface, so preview == production. The runner's own data
 * inputs flow back up from CanvasBody (see its bridge effects).
 */
export default function Canvas({ app, onCommit, editActionState = EMPTY_ACTION_STATE }) {
    const { definition, screenId, mode, previewUser, dispatch } = useAppEditor();
    // The shell's autosave flush — preview needs the server to be looking at
    // the same draft it is before it runs a step by ordinal.
    const chrome = useEditorChrome();

    // Preview owns the same scope state as the run view (AppRunPage.RunSurface):
    // forms published by AppForm, screen params from navigate-with-params, vars
    // lifted out of the action runner.
    const [forms, setForms] = useState({});
    const [screenParams, setScreenParams] = useState({});
    const registerFormValue = useCallback((formName, values) => {
        if (!formName) return;
        setForms((prev) => ({ ...prev, [formName]: values || {} }));
    }, []);

    const onNavigate = useCallback(
        (sid, params) => {
            setScreenParams(params && typeof params === 'object' ? params : {});
            dispatch({ type: 'set_screen', screenId: sid });
        },
        [dispatch],
    );

    // A house-style modal confirm for `confirm` steps (default is window.confirm).
    const { confirm, dialog: confirmDialog } = useConfirmDialog();

    // Mirrored up from CanvasBody (see its bridge effects).
    const [runnerDataState, setRunnerDataState] = useState({});
    const refreshRef = useRef(null);
    const handleRefresh = useCallback((...args) => refreshRef.current?.(...args), []);

    // Live actions for preview mode, always against the draft definition. The
    // sampled dataState feeds action formulas so previewed sequences see records.
    const { actionState, runAction, vars, setVar } = useActionRunner(app?.id, definition, {
        draft: true,
        onNavigate,
        confirm,
        dataState: runnerDataState,
        currentUser: previewUser,
        onRefresh: handleRefresh,
        // Same two roots the renderer's scope carries, so a previewed sequence
        // resolves screen.params.* exactly as the published app will.
        forms,
        screen: { id: screenId, params: screenParams },
        // The server steps against the SAVED draft, so persist the canvas
        // before it is asked to run one by ordinal.
        beforeServerStep: chrome?.flush || null,
    });

    // The live scope dynamic binding filters resolve against (buildScope's
    // shape, never a fork; no dataState — the fetch layer must not depend on
    // its own results). In EDIT mode the renderer's scope carries no
    // vars/forms/params (preview-only state), so the fetch scope matches it:
    // formula filters resolve identically on both sides and sampled data
    // ignores stale preview state.
    const scope = useMemo(() => (mode === 'edit'
        ? buildScope({ currentUser: previewUser, screen: { id: screenId, params: {} } })
        : buildScope({
            currentUser: previewUser,
            vars,
            forms,
            screen: { id: screenId, params: screenParams },
        })
    ), [mode, previewUser, vars, forms, screenId, screenParams]);

    return (
        <AppDataScope
            appId={app?.id}
            definition={definition}
            screenId={screenId}
            sample={mode === 'edit'}
            draft
            scope={scope}
            // The editor never polls: `sample` already blocks it, but saying so
            // here means a future change to that flag can't quietly start
            // hammering the API on every keystroke-driven re-render.
            refreshMs={0}
        >
            {(dataState, { refresh }) => (
                <CanvasBody
                    appId={app?.id || null}
                    onCommit={onCommit}
                    editActionState={editActionState}
                    dataState={dataState}
                    refresh={refresh}
                    onDataState={setRunnerDataState}
                    refreshRef={refreshRef}
                    actionState={actionState}
                    runAction={runAction}
                    vars={vars}
                    setVar={setVar}
                    forms={forms}
                    screenParams={screenParams}
                    registerFormValue={registerFormValue}
                    onNavigate={onNavigate}
                    confirmDialog={confirmDialog}
                />
            )}
        </AppDataScope>
    );
}
