/**
 * useExportTargets — probes which external export targets are configured.
 *
 * Used by NotebooksPage (it copied these two probes). The
 * results gate the SignRequest and Nextcloud entries in the export menu.
 */
import { useState, useEffect } from 'react';
import { API_BASE, authFetch } from '../../../utils/helpers';

export default function useExportTargets() {
    const [signRequestConfigured, setSignRequestConfigured] = useState(false);
    const [nextcloudConfigured, setNextcloudConfigured] = useState(false);

    useEffect(() => {
        authFetch(`${API_BASE}/ai/user-settings`)
            .then(r => (r.ok ? r.json() : {}))
            .then(d => setSignRequestConfigured(!!d.hasSignRequestConfig))
            .catch(e => console.warn('[notebooks] SignRequest config probe failed', e));
    }, []);

    useEffect(() => {
        authFetch(`${API_BASE}/auth/app-password-status`)
            .then(r => (r.ok ? r.json() : {}))
            .then(d => setNextcloudConfigured(!!d.hasAppPassword))
            .catch(e => console.warn('[notebooks] Nextcloud config probe failed', e));
    }, []);

    return { signRequestConfigured, nextcloudConfigured };
}
