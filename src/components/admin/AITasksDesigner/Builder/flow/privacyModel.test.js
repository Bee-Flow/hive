/**
 * BFSF-355 — the Privacy Shield model layer.
 *
 * The whole design rests on ONE claim: consolidating three palette entries into
 * one moded node needs no migration, because the runtime keeps its three step
 * types and this module only translates. That claim is only true if a stored
 * guard / tokenize / untokenize round-trips through read → write without
 * changing shape, so most of this file is that check.
 */

import { describe, it, expect } from 'vitest';
import {
    isPrivacyStep, readPrivacyMode, readPrivacy, writePrivacy,
    stepTypeForMode, modeScans, modeBranches, modeHides,
    privacyPorts, slotForPrivacyEdge, droppedEdgesOnModeChange,
} from './privacyModel';

/** What buildPatch does with the writePrivacy result: undefined DELETES a key. */
function applyPatch(step, patch) {
    const next = { ...step, ...patch };
    for (const [k, v] of Object.entries(patch)) if (v === undefined) delete next[k];
    return next;
}

describe('privacyModel — which mode a stored step is', () => {
    it('maps the three runtime types onto modes', () => {
        expect(readPrivacyMode({ type: 'guard' })).toBe('check');
        expect(readPrivacyMode({ type: 'tokenize' })).toBe('hide');
        expect(readPrivacyMode({ type: 'untokenize' })).toBe('reveal');
    });

    it('a guard that tokenizes what it finds IS the Check + Hide mode', () => {
        expect(readPrivacyMode({ type: 'guard', onFound: { tokenize: true } })).toBe('check_hide');
        // …and the other guard actions do not make it one.
        expect(readPrivacyMode({ type: 'guard', onFound: { stop: true, mask: true } })).toBe('check');
    });

    it('knows which steps it owns', () => {
        expect(isPrivacyStep({ type: 'guard' })).toBe(true);
        expect(isPrivacyStep({ type: 'switch' })).toBe(false);
        expect(isPrivacyStep(null)).toBe(false);
    });

    it('mode traits line up with what the runtime does', () => {
        expect(stepTypeForMode('check_hide')).toBe('guard');
        expect(stepTypeForMode('hide')).toBe('tokenize');
        expect(stepTypeForMode('reveal')).toBe('untokenize');
        // Only the guard-backed modes have two ports.
        expect([modeBranches('check'), modeBranches('check_hide')]).toEqual([true, true]);
        expect([modeBranches('hide'), modeBranches('reveal')]).toEqual([false, false]);
        // Reveal is the one mode that never runs the detector.
        expect(modeScans('reveal')).toBe(false);
        // Both hiding modes count as "this routine hides something".
        expect([modeHides('hide'), modeHides('check_hide')]).toEqual([true, true]);
        expect(modeHides('check')).toBe(false);
    });
});

describe('privacyModel — a stored step survives the round trip', () => {
    // THE compatibility test. If any of these change shape, opening a routine
    // and saving it would rewrite it, which is exactly what "no migration"
    // promised would not happen.
    const stored = [
        { id: 'g1', type: 'guard', label: 'Check', sourceRef: 'steps.a.output.text' },
        { id: 'g2', type: 'guard', sourceRef: 'x', onFound: { stop: true } },
        { id: 'g3', type: 'guard', sourceRef: 'x', onFound: { mask: true } },
        { id: 'g4', type: 'guard', sourceRef: 'x', onFound: { stop: true, mask: true }, categories: ['person'], confidence: 0.8 },
        { id: 't1', type: 'tokenize', sourceRef: 'steps.a.output.body' },
        { id: 't2', type: 'tokenize', sourceRef: 'x', categories: ['email_address'] },
        { id: 'u1', type: 'untokenize', sourceRef: 'steps.ai.output.text' },
    ];

    for (const step of stored) {
        it(`${step.id} (${step.type}) is byte-identical after read → write → merge`, () => {
            const after = applyPatch(step, writePrivacy(readPrivacy(step)));
            expect(after).toEqual(step);
            // …including the key ORDER, so a saved definition does not churn.
            expect(JSON.stringify(after)).toBe(JSON.stringify(step));
        });
    }

    it('inherited settings STAY inherited — absent is a real state, not a default', () => {
        const step = { id: 'g', type: 'guard', sourceRef: 'x' };
        const model = readPrivacy(step);
        expect(model.categories).toBeNull();
        expect(model.confidence).toBeNull();
        const after = applyPatch(step, writePrivacy(model));
        expect('categories' in after).toBe(false);
        expect('confidence' in after).toBe(false);
    });

    it('an unrecognised mode falls back to the mode that changes no data', () => {
        expect(writePrivacy({ mode: 'nonsense' }).type).toBe('guard');
        expect(writePrivacy({ mode: 'nonsense' }).onFound).toBeUndefined();
    });
});

