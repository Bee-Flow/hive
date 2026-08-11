import React from 'react';

/**
 * Save-pipeline status badge — extracted verbatim from ProductWebsitePanel.
 * The 5-state machine (idle → dirty → saving → saved / error) is driven by
 * the container's autosave machinery; `onRetry` re-flushes the failed batch.
 */
export default function SaveBadge({ status, onRetry }) {
    const map = {
        idle:   { label: '',                  color: 'var(--text-muted)' },
        dirty:  { label: '● Unsaved',         color: '#fbbf24' },
        saving: { label: 'Saving…',           color: 'var(--text-secondary)' },
        saved:  { label: '✓ Saved',           color: '#34d399' },
        error:  { label: '⚠ Save failed',     color: '#f87171' },
    };
    const s = map[status] || map.idle;
    if (!s.label) return <span />;
    return (
        <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: s.color }}>
            {s.label}
            {status === 'error' && onRetry ? (
                <button
                    type="button"
                    onClick={onRetry}
                    className="ml-1 px-1.5 py-0.5 rounded border border-[var(--border-default)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
                >
                    Retry
                </button>
            ) : null}
        </span>
    );
}
