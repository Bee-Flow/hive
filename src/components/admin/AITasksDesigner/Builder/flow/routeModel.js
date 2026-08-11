/**
 * The unified "Condition" node.
 *
 * If, Switch, Filter (route) and Filter (collection) were four palette entries
 * that all answer the same question — "which of these should continue, and
 * where does it go?" — with four different editors and four different mental
 * models. They are now ONE node with one editor, described by this model:
 *
 *   mode      'branch' — decide about the whole run
 *             'items'  — work through a list, decide per item
 *   rules     an ordered list of named conditions; each one is an output
 *   matchMode 'first'  — the first matching output takes it (every stored
 *                        router, and what an absent field means)
 *             'all'    — every output is asked independently and a record may
 *                        travel several of them (BFSF-356 fan-out, opt-in)
 *
 * What happens to whatever matched NO rule is not a setting — it follows from
 * the rule count, which is also exactly what the node shows on the canvas:
 * one rule keeps the matches and drops the rest (a Filter), several rules add
 * an "otherwise" output for the leftovers (a Switch + its default port).
 *
 * The RUNTIME keeps its three step types (`condition`, `switch`, `filter`) —
 * they are the shapes the engine, the validator, the canvas ports and every
 * saved routine already speak. This module is the translation layer, so:
 *   - existing If/Switch/Filter steps open in the unified editor untouched,
 *     with no migration and no version flag;
 *   - the editor picks the narrowest runtime type that expresses the model
 *     (one rule, branch mode ⇒ a plain `condition`, exactly as before).
 *
 * Everything here is pure.
 */

export const ROUTE_STEP_TYPES = new Set(['condition', 'switch', 'filter']);

/** Is this step edited by the unified Filter form? */
export function isRouteStep(step) {
    return !!step && ROUTE_STEP_TYPES.has(step.type);
}

/** A case that carries its own condition rather than a value to compare. */
function isRuleCase(c) {
    return !!c && typeof c.expr === 'string' && c.expr.trim().length > 0;
}

export function emptyRule(name) {
    return { name: name || 'rule1', expr: '', value: '' };
}

/** Mint a rule name that doesn't collide with its siblings (ports must be unique). */
export function uniqueRuleName(rules, base) {
    const names = new Set((Array.isArray(rules) ? rules : []).map(r => r?.name).filter(Boolean));
    const stem = base || 'rule';
    if (!names.has(stem)) return stem;
    let i = 1;
    let name = stem;
    while (names.has(name)) name = `${stem}_${++i}`;
    return name;
}

/** A case with neither a condition nor a value to compare — a rule row the
 *  author added but hasn't filled in yet. */
function isBlankCase(c) {
    return !!c && !isRuleCase(c) && (c.value == null || String(c.value).trim() === '');
}

/**
 * Which of the two deciding styles the editor is in, for a persisted switch.
 *
 * BFSF-356 — this used to be DERIVED from the cases on every open
 * (`cases.every(isRuleCase)`), and that derivation silently destroyed work:
 * "+ Add rule" appends `{name:'rule2', expr:'', value:''}`, that one blank
 * case fails `isRuleCase`, so the whole node reopened in 'value' style — and
 * the next save then rewrote EVERY case as `{name, value}`, throwing away all
 * the rule expressions with no warning and no undo.
 *
 * The style is persisted now (`step.routeStyle`, written by writeRoute), so
 * what the author picked is what reopens. The derivation survives as the
 * fallback for definitions saved BEFORE this change, which carry no
 * `routeStyle` and must open exactly as they do today — with ONE exception:
 * rule cases mixed with still-blank ones read as 'rules'. That is the shape
 * the bug leaves behind, so a routine already saved in that state would still
 * lose its expressions on the next save; every other stored shape (all rules,
 * all values, rules mixed with real values) derives exactly as before.
 */
function readStyle(step, cases) {
    if (step?.routeStyle === 'rules' || step?.routeStyle === 'value') return step.routeStyle;
    if (cases.some(isRuleCase) && cases.every(c => isRuleCase(c) || isBlankCase(c))) return 'rules';
    return (cases.length && cases.every(isRuleCase)) ? 'rules' : 'value';
}

