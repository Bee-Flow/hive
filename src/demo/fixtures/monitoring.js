/**
 * Fixtures for the organisation Usage & Monitoring demo.
 *
 * Targets `pages/settings/UsageSection` — the view at
 * /app/settings/organisation/usage with the Overview / Safety & Guardrails /
 * Integrations / Feedback / Terminations tabs. NOT
 * `components/admin/MonitoringPanel`, which is the standalone "AI Monitor"
 * with its own sidebar; they are different screens and the marketing page
 * sells this one.
 *
 * FIELD NAMES MATTER MORE THAN THE NUMBERS. Three bugs here were all the same
 * mistake — a near-miss name that renders as a silent zero or throws:
 *
 *   • `tokens` instead of `total_tokens`      → every token column read 0
 *   • `pii_events` instead of `pii_count`     → every safety counter read 0
 *   • `country_flags` as a string, not array  → `.map` threw, killing the tab
 *
 * `Number(undefined) || 0` never complains, so a wrong name is invisible until
 * somebody reads the screen. monitoring.test.js pins all three.
 *
 * Everything is invented, and the totals reconcile.
 */

import { COMMON_ROUTES } from './common';

const dayKey = (n) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

/* ── Overview ─────────────────────────────────────────────────────────
   One model table is the source of truth; every other view derives from it,
   so the tables cannot drift out of agreement with the headline totals. */

const MODELS = () => ([
    { model: 'claude-sonnet-5', calls: 1042, prompt_tokens: 921_600, completion_tokens: 362_400, input_cost: 2.76, output_cost: 5.44 },
    { model: 'gpt-5', calls: 604, prompt_tokens: 528_100, completion_tokens: 214_800, input_cost: 1.32, output_cost: 2.15 },
    { model: 'mistral-large', calls: 388, prompt_tokens: 310_700, completion_tokens: 120_800, input_cost: 0.62, output_cost: 0.73 },
    // Real traffic, no provider cost. This row is the argument the marketing
    // page makes, so it has to be a genuine row rather than a footnote.
    { model: 'qwen3-8b (local)', calls: 647, prompt_tokens: 501_300, completion_tokens: 193_500, input_cost: 0, output_cost: 0 },
]);

const withTotals = (m) => {
    const total_tokens = m.prompt_tokens + m.completion_tokens;
    const estimated_cost = Number((m.input_cost + m.output_cost).toFixed(2));
    return { ...m, total_tokens, estimated_cost, billed_cost: estimated_cost, total_cost: estimated_cost };
};

const MODEL_ROWS = () => MODELS().map(withTotals);
const sum = (rows, key) => rows.reduce((a, r) => a + (r[key] || 0), 0);

const SUMMARY = () => {
    const rows = MODEL_ROWS();
    const cost = Number(sum(rows, 'estimated_cost').toFixed(2));
    return {
        total_calls: sum(rows, 'calls'),
        total_tokens: sum(rows, 'total_tokens'),
        total_estimated_cost: cost,
        billed_cost: cost,
        total_cost: cost,
        total_input_cost: Number(sum(rows, 'input_cost').toFixed(2)),
        total_output_cost: Number(sum(rows, 'output_cost').toFixed(2)),
        unique_users: 6,
        avg_duration_ms: 2140,
        azure_services_total_cost: 0,
        combined_total_cost: cost,
    };
};

/* The weekend dip is deliberate — a flat line reads as fabricated. Shares are
   apportioned so the daily rows sum exactly to the totals above. */
const DAY_SHARE = [0.154, 0.190, 0.176, 0.199, 0.185, 0.044, 0.052];

const TIMELINE = () => {
    const s = SUMMARY();
    let tokensLeft = s.total_tokens;
    let centsLeft = Math.round(s.total_estimated_cost * 100);
    let callsLeft = s.total_calls;

    return DAY_SHARE.map((share, i) => {
        const last = i === DAY_SHARE.length - 1;
        const total_tokens = last ? tokensLeft : Math.round(s.total_tokens * share);
        const cents = last ? centsLeft : Math.round(s.total_estimated_cost * 100 * share);
        const calls = last ? callsLeft : Math.round(s.total_calls * share);
        tokensLeft -= total_tokens; centsLeft -= cents; callsLeft -= calls;
        const cost = Number((cents / 100).toFixed(2));
        const day = dayKey(DAY_SHARE.length - 1 - i);
        return { bucket: day, date: day, period: day, calls, total_tokens, estimated_cost: cost, billed_cost: cost };
    });
};

