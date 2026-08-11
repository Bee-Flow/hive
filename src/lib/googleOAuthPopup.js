// Shared Google OAuth connect-popup flow, extracted from the Settings →
// Integrations Google Workspace tile so every surface that needs a Google
// (re-)consent — the integrations tile, Meeting Notes upcoming banner, the
// Google Meet import panel, settings — opens the identical popup and waits for
// the same callback message.
//
// Contract with the server callback page: it posts
//   { type: 'google-callback', success: boolean }
// to window.opener and closes itself.

const POPUP_NAME = 'google-oauth';
const POPUP_WIDTH = 600;
const POPUP_HEIGHT = 700;
const CLOSE_POLL_MS = 500;
// The callback page posts its message and then closes itself — after we see
// the popup close, give an in-flight message a moment to arrive before
// declaring the flow abandoned.
const CLOSE_GRACE_MS = 1000;

/**
 * Open the Google OAuth consent popup and wait for it to finish.
 *
 * Resolves with `{ success, closed? }` once the popup posts its
 * 'google-callback' message — or with `{ success: false, closed: true }` when
 * the user closes the popup without completing — calling `onDone` with the
 * same result first. Rejects before the popup opens when the auth-url request
 * fails (`err.code = 'auth_url_failed'`, message = the server-provided error
 * when there is one) or the browser blocks the popup
 * (`err.code = 'popup_blocked'`). The message listener and close-poll are
 * always cleaned up on completion.
 *
 * @param {object} opts
 * @param {Function} opts.authFetch - authenticated fetch from utils/helpers
 * @param {string} opts.apiBase - API base URL (utils/helpers API_BASE)
 * @param {Function} [opts.onDone] - called with the result object
 * @param {Function} [opts.onOpened] - called right after the popup opens
 * @returns {Promise<{success: boolean, closed?: boolean}>}
 */
export async function openGoogleOAuthPopup({ authFetch, apiBase, onDone, onOpened } = {}) {
    let ok = false;
    let data = {};
    try {
        const res = await authFetch(`${apiBase}/api/integrations/google/auth-url`);
        data = await res.json().catch(() => ({}));
        ok = res.ok;
    } catch { /* rejected below as auth_url_failed */ }
    if (!ok || !data.url) {
        // Empty message when the server gave none — callers fall back to their
        // own translated generic error (`e.message || t(...)`).
        const err = new Error(data.error || '');
        err.code = 'auth_url_failed';
        throw err;
    }

    const [w, h] = [POPUP_WIDTH, POPUP_HEIGHT];
    const popup = window.open(
        data.url,
        POPUP_NAME,
        `width=${w},height=${h},left=${(screen.width - w) / 2},top=${(screen.height - h) / 2}`,
    );
    if (!popup) {
        const err = new Error('The Google sign-in popup was blocked — allow popups for this site and try again.');
        err.code = 'popup_blocked';
        throw err;
    }
    onOpened?.();

    return new Promise((resolve) => {
        let settled = false;
        let closePoll = null;
        const finish = (result) => {
            if (settled) return;
            settled = true;
            window.removeEventListener('message', handler);
            if (closePoll) clearInterval(closePoll);
            onDone?.(result);
            resolve(result);
        };
        // Only trust the callback page. Without an origin check any window
        // (an embedded frame, another tab that got a handle) could post a
        // forged { type:'google-callback', success:true } and make the UI
        // report a connection that never happened. The API origin is where
        // the callback page is served; in dev that differs from the SPA's.
        const apiOrigin = (() => {
            try { return new URL(apiBase || '', window.location.origin).origin; } catch { return window.location.origin; }
        })();
        const handler = (e) => {
            if (e.origin !== apiOrigin && e.origin !== window.location.origin) return;
            if (e.data?.type === 'google-callback') finish({ success: !!e.data.success });
        };
        window.addEventListener('message', handler);
        closePoll = setInterval(() => {
            if (popup.closed) {
                clearInterval(closePoll);
                setTimeout(() => finish({ success: false, closed: true }), CLOSE_GRACE_MS);
            }
        }, CLOSE_POLL_MS);
    });
}

export default openGoogleOAuthPopup;
