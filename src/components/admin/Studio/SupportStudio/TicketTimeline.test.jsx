import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import TicketTimeline from './TicketTimeline';
import { authFetch } from '../../../../utils/helpers';
import { ok } from '@/test/http';

vi.mock('../../../../utils/helpers', () => ({ API_BASE: '', authFetch: vi.fn() }));
vi.mock('../../../../hooks/useTranslation', () => import('@/test/useTranslationMock'));

describe('TicketTimeline', () => {
    beforeEach(() => { cleanup(); authFetch.mockReset(); });

    it('labels a mixed feed by precise actor kind', async () => {
        authFetch.mockImplementation(() => ok({
            events: [
                { id: 'e1', actor_kind: 'system', action: 'email_ingested', payload: { subject: 'Help' }, created_at: '2026-06-29T10:00:00Z' },
                { id: 'e2', actor_kind: 'ai', action: 'ai_reply', payload: { confidence: 0.92 }, created_at: '2026-06-29T10:01:00Z' },
                { id: 'e3', actor_kind: 'staff', action: 'staff_reply', actor_user_id: 'u1', payload: {}, created_at: '2026-06-29T10:05:00Z' },
            ],
        }));
        render(<TicketTimeline threadId="t1" teammates={[{ id: 'u1', name: 'Bob' }]} />);
        expect(await screen.findByText('Email received')).toBeTruthy();
        expect(screen.getByText('AI replied')).toBeTruthy();
        expect(screen.getByText('Replied')).toBeTruthy();
        // staff event resolves the teammate name
        expect(screen.getByText(/Bob/)).toBeTruthy();
    });

    it('shows an empty state when there are no events', async () => {
        authFetch.mockImplementation(() => ok({ events: [] }));
        render(<TicketTimeline threadId="t1" />);
        expect(await screen.findByText('No activity yet.')).toBeTruthy();
    });
});