const USERS = () => ([
    { user_id: 'demo-user', display_name: 'Demo user', username: 'demo', calls: 604, prompt_tokens: 452_100, completion_tokens: 176_300 },
    { user_id: 'u_sanne', display_name: 'Sanne de Vries', username: 'sanne', calls: 548, prompt_tokens: 411_800, completion_tokens: 160_400 },
    { user_id: 'u_ruben', display_name: 'Ruben Bakker', username: 'ruben', calls: 497, prompt_tokens: 370_200, completion_tokens: 144_700 },
    { user_id: 'u_iris', display_name: 'Iris Hoekstra', username: 'iris', calls: 441, prompt_tokens: 335_100, completion_tokens: 130_900 },
    { user_id: 'u_daan', display_name: 'Daan Willemsen', username: 'daan', calls: 356, prompt_tokens: 271_600, completion_tokens: 106_100 },
    { user_id: 'u_mees', display_name: 'Mees Koster', username: 'mees', calls: 235, prompt_tokens: 190_900, completion_tokens: 72_100 },
]);

const AGENTS = () => ([
    { agent_id: 'agent_demo_support', agent_name: 'Support drafter', name: 'Support drafter', calls: 731, prompt_tokens: 583_900, completion_tokens: 228_500 },
    { agent_id: 'agent_demo_kb', agent_name: 'Knowledge answers', name: 'Knowledge answers', calls: 688, prompt_tokens: 570_800, completion_tokens: 223_300 },
    { agent_id: 'agent_demo_linkedin', agent_name: 'LinkedIn Schrijver', name: 'LinkedIn Schrijver', calls: 402, prompt_tokens: 337_000, completion_tokens: 131_900 },
    { agent_id: 'agent_demo_tender', agent_name: 'Tender triage', name: 'Tender triage', calls: 355, prompt_tokens: 322_900, completion_tokens: 126_300 },
    { agent_id: 'agent_demo_notes', agent_name: 'Meeting summariser', name: 'Meeting summariser', calls: 288, prompt_tokens: 245_200, completion_tokens: 95_900 },
    { agent_id: null, agent_name: 'Direct chat', name: 'Direct chat', calls: 217, prompt_tokens: 206_700, completion_tokens: 80_800 },
]);

/** Cost tracks each row's share of tokens, so "top by cost" can never
 *  contradict "top by tokens" on the same screen. */
const costed = (list) => {
    const s = SUMMARY();
    const rows = list.map(r => ({ ...r, total_tokens: r.prompt_tokens + r.completion_tokens }));
    const totalTok = sum(rows, 'total_tokens');
    return rows.map(r => {
        const cost = Number((s.total_estimated_cost * (r.total_tokens / totalTok)).toFixed(2));
        return { ...r, estimated_cost: cost, billed_cost: cost, total_cost: cost };
    });
};

const USER_ROWS = () => costed(USERS());
const AGENT_ROWS = () => costed(AGENTS());

/** "By app area" on the real screen. */
const SOURCES = () => {
    const s = SUMMARY();
    return [
        { source: 'direct_chat', share: 0.41 },
        { source: 'agent', share: 0.29 },
        { source: 'automation', share: 0.18 },
        { source: 'notebook', share: 0.08 },
        { source: 'support_inbox', share: 0.04 },
    ].map(({ source, share }) => {
        const cost = Number((s.total_estimated_cost * share).toFixed(2));
        return {
            source,
            calls: Math.round(s.total_calls * share),
            total_tokens: Math.round(s.total_tokens * share),
            estimated_cost: cost, billed_cost: cost, total_cost: cost,
        };
    });
};

/** Cross-tabs: which model each agent / person actually used. */
const MODELS_BY = (rows, key) => {
    const models = MODEL_ROWS();
    return rows.map((r, i) => {
        const m = models[i % models.length];
        const cost = Number((r.estimated_cost * 0.6).toFixed(2));
        return {
            [key]: r[key],
            agent_name: r.agent_name,
            display_name: r.display_name,
            model: m.model,
            calls: Math.round(r.calls * 0.6),
            total_tokens: Math.round(r.total_tokens * 0.6),
            estimated_cost: cost,
            billed_cost: cost,
        };
    });
};

