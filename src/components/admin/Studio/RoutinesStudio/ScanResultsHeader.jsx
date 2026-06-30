import { RefreshCw, Loader2 } from 'lucide-react';
import React from 'react';
import { formatRelative } from './suggestionState';

/**
 * ScanResultsHeader — "Last scanned X ago · Re-scan" row shown above the
 * suggestion grid once we have a prior scan to refer to. The Re-scan button
 * fires a forced scan (bypasses caches). Hidden entirely until there's a
 * lastScannedAt to show.
 */
export default function ScanResultsHeader({ lastScannedAt, scanning, cached, onRescan, disabled = false }) {
    if (!lastScannedAt) return null;
    const rel = formatRelative(lastScannedAt);
    return (
        <div className="max-w-xl mx-auto mb-3 flex items-center justify-center gap-2 text-[11px] text-[var(--text-tertiary)]">
            <span>
                Last scanned {rel || 'just now'}
                {cached ? ' · from cache' : ''}
            </span>
            <span aria-hidden="true">·</span>
            <button
                type="button"
                onClick={() => onRescan?.(true)}
                disabled={scanning || disabled}
                className="inline-flex items-center gap-1 font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-50 transition"
            >
                {scanning
                    ? <Loader2 size={11} className="animate-spin" />
                    : <RefreshCw size={11} />}
                Re-scan
            </button>
        </div>
    );
}
