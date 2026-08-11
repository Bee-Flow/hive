import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import PublicFormRenderer, { FormEndingView } from '../components/forms/PublicFormRenderer';

const API = (import.meta.env.VITE_API_URL || '') + '/api/automation/form';

// Poll cadence while the routine works. Starts sub-second so a fast routine
// feels instant, then eases off so a slow one is not hammered.
const POLL_MIN_MS = 700;
const POLL_MAX_MS = 2000;
const POLL_STEP_MS = 200;
// After this the page stops polling and offers a manual retry, rather than
// spinning at someone forever.
const POLL_CEILING_MS = 5 * 60 * 1000;

/**
 * The hosted page behind a form trigger's public URL (`/f/<token>`).
 *
 * Anonymous by design, so three rules apply:
 *
 *   • BARE fetch, never authFetch — authFetch reloads the whole page on any
 *     401, which would put a visitor into a redirect loop on a page that has
 *     no session to begin with.
 *   • It stamps `data-theme` on <html> itself. `:root` in index.css is the DARK
 *     palette; the light values live under `[data-theme="light"]`, which only
 *     applyThemeToDocument sets — and that never runs for an anonymous visitor.
 *     Without this every "light" form would render dark.
 *   • The token is the credential, so an unknown/paused/renamed form is one
 *     indistinguishable "not found" — never a hint that the URL was once real.
 *
 * MULTI-PAGE. A routine can pause at a `form_page` step. The visitor never
 * leaves this URL: submitting returns a session id, the page polls it, and
 * whatever comes back — another page, a closing summary, or a failure — is
 * rendered here. The session id is mirrored into `?s=…` so a reload resumes
 * the journey instead of restarting it at page one.
 *
 * Phases: loading → form → working → form (page N) → done | error | expired.
 */
