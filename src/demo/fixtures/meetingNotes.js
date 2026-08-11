/**
 * Fixtures for the Meeting notes demo.
 *
 * One finished meeting, written out the way the product stores it: diarised
 * segments, named speakers, a summary, decisions, questions and action items
 * with timestamps. That is enough for the library, the transcript view, the
 * insights tabs and the speaker legend to render their real layouts.
 *
 * There is deliberately NO audio. `audioStorageKey` is null, so the player
 * takes the same "recording is no longer available" path a real note takes
 * once its audio has been cleaned up — a real state of the product, rather
 * than a broken one. It also means the demo never streams media, never
 * records anything and never asks for a microphone.
 *
 * The transcript is invented. No real meeting, person or company appears.
 */

import { COMMON_ROUTES, daysAgo } from './common';

const MEETING_ID = 'tr_demo_platform_review';

/**
 * The speaker's `id` IS its display label — `formatSpeakerLabel(s.id)` is what
 * the legend, the transcript and the player rows render. A meeting that has
 * been through the naming step therefore stores real names as ids, and
 * `Speaker 1` only survives where nobody has named them. Using names here is
 * what makes this look like a finished note rather than a raw transcript.
 */
const SPEAKERS = () => ([
    { id: 'Sanne de Vries', name: 'Sanne de Vries', color: '#3B82F6' },
    { id: 'Ruben Bakker', name: 'Ruben Bakker', color: '#EC4899' },
    { id: 'Iris Hoekstra', name: 'Iris Hoekstra', color: '#F59E0B' },
    { id: 'Daan Willemsen', name: 'Daan Willemsen', color: '#10B981' },
]);

/**
 * A short but complete conversation. Timestamps are seconds; the transcript
 * view, the speaker rows and the "jump to" links on action items all read
 * from these, so they have to be internally consistent.
 */
const SEGMENTS = () => ([
    { start: 6, end: 21, speaker: 'Sanne de Vries', text: 'Right — the point of today is to decide whether we roll the new intake flow out to the whole team next sprint, or keep it with the pilot group for another two weeks.' },
    { start: 22, end: 44, speaker: 'Ruben Bakker', text: 'From my side the pilot has gone well. Fourteen people used it last week, and the only complaint was that the confirmation step was easy to miss on mobile.' },
    { start: 45, end: 58, speaker: 'Iris Hoekstra', text: 'That matches what I heard. Nobody asked to go back to the old form, which is the bit I care about.' },
    { start: 59, end: 92, speaker: 'Daan Willemsen', text: 'The thing I would want before a wide rollout is the audit trail. At the moment we log that a document was filed, but not who approved it. If we go org-wide and someone asks in three months, we cannot answer.' },
    { start: 93, end: 118, speaker: 'Sanne de Vries', text: 'How much work is that, realistically?' },
    { start: 119, end: 151, speaker: 'Daan Willemsen', text: 'A day, maybe a day and a half. The approval step already carries the user; it just is not written to the run log. I would rather do it before rollout than after.' },
    { start: 152, end: 176, speaker: 'Ruben Bakker', text: 'Then let us do that. It is one sprint item, and it removes the only objection I would expect from legal.' },
    { start: 177, end: 205, speaker: 'Sanne de Vries', text: 'Agreed. So: Daan adds the approver to the audit log this sprint, and we roll out to everyone the sprint after. Ruben, can you fix the mobile confirmation step at the same time?' },
    { start: 206, end: 218, speaker: 'Ruben Bakker', text: 'Yes. It is a layout fix, not a logic one — half a day.' },
    { start: 219, end: 244, speaker: 'Iris Hoekstra', text: 'One more thing. Do we tell the pilot group they are staying on it for another two weeks? They were told it was two weeks total, and we are now at four.' },
    { start: 245, end: 268, speaker: 'Sanne de Vries', text: 'Fair. I will send a note today explaining why and what changes. Anything else before we close?' },
    { start: 269, end: 279, speaker: 'Daan Willemsen', text: 'Nothing from me.' },
    { start: 280, end: 291, speaker: 'Sanne de Vries', text: 'Good. Thanks everyone.' },
]);

