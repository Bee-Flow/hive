/**
 * AI-step tools, drawn on the canvas.
 *
 * An AI step's tools are a plain `tools: string[]` of catalog function names
 * (`gmail_search`) on the step itself — see server/core/automationRunner's
 * execAiStep. They were only ever editable as chips inside the step's editor,
 * which meant the one thing an AI step DOES ("it can look things up in Gmail")
 * was invisible on the canvas.
 *
 * This module derives a satellite node per tool, hanging under its AI step, and
 * the attach/detach edits that dragging an app from the ribbon performs.
 *
 * ── The one rule that shapes everything here ────────────────────────────────
 * These nodes are CANVAS-ONLY. They are never written into `definition.steps`
 * and their links are never written into `definition.edges`: those two arrays
 * are the execution surface, and the server's validator rejects a step type it
 * does not know (`step.unknown_type`) or an edge pointing at a non-step
 * (`edge.unknown_from/to`) as an INTEGRITY error — i.e. every save would 400.
 * A decorative edge that did validate would still change fan-in gating at run
 * time. So the document keeps exactly the `tools` array it has always kept, and
 * the canvas renders it. Same contract as the expanded loop's "Each item" pill
 * (see nodeDefs' SYNTHETIC_TYPES).
 *
 * Positions are derived, not stored, for the same reason — there is nowhere
 * honest to persist them — so tool nodes are not draggable.
 *
 * Pure and React-free; colocated test in aiToolNodes.test.js.
 */

/**
 * Separator between an AI step's id and the tool name in a synthetic node id.
 * Chosen because `newStepId` only ever emits `[a-z0-9_]` ids, so no real step
 * can collide with one of these, and `parse` can split unambiguously even when
 * the tool name itself contains underscores.
 */
export const TOOL_ID_SEP = '::tool::';

/** The bottom port an AI step exposes for its tools. */
export const TOOL_HANDLE_ID = 'tools';

/** Layout of the satellite row, in flow units. */
const TOOL_NODE_W = 168;
const TOOL_NODE_GAP = 12;
const TOOL_ROW_DY = 132;      // below the parent's top edge
const PARENT_W = 240;         // StepNodeBase's fixed card width
/**
 * How much taller a step with tools is, for LAYOUT purposes only.
 *
 * Dagre lays a rank out with `nodesep: 48` between vertical siblings against a
 * 96px card — so a branch's second arm starts 144px below the first. The tool
 * row sits at +132 and is ~30px tall, i.e. straight through it. Telling dagre
 * the AI step's box is tall enough to contain its tools is what keeps a
 * branchy flow from drawing the arms on top of the chips.
 */
export const TOOL_ROW_EXTRA_H = 76;

export function toolNodeId(stepId, tool) {
    return `${stepId}${TOOL_ID_SEP}${tool}`;
}

export function isToolNodeId(id) {
    return typeof id === 'string' && id.includes(TOOL_ID_SEP);
}

/** `{ stepId, tool }` for a synthetic id, else null. */
export function parseToolNodeId(id) {
    if (!isToolNodeId(id)) return null;
    const at = id.indexOf(TOOL_ID_SEP);
    return { stepId: id.slice(0, at), tool: id.slice(at + TOOL_ID_SEP.length) };
}

/**
 * What an AI step's tool configuration MEANS, as three named states rather
 * than the (allowTools, tools) tuple every call site used to re-derive:
 *
 *   'none'     — no tools; the step answers from its prompt only.
 *   'explicit' — `tools` is an array; exactly those, and an EMPTY array
 *                deliberately means none (the runtime filters to nothing).
 *   'all'      — legacy steps saved with `allowTools: true` and no array:
 *                every tool the user is permitted. Never silently narrowed.
 */
export function toolStateOf(step) {
    if (!step || step.type !== 'ai_step') return { mode: 'none', tools: [] };
    if (Array.isArray(step.tools)) return { mode: 'explicit', tools: step.tools.filter(Boolean) };
    return step.allowTools ? { mode: 'all', tools: [] } : { mode: 'none', tools: [] };
}

/**
 * Add `tool` to a step's allowlist. Returns the same definition object when
 * nothing changes, so callers can skip the save round-trip.
 *
 * `allToolNames` is only consulted for a legacy "all tools" step: attaching one
 * tool to it must not quietly REMOVE the other hundred, so the list is first
 * made explicit from everything currently available (the same conversion the
 * editor's "Choose specific tools…" performs) and the new one added on top.
 */
export function attachTool(definition, stepId, tool, { allToolNames = [] } = {}) {
    if (!definition || !stepId || !tool) return definition;
    const steps = definition.steps || [];
    const idx = steps.findIndex(s => s?.id === stepId);
    if (idx < 0 || steps[idx].type !== 'ai_step') return definition;
    const state = toolStateOf(steps[idx]);
    const base = state.mode === 'all' ? [...allToolNames] : state.tools;
    if (base.includes(tool)) return definition;
    const next = [...base, tool];
    return replaceStep(definition, idx, { tools: next, allowTools: next.length > 0 });
}

/**
 * Remove `tool` from a step's allowlist. Leaves an EXPLICIT empty array when
 * the last one goes — `tools: []` is how the runtime is told "no tools", and
 * normalising it back to null would flip the step to legacy all-tools.
 */
