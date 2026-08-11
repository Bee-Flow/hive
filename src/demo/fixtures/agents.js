/**
 * Fixtures for the Agent editor demo.
 *
 * A small team of assistants an organisation would plausibly have built, with
 * the LinkedIn writer opened by default so a visitor lands on a filled-in
 * editor — role description, instructions, model tier, attached skills — and
 * not on the empty "create your first agent" wizard.
 *
 * Instructions are written in Dutch on the two Dutch-facing assistants
 * because that is what a real Dutch team's prompt looks like; the product is
 * language-agnostic and it is more honest than pretending everything is
 * authored in English.
 *
 * Every agent, skill and knowledge base named here is invented.
 */

import { COMMON_ROUTES, daysAgo } from './common';

/**
 * BuilderSplit reads the agent as SNAKE_CASE top-level fields —
 * `initialAgent.system_prompt`, `.category_id`, `.starter_prompts`,
 * `.embed_enabled`, `.shared_groups`, `.rev` — not from a nested `config`.
 * A camelCase `config.systemPrompt` fixture left the Instructions box showing
 * its placeholder while everything around it looked correct, which reads as
 * "the demo has no content" rather than "the fixture used the wrong key".
 */
function agent({ id, name, description, avatar, model, systemPrompt, category = null, published = false, createdAt, updatedAt }) {
    return {
        id,
        name,
        description,
        avatar,
        model,
        system_prompt: systemPrompt,
        category_id: category,
        // The chips a user sees before they type anything. An empty list made
        // the panel look half-built; these also demonstrate what a good
        // starter prompt is — a task, not a greeting.
        starter_prompts: [
            'Schrijf een post over onze nieuwe integratie met Microsoft 365',
            'Herschrijf deze tekst korter en zonder jargon',
            'Bedenk drie invalshoeken voor een post over dataveiligheid',
        ],
        shared_groups: [],
        embed_enabled: false,
        threads_enabled: true,
        workspace_enabled: false,
        is_published: published,
        rev: 1,
        created_at: createdAt,
        updated_at: updatedAt,
        // Kept because the list card and a few older call sites read these.
        config: { avatar, systemPrompt, temperature: 0.7, maxTokens: 2048 },
    };
}

const LINKEDIN_AGENT_ID = 'agent_demo_linkedin';

const AGENTS = () => ([
    agent({
        id: LINKEDIN_AGENT_ID,
        name: 'LinkedIn Schrijver',
        description: 'Ik help je pakkende LinkedIn-posts te schrijven en verbeteren, afgestemd op jullie merkstem en doelgroep.',
        avatar: '\u270D\uFE0F',
        model: 'fast',
        systemPrompt: [
            'Je bent de LinkedIn-contentschrijver voor ons bedrijf. Je helpt bij het schrijven en verbeteren van LinkedIn-posts die passen bij onze merkstem: professioneel, toegankelijk en energiek.',
            '',
            'Vraag door naar het onderwerp, de doelgroep en het gewenste doel van de post (bijv. naamsbekendheid, engagement, thought leadership) als dit niet duidelijk is.',
            '',
            'Schrijf posts met een sterke opening (hook), een heldere kern met concrete waarde, en een duidelijke call-to-action. Gebruik geen overdreven jargon of clich\u00e9s, en vermijd overmatig gebruik van hashtags of emoji\'s tenzij expliciet gevraagd.',
            '',
            'Blijf altijd binnen de scope van LinkedIn-contentcreatie.',
        ].join('\n'),
        createdAt: daysAgo(38),
        updatedAt: daysAgo(2),
    }),
    agent({
        id: 'agent_demo_contracts',
        name: 'Contractvragen',
        description: 'Beantwoordt vragen over onze eigen contracten en algemene voorwaarden, met bronvermelding.',
        avatar: '\uD83D\uDCC4',
        model: 'standard',
        published: true,
        systemPrompt: 'Je beantwoordt vragen over onze contracten uitsluitend op basis van de aangesloten kennisbank. Citeer altijd de clausule waarop je je baseert. Als het antwoord niet in de bronnen staat, zeg dat dan expliciet in plaats van te gokken.',
        createdAt: daysAgo(96),
        updatedAt: daysAgo(11),
    }),
    agent({
        id: 'agent_demo_onboarding',
        name: 'Onboarding buddy',
        description: 'Answers the questions every new colleague asks in their first two weeks.',
        avatar: '\uD83E\uDDED',
        model: 'fast',
        published: true,
        systemPrompt: 'You help new colleagues find their way. Answer from the handbook knowledge base, keep it short, and link to the source page. If something looks out of date, say so rather than repeating it confidently.',
        createdAt: daysAgo(150),
        updatedAt: daysAgo(30),
    }),
]);

