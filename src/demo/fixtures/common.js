/**
 * Fixture pieces every demo needs.
 *
 * The Studio components don't only fetch their own data — they also ask the
 * platform who the user is and what the licence allows, and they render a
 * "not available on your plan" state if the answer is no. So a demo has to
 * answer those too, or the visitor sees a lock screen instead of the feature.
 *
 * Everything here is invented and public by construction. There is no real
 * user, org or licence behind it; these objects exist only to let the real
 * components render their normal, unlocked layout.
 */

// Every capability id the two seeded demos can touch. Kept as a plain list
// rather than "return true for everything" so adding a demo forces a
// deliberate decision about what it is allowed to show.
export const DEMO_CAPABILITIES = [
    'agent_routines', 'automations', 'meeting_notes', 'skills',
    'integrations', 'chat_basic', 'kb_unlimited', 'learning_center',
    'notebooks', 'projects',
    // Gates the Safety & Guardrails / Integrations / Feedback / Terminations
    // tabs in pages/settings/UsageSection (`canSeeAdvancedUsage`, line ~82).
    // Without it the tab list is filtered down to Overview alone and the
    // fixtures for those tabs load but are never rendered — which looks
    // exactly like the fixtures being missing.
    'advanced_usage_monitoring',
    // The Privacy Shield demo's document uses the Tokenize action and the web
    // search guard. Both are Enterprise gates the editor checks BEFORE the
    // server does, so without these the two controls the page is selling
    // render as licence locks.
    'pii_tokenize', 'web_search_guard',
    // Support Studio is gated per organisation as well as per member.
    'support_inbox',
    // The Compliance Center. The demo mounts ComplianceHub directly, so it
    // does not pass through the `RequireTier feature="compliance_hub_gdpr"`
    // wall in AdvancedSettings — but the capability is granted anyway so the
    // demo entitlements describe the same product the demo is showing, and so
    // a future gate INSIDE the hub does not silently blank it.
    'compliance_hub_gdpr',
    // App Studio. Same reasoning: the demo mounts AppStudioSection directly,
    // bypassing the Studio tab gate (`hasLicenseFeature('app_studio') &&
    // canUse('app_studio')`, studioApps.jsx) — nothing INSIDE the tree gates
    // today, but the entitlements should describe the product being shown.
    'app_studio',
];

// Per-member permissions the demos need. NotebooksPage checks these directly
// (`use_notebooks`), separately from the licence capability above — an 'all'
// grant would work but would also silently unlock every other gated screen,
// which is not what a demo should be asserting about itself.
export const DEMO_PERMISSIONS = ['use_notebooks'];

export const DEMO_USER = {
    id: 'demo-user',
    username: 'demo',
    displayName: 'Demo user',
    email: 'demo@example.com',
    role: 'user',
    organizationId: 'demo-org',
    permissions: DEMO_PERMISSIONS,
    betaFeatures: DEMO_CAPABILITIES,
    canUseFeature: Object.fromEntries(DEMO_CAPABILITIES.map(id => [id, true])),
};

/** GET /auth/my-entitlements — shape read by EntitlementsContext. */
export const DEMO_ENTITLEMENTS = {
    tier: 'enterprise',
    mode: 'selfhosted',
    superAdmin: false,
    effective: { core: DEMO_CAPABILITIES, beta: DEMO_CAPABILITIES, integration: [] },
    ceiling: { core: DEMO_CAPABILITIES, beta: DEMO_CAPABILITIES, integration: [] },
    reasons: {},
    registry: [],
};

/**
 * Routes every demo mounts, before its own feature routes.
 *
 * Anything the shell asks for on boot lands here. Unknown routes 404 by
 * design (see demoTransport), so this list is the "platform chrome" a demo
 * needs to stop looking broken — not a catch-all.
 */
export const COMMON_ROUTES = {
    'GET /auth/my-entitlements': () => DEMO_ENTITLEMENTS,
    'GET /auth/me': () => DEMO_USER,
    'GET /auth/setup-status': () => ({ deploymentMode: 'self-hosted', needsSetup: false }),
    // LicenseProvider gates features on this; an unlicensed answer would show
    // the visitor an upgrade wall instead of the feature they came to see.
    'GET /api/license/status': () => ({
        valid: true,
        tier: 'enterprise',
        features: DEMO_CAPABILITIES,
        scope: 'org',
        expiresAt: null,
        demo: true,
    }),
    'GET /api/health': () => ({ status: 'ok', demo: true }),
    'GET /api/languages/:locale': () => ({}),
    'GET /api/admin/ai-config': () => ({ modelTiers: {}, demo: true }),
    'GET /agents/all': ({ state }) => state.agents || [],
    'GET /api/integrations/connections': () => ({ connections: [] }),
    'GET /api/notifications': () => ({ notifications: [], unread: 0 }),
    // The remote-module runtime starts on idle (main.jsx), so it fires on
    // every demo a few seconds in — after DemoHost has swapped its own
    // transport in. An anonymous visitor has no installed modules, so the
    // honest answer is an empty list rather than a "no fixture" warning that
    // teaches the eye to ignore that warning.
    'GET /api/modules/frontend': () => ([]),
    // Bare array. NotebooksPage assigns it straight through and maps over it,
    // so an envelope takes the screen down. The skills demo overrides this
    // with real ones.
    'GET /api/skills': () => ([]),

    // Platform chrome several editors ask for on mount. Shapes matter more
    // than contents here: these four are read as BARE values
    // (`setX(await res.json())`) and then mapped over, so an envelope
    // crashes the screen instead of leaving a panel empty.
    'GET /auth/groups': () => ([]),
    // Admin screens gate sections on the effective permission list rather than
    // on the licence alone. Without this the organisation usage view renders
    // its "you do not have access" state instead of the dashboard.
    'GET /auth/my-permissions': () => ({ permissions: [...DEMO_PERMISSIONS, 'view_usage', 'org_admin'] }),
    'GET /auth/app-password-status': () => ({ enabled: false, hasPassword: false }),
    'GET /ai/user-settings': () => ({ integrations: {}, connected: [] }),
    'GET /ai/config/chat-models': () => ({
        tiers: {
            fast:     { label: 'Fast', model: 'demo-fast' },
            standard: { label: 'Standard', model: 'demo-standard' },
            thinking: { label: 'Thinking', model: 'demo-thinking' },
        },
        default: 'fast',
    }),
    // The chat composer (InputArea) probes what it may offer in its tool
    // menu. Empty answers render the menu without those entries, which is
    // the honest state for a demo that cannot reach any of them.
    'GET /ai/n8n/config': () => ({ enabled: false }),
    'GET /ai/mcp-servers/user-credentials': () => ([]),
    'GET /api/step/chat-tools': () => ({ steps: [] }),

    'GET /ai/config/tiers-for-user': () => ({
        tiers: {
            fast:     { label: 'Fast', description: 'Quick answers for everyday work' },
            standard: { label: 'Standard', description: 'The default balance of speed and depth' },
            thinking: { label: 'Thinking', description: 'Slower, for problems worth the wait' },
        },
        default: 'fast',
    }),
};

/** Deterministic ids — a demo must render identically on every visit. */
let seq = 0;
export const demoId = (prefix) => `${prefix}_demo${String(++seq).padStart(4, '0')}`;

/**
 * Timestamps relative to page load, so a demo never shows a stale "updated
 * 8 months ago" and never needs re-authoring.
 */
export const daysAgo = (n) => new Date(Date.now() - n * 86_400_000).toISOString();
export const minutesAgo = (n) => new Date(Date.now() - n * 60_000).toISOString();
