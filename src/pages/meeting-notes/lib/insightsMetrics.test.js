import { describe, it, expect } from 'vitest';
import {
    buildActionsPerTopic,
    buildAirtimeWindows,
    buildDeadAir,
    buildFollowUpStats,
    buildHandoffPairs,
    buildInsightsModel,
    buildMonologueRatio,
    buildSilentAttendees,
    buildSpeakerMetrics,
    buildTagMentions,
    buildTopicOwnership,
    countWords,
    insightsWindowSeconds,
} from './insightsMetrics';
import { normalizeChapters } from './playerData';

/** Alternating 30s turns: Tom 0-30, Jeroen 30-60, Tom 60-90… */
function alternating(count, len = 30) {
    return Array.from({ length: count }, (_, i) => ({
        speaker: i % 2 === 0 ? 'Tom' : 'Jeroen',
        start: i * len,
        end: (i + 1) * len,
        text: i % 2 === 0 ? 'een twee drie' : 'vier vijf',
    }));
}

describe('insightsWindowSeconds', () => {
    it('aims for ~12 buckets, clamped to 1–10 minutes', () => {
        expect(insightsWindowSeconds(0)).toBe(300);
        expect(insightsWindowSeconds(600)).toBe(60);      // 10 min → floor
        expect(insightsWindowSeconds(3600)).toBe(300);    // 1 h → 5 min
        expect(insightsWindowSeconds(36000)).toBe(600);   // 10 h → ceiling
    });
});

describe('countWords', () => {
    it('counts word-ish tokens only', () => {
        expect(countWords('een twee drie')).toBe(3);
        expect(countWords('  spaced   out  ')).toBe(2);
        expect(countWords('… — ?')).toBe(0);          // punctuation is not a word
        expect(countWords('hé, café!')).toBe(2);      // accents count
        expect(countWords('')).toBe(0);
        expect(countWords(null)).toBe(0);
    });
});

describe('buildSpeakerMetrics', () => {
    const segments = [
        { speaker: 'Tom', start: 0, end: 60, text: 'a b c d e f g h i j' },   // 10 words / 60s
        { speaker: 'Tom', start: 60, end: 90, text: 'is dat zo?' },           // a question
        { speaker: 'Jeroen', start: 90, end: 100, text: 'ja' },
    ];
    const talkSpeakers = [
        { speakerId: 'Tom', speakingSeconds: 90, turnCount: 2 },
        { speakerId: 'Jeroen', speakingSeconds: 10, turnCount: 1 },
    ];

    it('computes pace, questions, average turn and listening time', () => {
        const m = buildSpeakerMetrics(segments, talkSpeakers, 200);
        const tom = m.get('Tom');
        expect(tom.words).toBe(13);
        expect(tom.wpm).toBe(Math.round(13 / (90 / 60)));
        expect(tom.questionCount).toBe(1);
        expect(tom.avgTurnSeconds).toBe(45);
        expect(tom.listeningSeconds).toBe(110);
    });

    it('hides pace for a speaker with almost no speech', () => {
        // 10s of speech is not a sample — a stray "ja" would read as 6 wpm.
        expect(buildSpeakerMetrics(segments, talkSpeakers, 200).get('Jeroen').wpm).toBeNull();
    });

    it('survives a speaker with no segments at all', () => {
        const m = buildSpeakerMetrics([], [{ speakerId: 'Ghost', speakingSeconds: 60, turnCount: 1 }], 100);
        expect(m.get('Ghost')).toMatchObject({ words: 0, questionCount: 0, wpm: 0 });
    });
});

describe('buildSilentAttendees', () => {
    const spoke = [{ speakerId: 'Tom Kooy' }, { speakerId: 'Jeroen' }];

    it('lists invitees who never spoke', () => {
        expect(buildSilentAttendees(['Tom Kooy', 'Jeroen', 'Marijke'], spoke)).toEqual(['Marijke']);
    });

    it('matches on a unique first name', () => {
        expect(buildSilentAttendees(['Tom', 'Jeroen'], spoke)).toEqual([]);
    });

    it('treats an ambiguous first name as PRESENT (never accuse wrongly)', () => {
        const twoToms = [{ speakerId: 'Tom Kooy' }, { speakerId: 'Tom Jansen' }];
        expect(buildSilentAttendees(['Tom de Vries'], twoToms)).toEqual([]);
    });

    it('returns everyone when nobody spoke, and [] without a roster', () => {
        expect(buildSilentAttendees(['Tom'], [])).toEqual(['Tom']);
        expect(buildSilentAttendees([], spoke)).toEqual([]);
        expect(buildSilentAttendees(undefined, spoke)).toEqual([]);
    });
});

