import { createRequire } from 'node:module';
import { describe, it, expect } from 'vitest';
import {
    ID_RE,
    newId,
    findNode,
    findScreen,
    findAction,
    collectIds,
    updateNodeProps,
    updateNodeStyle,
    setNodeEvent,
    setNodeComputed,
    updateNodeLogic,
    NODE_EVENTS,
    insertNode,
    moveNode,
    removeNode,
    duplicateNode,
    updateTheme,
    updateMeta,
    addScreen,
    removeScreen,
    updateScreen,
    addSection,
    removeSection,
    setAction,
    removeAction,
    ensureIds,
} from './definitionOps';
import { BLANK_APP, KITCHEN_SINK } from './sampleDefinitions';

// The save route validates with server/appStudio/validate.js — load the real
// thing (CJS via createRequire, same trick as runtime/catalogLockstep.test.js)
// so "still saveable" is asserted against the authority, not a mirror.
const { validateAppDefinition } = createRequire(import.meta.url)(
    '../../../../../../../server/appStudio/validate.js',
);

// Fixtures in sampleDefinitions.js are deep-frozen at module load, so every
// op in this file doubles as a mutation check: modules are strict mode, any
// write to a frozen object throws. This helper freezes ad-hoc fixtures too.
function deepFreeze(obj) {
    if (obj && typeof obj === 'object' && !Object.isFrozen(obj)) {
        Object.freeze(obj);
        for (const value of Object.values(obj)) deepFreeze(value);
    }
    return obj;
}

const textNode = (id = null) => ({
    id, type: 'text', props: { text: 'Hi', muted: false }, style: { span: 12 }, visible: true,
});

// ---------------------------------------------------------------------------
// id helpers
// ---------------------------------------------------------------------------

