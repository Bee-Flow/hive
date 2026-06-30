// Helpers shared by the Usage & Monitoring dashboard surfaces.
//
// Lives outside UsageSection.jsx so the standalone Feedback / Terminations
// panels can import the same primitives without duplicating logic.

// ── CSV export ──────────────────────────────────────────────────────────────
// Minimal RFC 4180 escaping — enough for ≤ a few thousand audit rows.

export function csvEscape(v) {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function rowsToCsv(headers, rows) {
    const lines = [headers.join(',')];
    for (const r of rows) lines.push(headers.map(h => csvEscape(r[h])).join(','));
    return lines.join('\n');
}

export function downloadCsv(filename, csv) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ── Half-period trend delta ─────────────────────────────────────────────────
// Splits a timeline (an array of per-day rows) in half, reduces each half via
// `valueFn(row) -> number`, and returns the delta. The Integrations score
// trend uses this pattern with a PII-weighted formula; Overview / Safety use
// it with simpler value functions (sum of cost, count of pii).
//
// Returns `{ delta, prev, curr }` or null when there's not enough history.

export function computeHalfPeriodDelta(timeline, valueFn, opts = {}) {
    const minBuckets = opts.minBuckets || 2;
    if (!Array.isArray(timeline) || timeline.length < minBuckets) return null;
    const half = Math.floor(timeline.length / 2);
    if (half < 1) return null;
    const sumOver = (arr) => arr.reduce((s, r) => s + (Number(valueFn(r)) || 0), 0);
    const prev = sumOver(timeline.slice(0, half));
    const curr = sumOver(timeline.slice(half));
    return { delta: curr - prev, prev, curr };
}

// ── Unified date range adapter ──────────────────────────────────────────────
// One range model `{ preset, customStart, customEnd }` drives all five tabs.
// `deriveRangeParams` turns it into every shape the heterogeneous endpoints
// need at once, so each consumer picks the pair its route understands:
//   • usage family  → `?days=N`  (and, once the backend tweak ships, startDate/endDate)
//   • feedback      → `?startDate&endDate`  (omit both = all-time)
//   • terminations  → `?days=N` | `?startDate&endDate` (+ `interval`); omit = all-time
//
// `days` is null for the 'all' preset (truly unbounded); consumers that can
// only express a day count fall back to a large bound (see USAGE_ALL_DAYS).
export const USAGE_ALL_DAYS = 3650; // ~10y — "all" fallback for days-only routes

export function deriveRangeParams(range) {
    const { preset, customStart, customEnd } = range || {};
    const DAY = 86400000;
    const now = new Date();
    const iso = (d) => new Date(d).toISOString();
    const ago = (ms) => iso(new Date(now.getTime() - ms));
    const startOfToday = () => { const d = new Date(now); d.setHours(0, 0, 0, 0); return iso(d); };

    switch (preset) {
        case 'today':
            return { days: 1, startDate: startOfToday(), endDate: iso(now), interval: 'hour' };
        case '24h':
            return { days: 1, startDate: ago(DAY), endDate: iso(now), interval: 'hour' };
        case '7d':
            return { days: 7, startDate: ago(7 * DAY), endDate: iso(now), interval: 'day' };
        case '30d':
            return { days: 30, startDate: ago(30 * DAY), endDate: iso(now), interval: 'day' };
        case '90d':
            return { days: 90, startDate: ago(90 * DAY), endDate: iso(now), interval: 'day' };
        case 'all':
            return { days: null, startDate: null, endDate: null, interval: 'day' };
        case 'custom': {
            if (customStart && customEnd) {
                const s = new Date(customStart), e = new Date(customEnd);
                const span = Math.max(0, e.getTime() - s.getTime());
                return {
                    days: Math.max(1, Math.ceil(span / DAY)),
                    startDate: iso(s),
                    endDate: iso(e),
                    interval: span <= DAY ? 'hour' : 'day',
                };
            }
            return { days: 30, startDate: null, endDate: null, interval: 'day' };
        }
        default:
            return { days: 30, startDate: ago(30 * DAY), endDate: iso(now), interval: 'day' };
    }
}

// ── Model → tier mapping ────────────────────────────────────────────────────
// Usage/termination rows carry `model` but no tier. `/ai/config/tiers-for-user`
// returns `{ tierKey: { modelId } | modelId }`; invert it once so the cloud
// view can badge each row's model with its configured tier. Unknown models
// fall back to no tier (model-only badge).
export function buildModelTierMap(tiersForUser) {
    const map = {};
    if (tiersForUser && typeof tiersForUser === 'object') {
        for (const [tier, val] of Object.entries(tiersForUser)) {
            const modelId = typeof val === 'string' ? val : (val && val.modelId);
            if (modelId) map[modelId] = tier;
        }
    }
    return map;
}

export function tierForModel(map, model) {
    if (!map || !model) return null;
    return map[model] || null;
}
