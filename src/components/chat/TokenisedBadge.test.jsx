import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import TokenisedBadge from './TokenisedBadge';

/**
 * BFSF-303 — the "Sensitive data detected" popover rendered with the wrong
 * layering and a see-through background, so it collided with the chat content
 * behind it.
 *
 * jsdom has no layout engine and no stylesheet, so the two halves are pinned
 * by the structural facts that make each fault impossible:
 *
 *   • Layering: the panel must be a body portal, NOT a descendant of the
 *     message row. Inside the row it sat in the row's own stacking context
 *     (the glass themes put a backdrop-filter on every message surface), so
 *     its z-index could never lift it above the next bubble.
 *   • Opacity: the panel must carry `data-tokenised-popover`, the hook the
 *     glass-theme rules in index.css use to swap the translucent
 *     `--bg-card` for a solid tier-3 surface.
 */

const WARNINGS = [{ filename: 'big.pdf', reason: 'overflow', scannedPages: 3, totalPages: 40 }];

function Row(props) {
    // Mirrors the real call site: the badge lives inside the message row,
    // which in the glass themes is a stacking context of its own.
    return (
        <div data-testid="message-row" style={{ position: 'relative', zIndex: 0 }}>
            <TokenisedBadge {...props} />
        </div>
    );
}

describe('TokenisedBadge (BFSF-303)', () => {
    beforeEach(cleanup);

    it('renders nothing without redactions or warnings', () => {
        render(<Row count={0} />);
        expect(document.querySelector('[data-tokenised-popover]')).toBeNull();
        expect(screen.queryByRole('button')).toBeNull();
    });

    it('keeps the popover closed until the pill is clicked', () => {
        render(<Row count={3} categories={['Email', 'Email', 'Phone']} />);
        expect(screen.getByText('3 items redacted')).toBeTruthy();
        expect(document.querySelector('[data-tokenised-popover]')).toBeNull();
    });

    it('escapes the message row: the popover is a portal child of <body>', () => {
        render(<Row count={3} categories={['Email', 'Email', 'Phone']} />);
        fireEvent.click(screen.getByText('3 items redacted'));

        const panel = document.querySelector('[data-tokenised-popover="redacted"]');
        expect(panel).toBeTruthy();
        expect(panel.parentElement).toBe(document.body);
        expect(screen.getByTestId('message-row').contains(panel)).toBe(false);
    });

    it('positions the popover fixed above every chat surface', () => {
        render(<Row count={1} categories={['Email']} />);
        fireEvent.click(screen.getByText('1 email redacted'));

        const panel = document.querySelector('[data-tokenised-popover="redacted"]');
        expect(panel.style.position).toBe('fixed');
        // A portal alone is not enough — the panel must also outrank the
        // app's own overlays. AnchoredMenu's 10050 is the shared ceiling.
        expect(Number(panel.style.zIndex)).toBeGreaterThanOrEqual(10050);
    });

    it('carries the opacity hook the glass themes key their solid surface off', () => {
        render(<Row count={2} categories={['Email', 'Phone']} />);
        fireEvent.click(screen.getByText('2 items redacted'));

        // Losing this attribute silently reverts the bleed-through: the
        // index.css rules for [data-theme^="glass"] would stop matching and
        // the panel would fall back to the translucent --bg-card.
        expect(document.querySelectorAll('[data-tokenised-popover]').length).toBe(1);
        expect(screen.getByText('Sensitive data detected')).toBeTruthy();
    });

    it('still shows the category breakdown inside the portalled panel', () => {
        render(<Row count={3} categories={['Email', 'Email', 'Phone']} />);
        fireEvent.click(screen.getByText('3 items redacted'));

        const panel = document.querySelector('[data-tokenised-popover="redacted"]');
        expect(panel.textContent).toContain('Email');
        expect(panel.textContent).toContain('×2');
        expect(panel.textContent).toContain('Phone');
        expect(panel.textContent).toContain('×1');
    });

    it('closes on Escape and on an outside press', () => {
        render(<Row count={1} categories={['Email']} />);
        fireEvent.click(screen.getByText('1 email redacted'));
        expect(document.querySelector('[data-tokenised-popover]')).toBeTruthy();

        fireEvent.keyDown(document, { key: 'Escape' });
        expect(document.querySelector('[data-tokenised-popover]')).toBeNull();

        fireEvent.click(screen.getByText('1 email redacted'));
        expect(document.querySelector('[data-tokenised-popover]')).toBeTruthy();
        fireEvent.mouseDown(document.body);
        expect(document.querySelector('[data-tokenised-popover]')).toBeNull();
    });

    it('closes via the panel X button', () => {
        render(<Row count={1} categories={['Email']} />);
        fireEvent.click(screen.getByText('1 email redacted'));
        fireEvent.click(screen.getByLabelText('Close'));
        expect(document.querySelector('[data-tokenised-popover]')).toBeNull();
    });

    it('portals the amber scan-incomplete panel too, and only one at a time', () => {
        render(<Row count={2} categories={['Email', 'Phone']} warnings={WARNINGS} />);

        fireEvent.click(screen.getByText('Scan incomplete'));
        const warn = document.querySelector('[data-tokenised-popover="warn"]');
        expect(warn).toBeTruthy();
        expect(warn.parentElement).toBe(document.body);
        expect(warn.textContent).toContain('big.pdf');
        expect(document.querySelector('[data-tokenised-popover="redacted"]')).toBeNull();

        fireEvent.click(screen.getByText('2 items redacted'));
        expect(document.querySelector('[data-tokenised-popover="redacted"]')).toBeTruthy();
        expect(document.querySelector('[data-tokenised-popover="warn"]')).toBeNull();
    });
});
