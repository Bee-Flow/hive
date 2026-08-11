/**
 * Fixtures for the Privacy Shield demo.
 *
 * Targets `components/admin/guardrails/orgShield/OrgShieldEditor` — the
 * organisation shield at /app/settings/organisation/privacy, all five tabs:
 * Overview, What we look for, What happens, Leaving your org, What happened.
 *
 * WHAT THIS REPLACED, AND WHY
 * The demo used to be a composite: the CONSUMER privacy panel
 * (pages/settings/ConsumerPrivacySection — "for your account") beside a chat
 * you could type into. It read well, but it was not the screen. An
 * administrator evaluating whether this product can hold their organisation's
 * data goes looking for the organisation shield, and the demo showed them a
 * personal preferences pane with a different title, a different scope and a
 * different set of controls. A demo of the wrong screen is worse than none:
 * it is a confident answer to a question nobody asked.
 *
 * THE ORGANISATION IS THE SAME ONE AS THE COMPLIANCE DEMO — Van Dael
 * Assurantiën, the fictional Dutch insurance intermediary from
 * fixtures/compliance.js, down to the same processors (Microsoft Ireland,
 * OpenAI, Anthropic). Somebody who opens both demos should find one company,
 * not two.
 *
 * THE CONFIGURATION AND THE ACTIVITY TELL ONE STORY. "EU-hosted AI only" is
 * OFF, and the "What happened" tab then reports, from its own numbers, that
 * personal data reached servers outside Europe. That is deliberate: the
 * evidence tab exists to show an administrator something they did not know,
 * and the switch that fixes it is two tabs away. A demo configured perfectly
 * has nothing to demonstrate.
 *
 * SHAPES COME FROM THE SERVER, NOT FROM GUESSWORK:
 *   - the shield document mirrors the default in server/routes/orgPrivacyShield.js
 *     and must survive `normaliseDoc` in useOrgShield.js — note that
 *     `applyToAutomations` and `piiAllowPublicOrgs` are read as `!== false`,
 *     so absent means ON, and that `piiDetectionCategories` is filtered
 *     against the 21 ids in config/piiCategories.ts (a typo does not error,
 *     it silently disappears);
 *   - the two /overview responses mirror `getGuardrailOverview`
 *     (server/stores/guardrailEventStore.js) and `getIntegrationOverview`
 *     (server/stores/integrationActivityStore.js). `by_surface` is in the
 *     former and NOT in the hook's EMPTY_GUARD, so omitting it would render
 *     an empty card rather than an error.
 *
 * A non-OK GET on the shield document does not render an empty form — it
 * renders a red error box and no form at all (OrgShieldEditor). Every route
 * the editor touches has to answer.
 */

import { COMMON_ROUTES, daysAgo, minutesAgo } from './common';

const ORG = 'org_demo_vandael';
const ORG_NAME = 'Van Dael Assurantiën B.V.';

/* ── The shield document ────────────────────────────────────────────────
   An insurance intermediary: it handles names, addresses, bank details, BSN
   and — because it writes disability and health claims — medical data. The
   selection below is what that organisation would actually switch on, and
   the Overview's "N of 21" row counts it literally. */

const WATCHED_CATEGORIES = [
    'Person', 'DateOfBirth', 'PhoneNumber', 'Email', 'Address',
    'InternationalBankingAccountNumber', 'NationalIdentificationNumber',
    'HealthInsuranceNumber', 'MedicalCondition',
];

