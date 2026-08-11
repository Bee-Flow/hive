import React, { useEffect, useState } from 'react';
import { AlertCircle, Loader2, Check } from 'lucide-react';

/**
 * Shared save-status chip — the one answer to "is my work saved?".
 *
 * Used by the webpage IDE (StatusBar + editor top bar) and by the routines
 * builder's node-config modal. Announces changes to assistive tech via
 * role="status" aria-live; on 'error' it becomes a button that re-runs the
 * save (onRetry).
 *
 * `showWhenIdle` keeps the chip on screen once something HAS been saved,
 * reading "Saved 2m ago" instead of disappearing. Auto-saving surfaces need
 * that: when the only feedback is a Save button greying out, the user has no
 * way to tell a successful save from a silent failure (BFSF-338).
 *
 * Colours go through `--vsc-fg-muted` where that theme is in scope and fall
 * back to the project tokens everywhere else.
 */
function fmtTime(date) {
    if (!date) return '';
    const diff = (Date.now() - date.getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
}

const MUTED = 'var(--vsc-fg-muted, var(--text-tertiary))';
const DANGER = 'var(--text-error, var(--error, #dc2626))';

export default function SaveStatus({
    saveState,
    lastSavedAt,
    onRetry,
    size = 11,
    className = '',
    showWhenIdle = false,
}) {
    // "just now" must not still say "just now" ten minutes later. Only ticks
    // while there is a timestamp on screen to go stale.
    const [, tick] = useState(0);
    const showsAge = !!lastSavedAt && (saveState === 'saved' || (showWhenIdle && (!saveState || saveState === 'idle')));
    useEffect(() => {
        if (!showsAge) return undefined;
        const h = setInterval(() => tick(n => n + 1), 30_000);
        return () => clearInterval(h);
    }, [showsAge]);

    const iconSize = Math.round(size * 0.9);
    const base = `inline-flex items-center gap-1 ${className}`;

    if (!saveState || saveState === 'idle') {
        if (!showsAge) return null;
        return (
            <span role="status" aria-live="polite" className={base} style={{ fontSize: size, color: MUTED }}>
                <Check size={iconSize} /> Saved {fmtTime(lastSavedAt)}
            </span>
        );
    }

    if (saveState === 'saving') {
        return (
            <span role="status" aria-live="polite" className={base} style={{ fontSize: size, color: MUTED }}>
                <Loader2 size={iconSize} className="animate-spin" /> Saving…
            </span>
        );
    }

    if (saveState === 'error') {
        const content = <><AlertCircle size={iconSize} /> Save failed{onRetry ? ' — retry' : ''}</>;
        const style = { fontSize: size, color: DANGER };
        return onRetry ? (
            <button
                type="button"
                onClick={onRetry}
                aria-live="assertive"
                className={`${base} hover:underline`}
                style={{ ...style, cursor: 'pointer' }}
                title="Retry save"
            >
                {content}
            </button>
        ) : (
            <span role="status" aria-live="assertive" className={base} style={style}>{content}</span>
        );
    }

    // saved
    return (
        <span role="status" aria-live="polite" className={base} style={{ fontSize: size, color: MUTED }}>
            <Check size={iconSize} /> Saved {fmtTime(lastSavedAt)}
        </span>
    );
}
