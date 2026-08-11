import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import OnboardingWizard from './OnboardingWizard';

vi.mock('../../../hooks/useTranslation', () => ({
    useTranslation: () => ({ t: (key) => key }),
}));

const detected = {
    legal_bases: ['contract', 'consent'],
    data_residency: 'hybrid',
    default_retention_days: 180,
    privacy_notice_url: null,
    breach_recipients: ['admin@acme.example'],
};

describe('OnboardingWizard auto-prefill', () => {
    beforeEach(cleanup);

    async function toLegalStep() {
        fireEvent.change(screen.getByLabelText('compliance.dpo_name'), { target: { value: 'Jane' } });
        fireEvent.change(screen.getByLabelText('compliance.dpo_email'), { target: { value: 'jane@acme.example' } });
        fireEvent.click(screen.getByText('compliance.next'));
    }

    it('prefills untouched fields and flags the step', async () => {
        const onAutoDetect = vi.fn(async () => detected);
        render(<OnboardingWizard initialSettings={{}} onAutoDetect={onAutoDetect} onFinish={vi.fn()} />);
        await waitFor(() => expect(onAutoDetect).toHaveBeenCalled());
        await toLegalStep();
        expect(await screen.findByText('compliance.wizard_prefilled')).toBeInTheDocument();
    });

    it('never overwrites settings the org already saved', async () => {
        const onAutoDetect = vi.fn(async () => detected);
        render(
            <OnboardingWizard
                initialSettings={{ legal_bases: ['legal_obligation'], breach_recipients: ['dpo@saved.example'] }}
                onAutoDetect={onAutoDetect}
                onFinish={vi.fn()}
            />,
        );
        await waitFor(() => expect(onAutoDetect).toHaveBeenCalled());
        await toLegalStep();
        // Saved legal basis still selected, detected ones not applied → no hint.
        expect(screen.queryByText('compliance.wizard_prefilled')).not.toBeInTheDocument();
    });

    it('survives a failing auto-detect endpoint', async () => {
        const onAutoDetect = vi.fn(async () => { throw new Error('503'); });
        render(<OnboardingWizard initialSettings={{}} onAutoDetect={onAutoDetect} onFinish={vi.fn()} />);
        await waitFor(() => expect(onAutoDetect).toHaveBeenCalled());
        expect(screen.getByText('compliance.wizard_title')).toBeInTheDocument();
    });
});

const ORG_USERS = [
    { id: 'jan', displayName: 'Jan Janssen', email: 'jan@acme.nl', phone: '0611111111', orgRole: 'org_admin' },
    { id: 'zoe', displayName: 'Zoë de Vries', email: 'zoe@acme.nl', phone: null, orgRole: 'dpo' },
];

describe('OnboardingWizard org-user picker', () => {
    beforeEach(cleanup);

    it('DPO step: selecting a member fills the fields, which stay editable', () => {
        render(<OnboardingWizard initialSettings={{}} onFinish={vi.fn()} orgUsers={ORG_USERS} />);
        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'zoe' } });
        expect(screen.getByLabelText('compliance.dpo_name').value).toBe('Zoë de Vries');
        expect(screen.getByLabelText('compliance.dpo_email').value).toBe('zoe@acme.nl');
        expect(screen.getByLabelText('compliance.dpo_phone').value).toBe('');
        // External-DPO path: the plain inputs remain writable after a pick.
        fireEvent.change(screen.getByLabelText('compliance.dpo_email'), { target: { value: 'extern@dpo.example' } });
        expect(screen.getByLabelText('compliance.dpo_email').value).toBe('extern@dpo.example');
    });

    it('breach step: picking a member appends their email as a recipient chip', async () => {
        render(<OnboardingWizard initialSettings={{}} onFinish={vi.fn()} orgUsers={ORG_USERS} />);
        // Walk to step 3 (legal bases + residency have valid defaults).
        fireEvent.change(screen.getByLabelText('compliance.dpo_name'), { target: { value: 'Jane' } });
        fireEvent.change(screen.getByLabelText('compliance.dpo_email'), { target: { value: 'jane@acme.example' } });
        fireEvent.click(screen.getByText('compliance.next'));
        fireEvent.click(screen.getByText('compliance.next'));
        fireEvent.click(screen.getByText('compliance.next'));
        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'jan' } });
        expect(await screen.findByText('jan@acme.nl')).toBeInTheDocument();
        // Already-added members leave the dropdown.
        expect(screen.queryByText('Jan Janssen — jan@acme.nl')).not.toBeInTheDocument();
    });

    it('renders no picker without a directory — free text is the only path', () => {
        render(<OnboardingWizard initialSettings={{}} onFinish={vi.fn()} />);
        expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
        expect(screen.getByLabelText('compliance.dpo_name')).toBeInTheDocument();
    });
});
