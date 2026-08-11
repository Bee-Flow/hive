/**
 * Fixtures for the App Studio demo.
 *
 * The demo opens the real editor (AppEditorShell + BuilderChatPane) on a
 * finished app: a policy-renewal pipeline for Van Dael Assurantiën — the
 * same fictional Dutch insurance intermediary the privacy-shield and
 * compliance demos use. Three tables, seeded rows, a kanban wired to them:
 * the point of App Studio is apps over their OWN data model, so the demo
 * app must be data-backed, not a static page.
 *
 * Honest split: the editor, canvas, autosave, publish flow, version
 * history and the kanban's update_record round trip are real and run
 * against this in-memory state. The AI-builder pane shows the (invented)
 * conversation that "built" the app, and answers a typed message with a
 * deterministic script that says so — no model is called, nothing leaves
 * the browser.
 *
 * Everything here is invented. Zero-network rules for the definition:
 * no `design` key (a design.font of inter/geist/plex would inject a
 * Google-Fonts <link> the transport cannot see), no external image src,
 * no logoUrl.
 */

import { COMMON_ROUTES, daysAgo, minutesAgo } from './common';
import { DEMO_CATALOG } from './appStudioCatalog';

const APP_ID = 'app_demo_pipeline';

const THEME = { primary: '#0369A1', radius: 'md', density: 'comfortable', fontScale: 'md', appearance: 'auto' };

// ---------------------------------------------------------------------------
// The app definition — adapted from the product's own app-crm-pipeline
// template (server/appStudio/templates.js), reflavoured to policy renewals.
// Ids satisfy the product's ID_RE (^(scr|sec|cmp|act)_[a-z0-9]{4,12}$).
// ---------------------------------------------------------------------------

const STAGES = [
    { value: 'lead', label: 'Expiring soon', color: 'neutral' },
    { value: 'qualified', label: 'Contacted', color: 'info' },
    { value: 'proposal', label: 'Proposal sent', color: 'primary' },
    { value: 'won', label: 'Renewed', color: 'success' },
    { value: 'lost', label: 'Not renewed', color: 'danger' },
];

// The canvas heading doubles as the demo's expectText. It must come from
// the DEFINITION, not from the app row: the editor header shows the row's
// name before the definition has parsed, and a pin on that would pass while
// the canvas was still empty.
const CANVAS_HEADING = 'Policy renewals this quarter';

