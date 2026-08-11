import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

// The expression engine is deployed as TWO in-tree copies — one per Docker
// build context (server/shared/expr, agent-hub/src/shared/expr) — because a
// repo-root shared/ dir is copied into neither image. They MUST stay
// byte-identical; this test fails the moment one is edited without the other,
// which (together with sharedExpr.parity.test.js) is the anti-drift guarantee.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const FE_DIR = path.resolve(HERE, '../../../../../shared/expr');
const SERVER_DIR = path.resolve(HERE, '../../../../../../../server/shared/expr');

const SHARED_FILES = ['functions.mjs', 'engine.mjs', 'index.mjs', 'corpus.mjs'];

describe('shared expr engine — FE copy stays byte-identical to the server copy', () => {
    for (const file of SHARED_FILES) {
        it(`${file} matches server/shared/expr/${file}`, () => {
            const fe = fs.readFileSync(path.join(FE_DIR, file), 'utf8');
            const server = fs.readFileSync(path.join(SERVER_DIR, file), 'utf8');
            expect(fe, `agent-hub/src/shared/expr/${file} drifted from server/shared/expr/${file} — copy the canonical (server) version over`).toBe(server);
        });
    }
});
