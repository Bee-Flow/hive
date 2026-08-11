import { render, fireEvent, screen } from '@testing-library/react';
import React, { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import ActionsSection from './ActionsSection';
import StudioScopeProvider from './logic/StudioScopeProvider';

vi.mock('../../../../../hooks/useAutomationApi', () => ({
    default: () => ({ listAutomations: vi.fn(async () => ({ automations: [] })) }),
    safeText: vi.fn(async () => ''),
}));

/**
 * `navigate.params` is what makes "open THIS ticket" possible: the next screen
 * reads the values as `screen.params.<name>`. The runtime has resolved them
 * since v2 and the AI builder writes them, but the inspector showed only the
 * screen select — so a hand-builder could not author them, and anyone editing
 * an AI-written navigate action could not even see what was being passed.
 */

const NODE = { id: 'cmp_b1', type: 'button', props: { label: 'Open' }, style: {}, onClick: 'act_go' };

function baseDef(action) {
    return {
        schemaVersion: 2,
        meta: { name: 'T' },
        theme: {},
        homeScreenId: 'scr_a',
        screens: [
            { id: 'scr_a', name: 'List', showInNav: true, maxWidth: 'medium', sections: [{ id: 'sec_a', style: {}, children: [NODE] }] },
            { id: 'scr_b', name: 'Detail', showInNav: true, maxWidth: 'medium', sections: [{ id: 'sec_b', style: {}, children: [] }] },
        ],
        actions: { act_go: action },
    };
}

/** Controlled, so a commit feeds the next render like the real editor does. */
function renderActions(action) {
    const onCommit = vi.fn();
    function Harness() {
        const [definition, setDefinition] = useState(baseDef(action));
        return (
            <StudioScopeProvider definition={definition} node={NODE}>
                <ActionsSection
                    node={NODE}
                    definition={definition}
                    onCommit={(next) => { setDefinition(next); onCommit(next); }}
                    disabled={false}
                />
            </StudioScopeProvider>
        );
    }
    const utils = render(<Harness />);
    return { onCommit, lastAction: () => onCommit.mock.calls.at(-1)?.[0]?.actions?.act_go, ...utils };
}

const NAVIGATE = { kind: 'navigate', screenId: 'scr_b' };

describe('ActionsSection — navigate params', () => {
    it('shows what an AI-written action already carries', () => {
        renderActions({ ...NAVIGATE, params: { recordId: { kind: 'formula', expr: 'item.id' } } });
        expect(screen.getByLabelText('Value 1 name').value).toBe('recordId');
        expect(screen.getByLabelText('Value 1 formula').value).toBe('item.id');
    });

    it('adds a value and names it', () => {
        const { lastAction } = renderActions(NAVIGATE);
        fireEvent.click(screen.getByRole('button', { name: 'Carry a value along' }));
        fireEvent.change(screen.getByLabelText('Value 1 name'), { target: { value: 'recordId' } });
        fireEvent.change(screen.getByLabelText('Value 1 formula'), { target: { value: 'item.id' } });
        expect(lastAction().params).toEqual({ recordId: { kind: 'formula', expr: 'item.id' } });
    });

    it('switches a value between a formula and a fixed value', () => {
        const { lastAction } = renderActions({ ...NAVIGATE, params: { tab: { kind: 'formula', expr: 'item.tab' } } });
        fireEvent.click(screen.getByRole('button', { name: 'Use a fixed value' }));
        fireEvent.change(screen.getByLabelText('Value 1'), { target: { value: 'notes' } });
        expect(lastAction().params).toEqual({ tab: { kind: 'static', value: 'notes' } });
    });

    it('removing the last value drops the key entirely', () => {
        const { lastAction } = renderActions({ ...NAVIGATE, params: { tab: { kind: 'static', value: 'x' } } });
        fireEvent.click(screen.getByRole('button', { name: 'Remove value 1' }));
        expect(lastAction()).toEqual({ kind: 'navigate', screenId: 'scr_b' });
        expect(lastAction()).not.toHaveProperty('params');
    });

    // params is an object: committing a duplicate name would collapse the two
    // rows and drop the first one's value in silence.
    it('refuses a name another value already uses, and says why', () => {
        const { lastAction } = renderActions({ ...NAVIGATE, params: { a: { kind: 'static', value: '1' } } });
        fireEvent.click(screen.getByRole('button', { name: 'Carry a value along' }));
        fireEvent.change(screen.getByLabelText('Value 2 name'), { target: { value: 'a' } });

        expect(screen.getByText(/already goes by that name/i)).toBeTruthy();
        // The first value is intact — nothing was swallowed.
        expect(lastAction().params.a).toEqual({ kind: 'static', value: '1' });
    });

    it('the formula field is a real expression editor, not a bare box', () => {
        const { container } = renderActions({ ...NAVIGATE, params: { id: { kind: 'formula', expr: 'item.' } } });
        expect(container.querySelector('[data-formula-error]')).toBeTruthy();
        // And the variable picker is reachable from it.
        expect(screen.getAllByLabelText('Insert a variable').length).toBeGreaterThan(0);
    });

    it('says what the values are for when there are none yet', () => {
        renderActions(NAVIGATE);
        expect(screen.getByText(/screen\.params\.name/)).toBeTruthy();
    });
});
