import { v4 as uuidv4 } from 'uuid';
import { isPublicMarketingPath } from './cmsPublicRouting';

/** Anonymous marketing surface — a 401 there is the expected answer, not a
 *  session that needs recovering. Imported rather than re-derived so the
 *  reload guard, the telemetry consent gate and the router share one rule. */
function onPublicMarketingPage() {
    if (typeof window === 'undefined') return false;
    try { return isPublicMarketingPath(window.location.pathname); }
    catch (_) { return false; }
}

// In production (built app), always use relative URLs so nginx handles proxying
// In development, use the same hostname but port 3001 (allows network access from any IP)
// This ensures that if you access from 10.5.0.2:5175, API calls go to 10.5.0.2:3001
function getApiBase() {
    if (import.meta.env.VITE_API_URL) {
        return import.meta.env.VITE_API_URL;
    }
    if (import.meta.env.PROD) {
        return ''; // Relative URLs in production (nginx proxy)
    }
    // Development: use same host as frontend but port 3001
    const host = window.location.hostname;
    return `http://${host}:3001`;
}
export const API_BASE = getApiBase();

/**
 * Is this build running inside Nextcloud, behind AppAPI's signed proxy?
 *
 * The embed build sets VITE_API_URL to NC's proxy path (see agent-hub's
 * Dockerfile), so API_BASE is the reliable, build-time-accurate signal —
 * more so than sniffing window.location, which is the NC host either way.
 */
export const isNextcloudEmbed = () => API_BASE.includes('/apps/app_api/proxy/');

export const generateMessageId = () => uuidv4();

// Embedded-iframe session token. When BeeFlow runs inside another origin (e.g.
// Nextcloud), Chrome's storage partitioning keeps the session cookie set by the
// OAuth popup out of the iframe's reach. As a fallback the OAuth flow deposits
// a token here (see LoginPage popup pickup); we forward it as X-Session-Token
// on every request, and server/index.js merges it into req.session.
const SESSION_TOKEN_KEY = 'bf_session_token';

export const setSessionToken = (token) => {
    try {
        if (token) sessionStorage.setItem(SESSION_TOKEN_KEY, token);
        else sessionStorage.removeItem(SESSION_TOKEN_KEY);
    } catch (_) { /* sessionStorage may be unavailable in private mode */ }
};

export const getSessionToken = () => {
    try { return sessionStorage.getItem(SESSION_TOKEN_KEY); }
    catch (_) { return null; }
};

// ── Demo transport ───────────────────────────────────────────────────
//
// The public feature demos (/__demo__/<feature>) mount the REAL Studio
// components so the visuals are the product's, not a mock-up of it. Those
// components call authFetch directly — dozens of call sites — so this is the
// one choke point where "a demo can never reach the network" can actually be
// guaranteed rather than audited.
//
// When a transport is installed, authFetch NEVER calls fetch(). An unhandled
// route is an ERROR, not a passthrough: a passthrough default would mean one
// missing route silently turns an anonymous visitor's click into a real,
// unauthenticated API call. Fail closed instead — see helpers.demo.test.js.
let demoTransport = null;

/** Install (fn) or remove (null) the demo transport. Returns the previous one. */
export const setDemoTransport = (fn) => {
    const previous = demoTransport;
    demoTransport = typeof fn === 'function' ? fn : null;
    return previous;
};

export const isDemoMode = () => demoTransport !== null;

/** Is this the path of a public feature demo? */
export const isDemoPath = (pathname) => /^\/__demo__\/[a-z0-9-]+\/?$/.test(pathname || '');

