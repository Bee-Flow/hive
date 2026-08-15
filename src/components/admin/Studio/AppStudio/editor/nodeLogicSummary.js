import { describeAction } from '../inspector/actionLabels';
import { NODE_EVENTS } from '../state/definitionOps';

/**
 * What logic a component carries, in a sentence each.
 *
 * The canvas drew components and nothing else. A screen with a dozen of them
 * gave no clue which button does something when clicked, which field refuses a
 * bad value, which card is hidden from most people — you found out by selecting
 * each one in turn and opening three inspector accordions. For a builder who
 * cannot read the definition JSON, "what does what" was answerable only by
 * exhaustive clicking, and a rule attached to the wrong component was invisible
 * until somebody used the app.
 *
 * → [{ key, kind, text }], most important first. Empty when a node is plain,
 * which is most of them — the marks have to stay rare enough to mean something.
 *
 * `kind` is the badge to draw: 'action' | 'visibility' | 'enablement' |
 * 'validation' | 'computed'. `text` is the whole explanation, already in the
 * author's language (describeAction does the naming), so a tooltip needs no
 * further assembly.
 */

/** The event slots, in the order a person would read them. */
const EVENT_TEXT = {
    onClick: 'When clicked',
    onSubmit: 'When submitted',
    onRowClick: 'When a row is clicked',
    onRowSelect: 'When a row is selected',
    onCardMove: 'When a card is moved',
};

/** The expression behind a boolean|formula flag (legacy bare strings included). */
function exprOf(flag) {
    if (typeof flag === 'string') return flag;
    if (flag && typeof flag === 'object') return flag.expr || '';
    return '';
}

/** Cap an expression so a badge tooltip stays one readable line. */
function short(expr, max = 60) {
    const s = String(expr || '').replace(/\s+/g, ' ').trim();
    return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

export default function nodeLogicSummary(node, definition, titleFor = null) {
    if (!node || typeof node !== 'object') return [];
    const marks = [];
    const actions = (definition?.actions && typeof definition.actions === 'object') ? definition.actions : {};

    // What happens when someone uses it. First, because it is the question
    // asked most often and the one the canvas was least able to answer.
    for (const event of NODE_EVENTS) {
        const actionId = node[event];
        if (!actionId || typeof actionId !== 'string') continue;
        const action = actions[actionId];
        const what = action
            ? describeAction(actionId, action, definition, titleFor)
            // A slot pointing at an action that is not there is a real break —
            // validate.js rejects it on the next save — so say so rather than
            // drawing a badge that claims something happens.
            : 'points at an action that no longer exists';
        marks.push({
            key: `${event}:${actionId}`,
            kind: 'action',
            text: `${EVENT_TEXT[event] || event}: ${what}`,
        });
    }

    const visibleWhen = exprOf(node.visibleWhen);
    if (visibleWhen) {
        marks.push({ key: 'visibleWhen', kind: 'visibility', text: `Only shown when ${short(visibleWhen)}` });
    } else if (node.visible === false) {
        marks.push({ key: 'visible', kind: 'visibility', text: 'Hidden in the running app' });
    }

    const enabledWhen = exprOf(node.enabledWhen);
    if (enabledWhen) {
        marks.push({ key: 'enabledWhen', kind: 'enablement', text: `Only usable when ${short(enabledWhen)}` });
    }

    const rules = Array.isArray(node.validations) ? node.validations.filter(Boolean) : [];
    if (rules.length) {
        marks.push({
            key: 'validations',
            kind: 'validation',
            text: rules.length === 1 ? 'Checks 1 rule before submitting' : `Checks ${rules.length} rules before submitting`,
        });
    }

    const computed = (node.computed && typeof node.computed === 'object') ? Object.keys(node.computed) : [];
    if (computed.length) {
        marks.push({
            key: 'computed',
            kind: 'computed',
            text: `Works out ${computed.join(', ')} while the app runs`,
        });
    }

    return marks;
}

/**
 * Does this node, or anything inside it, carry logic?
 *
 * A container's own badge would otherwise say "plain" while every button in it
 * has an action — and a collapsed or scrolled-away child is exactly the one
 * somebody loses track of.
 */
export function subtreeHasLogic(node, definition) {
    if (!node) return false;
    if (nodeLogicSummary(node, definition).length) return true;
    return (Array.isArray(node.children) ? node.children : [])
        .some((child) => subtreeHasLogic(child, definition));
}
