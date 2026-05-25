import { Terminal } from 'lucide-react';
import React from 'react';

/**
 * Logs sub-tab placeholder. The live tail subscribes to a per-run SSE
 * stream that lands with Phase 2 of the runs/observability work
 * (server/core/runEventBus.js + GET /api/automation/runs/:id/stream).
 * Until then this tab tells the user where to look in the meantime.
 */
export default function StepLogsTab() {
    return (
        <div className="flex flex-col h-full min-h-0 items-center justify-center text-center px-6 py-12 text-[11px] text-[var(--text-tertiary)] gap-2">
            <Terminal size={18} className="opacity-60" />
            <div className="text-[var(--text-secondary)]">
                Streaming step logs arrive in Phase 2.
            </div>
            <div>
                For now, use the Output tab for the step result and the
                run history list for ordered execution traces.
            </div>
        </div>
    );
}
