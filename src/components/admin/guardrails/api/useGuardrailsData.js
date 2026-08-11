import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    probeCapabilities, fetchAiConfig, fetchOrganisations, fetchOrgShield, fetchGuardStatus,
} from './guardrailsApi';

/**
 * The console's shared data: the server-wide pattern library, the capability
 * probe, and enough per-org data to answer "who uses what, and what is broken".
 *
 * One loader rather than per-tab fetching, because the overview strip needs
 * numbers from every family at once and the tabs would otherwise each refetch
 * the same `ai` blob.
 */
export function useGuardrailsData() {
    const [capabilities, setCapabilities] = useState(null);
    const [rules, setRules] = useState([]);
    const [collections, setCollections] = useState([]);
    const [directChat, setDirectChat] = useState({ enabled: false, collectionIds: [] });
    const [orgs, setOrgs] = useState([]);
    const [orgShields, setOrgShields] = useState({});   // orgId → shield doc
    const [guardStatus, setGuardStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [caps, aiConfig, orgList] = await Promise.all([
                probeCapabilities(),
                fetchAiConfig(),
                fetchOrganisations().catch(() => []),
            ]);
            setCapabilities(caps);
            setRules(aiConfig?.regexGuardrails?.rules || []);
            setCollections(aiConfig?.regexGuardrails?.collections || []);
            setDirectChat({
                enabled: aiConfig?.directChatRegexGuardrails?.enabled === true,
                collectionIds: aiConfig?.directChatRegexGuardrails?.collectionIds || [],
            });
            setOrgs(Array.isArray(orgList) ? orgList : []);

            // Per-org shields, for the bindings overview and the stale-reference
            // count. Individually tolerant: one org the caller cannot read must
            // not blank the whole page.
            //
            // This is an N+1 and it is deliberate for now — there is no
            // aggregate endpoint yet, and the alternative is showing nothing.
            // `/api/admin/guardrail-presets/overview` replaces it in one call.
            const shields = await Promise.all(
                (orgList || []).map(async (o) => {
                    try { return [o.id, await fetchOrgShield(o.id)]; }
                    catch { return [o.id, null]; }
                }),
            );
            setOrgShields(Object.fromEntries(shields));
        } catch (e) {
            setError(e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    // Health is separate: it is slow, it is allowed to fail, and the rest of
    // the page must render without waiting for it.
    useEffect(() => {
        let cancelled = false;
        fetchGuardStatus()
            .then(s => { if (!cancelled) setGuardStatus(s); })
            .catch(() => { if (!cancelled) setGuardStatus({ configured: false, reachable: false }); });
        return () => { cancelled = true; };
    }, []);

    /**
     * References that point at something that no longer exists.
     *
     * Deleting a collection silently degrades every org and every surface that
     * referenced it — the shield keeps resolving, just with fewer rules, and
     * nothing in the current UI says so. Computing it here is what turns that
     * into a visible number.
     */
    const staleRefs = useMemo(() => {
        const collectionIds = new Set(collections.map(c => c.id));
        const ruleIds = new Set(rules.map(r => r.id));
        const out = [];

        for (const [orgId, shield] of Object.entries(orgShields)) {
            for (const cid of shield?.collectionIds || []) {
                if (!collectionIds.has(cid)) {
                    out.push({ kind: 'org_collection', orgId, collectionId: cid });
                }
            }
        }
        for (const cid of directChat.collectionIds) {
            if (!collectionIds.has(cid)) {
                out.push({ kind: 'directchat_collection', collectionId: cid });
            }
        }
        for (const col of collections) {
            for (const rid of col.ruleIds || []) {
                if (!ruleIds.has(rid)) {
                    out.push({ kind: 'collection_rule', collectionId: col.id, ruleId: rid });
                }
            }
        }
        return out;
    }, [collections, rules, orgShields, directChat.collectionIds]);

    const orgsWithShieldOn = useMemo(
        () => Object.values(orgShields).filter(s => s?.enabled).length,
        [orgShields],
    );

    return {
        loading, error, reload: load,
        capabilities,
        rules, setRules,
        collections, setCollections,
        directChat, setDirectChat,
        orgs, orgShields,
        guardStatus,
        staleRefs, orgsWithShieldOn,
    };
}

export default useGuardrailsData;