export default function PublicFormPage({ token }) {
    const [state, setState] = useState({ status: 'loading', form: null, csrf: null, issuedAt: 0, ending: null });
    // The session id lives in a ref as well as in state: the poll loop closes
    // over it, and re-creating the loop on every render would restart the timer.
    const sessionRef = useRef(readSessionFromUrl());
    const [sessionId, setSessionId] = useState(sessionRef.current);

    const setSession = useCallback((sid) => {
        sessionRef.current = sid;
        setSessionId(sid);
        writeSessionToUrl(sid);
    }, []);

    // ── Page one, or resume an in-flight session after a reload ────────────
    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                // A `?s=` in the URL means this browser was already mid-journey.
                // Ask the session first; only fall back to page one if it is
                // gone, so a reload does not silently re-submit the first page.
                if (sessionRef.current) {
                    const resumed = await fetchSession(token, sessionRef.current);
                    if (!alive) return;
                    if (resumed) { applySessionState(resumed, setState, setSession); return; }
                    setSession(null);
                }
                const r = await fetch(`${API}/${encodeURIComponent(token)}`, { headers: { Accept: 'application/json' } });
                const body = await r.json().catch(() => ({}));
                if (!alive) return;
                if (!r.ok) { setState({ status: 'missing', form: null, csrf: null, issuedAt: 0, ending: null }); return; }
                setState({ status: 'form', form: body.form, csrf: body.csrf, issuedAt: body.issuedAt || Date.now(), ending: null });
            } catch {
                if (alive) setState({ status: 'offline', form: null, csrf: null, issuedAt: 0, ending: null });
            }
        })();
        return () => { alive = false; };
    }, [token, setSession]);

    // ── Poll while the routine is working ─────────────────────────────────
    useEffect(() => {
        if (state.status !== 'working' || !sessionId) return undefined;
        let alive = true;
        let delay = POLL_MIN_MS;
        let timer = null;
        const startedAt = Date.now();

        const tick = async () => {
            if (!alive) return;
            if (Date.now() - startedAt > POLL_CEILING_MS) {
                setState(s => ({ ...s, status: 'slow' }));
                return;
            }
            const next = await fetchSession(token, sessionId);
            if (!alive) return;
            if (next && next.state !== 'working') { applySessionState(next, setState, setSession); return; }
            // A dropped poll is not fatal — the run keeps going either way.
            delay = Math.min(POLL_MAX_MS, delay + POLL_STEP_MS);
            timer = setTimeout(tick, delay);
        };
        timer = setTimeout(tick, POLL_MIN_MS);
        return () => { alive = false; if (timer) clearTimeout(timer); };
    }, [state.status, sessionId, token, setSession]);

    // Stamp the appearance the author chose. 'auto' follows the visitor's OS.
    const appearance = (state.form || state.ending)?.theme?.appearance || 'auto';
    useEffect(() => {
        if (typeof document === 'undefined') return undefined;
        const root = document.documentElement;
        const previous = root.getAttribute('data-theme');
        const resolved = appearance === 'auto'
            ? (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
            : appearance;
        root.setAttribute('data-theme', resolved);
        return () => {
            if (previous === null) root.removeAttribute('data-theme');
            else root.setAttribute('data-theme', previous);
        };
    }, [appearance]);

    const upload = useCallback(async (file, field) => {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('field', field);
        fd.append('csrf', state.csrf || '');
        // A later page's upload is checked against THAT page's declared fields,
        // so the server needs to know which page we are on.
        if (sessionRef.current) fd.append('sessionId', sessionRef.current);
        const r = await fetch(`${API}/${encodeURIComponent(token)}/upload`, { method: 'POST', body: fd });
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body.error || 'Upload failed');
        return body;
    }, [token, state.csrf]);

    // One nonce per rendered page. A double-click or a refresh-resubmit reuses
    // it and the server answers "already got that" instead of running twice;
    // moving to the next page mints a fresh one (state.csrf changes with it).
    const nonce = useMemo(() => randomNonce(), [token, state.csrf]);

    // Whether this journey has more screens after the current one. A plain
    // one-page form shows its thank-you the moment the submit is accepted and
    // never polls; anything with a form_page step has to wait for the run.
    const multiPage = !!state.form?.multiPage || !!sessionId;

    const submit = useCallback(async (values) => {
        const sid = sessionRef.current;
        const url = sid
            ? `${API}/${encodeURIComponent(token)}/s/${encodeURIComponent(sid)}`
            : `${API}/${encodeURIComponent(token)}`;
        const r = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...values, csrf: state.csrf, issuedAt: state.issuedAt, nonce }),
        });
        const body = await r.json().catch(() => ({}));
        if (!r.ok) {
            const err = new Error(body.error || 'Something went wrong. Please try again.');
            err.fields = body.fields;
            throw err;
        }
        // A one-page form is done: the renderer shows its own success card and
        // this resolve is all it needs. Nothing to poll for.
        if (!multiPage) return;
        // The first submission mints the session; later pages keep theirs.
        if (body.sessionId) setSession(body.sessionId);
        // Hand over to the poll loop: only the server knows whether the routine
        // paused for another page or ran to the end.
        setState(s => ({ ...s, status: 'working', form: null }));
    }, [token, state.csrf, state.issuedAt, nonce, setSession, multiPage]);

    const retry = useCallback(() => setState(s => ({ ...s, status: 'working' })), []);

    return (
        <div className="min-h-screen w-full flex items-start justify-center px-4 py-10 sm:py-16 bg-[var(--bg-primary)]">
            <div className="w-full max-w-xl">
                {state.status === 'loading' && (
                    <div className="flex items-center justify-center gap-2 py-24 text-sm text-[var(--text-secondary)]">
                        <Loader2 size={16} className="animate-spin" /> Loading…
                    </div>
                )}
                {state.status === 'working' && (
                    <div className="flex items-center justify-center gap-2 py-24 text-sm text-[var(--text-secondary)]" role="status">
                        <Loader2 size={16} className="animate-spin" /> Just a moment…
                    </div>
                )}
                {state.status === 'slow' && (
                    <div className="text-center py-24">
                        <h1 className="text-lg font-semibold text-[var(--text-primary)]">This is taking a while</h1>
                        <p className="mt-2 text-sm text-[var(--text-secondary)]">Your answers were received — we are still working on them.</p>
                        <button
                            type="button"
                            onClick={retry}
                            className="mt-4 px-3 py-1.5 text-sm rounded-md border border-[var(--border-default)] text-[var(--text-primary)]"
                        >
                            Check again
                        </button>
                    </div>
                )}
                {state.status === 'missing' && (
                    <div className="text-center py-24">
                        <h1 className="text-lg font-semibold text-[var(--text-primary)]">This form is not available</h1>
                        <p className="mt-2 text-sm text-[var(--text-secondary)]">
                            The link may have expired, or the form may have been taken offline.
                        </p>
                    </div>
                )}
                {state.status === 'expired' && (
                    <div className="text-center py-24">
                        <h1 className="text-lg font-semibold text-[var(--text-primary)]">This form has expired</h1>
                        <p className="mt-2 text-sm text-[var(--text-secondary)]">It was left open too long. Open the link again to start over.</p>
                    </div>
                )}
                {state.status === 'offline' && (
                    <div className="text-center py-24">
                        <h1 className="text-lg font-semibold text-[var(--text-primary)]">Could not reach the server</h1>
                        <p className="mt-2 text-sm text-[var(--text-secondary)]">Please check your connection and reload the page.</p>
                    </div>
                )}
                {state.status === 'error' && (
                    <div className="text-center py-24">
                        <h1 className="text-lg font-semibold text-[var(--text-primary)]">Something went wrong</h1>
                        <p className="mt-2 text-sm text-[var(--text-secondary)]">We could not finish this form. Please try again later.</p>
                    </div>
                )}
                {state.status === 'done' && (
                    <>
                        <FormEndingView form={state.ending} />
                        <p className="mt-4 text-center text-[11px] text-[var(--text-tertiary)]">Powered by Bee Flow</p>
                    </>
                )}
                {state.status === 'form' && (
                    <>
                        <PublicFormRenderer
                            // Remount on every page so answers, errors and the
                            // honeypot never bleed from one page into the next.
                            key={`${state.csrf || 'page1'}`}
                            form={state.form}
                            onSubmit={submit}
                            onUpload={upload}
                            showSuccess={!multiPage}
                        />
                        <p className="mt-4 text-center text-[11px] text-[var(--text-tertiary)]">Powered by Bee Flow</p>
                    </>
                )}
            </div>
        </div>
    );
}

