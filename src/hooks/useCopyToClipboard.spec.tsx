import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import useCopyToClipboard from './useCopyToClipboard';

type Result = { copied: boolean; copy: (s: string) => Promise<boolean> };

function Harness({ onReady, resetMs }: { onReady: (r: Result) => void; resetMs?: number }) {
    const r = useCopyToClipboard(resetMs ? { resetMs } : undefined);
    React.useEffect(() => { onReady(r); }, [r, onReady]);
    return null;
}

describe('useCopyToClipboard', () => {
    let writeText: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.useFakeTimers();
        writeText = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { writeText },
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('writes the text and flips copied=true after a successful copy', async () => {
        let captured!: Result;
        render(<Harness onReady={(r) => { captured = r; }} />);
        await act(async () => {
            const ok = await captured.copy('hello');
            expect(ok).toBe(true);
        });
        expect(writeText).toHaveBeenCalledWith('hello');
        expect(captured.copied).toBe(true);
    });

    it('auto-resets copied after resetMs', async () => {
        let captured!: Result;
        render(<Harness resetMs={500} onReady={(r) => { captured = r; }} />);
        await act(async () => { await captured.copy('x'); });
        expect(captured.copied).toBe(true);
        await act(async () => { vi.advanceTimersByTime(500); });
        expect(captured.copied).toBe(false);
    });

    it('returns false when the clipboard write rejects', async () => {
        writeText.mockRejectedValueOnce(new Error('denied'));
        let captured!: Result;
        render(<Harness onReady={(r) => { captured = r; }} />);
        let ok = true;
        await act(async () => { ok = await captured.copy('x'); });
        expect(ok).toBe(false);
        expect(captured.copied).toBe(false);
    });
});
