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
 */
export default function FieldHint({ children, title = null, placement = 'bottom', className = '' }) {
    if (children == null || children === '') return null;
    return (
        <Info title={title} placement={placement} className={className}>
            {children}
        </Info>
    );
}