function pipelineDefinition() {
    return {
        schemaVersion: 2,
        meta: { name: 'Renewal pipeline', description: 'Track policy renewals from first contact to signature.', icon: 'Kanban' },
        theme: { ...THEME },
        homeScreenId: 'scr_crmpipe',
        roles: [],
        screens: [
            {
                id: 'scr_crmpipe', name: 'Pipeline', icon: 'Kanban', showInNav: true, maxWidth: 'wide',
                sections: [
                    {
                        id: 'sec_crmhead', style: { padding: 4, gap: 2, background: 'none' },
                        children: [
                            { id: 'cmp_crmh1', type: 'heading', props: { text: CANVAS_HEADING, level: 1 }, style: { span: 12 } },
                            {
                                id: 'cmp_crmfil', type: 'filter_bar',
                                props: { fields: [{ name: 'q', label: 'Search renewals', type: 'search' }] },
                                style: { span: 12 },
                            },
                        ],
                    },
                    {
                        id: 'sec_crmboard', style: { padding: 4, gap: 3, background: 'none' },
                        children: [
                            {
                                id: 'cmp_crmkan', type: 'kanban',
                                props: {
                                    source: { kind: 'records', tableId: 'tbl_crmdl', filter: [{ field: 'title', op: 'contains', value: { kind: 'formula', expr: 'vars.filters.q' } }] },
                                    groupByField: 'stage',
                                    columns: STAGES,
                                    titleKey: 'title',
                                    subtitleKey: 'stage',
                                },
                                style: { span: 12 },
                                onRowClick: 'act_crmopen',
                                onCardMove: 'act_crmmove',
                            },
                        ],
                    },
                ],
            },
            {
                id: 'scr_crmdeal', name: 'Renewal', icon: 'Handshake', showInNav: false, maxWidth: 'medium',
                sections: [
                    {
                        id: 'sec_crmdetail', style: { padding: 4, gap: 3, background: 'none' },
                        children: [
                            { id: 'cmp_crmback', type: 'button', props: { label: 'Back to the board', variant: 'ghost', iconLeft: 'ArrowLeft' }, style: { span: 4 }, onClick: 'act_crmback' },
                            {
                                id: 'cmp_crmrd', type: 'record_detail',
                                props: {
                                    source: { kind: 'record', tableId: 'tbl_crmdl', filter: [{ field: 'id', op: 'eq', value: { kind: 'formula', expr: 'screen.params.id' } }] },
                                    fields: [
                                        { key: 'title', label: 'Renewal', format: 'text' },
                                        { key: 'stage', label: 'Stage', format: 'badge' },
                                        { key: 'amount', label: 'Yearly premium', format: 'number' },
                                    ],
                                    columns: 2,
                                },
                                style: { span: 12 },
                            },
                        ],
                    },
                ],
            },
        ],
        actions: {
            act_crmopen: { kind: 'navigate', screenId: 'scr_crmdeal', params: { id: { kind: 'formula', expr: 'item.id' } } },
            act_crmback: { kind: 'navigate', screenId: 'scr_crmpipe' },
            act_crmmove: {
                kind: 'sequence',
                steps: [
                    { kind: 'update_record', tableId: 'tbl_crmdl', recordId: { kind: 'formula', expr: 'item.id' }, values: { stage: { kind: 'formula', expr: 'value' } } },
                    { kind: 'toast', message: 'Renewal moved.', tone: 'success' },
                    // The runner does NOT refetch after a mutating step — refresh
                    // is an explicit client step. Without it the dragged card
                    // would snap back while the fixture record had moved.
                    { kind: 'refresh' },
                ],
            },
        },
    };
}

// The restorable older snapshot: the same app before the search bar and the
// detail screen existed. Restoring visibly changes the canvas.
function pipelineDefinitionV1() {
    const def = pipelineDefinition();
    def.screens = [def.screens[0]];
    def.screens[0].sections[0].children = def.screens[0].sections[0].children.filter(c => c.id !== 'cmp_crmfil');
    delete def.screens[0].sections[1].children[0].onRowClick;
    def.actions = { act_crmmove: def.actions.act_crmmove };
    return def;
}

const staticDefinition = (name, heading, body) => ({
    schemaVersion: 2,
    meta: { name, description: body, icon: 'LayoutDashboard' },
    theme: { ...THEME },
    homeScreenId: 'scr_stahome',
    roles: [],
    screens: [{
        id: 'scr_stahome', name: 'Home', icon: 'Home', showInNav: true, maxWidth: 'medium',
        sections: [{
            id: 'sec_stamain', style: { padding: 4, gap: 2, background: 'none' },
            children: [
                { id: 'cmp_stah1', type: 'heading', props: { text: heading, level: 1 }, style: { span: 12 } },
                { id: 'cmp_statx', type: 'text', props: { text: body, muted: true }, style: { span: 12 } },
            ],
        }],
    }],
    actions: {},
});

// ---------------------------------------------------------------------------
// Data — three tables, rows the screens actually read. Counts and totals in
// the demo derive from these arrays; nothing is typed twice.
// ---------------------------------------------------------------------------

