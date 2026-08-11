import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import CallFlowletNode from './CallFlowletNode';
import { NodeRuntimeContext } from '../NodeRuntimeContext';

/**
 * A call_layer node has two shapes: the ordinary card, and — once the user
 * expands it — a container the flowlet's own steps are drawn inside
 * (see flow/inlineFlowlets.js). Both offer the toggle, because getting stuck
 * expanded would be worse than never expanding at all.
 */
const STEP = { id: 'cl1', type: 'call_layer', layerKey: 'enrich', label: 'Enrich contact', inputs: { email: {} } };

function renderNode({ data = {}, rt = {} } = {}) {
    return render(
        <ReactFlowProvider>
            <NodeRuntimeContext.Provider value={{
                pinnedById: new Set(),
                disabledById: new Set(),
                triggerIds: new Set(),
                attachedIds: new Set(),
                layerSummaries: { enrich: 'Looks a contact up.' },
                ...rt,
            }}>
                <CallFlowletNode id="cl1" data={{ step: STEP, runStep: null, issues: { errors: [], warnings: [] }, ...data }} />
            </NodeRuntimeContext.Provider>
        </ReactFlowProvider>,
    );
}

describe('CallFlowletNode — collapsed', () => {
    beforeEach(cleanup);

    it('offers Expand, and calls the toggle with the node id and its flowlet', () => {
        const onToggleInline = vi.fn();
        renderNode({ rt: { onToggleInline } });
        fireEvent.click(screen.getByRole('button', { name: /expand/i }));
        expect(onToggleInline).toHaveBeenCalledWith('cl1', 'enrich');
    });

    it('shows no Expand affordance on a canvas that cannot expand', () => {
        renderNode();
        expect(screen.queryByRole('button', { name: /expand/i })).toBeNull();
    });

    it('still shows the mapped inputs and the drill-in', () => {
        renderNode({ rt: { onOpenLayer: vi.fn() } });
        expect(screen.getByText(/1 input: email/)).toBeTruthy();
        expect(screen.getByRole('button', { name: /open flowlet/i })).toBeTruthy();
    });
});

describe('CallFlowletNode — expanded container', () => {
    beforeEach(cleanup);

    const expanded = { inlineExpanded: { prefix: 'cl1', layerKey: 'enrich', size: { width: 900, height: 260 } } };

    it('renders header chrome instead of the card body', () => {
        renderNode({ data: expanded, rt: { onToggleInline: vi.fn() } });
        expect(screen.getByText('Enrich contact')).toBeTruthy();
        expect(screen.getByText('Looks a contact up.')).toBeTruthy();
        // The card's input summary belongs to the collapsed shape only — the
        // container's body is the space its steps are drawn in.
        expect(screen.queryByText(/1 input: email/)).toBeNull();
    });

    it('collapses again from the header', () => {
        const onToggleInline = vi.fn();
        renderNode({ data: expanded, rt: { onToggleInline } });
        fireEvent.click(screen.getByTitle('Collapse this flowlet'));
        expect(onToggleInline).toHaveBeenCalledWith('cl1', 'enrich');
    });

    it('warns when the flowlet has more than one call site', () => {
        renderNode({ data: expanded, rt: { layerRefCounts: { enrich: 3 } } });
        const chip = screen.getByTitle(/used in 3 places/i);
        expect(chip.textContent).toContain('3');
    });

    it('says nothing about call sites when there is only one', () => {
        renderNode({ data: expanded, rt: { layerRefCounts: { enrich: 1 } } });
        expect(screen.queryByTitle(/used in/i)).toBeNull();
    });

    it('keeps the drill-in available from the container', () => {
        const onOpenLayer = vi.fn();
        renderNode({ data: expanded, rt: { onOpenLayer } });
        fireEvent.click(screen.getByTitle('Open this flowlet on its own canvas'));
        expect(onOpenLayer).toHaveBeenCalledWith('enrich');
    });
});
