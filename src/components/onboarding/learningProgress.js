// Per-lesson completion tracking for the Learning Center.
//
// Two layers, mirroring how the intro tour persists `hasSeenIntroTour`:
//   • scopedStorage (per-user localStorage) — instant, same-browser source of truth
//   • POST/GET /ai/user-settings { learningProgress } — server blob, cross-device
//
// The engine's finish() calls markLessonComplete(); the Learning Center page calls
// fetchLearningProgress() on mount to hydrate checkmarks from the server. Every
// access is window/SSR-guarded and network calls are best-effort, so a failure
// never blocks the UI.

import scopedStorage from '../../utils/scopedStorage';
import { API_BASE, authFetch } from '../../utils/helpers';
import { isEphemeralLessonId } from './lessons';

export const LEARNING_PROGRESS_KEY = 'learningProgress';

const hasWindow = () => typeof window !== 'undefined';

// Point scopedStorage at the active user before any read/write (it namespaces
// keys as beeflow:{userId}:learningProgress).
function withUser(user) {
    try { if (user?.id) scopedStorage.setCurrentUser(user.id); } catch (_) { /* ignore */ }
}

// Read the local progress map: { [lessonId]: { completedAt } }.
export function readLearningProgress(user) {
    if (!hasWindow()) return {};
    try {
        withUser(user);
        const map = scopedStorage.getJSON(LEARNING_PROGRESS_KEY, {});
        return map && typeof map === 'object' ? map : {};
    } catch (_) {
        return {};
    }
}

// A lesson counts as complete only when its entry carries a completedAt — a bare
// entry that only holds resume `steps` (a lesson started but not finished) is NOT
// complete. (Legacy entries are always { completedAt }, so this is compatible.)
export function isLessonComplete(user, lessonId) {
    return lessonEntryComplete(readLearningProgress(user)[lessonId]);
}

// Shared completion predicate so the page and helpers agree. Accepts the legacy
// `=== true` shape and the `{ completedAt }` shape; rejects resume-only entries.
export function lessonEntryComplete(entry) {
    return entry === true || !!(entry && entry.completedAt);
}

// The per-step resume/score state stored alongside a lesson's progress entry:
// { [stepId]: { status, score, answers, ... } }.
export function readStepState(user, lessonId) {
    const entry = readLearningProgress(user)[lessonId];
    return (entry && typeof entry.steps === 'object' && entry.steps) || {};
}

// A { [lessonId]: true } map of COMPLETED lessons (completedAt present). Shared
// by the Learning Center page and the player host to derive course/badge state.
// The legacy intro-tour flag is no longer injected here: the tour engine writes
// a real getting-started completion on finish, and the server lazily migrates
// pre-tracking users (learning_intro_migrated_user_*) — injecting it locally
// would resurrect getting-started after a reset.
export function readCompletedMap(user) {
    const progress = readLearningProgress(user);
    const map = {};
    Object.keys(progress).forEach((id) => { if (lessonEntryComplete(progress[id])) map[id] = true; });
    return map;
}

function writeLocal(user, map) {
    try {
        withUser(user);
        scopedStorage.setJSON(LEARNING_PROGRESS_KEY, map);
    } catch (_) { /* ignore quota */ }
}

async function syncProgress(merged) {
    try {
        await authFetch(`${API_BASE}/ai/user-settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ [LEARNING_PROGRESS_KEY]: merged }),
        });
    } catch (_) { /* local mirror already written */ }
}

// Mark a lesson complete: merge into the local map, then best-effort sync the
// full merged map to the server (read-modify-write, so no clobbering). Any resume
// `steps` already recorded for the lesson are preserved. Ephemeral handoff ids
// (the tour sub-segments of a rich lesson) are NOT persisted as real lessons.
export async function markLessonComplete(user, lessonId) {
    if (!lessonId || isEphemeralLessonId(lessonId)) return readLearningProgress(user);
    const map = readLearningProgress(user);
    const prev = (map[lessonId] && typeof map[lessonId] === 'object') ? map[lessonId] : {};
    const merged = { ...map, [lessonId]: { ...prev, completedAt: new Date().toISOString() } };
    writeLocal(user, merged);
    await syncProgress(merged);
    return merged;
}

// Persist per-step state for resume/scoring (e.g. a passed quiz/exercise). Writes
// the local mirror immediately and best-effort syncs the full map. Does NOT set
// completedAt — the lesson stays "in progress" until markLessonComplete runs.
export async function saveStepState(user, lessonId, stepId, state) {
    if (!lessonId || !stepId || isEphemeralLessonId(lessonId)) return readLearningProgress(user);
    const map = readLearningProgress(user);
    const prev = (map[lessonId] && typeof map[lessonId] === 'object') ? map[lessonId] : {};
    const steps = { ...(prev.steps || {}), [stepId]: state };
    const merged = { ...map, [lessonId]: { ...prev, steps } };
    writeLocal(user, merged);
    await syncProgress(merged);
    return merged;
}

// Pull the authoritative map from the server and mirror it locally so a fresh
// browser shows cross-device completion. Returns the map (falls back to local).
export async function fetchLearningProgress(user) {
    try {
        const res = await authFetch(`${API_BASE}/ai/user-settings`);
        if (res.ok) {
            const data = await res.json();
            const map = data?.[LEARNING_PROGRESS_KEY];
            if (map && typeof map === 'object') {
                writeLocal(user, map);
                return map;
            }
        }
    } catch (_) { /* fall through to local */ }
    return readLearningProgress(user);
}

// Clear all progress (the "Reset progress" affordance). The server merges
// progress writes (a bare {} would be a no-op), so reset is an explicit flag.
// Note: does NOT touch the legacy hasSeenIntroTour flag, so the first-login
// auto-start guard is preserved.
export async function resetLearningProgress(user) {
    writeLocal(user, {});
    try {
        await authFetch(`${API_BASE}/ai/user-settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ learningProgressReset: true }),
        });
    } catch (_) { /* local already cleared */ }
    return {};
}
