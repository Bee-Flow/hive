import React, { useEffect, useRef, useState } from 'react';
import CollapsibleSection from './CollapsibleSection';
import scopedStorage from '../../../../../utils/scopedStorage';

/**
 * Inspector accordion section. Thin wrapper over CollapsibleSection that
 * groups a step type's fields into a named, collapsible block and adds:
 *   - the persistKey scheme `inspector.<stepType>.<sectionKey>` (per-user,
 *     via scopedStorage key `collapse.inspector.<type>.<key>`),
 *   - a `defaultOpen` seed (primary/has-content sections open by default),
 *   - `forceOpen` — when a validation error targets a field in this section
 *     it opens so the error is always reachable.
 *
 * Force-open never writes the persisted preference: once the error clears,
 * the user's own collapsed/expanded choice returns. Sections are
 * independent (multiple may be open at once), matching the existing
 * CollapsibleSection behaviour the AI step already relies on.
 */
export default function AccordionSection({
    stepType,
    sectionKey,
    title,
    defaultOpen = false,
    forceOpen = false,
    badge = null,
    children,
}) {
    const storageKey = `collapse.inspector.${stepType}.${sectionKey}`;
    const [open, setOpen] = useState(() => {
        if (forceOpen) return true; // an error is present on first mount
        const v = scopedStorage.getItem(storageKey);
        if (v === '1') return true;
        if (v === '0') return false;
        return defaultOpen;
    });

    // Force open only on the false→true transition, so the user can still
    // collapse the section afterwards while the error persists.
    const prevForce = useRef(forceOpen);
    useEffect(() => {
        if (forceOpen && !prevForce.current) setOpen(true);
        prevForce.current = forceOpen;
    }, [forceOpen]);

    const onToggle = (next) => {
        setOpen(next);
        scopedStorage.setItem(storageKey, next ? '1' : '0');
    };

    return (
        <CollapsibleSection title={title} open={open} onToggle={onToggle} badge={badge}>
            {children}
        </CollapsibleSection>
    );
}
