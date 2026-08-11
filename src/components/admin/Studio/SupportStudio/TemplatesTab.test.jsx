import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import TemplatesTab from './TemplatesTab';
import { authFetch } from '../../../../utils/helpers';
import { ok } from '@/test/http';

vi.mock('../../../../utils/helpers', () => ({ API_BASE: '', authFetch: vi.fn() }));
vi.mock('../../../../hooks/useTranslation', () => import('@/test/useTranslationMock'));

describe('TemplatesTab', () => {
    beforeEach(() => { cleanup(); authFetch.mockReset(); });

    it('creates a tag against the tenant (/api/support-inbox) namespace, not /api/support', async () => {
        authFetch.mockImplementation((url, opts) => {
            if (String(url).includes('/api/support-inbox/tags') && opts?.method === 'POST') return ok({ tag: { id: 't1', name: 'billing' } });
            if (String(url).includes('/api/support-inbox/tags')) return ok({ tags: [] });
            if (String(url).includes('/api/support-inbox/canned')) return ok({ canned: [] });
            return ok({});
        });
        render(<TemplatesTab />);
        const input = await screen.findByPlaceholderText('New tag name');
        fireEvent.change(input, { target: { value: 'billing' } });
        // Tags + Canned each have an "Add"; the Tags one renders first.
        fireEvent.click(screen.getAllByText('Add')[0]);

        const post = authFetch.mock.calls.find(([url, opts]) => opts?.method === 'POST');
        expect(post).toBeTruthy();
        expect(String(post[0])).toContain('/api/support-inbox/tags');
        expect(String(post[0])).not.toContain('/api/support/tags');
        expect(JSON.parse(post[1].body)).toMatchObject({ name: 'billing' });
    });
});
