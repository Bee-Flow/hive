/**
 * The unified "Privacy Shield" node.
 *
 * "Check for personal data", "Hide personal data" and "Show real values again"
 * were three palette entries for three stages of ONE capability. A user
 * building a detect → hide → reveal flow had to know which three nodes to drag
 * and in which order, and nothing said that reveal is meaningless without a
 * hide before it. They are now ONE node with one editor, described by a mode:
 *
 *   'check'       scan a value and branch on the answer          (runtime: guard)
 *   'hide'        replace personal data with reversible tokens   (runtime: tokenize)
 *   'check_hide'  do both: branch AND hide what was found        (runtime: guard
 *                                                                 + onFound.tokenize)
 *   'reveal'      put the real values back                       (runtime: untokenize)
 *
 * The RUNTIME keeps its three step types (`guard`, `tokenize`, `untokenize`) —
 * they are the shapes the engine, the validator, the canvas ports and every
 * saved routine already speak. This module is the translation layer, exactly as
 * routeModel.js is for If/Switch/Filter, so:
 *   - existing guard/tokenize/untokenize steps open in the unified editor
 *     untouched, with no migration and no run-history backfill;
 *   - the editor writes back the same runtime type it read, and only the mode
 *     selector changes it.
 *
 * PORTS ARE NOT UNIFORM ACROSS MODES, which is the one thing to be careful
 * about: a check branches (personal data / clean) while hide and reveal have a
 * single continuation. Switching between them changes the node's shape on the
 * canvas, so `droppedEdgesOnModeChange` exists to say what a switch would cost
 * BEFORE it is saved.
 *
 * Everything here is pure.
 */

export const PRIVACY_STEP_TYPES = new Set(['guard', 'tokenize', 'untokenize']);

/** Is this step edited by the unified Privacy Shield form? */
export function isPrivacyStep(step) {
    return !!step && PRIVACY_STEP_TYPES.has(step.type);
}

export const PRIVACY_MODES = [
    {
        id: 'check',
        label: 'Check for personal data',
        blurb: 'Scan a value and send the run down one path or the other.',
        type: 'guard',
    },
    {
        id: 'check_hide',
        label: 'Check and hide',
        blurb: 'Scan, branch on the answer, and replace what was found with placeholders.',
        type: 'guard',
    },
    {
        id: 'hide',
        label: 'Hide personal data',
        blurb: 'Replace personal data with placeholders. The real values come back later.',
        type: 'tokenize',
    },
    {
        id: 'reveal',
        label: 'Show real values again',
        blurb: 'Put the real values back where a step still holds placeholders.',
        type: 'untokenize',
    },
];

const MODE_IDS = new Set(PRIVACY_MODES.map(m => m.id));

/** The runtime step type a mode is stored as. */
export function stepTypeForMode(mode) {
    return PRIVACY_MODES.find(m => m.id === mode)?.type || 'guard';
}

/** Does this mode SCAN? (checks and hides do; reveal does not.) */
export function modeScans(mode) {
    return mode === 'check' || mode === 'check_hide' || mode === 'hide';
}

/** Does this mode BRANCH? Only the two guard-backed modes have two ports. */
export function modeBranches(mode) {
    return mode === 'check' || mode === 'check_hide';
}

/** Does this mode HIDE personal data? Used by the reveal-without-hide warning. */
export function modeHides(mode) {
    return mode === 'hide' || mode === 'check_hide';
}

/**
 * Persisted step → the mode it is edited as.
 *
 * A `guard` is a plain check unless it carries the tokenizing action, which is
 * what makes it a Check + Hide. Anything unrecognised reads as 'check', which
 * is the least destructive assumption: it scans and branches but changes no
 * data.
 */
export function readPrivacyMode(step) {
    if (step?.type === 'tokenize') return 'hide';
    if (step?.type === 'untokenize') return 'reveal';
    const onFound = step?.onFound && typeof step.onFound === 'object' ? step.onFound : {};
    return onFound.tokenize ? 'check_hide' : 'check';
}

