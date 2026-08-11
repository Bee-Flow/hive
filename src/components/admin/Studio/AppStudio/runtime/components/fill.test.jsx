import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import AppCalendar from './AppCalendar';
import AppCard from './AppCard';
import AppChart from './AppChart';
import AppContainer from './AppContainer';
import AppDataGrid from './AppDataGrid';
import AppFileGallery from './AppFileGallery';
import AppKanban from './AppKanban';
import AppTimeline from './AppTimeline';
import AppList from './AppList';
import { RuntimeProvider, DEFAULT_RUNTIME } from '../RuntimeContext';

/**
 * `height: 'fill'` per component.
 *
 * Every one of these types offers the height knob in the inspector, and every
 * one of them used to ignore 'fill' — silently. Two were actively harmful:
 * chart mapped the unknown value through `HEIGHT_MAP[h] || HEIGHT_MAP.md` and
 * rendered 200px, data_grid pinned itself at 280px, and list (the support
 * desk's sidebar) grew past its pane and was clipped by overflow-hidden.
 *
 * Two assertions per component, and the negative one matters as much: a fixed
 * height must NOT start behaving like fill, or every existing app reflows.
 */

const ROWS = [
    { id: 'r1', label: 'A', value: 3, when: '2026-08-05T10:00:00Z', status: 'open' },
    { id: 'r2', label: 'B', value: 7, when: '2026-08-06T10:00:00Z', status: 'done' },
];

const src = { kind: 'static', value: ROWS };

function node(type, props, height) {
    return { id: `cmp_${type}`, type, props, style: { span: 12, height } };
}

function renderNode(Component, n, extra = {}) {
    return render(
        <RuntimeProvider value={{ ...DEFAULT_RUNTIME, mode: 'run', ...extra }}>
            <Component node={n}>{extra.children}</Component>
        </RuntimeProvider>,
    );
}

/** The root a component hands back to its grid cell. */
const rootOf = (container) => container.firstElementChild;

const CASES = [
    {
        name: 'list',
        Component: AppList,
        props: { source: src, titleKey: 'label' },
        // The list IS the scroll region — it is an inbox sidebar.
        scrollers: 1,
    },
    {
        name: 'data_grid',
        Component: AppDataGrid,
        props: { source: src, columns: [{ key: 'label', label: 'L', format: 'text' }], pageSize: 25, selectable: 'none', searchable: true, rowActions: [], density: 'comfortable' },
        scrollers: 1,
    },
    {
        name: 'chart',
        Component: AppChart,
        props: { source: src, chartType: 'bar', xKey: 'label', series: [{ key: 'value', label: 'V' }] },
        scrollers: 0, // a chart grows, it never scrolls
    },
    {
        name: 'kanban',
        Component: AppKanban,
        props: { source: src, groupByField: 'status', titleKey: 'label', columns: [] },
        // One per COLUMN (the fixture yields two), never one on the board: a
        // board-level scrollbar would move every column at once and take the
        // headers with it.
        scrollers: 2,
    },
    {
        name: 'card',
        Component: AppCard,
        props: { title: 'T', description: null },
        scrollers: 0,
    },
    {
        name: 'container',
        Component: AppContainer,
        props: {},
        scrollers: 0,
    },
    {
        name: 'calendar',
        Component: AppCalendar,
        props: { source: src, titleKey: 'label', dateKey: 'when', view: 'month', emptyText: 'None' },
        scrollers: 1,
    },
    // Both of these offered the height knob and ignored it: the gallery passed
    // the height STRING to isFill (which takes the node, so it was always
    // false), and the timeline never read the knob at all.
    {
        name: 'file_gallery',
        Component: AppFileGallery,
        props: { source: src, nameKey: 'label' },
        scrollers: 1,
    },
    {
        name: 'timeline',
        Component: AppTimeline,
        props: { source: src, titleKey: 'label', dateKey: 'when' },
        scrollers: 1,
    },
];

describe.each(CASES)('$name honours height:fill', ({ Component, props, scrollers: expected }) => {
    it('takes the height it is given', () => {
        const { container } = renderNode(Component, node('x', props, 'fill'));
        const root = rootOf(container);
        expect(root.className).toContain('h-full');
        expect(root.className).toContain('min-h-0');
        // The shared hook the mobile stylesheet unwinds fill through.
        expect(root.className).toContain('app-fill');
    });

    it('puts the scroll region exactly where it belongs', () => {
        const { container } = renderNode(Component, node('x', props, 'fill'));
        const scrollers = container.querySelectorAll('[class*="overflow-y-auto"], [class*="overflow-auto"]');
        expect(scrollers.length).toBe(expected);
    });

    it('a fixed height is untouched', () => {
        const { container } = renderNode(Component, node('x', props, 'md'));
        expect(rootOf(container).className).not.toContain('h-full');
        expect(rootOf(container).className).not.toContain('app-fill');
    });
});

describe('chart height', () => {
    it('stops silently rendering 200px when asked to fill', () => {
        // The single worst case: 'fill' fell through HEIGHT_MAP's `|| md` and
        // became a hard 200px, so a chart in a full-height dashboard tile was
        // quietly a fifth of the size the author asked for.
        // Scoped to the chart's OWN sizing box — recharts renders its own
        // inline-sized wrappers underneath, which is not what is under test.
        const boxOf = (c) => c.querySelector('[data-app-chart] > div[class*="overflow-hidden"]');
        const props = () => ({ source: src, chartType: 'bar', xKey: 'label', series: [{ key: 'value', label: 'V' }] });

        const { container } = renderNode(AppChart, node('chart', props(), 'fill'));
        expect(boxOf(container).style.height).toBe('');
        expect(boxOf(container).className).toContain('flex-1');

        const fixed = renderNode(AppChart, node('chart', props(), 'md'));
        expect(boxOf(fixed.container).style.height).toBe('200px');
    });
});
