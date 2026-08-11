import { describe, it, expect } from 'vitest';
import {
    buildSpeakerRows, buildSpeakerColorMap, speakerColor, segmentSpeakerId,
    segmentAtTime, segmentNearTime, normalizeChapters,
} from './playerData';
import { SPEAKER_COLORS, NEUTRAL_SPEAKER_COLOR } from '../../../config/meetingNotesConfig';

const HOUR_40 = 6028; // 1:40:28

/** N speakers, 3 turns each; speaker i talks slightly longer than speaker i+1
 * so ranking by speaking time is the reverse of appearance order. Lengths stay
 * flat (~100-155s) so even the smallest turn clears the sub-pixel sliver
 * threshold at the returned duration. */
function manySpeakerSegments(n) {
    const segments = [];
    let t = 0;
    for (let round = 0; round < 3; round++) {
        for (let i = 0; i < n; i++) {
            const len = (n - i) * 2 + 100;
            segments.push({ speaker: `S${i}`, start: t, end: t + len });
            t += len + 0.5; // hairline gaps, like real diarizer output
        }
    }
    return { segments, duration: t };
}

describe('buildSpeakerRows', () => {
    it('gives each speaker one row with merged blocks (lane semantics preserved)', () => {
        const { rows, others } = buildSpeakerRows([
            { speaker: 'Gerard', start: 0, end: 30 },
            { speaker: 'Gerard', start: 30, end: 90 },
            { speaker: 'Tom', start: 90, end: 120 },
        ], [], HOUR_40);

        expect(others).toBeNull();
        expect(rows).toHaveLength(2);
        expect(rows[0].speakerId).toBe('Gerard'); // 90s > 30s
        expect(rows[0].blocks).toHaveLength(1);
        expect(rows[0].blocks[0].widthFraction).toBeCloseTo(90 / HOUR_40, 5);
        expect(rows[1].speakerId).toBe('Tom');
        expect(rows[1].blocks[0].fraction).toBeCloseTo(90 / HOUR_40, 5);
    });

    it('ranks by speakingSeconds from the roster, not by array or appearance order', () => {
        const segments = [
            { speaker: 'Eerst', start: 0, end: 10 },
            { speaker: 'Meest', start: 10, end: 40 },
        ];
        // Roster deliberately unsorted (backend order is first-appearance).
        const speakers = [
            { id: 'Eerst', speakingSeconds: 10 },
            { id: 'Meest', speakingSeconds: 3000 },
        ];
        const { rows } = buildSpeakerRows(segments, speakers, HOUR_40);
        expect(rows.map((r) => r.speakerId)).toEqual(['Meest', 'Eerst']);
        expect(rows[0].rank).toBe(0);
        expect(rows[0].speakingSeconds).toBe(3000);
    });

    it('bridges a sub-second gap within one speaker, also across an interjection-free rename boundary', () => {
        const { rows } = buildSpeakerRows([
            { speaker: 'Tom', start: 0, end: 10 },
            { speaker: 'Tom', start: 10.5, end: 20 },
        ], [], HOUR_40);
        expect(rows).toHaveLength(1);
        expect(rows[0].blocks).toHaveLength(1);
    });

    it('keeps a speaker\'s separate turns as separate blocks when someone interjects >1s', () => {
        const { rows } = buildSpeakerRows([
            { speaker: 'Gerard', start: 0, end: 300 },
            { speaker: 'Tom', start: 300, end: 330 },
            { speaker: 'Gerard', start: 330, end: 600 },
        ], [], HOUR_40);
        const gerard = rows.find((r) => r.speakerId === 'Gerard');
        expect(gerard.blocks).toHaveLength(2);
    });

    it('drops sub-pixel slivers but keeps a real short interjection', () => {
        const { rows } = buildSpeakerRows([
            { speaker: 'Gerard', start: 0, end: 300 },
            { speaker: 'Tom', start: 300, end: 300.5 },   // 0.008% — invisible
            { speaker: 'René', start: 300.5, end: 330 },  // ~0.5% — visible
        ], [], HOUR_40);
        expect(rows.map((r) => r.speakerId).sort()).toEqual(['Gerard', 'René']);
    });

    it('accepts speakerId as the field name and skips junk segments', () => {
        const { rows } = buildSpeakerRows([
            null,
            { speakerId: 'speaker_0', start: 0, end: 60 },
            { speaker: 'X', start: 100, end: 50 },        // inverted range
            { speaker: '', start: 200, end: 260 },        // no speaker
        ], [], HOUR_40);
        expect(rows).toHaveLength(1);
        expect(rows[0].speakerId).toBe('speaker_0');
    });

    it('clamps a segment running past the recorded duration', () => {
        const { rows } = buildSpeakerRows([{ speaker: 'Tom', start: 6000, end: 9000 }], [], HOUR_40);
        const b = rows[0].blocks[0];
        expect(b.fraction + b.widthFraction).toBeLessThanOrEqual(1);
    });

    it('returns nothing without a duration or segments', () => {
        expect(buildSpeakerRows([{ speaker: 'Tom', start: 0, end: 10 }], [], 0)).toEqual({ rows: [], others: null });
        expect(buildSpeakerRows(null, [], HOUR_40)).toEqual({ rows: [], others: null });
        expect(buildSpeakerRows([], [], HOUR_40)).toEqual({ rows: [], others: null });
    });

    it('28-speaker meeting: all rows ranked, overflow aggregated into others', () => {
        const { segments, duration } = manySpeakerSegments(28);
        const { rows, others } = buildSpeakerRows(segments, [], duration, { maxRows: 6 });

        expect(rows).toHaveLength(28);
        expect(rows[0].speakerId).toBe('S0'); // most speaking time
        expect(others).not.toBeNull();
        expect(others.count).toBe(22);
        expect(others.speakerIds).toHaveLength(22);
        expect(others.speakerIds).toEqual(rows.slice(6).map((r) => r.speakerId));
        // The 22 minor speakers talk back-to-back within each of the 3 rounds,
        // so their 66 turns fuse into exactly 3 grey stretches.
        expect(others.blocks.length).toBe(3);
    });

    it('≤maxRows speakers → no others row; single speaker still gets a row', () => {
        const { segments, duration } = manySpeakerSegments(6);
        const six = buildSpeakerRows(segments, [], duration, { maxRows: 6 });
        expect(six.rows).toHaveLength(6);
        expect(six.others).toBeNull();

        const one = buildSpeakerRows([{ speaker: 'Solo', start: 0, end: 500 }], [], HOUR_40);
        expect(one.rows).toHaveLength(1);
        expect(one.others).toBeNull();
    });

    it('caps a pathological row at 200 widest blocks, chronological order kept', () => {
        // 300 isolated turns for one speaker, all wide enough to be visible
        // (threshold at duration 100000 is 150s), alternating 260s/210s.
        const segments = [];
        for (let i = 0; i < 300; i++) {
            const start = i * 333;
            segments.push({ speaker: 'Rap', start, end: start + (i % 2 ? 210 : 260) });
        }
        const { rows } = buildSpeakerRows(segments, [], 100000);
        expect(rows[0].blocks).toHaveLength(200);
        const starts = rows[0].blocks.map((b) => b.start);
        expect([...starts].sort((a, b) => a - b)).toEqual(starts);
    });

    it('a speaker missing from the roster is ranked by summed block time', () => {
        const segments = [
            { speaker: 'InRoster', start: 0, end: 10 },
            { speaker: 'Mystery', start: 10, end: 400 },
        ];
        const { rows } = buildSpeakerRows(segments, [{ id: 'InRoster', speakingSeconds: 10 }], HOUR_40);
        expect(rows[0].speakerId).toBe('Mystery');
        expect(rows[0].speakingSeconds).toBe(390);
    });
});

