import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import DecisionsQuestionsPanel from './DecisionsQuestionsPanel';

const DECISIONS = [
    { id: 'd-0', text: 'Plan A goedgekeurd', timestamp: '12:30' },
    { id: 'd-1', text: 'Budget verhoogd', timestamp: '' }, // unreadable stamp → no chip
];
const QUESTIONS = [
    { id: 'q-0', text: 'Wie regelt de licentie?', timestamp: '20:00', open: true },
    { id: 'q-1', text: 'Wanneer is de demo?', timestamp: '25:00', open: false },
];

describe('DecisionsQuestionsPanel', () => {
    afterEach(cleanup);

    it('renders nothing when both artifact lists are empty (old notes)', () => {
        const { container } = render(<DecisionsQuestionsPanel decisions={[]} questions={[]} />);
        expect(container.firstChild).toBeNull();
    });

    it('lists decisions and badges open vs answered questions', () => {
        render(<DecisionsQuestionsPanel decisions={DECISIONS} questions={QUESTIONS} onSeek={() => {}} />);
        expect(screen.getByText('Decisions')).toBeTruthy();
        expect(screen.getByText('Plan A goedgekeurd')).toBeTruthy();
        expect(screen.getByText('open')).toBeTruthy();
        expect(screen.getByText('answered')).toBeTruthy();
    });

    it('seeks on a timestamp chip but renders no chip for junk stamps', () => {
        const onSeek = vi.fn();
        render(<DecisionsQuestionsPanel decisions={DECISIONS} questions={[]} onSeek={onSeek} />);
        fireEvent.click(screen.getByRole('button', { name: /12:30/ }));
        expect(onSeek).toHaveBeenCalledWith(750);
        // The empty-timestamp decision has no seek chip at all.
        expect(screen.getAllByRole('button')).toHaveLength(1);
    });
});
