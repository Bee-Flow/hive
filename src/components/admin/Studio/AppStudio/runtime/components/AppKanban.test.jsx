import { render } from '@testing-library/react';
import { act } from 'react';
import { describe, it, expect, vi } from 'vitest';

// Mock @dnd-kit/core: capture DndContext's drag callbacks so the test can fire
// synthetic drags without simulating pointer gestures (flaky in jsdom).
const captured = { onDragStart: null, onDragEnd: null, onDragCancel: null };
vi.mock('@dnd-kit/core', () => ({
    DndContext: ({ children, onDragStart, onDragEnd, onDragCancel }) => {
        captured.onDragStart = onDragStart;
        captured.onDragEnd = onDragEnd;
        captured.onDragCancel = onDragCancel;
        return <div data-dnd-context="true">{children}</div>;
    },
    // The moving copy rides in the overlay (the in-lane card is clipped by the
    // column's scroll container) — render children so tests can see it.
    DragOverlay: ({ children }) => <div data-dnd-overlay="true">{children}</div>,
    PointerSensor: function PointerSensor() {},
    // The cards announce themselves as draggable, so a keyboard user has to
    // be able to drag them — the component registers this sensor too.
    KeyboardSensor: function KeyboardSensor() {},
    pointerWithin: () => [],
    rectIntersection: () => [],
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
    { id: 'rec_1', title: 'Fix hive', status: 'open', owner: 'Ann', light: 'groen' },
    { id: 'rec_2', title: 'Order frames', status: 'open', owner: 'Bob', light: 'paars' },
    { id: 'rec_3', title: 'Paint boxes', status: 'done', owner: 'Cee', light: null },
];

const TONES = [
    { value: 'groen', label: 'Green', tone: 'success' },
    { value: 'rood', label: 'Red', tone: 'danger' },
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
        act(() => {
            captured.onDragEnd({
                active: { id: 'appkanban-card:0', data: { current: { row: ROWS[0] } } },
                over: { id: 'appkanban-col:done' },
            });
        });
        expect(runAction).toHaveBeenCalledWith('act_move01', { formValues: { item: ROWS[0], value: 'done' }, item: ROWS[0], value: 'done' });
    });

    it('drop on the SAME column (or nowhere) is a no-op', () => {
        const runAction = vi.fn();
        withRuntime(<AppKanban node={kbNode({ onCardMove: 'act_move01' })} />, { mode: 'run', runAction });
        act(() => {
            captured.onDragEnd({ active: { id: 'appkanban-card:0', data: { current: { row: ROWS[0] } } }, over: { id: 'appkanban-col:open' } });
            captured.onDragEnd({ active: { id: 'appkanban-card:0', data: { current: { row: ROWS[0] } } }, over: null });
        });
        expect(runAction).not.toHaveBeenCalled();
    });

    it('card click fires onRowClick with the row as form values', () => {
        const runAction = vi.fn();
        const { getByText } = withRuntime(
            <AppKanban node={kbNode({ onRowClick: 'act_row001' })} />,
            { mode: 'run', runAction },
        );
        getByText('Paint boxes').closest('[data-app-kanban-card]').click();
        expect(runAction).toHaveBeenCalledWith('act_row001', { formValues: ROWS[2], item: ROWS[2] });
    });

    it('the click a drop spawns does NOT open the card', () => {
        const runAction = vi.fn();
        const { getByText } = withRuntime(
            <AppKanban node={kbNode({ onRowClick: 'act_row001', onCardMove: 'act_move01' })} />,
            { mode: 'run', runAction },
        );
        act(() => {
            captured.onDragStart({ active: { id: 'appkanban-card:0', data: { current: { row: ROWS[0] } } } });
            captured.onDragEnd({ active: { id: 'appkanban-card:0', data: { current: { row: ROWS[0] } } }, over: { id: 'appkanban-col:open' } });
        });
        // The browser's synthetic click lands synchronously after pointerup —
        // before the guard's macrotask reset — so this click must be swallowed.
        getByText('Fix hive').closest('[data-app-kanban-card]').click();
        expect(runAction).not.toHaveBeenCalled();
    });

    it('shows the drag overlay copy while a drag is live', () => {
        const { getAllByText } = withRuntime(
            <AppKanban node={kbNode({ onCardMove: 'act_move01' })} />,
            { mode: 'run', runAction: vi.fn() },
        );
        act(() => {
            captured.onDragStart({ active: { id: 'appkanban-card:0', data: { current: { row: ROWS[0] } } } });
        });
        // The overlay is PORTALED to document.body (a transformed ancestor in
        // the builder chrome would otherwise re-anchor its fixed position and
        // float the copy away from the cursor) — query the document, not the
        // render container.
        expect(document.querySelector('[data-app-kanban-overlay]')).toBeTruthy();
        expect(getAllByText('Fix hive').length).toBe(2); // in-lane card + overlay copy
        act(() => {
            captured.onDragCancel();
        });
        expect(document.querySelector('[data-app-kanban-overlay]')).toBeNull();
    });

    it('a badge value the tone map covers renders as a coloured dot, not text', () => {
        const { container, queryByText } = withRuntime(
            <AppKanban node={kbNode({}, { badgeKey: 'light', badgeToneMap: TONES })} />,
        );
        const dot = container.querySelector('[data-app-kanban-dot]');
        expect(dot).toBeTruthy();
        expect(dot.getAttribute('data-app-kanban-dot')).toBe('success');
        expect(dot.getAttribute('title')).toBe('Green');
        expect(queryByText('groen')).toBeNull(); // the word never renders
    });

    it('a badge value OUTSIDE the tone map keeps the text pill', () => {
        const { container, getByText } = withRuntime(
            <AppKanban node={kbNode({}, { badgeKey: 'light', badgeToneMap: TONES })} />,
        );
        expect(getByText('paars')).toBeTruthy(); // unmapped → visible as text
        expect(container.querySelectorAll('[data-app-kanban-dot]').length).toBe(1);
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