describe('privacyModel — switching mode', () => {
    it('check → check_hide adds the tokenizing action and keeps the rest', () => {
        const step = { id: 'g', type: 'guard', sourceRef: 'x', onFound: { stop: true } };
        const model = { ...readPrivacy(step), mode: 'check_hide' };
        const after = applyPatch(step, writePrivacy(model));
        expect(after.type).toBe('guard');
        expect(after.onFound).toEqual({ stop: true, tokenize: true });
    });

    it('check_hide → hide drops onFound entirely rather than leaving it stale', () => {
        const step = { id: 'g', type: 'guard', sourceRef: 'x', onFound: { tokenize: true, stop: true } };
        const after = applyPatch(step, writePrivacy({ ...readPrivacy(step), mode: 'hide' }));
        expect(after.type).toBe('tokenize');
        expect('onFound' in after).toBe(false);
    });

    it('hide → reveal keeps the source but stops carrying scan settings', () => {
        const step = { id: 't', type: 'tokenize', sourceRef: 'x', categories: ['person'], confidence: 0.7 };
        const model = { ...readPrivacy(step), mode: 'reveal', categories: null, confidence: null };
        const after = applyPatch(step, writePrivacy(model));
        expect(after.type).toBe('untokenize');
        expect(after.sourceRef).toBe('x');
        expect('categories' in after).toBe(false);
    });
});

describe('privacyModel — ports and the edges a mode switch costs', () => {
    it('a checking mode has two ports, the others one', () => {
        expect(privacyPorts({ type: 'guard' }).map(p => p.label)).toEqual(['then', 'else']);
        expect(privacyPorts({ type: 'guard', onFound: { tokenize: true } }).map(p => p.label)).toEqual(['then', 'else']);
        expect(privacyPorts({ type: 'tokenize' }).map(p => p.label)).toEqual([null]);
        expect(privacyPorts({ type: 'untokenize' }).map(p => p.label)).toEqual([null]);
    });

    it('slot 0 is "the way on" in every mode, so it survives a switch', () => {
        expect(slotForPrivacyEdge({ type: 'guard' }, { label: 'then' })).toBe(0);
        expect(slotForPrivacyEdge({ type: 'guard' }, { label: 'else' })).toBe('clean');
        expect(slotForPrivacyEdge({ type: 'tokenize' }, { label: null })).toBe(0);
    });

    it('names the "clean" connection a check → hide switch would drop', () => {
        const step = { id: 'g', type: 'guard' };
        const edges = [
            { from: 'g', to: 'alert', label: 'then' },
            { from: 'g', to: 'onwards', label: 'else' },
            { from: 'other', to: 'g' },
        ];
        const dropped = droppedEdgesOnModeChange(step, 'hide', edges);
        expect(dropped).toHaveLength(1);
        expect(dropped[0].edge.to).toBe('onwards');
        expect(dropped[0].port).toBe('clean');
        // The other direction costs nothing: both ports still exist.
        expect(droppedEdgesOnModeChange(step, 'check_hide', edges)).toEqual([]);
    });

    it('hide → check drops an "if it fails" edge, which a guard may not have', () => {
        // validate.js lists guard in ON_ERROR_FORBIDDEN_SOURCE_TYPES while
        // tokenize is allowed one, so this switch would otherwise produce a
        // definition the validator rejects.
        const step = { id: 't', type: 'tokenize' };
        const edges = [{ from: 't', to: 'handler', label: 'on_error' }];
        const dropped = droppedEdgesOnModeChange(step, 'check', edges);
        expect(dropped).toHaveLength(1);
        expect(dropped[0].port).toBe('if it fails');
        // Staying single-port keeps it legal.
        expect(droppedEdgesOnModeChange(step, 'reveal', edges)).toEqual([]);
    });
});
