/**
 * App Studio — pure, immutable operations over an app definition.
 *
 * The definition schema (top-level shape, component types, style knobs,
 * actions, bindings, limits) is owned by server/appStudio/componentSpecs.js —
 * that file is AUTHORITATIVE. The frontend cannot import server code, so the
 * id helpers (newId / ID_RE) and the section-style defaults are mirrored here
 * verbatim; keep them in lockstep with the server.
 *
 * Every op takes a definition and returns a NEW definition with structural
 * sharing: only the screen/section/node objects on the path to the change are
 * rebuilt — untouched screens and sections keep reference identity. Inputs
 * are never mutated (fixtures may be deep-frozen). Ops that would change
 * nothing return the SAME definition reference so callers can `!==`-check
 * for dirtiness.
 *
 * Ops are spec-agnostic: insertNode receives an already-built node (the
 * caller builds it from the component catalog); "is this a container?" is
 * answered purely by the presence of a `children` array on the node.
 */

// ---------------------------------------------------------------------------
// Id helpers — mirrored from server/appStudio/componentSpecs.js (authoritative)
// ---------------------------------------------------------------------------

export const ID_PREFIXES = { screen: 'scr', section: 'sec', component: 'cmp', action: 'act' };
export const ID_RE = /^(scr|sec|cmp|act)_[a-z0-9]{4,12}$/;

export function newId(kind) {
    const prefix = ID_PREFIXES[kind] || 'cmp';
    let s = '';
    while (s.length < 6) s += Math.random().toString(36).slice(2);
    return `${prefix}_${s.slice(0, 6)}`;
}

// Mirrors SECTION_STYLE_DEFAULTS in componentSpecs.js.
const SECTION_STYLE_DEFAULTS = { padding: 4, gap: 3, background: 'none' };

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** newId that is guaranteed not to collide with `taken`; claims the id. */
function uniqueId(kind, taken) {
    let id = newId(kind);
    while (taken.has(id)) id = newId(kind);
    taken.add(id);
    return id;
}

function emptySection(taken) {
    return { id: uniqueId('section', taken), style: { ...SECTION_STYLE_DEFAULTS }, children: [] };
}

/** Clamp an insertion index into [0, len]; nullish/non-integer means append. */
function clampIndex(index, len) {
    if (!Number.isInteger(index)) return len;
    return Math.max(0, Math.min(index, len));
}

function insertAt(arr, index, item) {
    const next = arr.slice();
    next.splice(clampIndex(index, next.length), 0, item);
    return next;
}

/** True when a shallow patch would change nothing on `target` (Object.is). */
function isNoopPatch(target, patch) {
    return Object.keys(patch).every((k) => Object.is(target?.[k], patch[k]));
}

/** JSON-shaped deep clone (definitions are plain data by contract). */
export function deepClone(value) {
    if (Array.isArray(value)) return value.map(deepClone);
    if (value && typeof value === 'object') {
        const out = {};
        for (const [k, v] of Object.entries(value)) out[k] = deepClone(v);
        return out;
    }
    return value;
}

/** Depth-first visit of a node subtree (containers recurse via `children`). */
function visitTree(children, visit) {
    for (const node of children || []) {
        visit(node);
        if (Array.isArray(node.children)) visitTree(node.children, visit);
    }
}

/** Every id in a node's subtree (root included). */
export function subtreeIds(node) {
    const ids = new Set([node.id]);
    const walk = (children) => {
        for (const child of children || []) { ids.add(child.id); walk(child.children); }
    };
    walk(node.children);
    return ids;
}

/**
 * Locate `nodeId` inside `children` and splice in `fn(node)`'s replacement
 * array ([] removes, [a] replaces, [a, b] replaces-and-inserts-after).
 * Rebuilds only the ancestor chain; returns { children, hit }.
 */
function rewriteChildren(children, nodeId, fn) {
    for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (child.id === nodeId) {
            const next = [...children.slice(0, i), ...fn(child), ...children.slice(i + 1)];
            return { children: next, hit: true };
        }
        if (Array.isArray(child.children)) {
            const res = rewriteChildren(child.children, nodeId, fn);
            if (res.hit) {
                const next = children.slice();
                next[i] = { ...child, children: res.children };
                return { children: next, hit: true };
            }
        }
    }
    return { children, hit: false };
}

/** Apply rewriteChildren across the whole definition (structural sharing). */
function rewriteNode(def, nodeId, fn) {
    const screens = def.screens || [];
    for (let s = 0; s < screens.length; s++) {
        const screen = screens[s];
        const sections = screen.sections || [];
        for (let j = 0; j < sections.length; j++) {
            const section = sections[j];
            const res = rewriteChildren(section.children || [], nodeId, fn);
            if (!res.hit) continue;
            const nextSections = sections.slice();
            nextSections[j] = { ...section, children: res.children };
            const nextScreens = screens.slice();
            nextScreens[s] = { ...screen, sections: nextSections };
            return { def: { ...def, screens: nextScreens }, hit: true };
        }
    }
    return { def, hit: false };
}