describe('buildAirtimeWindows', () => {
    it('reports each speaker share WITHIN its window, not of the meeting', () => {
        const segments = [
            { speaker: 'Tom', start: 0, end: 60, text: 'x' },
            { speaker: 'Jeroen', start: 60, end: 120, text: 'x' },
        ];
        const w = buildAirtimeWindows(segments, 120, { windowSeconds: 60 });
        expect(w).toHaveLength(2);
        expect(w[0].shares).toEqual([{ speakerId: 'Tom', seconds: 60, share: 1 }]);
        expect(w[1].shares).toEqual([{ speakerId: 'Jeroen', seconds: 60, share: 1 }]);
    });

    it('splits a turn that straddles a window boundary', () => {
        const segments = [{ speaker: 'Tom', start: 30, end: 90, text: 'x' }];
        const w = buildAirtimeWindows(segments, 120, { windowSeconds: 60 });
        expect(w[0].speechSeconds).toBe(30);
        expect(w[1].speechSeconds).toBe(30);
    });

    it('keeps silent windows so the axis stays linear in time', () => {
        const segments = [{ speaker: 'Tom', start: 0, end: 10, text: 'x' }];
        const w = buildAirtimeWindows(segments, 180, { windowSeconds: 60 });
        expect(w).toHaveLength(3);
        expect(w[1]).toMatchObject({ speechSeconds: 0, shares: [] });
    });

    it('is empty without duration or speech', () => {
        expect(buildAirtimeWindows([], 100)).toEqual([]);
        expect(buildAirtimeWindows(alternating(4), 0)).toEqual([]);
    });
});

describe('buildHandoffPairs', () => {
    it('ranks directed pairs once the conversation really changed hands', () => {
        const pairs = buildHandoffPairs(alternating(6));   // 5 switches
        expect(pairs[0]).toMatchObject({ from: 'Tom', to: 'Jeroen', count: 3 });
        expect(pairs).toContainEqual({ from: 'Jeroen', to: 'Tom', count: 2 });
    });

    it('stays silent below the minimum sample', () => {
        expect(buildHandoffPairs(alternating(3))).toEqual([]);   // only 2 switches
        expect(buildHandoffPairs([])).toEqual([]);
    });
});

describe('buildDeadAir', () => {
    const segments = [
        { speaker: 'Tom', start: 60, end: 90, text: 'x' },     // 60s lead-in
        { speaker: 'Jeroen', start: 150, end: 180, text: 'x' },// 60s gap
    ];

    it('finds lead-in, mid-meeting gaps and lead-out, tagged and ranked', () => {
        const gaps = buildDeadAir(segments, 240, { minSeconds: 20 });
        expect(gaps.map((g) => g.kind).sort()).toEqual(['gap', 'lead_in', 'lead_out']);
        expect(gaps[0].seconds).toBe(60);
        expect(gaps.find((g) => g.kind === 'lead_out')).toMatchObject({ start: 180, end: 240, seconds: 60 });
    });

    it('ignores gaps below the threshold', () => {
        expect(buildDeadAir(segments, 240, { minSeconds: 120 })).toEqual([]);
    });

    it('does not invent a gap from overlapping speakers', () => {
        // Both talk 0-100; the union covers everything, so there is no dead air.
        const overlap = [
            { speaker: 'Tom', start: 0, end: 100, text: 'x' },
            { speaker: 'Jeroen', start: 10, end: 90, text: 'x' },
        ];
        expect(buildDeadAir(overlap, 100, { minSeconds: 20 })).toEqual([]);
    });
});

describe('buildMonologueRatio', () => {
    it('measures the share of talk spent in long stretches', () => {
        const segments = [
            { speaker: 'Tom', start: 0, end: 120, text: 'x' },     // 120s → monologue
            { speaker: 'Jeroen', start: 121, end: 161, text: 'x' },// 40s → not
        ];
        const r = buildMonologueRatio(segments);
        expect(r).toMatchObject({ seconds: 120, totalSeconds: 160, count: 1 });
        expect(r.ratio).toBeCloseTo(0.75, 5);
    });

    it('is null without turns', () => {
        expect(buildMonologueRatio([])).toBeNull();
    });
});

