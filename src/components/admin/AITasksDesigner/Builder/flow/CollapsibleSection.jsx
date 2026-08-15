import { ChevronRight } from 'lucide-react';
import React, { useState } from 'react';
import scopedStorage from '../../../../../utils/scopedStorage';
import {
    bandClass, disclosureClass, railClass, sectionHeaderClass, FOCUS_RING,
} from './settings/formStyles';

/**
 * Dense, inspector-scoped disclosure used to hide advanced/optional fields
 * behind a "Show N more options" toggle. Keeps the default config view
 * compact (the screenshot's wall of fields was the original complaint).
 *
 * Modes:
 *   - Uncontrolled (default): manages its own open state. Pass `persistKey`
 *     to remember the state per-user via scopedStorage.
 *   - Controlled: pass `open` + `onToggle`.
 *
 * `count` (optional) renders the n8n-style "Show N more options" /
 * "Fewer options" label and an optional `badge` (e.g. number of
 * auto-mapped fields) so collapsed content never silently hides state.
 *
 * TWO VARIANTS, one behaviour. This component used to render a named section
 * ("Basics") and the "Show N more options" control with identical markup and
 * identical classes, so a control looked exactly like a heading — a large part
 * of why the panel read as one flat list. `variant` splits the two looks:
 *
 *   section    — a filled band with a hairline rail down its body. The band is
 *                the only grouping cue strong enough for the warm flat themes,
 *                where the panel's surface tokens sit within ~1.1:1 of one
 *                another.
 *   disclosure — a ghost pill shaped like the buttons beside it, with a rule
 *                running to the edge so it still closes off the section.
 *
 * It is inferred from the props (only the disclosure passes `count`), so
 * callers need not opt in.
 *
 * Contract: the section header must stay a single <button> carrying
 * aria-expanded whose trimmed textContent is exactly the title — that is how
 * SettingsForm.accordion.test.jsx locates sections. Badges and `meta` are
 * therefore siblings of the button, never children of it.
 */
export default function CollapsibleSection({
    title = 'Advanced',
    count = null,
    badge = null,
    variant = null,
    meta = null,
    // What the counted things ARE ("Show 7 more fields"). Default keeps the
    // historic wording, so "options" can mean exactly one thing in a panel
    // that also counts hidden SECTIONS as options.
    countNoun = 'option',
    defaultOpen = false,
    open: controlledOpen,
    onToggle,
    persistKey = null,
    // Overrides collapsed state without touching the persisted preference —
    // an error inside must never hide behind a collapsed section (C11).
    forceOpen = false,
    children,
}) {
    const isControlled = controlledOpen != null && typeof onToggle === 'function';
    const [internalOpen, setInternalOpen] = useState(() => {
        if (persistKey) return scopedStorage.getItem(`collapse.${persistKey}`) === '1';
        return defaultOpen;
    });
    const open = forceOpen || (isControlled ? controlledOpen : internalOpen);

    const toggle = () => {
        if (isControlled) { onToggle(!open); return; }
        const next = !open;
        setInternalOpen(next);
        if (persistKey) scopedStorage.setItem(`collapse.${persistKey}`, next ? '1' : '0');
    };

    const kind = variant || (count != null ? 'disclosure' : 'section');
    const label = count != null
        ? (open ? `Fewer ${countNoun}s` : `Show ${count} more ${countNoun}${count === 1 ? '' : 's'}`)
        : title;

    const badgePill = badge != null && (
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] border border-[var(--accent-primary)]/25">
            {badge}
        </span>
    );

    if (kind === 'disclosure') {
        return (
            <div data-variant="disclosure">
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={toggle}
                        aria-expanded={open}
                        className={`${disclosureClass()} ${FOCUS_RING}`}
                    >
                        <span>{label}</span>
                        {badgePill}
                        <ChevronRight
                            size={12}
                            className={`transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
                        />
                    </button>
                    <span aria-hidden="true" className="flex-1 h-px bg-[var(--border-subtle)]" />
                </div>
                {open && <div className="pt-2.5 space-y-2.5">{children}</div>}
            </div>
        );
    }

    return (
        <div data-variant="section">
            <div className={bandClass()}>
                <button
                    type="button"
                    onClick={toggle}
                    aria-expanded={open}
                    className={`flex-1 min-w-0 flex items-center gap-1.5 px-2 py-1.5 text-left rounded-md ${sectionHeaderClass()} hover:text-[var(--text-primary)] transition-colors ${FOCUS_RING}`}
                >
                    <ChevronRight
                        size={12}
                        className={`shrink-0 text-[var(--text-tertiary)] transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
                    />
                    <span className="truncate">{title}</span>
                </button>
                {(badgePill || meta) && (
                    <div className="shrink-0 flex items-center gap-1.5">
                        {badgePill}
                        {meta}
                    </div>
                )}
            </div>
            {open && <div className={railClass()}>{children}</div>}
        </div>
    );
}
