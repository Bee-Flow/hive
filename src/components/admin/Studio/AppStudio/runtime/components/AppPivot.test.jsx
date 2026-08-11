import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import AppPivot from './AppPivot';
import { RuntimeProvider, buildScope, DEFAULT_RUNTIME } from '../RuntimeContext';

function withRuntime(ui, overrides = {}) {
    const value = { ...DEFAULT_RUNTIME, scope: buildScope({ now: '2020-01-01T00:00:00.000Z' }), ...overrides };
    return render(<RuntimeProvider value={value}>{ui}</RuntimeProvider>);
}

const ROWS = [
    { region: 'EU', product: 'A', amount: 10 },
    { region: 'EU', product: 'B', amount: 5 },
    { region: 'US', product: 'A', amount: 20 },
    { region: 'US', product: 'B', amount: 7 },
];

function pivotNode(overrides = {}) {
    return {
        id: 'cmp_piv', type: 'pivot', visible: true,
        props: {
            source: { kind: 'static', value: ROWS },
            rows: [{ key: 'region', label: 'Region' }],
            columns: [{ key: 'product', label: 'Product' }],
            values: [{ key: 'amount', agg: 'sum', label: 'Amount', format: 'number' }],
            showTotals: true, emptyText: 'Nothing to show yet.',
            ...overrides,
        },
        style: { span: 12 },
    };
}

describe('AppPivot', () => {
    it('renders a cross-tab with row groups and column groups', () => {
        const { getByText, getAllByText } = withRuntime(<AppPivot node={pivotNode()} />);
        expect(getByText('Region')).toBeTruthy();
        expect(getByText('EU')).toBeTruthy();
        expect(getByText('US')).toBeTruthy();
        expect(getAllByText('Total').length).toBeGreaterThan(0);
    });

    it('aggregates values (sum) into cells and row totals', () => {
        const { container } = withRuntime(<AppPivot node={pivotNode()} />);
        const text = container.textContent;
        // EU row: A=10, B=5, total=15 ; US row: A=20, B=7, total=27
        expect(text).toContain('15');
        expect(text).toContain('27');
    });

    it('shows the empty state when unbound', () => {
        const node = pivotNode({ source: { kind: 'static', value: [] } });
        const { getByText } = withRuntime(<AppPivot node={node} />);
        expect(getByText('Nothing to show yet.')).toBeTruthy();
    });

    it('falls back to an implicit count when no value fields are configured', () => {
        const node = pivotNode({ values: [], columns: [] });
        const { getByText } = withRuntime(<AppPivot node={node} />);
        expect(getByText('Count')).toBeTruthy();
    });

    it('renders in edit mode', () => {
        const { getByText } = withRuntime(<AppPivot node={pivotNode()} />, { mode: 'edit' });
        expect(getByText('EU')).toBeTruthy();
    });

    it('keeps head, body and total rows on the same columns with no row dimension', () => {
        const { container } = withRuntime(<AppPivot node={pivotNode({ rows: [] })} />);
        const heads = [...container.querySelectorAll('thead tr:first-child > *')].map((el) => el.textContent.trim());
        const rows = container.querySelectorAll('tbody tr');
        expect(heads).toEqual(['', 'A', 'B', 'Total']);
        for (const row of rows) expect(row.children.length).toBe(heads.length);
        // A = 10 + 20, B = 5 + 7 — under their OWN header, not shifted a column left.
        const cells = [...rows[0].children].map((el) => el.textContent.trim());
        expect(cells[heads.indexOf('A')]).toBe('30');
        expect(cells[heads.indexOf('B')]).toBe('12');
    });

    it('aggregates across multiple column dimensions', () => {
        const rows = [
            { region: 'EU', product: 'A', tier: 'x', amount: 1 },
            { region: 'EU', product: 'A', tier: 'y', amount: 2 },
            { region: 'EU', product: 'B', tier: 'x', amount: 4 },
        ];
        const node = pivotNode({
            source: { kind: 'static', value: rows },
            columns: [{ key: 'product' }, { key: 'tier' }],
            showTotals: false,
        });
        const { container } = withRuntime(<AppPivot node={node} />);
        const heads = [...container.querySelectorAll('thead tr:first-child > *')].map((el) => el.textContent.trim());
        const cells = [...container.querySelector('tbody tr').children].map((el) => el.textContent.trim());
        expect(heads).toEqual(['Region', 'A / x', 'A / y', 'B / x']);
        expect(cells).toEqual(['EU', '1', '2', '4']);
    });
});
