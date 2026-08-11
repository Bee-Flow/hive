/**
 * Fixtures for the Notebooks demo.
 *
 * A notebook is sources + a document + a chat that answers from those
 * sources. The demo ships one finished notebook — a tender response assembled
 * from six documents — so a visitor sees the editor with real content and a
 * populated source list rather than an empty page and an upload button.
 *
 * All sources, text and citations are invented.
 */

import { COMMON_ROUTES, daysAgo } from './common';

const NOTEBOOK_ID = 'nb_demo_tender';

// The page reads `name`, `type`, `status`, `wordCount` and `hasContent` —
// `title` is carried too because the citation components use that one.
const source = (id, name, type, wordCount) => ({
    id, name, title: name, type, status: 'ready',
    wordCount, hasContent: true, error: null, stage: 'ready',
    storageKey: null, metadata: {}, addedAt: daysAgo(12),
});

const SOURCES = () => ([
    source('src_1', 'Aanbestedingsleidraad 2026-114.pdf', 'pdf', 14820),
    source('src_2', 'Programma van eisen.docx', 'docx', 6410),
    source('src_3', 'Nota van inlichtingen (ronde 1).pdf', 'pdf', 3180),
    source('src_4', 'Onze referentieprojecten.xlsx', 'xlsx', 940),
    source('src_5', 'ISO 27001 certificaat.pdf', 'pdf', 610),
    source('src_6', 'Verwerkersovereenkomst (concept).docx', 'docx', 4275),
]);

const DOCUMENT_HTML = `
<h1>Tender 2026-114 — conceptantwoord</h1>
<p><em>Samengesteld uit zes brondocumenten. Elke bewering hieronder is aanklikbaar naar de bron.</em></p>

<h2>1. Begrip van de opdracht</h2>
<p>De aanbestedende dienst vraagt om een privacy-vriendelijke AI-werkplek voor circa 400 medewerkers,
met verwerking binnen de EU en aantoonbare controle over de dataverwerking. De leidraad stelt dit als
knock-outcriterium, niet als wens.</p>

<h2>2. Harde eisen en waar wij op staan</h2>
<ul>
  <li><strong>EU-dataresidentie</strong> — vereist. Wij draaien volledig binnen de door de klant gekozen regio.</li>
  <li><strong>ISO 27001</strong> — vereist. Certificaat bijgevoegd, geldig tot maart 2027.</li>
  <li><strong>Verwerkersovereenkomst</strong> — de concepttekst wijkt op twee punten af van onze standaard;
      zie paragraaf 6.</li>
  <li><strong>Doorlooptijd implementatie</strong> — maximaal acht weken. Haalbaar op basis van de twee
      referentieprojecten van vergelijkbare omvang.</li>
</ul>

<h2>3. Open punten voor de tweede nota van inlichtingen</h2>
<ol>
  <li>Wordt onder “verwerking binnen de EU” ook back-up en logging begrepen?</li>
  <li>Is een zelf-gehoste variant toegestaan, of moet het een SaaS-dienst zijn?</li>
  <li>Wie is verwerkingsverantwoordelijke voor de gespreksdata van medewerkers?</li>
</ol>

<h2>4. Risico’s</h2>
<p>Het grootste risico zit niet in de techniek maar in de planning: de nota van inlichtingen sluit
elf dagen vóór de inschrijfdatum, terwijl twee van de drie open punten de scope raken.</p>
`.trim();

const CHAT = () => ([
    {
        id: 'msg_1',
        role: 'user',
        content: 'Welke eisen zijn knock-out en welke zijn wensen?',
        createdAt: daysAgo(4),
    },
    {
        id: 'msg_2',
        role: 'assistant',
        createdAt: daysAgo(4),
        content: [
            'Vier eisen zijn knock-out (uitsluitingsgrond bij niet-voldoen):',
            '',
            '1. Verwerking binnen de EU — leidraad §3.2 [1]',
            '2. ISO 27001 of gelijkwaardig — leidraad §3.4 [1]',
            '3. Ondertekende verwerkersovereenkomst vóór gunning — PvE §7 [2]',
            '4. Implementatie binnen acht weken na gunning — PvE §9 [2]',
            '',
            'De rest van §4 van het PvE is geformuleerd als wens en wordt gescoord, niet uitgesloten. ',
            'Let op: in de nota van inlichtingen is vraag 14 beantwoord met “EU omvat ook back-up en ',
            'logging” — dat maakt back-upregio onderdeel van de knock-out. [3]',
        ].join('\n'),
        citations: [
            { index: 1, sourceId: 'src_1', title: 'Aanbestedingsleidraad 2026-114.pdf', page: 11 },
            { index: 2, sourceId: 'src_2', title: 'Programma van eisen.docx', page: 6 },
            { index: 3, sourceId: 'src_3', title: 'Nota van inlichtingen (ronde 1).pdf', page: 4 },
        ],
    },
]);

function notebook() {
    return {
        id: NOTEBOOK_ID,
        // NotebooksPage filters on `nb.name` and renders `selected.name`;
        // a `title`-only fixture crashed the list with
        // "Cannot read properties of undefined (reading 'toLowerCase')".
        name: 'Tender 2026-114 — privacy-vriendelijke AI-werkplek',
        title: 'Tender 2026-114 — privacy-vriendelijke AI-werkplek',
        description: 'Zes brondocumenten, één conceptantwoord, met bronvermelding per bewering.',
        // NotebooksPage reads `data.notebook.documentContent` when it opens a
        // notebook; `content`/`html` are carried for the list preview only. A
        // fixture without documentContent opens to a blank editor and the
        // preview says "This notebook is empty".
        documentContent: DOCUMENT_HTML,
        content: DOCUMENT_HTML,
        html: DOCUMENT_HTML,
        sources: SOURCES(),
        messages: CHAT(),
        ownerId: 'demo-user',
        isOwner: true,
        version: 1,
        pinnedAt: null,
        createdAt: daysAgo(12),
        updatedAt: daysAgo(4),
    };
}

