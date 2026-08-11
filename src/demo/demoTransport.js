/**
 * The demo backend — an in-memory API for the public feature demos.
 *
 * The demos mount the REAL Studio components, which call `authFetch` on
 * mount and on every interaction. This module answers those calls from
 * fixtures held in a plain JS object, so a visitor can click, open, edit and
 * drag exactly as in the product while:
 *
 *   • no request ever leaves the browser (installed via setDemoTransport,
 *     which short-circuits authFetch before it reaches fetch())
 *   • no session, cookie or token is involved — there is nothing to steal
 *     and nothing to authorise
 *   • no server endpoint exists to abuse, rate-limit or bill
 *
 * FAIL CLOSED. An unmatched route returns 404 with a clear body rather than
 * falling through to the network. That is the whole security property: a
 * route we forgot to add shows a broken panel in a demo, instead of quietly
 * turning an anonymous visitor's click into a real API call.
 *
 * Writes are honoured against the in-memory state so editing feels real;
 * they die with the tab. Nothing here is persisted anywhere.
 */

/** Build a Response the way fetch would, so callers need no special-casing. */
function json(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

function noContent(status = 204) {
    return new Response(null, { status });
}

/**
 * Strip API_BASE + query string → a comparable pathname.
 *
 * A trailing slash is normalised away because the API clients are not
 * consistent about it: useAutomationApi builds its collection calls as
 * `get('/')` → `/api/automation/`, while others use the bare path. Treating
 * those as different routes meant the automations list and every save 404'd
 * in the demo while looking like a plain "save failed" toast.
 */
function toPath(url) {
    const raw = String(url || '');
    // API_BASE is either '' (prod, relative) or an absolute origin (dev).
    const withoutOrigin = raw.replace(/^https?:\/\/[^/]+/i, '');
    const path = withoutOrigin.split('?')[0].split('#')[0];
    return path.length > 1 ? path.replace(/\/+$/, '') : path;
}

/**
 * The query string, which `toPath` deliberately strips before matching so
 * that `/x` and `/x?a=1` hit the same route.
 *
 * Handlers still need to READ it: the support inbox is filter-driven
 * (`?status=awaiting_agent`), so without this its status tabs all return the
 * same list and the counts disagree with what is on screen. Returns an empty
 * URLSearchParams when there is no query, so a handler can always call
 * `.get()` without a guard.
 */
function parseQuery(url) {
    const raw = String(url || '');
    const i = raw.indexOf('?');
    if (i === -1) return new URLSearchParams();
    return new URLSearchParams(raw.slice(i + 1).split('#')[0]);
}

function parseBody(options) {
    if (!options || typeof options.body !== 'string') return null;
    try { return JSON.parse(options.body); } catch (_) { return null; }
}

/**
 * Compile a route table into a matcher.
 *
 * Routes are declared as `'GET /api/ai-tasks/:id'`. `:param` matches one
 * segment; `*` at the end matches the rest. First match wins, so declare
 * literal paths before parameterised ones.
 */
function compile(routes) {
    return Object.entries(routes).map(([key, handler]) => {
        const [method, pattern] = key.split(' ');
        const names = [];
        const source = pattern
            .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
            .replace(/:([a-zA-Z0-9_]+)/g, (_, name) => { names.push(name); return '([^/]+)'; })
            .replace(/\*$/, '.*');
        return { method, regex: new RegExp(`^${source}$`), names, handler };
    });
}

/**
 * Create a transport bound to one demo's route table + state.
 *
 * @param {object} routes  { 'GET /api/x': (ctx) => body|Response }
 * @param {object} state   mutable fixture state, handed to every handler
 */
export function createDemoTransport(routes, state) {
    const compiled = compile(routes);

    return async function demoFetch(url, options = {}) {
        const method = String(options.method || 'GET').toUpperCase();
        const path = toPath(url);

        for (const route of compiled) {
            if (route.method !== method) continue;
            const match = route.regex.exec(path);
            if (!match) continue;

            const params = {};
            route.names.forEach((name, i) => { params[name] = decodeURIComponent(match[i + 1]); });

            let result;
            try {
                result = await route.handler({
                    state, params, body: parseBody(options), path, method,
                    query: parseQuery(url),
                });
            } catch (err) {
                // A throwing fixture handler is a bug in the demo, never a
                // reason to fall through to the network.
                console.error('[demo] handler failed', method, path, err);
                return json({ error: 'Demo handler failed' }, 500);
            }

            if (result instanceof Response) return result;
            if (result === undefined || result === null) return noContent();
            return json(result);
        }

        // Deliberately NOT a passthrough — see the module header.
        console.warn(`[demo] no fixture for ${method} ${path}`);
        return json({ error: 'Not available in the demo', demo: true, path, method }, 404);
    };
}

export const __test__ = { toPath, compile };
