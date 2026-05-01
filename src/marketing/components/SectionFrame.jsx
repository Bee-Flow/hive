import React from 'react';

/**
 * Wraps a marketing section. In preview mode, hovering the section reveals
 * a small toolbar (Edit settings · Hide) that posts intents to the parent
 * panel. In normal (public) mode it's a transparent passthrough.
 */
function isPreviewMode() {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).has('preview');
}

export default function SectionFrame({ id, name, enabled = true, children }) {
    if (!isPreviewMode()) {
        return <>{children}</>;
    }

    const post = (action) => {
        window.parent?.postMessage({ type: 'cms-section-action', section: id, action }, '*');
    };

    return (
        <div
            className={`cms-section-frame ${enabled ? '' : 'cms-section-hidden'}`}
            data-cms-section={id}
            onMouseEnter={() => post('hover')}
        >
            <div className="cms-section-toolbar" role="toolbar" aria-label={`${name} section controls`}>
                <span className="cms-section-name">{name}</span>
                <button type="button" onClick={() => post('focus')} title="Edit settings">
                    ⚙ Settings
                </button>
                <button type="button" onClick={() => post('toggle')} title={enabled ? 'Hide section' : 'Show section'}>
                    {enabled ? '👁 Hide' : '👁 Show'}
                </button>
            </div>
            {children}
        </div>
    );
}
