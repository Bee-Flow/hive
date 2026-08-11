/**
 * Fixtures for the Compliance Center demo.
 *
 * Targets `components/admin/ComplianceHub` — the hub at
 * /app/settings/organisation/compliance, both frameworks: the privacy pair
 * (GDPR + EU AI Act, with the DSR inbox, breach register, ROPA and DPIAs) and
 * ISO 27001 (Statement of Applicability, ISMS policies, risks, internal audit,
 * training, evidence connectors).
 *
 * WHERE THE DATA COMES FROM
 * The catalog half — 44 check definitions, 93 Annex A controls, 10 connectors
 * — is GENERATED from the server's own registries into complianceCatalog.js
 * (`cd server && node scripts/genComplianceDemoCatalog.js`). Everything a
 * component turns into an i18n key or a cross-reference therefore matches the
 * product exactly. Hand-copying those was not an option: a wrong titleKey
 * renders as a blank cell rather than an error, and a control whose `checks`
 * array names a check that does not exist quietly empties the SoA's evidence
 * column.
 *
 * The organisation half is invented — Van Dael Assurantiën, a fictional Dutch
 * insurance intermediary. It is written to be recognisable to someone who does
 * this work: a score in the eighties rather than a perfect one, two real
 * failures, a DSR three days from its deadline, a breach that was notified in
 * time and one still inside the 72-hour window.
 *
 * SHAPES ARE DERIVED FROM WHAT THE PAGES READ, not from what looks reasonable.
 * The monitoring fixture shipped five separate bugs of the form "near-miss
 * field name renders a silent zero", so every container here mirrors the
 * server's response literally — `overview.controls.verified`, not
 * `overview.verified`; `eu_count`-style disjoint buckets where the component
 * subtracts. compliance.test.js pins the ones that would fail silently.
 */

import { CHECK_DEFS, ISO_CONTROLS, ISO_THEMES, ISO_CONNECTORS } from './complianceCatalog';

const ORG = 'org_demo_vandael';
const now = () => Date.now();
const iso = (msAgo) => new Date(now() - msAgo).toISOString();
const days = (n) => n * 86_400_000;
const hours = (n) => n * 3_600_000;
// `iso(msAgo)` looks BACK, `inDays(n)` looks FORWARD. Both exist because half
// this data is history (a breach detected 19 hours ago) and half is a deadline
// (a review due in six days), and expressing a future date as `iso(-days(6))`
// reads as a typo every time somebody edits it.
const inDays = (n) => new Date(now() + days(n)).toISOString();

/* ── Who is in this fictional organisation ──────────────────────────── */

const ORG_USERS = () => ([
    { id: 'u_marieke', displayName: 'Marieke de Wit', email: 'm.dewit@vandael.example', phone: '+31 20 555 0142', orgRole: 'admin' },
    { id: 'u_joost', displayName: 'Joost Bakker', email: 'j.bakker@vandael.example', phone: '', orgRole: 'member' },
    { id: 'u_farah', displayName: 'Farah El Amrani', email: 'f.elamrani@vandael.example', phone: '', orgRole: 'admin' },
    { id: 'u_pieter', displayName: 'Pieter Hoogendijk', email: 'p.hoogendijk@vandael.example', phone: '', orgRole: 'member' },
    { id: 'u_sanne', displayName: 'Sanne Vermeer', email: 's.vermeer@vandael.example', phone: '', orgRole: 'member' },
    { id: 'u_ruben', displayName: 'Ruben Tak', email: 'r.tak@vandael.example', phone: '', orgRole: 'member' },
]);

const SETTINGS = () => ({
    organization_id: ORG,
    onboarded_at: iso(days(214)),
    dpo_name: 'Marieke de Wit',
    dpo_email: 'privacy@vandael.example',
    dpo_phone: '+31 20 555 0142',
    data_residency: 'eu',
    default_retention_days: 365,
    privacy_notice_url: 'https://vandael.example/privacy',
    legal_bases: ['contract', 'legal_obligation', 'legitimate_interests'],
    breach_recipients: ['privacy@vandael.example', 'j.bakker@vandael.example'],
    ai_literacy_material_url: 'https://vandael.example/intern/ai-basiskennis',
    ai_literacy_confirmed_at: iso(days(51)),
    ropa_reviewed_at: iso(days(23)),
    ropa_reviewed_by: 'u_marieke',
    scc_confirmed_operators: ['OpenAI, L.L.C.'],
});

/* ── Check results ──────────────────────────────────────────────────────
   One status map is the source of truth. Anything not named here passes, so
   adding a check to the product does not silently create a failing row in the
   demo — it appears as a pass, and the score stays believable.

   The failures are chosen to be the ones a real organisation actually carries:
   an unwritten policy, an overdue review, a control nobody has evidenced. */

const STATUS_OVERRIDES = {
    // GDPR — the two that genuinely bite most organisations.
    // NB: GDPR-Art35 and AIA-Art26 are per-source; their statuses come from
    // HIGH_RISK_AGENTS below, one row per assistant, not from this map.
    'GDPR-Art30-ropa-reviewed': 'pass',
    'GDPR-Art32-encryption-at-rest': 'pass',
    // EU AI Act — literacy confirmed, transparency notice still missing.
    'AIA-Art50-ai-disclosure': 'fail',
    // ISO 27001 — an unevidenced control and a supplier review that lapsed.
    'ISO27001-A.5.20-suppliers': 'fail',
    'ISO27001-A.8.8-vuln-mgmt': 'warn',
};

const DETAILS = {
    'AIA-Art50-ai-disclosure': 'No disclosure text configured. Users are not told they are interacting with an AI system.',
    'ISO27001-A.5.20-suppliers': 'No signed processing agreement on file for 1 of 5 processors.',
    'ISO27001-A.8.8-vuln-mgmt': 'Last dependency scan is 41 days old; the policy says 30.',
};

/* ── Per-source checks ──────────────────────────────────────────────────
   Two checks in the registry are `scope: 'per-source'` — GDPR Art. 35 (DPIA)
   and AI Act Art. 26 (human oversight). The runner expands those into ONE ROW
   PER SUBJECT with `scope_id = subject.id` (server/compliance/runner.js:25),
   and the pages depend on that: DpiaPage builds its rows by filtering the
   checks for `check_id === 'GDPR-Art35-dpia-high-risk' && c.scope_id`, reading
   the assistant's name and risk reason out of `evidence`.

   The fixture used to flatten both to a single `scope_id: null` row. The
   result was a demo that contradicted itself in two clicks: the Overview
   listed "DPIA for high-risk agents — 1 of 4 assistants … has no DPIA on
   record", and the DPIA section it linked to said "No high-risk agents
   detected — no DPIA required right now". Neither the missing-route check nor
   the shape tests can see that: the row existed and had the right shape, it
   just had no subject, so the page filtered it away and rendered its empty
   state. Only opening the section shows it.

   Subjects are the four published assistants, classified by the same
   heuristic the server uses (agents/art35-dpia-high-risk.js `_isHighRisk`) —
   the risk_reason strings are its output, not a paraphrase. Statuses are
   DERIVED from the DPIA fixture rather than declared, so the two can never
   disagree about which assistant is missing what. */
