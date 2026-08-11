/**
 * Fixtures for the Routines & automations demo.
 *
 * Modelled on a workflow a real team would build: pull last month's AI/SaaS
 * invoices out of the mailbox, extract the line items, total them per vendor
 * and post the result. It uses ordinary step types (`integration_action`,
 * `loop`, `ai_step`, `aggregate`, `notification`) so the canvas shows the
 * same node vocabulary the product does.
 *
 * Everything is invented. The "connected" Gmail account, the vendors and the
 * run history are all made up, and no request touches a real mailbox — the
 * demo transport answers every call from this file.
 */

import { COMMON_ROUTES, daysAgo, minutesAgo } from './common';

const AUTOMATION_ID = 'auto_demo_spend_report';
const STEP_LIBRARY_ID = 'blk_demo_vendor_lookup';

function spendReportDefinition() {
    return {
        title: 'Weekly AI/SaaS spend report',
        trigger: { id: 'trg', kind: 'manual', label: 'Manual trigger' },
        steps: [
            {
                id: 'search_invoices',
                type: 'integration_action',
                label: 'Search AI/SaaS billing emails (last 7 days)',
                app: 'gmail',
                action: 'gmail_search',
                params: {
                    query: 'from:(billing OR invoice OR receipt) newer_than:7d',
                    maxResults: 100,
                },
            },
            {
                id: 'read_each',
                type: 'loop',
                label: 'Read & extract each invoice',
                over: '{{ steps.search_invoices.messages }}',
                as: 'message',
                maxIterations: 100,
                steps: [
                    {
                        id: 'read_message',
                        type: 'integration_action',
                        label: 'Read message',
                        app: 'gmail',
                        action: 'gmail_read',
                        params: { messageId: '{{ message.id }}' },
                    },
                    {
                        id: 'extract_lines',
                        type: 'ai_step',
                        label: 'Extract billing line items',
                        modelTier: 'fast',
                        prompt: 'Extract every billing line item from this invoice email as JSON: vendor, description, amount, currency, period. If it is not an invoice, return an empty array.\n\n{{ steps.read_message.body }}',
                    },
                ],
            },
            {
                id: 'total_per_vendor',
                type: 'aggregate',
                label: 'Sum totals per vendor',
                over: '{{ steps.read_each.results }}',
                groupBy: 'vendor',
                operation: 'sum',
                field: 'amount',
            },
            {
                id: 'over_budget',
                type: 'condition',
                label: 'Above €2,000 this week?',
                expr: '{{ steps.total_per_vendor.total }} > 2000',
            },
            {
                id: 'write_summary',
                type: 'summarize',
                label: 'Write the summary',
                source: '{{ steps.total_per_vendor.groups }}',
                style: 'bullets',
            },
            {
                id: 'notify_finance',
                type: 'notification',
                label: 'Post to finance',
                channel: 'email',
                to: 'finance@example.com',
                subject: 'Weekly AI/SaaS spend — {{ now | date }}',
                body: '{{ steps.write_summary.text }}',
            },
        ],
        edges: [
            { from: 'trg', to: 'search_invoices' },
            { from: 'search_invoices', to: 'read_each' },
            { from: 'read_each', to: 'total_per_vendor' },
            { from: 'total_per_vendor', to: 'over_budget' },
            { from: 'over_budget', to: 'write_summary', branch: 'true' },
            { from: 'write_summary', to: 'notify_finance' },
        ],
    };
}

