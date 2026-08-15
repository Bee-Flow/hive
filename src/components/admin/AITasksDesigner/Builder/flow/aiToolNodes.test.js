import { describe, it, expect } from 'vitest';
import {
    TOOL_ID_SEP, toolNodeId, isToolNodeId, parseToolNodeId, toolStateOf,
    attachTool, detachTool, buildAiToolGraph, toolLabelIndex, allCatalogToolNames,
} from './aiToolNodes';

const aiStep = (over = {}) => ({ id: 'ai1', type: 'ai_step', prompt: 'go', position: { x: 100, y: 40 }, ...over });
const defWith = (step) => ({ trigger: { id: 't1', type: 'trigger' }, steps: [step], edges: [] });

describe('aiToolNodes — synthetic ids', () => {
    it('round-trips a tool name that contains underscores', () => {
        const id = toolNodeId('ai1', 'nextcloud_talk_send_message');
        expect(isToolNodeId(id)).toBe(true);
        expect(parseToolNodeId(id)).toEqual({ stepId: 'ai1', tool: 'nextcloud_talk_send_message' });
    });

    it('never claims a real step id', () => {
        // newStepId only ever emits [a-z0-9_], so no real id can contain the
        // separator — this is what keeps the two id spaces apart.
        expect(isToolNodeId('ai_step_1a2b')).toBe(false);
        expect(parseToolNodeId('ai_step_1a2b')).toBeNull();
        expect(TOOL_ID_SEP.includes(':')).toBe(true);
    });
});

describe('aiToolNodes — the three tool states', () => {
    it('reads an explicit list, an empty list, legacy all, and none', () => {
        expect(toolStateOf(aiStep({ tools: ['gmail_search'], allowTools: true })))
            .toEqual({ mode: 'explicit', tools: ['gmail_search'] });
        // An EMPTY array is deliberate: the runtime filters to no tools.
        expect(toolStateOf(aiStep({ tools: [], allowTools: false })))
            .toEqual({ mode: 'explicit', tools: [] });
        expect(toolStateOf(aiStep({ allowTools: true })).mode).toBe('all');
        expect(toolStateOf(aiStep({})).mode).toBe('none');
        expect(toolStateOf({ id: 's', type: 'set' }).mode).toBe('none');
    });
});

describe('aiToolNodes — attach', () => {
    it('adds the tool and derives allowTools', () => {
        const next = attachTool(defWith(aiStep({})), 'ai1', 'gmail_search');
        expect(next.steps[0].tools).toEqual(['gmail_search']);
        expect(next.steps[0].allowTools).toBe(true);
    });

    it('is a no-op when the step already has it (same object back)', () => {
        const def = defWith(aiStep({ tools: ['gmail_search'], allowTools: true }));
        expect(attachTool(def, 'ai1', 'gmail_search')).toBe(def);
    });

    it('never silently narrows a legacy all-tools step', () => {
        const def = defWith(aiStep({ allowTools: true })); // tools absent = "all"
        const next = attachTool(def, 'ai1', 'gmail_search', {
            allToolNames: ['gmail_read', 'drive_upload_file'],
        });
        // Everything it could already do, plus the new one — not just the new one.
        expect(next.steps[0].tools).toEqual(['gmail_read', 'drive_upload_file', 'gmail_search']);
    });

    it('refuses non-ai steps and unknown ids', () => {
        const def = { trigger: { id: 't1' }, steps: [{ id: 's1', type: 'set' }], edges: [] };
        expect(attachTool(def, 's1', 'gmail_search')).toBe(def);
        expect(attachTool(def, 'nope', 'gmail_search')).toBe(def);
    });
});

describe('aiToolNodes — detach', () => {
    it('removes one and leaves an EXPLICIT empty array behind', () => {
        const def = defWith(aiStep({ tools: ['gmail_search'], allowTools: true }));
        const next = detachTool(def, 'ai1', 'gmail_search');
        // [] means "no tools" to the runtime; null would mean "all tools".
        expect(next.steps[0].tools).toEqual([]);
        expect(next.steps[0].allowTools).toBe(false);
    });

    it('will not touch a legacy all-tools step (nothing to remove from)', () => {
        const def = defWith(aiStep({ allowTools: true }));
        expect(detachTool(def, 'ai1', 'gmail_search')).toBe(def);
    });
});

