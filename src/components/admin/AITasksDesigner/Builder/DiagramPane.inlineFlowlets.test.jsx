import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import DiagramPane from './DiagramPane';
import { composeInlineGraph, shiftForExpansion } from './flow/inlineFlowlets';

/**
 * The one place the inline-flowlet geometry meets React Flow. The pure layer is
 * covered in flow/inlineFlowlets.test.js; this asserts that the canvas actually
 * draws the container and puts the flowlet's steps INSIDE it — the parent/child
 * relationship is what React Flow needs to clip, drag and nest them, and a
 * silent regression there would look like the feature simply doing nothing.
 */
const DEF = {
    schemaVersion: 2,
    trigger: { id: 'trg', type: 'trigger', kind: 'manual', label: 'Start', position: { x: 0, y: 0 } },
    steps: [
        { id: 'cl1', type: 'call_layer', layerKey: 'enrich', label: 'Enrich contact', position: { x: 400, y: 0 } },
        { id: 'after', type: 'ai_step', label: 'Summarise', prompt: 'x', position: { x: 800, y: 0 } },
    ],
    edges: [{ from: 'trg', to: 'cl1' }, { from: 'cl1', to: 'after' }],
    layers: {
        enrich: {
            title: 'Enrich contact',
            trigger: { id: 'ltrg', type: 'trigger', kind: 'layer_input', label: 'Flowlet input', params: [], position: { x: 0, y: 0 } },
            steps: [
                { id: 's1', type: 'ai_step', label: 'Look it up', prompt: 'y', position: { x: 300, y: 0 } },
                { id: 'out', type: 'layer_output', fields: {}, label: 'Return', position: { x: 600, y: 0 } },
            ],
            edges: [{ from: 'ltrg', to: 's1' }, { from: 's1', to: 'out' }],
        },
    },
};

function renderCanvas(expandedKeys) {
    const { graph, sidecar } = composeInlineGraph(DEF, DEF, new Set(expandedKeys));
    const shiftById = shiftForExpansion(graph, sidecar);
    const utils = render(
        <div style={{ width: 1200, height: 800 }}>
            <DiagramPane definition={graph} sidecar={sidecar} shiftById={shiftById} editable />
        </div>,
    );
    return { ...utils, sidecar };
}

/**
 * React Flow tags each rendered node with its id. Matched by iteration rather
 * than a selector: an inline node's id contains a `/`, which needs escaping in
 * an attribute selector and is easy to get subtly wrong.
 */
const nodeEl = (container, id) => [...container.querySelectorAll('.react-flow__node')]
    .find(n => n.getAttribute('data-id') === id) || null;

describe('DiagramPane — expanded flowlets', () => {
    beforeEach(cleanup);

    it('draws the flowlet as a single card while collapsed', () => {
        const { container } = renderCanvas([]);
        expect(nodeEl(container, 'cl1')).toBeTruthy();
        expect(nodeEl(container, 'cl1/s1')).toBeNull();
        expect(screen.queryByText('Look it up')).toBeNull();
    });

    it("draws the flowlet's steps as children of the container once expanded", () => {
        const { container, sidecar } = renderCanvas(['cl1']);
        const box = nodeEl(container, 'cl1');
        expect(box).toBeTruthy();
        // The container is sized to its contents rather than the 240px card.
        expect(box.style.width).toBe(`${sidecar.get('cl1').size.width}px`);

        for (const id of ['cl1/ltrg', 'cl1/s1', 'cl1/out']) {
            expect(nodeEl(container, id)).toBeTruthy();
        }
        expect(screen.getByText('Look it up')).toBeTruthy();
    });

    it('nests the children under the container so React Flow moves and clips them with it', () => {
        const { container } = renderCanvas(['cl1']);
        // React Flow renders a parent's children after it and marks them
        // `parent`; without that relationship they would float loose on the
        // canvas at the flowlet's own coordinates.
        const ids = [...container.querySelectorAll('.react-flow__node')].map(n => n.getAttribute('data-id'));
        expect(ids.indexOf('cl1')).toBeLessThan(ids.indexOf('cl1/s1'));
        // React Flow marks a node that has children — that class only appears
        // once it has resolved their `parentId` back to this node.
        expect(nodeEl(container, 'cl1').className.split(/\s+/)).toContain('parent');
        // …and the children are then placed relative to it: the container sits
        // at x=400, its contents start one padding in, so React Flow resolves
        // `cl1/s1` (stored at x=300 in the flowlet's own space) to 400+20+300.
        expect(nodeEl(container, 'cl1/s1').style.transform).toBe('translate(720px,66px)');
    });

    it('keeps the flow around the flowlet on the canvas, pushed clear of the box', () => {
        const { container } = renderCanvas(['cl1']);
        expect(screen.getByText('Summarise')).toBeTruthy();
        const after = nodeEl(container, 'after');
        // The neighbour moved right to make room; its stored position is 800.
        const x = Number(/translate\((-?[\d.]+)px/.exec(after.style.transform)?.[1]);
        expect(x).toBeGreaterThan(800);
    });
});