const MODEL = () => ({
    modelVersion: 3,
    tables: [
        {
            id: 'tbl_crmco', key: 'clients', name: 'Clients', icon: 'Building2',
            fields: [
                { id: 'fld_crmconame', key: 'name', name: 'Name', type: 'text', required: true },
                { id: 'fld_crmcoind', key: 'industry', name: 'Industry', type: 'text' },
                { id: 'fld_crmcocity', key: 'city', name: 'City', type: 'text' },
            ],
            access: { default: 'app' },
        },
        {
            id: 'tbl_crmct', key: 'contacts', name: 'Contacts', icon: 'User',
            fields: [
                { id: 'fld_crmctname', key: 'name', name: 'Name', type: 'text', required: true },
                { id: 'fld_crmctmail', key: 'email', name: 'Email', type: 'text' },
                { id: 'fld_crmctco', key: 'client', name: 'Client', type: 'relation', relation: { table: 'tbl_crmco' } },
            ],
            access: { default: 'app' },
        },
        {
            id: 'tbl_crmdl', key: 'renewals', name: 'Renewals', icon: 'Handshake',
            fields: [
                { id: 'fld_crmdltitle', key: 'title', name: 'Title', type: 'text', required: true },
                { id: 'fld_crmdlstage', key: 'stage', name: 'Stage', type: 'select', options: STAGES.map(({ value, label }) => ({ value, label })) },
                { id: 'fld_crmdlamt', key: 'amount', name: 'Yearly premium', type: 'number', subtype: 'integer' },
                { id: 'fld_crmdlco', key: 'client', name: 'Client', type: 'relation', relation: { table: 'tbl_crmco' } },
            ],
            access: { default: 'app' },
        },
    ],
    roles: [],
    roleMapping: { default: 'app', byGroup: {} },
});

const CLIENTS = () => ([
    { id: 'rec_co01', name: 'Bakkerij Vermeulen', industry: 'Food retail', city: 'Utrecht' },
    { id: 'rec_co02', name: 'Transportbedrijf De Ruiter', industry: 'Logistics', city: 'Zwolle' },
    { id: 'rec_co03', name: 'Hoveniersbedrijf Groenendijk', industry: 'Landscaping', city: 'Amersfoort' },
    { id: 'rec_co04', name: 'Architectenbureau Smeets', industry: 'Architecture', city: 'Arnhem' },
]);

const CONTACTS = () => ([
    { id: 'rec_ct01', name: 'Willem Vermeulen', email: 'w.vermeulen@bakkerijvermeulen.example', client: 'rec_co01' },
    { id: 'rec_ct02', name: 'Sandra de Ruiter', email: 's.deruiter@deruitertransport.example', client: 'rec_co02' },
    { id: 'rec_ct03', name: 'Peter Groenendijk', email: 'p.groenendijk@groenendijk.example', client: 'rec_co03' },
    { id: 'rec_ct04', name: 'Ilse Smeets', email: 'i.smeets@smeetsarchitecten.example', client: 'rec_co04' },
]);

const RENEWALS = () => ([
    { id: 'rec_dl01', title: 'Bedrijfsaansprakelijkheid — Vermeulen', stage: 'lead', amount: 1850, client: 'rec_co01' },
    { id: 'rec_dl02', title: 'Wagenparkpolis — De Ruiter', stage: 'qualified', amount: 12400, client: 'rec_co02' },
    { id: 'rec_dl03', title: 'Opstal en inventaris — Vermeulen', stage: 'proposal', amount: 3200, client: 'rec_co01' },
    { id: 'rec_dl04', title: 'Werkmaterieel — Groenendijk', stage: 'proposal', amount: 5600, client: 'rec_co03' },
    { id: 'rec_dl05', title: 'Beroepsaansprakelijkheid — Smeets', stage: 'qualified', amount: 4100, client: 'rec_co04' },
    { id: 'rec_dl06', title: 'Cyberverzekering — Smeets', stage: 'lead', amount: 2300, client: 'rec_co04' },
    { id: 'rec_dl07', title: 'Verzuimverzekering — De Ruiter', stage: 'won', amount: 18700, client: 'rec_co02' },
    { id: 'rec_dl08', title: 'Gebouwenverzekering — Groenendijk', stage: 'won', amount: 2950, client: 'rec_co03' },
    { id: 'rec_dl09', title: 'Milieuschade — Groenendijk', stage: 'lost', amount: 1400, client: 'rec_co03' },
]);