const HIGH_RISK_AGENTS = [
    { id: 'agent_claims', label: 'Schadebeoordeling', risk_reason: 'system prompt mentions automated decisions' },
    { id: 'agent_intake', label: 'Polisintake', risk_reason: 'routes data to external provider (openai)' },
    { id: 'agent_helpdesk', label: 'Klantenservice-assistent', risk_reason: 'routes data to external provider (openai)' },
    { id: 'agent_kifid', label: 'Klachtdossier', risk_reason: 'processes PII categories: health, correspondence' },
];

const art35Row = (subject) => {
    const dpia = DPIA().find(d => d.agent_id === subject.id) || null;
    const evidence = { agent_id: subject.id, agent_name: subject.label, risk_reason: subject.risk_reason };
    if (!dpia) {
        return {
            status: 'fail',
            evidence,
            details: `No DPIA on record for "${subject.label}" — required because it ${subject.risk_reason}.`,
        };
    }
    return {
        status: 'pass',
        evidence: { ...evidence, mode: 'questionnaire', approved_at: dpia.approved_at },
        details: `DPIA on record (questionnaire) — last approved ${String(dpia.approved_at).slice(0, 10)}.`,
    };
};

const aia26Row = (subject) => {
    const dpia = DPIA().find(d => d.agent_id === subject.id) || null;
    const evidence = { agent_id: subject.id, agent_name: subject.label, risk_reason: subject.risk_reason };
    if (!dpia) {
        return {
            status: 'fail',
            evidence,
            details: `No current assessment for "${subject.label}" — record who oversees its output (Compliance → DPIA questionnaire, "Human oversight").`,
        };
    }
    return {
        status: 'pass',
        evidence: { ...evidence, human_oversight: dpia.human_oversight },
        details: `Human oversight recorded for "${subject.label}": ${dpia.human_oversight}`,
    };
};

const PER_SOURCE = {
    'GDPR-Art35-dpia-high-risk': art35Row,
    'AIA-Art26-human-oversight': aia26Row,
};

const CHECK_ROWS = () => CHECK_DEFS.flatMap((d, i) => {
    // Spread the run times over the last scan so the "last run" column is not
    // 44 identical timestamps.
    const run_at = iso(hours(6) + i * 1_000);
    const perSource = PER_SOURCE[d.check_id];
    if (perSource) {
        return HIGH_RISK_AGENTS.map((subject, j) => {
            const r = perSource(subject);
            return {
                ...d,
                scope_id: subject.id,
                run_at,
                ...r,
                evidence: { ...r.evidence, sha256: `demo${String(i).padStart(4, '0')}${j}` },
            };
        });
    }
    return [{
        ...d,
        scope_id: null,
        status: STATUS_OVERRIDES[d.check_id] || 'pass',
        details: DETAILS[d.check_id] || null,
        evidence: { sha256: `demo${String(i).padStart(4, '0')}` },
        run_at,
    }];
});

/* ── Scores ─────────────────────────────────────────────────────────────
   Computed with the SERVER'S formula (compliance/score.js), not typed in:
   weight by severity, pass = 1.0, warn = 0.5, fail = 0, not_applicable
   excluded from the denominator. A hand-written score drifts the moment a
   status above changes, and a compliance demo whose arithmetic is wrong is
   worse than no demo. */

const SEVERITY_WEIGHT = { critical: 3, high: 2, medium: 1, low: 0.5 };

const computeScore = (rows) => {
    if (!rows.length) return { score: 0, total: 0, pass: 0, warn: 0, fail: 0, na: 0 };
    let earned = 0, max = 0, pass = 0, warn = 0, fail = 0, na = 0;
    for (const r of rows) {
        const w = SEVERITY_WEIGHT[r.severity] || 1;
        if (r.status === 'not_applicable') { na++; continue; }
        max += w;
        if (r.status === 'pass') { earned += w; pass++; }
        else if (r.status === 'warn') { earned += w * 0.5; warn++; }
        else fail++;
    }
    return { score: max > 0 ? Math.round((earned / max) * 100) : 100, total: rows.length, pass, warn, fail, na };
};

const verificationSummary = (rows) => {
    const s = { automated: { total: 0, pass: 0 }, attestation: { total: 0, pass: 0 }, hybrid: { total: 0, pass: 0 } };
    for (const r of rows) {
        if (r.status === 'not_applicable') continue;
        const v = s[r.verification] ? r.verification : 'automated';
        s[v].total++;
        if (r.status === 'pass') s[v].pass++;
    }
    return s;
};

const OVERVIEW = () => {
    const rows = CHECK_ROWS();
    const forReg = (reg) => rows.filter(r => r.regulation === reg);
    return {
        organization_id: ORG,
        // TRUE, deliberately. ComplianceHub opens the onboarding wizard over
        // the whole hub when this is falsy — a visitor would land on a
        // four-step setup form instead of the thing the page is selling.
        onboarded: true,
        settings: SETTINGS(),
        overall: computeScore(rows),
        gdpr: computeScore(forReg('GDPR')),
        aia: computeScore(forReg('AIA')),
        iso: computeScore(forReg('ISO27001')),
        verification_summary: verificationSummary(rows),
        last_run_at: iso(hours(6)),
        total_checks: rows.length,
        first_scan_ran: false,
        score_formula: {
            weights: SEVERITY_WEIGHT,
            rule: 'score = round(sum(weight × statusFactor) / sum(weight) × 100), where statusFactor is 1.0 (pass), 0.5 (warn), 0 (fail). "not_applicable" rows are excluded from the denominator.',
        },
    };
};

// 90 days of history, drifting up to today's real score rather than ending on
// an invented number — a chart that disagrees with the headline is a bug the
// eye catches immediately.
const SCORE_HISTORY = () => {
    const rows = CHECK_ROWS();
    const end = computeScore(rows).score;
    const gdprEnd = computeScore(rows.filter(r => r.regulation === 'GDPR')).score;
    const aiaEnd = computeScore(rows.filter(r => r.regulation === 'AIA')).score;
    const isoEnd = computeScore(rows.filter(r => r.regulation === 'ISO27001')).score;
    const points = [];
    const STEPS = 13;
    for (let i = STEPS; i >= 0; i--) {
        const t = (STEPS - i) / STEPS;
        // Starts at 54, climbs, with a dip where the supplier check began
        // failing — a monotonic line looks generated.
        const dip = i === 4 ? -6 : 0;
        const at = (from, to) => Math.round(from + (to - from) * t) + dip;
        points.push({
            captured_at: iso(days(i * 7)),
            overall_score: at(54, end),
            gdpr_score: at(61, gdprEnd),
            aia_score: at(40, aiaEnd),
            iso_score: at(38, isoEnd),
        });
    }
    return points;
};

/* ── Data-subject requests ──────────────────────────────────────────── */

