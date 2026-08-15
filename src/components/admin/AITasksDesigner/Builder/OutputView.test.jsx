import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
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
        expect(onPick).toHaveBeenCalledWith('steps.x.output.results[*].output', { raw: false });
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
        expect(onPick).toHaveBeenCalledWith('steps.x.output.results[*].output.content', { raw: false });
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
        expect(onPick).toHaveBeenCalledWith('steps.x.output.results[0].output', { raw: false });
    });

    it('without enableDrag the table is not draggable (Output column unchanged)', () => {
        const { container } = render(<OutputView value={VALUE} basePath={BASE} />);
        // No expand affordance and no draggable headers when mapping is off.
        expect(screen.queryByLabelText('Show fields')).toBeNull();
        const th = container.querySelector('thead th');
        expect(th).toBeTruthy();
        expect(th.getAttribute('draggable')).toBeNull();
    });

    // Regression: an array of empty objects used to trigger an unbounded
    // RecordTable <-> FriendlyArray render loop (both find zero columns and
    // hand the same array back to each other), hanging/crashing the panel.
    it('renders an array of empty objects without hanging', () => {
        expect(() => render(<OutputView value={[{}]} basePath={BASE} />)).not.toThrow();
        cleanup();
        expect(() => render(<OutputView value={[{}, {}, {}]} basePath={BASE} />)).not.toThrow();
    });
});

describe('OutputView — long text is readable, not silently cut', () => {
    it('clamps a long string but offers the rest', () => {
        const long = 'a'.repeat(1200);
        render(<OutputView value={long} />);
        const toggle = screen.getByText('Show all 1200 characters');
        expect(document.body.textContent).not.toContain(long);
        fireEvent.click(toggle);
        expect(document.body.textContent).toContain(long);
        fireEvent.click(screen.getByText('Show less'));
        expect(document.body.textContent).not.toContain(long);
    });

    it('leaves short text alone', () => {
        render(<OutputView value="hello" />);
        expect(screen.getByText('hello')).toBeTruthy();
        expect(screen.queryByText(/Show all/)).toBeNull();
    });
});

describe('OutputView — array columns (the list-in-a-table complaint)', () => {
    beforeEach(() => cleanup());

    // A table whose column holds a LIST — the user's literal complaint.
    const MAIL = {
        results: [
            { subject: 'A', attachments: [{ filename: 'a1.pdf' }, { filename: 'a2.pdf' }] },
            { subject: 'B', attachments: [{ filename: 'b1.pdf' }] },
            { subject: 'C', attachments: [] },
        ],
    };

    it('an array-of-records cell reads as a labelled list, never as absent data', () => {
        render(<OutputView value={MAIL} basePath={BASE} enableDrag onPickPath={vi.fn()} />);
        // 2 + 1 records, one badge per non-empty cell…
        expect(screen.getByText('2 records')).toBeTruthy();
        expect(screen.getByText('1 record')).toBeTruthy();
        // …and an EMPTY list is a fact ("no attachments"), not the "—" marker.
        expect(screen.getByText('none')).toBeTruthy();
    });

    it('an array column expands into [*] children whose cells actually resolve', () => {
        const onPick = vi.fn();
        render(<OutputView value={MAIL} basePath={BASE} enableDrag onPickPath={onPick} />);
        fireEvent.click(screen.getByLabelText('Open the list in Attachments'));
        // The wildcard cells resolve through the runtime's [*] flatten —
        // a naive dotted walk would render `—` in every one of them.
        expect(screen.getAllByText('a1.pdf, a2.pdf').length).toBeGreaterThan(0);
        expect(screen.getAllByText('b1.pdf').length).toBeGreaterThan(0);
        // The expanded header maps the CHAINED wildcard column.
        const th = document.querySelector('[title*="results[*].attachments[*].filename"]');
        expect(th).toBeTruthy();
        fireEvent.click(th);
        expect(onPick).toHaveBeenCalledWith('steps.x.output.results[*].attachments[*].filename', { raw: false });
    });

    it('the per-column chooser button does not collide with "Show fields"', () => {
        const onPick = vi.fn();
        render(<OutputView value={MAIL} basePath={BASE} enableDrag onPickPath={onPick} />);
        // The chooser is its own affordance with its own name…
        fireEvent.click(screen.getByLabelText("Choose how to use every row's Subject"));
        expect(onPick).toHaveBeenCalledWith('steps.x.output.results[*].subject', { raw: false });
        // …and the expand chevron for the OBJECT column keeps its label.
        render(<OutputView value={VALUE} basePath={BASE} enableDrag onPickPath={vi.fn()} />);
        expect(screen.getByLabelText('Show fields')).toBeTruthy();
    });

    it('says how many columns the cap dropped instead of dropping them silently', () => {
        const wide = [Object.fromEntries(Array.from({ length: 15 }, (_, i) => [`col${i}`, i]))];
        render(<OutputView value={wide} basePath={BASE} />);
        expect(screen.getByText('+3 more columns')).toBeTruthy();
    });
});

