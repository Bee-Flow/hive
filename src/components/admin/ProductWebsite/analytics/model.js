/**
 * Pure folds shared by the breakdown sections.
 *
 * These live outside the components because they are where the actual thinking
 * is — turning Umami's raw dimension rows into the handful of numbers a
 * marketer can act on — and because that thinking is worth testing without a
 * DOM.
 */

/**
 * A `/report/breakdown` row, normalised.
 *
 * The requested field comes back under a key whose casing Umami does not
 * guarantee, so look it up case-insensitively rather than hoping. Getting this
 * wrong yields a table of nulls that looks like "no data".
 */
function readField(row, field) {
    if (row[field] !== undefined) return row[field];
    const want = field.toLowerCase();
    for (const k of Object.keys(row)) {
        if (k.toLowerCase() === want) return row[k];
    }
    return null;
}

export function pivotRow(row, fields) {
    const out = {
        views: Number(row.views) || 0,
        visitors: Number(row.visitors) || 0,
        visits: Number(row.visits) || 0,
        bounces: Number(row.bounces) || 0,
        totaltime: Number(row.totaltime) || 0,
    };
    for (const f of fields) {
        out[f] = readField(row, f) ?? null;
    }
    out.bounceRate = out.visits > 0 ? (out.bounces / out.visits) * 100 : null;
    // Time on page is only meaningful per VISIT; dividing by views would
    // understate it on any page someone reloads.
    out.avgTime = out.visits > 0 ? out.totaltime / out.visits : null;
    return out;
}

export function pivot(rows, fields) {
    return (Array.isArray(rows) ? rows : []).map(r => pivotRow(r, fields));
}

/**
 * Classify a referrer into a marketing channel.
 *
 * A marketing site's referrer list is mostly a long tail of one-visit domains;
 * the channel is the part anyone actually acts on. Deliberately a small, honest
 * table rather than a 500-entry copy of GA's — anything unrecognised is
 * "Referral", which is true, instead of being silently bucketed as "Other".
 */
const SEARCH = /(^|\.)(google|bing|duckduckgo|yahoo|yandex|ecosia|baidu|brave|startpage|qwant)\./i;
const SOCIAL = /(^|\.)(facebook|instagram|twitter|x|t|linkedin|reddit|youtube|pinterest|tiktok|mastodon|bsky|threads)\./i;
const EMAIL = /(^|\.)(mail|outlook|gmail|superhuman|hey)\./i;
const AI = /(^|\.)(chatgpt|openai|perplexity|claude|anthropic|copilot|gemini)\./i;

