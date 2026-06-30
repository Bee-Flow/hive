import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import OutputView from './OutputView';

// Shape that mirrors a forEach step's output: results[*].output.content.
const VALUE = {
    results: [
        { output: { content: 'INV-1', filename: 'a.pdf' } },
        { output: { content: 'INV-2', filename: 'b.pdf' } },
    ],
};
const BASE = 'steps.x.output';

function dndEvent() {
    return { setData: vi.fn(), effectAllowed: '' };
}

describe('OutputView — drag/click mapping', () => {
    beforeEach(() => cleanup());

    it('maps a table column to an absolute [*] path (not a relative segment)', () => {
        const onPick = vi.fn();
        const { container } = render(
            <OutputView value={VALUE} basePath={BASE} enableDrag onPickPath={onPick} />,
        );
        // The `output` column header maps every row's whole output object.
        const th = container.querySelector('[title*="steps.x.output.results[*].output)"]');
        expect(th).toBeTruthy();
        fireEvent.click(th);
        expect(onPick).toHaveBeenCalledWith('steps.x.output.results[*].output');
    });

    it('drills an object column so a single nested field (content) is mappable', () => {
        const onPick = vi.fn();
        const { container } = render(
            <OutputView value={VALUE} basePath={BASE} enableDrag onPickPath={onPick} />,
        );
        // Expand the `output` object column into its leaf sub-columns.
        const expandBtn = screen.getByLabelText('Show fields');
        fireEvent.click(expandBtn);
        // Now a `content` sub-column header maps every row's content only.
        const contentTh = container.querySelector('[title*="steps.x.output.results[*].output.content)"]');
        expect(contentTh).toBeTruthy();
        fireEvent.click(contentTh);
        expect(onPick).toHaveBeenCalledWith('steps.x.output.results[*].output.content');
    });

    it('sets an absolute binding path on dragStart', () => {
        const { container } = render(
            <OutputView value={VALUE} basePath={BASE} enableDrag onPickPath={vi.fn()} />,
        );
        const th = container.querySelector('[title*="steps.x.output.results[*].output)"]');
        const dataTransfer = dndEvent();
        fireEvent.dragStart(th, { dataTransfer });
        expect(dataTransfer.setData).toHaveBeenCalledWith('application/x-binding-path', 'steps.x.output.results[*].output');
    });

    it('a single cell maps the indexed path', () => {
        const onPick = vi.fn();
        const { container } = render(
            <OutputView value={VALUE} basePath={BASE} enableDrag onPickPath={onPick} />,
        );
        const cell = container.querySelector('td[title*="steps.x.output.results[0].output"]');
        expect(cell).toBeTruthy();
        fireEvent.click(cell);
        expect(onPick).toHaveBeenCalledWith('steps.x.output.results[0].output');
    });

    it('without enableDrag the table is not draggable (Output column unchanged)', () => {
        const { container } = render(<OutputView value={VALUE} basePath={BASE} />);
        // No expand affordance and no draggable headers when mapping is off.
        expect(screen.queryByLabelText('Show fields')).toBeNull();
        const th = container.querySelector('thead th');
        expect(th).toBeTruthy();
        expect(th.getAttribute('draggable')).toBeNull();
    });
});
