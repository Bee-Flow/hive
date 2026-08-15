import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import React, { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import ActionFlowEditor from './ActionFlowEditor';

vi.mock('../studioAppsApi', () => ({
    studioAppsApi: { getCatalog: vi.fn(async () => ({ components: {}, actions: { stepSpecs: STEP_SPECS_STUB } })) },
}));

const STEP_SPECS_STUB = {
    toast: { fields: { message: { type: 'string', required: true }, tone: { type: 'enum', values: ['info', 'success'], default: 'info' } } },
    navigate: { fields: { screenId: { type: 'string', required: true }, params: { type: 'navParams' } } },
    condition: { fields: { expr: { type: 'formula', required: true }, then: { type: 'steps' }, else: { type: 'steps' } } },
    set_variable: { fields: { name: { type: 'string', required: true }, value: { type: 'binding', required: true } } },
};

/**
 * A multi-step action was AI-only: the inspector edits four of ten action kinds
 * and none of the eighteen step kinds. These pin that the canvas can now build
 * one — and, more importantly, that what it hands back is still the strict tree
 * the runtime and the server both walk to find the step to run.
 */

// jsdom has no layout, so React Flow renders its nodes at zero size; the tests
// below query the node CONTENT rather than the canvas geometry.
const DEFINITION = {
    schemaVersion: 2,
    meta: { name: 'T' },
    homeScreenId: 'scr_a',
    screens: [
        { id: 'scr_a', name: 'List', sections: [{ id: 'sec_a', children: [
            { id: 'nd_modal', type: 'modal', props: { title: 'Confirm delete' }, children: [] },
        ] }] },
        { id: 'scr_b', name: 'Detail', sections: [{ id: 'sec_b', children: [] }] },
    ],
    actions: {},
};

function renderFlow(initial) {
    const onChange = vi.fn();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    function Harness() {
        const [action, setAction] = useState(initial);
        return (
            <QueryClientProvider client={client}>
                <ActionFlowEditor
                    action={action}
                    onChange={(next) => { setAction(next); onChange(next); }}
                    definition={DEFINITION}
                />
            </QueryClientProvider>
        );
    }
    const utils = render(<Harness />);
    return { onChange, last: () => onChange.mock.calls.at(-1)?.[0], ...utils };
}

const seq = (steps) => ({ kind: 'sequence', steps });

describe('ActionFlowEditor — reading an action', () => {
    it('draws one node per step', () => {
        renderFlow(seq([{ kind: 'toast', message: 'saved' }, { kind: 'navigate', screenId: 'scr_b' }]));
        expect(screen.getByText('Show a message')).toBeTruthy();
        expect(screen.getByText('Go to screen')).toBeTruthy();
    });

    it('says what each step actually does, not just its type', () => {
        renderFlow(seq([{ kind: 'toast', message: 'Saved!' }]));
        expect(screen.getByText('Saved!')).toBeTruthy();
    });

    it('names the branches of a container', () => {
        renderFlow(seq([{ kind: 'condition', expr: 'vars.ok', then: [], else: [] }]));
        // Once on the node as a chip, once as the branch's entry pill.
        expect(screen.getAllByText('Yes').length).toBeGreaterThan(0);
        expect(screen.getAllByText('No').length).toBeGreaterThan(0);
    });

    it('marks a step that runs on the server', () => {
        renderFlow(seq([{ kind: 'create_record', tableId: 'tbl_a', values: {} }]));
        expect(screen.getByLabelText('Runs on the server')).toBeTruthy();
    });

    it('offers a first step when the action is empty', () => {
        renderFlow(seq([]));
        expect(screen.getByRole('button', { name: /add the first step/i })).toBeTruthy();
    });

    it('treats a bare v1 action as a one-step flow', () => {
        renderFlow({ kind: 'toast', message: 'hi' });
        expect(screen.getByText('Show a message')).toBeTruthy();
    });
});

describe('ActionFlowEditor — building', () => {
    it('adds a step and commits a sequence', () => {
        const { last } = renderFlow(seq([]));
        fireEvent.click(screen.getByRole('button', { name: /add the first step/i }));
        fireEvent.click(screen.getByText('Show a message'));

        expect(last().kind).toBe('sequence');
        expect(last().steps).toHaveLength(1);
        expect(last().steps[0].kind).toBe('toast');
    });

    it('a new step lands valid — every required field is already there', () => {
        const { last } = renderFlow(seq([]));
        fireEvent.click(screen.getByRole('button', { name: /add the first step/i }));
        fireEvent.click(screen.getByText('Go to screen'));
        // The first screen is pre-picked rather than left blank.
        expect(last().steps[0].screenId).toBe('scr_a');
    });

    it('adds a step INTO a branch, not after the container', () => {
        const { last } = renderFlow(seq([{ kind: 'condition', expr: 'x', then: [], else: [] }]));
        fireEvent.click(screen.getByLabelText('Add a step to Yes'));
        fireEvent.click(screen.getByText('Show a message'));

        expect(last().steps[0].then).toHaveLength(1);
        expect(last().steps[0].else).toHaveLength(0);
        expect(last().steps).toHaveLength(1);
    });

    it('deleting a container takes its branches with it', () => {
        const { last } = renderFlow(seq([
            { kind: 'condition', expr: 'x', then: [{ kind: 'toast', message: 'inside' }], else: [] },
            { kind: 'toast', message: 'after' },
        ]));
        fireEvent.click(screen.getByText('If…'));
        fireEvent.click(screen.getByRole('button', { name: /delete this if/i }));

        expect(last().steps).toHaveLength(1);
        expect(last().steps[0].message).toBe('after');
    });

    it('the step ids it uses never reach the saved action', () => {
        const { last } = renderFlow(seq([]));
        fireEvent.click(screen.getByRole('button', { name: /add the first step/i }));
        fireEvent.click(screen.getByText('Show a message'));
        expect(last().steps[0]).not.toHaveProperty('id');
    });

    /**
     * A step's id is DERIVED from its position on every render and stripped
     * again on the way out, so the temporary id addStep handed to graphToSteps
     * never survived the round trip. Selecting it therefore selected nothing:
     * you picked a step from the palette and the panel stayed on "Pick a step
     * to change it", with the new step's REQUIRED field never shown — so the
     * likeliest next move was to publish an action that could not run.
     */
    it('opens the new step’s settings straight away', async () => {
        renderFlow(seq([]));
        fireEvent.click(screen.getByRole('button', { name: /add the first step/i }));
        fireEvent.click(screen.getByText('Show a message'));
        expect(await screen.findByLabelText('Message')).toBeTruthy();
    });

    it('opens the settings of a step added INTO a branch', async () => {
        renderFlow(seq([{ kind: 'condition', expr: 'x', then: [], else: [] }]));
        fireEvent.click(screen.getByLabelText('Add a step to Yes'));
        fireEvent.click(screen.getByText('Show a message'));
        expect(await screen.findByLabelText('Message')).toBeTruthy();
    });
});

/**
 * The line under a step's name is the whole point of drawing the action: it is
 * where "what does this one do" is answered. It used to print the raw id of
 * whatever the step pointed at — `→ scr_b` for a screen the author had named
 * "Detail" — which is the one thing on the canvas nobody could read.
 */
describe('ActionFlowEditor — saying which thing, by name', () => {
    it('names the screen a navigate step goes to', () => {
        renderFlow(seq([{ kind: 'navigate', screenId: 'scr_b' }]));
        expect(screen.getByText('→ Detail')).toBeTruthy();
        expect(screen.queryByText('→ scr_b')).toBeNull();
    });

    it('names the dialog an open_modal step opens', () => {
        renderFlow(seq([{ kind: 'open_modal', modalId: 'nd_modal' }]));
        expect(screen.getByText('Confirm delete')).toBeTruthy();
    });

    it('flags a step pointing at a screen that has been deleted', () => {
        renderFlow(seq([{ kind: 'navigate', screenId: 'scr_gone' }]));
        // The id stays visible — it is the only clue left about what was meant.
        expect(screen.getByText('→ scr_gone')).toBeTruthy();
        expect(screen.getByLabelText('This no longer exists')).toBeTruthy();
    });

    it('still says something before any list has loaded', () => {
        renderFlow(seq([{ kind: 'create_record', tableId: 'tbl_x', values: {} }]));
        // No appId in this harness, so tables never load: fall back to the id
        // rather than to an empty line, and do NOT cry wolf about it missing.
        expect(screen.getByText('tbl_x')).toBeTruthy();
        expect(screen.queryByLabelText('This no longer exists')).toBeNull();
    });
});

describe('ActionFlowEditor — editing a step', () => {
    it('selecting a step opens its settings, rendered from the spec', async () => {
        renderFlow(seq([{ kind: 'toast', message: 'saved' }]));
        fireEvent.click(screen.getByText('Show a message'));
        expect(await screen.findByLabelText('Message')).toBeTruthy();
        expect(screen.getByLabelText('Tone')).toBeTruthy();
    });

    it('a change to a setting commits the whole action back', async () => {
        const { last } = renderFlow(seq([{ kind: 'toast', message: 'old' }]));
        fireEvent.click(screen.getByText('Show a message'));
        fireEvent.change(await screen.findByLabelText('Message'), { target: { value: 'new' } });
        expect(last().steps[0].message).toBe('new');
    });

    it('a screen field is a picker, never a typed id', async () => {
        renderFlow(seq([{ kind: 'navigate', screenId: 'scr_b' }]));
        fireEvent.click(screen.getByText('Go to screen'));
        const control = await screen.findByLabelText('Screen');
        expect(control.tagName).toBe('SELECT');
        expect([...control.options].map((o) => o.textContent)).toContain('Detail');
    });

    it('editing a step inside a branch keeps it in that branch', async () => {
        const { last } = renderFlow(seq([
            { kind: 'condition', expr: 'x', then: [{ kind: 'toast', message: 'old' }], else: [] },
        ]));
        fireEvent.click(screen.getByText('Show a message'));
        fireEvent.change(await screen.findByLabelText('Message'), { target: { value: 'new' } });

        expect(last().steps[0].then[0].message).toBe('new');
        expect(last().steps).toHaveLength(1);
    });
});

/**
 * THE SAME TOOLS AS THE ROUTINE BUILDER.
 *
 * The steps draw with StepNodeBase and take their actions from
 * NodeRuntimeContext — the same component and the same context the automations
 * canvas uses — so duplicate, delete, add-after and the right-click menu behave
 * identically in both places. What is NOT shared is the model: an automation is
 * a DAG whose runner gates fan-in, an app action is a strict tree because the
 * server derives `stepIndex` by walking it. So reordering is a move, not a
 * re-drag of the edges.
 */
describe('ActionFlowEditor — the routine builder’s tools', () => {
    const seqOf = (...msgs) => seq(msgs.map((m) => ({ kind: 'toast', message: m })));

    it('right-click offers duplicate and delete', () => {
        renderFlow(seqOf('one'));
        fireEvent.contextMenu(screen.getByText('one'));
        expect(screen.getByRole('menuitem', { name: /duplicate/i })).toBeTruthy();
        expect(screen.getByRole('menuitem', { name: /delete/i })).toBeTruthy();
    });

    it('duplicating puts the copy straight after the original', () => {
        const { last } = renderFlow(seqOf('one', 'two'));
        fireEvent.contextMenu(screen.getByText('one'));
        fireEvent.click(screen.getByRole('menuitem', { name: /duplicate/i }));
        expect(last().steps.map((s) => s.message)).toEqual(['one', 'one', 'two']);
    });

    it('duplicating a branch step copies what is inside it', () => {
        const { last } = renderFlow(seq([
            { kind: 'condition', expr: 'x', then: [{ kind: 'toast', message: 'inside' }], else: [] },
        ]));
        fireEvent.contextMenu(screen.getByText('If…'));
        fireEvent.click(screen.getByRole('menuitem', { name: /duplicate/i }));
        expect(last().steps).toHaveLength(2);
        expect(last().steps[1].then[0].message).toBe('inside');
        // The copy carries no editor-only ids into the saved action.
        expect(last().steps[1].then[0]).not.toHaveProperty('id');
    });

    it('deleting from the menu removes that step', () => {
        const { last } = renderFlow(seqOf('one', 'two'));
        fireEvent.contextMenu(screen.getByText('one'));
        fireEvent.click(screen.getByRole('menuitem', { name: /delete/i }));
        expect(last().steps.map((s) => s.message)).toEqual(['two']);
    });

    /**
     * Reordering used to be impossible. The only affordance was a drag between
     * the node handles, and the graph is re-derived from the tree on every
     * render as a COMPLETE chain — so every node already had its one incoming
     * and one outgoing edge, canConnect refused every pair, and there was no
     * edge-delete path to disconnect one first. Deleting a step and rebuilding
     * it further down was the only way.
     */
    it('moves a step later, and back', () => {
        const { last } = renderFlow(seqOf('one', 'two', 'three'));
        fireEvent.click(screen.getByText('one'));
        fireEvent.click(screen.getByRole('button', { name: /move this step later/i }));
        expect(last().steps.map((s) => s.message)).toEqual(['two', 'one', 'three']);

        fireEvent.click(screen.getByRole('button', { name: /move this step earlier/i }));
        expect(last().steps.map((s) => s.message)).toEqual(['one', 'two', 'three']);
    });

    it('will not move a step out of its own branch', () => {
        renderFlow(seq([
            { kind: 'condition', expr: 'x', then: [{ kind: 'toast', message: 'only one' }], else: [] },
        ]));
        fireEvent.click(screen.getByText('only one'));
        // First and last of its scope, so neither direction is offered.
        expect(screen.getByRole('button', { name: /move this step earlier/i }).disabled).toBe(true);
        expect(screen.getByRole('button', { name: /move this step later/i }).disabled).toBe(true);
    });

    it('reorders inside a branch without touching the steps around it', () => {
        const { last } = renderFlow(seq([
            { kind: 'condition', expr: 'x', then: [{ kind: 'toast', message: 'a' }, { kind: 'toast', message: 'b' }], else: [] },
            { kind: 'toast', message: 'after' },
        ]));
        fireEvent.click(screen.getByText('a'));
        fireEvent.click(screen.getByRole('button', { name: /move this step later/i }));
        expect(last().steps[0].then.map((s) => s.message)).toEqual(['b', 'a']);
        expect(last().steps[1].message).toBe('after');
    });

    it('keeps the moved step selected, so you can move it twice', () => {
        const { last } = renderFlow(seqOf('one', 'two', 'three'));
        fireEvent.click(screen.getByText('one'));
        fireEvent.click(screen.getByRole('button', { name: /move this step later/i }));
        fireEvent.click(screen.getByRole('button', { name: /move this step later/i }));
        expect(last().steps.map((s) => s.message)).toEqual(['two', 'three', 'one']);
    });
});
