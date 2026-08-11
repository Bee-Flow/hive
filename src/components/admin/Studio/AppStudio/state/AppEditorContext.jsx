import { createContext, useContext, useMemo, useReducer } from 'react';
import { collectIds, findScreen } from './definitionOps';

/**
 * App Studio editor state — a thin useReducer store around the definition.
 *
 * The definition itself only changes through the pure ops in definitionOps.js;
 * components apply an op and dispatch the result via 'set_definition'. This
 * context deliberately stays minimal: undo/redo and autosave hook in as later
 * phases on top of the same dispatch surface.
 *
 * State:
 *   definition       — the app definition (see server/appStudio/componentSpecs.js)
 *   version          — persisted version the definition is based on (optimistic concurrency)
 *   screenId         — screen shown on the canvas
 *   selectedNodeIds  — Set of node ids in the current multi-selection (source of
 *                      truth). Insertion order is preserved; the LAST id added is
 *                      the "anchor" (its inspector panel + resize grips show).
 *   selectedNodeId   — DERIVED anchor = last id of selectedNodeIds (null = none).
 *                      Every legacy reader keeps using this; a single-select is
 *                      just a one-element set, so nothing downstream changed.
 *   mode             — 'edit' | 'preview'
 *   streamLock       — true while the AI builder is streaming (canvas read-only)
 *   recentlyAddedIds — Set of node ids to flash as "just added" (AI/paste)
 *   previewRole      — role KEY the editor is previewing "as" (null = owner/full
 *                      view). PRESENTATIONAL only: the renderer hides screens/
 *                      nodes gated away from this role. Row security is server-
 *                      enforced, so this is a UX preview, never a control.
 *   previewUser      — the mock currentUser fed to formulas while previewRole is
 *                      active (null when not previewing).
 */

const AppEditorContext = createContext(null);

function fallbackScreenId(definition) {
    if (!definition) return null;
    if (findScreen(definition, definition.homeScreenId)) return definition.homeScreenId;
    return definition.screens?.[0]?.id || null;
}

function initialState(app) {
    const definition = app?.definition || null;
    return {
        definition,
        // The server row exposes the optimistic-concurrency version as
        // `definitionVersion` (getApp → sanitizeAppRow); accept `version` too
        // for callers that already normalise it. Default to 1 (the column
        // default) so the FIRST autosave never sends a null baseVersion — the
        // save route requires an integer and 400s otherwise.
        version: app?.version ?? app?.definitionVersion ?? 1,
        screenId: fallbackScreenId(definition),
        selectedNodeIds: new Set(),
        selectedNodeId: null,
        mode: 'edit',
        streamLock: false,
        recentlyAddedIds: new Set(),
        previewRole: null,
        previewUser: null,
    };
}

/**
 * A deterministic mock viewer for a role preview. Shape mirrors the runtime
 * currentUser (see RuntimeContext.buildScope) so visibleWhen/computed formulas
 * that read currentUser.* resolve while previewing as this role.
 */
export function mockUserForRole(roleKey) {
    if (!roleKey || roleKey === 'owner') return null;
    return {
        id: `preview-${roleKey}`,
        name: `Preview: ${roleKey}`,
        email: null,
        role: roleKey,
        roles: [roleKey],
        organizationId: null,
        preview: true,
    };
}

/**
 * Build the { selectedNodeIds, selectedNodeId } pair from an id iterable,
 * keeping only ids that still exist in `definition` (order preserved). The
 * anchor (selectedNodeId) is the LAST surviving id, so a shift/marquee add
 * makes the newest node the inspector target — matching Figma/Sketch.
 */
function selectionFor(definition, idsIterable) {
    const present = definition ? collectIds(definition) : new Set();
    const next = new Set();
    for (const id of idsIterable || []) {
        if (id != null && present.has(id)) next.add(id);
    }
    let anchor = null;
    for (const id of next) anchor = id;
    return { selectedNodeIds: next, selectedNodeId: anchor };
}

/** True when two id sets hold the same ids (order-insensitive). */
function sameIdSet(a, b) {
    if (a === b) return true;
    if (!(a instanceof Set) || !(b instanceof Set) || a.size !== b.size) return false;
    for (const id of a) if (!b.has(id)) return false;
    return true;
}

