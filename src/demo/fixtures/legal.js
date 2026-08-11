/**
 * Fixtures for the Legal Studio demo.
 *
 * Five matters (dossiers), each a notebook underneath — that is how the
 * product models a matter: sources, a draft, and a settings blob holding the
 * client, the counterparty and the citation mode. Deadlines drive the
 * overdue/upcoming badge in the list, so the dates are spread across both
 * sides of today.
 *
 * The matters are invented Dutch civil disputes of unremarkable kinds. No
 * real client, counterparty, case number or firm appears, and no document
 * text is included — a public demo built from real matters would be a
 * privilege breach, not just a data leak.
 *
 * Legal Studio is labelled Dutch-law-only and enterprise opt-in on the
 * roadmap. The demo does not soften that; it just shows the interface.
 */

import { COMMON_ROUTES, daysAgo } from './common';

/** Dates relative to now so the deadline badges stay meaningful over time. */
const daysAhead = (n) => new Date(Date.now() + n * 86_400_000).toISOString();

const MATTERS = () => ([
    {
        id: 'lm_demo_huur',
        name: 'Huurgeschil Prinsengracht',
        sourceCount: 14,
        createdAt: daysAgo(64),
        updatedAt: daysAgo(1),
        settings: {
            legal: {
                clientName: 'Van Doorn Vastgoed B.V.',
                wederpartij: 'Bewonersvereniging Prinsengracht 212',
                citationMode: 'strict',
            },
            deadlines: [
                { label: 'Conclusie van antwoord', date: daysAhead(9) },
                { label: 'Zitting', date: daysAhead(38) },
            ],
        },
    },
    {
        id: 'lm_demo_arbeid',
        name: 'Ontbindingsverzoek arbeidsovereenkomst',
        sourceCount: 22,
        createdAt: daysAgo(31),
        updatedAt: daysAgo(0),
        settings: {
            legal: {
                clientName: 'Kwadrant IT B.V.',
                wederpartij: 'Werknemer (via gemachtigde)',
                citationMode: 'strict',
            },
            deadlines: [
                { label: 'Verweerschrift', date: daysAhead(3) },
            ],
        },
    },
    {
        id: 'lm_demo_aanbesteding',
        name: 'Kort geding aanbesteding gemeente',
        sourceCount: 41,
        createdAt: daysAgo(12),
        updatedAt: daysAgo(2),
        settings: {
            legal: {
                clientName: 'Helderwerk Infra B.V.',
                wederpartij: 'Gemeente Veenendaal',
                citationMode: 'strict',
            },
            deadlines: [
                // Deliberately in the past: the list has an overdue state and
                // a demo where nothing is ever late never shows it.
                { label: 'Dagvaarding betekenen', date: daysAgo(2) },
                { label: 'Mondelinge behandeling', date: daysAhead(6) },
            ],
        },
    },
    {
        id: 'lm_demo_levering',
        name: 'Wanprestatie leveringsovereenkomst',
        sourceCount: 9,
        createdAt: daysAgo(88),
        updatedAt: daysAgo(21),
        settings: {
            legal: {
                clientName: 'Bureau Lindgren',
                wederpartij: 'Noordkaap Componenten B.V.',
                citationMode: 'loose',
            },
            deadlines: [],
        },
    },
    {
        id: 'lm_demo_avg',
        name: 'AVG-klacht datalek klantenbestand',
        sourceCount: 17,
        createdAt: daysAgo(47),
        updatedAt: daysAgo(5),
        settings: {
            legal: {
                clientName: 'Veldkamp Groep',
                wederpartij: 'Autoriteit Persoonsgegevens',
                citationMode: 'strict',
            },
            deadlines: [
                { label: 'Reactietermijn AP', date: daysAhead(19) },
            ],
        },
    },
]);


/**
 * Party documents per matter — the material a dossier actually accumulates.
 * Deliberately NO case law: see the note at the top of this file.
 */
const src = (id, name, type, wordCount) => ({
    id, name, title: name, type, status: 'ready',
    wordCount, hasContent: true, error: null, stage: 'ready',
    storageKey: null, metadata: {}, addedAt: daysAgo(20),
});

