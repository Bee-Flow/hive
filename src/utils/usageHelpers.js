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