export function shieldDoc() {
    return {
        organization_id: ORG,
        enabled: true,
        collectionIds: [],
        scope: { userInput: true, agentOutput: true },
        action: 'delete',

        // OFF on purpose — see the header. The activity tab reports the
        // consequence, and this is the switch that ends it.
        euModeEnabled: false,

        piiDetectionCategories: WATCHED_CATEGORIES,
        // Not one of the presets, so the Overview row reads "Custom (65%)"
        // rather than a preset name — the shape a real tuned install is in.
        piiDetectionConfidenceThreshold: 0.65,
        // Tokenise and restore: the answer that keeps the reply readable.
        // Requires the pii_tokenize capability, which fixtures/common.js
        // grants — without it this renders as a licence lock.
        piiDetectionAction: 'tokenize',
        piiFailureMode: 'fail_closed',
        attachmentLargeInputPolicy: 'fail_open',
        showRawPayload: true,

        dlpEnabled: true,
        dlpMode: 'ask',
        webSearchGuardEnabled: true,
        webSearchGuardPiiCategories: ['NationalIdentificationNumber', 'HealthInsuranceNumber', 'MedicalCondition'],
        disableSearchOnUpload: true,

        toolPiiPolicy: {
            external: {
                blockCategories: [
                    'NationalIdentificationNumber', 'HealthInsuranceNumber',
                    'MedicalCondition', 'InternationalBankingAccountNumber',
                ],
            },
            internal: { blockCategories: ['NationalIdentificationNumber'] },
        },

        monitorIntegrations: true,
        applyToAutomations: true,

        customSensitiveTerms: ['polisnummer', 'schadedossier', 'Project Zilvermeeuw'],
        // The names that would otherwise be reported as people on every single
        // message. `piiAllowPublicOrgs` covers the well-known companies.
        piiAllowTerms: ['Van Dael', 'Kifid', 'Zorgverzekeraars Nederland'],
        piiAllowPublicOrgs: true,

        updatedAt: daysAgo(9),
        updatedBy: 'Marieke de Wit',
    };
}

/* ── "What happened" — thirty days of evidence ──────────────────────────
   Every number here is generated from ONE table of days so the parts cannot
   drift: the timeline sums to the summary, the categories sum to the PII
   count, the destinations sum to the call count, and the sovereignty score is
   computed with the server's own weighting rather than typed in. The tab
   picks exactly one alert from these numbers, so getting them wrong does not
   look like bad data — it looks like the shield saying the wrong thing. */

const DAYS = 30;

// Weekday-shaped traffic: quiet weekends, a spike on the day the claims backlog
// was worked through.
const dayShape = (i) => {
    const dow = (i + 3) % 7;              // arbitrary but fixed phase
    if (dow === 5 || dow === 6) return 0.25;
    return i === 11 ? 2.1 : 1;
};

const SERIES = Array.from({ length: DAYS }, (_, i) => {
    const f = dayShape(i);
    const pii = Math.round(14 * f);
    const moderation = Math.round(2 * f);
    const regex = Math.round(3 * f);
    const dlp = Math.round(4 * f);
    return {
        period: daysAgo(DAYS - 1 - i).slice(0, 10),
        total: pii + moderation + regex + dlp,
        moderation, pii, regex, dlp,
        calls: Math.round(96 * f),
    };
});

const sum = (key) => SERIES.reduce((s, r) => s + r[key], 0);

const TOTAL_EVENTS = sum('total');
const TOTAL_PII = sum('pii');
const TOTAL_CALLS = sum('calls');

/** Split a total across weights so the parts always add back up to it. */
function apportion(total, weights) {
    const w = weights.reduce((s, x) => s + x.weight, 0);
    const out = weights.map(x => ({ ...x, count: Math.floor((total * x.weight) / w) }));
    const drift = total - out.reduce((s, x) => s + x.count, 0);
    if (out.length) out[0].count += drift;   // the remainder lands on the biggest
    return out;
}

const CATEGORY_WEIGHTS = [
    { category: 'Person', weight: 34 },
    { category: 'Email', weight: 22 },
    { category: 'InternationalBankingAccountNumber', weight: 14 },
    { category: 'PhoneNumber', weight: 12 },
    { category: 'Address', weight: 9 },
    { category: 'NationalIdentificationNumber', weight: 6 },
    { category: 'MedicalCondition', weight: 3 },
];

const TOP_CATEGORIES = apportion(TOTAL_PII, CATEGORY_WEIGHTS)
    .map(c => ({ category: c.category, violation_type: 'pii', count: c.count }));

const PEOPLE = [
    { user_id: 'u_sanne', display_name: 'Sanne Vermeer', weight: 30 },
    { user_id: 'u_ruben', display_name: 'Ruben Tak', weight: 24 },
    { user_id: 'u_pieter', display_name: 'Pieter Hoogendijk', weight: 19 },
    { user_id: 'u_farah', display_name: 'Farah El Amrani', weight: 15 },
    { user_id: 'u_joost', display_name: 'Joost Bakker', weight: 12 },
];

