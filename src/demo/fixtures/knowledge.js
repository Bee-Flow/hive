/**
 * Fixtures for the Knowledge bases (kennisbank) demo.
 *
 * Seven knowledge bases across four categories, with realistic document
 * counts, and one of them — Product documentation — filled in far enough that
 * opening it shows the real detail view: documents, their chunk counts, the
 * chunks themselves and a retrieval search that returns cited passages.
 *
 * The bases are named after the kinds of material an organisation actually
 * indexes — policies, product documentation, tender history, Dutch legal
 * sources — but the documents are invented and no real content is included.
 *
 * TWO TRAPS THIS FILE EXISTS TO AVOID, both of which shipped:
 *
 * 1. ICONS ARE EMOJI, NOT LUCIDE NAMES. KBsStudio renders the icon as TEXT —
 *    `<span>{kb.icon || '📚'}</span>` — with an image only when the value is a
 *    data: or http: URL. The fixture used to supply Lucide component names
 *    ('BookOpen', 'ShieldCheck'), so the sidebar literally read "BookOpen
 *    Employee handbook". Same for categories, which render as
 *    `${c.icon} ${c.name}` inside an <option>.
 *
 * 2. THE LIST AND THE DETAIL VIEW ARE DIFFERENT ENDPOINTS. The sidebar comes
 *    from `GET /api/kb`, but opening a base calls `GET /api/kb/:id` — which
 *    the fixture did not answer. The transport failed closed with a 404 and
 *    KBDetailPage turns a 404 into `setKb(null)`, i.e. "Knowledge base not
 *    found". A full sidebar next to that message is worse than no demo.
 *
 * Route ORDER matters here: `GET /api/kb/categories` must be declared before
 * `GET /api/kb/:id` or the matcher (first match wins) resolves "categories"
 * as an id.
 */

import { COMMON_ROUTES, daysAgo } from './common';

const ORG = 'org_demo_vandael';

const CATEGORIES = () => ([
    { id: 'kbc_internal', name: 'Internal', icon: '🏢' },
    { id: 'kbc_product', name: 'Product', icon: '📦' },
    { id: 'kbc_commercial', name: 'Commercial', icon: '🤝' },
    { id: 'kbc_legal', name: 'Legal & compliance', icon: '⚖️' },
]);

/**
 * One document row as the detail view reads it: `title`, `source_type` (drives
 * the emoji), `chunk_count` and `created_at`. `content` is not part of the
 * server's row — it is here so the chunks endpoint below can cut real text
 * instead of lorem.
 *
 * `chunk_count` is DERIVED from that text, and the KB's `document_count` and
 * `total_chunks` are derived from the documents, because the detail view puts
 * the count and the list on the same screen: a header reading "212 documents"
 * above eight rows, or "28 chunks" above two, is a number the visitor can see
 * is wrong. Same rule the monitoring fixture follows.
 */
const doc = (id, title, source_type, ageDays, content) => ({
    id, title, source_type,
    chunk_count: splitChunks(content).length,
    created_at: daysAgo(ageDays),
    content,
});

/** One chunk per paragraph — the split the chunks endpoint below also uses. */
const splitChunks = (text) => String(text || '').split(/\n\n+/).filter(Boolean);