/**
 * Map every node in the tree through `fn` (same-reference return = no change);
 * children are mapped before their parent. Untouched sections/screens keep
 * reference identity; returns the same def when nothing changed.
 */
function mapAllNodes(def, fn) {
    const mapTree = (children) => {
        let dirty = false;
        const next = (children || []).map((child) => {
            let node = child;
            if (Array.isArray(node.children)) {
                const kids = mapTree(node.children);
                if (kids !== node.children) node = { ...node, children: kids };
            }
            node = fn(node);
            if (node !== child) dirty = true;
            return node;
        });
        return dirty ? next : children;
    };
    let changed = false;
    const screens = (def.screens || []).map((screen) => {
        let sectionsChanged = false;
        const sections = (screen.sections || []).map((section) => {
            const children = mapTree(section.children);
            if (children === section.children) return section;
            sectionsChanged = true;
            return { ...section, children };
        });
        if (!sectionsChanged) return screen;
        changed = true;
        return { ...screen, sections };
    });
    return changed ? { ...def, screens } : def;
}

/** Shallow-merge patch into node[key] (props/style); same def when a no-op. */
function patchNodeKey(def, nodeId, key, patch) {
    if (!patch || typeof patch !== 'object') return def;
    const found = findNode(def, nodeId);
    if (!found || isNoopPatch(found.node[key] || {}, patch)) return def;
    const { def: next } = rewriteNode(def, nodeId, (node) => [
        { ...node, [key]: { ...(node[key] || {}), ...patch } },
    ]);
    return next;
}

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

/**
 * Find a component node anywhere in the definition.
 * Returns { node, parent, screen, section, index } or null.
 * `parent` is the section (top-level nodes) or the container node.
 */
export function findNode(def, nodeId) {
    for (const screen of def?.screens || []) {
        for (const section of screen.sections || []) {
            const search = (children, parent) => {
                for (let i = 0; i < (children || []).length; i++) {
                    const child = children[i];
                    if (child.id === nodeId) return { node: child, parent, screen, section, index: i };
                    if (Array.isArray(child.children)) {
                        const found = search(child.children, child);
                        if (found) return found;
                    }
                }
                return null;
            };
            const found = search(section.children, section);
            if (found) return found;
        }
    }
    return null;
}

export function findScreen(def, screenId) {
    return (def?.screens || []).find((s) => s.id === screenId) || null;
}

export function findAction(def, actionId) {
    return (def?.actions && actionId != null && def.actions[actionId]) || null;
}

/** Every id in the definition: screens, sections, components and actions. */
export function collectIds(def) {
    const ids = new Set();
    for (const screen of def?.screens || []) {
        if (screen.id != null) ids.add(screen.id);
        for (const section of screen.sections || []) {
            if (section.id != null) ids.add(section.id);
            visitTree(section.children, (n) => { if (n.id != null) ids.add(n.id); });
        }
    }
    for (const actionId of Object.keys(def?.actions || {})) ids.add(actionId);
    return ids;
}

// ---------------------------------------------------------------------------
// Node ops
// ---------------------------------------------------------------------------

export function updateNodeProps(def, nodeId, patch) {
    return patchNodeKey(def, nodeId, 'props', patch);
}

export function updateNodeStyle(def, nodeId, patch) {
    return patchNodeKey(def, nodeId, 'style', patch);
}

// The full event vocabulary a node may carry (mirror of EVENT_NAMES in
// server/appStudio/componentSpecs.js). setNodeEvent accepts any of these; which
// events a given component TYPE actually supports is governed by the inspector
// (styleKnobMeta.TYPE_EVENT_LISTS) and validated server-side.
export const NODE_EVENTS = ['onClick', 'onSubmit', 'onRowClick', 'onRowSelect', 'onCardMove', 'onChange'];

/** Wire (or clear, with null) a node's event to an action id. */
export function setNodeEvent(def, nodeId, event, actionIdOrNull) {
    if (!NODE_EVENTS.includes(event)) return def;
    const found = findNode(def, nodeId);
    if (!found) return def;
    const next = actionIdOrNull ?? null;
    if ((found.node[event] ?? null) === next) return def;
    const { def: out } = rewriteNode(def, nodeId, (node) => {
        const copy = { ...node };
        if (next === null) delete copy[event];
        else copy[event] = next;
        return [copy];
    });
    return out;
}

// Node-level logic keys the inspector's Logic section edits (all v2 additive,
// all optional). An "empty" value clears the key rather than persisting noise.
const LOGIC_KEYS = new Set(['visible', 'visibleWhen', 'enabledWhen', 'readOnly', 'validations', 'computed', 'visibleToRoles']);

function isEmptyLogicValue(key, value) {
    if (value == null) return true;
    if (typeof value === 'string') return value.trim() === '';
    if (Array.isArray(value)) return value.length === 0;
    if (key === 'computed' && typeof value === 'object') return Object.keys(value).length === 0;
    return false;
}

