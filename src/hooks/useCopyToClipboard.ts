// Clipboard copy with a transient "copied" indicator.
//
// Replaces the 20+ inline `navigator.clipboard.writeText(...)` callers
// across the codebase (WorkspacePanel, MarkdownRenderer, MessageItem,
// BehaviorSection, AITasksDesigner, JsonTab, WebhookPanel, ...).
//
// Usage:
//   const { copy, copied } = useCopyToClipboard();
//   <button onClick={() => copy(value)}>
//     {copied ? 'Copied' : 'Copy'}
//   </button>
//
// `copied` flips to `true` on a successful copy and auto-resets after
// `resetMs` milliseconds (default 1500). On failure (no clipboard API,
// permission denied, write-protected document) `copy` resolves to false
// and `copied` stays false so the caller can render an error message.

import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseCopyToClipboardOptions {
    /** Milliseconds before `copied` flips back to false. */
    resetMs?: number;
}

export interface UseCopyToClipboardReturn {
    copy: (text: string) => Promise<boolean>;
    copied: boolean;
    reset: () => void;
}

export default function useCopyToClipboard(
    { resetMs = 1500 }: UseCopyToClipboardOptions = {},
): UseCopyToClipboardReturn {
    const [copied, setCopied] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearTimer = () => {
        if (timerRef.current != null) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    };

    useEffect(() => () => clearTimer(), []);

    const copy = useCallback(async (text: string): Promise<boolean> => {
        try {
            if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
                clearTimer();
                setCopied(true);
                timerRef.current = setTimeout(() => setCopied(false), resetMs);
                return true;
            }
        } catch {
            // Fall through to manual reset; some browsers reject in non-secure
            // contexts even though the API exists.
        }
        return false;
    }, [resetMs]);

    const reset = useCallback(() => {
        clearTimer();
        setCopied(false);
    }, []);

    return { copy, copied, reset };
}
