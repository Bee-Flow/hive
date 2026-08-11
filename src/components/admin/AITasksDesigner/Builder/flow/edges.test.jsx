import { render, screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { STATUS_COLORS } from '../../../../../constants/palette';

/**
 * The custom edge's own logic: identity colour on the stroke, tinted case
 * chips, the hover palette, and the parallel-lane fan-out.
 *
 * ReactFlow's primitives are mocked: real edges only mount after node
 * measurement, which never happens in jsdom, and EdgeLabelRenderer portals
 * into a canvas element a bare provider doesn't create. The mock keeps the
 * exact prop contract (BaseEdge gets the merged style; getSmoothStepPath gets
 * the fanned-out coordinates) so what's asserted is OUR component, not the
 * vendor's plumbing.
 */
const viewport = { zoom: 1 };
// Identity screen→flow mapping, so a test can point at a flow coordinate by
// passing it as clientX/clientY and read the result straight off the transform.
const reactFlow = { screenToFlowPosition: ({ x, y }) => ({ x, y }) };
vi.mock('@xyflow/react', () => ({
    BaseEdge: ({ id, path, style }) => <path data-testid="base-edge" data-id={id} d={path} style={style} />,
    EdgeLabelRenderer: ({ children }) => <div data-testid="label-layer">{children}</div>,
    useViewport: () => viewport,
    useReactFlow: () => reactFlow,
    getSmoothStepPath: ({ sourceX, sourceY, targetX, targetY }) => [
        `M${sourceX},${sourceY} L${targetX},${targetY}`,
        (sourceX + targetX) / 2,
        (sourceY + targetY) / 2,
    ],
}));

const { LabelledEdge } = await import('./edges');
const { EdgeCrossingProvider } = await import('./EdgeCrossingContext');

const BASE = {
    id: 'a->b||', source: 'a', target: 'b',
    sourceX: 0, sourceY: 0, targetX: 200, targetY: 0,
    sourcePosition: 'right', targetPosition: 'left',
};

// DiagramPane hands every editable edge all three action callbacks, and each
// button is only drawn when its own handler is there — an edge inside an
// expanded loop is DERIVED from the body's order, so it gets "+" but no delete
// and no colour. Tests that want a control withheld pass it explicitly as null.
const EDIT_HANDLERS = { onInsert: () => {}, onDelete: () => {}, onSetColor: () => {} };

function renderEdge(props = {}) {
    const data = props.data?.editable ? { ...EDIT_HANDLERS, ...props.data } : props.data;
    const { container } = render(<svg><LabelledEdge {...BASE} {...props} data={data} /></svg>);
    return container;
}

describe('LabelledEdge', () => {
    beforeEach(cleanup);

    it('the caller style merges over the base stroke', () => {
        renderEdge({ style: { stroke: STATUS_COLORS.red } });
        const path = screen.getByTestId('base-edge');
        expect(path.style.stroke).toBe('rgb(239, 68, 68)');
        expect(path.style.strokeWidth).toBe('1.5'); // base width kept
    });

    it('keeps the neutral base look without a style override', () => {
        renderEdge();
        expect(screen.getByTestId('base-edge').style.stroke).toBe('var(--border-default)');
    });

    it('a case chip tints to the identity colour; semantic chips keep their tone', () => {
        renderEdge({ data: { kind: 'pdf', chipColor: STATUS_COLORS.red } });
        const chip = screen.getByText('pdf');
        expect(chip.style.color).toBe('rgb(239, 68, 68)');
        cleanup();
        renderEdge({ data: { kind: 'then', chipColor: STATUS_COLORS.red } });
        const thenChip = screen.getByText('match');
        expect(thenChip.style.color).toBe('');
        expect(thenChip.getAttribute('class')).toMatch(/emerald/);
    });

    it('the hover palette offers eight swatches + auto, and reports the row identity', () => {
        const onSetColor = vi.fn();
        const container = renderEdge({
            data: { kind: 'pdf', editable: true, defLabel: 'case:pdf', defCaseName: 'pdf', defColor: null, onSetColor },
        });
        // Reveal the hover controls, then open the swatches.
        fireEvent.mouseEnter(container.querySelector('path[stroke="transparent"]'));
        fireEvent.click(screen.getByLabelText('Colour this connection'));
        expect(screen.getAllByLabelText(/Colour this connection \w+/).length).toBe(8);
        fireEvent.click(screen.getByLabelText('Colour this connection red'));
        expect(onSetColor).toHaveBeenCalledWith({
            source: 'a', target: 'b', sourceHandle: null, label: 'case:pdf', caseName: 'pdf', color: 'red',
        });
    });

    it('the auto dot clears the colour (null)', () => {
        const onSetColor = vi.fn();
        const container = renderEdge({
            data: { editable: true, defColor: 'red', defLabel: null, defCaseName: null, onSetColor },
        });
        fireEvent.mouseEnter(container.querySelector('path[stroke="transparent"]'));
        fireEvent.click(screen.getByLabelText('Colour this connection'));
        fireEvent.click(screen.getByLabelText('Automatic colour'));
        expect(onSetColor).toHaveBeenCalledWith(expect.objectContaining({ color: null }));
    });

    it('read-only edges offer no palette at all', () => {
        renderEdge({ data: { kind: 'pdf' } });
        expect(screen.queryByLabelText('Colour this connection')).toBeNull();
    });

    it('parallel lanes shift the target Y so the paths separate, and stagger the chips', () => {
        renderEdge({ data: { kind: 'pdf', parallelIndex: 0, parallelCount: 2 } });
        const d1 = screen.getByTestId('base-edge').getAttribute('d');
        const t1 = screen.getByText('pdf').parentElement.style.transform;
        cleanup();
        renderEdge({ data: { kind: 'word', parallelIndex: 1, parallelCount: 2 } });
        const d2 = screen.getByTestId('base-edge').getAttribute('d');
        const t2 = screen.getByText('word').parentElement.style.transform;
        expect(d1).not.toBe(d2);
        expect(t1).not.toBe(t2);
        cleanup();
        // A lone edge keeps the exact unshifted path.
        renderEdge({ data: {} });
        expect(screen.getByTestId('base-edge').getAttribute('d')).toBe('M0,0 L200,0');
    });

    it('never renders a banned colour family', () => {
        const container = renderEdge({ data: { kind: 'pdf', chipColor: STATUS_COLORS.cyan, editable: true } });
        expect(/purple|violet|indigo|fuchsia/i.test(container.innerHTML)).toBe(false);
    });

    it('hover controls counter-scale against the canvas zoom (never billboard-sized)', () => {
        viewport.zoom = 2;
        const container = renderEdge({ data: { editable: true } });
        fireEvent.mouseEnter(container.querySelector('path[stroke="transparent"]'));
        const controls = screen.getByTitle('Insert a step here').parentElement;
        expect(controls.style.transform).toContain('scale(0.5)'); // exact inverse of 2× zoom
        viewport.zoom = 1;
    });
});

/**
 * BFSF-331 — the hover target and the cluster. Every one of these was a
 * distinct way the actions were unreachable.
 */
describe('LabelledEdge — reaching the connection controls', () => {
    beforeEach(() => { cleanup(); viewport.zoom = 1; });
    afterEach(() => { viewport.zoom = 1; });

    const band = (container) => container.querySelector('path[stroke="transparent"]');
    const bandWidth = (container) => Number(band(container).getAttribute('stroke-width'));

    it('the hit band is measured in SCREEN pixels, so zooming out widens it', () => {
        // A fixed flow-unit width shrank to 12 screen px at 0.5× zoom — and
        // fitView routinely lands below 1×.
        viewport.zoom = 1;
        const at1 = bandWidth(renderEdge({ data: { editable: true } }));
        cleanup();
        viewport.zoom = 0.5;
        const atHalf = bandWidth(renderEdge({ data: { editable: true } }));
        expect(atHalf).toBeGreaterThan(at1);
        cleanup();
        // …but never beyond a sane cap, or the whole canvas becomes one edge.
        viewport.zoom = 0.05;
        expect(bandWidth(renderEdge({ data: { editable: true } }))).toBeLessThanOrEqual(96);
        cleanup();
        viewport.zoom = 4;
        expect(bandWidth(renderEdge({ data: { editable: true } }))).toBeGreaterThanOrEqual(16);
    });

    it('parallel lanes never get overlapping hit bands', () => {
        // The lanes are LANE_PITCH apart; a band wider than that would mean two
        // neighbours fight over the same pixels and the wrong edge wins.
        viewport.zoom = 0.3;
        const container = renderEdge({ data: { editable: true, parallelIndex: 0, parallelCount: 3 } });
        const d1 = screen.getByTestId('base-edge').getAttribute('d');
        expect(bandWidth(container)).toBeLessThan(26);
        cleanup();
        const c2 = renderEdge({ data: { editable: true, parallelIndex: 1, parallelCount: 3 } });
        expect(screen.getByTestId('base-edge').getAttribute('d')).not.toBe(d1);
        expect(bandWidth(c2)).toBeLessThan(26);
    });

    // BASE runs from (0,0) to (200,0), so the midpoint is (100,0).
    const cluster = (container) => container.querySelector('[data-edge-cluster]');
    const anchorOf = (container) => {
        const m = /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)\s*scale/.exec(cluster(container).style.transform);
        return m ? { x: Number(m[1]), y: Number(m[2]) } : null;
    };

    it('the controls come to where you pointed, not to the middle of the line', () => {
        // The reachability half of the report: on a long connection the
        // midpoint is nowhere near the cursor, so the buttons "appeared
        // somewhere else".
        const container = renderEdge({ data: { editable: true } });
        expect(anchorOf(container)).toEqual({ x: 100, y: 0 });
        fireEvent.mouseEnter(band(container), { clientX: 20, clientY: 0 });
        expect(anchorOf(container)).toEqual({ x: 20, y: 0 });
    });

    it('but a hover near the middle leaves the cluster where a label belongs', () => {
        const container = renderEdge({ data: { editable: true } });
        fireEvent.mouseEnter(band(container), { clientX: 120, clientY: 0 });
        expect(anchorOf(container)).toEqual({ x: 100, y: 0 });
    });

    it('the cluster stays put once anchored — it is not a moving target', () => {
        const container = renderEdge({ data: { editable: true } });
        fireEvent.mouseEnter(band(container), { clientX: 20, clientY: 0 });
        fireEvent.mouseMove(band(container), { clientX: 180, clientY: 0 });
        expect(anchorOf(container)).toEqual({ x: 20, y: 0 });
    });

    it('returns to the midpoint once the cluster closes', async () => {
        vi.useFakeTimers();
        try {
            const container = renderEdge({ data: { editable: true } });
            fireEvent.mouseEnter(band(container), { clientX: 20, clientY: 0 });
            expect(anchorOf(container)).toEqual({ x: 20, y: 0 });
            fireEvent.mouseLeave(band(container));
            await act(async () => { vi.advanceTimersByTime(400); });
            expect(anchorOf(container)).toEqual({ x: 100, y: 0 });
        } finally {
            vi.useRealTimers();
        }
    });

    it('the hit band follows the line as DRAWN, hops and all', () => {
        // The band used to trace the undecorated geometry, so where this line
        // bridged over another it sat beside the line you can see.
        const container = render(
            <EdgeCrossingProvider>
                <svg>
                    <LabelledEdge {...BASE} id="a" data={{ editable: true }} />
                    <LabelledEdge {...BASE} id="b" sourceX={100} sourceY={-50} targetX={100} targetY={50}
                        sourcePosition="bottom" targetPosition="top" data={{ editable: true }} />
                </svg>
            </EdgeCrossingProvider>,
        ).container;
        const drawn = [...container.querySelectorAll('[data-testid="base-edge"]')].map(p => p.getAttribute('d'));
        const bands = [...container.querySelectorAll('path[stroke="transparent"]')].map(p => p.getAttribute('d'));
        expect(bands).toEqual(drawn);
    });

    it('a read-only edge carrying run data is still hoverable', () => {
        // On a run replay the badge IS the point of the edge; gating the band
        // on `editable` left it with nothing to hover at all.
        const container = renderEdge({ data: { dataSummary: { label: '201 records' } } });
        expect(band(container)).toBeTruthy();
        expect(screen.getByText('201 records')).toBeTruthy();
    });

    it('a read-only edge with nothing to show gets no hit band', () => {
        expect(band(renderEdge({ data: { kind: 'then' } }))).toBeNull();
    });

    it('the branch chip opens the cluster when the line itself is a hairline', () => {
        // Zoomed out, a parallel lane's band is only a few screen px — but a
        // parallel edge is always a branch edge, so it always has a chip, and
        // hovering that reaches the same controls.
        viewport.zoom = 0.3;
        const container = renderEdge({
            data: { kind: 'then', editable: true, parallelIndex: 0, parallelCount: 3 },
        });
        fireEvent.mouseEnter(cluster(container));
        const insert = screen.getByTitle('Insert a step here');
        expect(insert.style.opacity).toBe('1');
    });

    it('the data badge and the actions are visible AT THE SAME TIME', () => {
        // They used to be mutually exclusive: hovering unmounted the badge.
        const container = renderEdge({
            data: { kind: 'pdf', editable: true, dataSummary: { label: '12 records' } },
        });
        fireEvent.mouseEnter(band(container));
        expect(screen.getByText('12 records')).toBeTruthy();
        expect(screen.getByText('pdf')).toBeTruthy();
        expect(screen.getByTitle('Remove this connection').style.opacity).toBe('1');
    });

    it('hidden actions are inert; "+" stays as the resting hint', () => {
        const container = renderEdge({ data: { editable: true } });
        const remove = screen.getByTitle('Remove this connection');
        expect(remove.style.opacity).toBe('0');
        expect(remove.style.pointerEvents).toBe('none');
        // "+" is dimmed but live — the only signal a connection is editable.
        const plus = screen.getByTitle('Insert a step here');
        expect(plus.style.opacity).toBe('0.35');
        expect(plus.style.pointerEvents).not.toBe('none');
        fireEvent.mouseEnter(band(container));
        expect(screen.getByTitle('Remove this connection').style.pointerEvents).toBe('all');
    });

    it('the controls survive the trip from the line to a button', async () => {
        // The buttons hang off the midpoint, so the pointer must leave the
        // line to reach them. Without the grace period that mouseleave took
        // them away mid-reach.
        vi.useFakeTimers();
        try {
            const container = renderEdge({ data: { editable: true } });
            fireEvent.mouseEnter(band(container));
            fireEvent.mouseLeave(band(container));
            // Still up: the close is only scheduled.
            expect(screen.getByTitle('Remove this connection').style.opacity).toBe('1');
            act(() => { vi.advanceTimersByTime(100); });
            fireEvent.mouseEnter(screen.getByTitle('Insert a step here').parentElement);
            act(() => { vi.advanceTimersByTime(400); });
            expect(screen.getByTitle('Remove this connection').style.opacity).toBe('1');
        } finally {
            vi.useRealTimers();
        }
    });

    it('offers only "+" on a derived line, and still inserts', () => {
        // A line inside an expanded loop is drawn FROM the body's order
        // (flow/inlineFlowlets.js), so DiagramPane withholds delete and colour:
        // there is nothing there to remove or recolour, and the next render
        // would draw it straight back. Inserting a step IS an order change, so
        // "+" stays.
        const onInsert = vi.fn();
        const container = renderEdge({ data: { editable: true, onInsert, onDelete: null, onSetColor: null } });
        fireEvent.mouseEnter(band(container));
        expect(screen.queryByTitle('Remove this connection')).toBeNull();
        expect(screen.queryByTitle('Colour this connection')).toBeNull();
        fireEvent.click(screen.getByTitle('Insert a step here'));
        expect(onInsert).toHaveBeenCalledTimes(1);
    });

    it('leaving for good does close it', () => {
        vi.useFakeTimers();
        try {
            const container = renderEdge({ data: { editable: true } });
            fireEvent.mouseEnter(band(container));
            fireEvent.mouseLeave(band(container));
            act(() => { vi.advanceTimersByTime(400); });
            expect(screen.getByTitle('Remove this connection').style.opacity).toBe('0');
        } finally {
            vi.useRealTimers();
        }
    });

    it('an open colour picker survives a mouseleave', () => {
        vi.useFakeTimers();
        try {
            const container = renderEdge({ data: { editable: true, onSetColor: vi.fn() } });
            fireEvent.mouseEnter(band(container));
            fireEvent.click(screen.getByLabelText('Colour this connection'));
            fireEvent.mouseLeave(band(container));
            act(() => { vi.advanceTimersByTime(500); });
            expect(screen.getByLabelText('Automatic colour')).toBeTruthy();
        } finally {
            vi.useRealTimers();
        }
    });

    it('clicking the line latches the controls open until you dismiss them', () => {
        vi.useFakeTimers();
        try {
            const container = renderEdge({ data: { editable: true } });
            fireEvent.click(band(container));
            fireEvent.mouseLeave(band(container));
            act(() => { vi.advanceTimersByTime(500); });
            expect(screen.getByTitle('Remove this connection').style.opacity).toBe('1');

            fireEvent.mouseDown(document.body);
            expect(screen.getByTitle('Remove this connection').style.opacity).toBe('0');
        } finally {
            vi.useRealTimers();
        }
    });

    it('Escape releases a latched cluster', () => {
        const container = renderEdge({ data: { editable: true } });
        fireEvent.click(band(container));
        expect(screen.getByTitle('Remove this connection').style.opacity).toBe('1');
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(screen.getByTitle('Remove this connection').style.opacity).toBe('0');
    });

    it('a read-only edge with only a label chip does not swallow pointer events', () => {
        renderEdge({ data: { kind: 'pdf' } });
        expect(screen.getByText('pdf').parentElement.style.pointerEvents).toBe('none');
    });
});

