import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AppStepper from './AppStepper';
import { RuntimeProvider, buildScope, DEFAULT_RUNTIME } from '../RuntimeContext';

/**
 * 'stepper' — where a record IS in its process.
 *
 * The behaviour worth pinning is the honest one: a value that matches no step
 * must leave every stage upcoming rather than implying the work has started.
 */

const STEPS = [
    { value: 'new', label: 'New', icon: null },
    { value: 'open', label: 'Open', icon: null },
    { value: 'done', label: 'Done', icon: null },
];

function node(value, extra = {}) {
    return {
        id: 'cmp_step01', type: 'stepper',
        props: {
            value: { kind: 'static', value },
            steps: STEPS, orientation: 'horizontal', tone: 'primary', showLabels: true,
            ...extra,
        },
        style: {},
    };
}

function renderStepper(n, runtime = {}) {
    const value = {
        ...DEFAULT_RUNTIME,
        scope: buildScope({ now: '2020-01-01T00:00:00.000Z' }),
        mode: 'run',
        ...runtime,
    };
    return render(
        <RuntimeProvider value={value}>
            <AppStepper node={n} />
        </RuntimeProvider>,
    );
}

describe('AppStepper', () => {
    it('marks the matching step current and the earlier ones done', () => {
        const { container } = renderStepper(node('open'));
        const items = container.querySelectorAll('[role="listitem"]');
        expect(items).toHaveLength(3);
        expect(items[0].dataset.state).toBe('done');
        expect(items[1].dataset.state).toBe('current');
        expect(items[2].dataset.state).toBe('upcoming');
        expect(screen.getByText('Open')).toBeInTheDocument();
    });

    it('leaves everything upcoming when the value matches no step', () => {
        // A record can hold a status somebody removed from the vocabulary.
        // Treating that as "step 1 in progress" would be a lie about the work.
        const { container } = renderStepper(node('archived'));
        for (const item of container.querySelectorAll('[role="listitem"]')) {
            expect(item.dataset.state).toBe('upcoming');
        }
    });

    it('is inert without an event, and clickable with one', () => {
        const { container, unmount } = renderStepper(node('new'));
        expect(container.querySelectorAll('button')).toHaveLength(0);
        unmount();

        const runAction = vi.fn();
        const clickable = { ...node('new'), onRowClick: 'act_pick01' };
        renderStepper(clickable, { runAction });
        fireEvent.click(screen.getByText('Done').closest('button'));
        // The step itself rides along as `item`/`value`/`index`, so a navigate
        // param can carry which step was clicked.
        expect(runAction).toHaveBeenCalledWith('act_pick01', expect.objectContaining({
            formValues: { value: 'done', label: 'Done', index: 2 },
            value: 'done',
            index: 2,
        }));
    });

    it('renders nothing without steps, rather than an empty rail', () => {
        const { container } = renderStepper(node('new', { steps: [] }));
        expect(container.querySelector('[data-app-stepper]')).toBeNull();
    });
});
