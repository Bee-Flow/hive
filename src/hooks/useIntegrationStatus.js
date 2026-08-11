import { useState, useEffect } from 'react';
import { API_BASE, authFetch } from '../utils/helpers';

// Module-level cache (same pattern as useSkills): the user-settings payload
// changes rarely within a session, and the skill editor may mount/unmount the
// hook often while switching skills.
let cache = null;
let inflight = null;

async function fetchStatus() {
    const res = await authFetch(`${API_BASE}/ai/user-settings`);
    if (!res.ok) return {};
    return res.json();
}

/**
 * Integration status for availability gating (the raw `GET /ai/user-settings`
 * payload — orgEnabledIntegrations, isGoogleUser, hasFirefliesKey, …).
 *
 * Consumers without access to AgentEditorBootstrapContext (e.g. SkillsStudio)
 * use this hook; BuilderSplit keeps its bootstrap-provided copy.
 */
export function useIntegrationStatus() {
    // useState(cache) seeds from the module cache at mount, so the effect only
    // has work to do on the first-ever mount (cache still null).
    const [integrationStatus, setIntegrationStatus] = useState(cache);

    useEffect(() => {
        if (cache !== null) return undefined;
        let mounted = true;
        if (!inflight) {
            inflight = fetchStatus()
                .then(data => { cache = data; return data; })
                .catch(() => { inflight = null; return {}; });
        }
        inflight.then(data => { if (mounted) setIntegrationStatus(data); });
        return () => { mounted = false; };
    }, []);

    return { integrationStatus };
}
