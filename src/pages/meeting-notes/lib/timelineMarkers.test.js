import { describe, it, expect } from 'vitest';
import { buildMentionMarkers, buildTimelineMarkers } from './timelineMarkers';

const HOUR_40 = 6028; // 1:40:28, the real meeting's length

describe('buildTimelineMarkers', () => {
    it('places a marker at the right fraction of the recording', () => {
        const markers = buildTimelineMarkers(
            [{ id: 'a', text: 'Webinar organiseren', assignee: 'Tom', timestamp: '53:50' }],
            HOUR_40,
        );
        expect(markers).toHaveLength(1);
        expect(markers[0].seconds).toBe(3230);
        expect(markers[0].fraction).toBeCloseTo(3230 / HOUR_40, 5);
        expect(markers[0].label).toBe('Webinar organiseren');
        expect(markers[0].assignee).toBe('Tom');
    });

    it('reads HH:MM:SS as well as MM:SS', () => {
        // Everything past the first hour arrives as HH:MM:SS. Misreading
        // "01:08:13" as 8:13 would seek an hour off.
        const [marker] = buildTimelineMarkers(
            [{ id: 'a', text: 'WKR koppelen', timestamp: '01:08:13' }],
            HOUR_40,
        );
        expect(marker.seconds).toBe(4093);
    });

    it('returns markers in chronological order regardless of input order', () => {
        const markers = buildTimelineMarkers([
            { id: 'c', text: 'Laatste', timestamp: '01:39:24' },
            { id: 'a', text: 'Eerste', timestamp: '07:29' },
            { id: 'b', text: 'Midden', timestamp: '53:50' },
        ], HOUR_40);
        expect(markers.map((m) => m.label)).toEqual(['Eerste', 'Midden', 'Laatste']);
    });

    it('collapses near-coincident items into one clickable cluster', () => {
        // Several action items commonly come out of one exchange. Drawn
        // separately they overlap into an unhittable blob and all seek to the
        // same second anyway.
        const markers = buildTimelineMarkers([
            { id: 'a', text: 'Eerste', timestamp: '53:50' },
            { id: 'b', text: 'Tweede', timestamp: '53:52' },
            { id: 'c', text: 'Ver weg', timestamp: '01:20:00' },
        ], HOUR_40);

        expect(markers).toHaveLength(2);
        expect(markers[0].count).toBe(2);
        expect(markers[0].label).toBe('Eerste · Tweede');
        expect(markers[1].count).toBe(1);
    });

    it('marks a cluster done only when every item in it is done', () => {
        const markers = buildTimelineMarkers([
            { id: 'a', text: 'A', timestamp: '10:00', done: true },
            { id: 'b', text: 'B', timestamp: '10:01', done: false },
        ], HOUR_40);
        expect(markers).toHaveLength(1);
        expect(markers[0].done).toBe(false);
    });

    it('drops unreadable timestamps rather than planting them at 0:00', () => {
        // A phantom marker at the start reads as a real moment. Nothing is
        // better than a lie.
        const markers = buildTimelineMarkers([
            { id: 'a', text: 'Kapot', timestamp: 'binnenkort' },
            { id: 'b', text: 'Leeg', timestamp: '' },
            { id: 'c', text: 'Ontbreekt' },
            { id: 'd', text: 'Rommel', timestamp: 'ab:cd' },
            { id: 'e', text: 'Goed', timestamp: '10:00' },
        ], HOUR_40);
        expect(markers.map((m) => m.label)).toEqual(['Goed']);
    });

    it('keeps a genuine moment at 0:00', () => {
        const markers = buildTimelineMarkers([{ id: 'a', text: 'Opening', timestamp: '00:00' }], HOUR_40);
        expect(markers).toHaveLength(1);
        expect(markers[0].seconds).toBe(0);
        expect(markers[0].fraction).toBe(0);
    });

    it('drops markers past the end of the audio', () => {
        // The model occasionally invents a timestamp beyond the recording.
        const markers = buildTimelineMarkers([
            { id: 'a', text: 'Onmogelijk', timestamp: '99:99:99' },
            { id: 'b', text: 'Goed', timestamp: '10:00' },
        ], HOUR_40);
        expect(markers.map((m) => m.label)).toEqual(['Goed']);
    });

    it('falls back to a label when the item has no text', () => {
        const [marker] = buildTimelineMarkers([{ id: 'a', text: '   ', timestamp: '10:00' }], HOUR_40);
        expect(marker.label).toBe('Action item');
    });

    it('returns nothing when there is no duration or no items', () => {
        expect(buildTimelineMarkers([{ id: 'a', timestamp: '10:00' }], 0)).toEqual([]);
        expect(buildTimelineMarkers([{ id: 'a', timestamp: '10:00' }], undefined)).toEqual([]);
        expect(buildTimelineMarkers([], HOUR_40)).toEqual([]);
        expect(buildTimelineMarkers(null, HOUR_40)).toEqual([]);
        expect(buildTimelineMarkers(undefined, HOUR_40)).toEqual([]);
    });

    it('survives junk entries in the list', () => {
        const markers = buildTimelineMarkers([null, undefined, { id: 'a', text: 'Goed', timestamp: '10:00' }], HOUR_40);
        expect(markers).toHaveLength(1);
    });

    it('mixes decisions and questions in with action items, keeping ids distinct', () => {
        // The rail now shows every extracted moment. Ids come from three
        // different prefixes (ai-/d-/q-), so React keys can't collide.
        const markers = buildTimelineMarkers([
            { id: 'ai-0', text: 'Taak', timestamp: '10:00' },
            { id: 'd-0', text: 'Besluit', timestamp: '30:00' },
            { id: 'q-0', text: 'Open vraag', timestamp: '50:00', open: true },
        ], HOUR_40);
        expect(markers.map((m) => m.id)).toEqual(['ai-0', 'd-0', 'q-0']);
        // Decisions/questions carry no `done` flag — they must not render muted.
        expect(markers.every((m) => m.done === false)).toBe(true);
    });

    it('a decision clustered next to a finished action item does not un-complete it', () => {
        // collapseNearby merges anything within 0.6% of the duration (~36s here)
        // and ANDs the done flags. Decisions have no `done`, so treating their
        // implicit false as "unfinished" would re-open a ticked action item.
        const markers = buildTimelineMarkers([
            { id: 'ai-0', text: 'Afgerond', timestamp: '10:00', done: true },
            { id: 'd-0', text: 'Besluit in hetzelfde gesprek', timestamp: '10:05' },
        ], HOUR_40);
        expect(markers).toHaveLength(1);
        expect(markers[0].count).toBe(2);
        expect(markers[0].done).toBe(true);
    });

    it('still un-completes a cluster when a genuinely open action item joins it', () => {
        const markers = buildTimelineMarkers([
            { id: 'ai-0', text: 'Afgerond', timestamp: '10:00', done: true },
            { id: 'd-0', text: 'Besluit', timestamp: '10:03' },
            { id: 'ai-1', text: 'Nog open', timestamp: '10:05', done: false },
        ], HOUR_40);
        expect(markers).toHaveLength(1);
        expect(markers[0].done).toBe(false);
    });

    it('a decision clustered first still takes the doneness of the action item that joins', () => {
        const markers = buildTimelineMarkers([
            { id: 'd-0', text: 'Besluit', timestamp: '10:00' },
            { id: 'ai-0', text: 'Afgerond', timestamp: '10:05', done: true },
        ], HOUR_40);
        expect(markers).toHaveLength(1);
        expect(markers[0].done).toBe(true);
    });

    it('handles the real meeting: 24 items across 1:40', () => {
        const items = [
            '07:29', '10:06', '11:25', '24:06', '25:02', '20:34', '53:50', '58:24',
            '01:08:13', '01:03:14', '01:19:11', '01:24:34', '01:39:24', '01:20:31',
            '01:22:47', '01:13:44', '01:12:26', '43:43',
        ].map((timestamp, i) => ({ id: `ai-${i}`, text: `Item ${i}`, timestamp }));

        const markers = buildTimelineMarkers(items, HOUR_40);
        expect(markers.length).toBeGreaterThan(10);
        // Every marker must sit inside the scrubber.
        markers.forEach((m) => {
            expect(m.fraction).toBeGreaterThanOrEqual(0);
            expect(m.fraction).toBeLessThanOrEqual(1);
        });
        // The second half must be represented — that's the half that used to be
        // invisible entirely.
        expect(markers.some((m) => m.fraction > 0.5)).toBe(true);
    });
});

