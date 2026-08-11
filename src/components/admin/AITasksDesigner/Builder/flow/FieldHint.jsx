import React from 'react';
import Info from '../../../guardrails/Info';

/**
 * On-demand field hint. Replaces the always-on multi-line gray descriptions
 * under every input (the main source of vertical bloat in the old config
 * panel) with a small ⓘ next to the label. Thin adapter over the shared
 * guardrails `Info` popover so behaviour (outside-click, Escape, theming,
 * no-purple) stays consistent with the rest of admin.
 *
 * Renders nothing when there's no hint, so call-sites can pass it
 * unconditionally.
 *
 * BFSF-362 — the `placement` prop is gone. `Info` now renders through the
 * AnchoredMenu portal, which measures the viewport and flips on its own; a
 * caller-declared side was exactly what left a hint on a bottom-edge field
 * opening downwards into the clipped void. No call site ever passed it.
 */
export default function FieldHint({ children, title = null, className = '' }) {
    if (children == null || children === '') return null;
    return (
        <Info title={title} className={className}>
            {children}
        </Info>
    );
}