// ---------------------------------------------------------------------------
// The AI-builder session that "built" the app. Message shapes are exactly the
// hook's own (useAppBuilderStream restores them verbatim): user/assistant
// items and { kind: 'tool' } chips.
// ---------------------------------------------------------------------------

const BUILDER_SNAPSHOT = () => ({
    sessionId: 'bsess_demo_pipeline',
    messages: [
        {
            role: 'user',
            content: 'Build a renewal pipeline for our office: clients, contacts and policy renewals with a yearly premium. I want a board grouped by stage that the team can drag, and a detail page per renewal.',
        },
        { kind: 'tool', name: 'app_upsert_table', label: 'Created table', ok: true, summary: 'Clients — name, industry, city' },
        { kind: 'tool', name: 'app_upsert_table', label: 'Created table', ok: true, summary: 'Contacts — name, email, linked to Clients' },
        { kind: 'tool', name: 'app_upsert_table', label: 'Created table', ok: true, summary: 'Renewals — title, stage, yearly premium, linked to Clients' },
        { kind: 'tool', name: 'app_seed_records', label: 'Seeded sample rows', ok: true, summary: '4 clients, 4 contacts, 9 renewals' },
        { kind: 'tool', name: 'app_add_components', label: 'Built the board', ok: true, summary: 'Kanban over Renewals, grouped by stage, with a search filter' },
        { kind: 'tool', name: 'app_add_screen', label: 'Added a screen', ok: true, summary: 'Renewal detail, reached by clicking a card' },
        { kind: 'tool', name: 'app_set_action', label: 'Wired the drag', ok: true, summary: 'Dropping a card updates the record and refreshes the board' },
        { kind: 'tool', name: 'app_finalize', label: 'Validated the app', ok: true, summary: 'Dry run passed — 2 screens, 3 actions, no errors' },
        {
            role: 'assistant',
            isStreaming: false,
            thinkingParts: [],
            content: 'Done. The board groups renewals by stage; dragging a card writes the new stage to the record and refreshes the board. Clicking a card opens the detail screen. Say the word and I will add a chart of premiums per stage, or a "my renewals" view per account manager.',
        },
    ],
});

const sse = (event, data) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

// Deterministic string work, not a model — and the reply says so. Mirrors the
// agents demo's refine handler: the interaction must DO something, and be
// honest about what it is.
function scriptedReply(message) {
    const echo = String(message || '').trim().slice(0, 120);
    return [
        echo ? `You asked: "${echo}${String(message || '').trim().length > 120 ? '…' : ''}"` : 'You sent an empty message.',
        '',
        'In the product this is where the AI builder plans and applies the change — new tables, screens or actions, validated and dry-run before anything lands. The demo has no network access, so this reply is a script, not a model, and your canvas stays exactly as you left it.',
        '',
        'Things in the demo that DO work: drag a card on the board in Preview, click one to open its detail screen, open the version history in the header, or rename the app.',
    ].join('\n');
}

// ---------------------------------------------------------------------------
// State + helpers
// ---------------------------------------------------------------------------

const appRow = ({ id, name, description, icon, accentColor, definition, createdDays, updatedMinutes, publishedVersion, isPublished }) => ({
    id,
    userId: 'demo-user',
    organizationId: 'demo-org',
    name,
    description,
    icon,
    accentColor,
    definition,
    publishedDefinition: isPublished ? definition : null,
    definitionVersion: 7,
    publishedVersion: publishedVersion ?? null,
    isPublished: !!isPublished,
    sharedGroups: [],
    publishedAt: isPublished ? daysAgo(6) : null,
    createdAt: daysAgo(createdDays),
    updatedAt: minutesAgo(updatedMinutes),
});

