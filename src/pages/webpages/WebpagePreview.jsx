import React, { useMemo, useState, useEffect } from 'react';
import { RefreshCw, ExternalLink } from 'lucide-react';
import composeWebpageDocument from '../../utils/composeWebpageDocument';

/**
 * Sandboxed live preview of a webpage's three slots.
 *
 * Critical: the iframe uses sandbox="allow-scripts" only — NO allow-same-origin.
 * This is the same approach Claude Artifacts / v0 / bolt use. It guarantees
 *  • the previewed page's CSS / JS can never reach into the host app
 *  • the host app's CSS / JS can never reach into the preview
 *  • parent.location, document.cookie, fetch() to the host app all fail
 */
export default function WebpagePreview({ html, css, js, onSelectionAttach }) {
    const [refreshKey, setRefreshKey] = useState(0);

    // The composed doc embeds a small script that posts user selections back
    // to the parent. Only enable the bridge when the parent supplied a
    // callback — keeps the iframe minimal everywhere else.
    const bridgeOn = typeof onSelectionAttach === 'function';

    const srcDoc = useMemo(
        () => composeWebpageDocument({ html, css, js }, { selectionBridge: bridgeOn }),
        [html, css, js, bridgeOn]
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

    const openInNewTab = () => {
        // A blob: URL with a unique opaque origin — gives the user a full-window
        // view without ever sharing an origin with the host app.
        const blob = new Blob([srcDoc], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank', 'noopener,noreferrer');
        // Revoke after a beat so the new tab has time to load.
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
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
                    sandbox="allow-scripts"
                    referrerPolicy="no-referrer"
                    style={{ width: '100%', height: '100%', border: 0, background: '#fff' }}
                />
            </div>
        </div>
    );
}
