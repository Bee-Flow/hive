import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import AppRecordDetail from './AppRecordDetail';
import { RuntimeProvider, buildScope, DEFAULT_RUNTIME } from '../RuntimeContext';

function withRuntime(ui, overrides = {}) {
    const value = { ...DEFAULT_RUNTIME, scope: buildScope({ now: '2026-01-01T00:00:00.000Z' }), ...overrides };
    return render(<RuntimeProvider value={value}>{ui}</RuntimeProvider>);
}

const RECORD = {
    id: 'rec_1',
    name: 'Beehive audit',
    amount: 12345.6,
    due: '2026-02-01',
    status: 'open',
    site: 'https://example.com/x',
    notes: 'Some **bold** notes',
    created_at: '2026-01-01T10:00:00Z',
};

function rdNode(props = {}) {
    return {
        id: 'cmp_rd', type: 'record_detail', visible: true,
        props: {
            source: { kind: 'static', value: RECORD },
            fields: [
                { key: 'name', label: 'Name', format: 'text' },
                { key: 'amount', label: 'Amount', format: 'number' },
                { key: 'due', label: 'Due', format: 'date' },
                { key: 'status', label: 'Status', format: 'badge' },
                { key: 'site', label: 'Site', format: 'link' },
                { key: 'notes', label: 'Notes', format: 'markdown' },
            ],
            columns: 2,
            emptyText: 'No record selected.',
            ...props,
        },
        style: { span: 12 },
    };
}

describe('AppRecordDetail', () => {
    it('renders each field with its format', () => {
        const { container, getByText } = withRuntime(<AppRecordDetail node={rdNode()} />);
        // text
        expect(getByText('Beehive audit')).toBeTruthy();
        // number → localized
        expect(getByText((12345.6).toLocaleString())).toBeTruthy();
        // date → localized date
        expect(getByText(new Date('2026-02-01').toLocaleDateString())).toBeTruthy();
        // badge → pill
        expect(getByText('open').className).toContain('rounded-full');
        // link → anchor with safe rel
        const a = container.querySelector('a[href="https://example.com/x"]');
        expect(a).toBeTruthy();
        expect(a.getAttribute('rel')).toContain('noopener');
        // markdown → inline bold
        expect(container.querySelector('strong').textContent).toBe('bold');
        // 2-column grid
        const dl = container.querySelector('[data-app-recorddetail]');
        expect(dl.style.gridTemplateColumns).toBe('repeat(2, minmax(0, 1fr))');
    });

    it('derives fields from the record keys (minus system columns) when fields is empty', () => {
        const { getByText, queryByText } = withRuntime(<AppRecordDetail node={rdNode({ fields: [] })} />);
        expect(getByText('name')).toBeTruthy();
        expect(getByText('amount')).toBeTruthy();
        expect(queryByText('created_at')).toBeNull();
        expect(queryByText('id')).toBeNull();
    });

    it('takes the first row of an array source and em-dashes missing values', () => {
        const nodeArr = rdNode({
            source: { kind: 'static', value: [{ name: 'First' }, { name: 'Second' }] },
            fields: [{ key: 'name', label: 'Name', format: 'text' }, { key: 'missing', label: 'Gone', format: 'text' }],
        });
        const { getByText, queryByText } = withRuntime(<AppRecordDetail node={nodeArr} />);
        expect(getByText('First')).toBeTruthy();
        expect(queryByText('Second')).toBeNull();
        expect(getByText('—')).toBeTruthy();
    });

    it('shows emptyText when the binding resolves to nothing', () => {
        const { getByText } = withRuntime(<AppRecordDetail node={rdNode({ source: { kind: 'static', value: null } })} />);
        expect(getByText('No record selected.')).toBeTruthy();
    });
});