const PRODUCT_DOCS = () => ([
    doc('kbd_install', 'Installation guide — self-hosted', 'upload', 12,
        'Bee Flow runs as a set of containers behind a single reverse proxy. The minimum profile is the API, the frontend and PostgreSQL with pgvector; the guard, reranker and transcription services are optional profiles you enable when you need them.\n\nThe installer provisions three databases and writes a key file that is never transmitted. Back that file up before you take the stack into production: without it, envelope-encrypted content cannot be recovered.'),
    doc('kbd_models', 'Configuring model providers', 'upload', 12,
        'A provider is configured once per organisation and then referenced by tier. Anthropic, OpenAI, Google, Google Vertex, Azure OpenAI and Mistral have first-party adapters; anything else that speaks the OpenAI chat-completions protocol can be added as a custom endpoint, including a model running on your own hardware.\n\nTiers exist so a change of provider does not mean editing every assistant. Point the "balanced" tier somewhere else and every assistant that asked for "balanced" follows.'),
    doc('kbd_rag', 'How retrieval works', 'upload', 26,
        'A document is split into chunks at semantic boundaries rather than at a fixed character count, embedded, and stored with its source reference. At query time the question is embedded, the nearest chunks are retrieved, and a cross-encoder re-ranks them before any of it reaches a model.\n\nEvery answer carries the chunks it used. An answer with no retrievable source is reported as such instead of being written anyway.'),
    doc('kbd_privacy', 'Privacy Shield reference', 'upload', 40,
        'The shield inspects a message after it leaves the browser and before it reaches a provider. Detected values are replaced with placeholders of the form [email_1]; the mapping is held for the duration of the request and used to restore the real values in the reply.\n\nWhen the detector cannot be reached the shield fails closed by default: the message is not sent.'),
    doc('kbd_release', 'Upgrade and rollback', 'web', 55,
        'Images are tagged per channel. An upgrade is a pull and a recreate; migrations run on boot and are idempotent. Roll back by pinning the previous tag — the schema is forward-compatible within a minor version.'),
    doc('kbd_api', 'API reference — agents and automations', 'web', 61,
        'Every surface in the product is an HTTP API with the same authentication and the same permission model. An automation step that calls the API is subject to the caller\'s grants, not the automation author\'s.'),
    doc('kbd_faq', 'Frequently asked questions', 'text', 74,
        'Does an assistant see documents the person asking cannot open? No. Retrieval is filtered by the same audience rules that govern the knowledge base itself, before the model is called.'),
    doc('kbd_glossary', 'Glossary', 'text', 74,
        'Assistant — a configured model with instructions, skills and knowledge. Routine — a saved sequence of steps that can run on a trigger. Skill — reusable instructions an assistant pulls in on demand.'),
]);

const HANDBOOK_DOCS = () => ([
    doc('kbd_hb_leave', 'Leave and absence', 'upload', 92, 'Statutory leave accrues per calendar year. Requests go to your team lead; absence is reported before 09:00 on the first day.'),
    doc('kbd_hb_expenses', 'Expenses and travel', 'upload', 92, 'Second-class rail is the default for domestic travel. Receipts are submitted within thirty days.'),
    doc('kbd_hb_conduct', 'Code of conduct', 'upload', 130, 'The confidential adviser can be approached directly and without involving your manager.'),
]);

const GENERIC_DOCS = (prefix, subject) => ([
    doc(`${prefix}_1`, 'Overview', 'upload', 44,
        `An overview of ${subject}. Sample content only — the point of this base in the demo is that it exists, is categorised, and is reachable.`),
    doc(`${prefix}_2`, 'Reference', 'upload', 70,
        `Reference material for ${subject}. Sample content only.`),
]);

const KBS = () => ([
    {
        id: 'kb_demo_handbook', name: 'Employee handbook', icon: '📕',
        description: 'HR policies, leave, expenses and the code of conduct.',
        category_id: 'kbc_internal',
        documents: HANDBOOK_DOCS(),
    },
    {
        id: 'kb_demo_itpolicy', name: 'IT and security policies', icon: '🛡️',
        description: 'Acceptable use, access control, incident response.',
        category_id: 'kbc_internal',
        documents: GENERIC_DOCS('kbd_it', 'the IT and security policy set'),
    },
    {
        id: 'kb_demo_productdocs', name: 'Product documentation', icon: '📘',
        description: 'Everything the product ships with: installation, configuration, retrieval, the API.',
        category_id: 'kbc_product',
        documents: PRODUCT_DOCS(),
    },
    {
        id: 'kb_demo_releasenotes', name: 'Release notes archive', icon: '🗒️',
        description: 'Every release note since the first public build.',
        category_id: 'kbc_product',
        documents: GENERIC_DOCS('kbd_rel', 'the release history'),
    },
    {
        id: 'kb_demo_tenders', name: 'Tender answer library', icon: '📋',
        description: 'Answers written for earlier tenders, reusable with review.',
        category_id: 'kbc_commercial',
        documents: GENERIC_DOCS('kbd_tnd', 'previously submitted tender answers'),
    },
    {
        id: 'kb_demo_contracts', name: 'Standard contract positions', icon: '🖋️',
        description: 'Fallback positions per clause, with the reasoning behind them.',
        category_id: 'kbc_legal',
        documents: GENERIC_DOCS('kbd_con', 'standard contract positions'),
    },
    {
        id: 'kb_demo_dutchlaw', name: 'Nederlandse juridische bronnen', icon: '🏛️',
        description: 'Wetteksten en jurisprudentie, met bronvermelding.',
        category_id: 'kbc_legal',
        documents: GENERIC_DOCS('kbd_nl', 'Nederlandse wetteksten en jurisprudentie'),
    },
].map(kb => ({
    ...kb,
    organization_id: ORG,
    is_published: true,
    // Counted, never typed. The sidebar badge, the "N documents · M chunks"
    // header and the list underneath it are all on screen at once.
    document_count: kb.documents.length,
    doc_count: kb.documents.length,
    total_chunks: kb.documents.reduce((s, d) => s + d.chunk_count, 0),
    // KBDetailPage parses this one as JSON, not as an array.
    shared_groups: '[]',
    usage_contexts: ['agent', 'direct_chat'],
})));

