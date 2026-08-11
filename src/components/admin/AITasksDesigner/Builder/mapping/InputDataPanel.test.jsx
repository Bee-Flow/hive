import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import InputDataPanel from './InputDataPanel';

/**
 * useUpstreamVariables returns groups TOPOLOGICALLY — trigger first, the step
 * closest to the one being edited last. The panel shows them nearest-first.
 */
const GROUPS = [
    {
        id: 'trg',
        label: 'Trigger',
        kind: 'trigger',
        basePath: 'trigger.output',
        sample: { email: 'a@b.nl' },
        fields: [{ key: 'email', path: 'trigger.output.email', sample: 'a@b.nl' }],
    },
    {
        id: 's1',
        label: 'Gmail search',
        kind: 'integration_action',
        basePath: 'steps.s1.output',
        sample: { results: [{ subject: 'Contract' }], count: 1 },
        fields: [
            { key: 'count', path: 'steps.s1.output.count', sample: 1 },
            {
                key: 'results',
                path: 'steps.s1.output.results',
                sample: [{ subject: 'Contract' }],
                children: [{ key: 'subject', path: 'steps.s1.output.results[*].subject', sample: 'Contract' }],
            },
        ],
    },
];

const renderPanel = (props = {}) => {
    const onPick = vi.fn();
    render(<InputDataPanel groups={GROUPS} previewSample={null} onPick={onPick} {...props} />);
    return { onPick };
};

describe('InputDataPanel', () => {
    beforeEach(cleanup);

    it('shows the field tree, not a nested table, by default', () => {
        renderPanel();
        // The nearest step is open, so its fields are on screen straight away.
        expect(screen.getByText('count')).toBeTruthy();
        // OutputView's Table/JSON toggle is the tell-tale of the old view.
        expect(screen.queryByText('JSON')).toBeNull();
    });

    it('lists the nearest step first and opens only that one', () => {
        renderPanel();
        const labels = screen.getAllByText(/Gmail search|Trigger/).map(el => el.textContent);
        expect(labels[0]).toBe('Gmail search');
        // The trigger section is collapsed, so its field is not rendered.
        expect(screen.queryByText('email')).toBeNull();
        fireEvent.click(screen.getByText('Trigger'));
        expect(screen.getByText('email')).toBeTruthy();
    });

    it('clicking a field inserts its path', () => {
        const { onPick } = renderPanel();
        fireEvent.click(screen.getByText('count'));
        expect(onPick).toHaveBeenCalledWith('steps.s1.output.count');
    });

    it('dragging a field carries BOTH mime types', () => {
        renderPanel();
        const setData = vi.fn();
        fireEvent.dragStart(screen.getByText('count').parentElement, {
            dataTransfer: { setData, get effectAllowed() { return ''; }, set effectAllowed(_v) {} },
        });
        expect(setData).toHaveBeenCalledWith('text/plain', 'steps.s1.output.count');
        expect(setData).toHaveBeenCalledWith('application/x-binding-path', 'steps.s1.output.count');
    });

    it('dragging the section header carries the whole output path', () => {
        renderPanel();
        const setData = vi.fn();
        fireEvent.dragStart(screen.getByText('Gmail search').parentElement, {
            dataTransfer: { setData, get effectAllowed() { return ''; }, set effectAllowed(_v) {} },
        });
        expect(setData).toHaveBeenCalledWith('application/x-binding-path', 'steps.s1.output');
    });

    it('searching filters across groups and opens what matched', () => {
        renderPanel();
        fireEvent.change(screen.getByLabelText('Search input fields'), { target: { value: 'email' } });
        expect(screen.getByText('email')).toBeTruthy();
        expect(screen.queryByText('count')).toBeNull();
        // The Gmail group has no match at all, so it drops out entirely.
        expect(screen.queryByText('Gmail search')).toBeNull();
    });

    it('reports honestly when nothing matches', () => {
        renderPanel();
        fireEvent.change(screen.getByLabelText('Search input fields'), { target: { value: 'zzzz' } });
        expect(screen.getByText('No matches.')).toBeTruthy();
    });

    it('the Table view is one click away and takes over the panel', () => {
        renderPanel();
        fireEvent.click(screen.getByLabelText('Open Gmail search as a table'));
        // OutputView is mounted (its mode toggle appears) and the section list
        // is gone, so there is exactly one scroller.
        expect(screen.getByText('JSON')).toBeTruthy();
        expect(screen.queryByLabelText('Search input fields')).toBeNull();
        fireEvent.click(screen.getByText('Fields'));
        expect(screen.getByLabelText('Search input fields')).toBeTruthy();
    });

    it('expanding a field keeps the row itself clickable as the parent path', () => {
        const { onPick } = renderPanel();
        const row = screen.getByText('results').parentElement;
        fireEvent.click(within(row).getByRole('button'));       // the chevron
        expect(screen.getByText('subject')).toBeTruthy();
        expect(onPick).not.toHaveBeenCalled();
        fireEvent.click(screen.getByText('results'));            // the row
        expect(onPick).toHaveBeenCalledWith('steps.s1.output.results');
    });

    it('says so when there is no upstream data at all', () => {
        render(<InputDataPanel groups={[]} onPick={vi.fn()} />);
        expect(screen.getByText(/No upstream data yet/)).toBeTruthy();
    });
});
