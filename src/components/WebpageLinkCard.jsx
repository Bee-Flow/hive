import React from 'react';
import { Globe, ArrowRight } from 'lucide-react';

/**
 * Renders a clickable card for /app/webpages/:id links inside chat messages.
 * Replaces the plain anchor that would otherwise be emitted by MarkdownRenderer.
 */
export default function WebpageLinkCard({ href, label }) {
    const handleClick = (e) => {
        e.preventDefault();
        // Push the URL and fire popstate so App.jsx picks it up
        window.history.pushState({ page: 'webpages' }, '', href);
        window.dispatchEvent(new PopStateEvent('popstate', { state: { page: 'webpages' } }));
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