/**
 * Merge node-level logic keys (visible/visibleWhen/enabledWhen/readOnly/
 * validations/computed/visibleToRoles). An empty value (null, blank string,
 * empty array, empty computed map) DELETES the key. Structural sharing: an
 * effective no-op returns the same def reference.
 */
export function updateNodeLogic(def, nodeId, patch) {
    if (!patch || typeof patch !== 'object') return def;
    const found = findNode(def, nodeId);
    if (!found) return def;
    const node = found.node;
    const next = { ...node };
    let changed = false;
    for (const [key, value] of Object.entries(patch)) {
        if (!LOGIC_KEYS.has(key)) continue;
        if (isEmptyLogicValue(key, value)) {
            if (key in next) { delete next[key]; changed = true; }
        } else if (next[key] !== value) {
            next[key] = value;
            changed = true;
        }
    }
    if (!changed) return def;
    const { def: out } = rewriteNode(def, nodeId, () => [next]);
    return out;
}

/** Set (or clear, with an empty map) a node's computed-prop formulas. */
export function setNodeComputed(def, nodeId, computed) {
    return updateNodeLogic(def, nodeId, { computed: computed ?? {} });
}

/**
 * Insert an already-built node under a section or container component.
 * `screenId` is an optional scope hint (ids are globally unique anyway).
 * Returns { def, nodeId }; on failure (missing/non-container parent) the
 * original def reference comes back with nodeId null.
 */
export function insertNode(def, { screenId, parentId, index, node } = {}) {
    if (!node || typeof node !== 'object') return { def, nodeId: null };
    // Keep the global-uniqueness invariant: a missing or already-taken id
    // gets a fresh one (the caller reads the real id from the return value).
    const taken = collectIds(def);
    const toInsert = node.id && !taken.has(node.id)
        ? node
        : { ...node, id: uniqueId('component', taken) };

    // Section parent?
    const screens = def.screens || [];
    for (let s = 0; s < screens.length; s++) {
        const screen = screens[s];
        if (screenId && screen.id !== screenId) continue;
        const sections = screen.sections || [];
        for (let j = 0; j < sections.length; j++) {
            const section = sections[j];
            if (section.id !== parentId) continue;
            const nextSections = sections.slice();
            nextSections[j] = { ...section, children: insertAt(section.children || [], index, toInsert) };
            const nextScreens = screens.slice();
            nextScreens[s] = { ...screen, sections: nextSections };
            return { def: { ...def, screens: nextScreens }, nodeId: toInsert.id };
        }
    }

    // Container component parent? (container-ness = it carries a children array)
    const parent = findNode(def, parentId);
    if (!parent || !Array.isArray(parent.node.children)) return { def, nodeId: null };
    if (screenId && parent.screen.id !== screenId) return { def, nodeId: null };
    const { def: next } = rewriteNode(def, parentId, (p) => [
        { ...p, children: insertAt(p.children, index, toInsert) },
    ]);
    return { def: next, nodeId: toInsert.id };
}

/**
 * Move a node to (toParentId, index) — same-parent reorder or cross-
 * section/container reparent. `index` addresses the destination children
 * AFTER the node is lifted out. Moving a node into itself or its own
 * descendant is a no-op (same reference), as is a move that lands the node
 * where it already is.
 */
export function moveNode(def, nodeId, { toParentId, index } = {}) {
    const found = findNode(def, nodeId);
    if (!found) return def;
    const targetParentId = toParentId ?? found.parent.id;

    // Reparenting into the moved subtree would orphan it — refuse.
    if (subtreeIds(found.node).has(targetParentId)) return def;

    // Same-parent move that ends where it started is a no-op.
    if (targetParentId === found.parent.id) {
        const siblings = found.parent.children || [];
        if (clampIndex(index, siblings.length - 1) === found.index) return def;
    }

    const without = removeNode(def, nodeId);
    const { def: next, nodeId: inserted } = insertNode(without, {
        parentId: targetParentId, index, node: found.node,
    });
    return inserted ? next : def;
}

/**
 * Remove a component (and everything inside it).
 *
 * A `modal` node is also an ACTION TARGET: open_modal/close_modal name it by
 * id. Deleting one used to leave those references behind, and a dangling
 * modalId is a hard validation error server-side (validate.js checkModalRef) —
 * so PUT /:id/definition 422s, useAppAutosave records the failure without
 * advancing its baseline, and every later keystroke re-fires the same rejected
 * save. The editor then refuses to close, because closing flushes. Deleting a
 * dialog jammed the whole editor on an error about a component that no longer
 * existed.
 *
 * So the modal references go with it, exactly as removeScreen already does for
 * screens: an open/close_modal ACTION aimed at a removed dialog is removed
 * (taking its event wiring with it), and modal steps inside sequences are
 * stripped. Deleting a container removes the dialogs INSIDE it too, so the
 * whole subtree is what gets cleaned up, not just the node named.
 */