const TOP_USERS = apportion(TOTAL_EVENTS, PEOPLE).map(u => ({
    user_id: u.user_id,
    display_name: u.display_name,
    total: u.count,
    pii: Math.round(u.count * 0.62),
    moderation: Math.round(u.count * 0.09),
    regex: Math.round(u.count * 0.13),
    last_event: minutesAgo(40 + PEOPLE.indexOf(u) * 220),
}));

const BY_SURFACE = apportion(TOTAL_EVENTS, [
    { surface: 'direct', weight: 46 },
    { surface: 'agent', weight: 34 },
    { surface: 'routine', weight: 15 },
    { surface: 'notebook', weight: 5 },
]).map(s => ({ surface: s.surface, count: s.count }));

const BY_ACTION = apportion(TOTAL_EVENTS, [
    { action_taken: 'tokenized', weight: 71 },
    { action_taken: 'redacted', weight: 17 },
    { action_taken: 'blocked', weight: 8 },
    { action_taken: 'allowed', weight: 4 },
]).map(a => ({ action_taken: a.action_taken, count: a.count }));

/* Destinations. `is_local` is the on-premise model; the two US operators are
   the ones the ROPA in the compliance demo also names. */
const DESTINATIONS = apportion(TOTAL_CALLS, [
    { dest_host: 'vandael-gpu-01.intern', operator: 'Van Dael (on-premise)', country_code: 'NL', country_name: 'Netherlands', is_eu: true, is_local: true, weight: 38 },
    { dest_host: 'swedencentral.api.cognitive.microsoft.com', operator: 'Microsoft Ireland Operations Ltd', country_code: 'SE', country_name: 'Sweden', is_eu: true, is_local: false, weight: 31 },
    { dest_host: 'api.openai.com', operator: 'OpenAI, L.L.C.', country_code: 'US', country_name: 'United States', is_eu: false, is_local: false, weight: 19 },
    { dest_host: 'api.anthropic.com', operator: 'Anthropic PBC', country_code: 'US', country_name: 'United States', is_eu: false, is_local: false, weight: 12 },
]).map(d => ({ ...d, total: d.count }));

const NON_EU = DESTINATIONS.filter(d => !d.is_eu);
const NON_EU_CALLS = NON_EU.reduce((s, d) => s + d.total, 0);
// Of the calls that left Europe, the ones that carried something the shield
// had already identified as personal data.
const PII_NON_EU = Math.round(NON_EU_CALLS * 0.21);

/**
 * The server's weighting: a call that stayed in Europe or on your own servers
 * scores full marks, and personal data leaving Europe counts double against
 * the score. Computed, so the headline cannot contradict the rows under it.
 */
const SOVEREIGNTY_SCORE = Math.max(0, Math.round(
    100 - ((NON_EU_CALLS + PII_NON_EU) / TOTAL_CALLS) * 100,
));

const GUARD_OVERVIEW = () => ({
    summary: {
        total_events: TOTAL_EVENTS,
        pii_count: TOTAL_PII,
        moderation_count: sum('moderation'),
        regex_count: sum('regex'),
        input_count: Math.round(TOTAL_EVENTS * 0.88),
        output_count: TOTAL_EVENTS - Math.round(TOTAL_EVENTS * 0.88),
        unique_users: PEOPLE.length,
    },
    timeline: SERIES.map(({ period, total, moderation, pii, regex, dlp }) =>
        ({ period, total, moderation, pii, regex, dlp })),
    top_categories: TOP_CATEGORIES,
    by_action: BY_ACTION,
    top_users: TOP_USERS,
    by_surface: BY_SURFACE,
    health: { last_event_at: minutesAgo(38) },
    window: { start: null, end: null, interval: 'day' },
});

