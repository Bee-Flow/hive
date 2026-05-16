import React, { useMemo, useState, useEffect, useRef } from 'react';
import { RefreshCw, ExternalLink } from 'lucide-react';
import composeWebpageDocument from '../../utils/composeWebpageDocument';
import { API_BASE, authFetch } from '../../utils/helpers';

/**
 * Sandboxed live preview of a webpage's three slots.
 *
 * Critical: the iframe uses sandbox="allow-scripts allow-forms" — NO
 * allow-same-origin. This is the same approach Claude Artifacts / v0 / bolt
 * use. It guarantees:
 *  • the previewed page's CSS / JS can never reach into the host app
 *  • the host app's CSS / JS can never reach into the preview
 *  • parent.location, document.cookie, fetch() to the host app all fail
 *
 * `allow-forms` is required because AI-generated pages routinely use
 * `<form>` elements; without it the browser blocks the submit event and
 * any JS preventDefault never runs. Forms still cannot navigate cross-
 * origin against the host (the target origin is `null`), so they're safe
 * — the form action is effectively inert and the JS submit handler runs.
 *
 * Database access from the iframe goes through a separate cross-origin
 * channel: the editor fetches a short-lived bearer token below, bakes it
 * into the iframe document, and the injected `window.beeflowDB` shim sends
 * it on every call to /api/webpages-preview/:id/db/...
 */