describe('buildSpeakerColorMap', () => {
    it('assigns palette colors by speaking-time rank, independent of id strings', () => {
        const map = buildSpeakerColorMap([
            { id: 'Zelden', speakingSeconds: 5 },
            { id: 'Altijd', speakingSeconds: 4000 },
            { id: 'Soms', speakingSeconds: 300 },
        ]);
        expect(map.Altijd).toBe(SPEAKER_COLORS[0]);
        expect(map.Soms).toBe(SPEAKER_COLORS[1]);
        expect(map.Zelden).toBe(SPEAKER_COLORS[2]);
    });

    it('28 speakers: top 10 unique colors, the rest all neutral (the collision fix)', () => {
        const speakers = Array.from({ length: 28 }, (_, i) => ({ id: `P${i}`, speakingSeconds: 2800 - i * 10 }));
        const map = buildSpeakerColorMap(speakers);

        const topColors = speakers.slice(0, 10).map((s) => map[s.id]);
        expect(new Set(topColors).size).toBe(10);
        for (const s of speakers.slice(10)) {
            expect(map[s.id]).toBe(NEUTRAL_SPEAKER_COLOR);
        }
    });

    it('is stable across renames: same speaking profile, new names, same colors per rank', () => {
        const before = buildSpeakerColorMap([
            { id: 'Guest-1', speakingSeconds: 900 },
            { id: 'Guest-2', speakingSeconds: 300 },
        ]);
        const after = buildSpeakerColorMap([
            { id: 'Ton', speakingSeconds: 900 },
            { id: 'Gerard', speakingSeconds: 300 },
        ]);
        expect(after.Ton).toBe(before['Guest-1']);
        expect(after.Gerard).toBe(before['Guest-2']);
    });

    it('breaks ties deterministically by roster order', () => {
        const map = buildSpeakerColorMap([
            { id: 'A', speakingSeconds: 100 },
            { id: 'B', speakingSeconds: 100 },
        ]);
        expect(map.A).toBe(SPEAKER_COLORS[0]);
        expect(map.B).toBe(SPEAKER_COLORS[1]);
    });

    it('speakerColor: unknown ids and junk input fall back to neutral', () => {
        const map = buildSpeakerColorMap([{ id: 'Ton', speakingSeconds: 10 }]);
        expect(speakerColor(map, 'Ton')).toBe(map.Ton);
        expect(speakerColor(map, 'Unknown')).toBe(NEUTRAL_SPEAKER_COLOR);
        expect(speakerColor(map, null)).toBe(NEUTRAL_SPEAKER_COLOR);
        expect(speakerColor(null, 'Ton')).toBe(NEUTRAL_SPEAKER_COLOR);
        expect(buildSpeakerColorMap(null)).toEqual({});
    });
});

