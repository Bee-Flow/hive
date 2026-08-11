import { createRequire } from 'node:module';
import { describe, it, expect } from 'vitest';
import { listVariables, removeVariable, renameVariable, setVariable } from './definitionOps';

const require = createRequire(import.meta.url);
const { validateAppDefinition } = require('../../../../../../../server/appStudio/validate.js');
const { canonicalizeAppDefinition } = require('../../../../../../../server/appStudio/canonicalize.js');

/**
 * These ops feed straight into autosave, so two contracts matter as much as the
 * behaviour: an effective no-op returns the SAME reference (or the editor
 * commits a history entry per keystroke), and whatever comes out still
 * validates (or the save 422s on the author's next edit).
 */

function deepFreeze(o) {
    if (o && typeof o === 'object') {
        for (const v of Object.values(o)) deepFreeze(v);
        Object.freeze(o);
    }
    return o;
}

const decl = (name, over = {}) => ({ name, label: name, type: 'text', default: '', description: '', ...over });

function baseDef(variables) {
    return deepFreeze({
        schemaVersion: 2,
        meta: { name: 'T', description: '', icon: 'LayoutGrid' },
        theme: {},
        homeScreenId: 'scr_a00001',
        roles: [],
        screens: [{
            id: 'scr_a00001', name: 'Home', icon: 'Home', showInNav: true, maxWidth: 'medium',
            sections: [{ id: 'sec_a00001', style: {}, children: [{ id: 'cmp_t00001', type: 'text', props: { text: 'x' } }] }],
        }],
        actions: {},
        ...(variables ? { variables } : {}),
    });
}

describe('listVariables', () => {
    it('is [] when the key is absent or malformed', () => {
        expect(listVariables(baseDef())).toEqual([]);
        expect(listVariables({ variables: 'nope' })).toEqual([]);
        expect(listVariables(null)).toEqual([]);
    });
});

describe('setVariable', () => {
    it('appends a new one and materialises the key', () => {
        const next = setVariable(baseDef(), decl('a'));
        expect(next.variables).toHaveLength(1);
    });

    it('patches an existing one in place, keeping the order', () => {
        const def = baseDef([decl('a'), decl('b')]);
        const next = setVariable(def, { name: 'a', label: 'Renamed label' });
        expect(next.variables.map((v) => v.name)).toEqual(['a', 'b']);
        expect(next.variables[0].label).toBe('Renamed label');
        expect(next.variables[0].type).toBe('text');   // untouched fields survive
    });

    it('returns the SAME def when nothing changes', () => {
        const def = baseDef([decl('a')]);
        expect(setVariable(def, { name: 'a', label: 'a' })).toBe(def);
    });

    it('ignores a nameless variable rather than writing junk', () => {
        const def = baseDef();
        expect(setVariable(def, { label: 'x' })).toBe(def);
    });
});

describe('renameVariable', () => {
    it('renames in place', () => {
        const next = renameVariable(baseDef([decl('a'), decl('b')]), 'a', 'c');
        expect(next.variables.map((v) => v.name)).toEqual(['c', 'b']);
    });

    it('refuses a name already taken, so a rename can never swallow a row', () => {
        const def = baseDef([decl('a'), decl('b')]);
        expect(renameVariable(def, 'a', 'b')).toBe(def);
    });

    it('is a no-op for an unknown name or an unchanged one', () => {
        const def = baseDef([decl('a')]);
        expect(renameVariable(def, 'nope', 'x')).toBe(def);
        expect(renameVariable(def, 'a', 'a')).toBe(def);
    });
});

describe('removeVariable', () => {
    it('removes one and keeps the rest', () => {
        const next = removeVariable(baseDef([decl('a'), decl('b')]), 'a');
        expect(next.variables.map((v) => v.name)).toEqual(['b']);
    });

    // Emit-when-present: created-then-deleted must round-trip byte-clean.
    it('deletes the key entirely when the last one goes', () => {
        const next = removeVariable(baseDef([decl('a')]), 'a');
        expect('variables' in next).toBe(false);
    });

    it('returns the SAME def for an unknown name', () => {
        const def = baseDef([decl('a')]);
        expect(removeVariable(def, 'nope')).toBe(def);
    });
});

describe('the result still saves', () => {
    it('an added variable canonicalizes and validates clean', () => {
        const next = setVariable(baseDef(), decl('statusFilter', { default: 'new', description: 'which status' }));
        const { def, repairs } = canonicalizeAppDefinition(next);
        expect(repairs.filter((r) => r.code.startsWith('variable'))).toEqual([]);
        const res = validateAppDefinition(def);
        expect(res.errors).toEqual([]);
    });

    it('a created-then-deleted round trip is byte-identical to never having one', () => {
        const start = baseDef();
        const after = removeVariable(setVariable(start, decl('a')), 'a');
        expect(JSON.stringify(canonicalizeAppDefinition(after).def))
            .toBe(JSON.stringify(canonicalizeAppDefinition(start).def));
    });
});
