import React, { useEffect, useState } from 'react';

/**
 * Sticky banner shown while a run is in flight — n8n's "Workflow is
 * executing…" pill with live step count and a Stop button. Anchored at
 * the top of the diagram column.
 */
export default function RunProgressBanner({ run, steps, onStop }) {
    const total = steps?.length || 0;
    const done = (steps || []).filter(s => s.status === 'success' || s.status === 'skipped' || s.status === 'pinned').length;
    const failed = (steps || []).some(s => s.status === 'error');
    const startedAt = run?.startedAt ? new Date(run.startedAt).getTime() : null;
    const [elapsed, setElapsed] = useState(startedAt ? Date.now() - startedAt : 0);
    useEffect(() => {
        if (!startedAt) return;
        const h = setInterval(() => setElapsed(Date.now() - startedAt), 250);
        return () => clearInterval(h);
    }, [startedAt]);
    return (
        <div className="absolute left-1/2 -translate-x-1/2 top-3 z-30 flex items-center gap-3 px-3 py-1.5 rounded-full bg-[var(--bg-card,#fff)] border border-[var(--border-default)] shadow-md text-xs">
            <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${failed ? 'bg-red-500' : 'bg-[var(--accent)]'}`} />
                <span className={`relative inline-flex rounded-full h-2 w-2 ${failed ? 'bg-red-500' : 'bg-[var(--accent)]'}`} />
            </span>
            <span className="font-medium text-[var(--text-primary)]">
                {failed ? 'Run failing' : 'Running'} — {done}/{total || '?'} steps
            </span>
            <span className="text-[var(--text-tertiary)] tabular-nums">
                {Math.floor(elapsed / 1000)}.{Math.floor((elapsed % 1000) / 100)}s
            </span>
            <button
                onClick={onStop}
                title="Stop this run"
                className="ml-1 px-2 py-0.5 rounded-full text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-red-600 transition"
            >
                Stop
            </button>
        </div>
    );
}
