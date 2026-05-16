// Returns a stable debounced wrapper around `fn`. Subsequent invocations
// reset the timer; the wrapped call fires `ms` milliseconds after the
// last invocation.
//
// Replaces the inline debounce-ref pattern in RoutineEditor, PreviewFrame,
// WebpagePickerPopover, MemoryPanel, MarkdownRenderer, etc.
//
//   const saveDraft = useDebouncedCallback((draft) => persist(draft), 500);
//   onChange={(e) => { setDraft(e.target.value); saveDraft(e.target.value); }}
//
// The returned function exposes a `.cancel()` method to abort a pending
// fire (useful in unmount-after-blur flows).

import { useCallback, useEffect, useRef } from 'react';

export interface DebouncedFunction<F extends (...args: any[]) => void> {
    (...args: Parameters<F>): void;
    cancel: () => void;
    flush: () => void;
}

export default function useDebouncedCallback<F extends (...args: any[]) => void>(
    fn: F,
    ms: number,
): DebouncedFunction<F> {
    // Keep the latest fn in a ref so identity changes don't recreate the
    // debounced wrapper (which would otherwise reset its timer chain).
    const fnRef = useRef<F>(fn);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const argsRef = useRef<Parameters<F> | null>(null);
    fnRef.current = fn;

    const cancel = useCallback(() => {
        if (timerRef.current != null) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
            argsRef.current = null;
        }
    }, []);

    const flush = useCallback(() => {
        if (timerRef.current != null && argsRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
            const args = argsRef.current;
            argsRef.current = null;
            fnRef.current(...args);
        }
    }, []);

    useEffect(() => cancel, [cancel]);

    const debounced = useCallback((...args: Parameters<F>) => {
        argsRef.current = args;
        if (timerRef.current != null) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            timerRef.current = null;
            argsRef.current = null;
            fnRef.current(...args);
        }, ms);
    }, [ms]) as DebouncedFunction<F>;

    debounced.cancel = cancel;
    debounced.flush = flush;
    return debounced;
}
