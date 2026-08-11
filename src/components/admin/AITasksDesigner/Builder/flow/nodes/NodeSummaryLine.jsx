import React from 'react';

/**
 * The one line under a node's name. Takes what flow/nodeSummaries.js returns —
 * a plain string, or `{ muted }` for the "not answered yet" state, which every
 * card renders the same way (italic, tertiary) so a half-configured node looks
 * half-configured wherever it appears.
 */
export default function NodeSummaryLine({ summary, title = undefined }) {
    if (!summary) return null;
    const muted = typeof summary === 'object';
    const text = muted ? summary.muted : summary;
    return (
        <div className="mt-0.5 text-[10px] text-[var(--text-secondary)] truncate" title={title || (muted ? undefined : text)}>
            {muted ? <span className="italic text-[var(--text-tertiary)]">{text}</span> : text}
        </div>
    );
}
