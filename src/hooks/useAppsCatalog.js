/**
 * Everything the Apps picker needs: which apps this user can reach, which of
 * them are switched on, and how to switch one.
 *
 * Extracted from InputArea so the Cowork composer can have the same picker
 * rather than a second copy of it. The four sources are fetched here —
 * the user's integration status, n8n workflows, connected MCP servers and the
 * Reusable Steps published "in chat".
 *
 * `enabledApps` is a *user preference*, not a per-message selection: it is
 * stored server-side and nothing is sent along at submit time. That is why
 * this hook returns no "selected" value — a cowork brief and a chat message
 * draw on the same list, which is also how the backend sees it.
 */
import { useCallback, useEffect, useState } from 'react';
import { API_BASE, authFetch } from '../utils/helpers';
import { useIntegrationStatus } from './useIntegrationStatus';
import { APP_DEFS, buildAppCatalog, filterAvailableApps } from '../components/apps/appCatalog';

export default function useAppsCatalog({ agentIntegrations = null } = {}) {
    // The /ai/user-settings payload, module-cached by the shared hook so this
    // is not a third caller of that endpoint.
    const { integrationStatus } = useIntegrationStatus();

    const [n8nWorkflows, setN8nWorkflows] = useState([]);
    const [mcpServers, setMcpServers] = useState([]);
    const [exposedSteps, setExposedSteps] = useState([]);
    // null = every app enabled. Seeded from the cached settings payload and
    // then owned locally, so toggling never has to invalidate that cache.
    const [enabledApps, setEnabledApps] = useState(null);
    const [seeded, setSeeded] = useState(false);

    useEffect(() => {
        if (seeded || !integrationStatus) return;
        if (integrationStatus.enabledApps) setEnabledApps(integrationStatus.enabledApps);
        setSeeded(true);
    }, [integrationStatus, seeded]);

    useEffect(() => {
        let alive = true;
        // All three are best-effort: a 403/404 (beta off, nothing configured)
        // just means that source contributes no apps.
        authFetch(`${API_BASE}/ai/n8n/config`)
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (alive && data?.workflows?.length) {
                    setN8nWorkflows(data.workflows.filter(w => w.enabled && !w.allowKbIngestion));
                }
            })
            .catch(() => { });
        authFetch(`${API_BASE}/ai/mcp-servers/user-credentials`)
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (alive && data?.servers?.length) {
                    setMcpServers(data.servers.filter(s => s.toolCount > 0));
                }
            })
            .catch(() => { });
        authFetch(`${API_BASE}/api/step/chat-tools`)
            .then(r => r.ok ? r.json() : null)
            .then(data => { if (alive && Array.isArray(data?.tools)) setExposedSteps(data.tools); })
            .catch(() => { });
        return () => { alive = false; };
    }, []);

    const toggleApp = useCallback((appId) => {
        setEnabledApps(prev => {
            const defaults = APP_DEFS.filter(a => !a.requiresNone).map(a => a.id);
            const current = prev || defaults;
            const next = current.includes(appId)
                ? current.filter(id => id !== appId)
                : [...current, appId];
            // Persist to the server, fire-and-forget: the switch flipping
            // instantly matters more than confirming the write.
            authFetch(`${API_BASE}/ai/user-settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabledApps: next }),
            }).catch(() => { });
            return next;
        });
    }, []);

    const isAppEnabled = useCallback(
        (appId) => (enabledApps ? enabledApps.includes(appId) : true),
        [enabledApps],
    );

    const availableApps = filterAvailableApps(
        buildAppCatalog({ n8nWorkflows, mcpServers, exposedSteps }),
        {
            integrationStatus: integrationStatus || {},
            orgEnabledIntegrations: integrationStatus?.orgEnabledIntegrations ?? null,
            agentIntegrations,
        },
    );

    return { availableApps, isAppEnabled, toggleApp };
}
