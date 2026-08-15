/**
 * Time formatting for the Cowork surface.
 *
 * Lives here rather than in each view because the list, the detail header and
 * the run history all state the same three things — how long ago, how long it
 * took, and exactly when — and they used to word them differently.
 */

/** "just now" / "12m ago" / "3h ago" / "2d ago" / "5w ago". */
export function relativeTime(dateStr) {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return `${Math.floor(days / 7)}w ago`;
}

/** "820ms" / "5.2s" / "2m 7s". */
export function formatDuration(ms) {
    if (ms == null) return '';
    if (ms < 1000) return `${ms}ms`;
    const secs = ms / 1000;
    if (secs < 60) return `${secs.toFixed(1)}s`;
    const mins = Math.floor(secs / 60);
    return `${mins}m ${Math.round(secs % 60)}s`;
}

/** "13 Aug, 11:29" — a run row needs the date, not a relative hand-wave. */
export function fullTimestamp(dateStr) {
    if (!dateStr) return '';
    try {
        return new Date(dateStr).toLocaleString(undefined, {
            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
        });
    } catch (_) {
        return dateStr;
    }
}
