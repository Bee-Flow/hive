import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import ExecutionsFilterBar from './ExecutionsFilterBar.jsx';

const baseFilters = { status: 'all', range: '24h', trigger: null, automationId: null };

const renderBar = (props = {}) =>
    render(
        <ExecutionsFilterBar
            filters={baseFilters}
            setFilters={vi.fn()}
            facets={null}
            onRefresh={vi.fn()}
            {...props}
        />,
    );

beforeEach(() => cleanup());

describe('ExecutionsFilterBar — chips & ranges', () => {
    it('renders the status chips and date-range buttons', () => {
        renderBar();
        for (const label of ['Success', 'Failures', 'Running', 'Awaiting']) {
            expect(screen.getByRole('button', { name: new RegExp(label) })).toBeTruthy();
        }
        for (const label of ['24h', '7d', '30d']) {
            expect(screen.getByRole('button', { name: new RegExp(`^${label}$`) })).toBeTruthy();
        }
        // 'All' appears as both a status chip and a range button.
        expect(screen.getAllByRole('button', { name: /^All$/ }).length).toBe(2);
    });

    it('derives status counts from facets.status', () => {
        const facets = { status: { success: 3, error: 1, running: 2, queued: 1, awaiting_approval: 1 } };
        renderBar({ facets });
        // Running = running(2) + queued(1) = 3
        expect(screen.getByRole('button', { name: /Running/ }).textContent).toMatch(/3/);
        expect(screen.getByRole('button', { name: /Failures/ }).textContent).toMatch(/1/);
        expect(screen.getByRole('button', { name: /Success/ }).textContent).toMatch(/3/);
        // All = sum of every status value = 8
        const allChip = screen.getAllByRole('button', { name: /^All\s*8$/ })[0];
        expect(allChip).toBeTruthy();
    });

    it('clicking Failures calls setFilters with an updater that sets status="error"', () => {
        const setFilters = vi.fn();
        renderBar({ setFilters });
        fireEvent.click(screen.getByRole('button', { name: /Failures/ }));
        expect(setFilters).toHaveBeenCalledTimes(1);
        const updater = setFilters.mock.calls[0][0];
        expect(typeof updater).toBe('function');
        expect(updater(baseFilters)).toEqual({ ...baseFilters, status: 'error' });
    });
});

describe('ExecutionsFilterBar — automation picker', () => {
    it('renders the picker with options when showAutomationPicker is true', () => {
        renderBar({ showAutomationPicker: true, automationOptions: [{ id: 'a1', title: 'Auto One' }] });
        expect(screen.getByRole('option', { name: 'Auto One' })).toBeTruthy();
    });

    it('does not render the picker when showAutomationPicker is false', () => {
        renderBar({ showAutomationPicker: false, automationOptions: [{ id: 'a1', title: 'Auto One' }] });
        expect(screen.queryByRole('option', { name: 'Auto One' })).toBeNull();
    });
});