export function removeNode(def, nodeId) {
    const found = findNode(def, nodeId);
    const modalIds = found ? modalIdsIn(found.node) : [];
    const { def: removed, hit } = rewriteNode(def, nodeId, () => []);
    if (!hit) return def;
    let next = removed;
    for (const modalId of modalIds) next = stripModalRefs(next, modalId);
    return next;
}

/** Every `modal` node id in this subtree — the node itself included. */
function modalIdsIn(node) {
    const ids = [];
    const walk = (n) => {
        if (!n || typeof n !== 'object') return;
        if (n.type === 'modal' && typeof n.id === 'string') ids.push(n.id);
        for (const child of n.children || []) walk(child);
    };
    walk(node);
    return ids;
}

/** Drop every action reference to a dialog that is no longer there. */
function stripModalRefs(def, modalId) {
    let next = def;
    // A whole action whose only job was this dialog goes, with its wiring.
    for (const [actionId, action] of Object.entries(next.actions || {})) {
        if (action && (action.kind === 'open_modal' || action.kind === 'close_modal')
            && action.modalId === modalId) {
            next = removeAction(next, actionId);
        }
    }
    let dirty = false;
    const actions = {};
    for (const [id, action] of Object.entries(next.actions || {})) {
        let copy = action;
        if (action && typeof action === 'object') {
            const steps = stripModalSteps(copy.steps, modalId);
            if (steps !== copy.steps) copy = { ...copy, steps };
        }
        if (copy !== action) dirty = true;
        actions[id] = copy;
    }
    return dirty ? { ...next, actions } : next;
}

/** The same recursive walk stripNavigateSteps does, for modal steps. */
function stripModalSteps(steps, modalId) {
    if (!Array.isArray(steps)) return steps;
    let dirty = false;
    const next = [];
    for (const step of steps) {
        if (!step || typeof step !== 'object') { next.push(step); continue; }
        if ((step.kind === 'open_modal' || step.kind === 'close_modal') && step.modalId === modalId) {
            dirty = true;
            continue;
        }
        let copy = step;
        for (const key of ['then', 'else', 'steps', 'default']) {
            const branch = stripModalSteps(step[key], modalId);
            if (branch !== step[key]) copy = { ...copy, [key]: branch };
        }
        if (Array.isArray(step.cases)) {
            let casesDirty = false;
            const cases = step.cases.map((c) => {
                if (!c || typeof c !== 'object') return c;
                const branch = stripModalSteps(c.steps, modalId);
                if (branch === c.steps) return c;
                casesDirty = true;
                return { ...c, steps: branch };
            });
            if (casesDirty) copy = { ...copy, cases };
        }
        if (copy !== step) dirty = true;
        next.push(copy);
    }
    return dirty ? next : steps;
}

/**
 * Deep-clone a node subtree, assigning a fresh, collision-free component id to
 * every node in it. `taken` is a live Set of ids already in use (mutated as new
 * ids are claimed) so many subtrees can be re-id'd against one definition
 * without colliding with each other. Props are deep-cloned; style is shallow-
 * copied; onClick/onSubmit action references are preserved (both copies fire the
 * same action). Pure — the input node is never mutated.
 */
export function reIdSubtree(node, taken = new Set()) {
    const copy = { ...node, id: uniqueId('component', taken) };
    if (node.props) copy.props = deepClone(node.props);
    if (node.style) copy.style = { ...node.style };
    if (Array.isArray(node.children)) copy.children = node.children.map((child) => reIdSubtree(child, taken));
    return copy;
}

/**
 * Duplicate a node (and its whole subtree) with fresh ids everywhere and
 * insert the copy right after the original. Returns { def, nodeId } where
 * nodeId is the duplicate's root id (null when the node doesn't exist).
 */
export function duplicateNode(def, nodeId) {
    const found = findNode(def, nodeId);
    if (!found) return { def, nodeId: null };
    const dup = reIdSubtree(found.node, collectIds(def));
    const { def: next } = rewriteNode(def, nodeId, (node) => [node, dup]);
    return { def: next, nodeId: dup.id };
}

// ---------------------------------------------------------------------------
// Roles / presentational visibility gating (v2)
// ---------------------------------------------------------------------------
//
// The DEFINITION carries only role KEY references — screen.visibleToRoles and
// node.visibleToRoles (arrays of role keys) plus def.roles ([{ id, name }], a
// mirror of the authoritative data-model roles so validation resolves the
// references). The actual role definitions + row-level security live server-
// side in the data model; these ops only touch the presentational gate.

/** Order-insensitive equality of two string-key arrays. */
function sameKeys(a, b) {
    const A = Array.isArray(a) ? a : [];
    const B = Array.isArray(b) ? b : [];
    if (A.length !== B.length) return false;
    const setB = new Set(B);
    return A.every((k) => setB.has(k));
}