const DSR = () => ([
    {
        id: 'dsr_2417', organization_id: ORG,
        subject_email: 'h.veenstra@example.nl', request_type: 'access',
        status: 'in_progress', created_at: iso(days(27)),
        notes: 'Policyholder asking for every message in which their claim was discussed.',
        result_summary: '', pending: true,
    },
    {
        id: 'dsr_2416', organization_id: ORG,
        subject_email: 'a.dekker@example.nl', request_type: 'deletion',
        status: 'pending', created_at: iso(days(9)),
        notes: 'Submitted through the public form on vandael.example/privacy.',
        result_summary: '', pending: true,
    },
    {
        id: 'dsr_2415', organization_id: ORG,
        subject_email: 'r.oosterhuis@example.nl', request_type: 'rectification',
        status: 'fulfilled', created_at: iso(days(34)),
        notes: 'Wrong date of birth in a claim summary.',
        result_summary: 'Corrected in the source record on 14 May and re-indexed. Confirmed by email.',
        pending: false,
    },
    {
        id: 'dsr_2414', organization_id: ORG,
        subject_email: 'broker@example.com', request_type: 'portability',
        status: 'rejected', created_at: iso(days(48)),
        notes: 'Requester could not be identified as the data subject.',
        result_summary: 'Rejected under Art. 12(6): identity not established after two requests for verification.',
        pending: false,
    },
    {
        id: 'dsr_2413', organization_id: ORG,
        subject_email: 'k.smits@example.nl', request_type: 'objection',
        status: 'fulfilled', created_at: iso(days(61)),
        notes: 'Objection to automated triage of a claim.',
        result_summary: 'Automated triage disabled for this policyholder; claims routed to a handler.',
        pending: false,
    },
]);

/* ── Breach register ─────────────────────────────────────────────────
   `deadline_at = detected_at + 72h` — the store's rule (incidentStore.js).
   Computed rather than typed so the countdown on screen is real. */

const incident = (o) => ({
    ...o,
    organization_id: ORG,
    deadline_at: new Date(new Date(o.detected_at).getTime() + hours(72)).toISOString(),
});

const INCIDENTS = () => ([
    incident({
        id: 'inc_31', title: 'Claim summary emailed to the wrong broker',
        description: 'An assistant-drafted summary was sent to a broker address from a different policy. One data subject affected; content included name, policy number and a description of the damage.',
        severity: 'medium', high_risk: false,
        detected_at: iso(hours(19)), occurred_at: iso(hours(26)),
        status: 'assessing',
        authority_notified_at: null, authority_reference: null,
        subjects_notified_at: null, recipients_notified_at: iso(hours(18)),
        notes: 'Recipient confirmed deletion in writing. Assessing whether Art. 33 notification is required.',
    }),
    incident({
        id: 'inc_30', title: 'Shared mailbox credential found in a support ticket',
        description: 'A password for a shared claims mailbox was pasted into a ticket body by a member. Rotated within the hour; access logs show no use from an unknown address.',
        severity: 'high', high_risk: false,
        detected_at: iso(days(12)), occurred_at: iso(days(12) + hours(3)),
        status: 'closed',
        authority_notified_at: null, authority_reference: null,
        subjects_notified_at: null, recipients_notified_at: iso(days(12) - hours(1)),
        notes: 'Assessed as unlikely to result in a risk (Art. 33(1)); documented rather than notified. Credential rotated, mailbox access reviewed.',
    }),
    incident({
        id: 'inc_29', title: 'Misconfigured export exposed a claims folder',
        description: 'A document export ran with the wrong scope and wrote 214 claim files to a folder readable by all staff for 4 days.',
        severity: 'high', high_risk: true,
        detected_at: iso(days(63)), occurred_at: iso(days(67)),
        status: 'closed',
        authority_notified_at: iso(days(62)), authority_reference: 'AP-2026-0043118',
        subjects_notified_at: iso(days(59)), recipients_notified_at: iso(days(63)),
        notes: 'Notified to the Autoriteit Persoonsgegevens within 41 hours. Affected policyholders informed by post.',
    }),
]);

/* ── ROPA ───────────────────────────────────────────────────────────── */

const PROCESSORS = () => ([
    { operator: 'Bee Flow B.V. (self-hosted)', country_code: 'NL', country_name: 'Netherlands', is_eu: true, calls: 18_442, first_seen: iso(days(180)), last_seen: iso(hours(2)) },
    { operator: 'Mistral AI SAS', country_code: 'FR', country_name: 'France', is_eu: true, calls: 9_318, first_seen: iso(days(174)), last_seen: iso(hours(3)) },
    { operator: 'Microsoft Ireland Operations Ltd', country_code: 'IE', country_name: 'Ireland', is_eu: true, calls: 4_106, first_seen: iso(days(151)), last_seen: iso(days(1)) },
    { operator: 'OpenAI, L.L.C.', country_code: 'US', country_name: 'United States', is_eu: false, calls: 1_297, first_seen: iso(days(96)), last_seen: iso(days(2)) },
    { operator: 'Anthropic PBC', country_code: 'US', country_name: 'United States', is_eu: false, calls: 604, first_seen: iso(days(88)), last_seen: iso(days(4)) },
]);

const ACTIVITY_SEEDS = [
    { activity_id: 'agent_claims', name: 'Schadebeoordeling', purpose: 'Drafts a first assessment of a submitted claim against the policy terms, for a handler to check.' },
    { activity_id: 'agent_intake', name: 'Polisintake', purpose: 'Reads an application and extracts the fields a broker would otherwise retype.' },
    { activity_id: 'agent_helpdesk', name: 'Klantenservice-assistent', purpose: 'Answers policyholder questions from the product documentation, with citations.' },
    { activity_id: 'agent_kifid', name: 'Klachtdossier', purpose: 'Assembles the file for a Kifid complaint from the correspondence already on record.' },
];

const ROPA = () => {
    const processors = PROCESSORS();
    const s = SETTINGS();
    return {
        organization_id: ORG,
        controller: { name: 'Van Dael Assurantiën B.V.', dpo_name: s.dpo_name, dpo_email: s.dpo_email, dpo_phone: s.dpo_phone },
        legal_bases: s.legal_bases,
        data_residency: s.data_residency,
        generated_at: iso(0),
        last_reviewed_at: s.ropa_reviewed_at,
        last_reviewed_by: s.ropa_reviewed_by,
        scc_confirmed_operators: s.scc_confirmed_operators,
        activities: ACTIVITY_SEEDS.map(a => ({
            ...a,
            data_categories: ['Conversation content', 'User profile (when supplied)'],
            data_subjects: ['Authenticated users', 'External data subjects whose data is entered into conversations'],
            recipients: 'Processors listed below',
            transfers: processors.filter(p => !p.is_eu).map(p => p.operator),
            retention: `Stored memories: ${s.default_retention_days} days (enforced automatically). Conversation content: not auto-deleted — governed by organisational policy.`,
            security_measures: [
                'Encryption at rest (envelope AES-256-GCM)',
                'Encryption in transit (TLS)',
                'Access logging via guardrail_events',
                'DLP / PII redaction (where enabled)',
            ],
        })),
        processors,
    };
};

/* ── DPIAs ──────────────────────────────────────────────────────────── */