function siblings() {
    const base = notebook();
    return [
        // Exactly one sibling is pinned so the pin affordance is visible on
        // the demo grid without every card carrying it.
        { ...base, id: 'nb_demo_research', name: 'Marktverkenning EU AI-leveranciers', title: 'Marktverkenning EU AI-leveranciers', description: 'Wie levert wat, en onder welke licentie.', sources: SOURCES().slice(0, 3), messages: [], pinnedAt: daysAgo(3), createdAt: daysAgo(60), updatedAt: daysAgo(21) },
        { ...base, id: 'nb_demo_dpia', name: 'DPIA — AI-assistent voor de klantenservice', title: 'DPIA — AI-assistent voor de klantenservice', description: 'Risico-analyse en mitigaties.', sources: SOURCES().slice(2, 5), messages: [], createdAt: daysAgo(120), updatedAt: daysAgo(45) },
    ];
}

// Fixtures are trusted, compile-time content, so a regex strip is enough here
// (the product derives preview/word counts server-side; see the API contract).
const stripTags = (html) => String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

// The full card shape the overview grid consumes — exported so the parity
// test can catch this fixture drifting behind the real list endpoint.
export const toListItem = (n) => {
    const docText = stripTags(n.documentContent);
    return {
        id: n.id, name: n.name, title: n.title, description: n.description,
        type: 'notebook', version: n.version || 1,
        sourceCount: (n.sources || []).length,
        processingCount: 0, failedCount: 0,
        sourceWordCount: (n.sources || []).reduce((sum, s) => sum + (s.wordCount || 0), 0),
        docWordCount: docText ? docText.split(/\s+/).length : 0,
        messageCount: (n.messages || []).length,
        preview: docText.slice(0, 300),
        pinned: Boolean(n.pinnedAt),
        pinnedAt: n.pinnedAt || null,
        lastActivityAt: n.updatedAt, lastActivityKind: 'edit',
        createdAt: n.createdAt, updatedAt: n.updatedAt,
        ownerId: n.ownerId, isOwner: true,
    };
};

export function createState() {
    return { notebooks: [notebook(), ...siblings()] };
}

const find = (state, id) => state.notebooks.find(n => n.id === id) || null;
const notFound = () => new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });

export const ROUTES = {
    ...COMMON_ROUTES,

    // Honours `search` and `sort=name` minimally; pinned floats first, same
    // as the real endpoint's `pinned_at DESC NULLS LAST`.
    'GET /api/notebooks': ({ state, query }) => {
        let items = state.notebooks.map(toListItem);
        const search = (query?.get('search') || '').trim().toLowerCase();
        if (search) items = items.filter(n => (n.name || '').toLowerCase().includes(search));
        if (query?.get('sort') === 'name') items.sort((a, b) => a.name.localeCompare(b.name));
        items.sort((a, b) => Number(b.pinned) - Number(a.pinned));
        return { notebooks: items, hasMore: false };
    },
    // Envelope, not the bare record: the page reads `data.notebook.…`.
    /**
     * Opening a notebook is ONE call: NotebooksPage reads `data.notebook` AND
     * `data.sources` off this single response and does not fetch the sources
     * separately. A bare `{ notebook }` opened a notebook advertised as "six
     * documents deep" onto "0 sources · 0 words / Add your first source" —
     * the sources route below existed and was simply never called.
     */
    'GET /api/notebooks/:id': ({ state, params }) => {
        const n = find(state, params.id);
        return n ? { notebook: n, sources: n.sources || [] } : notFound();
    },
    'PUT /api/notebooks/:id': ({ state, params, body }) => {
        const n = find(state, params.id);
        if (!n) return notFound();
        // `pinned` maps to pinnedAt and — like the server — bumps neither
        // version nor updatedAt; `expectedVersion` is CAS input, not a field.
        const { pinned, expectedVersion: _ignored, ...rest } = body || {};
        if (pinned !== undefined) n.pinnedAt = pinned ? new Date().toISOString() : null;
        if (Object.keys(rest).length > 0) {
            Object.assign(n, rest);
            n.version = (n.version || 1) + 1;
            n.updatedAt = new Date().toISOString();
        }
        return { success: true, version: n.version || 1, notebook: n };
    },
    'POST /api/notebooks': ({ state, body }) => {
        const created = { ...notebook(), id: `nb_demo_new_${state.notebooks.length + 1}`, name: body?.name || 'Untitled notebook', title: body?.name || 'Untitled notebook', documentContent: '', content: '', html: '', sources: [], messages: [] };
        state.notebooks.unshift(created);
        return { success: true, notebook: created };
    },
    'DELETE /api/notebooks/:id': ({ state, params }) => {
        state.notebooks = state.notebooks.filter(n => n.id !== params.id);
        return { success: true };
    },
    'GET /api/notebooks/:id/sources': ({ state, params }) => ({ sources: find(state, params.id)?.sources || [] }),
    'GET /api/notebooks/:id/messages': ({ state, params }) => ({ messages: find(state, params.id)?.messages || [] }),
    'GET /api/notebooks/:id/conversation': ({ state, params }) => ({ messages: find(state, params.id)?.messages || [] }),

    // Generation is scripted and says so — the demo calls no model.
    'POST /api/notebooks/:id/generate': () => ({
        demo: true,
        message: 'In the product this drafts a briefing, FAQ, mind map or data table from your sources. The demo does not call a model.',
    }),
};