const SKILLS = () => ([
    { id: 'skill_demo_tone', name: 'Merkstem', description: 'Onze schrijfregels: actief, concreet, geen superlatieven.', updatedAt: daysAgo(20) },
    { id: 'skill_demo_review', name: 'Post-review checklist', description: 'Loopt een concept na op hook, waarde en call-to-action.', updatedAt: daysAgo(41) },
]);

const KBS = () => ([
    { id: 'kb_demo_brand', name: 'Merk & tone of voice', documentCount: 12, chunkCount: 148, updatedAt: daysAgo(20) },
    { id: 'kb_demo_contracts', name: 'Contracten', documentCount: 87, chunkCount: 2431, updatedAt: daysAgo(4) },
    { id: 'kb_demo_handbook', name: 'Personeelshandboek', documentCount: 34, chunkCount: 612, updatedAt: daysAgo(66) },
]);

export function createState() {
    return { agents: AGENTS(), skills: SKILLS(), kbs: KBS() };
}

/**
 * Rewrite an instruction block from a plain-language request.
 *
 * Deterministic and small on purpose — the demo has no model. It recognises a
 * few common asks so the change reads as considered rather than random, and
 * otherwise appends the request as an explicit rule, which is what a careful
 * human editor would do with an instruction they did not want to lose.
 */
function refineInstructions(currentPrompt, ask) {
    const base = String(currentPrompt || '').trimEnd();
    const lower = ask.toLowerCase();
    if (!ask) return base;

    const RULES = [
        {
            match: /nederlands|dutch|in het nl/,
            line: 'Antwoord altijd in het Nederlands, tenzij de gebruiker expliciet om een andere taal vraagt.',
        },
        {
            match: /vriendelijk|friendly|informal|warmer|toon|tone/,
            line: 'Houd de toon warm en toegankelijk: schrijf zoals een behulpzame collega, zonder joviaal of populair te worden.',
        },
        {
            match: /samenvat|summar|afsluit|conclusion/,
            line: 'Sluit elk antwoord af met een korte samenvatting van maximaal twee zinnen.',
        },
        {
            match: /kort|beknopt|concise|shorter|brief/,
            line: 'Houd antwoorden beknopt: kom meteen ter zake en laat opvulzinnen weg.',
        },
        {
            match: /bron|citat|cite|source/,
            line: 'Vermeld bij elke feitelijke bewering de bron waarop je je baseert; als die er niet is, zeg dat expliciet.',
        },
    ];

    const hit = RULES.find(r => r.match.test(lower));
    const addition = hit ? hit.line : `${ask.charAt(0).toUpperCase()}${ask.slice(1)}`;

    // Idempotent: asking twice must not duplicate the rule.
    if (base.includes(addition)) return base;
    return `${base}\n\n${addition}`;
}

const find = (list, id) => list.find(x => x.id === id) || null;
const notFound = () => new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });

