import { fireEvent, render, act } from '@testing-library/react';
import { useEffect } from 'react';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import useEditorHotkeys from './useEditorHotkeys';
import { AppEditorProvider, useAppEditor } from '../state/AppEditorContext';
import { findNode } from '../state/definitionOps';
import { KITCHEN_SINK } from '../state/sampleDefinitions';

// Same harness as the clipboard suite: the hotkeys run against the reducer
// definition, kept in sync through onCommit.
const ctxRef = { current: null };

function Harness({ onCommit }) {
    const ctx = useAppEditor();
    useEffect(() => { ctxRef.current = ctx; });
    const commit = (def) => {
        onCommit(def);
        ctx.dispatch({ type: 'set_definition', definition: def });
    };
    useEditorHotkeys({ enabled: true, onCommit: commit });
    return null;
}

function setup() {
    const onCommit = vi.fn();
    render(
        <AppEditorProvider app={{ id: 'app-1', definition: KITCHEN_SINK, version: 1 }}>
            <Harness onCommit={onCommit} />
        </AppEditorProvider>,
    );
    return { onCommit };
}

const press = (key) => act(() => { fireEvent.keyDown(window, { key }); });

beforeEach(() => {
    ctxRef.current = null;
});

describe('useEditorHotkeys — Delete', () => {
    it('removes the WHOLE multi-selection in one commit (Bug 5)', () => {
        const { onCommit } = setup();
        act(() => ctxRef.current.dispatch({
            type: 'select_many', ids: ['cmp_headg1', 'cmp_intro1', 'cmp_divid1'],
        }));

        press('Delete');

        expect(onCommit).toHaveBeenCalledTimes(1);
        const def = onCommit.mock.calls[0][0];
        for (const id of ['cmp_headg1', 'cmp_intro1', 'cmp_divid1']) {
            expect(findNode(def, id)).toBeNull();
        }
        // Unselected siblings stay put.
        expect(findNode(def, 'cmp_table1')).not.toBeNull();
    });

    it('Backspace deletes the whole selection too', () => {
        const { onCommit } = setup();
        act(() => ctxRef.current.dispatch({ type: 'select_many', ids: ['cmp_stat01', 'cmp_stat02'] }));
        press('Backspace');
        const def = onCommit.mock.calls[0][0];
        expect(findNode(def, 'cmp_stat01')).toBeNull();
        expect(findNode(def, 'cmp_stat02')).toBeNull();
    });

    it('still deletes a single selected node', () => {
        const { onCommit } = setup();
        act(() => ctxRef.current.dispatch({ type: 'select_node', nodeId: 'cmp_divid1' }));
        press('Delete');
        expect(onCommit).toHaveBeenCalledTimes(1);
        expect(findNode(onCommit.mock.calls[0][0], 'cmp_divid1')).toBeNull();
    });

    it('does nothing without a selection', () => {
        const { onCommit } = setup();
        press('Delete');
        expect(onCommit).not.toHaveBeenCalled();
    });
});
