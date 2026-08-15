/**
 * One presentation record per RUNTIME STEP TYPE.
 *
 * Why this exists: a node's user-facing identity used to be written out
 * separately in five places — the palette payload (stepPalette.js), the drop
 * scaffold (DiagramPane.buildStepFromPayload), the canvas card
 * (flow/nodes/*.jsx), the node editor's header (NodeDetailView) and the
 * server's AI-builder tool (server/automation/builderTools.js). Nothing checked
 * that they agreed, and they didn't: `dedupe` was "Remove Duplicates" in the
 * palette, "Remove duplicates" on the canvas and "Dedupe" in the editor header,
 * and `guard`/`tokenize`/`untokenize` were missing from the editor's map
 * entirely, so opening a privacy node showed the raw type name — "tokenize" —
 * as its heading. The same omission in `sectionForIssue`'s taxonomy meant a
 * validation error on one of those nodes could not force its Advanced section
 * open, and at quick density that section is hidden, so the error was reported
 * and the control to fix it was unreachable.
 *
 * THE RULE: presentation only. If the runner or the validator would need to
 * read it, it does not belong here. No settings forms, no executors, no
 * validation rules, no LLM tool schemas.
 *
 * Not owned here either: the PALETTE entry (id / icon / keywords / payload).
 * That is a different axis — one palette item (Condition) maps to three runtime
 * types, two (the form pages) map to one, and triggers and flowlets map to
 * none. stepPalette.js keeps those and imports `defaultLabel` from here.
 *
 * Translation: `label`/`desc`/`typeLabel`/`help` each carry an i18n key
 * alongside their English. Read them through the accessors at the bottom so a
 * caller with no `t` (a pure helper, a test, the canvas summary) still gets
 * sensible English. The canvas SUMMARY lines stay English for now — they
 * interpolate step and field names and need a different treatment.
 */

// `null` in an issue map = a flat, always-visible field (Label, Prompt) with no
// section to open. Re-exported so sectionForIssue.js keeps its own vocabulary.
export const FLAT = null;

/**
 * Runtime types that have no canvas component and no palette entry, with the
 * reason. The completeness test allows exactly these; anything else missing
 * from DiagramPane's NODE_TYPES is a bug.
 */
export const PALETTE_ABSENT = {
    // Reached by flow/routeModel.js, which swaps the ONE "Condition" node
    // between condition / switch / filter as its editor grows from a single
    // rule to many, or starts working through a list. Deliberately not
    // separately addable — they are the same node to the user.
    switch: 'runtime shape of the Condition node (many rules)',
    filter: 'runtime shape of the Condition node (works through a list)',
    // Retired from the palette; its ability moved into Edit data. Existing
    // steps still load, render and run.
    parse_json: 'retired — absorbed by Edit data',
    // Engine + validator support these, nothing offers them yet. They have no
    // canvas component either, so a definition carrying one renders as a bare
    // React Flow default node. See WS7.
    approval: 'engine-only; no canvas component yet',
    parallel: 'engine-only; no canvas component yet',
};

/**
 * Node types the CANVAS draws that are not steps at all: they exist only in the
 * flat pseudo-graph an expanded container produces (flow/inlineFlowlets.js) and
 * are stripped again before anything is saved.
 *
 * They have a `typeLabel` and `help` — the user sees them and can hover them —
 * but no `defaultLabel` (nothing adds one), no editor sections and no
 * validation, because no validation record can ever name them. The completeness
 * test exempts exactly this list from those three requirements, so a real step
 * type still cannot slip through half-described.
 */
export const SYNTHETIC_TYPES = {
    loop_item: 'the "Each item" pill at the head of an expanded loop; never part of a definition',
    ai_tool: 'one tool chip under an AI step, drawn from its tools[] array; never a step of its own',
};

const K = 'routines.node';

/**
 * @typedef {object} NodeDef
 * @property {string}   typeLabel     what KIND of node this is (editor header)
 * @property {string}   defaultLabel  the name a freshly dropped node gets
 * @property {string}   label         how the palette invites you to pick it
 * @property {string}   desc          the one-line palette description
 * @property {string}   help          "what does this node do?", 1-2 sentences
 * @property {string[]} sectionKeys   accordion sections this type's editor renders
 * @property {string[]} [simpleSections] the subset shown in Simple mode — the
 *                      sections that make this step type WORK. Every entry must
 *                      also appear in sectionKeys. Omitted (approval, parallel,
 *                      anything new): Simple falls back to the global
 *                      ADVANCED_SECTION_KEYS rule in formDensity.js — a
 *                      documented default, not an omission. Sections holding a
 *                      validation error, or already configured (hasContent),
 *                      are shown regardless.
 * @property {object}   issueSections {fallback, map} — validation path → section
 */
