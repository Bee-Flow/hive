/**
 * Renders the real published page inside the heatmap stage.
 *
 * Umami's heatmap report literally tells us to do this: it answers
 * `snapshot: { kind: 'iframe', url, pageW, pageH }`. It stores click
 * coordinates, not pixels, so the only way to show WHAT was clicked is to put
 * the page back underneath them.
 *
 * Why the preview route rather than the public URL:
 *   - `/__cms_preview__?preview=1` renders ProductWebsite with no content fetch
 *     and, crucially, `?preview` makes AnalyticsTracker, SessionRecorder and
 *     the auto-event listeners all early-return. Framing the live URL instead
 *     would emit a phantom pageview every time an admin opened this tab, and
 *     the heatmap would slowly poison the numbers it is reporting on.
 *   - It is same-origin (one SPA, routed on pathname), so we can read
 *     `contentDocument` directly — that is what makes block attribution
 *     possible at all — and nginx allows it (`frame-ancestors 'self'`).
 *
 * Content comes from the PUBLIC `/api/cms/site` endpoint, so what we draw on is
 * what visitors actually saw, not the current draft.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { API_BASE } from '../../../../../utils/helpers';

export const PREVIEW_SRC = '/__cms_preview__?preview=1';

// The frame has to render, lay out, load fonts and settle before its height and
// block rectangles mean anything. These are deliberately generous: measuring
// too early yields a short page and every click lands in the wrong block.
const SETTLE_MS = 400;
const READY_TIMEOUT_MS = 8000;

/** `/faq` → `faq`; the homepage has no slug on the public API. */
export function pathToSlug(path) {
    const p = String(path || '/').split('?')[0].split('#')[0];
    const seg = p.replace(/^\/+|\/+$/g, '');
    return seg;
}

/**
 * @returns {{
 *   frameRef, status: 'idle'|'loading'|'ready'|'error', error: string|null,
 *   pageHeight: number|null, blocks: Array<{id,type,top,height}>,
 *   src: string, remeasure: () => void,
 * }}
 */
export function usePreviewBackdrop({ urlPath, locale = 'en', width, enabled = true }) {
    const frameRef = useRef(null);
    const [status, setStatus] = useState('idle');
    const [error, setError] = useState(null);
    const [pageHeight, setPageHeight] = useState(null);
    const [blocks, setBlocks] = useState([]);
    const [measureToken, setMeasureToken] = useState(0);
    const [attempt, setAttempt] = useState(0);

    const remeasure = useCallback(() => setMeasureToken(t => t + 1), []);
    const reload = useCallback(() => setAttempt(a => a + 1), []);

    // Content fetch + handshake + push. Split from measurement so a width
    // change re-measures without re-fetching and re-mounting the frame.
    useEffect(() => {
        if (!enabled || !urlPath) { setStatus('idle'); return undefined; }
        let cancelled = false;
        let readyTimer = null;
        setStatus('loading');
        setError(null);
        setBlocks([]);
        setPageHeight(null);

        const slug = pathToSlug(urlPath);
        const qs = `locale=${encodeURIComponent(locale)}${slug ? `&slug=${encodeURIComponent(slug)}` : ''}`;

        let content = null;
        let design = null;
        let pushes = 0;

        const push = () => {
            if (cancelled || !content) return false;
            const win = frameRef.current?.contentWindow;
            if (!win) return false;
            win.postMessage({ type: 'cms-preview', content, design }, window.location.origin);
            pushes += 1;
            return true;
        };

        /**
         * Same-origin, so "did it render?" is a DOM question rather than a
         * protocol one. Requiring at least one push of THIS page's content
         * matters on a page switch: the frame still shows the previous page, so
         * blocks are present before our content has been sent and we would
         * otherwise measure the wrong page.
         */
        const rendered = () => {
            if (!pushes) return false;
            try {
                return !!frameRef.current?.contentDocument?.querySelector('[data-cms-block-id]');
            } catch { return false; }
        };

        fetch(`${API_BASE}/api/cms/site?${qs}`, { credentials: 'include' })
            .then(r => (r.ok ? r.json() : Promise.reject(new Error(`Page fetch failed (${r.status})`))))
            .then(data => {
                if (cancelled) return;
                if (data?.found === false) throw new Error('That page is no longer published.');
                content = data?.content || {};
                design = data?.design || data?.content?.design || null;
                push();
            })
            .catch(err => { if (!cancelled) { setStatus('error'); setError(err.message); } });

        // One mechanism, not two. The frame's `cms-preview-ready` handshake is
        // posted ONCE, when it first mounts — on a page switch the frame is
        // already loaded and will never send it again, so listening for it
        // alone would hang forever. Pushing repeatedly until the DOM shows the
        // content is both simpler and correct in both cases; re-pushing a live
        // frame is exactly what the CMS builder does on every keystroke.
        const poll = setInterval(() => {
            if (cancelled) return;
            if (rendered()) {
                clearInterval(poll);
                readyTimer = setTimeout(() => {
                    if (cancelled) return;
                    // Layout is not final the moment React commits — fonts and
                    // images still move things. Measure after a settle.
                    setStatus('ready');
                    setMeasureToken(t => t + 1);
                }, SETTLE_MS);
                return;
            }
            push();
        }, 250);

        // If the frame never renders anything, say so instead of spinning.
        const giveUp = setTimeout(() => {
            if (cancelled || rendered()) return;
            clearInterval(poll);
            setStatus('error');
            setError('The page preview did not load.');
        }, READY_TIMEOUT_MS);

        return () => {
            cancelled = true;
            clearInterval(poll);
            clearTimeout(readyTimer);
            clearTimeout(giveUp);
        };
    }, [urlPath, locale, enabled, attempt]);

    // Measurement. Same-origin, so this is a direct DOM read — no bridge.
    useEffect(() => {
        if (status !== 'ready') return undefined;
        const doc = frameRef.current?.contentDocument;
        if (!doc?.body) return undefined;

        const measure = () => {
            const h = Math.max(
                doc.body.scrollHeight, doc.documentElement?.scrollHeight || 0,
            );
            setPageHeight(h || null);
            const found = [];
            for (const el of doc.querySelectorAll('[data-cms-block-id]')) {
                const r = el.getBoundingClientRect();
                found.push({
                    id: el.getAttribute('data-cms-block-id'),
                    type: el.getAttribute('data-cms-block-type') || 'block',
                    // getBoundingClientRect is viewport-relative; the frame is
                    // rendered full-height and unscrolled, so its viewport IS
                    // the document. scrollY is added defensively.
                    top: r.top + (frameRef.current?.contentWindow?.scrollY || 0),
                    height: r.height,
                });
            }
            setBlocks(found);
        };
        measure();

        // Late images/fonts change the geometry after our settle window.
        let ro = null;
        if (typeof doc.defaultView?.ResizeObserver === 'function') {
            ro = new doc.defaultView.ResizeObserver(measure);
            ro.observe(doc.body);
        }
        return () => ro?.disconnect();
    }, [status, width, measureToken]);

    return { frameRef, status, error, pageHeight, blocks, src: PREVIEW_SRC, remeasure, reload };
}
