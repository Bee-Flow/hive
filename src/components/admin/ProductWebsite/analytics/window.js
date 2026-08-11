/**
 * Time-window maths for the analytics charts.
 *
 * The reason this file exists: Umami returns only the buckets that HAVE data.
 * Ask for seven days on a site that was busy for one, and you get a single
 * point — which is why the overview chart rendered as a flat line with
 * "07-27 00:00" as both axis labels. Every series has to be densified against
 * the window that was actually requested before it is charted.
 */

const MS_MIN = 60_000;
const MS_HOUR = 3_600_000;
const MS_DAY = 86_400_000;

/** Mirrors the server's rangeToWindow so the client can label the same buckets. */
export function resolveWindow(scope) {
    const { range = '7d', start, end } = scope || {};
    if (range === 'custom') {
        const s = Number(start);
        const e = Number(end);
        if (Number.isFinite(s) && Number.isFinite(e) && e > s) {
            return { startAt: s, endAt: e, unit: (e - s) <= 2 * MS_DAY ? 'hour' : 'day' };
        }
    }
    const endAt = Date.now();
    const days = range === '24h' ? 1 : range === '30d' ? 30 : range === '90d' ? 90 : 7;
    return { startAt: endAt - days * MS_DAY, endAt, unit: range === '24h' ? 'hour' : 'day' };
}

/** The window immediately before this one, same length — what `comparison` covers. */
export function previousWindow(w) {
    const span = w.endAt - w.startAt;
    return { startAt: w.startAt - span, endAt: w.startAt, unit: w.unit };
}

/**
 * Umami timestamps are `"2026-07-27 13:00:00"` — no timezone marker, already
 * shifted into the timezone we asked for. `Date.parse` would read that as UTC
 * on some engines and local on others, so parse the fields explicitly and
 * rebuild as UTC. Every bucket key in this module is therefore "wall clock,
 * treated as UTC", which is consistent and DST-stable.
 */
export function parseBucket(x) {
    if (x instanceof Date) return x.getTime();
    if (typeof x === 'number') return x;
    const s = String(x || '');
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
    if (m) {
        return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
    }
    const d = Date.parse(s);
    return Number.isFinite(d) ? d : NaN;
}

const stepMs = (unit) => (unit === 'hour' ? MS_HOUR : unit === 'minute' ? MS_MIN : MS_DAY);

/** Snap a timestamp down to the start of its bucket. */
export function floorTo(ts, unit) {
    const d = new Date(ts);
    if (unit === 'minute') return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes());
    if (unit === 'hour') return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours());
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * Every bucket in the window, in order.
 *
 * Days are walked as CALENDAR dates rather than by adding 86,400,000ms, so a
 * DST transition cannot skip or duplicate a day.
 */
export function bucketKeys(w) {
    const unit = w.unit || 'day';
    const keys = [];
    const last = floorTo(w.endAt, unit);
    let t = floorTo(w.startAt, unit);
    // Hard cap: a bad custom range must not spin here.
    for (let guard = 0; t <= last && guard < 5000; guard++) {
        keys.push(t);
        if (unit === 'day') {
            const d = new Date(t);
            t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
        } else {
            t += stepMs(unit);
        }
    }
    return keys;
}

/**
 * Fill a sparse `[{x,y}]` series across the whole window.
 *
 * @param fill 0 for counts — a day with no pageviews genuinely had zero.
 *             null for percentiles — a day with no LCP samples is a GAP, and
 *             zero-filling it would recreate the "0 ms is perfect" lie this
 *             project is busy removing.
 */
export function densify(points, w, { fill = 0 } = {}) {
    const byBucket = new Map();
    for (const p of Array.isArray(points) ? points : []) {
        const t = parseBucket(p.x);
        if (!Number.isFinite(t)) continue;
        const k = floorTo(t, w.unit || 'day');
        byBucket.set(k, (byBucket.get(k) || 0) + (Number(p.y) || 0));
    }
    return bucketKeys(w).map(t => ({
        t,
        value: byBucket.has(t) ? byBucket.get(t) : fill,
    }));
}

/**
 * Line up a series with the equivalent one from the previous period, so a
 * chart can draw "this week vs last week" on one x-axis.
 */
export function alignSeries(current, previous) {
    return current.map((p, i) => ({ ...p, previous: previous[i]?.value ?? null }));
}

/** Axis/tooltip label for a bucket, in the unit's own resolution. */
export function bucketLabel(t, unit) {
    const d = new Date(t);
    const pad = (n) => String(n).padStart(2, '0');
    if (unit === 'minute') return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
    if (unit === 'hour') return `${pad(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]} ${pad(d.getUTCHours())}:00`;
    return `${pad(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Is the final bucket still filling up?
 *
 * Today's partial day always looks like a crash at the right-hand edge of a
 * chart. Charts dash it rather than let someone read a drop that has not
 * happened.
 */
export function lastBucketPartial(w) {
    const unit = w.unit || 'day';
    return floorTo(w.endAt, unit) === floorTo(Date.now(), unit);
}