const SOURCES_BY_MATTER = () => ({
    lm_demo_huur: [
        src('lsrc_huur_1', 'Huurovereenkomst Prinsengracht 212.pdf', 'pdf', 8240),
        src('lsrc_huur_2', 'Aanzegging huurverhoging 2026.pdf', 'pdf', 1120),
        src('lsrc_huur_3', 'Correspondentie bewonersvereniging.pdf', 'pdf', 4630),
        src('lsrc_huur_4', 'Onderhoudsrapport bouwkundige.docx', 'docx', 3410),
        src('lsrc_huur_5', 'Foto-inventarisatie gemeenschappelijke ruimten.pdf', 'pdf', 260),
    ],
    lm_demo_arbeid: [
        src('lsrc_arb_1', 'Arbeidsovereenkomst (getekend).pdf', 'pdf', 5180),
        src('lsrc_arb_2', 'Verbetertraject \u2014 verslagen 1 t/m 4.docx', 'docx', 6720),
        src('lsrc_arb_3', 'Functioneringsgesprekken 2024\u20132026.pdf', 'pdf', 9140),
        src('lsrc_arb_4', 'E-mailwisseling leidinggevende.pdf', 'pdf', 2880),
        src('lsrc_arb_5', 'Verzoekschrift ontbinding (concept).docx', 'docx', 4310),
    ],
    lm_demo_aanbesteding: [
        src('lsrc_aanb_1', 'Aanbestedingsleidraad gemeente.pdf', 'pdf', 16400),
        src('lsrc_aanb_2', 'Nota van inlichtingen (2 rondes).pdf', 'pdf', 5230),
        src('lsrc_aanb_3', 'Gunningsbeslissing.pdf', 'pdf', 1840),
        src('lsrc_aanb_4', 'Onze inschrijving.pdf', 'pdf', 12060),
        src('lsrc_aanb_5', 'Bezwaarbrief aan aanbestedende dienst.docx', 'docx', 2140),
        src('lsrc_aanb_6', 'Dagvaarding kort geding (concept).docx', 'docx', 5980),
    ],
    lm_demo_levering: [
        src('lsrc_lev_1', 'Leveringsovereenkomst.pdf', 'pdf', 6350),
        src('lsrc_lev_2', 'Ingebrekestelling.pdf', 'pdf', 890),
        src('lsrc_lev_3', 'Schade-onderbouwing (spreadsheet-export).pdf', 'pdf', 1470),
    ],
    lm_demo_avg: [
        src('lsrc_avg_1', 'Meldingsformulier datalek AP.pdf', 'pdf', 2210),
        src('lsrc_avg_2', 'Verwerkingsregister (uittreksel).xlsx', 'xlsx', 1830),
        src('lsrc_avg_3', 'Verwerkersovereenkomst leverancier.pdf', 'pdf', 7140),
        src('lsrc_avg_4', 'Forensisch rapport incident.pdf', 'pdf', 11250),
        src('lsrc_avg_5', 'Concept-reactie aan de AP.docx', 'docx', 3620),
    ],
});

/** A short working exchange per matter, of the kind that happens while
 *  preparing. Fact-marshalling only \u2014 nothing that reads as legal advice. */
const MESSAGES_BY_MATTER = () => ({
    lm_demo_huur: [
        { id: 'lmsg_huur_1', role: 'user', text: 'Welke onderhoudsklachten staan in de correspondentie en op welke data zijn ze gemeld?' },
        { id: 'lmsg_huur_2', role: 'ai', text: 'In de correspondentie staan vier gemelde klachten: lekkage trappenhuis (11 november), verlichting kelderberging (3 december), tochtende kozijnen voorgevel (17 januari) en een storing aan de intercom (2 februari). Het bouwkundig rapport behandelt de eerste en de derde; de andere twee komen daarin niet terug.\n\nBronnen: Correspondentie bewonersvereniging, Onderhoudsrapport bouwkundige.' },
        { id: 'lmsg_huur_3', role: 'user', text: 'Staat er ergens een reactietermijn genoemd?' },
        { id: 'lmsg_huur_4', role: 'ai', text: 'Ja \u2014 in de brief van 17 januari wordt een termijn van veertien dagen gesteld voor herstel van de kozijnen. Ik zie in de stukken geen reactie binnen die termijn; als die er wel is, zit hij niet in dit dossier.' },
    ],
    lm_demo_aanbesteding: [
        { id: 'lmsg_aanb_1', role: 'user', text: 'Op welk punt wijkt de gunningsbeslissing af van de leidraad?' },
        { id: 'lmsg_aanb_2', role: 'ai', text: 'De leidraad beschrijft in paragraaf 4.3 een weging van 60% kwaliteit en 40% prijs. In de gunningsbeslissing wordt gerekend met 50/50. Dat verschil is in de nota van inlichtingen niet aangekondigd \u2014 ik vind daar geen vraag of antwoord over de weging.\n\nBronnen: Aanbestedingsleidraad gemeente (\u00a74.3), Gunningsbeslissing, Nota van inlichtingen.' },
    ],
    lm_demo_avg: [
        { id: 'lmsg_avg_1', role: 'user', text: 'Hoeveel betrokkenen noemt het forensisch rapport, en komt dat overeen met de melding?' },
        { id: 'lmsg_avg_2', role: 'ai', text: 'Het forensisch rapport noemt 4.812 unieke e-mailadressen in de ge\u00ebxporteerde tabel. Het meldingsformulier vermeldt "circa 4.800". Die aantallen sluiten op elkaar aan; het rapport is preciezer.\n\nBronnen: Forensisch rapport incident (\u00a73.2), Meldingsformulier datalek AP.' },
    ],
});

/**
 * Partial drafts. Deliberately unfinished and deliberately free of case
 * references \u2014 they marshal facts from the party documents, which is the
 * part of the workflow this demo can honestly show.
 */
