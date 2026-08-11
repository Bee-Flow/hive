import { describe, it, expect } from 'vitest';
import {
    applyDragResult,
    buildNode,
    computeDragEnd,
    resolveDrop,
    screenIdFromScreenTabDroppable,
    screenTabDroppableId,
    sectionDroppableId,
    sectionIdFromDroppable,
} from './dnd';
import { APP_COMPONENT_TYPES } from '../runtime/componentRegistry';
import { ID_RE, findNode, findScreen, moveNode } from '../state/definitionOps';
import { BLANK_APP, KITCHEN_SINK } from '../state/sampleDefinitions';

// dnd-kit hands active/over data as a { current } ref — mirror that shape.
const nodeDrag = (id) => ({ id, data: { current: { type: 'node' } } });
const paletteDrag = (type) => ({
    id: `palette:${type}`,
    data: { current: { type: 'palette', componentType: type } },
});
const overNode = (id) => ({ id });
const overSection = (sectionId) => ({ id: sectionDroppableId(sectionId) });
const overScreenTab = (screenId) => ({ id: screenTabDroppableId(screenId) });

const childIds = (def, sectionId, screenId = null) => {
    for (const screen of def.screens) {
        if (screenId && screen.id !== screenId) continue;
        for (const section of screen.sections) {
            if (section.id === sectionId) return (section.children || []).map((n) => n.id);
        }
    }
    return null;
};

describe('buildNode', () => {
    it('builds a node from registry defaults with a fresh valid id', () => {
        const node = buildNode('button');
        expect(node.type).toBe('button');
        expect(node.visible).toBe(true);
        expect(ID_RE.test(node.id)).toBe(true);
        expect(node.props).toEqual(APP_COMPONENT_TYPES.button.defaultProps);
        expect(node.style).toEqual(APP_COMPONENT_TYPES.button.defaultStyle);
        expect(node.children).toBeUndefined();
    });

    it('deep-clones defaults so registry templates are never shared', () => {
        const a = buildNode('table');
        a.props.columns.push({ key: 'x', label: 'X' });
        a.style.span = 4;
        expect(APP_COMPONENT_TYPES.table.defaultProps.columns).toEqual([]);
        expect(APP_COMPONENT_TYPES.table.defaultStyle.span).toBe(12);
        expect(buildNode('table').props.columns).toEqual([]);
    });

    it('gives containers an empty children array and unique ids per call', () => {
        const card = buildNode('card');
        expect(card.children).toEqual([]);
        expect(buildNode('card').id).not.toBe(card.id);
    });

    it('returns null for unknown types', () => {
        expect(buildNode('does_not_exist')).toBeNull();
        expect(buildNode(undefined)).toBeNull();
    });
});

describe('section droppable ids', () => {
    it('round-trips', () => {
        expect(sectionIdFromDroppable(sectionDroppableId('sec_abc123'))).toBe('sec_abc123');
        expect(sectionIdFromDroppable('cmp_abc123')).toBeNull();
    });
});

describe('computeDragEnd — node moves', () => {
    it('reorders within a section (arrayMove semantics)', () => {
        // sec_dash01: [headg1, intro1, stat01, stat02, refre1, divid1, table1]
        const res = computeDragEnd({
            active: nodeDrag('cmp_headg1'),
            over: overNode('cmp_stat01'),
            definition: KITCHEN_SINK,
            screenId: 'scr_dash01',
        });
        expect(res).toMatchObject({ op: 'move', nodeId: 'cmp_headg1', toParentId: 'sec_dash01', index: 2 });

        const { def } = applyDragResult(KITCHEN_SINK, res);
        expect(childIds(def, 'sec_dash01').slice(0, 3)).toEqual(['cmp_intro1', 'cmp_stat01', 'cmp_headg1']);
    });

    it('moves across sections, landing before the hovered node', () => {
        // cmp_list01 lives in sec_dash02; drop it over cmp_table1 (sec_dash01 index 6).
        const res = computeDragEnd({
            active: nodeDrag('cmp_list01'),
            over: overNode('cmp_table1'),
            definition: KITCHEN_SINK,
            screenId: 'scr_dash01',
        });
        expect(res).toMatchObject({ op: 'move', nodeId: 'cmp_list01', toParentId: 'sec_dash01', index: 6 });

        const { def } = applyDragResult(KITCHEN_SINK, res);
        const ids = childIds(def, 'sec_dash01');
        expect(ids[6]).toBe('cmp_list01');
        expect(ids[7]).toBe('cmp_table1');
        expect(childIds(def, 'sec_dash02')).toEqual(['cmp_keyva1']);
    });

    it('moves onto an empty-section drop zone by appending', () => {
        const res = computeDragEnd({
            active: nodeDrag('cmp_stat01'),
            over: overSection('sec_dash02'),
            definition: KITCHEN_SINK,
            screenId: 'scr_dash01',
        });
        expect(res).toMatchObject({ op: 'move', nodeId: 'cmp_stat01', toParentId: 'sec_dash02' });

        const { def } = applyDragResult(KITCHEN_SINK, res);
        expect(childIds(def, 'sec_dash02')).toEqual(['cmp_list01', 'cmp_keyva1', 'cmp_stat01']);
    });

    it('moves into a hovered container, at the end', () => {
        const res = computeDragEnd({
            active: nodeDrag('cmp_stat01'),
            over: overNode('cmp_card01'),
            definition: KITCHEN_SINK,
            screenId: 'scr_dash01',
        });
        expect(res).toMatchObject({ op: 'move', nodeId: 'cmp_stat01', toParentId: 'cmp_card01' });

        const { def } = applyDragResult(KITCHEN_SINK, res);
        const card = findNode(def, 'cmp_card01').node;
        expect(card.children[card.children.length - 1].id).toBe('cmp_stat01');
        expect(childIds(def, 'sec_dash01')).not.toContain('cmp_stat01');
    });
});