describe('buildMentionMarkers', () => {
    it('places a mention with the speaker as the attribution', () => {
        const [marker] = buildMentionMarkers(
            [{ seconds: 3230, speakerId: 'Sandra', text: 'Tom, kun jij dat oppakken?' }],
            HOUR_40,
        );
        expect(marker.seconds).toBe(3230);
        expect(marker.fraction).toBeCloseTo(3230 / HOUR_40, 5);
        expect(marker.label).toBe('Tom, kun jij dat oppakken?');
        expect(marker.assignee).toBe('Sandra');
        // Never rendered as a completed item.
        expect(marker.done).toBe(false);
    });

    it('clusters mentions from one exchange and keeps them chronological', () => {
        const markers = buildMentionMarkers([
            { seconds: 3232, speakerId: 'Ewald', text: 'Tweede' },
            { seconds: 3230, speakerId: 'Sandra', text: 'Eerste' },
            { seconds: 4800, speakerId: 'Ewald', text: 'Ver weg' },
        ], HOUR_40);
        expect(markers).toHaveLength(2);
        expect(markers[0].count).toBe(2);
        expect(markers[0].label).toBe('Eerste · Tweede');
    });

    it('drops mentions outside the recording and handles empty input', () => {
        expect(buildMentionMarkers([{ seconds: -5, speakerId: 'X', text: 'a' }], HOUR_40)).toEqual([]);
        expect(buildMentionMarkers([{ seconds: HOUR_40 + 10, speakerId: 'X', text: 'a' }], HOUR_40)).toEqual([]);
        expect(buildMentionMarkers([], HOUR_40)).toEqual([]);
        expect(buildMentionMarkers(null, HOUR_40)).toEqual([]);
        expect(buildMentionMarkers([{ seconds: 10, speakerId: 'X', text: 'a' }], 0)).toEqual([]);
    });
});
