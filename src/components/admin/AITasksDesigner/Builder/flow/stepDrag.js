/**
 * Drag-and-drop glue for adding steps to the canvas.
 *
 * One MIME type, one payload shape, one hit-test — shared by every surface
 * that can START a step drag (the Office ribbon's command buttons, the
 * add-step menu rows) and the one surface that RECEIVES it (DiagramPane).
 *
 * The drop is position-aware: a step dragged onto an existing CONNECTION is
 * spliced into it, one dragged onto a NODE is wired from that node, and one
 * dropped on empty canvas lands unconnected — so "connect it exactly where I
 * want it" is a single gesture instead of add-then-rewire.
 *
 * Framework-free (plain DOM + dataTransfer) so it unit-tests without React.
 */

export const STEP_DND_MIME = 'application/x-automation-step';

/**
 * Spread onto any element that should start a step drag:
 *   <button {...stepDragProps(item.payload)} />
 *
 * `effectAllowed: 'copyMove'` pairs with DiagramPane's `dropEffect = 'copy'`
 * — the two MUST agree or the browser silently refuses the drop.
 */
export function stepDragProps(payload) {
    return {
        draggable: true,
        onDragStart: (event) => {
            if (!payload) return;
            try {
                event.dataTransfer.setData(STEP_DND_MIME, JSON.stringify(payload));
                event.dataTransfer.effectAllowed = 'copyMove';
            } catch (_) { /* dataTransfer is unavailable in some test envs */ }
        },
    };
}

/** Parse the dragged payload back out of a drop event, or null. */
export function readStepPayload(dataTransfer) {
    let raw = '';
    try { raw = dataTransfer?.getData?.(STEP_DND_MIME) || ''; } catch (_) { return null; }
    if (!raw) return null;
    try {
        const payload = JSON.parse(raw);
        return payload && payload.kind ? payload : null;
    } catch (_) { return null; }
}

/**
 * What is under the cursor on the React Flow canvas?
 *   { kind: 'edge', id }  — a connection (its fat transparent hit-path)
 *   { kind: 'node', id }  — a step node
 *   { kind: 'pane' }      — empty canvas
 *
 * React Flow stamps `data-id` on both the edge <g> and the node wrapper, so
 * the id maps straight back to the rendered edge/node we already hold in
 * state. `elementFromPoint` is used rather than React's own drag events
 * because HTML5 drag events don't fire on SVG edge paths reliably across
 * browsers, and because it gives ONE consistent answer for both kinds.
 */
export function dropTargetFromPoint(x, y, doc = typeof document === 'undefined' ? null : document) {
    const el = doc?.elementFromPoint?.(x, y);
    if (!el || !el.closest) return { kind: 'pane' };
    const edge = el.closest('.react-flow__edge');
    if (edge?.getAttribute) {
        const id = edge.getAttribute('data-id');
        if (id) return { kind: 'edge', id };
    }
    const node = el.closest('.react-flow__node');
    if (node?.getAttribute) {
        const id = node.getAttribute('data-id');
        if (id) return { kind: 'node', id };
    }
    return { kind: 'pane' };
}

/** Do two hit-test results point at the same thing? (re-render guard) */
export function sameDropTarget(a, b) {
    if (!a || !b) return a === b;
    return a.kind === b.kind && (a.id || null) === (b.id || null);
}
