import React, { Suspense, useState, useEffect, useRef, useCallback } from 'react';
import { lazy } from './utils/lazyWithReload';
import AgentHub from './AgentHub';
import LoginPage from './pages/LoginPage';
import EncryptionSetup from './pages/EncryptionSetup';
import EmbedChat from './pages/EmbedChat';
import DlpPreviewModal from './components/DlpPreviewModal';
import ErrorBoundary from './components/ErrorBoundary';
import { LicenseProvider, RequireTier } from './components/LicenseContext';
import { SubscriptionProvider, useSubscriptionContext } from './components/SubscriptionContext';
import NcOnboardingWizard from './components/NcOnboardingWizard';
import NcOnboardingPending from './components/NcOnboardingPending';
import NcBindingApprovalModal from './components/NcBindingApprovalModal';
import ProductWebsite from './marketing/ProductWebsite';
import LegalPage from './marketing/LegalPage';
import HomePage from './marketing/HomePage';
import PricingPage from './marketing/PricingPage';
import privacyMd from './marketing/legal/privacy.md?raw';
import termsMd from './marketing/legal/terms.md?raw';
import beeFlowIcon from './assets/BeeFlow-logo-Icon-2026.svg';
import beeFlowLogo from './assets/bee-flow-logo.svg';

// Heavy admin / studio routes are loaded on demand so the initial chat
// bundle stays lean. Each render site is wrapped in <Suspense> + a per-
// route <ErrorBoundary> so a load failure or runtime crash in one panel
// can't take down the rest of the app.
const ComponentBuilder = lazy(() => import('./components/admin/ComponentBuilder'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const OrgSettings = lazy(() => import('./pages/OrgSettings'));
// MeetingNotesPage is now mounted inside Studio (./components/admin/Studio/index.jsx).
// The RecorderProvider/CaptureProvider remain mounted at the app root so capture
// state persists across page navigation even when the Studio tab isn't open.
import { RecorderProvider } from './pages/meeting-notes/hooks/RecorderContext';
import { CaptureProvider } from './pages/meeting-notes/capture/CaptureContext';
import CaptureModal from './pages/meeting-notes/capture/CaptureModal';
import MeetingCommandPalette from './components/global/MeetingCommandPalette';
const TemplatesPage = lazy(() => import('./pages/TemplatesPage'));
const AgentDesigner = lazy(() => import('./components/admin/AgentDesigner'));
// NotebooksPage is imported by AgentHub now — it renders inline in the main content area.
// AgentWizard / Studio are still rendered through AgentHub's slots; keeping
// them eagerly-imported in AgentHub avoids a double-Suspense flash.

function RouteFallback() {
    const { t } = useTranslation();
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: 'var(--text-muted)' }}>
            {t('app.loading', 'Loading…')}
        </div>
    );
}

import { LogOut, User, Shield, Settings, ChevronDown } from 'lucide-react';

import { API_BASE, authFetch, setSessionToken } from './utils/helpers';
import scopedStorage from './utils/scopedStorage';
import { logger } from './utils/logger';
import { useTranslation } from './hooks/useTranslation';

// ── Route mapping ──────────────────────────────────────────────
const PAGE_ROUTES = {
    // ── App routes (all under /app/) ──
    agents: '/app',
    admin: '/app/admin',
    orgSettings: '/app/org-settings',
    settings: '/app/settings',
    agentDesigner: '/app/agent-designer',
    agentDesignerAdvanced: '/app/agent-designer-advanced',
    agentWizard: '/app/agent-wizard',
    studio: '/app/studio',
    // URL slug renamed from /app/ai-tasks → /app/routines (Aug 2026 rename).
    // Old paths still parse below for one release.
    aiTasks: '/app/routines',
    reports: '/app/reports',
    components: '/app/components',
    // Kept for /app/meeting-notes backward-compat — the page now renders
    // inside Studio so /app/meeting-notes redirects to /app/studio/meeting-notes.
    meetingNotes: '/app/meeting-notes',
    templates: '/app/templates',
    notebooks: '/app/notebooks',
    webpages: '/app/webpages',
    ticketAssistant: '/ticket-assistant',
};