export function createState() {
    return {
        apps: {
            [APP_ID]: appRow({
                id: APP_ID, name: 'Renewal pipeline',
                description: 'Policy renewals from first contact to signature.',
                icon: 'Kanban', accentColor: '#0369A1',
                definition: pipelineDefinition(),
                createdDays: 34, updatedMinutes: 20,
                isPublished: true, publishedVersion: 6,
            }),
            app_demo_onboard: appRow({
                id: 'app_demo_onboard', name: 'Onboarding checklist',
                description: 'Everything a new colleague needs in week one.',
                icon: 'ClipboardList', accentColor: '#B45309',
                definition: staticDefinition('Onboarding checklist', 'Welcome aboard', 'Your first-week checklist, owned by HR.'),
                createdDays: 90, updatedMinutes: 60 * 24 * 12,
                isPublished: true, publishedVersion: 3,
            }),
            app_demo_rooms: appRow({
                id: 'app_demo_rooms', name: 'Meeting room planner',
                description: 'Who has which room, and when.',
                icon: 'CalendarDays', accentColor: '#0F766E',
                definition: staticDefinition('Meeting room planner', 'Rooms today', 'Book a room without the reply-all thread.'),
                createdDays: 150, updatedMinutes: 60 * 24 * 40,
                isPublished: false,
            }),
        },
        records: { tbl_crmco: CLIENTS(), tbl_crmct: CONTACTS(), tbl_crmdl: RENEWALS() },
        model: MODEL(),
        datasets: [{
            id: 'ds_demo_stage', name: 'Renewals by stage', tableId: 'tbl_crmdl',
            source: { kind: 'table', tableId: 'tbl_crmdl' },
            descriptor: { groupBy: [{ field: 'stage' }], aggregates: [{ fn: 'count' }] },
        }],
        // The history modal renders `entry.label` (EditorHeader falls back to
        // "Version <id>", which reads as debug output); `summary` matches the
        // server's mapVersionMetaRow and is carried for shape fidelity.
        versions: [
            { id: 'ver_demo_06', version: 6, appId: APP_ID, label: 'Wired the drag to update the record', summary: 'Wired the drag to update the record', createdAt: daysAgo(6) },
            { id: 'ver_demo_05', version: 5, appId: APP_ID, label: 'Added the renewal detail screen', summary: 'Added the renewal detail screen', createdAt: daysAgo(8) },
            { id: 'ver_demo_04', version: 4, appId: APP_ID, label: 'Added the search filter', summary: 'Added the search filter', createdAt: daysAgo(9) },
            { id: 'ver_demo_03', version: 3, appId: APP_ID, label: 'AI: built the pipeline board', summary: 'AI: built the pipeline board', createdAt: daysAgo(12) },
            { id: 'ver_demo_02', version: 2, appId: APP_ID, label: 'AI: seeded sample rows', summary: 'AI: seeded sample rows', createdAt: daysAgo(12) },
            { id: 'ver_demo_01', version: 1, appId: APP_ID, label: 'AI: created the data model', summary: 'AI: created the data model', createdAt: daysAgo(12) },
        ],
        versionDefinitions: { ver_demo_03: pipelineDefinitionV1() },
        builderSnapshot: BUILDER_SNAPSHOT(),
    };
}

const metaRow = ({ definition: _def, publishedDefinition: _pub, ...rest }) => rest;

// Storage usage derives from the row counts — the two never disagree.
const usageFor = (state) => {
    const rows = Object.values(state.records).reduce((s, arr) => s + arr.length, 0);
    const dbBytes = rows * 4096;
    return { dbBytes, dbRatio: dbBytes / (256 * 1024 * 1024) };
};

const json = (body, status) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const notFound = () => json({ error: 'Not found' }, 404);

const findApp = (state, id) => state.apps[id] || null;

// The records route receives LITERAL filters — the client resolves formulas
// before building the query string. Only the two ops the fixture app uses.
function applyFilter(rows, filterJson) {
    let filters = null;
    try { filters = filterJson ? JSON.parse(filterJson) : null; } catch { filters = null; }
    if (!Array.isArray(filters)) return rows;
    return rows.filter((row) => filters.every(({ field, op, value }) => {
        if (value == null || value === '') return true;
        if (op === 'eq') return String(row[field]) === String(value);
        if (op === 'contains') return String(row[field] ?? '').toLowerCase().includes(String(value).toLowerCase());
        return true;
    }));
}

