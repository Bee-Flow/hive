import {
    ArrowRight, Bell, Bot, Braces, CheckCircle2, Database, ExternalLink, FileSearch,
    GitBranch, Layers, Mail, MessageSquare, Pencil, RefreshCw, Repeat, Search,
    SquareStack, Trash2, Workflow,
} from 'lucide-react';

/**
 * How each step KIND presents itself: a human name, an icon, a group, and the
 * one line that says what it does. Grouped the way somebody thinks about it —
 * "what happens on screen", "what changes in the data", "what decides" — not by
 * whether the browser or the server runs it.
 *
 * The kinds themselves come from the server (STEP_KINDS); this only dresses
 * them. stepCatalog.lockstep.test.js fails if a kind ships without an entry, so
 * a new step type cannot land as an unlabelled grey box.
 */

export const STEP_GROUPS = ['On screen', 'Data', 'AI', 'Flow'];

export const STEP_CATALOG = {
    // ── On screen ───────────────────────────────────────────────────────────
    navigate: {
        label: 'Go to screen', group: 'On screen', icon: ArrowRight,
        blurb: 'Open another screen in this app.',
    },
    toast: {
        label: 'Show a message', group: 'On screen', icon: MessageSquare,
        blurb: 'A short confirmation or warning.',
    },
    open_url: {
        label: 'Open a web page', group: 'On screen', icon: ExternalLink,
        blurb: 'Send the person to an address outside the app.',
    },
    open_modal: {
        label: 'Open a dialog', group: 'On screen', icon: SquareStack,
        blurb: 'Show one of this screen’s dialogs.',
    },
    close_modal: {
        label: 'Close a dialog', group: 'On screen', icon: SquareStack,
        blurb: 'Put a dialog away — end a save flow with this.',
    },
    confirm: {
        label: 'Ask first', group: 'On screen', icon: CheckCircle2,
        blurb: 'Stop and ask. Declining cancels everything after it.',
    },
    refresh: {
        label: 'Reload the data', group: 'On screen', icon: RefreshCw,
        blurb: 'Fetch the rows again after something changed.',
    },
    set_variable: {
        label: 'Set a variable', group: 'On screen', icon: Braces,
        blurb: 'Put a value in one of the app’s shared variables.',
    },

    // ── Data ────────────────────────────────────────────────────────────────
    create_record: {
        label: 'Add a row', group: 'Data', icon: Database, server: true,
        blurb: 'Write a new row into one of this app’s tables.',
    },
    update_record: {
        label: 'Change a row', group: 'Data', icon: Pencil, server: true,
        blurb: 'Update an existing row.',
    },
    delete_record: {
        label: 'Delete a row', group: 'Data', icon: Trash2, server: true,
        blurb: 'Remove a row for good.',
    },
    run_automation: {
        label: 'Run a routine', group: 'Data', icon: Workflow, server: true,
        blurb: 'Hand the work to one of your routines.',
    },
    send_email: {
        label: 'Send an email', group: 'Data', icon: Mail, server: true,
        blurb: 'Send a message from the app owner’s mailbox.',
    },

    // ── AI ──────────────────────────────────────────────────────────────────
    ai_extract: {
        label: 'Read a document', group: 'AI', icon: FileSearch, server: true,
        blurb: 'Pull structured fields out of an uploaded file.',
    },
    ai_generate: {
        label: 'Write something', group: 'AI', icon: Bot, server: true,
        blurb: 'Draft or summarise text.',
    },
    kb_query: {
        label: 'Search the knowledge base', group: 'AI', icon: Search, server: true,
        blurb: 'Look something up in a knowledge base.',
    },

    // ── Flow ────────────────────────────────────────────────────────────────
    condition: {
        label: 'If…', group: 'Flow', icon: GitBranch, container: true,
        blurb: 'Take one path or the other.',
    },
    switch: {
        label: 'Depending on…', group: 'Flow', icon: Layers, container: true,
        blurb: 'Several paths, one per case.',
    },
    loop: {
        label: 'For each', group: 'Flow', icon: Repeat, container: true,
        blurb: 'Do the same thing for every row in a list.',
    },
};

/** Fallback presentation, so an unknown kind is still readable. */
export const UNKNOWN_STEP = { label: 'Step', group: 'Flow', icon: Bell, blurb: '' };

export function stepMeta(kind) {
    return STEP_CATALOG[kind] || { ...UNKNOWN_STEP, label: String(kind || 'Step').replace(/_/g, ' ') };
}

/** The palette, grouped and in a fixed order. */
export function paletteGroups() {
    return STEP_GROUPS.map((group) => ({
        group,
        kinds: Object.entries(STEP_CATALOG)
            .filter(([, meta]) => meta.group === group)
            .map(([kind, meta]) => ({ kind, ...meta })),
    })).filter((g) => g.kinds.length);
}

/**
 * A fresh step of this kind, filled in enough to be valid the moment it lands.
 * A step that arrives already failing validation makes the author fix a problem
 * they did not create.
 */
export function newStep(kind, { screenId = '', modalId = '' } = {}) {
    switch (kind) {
        case 'navigate': return { kind, screenId };
        case 'toast': return { kind, message: '', tone: 'info' };
        case 'open_url': return { kind, url: '', newTab: true };
        case 'open_modal': return { kind, modalId };
        case 'close_modal': return { kind, modalId };
        case 'confirm': return { kind, message: 'Are you sure?' };
        case 'refresh': return { kind };
        case 'set_variable': return { kind, name: '', value: { kind: 'static', value: '' } };
        case 'create_record': return { kind, tableId: '', values: {} };
        case 'update_record': return { kind, tableId: '', recordId: { kind: 'static', value: '' }, values: {} };
        case 'delete_record': return { kind, tableId: '', recordId: { kind: 'static', value: '' } };
        case 'run_automation': return { kind, automationId: null };
        // connectorId names the mailbox it sends from; there is no sensible
        // default, so it starts blank and the validator says which one to pick.
        case 'send_email': return {
            kind,
            connectorId: '',
            to: { kind: 'static', value: '' },
            subject: { kind: 'static', value: '' },
            body: { kind: 'static', value: '' },
        };
        case 'ai_extract': return { kind, source: { kind: 'static', value: '' }, schema: [{ name: 'field1', type: 'string', description: '', required: false }] };
        case 'ai_generate': return { kind, prompt: '', output: 'text', resultVar: 'result' };
        case 'kb_query': return { kind, query: { kind: 'static', value: '' }, knowledgeBaseIds: [], resultVar: 'results' };
        case 'condition': return { kind, expr: '', then: [], else: [] };
        case 'switch': return { kind, expr: '', cases: [{ name: 'first', steps: [] }], default: [] };
        case 'loop': return { kind, source: { kind: 'static', value: [] }, itemVar: 'item', steps: [] };
        default: return { kind };
    }
}
