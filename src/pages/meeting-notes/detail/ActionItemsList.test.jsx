import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import React from 'react';

import ActionItemsList from './ActionItemsList';

/** "YYYY-MM-DD" `days` from today in the viewer's timezone. */
function localDate(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

describe('ActionItemsList due dates', () => {
    afterEach(cleanup);

    it('renders no due chip for items without a spoken deadline', () => {
        render(<ActionItemsList items={[{ id: 'ai-0', text: 'Geen deadline', assignee: 'Tom' }]} />);
        expect(screen.getByText('Geen deadline')).toBeTruthy();
        expect(screen.queryByText(/overdue/i)).toBeNull();
    });

    it('marks a past deadline overdue and leaves a future one neutral', () => {
        render(<ActionItemsList items={[
            { id: 'ai-0', text: 'Te laat', assignee: 'Tom', due: localDate(-1) },
            { id: 'ai-1', text: 'Nog tijd', assignee: 'Sandra', due: localDate(7) },
        ]} />);
        const overdueRow = screen.getByText('Te laat').closest('li');
        expect(within(overdueRow).getByText(/overdue/i)).toBeTruthy();
        const futureRow = screen.getByText('Nog tijd').closest('li');
        expect(within(futureRow).queryByText(/overdue/i)).toBeNull();
    });

    it('never calls a completed item overdue', () => {
        render(<ActionItemsList items={[{ id: 'ai-0', text: 'Af', due: localDate(-30), done: true }]} />);
        expect(screen.queryByText(/overdue/i)).toBeNull();
    });

    it('does not treat today as overdue (local date, not UTC)', () => {
        render(<ActionItemsList items={[{ id: 'ai-0', text: 'Vandaag', due: localDate(0) }]} />);
        expect(screen.queryByText(/overdue/i)).toBeNull();
    });

    it('sorts dated items by deadline, keeping undated ones in discussion order below', () => {
        render(<ActionItemsList items={[
            { id: 'ai-0', text: 'Geen datum A' },
            { id: 'ai-1', text: 'Later', due: '2026-09-01' },
            { id: 'ai-2', text: 'Geen datum B' },
            { id: 'ai-3', text: 'Eerder', due: '2026-08-01' },
        ]} />);
        const texts = screen.getAllByRole('listitem').map((li) => li.textContent);
        expect(texts[0]).toContain('Eerder');
        expect(texts[1]).toContain('Later');
        expect(texts[2]).toContain('Geen datum A');
        expect(texts[3]).toContain('Geen datum B');
    });

    it('leaves order untouched when nothing has a deadline', () => {
        const onToggle = vi.fn();
        render(<ActionItemsList
            items={[{ id: 'ai-0', text: 'Eerst' }, { id: 'ai-1', text: 'Daarna' }]}
            onToggle={onToggle}
        />);
        const texts = screen.getAllByRole('listitem').map((li) => li.textContent);
        expect(texts[0]).toContain('Eerst');
        expect(texts[1]).toContain('Daarna');
    });
});
