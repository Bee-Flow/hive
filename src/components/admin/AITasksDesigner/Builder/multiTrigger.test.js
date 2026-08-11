import { describe, it, expect } from 'vitest';
import { buildStepFromPayload, applyAddNode } from './DiagramPane';
import { buildLayout, seedPositions } from './flow/layout';
import { collectUpstream, computeUpstreamGroups } from './mapping/upstream';

/**
 * Scoped multi-trigger slice (webhook/app_event only) — FE half of the
 * contract whose server half is covered by
 * server/routes/automation/crud.multiTrigger.test.js and
 * server/automation/triggerBus.dispatch.rootStepId.test.js.
 *
 * definition.trigger stays the untouched primary; definition.triggers[]
 * holds ADDITIONAL webhook/app_event entries (validate.js rejects schedule/
 * manual there). These tests lock in: building a secondary-trigger payload,
 * appending (not replacing) via applyAddNode, canvas layout treating every
 * trigger as its own root, and the upstream variable picker surfacing every
 * trigger as its own group.
 */
describe('buildStepFromPayload — secondary trigger', () => {
    it('a plain trigger payload still marks __replaceTrigger (unchanged single-trigger behavior)', () => {
        const built = buildStepFromPayload({ kind: 'trigger', triggerKind: 'webhook', label: 'Webhook' });
        expect(built.__replaceTrigger).toBe(true);
        expect(built.__addTrigger).toBeUndefined();
    });

    it('asSecondaryTrigger marks __addTrigger instead of __replaceTrigger', () => {
        const built = buildStepFromPayload({ kind: 'trigger', triggerKind: 'webhook', label: 'Webhook', asSecondaryTrigger: true });
        expect(built.__addTrigger).toBe(true);
        expect(built.__replaceTrigger).toBeUndefined();
        expect(built.type).toBe('trigger');
        expect(built.kind).toBe('webhook');
    });
});

describe('applyAddNode — secondary trigger append', () => {
    const baseDef = {
        trigger: { id: 'trg1', type: 'trigger', kind: 'manual', position: { x: 0, y: 0 } },
        steps: [],
        edges: [],
    };

    it('appends to definition.triggers[] instead of replacing definition.trigger', () => {
        const payload = { kind: 'trigger', triggerKind: 'webhook', label: 'Webhook', asSecondaryTrigger: true };
        const next = applyAddNode(baseDef, payload, { x: 100, y: 100 });
        expect(next.trigger.id).toBe('trg1'); // primary untouched
        expect(next.triggers).toHaveLength(1);
        expect(next.triggers[0].kind).toBe('webhook');
        expect(next.triggers[0].type).toBe('trigger');
    });

    it('a second secondary trigger appends alongside the first', () => {
        const withOne = applyAddNode(baseDef, { kind: 'trigger', triggerKind: 'webhook', asSecondaryTrigger: true }, { x: 0, y: 0 });
        const withTwo = applyAddNode(withOne, { kind: 'trigger', triggerKind: 'app_event', asSecondaryTrigger: true }, { x: 0, y: 0 });
        expect(withTwo.triggers).toHaveLength(2);
        expect(withTwo.triggers.map(t => t.kind).sort()).toEqual(['app_event', 'webhook']);
    });
});