/* ── Safety & Guardrails ──────────────────────────────────────────────
   Note what is absent: the matched text. A guardrail event records which
   category fired, in which direction, and what was done. The real log works
   the same way, because a log holding the offending string is a second copy
   of the leak it just prevented. */

const G_SUMMARY = () => ({
    // SafetyTab reads these EXACT names (`Number(summary?.pii_count) || 0`).
    // `pii_events` renders 0 beside a correct total rather than failing.
    total_events: 1046,
    pii_count: 1042,
    moderation_count: 4,
    regex_count: 0,
    input_count: 118,
    output_count: 928,
    blocked: 22,
    tokenised: 903,
    redacted: 121,
    unique_users: 6,
});

const G_CATEGORIES = () => ([
    { violation_type: 'pii', category: 'person_name', count: 412 },
    { violation_type: 'pii', category: 'email', count: 268 },
    { violation_type: 'pii', category: 'phone_number', count: 143 },
    { violation_type: 'pii', category: 'iban', count: 96 },
    { violation_type: 'pii', category: 'address', count: 74 },
    { violation_type: 'pii', category: 'bsn', count: 31 },
    { violation_type: 'pii', category: 'api_key', count: 18 },
    { violation_type: 'moderation', category: 'harassment', count: 4 },
]);

const G_ACTIONS = () => ([
    { action: 'tokenise', action_taken: 'tokenise', types: 'pii', violation_type: 'pii', count: 903 },
    { action: 'redact', action_taken: 'redact', types: 'pii', violation_type: 'pii', count: 121 },
    { action: 'ask_user', action_taken: 'ask_user', types: 'pii', violation_type: 'pii', count: 18 },
    { action: 'block', action_taken: 'block', types: 'moderation', violation_type: 'moderation', count: 4 },
]);

const G_BY_USER = () => ([
    { user_id: 'demo-user', display_name: 'Demo user', pii: 284, moderation: 1, regex: 0, total: 285, last_event: dayKey(0) },
    { user_id: 'u_sanne', display_name: 'Sanne de Vries', pii: 241, moderation: 0, regex: 0, total: 241, last_event: dayKey(0) },
    { user_id: 'u_ruben', display_name: 'Ruben Bakker', pii: 198, moderation: 2, regex: 0, total: 200, last_event: dayKey(1) },
    { user_id: 'u_iris', display_name: 'Iris Hoekstra', pii: 167, moderation: 0, regex: 0, total: 167, last_event: dayKey(1) },
    { user_id: 'u_daan', display_name: 'Daan Willemsen', pii: 106, moderation: 1, regex: 0, total: 107, last_event: dayKey(2) },
    { user_id: 'u_mees', display_name: 'Mees Koster', pii: 46, moderation: 0, regex: 0, total: 46, last_event: dayKey(3) },
]);

const G_TIMELINE = () => {
    const share = [0.16, 0.19, 0.17, 0.20, 0.18, 0.05, 0.05];
    return share.map((f, i) => {
        const day = dayKey(share.length - 1 - i);
        const pii = Math.round(1042 * f);
        const moderation = (i === 2 || i === 4) ? 2 : 0;
        return { bucket: day, period: day, date: day, total: pii + moderation, pii, pii_events: pii, moderation, regex: 0 };
    });
};

