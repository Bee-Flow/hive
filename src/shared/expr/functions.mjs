/**
 * Whitelisted helper functions for the shared expression language.
 *
 * SHARED across the automation runtime (server) and App Studio (client + server).
 * Every function here is:
 *   - PURE: output depends only on its argument VALUES.
 *   - NULL-SAFE: never throws on null/undefined; returns a benign fallback.
 *   - DETERMINISTIC: no ambient time, no locale, no randomness — so the SAME
 *     expression + scope evaluates identically in Node and in the browser
 *     (that identity is the whole reason the engine is shared). "Now"/"today"
 *     are SCOPE variables, never functions, precisely to keep this property.
 *
 * The parser rejects any call to a name not in FUNCTIONS at PARSE time, so
 * this map is the complete, auditable set of callable forms. Adding a function
 * here makes it available to both runtimes at once; the FE syntax-help mirror
 * (agent-hub .../mapping/exprFunctions.js) and its lockstep test track this set.
 */

// ── Deterministic ISO date helpers (UTC-only) ──────────────────────────────
// Dates are ISO strings. We parse to a UTC instant MANUALLY so a bare
// 'YYYY-MM-DDTHH:MM:SS' (no zone) means the same thing in every JS engine —
// `new Date(isoWithoutZone)` is LOCAL-time in browsers but UTC for date-only,
// which would break client/server identity. Everything below is UTC.
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/;

function toEpoch(iso) {
    if (iso == null) return null;
    if (typeof iso === 'number' && isFinite(iso)) return iso;
    const s = String(iso).trim();
    let m = DATE_ONLY.exec(s);
    if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3]);
    m = DATE_TIME.exec(s);
    if (!m) { const t = Date.parse(s); return isNaN(t) ? null : t; }
    const [, y, mo, d, h, mi, se, zone] = m;
    let epoch = Date.UTC(+y, +mo - 1, +d, +h, +mi, se ? +se : 0);
    if (zone && zone !== 'Z') {
        const sign = zone[0] === '-' ? -1 : 1;
        const zz = zone.slice(1).replace(':', '');
        epoch -= sign * ((+zz.slice(0, 2)) * 60 + (+zz.slice(2, 4))) * 60000;
    }
    return epoch;
}

const UNIT_MS = { second: 1000, minute: 60000, hour: 3600000, day: 86400000, week: 604800000 };

function pad(n, w = 2) { return String(Math.abs(n)).padStart(w, '0'); }

function toNum(x) {
    if (x == null || x === '') return null;
    const n = typeof x === 'number' ? x : Number(x);
    return isFinite(n) ? n : null;
}

// Text matching is CASE-INSENSITIVE. A no-code filter that reads "subject
// contains ISV" must also keep "Re: isv contract" — case was by far the most
// common reason a filter silently returned nothing, and no builder-facing
// operator ever offered a way to say "ignore case". Only the STRING
// comparison changes: `contains(list, x)` keeps its exact-equality fast path
// for non-strings, ordering/equality operators are untouched, and `lower()`
// stays available for explicit normalisation.
const ciEq = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
const ci = (x) => String(x).toLowerCase();

// ── JSON path walker (for parseJson) ───────────────────────────────────────
// A miniature of the binding resolver's walkRelativePath (server
// automation/bind.js): dotted keys, [0] indices, ["quoted keys"], and a [*]
// wildcard that maps the remainder over an array and flattens one level.
// Prototype-chain members never resolve (own-property gate), so JSON text can
// never be used to reach `constructor`/`__proto__`. Misses return undefined —
// same contract as every path lookup in the engine.
function walkJsonSegments(value, segments, s) {
    let cur = value;
    for (let t = s; t < segments.length; t++) {
        const seg = segments[t];
        if (seg.wild) {
            if (!Array.isArray(cur)) return undefined;
            const out = [];
            for (const el of cur) {
                const m = walkJsonSegments(el, segments, t + 1);
                if (m === undefined) continue;
                if (Array.isArray(m)) out.push(...m);
                else out.push(m);
            }
            return out;
        }
        if (cur == null) return undefined;
        if (!Object.prototype.hasOwnProperty.call(cur, seg.key)) return undefined;
        cur = cur[seg.key];
    }
    return cur;
}

