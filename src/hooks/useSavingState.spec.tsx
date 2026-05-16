import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import useSavingState from './useSavingState';

function Harness({ onReady, flashMs }: { onReady: (r: ReturnType<typeof useSavingState>) => void; flashMs?: number }) {
    const r = useSavingState(flashMs ? { flashMs } : undefined);
    React.useEffect(() => { onReady(r); }, [r, onReady]);
    return null;
}

describe('useSavingState', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('starts in idle with no error', () => {
        let captured!: ReturnType<typeof useSavingState>;
        render(<Harness onReady={(r) => { captured = r; }} />);
        expect(captured.state).toBe('idle');
        expect(captured.error).toBeNull();
    });

    it('cycles idle → saving → saved → idle (auto-resets after flashMs)', () => {
        let captured!: ReturnType<typeof useSavingState>;
        render(<Harness flashMs={400} onReady={(r) => { captured = r; }} />);
        act(() => { captured.setSaving(); });
        expect(captured.state).toBe('saving');
        act(() => { captured.setSaved(); });
        expect(captured.state).toBe('saved');
        act(() => { vi.advanceTimersByTime(400); });
        expect(captured.state).toBe('idle');
    });

    it('persists in error state until reset/setSaving is called', () => {
        let captured!: ReturnType<typeof useSavingState>;
        render(<Harness onReady={(r) => { captured = r; }} />);
        const e = new Error('boom');
        act(() => { captured.setError(e); });
        expect(captured.state).toBe('error');
        expect(captured.error).toBe(e);
        act(() => { vi.advanceTimersByTime(10000); });
        expect(captured.state).toBe('error');
        act(() => { captured.reset(); });
        expect(captured.state).toBe('idle');
        expect(captured.error).toBeNull();
    });
});