/** GET the session. `null` means "gone" (404/network); the caller decides. */
async function fetchSession(token, sid) {
    try {
        const r = await fetch(`${API}/${encodeURIComponent(token)}/s/${encodeURIComponent(sid)}`, {
            headers: { Accept: 'application/json' },
        });
        if (!r.ok) return null;
        return await r.json();
    } catch {
        return null;
    }
}

/** Map a poll response onto the page's phase. */
function applySessionState(payload, setState, setSession) {
    switch (payload.state) {
        case 'form':
            setState({ status: 'form', form: payload.form, csrf: payload.csrf, issuedAt: payload.issuedAt || Date.now(), ending: null });
            break;
        case 'done':
            // The journey is over — drop `?s=` so a reload starts a fresh one
            // rather than landing on a session that no longer leads anywhere.
            setSession(null);
            setState({ status: 'done', form: null, csrf: null, issuedAt: 0, ending: payload.ending || null });
            break;
        case 'expired':
            setSession(null);
            setState({ status: 'expired', form: null, csrf: null, issuedAt: 0, ending: null });
            break;
        case 'working':
            setState(s => ({ ...s, status: 'working' }));
            break;
        default:
            setSession(null);
            setState({ status: 'error', form: null, csrf: null, issuedAt: 0, ending: null });
    }
}

const SESSION_RE = /^[a-f0-9]{24,64}$/;

function readSessionFromUrl() {
    try {
        const sid = new URLSearchParams(window.location.search).get('s');
        return sid && SESSION_RE.test(sid) ? sid : null;
    } catch {
        return null;
    }
}

/** Mirror the session into the URL so a reload resumes rather than restarts. */
function writeSessionToUrl(sid) {
    try {
        const url = new URL(window.location.href);
        if (sid) url.searchParams.set('s', sid);
        else url.searchParams.delete('s');
        window.history.replaceState(null, '', url.toString());
    } catch { /* a browser without history API still works, just not on reload */ }
}

function randomNonce() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID().replace(/-/g, '');
    return `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}