// Narrow on purpose: resolves exactly the two formula shapes the fixture
// app's actions use ('item.id' and 'value') — this is not a formula engine.
function resolveActionFormula(spec, formValues) {
    if (!spec || typeof spec !== 'object') return spec;
    if (spec.kind !== 'formula') return spec.kind === 'static' ? spec.value : spec;
    if (spec.expr === 'item.id') return formValues?.item?.id;
    if (spec.expr === 'value') return formValues?.value;
    return undefined;
}

export const ROUTES = {
    ...COMMON_ROUTES,

    // Literal paths BEFORE parameterised ones — first match wins.
    'GET /api/studio-apps/catalog': () => DEMO_CATALOG,
    'GET /api/studio-apps/templates': () => ({
        templates: [
            { id: 'app-crm-pipeline', title: 'CRM pipeline', description: 'A sales pipeline over your own data: drag deals across stages on a kanban, filter by name, and drill into a deal.', category: 'Data', icon: 'Kanban', tags: ['crm', 'sales', 'pipeline', 'kanban'] },
            { id: 'app-team-hub', title: 'Team hub', description: 'A small internal site: welcome page, useful links, and a contact form.', category: 'Content', icon: 'Users', tags: ['intranet', 'content', 'links'] },
        ],
    }),
    'GET /api/studio-apps/mine': ({ state }) => ({
        apps: Object.values(state.apps).map(a => ({ ...metaRow(a), usage: usageFor(state) })),
    }),
    'GET /api/studio-apps/builder/session/:appId': ({ state, params }) => (
        params.appId === APP_ID ? { snapshot: state.builderSnapshot } : notFound()
    ),
    'POST /api/studio-apps/builder/stream': ({ body }) => new Response(
        [
            sse('builder_session', { sessionId: 'bsess_demo_pipeline' }),
            sse('thinking_start', {}),
            sse('thinking', { delta: 'Demo mode: composing a scripted answer — no model, no network.' }),
            sse('thinking_stop', {}),
            sse('message', { content: scriptedReply(body?.message) }),
            // `done` is mandatory: a stream that ends without it is treated as
            // a dropped connection and fails the turn. Never emit `draft`
            // (it would overwrite the visitor's canvas) and never `error`.
            sse('done', { appId: APP_ID, finalized: false, awaitingPlan: false }),
        ].join(''),
        { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
    ),

    'GET /api/studio-apps': ({ state }) => ({ apps: Object.values(state.apps).map(metaRow) }),
    'POST /api/studio-apps': ({ state, body }) => {
        const id = `app_demo_new${Object.keys(state.apps).length + 1}`;
        const fromPipeline = body?.templateId === 'app-crm-pipeline';
        const created = appRow({
            id,
            name: body?.name || (fromPipeline ? 'CRM pipeline' : 'Untitled app'),
            description: body?.description || '',
            icon: body?.icon || (fromPipeline ? 'Kanban' : 'LayoutDashboard'),
            accentColor: body?.accentColor || '#0369A1',
            definition: fromPipeline
                ? pipelineDefinition()
                : staticDefinition(body?.name || 'Untitled app', body?.name || 'Untitled app', 'Start from a blank canvas.'),
            createdDays: 0, updatedMinutes: 0,
            isPublished: false,
        });
        created.definitionVersion = 1;
        state.apps[id] = created;
        return { success: true, app: created };
    },

    'GET /api/studio-apps/:id': ({ state, params }) => {
        const app = findApp(state, params.id);
        return app ? { app, readOnly: false } : notFound();
    },
    'PUT /api/studio-apps/:id': ({ state, params, body }) => {
        const app = findApp(state, params.id);
        if (!app) return notFound();
        for (const k of ['name', 'description', 'icon', 'accentColor']) {
            if (typeof body?.[k] === 'string') app[k] = body[k];
        }
        app.updatedAt = new Date().toISOString();
        return { success: true, app: metaRow(app) };
    },
    'DELETE /api/studio-apps/:id': ({ state, params }) => {
        delete state.apps[params.id];
        return { success: true };
    },
    'PUT /api/studio-apps/:id/definition': ({ state, params, body }) => {
        const app = findApp(state, params.id);
        if (!app) return notFound();
        if (body?.definition) app.definition = body.definition;
        app.definitionVersion = (Number.isFinite(body?.baseVersion) ? body.baseVersion : app.definitionVersion) + 1;
        app.updatedAt = new Date().toISOString();
        return { success: true, version: app.definitionVersion, warnings: [], repairs: [] };
    },
    'PATCH /api/studio-apps/:id/publish': ({ state, params, body }) => {
        const app = findApp(state, params.id);
        if (!app) return notFound();
        app.isPublished = !!body?.isPublished;
        app.sharedGroups = Array.isArray(body?.sharedGroups) ? body.sharedGroups : [];
        if (app.isPublished) {
            app.publishedDefinition = app.definition;
            app.publishedVersion = app.definitionVersion;
            app.publishedAt = new Date().toISOString();
        }
        return { success: true, isPublished: app.isPublished, sharedGroups: app.sharedGroups, publishedVersion: app.publishedVersion };
    },
    'GET /api/studio-apps/:id/versions': ({ state, params }) => ({
        versions: state.versions.filter(v => v.appId === params.id),
    }),
    'POST /api/studio-apps/:id/versions/:versionId/restore': ({ state, params }) => {
        const app = findApp(state, params.id);
        if (!app) return notFound();
        // Only ver_demo_03 carries a stored snapshot; restoring any other
        // entry keeps the current definition (still a valid, visible flow —
        // the header refetches and the version bumps).
        const snapshot = state.versionDefinitions[params.versionId];
        if (snapshot) app.definition = snapshot;
        app.definitionVersion += 1;
        return { success: true, version: app.definitionVersion };
    },
    'GET /api/studio-apps/:id/runtime': ({ state, params }) => {
        const app = findApp(state, params.id);
        if (!app) return notFound();
        return {
            id: app.id, name: app.name, icon: app.icon, accentColor: app.accentColor,
            definition: app.definition,
            viewer: { id: 'demo-user', name: 'Demo user', email: 'demo@example.com', isOwner: true, roleKey: null },
            appVersion: app.definitionVersion, draft: true,
        };
    },

    // ---- data ----
    'GET /api/studio-apps/:id/data/tables': ({ state }) => ({ tables: state.model.tables }),
    'GET /api/studio-apps/:id/data/tables/:tableId/records': ({ state, params, query }) => {
        const all = state.records[params.tableId];
        if (!all) return notFound();
        const rows = applyFilter(all, query.get('filter'));
        const limit = Number.parseInt(query.get('limit') || '', 10);
        return {
            records: Number.isFinite(limit) ? rows.slice(0, limit) : rows,
            nextCursor: null,
            appVersion: state.apps[APP_ID].definitionVersion,
        };
    },
    'POST /api/studio-apps/:id/data/tables/:tableId/records': ({ state, params, body }) => {
        const all = state.records[params.tableId];
        if (!all) return notFound();
        const record = { id: `rec_new${all.length + 1}`, ...(body?.values || body || {}) };
        all.push(record);
        return { success: true, id: record.id, record };
    },
    'PATCH /api/studio-apps/:id/data/tables/:tableId/records/:recordId': ({ state, params, body }) => {
        const all = state.records[params.tableId];
        const record = all?.find(r => r.id === params.recordId);
        if (!record) return notFound();
        Object.assign(record, body?.values || body || {});
        return { success: true, record };
    },
    'DELETE /api/studio-apps/:id/data/tables/:tableId/records/:recordId': ({ state, params }) => {
        const all = state.records[params.tableId];
        if (!all) return notFound();
        state.records[params.tableId] = all.filter(r => r.id !== params.recordId);
        return { success: true };
    },
    'POST /api/studio-apps/:id/data/query': ({ state, body }) => {
        // Saved dataset or inline aggregate — both computed from state.records,
        // so the numbers always match what the board shows.
        const descriptor = body?.datasetId
            ? state.datasets.find(d => d.id === body.datasetId)?.descriptor
            : body;
        const tableId = body?.datasetId
            ? state.datasets.find(d => d.id === body.datasetId)?.tableId
            : body?.tableId;
        const rows = state.records[tableId] || [];
        const groupField = descriptor?.groupBy?.[0]?.field;
        let out;
        if (groupField) {
            const groups = new Map();
            for (const r of rows) {
                const key = String(r[groupField] ?? '');
                groups.set(key, (groups.get(key) || 0) + 1);
            }
            out = [...groups.entries()].map(([value, count]) => ({ [groupField]: value, count }));
        } else {
            out = [{ count: rows.length }];
        }
        return body?.datasetId ? { result: { rows: out } } : { rows: out };
    },
    'GET /api/studio-apps/:id/datasets': ({ state }) => ({ datasets: state.datasets }),
    'GET /api/studio-apps/:id/schema': ({ state }) => ({ model: state.model, modelVersion: state.model.modelVersion }),
    'PUT /api/studio-apps/:id/schema': ({ state, body }) => {
        if (body?.model) state.model = body.model;
        state.model.modelVersion = (state.model.modelVersion || 1) + 1;
        return { success: true, version: state.model.modelVersion };
    },
    'GET /api/studio-apps/:id/members': () => ({ members: [] }),
    'GET /api/studio-apps/:id/data/connectors': () => ({ connectors: [] }),

    // ---- preview-mode actions ----
    'POST /api/studio-apps/:id/actions/:actionId/step': ({ state, params, body }) => {
        const app = findApp(state, params.id);
        const action = app?.definition?.actions?.[params.actionId];
        const steps = action?.kind === 'sequence' ? action.steps : (action ? [action] : []);
        const step = steps[body?.stepIndex ?? 0];
        if (!step) return json({ ok: false, error: 'Unknown step' }, 400);
        if (step.kind === 'update_record') {
            const recordId = resolveActionFormula(step.recordId, body?.formValues);
            const record = (state.records[step.tableId] || []).find(r => r.id === recordId);
            if (!record) return json({ ok: false, error: 'Record not found' }, 404);
            for (const [key, spec] of Object.entries(step.values || {})) {
                const value = resolveActionFormula(spec, body?.formValues);
                if (value !== undefined) record[key] = value;
            }
            return { ok: true, result: { success: true, record } };
        }
        if (step.kind === 'create_record') {
            const all = state.records[step.tableId] || [];
            const record = { id: `rec_new${all.length + 1}` };
            all.push(record);
            return { ok: true, result: { success: true, record } };
        }
        // Any other server kind succeeds neutrally — nothing external runs in
        // a demo, and a 404 here would surface as a red toast mid-drag.
        return { ok: true, result: { success: true } };
    },
    'POST /api/studio-apps/:id/actions/:actionId/run': () => ({ status: 'success', result: { ok: true } }),
    'GET /api/studio-apps/:id/actions/runs/:runId': () => ({ status: 'success', result: {} }),

    // AudiencePicker (publish modal) reads this as a BARE array.
    'GET /auth/users': () => ([
        { id: 'demo-user', username: 'demo', displayName: 'Demo user', email: 'demo@example.com' },
        { id: 'demo-user-2', username: 'sanne', displayName: 'Sanne de Vries', email: 'sanne@vandael.example' },
        { id: 'demo-user-3', username: 'koen', displayName: 'Koen Bakker', email: 'koen@vandael.example' },
    ]),
};
