import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React, { useRef, useState } from 'react';
import AnchoredMenu from './AnchoredMenu';

/**
 * The three failure modes BFSF-328 reported, as tests. The clipping half can't
 * be asserted in jsdom (no layout engine, no stylesheet), so we assert the
 * structural fact that makes clipping impossible: the panel is a child of
 * <body>, not of the clipping ancestor.
 */
function Harness({ onClose = () => {}, open = true }) {
    const anchorRef = useRef(null);
    return (
        <div data-testid="clipper" style={{ overflow: 'hidden' }}>
            <div ref={anchorRef}>
                <button type="button">anchor</button>
            </div>
            <AnchoredMenu open={open} onClose={onClose} anchorRef={anchorRef}>
                <button type="button">option one</button>
            </AnchoredMenu>
        </div>
    );
}

describe('AnchoredMenu', () => {
    beforeEach(cleanup);

    it('renders the panel outside the clipping ancestor, in a body portal', () => {
        render(<Harness />);
        const panel = document.querySelector('[data-anchored-menu]');
        expect(panel).toBeTruthy();
        expect(panel.parentElement).toBe(document.body);
        expect(screen.getByTestId('clipper').contains(panel)).toBe(false);
    });

    it('renders nothing while closed', () => {
        render(<Harness open={false} />);
        expect(document.querySelector('[data-anchored-menu]')).toBeNull();
    });

    it('closes on an outside press but not on a press inside the panel or the anchor', () => {
        const onClose = vi.fn();
        render(<Harness onClose={onClose} />);

        fireEvent.mouseDown(screen.getByText('option one'));
        expect(onClose).not.toHaveBeenCalled();

        fireEvent.mouseDown(screen.getByText('anchor'));
        expect(onClose).not.toHaveBeenCalled();

        fireEvent.mouseDown(document.body);
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does NOT close when the press lands on a scrollbar', () => {
        // The old `fixed inset-0` backdrop sat over the modal's scrollbar, so
        // grabbing it both dismissed the menu and never reached the scroller.
        const onClose = vi.fn();
        render(<Harness onClose={onClose} />);
        const outside = document.createElement('div');
        document.body.appendChild(outside);
        // jsdom has no layout, so hand the scroller a real box: 215px wide
        // border box, 200px of content — the last 15px are the gutter.
        Object.defineProperty(outside, 'clientWidth', { value: 200, configurable: true });
        Object.defineProperty(outside, 'clientHeight', { value: 100, configurable: true });
        outside.getBoundingClientRect = () => ({ left: 0, top: 0, right: 215, bottom: 100, width: 215, height: 100 });

        fireEvent.mouseDown(outside, { clientX: 208, clientY: 40 }); // in the vertical scrollbar
        expect(onClose).not.toHaveBeenCalled();

        fireEvent.mouseDown(outside, { clientX: 40, clientY: 40 }); // in the content
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('closes on Escape unless the caller opts out', () => {
        const onClose = vi.fn();
        const { unmount } = render(<Harness onClose={onClose} />);
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onClose).toHaveBeenCalledTimes(1);
        unmount();

        function NoEscape() {
            const anchorRef = useRef(null);
            return (
                <div ref={anchorRef}>
                    <AnchoredMenu open onClose={onClose} anchorRef={anchorRef} closeOnEscape={false}>x</AnchoredMenu>
                </div>
            );
        }
        render(<NoEscape />);
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('contains overscroll so a wheel at the end of the list does not scroll the page behind it', () => {
        render(<Harness />);
        const panel = document.querySelector('[data-anchored-menu]');
        expect(panel.style.overscrollBehavior).toBe('contain');
        expect(panel.style.overflowY).toBe('auto');
        expect(panel.style.position).toBe('fixed');
    });

    it('unmounts its listeners when it closes', () => {
        const onClose = vi.fn();
        function Toggle() {
            const anchorRef = useRef(null);
            const [open, setOpen] = useState(true);
            return (
                <div ref={anchorRef}>
                    <button type="button" onClick={() => setOpen(false)}>hide</button>
                    <AnchoredMenu open={open} onClose={onClose} anchorRef={anchorRef}>x</AnchoredMenu>
                </div>
            );
        }
        render(<Toggle />);
        fireEvent.click(screen.getByText('hide'));
        expect(document.querySelector('[data-anchored-menu]')).toBeNull();
        fireEvent.mouseDown(document.body);
        expect(onClose).not.toHaveBeenCalled();
    });
});