/** Dedupe + drop empties from a role-key list. */
function cleanRoleKeys(roleKeys) {
    if (!Array.isArray(roleKeys)) return [];
    return [...new Set(roleKeys.filter((k) => typeof k === 'string' && k))];
}

/** The role keys currently gating a screen or node (empty = visible to all). */
export function getVisibleToRoles(def, id) {
    const screen = findScreen(def, id);
    if (screen) return Array.isArray(screen.visibleToRoles) ? screen.visibleToRoles : [];
    const found = findNode(def, id);
    if (found) return Array.isArray(found.node.visibleToRoles) ? found.node.visibleToRoles : [];
    return [];
}

/**
 * Gate a screen or node (by id) to a set of role keys. An empty/blank list
 * CLEARS the gate (deletes visibleToRoles → visible to everyone). Returns the
 * same def reference when nothing changes, so callers can `!==`-check.
 */
export function setVisibleToRoles(def, id, roleKeys) {
    const keys = cleanRoleKeys(roleKeys);

    // Screen?
    const screens = def?.screens || [];
    const sIdx = screens.findIndex((s) => s.id === id);
    if (sIdx !== -1) {
        const current = Array.isArray(screens[sIdx].visibleToRoles) ? screens[sIdx].visibleToRoles : [];
        if (sameKeys(current, keys)) return def;
        const nextScreen = { ...screens[sIdx] };
        if (keys.length) nextScreen.visibleToRoles = keys;
        else delete nextScreen.visibleToRoles;
        const nextScreens = screens.slice();
        nextScreens[sIdx] = nextScreen;
        return { ...def, screens: nextScreens };
    }

    // Node?
    const found = findNode(def, id);
    if (!found) return def;
    const current = Array.isArray(found.node.visibleToRoles) ? found.node.visibleToRoles : [];
    if (sameKeys(current, keys)) return def;
    const { def: next } = rewriteNode(def, id, (node) => {
        const copy = { ...node };
        if (keys.length) copy.visibleToRoles = keys;
        else delete copy.visibleToRoles;
        return [copy];
    });
    return next;
}

/** The definition's mirrored role list ([{ id, name }]) or []. */
export function listDefinitionRoles(def) {
    return Array.isArray(def?.roles) ? def.roles : [];
}

/**
 * Mirror the authoritative data-model roles ([{ key, label }]) into
 * def.roles ([{ id, name }]) so screen/node visibleToRoles references resolve
 * (and the AI builder + validation see the same role vocabulary). Returns the
 * same def reference when the mirror is already in sync.
 */
export function setDefinitionRoles(def, roles) {
    const next = (Array.isArray(roles) ? roles : [])
        .filter((r) => r && typeof r.key === 'string' && r.key)
        .map((r) => ({ id: r.key, name: (typeof r.label === 'string' && r.label) ? r.label : r.key }));
    const current = listDefinitionRoles(def);
    const same = current.length === next.length
        && current.every((r, i) => r && r.id === next[i].id && r.name === next[i].name);
    if (same) return def;
    return { ...def, roles: next };
}

// ── Variables (definition.variables) ────────────────────────────────────────
// EMIT-WHEN-PRESENT, like design/nav: an app that declares none must round-trip
// to exactly the bytes it had before the key existed, or every shipped
// template's "no structural repairs" contract shifts on the next save.

/** The definition's declared variables, or []. */
export function listVariables(def) {
    return Array.isArray(def?.variables) ? def.variables : [];
}

/**
 * Add or patch one variable, matched by `name`. A new name is appended; an
 * existing one is shallow-merged in place so the list order survives an edit.
 * Returns the same def reference when nothing actually changes.
 */
export function setVariable(def, variable) {
    if (!variable || typeof variable.name !== 'string' || !variable.name) return def;
    const current = listVariables(def);
    const at = current.findIndex((v) => v?.name === variable.name);
    const next = at === -1
        ? [...current, variable]
        : current.map((v, i) => (i === at ? { ...v, ...variable } : v));
    const unchanged = at !== -1
        && Object.keys(variable).every((k) => shallowSame(current[at][k], variable[k]));
    if (unchanged) return def;
    return { ...def, variables: next };
}

/**
 * Rename a variable in place, keeping its position. Nothing REWRITES the
 * formulas that read it — the manager only offers a rename while a variable is
 * unused, for exactly that reason.
 */
export function renameVariable(def, from, to) {
    if (typeof to !== 'string' || !to || from === to) return def;
    const current = listVariables(def);
    if (!current.some((v) => v?.name === from)) return def;
    if (current.some((v) => v?.name === to)) return def;   // a name is unique
    return { ...def, variables: current.map((v) => (v?.name === from ? { ...v, name: to } : v)) };
}

/**
 * Remove a variable. Removing the LAST one deletes the key entirely, so a
 * created-then-deleted round trip is byte-clean (mirrors updateDesign(def, null)).
 */
export function removeVariable(def, name) {
    const current = listVariables(def);
    const next = current.filter((v) => v?.name !== name);
    if (next.length === current.length) return def;
    if (next.length === 0) {
        const { variables: _dropped, ...rest } = def;
        return rest;
    }
    return { ...def, variables: next };
}

