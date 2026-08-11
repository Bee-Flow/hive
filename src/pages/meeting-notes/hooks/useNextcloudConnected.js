import { useEffect, useRef, useState } from 'react';
import { API_BASE, authFetch } from '../../../utils/helpers';

/**
 * useNextcloudConnected — probes whether the current user has *any* Nextcloud
 * connection (connector / OAuth / saved app-password).
 *
 * Backed by the same `isConnected` check the settings page uses, surfaced via
 * the Talk-notes settings endpoint (`nextcloudConnected`). Used to gate
 * Nextcloud-only UI such as the "Nextcloud Talk" capture tile.
 *
 * Probes lazily (only once `enabled` is true) so we don't fire a Nextcloud
 * capability probe on every app load — CaptureModal is mounted app-wide but
 * only needs this when the user actually opens it. Defaults to false (hidden)
 * and stays false on any error / unlicensed account.
 *
 * @param {boolean} enabled - start the probe (e.g. when the modal opens)
 * @returns {{ connected: boolean, loading: boolean }} connection status and
 *   whether the probe is still in flight
 */
export default function useNextcloudConnected(enabled = true) {
    const [connected, setConnected] = useState(false);
    const [loading, setLoading] = useState(false);
    const probedRef = useRef(false);

    useEffect(() => {
        if (!enabled || probedRef.current) return;
        probedRef.current = true;
        let alive = true;
        setLoading(true);
        (async () => {
            try {
                const res = await authFetch(`${API_BASE}/api/talk-notes-settings/user/me`);
                const data = res.ok ? await res.json() : {};
                if (alive) setConnected(!!data.nextcloudConnected);
            } catch {
                if (alive) setConnected(false);
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => { alive = false; };
    }, [enabled]);

    return { connected, loading };
}
