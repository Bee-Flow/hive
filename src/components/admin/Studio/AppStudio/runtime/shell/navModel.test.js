import { describe, expect, it } from 'vitest';
import { navModel } from './navModel';

const scr = (id, name, extra = {}) => ({ id, name, icon: null, showInNav: true, ...extra });

function def(screens, nav) {
    return { screens, ...(nav ? { nav } : {}) };
}

describe('navModel', () => {
    it('no nav key: every showInNav screen is ungrouped, flat order = definition order', () => {
        const d = def([scr('scr_a00001', 'A'), scr('scr_b00001', 'B'), scr('scr_c00001', 'C')]);
        const m = navModel(d);
        expect(m.groups).toEqual([]);
        expect(m.ungrouped.map((s) => s.id)).toEqual(['scr_a00001', 'scr_b00001', 'scr_c00001']);
        expect(m.flat.map((s) => s.id)).toEqual(['scr_a00001', 'scr_b00001', 'scr_c00001']);
    });

    it('excludes showInNav:false screens everywhere, even when a group references them', () => {
        const d = def(
            [scr('scr_a00001', 'A'), scr('scr_b00001', 'B', { showInNav: false })],
            { style: 'sidebar', groups: [{ id: 'nvg_000001', label: 'G', icon: null, screens: ['scr_b00001'] }] },
        );
        const m = navModel(d);
        expect(m.groups).toEqual([]); // group only held a hidden screen → dropped
        expect(m.ungrouped.map((s) => s.id)).toEqual(['scr_a00001']);
        expect(m.flat.map((s) => s.id)).toEqual(['scr_a00001']);
    });

    it('a grouped screen leaves ungrouped; flat = ungrouped then grouped in group order', () => {
        const d = def(
            [scr('scr_a00001', 'A'), scr('scr_b00001', 'B'), scr('scr_c00001', 'C'), scr('scr_d00001', 'D')],
            {
                style: 'sidebar',
                groups: [
                    { id: 'nvg_000001', label: 'One', icon: 'Folder', screens: ['scr_c00001'] },
                    { id: 'nvg_000002', label: 'Two', icon: null, screens: ['scr_b00001'] },
                ],
            },
        );
        const m = navModel(d);
        expect(m.ungrouped.map((s) => s.id)).toEqual(['scr_a00001', 'scr_d00001']);
        expect(m.groups.map((g) => g.id)).toEqual(['nvg_000001', 'nvg_000002']);
        expect(m.groups[0].icon).toBe('Folder');
        expect(m.flat.map((s) => s.id)).toEqual(['scr_a00001', 'scr_d00001', 'scr_c00001', 'scr_b00001']);
    });

    it('a screen claimed by an earlier group is skipped in later ones; unknown refs are dropped', () => {
        const d = def(
            [scr('scr_a00001', 'A'), scr('scr_b00001', 'B')],
            {
                style: 'tabs',
                groups: [
                    { id: 'nvg_000001', label: 'First', icon: null, screens: ['scr_a00001', 'scr_nope01'] },
                    { id: 'nvg_000002', label: 'Second', icon: null, screens: ['scr_a00001'] },
                ],
            },
        );
        const m = navModel(d);
        expect(m.groups.map((g) => g.id)).toEqual(['nvg_000001']); // second group ends up empty → dropped
        expect(m.groups[0].screens.map((s) => s.id)).toEqual(['scr_a00001']);
        expect(m.flat.map((s) => s.id)).toEqual(['scr_b00001', 'scr_a00001']);
    });

    it('tolerates a missing definition and malformed group entries', () => {
        expect(navModel(null)).toEqual({ ungrouped: [], groups: [], flat: [] });
        const d = def([scr('scr_a00001', 'A')], { style: 'sidebar', groups: [null, 'x', { id: 'nvg_000001', label: 'G' }] });
        const m = navModel(d);
        expect(m.groups).toEqual([]);
        expect(m.flat.map((s) => s.id)).toEqual(['scr_a00001']);
    });
});
