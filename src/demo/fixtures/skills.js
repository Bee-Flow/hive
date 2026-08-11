/**
 * Fixtures for the Skills demo.
 *
 * Six skills, written the way the product stores them: instructions, rules,
 * worked examples, and the dynamic-activation settings that decide when an
 * assistant reaches for one. That is enough for the list, the editor and the
 * sharing controls to render their real layouts.
 *
 * All invented. The skills describe plausible internal conventions rather
 * than anything drawn from a real customer's workspace.
 */

import { COMMON_ROUTES } from './common';

const SKILLS = () => ([
    {
        id: 'skl_demo_tone',
        name: 'House writing style',
        icon: '🖊️',
        description: 'How we write to customers: plain, short, and never breezy about bad news.',
        instructions: 'Write in plain language at roughly a B1 reading level. Prefer short sentences.\n\nNever open with an apology unless something actually went wrong. Do not use "just", "simply" or "easy" about anything the reader has to do — if it were easy they would not be asking.\n\nWhen the answer is no, say no in the first sentence, then explain. Burying it is worse than saying it.',
        rules: [
            'No exclamation marks in customer-facing text.',
            'Numbers under ten are written as words, except in tables and version numbers.',
            'Never promise a date we have not confirmed with the person who owns the work.',
        ],
        examples: [
            { input: 'Tell the customer their export failed', output: 'Your export did not complete. The job stopped at 40 minutes because the connection timed out, not because the data is missing — nothing was lost, and we can restart it whenever suits you.' },
        ],
        dynamicActivation: { enabled: true, keywords: ['email', 'reply', 'draft', 'customer'] },
        isShared: true,
        sharedGroups: ['grp_support', 'grp_sales'],
        workflow: null,
    },
    {
        id: 'skl_demo_tender',
        name: 'Tender question triage',
        icon: '📋',
        description: 'Sorts tender questions into who should answer them and what evidence they need.',
        instructions: 'For each question in a tender document, decide which of four buckets it belongs to: technical, legal, commercial, or references.\n\nFor each one, name the evidence the answer will need — a certificate, a policy document, a named customer, a figure from the platform. Do not draft the answer itself; the point is to make the work visible before anyone starts writing.',
        rules: [
            'A question that needs a figure we do not publish is flagged, not guessed.',
            'Anything mentioning a deadline is surfaced first, regardless of bucket.',
        ],
        examples: [],
        dynamicActivation: { enabled: true, keywords: ['tender', 'aanbesteding', 'rfp', 'bid'] },
        isShared: true,
        sharedGroups: ['grp_sales'],
        workflow: null,
    },
    {
        id: 'skl_demo_incident',
        name: 'Incident write-up',
        icon: '🚀',
        description: 'Turns a messy incident channel into a timeline someone can actually read.',
        instructions: 'Produce four sections: what happened, when we knew, what we changed, and what is still open.\n\nUse timestamps from the source material rather than relative wording. Separate what was observed from what was inferred — a write-up that presents a theory as a fact is how the same incident happens twice.',
        rules: [
            'Never name an individual as a cause. Name the system and the gap.',
            'If the root cause is not known, the section says so rather than offering the best guess.',
        ],
        examples: [],
        dynamicActivation: { enabled: false, keywords: [] },
        isShared: false,
        sharedGroups: [],
        workflow: null,
    },
    {
        id: 'skl_demo_dutch',
        name: 'Nederlandse zakelijke brief',
        icon: '📧',
        description: 'Formele Nederlandse correspondentie met de juiste aanhef en afsluiting.',
        instructions: 'Gebruik "u" tenzij expliciet anders gevraagd. Begin met "Geachte heer/mevrouw" wanneer de naam onbekend is, anders met de achternaam.\n\nVermijd letterlijk vertaald Engels. "Please find attached" wordt "In de bijlage vindt u", niet "Vind alstublieft bijgevoegd".',
        rules: [
            'Datum voluit: 3 maart 2026, niet 03-03-2026.',
            'Sluit af met "Met vriendelijke groet" en een witregel voor de naam.',
        ],
        examples: [],
        dynamicActivation: { enabled: true, keywords: ['brief', 'nederlands', 'geachte'] },
        isShared: true,
        sharedGroups: ['grp_support'],
        workflow: null,
    },
    {
        id: 'skl_demo_review',
        name: 'Contract clause review',
        icon: '🔍',
        description: 'Reads a clause against our standard positions and flags the deltas.',
        instructions: 'Compare each clause to our standard position. Report only where they differ, and say whether the difference is acceptable, negotiable, or a blocker.\n\nQuote the exact wording that creates the problem. A summary of a clause is not reviewable — the counterparty will negotiate the words, not the summary.',
        rules: [
            'Liability caps, IP assignment and data-processing terms are always reported, even when they match.',
            'Never state a legal conclusion. Flag it for a lawyer instead.',
        ],
        examples: [],
        dynamicActivation: { enabled: false, keywords: [] },
        isShared: true,
        sharedGroups: ['grp_legal'],
        workflow: null,
    },
    {
        id: 'skl_demo_summary',
        name: 'Weekly digest',
        icon: '📊',
        description: 'Condenses a week of activity into something worth reading on a Monday.',
        instructions: 'Lead with what changed, not with what happened. Three sections at most.\n\nIf nothing meaningful changed, say that in one line rather than padding. A digest people learn to skip is worse than no digest.',
        rules: ['Never longer than 200 words.'],
        examples: [],
        dynamicActivation: { enabled: true, keywords: ['digest', 'weekly', 'summary'] },
        isShared: false,
        sharedGroups: [],
        workflow: null,
    },
]);

const GROUPS = () => ([
    { id: 'grp_support', name: 'Support' },
    { id: 'grp_sales', name: 'Sales' },
    { id: 'grp_legal', name: 'Legal' },
]);

export function createState() {
    return { skills: SKILLS(), groups: GROUPS() };
}

export const ROUTES = {
    ...COMMON_ROUTES,

    // Returned BARE, not enveloped: SkillsStudio does `setSkills(await
    // res.json())` and then maps over it, so an object here blanks the list.
    'GET /api/skills': ({ state }) => state.skills,
    'GET /auth/groups': ({ state }) => state.groups,

    'POST /api/skills': ({ state, body }) => {
        const created = {
            id: `skl_demo_new_${state.skills.length + 1}`,
            name: body?.name || 'Untitled skill',
            icon: body?.icon || '⚡',
            description: body?.description || '',
            instructions: body?.instructions || '',
            rules: body?.rules || [],
            examples: body?.examples || [],
            dynamicActivation: body?.dynamicActivation || { enabled: false, keywords: [] },
            isShared: false,
            sharedGroups: [],
            workflow: null,
        };
        state.skills.push(created);
        return created;
    },

    'PUT /api/skills/:id': ({ state, params, body }) => {
        const skill = state.skills.find(s => s.id === params.id);
        if (skill) Object.assign(skill, body || {});
        return skill || {};
    },

    'DELETE /api/skills/:id': ({ state, params }) => {
        const i = state.skills.findIndex(s => s.id === params.id);
        if (i >= 0) state.skills.splice(i, 1);
        return { ok: true };
    },
};
