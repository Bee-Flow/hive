// Single shared bootstrap fetch for the agent editor. Without this, every
// time the user switches agents in the studio (which forces a BuilderSplit
// remount via `key={selectedAgent.id}`) the editor refires six parallel
// requests (skills, integration status, agent categories, org groups, tier
// list, automations). The data rarely changes during a session, so we fetch
// once at the AgentStudio level and pass it down via context. BuilderSplit's
// hook falls back to its own fetch when no provider is present (so the
// wizard landing path keeps working).

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { API_BASE, authFetch } from '../../../utils/helpers';

const EMPTY = {
    allSkills: null,
    integrationStatus: null,
    categories: [],
    orgGroups: [],
    tiers: {},
    automations: [],
    loaded: false,
    refreshSkills: () => Promise.resolve(),
    refreshCategories: () => Promise.resolve(),
};

const AgentEditorBootstrapContext = createContext(EMPTY);

export function AgentEditorBootstrapProvider({ children }) {
    const [allSkills, setAllSkills] = useState(null);
    const [integrationStatus, setIntegrationStatus] = useState(null);
    const [categories, setCategories] = useState([]);
    const [orgGroups, setOrgGroups] = useState([]);
    const [tiers, setTiers] = useState({});
    const [automations, setAutomations] = useState([]);
    const [loaded, setLoaded] = useState(false);
    const cancelledRef = useRef(false);

    const refreshSkills = useCallback(async () => {
        try {
            const r = await authFetch(`${API_BASE}/api/skills`);
            if (r.ok) setAllSkills(await r.json());
        } catch (_) { /* ignore */ }
    }, []);

    const refreshCategories = useCallback(async () => {
        try {
            const r = await authFetch(`${API_BASE}/agents/categories`);
            if (r.ok) setCategories(await r.json());
        } catch (_) { /* ignore */ }
    }, []);

    useEffect(() => {
        cancelledRef.current = false;
        (async () => {
            try {
                const [skillsRes, statusRes, catsRes, groupsRes, tiersRes, autosRes] = await Promise.all([
                    authFetch(`${API_BASE}/api/skills`),
                    authFetch(`${API_BASE}/ai/user-settings`),
                    authFetch(`${API_BASE}/agents/categories`),
                    authFetch(`${API_BASE}/auth/groups`),
                    authFetch(`${API_BASE}/ai/config/tiers-for-user?taskType=direct_chat`),
                    authFetch(`${API_BASE}/automation`).catch(() => ({ ok: false })),
                ]);
                if (cancelledRef.current) return;
                setAllSkills(skillsRes.ok ? await skillsRes.json() : []);
                setIntegrationStatus(statusRes.ok ? await statusRes.json() : {});
                setCategories(catsRes.ok ? await catsRes.json() : []);
                setOrgGroups(groupsRes.ok ? await groupsRes.json() : []);
                setTiers(tiersRes.ok ? await tiersRes.json() : {});
                if (autosRes.ok) {
                    try {
                        const data = await autosRes.json();
                        setAutomations(Array.isArray(data?.automations) ? data.automations : []);
                    } catch (_) { setAutomations([]); }
                }
            } catch (_) {
                if (!cancelledRef.current) {
                    setAllSkills([]);
                    setIntegrationStatus({});
                }
            } finally {
                if (!cancelledRef.current) setLoaded(true);
            }
        })();
        return () => { cancelledRef.current = true; };
    }, []);

    const value = {
        allSkills,
        integrationStatus,
        categories,
        orgGroups,
        tiers,
        automations,
        loaded,
        refreshSkills,
        refreshCategories,
    };

    return (
        <AgentEditorBootstrapContext.Provider value={value}>
            {children}
        </AgentEditorBootstrapContext.Provider>
    );
}

export function useAgentEditorBootstrap() {
    return useContext(AgentEditorBootstrapContext);
}
