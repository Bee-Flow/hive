import { describe, it, expect } from 'vitest';
import {
    resolveWhen, advanceByRepeat, describeMoment, describeSchedule,
    buildCoworkPayload, titleFromBrief, toDateInput, toTimeInput,
} from './coworkSchedule';

// Fixed reference point: Wednesday 12 Aug 2026, 14:30 local.
const NOW = new Date(2026, 7, 12, 14, 30, 0);

describe('resolveWhen', () => {
    it('returns the current moment for "now"', () => {
        expect(resolveWhen('now', { now: NOW }).getTime()).toBe(NOW.getTime());
    });

    it('adds an hour for "in_1h"', () => {
        expect(resolveWhen('in_1h', { now: NOW }).getTime()).toBe(NOW.getTime() + 3600_000);
    });

    it('puts "tonight" at 18:00 the same day when it has not passed', () => {
        const d = resolveWhen('tonight', { now: NOW });
        expect(d.getDate()).toBe(12);
        expect(d.getHours()).toBe(18);
        expect(d.getMinutes()).toBe(0);
    });

    it('rolls "tonight" to the next day once 18:00 has passed', () => {
        const late = new Date(2026, 7, 12, 21, 0, 0);
        const d = resolveWhen('tonight', { now: late });
        expect(d.getDate()).toBe(13);
        expect(d.getHours()).toBe(18);
    });

    it('puts "tomorrow" at 09:00 the next day', () => {
        const d = resolveWhen('tomorrow', { now: NOW });
        expect(d.getDate()).toBe(13);
        expect(d.getHours()).toBe(9);
    });

    it('lands "next_week" on the coming Monday at 09:00', () => {
        const d = resolveWhen('next_week', { now: NOW });
        expect(d.getDay()).toBe(1);
        expect(d.getDate()).toBe(17);
        expect(d.getHours()).toBe(9);
    });

    it('never returns "today" for next_week when today IS Monday', () => {
        const monday = new Date(2026, 7, 17, 8, 0, 0);
        const d = resolveWhen('next_week', { now: monday });
        expect(d.getDate()).toBe(24);
    });

    it('resolves a custom date+time, and null while either half is missing', () => {
        expect(resolveWhen('custom', { now: NOW, date: '2026-09-01', time: '07:15' }).getHours()).toBe(7);
        expect(resolveWhen('custom', { now: NOW, date: '2026-09-01', time: '' })).toBeNull();
        expect(resolveWhen('custom', { now: NOW, date: '', time: '07:15' })).toBeNull();
    });
});

describe('advanceByRepeat', () => {
    it('advances the calendar intervals', () => {
        expect(advanceByRepeat(NOW, 'daily').getDate()).toBe(13);
        expect(advanceByRepeat(NOW, 'weekly').getDate()).toBe(19);
        expect(advanceByRepeat(NOW, 'biweekly').getDate()).toBe(26);
        expect(advanceByRepeat(NOW, 'monthly').getMonth()).toBe(8);
        expect(advanceByRepeat(NOW, 'quarterly').getMonth()).toBe(10);
    });

    it('skips the weekend for "weekdays"', () => {
        const friday = new Date(2026, 7, 14, 9, 0, 0);
        expect(advanceByRepeat(friday, 'weekdays').getDay()).toBe(1);
    });

    it('returns null when there is no repeat', () => {
        expect(advanceByRepeat(NOW, '')).toBeNull();
        expect(advanceByRepeat(NOW, null)).toBeNull();
    });
});

describe('describeMoment / describeSchedule', () => {
    it('says Today / Tomorrow for near dates', () => {
        expect(describeMoment(new Date(2026, 7, 12, 18, 0), { now: NOW })).toMatch(/^Today at/);
        expect(describeMoment(new Date(2026, 7, 13, 9, 0), { now: NOW })).toMatch(/^Tomorrow at/);
    });

    it('summarises a one-off run-now as "Now"', () => {
        expect(describeSchedule({ presetId: 'now', repeatInterval: '' }, { now: NOW })).toBe('Now');
    });

    it('summarises a repeating run-now with its cadence', () => {
        expect(describeSchedule({ presetId: 'now', repeatInterval: 'weekly' }, { now: NOW }))
            .toBe('Now, then every week');
    });

    it('asks for a moment when a custom schedule is unresolved', () => {
        expect(describeSchedule({ presetId: 'custom', runAt: null, repeatInterval: '' }, { now: NOW }))
            .toBe('Pick a moment');
    });
});

describe('buildCoworkPayload', () => {
    const base = { title: 'Weekly digest', prompt: 'Summarise the week', repeatInterval: '', agentId: '' };

    it('flags startNow and schedules at "now" for a one-off', () => {
        const p = buildCoworkPayload({ ...base, presetId: 'now' }, { now: NOW, timezone: 'Europe/Amsterdam' });
        expect(p.startNow).toBe(true);
        expect(new Date(p.nextRunAt).getTime()).toBe(NOW.getTime());
        expect(p.repeatInterval).toBeNull();
        expect(p.timezone).toBe('Europe/Amsterdam');
    });

    it('points a repeating run-now at the NEXT occurrence so the series does not double-fire', () => {
        const p = buildCoworkPayload({ ...base, presetId: 'now', repeatInterval: 'weekly' }, { now: NOW });
        expect(p.startNow).toBe(true);
        expect(new Date(p.nextRunAt).getTime()).toBe(NOW.getTime() + 7 * 24 * 3600_000);
    });

    it('omits startNow for a scheduled item', () => {
        const p = buildCoworkPayload({ ...base, presetId: 'tomorrow' }, { now: NOW });
        expect(p.startNow).toBeUndefined();
        expect(new Date(p.nextRunAt).getHours()).toBe(9);
    });

    it('only sends agentId when one is picked', () => {
        expect(buildCoworkPayload({ ...base, presetId: 'now' }, { now: NOW }).agentId).toBeUndefined();
        expect(buildCoworkPayload({ ...base, presetId: 'now', agentId: 'a1' }, { now: NOW }).agentId).toBe('a1');
    });

    it('returns null when the schedule is not resolvable yet', () => {
        expect(buildCoworkPayload({ ...base, presetId: 'custom', date: '', time: '' }, { now: NOW })).toBeNull();
    });
});

describe('titleFromBrief', () => {
    it('uses the first non-empty line', () => {
        expect(titleFromBrief('\n\nSend the weekly digest\nwith links')).toBe('Send the weekly digest');
    });

    it('strips list/markdown noise', () => {
        expect(titleFromBrief('- Send the digest')).toBe('Send the digest');
        expect(titleFromBrief('## Send the digest')).toBe('Send the digest');
    });

    it('truncates on a word boundary', () => {
        const t = titleFromBrief('a'.repeat(10) + ' ' + 'b'.repeat(80), { maxLength: 30 });
        expect(t.length).toBeLessThanOrEqual(31);
        expect(t.endsWith('…')).toBe(true);
    });

    it('falls back rather than producing an empty title', () => {
        expect(titleFromBrief('   ')).toBe('Untitled cowork');
        expect(titleFromBrief('###')).toBe('Untitled cowork');
    });
});

describe('input formatters', () => {
    it('emits the shapes <input type="date"|"time"> expect', () => {
        expect(toDateInput(NOW)).toBe('2026-08-12');
        expect(toTimeInput(NOW)).toBe('14:30');
    });
});
