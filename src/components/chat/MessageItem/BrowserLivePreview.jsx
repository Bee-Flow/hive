import React from 'react';
import { Globe } from 'lucide-react';

/**
 * Live thumbnail of a browse_web tool call, mirroring Tests Studio's agent-mode
 * live view (RunResults.jsx AgentLiveView): a plain <img> swapped on each
 * throttled JPEG frame streamed over the chat's existing SSE connection.
 *
 * Driven by a single `preview` object on the message (msg.browserPreview),
 * decoupled from msg.toolCall so a co-running tool can't hide it.
 */
export default function BrowserLivePreview({ preview }) {
    if (!preview) return null;
    const { url, task, queued, queuePosition, frame, action, ended } = preview;

    // Nothing to show yet and not queued → don't render an empty box.
    if (!frame && !queued) {
        // Session started but first frame hasn't arrived — show a slim loading strip.
        if (ended) return null;
    }

    return (
        <div
            className="mt-1.5 rounded-lg overflow-hidden w-full"
            style={{ maxWidth: 620, border: '1px solid var(--border-subtle)', background: 'var(--bg-tertiary)' }}
        >
            <div
                className="flex items-center gap-1.5 px-2 py-1 text-[10px] truncate"
                style={{ color: 'var(--text-tertiary)', borderBottom: '1px solid var(--border-subtle)' }}
            >
                <Globe className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{url || task || 'Browsing…'}</span>
                {ended && <span className="ml-auto flex-shrink-0 opacity-70">done</span>}
            </div>

            {frame ? (
                <img
                    src={`data:image/jpeg;base64,${frame}`}
                    alt="Live browser preview"
                    className="w-full h-auto block"
                    style={{ opacity: ended ? 0.75 : 1 }}
                />
            ) : (
                <div className="px-2 py-3 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                    {queued
                        ? `Waiting for an available browser session${queuePosition ? ` (${queuePosition} ahead)` : ''}…`
                        : 'Opening the browser…'}
                </div>
            )}

            {!ended && action && frame && (
                <div className="px-2 py-1 text-[10px] truncate" style={{ color: 'var(--text-tertiary)', borderTop: '1px solid var(--border-subtle)' }}>
                    {action}
                </div>
            )}
        </div>
    );
}