export default function WebpagePreview({ webpageId, html, css, js, extraFiles = [], extraContents = {}, onSelectionAttach }) {
    const [refreshKey, setRefreshKey] = useState(0);
    const [dbToken, setDbToken] = useState(null);
    const [dbTokenExpiresAt, setDbTokenExpiresAt] = useState(0);

    // The composed doc embeds a small script that posts user selections back
    // to the parent. Only enable the bridge when the parent supplied a
    // callback — keeps the iframe minimal everywhere else.
    const bridgeOn = typeof onSelectionAttach === 'function';

    // The iframe has an opaque origin, so `/api/...` relative URLs would
    // resolve against `null` and fail. Build an absolute base — VITE_API_URL
    // already gives an absolute URL in dev; in prod (relative API_BASE) we
    // use the editor's own origin since nginx proxies /api through it.
    const dbApiBase = useMemo(() => {
        if (API_BASE) return API_BASE;
        if (typeof window !== 'undefined') return window.location.origin;
        return '';
    }, []);

    // Fetch a fresh preview token whenever the webpage changes or the user
    // reloads the iframe. We deliberately do NOT cache by remaining TTL: the
    // signing secret can rotate (server restart in dev, key rotation in prod)
    // mid-session, and the only way to recover is to mint a new token. Token
    // fetches are cheap (single HMAC), so always doing it on these triggers
    // is the safe default.
    useEffect(() => {
        if (!webpageId) { setDbToken(null); setDbTokenExpiresAt(0); return; }
        const controller = new AbortController();
        let cancelled = false;
        (async () => {
            try {
                const res = await authFetch(`${API_BASE}/api/webpages/${webpageId}/preview-token`, {
                    method: 'POST',
                    signal: controller.signal,
                });
                if (!res.ok) throw new Error(`token fetch ${res.status}`);
                const data = await res.json();
                if (cancelled) return;
                setDbToken(data.token);
                setDbTokenExpiresAt(data.expiresAt || 0);
            } catch (err) {
                if (err?.name === 'AbortError') return;
                console.warn('[WebpagePreview] preview-token fetch failed:', err.message);
                if (!cancelled) { setDbToken(null); setDbTokenExpiresAt(0); }
            }
        })();
        return () => { cancelled = true; controller.abort(); };
    }, [webpageId, refreshKey]);

    // M1: keep the latest webpageId in a ref so the token-refresh postMessage
    // handler always mints a token for the *currently* selected webpage even if
    // the user has swapped pages between request and reply.
    const webpageIdRef = useRef(webpageId);
    useEffect(() => { webpageIdRef.current = webpageId; }, [webpageId]);

    // Merge metadata + content into a single shape composeWebpageDocument expects.
    const extras = useMemo(() => extraFiles.map(f => {
        const c = extraContents[f.path];
        return c
            ? { path: f.path, isText: c.isText, mimeType: c.mimeType, content: c.content, dataUrl: c.dataUrl }
            : { path: f.path, isText: f.isText, mimeType: f.mimeType };
    }), [extraFiles, extraContents]);

    const srcDoc = useMemo(
        () => composeWebpageDocument(
            { html, css, js },
            {
                selectionBridge: bridgeOn,
                extraFiles: extras,
                dbToken,
                dbApiBase,
                dbWebpageId: webpageId,
            }
        ),
        [html, css, js, extras, bridgeOn, dbToken, dbApiBase, webpageId]
    );

    useEffect(() => {
        if (!bridgeOn) return;
        const handler = (event) => {
            const data = event?.data;
            if (!data || data.__beeflowWebpageSelection !== true) return;
            const text = typeof data.text === 'string' ? data.text.trim() : '';
            if (!text) return;
            onSelectionAttach({
                text,
                tagName: data.tagName || null,
                className: data.className || null,
                elementId: data.elementId || null,
            });
        };
        window.addEventListener('message', handler);
        return () => window.removeEventListener('message', handler);
    }, [bridgeOn, onSelectionAttach]);

    // Token refresh bridge — the sandboxed iframe asks for a fresh token
    // whenever it sees a 401 from /api/webpages-preview/*. We mint one from
    // the session-authenticated /preview-token endpoint and postMessage it
    // back. The iframe swaps it into its TOKEN constant and retries the
    // original call without the user noticing. Keeps chat widgets / DB
    // calls working across dev-server restarts and key rotation.
    useEffect(() => {
        const handler = async (event) => {
            const data = event?.data;
            if (!data || data.__beeflowTokenRefresh !== true) return;
            const currentId = webpageIdRef.current;
            if (!currentId) return;
            const reqId = data.requestId;
            const respond = (body) => {
                try {
                    event.source?.postMessage({ __beeflowTokenResponse: true, requestId: reqId, ...body }, event.origin || '*');
                } catch (_) { /* ignore */ }
            };
            try {
                const res = await authFetch(`${API_BASE}/api/webpages/${currentId}/preview-token`, { method: 'POST' });
                if (!res.ok) throw new Error(`token fetch ${res.status}`);
                const body = await res.json();
                // Only update state if the page hasn't been swapped during the fetch.
                if (webpageIdRef.current === currentId) {
                    setDbToken(body.token);
                    setDbTokenExpiresAt(body.expiresAt || 0);
                }
                respond({ token: body.token, expiresAt: body.expiresAt || 0 });
            } catch (err) {
                respond({ error: err.message || 'token refresh failed' });
            }
        };
        window.addEventListener('message', handler);
        return () => window.removeEventListener('message', handler);
    }, []);

    const openInNewTab = () => {
        // A blob: URL with a unique opaque origin — gives the user a full-window
        // view without ever sharing an origin with the host app.
        const blob = new Blob([srcDoc], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank', 'noopener,noreferrer');
        // Revoke after a long beat so even high-latency networks finish loading
        // the document before the URL is invalidated. Browsers will GC the blob
        // when the page is gone; this is best-effort cleanup.
        setTimeout(() => URL.revokeObjectURL(url), 120_000);
    };

    return (
        <div className="flex flex-col h-full" style={{ background: 'var(--vsc-sidebar-bg)' }}>
            <div className="shrink-0 px-3 py-1.5 border-b flex items-center justify-between gap-2"
                 style={{ borderColor: 'var(--vsc-border)' }}>
                <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--vsc-fg-muted)', letterSpacing: '0.06em' }}>
                        Preview
                    </span>
                    <span className="text-[10px]" style={{ color: 'var(--vsc-fg-muted)', opacity: 0.7 }}>
                        sandboxed
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setRefreshKey(k => k + 1)}
                        className="px-2 py-0.5 rounded text-[11px] flex items-center gap-1 transition-colors"
                        style={{ color: 'var(--vsc-fg)' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--vsc-hover-bg)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        title="Reload preview"
                    >
                        <RefreshCw className="w-3 h-3" /> Reload
                    </button>
                    <button
                        onClick={openInNewTab}
                        className="px-2 py-0.5 rounded text-[11px] flex items-center gap-1 transition-colors"
                        style={{ color: 'var(--vsc-fg)' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--vsc-hover-bg)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        title="Open preview in new tab"
                    >
                        <ExternalLink className="w-3 h-3" /> Open
                    </button>
                </div>
            </div>
            <div className="flex-1 min-h-0">
                <iframe
                    key={refreshKey}
                    title="Webpage preview"
                    srcDoc={srcDoc}
                    sandbox="allow-scripts allow-forms"
                    referrerPolicy="no-referrer"
                    style={{ width: '100%', height: '100%', border: 0, background: '#fff' }}
                />
            </div>
        </div>
    );
}