describe('LabelledEdge — crossing another line', () => {
    beforeEach(cleanup);

    const drawn = (container) => container.querySelector('[data-testid="base-edge"]').getAttribute('d');

    it('bridges over an edge that crosses it', async () => {
        const { container } = render(
            <EdgeCrossingProvider>
                <svg>
                    {/* Horizontal, and a vertical straight through it. */}
                    <LabelledEdge {...BASE} id="h" sourceX={0} sourceY={50} targetX={200} targetY={50} />
                    <LabelledEdge {...BASE} id="v" sourceX={100} sourceY={0} targetX={100} targetY={100} />
                </svg>
            </EdgeCrossingProvider>,
        );
        // The first pass has nobody to hop over; each edge publishes, and the
        // bridge appears on the pass after.
        await waitFor(() => expect(container.querySelectorAll('[data-testid="base-edge"]')[0].getAttribute('d')).toContain('A'));

        const [horizontal, vertical] = container.querySelectorAll('[data-testid="base-edge"]');
        // Exactly ONE of them bridges. If both did, the two arcs would meet at
        // the crossing and read as a knot.
        expect(horizontal.getAttribute('d')).toContain('A6,6 0 0 0');
        expect(vertical.getAttribute('d')).not.toContain('A');
    });

    it('leaves a lone edge exactly as React Flow drew it', () => {
        const { container } = render(
            <EdgeCrossingProvider><svg><LabelledEdge {...BASE} /></svg></EdgeCrossingProvider>,
        );
        expect(drawn(container)).toBe('M0,0 L200,0');
    });

    it('draws normally with no provider at all — a hop is decoration, not a dependency', () => {
        const container = renderEdge();
        expect(drawn(container)).toBe('M0,0 L200,0');
    });

    it('SETTLES — it does not re-render itself forever', async () => {
        // The first version of this wired the publish/retract API and the
        // "something moved" counter into one context value. Every bump handed
        // each edge a new dependency, so its effect tore down (retract → bump)
        // and re-ran (publish → bump), which started the next round. Under a
        // drag it hid in the churn; on mouse-up the canvas locked solid.
        let renders = 0;
        function Counting(props) {
            renders += 1;
            return <LabelledEdge {...props} />;
        }
        const { container } = render(
            <EdgeCrossingProvider>
                <svg>
                    <Counting {...BASE} id="h" sourceX={0} sourceY={50} targetX={200} targetY={50} />
                    <Counting {...BASE} id="v" sourceX={100} sourceY={0} targetX={100} targetY={100} />
                </svg>
            </EdgeCrossingProvider>,
        );
        await waitFor(() => expect(drawn(container)).toContain('A'));

        const settled = renders;
        // Give the loop every chance to start again.
        for (let i = 0; i < 8; i += 1) await act(async () => { await Promise.resolve(); });
        expect(renders).toBe(settled);
    });

    it('stops hopping over an edge that was removed', async () => {
        const two = (
            <EdgeCrossingProvider>
                <svg>
                    <LabelledEdge {...BASE} id="h" sourceX={0} sourceY={50} targetX={200} targetY={50} />
                    <LabelledEdge {...BASE} id="v" sourceX={100} sourceY={0} targetX={100} targetY={100} />
                </svg>
            </EdgeCrossingProvider>
        );
        const { container, rerender } = render(two);
        await waitFor(() => expect(drawn(container)).toContain('A'));

        rerender(
            <EdgeCrossingProvider>
                <svg><LabelledEdge {...BASE} id="h" sourceX={0} sourceY={50} targetX={200} targetY={50} /></svg>
            </EdgeCrossingProvider>,
        );
        await waitFor(() => expect(drawn(container)).toBe('M0,50 L200,50'));
    });
});
