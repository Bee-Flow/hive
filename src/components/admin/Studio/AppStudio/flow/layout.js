import { scopesOf } from './stepGraph';

/**
 * Where each node sits on the canvas.
 *
 * An outline, not a dagre graph. An App Studio action is a tree that runs top
 * to bottom, so the honest picture is a vertical chain where a branch INDENTS:
 * you read it the way you read the steps. Dagre would spread the branches
 * sideways and make "what happens after the condition" a question about
 * geometry rather than about reading downward.
 *
 * Pure, so the arrangement is testable without a canvas.
 */

export const ROW_H = 92;      // one step, plus breathing room
export const INDENT = 56;     // how far a branch steps to the right
export const SCOPE_GAP = 16;  // after a container's last branch
export const NODE_W = 260;

/**
 * layoutGraph(nodes) → Map<id, {x, y}>
 *
 * `nodes` is what stepsToGraph emits, already in tree order — so a single pass
 * per scope, following the parent links, is enough.
 */
export function layoutGraph(nodes) {
    const positions = new Map();
    const byPrefix = new Map();
    for (const node of nodes) {
        if (!byPrefix.has(node.prefix)) byPrefix.set(node.prefix, []);
        byPrefix.get(node.prefix).push(node);
    }

    let cursorY = 0;

    const placeScope = (prefix, x) => {
        for (const node of byPrefix.get(prefix) || []) {
            positions.set(node.id, { x, y: cursorY });
            cursorY += ROW_H;

            if (node.isEntry || !node.step) continue;
            const scopes = scopesOf(node.step);
            if (!scopes.length) continue;

            for (const scope of scopes) {
                placeScope(`${node.id}/${scope.key}`, x + INDENT);
            }
            cursorY += SCOPE_GAP;
        }
    };

    placeScope('', 0);
    return positions;
}

/**
 * The height a container spans, so the canvas can draw a frame around its
 * branches. Returns null for a step that holds nothing.
 */
export function containerBounds(node, nodes, positions) {
    if (!node?.step) return null;
    const scopes = scopesOf(node.step);
    if (!scopes.length) return null;

    const inside = nodes.filter((n) => n.id !== node.id && n.id.startsWith(`${node.id}/`));
    if (!inside.length) return null;

    let minY = Infinity;
    let maxY = -Infinity;
    let maxX = -Infinity;
    for (const n of inside) {
        const p = positions.get(n.id);
        if (!p) continue;
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
        maxX = Math.max(maxX, p.x);
    }
    if (minY === Infinity) return null;

    const self = positions.get(node.id) || { x: 0, y: 0 };
    return {
        x: self.x + INDENT - 12,
        y: minY - 10,
        width: (maxX - self.x - INDENT) + NODE_W + 24,
        height: (maxY - minY) + ROW_H,
    };
}
