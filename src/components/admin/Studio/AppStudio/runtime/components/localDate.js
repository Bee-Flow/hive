/**
 * App Studio runtime — LOCAL calendar stamps for the date-ish inputs.
 *
 * A `date` / `datetime-local` control speaks the viewer's LOCAL calendar, so a
 * default must be built from the local getters. `new Date().toISOString()` is
 * UTC: east of Greenwich it rolls over to tomorrow late in the evening, west of
 * it stays on yesterday after midnight — a 'today' default then prefills the
 * wrong day. Any other date-only default in the runtime should use these.
 */

const pad = (n) => String(n).padStart(2, '0');

/** Local calendar day as 'YYYY-MM-DD'. */
export function todayIso(d = new Date()) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local 'YYYY-MM-DDTHH:mm' (what a datetime-local control expects/emits). */
export function nowLocalIso(d = new Date()) {
    return `${todayIso(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
