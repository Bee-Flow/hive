import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    readScanCache,
    writeScanCache,
    readSuggestionState,
    markDismissed as persistDismissed,
    markBuilt as persistBuilt,
    deriveStateSets,
    titleHash,
} from './suggestionState';
import useAutomationApi from '../../../../hooks/useAutomationApi';

// Pull the retry seconds out of a rate-limit message like "Retry in ~20s".
function parseRetrySeconds(msg) {
    const m = /(\d+)\s*s\b/.exec(String(msg || ''));
    return m ? Number(m[1]) : null;
}

/**
 * useSuggestionScan — owns the entire "Find repeating work" data layer:
 *   - loads the integration catalog (default-selects every available app),
 *   - runs the READ-ONLY SSE scan and tracks its live phase / per-tool log,
 *   - rehydrates the last scan from scoped storage on mount for an instant
 *     paint (NO scan fired), then reconciles against the server's last scan,
 *   - persists + projects dismiss/built state across re-scans.
 *
 * Everything new on the wire is OPTIONAL and feature-detected, so this works
 * even before the backend overhaul lands. The presentational layer stays dumb;
 * all state lives here.
 */
export default function useSuggestionScan() {
    const api = useAutomationApi();

    const [apps, setApps] = useState([]);              // [{ id, label, available }]
    const [catalogLoaded, setCatalogLoaded] = useState(false);
    const [selected, setSelected] = useState(() => new Set());
    const [focus, setFocus] = useState('');

    const [scanning, setScanning] = useState(false);
    const [phase, setPhase] = useState(null);          // 'scanning' | 'synthesising'
    const [scanSteps, setScanSteps] = useState([]);    // [{ tool, integration, status, piiCategories }]

    const [suggestions, setSuggestions] = useState([]);
    const [summary, setSummary] = useState(null);      // { integrations, toolCalls, piiCategories }
    const [scanned, setScanned] = useState(false);
    const [reason, setReason] = useState(null);
    const [error, setError] = useState(null);
    const [rateLimitedUntil, setRateLimitedUntil] = useState(null); // epoch ms, or null
    const [lastScannedAt, setLastScannedAt] = useState(null);
    const [cached, setCached] = useState(false);

    // Persisted dismiss/built ledger (keyed by titleHash). Re-read after each
    // mutation so derived Sets recompute.
    const [ledger, setLedger] = useState(() => ({ dismissed: {}, built: {} }));

    const abortRef = useRef(null);
    const selectedRef = useRef(selected);
    const focusRef = useRef(focus);
    useEffect(() => { selectedRef.current = selected; }, [selected]);
    useEffect(() => { focusRef.current = focus; }, [focus]);

    // Apply a result set to state and (optionally) persist it to the cache.
    // Declared before the effects that use it so there's no use-before-define.
    const applyResult = useCallback((res, persist) => {
        const list = Array.isArray(res.suggestions) ? res.suggestions : [];
        setSuggestions(list);
        setSummary(res.summary || null);
        setReason(res.reason || null);
        setScanned(true);
        setCached(!!res.cached);
        if (res.scannedAt) setLastScannedAt(res.scannedAt);
        if (persist) {
            writeScanCache(
                [...selectedRef.current],
                focusRef.current,
                { suggestions: list, summary: res.summary, reason: res.reason, scannedAt: res.scannedAt },
            );
        }
    }, []);

    // ---- catalog + rehydrate (instant paint, no scan) -----------------------
    useEffect(() => {
        let alive = true;
        setLedger(readSuggestionState());
        api.getCatalog()
            .then((d) => {
                if (!alive) return;
                const available = (d?.apps || []).filter((a) => a.available);
                setApps(available);
                const ids = available.map((a) => a.id);
                setSelected(new Set(ids));

                // Instant paint from the local cache for this integration set.
                const cache = readScanCache(ids, '');
                if (cache) {
                    applyResult({
                        suggestions: cache.suggestions,
                        summary: cache.summary,
                        reason: cache.reason,
                        scannedAt: cache.scannedAt,
                        cached: true,
                    }, false);
                }
            })
            .catch(() => { /* picker stays empty; section self-hides */ })
            .finally(() => { if (alive) setCatalogLoaded(true); });
        return () => { alive = false; };
    }, [api, applyResult]);

    // Reconcile against the server's last scan (feature-detected; ignore when
    // absent). Keep whichever is newer by scannedAt.
    useEffect(() => {
        let alive = true;
        if (typeof api.getLastScan !== 'function') return undefined;
        api.getLastScan()
            .then((server) => {
                if (!alive || !server) return;
                const serverAt = server.scannedAt || server.scanned_at || null;
                const serverSuggestions = Array.isArray(server.suggestions) ? server.suggestions : null;
                if (!serverSuggestions) return;
                setLastScannedAt((prev) => {
                    if (!prev || (serverAt && new Date(serverAt) > new Date(prev))) {
                        applyResult({
                            suggestions: serverSuggestions,
                            summary: server.summary || null,
                            reason: server.reason || null,
                            scannedAt: serverAt,
                            cached: true,
                        }, false);
                        return serverAt || prev;
                    }
                    return prev;
                });
            })
            .catch(() => { /* optional endpoint — ignore */ });
        return () => { alive = false; };
    }, [api, applyResult]);

    // Abort any in-flight scan on unmount.
    useEffect(() => () => { try { abortRef.current?.abort(); } catch { /* noop */ } }, []);

    // ---- helpers ------------------------------------------------------------
    const labelFor = useMemo(() => {
        const m = new Map(apps.map((a) => [a.id, a.label || a.id]));
        return (id) => m.get(id) || id;
    }, [apps]);

    const toggle = useCallback((id) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    }, []);

    const upsertStep = (prev, step) => {
        const i = prev.findIndex((s) => s.tool === step.tool);
        const status = step.phase === 'done'
            ? (step.ok === false ? 'blocked' : 'done')
            : 'scanning';
        const row = {
            tool: step.tool,
            integration: step.integration,
            status,
            blockedReason: step.reason || step.blockedReason || (i >= 0 ? prev[i].blockedReason : null) || null,
            piiCategories: step.piiCategories || (i >= 0 ? prev[i].piiCategories : []) || [],
        };
        if (i >= 0) { const next = prev.slice(); next[i] = { ...next[i], ...row }; return next; }
        return [...prev, row];
    };

    // ---- scan ---------------------------------------------------------------
    const scan = useCallback(async (force = false) => {
        const ac = new AbortController();
        abortRef.current = ac;
        setScanning(true);
        setError(null);
        setRateLimitedUntil(null);
        setScanSteps([]);
        setPhase('scanning');
        // Keep any prior suggestions/summary/scanned visible until the new
        // `done` replaces them — a failed or rate-limited re-scan must NOT wipe
        // the results the user is currently looking at.

        const streamed = []; // collects feature-detected per-suggestion events
        let doneData = null;

        try {
            await api.suggestAutomationsStream(
                {
                    integrationIds: [...selectedRef.current],
                    focus: focusRef.current.trim(),
                    force: !!force,
                },
                (event, data) => {
                    if (event === 'scan_step') {
                        setScanSteps((prev) => upsertStep(prev, data));
                    } else if (event === 'phase') {
                        setPhase(data.phase);
                    } else if (event === 'suggestion') {
                        // Optional future event: append + de-dupe by id.
                        if (data && data.id != null && !streamed.some((s) => s.id === data.id)) {
                            streamed.push(data);
                            setSuggestions((prev) => (prev.some((s) => s.id === data.id) ? prev : [...prev, data]));
                        }
                    } else if (event === 'done') {
                        doneData = data;
                    } else if (event === 'error') {
                        setError(data.error || 'Could not generate ideas right now.');
                    }
                },
                ac.signal,
            );

            if (doneData) {
                // `done.suggestions` is authoritative; fall back to anything
                // streamed via the optional per-suggestion event.
                const list = Array.isArray(doneData.suggestions) && doneData.suggestions.length
                    ? doneData.suggestions
                    : (streamed.length ? streamed : (Array.isArray(doneData.suggestions) ? doneData.suggestions : []));
                applyResult({
                    suggestions: list,
                    summary: doneData.summary || null,
                    reason: doneData.reason || null,
                    scannedAt: doneData.scannedAt || new Date().toISOString(),
                    cached: !!doneData.cached,
                }, true);
            } else if (streamed.length) {
                applyResult({ suggestions: streamed, scannedAt: new Date().toISOString() }, true);
            }
        } catch (e) {
            if (!ac.signal.aborted) {
                const retry = e?.retryAfter || parseRetrySeconds(e?.message);
                if (e?.status === 429 || retry) {
                    // Rate-limited: surface a calm cooldown, not a hard failure.
                    setRateLimitedUntil(Date.now() + (retry || 30) * 1000);
                } else {
                    setError(e.message || 'Could not generate ideas right now.');
                }
            }
        } finally {
            setScanning(false);
            setPhase(null);
        }
    }, [api, applyResult]);

    const cancel = useCallback(() => {
        try { abortRef.current?.abort(); } catch { /* noop */ }
        setScanning(false);
        setPhase(null);
    }, []);

    // ---- dismiss / built ----------------------------------------------------
    const dismiss = useCallback((suggestion) => {
        if (!suggestion) return;
        setLedger(persistDismissed(suggestion));
    }, []);

    const markBuilt = useCallback((suggestion) => {
        if (!suggestion) return;
        setLedger(persistBuilt(suggestion));
    }, []);

    // Deleted (dismissed) suggestions are REMOVED from view, not greyed — and the
    // removal must survive reloads/restarts. The dismissed ledger is persisted
    // (scopedStorage) and keyed by a stable title hash, so we filter the raw list
    // through it here: a deleted card stays gone even if a stale local cache or an
    // as-yet-unreconciled server row still contains it.
    const dismissedHashes = useMemo(
        () => new Set(Object.keys(ledger?.dismissed || {})),
        [ledger],
    );
    const visibleSuggestions = useMemo(
        () => (Array.isArray(suggestions) ? suggestions : []).filter(s => s && !dismissedHashes.has(titleHash(s))),
        [suggestions, dismissedHashes],
    );
    const { dismissed, built } = useMemo(
        () => deriveStateSets(visibleSuggestions, ledger),
        [visibleSuggestions, ledger],
    );

    return {
        apps,
        catalogLoaded,
        selected,
        toggle,
        setSelected,
        focus,
        setFocus,
        scanning,
        phase,
        scanSteps,
        suggestions: visibleSuggestions,
        summary,
        scanned,
        reason,
        error,
        rateLimitedUntil,
        lastScannedAt,
        cached,
        scan,
        cancel,
        dismiss,
        dismissed,
        markBuilt,
        builtIds: built,
        labelFor,
    };
}