describe('segmentNearTime', () => {
    const segments = [
        { speaker: 'Pim', start: 0, end: 10, text: 'een' },
        { speaker: 'Pim', start: 10.6, end: 20, text: 'twee' },   // 0.6s diarizer gap → bridged in the block
        { speaker: 'Tom', start: 20, end: 30, text: 'drie' },
        { speaker: 'Pim', start: 60, end: 70, text: 'vier' },
    ];

    it('finds the containing segment like segmentAtTime', () => {
        expect(segmentNearTime(segments, 5).text).toBe('een');
        expect(segmentNearTime(segments, 25).text).toBe('drie');
    });

    it('bridges the sub-second gap the timeline blocks also bridge (the blinking-name fix)', () => {
        // 10.3 sits in the 10→10.6 gap: exact lookup misses, tolerant lookup doesn't.
        expect(segmentAtTime(segments, 10.3)).toBeNull();
        expect(segmentNearTime(segments, 10.3).text).toBe('twee');
    });

    it('stays empty in real silence beyond the tolerance', () => {
        expect(segmentNearTime(segments, 45)).toBeNull();
        expect(segmentNearTime(segments, 999)).toBeNull();
    });

    it('with speakerId only that speaker\'s segments count', () => {
        // At 25s Tom is talking; on Pim's row we want what PIM said nearby — nothing within tolerance.
        expect(segmentNearTime(segments, 25, { speakerId: 'Pim' })).toBeNull();
        // Just after Pim's segment ends and Tom starts: Pim's row still answers with Pim.
        expect(segmentNearTime(segments, 20.5, { speakerId: 'Pim' }).text).toBe('twee');
        expect(segmentNearTime(segments, 20.5, { speakerId: 'Tom' }).text).toBe('drie');
    });

    it('handles junk input', () => {
        expect(segmentNearTime([], 5)).toBeNull();
        expect(segmentNearTime(null, 5)).toBeNull();
        expect(segmentNearTime(segments, NaN)).toBeNull();
    });
});

describe('segmentSpeakerId', () => {
    it('prefers speaker, falls back to speakerId, then the backend\'s capital-U Unknown', () => {
        expect(segmentSpeakerId({ speaker: 'Ton', speakerId: 'Guest-1' })).toBe('Ton');
        expect(segmentSpeakerId({ speakerId: 'Guest-1' })).toBe('Guest-1');
        expect(segmentSpeakerId({})).toBe('Unknown');
        expect(segmentSpeakerId(null)).toBe('Unknown');
    });
});

