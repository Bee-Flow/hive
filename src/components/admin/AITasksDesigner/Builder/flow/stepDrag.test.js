import { describe, it, expect, vi } from 'vitest';
import { STEP_DND_MIME, stepDragProps, readStepPayload, dropTargetFromPoint, sameDropTarget } from './stepDrag';

function fakeDataTransfer() {
    const store = {};
    return {
        store,
        setData: (mime, value) => { store[mime] = value; },
        getData: (mime) => store[mime] || '',
        effectAllowed: null,
    };
}

describe('stepDragProps', () => {
    it('writes the payload under the step MIME type', () => {
        const dt = fakeDataTransfer();
        const props = stepDragProps({ kind: 'condition', label: 'If' });
        expect(props.draggable).toBe(true);
        props.onDragStart({ dataTransfer: dt });
        expect(JSON.parse(dt.store[STEP_DND_MIME])).toEqual({ kind: 'condition', label: 'If' });
        // Must pair with DiagramPane's dropEffect:'copy' or the browser
        // silently refuses the drop.
        expect(dt.effectAllowed).toBe('copyMove');
    });

    it('never throws when dataTransfer is unavailable', () => {
        const props = stepDragProps({ kind: 'set' });
        expect(() => props.onDragStart({})).not.toThrow();
    });
});

describe('readStepPayload', () => {
    it('round-trips a payload', () => {
        const dt = fakeDataTransfer();
        stepDragProps({ kind: 'loop' }).onDragStart({ dataTransfer: dt });
        expect(readStepPayload(dt)).toEqual({ kind: 'loop' });
    });

    it('rejects foreign / malformed / kind-less drags', () => {
        expect(readStepPayload(null)).toBe(null);
        expect(readStepPayload(fakeDataTransfer())).toBe(null);
        const bad = fakeDataTransfer();
        bad.setData(STEP_DND_MIME, '{oops');
        expect(readStepPayload(bad)).toBe(null);
        const kindless = fakeDataTransfer();
        kindless.setData(STEP_DND_MIME, '{"label":"x"}');
        expect(readStepPayload(kindless)).toBe(null);
    });
});

describe('dropTargetFromPoint', () => {
    const docWith = (el) => ({ elementFromPoint: () => el });
    const elIn = (className, id) => ({
        closest: (sel) => (sel === className ? { getAttribute: () => id } : null),
    });

    it('reports a hovered connection', () => {
        expect(dropTargetFromPoint(1, 2, docWith(elIn('.react-flow__edge', 'e1'))))
            .toEqual({ kind: 'edge', id: 'e1' });
    });

    it('reports a hovered node', () => {
        expect(dropTargetFromPoint(1, 2, docWith(elIn('.react-flow__node', 'step_a'))))
            .toEqual({ kind: 'node', id: 'step_a' });
    });

    it('falls back to the pane for empty canvas and missing documents', () => {
        expect(dropTargetFromPoint(1, 2, docWith(null))).toEqual({ kind: 'pane' });
        expect(dropTargetFromPoint(1, 2, docWith({ closest: () => null }))).toEqual({ kind: 'pane' });
        expect(dropTargetFromPoint(1, 2, null)).toEqual({ kind: 'pane' });
    });

    it('prefers the connection when an edge and a node overlap', () => {
        // An edge's fat hit-path sits above the node it terminates on; the
        // splice is the more specific intent.
        const ids = { '.react-flow__edge': 'e9', '.react-flow__node': 'n9' };
        const both = { closest: (sel) => (sel in ids ? { getAttribute: () => ids[sel] } : null) };
        expect(dropTargetFromPoint(0, 0, docWith(both))).toEqual({ kind: 'edge', id: 'e9' });
    });

    it('prefers an AI step\'s tools port over the node it sits on', () => {
        // The port is INSIDE the card, so both always match. "Give the AI this
        // tool" is the more specific intent than "add a step after it".
        const ids = { '[data-tool-port]': 'ai1', '.react-flow__node': 'ai1' };
        const both = { closest: (sel) => (sel in ids ? { getAttribute: () => ids[sel] } : null) };
        expect(dropTargetFromPoint(0, 0, docWith(both))).toEqual({ kind: 'toolPort', id: 'ai1' });
    });
});

describe('sameDropTarget', () => {
    it('compares kind + id, so the highlight only re-renders on real moves', () => {
        expect(sameDropTarget({ kind: 'edge', id: 'a' }, { kind: 'edge', id: 'a' })).toBe(true);
        expect(sameDropTarget({ kind: 'edge', id: 'a' }, { kind: 'edge', id: 'b' })).toBe(false);
        expect(sameDropTarget({ kind: 'pane' }, { kind: 'pane' })).toBe(true);
        expect(sameDropTarget(null, { kind: 'pane' })).toBe(false);
        expect(sameDropTarget(null, null)).toBe(true);
    });
});

describe('ribbon integration contract', () => {
    it('exposes one MIME type shared by producer and consumer', () => {
        // If this ever drifts, drags silently do nothing on drop.
        expect(STEP_DND_MIME).toBe('application/x-automation-step');
        vi.restoreAllMocks();
    });
});