const G_RECENT = () => ([
    { id: 'gev_1', timestamp: dayKey(0), user_id: 'demo-user', display_name: 'Demo user', violation_type: 'pii', violation_categories: 'person_name, email', action_taken: 'tokenise', direction: 'outbound', source: 'direct_chat', agent_name: 'Support drafter', model: 'claude-sonnet-5', conversation_id: 'conv_demo_1' },
    { id: 'gev_2', timestamp: dayKey(0), user_id: 'u_sanne', display_name: 'Sanne de Vries', violation_type: 'pii', violation_categories: 'iban', action_taken: 'tokenise', direction: 'outbound', source: 'automation', agent_name: 'Tender triage', model: 'gpt-5', conversation_id: 'conv_demo_2' },
    { id: 'gev_3', timestamp: dayKey(0), user_id: 'u_ruben', display_name: 'Ruben Bakker', violation_type: 'pii', violation_categories: 'bsn', action_taken: 'redact', direction: 'outbound', source: 'agent', agent_name: 'Knowledge answers', model: 'claude-sonnet-5', conversation_id: 'conv_demo_3' },
    { id: 'gev_4', timestamp: dayKey(1), user_id: 'u_iris', display_name: 'Iris Hoekstra', violation_type: 'pii', violation_categories: 'person_name, address, phone_number', action_taken: 'tokenise', direction: 'outbound', source: 'support_inbox', agent_name: 'Support drafter', model: 'qwen3-8b (local)', conversation_id: 'conv_demo_4' },
    { id: 'gev_5', timestamp: dayKey(1), user_id: 'u_daan', display_name: 'Daan Willemsen', violation_type: 'moderation', violation_categories: 'harassment', action_taken: 'block', direction: 'inbound', source: 'direct_chat', agent_name: '', model: 'gpt-5', conversation_id: 'conv_demo_5' },
    { id: 'gev_6', timestamp: dayKey(1), user_id: 'demo-user', display_name: 'Demo user', violation_type: 'pii', violation_categories: 'api_key', action_taken: 'block', direction: 'outbound', source: 'automation', agent_name: 'Meeting summariser', model: 'mistral-large', conversation_id: 'conv_demo_6' },
    { id: 'gev_7', timestamp: dayKey(2), user_id: 'u_sanne', display_name: 'Sanne de Vries', violation_type: 'pii', violation_categories: 'email', action_taken: 'ask_user', direction: 'outbound', source: 'notebook', agent_name: '', model: 'claude-sonnet-5', conversation_id: 'conv_demo_7' },
    { id: 'gev_8', timestamp: dayKey(2), user_id: 'u_mees', display_name: 'Mees Koster', violation_type: 'pii', violation_categories: 'person_name', action_taken: 'tokenise', direction: 'outbound', source: 'agent', agent_name: 'LinkedIn Schrijver', model: 'gpt-5', conversation_id: 'conv_demo_8' },
]);

/* ── Integrations & egress ────────────────────────────────────────────
   Deliberately not all green: two endpoints resolve outside the EEA and one
   web-search call carried a name with it. A sovereignty view where everything
   is already compliant shows nothing about how it behaves when it is not. */

/** country_flags / country_names / country_codes / server_ips are ARRAYS —
 *  one endpoint can resolve to several IPs in several countries and the tab
 *  maps over them. Strings here throw `f.map is not a function` and take the
 *  whole tab down, which is how this was found. */
const I_SERVERS = () => ([
    { server_endpoint: 'gmail.googleapis.com', server_ips: ['142.250.179.109'], country_codes: ['IE'], country_names: ['Ireland'], country_flags: ['🇮🇪'], is_eu: true, integration_count: 3, sent: 418, received: 418, total: 836, last_contact: dayKey(0) },
    { server_endpoint: 'graph.microsoft.com', server_ips: ['20.190.160.14', '20.190.160.20'], country_codes: ['NL', 'IE'], country_names: ['Netherlands', 'Ireland'], country_flags: ['🇳🇱', '🇮🇪'], is_eu: true, integration_count: 4, sent: 261, received: 261, total: 522, last_contact: dayKey(0) },
    { server_endpoint: 'nextcloud.internal', server_ips: ['10.0.4.11'], country_codes: ['LOCAL'], country_names: ['On your network'], country_flags: ['🏠'], is_eu: true, integration_count: 6, sent: 194, received: 194, total: 388, last_contact: dayKey(0) },
    { server_endpoint: 'api.anthropic.com', server_ips: ['160.79.104.10'], country_codes: ['US'], country_names: ['United States'], country_flags: ['🇺🇸'], is_eu: false, integration_count: 1, sent: 96, received: 96, total: 192, last_contact: dayKey(0) },
    { server_endpoint: 'api.elevenlabs.io', server_ips: ['34.117.62.4'], country_codes: ['US'], country_names: ['United States'], country_flags: ['🇺🇸'], is_eu: false, integration_count: 1, sent: 21, received: 21, total: 42, last_contact: dayKey(2) },
]);