/**
 * How a node with several outputs treats a record that matches more than one
 * of them (BFSF-356).
 *
 *   'first' — the first matching output takes it, and only that one. This is
 *             what every switch ever saved does, so it is what ABSENT means.
 *   'all'   — every output is asked independently and none of them consumes
 *             the record: "contains land" and "contains water" both fire for a
 *             record that has both, and it travels both paths.
 *
 * The absent-field default is the whole compatibility mechanism: flipping the
 * engine to fan-out unconditionally would give every stored router duplicate
 * emails/tickets/API writes for customers who changed nothing. So anything
 * that is not EXACTLY 'all' reads as 'first' — including a typo, which the
 * validator separately rejects rather than letting it mean the opposite of
 * what the author wrote.
 */
export function readMatchMode(step) {
    return step?.matchMode === 'all' ? 'all' : 'first';
}

/**
 * Persisted step → the unified model.
 *
 * `style` distinguishes the two ways a switch can decide:
 *   'rules' — every rule carries its own condition (what this editor writes)
 *   'value' — one value is checked against each rule's expected value (the
 *             legacy switch shape; kept editable so old routines don't have
 *             to be rebuilt, convertible in one click)
 * `matchMode` is the fan-out opt-in — see readMatchMode.
 */
export function readRoute(step) {
    const type = step?.type;
    if (type === 'filter') {
        return {
            mode: 'items',
            style: 'rules',
            matchMode: 'first',
            source: step.arrayRef || '',
            matchOn: '',
            rules: [{ name: 'keep', expr: step.expr || '', value: '' }],
            defaultBranch: '',
            maxItems: typeof step.maxItems === 'number' ? step.maxItems : '',
        };
    }
    if (type === 'switch') {
        const cases = Array.isArray(step.cases) ? step.cases : [];
        // The key's PRESENCE is the mode switch — '' means "list mode, source
        // not picked yet" (an amber warning), absent means branch mode.
        const listMode = typeof step.arrayRef === 'string';
        return {
            mode: listMode ? 'items' : 'branch',
            style: readStyle(step, cases),
            matchMode: readMatchMode(step),
            source: step.arrayRef || '',
            matchOn: step.expr || '',
            rules: cases.map(c => ({ name: c?.name || '', expr: c?.expr || '', value: c?.value ?? '' })),
            defaultBranch: step.defaultBranch || '',
            maxItems: typeof step.maxItems === 'number' ? step.maxItems : '',
        };
    }
    // condition — including the old "Filter (route)" preset, which was only
    // ever an If whose `else` port was left unwired.
    return {
        mode: 'branch',
        style: 'rules',
        matchMode: 'first',
        source: '',
        matchOn: '',
        rules: [{ name: 'rule1', expr: step?.expr || '', value: '' }],
        defaultBranch: '',
        maxItems: '',
    };
}

/**
 * Rules that can actually become an output port.
 *
 * A rule with a name but no predicate yet DOES become a case, on purpose: the
 * port has to exist before the author can wire it, and the server treats the
 * resulting `switch.expr_missing` / `switch.cases_missing` as COMPLETENESS
 * problems (validate.js) — warnings while the routine is a draft, blocking
 * only at activation. Dropping such a rule here would delete the canvas edge
 * the author had already drawn from it (routeEdges/switchCaseOps re-point by
 * slot and by name, and a vanished case takes its edge with it), which is the
 * very kind of silent loss BFSF-356 is about. The style, which is what
 * actually got destroyed, is persisted instead — see readStyle.
 */
function usableRules(route) {
    return (Array.isArray(route?.rules) ? route.rules : []).filter(r => r && String(r.name || '').trim());
}

/**
 * The unified model → the step fields to persist, INCLUDING `type`.
 *
 * Keys that don't belong to the chosen runtime type are set to `undefined` so
 * the patch merge drops them — a step flipped from Switch to If must not keep
 * a stale `cases` array around for the validator to trip over.
 *
 * `routeStyle` rides along on the switch shapes: it is the editor's own state,
 * not something the runtime reads, but deriving it back from the cases lost
 * every rule expression the moment one rule was still blank (BFSF-356, see
 * readStyle). It is explicitly cleared on the condition/filter shapes, which
 * have only one way to decide.
 *
 * `matchMode` is written ONLY as 'all', and only on a switch that really has
 * more than one output. Everything else writes `undefined`, which the patch
 * merge drops:
 *   - a stored first-match router must not gain the key just by being opened
 *     and saved (the absent field IS the compatibility contract);
 *   - turning fan-out back off must CLEAR the key rather than pin 'first'
 *     forever, so the node keeps behaving like every other stored router;
 *   - a one-output node has nothing to fan out to.
 */