const FULL_TEXT = () => SEGMENTS()
    .map(s => `${SPEAKERS().find(sp => sp.id === s.speaker)?.name || s.speaker}: ${s.text}`)
    .join('\n\n');

const SUMMARY = `**Decision:** the new intake flow goes org-wide the sprint after next, once the approval audit trail is in place.

**Where the pilot landed**
- Fourteen people used it last week; nobody asked to return to the old form.
- The one usability complaint was the confirmation step being easy to miss on mobile.

**What is blocking a wider rollout**
- The run log records that a document was filed, but not who approved it. Daan estimated a day to a day and a half to add the approver, and the team agreed to do it before rollout rather than after — mainly to pre-empt a legal question later.

**Also agreed**
- Ruben fixes the mobile confirmation layout in the same sprint (about half a day).
- Sanne writes to the pilot group today: the pilot was announced as two weeks and is now at four, so they get an explanation and a note of what changes.`;

const ACTION_ITEMS = () => ([
    { id: 'ai_1', text: 'Add the approving user to the automation run log', assignee: 'Daan Willemsen', timestamp: 151, done: false },
    { id: 'ai_2', text: 'Fix the confirmation step layout on mobile', assignee: 'Ruben Bakker', timestamp: 218, done: false },
    { id: 'ai_3', text: 'Write to the pilot group explaining the extension and what changes', assignee: 'Sanne de Vries', timestamp: 268, done: false },
]);

const DECISIONS = () => ([
    { id: 'dec_1', text: 'Roll the intake flow out org-wide the sprint after next, not next sprint.', timestamp: 205 },
    { id: 'dec_2', text: 'The approval audit trail ships before the wide rollout, not after it.', timestamp: 176 },
]);

const QUESTIONS = () => ([
    { id: 'q_1', text: 'Does the pilot group need to be told the pilot is being extended?', timestamp: 244, answered: true },
]);

const CHAPTERS = () => ([
    { title: 'Purpose of the meeting', start: 6, end: 22 },
    { title: 'How the pilot went', start: 22, end: 59 },
    { title: 'The audit-trail gap', start: 59, end: 152 },
    { title: 'Decision and owners', start: 152, end: 219 },
    { title: 'Communicating with the pilot group', start: 219, end: 291 },
]);

function detail() {
    return {
        id: MEETING_ID,
        title: 'Intake flow — pilot review',
        fileName: 'intake-flow-pilot-review.m4a',
        language: 'en',
        durationSeconds: 291,
        speakerCount: 4,
        numSpeakers: 4,
        segmentCount: SEGMENTS().length,
        status: 'completed',
        provider: 'voxtral',
        source: 'upload',
        talkRoomToken: null,
        meetMeetingCode: null,
        isPublished: false,
        sharedGroups: [],
        sharedWith: [],
        tags: ['product', 'rollout'],
        organizationId: 'demo-org',
        createdAt: daysAgo(2),
        updatedAt: daysAgo(2),
        isOwner: true,
        ownerId: 'demo-user',
        fullText: FULL_TEXT(),
        transcript: FULL_TEXT(),
        summary: SUMMARY,
        segments: SEGMENTS(),
        speakers: SPEAKERS(),
        attendees: ['Sanne de Vries', 'Ruben Bakker', 'Iris Hoekstra', 'Daan Willemsen'],
        actionItems: ACTION_ITEMS(),
        decisions: DECISIONS(),
        questions: QUESTIONS(),
        chapters: CHAPTERS(),
        voiceprintMatches: [],
        // No audio in the demo — the player renders its "recording unavailable"
        // state, which is a real state of the product.
        audioPath: '',
        audioStorageKey: null,
        sourceUri: null,
    };
}

/** Two more rows so the library looks like a library rather than one card. */
function siblings() {
    const base = detail();
    return [
        {
            ...base,
            id: 'tr_demo_kickoff',
            title: 'Q3 planning kickoff',
            durationSeconds: 2_713,
            speakerCount: 6,
            numSpeakers: 6,
            segmentCount: 214,
            tags: ['planning'],
            createdAt: daysAgo(9),
            updatedAt: daysAgo(9),
        },
        {
            ...base,
            id: 'tr_demo_vendor',
            title: 'Vendor call — storage renewal',
            durationSeconds: 1_486,
            speakerCount: 3,
            numSpeakers: 3,
            segmentCount: 122,
            tags: ['procurement'],
            createdAt: daysAgo(23),
            updatedAt: daysAgo(23),
        },
    ];
}