const DRAFTS = {
    lm_demo_aanbesteding: 'FEITEN\n\n1. Op 14 januari 2026 heeft de aanbestedende dienst de aanbestedingsleidraad gepubliceerd. In paragraaf 4.3 is een weging opgenomen van 60% kwaliteit en 40% prijs.\n\n2. In twee rondes nota\u2019s van inlichtingen is over de weging geen vraag gesteld en is de weging niet gewijzigd.\n\n3. Client heeft tijdig ingeschreven.\n\n4. Bij gunningsbeslissing is de opdracht aan een derde gegund. Uit de beslissing blijkt dat is gerekend met een weging van 50% kwaliteit en 50% prijs.\n\n[te voltooien \u2014 juridische grondslag nog op te nemen]',
    lm_demo_avg: 'CHRONOLOGIE\n\n\u2022 Dag 0 \u2014 incident vastgesteld door de leverancier.\n\u2022 Dag 1 \u2014 client ge\u00efnformeerd; forensisch onderzoek gestart.\n\u2022 Dag 3 \u2014 melding bij de Autoriteit Persoonsgegevens ingediend.\n\u2022 Dag 11 \u2014 forensisch rapport opgeleverd: 4.812 unieke e-mailadressen betrokken.\n\n[reactie aan de AP nog op te stellen]',
};

export function createState() {
    const sources = SOURCES_BY_MATTER();
    return {
        // `sourceCount` is the badge in the matter list, and the dossier the
        // badge belongs to is one click away. Counted rather than declared —
        // it read "14 stuk" beside a dossier holding five.
        matters: MATTERS().map(m => ({ ...m, sourceCount: (sources[m.id] || []).length })),
        sources,
        messages: MESSAGES_BY_MATTER(),
    };
}

export const ROUTES = {
    ...COMMON_ROUTES,

    'GET /api/legal-matters': ({ state }) => ({ matters: state.matters }),

    /**
     * Opening a matter is ONE call. LegalStudioPage's `selectMatter` reads
     * `data.matter`, `data.sources`, `data.citations` and
     * `data.matter.documentContent` off this single response — it does not go
     * back for the sources afterwards. Returning a bare `{ matter }` therefore
     * opened a dossier that said "0 stukken · 0 woorden" and invited you to
     * "Add your first source", directly beside a list entry advertising 14 of
     * them. Nothing errored; the demo simply never opened a matter, so nobody
     * saw it.
     */
    'GET /api/legal-matters/:id': ({ state, params }) => {
        const matter = state.matters.find(m => m.id === params.id);
        if (!matter) return { matter: null };
        return {
            matter: { ...matter, documentContent: DRAFTS[params.id] || '' },
            sources: state.sources[params.id] || [],
            citations: [],
        };
    },

    'POST /api/legal-matters': ({ state, body }) => {
        const created = {
            id: `lm_demo_new_${state.matters.length + 1}`,
            name: body?.name || 'Nieuw dossier',
            sourceCount: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            settings: { legal: { clientName: '', wederpartij: '', citationMode: 'strict' }, deadlines: [] },
        };
        state.matters.push(created);
        return { matter: created };
    },

    'PATCH /api/legal-matters/:id': ({ state, params, body }) => {
        const matter = state.matters.find(m => m.id === params.id);
        if (matter) {
            Object.assign(matter, body || {});
            matter.updatedAt = new Date().toISOString();
        }
        return { matter: matter || null };
    },

    'DELETE /api/legal-matters/:id': ({ state, params }) => {
        const i = state.matters.findIndex(m => m.id === params.id);
        if (i >= 0) state.matters.splice(i, 1);
        return { ok: true };
    },

    /**
     * A matter is a notebook underneath, so the page reads notebook routes for
     * the sources and the draft. Empty collections rather than invented case
     * documents: the interface is the point, and fabricating passages that
     * look like court filings would be worse than showing an empty dossier.
     */
    'GET /api/notebooks/:id': ({ state, params }) => {
        const matter = state.matters.find(m => m.id === params.id);
        return {
            id: params.id,
            name: matter?.name || 'Dossier',
            sources: state.sources[params.id] || [],
            messages: state.messages[params.id] || [],
            draft: DRAFTS[params.id] || '',
            settings: matter?.settings || {},
        };
    },
    'GET /api/notebooks/:id/sources': ({ state, params }) => ({ sources: state.sources[params.id] || [] }),
    'GET /api/notebooks/:id/messages': ({ state, params }) => ({ messages: state.messages[params.id] || [] }),
    // Asked for only once a matter is actually OPEN — which the demo did not
    // do until it started landing on one, so this route was missing for as
    // long as the demo showed "Kies een dossier" and nobody could tell.
    'GET /api/notebooks/:id/conversation': ({ state, params }) => ({ messages: state.messages[params.id] || [] }),

    // Research reaches out to Rechtspraak, EUR-Lex and the rest. The demo
    // transport has no network, so this answers honestly rather than
    // inventing case law — a fabricated citation is the single worst thing a
    // legal tool can produce, demo or not.
    'POST /api/legal-matters/:id/research': () => ({
        results: [],
        note: 'Research is disabled in this demo: it queries Rechtspraak.nl, EUR-Lex and Kamerstukken live, and the demo has no network access. Nothing here is invented case law.',
    }),
};
