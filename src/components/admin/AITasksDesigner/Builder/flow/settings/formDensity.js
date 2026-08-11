import { createContext, useContext } from 'react';

/**
 * How much of a step's form to show.
 *
 *   'quick' — only the sections you need to make the step work. Opened by a
 *             single click on a node: most steps are one or two fields, and a
 *             full-screen three-column editor for `query: nextcloud` is noise.
 *   'full'  — everything, in the Input | Parameters | Output layout.
 *
 * The split is declared HERE rather than per form, so all ~20 sections follow
 * one rule and adding a section can't silently leak into the quick view.
 * Sections that hold a validation ERROR are always rendered regardless — a
 * problem the user cannot reach is worse than a busy panel.
 */

export const ADVANCED_SECTION_KEYS = new Set([
    'advanced',   // per-type "Advanced" blocks (forEach, defaultBranch, …)
    'options',    // parse_json / http_request tuning
    'headers',    // http_request
    'auth',       // http_request credentials
    'output',     // ai_step structured-output schema
]);

/** Is this section hidden at the given density? */
export function isAdvancedSection(sectionKey) {
    return ADVANCED_SECTION_KEYS.has(sectionKey);
}

/**
 * Which density an "open this node" request resolves to.
 *
 * The GESTURE decides, always: a single click asks for nothing and gets the
 * quick view, a double click asks for 'full'. An earlier version remembered
 * the user's last choice, which meant that after one expand, single and double
 * click behaved identically — the distinction the two gestures exist for.
 */
export function densityForOpen(requested) {
    return requested === 'full' ? 'full' : 'quick';
}

/**
 * `density` is what sections read. `onHiddenSection(key)` lets the host count
 * what it is hiding, so the "More options (3)" button can name a number
 * instead of promising something that may not exist.
 */
export const FormDensityContext = createContext({ density: 'full', onHiddenSection: null });

export function useFormDensity() {
    return useContext(FormDensityContext);
}
