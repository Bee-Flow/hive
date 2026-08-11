/**
 * Small info icon with a click-to-reveal help popover.
 *
 * Replaces the scattered `<span className="text-xs text-muted">…</span>`
 * pattern across GuardrailsPanel so every knob can have concise inline help
 * without cluttering the default view. Reached from every node-config field via
 * Builder/flow/FieldHint, so this component is the single place a field help
 * popover can be fixed — which is what BFSF-362 asked for.
 *
 * BFSF-362 — the panel used to be an `absolute … z-50` span sitting inside the
 * node config panel. Four separate faults produced the one report:
 *
 *   1. Clipping. SettingsForm is `overflow-y-auto` inside NodeDetailView's
 *      `rounded-xl overflow-hidden`, so a hint opened near the bottom of the
 *      panel was simply cut off. The overlay also carries `backdrop-blur-sm`,
 *      which makes it a containing block for `fixed` descendants — so not even
 *      `position: fixed` escapes it. Only a portal out of the subtree can.
 *   2. Dismiss-on-scroll. The old outside-click handler closed on ANY mousedown
 *      outside the wrapper, and the config panel's scrollbar is outside the
 *      wrapper — so grabbing the scrollbar to read the rest of the hint closed
 *      the hint. That is the exact "scrolling deselects it" in the report.
 *   3. No flip. `placement` was a fixed prop ('top'/'bottom'); a hint near the
 *      bottom edge still opened downwards into the void.
 *   4. Opacity. The panel painted `var(--bg-card)`, which is a deliberately
 *      translucent `rgba(255,255,255,0.55)` in the glass themes — and
 *      `--bg-primary` is outright `transparent` there — so the form behind it
 *      bled through. Hence `data-field-hint` plus the solid tier-3 surface
 *      rules in index.css, the same treatment TokenisedBadge got for BFSF-303.
 *
 * All four are answered by the shared AnchoredMenu primitive (BFSF-328): a
 * portal to <body> at `position: fixed`, z-index 10050, measure-and-flip
 * against the viewport, a mousedown handler that ignores scrollbar presses, and
 * a scroll handler that REPOSITIONS instead of closing. The panel is height-
 * capped to the room available and scrolls internally, so a long hint is always
 * readable without moving the panel underneath it.
 *
 * `placement` is deliberately gone: the panel now flips automatically, which is
 * strictly better than any fixed side, and no call site ever passed it.
 */

import { HelpCircle } from 'lucide-react';
import React, { useCallback, useRef, useState } from 'react';
import AnchoredMenu from '../../shared/AnchoredMenu';

// Wide enough for a sentence or two without becoming a wall of text. Matches
// the `w-64` the popover carried before it moved into the portal.
const HINT_WIDTH = 256;

export default function Info({ children, title, className = '' }) {
    const [open, setOpen] = useState(false);
    const anchorRef = useRef(null);
    const close = useCallback(() => setOpen(false), []);

    return (
        <span className={`inline-flex align-middle ${className}`}>
            <button
                ref={anchorRef}
                type="button"
                onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
                className="p-0.5 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                aria-label={title || 'More info'}
                aria-expanded={open}
                title={title}
            >
                <HelpCircle className="w-3.5 h-3.5" />
            </button>
            <AnchoredMenu
                open={open}
                onClose={close}
                anchorRef={anchorRef}
                align="left"
                width={HINT_WIDTH}
                minWidth={HINT_WIDTH}
                role="tooltip"
                data-field-hint=""
                className="p-3 text-xs leading-relaxed"
                style={{ color: 'var(--text-primary)' }}
            >
                {title && <div className="font-semibold mb-1">{title}</div>}
                <div style={{ color: 'var(--text-secondary)' }}>{children}</div>
            </AnchoredMenu>
        </span>
    );
}
