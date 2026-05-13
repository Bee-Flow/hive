import dagre from '@dagrejs/dagre';
import { buildStepLabelMap } from './displayHelpers';

/**
 * Auto-layout the automation graph. Returns nodes/edges in the shape
 * React Flow expects (`{id, type, position, data}` for nodes,
 * `{id, source, target, label, data}` for edges).
 *
 * Each step / trigger may carry a persisted `position: {x, y}` written
 * by the drag-and-drop builder. When *every* node has a position we
 * skip dagre and use those coordinates verbatim. If any node lacks one,
 * dagre lays the whole graph out so the canvas is never garbled — the
 * caller is expected to write the dagre-derived positions back into the
 * definition on the next save so future renders are stable.
 *
 * Inputs:
 *   def        — the draft definition: { trigger, steps[], edges[] }
 *   runByStep  — Map<stepId, runStep> for live status / output
 *   issuesByStep — Map<stepId, { errors:[], warnings:[] }> for the badge
 *   onAddAfter — optional callback (nodeId) → void; piped through node
 *                `data` so per-type wrappers can render the n8n-style
 *                "+ next step" hover button without prop-drilling.
 *   dims       — { width, height } per-node estimate; passed in by the
 *                renderer so dagre's box sizing matches the rendered card.
 */
export function buildLayout(def, { runByStep, issuesByStep, onAddAfter = null, dims = { width: 240, height: 96 } }) {
    if (!def || !def.trigger) {
        return { nodes: [], edges: [] };
    }

    const allSteps = [def.trigger, ...(def.steps || [])];
    const stepLabelById = buildStepLabelMap(def);

    const everyHasPosition = allSteps.every(s => isFinitePos(s.position));
    let positionById;
    if (everyHasPosition) {
        positionById = new Map(allSteps.map(s => [s.id, { x: s.position.x, y: s.position.y }]));
    } else {
        positionById = runDagre(allSteps, def.edges || [], dims);
    }

    const nodes = allSteps.map((s) => {
        const pos = positionById.get(s.id) || { x: 0, y: 0 };
        const isTrigger = s.id === def.trigger.id;
        const runStep = runByStep?.get(s.id) || null;
        const issues = issuesByStep?.get(s.id) || { errors: [], warnings: [] };
        const type = isTrigger ? 'trigger' : (s.type || 'integration_action');
        return {
            id: s.id,
            type,
            position: { x: pos.x, y: pos.y },
            data: { step: s, runStep, issues, isTrigger, onAddAfter, stepLabelById },
        };
    });

    const edges = (def.edges || [])
        .filter((e) => e.from && e.to)
        .map((e, i) => {
            // Switch edges carry caseName and a label of form `case:<name>`.
            // Surface that as a chip so the user sees which branch each edge
            // routes to without having to click into the inspector.
            let kind = null;
            if (e.label === 'then') kind = 'then';
            else if (e.label === 'else') kind = 'else';
            else if (e.caseName) kind = e.caseName === 'default' ? 'default' : e.caseName;
            else if (typeof e.label === 'string' && e.label.startsWith('case:')) kind = e.label.slice(5);
            else if (e.label) kind = e.label;
            return {
                id: `${e.from}->${e.to}-${i}`,
                source: e.from,
                target: e.to,
                label: kind || undefined,
                data: { kind },
                type: 'labelled',
            };
        });

    return { nodes, edges };
}

function isFinitePos(p) {
    return p && typeof p.x === 'number' && typeof p.y === 'number'
        && Number.isFinite(p.x) && Number.isFinite(p.y);
}

function runDagre(allSteps, edges, dims) {
    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: 'LR', nodesep: 32, ranksep: 64, marginx: 16, marginy: 16 });
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
    return out;
}

/**
 * Returns a copy of `def` with `position: {x, y}` populated on every
 * step + trigger via dagre. Cheap to call repeatedly — used by the
 * editable canvas to backfill missing positions on first edit so users
 * don't snap a single node and have everything else fly to (0,0).
 */
export function seedPositions(def, dims = { width: 240, height: 96 }) {
    if (!def || !def.trigger) return def;
    const allSteps = [def.trigger, ...(def.steps || [])];
    if (allSteps.every(s => isFinitePos(s.position))) return def;
    const positionById = runDagre(allSteps, def.edges || [], dims);
    const apply = (s) => isFinitePos(s.position) ? s : { ...s, position: positionById.get(s.id) || { x: 0, y: 0 } };
    return {
        ...def,
        trigger: apply(def.trigger),
        steps: (def.steps || []).map(apply),
    };
}
