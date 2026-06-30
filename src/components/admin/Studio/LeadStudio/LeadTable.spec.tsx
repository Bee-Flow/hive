import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import LeadTable from './LeadTable';

const t = (_key: string, fallback?: string) => fallback || _key;

const leads = [
    {
        id: 'l1', campaignId: 'c1', companyName: 'Bouwbedrijf Jansen BV', website: 'jansen.nl',
        address: 'Utrechtseweg 10, Utrecht', ownerName: 'Peter Jansen', email: 'peter@jansen.nl',
        phone: '030-1234567', status: 'new', verified: false, aiConfidence: 0.82,
        kvkNumber: '12345678', sbiCodes: ['4120'], provenance: { kvk_number: { source: 'kvk' } },
    },
    {
        id: 'l2', campaignId: 'c1', companyName: 'Acme NV', status: 'contacted',
        verified: true, checkedByUserId: 'u9', aiConfidence: 0.3,
    },
];

describe('LeadTable', () => {
    it('renders lead rows with company, owner, email, and confidence', () => {
        render(<LeadTable leads={leads} teammates={[]} onPatch={() => {}} onToggleVerify={() => {}} t={t} userId="u1" />);
        expect(screen.getByText('Bouwbedrijf Jansen BV')).toBeInTheDocument();
        expect(screen.getByText('Peter Jansen')).toBeInTheDocument();
        expect(screen.getByText('peter@jansen.nl')).toBeInTheDocument();
        expect(screen.getByText('82%')).toBeInTheDocument();
    });

    it('fires onToggleVerify when the afvink checkbox is clicked', () => {
        const onToggleVerify = vi.fn();
        render(<LeadTable leads={leads} teammates={[]} onPatch={() => {}} onToggleVerify={onToggleVerify} t={t} userId="u1" />);
        const checkboxes = screen.getAllByRole('checkbox');
        fireEvent.click(checkboxes[0]);
        expect(onToggleVerify).toHaveBeenCalledWith(leads[0]);
    });

    it('fires onPatch with a new status when the status select changes', () => {
        const onPatch = vi.fn();
        render(<LeadTable leads={leads} teammates={[]} onPatch={onPatch} onToggleVerify={() => {}} t={t} userId="u1" />);
        const selects = screen.getAllByRole('combobox');
        // first row's status select is the first combobox
        fireEvent.change(selects[0], { target: { value: 'qualified' } });
        expect(onPatch).toHaveBeenCalledWith('l1', { status: 'qualified' });
    });

    it('expands a row to reveal KvK + SBI detail', () => {
        render(<LeadTable leads={leads} teammates={[]} onPatch={() => {}} onToggleVerify={() => {}} t={t} userId="u1" />);
        fireEvent.click(screen.getByText('Bouwbedrijf Jansen BV'));
        expect(screen.getByText('12345678')).toBeInTheDocument();
        expect(screen.getByText('4120')).toBeInTheDocument();
    });

    it('fires onResearch and onDraftEmail from the per-row AI action buttons', () => {
        const onResearch = vi.fn();
        const onDraftEmail = vi.fn();
        render(<LeadTable leads={leads} teammates={[]} onPatch={() => {}} onToggleVerify={() => {}}
            onResearch={onResearch} onDraftEmail={onDraftEmail} t={t} userId="u1" />);
        fireEvent.click(screen.getAllByRole('button', { name: 'Meer info zoeken (AI)' })[0]);
        expect(onResearch).toHaveBeenCalledWith('l1');
        fireEvent.click(screen.getAllByRole('button', { name: 'E-mail opstellen (AI)' })[0]);
        expect(onDraftEmail).toHaveBeenCalledWith(leads[0]);
    });

    it('disables the research button while that lead is busy', () => {
        render(<LeadTable leads={leads} teammates={[]} onPatch={() => {}} onToggleVerify={() => {}}
            onResearch={() => {}} onDraftEmail={() => {}} busyResearchId="l1" t={t} userId="u1" />);
        const buttons = screen.getAllByRole('button', { name: 'Meer info zoeken (AI)' });
        expect(buttons[0]).toBeDisabled();
    });

    it('renders a Campaign column only when showCampaign is set', () => {
        const withCampaign = [{ ...leads[0], campaignTitle: 'Accountancy · Amstelveen' }];
        const { rerender, queryByText } = render(
            <LeadTable leads={withCampaign} teammates={[]} onPatch={() => {}} onToggleVerify={() => {}} t={t} userId="u1" />);
        expect(queryByText('Accountancy · Amstelveen')).not.toBeInTheDocument();
        rerender(<LeadTable leads={withCampaign} teammates={[]} onPatch={() => {}} onToggleVerify={() => {}} showCampaign t={t} userId="u1" />);
        expect(queryByText('Accountancy · Amstelveen')).toBeInTheDocument();
    });
});
