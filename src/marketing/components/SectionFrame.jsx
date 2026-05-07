import React from 'react';

/**
 * Pass-through wrapper for marketing sections. The hover-toolbar (Edit
 * settings · Hide) is gone — its `id` was the block *type*, while the
 * panel keys everything off block *id*, so neither the click handler
 * nor the active-section highlight ever resolved correctly. The side
 * panel covers the same affordances unambiguously.
 *
 * Kept as a thin component (rather than ripping it out of every section)
 * so the call sites in Hero/Features/etc. can stay unchanged. If we want
 * to bring the toolbar back later, do it here and post the block.id —
 * which means threading block.id through ProductWebsite.jsx into each
 * section so the path / id can flow back the other direction too.
 */
export default function SectionFrame({ children }) {
    return <>{children}</>;
}
