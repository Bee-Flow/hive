import { useEffect, useState } from 'react';
import { API_BASE, authFetch } from '../../../utils/helpers';

/**
 * useMeetingSources — which live-meeting sources can actually feed Meeting
 * Notes for this account: Nextcloud Talk (any connection: connector / OAuth /
 * app-password) and Google Meet (Google connected).
 *
 * Gates the "Upcoming" tab on the Meeting Notes page: an org on e.g. Outlook
 * calendar + Teams has neither source, and a tab that can never show a
 * meeting shouldn't exist for them. Uses the two cheap settings endpoints
 * (no calendar scans). Best-effort: any error or non-OK (e.g. unlicensed
 * 403) counts as unavailable.
 *
 * @returns {{ talk: boolean, gmeet: boolean, loading: boolean }}
 */
export default function useMeetingSources() {
    const [sources, setSources] = useState({ talk: false, gmeet: false, loading: true });

    useEffect(() => {
        let alive = true;
        (async () => {
            const [talk, gmeet] = await Promise.all([
                authFetch(`${API_BASE}/api/talk-notes-settings/user/me`)
                    .then((r) => (r.ok ? r.json() : {}))
                    .then((d) => d.nextcloudConnected === true)
                    .catch(() => false),
                authFetch(`${API_BASE}/api/gmeet-notes-settings/user/me`)
                    .then((r) => (r.ok ? r.json() : {}))
                    .then((d) => d.connection?.googleConnected === true)
                    .catch(() => false),
            ]);
            if (alive) setSources({ talk, gmeet, loading: false });
        })();
        return () => { alive = false; };
    }, []);

    return sources;
}
