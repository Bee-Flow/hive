import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const authFetch = vi.fn();
vi.mock('../../../../utils/helpers', () => ({ API_BASE: '', authFetch: (...a: unknown[]) => authFetch(...a) }));
vi.mock('../../../../hooks/useTranslation', () => ({ default: () => ({ t: (_k: string, fb?: string) => fb || _k }) }));

import LeadDetailPanel from './LeadDetailPanel';

const t = (_k: string, fb?: string) => fb || _k;
const lead = { id: 'l1', campaignId: 'c1', companyName: 'Acme BV', status: 'contacted', ownerName: 'Jan Jansen', email: 'jan@acme.nl' };

function route(url: string) {
    if (url.includes('/activities')) return { ok: true, json: async () => ({ activities: [{ id: 'a1', type: 'call', body: 'Goed gesprek', createdAt: new Date().toISOString() }] }) };
    if (url.includes('/contacts')) return { ok: true, json: async () => ({ contacts: [] }) };
    if (url.includes('/tasks')) return { ok: true, json: async () => ({ tasks: [{ id: 't1', leadId: 'l1', title: 'Bel terug', dueAt: null }] }) };
    return { ok: true, json: async () => ({}) };
}

describe('LeadDetailPanel', () => {
    beforeEach(() => { authFetch.mockReset(); authFetch.mockImplementation(async (url: string) => route(url)); });

    it('renders the company, timeline activity and a task', async () => {
        render(<LeadDetailPanel lead={lead} onClose={() => {}} onPatchLead={() => {}} t={t} userId="u1" />);
        expect(screen.getByText('Acme BV')).toBeInTheDocument();
        expect(await screen.findByText('Goed gesprek')).toBeInTheDocument();
        expect(await screen.findByText('Bel terug')).toBeInTheDocument();
    });

    it('patches the stage via onPatchLead', async () => {
        const onPatchLead = vi.fn();
        render(<LeadDetailPanel lead={lead} onClose={() => {}} onPatchLead={onPatchLead} t={t} userId="u1" />);
        const stageSelect = screen.getAllByRole('combobox')[0];
        fireEvent.change(stageSelect, { target: { value: 'qualified' } });
        expect(onPatchLead).toHaveBeenCalledWith('l1', { status: 'qualified' });
    });

    it('requests an AI next step', async () => {
        authFetch.mockImplementation(async (url: string, opts: any) => {
            if (url.includes('/next-step')) return { ok: true, json: async () => ({ suggestion: 'Stuur opvolgmail', rationale: '', action: { type: 'email' } }) };
            return route(url);
        });
        render(<LeadDetailPanel lead={lead} onClose={() => {}} onPatchLead={() => {}} t={t} userId="u1" />);
        fireEvent.click(screen.getByRole('button', { name: 'Voorstellen' }));
        expect(await screen.findByText('Stuur opvolgmail')).toBeInTheDocument();
    });

    it('adds a follow-up task via the API', async () => {
        render(<LeadDetailPanel lead={lead} onClose={() => {}} onPatchLead={() => {}} t={t} userId="u1" />);
        await screen.findByText('Bel terug');
        const input = screen.getByPlaceholderText('Nieuwe taak…');
        fireEvent.change(input, { target: { value: 'Demo plannen' } });
        fireEvent.click(screen.getByRole('button', { name: 'Taak toevoegen' }));
        await waitFor(() => expect(authFetch).toHaveBeenCalledWith(expect.stringContaining('/leads/l1/tasks'), expect.objectContaining({ method: 'POST' })));
    });
});
