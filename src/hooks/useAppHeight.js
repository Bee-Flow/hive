import { useEffect } from 'react';

/**
 * Tracks the *visible* viewport and the on-screen keyboard, writing two CSS
 * custom properties on <html> so layout can react in pure CSS:
 *
 *   --app-height      the real visible height in px (visualViewport.height,
 *                     falling back to window.innerHeight). Use instead of
 *                     100vh/100dvh for the app shell so it matches what the
 *                     user actually sees (browser chrome, address bar, etc).
 *   --keyboard-inset  how much the on-screen keyboard currently covers at the
 *                     bottom: max(0, innerHeight - visualViewport.height -
 *                     visualViewport.offsetTop). 0 when no keyboard is open.
 *
 * dvh does NOT shrink for the on-screen keyboard — only the visualViewport API
 * reflects it. Because the app shell is sized to --app-height (==
 * visualViewport.height), it already shrinks to the visible region above the
 * keyboard, so the bottom-anchored chat composer stays visible without extra
 * padding. --keyboard-inset is exposed as an auxiliary signal (e.g. for popover
 * positioning) and must NOT also be added to the shell's bottom padding, or it
 * would double-count on browsers (iOS Safari) whose layout viewport stays
 * full-height while typing.
 *
 * Pure side-effect (returns nothing). SSR-safe. Writes are coalesced into a
 * single requestAnimationFrame and skipped when the rounded value is unchanged,
 * so visualViewport's high-frequency events don't thrash layout. Mount once,
 * near the App root, before any chat surface renders.
 */
export function useAppHeight() {
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const root = document.documentElement;
        const vv = window.visualViewport || null;

        let rafId = null;
        let lastH = -1;
        let lastKb = -1;

        const apply = () => {
            rafId = null;
            const height = Math.round(vv ? vv.height : window.innerHeight);
            // How much of the layout viewport the keyboard covers at the bottom.
            const inset = vv
                ? Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop))
                : 0;
            if (height > 0 && height !== lastH) {
                lastH = height;
                root.style.setProperty('--app-height', `${height}px`);
            }
            if (inset !== lastKb) {
                lastKb = inset;
                root.style.setProperty('--keyboard-inset', `${inset}px`);
            }
        };

        const schedule = () => {
            if (rafId == null) rafId = window.requestAnimationFrame(apply);
        };

        // Set once synchronously so the vars are correct on first paint.
        apply();

        if (vv) {
            // 'scroll' matters on iOS: the page shifts under the keyboard and
            // fires scroll (not resize) as the visual viewport moves.
            vv.addEventListener('resize', schedule);
            vv.addEventListener('scroll', schedule);
        }
        // Fallback for browsers without visualViewport, plus orientation.
        window.addEventListener('resize', schedule);
        window.addEventListener('orientationchange', schedule);

        return () => {
            if (rafId != null) window.cancelAnimationFrame(rafId);
            if (vv) {
                vv.removeEventListener('resize', schedule);
                vv.removeEventListener('scroll', schedule);
            }
            window.removeEventListener('resize', schedule);
            window.removeEventListener('orientationchange', schedule);
        };
    }, []);
}

export default useAppHeight;
