import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MeetingLibrary from './MeetingLibrary';

/**
 * A failed list load must not render as an empty library.
 *
 * `useTranscriptions` has always exported `error`, and this component never
 * received it — so a 500 on GET /api/transcriptions showed the first-run
 * empty state ("No meetings yet"), which reads as "your recordings are gone"
 * to a user who has dozens.
 */
describe('MeetingLibrary load failure', () => {
    it('shows a retry affordance instead of the empty state', () => {
        const onRetry = vi.fn();
        render(
            <MeetingLibrary
                meetings={[]}
                loading={false}
                error={Object.assign(new Error('HTTP 500'), { status: 500 })}
                onRetry={onRetry}
                onCapture={() => {}}
            />
        );

        expect(screen.getByText(/Couldn’t load your meetings/i)).toBeTruthy();
        expect(screen.getByText('HTTP 500')).toBeTruthy();
        // The empty state's call to action must be absent — it is the thing
        // that made the failure look like success.
        expect(screen.queryByText(/no meetings yet/i)).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: /try again/i }));
        expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('still shows the empty state when the load succeeded with no meetings', () => {
        render(<MeetingLibrary meetings={[]} loading={false} error={null} onCapture={() => {}} />);
        expect(screen.queryByText(/Couldn’t load your meetings/i)).toBeNull();
    });
});
