import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const authFetch = vi.fn();
vi.mock('../../../../utils/helpers', () => ({ API_BASE: '', authFetch: (...a: unknown[]) => authFetch(...a) }));

import TasksView from './TasksView';

const t = (_k: string, fb?: string) => fb || _k;
const dayMs = 86400000;
const tasks = [
    { id: 't1', leadId: 'l1', title: 'Bel Acme', companyName: 'Acme BV', dueAt: new Date(Date.now() - dayMs).toISOString() }, // overdue
    { id: 't2', leadId: 'l2', title: 'Mail Beta', companyName: 'Beta NV', dueAt: new Date(Date.now() + 2 * dayMs).toISOString() }, // upcoming
    { id: 't3', leadId: 'l3', title: 'Geen datum', companyName: 'Gamma', dueAt: null }, // undated
];

describe('TasksView', () => {
    beforeEach(() => { authFetch.mockReset(); authFetch.mockResolvedValue({ ok: true, json: async () => ({ tasks }) }); });

    it('groups tasks into Overdue / Upcoming / No date', async () => {
        render(<TasksView onOpenLead={() => {}} t={t} />);
        expect(await screen.findByText('Bel Acme')).toBeInTheDocument();
        expect(screen.getByText('Te laat')).toBeInTheDocument();
        expect(screen.getByText('Aankomend')).toBeInTheDocument();
        expect(screen.getByText('Zonder datum')).toBeInTheDocument();
    });

    it('opens the lead when a task is clicked', async () => {
        const onOpenLead = vi.fn();
        render(<TasksView onOpenLead={onOpenLead} t={t} />);
        fireEvent.click(await screen.findByText('Bel Acme'));
        expect(onOpenLead).toHaveBeenCalledWith('l1');
    });

    it('completes a task via the API', async () => {
        render(<TasksView onOpenLead={() => {}} t={t} />);
        await screen.findByText('Bel Acme');
        const completeBtns = screen.getAllByRole('button', { name: 'Afronden' });
        fireEvent.click(completeBtns[0]);
        await waitFor(() => expect(authFetch).toHaveBeenCalledWith(expect.stringContaining('/tasks/'), expect.objectContaining({ method: 'POST' })));
    });
});
