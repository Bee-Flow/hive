// Data layer for the Privacy Shield "What happened" tab.
//
// Fetches ONLY when the tab is active and the licence allows it — unlike the
// old Usage & Monitoring page, which fired all 31 endpoints on mount
// regardless of the visible tab. Two consolidated overview calls replace the
// 19 requests the two old tabs made.
//
// Server contract (server/routes/usage.js — both admin-gated, dry runs
// excluded, org from the session):
//   GET /api/usage/guardrails/overview    → { summary, timeline, top_categories,
//                                            by_action, top_users, health, window }
//   GET /api/usage/integrations/overview  → { summary(+sovereignty_score/score_delta),
//                                            timeline, top{destinations,non_eu_destinations,
//                                            integrations,actors,users}, pii_categories,
//                                            data_categories, health, window }
// Details (plain arrays, keyset via ?cursor=<last id>):
//   GET /api/usage/guardrails/recent?limit=&type=&user=
//   GET /api/usage/integrations/egress?limit=&eu=&user=&integration=&pii=
//
// A 404 is treated as EMPTY (a stack whose API predates these endpoints shows
// the empty state, not an error); a network failure sets `error`.

import { useEffect, useRef, useState } from 'react';
import { API_BASE, authFetch } from '../../../../../utils/helpers';

const EMPTY_GUARD = { summary: {}, timeline: [], top_categories: [], by_action: [], top_users: [], health: {} };
const EMPTY_INTEG = {
    summary: {}, timeline: [],
    top: { destinations: [], non_eu_destinations: [], integrations: [], actors: [], users: [] },
    pii_categories: [], data_categories: [], health: {},
};

function buildQS(rangeParams, extra = {}) {
    const qs = new URLSearchParams();
    if (rangeParams?.startDate && rangeParams?.endDate) {
        qs.set('startDate', rangeParams.startDate);
        qs.set('endDate', rangeParams.endDate);
    } else if (rangeParams?.days) {
        qs.set('days', String(rangeParams.days));
    }
    if (rangeParams?.interval) qs.set('interval', rangeParams.interval);
    for (const [k, v] of Object.entries(extra)) {
        if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
    }
    const s = qs.toString();
    return s ? `?${s}` : '';
}

async function fetchJson(url) {
    const res = await authFetch(url);
    if (res.status === 404) return { notFound: true };
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { data: await res.json() };
}

export default function useShieldActivity({ enabled, rangeParams, detail }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [guard, setGuard] = useState(EMPTY_GUARD);
    const [integ, setInteg] = useState(EMPTY_INTEG);
    const [detailRows, setDetailRows] = useState([]);
    const [detailLoading, setDetailLoading] = useState(false);
    const loadedOnce = useRef(false);

    // ── Overview: two parallel calls, only while the tab is active ─────
    useEffect(() => {
        if (!enabled) return undefined;
        let cancelled = false;
        setLoading(true);
        setError(null);
        (async () => {
            try {
                const [g, i] = await Promise.all([
                    fetchJson(`${API_BASE}/api/usage/guardrails/overview${buildQS(rangeParams)}`),
                    fetchJson(`${API_BASE}/api/usage/integrations/overview${buildQS(rangeParams)}`),
                ]);
                if (cancelled) return;
                setGuard(g.notFound ? EMPTY_GUARD : { ...EMPTY_GUARD, ...g.data });
                setInteg(i.notFound ? EMPTY_INTEG : {
                    ...EMPTY_INTEG,
                    ...i.data,
                    top: { ...EMPTY_INTEG.top, ...(i.data?.top || {}) },
                });
                loadedOnce.current = true;
            } catch (e) {
                if (!cancelled) setError(e.message || 'failed');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
        // rangeParams is derived fresh each render — key on its meaningful bits.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, rangeParams?.startDate, rangeParams?.endDate, rangeParams?.days, rangeParams?.interval]);

    // ── Details: lazy, only while the fold is open ─────────────────────
    const drillKey = detail?.drill ? `${detail.drill.axis}:${detail.drill.value}` : '';
    useEffect(() => {
        if (!enabled || !detail?.open) return undefined;
        let cancelled = false;
        setDetailLoading(true);
        (async () => {
            try {
                const drill = detail.drill || null;
                // Category/dest drills filter CLIENT-side (the server has no
                // param for them) — fetch the maximum page so the filter sees
                // the whole sample instead of the newest 50 rows. The tab
                // hides Show-more for these axes: the limit is already maxed.
                const clientFiltered = drill && (drill.axis === 'category' || drill.axis === 'dest');
                const extra = { limit: clientFiltered ? 200 : (detail.limit || 50) };
                let url;
                if (detail.kind === 'guard') {
                    if (drill?.axis === 'user') extra.user = drill.value;
                    url = `${API_BASE}/api/usage/guardrails/recent${buildQS(rangeParams, extra)}`;
                } else {
                    if (drill?.axis === 'user') extra.user = drill.value;
                    if (drill?.axis === 'integration') extra.integration = drill.value;
                    if (drill?.axis === 'non_eu' || drill?.axis === 'dest') extra.eu = 'false';
                    url = `${API_BASE}/api/usage/integrations/egress${buildQS(rangeParams, extra)}`;
                }
                const res = await fetchJson(url);
                if (cancelled) return;
                let rows = res.notFound ? [] : (Array.isArray(res.data) ? res.data : []);
                // Client-side drills for axes the server has no param for.
                if (drill?.axis === 'category') {
                    rows = rows.filter(r => String(r.violation_categories || '').toLowerCase()
                        .includes(String(drill.value).toLowerCase()));
                }
                if (drill?.axis === 'dest') {
                    rows = rows.filter(r => (r.dest_host || r.tls_servername || r.server_endpoint) === drill.value);
                }
                setDetailRows(rows);
            } catch (_) {
                if (!cancelled) setDetailRows([]);
            } finally {
                if (!cancelled) setDetailLoading(false);
            }
        })();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, detail?.open, detail?.kind, detail?.limit, drillKey,
        rangeParams?.startDate, rangeParams?.endDate, rangeParams?.days]);

    return { loading: loading && !loadedOnce.current, refreshing: loading, error, guard, integ, detailRows, detailLoading };
}