function walkJsonPath(value, path) {
    const segments = [];
    let i = 0;
    let buf = '';
    const flush = () => { if (buf.length) { segments.push({ key: buf }); buf = ''; } };
    while (i < path.length) {
        const c = path[i];
        if (c === '.') { flush(); i++; continue; }
        if (c === '[') {
            flush();
            const close = path.indexOf(']', i);
            if (close < 0) return undefined; // malformed → miss, never throw
            const raw = path.slice(i + 1, close);
            if (raw === '*') segments.push({ wild: true });
            else if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) segments.push({ key: raw.slice(1, -1) });
            else segments.push({ key: parseInt(raw, 10) });
            i = close + 1;
            continue;
        }
        buf += c;
        i++;
    }
    flush();
    return walkJsonSegments(value, segments, 0);
}

export const FUNCTIONS = {
    // ── Original 7 (kept byte-identical to server/automation/expr.js) ──────
    contains: (a, b) => {
        if (a == null) return false;
        if (Array.isArray(a)) return a.some((x) => x === b || (typeof x === 'string' && typeof b === 'string' && ci(x).includes(ci(b))));
        return ci(a).includes(b == null ? '' : ci(b));
    },
    startsWith: (a, b) => (a == null ? false : ci(a).startsWith(b == null ? '' : ci(b))),
    endsWith: (a, b) => (a == null ? false : ci(a).endsWith(b == null ? '' : ci(b))),
    lower: (a) => (a == null ? '' : String(a).toLowerCase()),
    upper: (a) => (a == null ? '' : String(a).toUpperCase()),
    len: (a) => {
        if (a == null) return 0;
        if (Array.isArray(a) || typeof a === 'string') return a.length;
        if (typeof a === 'object') return Object.keys(a).length;
        return 0;
    },
    isEmpty: (a) => {
        if (a == null) return true;
        if (Array.isArray(a) || typeof a === 'string') return a.length === 0;
        if (typeof a === 'object') return Object.keys(a).length === 0;
        return false;
    },

    // ── Numeric ────────────────────────────────────────────────────────────
    number: (x) => toNum(x),
    round: (x, places = 0) => {
        const n = toNum(x); if (n == null) return null;
        const p = toNum(places) || 0;
        const f = Math.pow(10, p);
        return Math.round(n * f) / f;
    },
    floor: (x) => { const n = toNum(x); return n == null ? null : Math.floor(n); },
    ceil: (x) => { const n = toNum(x); return n == null ? null : Math.ceil(n); },
    abs: (x) => { const n = toNum(x); return n == null ? null : Math.abs(n); },
    min: (...xs) => { const ns = xs.map(toNum).filter((n) => n != null); return ns.length ? Math.min(...ns) : null; },
    max: (...xs) => { const ns = xs.map(toNum).filter((n) => n != null); return ns.length ? Math.max(...ns) : null; },
    clamp: (x, lo, hi) => {
        const n = toNum(x); if (n == null) return null;
        const l = toNum(lo); const h = toNum(hi);
        let r = n; if (l != null) r = Math.max(r, l); if (h != null) r = Math.min(r, h); return r;
    },
    sum: (arr) => (Array.isArray(arr) ? arr.reduce((s, x) => s + (toNum(x) || 0), 0) : 0),
    avg: (arr) => {
        if (!Array.isArray(arr)) return null;
        const ns = arr.map(toNum).filter((n) => n != null);
        return ns.length ? ns.reduce((s, n) => s + n, 0) / ns.length : null;
    },

    // ── Null / logic ─────────────────────────────────────────────────────
    coalesce: (...xs) => { for (const x of xs) if (x != null) return x; return null; },
    default: (x, fb) => (x == null ? (fb == null ? null : fb) : x),
    ifNull: (x, fb) => (x == null ? (fb == null ? null : fb) : x),

    // ── String ────────────────────────────────────────────────────────────
    trim: (s) => (s == null ? '' : String(s).trim()),
    concat: (...xs) => xs.map((x) => (x == null ? '' : String(x))).join(''),
    replace: (s, find, repl) => (s == null ? '' : String(s).split(find == null ? '' : String(find)).join(repl == null ? '' : String(repl))),
    split: (s, sep) => (s == null ? [] : String(s).split(sep == null ? '' : String(sep))),
    join: (arr, sep) => (Array.isArray(arr) ? arr.map((x) => (x == null ? '' : String(x))).join(sep == null ? '' : String(sep)) : ''),
    substring: (s, a, b) => {
        if (s == null) return '';
        const str = String(s); const start = toNum(a) || 0;
        return b == null ? str.substring(start) : str.substring(start, toNum(b) || 0);
    },
    padStart: (s, n, ch) => (s == null ? '' : String(s).padStart(toNum(n) || 0, ch == null ? ' ' : String(ch))),
    toStr: (x) => (x == null ? '' : String(x)),

    // ── Array ─────────────────────────────────────────────────────────────
    first: (arr) => (Array.isArray(arr) && arr.length ? arr[0] : null),
    last: (arr) => (Array.isArray(arr) && arr.length ? arr[arr.length - 1] : null),
    includes: (arr, x) => (Array.isArray(arr)
        ? arr.some((el) => el === x || (typeof el === 'string' && typeof x === 'string' && ciEq(el, x)))
        : false),
    count: (a) => {
        if (a == null) return 0;
        if (Array.isArray(a) || typeof a === 'string') return a.length;
        if (typeof a === 'object') return Object.keys(a).length;
        return 0;
    },

    // ── JSON ──────────────────────────────────────────────────────────────
    // Parse JSON text and optionally pick a path out of it. This is the
    // expression-language successor of the parse_json step: deterministic,
    // free at run time, never throws (invalid JSON → null). The grammar has
    // no member access on a call result — `parseJson(x).user` cannot parse —
    // so the two-argument form IS the way to reach into the parsed value.
    // Already-parsed objects/arrays pass through, so the same expression
    // works whether an upstream tool returned text or structured data.
    parseJson: (text, path) => {
        if (text == null) return null;
        let v;
        if (typeof text === 'object') v = text;
        else {
            let s = String(text);
            if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1); // strip BOM
            s = s.trim();
            if (!s) return null;
            try { v = JSON.parse(s); } catch { return null; }
        }
        return (path == null || path === '' || path === '$') ? v : walkJsonPath(v, String(path));
    },

    // ── Date (operate on ISO strings; UTC + deterministic) ────────────────
    dateAdd: (iso, n, unit) => {
        const e = toEpoch(iso); if (e == null) return null;
        const amt = toNum(n) || 0; const ms = UNIT_MS[unit] || UNIT_MS.day;
        return new Date(e + amt * ms).toISOString();
    },
    dateDiff: (a, b, unit) => {
        const ea = toEpoch(a); const eb = toEpoch(b);
        if (ea == null || eb == null) return null;
        const ms = UNIT_MS[unit] || UNIT_MS.day;
        return Math.floor((ea - eb) / ms);
    },
    formatDate: (iso, fmt) => {
        const e = toEpoch(iso); if (e == null) return '';
        const d = new Date(e);
        const map = {
            YYYY: d.getUTCFullYear(), MM: pad(d.getUTCMonth() + 1), DD: pad(d.getUTCDate()),
            HH: pad(d.getUTCHours()), mm: pad(d.getUTCMinutes()), ss: pad(d.getUTCSeconds()),
        };
        return String(fmt == null ? 'YYYY-MM-DD' : fmt).replace(/YYYY|MM|DD|HH|mm|ss/g, (t) => map[t]);
    },
    year: (iso) => { const e = toEpoch(iso); return e == null ? null : new Date(e).getUTCFullYear(); },
    month: (iso) => { const e = toEpoch(iso); return e == null ? null : new Date(e).getUTCMonth() + 1; },
    day: (iso) => { const e = toEpoch(iso); return e == null ? null : new Date(e).getUTCDate(); },
    weekday: (iso) => { const e = toEpoch(iso); return e == null ? null : new Date(e).getUTCDay(); }, // 0=Sun
    isBefore: (a, b) => { const ea = toEpoch(a); const eb = toEpoch(b); return ea == null || eb == null ? false : ea < eb; },
    isAfter: (a, b) => { const ea = toEpoch(a); const eb = toEpoch(b); return ea == null || eb == null ? false : ea > eb; },
};