function onboardingDefinition() {
    return {
        title: 'New client intake',
        trigger: {
            id: 'trg',
            kind: 'app_event',
            event: 'file.new',
            label: 'On new file in /Clients',
            params: { path: '/Clients' },
        },
        steps: [
            {
                id: 'classify',
                type: 'ai_step',
                label: 'Classify the document',
                modelTier: 'fast',
                prompt: 'Classify this document as one of: contract, id_document, invoice, other. Answer with one word.\n\n{{ trigger.file.text }}',
            },
            {
                id: 'route',
                type: 'switch',
                label: 'Route by type',
                on: '{{ steps.classify.text }}',
                cases: ['contract', 'id_document', 'invoice'],
            },
            {
                id: 'ask_review',
                type: 'approval',
                label: 'Ask the account manager to confirm',
                assignee: 'demo@example.com',
                prompt: 'A new contract arrived. File it under the client folder?',
            },
        ],
        edges: [
            { from: 'trg', to: 'classify' },
            { from: 'classify', to: 'route' },
            { from: 'route', to: 'ask_review', branch: 'contract' },
        ],
    };
}

const AUTOMATIONS = () => ([
    {
        id: AUTOMATION_ID,
        userId: 'demo-user',
        organizationId: 'demo-org',
        kind: 'automation',
        title: 'Weekly AI/SaaS spend report',
        description: 'Reads last week’s billing emails, totals them per vendor and posts a summary.',
        definition: spendReportDefinition(),
        version: 7,
        isActive: false,
        isDraft: false,
        needsFirstRunConfirm: false,
        triggerType: 'manual',
        scheduleCron: null,
        scheduleTz: 'Europe/Amsterdam',
        nextRunAt: null,
        lastRunAt: daysAgo(1),
        lastStatus: 'success',
        isPublished: false,
        sharedGroups: [],
        publishedVersion: null,
        exposeAsTool: false,
        icon: null,
        category: null,
        createdAt: daysAgo(46),
        updatedAt: daysAgo(1),
    },
    {
        id: 'auto_demo_intake',
        userId: 'demo-user',
        organizationId: 'demo-org',
        kind: 'automation',
        title: 'New client intake',
        description: 'Classifies documents dropped in /Clients and asks for a human OK before filing.',
        definition: onboardingDefinition(),
        version: 3,
        isActive: true,
        isDraft: false,
        needsFirstRunConfirm: false,
        triggerType: 'app_event',
        scheduleCron: null,
        scheduleTz: 'Europe/Amsterdam',
        nextRunAt: null,
        lastRunAt: minutesAgo(37),
        lastStatus: 'success',
        isPublished: false,
        sharedGroups: [],
        publishedVersion: null,
        exposeAsTool: false,
        icon: null,
        category: null,
        createdAt: daysAgo(12),
        updatedAt: minutesAgo(37),
    },
    {
        id: 'auto_demo_digest',
        userId: 'demo-user',
        organizationId: 'demo-org',
        kind: 'automation',
        title: 'Monday morning digest',
        description: 'Every Monday at 08:00: open actions, upcoming renewals and last week’s decisions.',
        definition: {
            title: 'Monday morning digest',
            trigger: { id: 'trg', kind: 'schedule', cron: '0 8 * * 1', label: 'Mondays at 08:00' },
            steps: [
                { id: 'gather', type: 'ai_step', label: 'Gather open actions', modelTier: 'fast', prompt: 'List the open action items from last week.' },
                { id: 'send', type: 'notification', label: 'Email the team', channel: 'email', to: 'team@example.com', subject: 'Monday digest', body: '{{ steps.gather.text }}' },
            ],
            edges: [{ from: 'trg', to: 'gather' }, { from: 'gather', to: 'send' }],
        },
        version: 2,
        isActive: true,
        isDraft: false,
        needsFirstRunConfirm: false,
        triggerType: 'schedule',
        scheduleCron: '0 8 * * 1',
        scheduleTz: 'Europe/Amsterdam',
        nextRunAt: daysAgo(-2),
        lastRunAt: daysAgo(5),
        lastStatus: 'success',
        isPublished: false,
        sharedGroups: [],
        publishedVersion: null,
        exposeAsTool: false,
        icon: null,
        category: null,
        createdAt: daysAgo(90),
        updatedAt: daysAgo(5),
    },
]);

