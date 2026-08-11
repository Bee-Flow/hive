import { describe, expect, it } from 'vitest';
import { boolValue, cellText, dateInputValue, listValue, optionPairs } from './rowValues';

/**
 * Rows come back as SQLite holds them. These tests pin the three shapes that
 * would otherwise reach the user raw: a yes/no as 0/1, a multi-select as a JSON
 * string, and a date as a stamp that must NOT be pushed through a time zone.
 */

describe('rowValues', () => {
    it('reads a yes/no back out of the 0/1 the column stores', () => {
        expect(boolValue(1)).toBe(true);
        expect(boolValue(0)).toBe(false);
        expect(cellText(0, { type: 'bool' })).toBe('No');
        expect(cellText(1, { type: 'bool' })).toBe('Yes');
    });

    it('shows a multi-select as its choices, never as the JSON it is stored in', () => {
        expect(listValue('["a","b"]')).toEqual(['a', 'b']);
        expect(cellText('["Open","Urgent"]', { type: 'multiselect' })).toBe('Open, Urgent');
    });

    it('shows a date exactly as stored, so no viewer sees the day before', () => {
        expect(cellText('2026-03-14', { type: 'date' })).toBe('2026-03-14');
        expect(cellText('2026-03-14T09:30', { type: 'datetime' })).toBe('2026-03-14 09:30');
        expect(dateInputValue('2026-03-14T09:30:00', 'datetime')).toBe('2026-03-14T09:30');
        expect(dateInputValue('2026-03-14', 'date')).toBe('2026-03-14');
    });

    it('shows a choice by its label and keeps blank placeholders out of the list', () => {
        const field = { type: 'select', options: ['', { value: 'open', label: 'Open' }] };
        expect(optionPairs(field)).toEqual([{ value: 'open', label: 'Open' }]);
        expect(cellText('open', field)).toBe('Open');
    });
});