export const ROUTES = {
    ...COMMON_ROUTES,

    // AgentStudio reads a bare array here, not an envelope.
    'GET /agents/all': ({ state }) => state.agents,
    'GET /agents/system': () => [],
    'GET /agents/:id': ({ state, params }) => find(state.agents, params.id) || notFound(),
    'PUT /agents/:id': ({ state, params, body }) => {
        const a = find(state.agents, params.id);
        if (!a) return notFound();
        Object.assign(a, body || {});
        a.updatedAt = new Date().toISOString();
        return { success: true, agent: a };
    },
    'POST /agents': ({ state, body }) => {
        const created = {
            ...AGENTS()[0],
            id: `agent_demo_new_${state.agents.length + 1}`,
            name: body?.name || 'New assistant',
            description: body?.description || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        state.agents.unshift(created);
        return { success: true, agent: created };
    },
    'DELETE /agents/:id': ({ state, params }) => {
        state.agents = state.agents.filter(a => a.id !== params.id);
        return { success: true };
    },

    // ── Editor bootstrap ──
    // These four return BARE ARRAYS, not envelopes — AgentEditorBootstrapContext
    // does `setAllSkills(await res.json())` and the consumers then call
    // `.map` on it directly. Wrapping them crashes the editor with
    // "(x || []).map is not a function", which an envelope-shaped fixture
    // makes look like a component bug rather than a fixture one.
    'GET /api/skills': ({ state }) => state.skills,
    'GET /agents/categories': () => ([
        { id: 'cat_legal', name: 'Legal' },
        { id: 'cat_hr', name: 'HR' },
        { id: 'cat_marketing', name: 'Marketing' },
    ]),
    'GET /api/knowledge': ({ state }) => state.kbs,
    // BuilderSplit does setAllKbs(await res.json()) — bare array again.
    'GET /api/kb': ({ state }) => state.kbs,
    'GET /api/kb/categories': () => ([
        { id: 'kbc_internal', name: 'Internal', icon: 'Building2' },
        { id: 'kbc_product', name: 'Product', icon: 'Package' },
        { id: 'kbc_commercial', name: 'Commercial', icon: 'Handshake' },
    ]),

    // The editor offers routines to attach; an empty list renders its real
    // empty state rather than a 404-shaped hole.
    'GET /api/automation': () => ({ automations: [] }),
    'GET /api/ai-tasks': () => ({
        tasks: [
            { id: 'auto_demo_spend_report', name: 'Weekly AI/SaaS spend report', enabled: true, schedule: 'Mon 07:30' },
            { id: 'auto_demo_competitors', name: 'Competitor changes digest', enabled: true, schedule: 'Mon 08:00' },
            { id: 'auto_demo_tender_watch', name: 'Tender watch — new publications', enabled: false, schedule: 'Daily 06:00' },
        ],
        maxTasks: 25,
    }),

    // ── Refine ──
    // The editor's chat pane posts here and folds `plan` back into the agent
    // via mergeRefinedPlan, so returning a real plan makes the Instructions
    // box visibly rewrite itself — which is the whole point of the pane. A
    // 404 here surfaced as a red "Not available in the demo" and taught a
    // visitor nothing.
    //
    // The rewrite is deterministic string work, not a model: a handful of
    // recognised intents plus a generic "append it as a rule" fallback. The
    // reply says so rather than implying an LLM ran.
    'POST /agents/wizard/refine': ({ body }) => {
        const plan = body?.plan || {};
        const current = body?.current || {};
        const ask = String(body?.refinement || '').trim();

        return {
            plan: {
                name: plan.name || '',
                description: plan.description || '',
                avatar: plan.avatar || '',
                systemPrompt: refineInstructions(plan.systemPrompt || '', ask),
                capabilities: Array.isArray(plan.capabilities) ? plan.capabilities : [],
            },
            // Echoed verbatim: the merge treats these as "do not touch", which
            // is what stops a tone tweak from wiping the model or the skills.
            preserved: {
                model: current.model ?? null,
                enabledIntegrations: current.enabledIntegrations || [],
                attachedSkills: current.attachedSkills || [],
                knowledge_base_ids: current.knowledge_base_ids || [],
            },
        };
    },
};
