import React, { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Renders an untrusted email HTML body the way Gmail/Outlook would — inside a
 * sandboxed iframe so the email's own CSS is isolated from the app and any
 * embedded <script> can never run.
 *
 * Security: sandbox WITHOUT `allow-scripts`. `allow-same-origin` only lets the
 * PARENT measure the rendered height (the srcDoc iframe stays same-origin); it
 * does NOT enable scripting inside the email. Never add `allow-scripts` here —
 * `allow-scripts` + `allow-same-origin` together would let the email strip its
 * own sandbox. Remote images load (matches the real email); links open in a new
 * tab via the injected <base target="_blank">.
 */

const WRAPPER_STYLE = `
  <style>
    :root { color-scheme: light; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      font-size: 14px;
      line-height: 1.5;
      color: #1a1a1a;
      background: #ffffff;
      word-break: break-word;
      overflow-wrap: anywhere;
      padding: 12px;
    }
    img { max-width: 100%; height: auto; }
    table { max-width: 100%; }
    a { color: #2563eb; }
  </style>
`;

// Make links open in a new tab (never navigate the app frame) and cap oversized
// images so a wide email can't force a horizontal scrollbar.
const HEAD_INJECT = '<base target="_blank"><style>img{max-width:100%;height:auto}</style>';

/**
 * Build the iframe document. Many senders (receipts, calendar invites,
 * newsletters) already ship a COMPLETE HTML document — `<!doctype><html>
 * <head><style>…</style></head><body style="…">…`. Those must be rendered
 * as-is: wrapping them inside another document double-nests <html>/<body>,
 * which merges the email's body styles onto our wrapper and corrupts the
 * layout (stray padding, runaway height). For a full document we only inject
 * <base> + the image cap into its existing <head>; bare fragments get wrapped
 * in our minimal readable shell.
 */
function buildSrcDoc(html) {
    const raw = html || '';
    if (/<html[\s>]/i.test(raw)) {
        if (/<head[\s>]/i.test(raw)) {
            return raw.replace(/<head([^>]*)>/i, `<head$1>${HEAD_INJECT}`);
        }
        return raw.replace(/<html([^>]*)>/i, `<html$1><head>${HEAD_INJECT}</head>`);
    }
    return `<!DOCTYPE html><html><head><meta charset="utf-8">${HEAD_INJECT}${WRAPPER_STYLE}</head><body>${raw}</body></html>`;
}

export default function EmailHtmlBody({ html }) {
    const iframeRef = useRef(null);
    const observerRef = useRef(null);
    const [height, setHeight] = useState(120);

    const measure = useCallback(() => {
        const iframe = iframeRef.current;
        if (!iframe) return;
        try {
            const doc = iframe.contentDocument;
            if (!doc) return;
            const h = Math.max(
                doc.documentElement?.scrollHeight || 0,
                doc.body?.scrollHeight || 0,
            );
            if (h) setHeight(h + 4);
        } catch {
            /* cross-origin guard — shouldn't trip with allow-same-origin */
        }
    }, []);

    const handleLoad = useCallback(() => {
        measure();
        // Remote images change layout height after the initial load event, so
        // keep re-measuring while the email's body resizes.
        try {
            const doc = iframeRef.current?.contentDocument;
            if (doc?.body && typeof ResizeObserver !== 'undefined') {
                observerRef.current?.disconnect();
                const ro = new ResizeObserver(() => measure());
                ro.observe(doc.body);
                observerRef.current = ro;
            }
        } catch {
            /* ignore */
        }
    }, [measure]);

    useEffect(() => () => observerRef.current?.disconnect(), []);

    return (
        <iframe
            ref={iframeRef}
            title="Email message"
            srcDoc={buildSrcDoc(html)}
            sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
            onLoad={handleLoad}
            className="w-full block"
            style={{ height, border: 'none', background: '#fff' }}
        />
    );
}
