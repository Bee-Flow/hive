import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { evaluate as evalEsm, parseExpr as parseEsm } from '@shared/expr/engine.mjs';
import { SCOPE, CASES, REJECT } from '@shared/expr/corpus.mjs';

// Parity guarantee: the browser build (ESM engine, imported via @shared) and
// the server runtime (CJS re-export of the same shared module) must evaluate
// the golden corpus IDENTICALLY. We load the server side through createRequire
// so this single vitest asserts client === server for every case — the
// anti-drift contract that makes "live preview matches enforcement" true.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SERVER_EXPR = path.resolve(HERE, '../../../../../../../server/automation/expr.js');
const require_ = createRequire(import.meta.url);
const { evaluate: evalServer } = require_(SERVER_EXPR);

describe('shared expression engine — client/server parity (App Studio + automation)', () => {
    it('the browser (ESM) engine matches expected for every corpus case', () => {
        for (const { expr, expected } of CASES) {
            expect(evalEsm(expr, SCOPE), `expr: ${expr}`).toEqual(expected);
        }
    });

    it('the browser engine matches the SERVER runtime for every corpus case', () => {
        for (const { expr } of CASES) {
            expect(evalEsm(expr, SCOPE), `expr: ${expr}`).toEqual(evalServer(expr, SCOPE));
        }
    });

    it('rejects the same malicious/invalid expressions on both sides', () => {
        for (const expr of REJECT) {
            expect(() => parseEsm(expr), `should reject: ${expr}`).toThrow();
        }
    });
});
