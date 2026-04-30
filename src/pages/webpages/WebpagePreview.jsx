import React, { useMemo, useState } from 'react';
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
export default function WebpagePreview({ html, css, js }) {
    const [refreshKey, setRefreshKey] = useState(0);

    const srcDoc = useMemo(
        () => composeWebpageDocument({ html, css, js }),
        [html, css, js]
    );

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
        <div className="flex flex-col h-full" style={{ background: 'var(--bg-primary)' }}>
            <div className="shrink-0 px-3 py-1.5 border-b flex items-center justify-between gap-2"
                 style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                        Live preview
                    </span>
                    <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                        sandboxed (allow-scripts)
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setRefreshKey(k => k + 1)}
                        className="px-2 py-1 rounded-md text-[11px] flex items-center gap-1 hover:opacity-80"
                        style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
                        title="Reload preview"
                    >
                        <RefreshCw className="w-3 h-3" /> Reload
                    </button>
                    <button
                        onClick={openInNewTab}
                        className="px-2 py-1 rounded-md text-[11px] flex items-center gap-1 hover:opacity-80"
                        style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
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
