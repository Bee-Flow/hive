/**
 * The one place that decides what state a cowork item is in.
 *
 * There used to be two: the list card read `lastStatus` almost directly, the
 * Studio detail pane derived a richer answer, and the same item could show
 * "Idle" in one and "Finished" in the other. Everything now calls this.
 *
 * The subtlety it exists for: `isActive === false` means very little on its
 * own. A one-off started with "Run now" is deactivated server-side *before* it
 * fires, so an inactive, never-run row is usually mid-flight — reading it as
 * idle tells the user nothing is happening seconds after they pressed Run.
 */
import { tokenFor } from '../shared/statusTokens';

/** True while an item is running or has not produced its first run yet. */
export function isInFlight(item) {
    return item.lastStatus === 'running' || (!item.lastRunAt && !item.runCount);
}

export function coworkStatus(item) {
    if (item.lastStatus === 'running') return tokenFor('running');
    if (!item.lastRunAt && !item.runCount) return tokenFor(item.isActive ? 'queued' : 'idle');
    if (!item.isActive && item.lastStatus === 'success') return tokenFor('success');
    if (!item.isActive) return tokenFor(item.lastStatus === 'error' ? 'error' : 'paused');
    return tokenFor(item.lastStatus);
}