describe('buildTopicOwnership', () => {
    const chapters = normalizeChapters(
        [{ title: 'Intro', start: '0:00' }, { title: 'Deep dive', start: '1:00' }],
        120,
    );

    it('attributes straddling turns by overlap, not by start', () => {
        // Tom 0-90 covers all of Intro (60s) and half of Deep dive (30s);
        // Jeroen 90-120 owns the rest of Deep dive.
        const segments = [
            { speaker: 'Tom', start: 0, end: 90, text: 'x' },
            { speaker: 'Jeroen', start: 90, end: 120, text: 'x' },
        ];
        const owned = buildTopicOwnership(segments, chapters);
        expect(owned[0]).toMatchObject({ title: 'Intro', topSpeakerId: 'Tom', openedBy: 'Tom' });
        expect(owned[0].topSpeakerShare).toBe(1);
        expect(owned[1]).toMatchObject({ title: 'Deep dive', topSpeakerId: 'Tom' });
        expect(owned[1].topSpeakerShare).toBeCloseTo(0.5, 5);
    });

    it('is empty when there are no usable chapters', () => {
        expect(buildTopicOwnership(alternating(4), [])).toEqual([]);
        expect(buildTopicOwnership(alternating(4), normalizeChapters([{ title: 'Only', start: '0:00' }], 120))).toEqual([]);
    });
});

describe('buildTagMentions', () => {
    const segments = [
        { speaker: 'Tom', start: 10, end: 20, text: 'We bespreken de weging van de data.' },
        { speaker: 'Jeroen', start: 30, end: 40, text: 'Weging is lastig, echt weging.' },
        { speaker: 'Tom', start: 50, end: 60, text: 'Mijn email is verstuurd.' },
    ];

    it('counts occurrences and remembers the first mention', () => {
        const m = buildTagMentions(['weging'], segments);
        expect(m).toEqual([{ tag: 'weging', count: 3, firstSeconds: 10 }]);
    });

    it('respects word boundaries — "ai" must not fire inside "email"', () => {
        expect(buildTagMentions(['ai'], segments)).toEqual([]);
    });

    it('matches multi-word tags across any whitespace', () => {
        const segs = [{ speaker: 'Tom', start: 5, end: 9, text: 'De gewogen   data klopt.' }];
        expect(buildTagMentions(['gewogen data'], segs)).toEqual([{ tag: 'gewogen data', count: 1, firstSeconds: 5 }]);
    });

    it('drops tags that are never spoken and handles empty input', () => {
        expect(buildTagMentions(['nooitgezegd'], segments)).toEqual([]);
        expect(buildTagMentions([], segments)).toEqual([]);
        expect(buildTagMentions(['weging'], [])).toEqual([]);
    });
});

describe('buildFollowUpStats', () => {
    const meeting = {
        durationSeconds: 3600,
        actionItems: [
            { id: 'a1', text: 'Bellen', assignee: 'Tom', timestamp: '10:00', done: false, due: '2020-01-01' },
            { id: 'a2', text: 'Mailen', assignee: 'Niet toegewezen', timestamp: '', done: false },
            { id: 'a3', text: 'Klaar', assignee: 'Jeroen', timestamp: '', done: true, due: '2020-01-01' },
        ],
        decisions: [{ id: 'd1', text: 'Ja', timestamp: '5:00' }],
        questions: [
            { id: 'q1', text: 'Wanneer?', timestamp: '7:00', open: true },
            { id: 'q2', text: 'Wie?', timestamp: '', open: false },
        ],
    };

    it('counts open/unassigned/overdue and decision density', () => {
        const s = buildFollowUpStats(meeting, { now: new Date('2026-07-26T12:00:00') });
        expect(s).toMatchObject({ total: 3, open: 2, done: 1, unassigned: 1, withDue: 2, overdue: 1, decisions: 1 });
        expect(s.decisionsPerHour).toBeCloseTo(1, 5);
    });

    it('never marks a DONE item overdue', () => {
        const s = buildFollowUpStats(meeting, { now: new Date('2026-07-26T12:00:00') });
        expect(s.byAssignee.find((r) => r.assignee === 'Jeroen').overdue).toBe(0);
    });

    it('compares due dates against the LOCAL day, so today is not overdue', () => {
        const today = { ...meeting, actionItems: [{ id: 'a', assignee: 'Tom', done: false, due: '2026-07-26' }] };
        // 00:30 local — a UTC-based comparison would already be on the 26th/27th.
        expect(buildFollowUpStats(today, { now: new Date('2026-07-26T00:30:00') }).overdue).toBe(0);
    });

    it('lists only open questions, with jumpable seconds', () => {
        const s = buildFollowUpStats(meeting, { now: new Date('2026-07-26T12:00:00') });
        expect(s.openQuestions).toEqual([{ id: 'q1', text: 'Wanneer?', seconds: 420 }]);
    });

    it('groups by assignee, excluding the unassigned placeholder', () => {
        const s = buildFollowUpStats(meeting, { now: new Date('2026-07-26T12:00:00') });
        expect(s.byAssignee.map((r) => r.assignee)).toEqual(['Tom', 'Jeroen']);
    });

    it('handles a meeting with no follow-up at all', () => {
        const s = buildFollowUpStats({ durationSeconds: 0 }, { now: new Date() });
        expect(s).toMatchObject({ total: 0, open: 0, decisions: 0, decisionsPerHour: 0 });
        expect(s.openQuestions).toEqual([]);
    });
});