describe('segmentAtTime', () => {
    const segments = [
        { speaker: 'A', start: 0, end: 10, text: 'een' },
        { speaker: 'B', start: 10, end: 25, text: 'twee' },
        { speaker: 'C', start: 30, end: 40, text: 'drie' },
    ];

    it('finds the segment containing the instant', () => {
        expect(segmentAtTime(segments, 5).text).toBe('een');
        expect(segmentAtTime(segments, 24.9).text).toBe('twee');
        expect(segmentAtTime(segments, 30).text).toBe('drie');
    });

    it('treats start as inclusive and end as exclusive', () => {
        expect(segmentAtTime(segments, 10).text).toBe('twee');
        expect(segmentAtTime(segments, 40)).toBeNull();
    });

    it('returns null in a gap and outside the recording', () => {
        expect(segmentAtTime(segments, 27)).toBeNull();
        expect(segmentAtTime(segments, -1)).toBeNull();
        expect(segmentAtTime(segments, 999)).toBeNull();
    });

    it('handles empty and junk input', () => {
        expect(segmentAtTime([], 5)).toBeNull();
        expect(segmentAtTime(null, 5)).toBeNull();
        expect(segmentAtTime(segments, NaN)).toBeNull();
    });
});

describe('normalizeChapters', () => {
    it('tiles the recording: each end is the next start, last ends at duration', () => {
        const blocks = normalizeChapters([
            { title: 'Opening', start: '00:00' },
            { title: 'Fase 1 demo', start: '08:30' },
            { title: 'Webinar', start: '53:50' },
        ], HOUR_40);

        expect(blocks).toHaveLength(3);
        expect(blocks[0].endSeconds).toBe(510);
        expect(blocks[1].endSeconds).toBe(3230);
        expect(blocks[2].endSeconds).toBe(HOUR_40);
        const total = blocks.reduce((n, b) => n + b.widthFraction, 0);
        expect(total).toBeCloseTo(1, 5);
    });

    it('reads HH:MM:SS and sorts out-of-order output', () => {
        const blocks = normalizeChapters([
            { title: 'Laat', start: '01:20:00' },
            { title: 'Vroeg', start: '05:00' },
        ], HOUR_40);
        expect(blocks.map((b) => b.title)).toEqual(['Vroeg', 'Laat']);
    });

    it('drops unreadable or out-of-range starts instead of pinning them to 0:00', () => {
        const blocks = normalizeChapters([
            { title: 'Kapot', start: 'straks' },
            { title: 'Te ver', start: '99:99:99' },
            { title: 'Echt', start: '00:00' },
            { title: 'Ook echt', start: '50:00' },
        ], HOUR_40);
        expect(blocks.map((b) => b.title)).toEqual(['Echt', 'Ook echt']);
    });

    it('drops a duplicate start that would render zero-width', () => {
        const blocks = normalizeChapters([
            { title: 'A', start: '10:00' },
            { title: 'B', start: '10:00' },
            { title: 'C', start: '20:00' },
        ], HOUR_40);
        expect(blocks.map((b) => b.title)).toEqual(['A', 'C']);
    });

    it('returns nothing for a single surviving chapter — one block tells the user nothing', () => {
        expect(normalizeChapters([{ title: 'Alles', start: '00:00' }], HOUR_40)).toEqual([]);
        expect(normalizeChapters([
            { title: 'Echt', start: '10:00' },
            { title: 'Kapot', start: 'onzin' },
        ], HOUR_40)).toEqual([]);
    });

    it('drops chapters with no title and handles empty input', () => {
        expect(normalizeChapters([{ title: '  ', start: '10:00' }, { title: 'X', start: '20:00' }], HOUR_40)).toEqual([]);
        expect(normalizeChapters([], HOUR_40)).toEqual([]);
        expect(normalizeChapters(null, HOUR_40)).toEqual([]);
        expect(normalizeChapters([{ title: 'X', start: '10:00' }], 0)).toEqual([]);
    });

    it('carries a per-chapter summary through, and is null when absent', () => {
        const blocks = normalizeChapters([
            { title: 'Opening', start: '00:00', summary: 'Ewald opent de vergadering.' },
            { title: 'Agenda', start: '10:00' },
        ], HOUR_40);
        expect(blocks[0].summary).toBe('Ewald opent de vergadering.');
        expect(blocks[1].summary).toBeNull();
    });
});
