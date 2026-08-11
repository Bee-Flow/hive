import { fireEvent, render, screen } from '@testing-library/react';
import React, { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { describeAction, actionOptions } from './actionLabels';
import MultiInspector from './MultiInspector';
import { KNOB_LABELS, STYLE_KNOBS, knobLabel } from './styleKnobMeta';
import { TabsInspector } from './panels/TabsInspector';

/**
 * The inspector's own affordances: what a control is CALLED, what a delete
 * destroys, and whether an action can be told apart from its id.
 */

// ── Knob labels ─────────────────────────────────────────────────────────────

describe('style knob labels', () => {
    // `border` was missing from both hand-maintained copies, and the two failed
    // differently: StyleSection rendered an unlabelled control (FormField skips
    // the <label> for undefined) while MultiInspector captioned it with the
    // literal string "undefined".
    it('names every knob the catalog has', () => {
        for (const knob of Object.keys(STYLE_KNOBS)) {
            expect(KNOB_LABELS[knob], `${knob} has no label`).toBeTruthy();
        }
    });

    it('falls back to the knob key rather than to undefined', () => {
        expect(knobLabel('border')).toBe('Border');
        expect(knobLabel('somethingNew')).toBe('SomethingNew');
        expect(String(knobLabel('whatever'))).not.toContain('undefined');
    });
});

// ── Action labels ───────────────────────────────────────────────────────────

const DEF = {
    screens: [{
        id: 'scr_a', name: 'Requests',
        sections: [{
            id: 'sec_a',
            children: [{ id: 'cmp_modal', type: 'modal', props: { title: 'Add customer' }, children: [] }],
        }],
    }],
    actions: {
        act_run: { kind: 'run_automation', automationId: 'auto_1' },
        act_nav: { kind: 'navigate', screenId: 'scr_a' },
        act_toast: { kind: 'toast', message: 'Saved.' },
        act_modal: { kind: 'open_modal', modalId: 'cmp_modal' },
        act_seq: { kind: 'sequence', steps: [{ kind: 'toast', message: 'a' }, { kind: 'refresh' }] },
    },
};

describe('describeAction', () => {
    it('names each kind in the author’s language', () => {
        expect(describeAction('act_nav', DEF.actions.act_nav, DEF)).toBe('Go to Requests');
        expect(describeAction('act_toast', DEF.actions.act_toast, DEF)).toContain('Saved.');
        expect(describeAction('act_modal', DEF.actions.act_modal, DEF)).toBe('Open the “Add customer” dialog');
        expect(describeAction('act_seq', DEF.actions.act_seq, DEF)).toBe('A flow of 2 steps');
    });

    it('uses the routine title when the caller can resolve one', () => {
        expect(describeAction('act_run', DEF.actions.act_run, DEF)).toBe('Run routine');
        expect(describeAction('act_run', DEF.actions.act_run, DEF, () => 'Nightly sync'))
            .toBe('Run routine — Nightly sync');
    });

    // The row-action and item-action selects listed these ids raw, so the user
    // chose between "act_a1b2c3" and "act_d4e5f6".
    it('gives a <select> a label per action', () => {
        const opts = actionOptions(DEF);
        expect(opts).toHaveLength(5);
        expect(opts.every((o) => o.label && o.label !== o.id)).toBe(true);
    });
});

// ── Destructive confirmations ───────────────────────────────────────────────

function defWithNodes(children) {
    return {
        schemaVersion: 2,
        screens: [{ id: 'scr_a', name: 'S', sections: [{ id: 'sec_a', children }] }],
        actions: {},
    };
}

describe('MultiInspector — bulk delete', () => {
    const card = { id: 'cmp_card', type: 'card', props: { title: 'Group' }, style: {}, children: [
        { id: 'cmp_txt', type: 'text', props: { text: 'inside' }, style: {} },
    ] };
    const heading = { id: 'cmp_h', type: 'heading', props: { text: 'Hi', level: 2 }, style: {} };

    function renderMulti(children, ids) {
        const onCommit = vi.fn();
        render(
            <MultiInspector
                definition={defWithNodes(children)}
                ids={ids}
                onCommit={onCommit}
                disabled={false}
                dispatch={vi.fn()}
            />,
        );
        return onCommit;
    }

    // Deleting ONE container asks first; deleting five from here did not ask at
    // all, and a bulk delete is where the most is at stake.
    it('asks before destroying a selection that holds other components', () => {
        const onCommit = renderMulti([card, heading], ['cmp_card', 'cmp_h']);
        fireEvent.click(screen.getByLabelText('Delete selected'));
        expect(onCommit).not.toHaveBeenCalled();
        expect(screen.getByText('Delete 2 components?')).toBeTruthy();

        fireEvent.click(screen.getByText('Delete'));
        expect(onCommit).toHaveBeenCalled();
    });

    it('does not ask when nothing in the selection holds anything', () => {
        const other = { id: 'cmp_h2', type: 'heading', props: { text: 'Yo', level: 2 }, style: {} };
        const onCommit = renderMulti([heading, other], ['cmp_h', 'cmp_h2']);
        fireEvent.click(screen.getByLabelText('Delete selected'));
        expect(onCommit).toHaveBeenCalled();
    });
});

describe('TabsInspector — deleting a tab', () => {
    const tabs = {
        id: 'cmp_tabs', type: 'tabs', props: {}, style: {},
        children: [
            { id: 'cmp_t1', type: 'tab', props: { label: 'General' }, style: {}, children: [] },
            {
                id: 'cmp_t2', type: 'tab', props: { label: 'Details' }, style: {},
                children: [{ id: 'cmp_in', type: 'input_text', props: { name: 'a', label: 'A' }, style: {} }],
            },
        ],
    };

    function renderTabs() {
        const onCommit = vi.fn();
        function Harness() {
            const [def, setDef] = useState(defWithNodes([tabs]));
            const node = def.screens[0].sections[0].children[0];
            return (
                <TabsInspector
                    node={node}
                    definition={def}
                    onCommit={(next) => { setDef(next); onCommit(next); }}
                    disabled={false}
                />
            );
        }
        render(<Harness />);
        return onCommit;
    }

    it('asks before destroying a tab that holds components', () => {
        const onCommit = renderTabs();
        fireEvent.click(screen.getByLabelText('Delete tab 2'));
        expect(onCommit).not.toHaveBeenCalled();
        expect(screen.getByText('Delete the “Details” tab?')).toBeTruthy();
        expect(screen.getByText(/holds 1 component/)).toBeTruthy();

        fireEvent.click(screen.getByText('Delete'));
        expect(onCommit).toHaveBeenCalled();
    });

    it('deletes an empty tab straight away', () => {
        const onCommit = renderTabs();
        fireEvent.click(screen.getByLabelText('Delete tab 1'));
        expect(onCommit).toHaveBeenCalled();
    });
});
