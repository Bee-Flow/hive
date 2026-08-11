import { render, screen, act, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Toaster, toast } from './Toast';

/**
 * The behaviour that matters here is what happens when the SAME message keeps
 * arriving. The routines builder re-saves a debounced draft roughly every
 * 500ms, and a definition the server rejects fails every single time — at a
 * 6-second error duration that used to stack a dozen identical toasts over the
 * canvas (BFSF-348).
 */
const toasts = () => screen.queryAllByRole('alert').concat(screen.queryAllByRole('status'));

describe('Toaster — repeats collapse', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { cleanup(); vi.useRealTimers(); });

    const push = (fn: () => void) => act(() => { fn(); });

    it('shows one toast with a counter instead of one toast per repeat', () => {
        render(<Toaster />);
        push(() => toast.error('Save failed'));
        expect(toasts()).toHaveLength(1);
        expect(screen.queryByText('×2')).toBeNull();

        push(() => toast.error('Save failed'));
        push(() => toast.error('Save failed'));

        expect(toasts()).toHaveLength(1);
        expect(screen.getByText('×3')).toBeTruthy();
    });

    it('keeps a repeating message on screen — each repeat restarts its countdown', () => {
        render(<Toaster />);
        push(() => toast.error('Save failed'));

        act(() => { vi.advanceTimersByTime(5000); });   // nearly expired (6s)
        push(() => toast.error('Save failed'));         // …but it happened again
        act(() => { vi.advanceTimersByTime(5000); });
        expect(toasts()).toHaveLength(1);

        act(() => { vi.advanceTimersByTime(1500); });   // now the retries stopped
        expect(toasts()).toHaveLength(0);
    });

    it('treats a different message, or the same text at a different level, as its own toast', () => {
        render(<Toaster />);
        push(() => toast.error('Save failed'));
        push(() => toast.error('Something else failed'));
        push(() => toast.info('Save failed'));
        expect(toasts()).toHaveLength(3);
    });

    it('caps the stack and drops the oldest', () => {
        render(<Toaster />);
        push(() => { for (let i = 1; i <= 6; i++) toast.info(`Message ${i}`); });
        expect(toasts()).toHaveLength(4);
        expect(screen.queryByText('Message 1')).toBeNull();
        expect(screen.queryByText('Message 2')).toBeNull();
        expect(screen.getByText('Message 3')).toBeTruthy();
        expect(screen.getByText('Message 6')).toBeTruthy();
    });

    it('dismisses on request, and a later repeat starts a fresh toast', () => {
        render(<Toaster />);
        let id = 0;
        push(() => { id = toast.error('Save failed'); });
        push(() => toast.dismiss(id));
        expect(toasts()).toHaveLength(0);

        push(() => toast.error('Save failed'));
        expect(toasts()).toHaveLength(1);
        expect(screen.queryByText('×2')).toBeNull();
    });

    it('an expired toast leaves no timer behind that could clear its successor', () => {
        render(<Toaster />);
        push(() => toast.info('Done'));
        act(() => { vi.advanceTimersByTime(3000); });
        expect(toasts()).toHaveLength(0);

        push(() => toast.info('Done'));
        act(() => { vi.advanceTimersByTime(2000); });
        expect(toasts()).toHaveLength(1);
    });
});