/**
 * Close the gap between first paint and DemoHost.
 *
 * DemoHost installs the fixture transport in a useState initialiser — during
 * its first render, before any child can fetch. That is airtight for the
 * FEATURE. It is not airtight for the APP SHELL, because DemoHost is behind
 * `lazy()`: while its chunk is still downloading, the providers above it have
 * already mounted and run their effects. Measured on a demo page, four real
 * requests left the browser before the transport landed —
 * /api/branding/effective, /api/branding/public, /api/languages/user/locales
 * and /api/modules/frontend — as an anonymous visitor, against the live API.
 *
 * None of them carries visitor input and all four already tolerate failure,
 * so nothing was broken by it. What was broken is a sentence: nine marketing
 * pages tell the reader "the demo has no network access". Either that is true
 * or it is not worth saying, and it is cheaper to make it true.
 *
 * Called from main.jsx BEFORE React renders, so there is no window at all.
 * Every route 404s; DemoHost swaps in the fixtured table moments later.
 * Deliberately silent — these are the shell's own calls, not a missing
 * fixture, and warning about them would train the eye to ignore the warning
 * that does matter.
 */
export const sealDemoBeforeBoot = (pathname) => {
    if (!isDemoPath(pathname)) return false;
    setDemoTransport(async () => new Response(
        JSON.stringify({ error: 'Not available in the demo', demo: true }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
    ));
    return true;
};

export const authFetch = async (url, options = {}) => {
    if (demoTransport) {
        const response = await demoTransport(url, options);
        if (!(response instanceof Response)) {
            throw new Error(`[demo] transport returned no Response for ${url}`);
        }
        return response;
    }

    const defaultOptions = {
        credentials: 'include',
        // Never serve dynamic per-user API responses from the browser's HTTP
        // cache. In the Nextcloud-embedded path (browser → AppAPI proxy →
        // connector → server) the server's `Cache-Control: no-store` headers
        // don't reliably survive the proxy, so the browser was replaying stale
        // GETs — most visibly the chat list, which showed "No chats yet" after
        // sending a message until the cache was cleared. A request-level
        // `cache: 'no-store'` mirrors DevTools "Disable cache" and works
        // regardless of response headers. Callers can still override per-request.
        cache: 'no-store',
    };

    const finalOptions = {
        ...defaultOptions,
        ...options
    };

    // Merge headers if provided
    if (options.headers) {
        finalOptions.headers = { ...options.headers };
    }

    // Nextcloud cannot proxy PATCH — at all.
    //
    // AppAPI's appinfo/routes.php registers ExAppGet/ExAppPost/ExAppPut/
    // ExAppDelete and nothing else, and AppAPIService::requestToExAppInternal's
    // match() has no 'PATCH' arm either. So a PATCH sent through the signed
    // proxy never reaches the connector: Nextcloud answers it itself, and every
    // PATCH-based feature (conversation rename, chat labels, …) fails inside the
    // embed while working perfectly on the web app. Tunnel it as POST with the
    // standard override header; the connector restores the real method before
    // the request reaches the Bee Flow server (nextcloud-connector/src/proxy.js).
    if (isNextcloudEmbed() && String(finalOptions.method || 'GET').toUpperCase() === 'PATCH') {
        finalOptions.method = 'POST';
        finalOptions.headers = { ...(finalOptions.headers || {}), 'X-HTTP-Method-Override': 'PATCH' };
    }

    // Embedded-iframe fallback: attach session token if we have one. Browser
    // cookies may be blocked here by storage partitioning, but the server's
    // X-Session-Token middleware will rebuild req.session from this.
    const sessionToken = getSessionToken();
    if (sessionToken) {
        finalOptions.headers = { ...(finalOptions.headers || {}), 'X-Session-Token': sessionToken };
    }

    const response = await fetch(url, finalOptions);

    // If server returns 401 (user deleted / session invalid), force logout
    // Skip for auth endpoints that handle their own auth flow or are called during login.
    // Auto-reload on 401 ONLY for app-level API calls (user is logged in but session expired).
    // Excluded paths (called unauthenticated and must fail silently):
    //   /auth/          — login/setup flow
    //   /api/health     — public health check
    //   /api/languages/ — i18n fetches; safe to fail before login, falls back to EN defaults
    //
    // …and never on a PUBLIC MARKETING page. There is no session to expire
    // there, so a 401 is the normal answer rather than a signal to recover
    // from — but this branch reloaded anyway, and the whole site was then
    // downloaded a second time: JS, CSS, fonts and every icon chunk. It was
    // invisible in production because the 30s cooldown below stopped the
    // second pass from becoming a loop, so the page merely rendered twice.
    // On throttled mobile that doubling was most of the Lighthouse score
    // (FCP 4.6s / LCP 6.7s against a first paint measured at ~1.3s).
    // ThemeContext even documents the 401 as expected and falls back to
    // /api/branding/public — it just never got the chance to.
    if (
        response.status === 401 &&
        !url.includes('/auth/') &&
        !url.includes('/api/health') &&
        !url.includes('/api/languages/') &&
        // The connector's /setup/* routes are admin-gated: a 401 there means
        // "this Nextcloud user isn't an admin", which no reload can change.
        // Reloading would just re-ask on every mount of the not-yet-paired
        // embedded view.
        !url.includes('/setup/') &&
        !onPublicMarketingPage()
    ) {
        // Loop breaker: if a 401 caused a reload within the last 30s, the
        // reload didn't fix the underlying problem (bad JWT, wrong audience,
        // unprovisioned user). A second reload would just spin forever and
        // hide the actual broken endpoint. Suppress and let the caller see
        // the 401.
        const RELOAD_FLAG = 'bf_auth_reload_at';
        const COOLDOWN_MS = 30_000;
        let lastReload = 0;
        try { lastReload = parseInt(sessionStorage.getItem(RELOAD_FLAG) || '0', 10) || 0; }
        catch (_) { /* sessionStorage unavailable */ }

        if (Date.now() - lastReload < COOLDOWN_MS) {
            console.warn(`[authFetch] 401 on ${url} — suppressing reload (cooldown active)`);
            return response;
        }

        try { sessionStorage.setItem(RELOAD_FLAG, String(Date.now())); }
        catch (_) { /* sessionStorage unavailable */ }
        window.location.reload();
        return response;
    }

    return response;
};

// Parse a non-OK fetch Response into { message, code, resource }. Tolerates
// both JSON ({error,code,resource}) and plain-text error bodies.
export const parseSaveError = async (res) => {
    let body = '';
    try { body = await res.text(); } catch (_) { /* ignore */ }
    let info = {};
    try { info = JSON.parse(body); } catch (_) { info = { error: body }; }
    const message = info.error || info.message || `Save failed (${res.status})`;
    const isLimit = res.status === 403 && (info.code === 'limit_reached' || /reached (its|the) limit|seat limit/i.test(message));
    return { message, code: info.code, resource: info.resource, isLimit };
};

export const getAgentInitials = (name) => {
    if (!name) return '?';
    return name
        .split(' ')
        .map(n => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
};

export const getAgentColor = (name) => {
    if (!name) return 'var(--accent-primary)';
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash) % 360;
    return `hsl(${h}, 70%, 40%)`;
};

/**
 * Returns a human-friendly relative time string (e.g., "3 days ago")
 * @param {string|Date} date - The date to format
 * @returns {string}
 */
export const getRelativeTime = (date) => {
    if (!date) return '';
    const now = new Date();
    const then = new Date(date);
    const diffInSeconds = Math.floor((now - then) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return then.toLocaleDateString();
};

/**
 * Maps technical tool IDs to human-friendly names
 */
export const TOOL_NAME_MAP = {
    'google_search': 'Google Search',
    'terminal_exec': 'Terminal',
    'python_interpreter': 'Python',
    'web_browser': 'Web Browser',
    'sql_query': 'Database',
    'file_read': 'File System',
    'api_fetcher': 'API Fetcher',
    'sequentialthinking': 'Reasoning',
    'browser_agent': 'Web Automation',
    'document_reader': 'Doc Parser',
    'arxiv_search': 'arXiv',
    'scholar_search': 'Google Scholar',
    'pubmed_search': 'PubMed',
    'crossref_lookup': 'CrossRef',
    'serper_search': 'Web Search',
    'activate_skill': 'Activating skill',
    'activate_session_skill': 'Activating chat skill',
    'publish_session_skill_to_library': 'Saving skill to library',
    'gamma_create_presentation': 'Gamma Create',
    'gamma_create_from_template': 'Gamma Template',
    'gamma_revise_as_new': 'Gamma Revise as New',
    'gamma_get_generation_status': 'Gamma Status',
    'gamma_list_themes': 'Gamma Themes',
    'gamma_list_folders': 'Gamma Folders',
};

/**
 * Returns a human-friendly label for a tool name.
 * Falls back to prettifying the raw name (snake_case → Title Case).
 */
export const getToolLabel = (name) => {
    if (!name) return 'Tool';
    if (TOOL_NAME_MAP[name]) return TOOL_NAME_MAP[name];
    return name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

/**
 * Maps a raw tool name to a stable catalog id (see emojiCatalog.js). Use this
 * with <AppEmoji id={toolNameToCatalogId(toolName)} /> so the active icon pack
 * can override every search-tool emoji at once via a single `tools.search` key.
 *
 * Returns 'tools.fallback' for unknown tools so AppEmoji renders the generic 🔧.
 */
export const toolNameToCatalogId = (name) => {
    const map = {
        agent_search: 'tools.search', google_search: 'tools.search', serper_search: 'tools.search',
        scholar_search: 'tools.search', arxiv_search: 'tools.search', pubmed_search: 'tools.search',
        crossref_lookup: 'tools.search',
        web_browser: 'tools.web_browser', browser_agent: 'tools.web_browser',
        terminal_exec: 'tools.terminal',
        python_interpreter: 'tools.python',
        notebook_doc_write: 'tools.notebook_write',
        notebook_add_source: 'tools.notebook_attach',
        sql_query: 'tools.sql',
        file_read: 'tools.file_read',
        document_reader: 'tools.document_reader',
        gmail_tool: 'tools.gmail',
        calendar_tool: 'tools.calendar',
        sequentialthinking: 'tools.thinking',
        api_fetcher: 'tools.api_fetcher',
        activate_skill: 'tools.skill',
        activate_session_skill: 'tools.session_skill',
        complete_session_skill: 'tools.skill_complete',
        publish_session_skill_to_library: 'tools.skill_publish',
        gamma_create_presentation: 'tools.gamma_create',
        gamma_create_from_template: 'tools.gamma_create',
        gamma_revise_as_new: 'tools.gamma_create',
        gamma_get_generation_status: 'tools.gamma_status',
        gamma_list_themes: 'tools.gamma_themes',
        gamma_list_folders: 'tools.gamma_folders',
    };
    return map[name] || 'tools.fallback';
};

const TOOL_DEFAULT_EMOJI = {
    'tools.search': '🔍', 'tools.web_browser': '🌐', 'tools.terminal': '💻',
    'tools.python': '🐍', 'tools.notebook_write': '📝', 'tools.notebook_attach': '📎',
    'tools.sql': '🗄️', 'tools.file_read': '📂', 'tools.document_reader': '📄',
    'tools.gmail': '📧', 'tools.calendar': '📅', 'tools.thinking': '🧠',
    'tools.api_fetcher': '🔗', 'tools.skill': '🧩', 'tools.session_skill': '🐝',
    'tools.skill_complete': '✅', 'tools.skill_publish': '⭐',
    'tools.gamma_create': '📊', 'tools.gamma_status': '⏱️',
    'tools.gamma_themes': '🎨', 'tools.gamma_folders': '📁',
    'tools.fallback': '🔧',
};

/**
 * Returns the default emoji for a tool name. Prefer rendering via
 * <AppEmoji id={toolNameToCatalogId(name)} /> so user overrides apply;
 * use this only when you need a synchronous string (logs, plain strings).
 */
export const getToolIcon = (name) => TOOL_DEFAULT_EMOJI[toolNameToCatalogId(name)] || '🔧';
