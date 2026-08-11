import { describe, expect, it } from 'vitest';

import {
    buildInteractivity,
    buildTalkStats,
    findNameMentions,
    matchViewerSpeaker,
    topTopics,
} from './insightsData';

const seg = (speaker, start, end, text = '') => ({ speaker, start, end, text });

describe('buildTalkStats', () => {
    it('returns null without duration or usable segments', () => {
        expect(buildTalkStats([], [], 0)).toBeNull();
        expect(buildTalkStats([], [], 600)).toBeNull();
        expect(buildTalkStats([seg('A', 0, 10)], [], 0)).toBeNull();
    });

    it('ranks speakers by talk time with shares from the common total', () => {
        const stats = buildTalkStats(
            [seg('A', 0, 90), seg('B', 90, 100)],
            [{ id: 'A', speakingSeconds: 90 }, { id: 'B', speakingSeconds: 10 }],
            100,
        );
        expect(stats.speakers.map((s) => s.speakerId)).toEqual(['A', 'B']);
        expect(stats.speakers[0].share).toBeCloseTo(0.9);
        expect(stats.topShare).toBeCloseTo(0.9);
        // 90/10 is a dominated meeting: entropy well below even.
        expect(stats.balance).toBeLessThan(0.5);
    });

    it('prefers roster speakingSeconds but falls back to summed turns', () => {
        const stats = buildTalkStats(
            [seg('A', 0, 10), seg('B', 10, 40)],
            [{ id: 'A', speakingSeconds: 999 }], // B missing from roster
            60,
        );
        const a = stats.speakers.find((s) => s.speakerId === 'A');
        const b = stats.speakers.find((s) => s.speakerId === 'B');
        expect(a.speakingSeconds).toBe(999);
        expect(b.speakingSeconds).toBe(30);
    });

    it('finds the longest monologue across a sub-second interjection and flags ≥90s', () => {
        const stats = buildTalkStats(
            [seg('A', 0, 50), seg('B', 50, 50.5), seg('A', 50.5, 100), seg('B', 101, 105)],
            [],
            120,
        );
        const a = stats.speakers.find((s) => s.speakerId === 'A');
        // The 0.5s "mm-hm" doesn't break A's stretch: spans fuse to one 0–100 monologue.
        expect(a.longestMonologue).toMatchObject({ start: 0, end: 100, seconds: 100, flagged: true });
        const b = stats.speakers.find((s) => s.speakerId === 'B');
        expect(b.longestMonologue.flagged).toBe(false);
    });

    it('computes silence from the union of speech, not the sum (overlap-safe)', () => {
        const stats = buildTalkStats(
            [seg('A', 0, 10), seg('B', 5, 15), seg('A', 20, 30)],
            [],
            40,
        );
        // Union covers [0,15] + [20,30] = 25s of a 40s recording.
        expect(stats.silenceSeconds).toBe(15);
    });

    it('never reports more silence than the meeting is long', () => {
        // A stored duration shorter than the segments claim: the out-of-range
        // span must be ignored, not subtracted as a negative.
        const stats = buildTalkStats([seg('A', 0, 50), seg('A', 200, 250)], [], 100);
        expect(stats.silenceSeconds).toBe(50);
        expect(stats.silenceSeconds).toBeLessThanOrEqual(100);
    });

    it('picks the longest monologue by raw length, not by rounded seconds', () => {
        // 95.6 rounds up to 96 and would beat the genuinely longer 95.8.
        const stats = buildTalkStats(
            [seg('A', 0, 95.6), seg('B', 100, 101), seg('A', 200, 295.8)],
            [],
            400,
        );
        const a = stats.speakers.find((s) => s.speakerId === 'A');
        expect(a.longestMonologue.start).toBe(200);
    });

    it('carries the AI-written contribution through from the roster', () => {
        const stats = buildTalkStats(
            [seg('A', 0, 30), seg('B', 30, 60)],
            [
                { id: 'A', speakingSeconds: 30, summary: '  A leidde de demo.  ' },
                { id: 'B', speakingSeconds: 30, summary: '   ' }, // whitespace only
            ],
            60,
        );
        const a = stats.speakers.find((s) => s.speakerId === 'A');
        const b = stats.speakers.find((s) => s.speakerId === 'B');
        expect(a.summary).toBe('A leidde de demo.');
        // Blank and missing summaries leave no key, so the panel shows no
        // disclosure rather than an empty one.
        expect('summary' in b).toBe(false);
    });

    it('leaves the summary off entirely for notes that predate the feature', () => {
        const stats = buildTalkStats([seg('A', 0, 60)], [{ id: 'A', speakingSeconds: 60 }], 60);
        expect('summary' in stats.speakers[0]).toBe(false);
    });

    it('treats a solo recording as balanced (nobody was crowded out)', () => {
        const stats = buildTalkStats([seg('A', 0, 60)], [], 60);
        expect(stats.balance).toBe(1);
        const even = buildTalkStats([seg('A', 0, 30), seg('B', 30, 60)], [], 60);
        expect(even.balance).toBeCloseTo(1);
    });
});