// Legacy page aliases — map old page keys to their new canonical names.
// Keeps deep links like ?page=emailKB working for one release.
const LEGACY_PAGE_ALIASES = {
    emailKB: 'ticketAssistant',
};

// Reverse lookup: path → page key
const PATH_TO_PAGE = Object.fromEntries(
    Object.entries(PAGE_ROUTES).map(([page, path]) => [path, page])
);

function pageFromPath(pathname) {
    // Root → agents (redirect to /app)
    if (pathname === '/') return 'agents';
    // Legacy /email-kb → ticketAssistant
    if (pathname === '/email-kb' || pathname.startsWith('/email-kb/')) return 'ticketAssistant';
    if (pathname === '/ticket-assistant' || pathname.startsWith('/ticket-assistant/')) return 'ticketAssistant';
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
    // /app/agent-designer-advanced or /app/agent-designer-advanced/* → agentDesignerAdvanced (legacy form)
    if (pathname === '/app/agent-designer-advanced' || pathname.startsWith('/app/agent-designer-advanced/')) return 'agentDesignerAdvanced';
    // /app/agent-designer or /app/agent-designer/* → agentDesigner (unified studio)
    if (pathname === '/app/agent-designer' || pathname.startsWith('/app/agent-designer/')) return 'agentDesigner';
    // /app/agent-wizard → agentWizard
    if (pathname === '/app/agent-wizard' || pathname.startsWith('/app/agent-wizard/')) return 'agentWizard';
    // /app/studio (and sub-sections) → unified Studio
    if (pathname === '/app/studio' || pathname.startsWith('/app/studio/')) return 'studio';
    // /app/routines or /app/routines/* → aiTasks (internal page key kept for stability)
    if (pathname === '/app/routines' || pathname.startsWith('/app/routines/')) return 'aiTasks';
    // Backward-compat: legacy /app/ai-tasks paths still resolve to the same page
    if (pathname === '/app/ai-tasks' || pathname.startsWith('/app/ai-tasks/')) return 'aiTasks';
    // /app/notebooks/:id → notebooks page (must come before generic /app/*)
    if (pathname.startsWith('/app/notebooks')) return 'notebooks';
    // /app/webpages/:id → unified Studio (Webpages tab)
    if (pathname.startsWith('/app/webpages')) return 'studio';
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

// Parse /app/studio/{section}/{id?} → { section: 'agents'|'skills'|'aiTasks'|'knowledge', id?: string }
// 'routines' is the canonical URL slug; 'ai-tasks' is accepted for backward compat.
function parseStudioUrl(pathname) {
    // Legacy /app/webpages[/<id>] paths route into Studio's Webpages section.
    const wp = pathname.match(/^\/app\/webpages(?:\/([^/]+))?/);
    if (wp) return { section: 'webpages', id: wp[1] || null };
    // Legacy /app/meeting-notes[/<id>] paths route into Studio's Meeting Notes section.
    const mn = pathname.match(/^\/app\/meeting-notes(?:\/([^/]+))?/);
    if (mn) return { section: 'meetingNotes', id: mn[1] || null };
    const m = pathname.match(/^\/app\/studio(?:\/([^/]+))?(?:\/([^/]+))?/);
    const seg = m?.[1] || 'agents';
    const id = m?.[2] || null;
    const section = (seg === 'routines' || seg === 'ai-tasks') ? 'aiTasks'
        : seg === 'skills' ? 'skills'
        : seg === 'knowledge' ? 'knowledge'
        : seg === 'webpages' ? 'webpages'
        : seg === 'tests' ? 'tests'
        : seg === 'meeting-notes' ? 'meetingNotes'
        : 'agents';
    return { section, id };
}

// Parse the task id out of /app/routines/{taskId} or legacy /app/ai-tasks/{taskId}.
// Trailing segments ignored.
function parseAITasksUrl(pathname) {
    const match = pathname.match(/^\/app\/(?:routines|ai-tasks)(?:\/([^/]+))?/);
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

// Top-level paths claimed by the BeeFlow app shell. Any single-segment
// pathname starting with one of these (e.g. `/app`, `/api`, `/admin`) is
// handed straight to the app router instead of being treated as a CMS page
// slug. Mirrors RESERVED_SLUGS in server/i18n/defaults/cmsDefaults.js plus
// the legacy short-id prefixes used by App.jsx's parsers.
const RESERVED_TOP_LEVEL = new Set([
    'app', 'api', 'admin', 'auth', 'login', 'logout', 'register', 'signup',
    'dashboard', 'settings', 'embed', 'oauth', 'callback',
    'chat', 'd', 'a', 'agent',
    'org-settings', 'email-kb', 'ticket-assistant',
    'privacy', 'terms', 'pricing',
    '__cms_preview__',
]);

// Returns true when `pathname` could be a CMS page (homepage or a single
// non-reserved slug segment). Multi-segment paths and reserved prefixes
// fall through to the app shell.
function isCmsPathCandidate(pathname) {
    if (!pathname || pathname === '/' || pathname === '') return true;
    const m = pathname.match(/^\/([^/]+)\/?$/);
    if (!m) return false;
    const seg = m[1].toLowerCase();
    if (RESERVED_TOP_LEVEL.has(seg)) return false;
    return /^[a-z0-9][a-z0-9-]*$/.test(seg);
}

// Root wrapper — handles embed route before App's hooks
function AppRoot() {
    const chatMatch = window.location.pathname.match(/^\/chat\/([a-zA-Z0-9-]+)/);
    if (chatMatch) {
        return <EmbedChat agentId={chatMatch[1]} />;
    }
    // Dedicated CMS preview route — rendered inside the admin Product Website
    // editor's iframe. Always shows the marketing site in preview mode, with
    // no auth/enabled/redirect coupling.
    if (window.location.pathname === '/__cms_preview__') {
        return <CmsPreviewHost />;
    }
    // Static public legal pages. Served from in-repo markdown so they remain
    // stable URLs for Google's OAuth consent screen regardless of CMS state.
    if (window.location.pathname === '/privacy') {
        return <LegalPage title="Privacy Policy" source={privacyMd} />;
    }
    if (window.location.pathname === '/terms') {
        return <LegalPage title="Terms of Service" source={termsMd} />;
    }
    if (window.location.pathname === '/pricing') {
        return <PricingPage />;
    }
    // Path-based marketing-site gate: intercept `/` and any single-segment
    // path (e.g. `/about`, `/contact`) so they render the public product
    // website. RootPathGate falls through to <App /> when the CMS is off
    // OR when the slug doesn't match a real page.
    if (isCmsPathCandidate(window.location.pathname)) {
        return <RootPathGate />;
    }
    return <LicenseProvider><App /></LicenseProvider>;
}

// Isolated host for the CMS preview iframe. Renders ProductWebsite with empty
// content; the admin panel pushes the real content via cms-preview postMessage
// immediately after ProductWebsite posts its cms-preview-ready handshake.
// No fetch, no auth coupling, no redirect logic — the iframe always renders
// the marketing site shell, never the chat app.
function CmsPreviewHost() {
    return <ProductWebsite content={{}} />;
}

function RootPathGate() {
    // null = still fetching, false = disabled (redirect happening),
    // object = { content } when CMS is enabled (or in preview mode).
    const [cms, setCms] = React.useState(null);
    const isPreview = new URLSearchParams(window.location.search).has('preview');

    React.useEffect(() => {
        let cancelled = false;
        const params = new URLSearchParams(window.location.search);
        const locale = (params.get('locale') || (navigator.language || 'en').split('-')[0]).toLowerCase();
        // Path-based routing: `/about` → slug "about", `/` → empty (homepage).
        // The legacy `?slug=` query param still wins if present so old links
        // keep working during the cutover.
        const pathSlug = (window.location.pathname.match(/^\/([^/]+)\/?$/)?.[1] || '').toLowerCase();
        const slug = (params.get('slug') || pathSlug || '').toString();

        // Preview mode: always render the marketing site so the admin's iframe
        // shows something even when the public site is still disabled. Pull
        // defaults from the admin endpoint so the page isn't empty before the
        // first postMessage arrives.
        if (isPreview) {
            fetch(`${API_BASE}/api/cms/admin`, { credentials: 'include' })
                .then(r => r.ok ? r.json() : null)
                .catch(() => null)
                .then(data => {
                    if (cancelled) return;
                    setCms({ content: data?.defaults || {} });
                });
            return;
        }

        const qs = `locale=${encodeURIComponent(locale)}` +
                   (slug ? `&slug=${encodeURIComponent(slug)}` : '');
        fetch(`${API_BASE}/api/cms/site?${qs}`)
            .then(r => r.ok ? r.json() : { enabled: false })
            .catch(() => ({ enabled: false }))
            .then(data => {
                if (cancelled) return;
                if (!data?.enabled) {
                    // No live CMS site. For "/" we render the static public
                    // HomePage (handled in the render branch below) so that
                    // beeflow.nl/ stays a no-login URL — required for Google's
                    // OAuth consent-screen verification. For non-root single-
                    // segment paths (e.g. /random) we still hand off to the
                    // app shell, redirecting to /app so the login form lives
                    // at a stable URL and the back button doesn't loop.
                    if (window.location.pathname !== '/') {
                        window.history.replaceState(null, '', '/app');
                    }
                    setCms(false);
                    return;
                }
                // Path-based 404: the user asked for `/widgets`, the CMS
                // is live, but no page with that slug exists. Hand the URL
                // back to the BeeFlow app router rather than rendering an
                // empty marketing shell. Homepage requests (no slug) skip
                // this check — the homepage is implicit.
                if (slug && data.found === false) {
                    setCms(false);
                    return;
                }
                // Canonical URL: the homepage lives at "/" only. If the
                // user typed `/home` (or any slug that resolves to the
                // homepage), rewrite the URL bar to "/" without reloading.
                // canonicalSlug is "" for the homepage, otherwise the
                // page's own slug.
                if (typeof data.canonicalSlug === 'string') {
                    const canonical = `/${data.canonicalSlug}`;
                    if (window.location.pathname !== canonical) {
                        window.history.replaceState(
                            null,
                            '',
                            canonical + window.location.search + window.location.hash,
                        );
                    }
                }
                setCms({ content: data.content || {} });
            });
        return () => { cancelled = true; };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    if (cms === null) {
        // Brief blank screen while we ask the server. Avoids flashing login.
        return <div style={{ background: '#06090F', minHeight: '100vh' }} />;
    }
    if (cms === false) {
        // CMS-managed site is off. At "/" show the static public HomePage so
        // there's a no-login landing for users (and Google's OAuth verifier).
        // Anywhere else, fall through to the auth-gated app shell.
        if (window.location.pathname === '/') return <HomePage />;
        return <App />;
    }
    return <ProductWebsite content={cms.content} />;
}


function App() {
    const { t } = useTranslation();
    const [currentPage, setCurrentPage] = useState(() => pageFromPath(window.location.pathname));
    const [adminPath, setAdminPath] = useState(() => parseAdminPath(window.location.pathname));
    const [orgSettingsPath, setOrgSettingsPath] = useState(() => parseOrgSettingsPath(window.location.pathname));
    const [initialNotebookId, setInitialNotebookId] = useState(() => parseNotebookUrl(window.location.pathname));
    const [user, setUser] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    // Keep scopedStorage pinned to the current user. When user logs out the
    // scope clears — subsequent reads return null until the next login. On
    // login, existing legacy global keys are migrated lazily on first read.
    useEffect(() => {
        scopedStorage.setCurrentUser(user?.id || null);
    }, [user?.id]);

    const [isLoading, setIsLoading] = useState(true);
    const [deploymentMode, setDeploymentMode] = useState('cloud');
    const [orgLogo, setOrgLogo] = useState(null);
    const [serverAvailable, setServerAvailable] = useState(null); // null=unknown, true=ok, false=down
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [showAgentDesigner, setShowAgentDesigner] = useState(() => pageFromPath(window.location.pathname) === 'agentDesigner');
    const [showAgentWizard, setShowAgentWizard] = useState(() => pageFromPath(window.location.pathname) === 'agentWizard');
    const [showStudio, setShowStudio] = useState(() => pageFromPath(window.location.pathname) === 'studio');
    const [studioRoute, setStudioRoute] = useState(() => parseStudioUrl(window.location.pathname));
    const [initialDesignerAgentId, setInitialDesignerAgentId] = useState(() => parseAgentDesignerUrl(window.location.pathname));
    const [showAITasks, setShowAITasks] = useState(() => pageFromPath(window.location.pathname) === 'aiTasks');
    const [initialAITaskId, setInitialAITaskId] = useState(() => parseAITasksUrl(window.location.pathname));
    // Settings panel is rendered inline inside AgentHub when showSettings is true.
    // Keep it in sync with the URL so /app/settings/* on hard-refresh opens the panel
    // and the browser's back/forward buttons toggle it.
    const [showSettings, setShowSettings] = useState(() => pageFromPath(window.location.pathname) === 'settings');
    const [showSkillsPanel, setShowSkillsPanel] = useState(false);
    const [showEmailKB, setShowEmailKB] = useState(false);
    // Notebooks panel is rendered inline inside AgentHub (same pattern as
    // showSettings / showAgentDesigner) so the left sidebar stays visible.
    // Hard-refreshes on /app/notebooks and /app/notebooks/:id still land the
    // user on the notebook via `initialNotebookId` parsed by pageFromPath.
    const [showNotebooks, setShowNotebooks] = useState(() => pageFromPath(window.location.pathname) === 'notebooks');
    const [encryptionState, setEncryptionState] = useState(null); // null | 'setup' | 'pin' | { recoveryKey: string }
    const [noOrganization, setNoOrganization] = useState(false);
    const [pendingApproval, setPendingApproval] = useState(false);
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

    // Check auth status on mount
    useEffect(() => {
        const checkAuth = async () => {
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
                    try {
                        const diagRes = await authFetch(`${API_BASE}/setup/diagnostics`, { cache: 'no-store' });
                        if (diagRes.ok) {
                            setBootstrapDiagnostics(await diagRes.json());
                        }
                    } catch (_) { /* connector itself unreachable — leave bootstrapDiagnostics null */ }
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
                        // Update deployment mode from authenticated response too
                        if (data.featureFlags?.deploymentMode) {
                            setDeploymentMode(data.featureFlags.deploymentMode);
                        }
                        // Post-auth org branding overrides the pre-auth guess
                        if (data.organization?.logo) {
                            setOrgLogo(`${API_BASE}${data.organization.logo}`);
                        }
                        // Check for SSO encryption setup needs (only if encryption feature is enabled)
                        if (data.encryptionEnabled !== false) {
                            if (data.needsEncryptionSetup) {
                                setEncryptionState('setup');
                            } else if (data.needsEncryptionPin) {
                                setEncryptionState('pin');
                            }
                        }
                        // Check if SSO user has no organisation
                        if (data.noOrganization) {
                            setNoOrganization(true);
                        }
                        // Check if SSO user is pending approval
                        if (data.pendingApproval) {
                            setPendingApproval(true);
                        }
                        // NC App Store onboarding wizard. Admin sees the
                        // wizard, others see "Setup in progress" — until
                        // the admin's POST /auth/admin/.../nc-onboarding/complete
                        // flips the flag.
                        logger.debug('[NcOnboarding] /auth/user flags:', {
                            needed: data.ncOnboardingNeeded,
                            pending: data.ncOnboardingPending,
                            isOrgAdmin: data.isOrgAdmin,
                            orgName: data.organizationName,
                        });
                        if (data.ncOnboardingNeeded) setNcOnboardingState('admin');
                        else if (data.ncOnboardingPending) setNcOnboardingState('pending');
                        else setNcOnboardingState(null);
                        if (data.organizationName) setNcOrgName(data.organizationName);
                        setPendingNcBinding(data.pendingNcBinding || null);
                        // Also fetch dynamic permissions
                        const permsRes = await authFetch(`${API_BASE}/auth/my-permissions`);
                        let permissions = [];
                        let userGroups = [];
                        let userOrgs = [];
                        let allowedAgentTypes = [];
                        let betaFeatures = [];
                        let canUseFeature = {};
                        if (permsRes.ok) {
                            const permsData = await permsRes.json();
                            permissions = permsData.permissions || [];
                            userGroups = permsData.groups || [];
                            userOrgs = permsData.organizations || [];
                            allowedAgentTypes = permsData.allowedAgentTypes || [];
                            betaFeatures = permsData.betaFeatures || [];
                            canUseFeature = permsData.canUseFeature || {};
                        }
                        const canManageUsers = permissions.includes('all') || permissions.includes('manage_users');
                        setUser({ ...data.user, permissions, groups: userGroups, organizations: userOrgs, allowedAgentTypes, betaFeatures, canUseFeature, featureFlags: data.featureFlags || {}, enabledIntegrations: data.enabledIntegrations || null, canManageUsers: canManageUsers || data.user.isAdmin, encryptionEnabled: data.encryptionEnabled !== false, isConsumerAccount: !!data.isConsumerAccount, ncOrg: data.ncOrg || null, organization: data.organization || null });
                        setIsAuthenticated(true);
                    }
                }
            } catch (err) {
                console.error('Auth check failed:', err);
            } finally {
                setIsLoading(false);
            }
        };
        checkAuth();
    }, []);

    // Handle browser back/forward
    useEffect(() => {
        const handlePopState = () => {
            const page = pageFromPath(window.location.pathname);
            setCurrentPage(page);
            setAdminPath(parseAdminPath(window.location.pathname));
            setOrgSettingsPath(parseOrgSettingsPath(window.location.pathname));
            setInitialNotebookId(parseNotebookUrl(window.location.pathname));
            // Sync inline-rendered panels with the URL so back/forward opens or closes them.
            setShowSettings(page === 'settings');
            const isDesigner = page === 'agentDesigner';
            setShowAgentDesigner(isDesigner);
            setShowAgentWizard(page === 'agentWizard');
            const isStudio = page === 'studio';
            setShowStudio(isStudio);
            if (isStudio) setStudioRoute(parseStudioUrl(window.location.pathname));
            if (isDesigner) setInitialDesignerAgentId(parseAgentDesignerUrl(window.location.pathname));
            const isAITasks = page === 'aiTasks';
            setShowAITasks(isAITasks);
            if (isAITasks) setInitialAITaskId(parseAITasksUrl(window.location.pathname));
            setShowNotebooks(page === 'notebooks');
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

    const navigateToPage = useCallback((page) => {
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
            // Normalise: 'studio:agents:<id>' or 'studio/agents/<id>'.
            const raw = page.replace(/^studio[/:]?/, '');
            const parts = raw.split(/[/:]/).filter(Boolean);
            const sectionRaw = parts[0] || 'agents';
            const id = parts[1] || null;
            const section = (sectionRaw === 'routines' || sectionRaw === 'ai-tasks') ? 'aiTasks'
                : sectionRaw === 'skills' ? 'skills'
                : sectionRaw === 'knowledge' ? 'knowledge'
                : sectionRaw === 'webpages' ? 'webpages'
                : sectionRaw === 'tests' ? 'tests'
                : (sectionRaw === 'meeting-notes' || sectionRaw === 'meetingNotes') ? 'meetingNotes'
                : 'agents';
            const pathSegment = section === 'aiTasks' ? 'routines'
                : section === 'meetingNotes' ? 'meeting-notes'
                : section;
            const path = id ? `/app/studio/${pathSegment}/${id}` : `/app/studio/${pathSegment}`;
            setStudioRoute({ section, id });
            setShowStudio(true);
            setShowAgentDesigner(false);
            setShowAgentWizard(false);
            setShowSettings(false);
            setShowSkillsPanel(false);
            setShowAITasks(false);
            setShowNotebooks(false);
            if (window.location.pathname !== path) {
                window.history.pushState({ page: 'studio' }, '', path);
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
            setShowEmailKB(false);
            setShowNotebooks(false);
            setShowStudio(false);
            const path = taskId ? `/app/routines/${taskId}` : '/app/routines';
            if (window.location.pathname !== path) {
                window.history.pushState({ page: 'aiTasks' }, '', path);
            }
            setCurrentPage('aiTasks');
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
            setShowEmailKB(false);
            setShowAITasks(false);
            setShowStudio(false);
            return;
        }
        // Ticket Assistant (formerly Email KB) renders inline in conversation area.
        // Accept legacy 'emailKB' page key for one release.
        if (page === 'ticketAssistant' || page === 'emailKB') {
            setShowEmailKB(true);
            setShowSettings(false);
            setShowAgentDesigner(false);
            setShowSkillsPanel(false);
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
            setShowEmailKB(false);
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
            setShowEmailKB(false);
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
        setShowStudio(false);
        const path = PAGE_ROUTES[page] || '/';
        window.history.pushState({ page }, '', path);
    }, []);

    const handleLogin = async (userData, recoveryKey) => {
        // Fetch dynamic permissions just like checkAuth does on refresh
        try {
            const permsRes = await authFetch(`${API_BASE}/auth/my-permissions`);
            let permissions = [];
            let userGroups = [];
            let userOrgs = [];
            let allowedAgentTypes = [];
            let betaFeatures = [];
            let canUseFeature = {};
            if (permsRes.ok) {
                const permsData = await permsRes.json();
                permissions = permsData.permissions || [];
                userGroups = permsData.groups || [];
                userOrgs = permsData.organizations || [];
                allowedAgentTypes = permsData.allowedAgentTypes || [];
                betaFeatures = permsData.betaFeatures || [];
                canUseFeature = permsData.canUseFeature || {};
            }
            const canManageUsers = permissions.includes('all') || permissions.includes('manage_users');
            // Pull `organization` (logo/name) from /auth/user — handleLogin's
            // userData payload doesn't include it, so the sidebar would
            // otherwise miss the org logo until the next full page refresh.
            let organization = null;
            try {
                const userRes = await authFetch(`${API_BASE}/auth/user`, { cache: 'no-store' });
                if (userRes.ok) {
                    const userJson = await userRes.json();
                    if (userJson?.organization) organization = userJson.organization;
                }
            } catch (_) { /* non-fatal */ }
            setUser({ ...userData, permissions, groups: userGroups, organizations: userOrgs, allowedAgentTypes, betaFeatures, canUseFeature, canManageUsers: canManageUsers || userData.isAdmin, isConsumerAccount: !!userData.isConsumerAccount, organization });
        } catch (err) {
            console.error('Failed to fetch permissions after login:', err);
            setUser(userData);
        }
        setIsAuthenticated(true);
        // Reset to main app view after login (currentPage may still be a homepage route)
        setCurrentPage('agents');
        window.history.pushState({ page: 'agents' }, '', '/app');
        // Show recovery key if one was generated (new user or migration)
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
        return <NcOnboardingWizard user={user} orgName={ncOrgName} onComplete={() => setNcOnboardingState(null)} />;
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
        }} initialAITaskId={initialAITaskId} showSkillsPanel={showSkillsPanel} onCloseSkillsPanel={() => setShowSkillsPanel(false)} showEmailKB={showEmailKB} onCloseEmailKB={() => setShowEmailKB(false)} showNotebooks={showNotebooks && user?.featureFlags?.notebooks !== false} initialNotebookId={initialNotebookId} onNotebookChange={(id) => {
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
        <div className="h-screen flex flex-col">

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
function SubscriptionGate({ user, currentPage, deploymentMode, navigateToPage }) {
    const { hasActiveSub, loading } = useSubscriptionContext();
    const isPlatformOperator = user?.id === 'admin';
    const isConsumer = !(user?.organizationId || user?.orgId);
    const isSelfHosted = deploymentMode === 'self-hosted';

    useEffect(() => {
        if (loading || hasActiveSub) return;
        if (isPlatformOperator || isConsumer || isSelfHosted) return;
        // Already on the License & Usage page (or its loading path) — let
        // it render so the admin can finish the checkout flow. Stripe
        // bounces back to the same URL with `?checkout=success`; allow
        // those query strings too.
        const path = window.location.pathname;
        const onLicensePage = path === '/app/settings/organisation/license'
            || path.startsWith('/app/settings/organisation/license');
        if (onLicensePage) return;
        navigateToPage('settings/organisation/license');
    }, [loading, hasActiveSub, isPlatformOperator, isConsumer, isSelfHosted, currentPage, navigateToPage]);

    return null;
}

export default AppRoot;
