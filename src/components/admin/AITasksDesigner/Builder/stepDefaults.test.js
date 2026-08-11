import { describe, it, expect } from 'vitest';
import { buildStepFromPayload } from './DiagramPane';

/**
 * A18/C20 — a freshly dropped step must never LOOK configured when it isn't.
 *
 * The rule: a field the runner reads to find data (a path, a field name) is
 * seeded EMPTY, so it validates as an amber "you still have to answer this"
 * (the server keeps those codes in COMPLETENESS_CODES, so a blank one autosaves
 * fine) and auto-map fills it from the nearest upstream array on connect.
 *
 * The failures this locks out — all of which reported a green success:
 *   - `loop.overRef: 'trigger.output.items'` resolved to nothing on most
 *     triggers, so the loop ran zero iterations. mapping/autoMapInputs.js's
 *     heal-on-connect path existed but could never fire, because the literal
 *     was indistinguishable from a real answer to everything except
 *     isScaffoldOverRef.
 *   - `aggregate.field: 'id'` collected a list of undefineds.
 *   - `summarize.field: 'amount'` totalled nothing and called it 0.
 *
 * The collection ops' `arrayRef` was already fixed this way (C20); these three
 * were missed.
 */

const at = { x: 0, y: 0 };

// The value a step is seeded with for each "where is the data" field. A literal
// path or field name here is the bug; an empty string is the fix.
const DATA_POINTERS = [
    ['loop', 'overRef'],
    ['filter', 'arrayRef'],
    ['limit', 'arrayRef'],
    ['dedupe', 'arrayRef'],
    ['aggregate', 'arrayRef'],
    ['aggregate', 'field'],
    ['summarize', 'arrayRef'],
    ['summarize', 'field'],
    ['guard', 'sourceRef'],
    ['tokenize', 'sourceRef'],
    ['untokenize', 'sourceRef'],
    ['http_request', 'url'],
];

describe('buildStepFromPayload — no step is seeded with a fake answer', () => {
    for (const [kind, field] of DATA_POINTERS) {
        it(`${kind}.${field} is seeded empty, not with a placeholder path`, () => {
            const step = buildStepFromPayload({ kind }, at);
            expect(step[field]).toBe('');
        });
    }

    it('loop keeps its non-pointer defaults while overRef goes blank', () => {
        const step = buildStepFromPayload({ kind: 'loop', label: 'Repeat for each' }, at);
        expect(step.overRef).toBe('');
        expect(step.itemVar).toBe('item');
        expect(step.maxIterations).toBe(100);
        expect(step.body).toEqual([]);
    });

    it('summarize keeps an operator default (there IS an honest one) but no field', () => {
        const step = buildStepFromPayload({ kind: 'summarize' }, at);
        expect(step.op).toBe('sum');
        expect(step.field).toBe('');
    });

    it('limit keeps count/mode defaults — they are real answers, not guesses', () => {
        const step = buildStepFromPayload({ kind: 'limit' }, at);
        expect(step.count).toBe(10);
        expect(step.mode).toBe('first');
    });

    it('http_request keeps the SSRF guard on by default', () => {
        const step = buildStepFromPayload({ kind: 'http_request' }, at);
        expect(step.blockPrivateTargets).toBe(true);
        expect(step.method).toBe('GET');
    });
});
