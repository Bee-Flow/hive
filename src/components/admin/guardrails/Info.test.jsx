import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import Info from './Info';
import FieldHint from '../AITasksDesigner/Builder/flow/FieldHint';

/**
 * BFSF-362 regression — "field help tooltip overflows panel bounds and
 * dismisses on scroll".
 *
 * Reported on the Gmail Search node's `maxResults` field, but the reporter was
 * right that it is not per-node: every field hint in the builder renders
 * through FieldHint → Info, so all of them shared one popover with four faults.
 * Each is pinned below.
 *
 * jsdom has no layout engine and no stylesheet, so the clipping half cannot be
 * asserted directly. What is asserted instead is the structural fact that makes
 * clipping impossible — the panel is a child of <body>, not of the
 * `overflow: hidden` ancestor — exactly as AnchoredMenu.test.jsx does for
 * BFSF-328.
 *
 * Run: cd agent-hub && npx vitest run src/components/admin/guardrails/Info.test.jsx
 */

// The clip chain the real node-config panel puts around a field hint:
// SettingsForm's `overflow-y-auto` inside NodeDetailView's `overflow-hidden`.
function Panel({ children }) {
    return (
        <div data-testid="clipper" style={{ overflow: 'hidden' }}>
            <div data-testid="scroller" style={{ overflowY: 'auto' }}>
                {children}
            </div>
        </div>
    );
}

const openHint = () => fireEvent.click(screen.getByRole('button', { name: 'maxResults' }));
const panel = () => document.querySelector('[data-field-hint]');

describe('Info — field help popover (BFSF-362)', () => {
    beforeEach(cleanup);

    it('renders nothing until the icon is clicked', () => {
        render(<Panel><Info title="maxResults">How many to fetch.</Info></Panel>);
        expect(panel()).toBeNull();
        openHint();
        expect(panel()).toBeTruthy();
        expect(screen.getByText('How many to fetch.')).toBeTruthy();
    });

    it('escapes the clipping ancestors via a body portal', () => {
        // Fault 1. The old panel was an `absolute` span INSIDE the scroller, so
        // a hint on a bottom-edge field was cut off by the panel's overflow.
        render(<Panel><Info title="maxResults">How many to fetch.</Info></Panel>);
        openHint();
        const p = panel();
        expect(p.parentElement).toBe(document.body);
        expect(screen.getByTestId('clipper').contains(p)).toBe(false);
        expect(screen.getByTestId('scroller').contains(p)).toBe(false);
    });

    it('paints fixed and above the modal, and scrolls internally when the hint is long', () => {
        // Fault 3/4 support: `absolute … z-50` was only a LOCAL z-index inside a
        // backdrop-filtered stacking context, and an uncapped panel could not
        // scroll its own overflow.
        render(<Panel><Info title="maxResults">{'x '.repeat(400)}</Info></Panel>);
        openHint();
        const p = panel();
        expect(p.style.position).toBe('fixed');
        expect(Number(p.style.zIndex)).toBeGreaterThanOrEqual(10050);
        expect(p.style.overflowY).toBe('auto');
        expect(p.style.overscrollBehavior).toBe('contain');
    });

    it('does NOT close when the press lands on the config panel scrollbar', () => {
        // Fault 2, the headline of the report: "scrolling to bring the tooltip
        // into view causes it to deselect and disappear before it can be read".
        // The old handler closed on ANY mousedown outside its wrapper, and the
        // scrollbar is outside the wrapper.
        render(<Panel><Info title="maxResults">How many to fetch.</Info></Panel>);
        openHint();

        const scroller = screen.getByTestId('scroller');
        // jsdom has no layout, so hand the scroller a real box: a 215px border
        // box over 200px of content — the last 15px are the scrollbar gutter.
        Object.defineProperty(scroller, 'clientWidth', { value: 200, configurable: true });
        Object.defineProperty(scroller, 'clientHeight', { value: 100, configurable: true });
        scroller.getBoundingClientRect = () => ({ left: 0, top: 0, right: 215, bottom: 100, width: 215, height: 100 });

        fireEvent.mouseDown(scroller, { clientX: 208, clientY: 40 }); // in the gutter
        expect(panel()).toBeTruthy();

        fireEvent.mouseDown(scroller, { clientX: 40, clientY: 40 }); // in the content
        expect(panel()).toBeNull();
    });

    it('survives a scroll of the surrounding panel instead of closing', () => {
        // The companion to the scrollbar press: a wheel/keyboard scroll of the
        // form must reposition the hint, never dismiss it.
        render(<Panel><Info title="maxResults">How many to fetch.</Info></Panel>);
        openHint();
        fireEvent.scroll(screen.getByTestId('scroller'));
        expect(panel()).toBeTruthy();
    });

    it('closes on Escape, on an outside press, and on a second icon click', () => {
        render(<Panel><Info title="maxResults">How many to fetch.</Info></Panel>);

        openHint();
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(panel()).toBeNull();

        openHint();
        fireEvent.mouseDown(document.body);
        expect(panel()).toBeNull();

        openHint();
        expect(panel()).toBeTruthy();
        openHint(); // toggle back off — the anchor press must not be an outside press
        expect(panel()).toBeNull();
    });

    it('carries the data-field-hint opacity hook so the glass themes can make it solid', () => {
        // Fault 4. Without this attribute the panel keeps AnchoredMenu's
        // `--bg-primary`, which is `transparent` in glass — the form behind it
        // would read straight through, which is the same complaint BFSF-303
        // fixed for the chat popover.
        render(<Panel><Info title="maxResults">How many to fetch.</Info></Panel>);
        openHint();
        expect(panel().hasAttribute('data-field-hint')).toBe(true);
    });

});

describe('Info — affordances and hygiene', () => {
    beforeEach(cleanup);

    it('exposes the hint as a tooltip, labelled by the field it belongs to', () => {
        render(<Panel><Info title="maxResults">How many to fetch.</Info></Panel>);
        const icon = screen.getByRole('button', { name: 'maxResults' });
        expect(icon.getAttribute('aria-expanded')).toBe('false');
        fireEvent.click(icon);
        expect(icon.getAttribute('aria-expanded')).toBe('true');
        expect(screen.getByRole('tooltip')).toBe(panel());
    });

    it('does not leak listeners once closed', () => {
        const spy = vi.spyOn(document, 'removeEventListener');
        render(<Panel><Info title="maxResults">How many to fetch.</Info></Panel>);
        openHint();
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(spy).toHaveBeenCalledWith('mousedown', expect.any(Function), true);
        spy.mockRestore();
        // And a later stray press cannot resurrect or re-close anything.
        fireEvent.mouseDown(document.body);
        expect(panel()).toBeNull();
    });
});

describe('FieldHint (BFSF-362)', () => {
    beforeEach(cleanup);

    it('renders nothing without a hint, so call sites can pass it unconditionally', () => {
        const { container: a } = render(<FieldHint title="maxResults">{null}</FieldHint>);
        expect(a.innerHTML).toBe('');
        cleanup();
        const { container: b } = render(<FieldHint title="maxResults">{''}</FieldHint>);
        expect(b.innerHTML).toBe('');
    });

    it('routes a real hint through the portalled popover', () => {
        render(<Panel><FieldHint title="maxResults">How many to fetch.</FieldHint></Panel>);
        openHint();
        expect(panel().parentElement).toBe(document.body);
        expect(screen.getByText('How many to fetch.')).toBeTruthy();
    });
});