const TASKS = () => ([
    {
        id: 'task_demo_competitors',
        userId: 'demo-user',
        title: 'Competitor watch',
        prompt: 'Search the web for announcements from our three main competitors in the last 24 hours. Summarise anything that affects our roadmap, and say plainly if there is nothing worth reporting.',
        repeatInterval: 'daily',
        nextRunAt: daysAgo(-1),
        lastRunAt: daysAgo(1),
        lastResult: 'Nothing material in the last 24 hours. One competitor published a changelog entry about SSO; no pricing or positioning changes.',
        lastStatus: 'success',
        isActive: true,
        modelTier: 'standard',
        toolsEnabled: ['agent_search'],
        maxResultLength: 50000,
        runCount: 46,
        timezone: 'Europe/Amsterdam',
        createdAt: daysAgo(46),
        agentId: null,
        conversationId: null,
        daysOfWeek: null,
        timeOfDay: '07:30',
    },
    {
        id: 'task_demo_renewals',
        userId: 'demo-user',
        title: 'Contract renewal check',
        prompt: 'Look through the contracts knowledge base for agreements whose notice period ends in the next 45 days. List them with the deadline and the required notice method.',
        repeatInterval: 'weekly',
        nextRunAt: daysAgo(-4),
        lastRunAt: daysAgo(3),
        lastResult: 'Two agreements need attention: Van Dijk B.V. (notice by 12 September, written) and Meridian Cloud (notice by 30 September, email to their account manager).',
        lastStatus: 'success',
        isActive: true,
        modelTier: 'standard',
        toolsEnabled: ['kb_search'],
        maxResultLength: 50000,
        runCount: 11,
        timezone: 'Europe/Amsterdam',
        createdAt: daysAgo(77),
        agentId: null,
        conversationId: null,
        daysOfWeek: [1],
        timeOfDay: '09:00',
    },
]);

const STEPS = () => ([
    {
        id: STEP_LIBRARY_ID,
        kind: 'block',
        title: 'Vendor lookup',
        description: 'Takes a vendor name and returns the contract owner, renewal date and monthly spend.',
        definition: {
            title: 'Vendor lookup',
            trigger: { id: 'trg', kind: 'manual' },
            steps: [
                { id: 'find', type: 'ai_step', label: 'Find the vendor record', modelTier: 'fast', prompt: 'Look up {{ input.vendor }} in the contracts knowledge base.' },
                { id: 'out', type: 'layer_output', label: 'Return the record', value: '{{ steps.find.text }}' },
            ],
            edges: [{ from: 'trg', to: 'find' }, { from: 'find', to: 'out' }],
        },
        isPublished: true,
        publishedVersion: 2,
        exposeAsTool: true,
        icon: 'Search',
        category: 'Finance',
        sharedGroups: [],
        version: 2,
        isActive: true,
        isDraft: false,
        createdAt: daysAgo(60),
        updatedAt: daysAgo(9),
    },
]);

const AGENTS = () => ([
    { id: 'agent_demo_analyst', name: 'Finance analyst', avatar: '📊', description: 'Answers questions about spend, contracts and renewals.' },
    { id: 'agent_demo_intake', name: 'Client intake', avatar: '📥', description: 'Reads incoming documents and files them.' },
]);

export function createState() {
    return {
        automations: AUTOMATIONS(),
        tasks: TASKS(),
        steps: STEPS(),
        agents: AGENTS(),
        runs: [
            { id: 'run_demo_1', automationId: AUTOMATION_ID, status: 'success', startedAt: daysAgo(1), finishedAt: daysAgo(1), stepCount: 6 },
            { id: 'run_demo_2', automationId: AUTOMATION_ID, status: 'success', startedAt: daysAgo(8), finishedAt: daysAgo(8), stepCount: 6 },
        ],
    };
}


