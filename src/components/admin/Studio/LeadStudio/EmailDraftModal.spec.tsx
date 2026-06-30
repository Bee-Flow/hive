import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const authFetch = vi.fn();
vi.mock('../../../../utils/helpers', () => ({ API_BASE: '', authFetch: (...a: unknown[]) => authFetch(...a) }));
vi.mock('../../../../hooks/useTranslation', () => ({ default: () => ({ t: (_k: string, fb?: string) => fb || _k }) }));

import EmailDraftModal from './EmailDraftModal';

const t = (_key: string, fallback?: string) => fallback || _key;

function jsonRes(body: unknown, ok = true) {
    return Promise.resolve({ ok, json: async () => body });
}

describe('EmailDraftModal', () => {
    beforeEach(() => { authFetch.mockReset(); });

    it('auto-generates a draft on open when the lead has none, and shows subject + body', async () => {
        authFetch.mockReturnValueOnce(jsonRes({ subject: 'Samenwerken met Acme', body: 'Beste Jan,\n\nGroet.', usedSearch: true }));
        render(<EmailDraftModal lead={{ id: 'l1', companyName: 'Acme BV', email: 'jan@acme.nl' }} onClose={() => {}} t={t} />);
        // POST to the draft-email endpoint fired on mount
        await waitFor(() => expect(authFetch).toHaveBeenCalled());
        const [url, opts] = authFetch.mock.calls[0];
        expect(url).toContain('/api/lead-studio/leads/l1/draft-email');
        expect(opts.method).toBe('POST');
        // generated content lands in the editable fields
        expect(await screen.findByDisplayValue('Samenwerken met Acme')).toBeInTheDocument();
        expect(await screen.findByDisplayValue(/Beste Jan/)).toBeInTheDocument();
    });

    it('shows the persisted draft without regenerating', async () => {
        render(<EmailDraftModal
            lead={{ id: 'l2', companyName: 'Acme BV', emailDraftSubject: 'Bestaand onderwerp', emailDraftBody: 'Bestaande tekst' }}
            onClose={() => {}} t={t} />);
        expect(screen.getByDisplayValue('Bestaand onderwerp')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Bestaande tekst')).toBeInTheDocument();
        // no auto-generate call on mount
        expect(authFetch).not.toHaveBeenCalled();
    });

    it('regenerates on demand', async () => {
        authFetch.mockReturnValue(jsonRes({ subject: 'Nieuw', body: 'Nieuwe tekst', usedSearch: false }));
        render(<EmailDraftModal
            lead={{ id: 'l3', companyName: 'Acme BV', emailDraftSubject: 'Oud', emailDraftBody: 'Oude tekst' }}
            onClose={() => {}} t={t} />);
        fireEvent.click(screen.getByRole('button', { name: 'Opnieuw genereren' }));
        expect(await screen.findByDisplayValue('Nieuw')).toBeInTheDocument();
    });
});