/** Cheap equality for a variable field (defaults may be objects or arrays). */
function shallowSame(a, b) {
    if (a === b) return true;
    if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
    try { return JSON.stringify(a) === JSON.stringify(b); } catch { return false; }
}

/**
 * Is a screen/node visible to `roleKey` under the presentational gate?
 * A missing/empty visibleToRoles means "everyone"; a null/blank roleKey or the
 * owner sentinel means "no gating" (full view). Pure — the renderer uses this
 * for the editor's view-as-role preview (row security is the real boundary).
 */
export function isVisibleToRole(nodeOrScreen, roleKey) {
    if (!roleKey || roleKey === 'owner') return true;
    const gate = nodeOrScreen && nodeOrScreen.visibleToRoles;
    if (!Array.isArray(gate) || gate.length === 0) return true;
    return gate.includes(roleKey);
}

// ---------------------------------------------------------------------------
// Theme / meta
// ---------------------------------------------------------------------------

export function updateTheme(def, patch) {
    if (!patch || typeof patch !== 'object' || isNoopPatch(def.theme || {}, patch)) return def;
    return { ...def, theme: { ...(def.theme || {}), ...patch } };
}

export function updateMeta(def, patch) {
    if (!patch || typeof patch !== 'object' || isNoopPatch(def.meta || {}, patch)) return def;
    return { ...def, meta: { ...(def.meta || {}), ...patch } };
}

// App Design v2 — design/nav are OPTIONAL keys (emit-when-present in the
// canonicalizer). A patch materializes the key; passing null removes it, which
// is the documented way back to byte-identical "no design" rendering.
export function updateDesign(def, patch) {
    if (patch === null) {
        if (!('design' in def)) return def;
        const { design: _dropped, ...rest } = def;
        return rest;
    }
    if (!patch || typeof patch !== 'object' || isNoopPatch(def.design || {}, patch)) return def;
    return { ...def, design: { ...(def.design || {}), ...patch } };
}

export function updateNav(def, patch) {
    if (patch === null) {
        if (!('nav' in def)) return def;
        const { nav: _dropped, ...rest } = def;
        return rest;
    }
    if (!patch || typeof patch !== 'object' || isNoopPatch(def.nav || {}, patch)) return def;
    return { ...def, nav: { ...(def.nav || {}), ...patch } };
}

// ---------------------------------------------------------------------------
// Screen / section ops
// ---------------------------------------------------------------------------

/** Append a new screen (with one empty section). Returns { def, screenId }. */
export function addScreen(def, { name } = {}) {
    const taken = collectIds(def);
    const screenId = uniqueId('screen', taken);
    const screen = {
        id: screenId,
        name: typeof name === 'string' && name.trim() ? name.trim() : 'Screen',
        icon: null,
        showInNav: true,
        maxWidth: 'medium',
        sections: [emptySection(taken)],
    };
    return { def: { ...def, screens: [...(def.screens || []), screen] }, screenId };
}

/**
 * Drop the navigate steps that target `screenId` from a sequence's step list,
 * recursing branch bodies (condition then/else, loop steps, switch cases and
 * default) — same shapes canonicalize.js walks server-side.
 */
function stripNavigateSteps(steps, screenId) {
    if (!Array.isArray(steps)) return steps;
    let dirty = false;
    const next = [];
    for (const step of steps) {
        if (!step || typeof step !== 'object') { next.push(step); continue; }
        if (step.kind === 'navigate' && step.screenId === screenId) { dirty = true; continue; }
        let copy = step;
        for (const key of ['then', 'else', 'steps', 'default']) {
            const branch = stripNavigateSteps(step[key], screenId);
            if (branch !== step[key]) copy = { ...copy, [key]: branch };
        }
        if (Array.isArray(step.cases)) {
            let casesDirty = false;
            const cases = step.cases.map((c) => {
                if (!c || typeof c !== 'object') return c;
                const branch = stripNavigateSteps(c.steps, screenId);
                if (branch === c.steps) return c;
                casesDirty = true;
                return { ...c, steps: branch };
            });
            if (casesDirty) copy = { ...copy, cases };
        }
        if (copy !== step) dirty = true;
        next.push(copy);
    }
    return dirty ? next : steps;
}

/** Strip effects' navigateTo + sequence navigate steps aimed at `screenId`. */
function stripScreenRefs(actions, screenId) {
    let dirty = false;
    const next = {};
    for (const [id, action] of Object.entries(actions || {})) {
        let copy = action;
        if (action && typeof action === 'object') {
            for (const slot of ['onSuccess', 'onError']) {
                const effects = copy[slot];
                if (effects && typeof effects === 'object' && effects.navigateTo === screenId) {
                    const { navigateTo: _gone, ...rest } = effects;
                    copy = { ...copy, [slot]: rest };
                }
            }
            const steps = stripNavigateSteps(copy.steps, screenId);
            if (steps !== copy.steps) copy = { ...copy, steps };
        }
        if (copy !== action) dirty = true;
        next[id] = copy;
    }
    return dirty ? next : actions;
}

