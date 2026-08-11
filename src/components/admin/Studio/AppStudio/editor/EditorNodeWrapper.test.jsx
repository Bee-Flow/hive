import { DndContext, useDndContext } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import EditorNodeWrapper from './EditorNodeWrapper';
import { RuntimeProvider } from '../runtime/RuntimeContext';
import resolveNodeStyle from '../runtime/styleResolver';
import { AppEditorProvider, useAppEditor } from '../state/AppEditorContext';
import { findNode } from '../state/definitionOps';

// jsdom (as configured for vitest) ships without PointerEvent / pointer
// capture; the resize grips are built on Pointer Events, so polyfill the
// minimum the handlers touch (a MouseEvent already carries clientX/clientY).
beforeAll(() => {
    if (typeof window.PointerEvent !== 'function') {
        class PointerEventPolyfill extends MouseEvent {
            constructor(type, params = {}) {
                super(type, params);
                this.pointerId = params.pointerId ?? 1;
            }
        }
        window.PointerEvent = PointerEventPolyfill;
        globalThis.PointerEvent = PointerEventPolyfill;
    }
    if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => {};
    if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {};
});

beforeEach(() => {
    // A 480px grid → one 12-column column is 40px wide.
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
        width: 480, height: 100, top: 0, left: 0, right: 480, bottom: 100, x: 0, y: 0, toJSON() {},
    });
});

const buttonNode = () => ({
    id: 'cmp_btn1', type: 'button', visible: true,
    props: { label: 'Go', variant: 'primary', role: 'button' },
    style: { span: 3, size: 'md', align: 'start' },
});

const imageNode = () => ({
    id: 'cmp_img1', type: 'image', visible: true,
    props: { src: null, alt: '', fit: 'cover' },
    style: { span: 4, height: 'md', radius: 'md', align: 'start' },
});

function makeDef(node) {
    return {
        schemaVersion: 1,
        homeScreenId: 'scr_1',
        screens: [{
            id: 'scr_1', name: 'S', showInNav: true, maxWidth: 'medium',
            sections: [{ id: 'sec_1', style: { padding: 4, gap: 3, background: 'none' }, children: [node] }],
        }],
        actions: {},
    };
}

const editorApi = { current: null };
function Capture() {
    const ctx = useAppEditor();
    useEffect(() => { editorApi.current = ctx; });
    return null;
}

// The ids dnd-kit actually has registered (its own draggable registry).
const dndApi = { current: null };
function CaptureDnd() {
    const ctx = useDndContext();
    useEffect(() => { dndApi.current = ctx; });
    return null;
}

function renderWrapper(node, { selectedNodeId = node.id } = {}) {
    const onCommit = vi.fn();
    const onSelectNode = vi.fn();
    const utils = render(
        <AppEditorProvider app={{ id: 'app-1', definition: makeDef(node), version: 1 }}>
            <Capture />
            <RuntimeProvider value={{ mode: 'edit', selectedNodeId, onSelectNode }}>
                <DndContext>
                    <SortableContext items={[node.id]}>
                        <div data-grid>
                            <EditorNodeWrapper
                                node={node}
                                className=""
                                style={resolveNodeStyle(node).style}
                                onCommit={onCommit}
                            >
                                <div>child</div>
                            </EditorNodeWrapper>
                        </div>
                    </SortableContext>
                </DndContext>
            </RuntimeProvider>
        </AppEditorProvider>,
    );
    return { ...utils, onCommit, onSelectNode };
}

const widthHandle = () => screen.getByRole('slider', { name: 'Resize width' });

/**
 * Render the same node as a repeater does: one wrapper per row, every copy
 * carrying the same node object (and therefore the same id).
 */