describe('aiToolNodes — the derived graph', () => {
    const nodes = [
        { id: 'ai1', type: 'ai_step', position: { x: 100, y: 40 }, data: { step: aiStep({ tools: ['gmail_search', 'drive_upload_file'], allowTools: true }) } },
        { id: 's2', type: 'set', position: { x: 500, y: 40 }, data: { step: { id: 's2', type: 'set' } } },
    ];

    it('hangs one chip per tool under the step, centred and non-interactive', () => {
        const { nodes: out, edges } = buildAiToolGraph(nodes, { editable: true, onDetach: () => {} });
        expect(out).toHaveLength(2);
        expect(out.every(n => n.type === 'ai_tool')).toBe(true);
        // Derived positions, so they must not be movable or deletable.
        expect(out.every(n => n.draggable === false && n.deletable === false && n.selectable === false)).toBe(true);
        // Below the parent, straddling its centre (240px card at x=100 → 220).
        expect(out.every(n => n.position.y === 40 + 132)).toBe(true);
        expect(out[0].position.x).toBeLessThan(220);
        expect(out[1].position.x).toBeGreaterThan(220);
        // Tethered to the parent's bottom port.
        expect(edges).toHaveLength(2);
        expect(edges[0]).toMatchObject({ source: 'ai1', sourceHandle: 'tools', type: 'toolLink', deletable: false });
    });

    it('shows legacy all-tools as ONE chip, with no per-tool remove', () => {
        const legacy = [{ id: 'ai1', type: 'ai_step', position: { x: 0, y: 0 }, data: { step: aiStep({ allowTools: true }) } }];
        const { nodes: out } = buildAiToolGraph(legacy, { editable: true, onDetach: () => {} });
        expect(out).toHaveLength(1);
        expect(out[0].data.label).toBe('All available tools');
        expect(out[0].data.onDetach).toBeNull();
    });

    it('draws nothing for a step with no tools, and never for other step types', () => {
        expect(buildAiToolGraph([nodes[1]], {}).nodes).toEqual([]);
        const bare = [{ id: 'ai1', type: 'ai_step', position: { x: 0, y: 0 }, data: { step: aiStep({}) } }];
        expect(buildAiToolGraph(bare, {}).nodes).toEqual([]);
    });

    it('inherits the parent flowlet container so chips stay clamped inside it', () => {
        const inside = [{
            id: 'lay1/ai1', type: 'ai_step', position: { x: 10, y: 10 },
            parentId: 'lay1', extent: 'parent',
            data: { step: aiStep({ id: 'lay1/ai1', tools: ['gmail_search'], allowTools: true }) },
        }];
        const { nodes: out } = buildAiToolGraph(inside, {});
        expect(out[0]).toMatchObject({ parentId: 'lay1', extent: 'parent' });
    });

    it('names a tool from the catalog, and still draws one the catalog forgot', () => {
        const catalog = { apps: [{ id: 'gmail', actions: [{ name: 'gmail_search', label: 'Search email', description: 'd', integrationId: 'gmail' }] }] };
        const labels = toolLabelIndex(catalog);
        const { nodes: out } = buildAiToolGraph(nodes, { labelFor: (t) => labels.get(t) || null });
        expect(out[0].data.label).toBe('Search email');
        // Unknown to the catalog — the user most needs to SEE that one.
        expect(out[1].data.label).toBe('Drive upload file');
    });
});

describe('aiToolNodes — catalog helpers', () => {
    it('lists only available apps when expanding legacy all-tools', () => {
        const catalog = {
            apps: [
                { id: 'gmail', actions: [{ name: 'gmail_search' }] },
                { id: 'secret', available: false, actions: [{ name: 'secret_do' }] },
            ],
        };
        expect(allCatalogToolNames(catalog)).toEqual(['gmail_search']);
    });
});