const I_BY_TOOL = () => ([
    { key: 'kb_search', label: 'kb_search', total: 894, eu_count: 894, local_count: 894, non_eu_count: 0, pii_non_eu_count: 0, top_operator: 'On your network' },
    { key: 'gmail_search', label: 'gmail_search', total: 431, eu_count: 431, local_count: 0, non_eu_count: 0, pii_non_eu_count: 0, top_operator: 'Google' },
    { key: 'drive_get_file', label: 'drive_get_file', total: 236, eu_count: 236, local_count: 0, non_eu_count: 0, pii_non_eu_count: 0, top_operator: 'Google' },
    { key: 'outlook_search', label: 'outlook_search', total: 188, eu_count: 188, local_count: 0, non_eu_count: 0, pii_non_eu_count: 0, top_operator: 'Microsoft' },
    { key: 'nextcloud_list', label: 'nextcloud_list', total: 152, eu_count: 152, local_count: 152, non_eu_count: 0, pii_non_eu_count: 0, top_operator: 'On your network' },
    { key: 'web_search', label: 'web_search', total: 96, eu_count: 22, local_count: 0, non_eu_count: 74, pii_non_eu_count: 3, top_operator: 'Mixed' },
    { key: 'elevenlabs_tts', label: 'elevenlabs_tts', total: 21, eu_count: 0, local_count: 0, non_eu_count: 21, pii_non_eu_count: 0, top_operator: 'ElevenLabs' },
]);

/**
 * The "By Integration Type" table renders `item.integration_type` (falling
 * back to the literal 'unknown'), plus `sent`, `received`, `pii_events` and
 * `last_used`. It does NOT read `key` or `label` — supplying only those gave
 * six rows all labelled "Unknown" with an empty "Last used".
 *
 * `integration_type` is also the lookup key for IntegrationLogo, so the value
 * has to match the ids in utils/integrationLogos (google, microsoft,
 * nextcloud…) or the row falls back to a coloured letter mark.
 *
 * EU / local / non-EU are DISJOINT buckets: the tab computes
 * `nonEu = total - eu - local`, and the score is `(eu + local) / total`. If
 * local traffic is also counted in eu_count the score exceeds 100 — which is
 * how this was spotted, at 148/100.
 */
const I_BY_TYPE = () => ([
    { key: 'knowledge', label: 'Knowledge base', integration_type: 'kb_search', total: 894, eu_count: 0, local_count: 894, non_eu_count: 0, pii_non_eu_count: 0, pii_events: 0, sent: 447, received: 447, last_used: dayKey(0), top_operator: 'On your network' },
    { key: 'google', label: 'Google Workspace', integration_type: 'google_drive', total: 728, eu_count: 728, local_count: 0, non_eu_count: 0, pii_non_eu_count: 0, pii_events: 412, sent: 364, received: 364, last_used: dayKey(0), top_operator: 'Google' },
    { key: 'microsoft', label: 'Microsoft 365', integration_type: 'outlook', total: 442, eu_count: 442, local_count: 0, non_eu_count: 0, pii_non_eu_count: 0, pii_events: 268, sent: 221, received: 221, last_used: dayKey(0), top_operator: 'Microsoft' },
    { key: 'nextcloud', label: 'Nextcloud', integration_type: 'nextcloud', total: 388, eu_count: 0, local_count: 388, non_eu_count: 0, pii_non_eu_count: 0, pii_events: 74, sent: 194, received: 194, last_used: dayKey(0), top_operator: 'On your network' },
    { key: 'search', label: 'Web search', integration_type: 'web_search', total: 96, eu_count: 22, local_count: 0, non_eu_count: 74, pii_non_eu_count: 3, pii_events: 31, sent: 48, received: 48, last_used: dayKey(1), top_operator: 'Mixed' },
    { key: 'voice', label: 'Voice', integration_type: 'elevenlabs', total: 21, eu_count: 0, local_count: 0, non_eu_count: 21, pii_non_eu_count: 0, pii_events: 0, sent: 11, received: 10, last_used: dayKey(2), top_operator: 'ElevenLabs' },
]);

