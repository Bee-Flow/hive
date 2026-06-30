import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import AuditTab from './AuditTab';
import { authFetch } from '../../../../utils/helpers';

vi.mock('../../../../utils/helpers', () => ({ API_BASE: '', authFetch: vi.fn() }));
vi.mock('../../../../hooks/useTranslation', () => ({ default: () => ({ t: (_k, fallback) => fallback || _k }) }));

const ok = (body) => Promise.resolve({ ok: true, json: async () => body });
const EVENTS = [
    { id: 'e1', actor_kind: 'ai', action: 'ai_reply', inbox_id: 'i1', thread_id: 't1', payload: { confidence: 0.9 }, created_at: '2026-06-29T10:00:00Z' },
    { id: 'e2', actor_kind: 'staff', action: 'inbox_access_changed', inbox_id: 'i1', payload: { sharedGroups: ['g1'] }, created_at: '2026-06-29T09:00:00Z' },
];

describe('AuditTab', () => {
    beforeEach(() => { cleanup(); authFetch.mockReset(); });

    it('renders events and never shows an export button', async () => {
        authFetch.mockImplementation(() => ok({ events: EVENTS, nextCursor: null }));
        render(<AuditTab inboxes={[{ id: 'i1', email_address: 'support@acme.nl' }]} />);
        expect(await screen.findByText('AI replied')).toBeTruthy();
        expect(screen.getByText('Access changed')).toBeTruthy();
        // Project rule: no CSV/JSON export on audit/dashboards.
        expect(screen.queryByText(/export/i)).toBeNull();
    });

    it('paginates with the cursor on "Load more"', async () => {
        let page = 0;
        authFetch.mockImplementation((url) => {
            page += 1;
            if (String(url).includes('cursor=')) return ok({ events: [{ id: 'e9', actor_kind: 'system', action: 'email_ingested', inbox_id: 'i1', payload: {}, created_at: '2026-06-29T08:00:00Z' }], nextCursor: null });
            return ok({ events: EVENTS, nextCursor: 'CUR1' });
        });
        render(<AuditTab inboxes={[{ id: 'i1', email_address: 'support@acme.nl' }]} />);
        fireEvent.click(await screen.findByText('Load more'));
        expect(await screen.findByText('Email received')).toBeTruthy();
        const cursorCall = authFetch.mock.calls.find(([url]) => String(url).includes('cursor=CUR1'));
        expect(cursorCall).toBeTruthy();
    });
});
