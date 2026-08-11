import React from 'react';
import { RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useMaintenanceWindow, formatEta } from '../hooks/useMaintenanceWindow';

/**
 * App-wide strip warning that a deployment is rolling and the connection will
 * drop briefly.
 *
 * Sits above the content rather than floating over it: this is a "the ground is
 * about to move" message, and a toast that can be dismissed or missed is the
 * wrong weight for it. It occupies layout only while a window is open, so the
 * normal case costs nothing.
 *
 * The copy names the concrete consequence — an answer stopping mid-sentence —
 * because "brief interruption" does not tell anyone whether to hit send.
 */
export default function MaintenanceBanner({ enabled = true }) {
    const { phase, secondsRemaining } = useMaintenanceWindow({ enabled });

    if (phase === 'idle') return null;

    const style = {
        pending: {
            Icon: RefreshCw,
            spin: true,
            bg: 'rgba(245, 158, 11, 0.12)',
            border: 'rgba(245, 158, 11, 0.35)',
            fg: 'rgb(146, 64, 14)',
            title: 'Update being installed',
            body: `The connection will drop for a moment — an answer in progress may stop mid-sentence. You can continue in ${formatEta(secondsRemaining)}.`,
        },
        overdue: {
            Icon: AlertTriangle,
            spin: false,
            bg: 'rgba(245, 158, 11, 0.12)',
            border: 'rgba(245, 158, 11, 0.35)',
            fg: 'rgb(146, 64, 14)',
            title: 'Update is taking longer than expected',
            body: 'Still reconnecting. Your work is saved — this page will say so as soon as the update lands.',
        },
        recovered: {
            Icon: CheckCircle2,
            spin: false,
            bg: 'rgba(34, 197, 94, 0.12)',
            border: 'rgba(34, 197, 94, 0.35)',
            fg: 'rgb(21, 128, 61)',
            title: 'Update complete',
            body: 'You can carry on. Reload the page if anything looks stale.',
        },
    }[phase];

    if (!style) return null;
    const { Icon, spin, bg, border, fg, title, body } = style;

    return (
        <div
            role="status"
            aria-live="polite"
            className="flex items-start gap-2 px-4 py-2 text-xs border-b"
            style={{ background: bg, borderColor: border, color: fg }}
        >
            <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${spin ? 'animate-spin' : ''}`} />
            <div className="min-w-0">
                <span className="font-semibold">{title}</span>
                <span className="mx-1.5" aria-hidden="true">·</span>
                <span>{body}</span>
            </div>
            {phase === 'recovered' && (
                <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="ml-auto shrink-0 underline font-medium"
                >
                    Reload
                </button>
            )}
        </div>
    );
}
