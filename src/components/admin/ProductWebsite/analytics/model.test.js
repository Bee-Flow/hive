import { describe, it, expect } from 'vitest';
import {
    pivot, channelOf, toChannels, referrerHost,
    foldEventData, ctaLeaderboard, blockLeaderboard,
    screenBuckets, sessionSignals,
} from './model';

describe('pivot', () => {
    it('derives bounce rate and time-per-VISIT from a breakdown row', () => {
        // Per visit, not per view: dividing by views would understate time on
        // any page someone reloads.
        const [r] = pivot([{ views: '4', visitors: 2, visits: 2, bounces: 1, totaltime: '120', path: '/x' }], ['path']);
        expect(r.path).toBe('/x');
        expect(r.views).toBe(4);
        expect(r.bounceRate).toBe(50);
        expect(r.avgTime).toBe(60);
    });

    it('is null rather than 0 when there is nothing to divide by', () => {
        const [r] = pivot([{ views: 1, visits: 0, path: '/x' }], ['path']);
        expect(r.bounceRate).toBeNull();
        expect(r.avgTime).toBeNull();
    });

    it('tolerates Umami varying the field casing', () => {
        const [r] = pivot([{ views: 1, Path: '/y' }], ['path']);
        expect(r.path).toBe('/y');
    });
});

describe('channelOf', () => {
    it('classifies the common referrer families', () => {
        expect(channelOf('https://www.google.com/search')).toBe('Search');
        expect(channelOf('https://t.co/abc')).toBe('Social');
        expect(channelOf('https://chatgpt.com/')).toBe('AI assistants');
        expect(channelOf('https://some-blog.dev/post')).toBe('Referral');
        expect(channelOf('')).toBe('Direct');
    });

    it('lets UTM medium override the referrer', () => {
        expect(channelOf('https://google.com', { utmMedium: 'cpc' })).toBe('Paid');
        expect(channelOf('', { utmMedium: 'email' })).toBe('Email');
        expect(channelOf('', { utmSource: 'newsletter' })).toBe('Campaign');
    });

    it('calls an unknown host Referral, not Other', () => {
        // "Other" hides a real, actionable domain behind a shrug.
        expect(channelOf('https://news.ycombinator.com')).toBe('Referral');
    });
});

describe('toChannels', () => {
    it('folds referrers into channels with shares, direct included', () => {
        const out = toChannels(
            [{ x: 'https://google.com', y: 6 }, { x: 'https://x.com', y: 2 }],
            { direct: 2 },
        );
        expect(out[0]).toMatchObject({ label: 'Search', value: 6, share: 60 });
        expect(out.find(c => c.label === 'Direct')).toMatchObject({ value: 2, share: 20 });
    });

    it('is empty rather than NaN with no data', () => {
        expect(toChannels([], {})).toEqual([]);
    });
});

describe('referrerHost', () => {
    it('reduces a referrer to a readable host', () => {
        expect(referrerHost('https://www.example.com/a/b?c=1')).toBe('example.com');
        expect(referrerHost('example.com')).toBe('example.com');
        expect(referrerHost('')).toBeNull();
    });
});

