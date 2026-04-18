import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { API_BASE } from '../../../utils/helpers';
import { api, settingsFromConnection } from '../utils';

const deepEqual = (a, b) => {
    if (a === b) return true;
    if (a == null || b == null || typeof a !== typeof b) return false;
    if (typeof a !== 'object') return false;
    if (Array.isArray(a)) {
        if (!Array.isArray(b) || a.length !== b.length) return false;
        return a.every((v, i) => deepEqual(v, b[i]));
    }
    const ak = Object.keys(a), bk = Object.keys(b);
    if (ak.length !== bk.length) return false;
    return ak.every(k => deepEqual(a[k], b[k]));
};

/**
 * Owns settings state, dirty tracking, save/discard, SSE live sync stream,
 * test result, and sync-log loading for a single connection.
 */
export default function useConnectionSettings(conn, { onUpdate, onSync } = {}) {
    const baselineRef = useRef(settingsFromConnection(conn));
    const [settings, setSettings] = useState(() => settingsFromConnection(conn));

    // Re-sync baseline + state whenever the server connection changes identity or non-setting fields
    // (auto-refresh every 30s). Preserve unsaved edits: if user hasn't touched baseline, update both.
    useEffect(() => {
        const fresh = settingsFromConnection(conn);
        const clean = deepEqual(settings, baselineRef.current);
        baselineRef.current = fresh;
        if (clean) setSettings(fresh);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [conn]);

    const dirty = useMemo(() => !deepEqual(settings, baselineRef.current), [settings]);

    const discard = useCallback(() => setSettings(baselineRef.current), []);

    const [saving, setSaving] = useState(false);
    const save = useCallback(async () => {
        setSaving(true);
        try {
            await onUpdate?.(conn.id, settings);
            baselineRef.current = settings;
        } finally {
            setSaving(false);
        }
    }, [conn.id, settings, onUpdate]);

    /* ── Sync (SSE) ── */
    const [syncing, setSyncing] = useState(false);
    const [syncProgress, setSyncProgress] = useState(null);
    const [syncConflict, setSyncConflict] = useState(null);
    const esRef = useRef(null);

    useEffect(() => () => { try { esRef.current?.close(); } catch { /* noop */ } }, []);

    const startSync = useCallback(async () => {
        setSyncing(true);
        setSyncProgress({ processed: 0, total: null, recent: [] });
        setSyncConflict(null);

        const streamUrl = `${API_BASE}/api/email-kb/connections/${conn.id}/sync/stream`;
        const es = new EventSource(streamUrl, { withCredentials: true });
        esRef.current = es;

        const finishOk = () => {
            try { es.close(); } catch { /* noop */ }
            setSyncing(false);
            setSyncProgress(null);
            onSync?.(conn.id, { sseFinished: true });
        };

        es.addEventListener('sync_fetch_complete', (ev) => {
            try {
                const data = JSON.parse(ev.data);
                setSyncProgress(p => ({ ...(p || { processed: 0, recent: [] }), total: data.total }));
            } catch { /* ignore */ }
        });
        es.addEventListener('email_processed', (ev) => {
            try {
                const data = JSON.parse(ev.data);
                setSyncProgress(p => {
                    const recent = [...(p?.recent || []), {
                        bucket: data.bucket,
                        reason: data.detail?.reason,
                        subject: data.detail?.subject || data.detail?.category || data.detail?.messageId || '',
                        at: data.at,
                    }].slice(-5);
                    return { processed: data.processed ?? (p?.processed || 0) + 1, total: data.total ?? p?.total ?? null, recent };
                });
            } catch { /* ignore */ }
        });
        es.addEventListener('sync_completed', finishOk);
        es.onerror = () => {
            try { es.close(); } catch { /* noop */ }
            setSyncing(false);
            setSyncProgress(null);
            onSync?.(conn.id, { sseError: true });
        };

        try {
            const resp = await fetch(`${API_BASE}/api/email-kb/connections/${conn.id}/sync`, {
                method: 'POST',
                credentials: 'include',
            });
            if (resp.status === 409) {
                const body = await resp.json().catch(() => ({}));
                setSyncConflict({ retryAfterSeconds: body.retryAfterSeconds || 60 });
                try { es.close(); } catch { /* noop */ }
                setSyncing(false);
                setSyncProgress(null);
                return;
            }
            if (!resp.ok) {
                const body = await resp.json().catch(() => ({}));
                throw new Error(body.error || `Sync failed (${resp.status})`);
            }
        } catch (err) {
            console.error('[EmailKB] Sync trigger failed:', err);
            try { es.close(); } catch { /* noop */ }
            setSyncing(false);
            setSyncProgress(null);
        }
    }, [conn.id, onSync]);

    /* ── Test ── */
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState(null);
    const runTest = useCallback(async () => {
        setTesting(true);
        setTestResult(null);
        try {
            const result = await api(`/connections/${conn.id}/test`, { method: 'POST' });
            setTestResult(result);
        } catch (err) {
            setTestResult({ error: err.message });
        } finally {
            setTesting(false);
        }
    }, [conn.id]);
    const clearTestResult = useCallback(() => setTestResult(null), []);

    /* ── Logs ── */
    const [logs, setLogs] = useState([]);
    const [logsLoaded, setLogsLoaded] = useState(false);
    const loadLogs = useCallback(async () => {
        try {
            const data = await api(`/connections/${conn.id}/logs`);
            setLogs(data.logs || []);
            setLogsLoaded(true);
        } catch (err) {
            console.error('Failed to load logs:', err);
        }
    }, [conn.id]);

    return {
        settings, setSettings,
        dirty, saving, save, discard,
        syncing, syncProgress, syncConflict, startSync,
        testing, testResult, runTest, clearTestResult,
        logs, logsLoaded, loadLogs,
    };
}