describe('buildLayout — additional triggers are extra roots', () => {
    const def = {
        trigger: { id: 'trg1', kind: 'manual', position: { x: 0, y: 0 } },
        triggers: [{ id: 'trg2', kind: 'webhook', position: { x: 0, y: 200 } }],
        steps: [
            { id: 'n1', type: 'notification', title: 'a', position: { x: 200, y: 0 } },
            { id: 'n2', type: 'notification', title: 'b', position: { x: 200, y: 200 } },
        ],
        edges: [
            { from: 'trg1', to: 'n1' },
            { from: 'trg2', to: 'n2' },
        ],
    };

    it('renders a node for the secondary trigger with type "trigger" and isTrigger true', () => {
        const { nodes } = buildLayout(def, { runByStep: new Map(), issuesByStep: new Map() });
        const secondary = nodes.find(n => n.id === 'trg2');
        expect(secondary).toBeTruthy();
        expect(secondary.type).toBe('trigger');
        expect(secondary.data.isTrigger).toBe(true);
    });

    it('onDiagnose stays scoped to the PRIMARY trigger only, never a secondary one', () => {
        const onDiagnose = () => {};
        const { nodes } = buildLayout(def, { runByStep: new Map(), issuesByStep: new Map(), onDiagnose });
        const primary = nodes.find(n => n.id === 'trg1');
        const secondary = nodes.find(n => n.id === 'trg2');
        expect(primary.data.onDiagnose).toBe(onDiagnose);
        expect(secondary.data.onDiagnose).toBeNull();
    });

    it('each trigger\'s own outgoing edge renders normally', () => {
        const { edges } = buildLayout(def, { runByStep: new Map(), issuesByStep: new Map() });
        expect(edges.some(e => e.source === 'trg1' && e.target === 'n1')).toBe(true);
        expect(edges.some(e => e.source === 'trg2' && e.target === 'n2')).toBe(true);
    });

    it('single-trigger definitions (no triggers[] field) are unaffected', () => {
        const single = { trigger: { id: 'trg1', kind: 'manual', position: { x: 0, y: 0 } }, steps: [], edges: [] };
        const { nodes } = buildLayout(single, { runByStep: new Map(), issuesByStep: new Map() });
        expect(nodes).toHaveLength(1);
        expect(nodes[0].id).toBe('trg1');
    });
});

describe('seedPositions — backfills positions for additional triggers too', () => {
    it('gives every triggers[] entry a position when missing, without touching present ones', () => {
        const def = {
            trigger: { id: 'trg1', kind: 'manual', position: { x: 0, y: 0 } },
            triggers: [{ id: 'trg2', kind: 'webhook' /* no position */ }],
            steps: [],
            edges: [],
        };
        const next = seedPositions(def);
        expect(next.triggers[0].position).toBeTruthy();
        expect(Number.isFinite(next.triggers[0].position.x)).toBe(true);
        expect(Number.isFinite(next.triggers[0].position.y)).toBe(true);
    });

    it('omits the triggers key entirely when the definition never had one', () => {
        const def = { trigger: { id: 'trg1', kind: 'manual' }, steps: [], edges: [] };
        const next = seedPositions(def);
        expect(next.triggers).toBeUndefined();
    });
});

describe('upstream.js — every trigger surfaces as its own group', () => {
    const def = {
        trigger: { id: 'trg1', kind: 'manual' },
        triggers: [{ id: 'trg2', kind: 'webhook' }],
        steps: [{ id: 'n1', type: 'notification', title: 'x' }],
        edges: [{ from: 'trg1', to: 'n1' }],
    };

    it('collectUpstream includes the primary AND the additional trigger even with no edge from it', () => {
        const upstream = collectUpstream(def, 'n1');
        const ids = upstream.map(n => n.id);
        expect(ids).toContain('trg1');
        expect(ids).toContain('trg2');
    });

    it('both trigger groups share the same runtime basePath (trigger.output)', () => {
        const groups = computeUpstreamGroups(def, 'n1', {});
        const triggerGroups = groups.filter(g => g.kind === 'trigger');
        expect(triggerGroups.length).toBeGreaterThanOrEqual(2);
        for (const g of triggerGroups) expect(g.basePath).toBe('trigger.output');
    });

    it('single-trigger definitions still work unchanged (no triggers[] field)', () => {
        const single = { trigger: { id: 'trg1', kind: 'manual' }, steps: [{ id: 'n1', type: 'notification', title: 'x' }], edges: [{ from: 'trg1', to: 'n1' }] };
        const upstream = collectUpstream(single, 'n1');
        expect(upstream.map(n => n.id)).toEqual(['trg1']);
    });
});