export const NODE_DEFS = {
    // ── Triggers ────────────────────────────────────────────────────────────
    // The trigger's label/desc/typeLabel are per-KIND, not per-type, and live
    // in flow/triggerLabels.js; only the issue map belongs here.
    trigger: {
        typeLabel: 'Trigger', defaultLabel: 'Trigger',
        help: 'What starts this routine. Every routine has exactly one.',
        sectionKeys: ['inputs', 'config'],
        simpleSections: ['inputs', 'config'],
        issueSections: {
            fallback: 'config',
            // All the kind-specific forms — schedule builder, app-event picker,
            // webhook panel, form editor — live in the ONE 'config' section.
            // This map used to name phantom sections 'event' and 'schedule':
            // 'event' was papered over by an extra check on the section itself,
            // and 'schedule' by nothing at all, so a bad cron reported an error
            // and left the schedule builder collapsed.
            map: { label: FLAT, kind: FLAT, params: 'config', appEvent: 'config', scheduleCron: 'config', scheduleTz: 'config' },
        },
    },

    // ── AI + apps ───────────────────────────────────────────────────────────
    ai_step: {
        typeLabel: 'AI step', defaultLabel: 'AI step',
        label: 'AI step', desc: 'Reason and call tools with AI',
        help: 'Hands the run to an AI model with your instructions, and passes on what it produces.',
        sectionKeys: ['inputs', 'advanced', 'output'],
        simpleSections: ['inputs'],
        issueSections: {
            fallback: 'advanced',
            map: {
                label: FLAT, prompt: FLAT,
                systemPrompt: 'advanced', model: 'advanced', modelTier: 'advanced', allowTools: 'advanced',
                inputs: 'inputs', outputFields: 'output', forEach: 'advanced',
            },
        },
    },
    integration_action: {
        typeLabel: 'Action', defaultLabel: 'Integration',
        help: 'Does one thing in a connected app — send the email, create the file, update the row.',
        sectionKeys: ['basics', 'inputs', 'advanced'],
        simpleSections: ['basics', 'inputs'],
        issueSections: {
            fallback: 'basics',
            map: { label: FLAT, tool: 'basics', operation: 'basics', inputs: 'inputs', forEach: 'advanced' },
        },
    },

    // ── Flow control ────────────────────────────────────────────────────────
    // condition / switch / filter share ONE editor and one section layout —
    // see PALETTE_ABSENT above.
    condition: {
        typeLabel: 'Condition', defaultLabel: 'Condition',
        label: 'Condition', desc: 'Keep, split or branch — one rule or many',
        help: 'Asks a yes/no question about your data and sends the run out of the matching side.',
        sectionKeys: ['rules', 'advanced'],
        simpleSections: ['rules'],
        issueSections: {
            fallback: 'rules',
            map: { label: FLAT, expr: 'rules', cases: 'rules', arrayRef: 'advanced', maxItems: 'advanced', defaultBranch: 'advanced' },
        },
    },
    switch: {
        typeLabel: 'Condition', defaultLabel: 'Condition',
        help: 'Asks a yes/no question about your data and sends the run out of the matching side.',
        sectionKeys: ['rules', 'advanced'],
        simpleSections: ['rules'],
        issueSections: {
            fallback: 'rules',
            // arrayRef/maxItems used to map to a section called 'source' that
            // RouteFields never rendered, so the error opened the Rules section
            // while the Source-list control sat in a still-collapsed Advanced.
            // `matchMode` (BFSF-356 fan-out) lives in Advanced with them: an
            // invalid value must force open the section that holds its control,
            // not the Rules list where it cannot be corrected.
            map: { label: FLAT, expr: 'rules', cases: 'rules', arrayRef: 'advanced', maxItems: 'advanced', defaultBranch: 'advanced', matchMode: 'advanced' },
        },
    },
    filter: {
        typeLabel: 'Condition', defaultLabel: 'Condition',
        help: 'Asks a yes/no question about your data and sends the run out of the matching side.',
        sectionKeys: ['rules', 'advanced'],
        simpleSections: ['rules'],
        issueSections: {
            fallback: 'rules',
            map: { label: FLAT, expr: 'rules', arrayRef: 'advanced', maxItems: 'advanced' },
        },
    },
    loop: {
        typeLabel: 'Repeat', defaultLabel: 'Repeat for each',
        label: 'Repeat for each', desc: 'Run the steps inside once for every item in a list',
        help: 'Takes a list and runs the steps inside it once per item. Each item is available to those steps as loop.item.',
        sectionKeys: ['loop', 'body'],
        simpleSections: ['loop', 'body'],
        issueSections: {
            fallback: 'loop',
            map: { label: FLAT, overRef: 'loop', itemVar: 'loop', maxIterations: 'loop', batchSize: 'loop', body: 'body' },
        },
    },
    wait: {
        typeLabel: 'Wait', defaultLabel: 'Wait',
        label: 'Wait', desc: 'Pause before the next step — seconds, minutes or hours',
        help: 'Holds the run here for a set time, then carries on. Up to 24 hours.',
        sectionKeys: ['config'],
        simpleSections: ['config'],
        issueSections: { fallback: 'config', map: { label: FLAT, seconds: 'config' } },
    },
    stop_error: {
        typeLabel: 'Stop', defaultLabel: 'Stop with an error',
        label: 'Stop with an error', desc: 'End the run now and record why',
        help: 'Ends the run immediately and records your message as the reason. Nothing after this node ever runs.',
        sectionKeys: ['config'],
        simpleSections: ['config'],
        issueSections: { fallback: 'config', map: { label: FLAT, message: 'config' } },
    },
    notification: {
        typeLabel: 'Notification', defaultLabel: 'Notification',
        label: 'Notification', desc: 'Send a message or alert',
        help: 'Sends a message to you or your team while the run is going — by in-app notification or email.',
        sectionKeys: ['message', 'advanced'],
        simpleSections: ['message'],
        issueSections: {
            fallback: 'message',
            map: { label: FLAT, title: 'message', body: 'message', inputs: 'message', channels: 'message', forEach: 'advanced' },
        },
    },
    form_page: {
        typeLabel: 'Form page', defaultLabel: 'Ask for more info',
        help: 'Pauses the run and shows another page on the routine’s own form link, then continues with the answers.',
        sectionKeys: ['config', 'waiting'],
        simpleSections: ['config', 'waiting'],
        issueSections: {
            fallback: 'config',
            map: { label: FLAT, mode: 'config', form: 'config', waitSeconds: 'waiting' },
        },
    },

    // ── Privacy ─────────────────────────────────────────────────────────────
    // These three were missing from the editor-header and issue-section maps
    // entirely, which is what this file exists to make impossible.
    guard: {
        typeLabel: 'Personal data check', defaultLabel: 'Find personal data',
        label: 'Find personal data', desc: 'Scan a value and branch on whether it holds personal data',
        help: 'Looks through a value for names, addresses, ID numbers and the like, then sends the run out of the "personal data" or "clean" side.',
        sectionKeys: ['config', 'advanced'],
        simpleSections: ['config'],
        issueSections: {
            fallback: 'config',
            map: { label: FLAT, sourceRef: 'config', onFound: 'config', categories: 'advanced', confidence: 'advanced', forEach: 'advanced' },
        },
    },
    tokenize: {
        typeLabel: 'Hide personal data', defaultLabel: 'Hide personal data',
        label: 'Hide personal data', desc: 'Swap personal data for placeholders; the real values come back on their own',
        help: 'Replaces personal data with placeholders before the value travels on — to an AI model, say. The real values are put back automatically wherever the run uses them again.',
        sectionKeys: ['config', 'advanced'],
        simpleSections: ['config'],
        issueSections: {
            fallback: 'config',
            map: { label: FLAT, sourceRef: 'config', categories: 'advanced', confidence: 'advanced', forEach: 'advanced' },
        },
    },
    untokenize: {
        typeLabel: 'Show real values', defaultLabel: 'Show real values again',
        label: 'Show real values again', desc: 'Put the real values back where a step still holds placeholders',
        help: 'Puts the real values back in place of any placeholders left in a value. Only needed where they did not already come back on their own.',
        sectionKeys: ['config'],
        simpleSections: ['config'],
        issueSections: { fallback: 'config', map: { label: FLAT, sourceRef: 'config' } },
    },

    // ── Data ────────────────────────────────────────────────────────────────
    set: {
        typeLabel: 'Edit data', defaultLabel: 'Edit data',
        // "organise", not "organize" — the product spells it anonymise /
        // organisation everywhere else.
        label: 'Edit data', desc: 'Add, rename and organise fields — for one record or a whole table',
        help: 'Builds the exact set of fields the next step needs — adding, renaming and reorganising what came before.',
        sectionKeys: ['fields', 'table', 'advanced'],
        simpleSections: ['fields', 'table'],
        issueSections: {
            fallback: 'fields',
            map: { label: FLAT, fields: 'fields', inputs: 'fields', forEach: 'advanced', arrayRef: 'advanced', maxItems: 'advanced', operations: 'table' },
        },
    },
    datetime: {
        typeLabel: 'Date & time', defaultLabel: 'Date & time',
        label: 'Date & time', desc: 'Get today’s date, reformat one, add days, or compare two',
        help: 'Works with dates and times: today’s date, reading one out of text, reformatting it, shifting it, or measuring the gap between two.',
        sectionKeys: ['config'],
        simpleSections: ['config'],
        issueSections: {
            fallback: 'config',
            map: { label: FLAT, op: 'config', input: 'config', input2: 'config', amount: 'config', format: 'config', part: 'config', unit: 'config' },
        },
    },
    http_request: {
        typeLabel: 'Web service call', defaultLabel: 'Call a web service',
        label: 'Call a web service', desc: 'Send a request to a system that has no ready-made action here',
        help: 'Sends a request straight to another system’s web address and passes on what it sends back. For systems with no ready-made action in the Action list.',
        sectionKeys: ['request', 'auth', 'headers', 'body', 'options'],
        simpleSections: ['request', 'auth', 'body'],
        issueSections: {
            fallback: 'request',
            map: { label: FLAT, url: 'request', method: 'request', headers: 'headers', body: 'body', timeoutMs: 'options', blockPrivateTargets: 'options', auth: 'auth' },
        },
    },
    parse_json: {
        typeLabel: 'Parse JSON', defaultLabel: 'Parse JSON',
        help: 'Pulls named fields out of a block of JSON text. Retired — Edit data does this now.',
        sectionKeys: ['source', 'fields', 'options'],
        simpleSections: ['source', 'fields'],
        issueSections: {
            fallback: 'fields',
            map: { label: FLAT, sourceRef: 'source', itemsRef: 'source', mode: 'fields', fields: 'fields' },
        },
    },
    code: {
        typeLabel: 'Code', defaultLabel: 'Code',
        label: 'Code', desc: 'Run custom JavaScript',
        help: 'Runs a snippet of JavaScript in a sandbox and passes on whatever it returns.',
        sectionKeys: ['code', 'advanced'],
        simpleSections: ['code'],
        issueSections: {
            fallback: 'code',
            map: { label: FLAT, code: 'code', language: 'code', forEach: 'advanced' },
        },
    },

    // ── Lists ───────────────────────────────────────────────────────────────
    limit: {
        typeLabel: 'Shorten list', defaultLabel: 'Shorten list',
        label: 'Shorten list', desc: 'Keep only the first — or last — few items',
        help: 'Cuts a list down to the first or last few items and passes the shorter list on.',
        sectionKeys: ['config'],
        simpleSections: ['config'],
        issueSections: {
            fallback: 'config',
            map: { label: FLAT, arrayRef: 'config', count: 'config', mode: 'config', maxItems: 'config' },
        },
    },
    dedupe: {
        typeLabel: 'Remove duplicates', defaultLabel: 'Remove duplicates',
        label: 'Remove duplicates', desc: 'Keep one of each — matching the whole item, or one field',
        help: 'Keeps one of each item and drops the repeats. Match on one field, or on the whole item.',
        sectionKeys: ['config'],
        simpleSections: ['config'],
        issueSections: {
            fallback: 'config',
            map: { label: FLAT, arrayRef: 'config', field: 'config', keyField: 'config', maxItems: 'config' },
        },
    },
    aggregate: {
        typeLabel: 'Collect one field', defaultLabel: 'Collect one field',
        label: 'Collect one field', desc: 'Take the same field from every item — every email address, say',
        help: 'Reads one field from every item in a list and hands back a plain list of just those values.',
        sectionKeys: ['config'],
        simpleSections: ['config'],
        issueSections: {
            fallback: 'config',
            map: { label: FLAT, arrayRef: 'config', field: 'config', maxItems: 'config' },
        },
    },
    summarize: {
        typeLabel: 'Add up or count', defaultLabel: 'Add up or count',
        label: 'Add up or count', desc: 'Total, count, average, lowest or highest — across one field',
        help: 'Turns a list into a single number: the total, the count, the average, or the lowest or highest value of one field.',
        sectionKeys: ['config'],
        simpleSections: ['config'],
        issueSections: {
            fallback: 'config',
            map: { label: FLAT, arrayRef: 'config', field: 'config', op: 'config', maxItems: 'config' },
        },
    },

    // ── Flowlets and reusable Steps ─────────────────────────────────────────
    call_layer: {
        typeLabel: 'Flowlet', defaultLabel: 'Flowlet',
        help: 'Runs a group of steps you built once and can reuse, then carries on with what it returns.',
        sectionKeys: ['flowlet', 'inputs', 'returns'],
        simpleSections: ['flowlet', 'inputs', 'returns'],
        issueSections: {
            fallback: 'inputs',
            map: { label: FLAT, layerKey: 'flowlet', layerId: 'flowlet', inputs: 'inputs' },
        },
    },
    call_block: {
        typeLabel: 'Step', defaultLabel: 'Step',
        help: 'Runs a reusable Step from your library, then carries on with what it returns.',
        // Had no issue map at all, so a bad input binding opened nothing.
        sectionKeys: ['step', 'inputs', 'returns'],
        simpleSections: ['step', 'inputs', 'returns'],
        issueSections: {
            fallback: 'inputs',
            map: { label: FLAT, blockId: 'step', inputs: 'inputs' },
        },
    },
    layer_output: {
        typeLabel: 'Return', defaultLabel: 'Return',
        label: 'Flowlet output', desc: 'Return data from this flowlet to its caller',
        help: 'Ends a flowlet and hands the fields you name back to whatever called it.',
        sectionKeys: ['fields'],
        simpleSections: ['fields'],
        issueSections: { fallback: 'fields', map: { label: FLAT, fields: 'fields' } },
    },

    // ── Engine-only (no canvas component yet — see PALETTE_ABSENT) ──────────
    approval: {
        typeLabel: 'Approval', defaultLabel: 'Approval',
        help: 'Pauses the run until a person approves or rejects it.',
        sectionKeys: ['config'],
        issueSections: { fallback: 'config', map: { label: FLAT, prompt: 'config' } },
    },
    parallel: {
        typeLabel: 'Parallel', defaultLabel: 'Parallel',
        help: 'Runs several branches at the same time and continues once they have all finished.',
        sectionKeys: ['config'],
        issueSections: { fallback: 'config', map: { label: FLAT, branches: 'config' } },
    },

    // ── Canvas-only (see SYNTHETIC_TYPES) ───────────────────────────────────
    loop_item: {
        typeLabel: 'Each item',
        help: 'Where every step inside the loop starts. One item of the list at a time, available to those steps as loop.item.',
    },
    ai_tool: {
        typeLabel: 'Tool',
        help: 'Something the AI step above is allowed to use on its own — it decides whether to, and with what.',
    },
};

/** Every runtime step type this app knows how to present. */
export const NODE_TYPE_KEYS = Object.keys(NODE_DEFS);

// ── Accessors ───────────────────────────────────────────────────────────────
// Each takes an optional `t`. Without one they answer in English, so pure
// helpers, tests and the canvas keep working outside a React tree.

const read = (type, field, t) => {
    const def = NODE_DEFS[type];
    if (!def) return '';
    const english = def[field];
    if (!english) return '';
    return t ? t(`${K}.${type}.${field}`, english) : english;
};

/** What KIND of node this is — the node editor's heading. */
export function nodeTypeLabel(type, t = null) {
    return read(type, 'typeLabel', t);
}

/** The name a freshly dropped node of this type gets. */
export function nodeDefaultLabel(type, t = null) {
    return read(type, 'defaultLabel', t);
}

/** One or two plain sentences: what does this node do? */
export function nodeHelp(type, t = null) {
    return read(type, 'help', t);
}

/** The palette's invitation to pick this node (absent for types you can't add). */
export function nodeLabel(type, t = null) {
    return read(type, 'label', t);
}

/** The palette's one-line description. */
export function nodeDesc(type, t = null) {
    return read(type, 'desc', t);
}
