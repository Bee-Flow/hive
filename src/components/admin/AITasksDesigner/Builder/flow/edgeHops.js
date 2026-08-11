/**
 * Line hops — the little bridge one connection makes over another where they
 * cross.
 *
 * A flow that fans out and rejoins draws lines straight through each other, and
 * a plain crossing is genuinely ambiguous: at the intersection there is nothing
 * to say whether the line you are following goes on or turns. Circuit diagrams
 * solved this decades ago with a hop, and it reads instantly.
 *
 * ── THE RULES ───────────────────────────────────────────────────────
 * Only a HORIZONTAL segment hops, and it always hops UP. Both halves of the
 * decision matter: if either line could hop, a crossing would sometimes draw two
 * bridges into each other, and a hop that chose its direction from local
 * geometry would flip between renders as nodes move.
 *
 * Crossings near a corner are skipped. The path's rounded corners are curves, so
 * a bridge there would sit on top of one and read as a kink rather than a hop.
 *
 * Pure geometry, no React and no DOM: the paths come in as the `d` strings React
 * Flow already produced, and a new `d` goes out. That keeps it testable as
 * data-in/data-out, which matters because the failure mode of a bad rewrite is a
 * silently mangled line rather than an exception.
 */

// Bridge radius in flow units. Big enough to read as deliberate at the zoom
// levels fitView lands on, small enough not to swallow a short segment.
export const HOP_RADIUS = 6;
// A crossing closer than this to either end of a segment is left alone — that is
// corner territory, where the path is a curve rather than the straight line a
// bridge assumes.
const CORNER_MARGIN = 10;
// Coordinates from a layout engine are floats; treat anything under this as the
// same line rather than a very shallow diagonal.
const EPS = 0.5;

const CMD_RE = /([MLQ])([^MLQZ]*)/gi;

function nums(chunk) {
    return String(chunk).trim().split(/[\s,]+/).map(Number).filter(Number.isFinite);
}

/**
 * An SVG path (M/L/Q only — what getSmoothStepPath emits) as a list of ops
 * carrying their absolute start and end. Anything unrecognised is dropped, which
 * makes the rewrite a no-op rather than a corruption.
 */
export function parsePath(d) {
    const ops = [];
    let cursor = null;
    let match;
    CMD_RE.lastIndex = 0;
    while ((match = CMD_RE.exec(String(d ?? '')))) {
        const cmd = match[1].toUpperCase();
        const coords = nums(match[2]);
        if (cmd === 'M' && coords.length >= 2) {
            cursor = { x: coords[0], y: coords[1] };
            ops.push({ cmd, coords, from: null, to: cursor });
        } else if (cmd === 'L' && coords.length >= 2 && cursor) {
            const to = { x: coords[0], y: coords[1] };
            ops.push({ cmd, coords, from: cursor, to });
            cursor = to;
        } else if (cmd === 'Q' && coords.length >= 4 && cursor) {
            const to = { x: coords[2], y: coords[3] };
            ops.push({ cmd, coords, from: cursor, to });
            cursor = to;
        }
    }
    return ops;
}

/**
 * The straight, axis-aligned pieces of a path — what a crossing can be computed
 * against. Curved corners are deliberately excluded: they are where two paths
 * most often graze without really crossing.
 */
export function pathSegments(d) {
    const out = [];
    for (const op of parsePath(d)) {
        if (op.cmd !== 'L' || !op.from) continue;
        const horizontal = Math.abs(op.to.y - op.from.y) < EPS;
        const vertical = Math.abs(op.to.x - op.from.x) < EPS;
        if (!horizontal && !vertical) continue;      // a diagonal is neither
        if (horizontal && vertical) continue;        // zero length
        out.push({ x1: op.from.x, y1: op.from.y, x2: op.to.x, y2: op.to.y, horizontal });
    }
    return out;
}

/** Where a horizontal segment is crossed by a vertical one, or null. */
function crossing(h, v) {
    const hx1 = Math.min(h.x1, h.x2);
    const hx2 = Math.max(h.x1, h.x2);
    const vy1 = Math.min(v.y1, v.y2);
    const vy2 = Math.max(v.y1, v.y2);
    // Strictly inside both, and clear of both sets of corners.
    if (v.x1 < hx1 + CORNER_MARGIN || v.x1 > hx2 - CORNER_MARGIN) return null;
    if (h.y1 < vy1 + CORNER_MARGIN || h.y1 > vy2 - CORNER_MARGIN) return null;
    return { x: v.x1, y: h.y1 };
}

/**
 * Rewrite `d` so it bridges over every vertical segment in `others` that one of
 * its horizontal segments crosses. Returns the original string when there is
 * nothing to hop, so an unchanged path stays referentially identical.
 */
export function hopPath(d, others, { radius = HOP_RADIUS } = {}) {
    const verticals = (others || []).filter(s => s && !s.horizontal);
    if (!verticals.length) return d;

    const ops = parsePath(d);
    if (!ops.length) return d;

    let out = '';
    let hopped = false;

    for (const op of ops) {
        if (op.cmd === 'M') { out += `M${fmt(op.to.x)},${fmt(op.to.y)}`; continue; }
        if (op.cmd === 'Q') { out += `Q${fmt(op.coords[0])},${fmt(op.coords[1])} ${fmt(op.coords[2])},${fmt(op.coords[3])}`; continue; }

        const horizontal = Math.abs(op.to.y - op.from.y) < EPS && Math.abs(op.to.x - op.from.x) >= EPS;
        if (!horizontal) { out += `L${fmt(op.to.x)},${fmt(op.to.y)}`; continue; }

        const seg = { x1: op.from.x, y1: op.from.y, x2: op.to.x, y2: op.to.y, horizontal: true };
        const rightwards = op.to.x > op.from.x;
        const points = verticals
            .map(v => crossing(seg, v))
            .filter(Boolean)
            // Along the direction of travel, and never two bridges so close they
            // would merge into one wide bump.
            .sort((a, b) => (rightwards ? a.x - b.x : b.x - a.x))
            .filter((p, i, arr) => i === 0 || Math.abs(p.x - arr[i - 1].x) > radius * 2);

        for (const p of points) {
            const enter = rightwards ? p.x - radius : p.x + radius;
            const exit = rightwards ? p.x + radius : p.x - radius;
            // Guard against a bridge that would overshoot its own segment.
            if ((rightwards && (enter < Math.min(op.from.x, op.to.x) || exit > Math.max(op.from.x, op.to.x)))
                || (!rightwards && (enter > Math.max(op.from.x, op.to.x) || exit < Math.min(op.from.x, op.to.x)))) continue;
            out += `L${fmt(enter)},${fmt(p.y)}`;
            // sweep-flag picks the side of the chord the arc bulges to, and SVG's
            // y axis points DOWN — so 0 is "up" going right and 1 is "up" going
            // left. Every hop arcs over the line it crosses, never under it.
            out += `A${fmt(radius)},${fmt(radius)} 0 0 ${rightwards ? 0 : 1} ${fmt(exit)},${fmt(p.y)}`;
            hopped = true;
        }
        out += `L${fmt(op.to.x)},${fmt(op.to.y)}`;
    }

    return hopped ? out : d;
}

function fmt(n) {
    return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, '');
}