// Rich metadata for the inspector's syntax-help panel. Kept next to the
// implementations so a new function is documented where it's defined.
export const EXPR_FUNCTIONS = [
    { name: 'contains', signature: 'contains(text, part)', description: 'True when text (or a list) contains part. Ignores upper/lower case.' },
    { name: 'startsWith', signature: 'startsWith(text, part)', description: 'True when text starts with part. Ignores upper/lower case.' },
    { name: 'endsWith', signature: 'endsWith(text, part)', description: 'True when text ends with part. Ignores upper/lower case.' },
    { name: 'lower', signature: 'lower(text)', description: 'Lowercase the text.' },
    { name: 'upper', signature: 'upper(text)', description: 'Uppercase the text.' },
    { name: 'len', signature: 'len(value)', description: 'Length of text, a list, or an object.' },
    { name: 'isEmpty', signature: 'isEmpty(value)', description: 'True for missing values, empty text, lists or objects.' },
    { name: 'number', signature: 'number(value)', description: 'Convert to a number (or null if not numeric).' },
    { name: 'round', signature: 'round(value, places?)', description: 'Round to the given decimal places (default 0).' },
    { name: 'floor', signature: 'floor(value)', description: 'Round down to a whole number.' },
    { name: 'ceil', signature: 'ceil(value)', description: 'Round up to a whole number.' },
    { name: 'abs', signature: 'abs(value)', description: 'Absolute value.' },
    { name: 'min', signature: 'min(a, b, …)', description: 'Smallest of the given numbers.' },
    { name: 'max', signature: 'max(a, b, …)', description: 'Largest of the given numbers.' },
    { name: 'clamp', signature: 'clamp(value, lo, hi)', description: 'Constrain value between lo and hi.' },
    { name: 'sum', signature: 'sum(list)', description: 'Sum of a list of numbers.' },
    { name: 'avg', signature: 'avg(list)', description: 'Average of a list of numbers.' },
    { name: 'coalesce', signature: 'coalesce(a, b, …)', description: 'First value that is not empty.' },
    { name: 'default', signature: 'default(value, fallback)', description: 'value, or fallback when value is empty.' },
    { name: 'ifNull', signature: 'ifNull(value, fallback)', description: 'value, or fallback when value is empty.' },
    { name: 'trim', signature: 'trim(text)', description: 'Remove surrounding whitespace.' },
    { name: 'concat', signature: 'concat(a, b, …)', description: 'Join values into one string.' },
    { name: 'replace', signature: 'replace(text, find, with)', description: 'Replace every occurrence of find.' },
    { name: 'split', signature: 'split(text, sep)', description: 'Split text into a list on sep.' },
    { name: 'join', signature: 'join(list, sep)', description: 'Join a list into text with sep.' },
    { name: 'substring', signature: 'substring(text, start, end?)', description: 'Slice of text between start and end.' },
    { name: 'padStart', signature: 'padStart(text, length, char?)', description: 'Pad the start of text to a length.' },
    { name: 'toStr', signature: 'toStr(value)', description: 'Convert any value to text.' },
    { name: 'first', signature: 'first(list)', description: 'First item of a list.' },
    { name: 'last', signature: 'last(list)', description: 'Last item of a list.' },
    { name: 'includes', signature: 'includes(list, value)', description: 'True when the list contains value (text ignores case).' },
    { name: 'count', signature: 'count(value)', description: 'Number of items in a list/text/object.' },
    { name: 'parseJson', signature: 'parseJson(text, path?)', description: 'Parse JSON text and optionally pick a path from it (a.b, items[0].x, items[*].x). Invalid JSON gives null.' },
    { name: 'dateAdd', signature: 'dateAdd(date, n, unit)', description: 'Add n units (day/hour/…) to an ISO date.' },
    { name: 'dateDiff', signature: 'dateDiff(a, b, unit)', description: 'Whole units between two ISO dates (a − b).' },
    { name: 'formatDate', signature: 'formatDate(date, "YYYY-MM-DD")', description: 'Format an ISO date (UTC) with YYYY/MM/DD/HH/mm/ss.' },
    { name: 'year', signature: 'year(date)', description: 'Year of an ISO date (UTC).' },
    { name: 'month', signature: 'month(date)', description: 'Month 1–12 of an ISO date (UTC).' },
    { name: 'day', signature: 'day(date)', description: 'Day of month of an ISO date (UTC).' },
    { name: 'weekday', signature: 'weekday(date)', description: 'Day of week 0–6 (Sun=0) of an ISO date (UTC).' },
    { name: 'isBefore', signature: 'isBefore(a, b)', description: 'True when ISO date a is before b.' },
    { name: 'isAfter', signature: 'isAfter(a, b)', description: 'True when ISO date a is after b.' },
];

export const EXPR_FUNCTION_NAMES = Object.keys(FUNCTIONS);
