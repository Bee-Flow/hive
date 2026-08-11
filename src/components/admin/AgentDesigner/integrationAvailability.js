// Shared org/credential availability filter for the integration catalog.
// Extracted from BuilderSplit so the agent builder and the skill editor gate
// the AppsPicker on exactly the same rules (mirrors ToolsSection.jsx).

// `agent-search` (Web Search) is a built-in platform capability with no
// per-org credentials — bypass the org-enabled gate so every agent can opt
// into it.
export const ALWAYS_AVAILABLE = new Set(['agent-search']);

/**
 * Filter the integration catalog against the caller's integration status
 * (the raw `GET /ai/user-settings` payload). A null/undefined status means
 * "not loaded yet" and returns the full catalog, matching the pre-extraction
 * behavior in BuilderSplit.
 */
export function filterAvailableIntegrations(catalog, integrationStatus) {
    if (!integrationStatus) return catalog;
    const status = integrationStatus;
    return catalog.filter(item => {
        if (ALWAYS_AVAILABLE.has(item.id)) return true;
        const orgEnabled = status.orgEnabledIntegrations;
        if (orgEnabled && !orgEnabled.includes(item.id)) return false;
        if (item.group === 'google') return !!status.isGoogleUser;
        if (item.id === 'fireflies') return !!status.hasFirefliesKey;
        if (item.id === 'youtrack') return !!status.hasYouTrackConfig;
        if (item.id === 'gamma') return !!status.hasGammaKey;
        if (item.id === 'n8n') return !!status.hasN8nConfig;
        if (item.id === 'linkedin') return !!status.hasLinkedInConfig || !!status.linkedInConnected;
        return true;
    });
}