describe('foldEventData / leaderboards', () => {
    // Shape copied from a live /event-data response.
    const payload = {
        data: [
            {
                eventId: '1', eventName: 'cta_click',
                eventProperties: [
                    { dataKey: 'label', stringValue: 'Get started' },
                    { dataKey: 'blockType', stringValue: 'hero' },
                    { dataKey: 'block', stringValue: 'blk_a' },
                    { dataKey: 'href', stringValue: 'http://localhost:5176/product' },
                ],
            },
            {
                eventId: '2', eventName: 'cta_click',
                eventProperties: [
                    { dataKey: 'label', stringValue: 'Get started' },
                    { dataKey: 'blockType', stringValue: 'pricing' },
                ],
            },
            {
                eventId: '3', eventName: 'form_submit',
                eventProperties: [{ dataKey: 'form', stringValue: 'contact' }],
            },
        ],
    };

    it('flattens the nested property rows', () => {
        const events = foldEventData(payload);
        expect(events).toHaveLength(3);
        expect(events[0].props).toEqual({
            label: 'Get started', blockType: 'hero', block: 'blk_a',
            href: 'http://localhost:5176/product',
        });
    });

    it('groups a CTA by label and keeps its placements', () => {
        // "Get started" in a hero and in pricing is ONE call to action with two
        // placements — and the placements are the interesting part.
        const [top] = ctaLeaderboard(foldEventData(payload));
        expect(top).toMatchObject({ label: 'Get started', count: 2, eventName: 'cta_click' });
        expect(top.placements).toEqual([
            { type: 'hero', count: 1 },
            { type: 'pricing', count: 1 },
        ]);
        expect(top.href).toBe('http://localhost:5176/product');
    });

    it('falls back to the href, then a marker, when a label is missing', () => {
        const rows = ctaLeaderboard(foldEventData({
            data: [{ eventId: '9', eventName: 'outbound_click', eventProperties: [{ dataKey: 'href', stringValue: 'https://x.dev' }] }],
        }));
        expect(rows[0].label).toBe('https://x.dev');

        const bare = ctaLeaderboard(foldEventData({ data: [{ eventId: '8', eventName: 'cta_click', eventProperties: [] }] }));
        expect(bare[0].label).toBe('(unlabelled)');
    });

    it('ranks blocks and lists what was clicked in each', () => {
        const blocks = blockLeaderboard(foldEventData(payload));
        expect(blocks.map(b => b.type)).toEqual(['hero', 'pricing']);
        expect(blocks[0].labels).toEqual(['Get started']);
    });

    it('survives an empty or unexpected payload', () => {
        expect(foldEventData(null)).toEqual([]);
        expect(foldEventData({})).toEqual([]);
        expect(ctaLeaderboard([])).toEqual([]);
    });
});

describe('screenBuckets', () => {
    it('turns raw screen strings into design breakpoints', () => {
        const out = screenBuckets([
            { screen: '390x844' }, { screen: '1280x720' }, { screen: '1920x1080' }, { screen: '1440x900' },
        ]);
        expect(out.total).toBe(4);
        const labels = out.rows.map(r => r.label);
        expect(labels).toContain('Phone (< 480px)');
        expect(labels).toContain('Laptop (1024–1440)');
        // 1920 lands in Desktop (<= 1920), not Wide.
        expect(labels).toContain('Desktop (1440–1920)');
        expect(out.rows.every(r => r.count > 0)).toBe(true);
    });

    it('ignores unusable values rather than bucketing them as zero-width', () => {
        const out = screenBuckets([{ screen: '' }, { screen: 'nonsense' }, { }, { screen: '1280x720' }]);
        expect(out.total).toBe(1);
    });
});

describe('sessionSignals', () => {
    const base = { firstAt: '2026-07-27T10:00:00Z', lastAt: '2026-07-27T10:03:00Z', views: 5, visits: 1 };

    it('scores an interacting visitor above a passive one', () => {
        const engaged = sessionSignals(base, { events: 3 });
        const passive = sessionSignals(base, { events: 0 });
        expect(engaged.score).toBeGreaterThan(passive.score);
        expect(engaged.reasons).toContain('3 interactions');
    });

    it('penalises a one-page bounce', () => {
        const bounced = sessionSignals(
            { firstAt: '2026-07-27T10:00:00Z', lastAt: '2026-07-27T10:00:04Z', views: 1, visits: 1 },
            {},
        );
        expect(bounced.reasons).toContain('bounced');
        expect(bounced.score).toBeLessThan(0);
    });

    it('derives duration from the timestamps, in milliseconds', () => {
        // NOT the API's `duration` field — that is an rrweb aggregate, and
        // reading it as seconds is what printed "196m 21s" for a one-minute visit.
        expect(sessionSignals(base, {}).duration).toBe(180_000);
    });

    it('is 0ms rather than NaN when the timestamps are unusable', () => {
        expect(sessionSignals({ firstAt: 'x', lastAt: 'y', views: 1 }, {}).duration).toBe(0);
    });
});
