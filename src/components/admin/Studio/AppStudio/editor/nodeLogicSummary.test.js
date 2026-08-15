import { describe, expect, it } from 'vitest';
import nodeLogicSummary, { subtreeHasLogic } from './nodeLogicSummary';

/**
 * The canvas drew components and nothing else. "Which button does something?
 * which field refuses a bad value? which card is hidden from most people?" were
 * answerable only by selecting every node in turn and opening three inspector
 * accordions. This is what the canvas says instead — one sentence per rule, in
 * the author's language, so the badge's tooltip needs no further assembly.
 */

const DEFINITION = {
    screens: [
        { id: 'scr_a', name: 'List', sections: [{ id: 'sec_a', children: [
            { id: 'nd_modal', type: 'modal', props: { title: 'Confirm delete' }, children: [] },
        ] }] },
        { id: 'scr_b', name: 'Detail', sections: [{ id: 'sec_b', children: [] }] },
    ],
    actions: {
        act_go: { kind: 'navigate', screenId: 'scr_b' },
        act_flow: { kind: 'sequence', steps: [{ kind: 'toast', message: 'a' }, { kind: 'navigate', screenId: 'scr_b' }] },
        act_dialog: { kind: 'open_modal', modalId: 'nd_modal' },
    },
};

const texts = (node) => nodeLogicSummary(node, DEFINITION).map((m) => m.text);
const kinds = (node) => nodeLogicSummary(node, DEFINITION).map((m) => m.kind);

describe('nodeLogicSummary — what happens when someone uses it', () => {
    it('says the event AND what it does, by name', () => {
        expect(texts({ id: 'b', type: 'button', onClick: 'act_go' }))
            .toEqual(['When clicked: Go to Detail']);
    });

    it('names a dialog rather than its id', () => {
        expect(texts({ id: 'b', type: 'button', onClick: 'act_dialog' }))
            .toEqual(['When clicked: Open the “Confirm delete” dialog']);
    });

    it('counts the steps of a flow', () => {
        expect(texts({ id: 'b', type: 'button', onClick: 'act_flow' }))
            .toEqual(['When clicked: A flow of 2 steps']);
    });

    it('covers every event slot, not just onClick', () => {
        expect(texts({ id: 'g', type: 'data_grid', onRowClick: 'act_go' }))
            .toEqual(['When a row is clicked: Go to Detail']);
        expect(texts({ id: 'f', type: 'form', onSubmit: 'act_go' }))
            .toEqual(['When submitted: Go to Detail']);
    });

    /**
     * A slot pointing at an action that is not in definition.actions is a real
     * break — validate.js rejects it on the next save. Drawing a badge that
     * claims something happens would be worse than drawing none.
     */
    it('says so when the wiring points at nothing', () => {
        expect(texts({ id: 'b', type: 'button', onClick: 'act_deleted' })[0])
            .toContain('no longer exists');
    });
});

describe('nodeLogicSummary — the rules attached to a component', () => {
    it('reports a visibility condition, with the condition in it', () => {
        expect(texts({ id: 'c', type: 'card', visibleWhen: { kind: 'formula', expr: "currentUser.role == 'admin'" } }))
            .toEqual(["Only shown when currentUser.role == 'admin'"]);
    });

    it('reports a plainly hidden component too', () => {
        expect(texts({ id: 'c', type: 'card', visible: false })).toEqual(['Hidden in the running app']);
    });

    it('prefers the condition over the flag when both are set', () => {
        const marks = texts({ id: 'c', type: 'card', visible: false, visibleWhen: { kind: 'formula', expr: 'vars.ok' } });
        expect(marks).toEqual(['Only shown when vars.ok']);
    });

    it('reads a legacy bare expression string as well as the envelope', () => {
        expect(texts({ id: 'c', type: 'card', enabledWhen: 'form.agree == true' }))
            .toEqual(['Only usable when form.agree == true']);
    });

    it('counts validation rules and computed props', () => {
        const node = {
            id: 'i',
            type: 'input_text',
            validations: [{ type: 'required' }, { type: 'formula', expr: 'x' }],
            computed: { label: { kind: 'formula', expr: 'a' } },
        };
        expect(texts(node)).toEqual([
            'Checks 2 rules before submitting',
            'Works out label while the app runs',
        ]);
    });

    it('shortens a long condition so the tooltip stays one line', () => {
        const expr = `form.a == '${'x'.repeat(120)}'`;
        const [text] = texts({ id: 'c', type: 'card', visibleWhen: { kind: 'formula', expr } });
        expect(text.length).toBeLessThan(90);
        expect(text.endsWith('…')).toBe(true);
    });
});

describe('nodeLogicSummary — staying rare enough to mean something', () => {
    it('says nothing about a plain component', () => {
        expect(nodeLogicSummary({ id: 't', type: 'text', props: { text: 'hi' } }, DEFINITION)).toEqual([]);
        expect(nodeLogicSummary(null, DEFINITION)).toEqual([]);
    });

    it('gives each mark a distinct kind so the canvas can draw them apart', () => {
        const node = {
            id: 'x',
            type: 'input_text',
            onClick: 'act_go',
            visibleWhen: { kind: 'formula', expr: 'a' },
            enabledWhen: { kind: 'formula', expr: 'b' },
            validations: [{ type: 'required' }],
            computed: { label: { kind: 'formula', expr: 'c' } },
        };
        expect(kinds(node)).toEqual(['action', 'visibility', 'enablement', 'validation', 'computed']);
        // Keys are unique — they become React keys on the badge strip.
        const ks = nodeLogicSummary(node, DEFINITION).map((m) => m.key);
        expect(new Set(ks).size).toBe(ks.length);
    });
});

describe('subtreeHasLogic', () => {
    it('sees logic on a descendant, not just on the node itself', () => {
        const container = {
            id: 'c', type: 'card', children: [
                { id: 'inner', type: 'container', children: [{ id: 'b', type: 'button', onClick: 'act_go' }] },
            ],
        };
        expect(subtreeHasLogic(container, DEFINITION)).toBe(true);
    });

    it('is false for a wholly plain subtree', () => {
        const container = { id: 'c', type: 'card', children: [{ id: 't', type: 'text', props: {} }] };
        expect(subtreeHasLogic(container, DEFINITION)).toBe(false);
    });
});
