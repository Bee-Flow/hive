/**
 * The Cowork empty state.
 *
 * Two things matter here. The heading has to promise what the composer will
 * actually do — in Cowork the next thing you type is not answered on screen,
 * it goes off and runs — and the starters must FILL the box rather than send,
 * because a click that silently schedules recurring work is not recoverable
 * from the same click.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import CoworkWelcome, {
    CoworkWelcomeHeader, COWORK_HEADING, COWORK_STARTERS,
} from './CoworkWelcome';

describe('CoworkWelcome', () => {
    it('promises scheduled work, not a chat answer', () => {
        render(<CoworkWelcome />);
        expect(screen.getByText(COWORK_HEADING)).toBeInTheDocument();
        expect(screen.getByText(/runs on its own/i)).toBeInTheDocument();
    });

    it('renders the composer it is given', () => {
        render(<CoworkWelcome><div data-testid="composer" /></CoworkWelcome>);
        expect(screen.getByTestId('composer')).toBeInTheDocument();
    });

    it('a starter fills the box instead of scheduling anything', () => {
        const onStarterClick = vi.fn();
        render(<CoworkWelcome onStarterClick={onStarterClick} />);

        const starters = screen.getAllByTestId('cowork-starter');
        expect(starters).toHaveLength(COWORK_STARTERS.length);
        fireEvent.click(starters[0]);
        expect(onStarterClick).toHaveBeenCalledWith(COWORK_STARTERS[0]);
    });

    it('survives a missing starter handler', () => {
        render(<CoworkWelcome />);
        // No onStarterClick wired — clicking must not throw.
        expect(() => fireEvent.click(screen.getAllByTestId('cowork-starter')[0])).not.toThrow();
    });

    it('every starter describes a schedule — that is the whole point', () => {
        for (const text of COWORK_STARTERS) {
            expect(text).toMatch(/every|each|on the/i);
        }
    });

    it('the header alone is reusable by the Cowork page', () => {
        render(<CoworkWelcomeHeader />);
        expect(screen.getByTestId('cowork-welcome')).toBeInTheDocument();
        expect(screen.getByText(COWORK_HEADING)).toBeInTheDocument();
        // No starters and no composer slot — the page supplies its own.
        expect(screen.queryByTestId('cowork-starter')).not.toBeInTheDocument();
    });
});
