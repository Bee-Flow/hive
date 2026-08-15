import React, { Suspense, useState, useEffect, useRef, useCallback } from 'react';
import { lazy } from './utils/lazyWithReload';

/**
 * The authenticated product, behind ONE lazy boundary.
 *
 * This file is the app half of the marketing/app split. App.jsx used to hold
 * both surfaces, and although the heavy feature trees were already lazy, the
 * router shell itself statically imported the licence/subscription contexts,
 * the Studio route table (which drags in the module-runtime registry), the
 * meeting/billing helpers and the whole 1,200-line <App/> — ~90 KB gz of
 * JavaScript a marketing visitor parsed to read a landing page it never runs.
 * App.jsx now imports this module via `lazy()`, so a marketing pageview
 * fetches none of it and a product pageview fetches all of it exactly once,
 * warmed up by a module-scope import() on /app paths so the boundary costs a
 * signed-in user no extra round trip in practice.
 *
 * Nothing in here may be imported by App.jsx or anything App.jsx reaches
 * statically — that would weld this chunk straight back into the entry.
 */
const AgentHub = lazy(() => import('./AgentHub'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const MfaSetupGate = lazy(() => import('./pages/login/MfaSetupGate'));
const EncryptionSetup = lazy(() => import('./pages/EncryptionSetup'));
const DlpPreviewModal = lazy(() => import('./components/DlpPreviewModal'));
const OnboardingTour = lazy(() => import('./components/onboarding/OnboardingTour'));
const LessonPlayerHost = lazy(() => import('./components/onboarding/LessonPlayerHost'));
import ErrorBoundary from './components/ErrorBoundary';
import MaintenanceBanner from './components/MaintenanceBanner';
import { LicenseProvider, RequireTier, useLicenseContext } from './components/LicenseContext';
import { SubscriptionProvider, useSubscriptionContext } from './components/SubscriptionContext';
import { EntitlementsProvider } from './components/EntitlementsContext';
const NcOnboardingWizard = lazy(() => import('./components/NcOnboardingWizard'));
const NcOnboardingPending = lazy(() => import('./components/NcOnboardingPending'));
const NcBindingApprovalModal = lazy(() => import('./components/NcBindingApprovalModal'));
const EmailVerificationScreen = lazy(() => import('./components/EmailVerificationScreen'));
import beeFlowIcon from './assets/BeeFlow-logo-Icon-2026.svg';
import beeFlowLogo from './assets/bee-flow-logo.svg';


// Heavy admin / studio routes are loaded on demand so the initial chat
// bundle stays lean. Each render site is wrapped in <Suspense> + a per-
// route <ErrorBoundary> so a load failure or runtime crash in one panel
// can't take down the rest of the app.
const ComponentBuilder = lazy(() => import('./components/admin/ComponentBuilder'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const OrgSettings = lazy(() => import('./pages/OrgSettings'));
// The RecorderProvider/CaptureProvider remain mounted at the app root so
// capture state persists across page navigation even when the Studio tab
// isn't open. Lazy: they pull the whole meeting-notes capture subtree.
const RecorderProvider = lazy(() => import('./pages/meeting-notes/hooks/RecorderContext')
    .then(m => ({ default: m.RecorderProvider })));
const CaptureProvider = lazy(() => import('./pages/meeting-notes/capture/CaptureContext')
    .then(m => ({ default: m.CaptureProvider })));
const CaptureModal = lazy(() => import('./pages/meeting-notes/capture/CaptureModal'));
const MeetingCommandPalette = lazy(() => import('./components/global/MeetingCommandPalette'));
const TemplatesPage = lazy(() => import('./pages/TemplatesPage'));
const AppRunPage = lazy(() => import('./pages/apps/AppRunPage'));
const AppsHomePage = lazy(() => import('./pages/apps/AppsHomePage'));
const AgentDesigner = lazy(() => import('./components/admin/AgentDesigner'));

import { API_BASE, authFetch, setSessionToken } from './utils/helpers';
import { parseStudioUrl, parseStudioQuery, sectionFromRaw, segmentForSection } from './components/admin/Studio/studioRoutes';
import { parseProjectUrl, projectRoutePath } from './utils/projectRoutes';
import scopedStorage from './utils/scopedStorage';
import { queryClient } from './api/queryClient';
import { identityKey, shouldResetCache } from './utils/identityCache';
import { logger } from './utils/logger';
import { useTranslation } from './hooks/useTranslation';
import { useViewport } from './hooks/useViewport';
import { capturePendingPlanFromUrl } from './components/billing/pendingPlan';
import { useAppHeight } from './hooks/useAppHeight';

function RouteFallback() {
    const { t } = useTranslation();
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: 'var(--text-muted)' }}>
            {t('app.loading', 'Loading…')}
        </div>
    );
}

/* Matches the shell background painted by index.html, so a chunk fetch never
   shows through as white. Duplicated from App.jsx on purpose: importing
   anything from App.jsx here would defeat the split (see header). */
function AppBackdrop() {
    return <div style={{ background: '#06090F', minHeight: '100vh' }} />;
}

// ── Route mapping ──────────────────────────────────────────────
const PAGE_ROUTES = {
    // ── App routes (all under /app/) ──
    agents: '/app',
    admin: '/app/admin',
    orgSettings: '/app/org-settings',
    settings: '/app/settings',
    // Plans, invoices and checkout. Billing used to be buried in a Settings
    // sub-tab with no route of its own, so the pricing page's
    // /app/billing?plan=<id> links 404'd and the chosen plan was dropped.
    billing: '/app/billing',
    agentDesigner: '/app/agent-designer',
    agentDesignerAdvanced: '/app/agent-designer-advanced',
    agentWizard: '/app/agent-wizard',
    studio: '/app/studio',
    // URL slug renamed from /app/ai-tasks → /app/routines (Aug 2026 rename).
    // Old paths still parse below for one release.
    aiTasks: '/app/routines',
    // Cowork — the front door for "just do this for me" prompt automation, and
    // the only place it lives: create, correct and run history in one master-
    // detail page. /app/routines keeps the flow builder for multi-step work.
    // Legacy /app/work and /app/studio/cowork/:id resolve here too (below).
    cowork: '/app/cowork',
    // Consumer directory of published App Studio apps. The run view for a
    // single app lives at /app/apps/:id (page key 'appRun', matched below).
    apps: '/app/apps',
    reports: '/app/reports',
    components: '/app/components',
    // Kept for /app/meeting-notes backward-compat — the page now renders
    // inside Studio so /app/meeting-notes redirects to /app/studio/meeting-notes.
    meetingNotes: '/app/meeting-notes',
    templates: '/app/templates',
    notebooks: '/app/notebooks',
    // Projects had NO route at all: the list and detail views were pure local
    // state in AgentHub, so they could not be linked, bookmarked, reached with
    // the back button, or survive a reload. For a feature whose entire point is
    // "send this to a colleague", that was the sharpest edge in it.
    projects: '/app/projects',
    webpages: '/app/webpages',
};

// ── Mobile access control ──────────────────────────────────────
// Phones (<768px) are a focused view/chat-only surface. Only these page keys
// are allowed; everything else (studio, admin, org settings, the agent
// editors/wizard, notebooks, etc.) redirects to /app. Deny-by-default
// so new desktop-only pages are blocked automatically. 'agents' already covers
// /app, /app/a/:id (agent chat) and /app/d/:id (direct chat).
// 'appRun' (published App Studio apps) is deliberately phone-friendly — the
// runtime stacks sections below 640px. 'apps' (the published-apps directory)
// stacks its tile grid to a single column, so it's phone-friendly too.
// 'cowork' is phone-friendly by design — delegating a task from your phone and
// reading the result later is the case Cowork exists for. The page collapses
// to the list, with a selected item taking the whole screen.
export const MOBILE_ALLOWED_PAGES = new Set(['agents', 'settings', 'appRun', 'apps', 'cowork']);
const isPageAllowedOnMobile = (page) => MOBILE_ALLOWED_PAGES.has(page);

// Reduce a navigateToPage() argument (which may be a bare key, a 'studio/agents'
// path form, or an 'agentDesigner:<id>' form) to the canonical page key used by
// MOBILE_ALLOWED_PAGES. Mirrors the alias handling inside navigateToPage().
function mobilePageKey(page) {
    if (!page || page === '/' || page === 'home') return 'agents';
    const head = String(page).split(/[/:]/)[0];
    if (head === 'webpages' || head === 'meetingNotes' || head === 'meeting-notes') return 'studio';
    return head;
}

// Reverse lookup: path → page key
const PATH_TO_PAGE = Object.fromEntries(
    Object.entries(PAGE_ROUTES).map(([page, path]) => [path, page])
);

function pageFromPath(pathname) {
    // Root → agents (redirect to /app)
    if (pathname === '/') return 'agents';
    // Exact match for app routes
    if (PATH_TO_PAGE[pathname]) return PATH_TO_PAGE[pathname];
    // /app/admin or /app/admin/* → admin page
    if (pathname === '/app/admin' || pathname.startsWith('/app/admin/')) return 'admin';
    // Legacy bare /admin → redirect to /app/admin (handled below)
    if (pathname === '/admin' || pathname.startsWith('/admin/')) return 'admin';
    // /app/org-settings or /app/org-settings/* → orgSettings
    if (pathname === '/app/org-settings' || pathname.startsWith('/app/org-settings/')) return 'orgSettings';
    // Legacy bare /org-settings
    if (pathname === '/org-settings' || pathname.startsWith('/org-settings/')) return 'orgSettings';
    // /app/settings or /app/settings/* → settings
    if (pathname === '/app/settings' || pathname.startsWith('/app/settings/')) return 'settings';
    // /app/billing (+ /app/billing/* for future sub-tabs) → billing
    if (pathname === '/app/billing' || pathname.startsWith('/app/billing/')) return 'billing';
    // /app/agent-designer-advanced or /app/agent-designer-advanced/* → agentDesignerAdvanced (legacy form)
    if (pathname === '/app/agent-designer-advanced' || pathname.startsWith('/app/agent-designer-advanced/')) return 'agentDesignerAdvanced';
    // /app/agent-designer or /app/agent-designer/* → agentDesigner (unified studio)
    if (pathname === '/app/agent-designer' || pathname.startsWith('/app/agent-designer/')) return 'agentDesigner';
    // /app/agent-wizard → agentWizard
    if (pathname === '/app/agent-wizard' || pathname.startsWith('/app/agent-wizard/')) return 'agentWizard';
    // Cowork used to be a Studio tab. Its deep links keep working, but they
    // resolve to the standalone page now — matched BEFORE the generic Studio
    // rule below, which would otherwise swallow them.
    if (pathname === '/app/studio/cowork' || pathname.startsWith('/app/studio/cowork/')) return 'cowork';
    // /app/studio (and sub-sections) → unified Studio
    if (pathname === '/app/studio' || pathname.startsWith('/app/studio/')) return 'studio';
    // /app/routines or /app/routines/* → aiTasks (internal page key kept for stability)
    if (pathname === '/app/routines' || pathname.startsWith('/app/routines/')) return 'aiTasks';
    // Backward-compat: legacy /app/ai-tasks paths still resolve to the same page
    if (pathname === '/app/ai-tasks' || pathname.startsWith('/app/ai-tasks/')) return 'aiTasks';
    // /app/cowork (+ /app/cowork/:id for the detail pane) → Cowork.
    // /app/work is what this page was called before the rename; kept so
    // bookmarks and the old sidebar entry still land somewhere.
    if (pathname === '/app/cowork' || pathname.startsWith('/app/cowork/')) return 'cowork';
    if (pathname === '/app/work' || pathname.startsWith('/app/work/')) return 'cowork';
    // /app/notebooks/:id → notebooks page (must come before generic /app/*)
    if (pathname.startsWith('/app/notebooks')) return 'notebooks';
    // /app/projects, /app/projects/:id, /app/projects/:id/:tab
    if (pathname.startsWith('/app/projects')) return 'projects';
    // /app/webpages/:id → unified Studio (Webpages tab)
    if (pathname.startsWith('/app/webpages')) return 'studio';
    // /app/apps → the published-apps directory (consumer gallery). Must be
    // matched BEFORE the /app/apps/:id run view so the bare path resolves here.
    if (pathname === '/app/apps' || pathname === '/app/apps/') return 'apps';
    // /app/apps/:id → standalone App Studio run view (end users open a
    // published app without the Studio shell). The editor lives at
    // /app/studio/apps.
    if (pathname.startsWith('/app/apps/')) return 'appRun';
    // /app/meeting-notes → unified Studio (Meeting Notes tab)
    if (pathname === '/app/meeting-notes' || pathname.startsWith('/app/meeting-notes/')) return 'studio';

    // /app/a/:shortId or /app/agent/:id → agents page
    if (pathname.startsWith('/app/a/') || pathname.startsWith('/app/agent/')) return 'agents';
    // /app/d/:convId → direct chat
    if (pathname.startsWith('/app/d/')) return 'agents';
    // Legacy bare paths (backward compat)
    if (pathname.startsWith('/a/') || pathname.startsWith('/agent/')) return 'agents';
    if (pathname.startsWith('/d/')) return 'agents';
    // /app/* catch-all → agents
    if (pathname.startsWith('/app/')) return 'agents';
    // Legacy ?page= param support (backward compat)
    const params = new URLSearchParams(window.location.search);
    const legacyPage = params.get('page');
    if (legacyPage && PAGE_ROUTES[legacyPage]) return legacyPage;
    // Default — redirect everything to app
    return 'agents';
}

// Parse /app/admin/{seg1}/{seg2}/{seg3} from the URL
function parseAdminPath(pathname) {
    const match = pathname.match(/^\/(?:app\/)?admin(?:\/([^/]+))?(?:\/([^/]+))?(?:\/([^/]+))?/);
    return {
        seg1: match?.[1] || '',
        seg2: match?.[2] || '',
        seg3: match?.[3] || '',
    };
}

// Parse /app/org-settings/{seg1}/{seg2} from the URL
function parseOrgSettingsPath(pathname) {
    const match = pathname.match(/^\/(?:app\/)?org-settings(?:\/([^/]+))?(?:\/([^/]+))?/);
    return {
        seg1: match?.[1] || '',
        seg2: match?.[2] || '',
    };
}

// Parse the agent id out of /app/agent-designer/{agentId} (trailing segments ignored).
function parseAgentDesignerUrl(pathname) {
    const match = pathname.match(/^\/app\/agent-designer(?:-advanced)?(?:\/([^/]+))?/);
    return match?.[1] || null;
}

// parseStudioUrl (parsing /app/studio/* + legacy /app/webpages, /app/meeting-notes)
// now lives in ./components/admin/Studio/studioRoutes.js, derived from the
// Studio app registry.

// Parse the task id out of /app/routines/{taskId} or legacy /app/ai-tasks/{taskId}.
// Trailing segments ignored.
function parseAITasksUrl(pathname) {
    const match = pathname.match(/^\/app\/(?:routines|ai-tasks)(?:\/([^/]+))?/);
    return match?.[1] || null;
}

// Extract the cowork id from /app/cowork/:id, plus the two legacy shapes it
// used to live at: /app/work/:id and the Studio tab /app/studio/cowork/:id.
function parseCoworkUrl(pathname) {
    const match = pathname.match(/^\/app\/(?:studio\/cowork|cowork|work)(?:\/([^/]+))?/);
    return match?.[1] || null;
}

// Extract agent ID prefix and conversation ID prefix from URL
// Supports: /app/a/:shortId, /app/a/:shortId/:shortConvId, /app/agent/:fullId, and legacy bare forms
function parseAgentUrl(pathname) {
    const match = pathname.match(/^\/(?:app\/)?(?:a|agent)\/([a-zA-Z0-9_-]+)(?:\/([a-zA-Z0-9_-]+))?/);
    if (match) {
        return { agentId: match[1], conversationId: match[2] || null };
    }
    return { agentId: null, conversationId: null };
}

// Extract direct chat conversation ID from URL: /app/d/:shortConvId (legacy: /d/:shortConvId)
function parseDirectChatUrl(pathname) {
    const match = pathname.match(/^\/(?:app\/)?d\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
}

// Extract notebook ID from URL: /app/notebooks/:id
function parseNotebookUrl(pathname) {
    const match = pathname.match(/^\/app\/notebooks\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
}

// A Studio app opened from its own Nextcloud app-menu entry. The connector's
// per-entry page script (nextcloud-connector/src/studioAppMenus.js) mounts the
// SPA iframe at the signed-proxy ROOT with `?ncStudioApp=<appId>` — inside
// Nextcloud the pathname is the proxy path and never matches /app/apps/:id,
// so the boot route comes from this query param instead.
function parseNcStudioAppParam() {
    try {
        const id = new URLSearchParams(window.location.search).get('ncStudioApp');
        // App ids are UUIDs; refuse anything else so a mangled param falls
        // back to the normal home screen instead of a broken run view.
        return (id && /^[0-9a-f-]{36}$/i.test(id)) ? id : null;
    } catch (_) {
        return null;
    }
}

// Reserved top-level paths + CMS slug routing rules live in
// utils/cmsPublicRouting.js (shared with the CMS editor's slug warnings).

// The authenticated app, wrapped in its capability/licence providers.
// EntitlementsProvider wraps LicenseProvider so LicenseContext.hasFeature can
// delegate to the unified resolver snapshot (the same one the API's
// requireCapability enforces) — page-render and API-allow can no longer diverge.
//
// MUST be used everywhere <App/> is rendered. There are two entry paths:
//   • /app and other reserved paths → AppRoot renders this directly.
//   • "/" and single-segment paths → RootPathGate renders this on fall-through.
// SSO/OAuth lands on "/" (the origin), which RootPathGate rewrites to /app
// WITHOUT a reload, so AppRoot's branch never runs for that navigation. A bare
// <App/> there left useLicenseContext/useEntitlements on their defaults
// (deploymentMode='cloud', hasFeature => false), hiding self-hosted branding and
// every capability-gated sidebar item (Notebooks, etc.) until a manual refresh
// of /app re-entered the provider-wrapped branch.
function AuthedApp() {
    /* One boundary for the whole authenticated tree. `App` has a dozen early
       returns (login, MFA, encryption setup, Nextcloud onboarding, AgentHub),
       every one of which now resolves a lazy chunk — wrapping here covers all
       of them without a Suspense at each site. The fallback is the app's own
       backdrop rather than null, so the handoff from index.html reads as one
       continuous surface instead of a white flash. */
    return (
        <EntitlementsProvider>
            <LicenseProvider>
                <Suspense fallback={<AppBackdrop />}>
                    <App />
                </Suspense>
            </LicenseProvider>
        </EntitlementsProvider>
    );
}
function App() {
    const { t } = useTranslation();
    // Keep --app-height / --keyboard-inset live for the whole app (mounted before
    // any early return so the rules of hooks hold and the vars update on the
    // auth/splash screens too).
    useAppHeight();
    // Drive mobile access control. navigateToPage is a useCallback([]) and can't
    // read this directly, so we mirror it into a ref kept current by an effect.
    const { isMobile } = useViewport();
    const isMobileRef = useRef(isMobile);
    useEffect(() => { isMobileRef.current = isMobile; }, [isMobile]);
    const [currentPage, setCurrentPage] = useState(() => (
        // Opened from a Nextcloud app-menu entry → boot straight into the
        // app's own run view (the proxy-root pathname can't express it).
        parseNcStudioAppParam() ? 'appRun' : pageFromPath(window.location.pathname)
    ));
    const [adminPath, setAdminPath] = useState(() => parseAdminPath(window.location.pathname));
    const [orgSettingsPath, setOrgSettingsPath] = useState(() => parseOrgSettingsPath(window.location.pathname));
    const [initialNotebookId, setInitialNotebookId] = useState(() => parseNotebookUrl(window.location.pathname));
    const [initialCoworkId, setInitialCoworkId] = useState(() => parseCoworkUrl(window.location.pathname));
    const [user, setUser] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    // Keep scopedStorage pinned to the current user. When user logs out the
    // scope clears — subsequent reads return null until the next login. On
    // login, existing legacy global keys are migrated lazily on first read.
    const _prevIdentityRef = useRef(null);
    // A `?plan=<id>` deep link from the pricing page has to be captured before
    // the sign-in redirect throws the query string away. Stored for the session
    // and consumed once the billing surface renders.
    useEffect(() => { capturePendingPlanFromUrl(); }, []);

    useEffect(() => {
        scopedStorage.setCurrentUser(user?.id || null);
        // Reset all cached server data when the IDENTITY (user + active org)
        // changes from one signed-in identity to a DIFFERENT one — an account
        // switch or org switch that doesn't go through handleLogout. React Query
        // keys are not tenant-scoped, so stale lists from the previous identity
        // must not bleed through. Skip the initial null→X set and benign profile
        // patches (same identity). Logout (X→null) is handled in handleLogout.
        const identity = identityKey(user);
        if (shouldResetCache(_prevIdentityRef.current, identity)) queryClient.clear();
        _prevIdentityRef.current = identity;
    }, [user?.id, user?.organizationId, user?.orgId]);

    const [isLoading, setIsLoading] = useState(true);
    const [deploymentMode, setDeploymentMode] = useState('cloud');
    const [orgLogo, setOrgLogo] = useState(null);
    const [serverAvailable, setServerAvailable] = useState(null); // null=unknown, true=ok, false=down
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [showAgentDesigner, setShowAgentDesigner] = useState(() => pageFromPath(window.location.pathname) === 'agentDesigner');
    const [showAgentWizard, setShowAgentWizard] = useState(() => pageFromPath(window.location.pathname) === 'agentWizard');
    const [showStudio, setShowStudio] = useState(() => pageFromPath(window.location.pathname) === 'studio');
    // Path = which routine; query = what of it is open (?view/run/step), so a
    // run deep-link survives a cold load.
    const [studioRoute, setStudioRoute] = useState(() => ({
        ...parseStudioUrl(window.location.pathname),
        ...parseStudioQuery(window.location.search),
    }));
    const [initialDesignerAgentId, setInitialDesignerAgentId] = useState(() => parseAgentDesignerUrl(window.location.pathname));
    const [showAITasks, setShowAITasks] = useState(() => pageFromPath(window.location.pathname) === 'aiTasks');
    const [initialAITaskId, setInitialAITaskId] = useState(() => parseAITasksUrl(window.location.pathname));
    // Standalone published-app run view (/app/apps/:id). The id is re-derived
    // from the URL at render time; this state exists so an in-app 'apps/<id>'
    // navigation re-renders even when currentPage is already 'appRun' (the
    // sidebar lists published apps, so app→app switches are one click now).
    const [appRunId, setAppRunId] = useState(() => {
        const m = window.location.pathname.match(/^\/app\/apps\/([^/]+)/);
        // The Nextcloud app-menu embed carries the id in ?ncStudioApp instead
        // of the pathname (see parseNcStudioAppParam).
        return m ? m[1] : parseNcStudioAppParam();
    });
    // Settings panel is rendered inline inside AgentHub when showSettings is true.
    // Keep it in sync with the URL so /app/settings/* on hard-refresh opens the panel
    // and the browser's back/forward buttons toggle it.
    const [showSettings, setShowSettings] = useState(() => pageFromPath(window.location.pathname) === 'settings');
    const [showSkillsPanel, setShowSkillsPanel] = useState(false);
    // Notebooks panel is rendered inline inside AgentHub (same pattern as
    // showSettings / showAgentDesigner) so the left sidebar stays visible.
    // Hard-refreshes on /app/notebooks and /app/notebooks/:id still land the
    // user on the notebook via `initialNotebookId` parsed by pageFromPath.
    const [showNotebooks, setShowNotebooks] = useState(() => pageFromPath(window.location.pathname) === 'notebooks');
    // Projects route state. `showProjects` distinguishes "on a projects page"
    // from "not"; `initialProjectRoute.projectId` distinguishes the list from a
    // specific project, so /app/projects and /app/projects/:id are separate
    // destinations rather than one view that only appears after closing another.
    const [showProjects, setShowProjects] = useState(() => pageFromPath(window.location.pathname) === 'projects');
    const [initialProjectRoute, setInitialProjectRoute] = useState(() => parseProjectUrl(window.location.pathname));
    const [encryptionState, setEncryptionState] = useState(null); // null | 'setup' | 'pin' | { recoveryKey: string }
    const [noOrganization, setNoOrganization] = useState(false);
    const [pendingApproval, setPendingApproval] = useState(false);
    // Forced TOTP enrollment for username/password accounts (admin-required).
    const [mfaSetupRequired, setMfaSetupRequired] = useState(false);
    // NC App Store onboarding gate: 'admin' renders the 4-step wizard,
    // 'pending' shows the "Setup in progress" screen, null lets the SPA
    // mount normally.
    const [ncOnboardingState, setNcOnboardingState] = useState(null);
    const [ncOrgName, setNcOrgName] = useState(null);
    // Pending NC connector binding awaiting org-admin confirmation. When
    // present (and user is org_admin), <NcBindingApprovalModal/> takes
    // precedence over the onboarding wizard.
    const [pendingNcBinding, setPendingNcBinding] = useState(null);
    // Connector-side bootstrap diagnostics, fetched from /setup/diagnostics
    // when the main SaaS calls fail. Surfaces categorised remediation
    // ("set BEEFLOW_NC_PUBLIC_URL", "SaaS unreachable", …) in the error
    // overlay so admins know what to fix instead of staring at a generic
    // retry button. Admin-only data — see info.xml route gating.
    const [bootstrapDiagnostics, setBootstrapDiagnostics] = useState(null);
    const profileMenuRef = useRef(null);

    // Parse initial agent/conversation from URL
    const initialUrlRef = useRef(parseAgentUrl(window.location.pathname));
    const initialDirectConvRef = useRef(parseDirectChatUrl(window.location.pathname));

    // Apply the authenticated session from the authoritative /auth/user +
    // /auth/my-permissions responses. Shared by checkAuth (page refresh) and
    // handleLogin (in-app login) so BOTH paths populate identical state —
    // featureFlags, org branding, capability gates, encryption/MFA/NC
    // gates. Previously handleLogin built a thin `user` from the login response
    // (no featureFlags, no fresh org) and skipped these gates, so the sidebar
    // and branding showed a stale subset until the next full page refresh.
    const applyAuthSession = useCallback((data, permsData) => {
        // Deployment mode (drives self-hosted white-label branding)
        if (data.featureFlags?.deploymentMode) {
            setDeploymentMode(data.featureFlags.deploymentMode);
        }
        // Post-auth org branding overrides the pre-auth guess
        if (data.organization?.logo) {
            setOrgLogo(`${API_BASE}${data.organization.logo}`);
        }
        // SSO encryption setup needs (only if encryption is enabled)
        if (data.encryptionEnabled !== false) {
            if (data.needsEncryptionSetup) setEncryptionState('setup');
            else if (data.needsEncryptionPin) setEncryptionState('pin');
        }
        if (data.noOrganization) setNoOrganization(true);
        if (data.pendingApproval) setPendingApproval(true);
        // Forced MFA enrollment (live from server; self-clears on enrol)
        setMfaSetupRequired(!!data.mfaSetupRequired);
        // NC App Store onboarding wizard gate
        if (data.ncOnboardingNeeded) setNcOnboardingState('admin');
        else if (data.ncOnboardingPending) setNcOnboardingState('pending');
        else setNcOnboardingState(null);
        if (data.organizationName) setNcOrgName(data.organizationName);
        setPendingNcBinding(data.pendingNcBinding || null);

        const permissions = permsData?.permissions || [];
        const userGroups = permsData?.groups || [];
        const userOrgs = permsData?.organizations || [];
        const allowedAgentTypes = permsData?.allowedAgentTypes || [];
        const betaFeatures = permsData?.betaFeatures || [];
        const canUseFeature = permsData?.canUseFeature || {};
        const canManageUsers = permissions.includes('all') || permissions.includes('manage_users');
        setUser({ ...data.user, permissions, groups: userGroups, organizations: userOrgs, allowedAgentTypes, betaFeatures, canUseFeature, featureFlags: data.featureFlags || {}, enabledIntegrations: data.enabledIntegrations || null, canManageUsers: canManageUsers || data.user.isAdmin, encryptionEnabled: data.encryptionEnabled !== false, isConsumerAccount: !!data.isConsumerAccount, ncOrg: data.ncOrg || null, organization: data.organization || null });
        setIsAuthenticated(true);
    }, []);

    // Check auth status on mount
    useEffect(() => {
        const checkAuth = async () => {
            // Ask the connector why we have no session. Drives the in-app
            // email-verification screen; connector-owned route, so it 404s
            // harmlessly in standalone (non-embedded) mode. Admin-only — non-
            // admins get 401/403 and fall back to the bare login form, which
            // is fine (they couldn't complete the pairing anyway).
            const probeBootstrapDiagnostics = async () => {
                try {
                    const diagRes = await authFetch(`${API_BASE}/setup/diagnostics`, { cache: 'no-store' });
                    if (diagRes.ok) setBootstrapDiagnostics(await diagRes.json());
                } catch (_) { /* not embedded / connector unreachable */ }
            };
            try {
                // Fetch deployment mode from setup-status (available without auth)
                try {
                    const setupRes = await authFetch(`${API_BASE}/auth/setup-status`);
                    if (setupRes.ok) {
                        const setupData = await setupRes.json();
                        if (setupData.deploymentMode) {
                            setDeploymentMode(setupData.deploymentMode);
                        }
                        if (setupData.branding?.logo) {
                            setOrgLogo(`${API_BASE}${setupData.branding.logo}`);
                        }
                        setServerAvailable(true);
                    } else {
                        setServerAvailable(true); // server responded, even if not OK
                    }
                } catch (_) {
                    // Network error — the SaaS-backed setup-status call
                    // failed. The connector itself may still be reachable;
                    // ask it for categorised bootstrap diagnostics so the
                    // overlay can show actionable remediation instead of
                    // a generic retry button. Admin-only endpoint — non-
                    // admins get a 401/403 and fall back to the bare
                    // overlay, which is fine (they couldn't fix it anyway).
                    setServerAvailable(false);
                    await probeBootstrapDiagnostics();
                    setIsLoading(false);
                    return;
                }

                // cache: 'no-store' avoids stale auth state after the NC
                // onboarding wizard flips ncOnboardingNeeded server-side
                // — browsers may otherwise serve a cached "needed=true"
                // response on subsequent refreshes.
                const res = await authFetch(`${API_BASE}/auth/user`, { cache: 'no-store' });
                if (res.ok) {
                    const data = await res.json();
                    if (data.authenticated && data.user) {
                        logger.debug('[NcOnboarding] /auth/user flags:', {
                            needed: data.ncOnboardingNeeded,
                            pending: data.ncOnboardingPending,
                            isOrgAdmin: data.isOrgAdmin,
                            orgName: data.organizationName,
                        });
                        // Fetch dynamic permissions, then apply the full session
                        // through the shared applier so refresh and login populate
                        // identical state.
                        const permsRes = await authFetch(`${API_BASE}/auth/my-permissions`);
                        const permsData = permsRes.ok ? await permsRes.json() : null;
                        applyAuthSession(data, permsData);
                    } else {
                        // Not authenticated. In the embedded connector this can
                        // mean bootstrap hasn't finished (no tenant key yet) —
                        // ask the connector for diagnostics so we can show the
                        // in-app email-verification screen instead of a dead
                        // login form.
                        await probeBootstrapDiagnostics();
                    }
                } else {
                    // Non-OK, non-throwing: until bootstrap completes, the
                    // embedded connector answers every SaaS-bound call with
                    // 502 "Tenant key not configured". fetch() doesn't throw on
                    // that, so the catch above never fired, and it isn't a 200
                    // either, so the branch above never ran — the pairing
                    // screen was unreachable and the admin got a dead login
                    // form on the one screen that could have fixed it.
                    await probeBootstrapDiagnostics();
                }
            } catch (err) {
                console.error('Auth check failed:', err);
            } finally {
                setIsLoading(false);
            }
        };
        checkAuth();
    }, [applyAuthSession]);

    // Handle browser back/forward
    useEffect(() => {
        const handlePopState = () => {
            const page = pageFromPath(window.location.pathname);
            setCurrentPage(page);
            setAdminPath(parseAdminPath(window.location.pathname));
            setOrgSettingsPath(parseOrgSettingsPath(window.location.pathname));
            setInitialNotebookId(parseNotebookUrl(window.location.pathname));
            if (page === 'cowork') setInitialCoworkId(parseCoworkUrl(window.location.pathname));
            // Sync inline-rendered panels with the URL so back/forward opens or closes them.
            setShowSettings(page === 'settings');
            const isDesigner = page === 'agentDesigner';
            setShowAgentDesigner(isDesigner);
            setShowAgentWizard(page === 'agentWizard');
            const isStudio = page === 'studio';
            setShowStudio(isStudio);
            if (isStudio) setStudioRoute({ ...parseStudioUrl(window.location.pathname), ...parseStudioQuery(window.location.search) });
            if (isDesigner) setInitialDesignerAgentId(parseAgentDesignerUrl(window.location.pathname));
            const isAITasks = page === 'aiTasks';
            setShowAITasks(isAITasks);
            if (isAITasks) setInitialAITaskId(parseAITasksUrl(window.location.pathname));
            setShowNotebooks(page === 'notebooks');
            // Back/forward now moves between the project list and individual
            // projects, which it could not do while this was local state.
            const isProjects = page === 'projects';
            setShowProjects(isProjects);
            setInitialProjectRoute(isProjects ? parseProjectUrl(window.location.pathname) : null);
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    // On first load, redirect legacy ?page= URLs to clean paths
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const legacyPage = params.get('page');
        if (legacyPage && PAGE_ROUTES[legacyPage] && window.location.pathname === '/') {
            window.history.replaceState({}, '', PAGE_ROUTES[legacyPage]);
        }
    }, []);

    const navigateToPage = useCallback((page, { replace = false } = {}) => {
        // Mobile access control: on phones, any destination that isn't chat or
        // user-settings bounces to the app home. Belt-and-suspenders with
        // MobileRouteGuard (which catches deep-links/refresh + resize). Close
        // every overlay so a panel that was already open doesn't linger.
        if (isMobileRef.current && !isPageAllowedOnMobile(mobilePageKey(page))) {
            setShowStudio(false);
            setShowSettings(false);
            setShowAgentDesigner(false);
            setShowAgentWizard(false);
            setShowAITasks(false);
            setShowSkillsPanel(false);
            setShowNotebooks(false);
            setShowProfileMenu(false);
            setCurrentPage('agents');
            if (window.location.pathname !== '/app') {
                window.history.pushState({ page: 'agents' }, '', '/app');
            }
            return;
        }
        // Root / home → redirect to /app
        if (page === '/' || page === 'home') {
            setCurrentPage('agents');
            window.history.pushState({}, '', '/app');
            return;
        }
        // Legacy Agent Designer (advanced form) — guardrails, embed, bubble widget, sharing
        if (page === 'agentDesignerAdvanced' || page.startsWith('agentDesignerAdvanced:')) {
            const agentId = page.includes(':') ? page.split(':')[1] : null;
            setInitialDesignerAgentId(agentId);
            const path = agentId ? `/app/agent-designer-advanced/${agentId}` : '/app/agent-designer-advanced';
            if (window.location.pathname !== path) {
                window.history.pushState({ page: 'agentDesignerAdvanced' }, '', path);
            }
            setCurrentPage('agentDesignerAdvanced');
            return;
        }
        // Unified Studio — Agents / Skills / Routines / Knowledge Bases under one shell.
        // Accepts: 'studio', 'studio/agents', 'studio/skills', 'studio/routines', 'studio/knowledge',
        // and 'studio/<section>/<id>' for deep links. 'studio/ai-tasks' kept as legacy alias.
        if (page === 'studio' || page.startsWith('studio/') || page.startsWith('studio:')) {
            // Split off the query FIRST — ?view/run/step is builder state and
            // must not be chopped up by the path split below.
            const qIndex = page.indexOf('?');
            const pagePath = qIndex >= 0 ? page.slice(0, qIndex) : page;
            const search = qIndex >= 0 ? page.slice(qIndex) : '';
            // Normalise: 'studio:agents:<id>' or 'studio/agents/<id>'.
            const raw = pagePath.replace(/^studio[/:]?/, '');
            const parts = raw.split(/[/:]/).filter(Boolean);
            const sectionRaw = parts[0] || 'agents';
            let id = parts[1] || null;
            // Third segment — currently only Routines uses it, to address a
            // flowlet (layer) inside an automation: studio/routines/<id>/<flowlet>.
            let sub = parts[2] || null;
            // Reserved routines "steps" segment — same rule as parseStudioUrl.
            // In-app navigation used to drop it, so a Reusable-Step deep link
            // mis-resolved to an automation named "steps".
            let routineKind = null;
            if ((sectionRaw === 'automations' || sectionRaw === 'routines' || sectionRaw === 'ai-tasks') && id === 'steps') {
                routineKind = 'step';
                id = parts[2] || null;
                sub = parts[3] || null;
            }
            const section = sectionFromRaw(sectionRaw);
            const pathSegment = segmentForSection(section);
            const stepsSeg = routineKind === 'step' ? '/steps' : '';
            const basePath = id
                ? (sub ? `/app/studio/${pathSegment}${stepsSeg}/${id}/${sub}` : `/app/studio/${pathSegment}${stepsSeg}/${id}`)
                : `/app/studio/${pathSegment}`;
            const query = parseStudioQuery(search);
            setStudioRoute({ section, id, sub, routineKind, ...query });
            setShowStudio(true);
            setShowAgentDesigner(false);
            setShowAgentWizard(false);
            setShowSettings(false);
            setShowSkillsPanel(false);
            setShowAITasks(false);
            setShowNotebooks(false);
            // Compare pathname + search — Editor→Runs inside one routine
            // changes only the query, and comparing the pathname alone meant
            // that transition never wrote the URL at all.
            if (window.location.pathname + window.location.search !== basePath + search) {
                // `beeflowRunOpen` lets the runs panel prefer history.back()
                // when closing a run IT pushed, so Back stays symmetric.
                const state = { page: 'studio', beeflowRunOpen: query.runId || null };
                if (replace) window.history.replaceState(state, '', basePath + search);
                else window.history.pushState(state, '', basePath + search);
            }
            setCurrentPage('studio');
            return;
        }
        // Agent Wizard — full-page guided creation flow
        if (page === 'agentWizard') {
            setShowAgentWizard(true);
            setShowAgentDesigner(false);
            setShowSettings(false);
            setShowSkillsPanel(false);
            setShowAITasks(false);
            setShowStudio(false);
            if (window.location.pathname !== '/app/agent-wizard') {
                window.history.pushState({ page: 'agentWizard' }, '', '/app/agent-wizard');
            }
            setCurrentPage('agentWizard');
            return;
        }
        // Agent Designer renders inline in conversation area
        if (page === 'agentDesigner' || page.startsWith('agentDesigner:')) {
            const agentId = page.includes(':') ? page.split(':')[1] : null;
            setInitialDesignerAgentId(agentId);
            setShowAgentDesigner(true);
            setShowSettings(false);
            setShowSkillsPanel(false);
            setShowAITasks(false);
            setShowStudio(false);
            // Push the URL so /app/agent-designer[/{id}] is bookmarkable.
            const path = agentId ? `/app/agent-designer/${agentId}` : '/app/agent-designer';
            if (window.location.pathname !== path) {
                window.history.pushState({ page: 'agentDesigner' }, '', path);
            }
            setCurrentPage('agentDesigner');
            return;
        }
        // AI Tasks renders inline in conversation area (same slot as Agent Designer)
        if (page === 'aiTasks' || page.startsWith('aiTasks:')) {
            const taskId = page.includes(':') ? page.split(':')[1] : null;
            setInitialAITaskId(taskId);
            setShowAITasks(true);
            setShowSettings(false);
            setShowAgentDesigner(false);
            setShowSkillsPanel(false);
            setShowNotebooks(false);
            setShowStudio(false);
            const path = taskId ? `/app/routines/${taskId}` : '/app/routines';
            if (window.location.pathname !== path) {
                window.history.pushState({ page: 'aiTasks' }, '', path);
            }
            setCurrentPage('aiTasks');
            return;
        }
        // /app/billing is a stable, account-type-agnostic entry point for the
        // billing surface — the address the pricing page and every in-app
        // upgrade CTA can link to without knowing whether the visitor ends up
        // with a personal or an organisation account. It resolves to the
        // matching settings tab, which is where the plan UI actually lives.
        if (page === 'billing') {
            const target = user?.isConsumerAccount
                ? 'settings/account/license'
                : 'settings/organisation/license';
            navigateToPage(target);
            return;
        }
        // Settings renders inline in conversation area
        if (page === 'settings' || page.startsWith('settings/')) {
            setShowSettings(true);
            setShowAgentDesigner(false);
            setShowSkillsPanel(false);
            setShowAITasks(false);
            setShowStudio(false);
            // Push the URL so the settings panel is bookmarkable / back-button aware.
            // Sub-path (e.g. 'settings/memory') is preserved as `/app/settings/memory`.
            const subPath = page === 'settings' ? '' : page.slice('settings'.length);
            const path = '/app/settings' + subPath;
            if (window.location.pathname !== path) {
                window.history.pushState({ page: 'settings' }, '', path);
            }
            setCurrentPage('settings');
            return;
        }
        // Skills panel renders inline in conversation area
        if (page === 'skills') {
            setShowSkillsPanel(true);
            setShowSettings(false);
            setShowAgentDesigner(false);
            setShowAITasks(false);
            setShowStudio(false);
            return;
        }
        // Support admin sub-paths like 'admin/ai-config' or 'admin/security/sso'
        if (page.startsWith('admin')) {
            const subPath = page === 'admin' ? '' : page.slice('admin'.length); // e.g. '/ai-config'
            const path = '/app/admin' + subPath;
            setCurrentPage('admin');
            setAdminPath(parseAdminPath(path));
            setShowProfileMenu(false);
            setShowStudio(false);
            window.history.pushState({ page: 'admin' }, '', path);
            return;
        }
        // Support org-settings sub-paths like 'org-settings/agents'
        if (page === 'orgSettings' || page.startsWith('org-settings')) {
            const subPage = page === 'orgSettings' ? 'org-settings' : page;
            const path = '/app/' + subPage;
            setCurrentPage('orgSettings');
            setOrgSettingsPath(parseOrgSettingsPath(path));
            setShowStudio(false);
            setShowProfileMenu(false);
            window.history.pushState({ page: 'orgSettings' }, '', path);
            return;
        }
        // Notebooks — rendered inline inside AgentHub (same pattern as
        // settings / agent designer). Bare 'notebooks' → list view; the
        // 'notebooks/:id' form deep-links directly to a specific notebook.
        if (page === 'notebooks' || page.startsWith('notebooks/')) {
            const notebookId = page.startsWith('notebooks/') ? page.slice('notebooks/'.length) : null;
            setInitialNotebookId(notebookId);
            setShowNotebooks(true);
            setShowSettings(false);
            setShowAgentDesigner(false);
            setShowSkillsPanel(false);
            setShowAITasks(false);
            setShowStudio(false);
            setCurrentPage('notebooks');
            setShowProfileMenu(false);
            const path = notebookId ? `/app/notebooks/${notebookId}` : '/app/notebooks';
            if (window.location.pathname !== path) {
                window.history.pushState({ page: 'notebooks', notebookId }, '', path);
            }
            return;
        }
        // Cowork — a top-level page with a selectable detail pane. Bare
        // 'cowork' → the list with the welcome pane; 'cowork/:id' deep-links a
        // single item, which is what selecting a row and what a run
        // notification's link both produce.
        if (page === 'cowork' || page.startsWith('cowork/')) {
            const coworkId = page.startsWith('cowork/') ? page.slice('cowork/'.length) : null;
            setInitialCoworkId(coworkId);
            setShowStudio(false);
            setShowNotebooks(false);
            setShowSettings(false);
            setShowAgentDesigner(false);
            setShowSkillsPanel(false);
            setShowAITasks(false);
            setCurrentPage('cowork');
            setShowProfileMenu(false);
            const path = coworkId ? `/app/cowork/${coworkId}` : '/app/cowork';
            if (window.location.pathname !== path) {
                // Selecting a row is a filter, not a destination — replacing
                // keeps Back meaning "leave Cowork" rather than walking the
                // user through every item they clicked.
                const state = { page: 'cowork', coworkId };
                if (replace || coworkId) window.history.replaceState(state, '', path);
                else window.history.pushState(state, '', path);
            }
            return;
        }
        // Published-app run view — 'apps/<id>' opens /app/apps/<id> (page key
        // 'appRun'). Bare 'apps' (the directory) falls through to the generic
        // branch below like any other top-level page.
        if (page.startsWith('apps/')) {
            const appId = page.slice('apps/'.length);
            setAppRunId(appId);
            setShowStudio(false);
            setShowNotebooks(false);
            setShowSettings(false);
            setShowAgentDesigner(false);
            setShowAgentWizard(false);
            setShowAITasks(false);
            setShowSkillsPanel(false);
            setShowProfileMenu(false);
            const path = `/app/apps/${appId}`;
            if (window.location.pathname !== path) {
                window.history.pushState({ page: 'appRun' }, '', path);
            }
            setCurrentPage('appRun');
            return;
        }
        // Webpages — now lives inside Studio under /app/studio/webpages.
        // Legacy 'webpages' / 'webpages/<id>' navigations are rerouted so the
        // sidebar entry and any old deep links land in the unified shell.
        if (page === 'webpages' || page.startsWith('webpages/')) {
            const webpageId = page.startsWith('webpages/') ? page.slice('webpages/'.length) : null;
            setStudioRoute({ section: 'webpages', id: webpageId });
            setShowStudio(true);
            setShowNotebooks(false);
            setShowSettings(false);
            setShowAgentDesigner(false);
            setShowSkillsPanel(false);
            setShowAITasks(false);
            const path = webpageId ? `/app/studio/webpages/${webpageId}` : '/app/studio/webpages';
            if (window.location.pathname !== path) {
                window.history.pushState({ page: 'studio' }, '', path);
            }
            setCurrentPage('studio');
            setShowProfileMenu(false);
            return;
        }
        setCurrentPage(page);
        setShowProfileMenu(false);
        // Landing on a top-level page (agents/home, admin, …) closes any open
        // overlay panel. Without this, an overlay flag initialised from a deep
        // link (e.g. showAgentDesigner from /app/agent-designer) would keep the
        // panel mounted after a redirect to /app — notably the MobileRouteGuard
        // bounce on phones.
        setShowStudio(false);
        setShowSettings(false);
        setShowAgentDesigner(false);
        setShowAgentWizard(false);
        setShowAITasks(false);
        setShowSkillsPanel(false);
        setShowNotebooks(false);
        const path = PAGE_ROUTES[page] || '/';
        window.history.pushState({ page }, '', path);
    }, []);

    // Tell the (above-auth-boundary) EntitlementsProvider to re-resolve whenever
    // auth flips — login/logout/bootstrap all run through setIsAuthenticated, so
    // one effect keyed on it covers every transition. Without this the provider's
    // pre-login snapshot (401 → empty) persists and every capability-gated UI
    // (Studio Webpages tab, etc.) stays hidden after login.
    useEffect(() => {
        window.dispatchEvent(new Event('beeflow:auth-changed'));
    }, [isAuthenticated]);

    // Runtime (remotely-installed) modules add their own Studio sections. On a
    // cold load of a deep link into such a section (e.g. /app/studio/<module>),
    // the runtime map is empty at first parse so parseStudioUrl falls back to
    // 'agents'. Re-parse once the module descriptors arrive so the correct tab
    // renders without a manual refresh. Only touches state while on /app/studio.
    useEffect(() => {
        const onModulesChanged = () => {
            if (pageFromPath(window.location.pathname) === 'studio') {
                setStudioRoute({ ...parseStudioUrl(window.location.pathname), ...parseStudioQuery(window.location.search) });
            }
        };
        window.addEventListener('beeflow:modules-changed', onModulesChanged);
        return () => window.removeEventListener('beeflow:modules-changed', onModulesChanged);
    }, []);

    const handleLogin = async (userData, recoveryKey) => {
        // Hydrate from /auth/user + /auth/my-permissions exactly like a page
        // refresh (checkAuth) via the shared applier, so the sidebar, org
        // branding, feature flags and capability gates reflect the user's real
        // permissions immediately. The thin login response (`userData`) lacks
        // the freshly-computed featureFlags / org / capability data, which is
        // why login previously showed a stale subset until a manual refresh.
        try {
            const userRes = await authFetch(`${API_BASE}/auth/user`, { cache: 'no-store' });
            const data = userRes.ok ? await userRes.json() : null;
            if (data?.authenticated && data.user) {
                const permsRes = await authFetch(`${API_BASE}/auth/my-permissions`);
                const permsData = permsRes.ok ? await permsRes.json() : null;
                applyAuthSession(data, permsData);
            } else {
                // /auth/user unavailable right after login (rare — the session
                // is already established). Fall back to the thin login payload
                // so the user isn't blocked; a later refresh reconciles.
                setUser(userData);
                setIsAuthenticated(true);
            }
        } catch (err) {
            console.error('Failed to hydrate session after login:', err);
            setUser(userData);
            setIsAuthenticated(true);
        }
        // Reset to main app view after login (currentPage may still be a homepage route)
        setCurrentPage('agents');
        window.history.pushState({ page: 'agents' }, '', '/app');
        // Show recovery key if one was generated (new user or migration).
        // Set last so it takes precedence over any encryption-setup state the
        // applier may have derived from /auth/user.
        if (recoveryKey) {
            setEncryptionState({ recoveryKey });
        }
    };

    const handleLogout = async () => {
        const prevUserId = user?.id || null;
        try {
            await authFetch(`${API_BASE}/auth/logout`, {
                method: 'POST',
            });
        } catch (err) {
            console.error('Logout error:', err);
        }
        // Drop every user-scoped preference so the next login on this browser
        // can't read the previous user's favourites / last-used agent / etc.
        // Device-level keys (theme, locale) are not touched.
        if (prevUserId) scopedStorage.clearUser(prevUserId);
        scopedStorage.setCurrentUser(null);
        // Drop ALL cached server data. React Query keys are not tenant-scoped
        // (e.g. ['agents','list']), so without this a second account logging in
        // on the same browser could read the previous user's cached lists for
        // up to gcTime (5min). clear() removes every query + mutation cache.
        queryClient.clear();
        // Drop the embedded-iframe pickup token so a logged-out iframe doesn't
        // keep replaying it on subsequent requests.
        setSessionToken(null);
        setUser(null);
        setIsAuthenticated(false);
        navigateToPage('agents');
    };

    // Show loading spinner while checking auth
    const useOrgBrand = deploymentMode === 'self-hosted' && !!orgLogo;
    if (isLoading) {
        return (
            <div className="h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
                <div className="flex flex-col items-center gap-4">
                    <img
                        src={useOrgBrand ? orgLogo : beeFlowIcon}
                        alt={useOrgBrand ? 'Organization' : 'Bee Flow'}
                        className={`w-16 h-16 rounded-2xl animate-pulse ${useOrgBrand ? 'object-contain' : 'object-contain'}`}
                    />
                    <p className="text-[var(--text-secondary)] text-sm">{t('app.loading', 'Loading...')}</p>
                </div>
            </div>
        );
    }

    // Server is unreachable — show a clear error instead of the product website
    if (serverAvailable === false) {
        return (
            <div style={{
                height: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--bg-primary)',
                padding: '24px',
            }}>
                <div style={{
                    maxWidth: 420,
                    width: '100%',
                    textAlign: 'center',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 24,
                    padding: '40px 32px',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
                    position: 'relative',
                    overflow: 'hidden',
                }}>
                    <div style={{
                        position: 'absolute', top: 0, left: '10%', right: '10%',
                        height: 1,
                        background: 'linear-gradient(90deg, transparent, var(--border-default), transparent)',
                    }} />
                    <img
                        src={useOrgBrand ? orgLogo : beeFlowIcon}
                        alt={useOrgBrand ? 'Organization' : 'Bee Flow'}
                        style={{
                            width: 64, height: 64, borderRadius: 18, margin: '0 auto 20px',
                            objectFit: 'contain',
                            display: 'block',
                        }}
                    />
                    <div style={{
                        width: 52, height: 52, borderRadius: 14, margin: '0 auto 16px',
                        background: 'rgba(239, 68, 68, 0.1)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <svg width="26" height="26" fill="none" stroke="#ef4444" strokeWidth="1.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                        </svg>
                    </div>
                    <h2 style={{ margin: '0 0 10px', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                        {bootstrapDiagnostics?.state === 'awaiting_admin_approval'
                            ? t('app.bootstrap_pending_title', 'Setup awaiting approval')
                            : bootstrapDiagnostics?.state === 'failed'
                                ? t('app.bootstrap_failed_title', 'Bee Flow setup failed')
                                : t('app.server_unavailable_title', 'Server Unavailable')}
                    </h2>
                    <p style={{ margin: '0 0 20px', fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.65 }}>
                        {bootstrapDiagnostics?.state === 'awaiting_admin_approval'
                            ? t('app.bootstrap_pending_desc', 'A Bee Flow admin needs to approve this Nextcloud as part of an existing organisation. The setup will continue automatically once approved.')
                            : bootstrapDiagnostics?.lastError
                                ? `${bootstrapDiagnostics.lastError.category}: ${bootstrapDiagnostics.lastError.error}`
                                : t('app.server_unavailable_desc', 'Could not connect to the Bee Flow server. Please make sure the server is running and try again.')}
                    </p>
                    {bootstrapDiagnostics?.lastError && (
                        <details style={{
                            margin: '0 0 24px',
                            textAlign: 'left',
                            background: 'var(--bg-primary)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 10,
                            padding: '12px 14px',
                            fontSize: 13,
                            color: 'var(--text-secondary)',
                            lineHeight: 1.6,
                        }}>
                            <summary style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--text-primary)' }}>
                                {t('app.bootstrap_show_remediation', 'How to fix this')}
                            </summary>
                            <p style={{ marginTop: 10, marginBottom: 8 }}>
                                {bootstrapDiagnostics.lastError.remediation || t('app.bootstrap_no_remediation', 'See docs.beeflow.ai/connector/troubleshooting for diagnostic commands.')}
                            </p>
                            {bootstrapDiagnostics.lastError.nextRetryAt && (
                                <p style={{ margin: 0, fontSize: 12, opacity: 0.7 }}>
                                    {t('app.bootstrap_next_retry', 'Next retry')}: {new Date(bootstrapDiagnostics.lastError.nextRetryAt).toLocaleTimeString()}
                                </p>
                            )}
                        </details>
                    )}
                    <button
                        onClick={() => window.location.reload()}
                        style={{
                            width: '100%', padding: '11px 0', borderRadius: 12,
                            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                            color: '#fff', fontWeight: 600, fontSize: 14,
                            border: 'none', cursor: 'pointer',
                            boxShadow: '0 4px 12px rgba(245,158,11,0.3)',
                        }}
                    >
                        {t('app.retry_connection', 'Retry Connection')}
                    </button>
                </div>
            </div>
        );
    }

    // Embedded connector awaiting in-app email verification — show the code
    // screen instead of the login form. The connector has no tenant key yet, so
    // /auth/user reports unauthenticated; the connector's /setup/diagnostics
    // tells us a code was emailed to the org admin.
    if (!isAuthenticated && bootstrapDiagnostics?.state === 'awaiting_email_verification') {
        return <EmailVerificationScreen verification={bootstrapDiagnostics.verification} t={t} />;
    }

    // Not authenticated → show login page directly
    if (!isAuthenticated) {
        return <LoginPage onLogin={handleLogin} />;
    }

    // Show encryption setup/unlock gate for SSO users
    if (encryptionState === 'setup' || encryptionState === 'pin') {
        return (
            <EncryptionSetup
                mode={encryptionState === 'setup' ? 'setup' : 'unlock'}
                onComplete={() => setEncryptionState(null)}
            />
        );
    }

    // Show recovery key after login migration or signup
    if (encryptionState && encryptionState.recoveryKey) {
        return (
            <EncryptionSetup
                mode="recovery"
                recoveryKeyProp={encryptionState.recoveryKey}
                onComplete={() => setEncryptionState(null)}
            />
        );
    }

    // NC connector binding approval — gated before the onboarding wizard.
    // When the connector bootstrap is awaiting an authenticated approval
    // from this org's admin, show the modal first; the wizard takes over
    // afterwards via the next /auth/user refresh.
    if (pendingNcBinding && user && (user.orgRole === 'org_admin' || user.isAdmin)) {
        return (
            <NcBindingApprovalModal
                pending={pendingNcBinding}
                organizationName={ncOrgName}
                onResolved={async () => {
                    // Re-pull /auth/user so the next gate (wizard or app) renders.
                    try {
                        const res = await authFetch(`${API_BASE}/auth/user`, { cache: 'no-store' });
                        if (res.ok) {
                            const data = await res.json();
                            setPendingNcBinding(data.pendingNcBinding || null);
                            if (data.ncOnboardingNeeded) setNcOnboardingState('admin');
                            else if (data.ncOnboardingPending) setNcOnboardingState('pending');
                            else setNcOnboardingState(null);
                            if (data.organizationName) setNcOrgName(data.organizationName);
                        } else {
                            setPendingNcBinding(null);
                        }
                    } catch (_) {
                        setPendingNcBinding(null);
                    }
                }}
            />
        );
    }

    // NC App Store onboarding wizard — admin sees this first time after install
    if (ncOnboardingState === 'admin' && user) {
        return <NcOnboardingWizard user={user} orgName={ncOrgName} deploymentMode={deploymentMode} onComplete={() => setNcOnboardingState(null)} />;
    }
    if (ncOnboardingState === 'pending') {
        return <NcOnboardingPending orgName={ncOrgName} onRefresh={() => window.location.reload()} />;
    }

    // Show no-organisation gate for SSO users without org membership
    // Consumer accounts (org-less by design) bypass this gate
    if (noOrganization && !user?.isConsumerAccount) {
        return (
            <div className="h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(160deg, var(--bg-primary) 0%, var(--bg-secondary) 50%, var(--bg-tertiary) 100%)' }}>
                <div className="w-full max-w-md">
                    <div className="backdrop-blur-xl rounded-3xl p-8 shadow-2xl border relative overflow-hidden text-center" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)' }}>
                        <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-[var(--border-default)] to-transparent" />
                        <div className="w-20 h-20 mx-auto mb-5 rounded-full overflow-hidden shadow-xl ring-4 ring-[var(--border-subtle)]">
                            <img src={beeFlowLogo} alt="Bee Flow" className="w-full h-full object-cover" />
                        </div>
                        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(245, 158, 11, 0.1)' }}>
                            <svg className="w-7 h-7" fill="none" stroke="#f59e0b" viewBox="0 0 24 24" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                            </svg>
                        </div>
                        <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>No Organisation Found</h2>
                        <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                            Your account is not linked to any organisation yet. Please ask your administrator to create an account for you, or sign up with a new organisation.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={handleLogout}
                                className="flex-1 py-2.5 rounded-xl font-medium text-sm border transition-colors hover:bg-[var(--bg-tertiary)]"
                                style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                            >
                                Sign Out
                            </button>
                            <button
                                onClick={() => { handleLogout(); setTimeout(() => { window.location.href = '/?signup=1'; }, 300); }}
                                className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-white"
                                style={{ background: 'var(--accent-primary)' }}
                            >
                                Sign Up Instead
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Show pending approval gate for SSO users awaiting admin approval
    if (pendingApproval) {
        return (
            <div className="h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(160deg, var(--bg-primary) 0%, var(--bg-secondary) 50%, var(--bg-tertiary) 100%)' }}>
                <div className="w-full max-w-md">
                    <div className="backdrop-blur-xl rounded-3xl p-8 shadow-2xl border relative overflow-hidden text-center" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)' }}>
                        <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-[var(--border-default)] to-transparent" />
                        <div className="w-20 h-20 mx-auto mb-5 rounded-full overflow-hidden shadow-xl ring-4 ring-[var(--border-subtle)]">
                            <img src={beeFlowLogo} alt="Bee Flow" className="w-full h-full object-cover" />
                        </div>
                        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(59, 130, 246, 0.1)' }}>
                            <svg className="w-7 h-7" fill="none" stroke="#3b82f6" viewBox="0 0 24 24" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Awaiting Approval</h2>
                        <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                            {user?.isConsumerAccount
                                ? 'Your account has been created and is being reviewed. An administrator will approve your access shortly.'
                                : 'Your account has been created and linked to an organisation, but it needs to be approved by an administrator before you can access the platform.'
                            }
                        </p>
                        <button
                            onClick={handleLogout}
                            className="w-full py-2.5 rounded-xl font-medium text-sm border transition-colors hover:bg-[var(--bg-tertiary)]"
                            style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                        >
                            Sign Out
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Forced MFA enrollment gate — password (non-SSO) accounts must set up
    // two-factor auth before using the app when the admin requires it. The
    // server derives this live, so completing enrollment + re-fetch clears it.
    if (mfaSetupRequired) {
        return (
            <MfaSetupGate
                onLogout={handleLogout}
                onDone={async () => {
                    setMfaSetupRequired(false);
                    try {
                        const res = await authFetch(`${API_BASE}/auth/user`, { cache: 'no-store' });
                        if (res.ok) {
                            const data = await res.json();
                            setMfaSetupRequired(!!data.mfaSetupRequired);
                        }
                    } catch (_) { /* leave cleared */ }
                }}
            />
        );
    }

    // Per-route wrapper — a crash inside one panel surfaces only its own
    // boundary, leaving the rest of the app usable. Each lazy() chunk is
    // also wrapped so a network failure during code-split download falls
    // back to the same UI.
    const routed = (label, node) => (
        <ErrorBoundary label={label}>
            <Suspense fallback={<RouteFallback />}>{node}</Suspense>
        </ErrorBoundary>
    );

    const renderContent = () => {
        if (currentPage === 'admin') {
            return routed('admin', <AdminDashboard user={user} onBack={() => navigateToPage('agents')} adminPath={adminPath} onNavigate={navigateToPage} />);
        }
        if (currentPage === 'orgSettings') {
            return routed('orgSettings', <OrgSettings user={user} onBack={() => navigateToPage('agents')} orgSettingsPath={orgSettingsPath} onNavigate={navigateToPage} />);
        }


        if (currentPage === 'components') {
            return routed('components',
                <RequireTier feature="component_designer" onNavigateToLicense={() => navigateToPage('settings')}>
                    <ComponentBuilder onBack={() => navigateToPage('agents')} />
                </RequireTier>
            );
        }

        if (currentPage === 'apps') {
            // The published-apps directory (consumer gallery at /app/apps).
            // Tiles link to the run view at /app/apps/:id.
            return routed('apps', <AppsHomePage />);
        }

        if (currentPage === 'appRun') {
            // Standalone run view for a published App Studio app. The id comes
            // from the URL (/app/apps/:id); ?draft=1 lets the owner preview the
            // working draft (the server enforces owner-only on that flag).
            const appMatch = window.location.pathname.match(/^\/app\/apps\/([^/]+)/);
            const isDraftPreview = new URLSearchParams(window.location.search).get('draft') === '1';
            return routed('appRun', <AppRunPage appId={appMatch?.[1] || appRunId || null} draft={isDraftPreview} />);
        }

        if (currentPage === 'agentDesignerAdvanced') {
            return routed('agentDesignerAdvanced',
                <AgentDesigner
                    onBack={null}
                    initialAgentId={initialDesignerAgentId}
                    user={user}
                    onClose={() => navigateToPage(initialDesignerAgentId ? `agentDesigner:${initialDesignerAgentId}` : 'agentDesigner')}
                    hasPermission={(perm) => {
                        const perms = user?.permissions || [];
                        return perms.includes('all') || perms.includes(perm);
                    }}
                />
            );
        }



        // Meeting Notes now renders inside Studio (see studio handler above).
        // The legacy `/app/meeting-notes` URL is normalised to the Studio
        // route by pageFromPath() / parseStudioUrl().
        if (currentPage === 'meetingNotes') {
            navigateToPage('studio/meeting-notes');
            return null;
        }
        if (currentPage === 'templates') {
            if (user?.featureFlags?.templates === false) return navigateToPage('agents');
            return routed('templates', <TemplatesPage user={user} onBack={() => navigateToPage('agents')} />);
        }
        // Notebooks used to render as a standalone page here, taking over the
        // whole viewport. It now renders inline inside AgentHub below (same
        // slot as Settings / Agent Designer) so the app sidebar stays visible.

        return <AgentHub onNavigate={navigateToPage} user={user} onUpdateUser={(patch) => setUser(prev => prev ? { ...prev, ...patch } : prev)} initialAgentId={initialUrlRef.current.agentId} initialConversationId={initialUrlRef.current.conversationId} initialDirectConvId={initialDirectConvRef.current} onLogout={handleLogout} currentPage={currentPage} showSettings={showSettings} onCloseSettings={() => {
            setShowSettings(false);
            // Return the URL to the app root when the settings panel closes, so
            // the back button doesn't leave /app/settings stuck in the address bar.
            if (window.location.pathname.startsWith('/app/settings')) {
                setCurrentPage('agents');
                window.history.pushState({ page: 'agents' }, '', '/app');
            }
        }} showAgentDesigner={showAgentDesigner} onCloseAgentDesigner={() => {
            setShowAgentDesigner(false);
            // Return the URL to the app root when the designer closes so /app/agent-designer
            // doesn't stay in the address bar.
            if (window.location.pathname.startsWith('/app/agent-designer')) {
                setCurrentPage('agents');
                window.history.pushState({ page: 'agents' }, '', '/app');
            }
        }} initialDesignerAgentId={initialDesignerAgentId} showAgentWizard={showAgentWizard} onCloseAgentWizard={() => {
            setShowAgentWizard(false);
            if (window.location.pathname.startsWith('/app/agent-wizard')) {
                setCurrentPage('agents');
                window.history.pushState({ page: 'agents' }, '', '/app');
            }
        }} showStudio={showStudio} studioRoute={studioRoute} onCloseStudio={() => {
            setShowStudio(false);
            if (window.location.pathname.startsWith('/app/studio')) {
                setCurrentPage('agents');
                window.history.pushState({ page: 'agents' }, '', '/app');
            }
        }} showAITasks={showAITasks} onCloseAITasks={() => {
            setShowAITasks(false);
            setInitialAITaskId(null);
            if (window.location.pathname.startsWith('/app/routines') || window.location.pathname.startsWith('/app/ai-tasks')) {
                setCurrentPage('agents');
                window.history.pushState({ page: 'agents' }, '', '/app');
            }
        }} initialAITaskId={initialAITaskId} initialCoworkId={initialCoworkId} showProjects={showProjects} initialProjectRoute={initialProjectRoute} onProjectRouteChange={(projectId, tab) => {
            // Drives the URL from the app, so a project view can be linked,
            // bookmarked and reached with the back button. Before this, the
            // active project lived only in AgentHub state and a reload dropped
            // the user back to an empty chat with no way to return.
            // `''` means "open the create form" — keep it distinct from the
            // list (null), or the New Project button navigates nowhere.
            const isCreate = projectId === '';
            const path = projectRoutePath(projectId, tab);
            setInitialProjectRoute({
                projectId: isCreate ? '' : (projectId || null),
                tab: isCreate ? null : (tab || null),
            });
            setShowProjects(true);
            setCurrentPage('projects');
            if (window.location.pathname !== path) {
                // Leaving the create form for the project it just created:
                // replace, so Back doesn't land on a stale empty form.
                const leavingCreate = !isCreate && projectId
                    && window.location.pathname === '/app/projects/new';
                const state = { page: 'projects', projectId };
                if (leavingCreate) window.history.replaceState(state, '', path);
                else window.history.pushState(state, '', path);
            }
        }} onCloseProjects={() => {
            setShowProjects(false);
            setInitialProjectRoute(null);
            if (window.location.pathname.startsWith('/app/projects')) {
                setCurrentPage('agents');
                window.history.pushState({ page: 'agents' }, '', '/app');
            }
        }} showSkillsPanel={showSkillsPanel} onCloseSkillsPanel={() => setShowSkillsPanel(false)} showNotebooks={showNotebooks && user?.featureFlags?.notebooks !== false} initialNotebookId={initialNotebookId} onNotebookChange={(id) => {
            setInitialNotebookId(id);
            const path = id ? `/app/notebooks/${id}` : '/app/notebooks';
            window.history.replaceState({ page: 'notebooks', notebookId: id }, '', path);
        }} onCloseNotebooks={() => {
            setShowNotebooks(false);
            setInitialNotebookId(null);
            // Mirror the Settings / Agent Designer close pattern — rewrite the
            // URL back to the app root so /app/notebooks doesn't linger.
            if (window.location.pathname.startsWith('/app/notebooks')) {
                setCurrentPage('agents');
                window.history.pushState({ page: 'agents' }, '', '/app');
            }
        }} />;
    };

    return (
        <SubscriptionProvider user={user}>
        <RecorderProvider>
        <CaptureProvider>
        <div className="flex flex-col" style={{ height: 'var(--app-height)' }}>

            {/* Deployment warning. Above everything, in the layout flow rather
                than floating: a rollout severs open SSE streams, so an answer
                can stop mid-sentence, and that deserves more weight than a
                dismissible toast. Renders nothing when no window is open, and
                only polls for signed-in users. */}
            {isAuthenticated && <MaintenanceBanner />}

            {/* No-subscription gate: org users without an active plan can
                only reach the License & Usage page so they can subscribe. */}
            {isAuthenticated && (
                <SubscriptionGate
                    user={user}
                    currentPage={currentPage}
                    deploymentMode={deploymentMode}
                    navigateToPage={navigateToPage}
                />
            )}

            {/* Mobile access control: bounce disallowed pages to /app on phones.
                Catches hard deep-links/refresh and viewport resize/rotate (the
                cases navigateToPage's own gate can't see). */}
            {isAuthenticated && (
                <MobileRouteGuard
                    isMobile={isMobile}
                    currentPage={currentPage}
                    navigateToPage={navigateToPage}
                />
            )}

            {/* Content */}
            <div className="flex-1 overflow-hidden">
                {renderContent()}
            </div>

            {/* Pre-flight DLP preview modal — globally mounted, listens for
                `beeflow:dlp_preview` window events emitted by useChatEngine. */}
            {isAuthenticated && <DlpPreviewModal />}

            {/* Global Meeting Notes surfaces — mounted once, available from any page. */}
            {isAuthenticated && <CaptureModal />}
            {isAuthenticated && <MeetingCommandPalette user={user} onNavigate={navigateToPage} />}

            {/* New-user product tour — auto-starts once per new user, replayable
                from Settings → Help & Support. Mounted here so it floats above
                the app shell and can drive navigation via navigateToPage. */}
            {isAuthenticated && <OnboardingTour user={user} onNavigate={navigateToPage} currentPage={currentPage} />}

            {/* Learning Center — focused player for rich (slide/quiz/exercise)
                lessons. Pure-tour lessons are routed back to OnboardingTour. */}
            {isAuthenticated && <LessonPlayerHost user={user} />}

            {/* The floating customer-support drawer was retired — the user-side
                support inbox now lives at /app/settings → Help & Support. */}

            {/* Dropdown animation keyframe */}
            <style>{`
                @keyframes dropdownIn {
                    from { opacity: 0; transform: translateY(-4px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes overlayIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes overlayContentIn {
                    from { opacity: 0; transform: scale(0.97) translateY(8px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }
            `}</style>
            <style>{`
                @keyframes bannerSlideIn {
                    from { transform: translateY(-100%); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            `}</style>



        </div>
        </CaptureProvider>
        </RecorderProvider>
        </SubscriptionProvider>
    );
}

/**
 * Invisible app-shell gate. When the org has no active subscription
 * (status !== 'active' / 'trialing'), force navigate to the License &
 * Usage page so the admin can buy one. Skips for the hardcoded platform
 * operator and for consumer accounts (no orgId).
 */
// Null-rendering guard (same pattern as SubscriptionGate) that enforces the
// mobile allow-list for cases navigateToPage can't intercept: a hard deep-link
// or refresh onto a disallowed URL, and the viewport becoming mobile (resize/
// rotate) while sitting on a disallowed page. Idempotent — once it lands on
// 'agents' the condition is false. Mounted only under isAuthenticated, so it
// never runs for the embed/CMS/legal/pricing routes that return earlier.
function MobileRouteGuard({ isMobile, currentPage, navigateToPage }) {
    useEffect(() => {
        if (isMobile && !MOBILE_ALLOWED_PAGES.has(currentPage)) {
            navigateToPage('agents');
        }
    }, [isMobile, currentPage, navigateToPage]);
    return null;
}

function SubscriptionGate({ user, currentPage, deploymentMode, navigateToPage }) {
    const { hasActiveSub, loading } = useSubscriptionContext();
    const { serverOverride, loading: licLoading } = useLicenseContext();
    const isPlatformOperator = user?.id === 'admin';
    const isConsumer = !(user?.organizationId || user?.orgId);
    const isSelfHosted = deploymentMode === 'self-hosted';

    useEffect(() => {
        // Wait for BOTH the subscription and licence probes before deciding,
        // so a server-licensed install isn't briefly redirected on first load.
        if (loading || licLoading || hasActiveSub) return;
        // A server-wide licence covers the whole install — the licence is
        // authoritative, no Stripe subscription is required (mirrors the
        // backend bypass in server/core/limits.js).
        if (isPlatformOperator || isConsumer || isSelfHosted || serverOverride) return;
        // Already on the License & Usage page (or its loading path) — let
        // it render so the admin can finish the checkout flow. Stripe
        // bounces back to the same URL with `?checkout=success`; allow
        // those query strings too.
        const path = window.location.pathname;
        const onLicensePage = path === '/app/settings/organisation/license'
            || path.startsWith('/app/settings/organisation/license');
        if (onLicensePage) return;
        navigateToPage('settings/organisation/license');
    }, [loading, licLoading, hasActiveSub, isPlatformOperator, isConsumer, isSelfHosted, serverOverride, currentPage, navigateToPage]);

    return null;
}

export default AuthedApp;
