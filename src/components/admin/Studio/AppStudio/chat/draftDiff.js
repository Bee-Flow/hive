import { collectIds } from '../state/definitionOps';

/**
 * App Studio AI builder — cheap, pure diff between two app definitions.
 *
 * diffDefinitions(prevDef, nextDef) → {
 *   addedIds        Set — ids present in next but not in prev (screens,
 *                         sections, components and actions)
 *   changedIds      Set — ids present in both whose OWN shape changed
 *                         (shallow: a container is not "changed" just
 *                         because a descendant changed)
 *   addedOnScreens  Set — screen ids where at least one addition landed
 *                         (a brand-new screen counts as its own addition)
 * }
 *
 * Used per `draft` SSE event to pulse just-added nodes and follow the AI to
 * the screen it is editing. Signatures are JSON-based (definitions are plain
 * JSON by contract and small), with child collections excluded so identity
 * stays shallow.
 */
export function diffDefinitions(prevDef, nextDef) {
    const addedIds = new Set();
    const changedIds = new Set();
    const addedOnScreens = new Set();
    if (!nextDef) return { addedIds, changedIds, addedOnScreens };

    const prevIds = collectIds(prevDef || {});
    const prevIndex = indexDefinition(prevDef);

    for (const [id, entry] of indexDefinition(nextDef)) {
        if (!prevIds.has(id)) {
            addedIds.add(id);
            if (entry.screenId) addedOnScreens.add(entry.screenId);
        } else {
            const before = prevIndex.get(id);
            if (before && before.sig !== entry.sig) changedIds.add(id);
        }
    }
    return { addedIds, changedIds, addedOnScreens };
}

/** id → { sig, screenId } for every screen/section/component/action. */
function indexDefinition(def) {
    const map = new Map();
    for (const screen of def?.screens || []) {
        const screenId = screen.id ?? null;
        if (screenId != null) {
            map.set(screenId, { sig: signature(screen, 'sections'), screenId });
        }
        for (const section of screen.sections || []) {
            if (section.id != null) {
                map.set(section.id, { sig: signature(section, 'children'), screenId });
            }
            walk(section.children, (node) => {
                if (node.id != null) {
                    map.set(node.id, { sig: signature(node, 'children'), screenId });
                }
            });
        }
    }
    for (const [actionId, action] of Object.entries(def?.actions || {})) {
        map.set(actionId, { sig: signature(action, null), screenId: null });
    }
    return map;
}

function walk(children, visit) {
    for (const node of children || []) {
        visit(node);
        if (Array.isArray(node.children)) walk(node.children, visit);
    }
}

/** JSON signature of an entity with its child collection excluded. */
function signature(obj, childKey) {
    try {
        return JSON.stringify(obj, (key, value) => (childKey && key === childKey ? undefined : value));
    } catch {
        return null;
    }
}

export default diffDefinitions;