const I_EGRESS = () => {
    const rows = [
        ['gmail_search', 'google', 'gmail.googleapis.com', 'IE', 'Ireland', '🇮🇪', 1, 0, 'Google', 'outbound', ''],
        ['kb_search', 'knowledge', 'nextcloud.internal', 'LOCAL', 'On your network', '🏠', 1, 1, 'On your network', 'outbound', ''],
        ['outlook_search', 'microsoft', 'graph.microsoft.com', 'NL', 'Netherlands', '🇳🇱', 1, 0, 'Microsoft', 'outbound', 'person_name'],
        ['web_search', 'search', 'api.search.example', 'US', 'United States', '🇺🇸', 0, 0, 'Mixed', 'outbound', 'person_name'],
        ['drive_get_file', 'google', 'gmail.googleapis.com', 'IE', 'Ireland', '🇮🇪', 1, 0, 'Google', 'inbound', ''],
        ['elevenlabs_tts', 'voice', 'api.elevenlabs.io', 'US', 'United States', '🇺🇸', 0, 0, 'ElevenLabs', 'outbound', ''],
        ['nextcloud_list', 'nextcloud', 'nextcloud.internal', 'LOCAL', 'On your network', '🏠', 1, 1, 'On your network', 'outbound', ''],
    ];
    const people = USERS();
    return rows.map((r, i) => ({
        id: `egr_demo_${i + 1}`,
        timestamp: dayKey(i % 4),
        tool_name: r[0],
        integration_type: r[1],
        server_endpoint: r[2],
        tls_servername: r[2],
        peer_ip: `203.0.113.${10 + i}`,
        peer_ip_source: 'resolved',
        country_code: r[3],
        country_name: r[4],
        country_flag: r[5],
        // STRICT booleans: IntegrationsTab counts EU with `r.is_eu === true`,
        // so `1` here silently lands every row in the non-EU bucket and the
        // sovereignty score collapses to 22/100 "RISKY" on EU-only traffic.
        is_eu: r[6] === 1,
        is_local: r[7] === 1,
        operator: r[8],
        data_direction: r[9],
        pii_categories_detected: r[10],
        user_id: people[i % people.length].user_id,
        display_name: people[i % people.length].display_name,
        agent_id: null,
    }));
};

/** SovereigntyRow reads `eu_count` / `local_count` / `non_eu_count` /
 *  `pii_non_eu_count` — NOT `eu` / `local` / `non`. With the short names every
 *  row scored 0 because `total > 0` but the numerator was undefined. */
const sovRow = (axis, key, total, { nonPct = 0.06, localPct = 0.5, piiNonEu = 0, top_operator = '' } = {}) => {
    // DISJOINT buckets. The score is `(eu_count + local_count) / total`, so if
    // local traffic is also counted inside eu_count the row scores over 100 —
    // the demo was showing 148/100, which is worse than showing nothing.
    const non_eu_count = Math.round(total * nonPct);
    const local_count = Math.round((total - non_eu_count) * localPct);
    return {
        axis, key, label: key, total,
        eu_count: total - non_eu_count - local_count,
        local_count,
        non_eu_count,
        pii_non_eu_count: piiNonEu,
        top_operator,
    };
};

const I_SOVEREIGNTY = (axis) => {
    const byAxis = {
        user: USERS().map((u, i) => sovRow('user', u.display_name, u.calls, {
            nonPct: i === 3 ? 0.11 : 0.04, localPct: 0.52,
            piiNonEu: i === 3 ? 2 : 0, top_operator: 'Google',
        })),
        integration: I_BY_TYPE().map(r => ({
            axis: 'integration', key: r.label, label: r.label, total: r.total,
            eu_count: r.eu_count, local_count: r.local_count,
            non_eu_count: r.non_eu_count, pii_non_eu_count: r.pii_non_eu_count,
            top_operator: r.top_operator,
        })),
        agent: AGENTS().map((a, i) => sovRow('agent', a.agent_name, a.calls, {
            nonPct: i === 1 ? 0.09 : 0.03, localPct: 0.5,
            piiNonEu: i === 1 ? 1 : 0, top_operator: 'Mixed',
        })),
        pii: G_CATEGORIES().filter(c => c.violation_type === 'pii').map((c, i) => sovRow('pii', c.category, c.count, {
            nonPct: i === 0 ? 0.05 : 0.02, localPct: 0.6,
            piiNonEu: i === 0 ? 3 : 0, top_operator: 'Mixed',
        })),
    };
    return byAxis[axis] || byAxis.user;
};

/** The sovereignty-over-time chart reads its OWN shape — eu_count /
 *  local_count / non_eu_count / pii_non_eu_count / total — not the usage
 *  timeline. Returning the usage timeline here left the chart empty. */
const I_TIMELINE = () => TIMELINE().map((t, i) => {
    const total = t.calls;
    const non_eu_count = i === 3 ? Math.round(total * 0.09) : Math.round(total * 0.03);
    return {
        bucket: t.bucket, period: t.period, date: t.date,
        total,
        eu_count: total - non_eu_count,
        local_count: Math.round(total * 0.53),
        non_eu_count,
        pii_non_eu_count: i === 3 ? 1 : 0,
    };
});

const I_SUMMARY = () => ({
    total_calls: 2569,
    unique_integrations: 6,
    unique_servers: 6,
    pii_events: 1042,
    eu_calls: 2474,
    non_eu_calls: 95,
    local_calls: 1434,
});