describe('buildInteractivity', () => {
    it('returns null for empty or single-turn meetings', () => {
        expect(buildInteractivity([], 600)).toBeNull();
        expect(buildInteractivity([seg('A', 0, 600)], 600)).toBeNull();
        // Same-speaker segments merge into one turn → still a monologue.
        expect(buildInteractivity([seg('A', 0, 300), seg('A', 300, 600)], 600)).toBeNull();
    });

    it('scores a lively alternating dialogue at the top of the scale', () => {
        const segments = [seg('A', 0, 10), seg('B', 10, 20), seg('A', 20, 30), seg('B', 30, 40)];
        const result = buildInteractivity(segments, 40);
        expect(result.switches).toBe(3);
        expect(result.score).toBe(10);
    });

    it('buckets switches into windows for the sparkline', () => {
        const segments = [
            seg('A', 0, 100), seg('B', 100, 290),      // one switch in window 0
            seg('A', 310, 400), seg('B', 400, 590),    // two switches in window 1
        ];
        const result = buildInteractivity(segments, 600, { windowSeconds: 300 });
        expect(result.windows).toHaveLength(2);
        expect(result.windows[0].switches).toBe(1);
        expect(result.windows[1].switches).toBe(2);
    });
});

describe('topTopics', () => {
    it('ranks chapters by time share and limits the count', () => {
        const chapters = [
            { title: 'Opening', seconds: 0, widthFraction: 0.1 },
            { title: 'MFA', seconds: 60, widthFraction: 0.6 },
            { title: 'Planning', seconds: 420, widthFraction: 0.3 },
        ];
        expect(topTopics(chapters, 2)).toEqual([
            { title: 'MFA', seconds: 60, share: 0.6 },
            { title: 'Planning', seconds: 420, share: 0.3 },
        ]);
        expect(topTopics(null)).toEqual([]);
    });
});

describe('matchViewerSpeaker', () => {
    const speakers = [{ id: 'Tom Kooy' }, { id: 'Sandra' }];

    it('matches the full display name exactly (case/whitespace-insensitive)', () => {
        expect(matchViewerSpeaker(speakers, '  tom  kooy ')).toBe('Tom Kooy');
    });

    it('falls back to a unique first-name match', () => {
        expect(matchViewerSpeaker(speakers, 'Tom')).toBe('Tom Kooy');
    });

    it('refuses to guess between ambiguous candidates', () => {
        const twoToms = [{ id: 'Tom Kooy' }, { id: 'Tom Jansen' }];
        expect(matchViewerSpeaker(twoToms, 'Tom')).toBeNull();
        expect(matchViewerSpeaker(speakers, 'Ewald')).toBeNull();
        expect(matchViewerSpeaker(speakers, '')).toBeNull();
    });
});

describe('findNameMentions', () => {
    const segments = [
        seg('Sandra', 10, 15, 'Tom, kun jij dat oppakken?'),
        seg('Sandra', 20, 25, 'Tommy is een ander persoon.'),
        seg('Tom Kooy', 30, 35, 'Ik ben Tom, dat pak ik op.'),
        seg('Spreker 1', 40, 45, 'Volgens Tom Kooy klopt dat.'),
    ];

    it('finds word-boundary mentions by others, skipping the viewer themself', () => {
        const mentions = findNameMentions(segments, 'Tom Kooy');
        expect(mentions.map((m) => m.seconds)).toEqual([10, 40]);
        expect(mentions[0].speakerId).toBe('Sandra');
    });

    it('does not treat an everyday word as a first-name mention', () => {
        // 'Wil', 'Mark' and 'Will' are ordinary words; a case-insensitive
        // first-name match lit the rail up on every "ik wil dat oppakken".
        const dutch = [seg('Sandra', 10, 15, 'Ik wil dat morgen oppakken.')];
        expect(findNameMentions(dutch, 'Wil Jansen')).toEqual([]);
        // The capitalised name still matches.
        const named = [seg('Sandra', 10, 15, 'Kan Wil dat oppakken?')];
        expect(findNameMentions(named, 'Wil Jansen')).toHaveLength(1);
        // And the full name matches regardless of casing.
        const full = [seg('Sandra', 10, 15, 'volgens wil jansen klopt dat')];
        expect(findNameMentions(full, 'Wil Jansen')).toHaveLength(1);
    });

    it('does not fire on substrings or short first names', () => {
        // 'Tommy' must not match 'Tom' (word boundary).
        expect(findNameMentions([segments[1]], 'Tom Kooy')).toEqual([]);
        // 'Bo' (<3 chars) only matches as part of the full name.
        expect(findNameMentions([seg('X', 0, 5, 'bo derde punt')], 'Bo Rombouts')).toEqual([]);
        expect(findNameMentions([seg('X', 0, 5, 'zoals Bo Rombouts zei')], 'Bo Rombouts')).toHaveLength(1);
    });

    it('handles empty input safely', () => {
        expect(findNameMentions(null, 'Tom')).toEqual([]);
        expect(findNameMentions(segments, '')).toEqual([]);
    });
});
