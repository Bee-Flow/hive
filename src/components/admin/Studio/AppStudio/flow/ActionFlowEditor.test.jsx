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
        { id: 'scr_a', name: 'List', sections: [{ id: 'sec_a', children: [] }] },
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
