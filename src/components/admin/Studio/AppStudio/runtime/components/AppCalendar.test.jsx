import { fireEvent, render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AppCalendar, { bucketEvents } from './AppCalendar';
import { RuntimeProvider, buildScope, DEFAULT_RUNTIME } from '../RuntimeContext';

function withRuntime(ui, overrides = {}) {
    const value = { ...DEFAULT_RUNTIME, scope: buildScope({ now: '2026-03-01T00:00:00.000Z' }), ...overrides };
    return render(<RuntimeProvider value={value}>{ui}</RuntimeProvider>);
}

const ROWS = [
    { id: 'e1', title: 'Kickoff', due: '2026-03-03' },
    { id: 'e2', title: 'Retro', due: '2026-03-27' },
    { id: 'e3', title: 'Sprint', due: '2026-03-10', until: '2026-03-12' },
    { id: 'e4', title: 'Dateless', due: null },
];

function calNode(props = {}, extra = {}) {
    return {
        id: 'cmp_cal', type: 'calendar', visible: true,
        props: {
            source: { kind: 'static', value: ROWS }, dateKey: 'due', endDateKey: null,
            titleKey: 'title', colorKey: null, view: 'month', emptyText: 'No events yet.',
            ...props,
        },
        style: { span: 12 },
        ...extra,
    };
}

describe('bucketEvents', () => {
    it('buckets rows by local day and expands endDateKey spans', () => {
        const buckets = bucketEvents(ROWS, 'due', 'until');
        expect(buckets.get('2026-03-03').length).toBe(1);
        expect(buckets.get('2026-03-10').length).toBe(1);
        expect(buckets.get('2026-03-11').length).toBe(1);
        expect(buckets.get('2026-03-12').length).toBe(1);
        expect(buckets.has('2026-03-13')).toBe(false);
        // invalid dates are skipped entirely
        expect([...buckets.values()].flat().some((e) => e.row.id === 'e4')).toBe(false);
    });

    it('treats an end date before the start as a single day', () => {
        const buckets = bucketEvents([{ due: '2026-03-05', until: '2026-03-01', title: 'x' }], 'due', 'until');
        expect(buckets.get('2026-03-05').length).toBe(1);
        expect(buckets.size).toBe(1);
    });
});

describe('AppCalendar — month view', () => {
    it('anchors on the first event month and places events in their day cells', () => {
        const { container } = withRuntime(<AppCalendar node={calNode()} />);
        expect(container.querySelector('[data-app-calendar="month"]')).toBeTruthy();
        const heading = container.querySelector('[data-app-calendar-heading]').textContent;
        expect(heading).toMatch(/2026/);
        const day3 = container.querySelector('[data-app-calendar-day="2026-03-03"]');
        expect(day3.textContent).toContain('Kickoff');
        const day27 = container.querySelector('[data-app-calendar-day="2026-03-27"]');
        expect(day27.textContent).toContain('Retro');
        // multi-day span (endDateKey) fills every covered cell
        const spanNode = calNode({ endDateKey: 'until' });
        const spanned = withRuntime(<AppCalendar node={spanNode} />).container;
        for (const key of ['2026-03-10', '2026-03-11', '2026-03-12']) {
            expect(spanned.querySelector(`[data-app-calendar-day="${key}"]`).textContent).toContain('Sprint');
        }
    });

    it('prev/next move the month grid', () => {
        const { container, getByLabelText } = withRuntime(<AppCalendar node={calNode()} />);
        fireEvent.click(getByLabelText('Next month'));
        expect(container.querySelector('[data-app-calendar-day="2026-04-01"]')).toBeTruthy();
        fireEvent.click(getByLabelText('Previous month'));
        expect(container.querySelector('[data-app-calendar-day="2026-03-03"]')).toBeTruthy();
    });

    it('event chip click fires onRowClick with the row (run mode)', () => {
        const runAction = vi.fn();
        const { container } = withRuntime(
            <AppCalendar node={calNode({}, { onRowClick: 'act_row001' })} />,
            { mode: 'run', runAction },
        );
        const chip = container.querySelector('[data-app-calendar-day="2026-03-03"] [data-app-calendar-event]');
        fireEvent.click(chip);
        // The row goes out as `item` too — that is the name every picker and
        // template teaches for it, and navigate params read `item.<field>`.
        expect(runAction).toHaveBeenCalledWith('act_row001', { formValues: ROWS[0], item: ROWS[0] });
    });
});

describe('AppCalendar — list & week views', () => {
    it('list view renders a date-sorted agenda (cheap fallback)', () => {
        const { container } = withRuntime(<AppCalendar node={calNode({ view: 'list' })} />);
        const list = container.querySelector('[data-app-calendar="list"]');
        expect(list).toBeTruthy();
        const titles = [...list.querySelectorAll('li')].map((li) => li.textContent);
        expect(titles.length).toBe(3); // dateless row dropped
        expect(titles[0]).toContain('Kickoff');
        expect(titles[1]).toContain('Sprint');
        expect(titles[2]).toContain('Retro');
    });

    it('week view renders exactly 7 day cells around the anchor', () => {
        const { container } = withRuntime(<AppCalendar node={calNode({ view: 'week' })} />);
        expect(container.querySelector('[data-app-calendar="week"]')).toBeTruthy();
        expect(container.querySelectorAll('[data-app-calendar-day]').length).toBe(7);
        expect(container.querySelector('[data-app-calendar-day="2026-03-03"]').textContent).toContain('Kickoff');
    });

    it('shows emptyText with no rows', () => {
        const { getByText } = withRuntime(<AppCalendar node={calNode({ source: { kind: 'static', value: [] } })} />);
        expect(getByText('No events yet.')).toBeTruthy();
    });
});

/**
 * A vitest worker ignores process.env.TZ (worker threads never re-run tzset),
 * so a westward zone is simulated where the bug actually lives: how a date
 * STRING parses. A UTC-midnight instant read by a UTC-8 reader reports the
 * PREVIOUS day; component-wise construction (new Date(y, m, d)) is untouched.
 */
function asWesternReader(fn) {
    const RealDate = Date;
    class WesternDate extends RealDate {
        constructor(...args) {
            if (args.length === 1 && typeof args[0] === 'string') {
                const t = RealDate.parse(args[0]);
                super(Number.isNaN(t) ? NaN : t - 8 * 60 * 60 * 1000);
                return;
            }
            super(...args);
        }
    }
    vi.stubGlobal('Date', WesternDate);
    try { return fn(); } finally { vi.unstubAllGlobals(); }
}

describe('AppCalendar — local-date arithmetic', () => {
    it('buckets a date-only string on its own calendar day west of Greenwich', () => {
        const buckets = asWesternReader(() => bucketEvents([{ due: '2026-03-03', title: 'Kickoff' }], 'due', null));
        expect([...buckets.keys()]).toEqual(['2026-03-03']);
    });

    it('still dates a zoned instant by the local day it falls on', () => {
        // A timestamp is an INSTANT, not a calendar date — the date-only rule
        // must not swallow it and pin it to its UTC day.
        const iso = '2026-03-03T12:00:00Z';
        const local = new Date(iso);
        const key = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(local.getDate()).padStart(2, '0')}`;
        const buckets = bucketEvents([{ due: iso, title: 'Late' }], 'due', null);
        expect([...buckets.keys()]).toEqual([key]);
    });

    // The two DST cases below only discriminate on a box whose zone observes
    // DST (they pass trivially under TZ=UTC); Oct 25 2026 is the European
    // fall-back, where a fixed 24h step lands back on the previous date.
    it('spans an event across a DST change without losing a day', () => {
        const buckets = bucketEvents([{ due: '2026-10-24', until: '2026-10-27', title: 'Harvest' }], 'due', 'until');
        expect([...buckets.keys()]).toEqual(['2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27']);
    });

    it('builds a month grid of 42 distinct days across a DST change', () => {
        const node = calNode({ source: { kind: 'static', value: [{ id: 'e1', title: 'Autumn', due: '2026-10-01' }] } });
        const { container } = withRuntime(<AppCalendar node={node} />);
        const keys = [...container.querySelectorAll('[data-app-calendar-day]')]
            .map((el) => el.getAttribute('data-app-calendar-day'));
        expect(keys.length).toBe(42);
        expect(new Set(keys).size).toBe(42);
        expect(keys[0]).toBe('2026-09-28');
        expect(keys[41]).toBe('2026-11-08');
    });
});
