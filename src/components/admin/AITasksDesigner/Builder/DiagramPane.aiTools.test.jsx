import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import DiagramPane from './DiagramPane';
import { STEP_DND_MIME } from './flow/stepDrag';
import { toolNodeId } from './flow/aiToolNodes';

/**
 * Where an AI step's tools meet React Flow.
 *
 * The pure model is covered in flow/aiToolNodes.test.js; this asserts the
 * canvas actually DRAWS the satellites and — the part that would silently rot —
 * that dropping an app on the tools port edits `tools` instead of adding a
 * step. The invariant under all of it: nothing synthetic may ever reach
 * definition.steps or definition.edges, because the server rejects both.
 */
const CATALOG = {
    apps: [{
        id: 'gmail',
        label: 'Gmail',
        actions: [
            { name: 'gmail_search', label: 'Search email', description: 'Find messages', integrationId: 'gmail' },
            { name: 'gmail_send', label: 'Send email', integrationId: 'gmail' },
        ],
    }],
};

const defWith = (aiOver = {}) => ({
    trigger: { id: 'trg', type: 'trigger', kind: 'manual', label: 'Start', position: { x: 0, y: 0 } },
    steps: [{
        id: 'ai1', type: 'ai_step', label: 'Answer it', prompt: 'go',
        position: { x: 400, y: 0 }, ...aiOver,
    }],
    edges: [{ from: 'trg', to: 'ai1' }],
});

function renderCanvas(definition, extra = {}) {
    return render(
        <div style={{ width: 1200, height: 800 }}>
            <DiagramPane definition={definition} catalog={CATALOG} editable {...extra} />
        </div>,
    );
}

const nodeEl = (container, id) => [...container.querySelectorAll('.react-flow__node')]
    .find(n => n.getAttribute('data-id') === id) || null;

/** A drop on the tools port: the hit-test reads [data-tool-port] off the DOM. */
function dropOnPort(container, payload) {
    const port = container.querySelector('[data-tool-port]');
    expect(port).toBeTruthy();
    // dropTargetFromPoint uses elementFromPoint, which jsdom does not implement
    // at all (nothing is laid out) — point it at the port we just found.
    const had = Object.prototype.hasOwnProperty.call(document, 'elementFromPoint');
    const prev = document.elementFromPoint;
    document.elementFromPoint = () => port;
    try {
        fireEvent.drop(container.querySelector('.react-flow').parentElement, {
            clientX: 10,
            clientY: 10,
            dataTransfer: { getData: (mime) => (mime === STEP_DND_MIME ? JSON.stringify(payload) : '') },
        });
    } finally {
        if (had) document.elementFromPoint = prev; else delete document.elementFromPoint;
    }
}

describe('DiagramPane — an AI step wears its tools', () => {
    beforeEach(cleanup);

    it('draws one chip per tool, tethered to the step', () => {
        const { container } = renderCanvas(defWith({ tools: ['gmail_search', 'gmail_send'], allowTools: true }));
        expect(nodeEl(container, toolNodeId('ai1', 'gmail_search'))).toBeTruthy();
        expect(nodeEl(container, toolNodeId('ai1', 'gmail_send'))).toBeTruthy();
        // Named from the catalog, not by their function names.
        expect(screen.getByText('Search email')).toBeTruthy();
        expect(screen.getByText('Send email')).toBeTruthy();
    });

    it('offers the port as a findable drop target even with no tools yet', () => {
        const { container } = renderCanvas(defWith());
        const port = container.querySelector('[data-tool-port]');
        expect(port).toBeTruthy();
        expect(port.getAttribute('data-tool-port')).toBe('ai1');
        expect(port.textContent).toMatch(/Drop an app here/);
    });

    it('an app dropped on the port becomes a TOOL, never a new step', () => {
        const onDefinitionChange = vi.fn();
        // onDropStep is what a normal drop calls; a tools drop must not.
        const onDropStep = vi.fn();
        const { container } = renderCanvas(defWith(), { onDefinitionChange, onDropStep });
        dropOnPort(container, { kind: 'integration_action', tool: 'gmail_search', label: 'Search email', appId: 'gmail' });

        expect(onDropStep).not.toHaveBeenCalled();
        expect(onDefinitionChange).toHaveBeenCalledTimes(1);
        const next = onDefinitionChange.mock.calls[0][0];
        expect(next.steps[0].tools).toEqual(['gmail_search']);
        expect(next.steps[0].allowTools).toBe(true);
        // The invariant: no synthetic step, no synthetic edge.
        expect(next.steps).toHaveLength(1);
        expect(next.edges).toEqual([{ from: 'trg', to: 'ai1' }]);
    });

    it('a step type dropped on the port is added to the flow instead — never silently ignored', () => {
        const onDropStep = vi.fn();
        const { container } = renderCanvas(defWith(), { onDropStep });
        dropOnPort(container, { kind: 'loop', label: 'Loop' });
        // A Loop is not a tool, so the gesture falls back to "add after this step".
        expect(onDropStep).toHaveBeenCalledTimes(1);
        expect(onDropStep.mock.calls[0][1]).toMatchObject({ sourceId: 'ai1' });
    });

    it('removing a chip takes the tool out of the allowlist', () => {
        const onDefinitionChange = vi.fn();
        renderCanvas(defWith({ tools: ['gmail_search', 'gmail_send'], allowTools: true }), { onDefinitionChange });
        fireEvent.click(screen.getByLabelText('Remove Search email'));
        const next = onDefinitionChange.mock.calls[0][0];
        expect(next.steps[0].tools).toEqual(['gmail_send']);
        expect(next.steps[0].allowTools).toBe(true);
    });

    it('clicking a chip opens the AI step, since a tool has no editor of its own', () => {
        const onNodeClick = vi.fn();
        const { container } = renderCanvas(defWith({ tools: ['gmail_search'], allowTools: true }), { onNodeClick });
        fireEvent.click(nodeEl(container, toolNodeId('ai1', 'gmail_search')));
        expect(onNodeClick).toHaveBeenCalledWith('ai1');
    });

    it('draws nothing extra for a step with no tools', () => {
        const { container } = renderCanvas(defWith());
        expect(container.querySelectorAll('.react-flow__node')).toHaveLength(2);
    });
});
