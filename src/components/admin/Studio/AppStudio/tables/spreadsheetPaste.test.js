import { describe, expect, it } from 'vitest';
import {
    buildImportRows, coerceCell, parseDateish, parseNumberish, parsePasted, suggestMapping,
} from './spreadsheetPaste';

/**
 * The paste path is where a spreadsheet's habits meet the column types: the
 * separator differs per tool and locale, a wrapped field may hold the separator
 * itself, and an amount or a date is written five different ways. These tests
 * pin the conversions whose failure would silently put the WRONG value in a
 * column (rather than refusing it).
 */

const FIELDS = [
    { id: 'f1', key: 'name', name: 'Name', type: 'text' },
    { id: 'f2', key: 'amount', name: 'Amount', type: 'number' },
    { id: 'f3', key: 'status', name: 'Status', type: 'select', options: ['Open', 'Closed'] },
    { id: 'f4', key: 'paid', name: 'Paid', type: 'bool' },
    { id: 'f5', key: 'due', name: 'Due date', type: 'date' },
    { id: 'f6', key: 'total', name: 'Total', type: 'computed' },
];

describe('parsePasted', () => {
    it('reads a tab-separated block the way Excel puts it on the clipboard', () => {
        const { header, rows, delimiter } = parsePasted('Name\tAmount\nAnna\t12\nBram\t8\n');
        expect(delimiter).toBe('\t');
        expect(header).toEqual(['Name', 'Amount']);
        expect(rows).toEqual([['Anna', '12'], ['Bram', '8']]);
    });

    it('keeps a quoted field that contains the separator and a line break in one cell', () => {
        const text = 'Name,Note\n"Vries, Anna","line one\nline two"\n';
        const { header, rows } = parsePasted(text);
        expect(header).toEqual(['Name', 'Note']);
        expect(rows).toHaveLength(1);
        expect(rows[0]).toEqual(['Vries, Anna', 'line one\nline two']);
    });

    it('reads a doubled quote as one quote, and a semicolon file as a table', () => {
        const { rows } = parsePasted('Name;Note\nAnna;"she said ""hi"""');
        expect(rows[0]).toEqual(['Anna', 'she said "hi"']);
    });

    it('drops the blank line a selection usually carries along', () => {
        expect(parsePasted('A\tB\n1\t2\n\n').rows).toEqual([['1', '2']]);
        expect(parsePasted('   ').rows).toEqual([]);
    });
});

describe('suggestMapping', () => {
    it('matches header names to fields regardless of case and punctuation', () => {
        expect(suggestMapping(['NAME', 'due_date', 'Nothing'], FIELDS)).toEqual(['name', 'due', '']);
    });

    it('never offers a computed column — it is worked out, not written', () => {
        expect(suggestMapping(['Total'], FIELDS)).toEqual(['']);
    });
});

describe('value conversion', () => {
    it('reads both decimal conventions and drops thousands separators', () => {
        expect(parseNumberish('1.234,56')).toBe(1234.56);
        expect(parseNumberish('1,234.56')).toBe(1234.56);
        expect(parseNumberish('1,234')).toBe(1234);
        expect(parseNumberish('12,5')).toBe(12.5);
        expect(parseNumberish('€ 1 200')).toBe(1200);
        expect(Number.isNaN(parseNumberish('twelve'))).toBe(true);
    });

    it('reads ISO and day-first dates, and refuses a day that does not exist', () => {
        expect(parseDateish('2026-03-14')).toBe('2026-03-14');
        expect(parseDateish('14-03-2026')).toBe('2026-03-14');
        expect(parseDateish('14/03/2026')).toBe('2026-03-14');
        expect(parseDateish('3/14/2026')).toBe('2026-03-14');
        expect(parseDateish('31-02-2026')).toBeNull();
    });

    it('says which value would not convert, in the words of the column', () => {
        expect(coerceCell('abc', FIELDS[1]).error).toMatch(/“abc” is not a number/);
        expect(coerceCell('Blue', FIELDS[2]).error).toMatch(/not one of the choices \(Open, Closed\)/);
        expect(coerceCell('maybe', FIELDS[3]).error).toMatch(/not a yes or a no/);
        expect(coerceCell('', { ...FIELDS[0], required: true }).error).toMatch(/Name can’t be empty/);
    });

    it('takes the yes/no spellings a spreadsheet actually holds', () => {
        expect(coerceCell('Yes', FIELDS[3]).value).toBe(true);
        expect(coerceCell('1', FIELDS[3]).value).toBe(true);
        expect(coerceCell('nee', FIELDS[3]).value).toBe(false);
    });

    it('matches a choice on its label, whatever its case', () => {
        expect(coerceCell('closed', FIELDS[2]).value).toBe('Closed');
    });
});

describe('buildImportRows', () => {
    const parsed = parsePasted('Name\tAmount\tStatus\nAnna\t1.234,56\tOpen\nBram\tnope\tOpen\n');
    const mapping = suggestMapping(parsed.header, FIELDS);

    it('converts a good row and flags the cell that fails, per spreadsheet line', () => {
        const rows = buildImportRows(parsed, mapping, FIELDS);
        expect(rows[0]).toMatchObject({ line: 2, values: { name: 'Anna', amount: 1234.56, status: 'Open' }, problems: [] });
        expect(rows[1].line).toBe(3);
        expect(rows[1].problems).toHaveLength(1);
        expect(rows[1].problems[0]).toMatchObject({ column: 'Amount', fieldKey: 'amount' });
    });

    it('leaves an unmapped column out entirely, and an empty cell to the column default', () => {
        const rows = buildImportRows(parsed, ['name', '', ''], FIELDS);
        expect(rows[0].values).toEqual({ name: 'Anna' });
        const blank = buildImportRows(parsePasted('Name\tAmount\nAnna\t\n'), ['name', 'amount'], FIELDS);
        expect(blank[0].values).toEqual({ name: 'Anna' });
    });
});
