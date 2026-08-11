/**
 * App Studio editor — copy/paste over the app definition.
 *
 * serializeNodes(def, ids)                       → a portable payload
 * pasteNodes(def, payload, { screenId, sectionId, index }) → { def, newIds }
 *
 * A copy captures the FULL subtree of each selected node (deep-cloned so the
 * frozen fixtures / live definition are never touched). Ids that are
 * descendants of another selected id are dropped, so copying a card AND a
 * button already inside it pastes ONE card (with the button inside), not two.
 *
 * A paste re-ids every node in the payload (definitionOps.reIdSubtree) against
 * the live definition so ids never collide — with existing nodes OR between two
 * pasted subtrees — and inserts them into the target section, preserving order.
 *
 * A tiny module-level store backs the Cmd+C/X → Cmd+V hotkey pair (the system
 * clipboard is async + permission-gated; an in-memory buffer is deterministic
 * and reliable inside one editor session).
 */

import { collectIds, deepClone, findNode, insertNode, reIdSubtree, subtreeIds } from './definitionOps';

export const CLIPBOARD_KIND = 'appstudio/nodes';

// ---------------------------------------------------------------------------
// In-memory clipboard buffer
// ---------------------------------------------------------------------------

let buffer = null;

export function setClipboard(payload) {
    buffer = payload && Array.isArray(payload.nodes) && payload.nodes.length ? payload : null;
}
export function getClipboard() {
    return buffer;
}
export function hasClipboard() {
    return !!(buffer && Array.isArray(buffer.nodes) && buffer.nodes.length);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * The "top-level" ids of a selection: drop any id that is a descendant of
 * another selected id (so a subtree is copied once, not once per selected
 * descendant). Preserves the input order.
 */
function topLevelIds(def, ids) {
    const list = ids instanceof Set ? [...ids] : (Array.isArray(ids) ? ids : []);
    const found = list
        .map((id) => ({ id, node: findNode(def, id)?.node }))
        .filter((x) => x.node);
    const subtrees = found.map((x) => subtreeIds(x.node));
    return found
        .filter((_, i) => !found.some((__, j) => j !== i && subtrees[j].has(found[i].id)))
        .map((x) => x.id);
}

function resolveTargetSection(def, { screenId, sectionId } = {}) {
    const screens = def?.screens || [];
    if (sectionId) {
        for (const screen of screens) {
            if ((screen.sections || []).some((s) => s.id === sectionId)) return sectionId;
        }
    }
    if (screenId) {
        const screen = screens.find((s) => s.id === screenId);
        if (screen?.sections?.length) return screen.sections[0].id;
    }
    return screens[0]?.sections?.[0]?.id || null;
}

function payloadNodes(payload) {
    if (!payload || payload.kind !== CLIPBOARD_KIND || !Array.isArray(payload.nodes)) return [];
    return payload.nodes.filter((n) => n && typeof n === 'object' && typeof n.type === 'string');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Capture the selected nodes (top-level subtrees) into a portable payload. */
export function serializeNodes(def, ids) {
    const roots = topLevelIds(def, ids);
    const nodes = roots
        .map((id) => findNode(def, id)?.node)
        .filter(Boolean)
        .map(deepClone);
    return { kind: CLIPBOARD_KIND, version: 1, nodes };
}

/**
 * Paste a payload into a section. Returns { def, newIds } — the same def
 * reference + empty ids when nothing valid was pasted (never throws).
 */
export function pasteNodes(def, payload, { screenId, sectionId, index } = {}) {
    const nodes = payloadNodes(payload);
    if (!nodes.length) return { def, newIds: [] };
    const target = resolveTargetSection(def, { screenId, sectionId });
    if (!target) return { def, newIds: [] };

    // Re-id ALL subtrees up front against one growing id set so two pasted
    // subtrees can't collide with each other (or with the definition).
    const taken = collectIds(def);
    const clones = nodes.map((node) => reIdSubtree(node, taken));

    let out = def;
    let at = Number.isInteger(index) ? index : undefined;
    const newIds = [];
    for (const clone of clones) {
        const res = insertNode(out, { parentId: target, index: at, node: clone });
        if (res.nodeId) {
            out = res.def;
            newIds.push(res.nodeId);
            if (at != null) at += 1; // keep the pasted order at the drop point
        }
    }
    return { def: out, newIds };
}

export default { serializeNodes, pasteNodes, setClipboard, getClipboard, hasClipboard, CLIPBOARD_KIND };