describe('computeDragEnd — palette inserts', () => {
    it('inserts into an empty section drop zone', () => {
        const res = computeDragEnd({
            active: paletteDrag('button'),
            over: overSection('sec_home01'),
            definition: BLANK_APP,
            screenId: 'scr_home01',
        });
        expect(res.op).toBe('insert');
        expect(res.parentId).toBe('sec_home01');
        expect(res.node.type).toBe('button');

        const { def, nodeId } = applyDragResult(BLANK_APP, res);
        expect(nodeId).toBe(res.node.id);
        expect(childIds(def, 'sec_home01')).toEqual([nodeId]);
    });

    it('inserts right after a hovered node (matches click-to-add)', () => {
        const res = computeDragEnd({
            active: paletteDrag('text'),
            over: overNode('cmp_intro1'), // index 1 in sec_dash01
            definition: KITCHEN_SINK,
            screenId: 'scr_dash01',
        });
        expect(res).toMatchObject({ op: 'insert', parentId: 'sec_dash01', index: 2 });

        const { def, nodeId } = applyDragResult(KITCHEN_SINK, res);
        expect(childIds(def, 'sec_dash01')[2]).toBe(nodeId);
        expect(findNode(def, nodeId).node.type).toBe('text');
    });

    it('inserts inside a hovered container, at the end', () => {
        const res = computeDragEnd({
            active: paletteDrag('callout'),
            over: overNode('cmp_form01'), // form container on scr_form01
            definition: KITCHEN_SINK,
            screenId: 'scr_form01',
        });
        expect(res).toMatchObject({ op: 'insert', parentId: 'cmp_form01', index: 6 });

        const { def, nodeId } = applyDragResult(KITCHEN_SINK, res);
        const form = findNode(def, 'cmp_form01').node;
        expect(form.children[form.children.length - 1].id).toBe(nodeId);
    });
});

describe('computeDragEnd — no-ops', () => {
    const base = { definition: KITCHEN_SINK, screenId: 'scr_dash01' };

    it('returns null without an over target or definition', () => {
        expect(computeDragEnd({ ...base, active: nodeDrag('cmp_headg1'), over: null })).toBeNull();
        expect(computeDragEnd({ active: nodeDrag('cmp_headg1'), over: overNode('cmp_intro1'), definition: null })).toBeNull();
        expect(computeDragEnd()).toBeNull();
    });

    it('returns null when dropped on itself', () => {
        expect(computeDragEnd({ ...base, active: nodeDrag('cmp_headg1'), over: overNode('cmp_headg1') })).toBeNull();
    });

    it('returns null for a container dropped into its own subtree', () => {
        expect(computeDragEnd({ ...base, active: nodeDrag('cmp_card01'), over: overNode('cmp_image1') })).toBeNull();
    });

    it('returns null when hovering one’s own parent container', () => {
        expect(computeDragEnd({ ...base, active: nodeDrag('cmp_image1'), over: overNode('cmp_card01') })).toBeNull();
    });

    it('returns null for unknown palette types, ids and sections', () => {
        expect(computeDragEnd({ ...base, active: paletteDrag('nope'), over: overNode('cmp_headg1') })).toBeNull();
        expect(computeDragEnd({ ...base, active: nodeDrag('cmp_gone99'), over: overNode('cmp_headg1') })).toBeNull();
        expect(computeDragEnd({ ...base, active: nodeDrag('cmp_headg1'), over: overNode('cmp_gone99') })).toBeNull();
        expect(computeDragEnd({ ...base, active: nodeDrag('cmp_headg1'), over: overSection('sec_gone99') })).toBeNull();
    });

    it('applyDragResult passes null through and never mutates', () => {
        expect(applyDragResult(KITCHEN_SINK, null)).toEqual({ def: KITCHEN_SINK, nodeId: null });
        // KITCHEN_SINK is deep-frozen — any mutation in the pipeline would throw
        // in the tests above; sanity-check the fixture is still intact here.
        expect(findScreen(KITCHEN_SINK, 'scr_dash01').sections[0].children[0].id).toBe('cmp_headg1');
    });
});

