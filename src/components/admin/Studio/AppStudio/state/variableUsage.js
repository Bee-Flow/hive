import { RESERVED_VARIABLE_NAMES, VARIABLE_NAME_RE } from '../runtime/appVariables';

/**
 * Where every `vars.<name>` is read and written, with enough detail to point at
 * the place on screen.
 *
 * This is what makes a variable something you can reason about: the manager can
 * say "used 3×" instead of "delete and find out", the delete dialog can name
 * the sites in plain English, and the reads-nothing-writes banner can offer to
 * declare the names a formula is asking for. That banner is the direct answer
 * to the `vars.statusfilter` typo — the whole reason this feature exists.
 *
 * Pure and React-free: it walks the definition, and state/ → runtime/ is the
 * established import direction in this tree.
 */

// compile().refs would only give the ROOT, so the name comes off the source
// text — the same trick validate.js uses for currentUser.<attr>.
const VARS_ATTR_RE = /\bvars\s*\.\s*([A-Za-z_$][\w$]*)/g;

function isObject(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }

/** Every `vars.<name>` inside one expression string. */
function namesIn(expr) {
    if (typeof expr !== 'string' || !expr) return [];
    return [...expr.matchAll(VARS_ATTR_RE)].map((m) => m[1]);
}

/**
 * Walk any authored value for formulas. A prop can hold a binding, a filter
 * array whose entries hold bindings, a connector params map — the shapes vary,
 * but a formula is always `{kind:'formula', expr}` (or the legacy bare string
 * a filter may still carry).
 */
function eachFormula(value, visit, depth = 0) {
    if (depth > 12 || value == null) return;
    if (Array.isArray(value)) {
        for (const entry of value) eachFormula(entry, visit, depth + 1);
        return;
    }
    if (!isObject(value)) return;
    if (value.kind === 'formula' && typeof value.expr === 'string') { visit(value.expr); return; }
    if (value.type === 'formula' && typeof value.expr === 'string') { visit(value.expr); return; }
    for (const v of Object.values(value)) eachFormula(v, visit, depth + 1);
}

function walkSteps(steps, visit, depth = 0) {
    if (!Array.isArray(steps) || depth > 12) return;
    for (const step of steps) {
        if (!isObject(step)) continue;
        visit(step);
        walkSteps(step.then, visit, depth + 1);
        walkSteps(step.else, visit, depth + 1);
        walkSteps(step.steps, visit, depth + 1);
        walkSteps(step.onError, visit, depth + 1);
        for (const c of Array.isArray(step.cases) ? step.cases : []) {
            if (isObject(c)) walkSteps(c.steps, visit, depth + 1);
        }
        walkSteps(step.default, visit, depth + 1);
    }
}

/**
 * collectVariableUsage(def) → { reads, writes, unknown, countOf }
 *
 *   reads    Map<name, Site[]>  formulas that read vars.<name>
 *   writes   Map<name, Site[]>  things that put a value in it
 *   unknown  Set<name>          read, but neither declared nor written — the typo
 *   countOf(name) → number      reads + writes, for the "used N×" chip
 *
 * Site = { kind, label, screenId, screenName, nodeId, nodeType, actionId }
 */