export function channelOf(referrer, utm = {}) {
    const medium = String(utm.utmMedium || '').toLowerCase();
    if (medium.includes('cpc') || medium.includes('ppc') || medium.includes('paid')) return 'Paid';
    if (medium.includes('email') || medium.includes('newsletter')) return 'Email';
    if (medium.includes('social')) return 'Social';
    if (utm.utmSource || utm.utmCampaign) return 'Campaign';

    const host = String(referrer || '').replace(/^https?:\/\//, '').split('/')[0].toLowerCase();
    if (!host) return 'Direct';
    if (SEARCH.test(host)) return 'Search';
    if (SOCIAL.test(host)) return 'Social';
    if (EMAIL.test(host)) return 'Email';
    if (AI.test(host)) return 'AI assistants';
    return 'Referral';
}

export const CHANNEL_ORDER = ['Direct', 'Search', 'Referral', 'Social', 'Email', 'AI assistants', 'Campaign', 'Paid'];

/** `[{x: referrer, y: count}]` → channel totals, biggest first. */
export function toChannels(referrerRows, { direct = 0 } = {}) {
    const totals = new Map();
    if (direct > 0) totals.set('Direct', direct);
    for (const r of Array.isArray(referrerRows) ? referrerRows : []) {
        const ch = channelOf(r.x);
        totals.set(ch, (totals.get(ch) || 0) + (Number(r.y) || 0));
    }
    const sum = [...totals.values()].reduce((a, b) => a + b, 0) || 1;
    return [...totals.entries()]
        .map(([label, value]) => ({ label, value, share: (value / sum) * 100 }))
        .sort((a, b) => b.value - a.value
            || CHANNEL_ORDER.indexOf(a.label) - CHANNEL_ORDER.indexOf(b.label));
}

/** A referrer's display name — the host, without the protocol or trailing path. */
export function referrerHost(referrer) {
    const s = String(referrer || '').trim();
    if (!s) return null;
    try {
        return new URL(s.includes('://') ? s : `https://${s}`).hostname.replace(/^www\./, '');
    } catch {
        return s.replace(/^https?:\/\//, '').split('/')[0].replace(/^www\./, '') || s;
    }
}

/**
 * Fold `/event-data` rows into one row per event occurrence, with its
 * properties flattened.
 *
 * Umami returns one row per EVENT with a nested `eventProperties` array of
 * `{dataKey, stringValue, numberValue, dateValue}`. Our auto-tracked events
 * carry `label`, `href`, `block` and `blockType`, which is what makes
 * per-block conversion attribution possible at all.
 */
export function foldEventData(payload) {
    const rows = Array.isArray(payload?.data) ? payload.data
        : Array.isArray(payload) ? payload : [];
    return rows.map(r => {
        const props = {};
        for (const p of Array.isArray(r.eventProperties) ? r.eventProperties : []) {
            const v = p.stringValue ?? p.numberValue ?? p.dateValue;
            if (v !== undefined && v !== null && p.dataKey) props[p.dataKey] = v;
        }
        return { eventId: r.eventId, eventName: r.eventName, props };
    });
}

/**
 * Rank the things visitors actually clicked.
 *
 * Groups by the human label rather than the block id, because "Get started"
 * appearing in three blocks is one CTA with three placements — and the
 * placements are the interesting part, so they are kept as a breakdown.
 */
export function ctaLeaderboard(events) {
    const byLabel = new Map();
    for (const e of events) {
        const label = e.props.label || e.props.href || '(unlabelled)';
        const key = `${e.eventName}::${label}`;
        const cur = byLabel.get(key) || {
            key, eventName: e.eventName, label, count: 0,
            href: e.props.href || null, placements: new Map(),
        };
        cur.count += 1;
        if (e.props.blockType) {
            cur.placements.set(e.props.blockType, (cur.placements.get(e.props.blockType) || 0) + 1);
        }
        if (!cur.href && e.props.href) cur.href = e.props.href;
        byLabel.set(key, cur);
    }
    return [...byLabel.values()]
        .map(r => ({
            ...r,
            placements: [...r.placements.entries()]
                .map(([type, count]) => ({ type, count }))
                .sort((a, b) => b.count - a.count),
        }))
        .sort((a, b) => b.count - a.count);
}

/** Same events, grouped by the CMS block they fired in. */
export function blockLeaderboard(events) {
    const byBlock = new Map();
    for (const e of events) {
        const type = e.props.blockType;
        if (!type) continue;
        const cur = byBlock.get(type) || { type, count: 0, labels: new Set() };
        cur.count += 1;
        if (e.props.label) cur.labels.add(e.props.label);
        byBlock.set(type, cur);
    }
    return [...byBlock.values()]
        .map(r => ({ ...r, labels: [...r.labels] }))
        .sort((a, b) => b.count - a.count);
}

/**
 * Screen widths → the breakpoints a designer actually needs.
 *
 * `sessions[].screen` is "1280x720". Nothing in the product used it, and it is
 * the only honest answer to "what widths do I have to design for".
 */
const BUCKETS = [
    { max: 480, label: 'Phone (< 480px)' },
    { max: 768, label: 'Large phone (480–768)' },
    { max: 1024, label: 'Tablet (768–1024)' },
    { max: 1440, label: 'Laptop (1024–1440)' },
    { max: 1920, label: 'Desktop (1440–1920)' },
    { max: Infinity, label: 'Wide (1920+)' },
];

export function screenBuckets(sessions) {
    const counts = new Map(BUCKETS.map(b => [b.label, 0]));
    let total = 0;
    for (const s of Array.isArray(sessions) ? sessions : []) {
        const w = Number(String(s.screen || '').split('x')[0]);
        if (!Number.isFinite(w) || w <= 0) continue;
        const b = BUCKETS.find(x => w <= x.max);
        counts.set(b.label, counts.get(b.label) + 1);
        total += 1;
    }
    return {
        total,
        rows: BUCKETS.map(b => ({
            label: b.label,
            count: counts.get(b.label),
            share: total ? (counts.get(b.label) / total) * 100 : 0,
        })).filter(r => r.count > 0),
    };
}

/**
 * An "is this worth watching?" score for a session.
 *
 * A chronological list cannot answer that. These weights are deliberately
 * simple and are shown to the user as the reasons behind the score, so the
 * ranking is inspectable rather than a black box.
 */
export function sessionSignals(session, { events = 0, replay = null } = {}) {
    const reasons = [];
    let score = 0;

    const views = Number(session.views) || 0;
    const durationMs = Date.parse(session.lastAt) - Date.parse(session.firstAt);
    const duration = Number.isFinite(durationMs) ? Math.max(0, durationMs) : 0;

    if (events > 0) { score += 40 + Math.min(20, events * 4); reasons.push(`${events} interaction${events > 1 ? 's' : ''}`); }
    if (views >= 4) { score += 20; reasons.push(`${views} pages`); }
    if (duration >= 120_000) { score += 15; reasons.push('long visit'); }
    if (views === 1 && duration < 10_000) { score -= 10; reasons.push('bounced'); }
    if (replay) { score += 10; reasons.push('recorded'); }
    if ((Number(session.visits) || 0) > 1) { score += 10; reasons.push('returning'); }

    return { score, reasons, duration, views, events, hasReplay: !!replay };
}