const DPIA = () => ([
    {
        id: 'dpia_4', organization_id: ORG, mode: 'questionnaire', agent_id: 'agent_intake', agent_name: 'Polisintake',
        purpose: 'Extract structured application fields from documents a broker submits.',
        data_categories: 'Name, address, date of birth, policy history. No special categories.',
        automated_decisions: false,
        human_oversight: 'A broker reviews and confirms every extracted field before the application is created.',
        mitigations: 'Runs against the local model; PII redaction on; retention capped at 365 days.',
        risk_level: 'low', risk_reason: 'No decision is taken by the system and no special-category data is processed.',
        status: 'approved', approved_at: iso(days(74)),
    },
    {
        id: 'dpia_3', organization_id: ORG, mode: 'questionnaire', agent_id: 'agent_helpdesk', agent_name: 'Klantenservice-assistent',
        purpose: 'Answer policyholder questions from the published product documentation.',
        data_categories: 'Question text, policy number where the caller supplies it.',
        automated_decisions: false,
        human_oversight: 'Answers are drafted for a service agent, who sends them.',
        mitigations: 'Knowledge scoped to published documentation only; no claim files in retrieval.',
        risk_level: 'low', risk_reason: 'Retrieval is limited to material that is already public.',
        status: 'approved', approved_at: iso(days(66)),
    },
    {
        id: 'dpia_2', organization_id: ORG, mode: 'questionnaire', agent_id: 'agent_kifid', agent_name: 'Klachtdossier',
        purpose: 'Assemble a complaint file from correspondence already on record.',
        data_categories: 'Correspondence, claim history, health information where the complaint concerns a disability policy.',
        automated_decisions: false,
        human_oversight: 'The file is assembled for a complaints officer, who writes the response.',
        mitigations: 'EU-hosted models only for this assistant; access limited to the complaints group.',
        risk_level: 'medium', risk_reason: 'Special-category data can appear in disability complaints, so the residency restriction is doing real work here.',
        status: 'approved', approved_at: iso(days(38)),
    },
]);

/* ── ISO 27001 ──────────────────────────────────────────────────────── */

// Which controls have an SoA decision, and what it is. Everything else is
// still "todo", which is honest for an organisation eight months in.
const SOA_APPROVED = new Set([
    'A.5.1', 'A.5.2', 'A.5.7', 'A.5.9', 'A.5.10', 'A.5.12', 'A.5.15', 'A.5.16', 'A.5.17', 'A.5.18',
    'A.5.23', 'A.5.28', 'A.5.30', 'A.5.34', 'A.6.1', 'A.6.2', 'A.6.3', 'A.6.5', 'A.6.6',
    'A.8.1', 'A.8.2', 'A.8.3', 'A.8.5', 'A.8.7', 'A.8.9', 'A.8.10', 'A.8.12', 'A.8.13',
    'A.8.15', 'A.8.16', 'A.8.20', 'A.8.24',
]);
const SOA_REVIEWED = new Set(['A.5.20', 'A.5.21', 'A.5.24', 'A.5.29', 'A.8.8', 'A.8.28', 'A.8.31', 'A.7.9']);
// Physical controls the organisation does not operate — they sit with the IaaS
// provider. An exclusion has to carry a justification or the row is worthless
// to an auditor, so every excluded control here has one.
const SOA_EXCLUDED = new Set(['A.7.1', 'A.7.2', 'A.7.3', 'A.7.4', 'A.7.5', 'A.7.6', 'A.7.8', 'A.7.11', 'A.7.12', 'A.7.13']);

const CHECKS_BY_CONTROL = () => {
    const byControl = {};
    for (const d of CHECK_DEFS) {
        if (d.regulation !== 'ISO27001') continue;
        // Check ids are ISO27001-<ref>-<slug>; the ref is the middle segment.
        const m = /^ISO27001-(A\.\d+\.\d+)-/.exec(d.check_id);
        if (!m) continue;
        (byControl[m[1]] = byControl[m[1]] || []).push(d.check_id);
    }
    return byControl;
};

const soaEntry = (ref, status) => ({
    control_ref: ref,
    organization_id: ORG,
    applicable: status !== 'excluded',
    status,
    justification: status === 'excluded'
        ? 'Physical premises and media are operated by our IaaS provider (Scaleway, FR). Inherited control; evidenced by the provider’s ISO 27001 certificate.'
        : 'In scope. Implemented and evidenced through the linked automated checks and the ISMS policy set.',
    owner_user_id: status === 'excluded' ? 'u_farah' : 'u_marieke',
    approved_at: status === 'approved' ? iso(days(29)) : null,
    reviewed_at: status === 'todo' ? null : iso(days(29)),
});

const SOA = () => {
    const checksByControl = CHECKS_BY_CONTROL();
    const statusOf = (ref) => (SOA_APPROVED.has(ref) ? 'approved'
        : SOA_REVIEWED.has(ref) ? 'reviewed'
            : SOA_EXCLUDED.has(ref) ? 'excluded' : 'todo');
    const controls = ISO_CONTROLS.map(c => {
        const status = statusOf(c.ref);
        return {
            ref: c.ref, key: c.key, theme: c.theme, bucket: c.bucket,
            titleKey: c.titleKey, objectiveKey: c.objectiveKey,
            checks: checksByControl[c.ref] || [],
            entry: status === 'todo' ? null : soaEntry(c.ref, status),
        };
    });
    return {
        controls,
        stats: {
            total: controls.length,
            approved: SOA_APPROVED.size,
            reviewed: SOA_REVIEWED.size,
            excluded: SOA_EXCLUDED.size,
            todo: controls.length - SOA_APPROVED.size - SOA_REVIEWED.size - SOA_EXCLUDED.size,
        },
        themes: ISO_THEMES,
    };
};

const POLICY_SEEDS = [
    ['isms-scope', 'ISMS scope statement', 'u_marieke'],
    ['information-security-policy', 'Information security policy', 'u_marieke'],
    ['access-control-policy', 'Access control policy', 'u_farah'],
    ['acceptable-use-policy', 'Acceptable use policy', 'u_farah'],
    ['supplier-security-policy', 'Supplier security policy', 'u_joost'],
    ['incident-response-plan', 'Incident response plan', 'u_farah'],
    ['business-continuity-plan', 'Business continuity plan', 'u_joost'],
    ['secure-development-policy', 'Secure development policy', 'u_farah'],
    ['cryptography-policy', 'Cryptography and key management policy', 'u_farah'],
    ['data-retention-policy', 'Data retention and disposal policy', 'u_marieke'],
];

const ISO_DOCS = () => ({
    // Two are still drafts and one review has lapsed. An ISMS in which every
    // policy is published, acknowledged by everyone and in date is not one
    // anybody who does this work would recognise.
    documents: POLICY_SEEDS.map(([slug, title, owner], i) => {
        const published = i < 8;
        return {
            slug, title,
            organization_id: ORG,
            status: published ? 'published' : 'draft',
            current_version: published ? (i === 1 ? 3 : 1) : 0,
            owner_user_id: owner,
            // The supplier policy (i === 4) is 11 days overdue; the rest are
            // spread across the next few months.
            review_due_at: i === 4 ? iso(days(11)) : inDays(38 + i * 21),
            ack_count: published ? [6, 6, 6, 5, 4, 6, 3, 5][i] : 0,
            edited: i === 1,
            updated_at: iso(days(30 + i * 4)),
        };
    }),
    missing_seeds: [],
});

