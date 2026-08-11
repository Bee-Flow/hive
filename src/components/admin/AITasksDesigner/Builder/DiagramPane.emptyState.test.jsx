import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import DiagramPane from './DiagramPane';

/**
 * The first screen of a new routine. Its only affordance used to be the
 * sentence "pick one from the bar above" — there was no button, and the prop
 * meant to back one (`onRequestOpenPalette`) was declared, threaded through two
 * components, and never called by anything (BFSF-327).
 */
describe('DiagramPane — the empty canvas', () => {
    beforeEach(cleanup);

    const cta = () => screen.queryByRole('button', { name: /choose a trigger/i });

    it('offers a button that opens the trigger picker', () => {
        const onRequestOpenPalette = vi.fn();
        render(<DiagramPane definition={null} editable onRequestOpenPalette={onRequestOpenPalette} />);
        expect(screen.getByText('Start with a trigger')).toBeTruthy();
        fireEvent.click(cta());
        expect(onRequestOpenPalette).toHaveBeenCalledTimes(1);
    });

    it('still points at the ribbon, for the people who reach there first', () => {
        render(<DiagramPane definition={null} editable onRequestOpenPalette={vi.fn()} />);
        expect(screen.getByText(/bar above/i)).toBeTruthy();
    });

    it('renders no button on a surface that has no palette to open', () => {
        // Static thumbnails and read-only replays pass no handler; a button
        // that did nothing would be worse than none.
        render(<DiagramPane definition={null} />);
        expect(screen.getByText('Start with a trigger')).toBeTruthy();
        expect(cta()).toBeNull();
    });

    it('gives way to the canvas as soon as there is a trigger', () => {
        render(<DiagramPane
            definition={{ trigger: { id: 'trg', type: 'trigger', kind: 'manual', position: { x: 0, y: 0 } }, steps: [], edges: [] }}
            editable
            onRequestOpenPalette={vi.fn()}
        />);
        expect(screen.queryByText('Start with a trigger')).toBeNull();
    });
});
