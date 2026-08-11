import { describe, it, expect } from 'vitest';
import { autoMapping, isUntouchedSchema, schemaFromColumns } from './aiFieldMatching';

/**
 * The column-matching rules behind the ai_extract write-to editor. The executor
 * mirrors the same-name rule server-side (actionExecutor.resolveWriteMapping),
 * so a change here should be checked against appStudio/actionExecutor.ai.test.js.
 */

const columns = [
    { key: 'invoice_number', name: 'Invoice Number', type: 'text' },
    { key: 'amount', name: 'Amount', type: 'number', required: true },
    { key: 'issued_on', name: 'Issued On', type: 'date' },
    { key: 'paid', name: 'Paid', type: 'bool' },
    { key: 'status', name: 'Status', type: 'select', options: ['open', 'paid'] },
    { key: 'tags', name: 'Tags', type: 'multiselect' },
    { key: 'owner', name: 'Owner', type: 'relation' },
    { key: 'scan', name: 'Scan', type: 'file' },
    { key: 'total', name: 'Total', type: 'computed' },
];

describe('schemaFromColumns', () => {
    it('derives one typed field per column the AI can fill', () => {
        expect(schemaFromColumns(columns).map((f) => [f.name, f.type])).toEqual([
            ['invoice_number', 'string'],
            ['amount', 'number'],
            ['issued_on', 'date'],
            ['paid', 'boolean'],
            ['status', 'string'],
            ['tags', 'array'],
        ]);
        // relation needs a record id, file needs an upload, computed is
        // server-managed — none of them are something to extract.
    });

    it('carries the column label, its options and its required flag into the schema', () => {
        const byName = Object.fromEntries(schemaFromColumns(columns).map((f) => [f.name, f]));
        expect(byName.invoice_number.description).toBe('Invoice Number');
        expect(byName.status.description).toBe('Status. One of: open, paid');
        expect(byName.amount.required).toBe(true);
        expect(byName.paid.required).toBe(false);
    });

    it('stays within the 40-field schema cap', () => {
        const many = Array.from({ length: 60 }, (_, i) => ({ key: `c${i}`, name: `C${i}`, type: 'text' }));
        expect(schemaFromColumns(many)).toHaveLength(40);
    });
});

describe('autoMapping', () => {
    it('matches on the exact key, and through case and punctuation', () => {
        const fields = [{ name: 'amount' }, { name: 'invoiceNumber' }, { name: 'IssuedOn' }];
        expect(autoMapping(fields, columns)).toEqual({
            amount: 'amount',
            invoice_number: 'invoiceNumber',
            issued_on: 'IssuedOn',
        });
    });

    it('matches a field named after the column label', () => {
        expect(autoMapping([{ name: 'Invoice_Number' }], columns)).toEqual({ invoice_number: 'Invoice_Number' });
    });

    it('leaves unmatched fields out rather than guessing', () => {
        expect(autoMapping([{ name: 'vendor' }, { name: 'amount' }], columns)).toEqual({ amount: 'amount' });
    });

    it('never targets a computed column, and never doubles up on one column', () => {
        expect(autoMapping([{ name: 'total' }], columns)).toEqual({});
        // Both fields normalize to the same column; the first one wins.
        expect(autoMapping([{ name: 'amount' }, { name: 'Amount' }], columns)).toEqual({ amount: 'amount' });
    });

    it('is empty for an empty schema or a table with no columns', () => {
        expect(autoMapping([], columns)).toEqual({});
        expect(autoMapping([{ name: 'amount' }], [])).toEqual({});
    });
});

describe('isUntouchedSchema', () => {
    it('spots the placeholder fields nobody has edited', () => {
        expect(isUntouchedSchema([])).toBe(true);
        expect(isUntouchedSchema([{ name: 'field1', description: '' }])).toBe(true);
        expect(isUntouchedSchema([{ name: 'field', description: '  ' }, { name: 'field2' }])).toBe(true);
    });

    it('leaves a schema alone once it says something', () => {
        expect(isUntouchedSchema([{ name: 'vendor' }])).toBe(false);
        expect(isUntouchedSchema([{ name: 'field1', description: 'the vendor name' }])).toBe(false);
    });
});
