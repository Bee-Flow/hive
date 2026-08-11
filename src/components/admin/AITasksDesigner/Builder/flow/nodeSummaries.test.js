import { describe, it, expect } from 'vitest';
import {
    limitSummary, dedupeSummary, aggregateSummary, summarizeSummary,
    dateTimeSummary, waitSummary,
} from './nodeSummaries';
import { formatWaitDuration } from './waitDuration';

/**
 * The canvas line for the Lists and Data nodes.
 *
 * Two properties matter and neither was true before:
 *   1. It reads as English. The old lines were "by deep-equal", a bare field
 *      name in monospace, "addDays", "7200s".
 *   2. It NAMES THE LIST. Four Lists nodes hanging off one search used to read
 *      as four identical cards, so the only way to tell them apart was to open
 *      each one.
 */

const labels = new Map([['s1', 'Search email']]);
const REF = 'steps.s1.output.results';

/** Every summary either names the list, or says nothing is picked yet. */
const namesTheList = (out) => typeof out === 'string' && out.includes('Search email');

describe('list summaries name their source list', () => {
    it('every Lists node says which list it works on', () => {
        expect(namesTheList(limitSummary({ arrayRef: REF, count: 10, mode: 'first' }, { stepLabelById: labels }))).toBe(true);
        expect(namesTheList(dedupeSummary({ arrayRef: REF }, { stepLabelById: labels }))).toBe(true);
        expect(namesTheList(aggregateSummary({ arrayRef: REF, field: 'email' }, { stepLabelById: labels }))).toBe(true);
        expect(namesTheList(summarizeSummary({ arrayRef: REF, field: 'amount', op: 'sum' }, { stepLabelById: labels }))).toBe(true);
    });

    it('four Lists nodes on the same source still read differently', () => {
        const ctx = { stepLabelById: labels };
        const lines = [
            limitSummary({ arrayRef: REF, count: 10, mode: 'first' }, ctx),
            dedupeSummary({ arrayRef: REF, keyField: 'email' }, ctx),
            aggregateSummary({ arrayRef: REF, field: 'email' }, ctx),
            summarizeSummary({ arrayRef: REF, field: 'amount', op: 'sum' }, ctx),
        ];
        expect(new Set(lines).size).toBe(4);
    });

    it('says so plainly when no list is picked yet', () => {
        for (const fn of [limitSummary, dedupeSummary, aggregateSummary, summarizeSummary]) {
            expect(fn({}, {})).toEqual({ muted: 'no list picked yet' });
        }
    });
});

describe('limit', () => {
    it('reads as first or last N of the named list', () => {
        expect(limitSummary({ arrayRef: REF, count: 10, mode: 'first' }, { stepLabelById: labels })).toBe('First 10 of ‹Search email›.results');
        expect(limitSummary({ arrayRef: REF, count: 3, mode: 'last' }, { stepLabelById: labels })).toBe('Last 3 of ‹Search email›.results');
    });

    it('count 0 says nothing is kept — it does NOT read as "first 0"', () => {
        expect(limitSummary({ arrayRef: REF, count: 0, mode: 'last' }, { stepLabelById: labels })).toBe('Nothing from ‹Search email›.results');
    });
});

describe('dedupe', () => {
    it('names the field duplicates are matched on, in words', () => {
        expect(dedupeSummary({ arrayRef: REF, keyField: 'emailAddress' }, { stepLabelById: labels }))
            .toBe('One per Email address · from ‹Search email›.results');
    });

    it('never says "deep-equal" again', () => {
        const out = dedupeSummary({ arrayRef: REF }, { stepLabelById: labels });
        expect(out).toBe('Identical items removed from ‹Search email›.results');
        expect(out).not.toMatch(/equal/i);
    });
});

describe('aggregate', () => {
    it('says which field it collects, from where', () => {
        expect(aggregateSummary({ arrayRef: REF, field: 'email' }, { stepLabelById: labels }))
            .toBe('Email from every item of ‹Search email›.results');
    });

    it('asks for the field when there is none, rather than showing "no field"', () => {
        expect(aggregateSummary({ arrayRef: REF }, { stepLabelById: labels })).toEqual({ muted: 'pick which field to collect' });
    });
});

describe('summarize', () => {
    it('names the operation as a word, not an operator key', () => {
        const ctx = { stepLabelById: labels };
        expect(summarizeSummary({ arrayRef: REF, field: 'amount', op: 'sum' }, ctx)).toBe('Total of Amount · from ‹Search email›.results');
        expect(summarizeSummary({ arrayRef: REF, field: 'amount', op: 'avg' }, ctx)).toBe('Average of Amount · from ‹Search email›.results');
        expect(summarizeSummary({ arrayRef: REF, field: 'amount', op: 'min' }, ctx)).toBe('Lowest of Amount · from ‹Search email›.results');
    });

    it('count never claims to be counting a field it ignores', () => {
        const out = summarizeSummary({ arrayRef: REF, field: 'amount', op: 'count' }, { stepLabelById: labels });
        expect(out).toBe('How many items in ‹Search email›.results');
        expect(out).not.toMatch(/Amount/);
    });

    it('asks for the field when a numeric op has none', () => {
        expect(summarizeSummary({ arrayRef: REF, op: 'sum' }, {})).toEqual({ muted: 'pick which field to add up' });
    });
});

describe('date & time', () => {
    it('never shows the raw operation key', () => {
        for (const op of ['now', 'parse', 'format', 'addDays', 'addHours', 'addMinutes', 'diff', 'extract']) {
            const out = dateTimeSummary({ op, amount: 3, part: 'dayOfWeek', unit: 'days' });
            expect(typeof out).toBe('string');
            expect(out, `${op} leaked its key`).not.toBe(op);
            expect(out).not.toMatch(/addDays|addHours|addMinutes/);
        }
    });

    it('reads the amount into the sentence, and subtracts when negative', () => {
        expect(dateTimeSummary({ op: 'addDays', amount: 3 })).toBe('Add 3 days');
        expect(dateTimeSummary({ op: 'addDays', amount: 1 })).toBe('Add 1 day');
        expect(dateTimeSummary({ op: 'addHours', amount: -2 })).toBe('Subtract 2 hours');
    });

    it('names the extracted part in words', () => {
        expect(dateTimeSummary({ op: 'extract', part: 'dayOfWeek' })).toBe('Take the day of week');
        expect(dateTimeSummary({ op: 'extract', part: 'year' })).toBe('Take the year');
    });

    it('defaults to "now" and survives an unknown op from an imported definition', () => {
        expect(dateTimeSummary({})).toBe('Today’s date and time');
        expect(dateTimeSummary({ op: 'startOfWeek' })).toBe('Start of week');
    });
});

describe('wait', () => {
    it('uses the unit the editor would open on, not raw seconds', () => {
        expect(waitSummary({ seconds: 7200 })).toBe('2 hours');
        expect(waitSummary({ seconds: 3600 })).toBe('1 hour');
        expect(waitSummary({ seconds: 300 })).toBe('5 minutes');
        expect(waitSummary({ seconds: 45 })).toBe('45 seconds');
    });

    it('picks the largest unit that divides exactly, never a fraction', () => {
        expect(formatWaitDuration(5400)).toBe('90 minutes'); // not "1.5 hours"
        expect(formatWaitDuration(90)).toBe('90 seconds');   // not "1.5 minutes"
    });

    it('says nothing is set rather than showing 0s', () => {
        expect(waitSummary({})).toEqual({ muted: 'no wait set' });
        expect(waitSummary({ seconds: 0 })).toEqual({ muted: 'no wait set' });
    });
});