describe('OutputView — the table is the answer', () => {
    beforeEach(() => cleanup());

    // Exactly what a Gmail search returns.
    const SEARCH = {
        query: 'isv',
        total: 201,
        results: [{ id: '19ff', to: 'ewoud@beeflow.nl', date: 'Tue, 11 Aug' }],
    };

    it('drops the request echo above the table — the header already counts the rows', () => {
        render(<OutputView value={SEARCH} basePath={BASE} />);
        expect(screen.queryByText('Query:')).toBeNull();
        expect(screen.queryByText('Total:')).toBeNull();
        expect(screen.queryByText('Results')).toBeNull();
        // …and the data itself is right there, unlabelled and above the fold.
        expect(screen.getByText('ewoud@beeflow.nl')).toBeTruthy();
    });

    it('keeps the labels when they are the only thing telling two lists apart', () => {
        render(<OutputView value={{ sent: [{ id: 1 }], failed: [{ id: 2 }] }} basePath={BASE} />);
        expect(screen.getByText('Sent')).toBeTruthy();
        expect(screen.getByText('Failed')).toBeTruthy();
    });

    it('keeps the labels when a scalar is all there is', () => {
        render(<OutputView value={{ status: 'ok', note: 'nothing to do' }} basePath={BASE} />);
        expect(screen.getByText('Status:')).toBeTruthy();
    });

    it('keeps a scalar that is part of the ANSWER, not of the request', () => {
        // Same shape as the search envelope; every word of it is content.
        render(<OutputView value={{ urgency: 'Medium', topSenders: [{ name: '24Accountant' }] }} basePath={BASE} />);
        expect(screen.getByText('Urgency:')).toBeTruthy();
        expect(screen.getByText('Medium')).toBeTruthy();
    });

    it('keeps a lone list\'s label — it is the only word naming the table', () => {
        render(<OutputView value={{ invoices: [{ n: 1 }] }} basePath={BASE} />);
        expect(screen.getByText('Invoices')).toBeTruthy();
    });

    it('caps every column so one long value cannot push the rest off the panel', () => {
        const { container } = render(<OutputView value={SEARCH} basePath={BASE} />);
        const cells = [...container.querySelectorAll('td'), ...container.querySelectorAll('th')];
        expect(cells.length).toBeGreaterThan(0);
        expect(cells.every(c => c.style.maxWidth === '220px')).toBe(true);
    });

    it('shows a cell\'s full contents on hover, once the pointer settles', () => {
        vi.useFakeTimers();
        try {
            const long = { results: [{ to: 'Ewoud van de Kolk <ewoud@beeflow.nl>, Tom Kooy <tomkooy@beeflow.nl>' }] };
            const { container } = render(<OutputView value={long} basePath={BASE} />);
            const td = container.querySelector('td');
            fireEvent.mouseEnter(td);
            // Nothing yet — sweeping across a table must not strobe.
            expect(document.querySelector('[role="tooltip"]')).toBeNull();
            act(() => { vi.advanceTimersByTime(300); });
            const card = document.querySelector('[role="tooltip"]');
            expect(card).toBeTruthy();
            expect(card.textContent).toContain('tomkooy@beeflow.nl');
            fireEvent.mouseLeave(td);
            expect(document.querySelector('[role="tooltip"]')).toBeNull();
        } finally {
            vi.useRealTimers();
        }
    });

    it('stays quiet for a short value that already fits', () => {
        vi.useFakeTimers();
        try {
            const { container } = render(<OutputView value={{ results: [{ n: 201 }] }} basePath={BASE} />);
            fireEvent.mouseEnter(container.querySelector('td'));
            act(() => { vi.advanceTimersByTime(300); });
            expect(document.querySelector('[role="tooltip"]')).toBeNull();
        } finally {
            vi.useRealTimers();
        }
    });
});
