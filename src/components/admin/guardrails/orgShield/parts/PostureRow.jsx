import {
    AlertTriangle, Ban, ChevronRight, Eye, Globe, Info, ListPlus, Repeat,
    ScanSearch, Search, ShieldAlert, ShieldOff, SlidersHorizontal, Workflow, Wrench,
} from 'lucide-react';
import React from 'react';

/**
 * One line of the Overview tab: icon | label | value | Change →
 *
 * The row is READ-ONLY on purpose. A summary that also edits is a second place
 * for every setting to live, and the two drift. "Change" jumps to the tab that
 * owns the control instead.
 */

// A name→component map rather than storing components in the posture module:
// that module is pure and unit-tested, and it should not import React just to
// name an icon.
const ICONS = {
    AlertTriangle, Ban, Eye, Globe, ListPlus, Repeat, ScanSearch, Search,
    ShieldAlert, ShieldOff, SlidersHorizontal, Workflow, Wrench,
};

const TONE_COLOR = {
    ok: 'var(--text-muted)',
    note: '#3b82f6',
    warn: '#d97706',
    error: '#ef4444',
};

export function PostureRow({ row, label, value, hint, onGoTo, goToLabel }) {
    const Icon = ICONS[row.icon] || Info;
    const color = TONE_COLOR[row.tone] || TONE_COLOR.ok;
    const isAlert = row.tone === 'warn' || row.tone === 'error';

    return (
        <div
            className="flex items-start gap-3 px-4 py-3"
            style={{ borderBottom: '1px solid var(--border-subtle)' }}
        >
            <Icon className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" style={{ color }} />
            <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>{label}</span>
                    <span
                        className="text-[13px]"
                        style={{ color: isAlert ? color : 'var(--text-secondary)' }}
                        // Screen readers get the same emphasis sighted users
                        // get from the amber: a summary whose only warning
                        // signal is colour is not a warning for everyone.
                        role={isAlert ? 'status' : undefined}
                    >{value}</span>
                </div>
                {hint && (
                    <p className="text-[11px] mt-0.5 leading-relaxed" style={{ color: isAlert ? color : 'var(--text-muted)' }}>
                        {hint}
                    </p>
                )}
            </div>
            {row.tab && onGoTo && (
                <button
                    type="button"
                    onClick={() => onGoTo(row.tab)}
                    className="text-[11px] shrink-0 inline-flex items-center gap-0.5 hover:underline"
                    style={{ color: 'var(--accent-primary)' }}
                >
                    {goToLabel}
                    <ChevronRight className="w-3 h-3" aria-hidden="true" />
                </button>
            )}
        </div>
    );
}

export default PostureRow;
