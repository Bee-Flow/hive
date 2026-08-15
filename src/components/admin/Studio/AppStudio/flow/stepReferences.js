/**
 * The things a step POINTS AT, by name rather than by id.
 *
 * Half the fields on a step are a reference: `create_record` names a table,
 * `open_modal` names a dialog, `run_automation` names a routine, `refresh`
 * names a table or a saved view. The server types every one of them as a plain
 * `string` (componentSpecs.js STEP_SPECS) because that is what goes over the
 * wire — but a builder is not supposed to know that a table is called
 * `tbl_9f3a2c`. StepSettings already made that argument for screens ("A screen
 * reference is a pick, never a typed id"); this is the rest of them.
 *
 * Two consumers, one source of truth:
 *   • StepSettings turns each reference field into a picker,
 *   • the flow canvas uses the SAME lookup for the line under a step's name, so
 *     a node reads "Add a row · Invoices" rather than "Add a row · tbl_9f3a2c".
 *
 * Lists the editor cannot reach (no appId outside the editor shell, a plan
 * without routines) resolve to an empty array — every helper here degrades to
 * the raw id rather than to a blank, so a value is never hidden from the person
 * who has to fix it.
 */

/** Which reference a field key names. Keys are the STEP_SPECS field names. */
export const REFERENCE_FIELDS = {
    screenId: 'screen',
    modalId: 'modal',
    tableId: 'table',
    datasetId: 'dataset',
    automationId: 'automation',
    connectorId: 'connector',
};

/** The label a picker shows when the field is not set yet. */
export const REFERENCE_PLACEHOLDERS = {
    screen: 'Pick a screen…',
    modal: 'Pick a dialog…',
    table: 'Pick a table…',
    dataset: 'Pick a saved view…',
    automation: 'Pick a routine…',
    connector: 'Pick a connection…',
};

/**
 * What to say when the list is empty — the reason, and what to do about it,
 * because "no options" on its own reads as a broken screen.
 */
export const REFERENCE_EMPTY_HINTS = {
    screen: 'This app has no other screens yet.',
    modal: 'This app has no dialogs yet — add a Dialog component to a screen first.',
    table: 'This app has no tables yet — make one under Data first.',
    dataset: 'No saved views yet — save one from the query builder first.',
    automation: 'No routines yet.',
    connector: 'No connections yet — add one under Data · Connections first.',
};

/** Every `modal` node in the app, in the order the screens list them. */
export function collectModals(definition) {
    const out = [];
    const walk = (nodes) => {
        for (const n of nodes || []) {
            if (n?.type === 'modal' && typeof n.id === 'string') {
                out.push({ id: n.id, label: modalLabel(n) });
            }
            if (Array.isArray(n?.children)) walk(n.children);
        }
    };
    for (const screen of definition?.screens || []) {
        for (const section of screen.sections || []) walk(section.children);
    }
    return out;
}

/** A dialog's own title, falling back to its id so it stays identifiable. */
function modalLabel(node) {
    const title = node?.props?.title || node?.props?.heading || node?.props?.label;
    return (typeof title === 'string' && title.trim()) ? title.trim() : node.id;
}

/** Screens as { id, label } — `name` is what the author typed on the tab. */
export function screenOptions(screens) {
    return (Array.isArray(screens) ? screens : [])
        .filter((s) => s && typeof s.id === 'string')
        .map((s) => ({ id: s.id, label: s.name || s.id }));
}

/** Tables as { id, label }. The data model calls the human name `name`. */
export function tableOptions(tables) {
    return (Array.isArray(tables) ? tables : [])
        .filter((t) => t && (typeof t.id === 'string' || typeof t.key === 'string'))
        .map((t) => ({ id: t.id ?? t.key, label: t.name || t.label || t.key || t.id }));
}

/** Saved datasets as { id, label }. */
export function datasetOptions(datasets) {
    return (Array.isArray(datasets) ? datasets : [])
        .filter((d) => d && typeof d.id === 'string')
        .map((d) => ({ id: d.id, label: d.name || d.title || d.id }));
}

/** Routines as { id, label }. */
export function automationOptions(automations) {
    return (Array.isArray(automations) ? automations : [])
        .filter((a) => a && typeof a.id === 'string')
        .map((a) => ({ id: a.id, label: a.title || a.name || a.id }));
}

/** Connectors as { id, label }. */
export function connectorOptions(connectors) {
    return (Array.isArray(connectors) ? connectors : [])
        .filter((c) => c && typeof c.id === 'string')
        .map((c) => ({ id: c.id, label: c.name || c.kind || c.id }));
}

/**
 * The name behind an id, or the id itself when the list has not loaded (or the
 * thing it pointed at is gone — in which case showing the raw id is the only
 * honest answer, and the one that lets somebody repair the step).
 */
export function labelForRef(options, id) {
    if (id == null || id === '') return '';
    const hit = (Array.isArray(options) ? options : []).find((o) => o.id === id);
    return hit ? hit.label : String(id);
}

/**
 * Does this id still point at something? A step aiming at a deleted screen,
 * dialog or table is the failure the canvas should show BEFORE it is published,
 * not a toast at run time. `false` only when the list has actually loaded —
 * an empty list is "not known yet", never "broken".
 */
export function isDanglingRef(options, id) {
    if (id == null || id === '') return false;
    if (!Array.isArray(options) || options.length === 0) return false;
    return !options.some((o) => o.id === id);
}

/**
 * The columns of a table, as { key, label, type, required } — what
 * `create_record`/`update_record` write into.
 *
 * `fields` is the projection GET /:id/data/tables returns (publicTable), where
 * `key` is the column the write is addressed by and `name` is what the owner
 * called it. The recordValues map is keyed by `key`, so that is what a picker
 * must emit while showing `name`.
 */
export function columnOptions(fields) {
    return (Array.isArray(fields) ? fields : [])
        .filter((f) => f && typeof f.key === 'string')
        .map((f) => ({
            key: f.key,
            label: f.name || f.key,
            type: f.type || null,
            required: !!f.required,
        }));
}