describe('newId / ID_RE', () => {
    it('generates ids with the right prefix that satisfy ID_RE', () => {
        expect(newId('screen')).toMatch(/^scr_[a-z0-9]{6}$/);
        expect(newId('section')).toMatch(/^sec_[a-z0-9]{6}$/);
        expect(newId('component')).toMatch(/^cmp_[a-z0-9]{6}$/);
        expect(newId('action')).toMatch(/^act_[a-z0-9]{6}$/);
        expect(newId('bogus')).toMatch(/^cmp_/); // unknown kinds fall back to cmp
        expect(ID_RE.test(newId('screen'))).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// lookups
// ---------------------------------------------------------------------------

describe('findNode', () => {
    it('finds a top-level node with its section as parent', () => {
        const found = findNode(KITCHEN_SINK, 'cmp_table1');
        expect(found.node.id).toBe('cmp_table1');
        expect(found.parent).toBe(KITCHEN_SINK.screens[0].sections[0]);
        expect(found.section).toBe(KITCHEN_SINK.screens[0].sections[0]);
        expect(found.screen).toBe(KITCHEN_SINK.screens[0]);
        expect(found.index).toBe(6);
    });

    it('finds a nested node with the container as parent and the outer section', () => {
        const found = findNode(KITCHEN_SINK, 'cmp_image1');
        expect(found.parent.id).toBe('cmp_card01');
        expect(found.section.id).toBe('sec_dash03');
        expect(found.screen.id).toBe('scr_dash01');
        expect(found.index).toBe(0);
    });

    it('finds a form field on the second screen', () => {
        const found = findNode(KITCHEN_SINK, 'cmp_inpri1');
        expect(found.parent.id).toBe('cmp_form01');
        expect(found.screen.id).toBe('scr_form01');
        expect(found.index).toBe(3);
    });

    it('returns null for unknown ids', () => {
        expect(findNode(KITCHEN_SINK, 'cmp_nope99')).toBeNull();
        expect(findNode(KITCHEN_SINK, 'sec_dash01')).toBeNull(); // sections are not nodes
    });
});

describe('findScreen / findAction', () => {
    it('returns the screen object by id, null otherwise', () => {
        expect(findScreen(KITCHEN_SINK, 'scr_form01')).toBe(KITCHEN_SINK.screens[1]);
        expect(findScreen(KITCHEN_SINK, 'scr_nope01')).toBeNull();
    });

    it('returns the action by id, null otherwise', () => {
        expect(findAction(KITCHEN_SINK, 'act_submit')).toBe(KITCHEN_SINK.actions.act_submit);
        expect(findAction(KITCHEN_SINK, 'act_nope01')).toBeNull();
        expect(findAction(KITCHEN_SINK, null)).toBeNull();
    });
});

describe('collectIds', () => {
    it('collects screen, section, component and action ids', () => {
        const ids = collectIds(KITCHEN_SINK);
        // 2 screens + 4 sections + 24 components + 5 actions
        expect(ids.size).toBe(35);
        for (const id of ['scr_dash01', 'sec_form01', 'cmp_inqty1', 'cmp_image1', 'act_docs01']) {
            expect(ids.has(id)).toBe(true);
        }
    });

    it('handles the blank app', () => {
        expect([...collectIds(BLANK_APP)].sort()).toEqual(['scr_home01', 'sec_home01']);
    });
});

// ---------------------------------------------------------------------------
// node patches
// ---------------------------------------------------------------------------

describe('updateNodeProps', () => {
    it('shallow-merges the patch and keeps untouched branches by reference', () => {
        const next = updateNodeProps(KITCHEN_SINK, 'cmp_headg1', { text: 'Renamed' });
        expect(next).not.toBe(KITCHEN_SINK);
        const node = findNode(next, 'cmp_headg1').node;
        expect(node.props).toEqual({ text: 'Renamed', level: 1 });
        // structural sharing: only the path to the node was rebuilt
        expect(next.screens[1]).toBe(KITCHEN_SINK.screens[1]);
        expect(next.screens[0].sections[1]).toBe(KITCHEN_SINK.screens[0].sections[1]);
        expect(next.actions).toBe(KITCHEN_SINK.actions);
    });

    it('returns the same reference for a no-op patch or an unknown node', () => {
        expect(updateNodeProps(KITCHEN_SINK, 'cmp_headg1', { level: 1 })).toBe(KITCHEN_SINK);
        expect(updateNodeProps(KITCHEN_SINK, 'cmp_headg1', {})).toBe(KITCHEN_SINK);
        expect(updateNodeProps(KITCHEN_SINK, 'cmp_nope99', { text: 'x' })).toBe(KITCHEN_SINK);
        expect(updateNodeProps(KITCHEN_SINK, 'cmp_headg1', null)).toBe(KITCHEN_SINK);
    });
});

describe('updateNodeStyle', () => {
    it('patches style on a nested node', () => {
        const next = updateNodeStyle(KITCHEN_SINK, 'cmp_image1', { span: 12 });
        const node = findNode(next, 'cmp_image1').node;
        expect(node.style).toEqual({ span: 12, height: 'md', radius: 'md', align: 'start' });
        expect(next.screens[1]).toBe(KITCHEN_SINK.screens[1]);
    });

    it('returns the same reference when nothing changes', () => {
        expect(updateNodeStyle(KITCHEN_SINK, 'cmp_image1', { height: 'md' })).toBe(KITCHEN_SINK);
    });
});

describe('setNodeEvent', () => {
    it('rewires onClick to another action', () => {
        const next = setNodeEvent(KITCHEN_SINK, 'cmp_refre1', 'onClick', 'act_toast1');
        expect(findNode(next, 'cmp_refre1').node.onClick).toBe('act_toast1');
        expect(next.screens[1]).toBe(KITCHEN_SINK.screens[1]);
    });

    it('clears the event with null (the key disappears)', () => {
        const next = setNodeEvent(KITCHEN_SINK, 'cmp_form01', 'onSubmit', null);
        expect('onSubmit' in findNode(next, 'cmp_form01').node).toBe(false);
    });

    it('is a no-op for same value, unknown events and unknown nodes', () => {
        expect(setNodeEvent(KITCHEN_SINK, 'cmp_refre1', 'onClick', 'act_fetch1')).toBe(KITCHEN_SINK);
        expect(setNodeEvent(KITCHEN_SINK, 'cmp_headg1', 'onClick', null)).toBe(KITCHEN_SINK);
        expect(setNodeEvent(KITCHEN_SINK, 'cmp_refre1', 'onHover', 'act_fetch1')).toBe(KITCHEN_SINK);
        expect(setNodeEvent(KITCHEN_SINK, 'cmp_nope99', 'onClick', 'act_fetch1')).toBe(KITCHEN_SINK);
    });

    it('accepts the full v2 event vocabulary (onRowClick / onCardMove)', () => {
        expect(NODE_EVENTS).toContain('onRowClick');
        expect(NODE_EVENTS).toContain('onCardMove');
        const withRow = setNodeEvent(KITCHEN_SINK, 'cmp_refre1', 'onRowClick', 'act_toast1');
        expect(findNode(withRow, 'cmp_refre1').node.onRowClick).toBe('act_toast1');
        const withCard = setNodeEvent(KITCHEN_SINK, 'cmp_refre1', 'onCardMove', 'act_fetch1');
        expect(findNode(withCard, 'cmp_refre1').node.onCardMove).toBe('act_fetch1');
    });
});

describe('updateNodeLogic / setNodeComputed', () => {
    it('sets and clears visibleWhen / enabledWhen', () => {
        const withVis = updateNodeLogic(KITCHEN_SINK, 'cmp_refre1', { visibleWhen: 'form.ok == true' });
        expect(findNode(withVis, 'cmp_refre1').node.visibleWhen).toBe('form.ok == true');
        const cleared = updateNodeLogic(withVis, 'cmp_refre1', { visibleWhen: '' });
        expect('visibleWhen' in findNode(cleared, 'cmp_refre1').node).toBe(false);
    });

    it('sets visible:false and keeps unrelated keys untouched', () => {
        const next = updateNodeLogic(KITCHEN_SINK, 'cmp_refre1', { visible: false });
        expect(findNode(next, 'cmp_refre1').node.visible).toBe(false);
    });

    it('setNodeComputed writes and clears node.computed', () => {
        const next = setNodeComputed(KITCHEN_SINK, 'cmp_refre1', { label: "item.done ? 'Done' : 'Open'" });
        expect(findNode(next, 'cmp_refre1').node.computed).toEqual({ label: "item.done ? 'Done' : 'Open'" });
        const cleared = setNodeComputed(next, 'cmp_refre1', {});
        expect('computed' in findNode(cleared, 'cmp_refre1').node).toBe(false);
    });

    it('is a no-op (same ref) for an empty patch, empty computed and unknown node', () => {
        expect(updateNodeLogic(KITCHEN_SINK, 'cmp_refre1', {})).toBe(KITCHEN_SINK);
        expect(setNodeComputed(KITCHEN_SINK, 'cmp_refre1', {})).toBe(KITCHEN_SINK);
        expect(setNodeComputed(KITCHEN_SINK, 'cmp_nope99', { x: '1' })).toBe(KITCHEN_SINK);
        expect(updateNodeLogic(KITCHEN_SINK, 'cmp_refre1', { bogusKey: 'x' })).toBe(KITCHEN_SINK);
    });
});

// ---------------------------------------------------------------------------
// insert / move / remove / duplicate
// ---------------------------------------------------------------------------

describe('insertNode', () => {
    it('inserts into a section at the given index', () => {
        const { def, nodeId } = insertNode(KITCHEN_SINK, {
            screenId: 'scr_dash01', parentId: 'sec_dash02', index: 1, node: textNode('cmp_new001'),
        });
        expect(nodeId).toBe('cmp_new001');
        const children = findScreen(def, 'scr_dash01').sections[1].children;
        expect(children.map((c) => c.id)).toEqual(['cmp_list01', 'cmp_new001', 'cmp_keyva1']);
        expect(def.screens[1]).toBe(KITCHEN_SINK.screens[1]);
    });

    it('inserts into a container component', () => {
        const { def, nodeId } = insertNode(KITCHEN_SINK, {
            parentId: 'cmp_card01', index: 0, node: textNode('cmp_new002'),
        });
        expect(nodeId).toBe('cmp_new002');
        expect(findNode(def, 'cmp_card01').node.children[0].id).toBe('cmp_new002');
    });

    it('clamps the index and appends when index is omitted', () => {
        const big = insertNode(KITCHEN_SINK, { parentId: 'sec_dash02', index: 999, node: textNode('cmp_new003') });
        expect(findScreen(big.def, 'scr_dash01').sections[1].children[2].id).toBe('cmp_new003');
        const neg = insertNode(KITCHEN_SINK, { parentId: 'sec_dash02', index: -5, node: textNode('cmp_new004') });
        expect(findScreen(neg.def, 'scr_dash01').sections[1].children[0].id).toBe('cmp_new004');
        const none = insertNode(KITCHEN_SINK, { parentId: 'sec_dash02', node: textNode('cmp_new005') });
        expect(findScreen(none.def, 'scr_dash01').sections[1].children[2].id).toBe('cmp_new005');
    });

    it('assigns a fresh id when the node has none or the id is taken', () => {
        const noId = insertNode(KITCHEN_SINK, { parentId: 'sec_dash02', node: textNode(null) });
        expect(noId.nodeId).toMatch(ID_RE);
        const taken = insertNode(KITCHEN_SINK, { parentId: 'sec_dash02', node: textNode('cmp_table1') });
        expect(taken.nodeId).toMatch(ID_RE);
        expect(taken.nodeId).not.toBe('cmp_table1');
        expect(collectIds(taken.def).size).toBe(36);
    });

    it('fails softly on a missing or non-container parent', () => {
        const missing = insertNode(KITCHEN_SINK, { parentId: 'cmp_nope99', node: textNode('cmp_new006') });
        expect(missing.def).toBe(KITCHEN_SINK);
        expect(missing.nodeId).toBeNull();
        const leaf = insertNode(KITCHEN_SINK, { parentId: 'cmp_headg1', node: textNode('cmp_new007') });
        expect(leaf.def).toBe(KITCHEN_SINK);
        expect(leaf.nodeId).toBeNull();
        // scope hint pointing at the wrong screen
        const wrongScreen = insertNode(KITCHEN_SINK, {
            screenId: 'scr_form01', parentId: 'sec_dash01', node: textNode('cmp_new008'),
        });
        expect(wrongScreen.def).toBe(KITCHEN_SINK);
        expect(wrongScreen.nodeId).toBeNull();
    });
});

describe('moveNode', () => {
    it('reorders within the same parent (index addresses the post-removal list)', () => {
        const next = moveNode(KITCHEN_SINK, 'cmp_headg1', { toParentId: 'sec_dash01', index: 3 });
        const ids = findScreen(next, 'scr_dash01').sections[0].children.map((c) => c.id);
        expect(ids).toEqual([
            'cmp_intro1', 'cmp_stat01', 'cmp_stat02', 'cmp_headg1', 'cmp_refre1', 'cmp_divid1', 'cmp_table1',
        ]);
        expect(next.screens[1]).toBe(KITCHEN_SINK.screens[1]);
    });

    it('moves across sections', () => {
        const next = moveNode(KITCHEN_SINK, 'cmp_table1', { toParentId: 'sec_dash02', index: 0 });
        const [a, b] = findScreen(next, 'scr_dash01').sections;
        expect(a.children).toHaveLength(6);
        expect(b.children.map((c) => c.id)).toEqual(['cmp_table1', 'cmp_list01', 'cmp_keyva1']);
    });

    it('moves into a container and clamps the index', () => {
        const next = moveNode(KITCHEN_SINK, 'cmp_intro1', { toParentId: 'cmp_card01', index: 999 });
        const card = findNode(next, 'cmp_card01').node;
        expect(card.children[card.children.length - 1].id).toBe('cmp_intro1');
        expect(findScreen(next, 'scr_dash01').sections[0].children).toHaveLength(6);
    });

    it('is a no-op when moving into itself or its own descendant', () => {
        expect(moveNode(KITCHEN_SINK, 'cmp_card01', { toParentId: 'cmp_card01', index: 0 })).toBe(KITCHEN_SINK);
        // nest a container inside the card, then try to move the card into it
        const { def: withNested } = insertNode(KITCHEN_SINK, {
            parentId: 'cmp_card01', index: 0,
            node: { id: 'cmp_nest01', type: 'card', props: {}, style: { span: 12 }, visible: true, children: [] },
        });
        expect(moveNode(withNested, 'cmp_card01', { toParentId: 'cmp_nest01', index: 0 })).toBe(withNested);
    });

    it('is a no-op when the node would land where it already is', () => {
        expect(moveNode(KITCHEN_SINK, 'cmp_intro1', { toParentId: 'sec_dash01', index: 1 })).toBe(KITCHEN_SINK);
    });

    it('is a no-op for unknown nodes or a vanished target parent', () => {
        expect(moveNode(KITCHEN_SINK, 'cmp_nope99', { toParentId: 'sec_dash02', index: 0 })).toBe(KITCHEN_SINK);
        expect(moveNode(KITCHEN_SINK, 'cmp_table1', { toParentId: 'cmp_nope99', index: 0 })).toBe(KITCHEN_SINK);
        // non-container target
        expect(moveNode(KITCHEN_SINK, 'cmp_table1', { toParentId: 'cmp_headg1', index: 0 })).toBe(KITCHEN_SINK);
    });
});

describe('removeNode', () => {
    it('removes a nested node', () => {
        const next = removeNode(KITCHEN_SINK, 'cmp_image1');
        expect(findNode(next, 'cmp_image1')).toBeNull();
        expect(findNode(next, 'cmp_card01').node.children).toHaveLength(4);
        expect(next.screens[1]).toBe(KITCHEN_SINK.screens[1]);
    });

    it('returns the same reference for unknown nodes', () => {
        expect(removeNode(KITCHEN_SINK, 'cmp_nope99')).toBe(KITCHEN_SINK);
    });
});

describe('duplicateNode', () => {
    it('re-ids the whole subtree and inserts the copy right after the original', () => {
        const before = collectIds(KITCHEN_SINK);
        const { def, nodeId } = duplicateNode(KITCHEN_SINK, 'cmp_card01');
        const section = findScreen(def, 'scr_dash01').sections[2];
        expect(section.children.map((c) => c.id)).toEqual(['cmp_card01', nodeId]);

        // card + 5 children = 6 brand-new ids, no collisions anywhere
        const after = collectIds(def);
        expect(after.size).toBe(before.size + 6);
        const dup = section.children[1];
        const subIds = [dup.id, ...dup.children.map((c) => c.id)];
        expect(new Set(subIds).size).toBe(6);
        for (const id of subIds) {
            expect(before.has(id)).toBe(false);
            expect(id).toMatch(ID_RE);
        }
    });

    it('duplicates a leaf directly after the original', () => {
        const { def, nodeId } = duplicateNode(KITCHEN_SINK, 'cmp_divid1');
        const ids = findScreen(def, 'scr_dash01').sections[0].children.map((c) => c.id);
        expect(ids.indexOf(nodeId)).toBe(ids.indexOf('cmp_divid1') + 1);
    });

    it('deep-copies props so later edits cannot bleed into the original', () => {
        const { def, nodeId } = duplicateNode(KITCHEN_SINK, 'cmp_table1');
        const dup = findNode(def, nodeId).node;
        const orig = findNode(def, 'cmp_table1').node;
        expect(dup.props).toEqual(orig.props);
        expect(dup.props).not.toBe(orig.props);
        expect(dup.props.columns).not.toBe(orig.props.columns);
    });

    it('returns null for unknown nodes', () => {
        const { def, nodeId } = duplicateNode(KITCHEN_SINK, 'cmp_nope99');
        expect(def).toBe(KITCHEN_SINK);
        expect(nodeId).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// theme / meta
// ---------------------------------------------------------------------------

describe('updateTheme / updateMeta', () => {
    it('shallow-merges theme and keeps screens by reference', () => {
        const next = updateTheme(KITCHEN_SINK, { primary: '#0369A1' });
        expect(next.theme).toEqual({ ...KITCHEN_SINK.theme, primary: '#0369A1' });
        expect(next.screens).toBe(KITCHEN_SINK.screens);
    });

    it('shallow-merges meta', () => {
        const next = updateMeta(KITCHEN_SINK, { name: 'Renamed app' });
        expect(next.meta.name).toBe('Renamed app');
        expect(next.meta.icon).toBe(KITCHEN_SINK.meta.icon);
    });

    it('returns the same reference for no-op patches', () => {
        expect(updateTheme(KITCHEN_SINK, { radius: 'md' })).toBe(KITCHEN_SINK);
        expect(updateMeta(KITCHEN_SINK, { name: 'Kitchen sink' })).toBe(KITCHEN_SINK);
        expect(updateTheme(KITCHEN_SINK, null)).toBe(KITCHEN_SINK);
    });
});

// ---------------------------------------------------------------------------
// screens & sections
// ---------------------------------------------------------------------------

describe('addScreen', () => {
    it('appends a screen with one empty default section', () => {
        const { def, screenId } = addScreen(KITCHEN_SINK, { name: 'Reports' });
        expect(screenId).toMatch(/^scr_/);
        expect(def.screens).toHaveLength(3);
        const screen = findScreen(def, screenId);
        expect(screen.name).toBe('Reports');
        expect(screen.sections).toHaveLength(1);
        expect(screen.sections[0].id).toMatch(/^sec_/);
        expect(screen.sections[0].children).toEqual([]);
        expect(screen.sections[0].style).toEqual({ padding: 4, gap: 3, background: 'none' });
        // existing screens untouched
        expect(def.screens[0]).toBe(KITCHEN_SINK.screens[0]);
        expect(def.homeScreenId).toBe(KITCHEN_SINK.homeScreenId);
    });

    it('defaults the name', () => {
        const { def, screenId } = addScreen(KITCHEN_SINK);
        expect(findScreen(def, screenId).name).toBe('Screen');
    });
});

describe('removeScreen', () => {
    it('removes a screen', () => {
        const next = removeScreen(KITCHEN_SINK, 'scr_form01');
        expect(next.screens.map((s) => s.id)).toEqual(['scr_dash01']);
        expect(next.homeScreenId).toBe('scr_dash01');
        // Sections without a reference to the removed screen keep their identity
        // (sec_dash03 holds the button that navigated there, so it is rebuilt).
        expect(next.screens[0].sections[0]).toBe(KITCHEN_SINK.screens[0].sections[0]);
        expect(next.screens[0].sections[1]).toBe(KITCHEN_SINK.screens[0].sections[1]);
    });

    it('repoints homeScreenId when the home screen goes', () => {
        const next = removeScreen(KITCHEN_SINK, 'scr_dash01');
        expect(next.homeScreenId).toBe('scr_form01');
    });

    it('refuses to remove the last screen (same reference)', () => {
        expect(removeScreen(BLANK_APP, 'scr_home01')).toBe(BLANK_APP);
        expect(removeScreen(KITCHEN_SINK, 'scr_nope01')).toBe(KITCHEN_SINK);
    });

    it('drops navigate actions aimed at the removed screen and their event wiring', () => {
        const next = removeScreen(KITCHEN_SINK, 'scr_form01');
        expect(next.actions.act_gonav1).toBeUndefined();
        expect('onClick' in findNode(next, 'cmp_gofrm1').node).toBe(false);
        // unrelated actions + wiring stay
        expect(next.actions.act_docs01).toBe(KITCHEN_SINK.actions.act_docs01);
        expect(findNode(next, 'cmp_docsb1').node.onClick).toBe('act_docs01');
    });

    it('clears an onSuccess/onError navigateTo pointing at the removed screen', () => {
        const next = removeScreen(KITCHEN_SINK, 'scr_dash01');
        expect('navigateTo' in next.actions.act_submit.onSuccess).toBe(false);
        // the rest of the effects survive untouched
        expect(next.actions.act_submit.onSuccess.toast).toEqual(
            KITCHEN_SINK.actions.act_submit.onSuccess.toast,
        );
        expect(next.actions.act_submit.onError).toBe(KITCHEN_SINK.actions.act_submit.onError);
    });

    it('drops navigate steps inside sequences, including nested branches', () => {
        const withSequence = {
            ...KITCHEN_SINK,
            actions: {
                ...KITCHEN_SINK.actions,
                act_seq001: {
                    kind: 'sequence',
                    steps: [
                        { kind: 'toast', message: 'Saved.', tone: 'success' },
                        { kind: 'navigate', screenId: 'scr_form01' },
                        {
                            kind: 'condition',
                            expr: 'form.ok == true',
                            then: [{ kind: 'navigate', screenId: 'scr_form01' }],
                            else: [{ kind: 'navigate', screenId: 'scr_dash01' }],
                        },
                    ],
                },
            },
        };
        const next = removeScreen(deepFreeze(withSequence), 'scr_form01');
        const steps = next.actions.act_seq001.steps;
        expect(steps.map((s) => s.kind)).toEqual(['toast', 'condition']);
        expect(steps[1].then).toEqual([]);
        expect(steps[1].else).toEqual([{ kind: 'navigate', screenId: 'scr_dash01' }]);
    });

    it('leaves a definition the SERVER validator still accepts (no dangling refs)', () => {
        // The save route rejects a dangling screen reference with 422, which is
        // what made the app unsaveable — assert against the authoritative
        // validator itself rather than a hand-rolled approximation.
        // The fixture predates the v2 schemaVersion bump; everything else in it
        // is already v2-shaped.
        const base = deepFreeze({ ...KITCHEN_SINK, schemaVersion: 2 });
        const before = validateAppDefinition(base);
        expect(before.errors).toEqual([]);

        const next = removeScreen(base, 'scr_form01');
        const after = validateAppDefinition(next);
        expect(after.errors).toEqual([]);
        expect(after.ok).toBe(true);
    });
});

describe('updateScreen', () => {
    it('patches screen settings', () => {
        const next = updateScreen(KITCHEN_SINK, 'scr_form01', { name: 'Request', showInNav: false });
        const screen = findScreen(next, 'scr_form01');
        expect(screen.name).toBe('Request');
        expect(screen.showInNav).toBe(false);
        expect(screen.sections).toBe(KITCHEN_SINK.screens[1].sections);
        expect(next.screens[0]).toBe(KITCHEN_SINK.screens[0]);
    });

    it('ignores structural keys (id, sections) and no-op patches', () => {
        expect(updateScreen(KITCHEN_SINK, 'scr_form01', { id: 'scr_evil01', sections: [] })).toBe(KITCHEN_SINK);
        const next = updateScreen(KITCHEN_SINK, 'scr_form01', { id: 'scr_evil01', name: 'X' });
        expect(findScreen(next, 'scr_form01').name).toBe('X');
        expect(updateScreen(KITCHEN_SINK, 'scr_form01', { name: 'New request' })).toBe(KITCHEN_SINK);
        expect(updateScreen(KITCHEN_SINK, 'scr_nope01', { name: 'X' })).toBe(KITCHEN_SINK);
    });
});

describe('addSection', () => {
    it('inserts an empty section at the index (clamped)', () => {
        const { def, sectionId } = addSection(KITCHEN_SINK, 'scr_dash01', 1);
        const screen = findScreen(def, 'scr_dash01');
        expect(screen.sections).toHaveLength(4);
        expect(screen.sections[1].id).toBe(sectionId);
        expect(screen.sections[1].children).toEqual([]);
        expect(def.screens[1]).toBe(KITCHEN_SINK.screens[1]);

        const clamped = addSection(KITCHEN_SINK, 'scr_dash01', 99);
        const sections = findScreen(clamped.def, 'scr_dash01').sections;
        expect(sections[sections.length - 1].id).toBe(clamped.sectionId);
    });

    it('fails softly for unknown screens', () => {
        const { def, sectionId } = addSection(KITCHEN_SINK, 'scr_nope01', 0);
        expect(def).toBe(KITCHEN_SINK);
        expect(sectionId).toBeNull();
    });
});

describe('removeSection', () => {
    it('removes a section', () => {
        const next = removeSection(KITCHEN_SINK, 'sec_dash02');
        expect(findScreen(next, 'scr_dash01').sections.map((s) => s.id)).toEqual(['sec_dash01', 'sec_dash03']);
        expect(next.screens[1]).toBe(KITCHEN_SINK.screens[1]);
    });

    it('replaces the only section with a fresh empty one', () => {
        const next = removeSection(KITCHEN_SINK, 'sec_form01');
        const screen = findScreen(next, 'scr_form01');
        expect(screen.sections).toHaveLength(1);
        expect(screen.sections[0].id).not.toBe('sec_form01');
        expect(screen.sections[0].id).toMatch(/^sec_/);
        expect(screen.sections[0].children).toEqual([]);
    });

    it('returns the same reference for unknown sections', () => {
        expect(removeSection(KITCHEN_SINK, 'sec_nope01')).toBe(KITCHEN_SINK);
    });
});

// ---------------------------------------------------------------------------
// actions
// ---------------------------------------------------------------------------

describe('setAction', () => {
    it('creates an action when the id is null', () => {
        const { def, actionId } = setAction(KITCHEN_SINK, null, { kind: 'toast', message: 'Hi', tone: 'info' });
        expect(actionId).toMatch(/^act_/);
        expect(def.actions[actionId]).toEqual({ kind: 'toast', message: 'Hi', tone: 'info' });
        expect(Object.keys(def.actions)).toHaveLength(6);
        expect(def.screens).toBe(KITCHEN_SINK.screens);
    });

    it('upserts an existing action in place', () => {
        const { def, actionId } = setAction(KITCHEN_SINK, 'act_toast1', { kind: 'toast', message: 'Bye', tone: 'warning' });
        expect(actionId).toBe('act_toast1');
        expect(def.actions.act_toast1.message).toBe('Bye');
        expect(Object.keys(def.actions)).toHaveLength(5);
    });

    it('rejects a missing action payload', () => {
        const { def, actionId } = setAction(KITCHEN_SINK, null, null);
        expect(def).toBe(KITCHEN_SINK);
        expect(actionId).toBeNull();
    });
});

describe('removeAction', () => {
    it('removes the action and strips onClick/onSubmit refs to it', () => {
        const next = removeAction(KITCHEN_SINK, 'act_fetch1');
        expect(next.actions.act_fetch1).toBeUndefined();
        expect('onClick' in findNode(next, 'cmp_refre1').node).toBe(false);
        // unrelated wiring stays
        expect(findNode(next, 'cmp_docsb1').node.onClick).toBe('act_docs01');
        // bindings are NOT stripped here — the inspector surfaces those
        expect(findNode(next, 'cmp_table1').node.props.source.actionId).toBe('act_fetch1');
    });

    it('strips a form onSubmit', () => {
        const next = removeAction(KITCHEN_SINK, 'act_submit');
        expect('onSubmit' in findNode(next, 'cmp_form01').node).toBe(false);
    });

    it('keeps screens without references by identity', () => {
        const next = removeAction(KITCHEN_SINK, 'act_toast1'); // only referenced on screen 2
        expect(next.screens[0]).toBe(KITCHEN_SINK.screens[0]);
        expect(next.screens[1]).not.toBe(KITCHEN_SINK.screens[1]);
    });

    it('returns the same reference for unknown actions', () => {
        expect(removeAction(KITCHEN_SINK, 'act_nope01')).toBe(KITCHEN_SINK);
    });
});

// ---------------------------------------------------------------------------
// ensureIds
// ---------------------------------------------------------------------------

describe('ensureIds', () => {
    it('leaves a clean definition untouched (same reference, changed=false)', () => {
        expect(ensureIds(KITCHEN_SINK)).toEqual({ def: KITCHEN_SINK, changed: false });
        expect(ensureIds(KITCHEN_SINK).def).toBe(KITCHEN_SINK);
        expect(ensureIds(BLANK_APP).def).toBe(BLANK_APP);
    });

    it('fills missing ids everywhere and repoints a dangling homeScreenId', () => {
        const broken = deepFreeze({
            schemaVersion: 1,
            meta: { name: 'x', description: '', icon: null },
            theme: {},
            homeScreenId: undefined,
            screens: [{
                name: 'One',
                sections: [{ children: [{ type: 'text', props: { text: 'a' } }] }],
            }],
            actions: {},
        });
        const { def, changed } = ensureIds(broken);
        expect(changed).toBe(true);
        expect(def.screens[0].id).toMatch(/^scr_[a-z0-9]{6}$/);
        expect(def.screens[0].sections[0].id).toMatch(/^sec_[a-z0-9]{6}$/);
        expect(def.screens[0].sections[0].children[0].id).toMatch(/^cmp_[a-z0-9]{6}$/);
        expect(def.homeScreenId).toBe(def.screens[0].id);
        expect(collectIds(def).size).toBe(3);
    });

    it('regenerates malformed ids and rewrites references unambiguously', () => {
        const broken = deepFreeze({
            schemaVersion: 1,
            meta: { name: 'x', description: '', icon: null },
            theme: {},
            homeScreenId: 'home',
            screens: [
                {
                    id: 'home', name: 'Home',
                    sections: [{
                        id: 'sec_ok0001',
                        children: [
                            { id: 'cmp_btn001', type: 'button', props: { label: 'Go' }, onClick: 'doStuff' },
                            {
                                id: 'cmp_stat99', type: 'stat',
                                props: { label: 'S', value: { kind: 'actionResult', actionId: 'doStuff', path: 'n' } },
                            },
                        ],
                    }],
                },
                { id: 'scr_second', name: 'Two', sections: [{ id: 'sec_ok0002', children: [] }] },
            ],
            actions: {
                doStuff: { kind: 'run_automation', automationId: null, onSuccess: { navigateTo: 'home' } },
                act_nav001: { kind: 'navigate', screenId: 'home' },
            },
        });
        const { def, changed } = ensureIds(broken);
        expect(changed).toBe(true);

        const newScreenId = def.screens[0].id;
        expect(newScreenId).toMatch(/^scr_[a-z0-9]{6}$/);
        expect(def.homeScreenId).toBe(newScreenId);

        const newActionId = Object.keys(def.actions).find((id) => id !== 'act_nav001');
        expect(newActionId).toMatch(/^act_[a-z0-9]{6}$/);
        expect(def.actions.act_nav001.screenId).toBe(newScreenId);
        expect(def.actions[newActionId].onSuccess.navigateTo).toBe(newScreenId);
        expect(findNode(def, 'cmp_btn001').node.onClick).toBe(newActionId);
        expect(findNode(def, 'cmp_stat99').node.props.value.actionId).toBe(newActionId);

        // untouched screen keeps its identity
        expect(def.screens[1]).toBe(broken.screens[1]);
    });

    it('lets the first duplicate keep its id and does not rewrite refs to it', () => {
        const broken = deepFreeze({
            schemaVersion: 1,
            meta: { name: 'x', description: '', icon: null },
            theme: {},
            homeScreenId: 'scr_aaa001',
            screens: [
                { id: 'scr_aaa001', name: 'A', sections: [{ id: 'sec_aaa001', children: [] }] },
                {
                    id: 'scr_aaa001', name: 'B',
                    sections: [{
                        id: 'sec_bbb001',
                        children: [
                            { id: 'cmp_ccc001', type: 'text', props: { text: 'a' } },
                            { id: 'cmp_ccc001', type: 'text', props: { text: 'b' } },
                        ],
                    }],
                },
            ],
            actions: { act_nav123: { kind: 'navigate', screenId: 'scr_aaa001' } },
        });
        const { def, changed } = ensureIds(broken);
        expect(changed).toBe(true);
        expect(def.screens[0].id).toBe('scr_aaa001');
        expect(def.screens[1].id).not.toBe('scr_aaa001');
        // refs to the (still existing) first occurrence stay put
        expect(def.homeScreenId).toBe('scr_aaa001');
        expect(def.actions.act_nav123.screenId).toBe('scr_aaa001');
        const kids = def.screens[1].sections[0].children;
        expect(kids[0].id).toBe('cmp_ccc001');
        expect(kids[1].id).not.toBe('cmp_ccc001');
        // everything unique afterwards: 2 screens + 2 sections + 2 nodes + 1 action
        expect(collectIds(def).size).toBe(7);
    });

    it('does not rewrite references whose old id was regenerated ambiguously', () => {
        const broken = deepFreeze({
            schemaVersion: 1,
            meta: { name: 'x', description: '', icon: null },
            theme: {},
            homeScreenId: 'home',
            screens: [
                { id: 'home', name: 'A', sections: [{ id: 'sec_aaa001', children: [] }] },
                { id: 'home', name: 'B', sections: [{ id: 'sec_bbb001', children: [] }] },
            ],
            actions: { act_nav123: { kind: 'navigate', screenId: 'home' } },
        });
        const { def } = ensureIds(broken);
        // 'home' mapped to two different new ids → the navigate ref is left alone
        expect(def.actions.act_nav123.screenId).toBe('home');
        // but homeScreenId gets the first-screen fallback so the app stays renderable
        expect(def.homeScreenId).toBe(def.screens[0].id);
        expect(def.screens[0].id).not.toBe(def.screens[1].id);
    });
});

// ---------------------------------------------------------------------------
// immutability sweep
// ---------------------------------------------------------------------------

describe('immutability', () => {
    it('never mutates a deep-frozen input across the whole op surface', () => {
        // KITCHEN_SINK/BLANK_APP are deep-frozen in sampleDefinitions.js; any
        // in-place write inside an op would throw in strict mode.
        expect(() => {
            updateNodeProps(KITCHEN_SINK, 'cmp_headg1', { text: 'x' });
            updateNodeStyle(KITCHEN_SINK, 'cmp_image1', { span: 3 });
            setNodeEvent(KITCHEN_SINK, 'cmp_refre1', 'onClick', 'act_toast1');
            insertNode(KITCHEN_SINK, { parentId: 'cmp_card01', index: 0, node: textNode('cmp_frz001') });
            moveNode(KITCHEN_SINK, 'cmp_table1', { toParentId: 'sec_dash02', index: 0 });
            removeNode(KITCHEN_SINK, 'cmp_image1');
            duplicateNode(KITCHEN_SINK, 'cmp_card01');
            updateTheme(KITCHEN_SINK, { primary: '#0369A1' });
            updateMeta(KITCHEN_SINK, { name: 'x' });
            addScreen(KITCHEN_SINK, { name: 'x' });
            removeScreen(KITCHEN_SINK, 'scr_form01');
            updateScreen(KITCHEN_SINK, 'scr_form01', { name: 'x' });
            addSection(KITCHEN_SINK, 'scr_dash01', 0);
            removeSection(KITCHEN_SINK, 'sec_form01');
            setAction(KITCHEN_SINK, null, { kind: 'toast', message: 'x', tone: 'info' });
            removeAction(KITCHEN_SINK, 'act_fetch1');
            ensureIds(KITCHEN_SINK);
            ensureIds(BLANK_APP);
        }).not.toThrow();
        // and the fixture still deep-equals a pristine copy of itself
        expect(KITCHEN_SINK.screens[0].sections[0].children).toHaveLength(7);
        expect(Object.keys(KITCHEN_SINK.actions)).toHaveLength(5);
    });
});

/**
 * A `modal` node is also an ACTION TARGET. Deleting one used to leave every
 * open_modal/close_modal reference behind, and a dangling modalId is a hard
 * validation error server-side — so the save 422s, useAppAutosave never
 * advances its baseline, every later keystroke re-fires the same rejected save,
 * and the editor refuses to close because closing flushes. Deleting a dialog
 * jammed the editor on an error about a component that no longer existed.
 */
describe('removeNode — a deleted dialog takes its wiring with it', () => {
    const requireServer = createRequire(import.meta.url);
    const { validateAppDefinition } = requireServer('../../../../../../../server/appStudio/validate.js');
    const { canonicalizeAppDefinition } = requireServer('../../../../../../../server/appStudio/canonicalize.js');

    /** Would the server accept this definition? */
    const serverErrors = (def) => validateAppDefinition(canonicalizeAppDefinition(def).def).errors;

    function defWithModal(extra = {}) {
        return {
            schemaVersion: 2,
            meta: { name: 'T' },
            theme: {},
            homeScreenId: 'scr_aaaaaa',
            screens: [{
                id: 'scr_aaaaaa', name: 'T', showInNav: true, maxWidth: 'medium',
                sections: [{
                    id: 'sec_aaaaaa',
                    style: { padding: 4, gap: 3, background: 'none' },
                    children: [
                        { id: 'cmp_dialog', type: 'modal', props: { title: 'Confirm' }, style: {}, children: [] },
                        { id: 'cmp_button', type: 'button', props: { label: 'Open', variant: 'primary', role: 'button' }, style: {}, onClick: 'act_open0' },
                    ],
                }],
            }],
            actions: { act_open0: { kind: 'open_modal', modalId: 'cmp_dialog' } },
            ...extra,
        };
    }

    it('the wedge is real: the server rejects a dangling modalId', () => {
        const orphaned = defWithModal();
        // Delete the dialog the way the old code did — the node only.
        orphaned.screens[0].sections[0].children = orphaned.screens[0].sections[0].children.slice(1);
        expect(serverErrors(orphaned).some((e) => e.code === 'action.modal_unresolved')).toBe(true);
    });

    it('removes the action that pointed at it, and unhooks the button', () => {
        const next = removeNode(defWithModal(), 'cmp_dialog');
        expect(next.actions.act_open0).toBeUndefined();
        expect(findNode(next, 'cmp_button').node.onClick).toBeUndefined();
        expect(serverErrors(next)).toEqual([]);
    });

    it('strips modal steps out of a sequence rather than deleting the flow', () => {
        const def = defWithModal({
            actions: {
                act_save00: {
                    kind: 'sequence',
                    steps: [
                        { kind: 'toast', message: 'Saved' },
                        { kind: 'close_modal', modalId: 'cmp_dialog' },
                        { kind: 'condition', expr: 'vars.ok', then: [{ kind: 'open_modal', modalId: 'cmp_dialog' }], else: [] },
                    ],
                },
            },
        });
        const next = removeNode(def, 'cmp_dialog');
        expect(next.actions.act_save00.steps.map((s) => s.kind)).toEqual(['toast', 'condition']);
        expect(next.actions.act_save00.steps[1].then).toEqual([]);
        expect(serverErrors(next)).toEqual([]);
    });

    it('cleans up dialogs nested inside a deleted container', () => {
        const def = defWithModal();
        // Wrap the dialog in a card and delete the card.
        def.screens[0].sections[0].children = [
            { id: 'cmp_card00', type: 'card', props: {}, style: {}, children: [def.screens[0].sections[0].children[0]] },
            def.screens[0].sections[0].children[1],
        ];
        const next = removeNode(def, 'cmp_card00');
        expect(next.actions.act_open0).toBeUndefined();
        expect(serverErrors(next)).toEqual([]);
    });

    it('leaves an action aimed at a DIFFERENT dialog alone', () => {
        const def = defWithModal();
        def.screens[0].sections[0].children.push({ id: 'cmp_other0', type: 'modal', props: { title: 'Other' }, style: {}, children: [] });
        def.actions.act_othr0 = { kind: 'open_modal', modalId: 'cmp_other0' };
        const next = removeNode(def, 'cmp_dialog');
        expect(next.actions.act_othr0).toEqual({ kind: 'open_modal', modalId: 'cmp_other0' });
    });

    it('returns the same definition when nothing was removed', () => {
        const def = defWithModal();
        expect(removeNode(def, 'cmp_nope00')).toBe(def);
    });
});
