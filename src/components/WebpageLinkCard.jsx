import React from 'react';
import { Globe, ArrowRight } from 'lucide-react';

/**
 * Renders a clickable card for /app/webpages/:id (and /app/studio/webpages/:id)
 * links inside chat messages. Replaces the plain anchor that would otherwise
 * be emitted by MarkdownRenderer.
 *
 * Click behaviour: dispatch a cancellable `beeflow:open-webpage-side` event
 * so AgentHub can open the webpage in its right-hand panel without losing
 * chat context. If no listener handles it (e.g. card rendered outside the
 * chat shell), fall back to plain in-app navigation.
 */
function extractWebpageId(href) {
    if (typeof href !== 'string') return null;
    const m = href.match(/\/app\/(?:studio\/)?webpages\/([a-zA-Z0-9_-]+)/);
    return m ? m[1] : null;
}

export default function WebpageLinkCard({ href, label }) {
    const handleClick = (e) => {
        e.preventDefault();
        const id = extractWebpageId(href);
        if (id) {
            const evt = new CustomEvent('beeflow:open-webpage-side', {
                detail: { id, href },
                cancelable: true,
            });
            const wasHandled = !window.dispatchEvent(evt);
            // Listener calls preventDefault() to claim the event. If nothing
            // handled it (e.g. user is on a non-chat page), fall back to nav.
            if (wasHandled) return;
        }
        const target = href || (id ? `/app/studio/webpages/${id}` : '/app/studio/webpages');
        window.history.pushState({ page: 'studio' }, '', target);
        window.dispatchEvent(new PopStateEvent('popstate', { state: { page: 'studio' } }));
    };

    return (
        <button
            onClick={handleClick}
            className="inline-flex items-center gap-2 my-1 px-3 py-2 rounded-xl border text-left transition-all hover:shadow-md"
            style={{
                background: 'var(--bg-secondary)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-primary)',
                maxWidth: 320,
            }}
        >
            <div
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: 'var(--brand-gradient, var(--accent-primary))' }}
            >
                <Globe size={14} color="white" />
            </div>
            <span className="flex-1 text-sm font-medium truncate">{label || 'Open webpage'}</span>
            <ArrowRight size={13} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
        </button>
    );
}
