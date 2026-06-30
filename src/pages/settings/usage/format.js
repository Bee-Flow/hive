// Shared formatters for the Usage & Monitoring dashboard.
//
// These previously lived (duplicated, with small drifts) inside UsageSection.jsx,
// OrgFeedbackPanel.jsx and OrgTerminationsPanel.jsx. Consolidated here so every
// tab formats numbers, durations, models and dates identically.

// Compact number: 1.2M / 3.4K / 999. Null/undefined → '0'.
export const fNum = (n) => {
    if (n == null) return '0';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return n.toLocaleString?.() ?? String(n);
};

// USD currency, two decimals.
export const fCur = (c) => `$${(c || 0).toFixed(2)}`;

// Symbol for an ISO currency code.
export const currencySym = (c) =>
    ({ EUR: '€', USD: '$', GBP: '£' }[String(c || 'EUR').toUpperCase()] || (c || '€'));

// "5 Jun – 5 Jul 2026" style range from two ISO timestamps.
export const formatDateRange = (startIso, endIso) => {
    try {
        const a = startIso ? new Date(startIso) : null;
        const b = endIso ? new Date(endIso) : null;
        if (!a || !b) return '';
        const yearOpts = { day: 'numeric', month: 'short', year: 'numeric' };
        return `${a.toLocaleDateString(undefined, yearOpts)} – ${b.toLocaleDateString(undefined, yearOpts)}`;
    } catch { return ''; }
};

// Strip provider prefix + trailing dated snapshot from a model id.
export const shortModel = (m) => {
    if (!m) return 'Unknown';
    return m.replace(/^(openai\/|anthropic\/|google\/|azure\/|mistral\/)/, '')
            .replace(/-\d{4}-\d{2}-\d{2}$/, '');
};

// Date → value for an <input type="datetime-local"> (local time, no seconds).
export const toLocalInput = (date) => {
    const d = new Date(date);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// Relative "just now / 5m / 3h" within a day, else a locale date.
export const fmtTime = (ts) => {
    if (!ts) return '—';
    const d = new Date(ts);
    const diff = Date.now() - d.getTime();
    if (diff < 60_000) return 'just now';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
    return d.toLocaleDateString();
};

// Human bytes. 0/empty → '0 B'.
export const fmtBytes = (n) => {
    if (!n || n <= 0) return '0 B';
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
    return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

// Duration in ms → "420 ms" / "1.4 s". `invalid` is returned for missing/zero
// values — pass `{ invalid: null }` when the caller hides the badge on falsy.
export const fmtDuration = (ms, { invalid = '—' } = {}) => {
    if (ms == null || ms === '') return invalid;
    const n = Number(ms);
    if (!Number.isFinite(n) || n <= 0) return invalid;
    if (n < 1000) return `${Math.round(n)} ms`;
    return `${(n / 1000).toFixed(1)} s`;
};