export function writeRoute(route) {
    const rules = usableRules(route);
    const first = rules[0] || (Array.isArray(route?.rules) ? route.rules[0] : null);
    const asCases = () => rules.map(r => (route.style === 'value'
        ? { name: r.name, value: r.value ?? '' }
        : { name: r.name, expr: r.expr || '' }));
    const defaultBranch = route.defaultBranch && rules.some(r => r.name === route.defaultBranch)
        ? route.defaultBranch : null;
    const matchMode = (rules.length > 1 && route.matchMode === 'all') ? 'all' : undefined;

    if (route.mode === 'items') {
        // One rule that simply drops the rest IS a Filter — the narrowest
        // shape, and the one whose `{items, count}` output every downstream
        // step already knows how to read. A second rule is what asks for an
        // "otherwise" output, so there is nothing to configure.
        if (rules.length <= 1 && route.style === 'rules') {
            return {
                type: 'filter',
                arrayRef: route.source || '',
                expr: (first?.expr) || '',
                maxItems: route.maxItems === '' || route.maxItems == null ? undefined : Number(route.maxItems),
                cases: undefined, defaultBranch: undefined, routeStyle: undefined, matchMode: undefined,
            };
        }
        return {
            type: 'switch',
            arrayRef: route.source || '',
            expr: route.style === 'value' ? (route.matchOn || '') : '',
            cases: asCases(),
            defaultBranch,
            routeStyle: route.style === 'value' ? 'value' : 'rules',
            matchMode,
            maxItems: route.maxItems === '' || route.maxItems == null ? undefined : Number(route.maxItems),
        };
    }

    // Branch mode. A single condition with an otherwise port is exactly an If.
    if (rules.length <= 1 && route.style === 'rules') {
        return {
            type: 'condition',
            expr: (first?.expr) || '',
            arrayRef: undefined, cases: undefined, defaultBranch: undefined, maxItems: undefined,
            routeStyle: undefined, matchMode: undefined,
        };
    }
    return {
        type: 'switch',
        expr: route.style === 'value' ? (route.matchOn || '') : '',
        cases: asCases(),
        defaultBranch,
        routeStyle: route.style === 'value' ? 'value' : 'rules',
        matchMode,
        arrayRef: undefined, maxItems: undefined,
    };
}

/**
 * The step's output ports, in order, each tagged with the SLOT it fills:
 * rule index 0..n-1, or 'otherwise' for the catch-all. Slots are what edges
 * are re-pointed by when the node changes shape — a slot survives a type flip
 * even though its port name doesn't.
 */
export function routePorts(step) {
    if (step?.type === 'condition') {
        return [
            { slot: 0, label: 'then' },
            { slot: 'otherwise', label: 'else' },
        ];
    }
    if (step?.type === 'switch') {
        const cases = Array.isArray(step.cases) ? step.cases : [];
        return [
            ...cases.filter(c => c?.name).map((c, i) => ({ slot: i, label: `case:${c.name}`, caseName: c.name })),
            { slot: 'otherwise', label: 'case:default', caseName: 'default' },
        ];
    }
    // filter (and anything else): one plain continuation.
    return [{ slot: 0, label: null }];
}

/** Which slot does this outgoing edge occupy on `step`? null = not a branch edge. */
export function slotForEdge(step, edge) {
    const label = edge?.label || null;
    const caseName = edge?.caseName ?? (typeof label === 'string' && label.startsWith('case:') ? label.slice(5) : null);
    if (step?.type === 'condition') {
        if (label === 'then') return 0;
        if (label === 'else') return 'otherwise';
        return null;
    }
    if (step?.type === 'switch') {
        if (caseName == null) return null;
        if (caseName === 'default') return 'otherwise';
        const cases = Array.isArray(step.cases) ? step.cases : [];
        const i = cases.findIndex(c => c?.name === caseName);
        return i >= 0 ? i : null;
    }
    // filter: the single unlabelled continuation.
    return label == null ? 0 : null;
}
