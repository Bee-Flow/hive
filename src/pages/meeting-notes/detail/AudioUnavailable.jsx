import React from 'react';
import { AlertTriangle, Download, RefreshCw } from 'lucide-react';

/**
 * Shown in place of the player when a meeting's audio cannot be served.
 *
 * The point of this component is honesty. The old behaviour was a single
 * message — "Saved audio not found. Cannot reprocess — please upload again" —
 * which is wrong in two different ways: it reads as permanent data loss during
 * a passing storage outage, and it asks for a file that never existed when the
 * meeting was recorded in the browser.
 *
 * Three states, three different truths:
 *   recoverable          the durable copy is fine, the audio service is briefly
 *                        unreachable → offer Retry
 *   capture 'recording'  the bytes existed only here and are gone → say so, and
 *                        do NOT ask for a file the user cannot produce
 *   otherwise            an uploaded file → asking for the original is fair
 */
export default function AudioUnavailable({ audio, onRetry }) {
    const recoverable = !!audio?.recoverable;
    const wasRecorded = audio?.capture === 'recording';

    let title;
    let detail;
    if (recoverable) {
        title = 'Audio is temporarily unavailable';
        detail = 'The recording is stored safely — the audio service just isn’t reachable right now.';
    } else if (wasRecorded) {
        title = 'This recording is no longer available';
        detail = 'It was recorded in your browser, so no other copy of the audio exists. The transcript and summary below are what remains.';
    } else {
        title = 'The saved audio is no longer available';
        detail = 'Upload the original file again to restore playback and re-transcribe it.';
    }

    return (
        <div
            className="flex flex-col items-center justify-center gap-2 rounded-xl border px-4 py-6 text-center"
            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}
        >
            <AlertTriangle className="w-6 h-6" style={{ color: recoverable ? '#f59e0b' : '#ef4444' }} />
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</p>
            <p className="text-xs max-w-md" style={{ color: 'var(--text-muted)' }}>{detail}</p>
            {recoverable && onRetry && (
                <button
                    type="button"
                    onClick={onRetry}
                    className="mt-1 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium"
                    style={{ background: 'var(--accent-primary)', color: '#fff' }}
                >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Try again
                </button>
            )}
        </div>
    );
}

/**
 * Quiet warning for a note that plays fine today but has no durable backup —
 * on a multi-replica deploy that is one restart from the state above. Offers the
 * download, which is the user's own escape hatch while it still exists.
 */
export function AudioNotBackedUp({ downloadUrl }) {
    return (
        <div
            className="flex items-center gap-2 rounded-lg border px-3 py-2 text-[11px]"
            style={{ background: 'var(--bg-secondary)', borderColor: '#f59e0b', color: 'var(--text-muted)' }}
        >
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" style={{ color: '#f59e0b' }} />
            <span className="flex-1">This recording doesn&rsquo;t have a durable backup yet.</span>
            {downloadUrl && (
                <a
                    href={downloadUrl}
                    className="inline-flex items-center gap-1 font-medium hover:underline"
                    style={{ color: 'var(--accent-primary)' }}
                >
                    <Download className="w-3.5 h-3.5" />
                    Download
                </a>
            )}
        </div>
    );
}
