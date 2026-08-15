import { describe, it, expect } from 'vitest';
import { computeDropHint } from './dropHint';
import { computeDragEnd, PALETTE_PREFIX } from './dnd';
import { moveNode } from '../state/definitionOps';

/**
 * The drop indicator.
 *
 * The editor drew NOTHING during a drag — no line, no gap, no marking. A reorder
 * inside one container gave zero feedback until the mouse came up, so the only
 * way to learn where something would land was to drop it and undo.
 *
 * These tests exist to keep the hint and the actual drop in step: every case
 * asserts the hint AND what computeDragEnd would really do, because an indicator
 * that points somewhere the drop does not go is worse than none at all.
 */

const leaf = (id, type = 'text') => ({ id, type, props: {}, style: { span: 12 } });
const box = (id, children) => ({ id, type: 'container', props: {}, style: { span: 12 }, children });

function definition() {
    return {
        schemaVersion: 2,
        screens: [{
            id: 'scr_a0001', name: 'Home', sections: [{
                id: 'sec_a0001',
                children: [leaf('cmp_aa0001'), leaf('cmp_bb0001'), box('cmp_box001', [leaf('cmp_cc0001')])],
            }],
        }],
        actions: {},
    };
}

const nodeDrag = (id) => ({ id, data: { current: { type: 'node', node: { id } } } });
const paletteDrag = (type) => ({ id: `${PALETTE_PREFIX}${type}`, data: { current: { type: 'palette', componentType: type } } });
const over = (id) => ({ id });

describe('computeDropHint', () => {
    /**
     * The node takes the sibling's SLOT INDEX, and moveNode applies that index
     * with the node already removed from the array. Dragging DOWN inside one
     * parent therefore shifts the target up by one and the node lands AFTER it
     * — while the indicator used to draw its line above the target, one slot
     * too high, so the drop never landed where the line promised.
     */
    it('dragging a sibling DOWNWARD shows the line after it — where it lands', () => {
        const def = definition();
        const hint = computeDropHint({ active: nodeDrag('cmp_aa0001'), over: over('cmp_bb0001'), definition: def, isPalette: false });
        expect(hint).toEqual({ nodeId: 'cmp_bb0001', edge: 'after' });

        // …and that really is where it goes: index 1 applied to [bb, cc].
        const res = computeDragEnd({ active: nodeDrag('cmp_aa0001'), over: over('cmp_bb0001'), definition: def, screenId: 'scr_a0001' });
        expect(res).toMatchObject({ op: 'move', toParentId: 'sec_a0001', index: 1 });
        expect(moveNode(def, 'cmp_aa0001', { toParentId: 'sec_a0001', index: 1 })
            .screens[0].sections[0].children.map((c) => c.id))
            .toEqual(['cmp_bb0001', 'cmp_aa0001', 'cmp_box001']);
    });

    it('dragging a sibling UPWARD still shows the line before it', () => {
        // Three flat siblings, so "upward" is expressible in one parent.
        const def = definition();
        def.screens[0].sections[0].children = [leaf('cmp_aa0001'), leaf('cmp_bb0001'), leaf('cmp_dd0001')];
        // Nothing below the target is removed, so the slot really is before it.
        expect(computeDropHint({ active: nodeDrag('cmp_dd0001'), over: over('cmp_aa0001'), definition: def, isPalette: false }))
            .toEqual({ nodeId: 'cmp_aa0001', edge: 'before' });
        expect(moveNode(def, 'cmp_dd0001', { toParentId: 'sec_a0001', index: 0 })
            .screens[0].sections[0].children.map((c) => c.id))
            .toEqual(['cmp_dd0001', 'cmp_aa0001', 'cmp_bb0001']);
    });

    it('a PALETTE component over a leaf shows a line AFTER it', () => {
        const def = definition();
        expect(computeDropHint({ active: paletteDrag('text'), over: over('cmp_aa0001'), definition: def, isPalette: true }))
            .toEqual({ nodeId: 'cmp_aa0001', edge: 'after' });

        const res = computeDragEnd({ active: paletteDrag('text'), over: over('cmp_aa0001'), definition: def, screenId: 'scr_a0001' });
        expect(res).toMatchObject({ op: 'insert', parentId: 'sec_a0001', index: 1 });
    });

    it('a container reads as "inside", not as a line beside it', () => {
        const def = definition();
        expect(computeDropHint({ active: nodeDrag('cmp_aa0001'), over: over('cmp_box001'), definition: def, isPalette: false }))
            .toEqual({ nodeId: 'cmp_box001', edge: 'inside' });
        expect(computeDropHint({ active: paletteDrag('text'), over: over('cmp_box001'), definition: def, isPalette: true }))
            .toEqual({ nodeId: 'cmp_box001', edge: 'inside' });
    });

    it('shows nothing where the drop would be refused', () => {
        const def = definition();
        // Onto itself.
        expect(computeDropHint({ active: nodeDrag('cmp_aa0001'), over: over('cmp_aa0001'), definition: def, isPalette: false })).toBeNull();
        // Into its own subtree — a container dragged onto its own child.
        expect(computeDropHint({ active: nodeDrag('cmp_box001'), over: over('cmp_cc0001'), definition: def, isPalette: false })).toBeNull();
        expect(computeDragEnd({ active: nodeDrag('cmp_box001'), over: over('cmp_cc0001'), definition: def, screenId: 'scr_a0001' })).toBeNull();
        // Into its own parent container — computeDragEnd refuses it, so must we.
        expect(computeDropHint({ active: nodeDrag('cmp_cc0001'), over: over('cmp_box001'), definition: def, isPalette: false })).toBeNull();
        // No target at all.
        expect(computeDropHint({ active: nodeDrag('cmp_aa0001'), over: null, definition: def, isPalette: false })).toBeNull();
    });

    it('leaves sections and screen tabs alone — they draw their own affordance', () => {
        const def = definition();
        expect(computeDropHint({ active: paletteDrag('text'), over: over('section:sec_a0001'), definition: def, isPalette: true })).toBeNull();
    });
});
