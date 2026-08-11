/**
 * Maps validation issues to the inspector accordion section that contains
 * the offending field, so SettingsForm can force that section open (errors
 * must never hide behind a collapsed section).
 *
 * Validation records carry an id-based path like `steps[<id>].inputs.subject`
 * / `steps[<id>].expr` / `steps[<id>].forEach.overRef` / `trigger.kind`
 * (server/automation/validate.js). `stepIssues` is already filtered to one
 * step (matchValidationToStep), so here we only need the FIELD TAIL after the
 * step id, then map its leading segment to a section key.
 *
 * `null` in a type's map = a flat, always-visible field (Label, Prompt,
 * Trigger kind) — no section to open. An unknown tail falls back to the
 * type's first section so an error is never silently hidden.
 */

import { NODE_DEFS, FLAT, SYNTHETIC_TYPES } from './nodeDefs';

// Per-step-type: `fallback` is the section an unrecognised field tail opens,
// `map` routes a known one. These now live in flow/nodeDefs.js next to the
// type's other presentation facts, because keeping a SEPARATE list here is
// exactly how `guard`, `tokenize`, `untokenize` and `call_block` came to be
// missing from it: an error on one of those returned an empty section set, so
// nothing force-opened, and at quick density the Advanced section holding the
// offending control is not rendered at all. flow/nodeDefs.test.js now asserts
// every type has an entry and that every section it names is one the type's
// editor actually renders.
//
// Still exported under this name — several tests and callers know it.
// Canvas-only node types are excluded: they have no editor and no validation
// path can name them, so an entry here would be a section map for a form that
// does not exist.
const TAXONOMY = Object.fromEntries(
    Object.entries(NODE_DEFS)
        .filter(([type]) => !SYNTHETIC_TYPES[type])
        .map(([type, def]) => [type, def.issueSections]),
);

/** Strip the path down to the field tail after the step id (or `trigger`). */
function fieldTail(path, stepId) {
    if (typeof path !== 'string') return '';
    let tail = path;
    const idIdx = stepId ? path.indexOf(stepId) : -1;
    if (idIdx >= 0) tail = path.slice(idIdx + stepId.length);
    else if (path.startsWith('trigger')) tail = path.slice('trigger'.length);
    return tail.replace(/^\]?\.?/, ''); // drop a leading `].` / `.`
}

/** Leading field segment of a tail, e.g. `inputs.subject` → `inputs`. */
function leadingSegment(tail) {
    return (String(tail).split(/[.[\]]/).filter(Boolean)[0]) || '';
}

/**
 * @param {object} step        the step being edited (needs `type`, `id`)
 * @param {{errors?:[], warnings?:[]}} stepIssues  step-scoped validation
 * @returns {Set<string>} section keys that contain at least one error
 */
export function sectionsWithErrors(step, stepIssues) {
    const out = new Set();
    if (!step || !stepIssues) return out;
    const tax = TAXONOMY[step.type];
    if (!tax) return out;
    for (const rec of (stepIssues.errors || [])) {
        const seg = leadingSegment(fieldTail(rec?.path, step.id));
        if (!seg) continue;
        const section = tax.map[seg];
        if (section === FLAT) continue;           // always-visible field
        out.add(section || tax.fallback);          // unknown tail → first section
    }
    return out;
}

export { TAXONOMY };