export function createState() {
    return {
        summary: SUMMARY(),
        timeline: TIMELINE(),
        users: USER_ROWS(),
        agents: AGENT_ROWS(),
        models: MODEL_ROWS(),
        sources: SOURCES(),
    };
}

/* Azure service telemetry only exists on Azure deployments. Empty is the
   correct answer for a generic demo rather than an invented bill. */
const EMPTY_AZURE = {};
['azure-services/summary', 'azure-services/by-type', 'azure-services/by-user'].forEach((ep) => {
    EMPTY_AZURE[`GET /api/usage/${ep}`] = ep.endsWith('summary') ? () => ({}) : () => ([]);
});

export const ROUTES = {
    ...COMMON_ROUTES,
    ...EMPTY_AZURE,

    // ── Overview tab ─────────────────────────────────────────────────
    'GET /api/usage/summary': ({ state }) => state.summary,
    'GET /api/usage/timeline': ({ state }) => state.timeline,
    'GET /api/usage/users': ({ state }) => state.users,
    'GET /api/usage/sources': ({ state }) => state.sources,
    'GET /api/usage/agents': ({ state }) => state.agents,
    'GET /api/usage/models': ({ state }) => state.models,
    'GET /api/usage/models-by-agent': ({ state }) => MODELS_BY(state.agents, 'agent_id'),
    'GET /api/usage/models-by-user': ({ state }) => MODELS_BY(state.users, 'user_id'),

    // ── Safety & Guardrails tab ──────────────────────────────────────
    'GET /api/usage/guardrails/summary': () => G_SUMMARY(),
    'GET /api/usage/guardrails/timeline': () => G_TIMELINE(),
    'GET /api/usage/guardrails/by-user': () => G_BY_USER(),
    'GET /api/usage/guardrails/by-category': () => G_CATEGORIES(),
    'GET /api/usage/guardrails/by-action': () => G_ACTIONS(),
    'GET /api/usage/guardrails/recent': () => G_RECENT(),

    // ── Integrations tab ─────────────────────────────────────────────
    'GET /api/usage/integrations/summary': () => I_SUMMARY(),
    'GET /api/usage/integrations/by-type': () => I_BY_TYPE(),
    'GET /api/usage/integrations/by-tool': () => I_BY_TOOL(),
    // The chips render `p.pii_category` and `p.integration_type`, not
    // `category` — without them the row showed a count with no label.
    'GET /api/usage/integrations/pii-summary': () => {
        const byType = ['google_drive', 'outlook', 'gmail', 'web_search', 'nextcloud', 'kb_search', 'github'];
        return G_CATEGORIES()
            .filter(c => c.violation_type === 'pii')
            .map((c, i) => ({
                pii_category: c.category,
                category: c.category,
                count: c.count,
                integration_type: byType[i % byType.length],
            }));
    },
    'GET /api/usage/integrations/servers': () => I_SERVERS(),
    'GET /api/usage/integrations/recent': () => I_EGRESS(),
    'GET /api/usage/integrations/egress': () => I_EGRESS(),
    'GET /api/usage/integrations/operator-summary': () => I_BY_TYPE(),
    'GET /api/usage/integrations/timeline': () => I_TIMELINE(),
    'GET /api/usage/integrations/sovereignty': ({ query }) => I_SOVEREIGNTY(query.get('dimension') || 'user'),

    // ── Plan cards ───────────────────────────────────────────────────
    'GET /api/subscriptions/orgs/:orgId': () => ({
        plan: 'enterprise',
        status: 'active',
        seats: 6,
        activeUsers: 6,
        currency: 'EUR',
        billedPerCycle: 0,
        periodStart: dayKey(6),
        periodEnd: dayKey(-24),
        demo: true,
    }),
    'GET /ai/config/tiers-for-user': () => ({
        tiers: {
            fast: { label: 'Fast', model: 'qwen3-8b (local)' },
            standard: { label: 'Standard', model: 'claude-sonnet-5' },
            thinking: { label: 'Deep Thinking', model: 'gpt-5' },
        },
        default: 'standard',
    }),

    // Empty rather than invented: fabricated thumbs-down comments would put
    // words in real users' mouths for a screenshot.
    'GET /api/feedback': () => ({ feedback: [], total: 0 }),
    'GET /api/feedback/summary': () => ({ up: 0, down: 0, total: 0 }),
};