function reducer(state, action) {
    switch (action.type) {
        case 'set_definition': {
            const definition = action.definition || null;
            // Keep the current screen when it still exists, else go home.
            const screenId = findScreen(definition, state.screenId)
                ? state.screenId
                : fallbackScreenId(definition);
            // Drop any selected nodes that no longer exist (structural edits /
            // AI turns can delete them); keep the survivors + recompute anchor.
            const sel = selectionFor(definition, state.selectedNodeIds);
            return {
                ...state,
                definition,
                version: action.version !== undefined ? action.version : state.version,
                screenId,
                selectedNodeIds: sel.selectedNodeIds,
                selectedNodeId: sel.selectedNodeId,
            };
        }
        case 'select_node': {
            // REPLACE the whole selection with this single node (or clear it).
            const sel = selectionFor(state.definition, action.nodeId ? [action.nodeId] : []);
            if (sel.selectedNodeId === state.selectedNodeId && sameIdSet(sel.selectedNodeIds, state.selectedNodeIds)) {
                return state;
            }
            return { ...state, ...sel };
        }
        case 'toggle_node': {
            // Shift/⌘-click: add the node when absent, remove it when present.
            if (!action.nodeId || !(state.definition && collectIds(state.definition).has(action.nodeId))) {
                return state;
            }
            const ids = new Set(state.selectedNodeIds);
            if (ids.has(action.nodeId)) ids.delete(action.nodeId);
            else ids.add(action.nodeId);
            const sel = selectionFor(state.definition, ids);
            return { ...state, ...sel };
        }
        case 'select_many': {
            // Marquee / bulk: replace the selection with an explicit id list.
            const sel = selectionFor(state.definition, action.ids || []);
            if (sameIdSet(sel.selectedNodeIds, state.selectedNodeIds)) return state;
            return { ...state, ...sel };
        }
        case 'clear_selection':
            return state.selectedNodeIds.size === 0
                ? state
                : { ...state, selectedNodeIds: new Set(), selectedNodeId: null };
        case 'set_screen': {
            if (!findScreen(state.definition, action.screenId)) return state;
            return action.screenId === state.screenId ? state : { ...state, screenId: action.screenId };
        }
        case 'set_mode': {
            if (action.mode !== 'edit' && action.mode !== 'preview') return state;
            return action.mode === state.mode ? state : { ...state, mode: action.mode };
        }
        case 'set_stream_lock':
            return { ...state, streamLock: !!action.streamLock };
        case 'set_recent_ids':
            return {
                ...state,
                recentlyAddedIds: action.ids instanceof Set ? action.ids : new Set(action.ids || []),
            };
        case 'clear_recent_id': {
            // Each cell drops ITSELF when its pulse animation ends. Rebuilding
            // the whole set from a render value instead would let a second cell
            // whose handler still closes over the pre-clear set resurrect an id
            // that already stopped pulsing.
            if (!state.recentlyAddedIds.has(action.nodeId)) return state;
            const ids = new Set(state.recentlyAddedIds);
            ids.delete(action.nodeId);
            return { ...state, recentlyAddedIds: ids };
        }
        case 'set_version':
            return { ...state, version: action.version };
        case 'set_preview_role': {
            // Falsy role → back to the owner/full view (default). Otherwise adopt
            // the role + a mock viewer (caller may override with an explicit user).
            const role = (typeof action.role === 'string' && action.role && action.role !== 'owner')
                ? action.role
                : null;
            if (!role) {
                return (state.previewRole === null && state.previewUser === null)
                    ? state
                    : { ...state, previewRole: null, previewUser: null };
            }
            const user = action.user !== undefined ? action.user : mockUserForRole(role);
            return { ...state, previewRole: role, previewUser: user };
        }
        default:
            return state;
    }
}

/**
 * @param {{ app?: { definition?: object, version?: number|string }, children: any }} props
 * `app` seeds the store once (on mount); later server refreshes go through
 * dispatch({ type: 'set_definition', definition, version }).
 */
export function AppEditorProvider({ app, children }) {
    const [state, dispatch] = useReducer(reducer, app, initialState);
    const value = useMemo(() => ({ ...state, dispatch }), [state]);
    return <AppEditorContext.Provider value={value}>{children}</AppEditorContext.Provider>;
}

export function useAppEditor() {
    const ctx = useContext(AppEditorContext);
    if (!ctx) throw new Error('useAppEditor must be used inside <AppEditorProvider>');
    return ctx;
}
