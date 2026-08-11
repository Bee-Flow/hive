/**
 * What an action is CALLED, in the author's language.
 *
 * This lived inside ActionsSection, so every other place that had to name an
 * action — the data grid's row actions, the repeater's item actions — listed
 * raw ids instead: the user chose between "act_a1b2c3" and "act_d4e5f6" and had
 * to open the Actions accordion to find out which was which. It is a pure
 * function of the definition, so it belongs in its own module rather than
 * inside a 45 KB panel.
 *
 * `titleFor` resolves an automation id to its title; callers without the
 * automations list (the ones outside ActionsSection) pass nothing and get
 * "Run routine" unqualified, which still beats an opaque id.
 */

export function describeAction(id, action, definition, titleFor = null) {
    switch (action?.kind) {
        case 'run_automation': {
            const title = typeof titleFor === 'function' ? titleFor(action.automationId) : null;
            return title ? `Run routine — ${title}` : 'Run routine';
        }
        case 'navigate': {
            const screen = (definition?.screens || []).find((s) => s.id === action.screenId);
            return `Go to ${screen?.name || 'screen'}`;
        }
        case 'toast': {
            const msg = (action.message || '').slice(0, 24);
            return msg ? `Show a message: “${msg}”` : 'Show a message';
        }
        case 'open_url':
            return action.url ? `Open ${action.url}` : 'Open a web page';
        case 'open_modal':
        case 'close_modal': {
            const label = action.kind === 'open_modal' ? 'Open' : 'Close';
            const modal = findModal(definition, action.modalId);
            return modal ? `${label} the “${modal}” dialog` : `${label} a dialog`;
        }
        case 'sequence': {
            const n = Array.isArray(action.steps) ? action.steps.length : 0;
            return n ? `A flow of ${n} step${n === 1 ? '' : 's'}` : 'A flow';
        }
        case 'send_email':
            return 'Send an e-mail';
        case 'ai_extract':
            return 'AI · extract from document';
        case 'ai_generate':
            return 'AI · generate / summarize';
        case 'kb_query':
            return 'AI · search knowledge base';
        default:
            // An id is a poor label, but it is the only true one for a kind this
            // build does not know — and saying so is better than showing blank.
            return id;
    }
}

/** The title of the modal node with this id, anywhere in the app. */
function findModal(definition, modalId) {
    if (!modalId) return null;
    let found = null;
    const walk = (nodes) => {
        for (const n of nodes || []) {
            if (found) return;
            if (n?.id === modalId && n.type === 'modal') { found = n.props?.title || null; return; }
            if (Array.isArray(n?.children)) walk(n.children);
        }
    };
    for (const screen of definition?.screens || []) {
        for (const section of screen.sections || []) walk(section.children);
    }
    return found;
}

/** `[{ id, label }]` for every action in the app — the shape a <select> wants. */
export function actionOptions(definition, titleFor = null) {
    const actions = definition?.actions && typeof definition.actions === 'object' ? definition.actions : {};
    return Object.entries(actions).map(([id, action]) => ({
        id,
        label: describeAction(id, action, definition, titleFor),
    }));
}

export default describeAction;
