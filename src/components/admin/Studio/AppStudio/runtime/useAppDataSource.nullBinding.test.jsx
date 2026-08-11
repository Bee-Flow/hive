import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DataProvider } from './DataContext';
import useAppDataSource from './useAppDataSource';

/**
 * A null binding must be inert, not fatal.
 *
 * `resolveBindingFilters` returns null when a REQUIRED filter has nothing to
 * resolve against — "no ticket selected yet, so no rows". The hook guarded its
 * effect body with `enabled`, but read `binding.tableId` in the effect's
 * DEPENDENCY ARRAY, which React evaluates on every render regardless. Opening
 * any screen with a selection-scoped component threw straight to the error
 * boundary: "Cannot read properties of null (reading 'tableId')".
 */

vi.mock('../../../../../utils/helpers', () => ({
    API_BASE: '',
    authFetch: vi.fn(async () => { throw new Error('must not fetch'); }),
}));

function Probe({ binding }) {
    const { cacheKey } = useAppDataSource(binding);
    return <span data-testid="key">{String(cacheKey)}</span>;
}

function renderProbe(binding) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <DataProvider appId="app_1">
                <Probe binding={binding} />
            </DataProvider>
        </QueryClientProvider>,
    );
}

describe('useAppDataSource with no binding', () => {
    it('renders inertly instead of throwing', () => {
        const { getByTestId } = renderProbe(null);
        expect(getByTestId('key').textContent).toBe('null');
    });

    it('is equally safe for undefined', () => {
        const { getByTestId } = renderProbe(undefined);
        expect(getByTestId('key').textContent).toBe('null');
    });

    it('still works for a real binding', () => {
        const { getByTestId } = renderProbe({ kind: 'records', tableId: 'tbl_1', limit: 10 });
        expect(getByTestId('key').textContent).toContain('tbl_1');
    });
});
