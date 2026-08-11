import React, { useEffect, useRef, useState } from 'react';
import CollapsibleSection from './CollapsibleSection';
import { isAdvancedSection, useFormDensity } from './settings/formDensity';
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
    // Rendered beside the title on the band, outside the toggle button (a
    // FieldHint, a count chip). Never plain text: the button's textContent is
    // how tests locate a section.
    meta = null,
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

    // Quick view: advanced sections are left out entirely (the host offers a
    // "More options" way in). A section holding a validation ERROR is the one
    // exception — hiding it would make the problem unreachable.
    const { density, onHiddenSection } = useFormDensity();
    const hidden = density === 'quick' && isAdvancedSection(sectionKey) && !forceOpen;
    useEffect(() => {
        if (hidden) onHiddenSection?.(sectionKey);
    }, [hidden, sectionKey, onHiddenSection]);
    if (hidden) return null;

    const onToggle = (next) => {
        setOpen(next);
        scopedStorage.setItem(storageKey, next ? '1' : '0');
    };

    return (
        <CollapsibleSection variant="section" title={title} open={open} onToggle={onToggle} badge={badge} meta={meta}>
            {children}
        </CollapsibleSection>
    );
}