/**
 * Remove a screen. Refuses (same reference) when it is the last one; repoints
 * homeScreenId at the first remaining screen if it targeted the removed one,
 * and strips every navigate reference to it — a navigate ACTION aimed at the
 * screen goes (taking its event wiring with it, via removeAction), as do
 * onSuccess/onError navigateTo and navigate steps inside sequences. A dangling
 * screen reference is a hard validation error server-side, so leaving one
 * behind makes every later save fail.
 */
export function removeScreen(def, screenId) {
    const screens = def.screens || [];
    if (screens.length <= 1 || !screens.some((s) => s.id === screenId)) return def;
    const remaining = screens.filter((s) => s.id !== screenId);
    let next = { ...def, screens: remaining };
    if (def.homeScreenId === screenId) next.homeScreenId = remaining[0].id;
    for (const [actionId, action] of Object.entries(next.actions || {})) {
        if (action && action.kind === 'navigate' && action.screenId === screenId) {
            next = removeAction(next, actionId);
        }
    }
    const actions = stripScreenRefs(next.actions, screenId);
    return actions === next.actions ? next : { ...next, actions };
}

/** Shallow-patch screen settings (name/icon/showInNav/maxWidth). id and sections are op-managed and ignored. */
export function updateScreen(def, screenId, patch) {
    if (!patch || typeof patch !== 'object') return def;
    const screens = def.screens || [];
    const idx = screens.findIndex((s) => s.id === screenId);
    if (idx === -1) return def;
    const { id: _id, sections: _sections, ...rest } = patch;
    if (isNoopPatch(screens[idx], rest)) return def;
    const nextScreens = screens.slice();
    nextScreens[idx] = { ...screens[idx], ...rest };
    return { ...def, screens: nextScreens };
}

/** Insert an empty section into a screen at index (clamped). Returns { def, sectionId }. */
export function addSection(def, screenId, index) {
    const screens = def.screens || [];
    const idx = screens.findIndex((s) => s.id === screenId);
    if (idx === -1) return { def, sectionId: null };
    const section = emptySection(collectIds(def));
    const nextScreens = screens.slice();
    nextScreens[idx] = { ...screens[idx], sections: insertAt(screens[idx].sections || [], index, section) };
    return { def: { ...def, screens: nextScreens }, sectionId: section.id };
}

/**
 * Remove a section. Screens always keep at least one section: removing the
 * only section replaces it with a fresh empty one instead.
 */
export function removeSection(def, sectionId) {
    const screens = def.screens || [];
    for (let s = 0; s < screens.length; s++) {
        const screen = screens[s];
        const sections = screen.sections || [];
        if (!sections.some((sec) => sec.id === sectionId)) continue;
        const remaining = sections.filter((sec) => sec.id !== sectionId);
        const nextScreens = screens.slice();
        nextScreens[s] = {
            ...screen,
            sections: remaining.length ? remaining : [emptySection(collectIds(def))],
        };
        return { ...def, screens: nextScreens };
    }
    return def;
}

// ---------------------------------------------------------------------------
// Action ops
// ---------------------------------------------------------------------------

/** Upsert an action; a null/undefined id creates one. Returns { def, actionId }. */
export function setAction(def, actionIdOrNull, action) {
    if (!action || typeof action !== 'object') return { def, actionId: null };
    const actionId = actionIdOrNull || uniqueId('action', collectIds(def));
    return { def: { ...def, actions: { ...(def.actions || {}), [actionId]: action } }, actionId };
}

/** Remove an action and strip every onClick/onSubmit that pointed at it. */
export function removeAction(def, actionId) {
    if (!def.actions || !(actionId in def.actions)) return def;
    const actions = { ...def.actions };
    delete actions[actionId];
    return mapAllNodes({ ...def, actions }, (node) => {
        if (node.onClick !== actionId && node.onSubmit !== actionId) return node;
        const copy = { ...node };
        if (copy.onClick === actionId) delete copy.onClick;
        if (copy.onSubmit === actionId) delete copy.onSubmit;
        return copy;
    });
}

// ---------------------------------------------------------------------------
// ensureIds — repair AI-generated / imported definitions
// ---------------------------------------------------------------------------

/**
 * Guarantee every screen/section/component/action has a valid, globally
 * unique id (missing, malformed or duplicate ids get regenerated; the FIRST
 * occurrence of a duplicate keeps it). Internal references are rewritten
 * when the mapping old→new is unambiguous: homeScreenId, node onClick/
 * onSubmit, navigate.screenId (incl. effects navigateTo) and actionResult
 * bindings' actionId. Returns { def, changed }; same reference when clean.
 */
