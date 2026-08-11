/**
 * Split a tool's schema properties into "essential" (shown by default) and
 * "advanced" (collapsed behind a "Show N more options" disclosure).
 *
 * This is the single source of truth for the progressive-disclosure policy
 * — kept pure + testable, out of JSX.
 */

// Frequently-primary field names — shown by default even when not required.
//
// `maxresults` / `max_results` are here because a result cap is not an
// "advanced" concern: collapsed behind "Show N more options" with an empty
// box, gmail_search's cap of 10 was invisible, so a routine whose query
// matched 201 mails quietly processed ten of them and nothing on screen
// explained why (BFSF-358A). A field that decides how much of the user's data
// the routine even sees belongs in the default view.
const COMMON_PRIMARY = new Set([
    'query', 'q', 'prompt', 'message', 'body', 'text', 'content', 'input',
    'url', 'to', 'subject', 'name', 'path', 'title', 'email',
    'maxresults', 'max_results',
]);

/**
 * Is a binding empty (so the field counts as "unset")? Centralised here so
 * ToolInputForm and partitionInputs agree on emptiness.
 */
export function isEmptyBinding(b) {
    if (b == null) return true;
    if (typeof b !== 'object') return false;
    if (b.kind === 'literal' && (b.value == null || b.value === '')) return true;
    if (b.kind === 'ref' && !b.path) return true;
    if ((b.kind === 'template' || b.kind === 'expr') && !b.value) return true;
    return false;
}

/**
 * @param {object} properties   inputSchema.properties (JSON Schema-ish)
 * @param {Set<string>} requiredSet  required field names
 * @param {object} currentInputs the step's current inputs map
 * @returns {{ essentialKeys: string[], advancedKeys: string[] }}
 *
 * Classification (priority order):
 *   1. required        -> essential
 *   2. already-set     -> essential (never hide a field the user populated)
 *   3. x-primary:true  -> essential ; x-advanced:true -> advanced
 *   4. common-name allowlist -> essential
 *   5. everything else -> advanced
 * Floor: if nothing landed in essential, promote the first declared property.
 * Keys preserve declaration order.
 */
export function partitionInputs(properties, requiredSet, currentInputs = {}) {
    const props = properties || {};
    const required = requiredSet || new Set();
    const essentialKeys = [];
    const advancedKeys = [];

    for (const key of Object.keys(props)) {
        const prop = props[key] || {};
        const set = !isEmptyBinding((currentInputs || {})[key]);
        let essential;
        if (required.has(key)) essential = true;
        else if (set) essential = true;
        else if (prop['x-primary'] === true) essential = true;
        else if (prop['x-advanced'] === true) essential = false;
        else if (COMMON_PRIMARY.has(String(key).toLowerCase())) essential = true;
        else essential = false;

        (essential ? essentialKeys : advancedKeys).push(key);
    }

    // Floor: never render an empty default view when there ARE properties.
    if (essentialKeys.length === 0 && advancedKeys.length > 0) {
        essentialKeys.push(advancedKeys.shift());
    }

    return { essentialKeys, advancedKeys };
}
