import { createRequire } from 'node:module';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import LogicSection from './LogicSection';
import { findNode } from '../../state/definitionOps';

/**
 * visibleWhen / enabledWhen / computed used to be written as bare expression
 * STRINGS: canonicalize.js drops those, so the rule the user wrote silently
 * never existed. The gate is the real server pair — whatever this section
 * commits must come back out of canonicalize unchanged and validate clean.
 */
const require = createRequire(import.meta.url);
const { canonicalizeAppDefinition } = require('../../../../../../../../server/appStudio/canonicalize.js');
const { validateAppDefinition } = require('../../../../../../../../server/appStudio/validate.js');

const NODE_ID = 'cmp_logic1';

function defWith(node) {
    return {
        schemaVersion: 2,
        meta: { name: 'T' },
        theme: {},
        homeScreenId: 'scr_logic',
        screens: [{
            id: 'scr_logic', name: 'T', showInNav: true, maxWidth: 'medium',
            sections: [{ id: 'sec_logic', style: {}, children: [node] }],
        }],
        actions: {},
    };
}

/** The node as the SERVER would store it, plus the definition's errors. */
function roundTrip(def) {
    const { def: canon } = canonicalizeAppDefinition(def);
    return {
        node: canon.screens[0].sections[0].children[0],
        errors: validateAppDefinition(canon).errors,
    };
}

/** LogicSection is controlled by the shell — feed its commits back in. */
function Harness({ initial, onCommit }) {
    const [definition, setDefinition] = useState(initial);
    const node = findNode(definition, NODE_ID).node;
    return (
        <LogicSection
            node={node}
            definition={definition}
            onCommit={(next) => { setDefinition(next); onCommit(next); }}
            disabled={false}
        />
    );
}

function renderLogic(node) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const onCommit = vi.fn();
    const utils = render(
        <QueryClientProvider client={client}>
            <Harness initial={defWith({ id: NODE_ID, ...node })} onCommit={onCommit} />
        </QueryClientProvider>,
    );
    const lastNode = () => findNode(onCommit.mock.calls.at(-1)[0], NODE_ID).node;
    const lastDef = () => onCommit.mock.calls.at(-1)[0];
    return { onCommit, lastNode, lastDef, ...utils };
}

const BUTTON = { type: 'button', props: { label: 'Go', variant: 'primary' }, style: {} };
const TEXT = { type: 'text', props: { text: '—' }, style: {} };

/**
 * Where a boolean is wanted these fields OPEN on the clickable condition
 * builder, so a test that wants the raw box has to ask for it — the same click
 * a formula-writing author makes.
 */
function writeAllAsFormula(utils) {
    for (let links = utils.queryAllByText('Write a formula'); links.length; links = utils.queryAllByText('Write a formula')) {
        fireEvent.click(links[0]);
    }
}

describe('LogicSection — server contract', () => {
    it('a bare expression string is dropped on save — the shape the editor emits is not', () => {
        const kept = roundTrip(defWith({ id: NODE_ID, ...BUTTON, visibleWhen: { kind: 'formula', expr: 'form.ok == true' } }));
        expect(kept.node.visibleWhen).toEqual({ kind: 'formula', expr: 'form.ok == true' });
        expect(kept.errors).toEqual([]);

        const lost = roundTrip(defWith({ id: NODE_ID, ...BUTTON, visibleWhen: 'form.ok == true' }));
        expect(lost.node.visibleWhen).toBeUndefined();
    });

    it('"Only show when" / "Enabled when" commit formulas that round-trip', () => {
        const utils = renderLogic(BUTTON);
        const { lastNode, lastDef, getByPlaceholderText } = utils;
        writeAllAsFormula(utils);
        fireEvent.change(getByPlaceholderText("e.g. form.priority == 'high'"), { target: { value: 'form.ok == true' } });
        expect(lastNode().visibleWhen).toEqual({ kind: 'formula', expr: 'form.ok == true' });

        fireEvent.change(getByPlaceholderText('e.g. form.agree == true'), { target: { value: 'form.agree == true' } });
        expect(lastNode().enabledWhen).toEqual({ kind: 'formula', expr: 'form.agree == true' });

        const saved = roundTrip(lastDef());
        expect(saved.node.visibleWhen).toEqual({ kind: 'formula', expr: 'form.ok == true' });
        expect(saved.node.enabledWhen).toEqual({ kind: 'formula', expr: 'form.agree == true' });
        expect(saved.errors).toEqual([]);
    });

    /**
     * The two modes edit ONE value. Opening on the builder and switching back
     * must hand the formula box exactly what was stored — a mode switch that
     * re-serialised through the row model could quietly rewrite a working rule
     * (or drop the half it could not represent) without the author touching it.
     */
    it('switching between the builder and the formula box leaves the value alone', () => {
        const stored = "form.priority == 'high'";
        const utils = renderLogic({ ...BUTTON, visibleWhen: { kind: 'formula', expr: stored } });
        // It opened on the builder, not the code box.
        expect(utils.getAllByText('Write a formula').length).toBeGreaterThan(0);

        writeAllAsFormula(utils);
        expect(utils.getByPlaceholderText("e.g. form.priority == 'high'").value).toBe(stored);
        // Nothing was committed by merely looking at it.
        expect(utils.onCommit).not.toHaveBeenCalled();
    });

    it('clearing a visibility formula drops the key instead of storing a blank one', () => {
        const utils = renderLogic({
            ...BUTTON, visibleWhen: { kind: 'formula', expr: 'form.ok == true' },
        });
        const { lastNode, getByPlaceholderText } = utils;
        writeAllAsFormula(utils);
        fireEvent.change(getByPlaceholderText("e.g. form.priority == 'high'"), { target: { value: '' } });
        expect(lastNode().visibleWhen).toBeUndefined();
        // A blank expression would not merely be dropped — it is a hard error.
        expect(roundTrip(defWith({ id: NODE_ID, ...BUTTON, visibleWhen: { kind: 'formula', expr: '' } })).errors.length)
            .toBeGreaterThan(0);
    });

    it('a computed value commits a formula that round-trips', () => {
        const { lastNode, lastDef, getByPlaceholderText, getByText } = renderLogic(TEXT);
        fireEvent.click(getByText('Compute a value'));
        fireEvent.change(
            getByPlaceholderText("e.g. item.status == 'done' ? 'Done' : 'Open'"),
            { target: { value: 'item.name' } },
        );
        expect(lastNode().computed).toEqual({ text: { kind: 'formula', expr: 'item.name' } });

        const saved = roundTrip(lastDef());
        expect(saved.node.computed).toEqual({ text: { kind: 'formula', expr: 'item.name' } });
        expect(saved.errors).toEqual([]);
    });

    it('a computed row with no formula yet is never committed', () => {
        const { onCommit, getByText } = renderLogic(TEXT);
        fireEvent.click(getByText('Compute a value'));
        expect(onCommit).not.toHaveBeenCalled();
        // …because an empty expression is rejected outright.
        expect(roundTrip(defWith({ id: NODE_ID, ...TEXT, computed: { text: { kind: 'formula', expr: '' } } })).errors.length)
            .toBeGreaterThan(0);
    });
});
