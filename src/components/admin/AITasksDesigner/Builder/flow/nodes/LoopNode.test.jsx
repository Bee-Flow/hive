import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import LoopNode from './LoopNode';
import LoopItemNode from './LoopItemNode';
import { NodeRuntimeContext } from '../NodeRuntimeContext';

/**
 * A Repeat-for-each has two shapes, like a flowlet call: the ordinary card, and
 * a container its body is drawn inside. The body used to be authorable only as
 * a list in the step editor, so the badge pointed the user there; both the
 * badge and the card now point at the canvas.
 */
const STEP = {
    id: 'lp1', type: 'loop', label: 'Repeat for each',
    overRef: 'steps.src.output.results', itemVar: 'item',
    body: [{ id: 'a', type: 'set' }, { id: 'b', type: 'set' }],
};

function renderLoop({ step = STEP, data = {}, rt = {} } = {}) {
    return render(
        <ReactFlowProvider>
            <NodeRuntimeContext.Provider value={{
                pinnedById: new Set(), disabledById: new Set(),
                triggerIds: new Set(), attachedIds: new Set(),
                ...rt,
            }}>
                <LoopNode id="lp1" data={{
                    step, runStep: null, issues: { errors: [], warnings: [] },
                    stepLabelById: new Map([['src', 'Search email']]),
                    ...data,
                }} />
            </NodeRuntimeContext.Provider>
        </ReactFlowProvider>,
    );
}

describe('LoopNode — collapsed', () => {
    beforeEach(cleanup);

    it('offers Expand, passing no flowlet key — a body is not shared', () => {
        const onToggleInline = vi.fn();
        renderLoop({ rt: { onToggleInline } });
        fireEvent.click(screen.getByRole('button', { name: /expand/i }));
        expect(onToggleInline).toHaveBeenCalledWith('lp1', null);
    });

    it('shows no Expand affordance on a canvas that cannot expand', () => {
        renderLoop();
        expect(screen.queryByRole('button', { name: /expand/i })).toBeNull();
    });

    it('counts the body and names the list it walks', () => {
        renderLoop();
        expect(screen.getByText('▸ 2 steps inside')).toBeTruthy();
        expect(screen.getByText(/Search email/)).toBeTruthy();
    });

    it('sends the user to the canvas for the body, not to the inspector', () => {
        renderLoop();
        expect(screen.getByTitle(/expand the node to see them/i)).toBeTruthy();
    });
});

describe('LoopNode — expanded container', () => {
    beforeEach(cleanup);

    const expanded = { inlineExpanded: { prefix: 'lp1', kind: 'loop', size: { width: 900, height: 260 } } };

    it('renders header chrome instead of the card body', () => {
        renderLoop({ data: expanded, rt: { onToggleInline: vi.fn() } });
        expect(screen.getByText('Repeat for each')).toBeTruthy();
        expect(screen.getByText(/over .*Search email.* · as loop\.item/)).toBeTruthy();
        // The step count belongs to the collapsed card — expanded, the steps
        // themselves are on screen.
        expect(screen.queryByText('▸ 2 steps inside')).toBeNull();
    });

    it('collapses again from the header', () => {
        const onToggleInline = vi.fn();
        renderLoop({ data: expanded, rt: { onToggleInline } });
        fireEvent.click(screen.getByTitle(/collapse/i));
        expect(onToggleInline).toHaveBeenCalledWith('lp1', null);
    });

    it('says once that per-item steps carry no run status of their own', () => {
        // execLoop passes recordSteps:false, so the cards inside never light up.
        // Without this the user is left waiting for something that cannot come.
        renderLoop({ data: expanded });
        expect(screen.getByTitle(/aren't recorded one by one/i)).toBeTruthy();
    });

    it('keeps both outgoing ports while open', () => {
        const { container } = renderLoop({ data: expanded });
        const ids = [...container.querySelectorAll('.react-flow__handle')]
            .map(h => h.getAttribute('data-handleid'));
        expect(ids).toContain('done');
        expect(ids).toContain('on_error');
    });
});

describe('LoopItemNode', () => {
    beforeEach(cleanup);

    const renderItem = (step) => render(
        <ReactFlowProvider>
            <LoopItemNode id="lp1/__item__" data={{ step }} />
        </ReactFlowProvider>,
    );

    it('names the variable the steps below have to bind against', () => {
        renderItem({ id: '__item__', type: 'loop_item', itemVar: 'invoice', batchSize: 1 });
        expect(screen.getByText('Each item')).toBeTruthy();
        expect(screen.getByText('loop.invoice')).toBeTruthy();
    });

    it('says BATCH when the loop binds a slice, not a single item', () => {
        renderItem({ id: '__item__', type: 'loop_item', itemVar: 'rows', batchSize: 10 });
        expect(screen.getByText('Each batch of 10')).toBeTruthy();
    });

    it('has an output only — nothing connects into the start of an iteration', () => {
        const { container } = renderItem({ id: '__item__', type: 'loop_item', itemVar: 'item', batchSize: 1 });
        const handles = [...container.querySelectorAll('.react-flow__handle')];
        expect(handles.length).toBe(1);
        expect(handles[0].className).toMatch(/source/);
    });
});
