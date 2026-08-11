import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

// Mock @dnd-kit/core: capture DndContext's onDragEnd so the test can fire a
// synthetic drop without simulating pointer gestures (flaky in jsdom).
const captured = { onDragEnd: null };
vi.mock('@dnd-kit/core', () => ({
    DndContext: ({ children, onDragEnd }) => {
        captured.onDragEnd = onDragEnd;
        return <div data-dnd-context="true">{children}</div>;
    },
    PointerSensor: function PointerSensor() {},
    // The cards announce themselves as draggable, so a keyboard user has to
    // be able to drag them — the component registers this sensor too.
    KeyboardSensor: function KeyboardSensor() {},
    useSensor: () => null,
    useSensors: (...sensors) => sensors,
    useDraggable: () => ({ attributes: {}, listeners: {}, setNodeRef: () => {}, transform: null, isDragging: false }),
    useDroppable: () => ({ setNodeRef: () => {}, isOver: false }),
}));

const { default: AppKanban, kanbanColumns } = await import('./AppKanban');
const { RuntimeProvider, buildScope, DEFAULT_RUNTIME } = await import('../RuntimeContext');

function withRuntime(ui, overrides = {}) {
    const value = { ...DEFAULT_RUNTIME, scope: buildScope({ now: '2026-01-01T00:00:00.000Z' }), ...overrides };
    return render(<RuntimeProvider value={value}>{ui}</RuntimeProvider>);
}

const ROWS = [
    { id: 'rec_1', title: 'Fix hive', status: 'open', owner: 'Ann' },
    { id: 'rec_2', title: 'Order frames', status: 'open', owner: 'Bob' },
    { id: 'rec_3', title: 'Paint boxes', status: 'done', owner: 'Cee' },
];

function kbNode(extra = {}, props = {}) {
    return {
        id: 'cmp_kb', type: 'kanban', visible: true,
        props: {
            source: { kind: 'static', value: ROWS },
            groupByField: 'status',
            columns: [
                { value: 'open', label: 'Open', color: 'info' },
                { value: 'done', label: 'Done', color: 'success' },
            ],
            titleKey: 'title', subtitleKey: 'owner', badgeKey: null, allowDrag: true,
            ...props,
        },
        style: { span: 12 },
        ...extra,
    };
}

describe('kanbanColumns', () => {
    it('keeps the configured order, labels and colours', () => {
        expect(kanbanColumns(
            [{ value: 'done', label: 'Done', color: 'success' }, { value: 'open', label: 'Open', color: 'info' }],
            ROWS,
            'status',
        )).toEqual([
            { value: 'done', label: 'Done', color: 'success' },
            { value: 'open', label: 'Open', color: 'info' },
        ]);
    });
    it('appends a column for every value the configured list misses', () => {
        expect(kanbanColumns([{ value: 'a', label: 'A', color: 'info' }], ROWS, 'status'))
            .toEqual([
                { value: 'a', label: 'A', color: 'info' },
                { value: 'open', label: 'open', color: null },
                { value: 'done', label: 'done', color: null },
            ]);
    });
    it('derives distinct columns from the rows when unconfigured', () => {
        expect(kanbanColumns([], ROWS, 'status')).toEqual([
            { value: 'open', label: 'open', color: null },
            { value: 'done', label: 'done', color: null },
        ]);
    });
});

describe('AppKanban', () => {
    it('groups cards into columns with counts', () => {
        const { container, getByText } = withRuntime(<AppKanban node={kbNode()} />);
        const openCol = container.querySelector('[data-app-kanban-column="open"]');
        const doneCol = container.querySelector('[data-app-kanban-column="done"]');
        expect(openCol.querySelectorAll('[data-app-kanban-card]').length).toBe(2);
        expect(doneCol.querySelectorAll('[data-app-kanban-card]').length).toBe(1);
        expect(getByText('Fix hive')).toBeTruthy();
        expect(getByText('Ann')).toBeTruthy(); // subtitle
    });

    it('drop on another column fires onCardMove with { item, value } as form values', () => {
        const runAction = vi.fn();
        withRuntime(<AppKanban node={kbNode({ onCardMove: 'act_move01' })} />, { mode: 'run', runAction });
        expect(typeof captured.onDragEnd).toBe('function');
        captured.onDragEnd({
            active: { id: 'appkanban-card:0', data: { current: { row: ROWS[0] } } },
            over: { id: 'appkanban-col:done' },
        });
        expect(runAction).toHaveBeenCalledWith('act_move01', { formValues: { item: ROWS[0], value: 'done' } });
    });

    it('drop on the SAME column (or nowhere) is a no-op', () => {
        const runAction = vi.fn();
        withRuntime(<AppKanban node={kbNode({ onCardMove: 'act_move01' })} />, { mode: 'run', runAction });
        captured.onDragEnd({ active: { id: 'appkanban-card:0', data: { current: { row: ROWS[0] } } }, over: { id: 'appkanban-col:open' } });
        captured.onDragEnd({ active: { id: 'appkanban-card:0', data: { current: { row: ROWS[0] } } }, over: null });
        expect(runAction).not.toHaveBeenCalled();
    });

    it('card click fires onRowClick with the row as form values', () => {
        const runAction = vi.fn();
        const { getByText } = withRuntime(
            <AppKanban node={kbNode({ onRowClick: 'act_row001' })} />,
            { mode: 'run', runAction },
        );
        getByText('Paint boxes').closest('[data-app-kanban-card]').click();
        expect(runAction).toHaveBeenCalledWith('act_row001', { formValues: ROWS[2] });
    });

    it('derives columns from the data when props.columns is empty', () => {
        const { container } = withRuntime(<AppKanban node={kbNode({}, { columns: [] })} />);
        expect(container.querySelectorAll('[data-app-kanban-column]').length).toBe(2);
    });

    it('surfaces cards whose group value matches no configured column', () => {
        const rows = [...ROWS, { id: 'rec_4', title: 'Legacy task', status: 'archived', owner: 'Dee' }];
        const { container, getByText } = withRuntime(
            <AppKanban node={kbNode({}, { source: { kind: 'static', value: rows } })} />,
        );
        expect(getByText('Legacy task')).toBeTruthy();
        const extra = container.querySelector('[data-app-kanban-column="archived"]');
        expect(extra).toBeTruthy();
        expect(extra.querySelectorAll('[data-app-kanban-card]').length).toBe(1);
    });

    it('surfaces cards with an empty group value under (none)', () => {
        const rows = [...ROWS, { id: 'rec_5', title: 'Unsorted', status: null, owner: 'Eve' }];
        const { container, getByText } = withRuntime(
            <AppKanban node={kbNode({}, { source: { kind: 'static', value: rows } })} />,
        );
        expect(getByText('Unsorted')).toBeTruthy();
        expect(getByText('(none)')).toBeTruthy();
        expect(container.querySelector('[data-app-kanban-column=""]')).toBeTruthy();
    });
});