/** The list payload is a strict subset of the detail payload. */
function toListItem(t) {
    return {
        id: t.id, title: t.title, fileName: t.fileName, language: t.language,
        durationSeconds: t.durationSeconds, speakerCount: t.speakerCount,
        segmentCount: t.segmentCount, status: t.status, provider: t.provider,
        source: t.source, talkRoomToken: t.talkRoomToken, meetMeetingCode: t.meetMeetingCode,
        isPublished: t.isPublished, sharedGroups: t.sharedGroups, tags: t.tags,
        organizationId: t.organizationId, createdAt: t.createdAt, updatedAt: t.updatedAt,
        isOwner: true, ownerId: 'demo-user',
        transcriptSnippet: t.fullText.slice(0, 400),
    };
}

export function createState() {
    const all = [detail(), ...siblings()];
    return { transcriptions: all, templates: [], agents: [] };
}

const find = (state, id) => state.transcriptions.find(t => t.id === id) || null;
const notFound = () => new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });

export const ROUTES = {
    ...COMMON_ROUTES,

    'GET /api/transcriptions': ({ state }) => ({
        transcriptions: state.transcriptions.map(toListItem),
        total: state.transcriptions.length,
    }),
    'GET /api/transcriptions/:id': ({ state, params }) => find(state, params.id) || notFound(),
    'PATCH /api/transcriptions/:id': ({ state, params, body }) => {
        const t = find(state, params.id);
        if (!t) return notFound();
        Object.assign(t, body || {});
        return { success: true, transcription: t };
    },
    'DELETE /api/transcriptions/:id': ({ state, params }) => {
        state.transcriptions = state.transcriptions.filter(t => t.id !== params.id);
        return { success: true };
    },

    // Speaker renames land in memory so the transcript really does re-label.
    'POST /api/transcriptions/:id/speakers': ({ state, params, body }) => {
        const t = find(state, params.id);
        if (!t) return notFound();
        const renames = body?.renames || {};
        t.speakers = t.speakers.map(s => (renames[s.id] ? { ...s, name: renames[s.id] } : s));
        return { success: true, transcription: t };
    },

    // Regeneration is scripted — no model is called, and we say so.
    'POST /api/transcriptions/:id/summary': ({ state, params }) => {
        const t = find(state, params.id);
        if (!t) return notFound();
        return { success: true, summary: t.summary, demo: true };
    },

    // Sources the library offers to import from. Empty in the demo: there is
    // no connected account, and the panels render their real empty states.
    'GET /api/transcriptions/talk-meetings': () => ({ meetings: [] }),
    'GET /api/transcriptions/gmeet-meetings': () => ({ meetings: [] }),
    'GET /api/transcriptions/gmeet-recordings': () => ({ recordings: [] }),
    'GET /api/transcriptions/gmeet-imports': () => ({ imports: [] }),
    'GET /api/transcriptions/nextcloud-audio-files': () => ({ files: [] }),
    'GET /api/transcriptions/nextcloud-talk-recordings': () => ({ recordings: [] }),

    // No audio in the demo — answer 404 deliberately so the player takes its
    // real "recording is no longer available" path instead of hanging on a
    // request that was simply never fixtured.
    'GET /api/transcriptions/:id/audio': () => new Response(
        JSON.stringify({ error: 'No recording in the demo' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
    ),

    'GET /api/summary-templates': ({ state }) => ({ templates: state.templates }),
    'GET /api/summary-templates/org': ({ state }) => ({ templates: state.templates }),
    'GET /api/talk-notes-settings/user/me': () => ({ enabled: false }),
    'GET /api/gmeet-notes-settings/user/me': () => ({ enabled: false }),
    'GET /api/org/users': () => ({ users: [] }),
    'GET /api/org/groups': () => ({ groups: [] }),
};