/** Persisted step → the unified model. */
export function readPrivacy(step) {
    const mode = readPrivacyMode(step);
    const onFound = step?.onFound && typeof step.onFound === 'object' ? step.onFound : {};
    return {
        mode,
        sourceRef: step?.sourceRef || '',
        // `categories` and `confidence` absent means "inherit the organisation's
        // Privacy Shield settings" — a real, meaningful state that must survive
        // the round trip, so it is kept as null rather than defaulted here.
        categories: Array.isArray(step?.categories) ? step.categories : null,
        confidence: typeof step?.confidence === 'number' ? step.confidence : null,
        stopOnFound: !!onFound.stop,
        maskOnFound: !!onFound.mask,
    };
}

/**
 * The unified model → a persisted step patch.
 *
 * Follows writeRoute's idiom: keys the chosen mode has no business carrying are
 * written as `undefined`, which the patch merge treats as "delete", so a mode
 * switch cannot leave a stale field behind (a `stopOnFound` surviving onto a
 * reveal step, say, where nothing would ever read it).
 */
export function writePrivacy(model) {
    const mode = MODE_IDS.has(model?.mode) ? model.mode : 'check';
    const type = stepTypeForMode(mode);
    const base = {
        type,
        sourceRef: model?.sourceRef || '',
        categories: Array.isArray(model?.categories) && model.categories.length ? model.categories : undefined,
        confidence: typeof model?.confidence === 'number' ? model.confidence : undefined,
    };

    if (!modeBranches(mode)) {
        // tokenize / untokenize read no onFound at all.
        return { ...base, onFound: undefined };
    }

    const onFound = {};
    if (model?.stopOnFound) onFound.stop = true;
    if (model?.maskOnFound) onFound.mask = true;
    if (mode === 'check_hide') onFound.tokenize = true;
    return { ...base, onFound: Object.keys(onFound).length ? onFound : undefined };
}

/**
 * The step's output ports, in order, each tagged with the SLOT it fills.
 * Slots are what edges are re-pointed by when the node changes shape — slot 0
 * is "the way on", which every mode has, so a check→hide switch keeps the edge
 * leaving its `then` port.
 */
export function privacyPorts(step) {
    const mode = readPrivacyMode(step);
    if (modeBranches(mode)) {
        return [
            { slot: 0, label: 'then' },
            { slot: 'clean', label: 'else' },
        ];
    }
    return [{ slot: 0, label: null }];
}

/** Which slot does this outgoing edge occupy on `step`? null = not a branch edge. */
export function slotForPrivacyEdge(step, edge) {
    const label = edge?.label || null;
    if (!modeBranches(readPrivacyMode(step))) return label ? null : 0;
    if (label === 'then') return 0;
    if (label === 'else') return 'clean';
    return null;
}

/**
 * Which outgoing edges a mode switch would DROP, named for the user.
 *
 * Going from a branching mode to a single-port one leaves the `else` edge with
 * a label the new shape has no port for. The canvas would silently discard it,
 * so the editor asks first — the same stance RouteFields takes when collapsing
 * a router back to one output.
 *
 * `on_error` edges are dropped from a guard too: validate.js lists guard in
 * ON_ERROR_FORBIDDEN_SOURCE_TYPES while tokenize/untokenize are allowed to have
 * one, so a hide→check switch turns a legal on_error edge into an invalid
 * definition. That direction is reported as well.
 */
export function droppedEdgesOnModeChange(step, nextMode, edges = []) {
    const from = step?.id;
    if (!from) return [];
    const out = (edges || []).filter(e => e?.from === from);
    const wasBranching = modeBranches(readPrivacyMode(step));
    const willBranch = modeBranches(nextMode);
    const dropped = [];

    if (wasBranching && !willBranch) {
        for (const e of out) {
            if (e.label === 'else') dropped.push({ edge: e, port: 'clean', why: 'this mode has only one way on' });
        }
    }
    if (!wasBranching && willBranch) {
        // A guard may not carry an on_error edge (validate.js).
        for (const e of out) {
            if (e.label === 'on_error') dropped.push({ edge: e, port: 'if it fails', why: 'a checking step cannot have an "if it fails" path' });
        }
    }
    return dropped;
}
