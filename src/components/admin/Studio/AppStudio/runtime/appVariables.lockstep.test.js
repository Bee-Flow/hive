/**
 * Variable lockstep — the client mirror must agree with the server, verbatim.
 *
 * The runtime seeds `vars` at mount, before any catalog request could land, so
 * the vocabulary has to be a local mirror rather than a fetch. That makes drift
 * possible, which makes this test the thing that stops it: a type added
 * server-side but missing here would silently seed `null` where the app expects
 * `[]`, and a coercion rule that differs would make the same declaration mean
 * one thing in the browser and another in a step.
 */

import { createRequire } from 'node:module';
import { describe, it, expect } from 'vitest';
import {
    VARIABLE_TYPES,
    VARIABLE_TYPE_DEFAULTS,
    VARIABLE_NAME_RE,
    RESERVED_VARIABLE_NAMES,
    MAX_VARIABLES,
    MAX_VARIABLE_DEFAULT_BYTES,
    coerceVariableDefault,
    seedVariableDefaults,
} from './appVariables';

const require = createRequire(import.meta.url);
const specs = require('../../../../../../../server/appStudio/componentSpecs.js');

describe('appVariables — mirrors the server vocabulary', () => {
    it('types, defaults and reserved names are verbatim', () => {
        expect(VARIABLE_TYPES).toEqual(specs.VARIABLE_TYPES);
        expect(VARIABLE_TYPE_DEFAULTS).toEqual(specs.VARIABLE_TYPE_DEFAULTS);
        expect(RESERVED_VARIABLE_NAMES).toEqual(specs.RESERVED_VARIABLE_NAMES);
    });

    it('the name grammar is the same pattern', () => {
        expect(VARIABLE_NAME_RE.source).toBe(specs.VARIABLE_NAME_RE.source);
    });

    it('the ceilings match', () => {
        expect(MAX_VARIABLES).toBe(specs.LIMITS.MAX_VARIABLES);
        expect(MAX_VARIABLE_DEFAULT_BYTES).toBe(specs.LIMITS.MAX_VARIABLE_DEFAULT_BYTES);
    });

    // Table-driven, so a coercion rule that changes on one side fails here
    // rather than in production on somebody's first paint.
    const CASES = [
        ['text', 'x'], ['text', 42], ['text', true], ['text', null], ['text', undefined], ['text', {}],
        ['number', 5], ['number', '5'], ['number', '5.5'], ['number', 'nope'], ['number', true], ['number', null],
        ['yesno', true], ['yesno', 'true'], ['yesno', 'false'], ['yesno', 1], ['yesno', 0], ['yesno', 'maybe'],
        ['date', '2026-08-10'], ['date', '2026-08-10T09:00:00Z'], ['date', 'nope'], ['date', null], ['date', 5],
        ['record', { a: 1 }], ['record', []], ['record', 'x'], ['record', null],
        ['list', [1, 2]], ['list', {}], ['list', 'x'],
        ['any', 1], ['any', 'x'], ['any', null], ['any', { a: 1 }], ['any', undefined],
    ];

    it.each(CASES)('coerceVariableDefault(%s, %j) agrees with the server', (type, value) => {
        expect(coerceVariableDefault(type, value)).toEqual(specs.coerceVariableDefault(type, value));
    });

    it('seedVariableDefaults agrees, including the names it refuses', () => {
        const declarations = [
            { name: 'status', type: 'text', default: 'new' },
            { name: 'limit', type: 'number', default: '10' },
            { name: 'filters', type: 'text', default: 'x' },     // reserved
            { name: 'my var', type: 'text', default: 'x' },      // unusable
            { name: 'when', type: 'date', default: '2026-08-10T09:00:00Z' },
            { name: 'odd', type: 'colour', default: 'x' },       // unknown type → any
        ];
        expect(seedVariableDefaults(declarations)).toEqual(specs.seedVariableDefaults(declarations));
    });

    it('an oversized default is refused on both sides', () => {
        const big = { blob: 'x'.repeat(MAX_VARIABLE_DEFAULT_BYTES + 100) };
        expect(coerceVariableDefault('record', big)).toEqual(specs.coerceVariableDefault('record', big));
    });
});