describe('buildActionsPerTopic', () => {
    const chapters = normalizeChapters([{ title: 'Intro', start: '0:00' }, { title: 'Rest', start: '1:00' }], 120);

    it('maps items into the chapter they were raised in', () => {
        const items = [{ timestamp: '0:30' }, { timestamp: '1:30' }, { timestamp: '1:40' }, { timestamp: '' }];
        expect(buildActionsPerTopic(items, chapters)).toEqual([
            { title: 'Rest', seconds: 60, count: 2 },
            { title: 'Intro', seconds: 0, count: 1 },
        ]);
    });

    it('is empty without chapters', () => {
        expect(buildActionsPerTopic([{ timestamp: '0:30' }], [])).toEqual([]);
    });
});

describe('buildInsightsModel', () => {
    const meeting = {
        durationSeconds: 300,
        segments: alternating(8, 30),
        speakers: [
            { id: 'Tom', speakingSeconds: 120 },
            { id: 'Jeroen', speakingSeconds: 120 },
        ],
        chapters: [{ title: 'Intro', start: '0:00' }, { title: 'Rest', start: '2:00' }],
        tags: ['drie'],
        attendees: ['Tom', 'Jeroen', 'Marijke'],
        actionItems: [{ id: 'a1', assignee: 'Tom', done: false, timestamp: '0:30' }],
        decisions: [],
        questions: [],
    };

    it('assembles every tab section for a normal meeting', () => {
        const m = buildInsightsModel(meeting);
        expect(m.talk.speakers).toHaveLength(2);
        expect(m.people.rows[0]).toHaveProperty('wpm');
        expect(m.people.silentAttendees).toEqual(['Marijke']);
        expect(m.flow.monologue).not.toBeNull();
        expect(m.topics.blocks).toHaveLength(2);
        expect(m.topics.tags[0].tag).toBe('drie');
        expect(m.followUp.total).toBe(1);
        expect(m.overview.some((h) => h.id === 'participants')).toBe(true);
    });

    it('returns null when there is not enough speech', () => {
        expect(buildInsightsModel({ durationSeconds: 0, segments: [] })).toBeNull();
        expect(buildInsightsModel(null)).toBeNull();
    });

    // The gate is the load-bearing privacy control: attribution must not be
    // BUILT, so no rendering mistake downstream can leak it.
    it('omits every per-person structure when the org gate is off', () => {
        const m = buildInsightsModel(meeting, { perPersonEnabled: false });
        expect(m.people).toBeNull();
        expect(m.flow.airtime).toBeNull();
        expect(m.flow.handoffs).toBeNull();
        expect(m.followUp.byAssignee).toBeNull();
        // Meeting-level facts survive.
        expect(m.flow.monologue).not.toBeNull();
        expect(m.flow.deadAir).toBeDefined();
        expect(m.topics.blocks).toHaveLength(2);
        expect(m.topics.blocks[0].seconds).toBe(0);
        // …but no chapter carries a speaker.
        for (const b of m.topics.blocks) {
            expect(b.topSpeakerId).toBeUndefined();
            expect(b.openedBy).toBeUndefined();
        }
        // …and no highlight names anybody.
        const serialized = JSON.stringify(m.overview);
        expect(serialized).not.toContain('Tom');
        expect(serialized).not.toContain('Jeroen');
    });
});
