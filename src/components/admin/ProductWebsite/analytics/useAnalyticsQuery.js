/**
 * Data hooks for the Website Analytics dashboard.
 *
 * Every section fetches through the server's allow-listed Umami proxy, so these
 * hooks only deal with request identity, in-flight cancellation and error copy.
 * Deliberately hand-rolled useEffect + fetch to match the other admin
 * dashboards (MonitoringPanel, ConnectorHealthPanel) rather than introducing
 * React Query on a single surface.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { analyticsApi, analyticsFetch, analyticsPost, reportBody } from '../analyticsApi';

/**
 * Serialises the request identity so effects re-run only on real changes.
 *
 * `_token` is part of it: the shell bumps that counter when the operator hits
 * Refresh, and leaving it out made the button a no-op on every section — the
 * effect never re-ran, and the 15 s server cache made it look like it had.
 */
function scopeKey(scope) {
    const { siteId, range, timezone, start, end, filters, _token } = scope || {};
    return JSON.stringify([siteId, range, timezone, start, end, filters || {}, _token || 0]);
}

/**
 * One Umami resource (GET) or report (POST).
 *
 * @param kind    'query' | 'report'
 * @param name    resource or report name
 * @param scope   { siteId, range, timezone, start, end, filters }
 * @param options { params, body, enabled, pollMs }
 */
export function useAnalyticsQuery(kind, name, scope, options = {}) {
    const { params, body, enabled = true, pollMs = 0 } = options;
    const [state, setState] = useState({ data: null, loading: enabled, error: null, cached: false });

    const key = `${kind}:${name}:${scopeKey(scope)}:${JSON.stringify(params || body || {})}`;
    // Guards a late response from a superseded request overwriting fresh state.
    const requestRef = useRef(0);
    // An explicit Refresh has to bypass the server's 15 s cache too — re-firing
    // the request only to be served the same cached payload is not a refresh.
    const tokenRef = useRef(scope?._token || 0);

    const run = useCallback(async ({ fresh = false, quiet = false } = {}) => {
        if (!enabled) return;
        const id = ++requestRef.current;
        if (!quiet) setState(s => ({ ...s, loading: true, error: null }));
        try {
            const res = kind === 'report'
                ? await analyticsPost(analyticsApi.report(name), reportBody({ ...scope, ...body, fresh }))
                : await analyticsFetch(analyticsApi.query(name, { ...scope, params, fresh }));
            if (id !== requestRef.current) return;
            setState({ data: res, loading: false, error: null, cached: !!res?.cached });
        } catch (err) {
            if (id !== requestRef.current) return;
            setState({ data: null, loading: false, error: err.message || 'Failed to load', cached: false });
        }
        // `key` covers scope/params; run is stable within one request identity.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key, enabled]);

    useEffect(() => {
        const token = scope?._token || 0;
        const refreshed = token !== tokenRef.current;
        tokenRef.current = token;
        run({ fresh: refreshed });
        // `run` already encodes the full request identity via `key`.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [run]);

    // Polling (realtime). Pauses while the tab is hidden so a backgrounded
    // dashboard doesn't hammer Umami for numbers nobody is looking at.
    useEffect(() => {
        if (!pollMs || !enabled) return undefined;
        let timer = null;
        const tick = () => {
            if (document.visibilityState === 'visible') run({ fresh: true, quiet: true });
        };
        const start = () => { if (!timer) timer = setInterval(tick, pollMs); };
        const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
        const onVisibility = () => {
            if (document.visibilityState === 'visible') { tick(); start(); } else stop();
        };
        if (document.visibilityState === 'visible') start();
        document.addEventListener('visibilitychange', onVisibility);
        return () => { stop(); document.removeEventListener('visibilitychange', onVisibility); };
    }, [pollMs, enabled, run]);

    return { ...state, reload: run, payload: state.data?.data ?? null };
}

/** Convenience wrapper for a breakdown dimension (`metrics`). */
export function useMetrics(type, scope, { limit = 10, enabled = true } = {}) {
    return useAnalyticsQuery('query', 'metrics', scope, { params: { type, limit }, enabled });
}