const ISO_READINESS = () => {
    const rows = CHECK_ROWS().filter(r => r.regulation === 'ISO27001');
    const byCheck = Object.fromEntries(rows.map(r => [r.check_id, r.status]));
    const checksByControl = CHECKS_BY_CONTROL();
    const verifiable = ISO_CONTROLS.filter(c => c.bucket === 'auto' || c.bucket === 'connector');
    let verified = 0, failing = 0, unchecked = 0;
    for (const c of verifiable) {
        const statuses = (checksByControl[c.ref] || []).map(id => byCheck[id]).filter(Boolean);
        if (!statuses.length) { unchecked++; continue; }
        if (statuses.includes('fail')) failing++;
        else if (statuses.every(s => s === 'pass' || s === 'not_applicable')) verified++;
    }
    const docs = ISO_DOCS().documents;
    const published = docs.filter(d => d.status === 'published');
    const soa = SOA().stats;
    return {
        controls: { verifiable_total: verifiable.length, verified, failing, unchecked, catalog_total: ISO_CONTROLS.length },
        soa,
        operating_since: iso(days(214)),
        history_points: SCORE_HISTORY().map(h => ({ captured_at: h.captured_at, score: h.iso_score })),
        policies: {
            published: published.length,
            total: docs.length,
            acknowledgements: published.reduce((s, d) => s + (d.ack_count || 0), 0),
        },
        clauses: [
            { clause: '4', title: 'Context of the organisation', status: 'in_place' },
            { clause: '5', title: 'Leadership', status: 'in_place' },
            { clause: '6', title: 'Planning', status: 'in_place' },
            { clause: '7', title: 'Support', status: 'partial' },
            { clause: '8', title: 'Operation', status: 'in_place' },
            { clause: '9', title: 'Performance evaluation', status: 'partial' },
            { clause: '10', title: 'Improvement', status: 'in_place' },
        ],
    };
};

const CONNECTOR_STATE = {
    afas: { enabled: true, last_status: 'ok', connection_id: 'conn_afas_prod' },
    entra: { enabled: true, last_status: 'ok', connection_id: 'conn_entra_prod' },
    'dns-tls': { enabled: true, last_status: 'ok', connection_id: null },
    github: { enabled: true, last_status: 'warn', connection_id: 'conn_github_org', last_error: 'Branch protection is off on 1 of 7 repositories.' },
    jira: { enabled: false, last_status: null, connection_id: null },
};

const ISO_CONNECTOR_ROWS = () => ISO_CONNECTORS.map((c) => {
    const st = CONNECTOR_STATE[c.id];
    return {
        ...c,
        config: st ? {
            enabled: st.enabled,
            connection_id: st.connection_id,
            settings: {},
            last_sweep_at: st.enabled ? iso(hours(9)) : null,
            last_status: st.last_status,
            last_error: st.last_error || null,
        } : null,
        snapshots: [],
    };
});

const RISKS = () => {
    const risks = [
        { id: 'risk_11', title: 'Policyholder data reaches a model outside the EEA', category: 'privacy', description: 'A member selects a US-hosted model for a claim conversation containing health information.', likelihood: 3, impact: 4, status: 'treating', owner_user_id: 'u_marieke', review_due_at: iso(days(34)) },
        { id: 'risk_10', title: 'Supplier without a processing agreement', category: 'supplier', description: 'A processor is in use before the DPA is countersigned.', likelihood: 2, impact: 4, status: 'open', owner_user_id: 'u_joost', review_due_at: inDays(6) },
        { id: 'risk_09', title: 'Assistant output relied on without review', category: 'operational', description: 'A handler treats a drafted claim assessment as a decision rather than a draft.', likelihood: 3, impact: 3, status: 'treating', owner_user_id: 'u_farah', review_due_at: iso(days(12)) },
        { id: 'risk_08', title: 'Shared credential in a support conversation', category: 'access', description: 'Members paste credentials into tickets or chats.', likelihood: 2, impact: 3, status: 'treating', owner_user_id: 'u_farah', review_due_at: iso(days(58)) },
        { id: 'risk_07', title: 'Knowledge base retains documents past their retention period', category: 'privacy', description: 'Source documents outlive the retention policy because deletion is manual.', likelihood: 3, impact: 2, status: 'open', owner_user_id: 'u_marieke', review_due_at: inDays(21) },
        { id: 'risk_06', title: 'Single administrator for the workspace', category: 'operational', description: 'One person holds every administrative permission.', likelihood: 2, impact: 3, status: 'accepted', owner_user_id: 'u_joost', review_due_at: iso(days(90)), accepted_at: iso(days(44)), accepted_by: 'u_joost' },
        { id: 'risk_05', title: 'Laptop loss exposes cached exports', category: 'access', description: 'Exported PDFs are kept in local downloads folders.', likelihood: 2, impact: 2, status: 'closed', owner_user_id: 'u_farah', review_due_at: iso(days(120)) },
    ].map(r => ({
        ...r,
        organization_id: ORG,
        score: r.likelihood * r.impact,
        created_at: iso(days(120)),
    }));
    const treatments = [
        { id: 'rt_5', risk_id: 'risk_11', option: 'reduce', description: 'Model allowlist per assistant; the claims assistants are pinned to EU-hosted models.', due_at: iso(days(20)), done_at: iso(days(22)), owner_user_id: 'u_marieke' },
        { id: 'rt_4', risk_id: 'risk_11', option: 'reduce', description: 'Privacy Shield set to redact health terms before any outbound call.', due_at: inDays(30), done_at: null, owner_user_id: 'u_farah' },
        { id: 'rt_3', risk_id: 'risk_09', option: 'reduce', description: 'Assistant output carries a standing "draft — a handler decides" banner, and the handbook says the same.', due_at: iso(days(9)), done_at: iso(days(10)), owner_user_id: 'u_farah' },
        { id: 'rt_2', risk_id: 'risk_08', option: 'reduce', description: 'Secret detection on outbound messages; credentials are blocked rather than redacted.', due_at: inDays(14), done_at: null, owner_user_id: 'u_farah' },
        { id: 'rt_1', risk_id: 'risk_10', option: 'avoid', description: 'Processor suspended until the agreement is signed.', due_at: inDays(3), done_at: null, owner_user_id: 'u_joost' },
    ];
    const open = risks.filter(r => r.status === 'open' || r.status === 'treating').length;
    return {
        risks,
        treatments,
        stats: {
            total: risks.length,
            open,
            high: risks.filter(r => r.score >= 9 && r.status !== 'closed').length,
            overdue_reviews: risks.filter(r => r.status !== 'closed' && new Date(r.review_due_at).getTime() < now()).length,
        },
    };
};

