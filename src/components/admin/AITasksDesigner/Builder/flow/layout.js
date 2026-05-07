import dagre from '@dagrejs/dagre';

/**
 * Auto-layout the automation graph with dagre. Returns nodes/edges in the
 * shape React Flow expects (`{id, type, position, data}` for nodes,
 * `{id, source, target, label, data}` for edges).
 *
 * Inputs:
 *   def        — the draft definition: { trigger, steps[], edges[] }
 *   runByStep  — Map<stepId, runStep> for live status / output
 *   issuesByStep — Map<stepId, { errors:[], warnings:[] }> for the badge
 *   dims       — { width, height } per-node estimate; passed in by the
 *                renderer so dagre's box sizing matches the rendered card.
 */
export function buildLayout(def, { runByStep, issuesByStep, dims = { width: 240, height: 96 } }) {
    if (!def || !def.trigger) {
        return { nodes: [], edges: [] };
    }

    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: 'LR', nodesep: 32, ranksep: 64, marginx: 16, marginy: 16 });
    g.setDefaultEdgeLabel(() => ({}));

    const allSteps = [def.trigger, ...(def.steps || [])];
    for (const s of allSteps) {
        g.setNode(s.id, { width: dims.width, height: dims.height });
    }
    for (const e of (def.edges || [])) {
        if (!e.from || !e.to) continue;
        g.setEdge(e.from, e.to);
    }

    dagre.layout(g);

    const nodes = allSteps.map((s) => {
        const pos = g.node(s.id) || { x: 0, y: 0 };
        const isTrigger = s.id === def.trigger.id;
        const runStep = runByStep?.get(s.id) || null;
        const issues = issuesByStep?.get(s.id) || { errors: [], warnings: [] };
        // Map step.type → React Flow node type. Trigger gets its own
        // component because its data shape (kind, schedule.cron) differs.
        const type = isTrigger ? 'trigger' : (s.type || 'integration_action');
        return {
            id: s.id,
            type,
            position: { x: pos.x - dims.width / 2, y: pos.y - dims.height / 2 },
            data: { step: s, runStep, issues, isTrigger },
            // The default x/y handles work for LR layout — no need to override.
        };
    });

    const edges = (def.edges || [])
        .filter((e) => e.from && e.to)
        .map((e, i) => {
            // `then`/`else` branches get a coloured chip; loop labels too.
            const kind = e.label === 'then' ? 'then'
                : e.label === 'else' ? 'else'
                : (e.label || null);
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
