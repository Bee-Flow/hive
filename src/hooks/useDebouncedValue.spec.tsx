import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import useDebouncedValue from './useDebouncedValue';
import useDebouncedCallback from './useDebouncedCallback';

function ValueHarness({ value, ms, onChange }: { value: string; ms: number; onChange: (v: string) => void }) {
    const debounced = useDebouncedValue(value, ms);
    React.useEffect(() => { onChange(debounced); }, [debounced, onChange]);
    return null;
}

function CallbackHarness({ ms, onReady }: { ms: number; onReady: (fn: ReturnType<typeof useDebouncedCallback>) => void }) {
    const inner = vi.fn();
    const debounced = useDebouncedCallback(inner, ms);
    React.useEffect(() => { onReady(debounced); }, [debounced, onReady]);
    (debounced as any)._inner = inner;
    return null;
}

describe('useDebouncedValue', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('returns the initial value synchronously', () => {
        const seen: string[] = [];
        render(<ValueHarness value="a" ms={100} onChange={(v) => seen.push(v)} />);
        expect(seen[0]).toBe('a');
    });

    it('only flips after the timeout elapses without further changes', () => {
        const seen: string[] = [];
        const { rerender } = render(<ValueHarness value="a" ms={100} onChange={(v) => seen.push(v)} />);
        rerender(<ValueHarness value="b" ms={100} onChange={(v) => seen.push(v)} />);
        act(() => { vi.advanceTimersByTime(50); });
        rerender(<ValueHarness value="c" ms={100} onChange={(v) => seen.push(v)} />);
        // Timer restarts on each value change; advance the full ms to land on 'c'.
        act(() => { vi.advanceTimersByTime(100); });
        expect(seen[seen.length - 1]).toBe('c');
    });
});

describe('useDebouncedCallback', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('fires the wrapped fn only after the timeout, with the last args', () => {
        let captured!: any;
        render(<CallbackHarness ms={50} onReady={(fn) => { captured = fn; }} />);
        captured(1); captured(2); captured(3);
        act(() => { vi.advanceTimersByTime(50); });
        expect(captured._inner).toHaveBeenCalledTimes(1);
        expect(captured._inner).toHaveBeenCalledWith(3);
    });

    it('cancel() prevents a pending fire', () => {
        let captured!: any;
        render(<CallbackHarness ms={50} onReady={(fn) => { captured = fn; }} />);
        captured(1);
        captured.cancel();
        act(() => { vi.advanceTimersByTime(100); });
        expect(captured._inner).not.toHaveBeenCalled();
    });

    it('flush() runs the pending call immediately', () => {
        let captured!: any;
        render(<CallbackHarness ms={50} onReady={(fn) => { captured = fn; }} />);
        captured('done');
        captured.flush();
        expect(captured._inner).toHaveBeenCalledWith('done');
        act(() => { vi.advanceTimersByTime(50); });
        // Should not fire a second time after flush.
        expect(captured._inner).toHaveBeenCalledTimes(1);
    });
});