describe('cross-screen drag — screen tab drop targets', () => {
    it('round-trips the screentab droppable id', () => {
        expect(screenIdFromScreenTabDroppable(screenTabDroppableId('scr_form01'))).toBe('scr_form01');
        expect(screenIdFromScreenTabDroppable(sectionDroppableId('sec_dash01'))).toBeNull();
        expect(screenIdFromScreenTabDroppable('cmp_headg1')).toBeNull();
    });

    it('moves a node onto another screen’s first section when dropped on its tab', () => {
        // cmp_headg1 lives on scr_dash01; drop it on the scr_form01 tab.
        const res = computeDragEnd({
            active: nodeDrag('cmp_headg1'),
            over: overScreenTab('scr_form01'),
            definition: KITCHEN_SINK,
            screenId: 'scr_dash01',
        });
        expect(res).toMatchObject({ op: 'move', nodeId: 'cmp_headg1', toParentId: 'sec_form01', screenId: 'scr_form01' });

        const { def } = applyDragResult(KITCHEN_SINK, res);
        expect(childIds(def, 'sec_form01')).toContain('cmp_headg1'); // landed on the form screen
        expect(childIds(def, 'sec_dash01')).not.toContain('cmp_headg1'); // left the dashboard
    });

    it('inserts a palette component onto a screen tab’s first section', () => {
        const res = computeDragEnd({
            active: paletteDrag('button'),
            over: overScreenTab('scr_form01'),
            definition: KITCHEN_SINK,
            screenId: 'scr_dash01',
        });
        expect(res).toMatchObject({ op: 'insert', parentId: 'sec_form01', screenId: 'scr_form01' });

        const { def, nodeId } = applyDragResult(KITCHEN_SINK, res);
        expect(childIds(def, 'sec_form01')).toContain(nodeId);
    });

    it('returns null for an unknown screen tab', () => {
        expect(computeDragEnd({
            active: nodeDrag('cmp_headg1'),
            over: overScreenTab('scr_nope99'),
            definition: KITCHEN_SINK,
            screenId: 'scr_dash01',
        })).toBeNull();
    });

    it('resolveDrop commits a cross-screen move computed against the snapshot', () => {
        const out = resolveDrop({
            snapshot: KITCHEN_SINK,
            liveDefinition: KITCHEN_SINK, // handleDragOver skips screentab targets, so no transient move
            active: nodeDrag('cmp_stat01'),
            over: overScreenTab('scr_form01'),
            screenId: 'scr_dash01',
        });
        expect(out.op).toBe('move');
        expect(out.nodeId).toBe('cmp_stat01');
        expect(childIds(out.def, 'sec_form01')).toContain('cmp_stat01');
    });
});

describe('resolveDrop — transient dragOver reconciliation', () => {
    it('commits a transient cross-section move even when the drop lands on the node itself', () => {
        // onDragOver already reparented cmp_list01 (sec_dash02 → sec_dash01), so
        // by drop time over.id === active.id (a self-drop) and
        // computeDragEnd(snapshot) is null. resolveDrop must KEEP that move
        // instead of reverting the whole gesture (the reported bug).
        const liveDefinition = moveNode(KITCHEN_SINK, 'cmp_list01', { toParentId: 'sec_dash01', index: 3 });
        expect(liveDefinition).not.toBe(KITCHEN_SINK);

        const out = resolveDrop({
            snapshot: KITCHEN_SINK,
            liveDefinition,
            active: nodeDrag('cmp_list01'),
            over: overNode('cmp_list01'), // dropped on itself
            screenId: 'scr_dash01',
        });
        expect(out).toEqual({ def: liveDefinition, nodeId: 'cmp_list01', op: 'move' });
        expect(childIds(out.def, 'sec_dash01')).toContain('cmp_list01');
        expect(childIds(out.def, 'sec_dash02')).not.toContain('cmp_list01');
    });

    it('reverts (null) a self-drop when the live draft never changed', () => {
        expect(resolveDrop({
            snapshot: KITCHEN_SINK,
            liveDefinition: KITCHEN_SINK,
            active: nodeDrag('cmp_list01'),
            over: overNode('cmp_list01'),
            screenId: 'scr_dash01',
        })).toBeNull();
    });

    it('prefers a fresh drop target computed against the snapshot over the transient move', () => {
        const liveDefinition = moveNode(KITCHEN_SINK, 'cmp_list01', { toParentId: 'sec_dash01', index: 3 });
        const out = resolveDrop({
            snapshot: KITCHEN_SINK,
            liveDefinition,
            active: nodeDrag('cmp_list01'),
            over: overNode('cmp_table1'), // a real, different target in sec_dash01
            screenId: 'scr_dash01',
        });
        expect(out.op).toBe('move');
        expect(out.def).not.toBe(liveDefinition); // recomputed from the snapshot
        expect(childIds(out.def, 'sec_dash01')).toContain('cmp_list01');
    });

    it('returns null without a snapshot', () => {
        expect(resolveDrop({
            liveDefinition: KITCHEN_SINK, active: nodeDrag('cmp_list01'), over: overNode('cmp_list01'),
        })).toBeNull();
    });
});