export function collectVariableUsage(def) {
    const reads = new Map();
    const writes = new Map();

    const add = (map, name, site) => {
        if (!map.has(name)) map.set(name, []);
        map.get(name).push(site);
    };
    const addReads = (expr, site) => {
        for (const name of namesIn(expr)) add(reads, name, site);
    };
    /**
     * A boolean-or-formula flag (visible / visibleWhen / enabledWhen /
     * readOnly). These reach us as {kind:'formula',expr} — the only expression
     * shape canonicalize keeps — so reading them as plain strings found
     * nothing: a variable used ONLY to decide what is shown counted as unused,
     * the manager offered to delete it with no confirmation, and every rule
     * built on it silently stopped working. The legacy bare string is still
     * accepted, for a definition held in memory before its first save.
     */
    const addFlagReads = (flag, site) => {
        if (typeof flag === 'string') { addReads(flag, site); return; }
        eachFormula(flag, (expr) => addReads(expr, site));
    };

    // ── components ──────────────────────────────────────────────────────────
    for (const screen of Array.isArray(def?.screens) ? def.screens : []) {
        const screenSite = { screenId: screen?.id, screenName: screen?.name || screen?.id };
        const walk = (nodes, depth) => {
            if (!Array.isArray(nodes) || depth > 12) return;
            for (const node of nodes) {
                if (!isObject(node)) continue;
                const at = { ...screenSite, nodeId: node.id, nodeType: node.type };

                eachFormula(node.props, (expr) => addReads(expr, { ...at, kind: 'prop', label: 'a setting' }));
                eachFormula(node.computed, (expr) => addReads(expr, { ...at, kind: 'computed', label: 'a computed value' }));
                eachFormula(node.validations, (expr) => addReads(expr, { ...at, kind: 'validation', label: 'a validation rule' }));
                addFlagReads(node.visibleWhen, { ...at, kind: 'visibleWhen', label: 'when it is shown' });
                addFlagReads(node.enabledWhen, { ...at, kind: 'enabledWhen', label: 'when it is enabled' });
                addFlagReads(node.visible, { ...at, kind: 'visibleWhen', label: 'when it is shown' });
                addFlagReads(node.readOnly, { ...at, kind: 'readOnly', label: 'when it is read-only' });

                // A filter bar owns the reserved `filters` name.
                if (node.type === 'filter_bar' && Array.isArray(node.props?.fields) && node.props.fields.length) {
                    add(writes, 'filters', { ...at, kind: 'filter_bar', label: 'the filter bar' });
                }

                walk(node.children, depth + 1);
            }
        };
        for (const section of Array.isArray(screen?.sections) ? screen.sections : []) {
            walk(section?.children, 0);
        }
    }

    // ── actions ─────────────────────────────────────────────────────────────
    for (const [actionId, action] of Object.entries(isObject(def?.actions) ? def.actions : {})) {
        if (!isObject(action)) continue;
        const at = { actionId, kind: 'action', nodeId: null };

        // A bare action is walked as a one-step sequence below, which already
        // records its resultVar — adding it here too counted the same write
        // twice, so the manager said "used 2x" for one action and the delete
        // dialog listed the same site on two rows.
        if (action.kind === 'sequence' && typeof action.resultVar === 'string') {
            add(writes, action.resultVar, { ...at, kind: 'resultVar', label: `the result of ${actionId}` });
        }

        walkSteps(action.kind === 'sequence' ? action.steps : [action], (step) => {
            const site = { ...at, kind: step.kind, label: describeStep(step) };
            if (step.kind === 'set_variable' && typeof step.name === 'string') {
                add(writes, step.name, site);
            }
            if (typeof step.resultVar === 'string') {
                add(writes, step.resultVar, { ...site, kind: 'resultVar' });
            }
            if (step.kind === 'loop') {
                if (typeof step.itemVar === 'string' && step.itemVar) add(writes, step.itemVar, { ...site, kind: 'itemVar', label: 'a loop, while it runs' });
                if (typeof step.indexVar === 'string' && step.indexVar) add(writes, step.indexVar, { ...site, kind: 'indexVar', label: 'a loop, while it runs' });
            }
            // Everything a step reads: condition/switch expressions, record
            // values, navigate params, loop sources — all formulas in its body.
            eachFormula(step, (expr) => addReads(expr, site));
            if (typeof step.expr === 'string') addReads(step.expr, site);
        });
    }

    const declared = new Set(
        (Array.isArray(def?.variables) ? def.variables : [])
            .map((v) => v?.name)
            .filter((n) => typeof n === 'string' && n),
    );

    const unknown = new Set();
    for (const name of reads.keys()) {
        if (declared.has(name) || writes.has(name) || RESERVED_VARIABLE_NAMES.includes(name)) continue;
        unknown.add(name);
    }

    const countOf = (name) => (reads.get(name)?.length || 0) + (writes.get(name)?.length || 0);

    return { reads, writes, unknown, countOf };
}

function describeStep(step) {
    switch (step.kind) {
        case 'set_variable': return 'a "set a variable" step';
        case 'loop': return 'a loop';
        case 'condition': return 'a condition';
        case 'switch': return 'a switch';
        default: return `a ${String(step.kind || 'step').replace(/_/g, ' ')} step`;
    }
}

/**
 * A name that is read but nowhere declared or written, and which COULD be
 * declared — the one-click fix behind the "nothing gives this a value" banner.
 * A name that is not a legal identifier is excluded: declaring it would not
 * make the read work.
 */
export function declarableUnknowns(usage) {
    return [...usage.unknown].filter((n) => VARIABLE_NAME_RE.test(n)).sort();
}

/** One human sentence for a usage site, for the delete dialog. */
export function describeSite(site) {
    if (!site) return '';
    if (site.screenName && site.nodeType) {
        return `Screen “${site.screenName}” → ${String(site.nodeType).replace(/_/g, ' ')} → ${site.label}`;
    }
    if (site.actionId) return `Action ${site.actionId} → ${site.label}`;
    return site.label || '';
}
