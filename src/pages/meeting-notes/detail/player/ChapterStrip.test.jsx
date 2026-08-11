import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import ChapterStrip from './ChapterStrip';

// Blocks in the shape normalizeChapters produces.
const CHAPTERS = [
    { title: 'Opening', seconds: 0, endSeconds: 600, widthFraction: 0.3, summary: 'Ewald opent de vergadering.' },
    { title: 'MFA en inloggen', seconds: 600, endSeconds: 1200, widthFraction: 0.3, summary: 'Bespreking van MFA en inlogproblemen.' },
    { title: 'Afsluiting', seconds: 1200, endSeconds: 1800, widthFraction: 0.4 }, // no summary
];

describe('ChapterStrip hover tooltip', () => {
    afterEach(cleanup);

    it('renders nothing without chapters', () => {
        const { container } = render(<ChapterStrip chapters={[]} />);
        expect(container.firstChild).toBeNull();
    });

    it('shows title + time range + summary when a chapter is hovered', () => {
        render(<ChapterStrip chapters={CHAPTERS} onSeek={() => {}} />);
        // Nothing shown until hover.
        expect(screen.queryByText('Bespreking van MFA en inlogproblemen.')).toBeNull();

        fireEvent.mouseEnter(screen.getByRole('button', { name: /Chapter: MFA en inloggen/ }));
        expect(screen.getByText('Bespreking van MFA en inlogproblemen.')).toBeTruthy();
        expect(screen.getByText(/10:00\s*–\s*20:00/)).toBeTruthy();
    });

    it('shows title + range but no summary line for a chapter without one', () => {
        render(<ChapterStrip chapters={CHAPTERS} onSeek={() => {}} />);
        fireEvent.mouseEnter(screen.getByRole('button', { name: /Chapter: Afsluiting/ }));
        expect(screen.getByText(/20:00\s*–\s*30:00/)).toBeTruthy();
        // No summary text exists for this chapter.
        expect(screen.queryByText('Bespreking van MFA en inlogproblemen.')).toBeNull();
    });

    it('hides the tooltip on mouse leave', () => {
        render(<ChapterStrip chapters={CHAPTERS} onSeek={() => {}} />);
        const btn = screen.getByRole('button', { name: /Chapter: Opening/ });
        fireEvent.mouseEnter(btn);
        expect(screen.getByText('Ewald opent de vergadering.')).toBeTruthy();
        fireEvent.mouseLeave(btn);
        expect(screen.queryByText('Ewald opent de vergadering.')).toBeNull();
    });

    it('seeks to the chapter start on click', () => {
        const onSeek = vi.fn();
        render(<ChapterStrip chapters={CHAPTERS} onSeek={onSeek} />);
        fireEvent.click(screen.getByRole('button', { name: /Chapter: MFA en inloggen/ }));
        expect(onSeek).toHaveBeenCalledWith(600);
    });
});