function renderRepeated(node, rows = 3) {
    const onCommit = vi.fn();
    const onSelectNode = vi.fn();
    const utils = render(
        <AppEditorProvider app={{ id: 'app-1', definition: makeDef(node), version: 1 }}>
            <Capture />
            <RuntimeProvider value={{ mode: 'edit', selectedNodeId: node.id, onSelectNode }}>
                <DndContext>
                    <CaptureDnd />
                    <SortableContext items={[node.id]}>
                        <div data-grid>
                            {Array.from({ length: rows }, (_, i) => (
                                <EditorNodeWrapper
                                    key={i}
                                    node={node}
                                    className=""
                                    style={resolveNodeStyle(node).style}
                                    onCommit={onCommit}
                                >
                                    <div>row {i}</div>
                                </EditorNodeWrapper>
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
            </RuntimeProvider>
        </AppEditorProvider>,
    );
    return { ...utils, onCommit, onSelectNode };
}

describe('EditorNodeWrapper — resize affordances visibility', () => {
    it('shows the width grip for a selected node in edit mode', () => {
        renderWrapper(buttonNode());
        expect(widthHandle()).toBeInTheDocument();
    });

    it('hides the grip when the node is not the selected one', () => {
        renderWrapper(buttonNode(), { selectedNodeId: 'cmp_other' });
        expect(screen.queryByRole('slider', { name: 'Resize width' })).toBeNull();
    });

    it('hides the grip in preview/run mode', () => {
        renderWrapper(buttonNode());
        expect(widthHandle()).toBeInTheDocument();
        act(() => editorApi.current.dispatch({ type: 'set_mode', mode: 'preview' }));
        expect(screen.queryByRole('slider', { name: 'Resize width' })).toBeNull();
    });

    it('hides the grip while the AI streams (streamLock)', () => {
        renderWrapper(buttonNode());
        expect(widthHandle()).toBeInTheDocument();
        act(() => editorApi.current.dispatch({ type: 'set_stream_lock', streamLock: true }));
        expect(screen.queryByRole('slider', { name: 'Resize width' })).toBeNull();
    });

    it('renders a height grip only for height-capable types', () => {
        renderWrapper(imageNode());
        expect(screen.getByRole('slider', { name: 'Resize height' })).toBeInTheDocument();
    });

    it('omits the height grip for types without a height knob', () => {
        renderWrapper(buttonNode());
        expect(screen.queryByRole('slider', { name: 'Resize height' })).toBeNull();
    });
});

describe('EditorNodeWrapper — width resize gesture', () => {
    it('a one-column drag bumps span by one and commits exactly one history entry', () => {
        const { onCommit } = renderWrapper(buttonNode()); // span 3, column = 40px
        const handle = widthHandle();

        fireEvent.pointerDown(handle, { clientX: 100, pointerId: 1 });
        fireEvent.pointerMove(handle, { clientX: 140, pointerId: 1 }); // +40px = +1 column
        // Live preview must NOT commit — history stays clean mid-drag.
        expect(onCommit).not.toHaveBeenCalled();
        fireEvent.pointerUp(handle, { clientX: 140, pointerId: 1 });

        expect(onCommit).toHaveBeenCalledTimes(1);
        expect(findNode(onCommit.mock.calls[0][0], 'cmp_btn1').node.style.span).toBe(4);
    });

    it('a two-column drag bumps span by two', () => {
        const { onCommit } = renderWrapper(buttonNode());
        const handle = widthHandle();
        fireEvent.pointerDown(handle, { clientX: 0, pointerId: 1 });
        fireEvent.pointerMove(handle, { clientX: 80, pointerId: 1 }); // +2 columns
        fireEvent.pointerUp(handle, { clientX: 80, pointerId: 1 });
        expect(findNode(onCommit.mock.calls[0][0], 'cmp_btn1').node.style.span).toBe(5);
    });

    it('a drag that returns to the start span commits nothing', () => {
        const { onCommit } = renderWrapper(buttonNode());
        const handle = widthHandle();
        fireEvent.pointerDown(handle, { clientX: 100, pointerId: 1 });
        fireEvent.pointerMove(handle, { clientX: 160, pointerId: 1 });
        fireEvent.pointerMove(handle, { clientX: 100, pointerId: 1 }); // back to start
        fireEvent.pointerUp(handle, { clientX: 100, pointerId: 1 });
        expect(onCommit).not.toHaveBeenCalled();
    });

    it('ArrowRight nudges span by one and commits once (keyboard accessible)', () => {
        const { onCommit } = renderWrapper(buttonNode());
        fireEvent.keyDown(widthHandle(), { key: 'ArrowRight' });
        expect(onCommit).toHaveBeenCalledTimes(1);
        expect(findNode(onCommit.mock.calls[0][0], 'cmp_btn1').node.style.span).toBe(4);
    });
});

describe('EditorNodeWrapper — height resize gesture', () => {
    it('a one-step drag snaps height and commits exactly one history entry', () => {
        const { onCommit } = renderWrapper(imageNode()); // height 'md'
        const handle = screen.getByRole('slider', { name: 'Resize height' });
        fireEvent.pointerDown(handle, { clientY: 100, pointerId: 1 });
        fireEvent.pointerMove(handle, { clientY: 180, pointerId: 1 }); // +80px = +1 step (md → lg)
        fireEvent.pointerUp(handle, { clientY: 180, pointerId: 1 });
        expect(onCommit).toHaveBeenCalledTimes(1);
        expect(findNode(onCommit.mock.calls[0][0], 'cmp_img1').node.style.height).toBe('lg');
    });
});

describe('EditorNodeWrapper — placement clarity', () => {
    it('the move grip advertises drag + Alt+Arrow reordering', () => {
        renderWrapper(buttonNode());
        const grip = screen.getByRole('button', { name: 'Drag to move · Alt+Arrow to reorder' });
        expect(grip).toHaveAttribute('title', expect.stringContaining('Alt'));
    });
});

describe('EditorNodeWrapper — repeated rows share one node id', () => {
    it('gives the editor affordances to the FIRST copy only', () => {
        renderRepeated(buttonNode(), 3);
        expect(document.querySelectorAll('[data-node-id="cmp_btn1"]')).toHaveLength(3);
        // One toolbar, one move grip, one resize grip — not one per row.
        expect(screen.getAllByRole('button', { name: 'Drag to move · Alt+Arrow to reorder' })).toHaveLength(1);
        expect(screen.getAllByRole('slider', { name: 'Resize width' })).toHaveLength(1);
    });

    it('registers a distinct dnd-kit draggable id per copy', () => {
        renderRepeated(buttonNode(), 3);
        const ids = [...dndApi.current.draggableNodes.keys()];
        expect(ids).toHaveLength(3);
        expect(new Set(ids).size).toBe(3);
        // Exactly one of them is the real node id — the sortable the canvas
        // context knows about; the echoes are suffixed and non-draggable.
        expect(ids.filter((id) => id === 'cmp_btn1')).toHaveLength(1);
        const echoes = [...document.querySelectorAll('[data-node-id="cmp_btn1"]')].slice(1);
        for (const el of echoes) expect(el).toHaveAttribute('aria-disabled', 'true');
    });
});

// NOTE: React does not deliver `animationend` in this jsdom setup, so the
// pulse-clearing path is covered where it is decidable — the reducer's
// clear_recent_id case in state/AppEditorContext.test.jsx.

describe('EditorNodeWrapper — pointerdown does not swallow the event', () => {
    it('lets document-level outside-click handlers still see it', () => {
        renderRepeated(buttonNode(), 1);
        const outside = vi.fn();
        document.addEventListener('pointerdown', outside);
        try {
            fireEvent.pointerDown(document.querySelector('[data-node-id="cmp_btn1"]'), { pointerId: 1 });
            expect(outside).toHaveBeenCalledTimes(1);
        } finally {
            document.removeEventListener('pointerdown', outside);
        }
    });

    it('still keeps a nested node from selecting its container too', () => {
        const child = buttonNode();
        const card = {
            id: 'cmp_card1', type: 'card', visible: true, props: {}, style: { span: 12 }, children: [child],
        };
        const onSelectNode = vi.fn();
        render(
            <AppEditorProvider app={{ id: 'app-1', definition: makeDef(card), version: 1 }}>
                <RuntimeProvider value={{ mode: 'edit', selectedNodeId: null, onSelectNode }}>
                    <DndContext>
                        <SortableContext items={[card.id, child.id]}>
                            <div data-grid>
                                <EditorNodeWrapper node={card} className="" style={{}} onCommit={vi.fn()}>
                                    <EditorNodeWrapper node={child} className="" style={{}} onCommit={vi.fn()}>
                                        <div>inner</div>
                                    </EditorNodeWrapper>
                                </EditorNodeWrapper>
                            </div>
                        </SortableContext>
                    </DndContext>
                </RuntimeProvider>
            </AppEditorProvider>,
        );
        fireEvent.pointerDown(document.querySelector('[data-node-id="cmp_btn1"]'), { pointerId: 1 });
        expect(onSelectNode).toHaveBeenCalledTimes(1);
        expect(onSelectNode).toHaveBeenCalledWith('cmp_btn1');
    });
});

