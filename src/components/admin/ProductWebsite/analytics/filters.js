/**
 * Drill-down filter state for the analytics dashboard.
 *
 * Filters are a flat { dimension: value } object applied to every section, so
 * clicking "Chrome" in Browsers narrows Pages, Sources, Performance and the
 * rest at once. Keys must match Umami's dimension vocabulary — the server
 * re-validates against the same list and drops anything else.
 */

export const FILTER_LABELS = {
    path: 'Page',
    referrer: 'Referrer',
    title: 'Page title',
    query: 'Query',
    os: 'OS',
    browser: 'Browser',
    device: 'Device',
    country: 'Country',
    region: 'Region',
    city: 'City',
    tag: 'Tag',
    hostname: 'Host',
    language: 'Language',
    event: 'Event',
    utmSource: 'UTM source',
    utmMedium: 'UTM medium',
    utmCampaign: 'UTM campaign',
    utmContent: 'UTM content',
    utmTerm: 'UTM term',
};

export const FILTER_KEYS = Object.keys(FILTER_LABELS);

export function filterLabel(key) {
    return FILTER_LABELS[key] || key;
}

/** Immutably set one dimension. Unknown dimensions are ignored. */
export function withFilter(filters, key, value) {
    if (!FILTER_LABELS[key] || value === undefined || value === null || value === '') return filters;
    return { ...filters, [key]: String(value) };
}

/** Immutably clear one dimension. */
export function withoutFilter(filters, key) {
    if (!(key in (filters || {}))) return filters;
    const next = { ...filters };
    delete next[key];
    return next;
}

export function filterCount(filters) {
    return Object.keys(filters || {}).length;
}

/** Serialise for the URL so a filtered view is shareable. */
export function encodeFilters(filters) {
    const entries = Object.entries(filters || {}).filter(([k]) => FILTER_LABELS[k]);
    if (!entries.length) return '';
    return entries.map(([k, v]) => `${k}:${encodeURIComponent(v)}`).join(',');
}

export function decodeFilters(str) {
    const out = {};
    if (!str) return out;
    for (const part of String(str).split(',')) {
        const idx = part.indexOf(':');
        if (idx <= 0) continue;
        const key = part.slice(0, idx);
        if (!FILTER_LABELS[key]) continue;
        try { out[key] = decodeURIComponent(part.slice(idx + 1)); } catch { /* skip malformed */ }
    }
    return out;
}
