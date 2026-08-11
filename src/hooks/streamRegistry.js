/**
 * In-flight chat streams, kept alive across navigation.
 *
 * ── The problem ─────────────────────────────────────────────────────────────
 *
 * useChatEngine aborts its AbortController on unmount, and every navigation in
 * AgentHub unmounts the chat. Because the server's SSE route tears down its
 * generation on `res.on('close')`, aborting the client fetch does not merely
 * stop listening — IT KILLS THE ANSWER. Switching to another thread while the
 * model was writing lost the reply outright, and nothing was persisted, so
 * coming back showed the question with no answer.
 *
 * That is tolerable for one person with one chat. It is not tolerable once a
 * project has several threads people move between, and it is actively wrong in
 * a SHARED thread, where the other members watching the stream would see it
 * die because someone else clicked away.
 *
 * ── What this does ──────────────────────────────────────────────────────────
 *
 * A stream registered here is DETACHED rather than aborted when its component
 * unmounts: the fetch keeps draining in the background, so the server finishes
 * and persists the message, and the returning user sees a complete answer via
 * the normal conversation reload. The UI stops updating (there is nothing
 * mounted to update) but the work completes.
 *
 * What is deliberately NOT attempted here: replaying tokens into a remounted
 * component. That would mean buffering partial content outside React and
 * reconciling it against whatever the reload fetched — two sources of truth for
 * the same message. Letting the server be the single source and re-reading it is
 * both simpler and correct.
 *
 * ── What still aborts ───────────────────────────────────────────────────────
 *
 *   - Ephemeral streams (no conversation id). Nothing persists them, so a
 *     detached one produces output nobody will ever see.
 *   - An explicit user stop.
 *   - A hard page unload.
 *   - Anything still running after DETACHED_TIMEOUT_MS — a detached stream must
 *     not be able to leak a socket forever.
 */

const DETACHED_TIMEOUT_MS = 5 * 60_000;

/** key -> { controller, detachedAt, timer } */
const streams = new Map();

/**
 * Track a stream so it can outlive its component.
 * @param {string} key    stable per conversation — usually the conversation id
 * @param {AbortController} controller
 */
export function registerStream(key, controller) {
    if (!key || !controller) return;
    // A new stream on the same conversation supersedes the old one; two live
    // generations writing to one thread is never what the user asked for.
    const existing = streams.get(key);
    if (existing && existing.controller !== controller) {
        try { existing.controller.abort(); } catch { /* already gone */ }
        if (existing.timer) clearTimeout(existing.timer);
    }
    streams.set(key, { controller, detachedAt: null, timer: null });
}

/** The stream finished, failed, or was stopped. Forget it. */
export function releaseStream(key) {
    const entry = streams.get(key);
    if (!entry) return;
    if (entry.timer) clearTimeout(entry.timer);
    streams.delete(key);
}

/**
 * The component owning this stream is unmounting.
 *
 * Returns true when the stream was kept alive, false when the caller should
 * abort it as before. Callers pass `canDetach: false` for anything that is not
 * being persisted server-side.
 */
export function detachStream(key, { canDetach = true } = {}) {
    const entry = streams.get(key);
    if (!entry) return false;

    if (!canDetach) {
        try { entry.controller.abort(); } catch { /* already gone */ }
        releaseStream(key);
        return false;
    }

    entry.detachedAt = Date.now();
    // Backstop. If the server never closes the stream, a detached fetch would
    // otherwise hold a socket for the life of the tab.
    entry.timer = setTimeout(() => {
        try { entry.controller.abort(); } catch { /* already gone */ }
        streams.delete(key);
    }, DETACHED_TIMEOUT_MS);
    return true;
}

/** A component is (re)mounting for this conversation — it owns the stream again. */
export function reattachStream(key) {
    const entry = streams.get(key);
    if (!entry) return null;
    if (entry.timer) { clearTimeout(entry.timer); entry.timer = null; }
    entry.detachedAt = null;
    return entry.controller;
}

/** Is a generation still running for this conversation? Drives the tab spinner. */
export function isStreaming(key) {
    return streams.has(key);
}

/** Conversation ids with a live stream, for the session tab strip. */
export function activeStreamKeys() {
    return [...streams.keys()];
}

/** Stop everything — page unload, or sign-out. */
export function abortAllStreams() {
    for (const [key, entry] of streams) {
        try { entry.controller.abort(); } catch { /* already gone */ }
        if (entry.timer) clearTimeout(entry.timer);
        streams.delete(key);
    }
}

// A detached stream must not survive the document. Without this, a navigation
// away from the SPA leaves the fetch to be torn down by the browser at an
// unspecified time.
if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', abortAllStreams);
}

export default {
    registerStream,
    releaseStream,
    detachStream,
    reattachStream,
    isStreaming,
    activeStreamKeys,
    abortAllStreams,
};
