import { describe, expect, it } from 'vitest';
import {
    collectModals, columnOptions, isDanglingRef, labelForRef, screenOptions, tableOptions,
} from './stepReferences';

/**
 * The lookup behind every reference picker and every line on the flow canvas.
 * Its one hard rule: NEVER hide a value. An id whose target is gone still shows
 * itself, because it is the only remaining evidence of what a step was meant to
 * do — and the person repairing it needs to see it.
 */

const DEFINITION = {
    screens: [
        {
            id: 'scr_a',
            name: 'List',
            sections: [{
                id: 'sec_a',
                children: [
                    { id: 'nd_wrap', type: 'container', children: [
                        { id: 'nd_nested', type: 'modal', props: { title: 'Nested dialog' }, children: [] },
                    ] },
                    { id: 'nd_plain', type: 'modal', props: {}, children: [] },
                ],
            }],
        },
        { id: 'scr_b', sections: [] },
    ],
};

describe('collectModals', () => {
    it('finds dialogs nested inside other components', () => {
        expect(collectModals(DEFINITION).map((m) => m.id)).toEqual(['nd_nested', 'nd_plain']);
    });

    it('names a dialog by its title, falling back to its id', () => {
        const byId = Object.fromEntries(collectModals(DEFINITION).map((m) => [m.id, m.label]));
        expect(byId.nd_nested).toBe('Nested dialog');
        expect(byId.nd_plain).toBe('nd_plain');
    });

    it('survives an app with no screens at all', () => {
        expect(collectModals(null)).toEqual([]);
        expect(collectModals({})).toEqual([]);
    });
});

describe('screenOptions / tableOptions', () => {
    it('falls back to the id when a screen was never named', () => {
        expect(screenOptions(DEFINITION.screens)).toEqual([
            { id: 'scr_a', label: 'List' },
            { id: 'scr_b', label: 'scr_b' },
        ]);
    });

    it('prefers a table’s human name over its key', () => {
        expect(tableOptions([{ id: 'tbl_1', key: 'invoices', name: 'Invoices' }]))
            .toEqual([{ id: 'tbl_1', label: 'Invoices' }]);
    });
});

describe('labelForRef', () => {
    const options = [{ id: 'a', label: 'Alpha' }];

    it('resolves a known id to its name', () => {
        expect(labelForRef(options, 'a')).toBe('Alpha');
    });

    it('shows the raw id when it resolves to nothing — never a blank', () => {
        expect(labelForRef(options, 'gone')).toBe('gone');
        expect(labelForRef([], 'gone')).toBe('gone');
    });

    it('is empty only when there is genuinely nothing set', () => {
        expect(labelForRef(options, '')).toBe('');
        expect(labelForRef(options, null)).toBe('');
    });
});

describe('isDanglingRef', () => {
    const options = [{ id: 'a', label: 'Alpha' }];

    it('reports an id the loaded list does not contain', () => {
        expect(isDanglingRef(options, 'gone')).toBe(true);
    });

    /**
     * An empty list means "not loaded yet" far more often than it means "you
     * deleted everything" — the pickers mount before their fetch resolves, and
     * outside the editor shell they never load at all. Warning then would put a
     * red "this no longer exists" under every correct step on every mount.
     */
    it('stays silent while the list is empty', () => {
        expect(isDanglingRef([], 'a')).toBe(false);
        expect(isDanglingRef(null, 'a')).toBe(false);
    });

    it('says nothing about a field that is simply unset', () => {
        expect(isDanglingRef(options, '')).toBe(false);
        expect(isDanglingRef(options, null)).toBe(false);
    });
});

describe('columnOptions', () => {
    it('emits the column KEY as the value and the owner’s name as the label', () => {
        // The recordValues map is keyed by `key`; `name` is only what it is
        // called on screen. Swapping the two writes to a column that does not
        // exist, which fails at run time and nowhere earlier.
        expect(columnOptions([{ key: 'amount_due', name: 'Amount due', type: 'number', required: true }]))
            .toEqual([{ key: 'amount_due', label: 'Amount due', type: 'number', required: true }]);
    });

    it('falls back to the key when a column was never named', () => {
        expect(columnOptions([{ key: 'ref' }])[0].label).toBe('ref');
    });

    it('drops anything without a key rather than offering a broken option', () => {
        expect(columnOptions([{ name: 'No key here' }, null, undefined])).toEqual([]);
    });
});
