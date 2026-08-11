import React from 'react';

/**
 * On-canvas block chrome for the CMS preview iframe (WS3-P1).
 *
 * Rendered by the block map in ../ProductWebsite.jsx INSIDE each
 * `[data-cms-block-id]` wrapper — and ONLY in preview mode (?preview=1),
 * same guard as the wrapper's click-to-select handler. Styling lives in
 * ../preview-chrome.css, fully scoped under `.marketing-root.cms-preview`,
 * so none of this exists on the published site.
 *
 * Everything keys on the wrapper's block *id*: the old SectionFrame hover
 * toolbar died because it keyed on block *type* (see its docblock) while
 * the panel keys everything off id.
 *
 * The parent (ProductWebsitePanel) is the single source of truth for
 * selection + the AI stream lock; it mirrors them here via the
 * `cms-active { blockId, locked, labels }` message. This component only
 * posts intents back:
 *   cms-block-action { blockId, action: 'move-up'|'move-down'|'duplicate'
 *                                       |'delete'|'settings' }
 *   cms-insert-at    { index }
 * The panel gates both on its stream lock before mutating anything.
 *
 * Icons are deliberately small inline SVGs — this file ships in the public
 * marketing bundle, so it must NOT import lucide-react (or the admin-side
 * AppIcon wrapper around it).
 */

// Explicit target origin — the admin panel is same-origin with the preview
// iframe; mirrors the guard on the panel's message listener.
function postToPanel(msg) {
    window.parent?.postMessage(msg, window.location.origin);
}

function Svg({ children }) {
    return (
        <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            {children}
        </svg>
    );
}

const ICONS = {
    'move-up':   <Svg><path d="M8 13V3" /><path d="M4 7l4-4 4 4" /></Svg>,
    'move-down': <Svg><path d="M8 3v10" /><path d="M4 9l4 4 4-4" /></Svg>,
    duplicate:   <Svg><rect x="6" y="6" width="7" height="7" rx="1.5" /><path d="M10.5 3.5H4.75A1.25 1.25 0 0 0 3.5 4.75v5.75" /></Svg>,
    delete:      <Svg><path d="M3 4.5h10" /><path d="M6.5 4.5V3h3v1.5" /><path d="M4.5 4.5l.5 8.25a1 1 0 0 0 1 .75h4a1 1 0 0 0 1-.75l.5-8.25" /></Svg>,
    settings:    <Svg><path d="M3 5.5h10" /><path d="M3 10.5h10" /><circle cx="6" cy="5.5" r="1.6" /><circle cx="10" cy="10.5" r="1.6" /></Svg>,
};

/**
 * Name tag (top-left) + floating action toolbar (top-right) for one block.
 * Visibility is pure CSS (wrapper :hover / .cms-block-active) — this
 * component renders unconditionally and stays cheap.
 */
export function PreviewBlockChrome({ blockId, label, locked, isFirst, isLast }) {
    const button = (action, title, disabled = false) => (
        <button
            type="button"
            className={action === 'delete' ? 'cms-chrome-btn cms-chrome-btn--danger' : 'cms-chrome-btn'}
            title={locked ? 'AI is editing' : title}
            aria-label={title}
            disabled={locked || disabled}
            onClick={(e) => {
                // Keep the wrapper's click-to-select (cms-select) out of it —
                // the panel updates the selection itself where the action
                // implies it (duplicate/settings).
                e.stopPropagation();
                e.preventDefault();
                if (locked || disabled) return;
                postToPanel({ type: 'cms-block-action', blockId, action });
            }}
        >
            {ICONS[action]}
        </button>
    );
    return (
        <>
            <span className="cms-chrome-tag">{label}</span>
            <div
                className={`cms-chrome-toolbar${locked ? ' cms-chrome-toolbar--locked' : ''}`}
                role="toolbar"
                aria-label={`${label} section actions`}
                onClick={(e) => e.stopPropagation()}
            >
                {button('move-up', 'Move section up', isFirst)}
                {button('move-down', 'Move section down', isLast)}
                {button('duplicate', 'Duplicate section')}
                {button('delete', 'Delete section')}
                {button('settings', 'Section settings')}
            </div>
        </>
    );
}

/**
 * Insert-between "+" zone. Rendered by the block map between wrappers and
 * before-first/after-last (preview only). `index` is the splice position in
 * the FULL page blocks array — the panel opens its Add-block dialog with it.
 */
export function InsertZone({ index, locked }) {
    return (
        <div className="cms-insert-zone" role="presentation">
            <button
                type="button"
                className="cms-insert-zone-btn"
                title={locked ? 'AI is editing' : 'Insert section here'}
                aria-label="Insert section here"
                disabled={locked}
                onClick={(e) => {
                    e.stopPropagation();
                    if (locked) return;
                    postToPanel({ type: 'cms-insert-at', index });
                }}
            >
                <Svg><path d="M8 3.5v9" /><path d="M3.5 8h9" /></Svg>
            </button>
        </div>
    );
}