export function ensureIds(def) {
    const seen = new Set();
    const AMBIGUOUS = Symbol('ambiguous');
    const screenRemap = new Map(); // oldId -> newId | AMBIGUOUS
    const actionRemap = new Map();
    let changed = false;

    const claim = (id, kind, remap) => {
        if (typeof id === 'string' && ID_RE.test(id) && !seen.has(id)) {
            seen.add(id);
            return id;
        }
        const fresh = uniqueId(kind, seen);
        changed = true;
        if (remap && typeof id === 'string' && id) {
            remap.set(id, remap.has(id) ? AMBIGUOUS : fresh);
        }
        return fresh;
    };

    // Pass 1 — claim/regenerate ids top-down (structural sharing throughout).
    const claimTree = (children) => {
        let dirty = false;
        const next = (children || []).map((child) => {
            const id = claim(child.id, 'component', null);
            const kids = Array.isArray(child.children) ? claimTree(child.children) : child.children;
            if (id === child.id && kids === child.children) return child;
            dirty = true;
            const node = { ...child, id };
            if (kids !== child.children) node.children = kids;
            return node;
        });
        return dirty ? next : children;
    };
    let screensDirty = false;
    const claimedScreens = (def.screens || []).map((screen) => {
        const id = claim(screen.id, 'screen', screenRemap);
        let sectionsDirty = false;
        const sections = (screen.sections || []).map((section) => {
            const sid = claim(section.id, 'section', null);
            const children = claimTree(section.children);
            if (sid === section.id && children === section.children) return section;
            sectionsDirty = true;
            const next = { ...section, id: sid };
            if (children !== section.children) next.children = children;
            return next;
        });
        if (id === screen.id && !sectionsDirty) return screen;
        screensDirty = true;
        return { ...screen, id, sections: sectionsDirty ? sections : screen.sections };
    });
    let actionsDirty = false;
    const actions = {};
    for (const [key, action] of Object.entries(def.actions || {})) {
        const id = claim(key, 'action', actionRemap);
        if (id !== key) actionsDirty = true;
        actions[id] = action;
    }

    // A remap is only safe when the old id maps to exactly one new id AND is
    // no longer in use (duplicates keep their first occurrence — references
    // to a duplicated id still resolve, so they must not be rewritten).
    const resolve = (remap) => {
        const out = new Map();
        for (const [oldId, mapped] of remap) {
            if (mapped !== AMBIGUOUS && !seen.has(oldId)) out.set(oldId, mapped);
        }
        return out;
    };
    const screenMap = resolve(screenRemap);
    const actionMap = resolve(actionRemap);

    // Pass 2 — rewrite references (structural sharing continues: mapAllNodes
    // and the loops below return original objects when nothing changes).
    let next = {
        ...def,
        screens: screensDirty ? claimedScreens : def.screens,
        actions: actionsDirty ? actions : def.actions,
    };

    if (actionMap.size) {
        next = mapAllNodes(next, (node) => {
            let copy = null;
            const ensure = () => (copy = copy || { ...node });
            for (const event of ['onClick', 'onSubmit']) {
                if (actionMap.has(node[event])) ensure()[event] = actionMap.get(node[event]);
            }
            // actionResult bindings live as direct prop values.
            for (const [key, value] of Object.entries(node.props || {})) {
                if (value && typeof value === 'object' && value.kind === 'actionResult'
                    && actionMap.has(value.actionId)) {
                    ensure().props = { ...(copy.props || node.props), [key]: { ...value, actionId: actionMap.get(value.actionId) } };
                }
            }
            if (copy) changed = true;
            return copy || node;
        });
    }

    if (screenMap.size) {
        let refDirty = false;
        const rewritten = {};
        for (const [id, action] of Object.entries(next.actions || {})) {
            let copy = action;
            if (action.kind === 'navigate' && screenMap.has(action.screenId)) {
                copy = { ...copy, screenId: screenMap.get(action.screenId) };
            }
            for (const slot of ['onSuccess', 'onError']) {
                if (copy[slot] && screenMap.has(copy[slot].navigateTo)) {
                    copy = { ...copy, [slot]: { ...copy[slot], navigateTo: screenMap.get(copy[slot].navigateTo) } };
                }
            }
            if (copy !== action) refDirty = true;
            rewritten[id] = copy;
        }
        if (refDirty) {
            next = { ...next, actions: rewritten };
            changed = true;
        }
    }

    // homeScreenId: follow the remap; if it still points nowhere, fall back
    // to the first screen so imported apps always have a renderable home.
    let homeScreenId = def.homeScreenId;
    if (screenMap.has(homeScreenId)) homeScreenId = screenMap.get(homeScreenId);
    const finalScreens = next.screens || [];
    if (!finalScreens.some((s) => s.id === homeScreenId) && finalScreens.length) {
        homeScreenId = finalScreens[0].id;
    }
    if (homeScreenId !== def.homeScreenId) {
        next = { ...next, homeScreenId };
        changed = true;
    }

    return changed ? { def: next, changed: true } : { def, changed: false };
}
