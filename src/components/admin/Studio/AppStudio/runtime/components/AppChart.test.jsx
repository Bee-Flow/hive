import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AppChart, { deriveSeries } from './AppChart';
import { dataCacheKey } from '../resolveBinding';
import { RuntimeProvider, buildScope, DEFAULT_RUNTIME } from '../RuntimeContext';

function withRuntime(ui, overrides = {}) {
    const value = { ...DEFAULT_RUNTIME, scope: buildScope({ now: '2020-01-01T00:00:00.000Z' }), ...overrides };
    return render(<RuntimeProvider value={value}>{ui}</RuntimeProvider>);
}

const BAR_ROWS = [
    { label: 'Jan', open: 5, closed: 2 },
    { label: 'Feb', open: 8, closed: 6 },
    { label: 'Mar', open: 3, closed: 9 },
];

function chartNode(overrides = {}) {
    return {
        id: 'cmp_chart', type: 'chart', visible: true,
        props: {
            chartType: 'bar',
            source: { kind: 'static', value: BAR_ROWS },
            title: 'Requests',
            xKey: 'label',
            series: [{ key: 'open', label: 'Open' }, { key: 'closed', label: 'Closed' }],
            stacked: false, showLegend: true, showGrid: true, valueFormat: 'number',
            ...overrides,
        },
        style: { span: 6, height: 'md' },
    };
}

const FORBIDDEN = [/#6366f1/i, /#7c3aed/i, /#a855f7/i, /indigo/i, /violet/i, /purple/i];

describe('AppChart', () => {
    it('renders a bar chart with series from bound data (run mode)', () => {
        const { container, getByText } = withRuntime(<AppChart node={chartNode()} />);
        expect(getByText('Requests')).toBeTruthy();
        expect(container.querySelector('svg.recharts-surface')).toBeTruthy();
        expect(container.querySelectorAll('.recharts-bar').length).toBeGreaterThan(0);
    });

    it('falls back to a sample series in edit mode when unbound (never blank)', () => {
        const node = chartNode({ source: { kind: 'static', value: [] }, series: [] });
        const { container } = withRuntime(<AppChart node={node} />, { mode: 'edit' });
        expect(container.querySelector('svg.recharts-surface')).toBeTruthy();
    });

    it('shows an empty state in run mode when unbound', () => {
        const node = chartNode({ source: { kind: 'static', value: [] }, series: [] });
        const { container, getByText } = withRuntime(<AppChart node={node} />, { mode: 'run' });
        expect(getByText('No chart data yet.')).toBeTruthy();
        expect(container.querySelector('svg.recharts-surface')).toBeNull();
    });

    it('renders line / area / pie / donut variants', () => {
        for (const chartType of ['line', 'area', 'pie', 'donut']) {
            const { container } = withRuntime(<AppChart node={chartNode({ chartType })} />);
            expect(container.querySelector('svg.recharts-surface')).toBeTruthy();
        }
    });

    it('emits no purple/indigo/violet colour', () => {
        const { container } = withRuntime(<AppChart node={chartNode()} />);
        const html = container.innerHTML;
        for (const re of FORBIDDEN) expect(re.test(html)).toBe(false);
    });
});

describe('deriveSeries', () => {
    it('keeps a column that is null in the first row and drops text columns', () => {
        const rows = [
            { label: 'Jan', owner: 'Ann', open: null, closed: 2 },
            { label: 'Feb', owner: 'Bob', open: 5, closed: 6 },
        ];
        expect(deriveSeries(rows, 'label')).toEqual([
            { key: 'open', label: 'open' },
            { key: 'closed', label: 'closed' },
        ]);
    });

    it('drops all-empty, boolean and object columns', () => {
        const rows = [{ label: 'Jan', note: null, done: true, meta: { a: 1 }, n: 3 }];
        expect(deriveSeries(rows, 'label')).toEqual([{ key: 'n', label: 'n' }]);
    });

    it('accepts numeric strings (the shape a SQL connector returns)', () => {
        expect(deriveSeries([{ label: 'Jan', amount: '12.5' }], 'label')).toEqual([{ key: 'amount', label: 'amount' }]);
    });
});

describe('AppChart width measurement', () => {
    it('measures the chart box once it EXISTS, not only on mount', () => {
        const observed = [];
        class CapturingResizeObserver {
            constructor(callback) { this.callback = callback; }
            observe(el) { observed.push(el); }
            unobserve() {}
            disconnect() {}
        }
        vi.stubGlobal('ResizeObserver', CapturingResizeObserver);
        try {
            const source = { kind: 'records', tableId: 'tbl_x' };
            const node = chartNode({ source });
            const key = dataCacheKey(source);
            const ui = (dataState) => (
                <RuntimeProvider value={{ ...DEFAULT_RUNTIME, scope: buildScope({ now: '2020-01-01T00:00:00.000Z' }), dataState }}>
                    <AppChart node={node} />
                </RuntimeProvider>
            );
            const { container, rerender } = render(ui({ [key]: { status: 'loading', result: undefined, error: null } }));
            // The measured div does not exist yet — a bound chart shows a skeleton.
            expect(container.querySelector('[data-app-chart]')).toBeNull();
            expect(observed.length).toBe(0);

            rerender(ui({ [key]: { status: 'success', result: BAR_ROWS, error: null } }));
            const wrap = container.querySelector('[data-app-chart]').lastElementChild;
            expect(observed).toEqual([wrap]);
        } finally {
            vi.unstubAllGlobals();
        }
    });
});