const INTEG_OVERVIEW = () => ({
    summary: {
        total_calls: TOTAL_CALLS,
        pii_non_eu_count: PII_NON_EU,
        sovereignty_score: SOVEREIGNTY_SCORE,
        score_delta: 4,
        eu_count: TOTAL_CALLS - NON_EU_CALLS,
        non_eu_count: NON_EU_CALLS,
    },
    timeline: SERIES.map(r => ({ period: r.period, total: r.calls })),
    top: {
        destinations: DESTINATIONS,
        non_eu_destinations: NON_EU,
        integrations: [
            { integration_type: 'llm_provider', total: TOTAL_CALLS - 214 },
            { integration_type: 'mcp_server', total: 141 },
            { integration_type: 'web_search', total: 73 },
        ],
        actors: [
            { actor: 'agent', total: Math.round(TOTAL_CALLS * 0.54) },
            { actor: 'user', total: Math.round(TOTAL_CALLS * 0.31) },
            { actor: 'routine', total: Math.round(TOTAL_CALLS * 0.15) },
        ],
        users: TOP_USERS.map(u => ({ user_id: u.user_id, display_name: u.display_name, total: Math.round(u.total * 1.7) })),
    },
    pii_categories: TOP_CATEGORIES.slice(0, 5).map(c => ({ category: c.category, count: Math.round(c.count * 0.24) })),
    data_categories: [
        { category: 'Conversation content', count: TOTAL_CALLS },
        { category: 'Attachment text', count: 318 },
        { category: 'Retrieved knowledge', count: 902 },
    ],
    health: { last_call_at: minutesAgo(6) },
    window: { start: null, end: null, interval: 'day' },
});

/* ── The drill-down rows ────────────────────────────────────────────────
   The tab filters the category and destination drills CLIENT-side, so these
   rows have to carry the categories and hosts the cards above them show —
   otherwise clicking a card opens an empty table, which reads as a bug in the
   product rather than a gap in the sample. */

const GUARD_EVENT_SEEDS = [
    { user: 0, surface: 'direct', cats: 'Person,Email', action: 'tokenized', agent: null },
    { user: 1, surface: 'agent', cats: 'InternationalBankingAccountNumber', action: 'tokenized', agent: 'Schadebeoordeling' },
    { user: 0, surface: 'agent', cats: 'Person,PhoneNumber', action: 'tokenized', agent: 'Polisintake' },
    { user: 2, surface: 'routine', cats: 'Email', action: 'redacted', agent: 'Wekelijkse schaderapportage' },
    { user: 3, surface: 'direct', cats: 'NationalIdentificationNumber', action: 'blocked', agent: null },
    { user: 1, surface: 'agent', cats: 'Person,Address', action: 'tokenized', agent: 'Klachtdossier' },
    { user: 4, surface: 'direct', cats: 'MedicalCondition', action: 'blocked', agent: null },
    { user: 2, surface: 'agent', cats: 'Person', action: 'tokenized', agent: 'Klantenservice-assistent' },
    { user: 0, surface: 'notebook', cats: 'Email,Person', action: 'tokenized', agent: null },
    { user: 3, surface: 'routine', cats: 'InternationalBankingAccountNumber,Person', action: 'tokenized', agent: 'Incassobestand opschonen' },
    { user: 1, surface: 'direct', cats: 'PhoneNumber', action: 'tokenized', agent: null },
    { user: 4, surface: 'agent', cats: 'Address', action: 'redacted', agent: 'Polisintake' },
];

const GUARD_ROWS = () => GUARD_EVENT_SEEDS.map((s, i) => ({
    id: `ge_${1000 + i}`,
    timestamp: minutesAgo(35 + i * 97),
    user_id: PEOPLE[s.user].user_id,
    display_name: PEOPLE[s.user].display_name,
    violation_type: 'pii',
    violation_categories: s.cats,
    action_taken: s.action,
    direction: 'input',
    agent_name: s.agent,
    conversation_id: `conv_${7100 + i}`,
    model: s.surface === 'routine' ? 'qwen3-8b' : 'gpt-5',
    status: 'handled',
}));

const EGRESS_SEEDS = [
    { dest: 0, tool: 'chat.completions', pii: '', dur: 1_180 },
    { dest: 2, tool: 'chat.completions', pii: 'Person,Email', dur: 2_940 },
    { dest: 1, tool: 'chat.completions', pii: 'Person', dur: 1_610 },
    { dest: 3, tool: 'messages.create', pii: 'Person,Address', dur: 3_220 },
    { dest: 0, tool: 'embeddings', pii: '', dur: 310 },
    { dest: 2, tool: 'chat.completions', pii: 'InternationalBankingAccountNumber', dur: 2_705 },
    { dest: 1, tool: 'chat.completions', pii: '', dur: 1_455 },
    { dest: 3, tool: 'messages.create', pii: '', dur: 2_860 },
    { dest: 0, tool: 'chat.completions', pii: 'Person', dur: 990 },
    { dest: 2, tool: 'web.search', pii: '', dur: 1_740 },
];

