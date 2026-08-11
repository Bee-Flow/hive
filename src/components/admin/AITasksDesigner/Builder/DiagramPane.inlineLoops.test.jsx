import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import DiagramPane from './DiagramPane';
import { composeInlineGraph, shiftForExpansion } from './flow/inlineFlowlets';
import { buildLayout } from './flow/layout';

/**
 * Where the loop-container geometry meets React Flow. The pure layer is covered
 * in flow/inlineLoops.test.js; this asserts the canvas actually draws the box
 * and puts the body steps INSIDE it. The parent/child relationship is what lets
 * React Flow move, clip and nest them — a silent regression there looks like
 * the feature simply doing nothing.
 */
const DEF = {
    trigger: { id: 'trg', type: 'trigger', kind: 'manual', label: 'Start', position: { x: 0, y: 0 } },
    steps: [
        {
            id: 'lp1', type: 'loop', label: 'Repeat for each',
            overRef: 'trigger.output.rows', itemVar: 'invoice',
            position: { x: 400, y: 0 },
            body: [
                { id: 'a', type: 'ai_step', label: 'Draft a reply', prompt: 'x', position: { x: 300, y: 0 } },
                { id: 'b', type: 'set', label: 'Tidy it up', position: { x: 600, y: 0 } },
            ],
        },
        { id: 'after', type: 'ai_step', label: 'Summarise', prompt: 'y', position: { x: 800, y: 0 } },
    ],
    edges: [{ from: 'trg', to: 'lp1' }, { from: 'lp1', to: 'after' }],
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

const nodeEl = (container, id) => [...container.querySelectorAll('.react-flow__node')]
    .find(n => n.getAttribute('data-id') === id) || null;

describe('DiagramPane — expanded loops', () => {
    beforeEach(cleanup);

    it('draws the loop as a single card while collapsed', () => {
        const { container } = renderCanvas([]);
        expect(nodeEl(container, 'lp1')).toBeTruthy();
        expect(nodeEl(container, 'lp1/a')).toBeNull();
        expect(screen.queryByText('Draft a reply')).toBeNull();
    });

    it('draws the body inside the container once expanded', () => {
        const { container, sidecar } = renderCanvas(['lp1']);
        const box = nodeEl(container, 'lp1');
        expect(box.style.width).toBe(`${sidecar.get('lp1').size.width}px`);
        for (const id of ['lp1/__item__', 'lp1/a', 'lp1/b']) {
            expect(nodeEl(container, id)).toBeTruthy();
        }
        expect(screen.getByText('Draft a reply')).toBeTruthy();
        expect(screen.getByText('loop.invoice')).toBeTruthy();
    });

    it('nests the body under the container so React Flow moves and clips it', () => {
        const { container } = renderCanvas(['lp1']);
        const ids = [...container.querySelectorAll('.react-flow__node')].map(n => n.getAttribute('data-id'));
        expect(ids.indexOf('lp1')).toBeLessThan(ids.indexOf('lp1/a'));
        expect(nodeEl(container, 'lp1').className.split(/\s+/)).toContain('parent');
    });

    it('lays out the body chain but not the container-to-entry link', () => {
        // Asserted through buildLayout rather than the DOM: React Flow draws no
        // edges in jsdom (it waits for measured node sizes), so the layout
        // output IS the observable behaviour here.
        const { graph, sidecar } = composeInlineGraph(DEF, DEF, new Set(['lp1']));
        const { edges } = buildLayout(graph, { sidecar, shiftById: shiftForExpansion(graph, sidecar) });
        const pairs = edges.map(e => `${e.source}->${e.target}`);
        expect(pairs).toContain('lp1/__item__->lp1/a');
        expect(pairs).toContain('lp1/a->lp1/b');
        // The container-to-entry link exists in the graph so the variable
        // picker can see past the loop, but drawing it would run a line out of
        // the loop's own output handle and back into its first child.
        expect(pairs).not.toContain('lp1->lp1/__item__');
    });

    it('keeps the flow around the loop on the canvas, pushed clear of the box', () => {
        const { container } = renderCanvas(['lp1']);
        const after = nodeEl(container, 'after');
        const x = Number(/translate\((-?[\d.]+)px/.exec(after.style.transform)?.[1]);
        expect(x).toBeGreaterThan(800);
    });

    it('offers no Disconnect on a body step — its links are derived', () => {
        // "Take this step out of the flow" on a body step would be undone by
        // the next render, because the chain is rebuilt from the body's order.
        // Deleting it, or dragging it elsewhere in the chain, are what mean
        // something there. The step AFTER the loop keeps the button.
        const { container } = renderCanvas(['lp1']);
        const detach = (id) => nodeEl(container, id)?.querySelector('[aria-label="Disconnect step"]');
        expect(detach('lp1/a')).toBeNull();
        expect(detach('after')).toBeTruthy();
    });

    it('still lets a body step be deleted and duplicated', () => {
        const { container } = renderCanvas(['lp1']);
        const node = nodeEl(container, 'lp1/a');
        expect(node.querySelector('[aria-label="Delete step"]')).toBeTruthy();
        expect(node.querySelector('[aria-label="Duplicate step"]')).toBeTruthy();
    });

    it('protects the entry pill from deletion', () => {
        const { container } = renderCanvas(['lp1']);
        // It is not in the document, so there is nothing there to remove.
        expect(nodeEl(container, 'lp1/__item__').querySelector('[aria-label="Delete step"]')).toBeNull();
    });
});
