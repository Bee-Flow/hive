import dagre from '@dagrejs/dagre';

/**
 * Dagre auto-layout for an automation graph, with a module-level LRU.
 *
 * Extracted from layout.js so BOTH the canvas layout and the inline-flowlet
 * composer (inlineFlowlets.js) can lay out a graph without importing each
 * other — layout.js imports inlineFlowlets.js, so the shared helper has to
 * live below both of them.
 *
 * The cost of laying out a 30-step graph isn't huge but it adds up: every
 * keystroke in an inspector field rebuilds the draft → `seedPositions` runs →
 * dagre fires. Topology rarely changes between keystrokes, so caching against
 * a structural key (node IDs + edge endpoints + dims) is almost always a hit
 * during text editing. Capacity is intentionally small — we only need to
 * remember a handful of recent shapes.
 */

const LAYOUT_CACHE_CAP = 8;
const layoutCache = new Map(); // key -> positionById Map

export function isFinitePos(p) {
    return p && typeof p.x === 'number' && typeof p.y === 'number'
        && Number.isFinite(p.x) && Number.isFinite(p.y);
}

function layoutCacheKey(allSteps, edges, dims) {
    // Stable: sort to ignore array order changes that don't affect shape.
    // Includes label/caseName — an edge's REAL identity — so parallel branch
    // edges between the same pair don't collapse into one cache entry.
    const nodeIds = allSteps.map(s => s.id).sort().join(',');
    const edgeKey = edges
        .filter(e => e.from && e.to)
        .map(e => `${e.from}>${e.to}|${e.label || ''}|${e.caseName ?? ''}`)
        .sort()
        .join('|');
    return `${dims.width}x${dims.height}#${nodeIds}#${edgeKey}`;
}

function rememberLayout(key, positionById) {
    if (layoutCache.has(key)) layoutCache.delete(key);
    layoutCache.set(key, positionById);
    if (layoutCache.size > LAYOUT_CACHE_CAP) {
        // Drop the oldest entry — Maps preserve insertion order.
        const oldest = layoutCache.keys().next().value;
        if (oldest !== undefined) layoutCache.delete(oldest);
    }
}

/**
 * Lay every node out with dagre and return Map<id, {x, y}> in top-left
 * coordinates. Memoised on graph shape.
 */
export function runDagre(allSteps, edges, dims) {
    const key = layoutCacheKey(allSteps, edges, dims);
    const cached = layoutCache.get(key);
    if (cached) {
        // LRU touch: re-insert so the hit promotes to most-recent.
        layoutCache.delete(key);
        layoutCache.set(key, cached);
        return cached;
    }

    const g = new dagre.graphlib.Graph();
    // ranksep is the gap BETWEEN cards along the flow, and it was 64 against a
    // 240px card — 27% of a card's width, which is not enough room for the
    // thing that actually lives in that gap. Edges carry labels ("on error",
    // "0 steps inside", "≤100", a branch name), and at 64px those badges
    // overlapped the cards on either side, so a chain of eight steps read as
    // one continuous smear rather than eight things with relationships.
    //
    // 120 puts the gap at half a card. nodesep (32 → 48) is the gap between
    // SIBLINGS in the same rank — the stacked arms of a condition or switch —
    // where the two branch labels sat almost touching.
    //
    // The cost is width: a long linear flow is now ~20% wider, so fitView
    // scales it down slightly. That is paid back by the fitView padding in
    // DiagramPane, which was reserving more margin than a canvas of this
    // shape needs.
    g.setGraph({ rankdir: 'LR', nodesep: 48, ranksep: 120, marginx: 16, marginy: 16 });
    g.setDefaultEdgeLabel(() => ({}));
    for (const s of allSteps) g.setNode(s.id, { width: dims.width, height: dims.height });
    for (const e of edges) {
        if (!e.from || !e.to) continue;
        g.setEdge(e.from, e.to);
    }
    dagre.layout(g);
    const out = new Map();
    for (const s of allSteps) {
        const n = g.node(s.id) || { x: 0, y: 0 };
        out.set(s.id, { x: n.x - dims.width / 2, y: n.y - dims.height / 2 });
    }
    rememberLayout(key, out);
    return out;
}

/**
 * Positions for a whole graph ({trigger, triggers?, steps, edges}) using the
 * same rule the canvas uses: saved coordinates verbatim when EVERY node has
 * one, dagre for the whole graph otherwise (a half-laid-out canvas is worse
 * than a re-laid-out one).
 *
 * @returns {Map<string, {x:number,y:number}>}
 */
export function graphPositions(graph, dims = { width: 240, height: 96 }) {
    const allSteps = graphNodes(graph);
    if (allSteps.length === 0) return new Map();
    if (allSteps.every(s => isFinitePos(s.position))) {
        return new Map(allSteps.map(s => [s.id, { x: s.position.x, y: s.position.y }]));
    }
    return runDagre(allSteps, (graph?.edges || []).filter(e => e?.from && e?.to), dims);
}

/** Trigger + secondary triggers + steps, in the order the canvas renders them. */
export function graphNodes(graph) {
    if (!graph) return [];
    return [
        graph.trigger,
        ...(Array.isArray(graph.triggers) ? graph.triggers : []),
        ...(Array.isArray(graph.steps) ? graph.steps : []),
    ].filter(s => s && s.id);
}
