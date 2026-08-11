import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { EXPR_FUNCTIONS, EXPR_FUNCTION_NAMES } from './exprFunctions';
import { serializeRow } from '../utils/conditionModel';

// Lockstep check: this FE mirror must match the server's restricted-
// expression whitelist exactly (server/automation/expr.js) — see the header
// comment in exprFunctions.js. Resolved relative to THIS file's real
// filesystem path (not cwd), so it works from any invocation directory.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SERVER_EXPR_PATH = path.resolve(HERE, '../../../../../../../server/automation/expr.js');
const require_ = createRequire(import.meta.url);
const { EXPR_FUNCTION_NAMES: SERVER_NAMES } = require_(SERVER_EXPR_PATH);

describe('exprFunctions — lockstep with server/automation/expr.js', () => {
    it('the FE whitelist has the exact same function names as the server (order-insensitive)', () => {
        expect([...EXPR_FUNCTION_NAMES].sort()).toEqual([...SERVER_NAMES].sort());
    });

    it('every EXPR_FUNCTIONS entry has a name in the exported name list', () => {
        expect(EXPR_FUNCTIONS.map(f => f.name).sort()).toEqual([...EXPR_FUNCTION_NAMES].sort());
    });
});

describe('conditionModel operator registry — fn operators stay in the server whitelist', () => {
    it('contains/startsWith/endsWith serialize to whitelisted helper calls', () => {
        const row = { field: { kind: 'ref', path: 'item.name' }, op: 'contains', value: { kind: 'literal', value: '.pdf' } };
        expect(serializeRow(row)).toBe('contains(item.name, ".pdf")');
        expect(SERVER_NAMES).toContain('contains');
    });

    it('every fn-kind operator the model can emit exists in the server whitelist', () => {
        for (const fn of ['contains', 'startsWith', 'endsWith']) {
            expect(SERVER_NAMES).toContain(fn);
        }
        // isEmpty/!isEmpty (unary ops) also compile to a whitelisted helper call.
        const row = { field: { kind: 'ref', path: 'item.name' }, op: 'isEmpty', value: { kind: 'literal', value: '' } };
        expect(serializeRow(row)).toBe('isEmpty(item.name)');
        expect(SERVER_NAMES).toContain('isEmpty');
    });
});