export function detachTool(definition, stepId, tool) {
    if (!definition || !stepId || !tool) return definition;
    const steps = definition.steps || [];
    const idx = steps.findIndex(s => s?.id === stepId);
    if (idx < 0 || steps[idx].type !== 'ai_step') return definition;
    const state = toolStateOf(steps[idx]);
    if (state.mode !== 'explicit' || !state.tools.includes(tool)) return definition;
    const next = state.tools.filter(t => t !== tool);
    return replaceStep(definition, idx, { tools: next, allowTools: next.length > 0 });
}

function replaceStep(definition, idx, patch) {
    const steps = definition.steps.slice();
    steps[idx] = { ...steps[idx], ...patch };
    return { ...definition, steps };
}

/**
 * The satellite nodes + their links, derived from the ALREADY-LAID-OUT React
 * Flow nodes (not from the definition) so each tool inherits its parent's final
 * display position — including the offset an expanded flowlet applies, and the
 * `parentId`/`extent` that keeps a node clamped inside its container.
 *
 * `labelFor(tool)` → `{ label, description, integrationId }` for the chip;
 * callers pass a catalog-backed lookup. Missing entries still render (a tool
 * the catalog no longer offers is exactly what the user needs to SEE).
 */
export function buildAiToolGraph(nodes, { labelFor = null, onDetach = null, editable = false } = {}) {
    const outNodes = [];
    const outEdges = [];
    for (const parent of nodes || []) {
        if (parent?.type !== 'ai_step') continue;
        const step = parent.data?.step;
        const state = toolStateOf(step);
        // A legacy "all tools" step gets ONE node saying so. Rendering a
        // hundred satellites for it would bury the flow, and the set is not
        // even knowable here — it is whatever the user is permitted at run time.
        const entries = state.mode === 'all'
            ? [{ tool: null, key: `${parent.id}${TOOL_ID_SEP}*`, all: true }]
            : state.tools.map(t => ({ tool: t, key: toolNodeId(parent.id, t), all: false }));
        if (entries.length === 0) continue;

        const rowW = entries.length * TOOL_NODE_W + (entries.length - 1) * TOOL_NODE_GAP;
        const startX = (parent.position?.x ?? 0) + PARENT_W / 2 - rowW / 2;
        const y = (parent.position?.y ?? 0) + TOOL_ROW_DY;

        entries.forEach((entry, i) => {
            const meta = (entry.tool && labelFor) ? labelFor(entry.tool) : null;
            outNodes.push({
                id: entry.key,
                type: 'ai_tool',
                position: { x: startX + i * (TOOL_NODE_W + TOOL_NODE_GAP), y },
                // Derived, so the user must not be able to move, delete or
                // multi-select them into an operation that expects a step.
                draggable: false,
                deletable: false,
                selectable: false,
                ...(parent.parentId ? { parentId: parent.parentId, extent: parent.extent } : {}),
                data: {
                    stepId: parent.id,
                    tool: entry.tool,
                    all: entry.all,
                    label: entry.all ? 'All available tools' : (meta?.label || prettyToolName(entry.tool)),
                    description: entry.all
                        ? 'This step may use every tool you have access to. Open it to choose specific ones.'
                        : (meta?.description || null),
                    integrationId: meta?.integrationId || null,
                    onDetach: (editable && !entry.all && onDetach) ? onDetach : null,
                },
            });
            outEdges.push({
                id: `${entry.key}${TOOL_ID_SEP}link`,
                source: parent.id,
                sourceHandle: TOOL_HANDLE_ID,
                target: entry.key,
                type: 'toolLink',
                deletable: false,
                selectable: false,
                focusable: false,
            });
        });
    }
    return { nodes: outNodes, edges: outEdges };
}

/**
 * Per-node layout heights for dagre: `Map<stepId, px>` for the AI steps whose
 * tool row needs room underneath. Empty (and cheap) for graphs with none.
 */
export function toolLayoutHeights(steps, baseHeight) {
    const m = new Map();
    for (const s of steps || []) {
        if (s?.type !== 'ai_step') continue;
        const state = toolStateOf(s);
        if (state.mode === 'none') continue;
        if (state.mode === 'explicit' && state.tools.length === 0) continue;
        m.set(s.id, baseHeight + TOOL_ROW_EXTRA_H);
    }
    return m;
}

/**
 * Catalog lookup for the chip: function name → { label, description,
 * integrationId }. Built once from the same `/catalog` payload the ribbon and
 * the step editor read, so a tool is named identically in all three.
 */
export function toolLabelIndex(catalog) {
    const m = new Map();
    for (const app of (catalog?.apps || [])) {
        for (const a of (app.actions || [])) {
            if (!a?.name) continue;
            m.set(a.name, {
                label: a.label || prettyToolName(a.name),
                description: a.description || null,
                integrationId: a.integrationId || app.id || null,
            });
        }
    }
    return m;
}

/** Every tool name the catalog currently offers — the legacy-"all" expansion. */
export function allCatalogToolNames(catalog) {
    return (catalog?.apps || [])
        .filter(a => a?.available !== false)
        .flatMap(a => (a.actions || []).map(x => x?.name).filter(Boolean));
}

/** `gmail_search` → `Gmail search`, for tools the catalog can no longer name. */
export function prettyToolName(name) {
    return String(name || '')
        .replace(/_/g, ' ')
        .trim()
        .replace(/^./, c => c.toUpperCase());
}