const EGRESS_ROWS = () => EGRESS_SEEDS.map((s, i) => {
    const d = DESTINATIONS[s.dest];
    return {
        id: `eg_${2000 + i}`,
        timestamp: minutesAgo(12 + i * 113),
        user_id: PEOPLE[i % PEOPLE.length].user_id,
        display_name: PEOPLE[i % PEOPLE.length].display_name,
        integration_type: s.tool === 'web.search' ? 'web_search' : 'llm_provider',
        tool_name: s.tool,
        dest_host: d.dest_host,
        tls_servername: d.dest_host,
        server_endpoint: `https://${d.dest_host}/v1`,
        operator: d.operator,
        country_code: d.country_code,
        country_name: d.country_name,
        country_flag: d.is_eu ? '🇪🇺' : '🇺🇸',
        is_eu: d.is_eu,
        is_local: !!d.is_local,
        pii_categories_detected: s.pii,
        duration_ms: s.dur,
        status: 'ok',
    };
});

/* ── State + routes ─────────────────────────────────────────────────── */

export function createState() {
    return { shield: shieldDoc() };
}

export const ROUTES = {
    ...COMMON_ROUTES,

    'GET /api/org-privacy-shield/:orgId': ({ state }) => state.shield,

    /**
     * Saving really saves — for this tab. The editor overlays its fields onto
     * the document it loaded and PUTs the whole thing, so writing the body
     * straight back is what the server does too. `clamped_fields` and
     * `termErrors` are empty because the demo grants the capabilities the
     * document uses; returning them absent would render as "saved with notes".
     */
    'PUT /api/org-privacy-shield/:orgId': ({ state, body }) => {
        state.shield = {
            ...state.shield,
            ...(body || {}),
            organization_id: ORG,
            updatedAt: new Date().toISOString(),
            updatedBy: 'Demo user',
        };
        return { config: state.shield, clamped_fields: [], termErrors: [] };
    },

    /**
     * These two decide whether two Overview rows exist at all. `searchProvider`
     * set → "Web search protection"; a non-empty EU model map → "EU-hosted AI
     * only". Both are on the screenshot the page is selling, and both vanish
     * silently if these return empty.
     */
    'GET /ai/config': () => ({
        searchProvider: 'searxng',
        piiDetectionCategories: WATCHED_CATEGORIES,
    }),
    'GET /ai/config/chat-models-eu': () => ({
        fast: { modelId: 'mistral-small-latest' },
        balanced: { modelId: 'azure/gpt-4.1-swedencentral' },
        powerful: { modelId: 'mistral-large-latest' },
    }),

    // Fetched even with the org pinned. The picker is not rendered, but the
    // transport fails closed, so an unanswered route is a console warning and
    // a failed test rather than nothing.
    'GET /auth/organizations': () => ([{ id: ORG, name: ORG_NAME }]),

    // ── "What happened" ───────────────────────────────────────────────
    'GET /api/usage/guardrails/overview': () => GUARD_OVERVIEW(),
    'GET /api/usage/integrations/overview': () => INTEG_OVERVIEW(),
    // `query` is a URLSearchParams, not a plain object — `query.eu` reads
    // undefined and every filter below would silently pass everything, which
    // shows as a drill labelled "Outside Europe" listing EU rows.
    'GET /api/usage/guardrails/recent': ({ query }) => {
        const user = query.get('user');
        const rows = GUARD_ROWS().filter(r => !user || r.user_id === user);
        return rows.slice(0, Number(query.get('limit')) || 50);
    },
    'GET /api/usage/integrations/egress': ({ query }) => {
        const [eu, user, integration] = ['eu', 'user', 'integration'].map(k => query.get(k));
        const rows = EGRESS_ROWS().filter(r =>
            (eu !== 'false' || !r.is_eu)
            && (!user || r.user_id === user)
            && (!integration || r.integration_type === integration));
        return rows.slice(0, Number(query.get('limit')) || 50);
    },
};

// Exported for the tests: they assert the arithmetic a visitor can check by
// reading the screen, not just that the keys exist.
export const _internals = {
    GUARD_OVERVIEW, INTEG_OVERVIEW, GUARD_ROWS, EGRESS_ROWS,
    DESTINATIONS, WATCHED_CATEGORIES,
    TOTAL_EVENTS, TOTAL_PII, TOTAL_CALLS, NON_EU_CALLS, PII_NON_EU, SOVEREIGNTY_SCORE,
};
