import { describe, it, expect } from 'vitest';
import { reconcileVariableDefaults, seedVariableDefaults } from './appVariables';

/**
 * Reconciling declarations into the LIVE bag is where this feature could do
 * real damage: the editor re-renders it on every inspector keystroke, so a rule
 * that resets rather than merges would wipe a filter the author is looking at,
 * mid-word.
 */

const decl = (name, type, def) => ({ name, label: name, type, default: def, description: '' });

describe('seedVariableDefaults', () => {
    it('handles nothing, an empty list, and a mixed one', () => {
        expect(seedVariableDefaults(undefined)).toEqual({});
        expect(seedVariableDefaults([])).toEqual({});
        expect(seedVariableDefaults([decl('a', 'text', 'x'), decl('b', 'number', 3)])).toEqual({ a: 'x', b: 3 });
    });

    it('skips a name no formula could read, and the reserved ones', () => {
        expect(seedVariableDefaults([decl('my var', 'text', 'x'), decl('filters', 'text', 'y')])).toEqual({});
    });
});

describe('reconcileVariableDefaults', () => {
    it('seeds a newly declared variable', () => {
        const next = reconcileVariableDefaults({ a: 'x' }, [decl('a', 'text', 'x')], [decl('a', 'text', 'x'), decl('b', 'number', 7)]);
        expect(next).toEqual({ a: 'x', b: 7 });
    });

    it('adopts a changed default while the value is still untouched', () => {
        const next = reconcileVariableDefaults({ a: 'old' }, [decl('a', 'text', 'old')], [decl('a', 'text', 'new')]);
        expect(next.a).toBe('new');
    });

    // The one that matters: a value an action or a filter bar produced is real
    // state, and outranks an editor-side edit to the declaration.
    it('KEEPS a value that was written at runtime when the default changes', () => {
        const next = reconcileVariableDefaults({ a: 'typed by the user' }, [decl('a', 'text', 'old')], [decl('a', 'text', 'new')]);
        expect(next.a).toBe('typed by the user');
    });

    it('drops a removed variable that still holds its default', () => {
        const next = reconcileVariableDefaults({ a: 'x', b: 7 }, [decl('a', 'text', 'x'), decl('b', 'number', 7)], [decl('a', 'text', 'x')]);
        expect(next).toEqual({ a: 'x' });
    });

    // Undeclared names stay perfectly legal — set_variable can write anything —
    // so discarding a live value would be a behaviour change, not a cleanup.
    it('KEEPS a removed variable that holds a written value', () => {
        const next = reconcileVariableDefaults({ b: 'written' }, [decl('b', 'number', 7)], []);
        expect(next.b).toBe('written');
    });

    it('leaves names nothing ever declared alone', () => {
        const next = reconcileVariableDefaults({ adhoc: 1 }, [], [decl('a', 'text', 'x')]);
        expect(next.adhoc).toBe(1);
    });

    // Without this the editor would schedule a re-render per keystroke.
    it('returns the SAME object when nothing changed', () => {
        const prev = { a: 'x' };
        const decls = [decl('a', 'text', 'x')];
        expect(reconcileVariableDefaults(prev, decls, decls)).toBe(prev);
    });

    it('compares object defaults by value, not by reference', () => {
        const prev = { a: { k: 1 } };
        const before = [decl('a', 'record', { k: 1 })];
        const after = [decl('a', 'record', { k: 2 })];
        // Untouched (deep-equals the old default) → adopt the new one.
        expect(reconcileVariableDefaults(prev, before, after).a).toEqual({ k: 2 });
    });

    it('survives a null or missing bag', () => {
        expect(reconcileVariableDefaults(null, [], [decl('a', 'text', 'x')])).toEqual({ a: 'x' });
    });
});
