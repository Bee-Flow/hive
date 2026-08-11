import React from 'react';
import { useTranslation } from '../../../../../../hooks/useTranslation';
import { nodeHelp } from '../nodeDefs';

/**
 * "What does this step do?" — one or two plain sentences at the top of the
 * step's own editor.
 *
 * This is the only place in the builder a non-technical author can reliably
 * find out. The palette description exists, but the ribbon is the default add
 * surface and shows labels only; the dropdown gives its description one clipped
 * line; and the canvas card deliberately shows no explanation at all
 * (StepNodeBase documents why — the popover that used to cover neighbouring
 * cards and the hover toolbar above them). So the moment the author lands here,
 * which is immediately after adding a step, is the moment to say it.
 *
 * Deliberately static text, not a tooltip or a popover: it works on touch, it
 * is read by screen readers in order, it needs no discovery, and it cannot
 * cover anything.
 *
 * It says only WHAT THE STEP DOES — the node's type is already named in the
 * detail view's own header directly above, and printing it twice made the panel
 * look like it was stuttering.
 */
export default function NodePurpose({ step }) {
    const { t } = useTranslation();
    const help = step?.type ? nodeHelp(step.type, t) : '';
    if (!help) return null;

    return (
        <p className="rounded-md border border-[var(--border-default)] bg-[var(--bg-secondary)]/50 px-2.5 py-2 text-[11px] leading-relaxed text-[var(--text-secondary)]">
            {help}
        </p>
    );
}
