/**
 * Pure folds for the heatmap. Kept out of the components so the part that
 * carries the actual insight — "which block earns the clicks" — is testable
 * without a canvas or an iframe.
 */

/**
 * Normalise Umami's heatmap points.
 *
 * Every point carries absolute page coordinates AND the page width it was
 * captured at, which is what makes overlaying them on a re-rendered page
 * possible. Points captured at different widths must never be normalised
 * together — a 390px mobile click and a 1280px desktop click at the same
 * pageX are in completely different places on the page.
 */
export function toPoints(payload) {
    const raw = Array.isArray(payload?.points) ? payload.points
        : Array.isArray(payload) ? payload
        : Array.isArray(payload?.data) ? payload.data
        : [];
    return raw
        .map(p => ({
            x: Number(p.pageX ?? p.x ?? p.clientX ?? p.left),
            y: Number(p.pageY ?? p.y ?? p.clientY ?? p.top),
            pageW: Number(p.pageW) || 0,
            pageH: Number(p.pageH) || 0,
            viewportH: Number(p.viewportH) || 0,
            count: Number(p.count ?? p.value ?? p.n ?? 1) || 1,
        }))
        .filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));
}

/**
 * Group points by the width they were captured at.
 *
 * Returns widths sorted by click volume, so the default view is the one most
 * visitors actually saw rather than whichever happens to be widest.
 */
export function groupByWidth(points) {
    const byWidth = new Map();
    for (const p of points) {
        const w = p.pageW || 0;
        if (!w) continue;
        const g = byWidth.get(w) || { width: w, points: [], clicks: 0, pageH: 0 };
        g.points.push(p);
        g.clicks += p.count;
        if (p.pageH > g.pageH) g.pageH = p.pageH;
        byWidth.set(w, g);
    }
    const groups = [...byWidth.values()].sort((a, b) => b.clicks - a.clicks);
    const total = groups.reduce((a, g) => a + g.clicks, 0) || 1;
    return groups.map(g => ({ ...g, share: (g.clicks / total) * 100 }));
}

/**
 * Attribute clicks to the CMS blocks they landed in.
 *
 * `blocks` come from reading the same-origin iframe's DOM, so they are the real
 * rendered geometry rather than a guess. A click that falls outside every block
 * is site chrome (header/footer) — reported as its own row rather than dropped,
 * because silently discarding 20% of the clicks would make every share wrong.
 */
export function attributeToBlocks(points, blocks, { views = 0 } = {}) {
    const totals = new Map();
    let chrome = 0;
    let total = 0;

    // Descending by top edge: the last block whose range contains y wins, so
    // nested/overlapping wrappers attribute to the innermost one.
    const ordered = [...(blocks || [])].sort((a, b) => a.top - b.top);

    for (const p of points) {
        total += p.count;
        let hit = null;
        for (const b of ordered) {
            if (p.y >= b.top && p.y < b.top + b.height) hit = b;
        }
        if (!hit) { chrome += p.count; continue; }
        const cur = totals.get(hit.id) || { id: hit.id, type: hit.type, top: hit.top, height: hit.height, clicks: 0 };
        cur.clicks += p.count;
        totals.set(hit.id, cur);
    }

    const rows = [...totals.values()].map(r => ({
        ...r,
        share: total ? (r.clicks / total) * 100 : 0,
        // Clicks per 100 views is the comparable number: a block far down the
        // page gets fewer clicks simply because fewer people reach it.
        per100: views ? (r.clicks / views) * 100 : null,
    })).sort((a, b) => b.clicks - a.clicks);

    if (chrome > 0) {
        rows.push({
            id: '__chrome__', type: 'chrome', top: null, height: null, clicks: chrome,
            share: total ? (chrome / total) * 100 : 0,
            per100: views ? (chrome / views) * 100 : null,
        });
    }
    return { rows, total, chrome };
}

/** Human label for a block type, e.g. `media-text` → `Media & text`. */
const TYPE_LABELS = {
    hero: 'Hero',
    socialProof: 'Social proof',
    content: 'Content',
    'media-text': 'Media & text',
    features: 'Features',
    steps: 'Steps',
    security: 'Security',
    integrations: 'Integrations',
    architecture: 'Architecture',
    techStats: 'Tech stats',
    cta: 'Call to action',
    'cta-banner': 'CTA banner',
    'live-component': 'Live component',
    pricing: 'Pricing',
    'customer-support': 'Support form',
    chrome: 'Site chrome (header & footer)',
};
export const blockLabel = (type) => TYPE_LABELS[type]
    || String(type || 'Block').replace(/[-_]/g, ' ').replace(/^./, c => c.toUpperCase());

/**
 * Scroll reach → a monotonically decreasing curve.
 *
 * Umami returns a bucket per depth that was reached, but a visitor who reached
 * 60% necessarily passed 20% and 40%, so the raw per-bucket session counts are
 * not the reach. Accumulate from the bottom up to get "% who got at least this
 * far", which is the number the fold line and the dimming actually mean.
 */
export function toScrollReach(scroll) {
    const buckets = Array.isArray(scroll?.buckets) ? scroll.buckets : [];
    const totalSessions = Number(scroll?.totalSessions) || 0;
    if (!buckets.length || !totalSessions) return { steps: [], totalSessions, pageH: null, viewportH: null };

    const byDepth = [...buckets]
        .map(b => ({ depth: Number(b.depth) || 0, sessions: Number(b.sessions) || 0 }))
        .sort((a, b) => a.depth - b.depth);

    let running = 0;
    const steps = [];
    for (let i = byDepth.length - 1; i >= 0; i--) {
        running += byDepth[i].sessions;
        steps.unshift({
            depth: byDepth[i].depth,
            sessions: running,
            reach: Math.min(100, (running / totalSessions) * 100),
        });
    }
    return {
        steps,
        totalSessions,
        pageH: Number(scroll?.pageH) || null,
        viewportH: Number(scroll?.viewportH) || null,
    };
}

/** Reach at an arbitrary depth, interpolated between the measured buckets. */
export function reachAt(steps, depthPct) {
    if (!steps?.length) return null;
    if (depthPct <= steps[0].depth) return 100;
    for (let i = 0; i < steps.length; i++) {
        if (steps[i].depth >= depthPct) {
            const prev = steps[i - 1];
            if (!prev) return steps[i].reach;
            const k = (depthPct - prev.depth) / (steps[i].depth - prev.depth || 1);
            return prev.reach + (steps[i].reach - prev.reach) * k;
        }
    }
    return steps[steps.length - 1].reach;
}
