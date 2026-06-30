import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import KBsStudio from './index.jsx';
import { authFetch } from '../../../../utils/helpers';

// Stub the detail page (not under test here) and the auth-aware fetch.
vi.mock('../../../KBDetailPage', () => ({ default: () => null }));
vi.mock('../../../../utils/helpers', () => ({ API_BASE: '', authFetch: vi.fn() }));
vi.mock('../../../../hooks/useTranslation', () => ({
    useTranslation: () => ({
        t: (key) => ({
            'kb_studio.category_filter_all': 'All categories',
            'kb_studio.category_filter_empty': 'No knowledge bases in this category',
        }[key] || key),
    }),
}));

const ok = (body) => Promise.resolve({ ok: true, json: async () => body });

const mockFetches = ({ kbs = [], categories = [], categoriesReject = false } = {}) => {
    authFetch.mockImplementation((url) => {
        if (String(url).includes('/api/kb/categories')) {
            return categoriesReject ? Promise.reject(new Error('network')) : ok(categories);
        }
        return ok(kbs);
    });
};

const SALES = { id: 'c1', name: 'Sales', icon: '💼' };

describe('KBsStudio category filter', () => {
    beforeEach(() => { cleanup(); authFetch.mockReset(); });

    it('hides the filter select when no KB uses a category', async () => {
        mockFetches({
            kbs: [{ id: 'kb1', name: 'KB One' }, { id: 'kb2', name: 'KB Two' }],
            categories: [SALES],
        });
        render(<KBsStudio user={{}} />);
        expect(await screen.findByText('KB One')).toBeTruthy();
        expect(screen.queryByRole('combobox')).toBeNull();
    });

    it('filters the list by category and restores it on "All categories"', async () => {
        mockFetches({
            kbs: [{ id: 'kb1', name: 'KB One', category_id: 'c1' }, { id: 'kb2', name: 'KB Two' }],
            categories: [SALES],
        });
        render(<KBsStudio user={{}} />);
        const select = await screen.findByRole('combobox');
        expect(screen.getByText('💼 Sales')).toBeTruthy();

        fireEvent.change(select, { target: { value: 'c1' } });
        expect(screen.getByText('KB One')).toBeTruthy();
        expect(screen.queryByText('KB Two')).toBeNull();

        fireEvent.change(select, { target: { value: 'all' } });
        expect(screen.getByText('KB One')).toBeTruthy();
        expect(screen.getByText('KB Two')).toBeTruthy();
    });

    it('still renders all KBs when the categories fetch rejects', async () => {
        mockFetches({
            kbs: [{ id: 'kb1', name: 'KB One', category_id: 'c1' }, { id: 'kb2', name: 'KB Two' }],
            categoriesReject: true,
        });
        render(<KBsStudio user={{}} />);
        expect(await screen.findByText('KB One')).toBeTruthy();
        expect(screen.getByText('KB Two')).toBeTruthy();
        expect(screen.queryByRole('combobox')).toBeNull();
    });
});
