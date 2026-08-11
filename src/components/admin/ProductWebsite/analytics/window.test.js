import { describe, it, expect } from 'vitest';
import {
    resolveWindow, previousWindow, parseBucket, floorTo, bucketKeys,
    densify, alignSeries, bucketLabel, lastBucketPartial,
} from './window';

const DAY = 86_400_000;
const at = (iso) => Date.parse(iso);

describe('parseBucket', () => {
    it('reads Umami\'s timezone-less wall-clock stamps deterministically', () => {
        // "2026-07-27 13:00:00" has no zone marker and is ALREADY in the tz we
        // asked for. Date.parse would guess, and guess differently per engine.
        expect(parseBucket('2026-07-27 13:00:00')).toBe(Date.UTC(2026, 6, 27, 13, 0, 0));
        expect(parseBucket('2026-07-27T13:00:00Z')).toBe(Date.UTC(2026, 6, 27, 13, 0, 0));
    });

    it('passes through numbers and Dates', () => {
        expect(parseBucket(1700)).toBe(1700);
        expect(parseBucket(new Date(1700))).toBe(1700);
    });

    it('is NaN for junk rather than silently zero', () => {
        expect(Number.isNaN(parseBucket('not a date'))).toBe(true);
    });
});

describe('bucketKeys', () => {
    it('walks calendar days, so a DST transition cannot skip or duplicate one', () => {
        // Europe/Amsterdam springs forward on 2026-03-29. Adding 86_400_000ms
        // repeatedly across that boundary drifts; calendar arithmetic does not.
        const w = { startAt: at('2026-03-27T00:00:00Z'), endAt: at('2026-03-31T00:00:00Z'), unit: 'day' };
        const keys = bucketKeys(w);
        expect(keys).toHaveLength(5);
        expect(keys.map(k => new Date(k).toISOString().slice(0, 10)))
            .toEqual(['2026-03-27', '2026-03-28', '2026-03-29', '2026-03-30', '2026-03-31']);
    });

    it('produces one bucket per hour for an hourly window', () => {
        const w = { startAt: at('2026-07-27T10:00:00Z'), endAt: at('2026-07-27T13:30:00Z'), unit: 'hour' };
        expect(bucketKeys(w)).toHaveLength(4);
    });

    it('does not spin on an absurd custom range', () => {
        const w = { startAt: 0, endAt: Date.UTC(2200, 0, 1), unit: 'day' };
        expect(bucketKeys(w).length).toBeLessThanOrEqual(5000);
    });
});

describe('densify', () => {
    const w = { startAt: at('2026-07-21T00:00:00Z'), endAt: at('2026-07-27T00:00:00Z'), unit: 'day' };

    it('fills the whole window, not just the days that had traffic', () => {
        // This is the bug: Umami returns ONLY non-empty buckets, so a 7-day
        // range on a site busy for one day came back as a single point and the
        // chart drew a flat line with the same label at both ends.
        const out = densify([{ x: '2026-07-27 00:00:00', y: 20 }], w);
        expect(out).toHaveLength(7);
        expect(out.map(p => p.value)).toEqual([0, 0, 0, 0, 0, 0, 20]);
    });

    it('sums several points that land in the same bucket', () => {
        const out = densify([
            { x: '2026-07-27 01:00:00', y: 3 },
            { x: '2026-07-27 18:00:00', y: 4 },
        ], w);
        expect(out.at(-1).value).toBe(7);
    });

    it('leaves percentile gaps null — a day with no samples is not 0ms', () => {
        // Zero-filling a percentile would recreate exactly the "0 ms is
        // perfect" lie the Performance tab is being fixed to stop telling.
        const out = densify([{ x: '2026-07-27 00:00:00', y: 1580 }], w, { fill: null });
        expect(out.slice(0, 6).every(p => p.value === null)).toBe(true);
        expect(out.at(-1).value).toBe(1580);
    });

    it('survives an empty or malformed series', () => {
        expect(densify([], w)).toHaveLength(7);
        expect(densify(null, w).every(p => p.value === 0)).toBe(true);
        expect(densify([{ x: 'junk', y: 5 }], w).every(p => p.value === 0)).toBe(true);
    });
});

describe('alignSeries', () => {
    it('pairs each bucket with the same offset in the previous period', () => {
        const cur = [{ t: 1, value: 10 }, { t: 2, value: 20 }];
        const prev = [{ t: 0, value: 5 }, { t: 1, value: 6 }];
        expect(alignSeries(cur, prev)).toEqual([
            { t: 1, value: 10, previous: 5 },
            { t: 2, value: 20, previous: 6 },
        ]);
    });

    it('is null rather than 0 where the previous period is shorter', () => {
        expect(alignSeries([{ t: 1, value: 10 }], [])[0].previous).toBeNull();
    });
});

describe('resolveWindow / previousWindow', () => {
    it('maps range tokens the way the server does', () => {
        expect(resolveWindow({ range: '24h' }).unit).toBe('hour');
        expect(resolveWindow({ range: '7d' }).unit).toBe('day');
        expect(resolveWindow({}).unit).toBe('day');
    });

    it('honours a valid custom window and picks the unit from its span', () => {
        const w = resolveWindow({ range: 'custom', start: 1000, end: 1000 + DAY });
        expect(w).toMatchObject({ startAt: 1000, endAt: 1000 + DAY, unit: 'hour' });
        expect(resolveWindow({ range: 'custom', start: 0, end: 5 * DAY }).unit).toBe('day');
    });

    it('falls back rather than producing a backwards window', () => {
        const w = resolveWindow({ range: 'custom', start: 500, end: 100 });
        expect(w.endAt).toBeGreaterThan(w.startAt);
    });

    it('previousWindow is the same length, immediately before', () => {
        const w = { startAt: 1000, endAt: 1000 + 7 * DAY, unit: 'day' };
        expect(previousWindow(w)).toEqual({ startAt: 1000 - 7 * DAY, endAt: 1000, unit: 'day' });
    });
});

describe('labels and partial buckets', () => {
    it('labels at the unit\'s own resolution', () => {
        const t = Date.UTC(2026, 6, 27, 13, 5);
        expect(bucketLabel(t, 'day')).toBe('27 Jul');
        expect(bucketLabel(t, 'hour')).toBe('27 Jul 13:00');
        expect(bucketLabel(t, 'minute')).toBe('13:05');
    });

    it('flags a window whose last bucket is still filling up', () => {
        // Today's partial day looks like a cliff at the right edge otherwise.
        expect(lastBucketPartial({ endAt: Date.now(), unit: 'day' })).toBe(true);
        expect(lastBucketPartial({ endAt: at('2020-01-01T00:00:00Z'), unit: 'day' })).toBe(false);
    });

    it('floorTo snaps to the start of the bucket', () => {
        const t = Date.UTC(2026, 6, 27, 13, 47, 12);
        expect(floorTo(t, 'day')).toBe(Date.UTC(2026, 6, 27));
        expect(floorTo(t, 'hour')).toBe(Date.UTC(2026, 6, 27, 13));
        expect(floorTo(t, 'minute')).toBe(Date.UTC(2026, 6, 27, 13, 47));
    });
});
