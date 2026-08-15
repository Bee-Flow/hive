import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import React, { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import ActionsSection, { stepCount } from './ActionsSection';
import StudioScopeProvider from './logic/StudioScopeProvider';

const AUTOMATIONS = [{
    id: 'aut_1',
    title: 'Send the invoice',
    definition: { trigger: { kind: 'app_trigger', params: [{ name: 'email', type: 'string', required: true }, { name: 'amount', type: 'number' }] } },
}];

vi.mock('../../../../shared/Toast', () => {
    const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
    return { default: toast, toast };
});
import toast from '../../../../shared/Toast';

vi.mock('../../../../../hooks/useAutomationApi', () => ({
    default: () => ({
        listAutomations: vi.fn(async () => ({ automations: AUTOMATIONS })),
        createAutomation: vi.fn(async () => ({ automation: { id: 'aut_new', title: 'New routine for this app' } })),
    }),
    safeText: vi.fn(async () => ''),
}));
vi.mock('../studioAppsApi', () => ({
    studioAppsApi: { getCatalog: vi.fn(async () => ({ components: {}, actions: { stepSpecs: {} } })) },
}));

/**
 * Two things a multi-step action could not survive before: it displayed as
 * "Run routine" (the select fell back when the kind was not in its list), and
 * the first change to that select replaced the whole action with a fresh
 * default — silently discarding every step.
 */

const NODE = { id: 'cmp_b1', type: 'button', props: { label: 'Go' }, style: {}, onClick: 'act_a' };

function defWith(action) {
    return {
        schemaVersion: 2,
        meta: { name: 'T' },
        homeScreenId: 'scr_a',
        screens: [
            { id: 'scr_a', name: 'Home', sections: [{ id: 'sec_a', children: [NODE] }] },
            { id: 'scr_b', name: 'Thank you', sections: [{ id: 'sec_b', children: [] }] },
        ],
        actions: { act_a: action },
    };
}

function renderSection(action) {
    const onCommit = vi.fn();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    function Harness() {
        const [definition, setDefinition] = useState(defWith(action));
        return (
            <QueryClientProvider client={client}>
                <StudioScopeProvider definition={definition} node={NODE}>
                    <ActionsSection
                        node={NODE}
                        definition={definition}
                        onCommit={(next) => { setDefinition(next); onCommit(next); }}
                        disabled={false}
                    />
                </StudioScopeProvider>
            </QueryClientProvider>
        );
    }
    const utils = render(<Harness />);
    return { onCommit, lastAction: () => onCommit.mock.calls.at(-1)?.[0]?.actions?.act_a, ...utils };
}

const SEQUENCE = {
    kind: 'sequence',
    steps: [
        { kind: 'confirm', message: 'Sure?' },
        { kind: 'create_record', tableId: 'tbl_a', values: {} },
        { kind: 'navigate', screenId: 'scr_a' },
    ],
};

describe('stepCount', () => {
    it('counts the steps inside branches too', () => {
        expect(stepCount(SEQUENCE)).toBe(3);
        expect(stepCount({ kind: 'sequence', steps: [{ kind: 'condition', then: [{ kind: 'toast' }], else: [{ kind: 'toast' }] }] })).toBe(3);
        expect(stepCount({ kind: 'toast' })).toBe(1);
        expect(stepCount(null)).toBe(0);
    });
});

describe('ActionsSection — a multi-step action is no longer invisible', () => {
    it('says what it is instead of claiming to be a routine', () => {
        renderSection(SEQUENCE);
        expect(screen.getByRole('combobox', { name: 'Action kind' }).value).toBe('sequence');
        expect(screen.getByText(/3 steps, run in order/i)).toBeTruthy();
    });

    it('offers a way into the flow editor', () => {
        renderSection(SEQUENCE);
        expect(screen.getByRole('button', { name: /edit the flow/i })).toBeTruthy();
    });

    // The destructive one: this used to happen on the first change, silently.
    it('asks before throwing the other steps away', () => {
        const { onCommit } = renderSection(SEQUENCE);
        fireEvent.change(screen.getByRole('combobox', { name: 'Action kind' }), { target: { value: 'toast' } });
        expect(onCommit).not.toHaveBeenCalled();
        expect(screen.getByText(/keep only one step/i)).toBeTruthy();
    });

    it('a one-step flow switches without a fuss', () => {
        const { lastAction } = renderSection({ kind: 'sequence', steps: [{ kind: 'toast', message: 'x' }] });
        fireEvent.change(screen.getByRole('combobox', { name: 'Action kind' }), { target: { value: 'toast' } });
        expect(lastAction().kind).toBe('toast');
    });
});

describe('ActionsSection — turning one action into a flow', () => {
    it('keeps what was there as the first step', () => {
        // The old behaviour built a fresh default, so the author's work vanished.
        const { lastAction } = renderSection({ kind: 'toast', message: 'Saved!', tone: 'success' });
        fireEvent.change(screen.getByRole('combobox', { name: 'Action kind' }), { target: { value: 'sequence' } });

        expect(lastAction().kind).toBe('sequence');
        expect(lastAction().steps).toHaveLength(1);
        expect(lastAction().steps[0]).toMatchObject({ kind: 'toast', message: 'Saved!' });
    });
});

describe('ActionsSection — the routine contract, when it drifts', () => {
    const wired = { kind: 'run_automation', automationId: 'aut_1', inputMapping: { email: { kind: 'static', value: 'a@b.c' }, gone: { kind: 'static', value: 'x' } } };

    it('names an input the routine expects and this action does not send', async () => {
        renderSection(wired);
        expect(await screen.findByRole('button', { name: /\+ amount/ })).toBeTruthy();
    });

    it('names an input the routine no longer takes', async () => {
        renderSection(wired);
        expect(await screen.findByRole('button', { name: /gone/ })).toBeTruthy();
    });

    it('adding a missing input writes it into the mapping', async () => {
        const { lastAction } = renderSection(wired);
        fireEvent.click(await screen.findByRole('button', { name: /\+ amount/ }));
        expect(Object.keys(lastAction().inputMapping)).toContain('amount');
    });

    it('stays quiet when the mapping matches the contract', async () => {
        renderSection({ kind: 'run_automation', automationId: 'aut_1', inputMapping: { email: { kind: 'static', value: 'x' }, amount: { kind: 'static', value: 1 } } });
        await screen.findByRole('combobox', { name: 'Action kind' });
        expect(screen.queryByText(/the routine also expects/i)).toBeNull();
        expect(screen.queryByText(/no longer takes/i)).toBeNull();
    });
});

/**
 * Effects are an ACTION-level shape: no step kind carries onSuccess/onError,
 * and canonicalize drops the keys on the next save. Converting a "Run routine"
 * with "on success: say Saved, then go to Thank you" therefore looked like
 * nothing happened, and then quietly lost both.
 */
describe('ActionsSection — turning an action into a flow keeps its effects', () => {
    it('turns onSuccess into the steps that do the same thing', () => {
        const { lastAction } = renderSection({
            kind: 'run_automation',
            automationId: 'auto-1',
            onSuccess: { toast: { message: 'Saved!', tone: 'success' }, navigateTo: 'scr_b' },
        });
        fireEvent.change(screen.getByLabelText('Action kind'), { target: { value: 'sequence' } });

        const steps = lastAction().steps;
        expect(steps.map((s) => s.kind)).toEqual(['run_automation', 'toast', 'navigate']);
        expect(steps[1]).toMatchObject({ message: 'Saved!', tone: 'success' });
        expect(steps[2]).toMatchObject({ screenId: 'scr_b' });
        // The effect keys do not ride along on the step — nothing reads them
        // there, and the server strips them.
        expect(steps[0]).not.toHaveProperty('onSuccess');
    });

    it('says so when the on-error part cannot come across', () => {
        const { lastAction } = renderSection({
            kind: 'run_automation',
            automationId: 'auto-1',
            onError: { toast: { message: 'Oh no', tone: 'danger' } },
        });
        fireEvent.change(screen.getByLabelText('Action kind'), { target: { value: 'sequence' } });

        // A flow stops at the step that fails, so there is nowhere to put it.
        expect(lastAction().steps.map((s) => s.kind)).toEqual(['run_automation']);
        expect(lastAction().steps[0]).not.toHaveProperty('onError');
        expect(toast.info).toHaveBeenCalledWith(expect.stringMatching(/on error/i));
    });
});
