/**
 * Step-kind lockstep — the mirror `catalogLockstep.test.js` does NOT cover.
 *
 * That test pins the COMPONENT catalog between server and client. Nothing pinned
 * the STEP catalog, and the two drifted: `send_email` was implemented on the
 * server, rate-limited on the route, validated by the spec — and absent from the
 * client's SERVER_STEP_KINDS. A step kind the client does not know falls through
 * execStep without dispatching and without throwing, so the surrounding sequence
 * kept running and still reported success. The support desk toasted "Reply sent"
 * while no mail was ever sent.
 *
 * A silent no-op is worse than a crash: it lies. This test makes the drift a
 * build failure.
 */

import { createRequire } from 'node:module';
import { describe, it, expect } from 'vitest';
import { SERVER_STEP_KINDS } from './useActionRunner';

const require = createRequire(import.meta.url);
const specs = require('../../../../../../../server/appStudio/componentSpecs.js');

const { DATA_MUTATING_STEP_KINDS, CLIENT_STEP_KINDS, STEP_KINDS } = specs;

describe('step-kind lockstep with the server spec', () => {
    it('dispatches exactly the data-mutating kinds to the server', () => {
        expect([...SERVER_STEP_KINDS].sort()).toEqual([...DATA_MUTATING_STEP_KINDS].sort());
    });

    it('never dispatches a client-only kind', () => {
        const leaked = CLIENT_STEP_KINDS.filter((k) => SERVER_STEP_KINDS.has(k));
        expect(leaked).toEqual([]);
    });

    it('covers every step kind the spec defines', () => {
        // Together the two sets must be a total cover — a kind in neither is a
        // step the runtime silently ignores, which is the bug this file exists
        // for. componentSpecs.test.js asserts the same partition server-side.
        const covered = new Set([...SERVER_STEP_KINDS, ...CLIENT_STEP_KINDS]);
        expect(STEP_KINDS.filter((k) => !covered.has(k))).toEqual([]);
    });
});
