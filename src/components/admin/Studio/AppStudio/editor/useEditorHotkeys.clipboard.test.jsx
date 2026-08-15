import { fireEvent, render, act } from '@testing-library/react';
import { useEffect } from 'react';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import useEditorHotkeys from './useEditorHotkeys';
import { setClipboard } from '../state/clipboard';
import { AppEditorProvider, useAppEditor } from '../state/AppEditorContext';
import { findNode } from '../state/definitionOps';
import { KITCHEN_SINK } from '../state/sampleDefinitions';

// A harness that runs the hotkeys, keeps the reducer definition in sync via
// onCommit (so paste reads the freshest def), and exposes the live context.
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

const meta = (key, extra = {}) => act(() => { fireEvent.keyDown(window, { key, metaKey: true, ...extra }); });

beforeEach(() => {
    setClipboard(null);
    ctxRef.current = null;
});

describe('useEditorHotkeys — clipboard', () => {
    it('copy → paste round-trips a re-id\'d clone selected + pulsed', () => {
        const { onCommit } = setup();

        // Select the dashboard heading, copy it, then paste.
        act(() => ctxRef.current.dispatch({ type: 'select_node', nodeId: 'cmp_headg1' }));
        meta('c');
        expect(onCommit).not.toHaveBeenCalled(); // copy never mutates
        meta('v');

        expect(onCommit).toHaveBeenCalledTimes(1);
        const def = onCommit.mock.calls[0][0];

        // The paste landed right after the anchor with a FRESH id + cloned props.
        const original = findNode(KITCHEN_SINK, 'cmp_headg1').node;
        const section = def.screens.find((s) => s.id === 'scr_dash01').sections.find((s) => s.id === 'sec_dash01');
        const ids = section.children.map((c) => c.id);
        const anchorIdx = ids.indexOf('cmp_headg1');
        const pastedId = ids[anchorIdx + 1];

        expect(pastedId).not.toBe('cmp_headg1');
        const pasted = findNode(def, pastedId).node;
        expect(pasted.type).toBe(original.type);
        expect(pasted.props).toEqual(original.props);

        // Selection + pulse moved to the paste.
        expect([...ctxRef.current.selectedNodeIds]).toEqual([pastedId]);
        expect(ctxRef.current.recentlyAddedIds.has(pastedId)).toBe(true);
    });

    it('cut removes the selection in one commit and clears it', () => {
        const { onCommit } = setup();
        act(() => ctxRef.current.dispatch({ type: 'select_node', nodeId: 'cmp_intro1' }));

        meta('x');

        expect(onCommit).toHaveBeenCalledTimes(1);
        const def = onCommit.mock.calls[0][0];
        expect(findNode(def, 'cmp_intro1')).toBeNull();
        expect(ctxRef.current.selectedNodeIds.size).toBe(0);

        // The cut also stocked the clipboard: a following paste restores a clone.
        meta('v');
        expect(onCommit).toHaveBeenCalledTimes(2);
    });

    it('does nothing on paste with an empty clipboard', () => {
        const { onCommit } = setup();
        act(() => ctxRef.current.dispatch({ type: 'select_node', nodeId: 'cmp_headg1' }));
        meta('v');
        expect(onCommit).not.toHaveBeenCalled();
    });

    it('is suppressed while typing in an input', () => {
        const { onCommit } = setup();
        act(() => ctxRef.current.dispatch({ type: 'select_node', nodeId: 'cmp_headg1' }));

        const input = document.createElement('input');
        document.body.appendChild(input);
        act(() => { fireEvent.keyDown(input, { key: 'c', metaKey: true }); });
        act(() => { fireEvent.keyDown(input, { key: 'v', metaKey: true }); });
        expect(onCommit).not.toHaveBeenCalled();
        input.remove();
    });
});

/**
 * Switching screens leaves the selection alone — the reducer's `set_screen`
 * does not clear it. So the paste target, taken from the anchor's section,
 * pointed at the screen you had LEFT: the copy landed off-screen, silently,
 * with the canvas in front of you unchanged.
 */
describe('useEditorHotkeys — paste lands on the screen being edited', () => {
    it('appends to the current screen when the selection is on another one', () => {
        const { onCommit } = setup();

        // Copy the dashboard heading…
        act(() => ctxRef.current.dispatch({ type: 'select_node', nodeId: 'cmp_headg1' }));
        meta('c');

        // …switch to the form screen, WITHOUT clearing the selection…
        act(() => ctxRef.current.dispatch({ type: 'set_screen', screenId: 'scr_form01' }));
        expect(ctxRef.current.selectedNodeId).toBe('cmp_headg1');

        meta('v');
        const def = onCommit.mock.calls.at(-1)[0];

        // …and the copy is on the screen in front of you, not the one you left.
        const dashIds = def.screens.find((s) => s.id === 'scr_dash01')
            .sections.flatMap((sec) => sec.children).map((c) => c.id);
        const formIds = def.screens.find((s) => s.id === 'scr_form01')
            .sections.flatMap((sec) => sec.children).map((c) => c.id);
        const before = KITCHEN_SINK.screens.find((s) => s.id === 'scr_dash01')
            .sections.flatMap((sec) => sec.children).length;

        expect(dashIds).toHaveLength(before);
        expect(formIds).toContain(
            formIds.find((id) => !KITCHEN_SINK.screens.find((s) => s.id === 'scr_form01')
                .sections.flatMap((sec) => sec.children).some((c) => c.id === id)),
        );
    });
});