/** The sidebar list must not carry the document bodies — the real list endpoint doesn't. */
const listRow = ({ documents: _docs, ...rest }) => rest;

/**
 * Chunks for a document: the real endpoint returns pre-split passages, so the
 * demo splits the document text on blank lines rather than inventing chunk
 * text that says nothing.
 */
const chunksFor = (document) => splitChunks(document.content)
    .map((content, i) => ({ chunk_id: i, chunk_type: 'content', lang: 'en', content }));

export function createState() {
    return { kbs: KBS(), categories: CATEGORIES() };
}

const findKb = (state, id) => state.kbs.find(k => k.id === id) || null;

export const ROUTES = {
    ...COMMON_ROUTES,

    // KBsStudio accepts either a bare array or `{ kbs }`; the bare array is
    // what the real endpoint returns, so that is what the demo returns too.
    'GET /api/kb': ({ state }) => state.kbs.map(listRow),

    // BEFORE the `:id` route — first match wins, and "categories" is not an id.
    'GET /api/kb/categories': ({ state }) => state.categories,
    'GET /api/kb/n8n/ingestible': () => ([]),

    'GET /api/kb/:id': ({ state, params }) => findKb(state, params.id),
    'GET /api/kb/:id/documents': ({ state, params }) => (findKb(state, params.id)?.documents || []),
    'GET /api/kb/:id/documents/:docId/chunks': ({ state, params }) => {
        const d = (findKb(state, params.id)?.documents || []).find(x => x.id === params.docId);
        return { chunks: d ? chunksFor(d) : [], remote_only: false };
    },

    /**
     * Retrieval, honestly labelled. The product embeds the question and
     * re-ranks with a cross-encoder; this scores by term overlap so the demo
     * can run with no network and no model. What is real is the SHAPE of an
     * answer: a passage, the document it came from, and a score — the point
     * being that an answer here always carries its source.
     */
    'POST /api/kb/search': ({ state, body }) => {
        const query = String(body?.query || '').toLowerCase();
        const terms = query.split(/\W+/).filter(w => w.length > 3);
        const ids = Array.isArray(body?.kb_ids) ? body.kb_ids : [];
        const pool = state.kbs.filter(k => !ids.length || ids.includes(k.id));
        const scored = [];
        for (const kb of pool) {
            for (const d of kb.documents || []) {
                for (const c of chunksFor(d)) {
                    const hay = c.content.toLowerCase();
                    const hits = terms.filter(term => hay.includes(term)).length;
                    if (!hits) continue;
                    scored.push({
                        id: `${d.id}#${c.chunk_id}`,
                        document_id: d.id,
                        chunk_id: c.chunk_id,
                        title: d.title,
                        source_uri: `${kb.name} · ${d.title}`,
                        score: Math.min(0.99, 0.42 + hits * 0.17),
                        content: c.content,
                    });
                }
            }
        }
        scored.sort((a, b) => b.score - a.score);
        return { chunks: scored.slice(0, body?.top_k || 8) };
    },

    'POST /api/kb': ({ state, body }) => {
        const created = {
            id: `kb_demo_new_${state.kbs.length + 1}`,
            name: body?.name || 'New knowledge base',
            icon: body?.icon || '📚',
            description: body?.description || '',
            category_id: body?.category_id || null,
            organization_id: ORG,
            is_published: false,
            shared_groups: '[]',
            usage_contexts: ['agent', 'direct_chat'],
            document_count: 0,
            doc_count: 0,
            total_chunks: 0,
            documents: [],
        };
        state.kbs.push(created);
        return created;
    },

    'PUT /api/kb/:id': ({ state, params, body }) => {
        const kb = findKb(state, params.id);
        if (kb) Object.assign(kb, body || {});
        return kb || {};
    },

    'DELETE /api/kb/:id': ({ state, params }) => {
        const i = state.kbs.findIndex(k => k.id === params.id);
        if (i >= 0) state.kbs.splice(i, 1);
        return { ok: true };
    },

    'POST /api/kb/categories': ({ state, body }) => {
        const created = {
            id: `kbc_demo_new_${state.categories.length + 1}`,
            name: body?.name || 'New category',
            icon: body?.icon || '📁',
        };
        state.categories.push(created);
        return created;
    },
};