const AUDIT = () => {
    const audits = [
        { id: 'aud_2', title: 'Internal audit 2026-H1 — Annex A 5, 6 and 8', scope_note: 'Organisational, people and technological controls. Excludes physical (inherited).', auditor_user_id: 'u_joost', status: 'in_progress', planned_at: iso(days(20)), started_at: iso(days(6)), closed_at: null, organization_id: ORG },
        { id: 'aud_1', title: 'Internal audit 2025-H2 — full ISMS', scope_note: 'First full pass after the ISMS went live.', auditor_user_id: 'u_joost', status: 'closed', planned_at: iso(days(190)), started_at: iso(days(178)), closed_at: iso(days(160)), organization_id: ORG },
    ];
    const findings = [
        { id: 'f_4', audit_id: 'aud_2', clause: 'A.5.20', control_ref: 'A.5.20', severity: 'major', description: 'One processor is in use without a signed processing agreement.', evidence_ref: 'Supplier register, row 5', nonconformity_id: 'nc_2', created_at: iso(days(5)) },
        { id: 'f_3', audit_id: 'aud_2', clause: 'A.8.8', control_ref: 'A.8.8', severity: 'minor', description: 'Dependency scanning ran 41 days ago; the policy requires 30.', evidence_ref: 'CI history', nonconformity_id: 'nc_1', created_at: iso(days(5)) },
        { id: 'f_2', audit_id: 'aud_2', clause: '9.3', control_ref: null, severity: 'observation', description: 'Management review minutes record decisions but not the inputs considered.', evidence_ref: 'MR minutes, 12 Feb', nonconformity_id: null, created_at: iso(days(4)) },
        { id: 'f_1', audit_id: 'aud_1', clause: 'A.5.15', control_ref: 'A.5.15', severity: 'minor', description: 'Access review for the claims group was not evidenced.', evidence_ref: 'Access review folder', nonconformity_id: null, created_at: iso(days(170)) },
    ];
    const ncs = [
        { id: 'nc_2', title: 'Processor without a signed agreement', description: 'Raised from internal audit 2026-H1, finding f_4.', severity: 'major', source: 'internal_audit', status: 'corrective_action', owner_user_id: 'u_joost', due_at: iso(days(9)), corrective_action: 'Suspend the processor, countersign the agreement, and add a pre-use gate to the supplier checklist.', effectiveness_review_due_at: inDays(60), effectiveness_confirmed_at: null, effectiveness_confirmed_by: null, closed_at: null, created_at: iso(days(5)) },
        { id: 'nc_1', title: 'Dependency scanning behind policy', description: 'Raised from internal audit 2026-H1, finding f_3.', severity: 'minor', source: 'internal_audit', status: 'effectiveness_review', owner_user_id: 'u_farah', due_at: iso(days(2)), corrective_action: 'Scan moved into the nightly pipeline rather than a manual step.', effectiveness_review_due_at: inDays(45), effectiveness_confirmed_at: null, effectiveness_confirmed_by: null, closed_at: null, created_at: iso(days(5)) },
    ];
    const reviews = [
        { id: 'mr_2', held_at: iso(days(47)), attendees: ['u_marieke', 'u_joost', 'u_farah'], decisions: 'Approved the SoA as it stands. Agreed to bring the supplier register under the same review cycle as the policy set. Next review in Q3.', inputs: {}, organization_id: ORG },
        { id: 'mr_1', held_at: iso(days(168)), attendees: ['u_marieke', 'u_joost'], decisions: 'ISMS scope confirmed. Accepted the single-administrator risk for one cycle with a named deputy to be appointed.', inputs: {}, organization_id: ORG },
    ];
    const objectives = [
        { id: 'obj_3', title: 'Every applicable Annex A control has an approved SoA decision', measure: 'Approved SoA rows / applicable controls', target: '100%', owner_user_id: 'u_marieke', review_due_at: inDays(40), status: 'active' },
        { id: 'obj_2', title: 'No nonconformity open past its due date', measure: 'Overdue nonconformities', target: '0', owner_user_id: 'u_farah', review_due_at: inDays(18), status: 'active' },
        { id: 'obj_1', title: 'All staff attest to the security policy set each year', measure: 'Attestations / personnel', target: '100%', owner_user_id: 'u_joost', review_due_at: iso(days(30)), status: 'achieved' },
    ];
    const soa = SOA().stats;
    const risk = RISKS().stats;
    return {
        audits, findings, reviews, ncs, objectives,
        mr_inputs: {
            score_now: computeScore(CHECK_ROWS()).score,
            score_90d_ago: 54,
            failing_checks: CHECK_ROWS().filter(r => r.status === 'fail').length,
            open_nonconformities: ncs.filter(n => n.status !== 'closed').length,
            open_incidents: INCIDENTS().filter(i => i.status !== 'closed').length,
            risks_open: risk.open,
            risks_high: risk.high,
            soa_approved: `${soa.approved}/${soa.total}`,
            last_internal_audit: audits.filter(a => a.status === 'closed').map(a => a.closed_at).sort().pop() || null,
        },
    };
};

const TRAINING = () => {
    const publishedTotal = ISO_DOCS().documents.filter(d => d.status === 'published').length;
    const rows = [
        ['u_marieke', 8, 6, iso(days(51))],
        ['u_joost', 8, 5, iso(days(49))],
        ['u_farah', 8, 6, iso(days(51))],
        ['u_pieter', 6, 3, null],
        ['u_sanne', 8, 4, iso(days(12))],
        ['u_ruben', 4, 2, null],
    ];
    const byId = Object.fromEntries(ORG_USERS().map(u => [u.id, u]));
    return {
        personnel: rows.map(([id, acks, learning, attested]) => ({
            user_id: id,
            displayName: byId[id].displayName,
            email: byId[id].email,
            policy_acks: acks,
            policy_total: publishedTotal,
            learning_done: learning,
            attested_at: attested,
            attested_note: attested ? 'Read and understood the security policy set.' : null,
        })),
        obligations: [
            { id: 'obl_3', title: 'Annual security awareness refresher', kind: 'training', subject: 'All personnel', owner_user_id: 'u_joost', due_at: iso(days(26)), recur_months: 12, completed_at: null },
            { id: 'obl_2', title: 'Phishing simulation', kind: 'exercise', subject: 'All personnel', owner_user_id: 'u_farah', due_at: iso(days(4)), recur_months: 6, completed_at: null },
            { id: 'obl_1', title: 'Incident response tabletop', kind: 'exercise', subject: 'Security team', owner_user_id: 'u_farah', due_at: inDays(33), recur_months: 12, completed_at: iso(days(2)) },
        ],
    };
};

/* ── Mutable state ──────────────────────────────────────────────────── */

export function createState() {
    return {
        settings: SETTINGS(),
        checks: CHECK_ROWS(),
        dsr: DSR(),
        incidents: INCIDENTS(),
        dpia: DPIA(),
        soa: SOA(),
        docs: ISO_DOCS(),
        connectors: ISO_CONNECTOR_ROWS(),
        risks: RISKS(),
        audit: AUDIT(),
        training: TRAINING(),
    };
}

const ok = () => ({ ok: true });

/* ── Routes ─────────────────────────────────────────────────────────────
   Writes mutate the in-tab state and are gone on reload. They are answered
   rather than 404'd because a compliance screen is mostly buttons — "mark
   reviewed", "record an incident", "attest" — and a demo where every button
   errors teaches a visitor that the product is broken. */