// ── Run engine ───────────────────────────────────────────────────────
//
// Pressing ▶ on a node calls POST /api/automation/:id/steps/:stepId/run and
// merges the returned step rows into the canvas. Without an answer the panel
// just says "No run output for this step yet", which shows the chrome and
// none of the behaviour — you cannot see what a workflow DOES.
//
// So each step has a canned result, and they are consistent with each other:
// the loop consumes what the search returned, the aggregate totals what the
// loop extracted, the condition tests that total. Executing steps in order
// also populates the INPUT panel of the next node, because that panel is
// built from upstream outputs.
//
// Row shape mirrors the server's: { stepId, stepType, status, input, output }.

const INVOICES = [
    { id: 'msg_a1', from: 'billing@anthropic.com', subject: 'Your Anthropic invoice', date: '2026-07-22', vendor: 'Anthropic', amount: 842.00 },
    { id: 'msg_a2', from: 'invoice@openai.com', subject: 'OpenAI receipt', date: '2026-07-23', vendor: 'OpenAI', amount: 611.40 },
    { id: 'msg_a3', from: 'billing@scaleway.com', subject: 'Facture Scaleway', date: '2026-07-24', vendor: 'Scaleway', amount: 388.05 },
    { id: 'msg_a4', from: 'receipts@github.com', subject: 'GitHub Team', date: '2026-07-25', vendor: 'GitHub', amount: 176.00 },
    { id: 'msg_a5', from: 'no-reply@figma.com', subject: 'Figma monthly', date: '2026-07-26', vendor: 'Figma', amount: 300.00 },
];

const LINE_ITEMS = INVOICES.map(i => ({
    vendor: i.vendor,
    description: `${i.vendor} — monthly subscription`,
    amount: i.amount,
    currency: 'EUR',
    period: '2026-07',
}));

const TOTAL = LINE_ITEMS.reduce((n, l) => n + l.amount, 0);   // 2317.45

const SUMMARY_TEXT = [
    'AI/SaaS spend, week of 22–26 July: 2.317,45 EUR across 5 vendors.',
    '',
    '- Anthropic      842,00',
    '- OpenAI         611,40',
    '- Scaleway       388,05',
    '- Figma          300,00',
    '- GitHub         176,00',
    '',
    'Above the 2.000 EUR threshold, so finance has been notified.',
].join('\n');

/** stepId → what a real run of that step would produce. */
const STEP_RESULTS = {
    trg: {
        stepType: 'trigger',
        input: null,
        output: { triggeredBy: 'demo@example.com', at: '2026-07-27T09:00:00.000Z', kind: 'manual' },
    },
    search_invoices: {
        stepType: 'integration_action',
        input: { query: 'from:(billing OR invoice OR receipt) newer_than:7d', maxResults: 100 },
        output: { messages: INVOICES.map(({ id, from, subject, date }) => ({ id, from, subject, date })), resultSizeEstimate: INVOICES.length },
    },
    read_message: {
        stepType: 'integration_action',
        input: { messageId: 'msg_a1' },
        output: { id: 'msg_a1', from: 'billing@anthropic.com', subject: 'Your Anthropic invoice', body: 'Invoice 2026-07-0042\nPlan: Team\nPeriod: July 2026\nTotal due: EUR 842.00' },
    },
    extract_lines: {
        stepType: 'ai_step',
        input: { modelTier: 'fast', prompt: 'Extract every billing line item…' },
        output: [LINE_ITEMS[0]],
    },
    read_each: {
        stepType: 'loop',
        input: { over: '{{ steps.search_invoices.messages }}', as: 'message' },
        output: { iterations: INVOICES.length, results: LINE_ITEMS },
    },
    total_per_vendor: {
        stepType: 'aggregate',
        input: { groupBy: 'vendor', operation: 'sum', field: 'amount' },
        output: {
            groups: LINE_ITEMS
                .map(l => ({ vendor: l.vendor, total: l.amount }))
                .sort((a, b) => b.total - a.total),
            total: Number(TOTAL.toFixed(2)),
            currency: 'EUR',
        },
    },
    over_budget: {
        stepType: 'condition',
        input: { expr: '{{ steps.total_per_vendor.total }} > 2000' },
        output: { result: true, evaluated: `${TOTAL.toFixed(2)} > 2000`, branch: 'true' },
    },
    write_summary: {
        stepType: 'summarize',
        input: { style: 'bullets', source: '{{ steps.total_per_vendor.groups }}' },
        output: { text: SUMMARY_TEXT },
    },
    notify_finance: {
        stepType: 'notification',
        input: { channel: 'email', to: 'finance@example.com' },
        // The one place the demo must not look like it did something real.
        output: { delivered: false, to: 'finance@example.com', subject: 'Weekly AI/SaaS spend — 27 Jul 2026', demo: 'No email was sent — the demo has no network access.' },
    },
};

