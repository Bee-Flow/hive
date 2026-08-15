/**
 * The one place that knows what a trigger is CALLED.
 *
 * Two different strings, deliberately kept apart:
 *   · the TYPE label ("Schedule trigger") — the muted kicker above the node
 *     name on the canvas and in the node-config header;
 *   · the NAME ("Schedule") — what lands in `step.label` when Bee Flow names
 *     the node itself, i.e. what the palette stamps on a freshly dropped
 *     trigger.
 *
 * They used to live in three unrelated places (the palette payloads, this
 * node's KIND_META, and formState's `defaultLabelPlaceholder`), which is why
 * switching a trigger's kind left the canvas node and the modal header both
 * still reading "Manual" — nothing owned the rename (BFSF-339).
 *
 * Pure data + pure functions: no React, no icons. TriggerNode keeps its own
 * icon map, because an icon is a rendering concern and importing lucide here
 * would drag it into formState and the diagram builder.
 */

/** kind → the muted type kicker. */
export const TRIGGER_TYPE_LABEL = {
    schedule:    'Schedule trigger',
    manual:      'Manual trigger',
    webhook:     'Webhook trigger',
    app_event:   'App-event trigger',
    // Exposed to agents/direct chat as a function tool (trigger.kind === 'agent_call').
    agent_call:  'Agent trigger',
    // Inline-flowlet entry point: the sub-flow's declared inputs (no real
    // "trigger" — it runs when a call_layer step invokes it).
    layer_input: 'Flowlet input',
    // Fired by a Studio App action with declared typed inputs (incl. files).
    app_trigger: 'Studio App trigger',
    // A public page Bee Flow hosts; every submission is one run.
    form:        'Form trigger',
};

/**
 * kind → the node's generated NAME. Shorter than the type label on purpose:
 * the two are shown one above the other, so "Schedule / Schedule trigger"
 * reads as a label and its type, while "Schedule trigger / Schedule trigger"
 * reads as a rendering bug.
 */
export const TRIGGER_NAME = {
    schedule:    'Schedule',
    manual:      'Manual',
    webhook:     'Webhook',
    app_event:   'App event',
    agent_call:  'Agent',
    layer_input: 'Flowlet input',
    app_trigger: 'Studio App',
    form:        'Form',
};

/**
 * Sub-label per (provider, event) so a Gmail-new-email trigger reads
 * "New email (Gmail)" instead of the generic "App-event trigger".
 */
export const APP_EVENT_TYPE_LABEL = {
    'gmail.mail.new':                  'New email (Gmail)',
    'gmail.label.added':               'Email labelled (Gmail)',
    'google-calendar.event.changed':   'Calendar event changed',
    'google-calendar.event.upcoming':  'Calendar event upcoming',
    'google-drive.file.new':           'New file (Drive)',
    'nextcloud.file.new':              'New file (Nextcloud)',
    'nextcloud.file.changed':          'File changed (Nextcloud)',
    'nextcloud.share.received':        'Share received (Nextcloud)',
    'nextcloud.activity.new':          'Nextcloud activity',
    'nextcloud.notification.new':      'Nextcloud notification',
};

const appEventKey = (step) => (
    step?.appEvent?.provider && step?.appEvent?.event
        ? `${step.appEvent.provider}.${step.appEvent.event}`
        : null
);

/** The muted type kicker for a trigger step, app-event specialisation included. */
export function triggerTypeLabel(step) {
    const kind = step?.kind || 'manual';
    if (kind === 'app_event') {
        const specific = APP_EVENT_TYPE_LABEL[appEventKey(step)];
        if (specific) return specific;
    }
    return TRIGGER_TYPE_LABEL[kind] || TRIGGER_TYPE_LABEL.manual;
}

/** The name Bee Flow gives a trigger node of this kind. */
export function defaultTriggerLabel(kind) {
    return TRIGGER_NAME[kind] || TRIGGER_NAME.manual;
}

const GENERATED_LABELS = new Set([
    ...Object.values(TRIGGER_TYPE_LABEL),
    ...Object.values(TRIGGER_NAME),
    ...Object.values(APP_EVENT_TYPE_LABEL),
    'Trigger', // formState's old placeholder, and the palette's generic fallback
]);

/**
 * True when `label` is a name Bee Flow produced rather than one a person
 * typed — the licence to rewrite it when the kind changes. Matching against
 * EVERY kind's generated names (not just the current one) is deliberate: a
 * trigger that has already been switched once carries the previous kind's
 * name, and that is exactly the case this has to catch.
 */
export function isGeneratedTriggerLabel(label) {
    const s = String(label ?? '').trim();
    return s === '' || GENERATED_LABELS.has(s);
}