export const ROUTES = {
    'GET /api/compliance/overview': ({ state }) => ({ ...OVERVIEW(), settings: state.settings }),
    'GET /api/compliance/checks': ({ state }) => state.checks,
    'GET /api/compliance/score-history': () => SCORE_HISTORY(),
    'GET /api/compliance/settings': ({ state }) => state.settings,
    'PUT /api/compliance/settings': ({ state, body }) => {
        state.settings = { ...state.settings, ...(body || {}) };
        return state.settings;
    },
    'POST /api/compliance/settings/onboarded': ({ state }) => {
        state.settings = { ...state.settings, onboarded_at: new Date().toISOString() };
        return state.settings;
    },
    'POST /api/compliance/auto-detect-settings': ({ state }) => state.settings,
    'GET /api/compliance/org-users': () => ORG_USERS(),

    // A scan re-runs against the same fictional configuration, so the result
    // is the same list with fresh timestamps — not new random statuses.
    'POST /api/compliance/checks/run': ({ state }) => {
        state.checks = state.checks.map(c => ({ ...c, run_at: new Date().toISOString() }));
        return { ...OVERVIEW(), settings: state.settings };
    },
    'POST /api/compliance/checks/:id/run': ({ state, params }) => {
        state.checks = state.checks.map(c => (c.check_id === params.id ? { ...c, run_at: new Date().toISOString() } : c));
        return ok();
    },
    'POST /api/compliance/checks/:id/auto-fix': ({ state, params }) => {
        state.checks = state.checks.map(c => (c.check_id === params.id
            ? { ...c, status: 'pass', details: 'Fixed from this screen.', run_at: new Date().toISOString() }
            : c));
        return { fixed: true };
    },
    'GET /api/compliance/checks/:id/history': ({ params }) => ([
        { check_id: params.id, status: 'pass', run_at: iso(hours(6)), details: null },
        { check_id: params.id, status: 'pass', run_at: iso(days(7)), details: null },
        { check_id: params.id, status: 'warn', run_at: iso(days(14)), details: 'First observed as a warning.' },
    ]),
    'GET /api/compliance/evidence/:checkId': ({ params }) => ([
        { id: `ev_${params.checkId}_2`, check_id: params.checkId, subject_type: 'check_run', hash: 'a41f…9c02', captured_at: iso(hours(6)) },
        { id: `ev_${params.checkId}_1`, check_id: params.checkId, subject_type: 'check_run', hash: '77bd…10e5', captured_at: iso(days(7)) },
    ]),

    'GET /api/dsr/requests': ({ state }) => state.dsr,
    'POST /api/dsr/requests/:id/fulfil': ({ state, params, body }) => {
        state.dsr = state.dsr.map(r => (r.id === params.id
            ? { ...r, status: body?.status || 'fulfilled', result_summary: body?.result_summary || r.result_summary, pending: false }
            : r));
        return ok();
    },

    'GET /api/compliance/incidents': ({ state }) => state.incidents,
    'POST /api/compliance/incidents': ({ state, body }) => {
        const detected_at = new Date().toISOString();
        const created = incident({
            id: `inc_${32 + state.incidents.length}`,
            title: body?.title || 'Untitled incident',
            description: body?.description || '',
            severity: body?.severity || 'medium',
            high_risk: !!body?.high_risk,
            detected_at,
            occurred_at: body?.occurred_at || detected_at,
            status: 'open',
            authority_notified_at: null, authority_reference: null,
            subjects_notified_at: null, recipients_notified_at: null,
            notes: '',
        });
        state.incidents = [created, ...state.incidents];
        return created;
    },
    'PATCH /api/compliance/incidents/:id': ({ state, params, body }) => {
        state.incidents = state.incidents.map(i => (i.id === params.id ? { ...i, ...(body || {}) } : i));
        return state.incidents.find(i => i.id === params.id);
    },
    'POST /api/compliance/incidents/:id/notify-recipients': ({ state, params }) => {
        const at = new Date().toISOString();
        state.incidents = state.incidents.map(i => (i.id === params.id ? { ...i, recipients_notified_at: at } : i));
        // Nothing is sent from a demo, and saying so beats a silent success.
        return { notified: 0, demo_not_sent: true };
    },

    'GET /api/compliance/ropa': () => ROPA(),
    'POST /api/compliance/ropa/review': ({ state }) => {
        const at = new Date().toISOString();
        state.settings = { ...state.settings, ropa_reviewed_at: at };
        return { ok: true, reviewed_at: at, reviewer: 'u_marieke' };
    },
    'POST /api/compliance/settings/scc': ({ state, body }) => {
        const list = new Set(state.settings.scc_confirmed_operators || []);
        if (body?.confirmed === false) list.delete(body?.operator);
        else list.add(body?.operator);
        state.settings = { ...state.settings, scc_confirmed_operators: [...list] };
        return state.settings;
    },

    'GET /api/compliance/dpia': ({ state }) => state.dpia,
    'GET /api/compliance/dpia/:agentId': ({ state, params }) =>
        state.dpia.find(d => d.agent_id === params.agentId) || null,
    'POST /api/compliance/dpia/:agentId': ({ state, params, body }) => {
        const existing = state.dpia.find(d => d.agent_id === params.agentId);
        const saved = {
            ...(existing || { id: `dpia_${state.dpia.length + 1}`, organization_id: ORG, agent_id: params.agentId }),
            ...(body || {}),
            status: 'approved',
            approved_at: new Date().toISOString(),
        };
        state.dpia = existing
            ? state.dpia.map(d => (d.agent_id === params.agentId ? saved : d))
            : [saved, ...state.dpia];
        return saved;
    },

    'GET /api/compliance/iso/soa': ({ state }) => state.soa,
    'POST /api/compliance/iso/soa/seed': ({ state }) => ({ seeded: state.soa.stats.todo }),
    'PUT /api/compliance/iso/soa/:ref': ({ state, params, body }) => {
        state.soa = {
            ...state.soa,
            controls: state.soa.controls.map(c => (c.ref === params.ref
                ? { ...c, entry: { ...(c.entry || soaEntry(params.ref, 'reviewed')), ...(body || {}) } }
                : c)),
        };
        return state.soa.controls.find(c => c.ref === params.ref)?.entry || null;
    },

    'GET /api/compliance/iso/readiness': () => ISO_READINESS(),

    'GET /api/compliance/iso/docs': ({ state }) => state.docs,
    'GET /api/compliance/iso/docs/:slug': ({ state, params }) => {
        const d = state.docs.documents.find(x => x.slug === params.slug);
        return d ? { ...d, body: DOC_BODY(d), draft_body: d.status === 'draft' ? DOC_BODY(d) : null } : null;
    },
    'PUT /api/compliance/iso/docs/:slug': ({ state, params, body }) => {
        state.docs = {
            ...state.docs,
            documents: state.docs.documents.map(d => (d.slug === params.slug ? { ...d, ...(body || {}), edited: true } : d)),
        };
        return state.docs.documents.find(d => d.slug === params.slug);
    },
    'POST /api/compliance/iso/docs/:slug/publish': ({ state, params }) => {
        state.docs = {
            ...state.docs,
            documents: state.docs.documents.map(d => (d.slug === params.slug
                ? { ...d, status: 'published', current_version: (d.current_version || 0) + 1 }
                : d)),
        };
        return state.docs.documents.find(d => d.slug === params.slug);
    },
    'POST /api/compliance/iso/docs/seed': ({ state }) => ({ seeded: state.docs.missing_seeds.length }),

    'GET /api/compliance/iso/connectors': ({ state }) => state.connectors,
    'GET /api/compliance/iso/connectors/:id/connections': () => ([]),
    'PUT /api/compliance/iso/connectors/:id': ({ state, params, body }) => {
        state.connectors = state.connectors.map(c => (c.id === params.id
            ? { ...c, config: { ...(c.config || { settings: {}, last_sweep_at: null, last_status: null, last_error: null }), ...(body || {}) } }
            : c));
        return state.connectors.find(c => c.id === params.id);
    },
    'POST /api/compliance/iso/connectors/:id/sweep': ({ state, params }) => {
        const at = new Date().toISOString();
        state.connectors = state.connectors.map(c => (c.id === params.id
            ? { ...c, config: { ...(c.config || {}), last_sweep_at: at, last_status: 'ok', last_error: null } }
            : c));
        return { swept: true, at };
    },

    'GET /api/compliance/iso/risks': ({ state }) => state.risks,
    'POST /api/compliance/iso/risks': ({ state, body }) => {
        const r = {
            id: `risk_${12 + state.risks.risks.length}`, organization_id: ORG,
            likelihood: 2, impact: 2, status: 'open', ...(body || {}),
        };
        r.score = (r.likelihood || 0) * (r.impact || 0);
        state.risks = { ...state.risks, risks: [r, ...state.risks.risks] };
        return r;
    },
    'PUT /api/compliance/iso/risks/:id': ({ state, params, body }) => {
        state.risks = {
            ...state.risks,
            risks: state.risks.risks.map(r => {
                if (r.id !== params.id) return r;
                const next = { ...r, ...(body || {}) };
                next.score = (next.likelihood || 0) * (next.impact || 0);
                return next;
            }),
        };
        return state.risks.risks.find(r => r.id === params.id);
    },
    'POST /api/compliance/iso/risks/:id/treatments': ({ state, params, body }) => {
        const t = { id: `rt_${6 + state.risks.treatments.length}`, risk_id: params.id, ...(body || {}) };
        state.risks = { ...state.risks, treatments: [t, ...state.risks.treatments] };
        return t;
    },
    'POST /api/compliance/iso/risks/seed': ({ state }) => ({ seeded: state.risks.risks.length }),

    'GET /api/compliance/iso/audit': ({ state }) => state.audit,
    'GET /api/compliance/iso/audit/independence/:userId': ({ params }) => ({
        // Joost owns no control in the audited scope, so he can audit it.
        independent: params.userId === 'u_joost',
        owns_controls: params.userId === 'u_joost' ? [] : ['A.8.2', 'A.8.15'],
    }),
    'POST /api/compliance/iso/audits': ({ state, body }) => {
        const a = { id: `aud_${3 + state.audit.audits.length}`, status: 'planned', organization_id: ORG, ...(body || {}) };
        state.audit = { ...state.audit, audits: [a, ...state.audit.audits] };
        return a;
    },
    'PUT /api/compliance/iso/audits/:id': ({ state, params, body }) => {
        state.audit = { ...state.audit, audits: state.audit.audits.map(a => (a.id === params.id ? { ...a, ...(body || {}) } : a)) };
        return state.audit.audits.find(a => a.id === params.id);
    },
    'POST /api/compliance/iso/audits/:id/findings': ({ state, params, body }) => {
        const f = { id: `f_${5 + state.audit.findings.length}`, audit_id: params.id, created_at: new Date().toISOString(), ...(body || {}) };
        state.audit = { ...state.audit, findings: [f, ...state.audit.findings] };
        return f;
    },
    'POST /api/compliance/iso/reviews': ({ state, body }) => {
        const r = { id: `mr_${3 + state.audit.reviews.length}`, organization_id: ORG, ...(body || {}) };
        state.audit = { ...state.audit, reviews: [r, ...state.audit.reviews] };
        return r;
    },
    'POST /api/compliance/iso/ncs': ({ state, body }) => {
        const n = { id: `nc_${3 + state.audit.ncs.length}`, status: 'open', created_at: new Date().toISOString(), ...(body || {}) };
        state.audit = { ...state.audit, ncs: [n, ...state.audit.ncs] };
        return n;
    },
    'PUT /api/compliance/iso/ncs/:id': ({ state, params, body }) => {
        state.audit = { ...state.audit, ncs: state.audit.ncs.map(n => (n.id === params.id ? { ...n, ...(body || {}) } : n)) };
        return state.audit.ncs.find(n => n.id === params.id);
    },
    'POST /api/compliance/iso/objectives': ({ state, body }) => {
        const o = { id: `obj_${4 + state.audit.objectives.length}`, status: 'active', ...(body || {}) };
        state.audit = { ...state.audit, objectives: [o, ...state.audit.objectives] };
        return o;
    },
    'PUT /api/compliance/iso/objectives/:id': ({ state, params, body }) => {
        state.audit = { ...state.audit, objectives: state.audit.objectives.map(o => (o.id === params.id ? { ...o, ...(body || {}) } : o)) };
        return state.audit.objectives.find(o => o.id === params.id);
    },

    'GET /api/compliance/iso/training': ({ state }) => state.training,
    'POST /api/compliance/iso/training/:userId/attest': ({ state, params, body }) => {
        const at = new Date().toISOString();
        state.training = {
            ...state.training,
            personnel: state.training.personnel.map(p => (p.user_id === params.userId
                ? { ...p, attested_at: at, attested_note: body?.note || '' }
                : p)),
        };
        return ok();
    },
    'POST /api/compliance/iso/obligations': ({ state, body }) => {
        const o = { id: `obl_${4 + state.training.obligations.length}`, completed_at: null, ...(body || {}) };
        state.training = { ...state.training, obligations: [o, ...state.training.obligations] };
        return o;
    },
    'POST /api/compliance/iso/obligations/:id/complete': ({ state, params }) => {
        const at = new Date().toISOString();
        state.training = {
            ...state.training,
            obligations: state.training.obligations.map(o => (o.id === params.id ? { ...o, completed_at: at } : o)),
        };
        return ok();
    },
};

// Policy bodies are one short, real-sounding paragraph each rather than lorem:
// a visitor who opens a policy should see something an ISMS would actually
// contain, and something obviously specific to this fictional company.
function DOC_BODY(doc) {
    return [
        `# ${doc.title}`,
        '',
        `**Owner:** ${(ORG_USERS().find(u => u.id === doc.owner_user_id) || {}).displayName || 'unassigned'}  `,
        `**Status:** ${doc.status === 'published' ? `published, version ${doc.current_version}` : 'draft'}`,
        '',
        '## Scope',
        '',
        'This document applies to Van Dael Assurantiën B.V. and to every system used to advise on, sell or administer insurance for our clients, including the AI workspace.',
        '',
        '## Policy',
        '',
        'Requirements are stated here in full in the real document. This copy is shortened for the public demo.',
        '',
        '## Review',
        '',
        'Reviewed at least annually by the owner named above, and after any incident classed as high risk.',
    ].join('\n');
}