/** Execution order, so `mode: 'from'` can run the tail of the graph. */
const RUN_ORDER = ['trg', 'search_invoices', 'read_each', 'total_per_vendor', 'over_budget', 'write_summary', 'notify_finance'];

function stepRow(stepId) {
    const r = STEP_RESULTS[stepId];
    if (!r) return { stepId, stepType: 'unknown', status: 'success', input: null, output: { demo: 'No sample output for this step.' } };
    return { stepId, stepType: r.stepType, status: 'success', input: r.input, output: r.output, error: null };
}

function runEnvelope(automationId, stepIds) {
    return {
        run: {
            id: 'run_demo_live',
            automationId,
            status: 'success',
            startedAt: new Date(Date.now() - 1200).toISOString(),
            finishedAt: new Date().toISOString(),
            stepCount: stepIds.length,
            demo: true,
        },
        steps: stepIds.map(stepRow),
    };
}

const find = (list, id) => list.find(x => x.id === id) || null;
const notFound = () => new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });

export const ROUTES = {
    ...COMMON_ROUTES,

    // ── Prompt tasks ──
    'GET /api/ai-tasks': ({ state }) => ({ tasks: state.tasks, maxTasks: 25 }),
    'POST /api/ai-tasks': ({ state, body }) => {
        const task = { ...TASKS()[0], ...body, id: `task_demo_${state.tasks.length + 1}`, runCount: 0, lastStatus: 'pending', lastResult: null };
        state.tasks.unshift(task);
        return { success: true, task };
    },
    'PUT /api/ai-tasks/:id': ({ state, params, body }) => {
        const task = find(state.tasks, params.id);
        if (!task) return notFound();
        Object.assign(task, body || {});
        return { success: true, task };
    },
    'POST /api/ai-tasks/:id/toggle': ({ state, params }) => {
        const task = find(state.tasks, params.id);
        if (!task) return notFound();
        task.isActive = !task.isActive;
        return { success: true, task };
    },
    'POST /api/ai-tasks/:id/run-now': ({ state, params }) => {
        const task = find(state.tasks, params.id);
        if (!task) return notFound();
        task.lastStatus = 'success';
        task.lastRunAt = new Date().toISOString();
        task.runCount += 1;
        task.lastResult = 'Demo run — this is sample output. In the product this is what the model actually returned.';
        return { success: true, task };
    },
    'DELETE /api/ai-tasks/:id': ({ state, params }) => {
        state.tasks = state.tasks.filter(t => t.id !== params.id);
        return { success: true };
    },

    // ── Automations ──
    'GET /api/automation': ({ state }) => ({ automations: state.automations }),
    'GET /api/automation/:id': ({ state, params }) => find(state.automations, params.id) || notFound(),
    'POST /api/automation': ({ state, body }) => {
        const created = {
            ...AUTOMATIONS()[0],
            id: `auto_demo_${state.automations.length + 1}`,
            title: body?.title || 'Untitled automation',
            description: '',
            definition: body?.definition || { trigger: { id: 'trg', kind: 'manual' }, steps: [], edges: [] },
            isActive: false, isDraft: true, lastRunAt: null, lastStatus: null, version: 1,
        };
        state.automations.unshift(created);
        return { success: true, automation: created };
    },
    'PUT /api/automation/:id': ({ state, params, body }) => {
        const a = find(state.automations, params.id);
        if (!a) return notFound();
        Object.assign(a, body || {});
        a.version += 1;
        return { success: true, automation: a };
    },
    'DELETE /api/automation/:id': ({ state, params }) => {
        state.automations = state.automations.filter(a => a.id !== params.id);
        return { success: true };
    },
    'POST /api/automation/:id/activate': ({ state, params }) => {
        const a = find(state.automations, params.id);
        if (!a) return notFound();
        a.isActive = true;
        return { success: true, automation: a };
    },
    'POST /api/automation/:id/deactivate': ({ state, params }) => {
        const a = find(state.automations, params.id);
        if (!a) return notFound();
        a.isActive = false;
        return { success: true, automation: a };
    },
    'POST /api/automation/:id/run': ({ state, params }) => {
        const a = find(state.automations, params.id);
        if (!a) return notFound();
        a.lastRunAt = new Date().toISOString();
        a.lastStatus = 'success';
        // Every node lights up with its sample output, so "Run flow" shows the
        // whole behaviour rather than a toast.
        return { success: true, ...runEnvelope(params.id, RUN_ORDER) };
    },

    // Per-node ▶. `mode: 'only'` runs this step; `mode: 'from'` runs it and
    // everything downstream — the same two modes the real endpoint takes.
    'POST /api/automation/:id/steps/:stepId/run': ({ state, params, body }) => {
        const a = find(state.automations, params.id);
        if (!a) return notFound();
        const idx = RUN_ORDER.indexOf(params.stepId);
        const ids = body?.mode === 'from' && idx >= 0
            ? RUN_ORDER.slice(idx)
            : [params.stepId];
        const env = runEnvelope(params.id, ids);
        return { ...env, stepRecord: env.steps[0] };
    },

    // Dry run — same rows, flagged so the UI can label it.
    'POST /api/automation/:id/dry-run': ({ params }) => ({
        ...runEnvelope(params.id, RUN_ORDER),
        dryRun: true,
    }),
    'GET /api/automation/:id/runs': ({ state, params }) => ({
        runs: state.runs.filter(r => r.automationId === params.id),
    }),
    // The builder rehydrates the LAST run's step rows on mount
    // (hydrateLastRun) so chips and samples survive a reload — in the demo
    // that resolves to the canned full-run rows, which keeps the canvas
    // populated the moment the page opens.
    'GET /api/automation/runs/:runId/steps': ({ state }) => {
        const run = state.runs.find(r => r.id === 'run_demo_1') || state.runs[0];
        const env = runEnvelope(run?.automationId || AUTOMATION_ID, RUN_ORDER);
        return { steps: env.steps };
    },
    'GET /api/automation/:id/versions': ({ state, params }) => {
        const a = find(state.automations, params.id);
        return { versions: a ? [{ version: a.version, createdAt: a.updatedAt, title: a.title }] : [] };
    },

    // ── Reusable Steps ──
    'GET /api/step': ({ state }) => ({ steps: state.steps }),
    'GET /api/step/:id': ({ state, params }) => find(state.steps, params.id) || notFound(),

    // ── Things the builder asks for that have no demo answer ──
    // Explicitly empty rather than missing, so the panels render their real
    // empty states instead of an error.
    'GET /api/automation/_runs/stream': () => ({ runs: [] }),
    // Polled every few seconds for the "● now executing" dot.
    'GET /api/automation/_runs/active': () => ({ runs: [] }),
    // The AI builder's chat session for this automation. No prior
    // conversation in the demo, and the composer renders its empty state.
    'GET /api/automation/builder/session/:id': () => ({ snapshot: null }),
    'GET /api/automation/builder/suggest/last': () => ({ suggestion: null }),
    'GET /api/automation/catalog': ({ state }) => ({ tools: [], apps: [], steps: state.steps }),
    'GET /api/integrations/connections': () => ({
        connections: [{ id: 'conn_demo_gmail', app: 'gmail', label: 'demo@example.com', status: 'connected' }],
    }),
};
