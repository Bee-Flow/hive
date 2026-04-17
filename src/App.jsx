import React, { useState, useEffect, useRef, useCallback } from 'react';
import AgentHub from './AgentHub';
import ComponentBuilder from './components/admin/ComponentBuilder';
import AdminDashboard from './pages/AdminDashboard';
import OrgSettings from './pages/OrgSettings';

import MeetingNotesPage from './pages/MeetingNotesPage';
import TemplatesPage from './pages/TemplatesPage';
// NotebooksPage is imported by AgentHub now — it renders inline in the main content area.

import AgentDesigner from './components/admin/AgentDesigner';
import LoginPage from './pages/LoginPage';
import EncryptionSetup from './pages/EncryptionSetup';
import EmbedChat from './pages/EmbedChat';
import DlpPreviewModal from './components/DlpPreviewModal';

import { LogOut, User, Shield, Settings, ChevronDown } from 'lucide-react';

import { API_BASE, authFetch } from './utils/helpers';
import scopedStorage from './utils/scopedStorage';

// ── Route mapping ──────────────────────────────────────────────
const PAGE_ROUTES = {
    // ── App routes (all under /app/) ──
    agents: '/app',
    admin: '/app/admin',
    orgSettings: '/app/org-settings',
    settings: '/app/settings',
    agentDesigner: '/app/agent-designer',
    reports: '/app/reports',
    components: '/app/components',
    meetingNotes: '/app/meeting-notes',
    templates: '/app/templates',
    notebooks: '/app/notebooks',

};

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
    // /app/agent-designer or /app/agent-designer/* → agentDesigner
    if (pathname === '/app/agent-designer' || pathname.startsWith('/app/agent-designer/')) return 'agentDesigner';
    // /app/notebooks/:id → notebooks page (must come before generic /app/*)
    if (pathname.startsWith('/app/notebooks')) return 'notebooks';

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
    const match = pathname.match(/^\/app\/agent-designer(?:\/([^/]+))?/);
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

// Root wrapper — handles embed route before App's hooks
function AppRoot() {
    const chatMatch = window.location.pathname.match(/^\/chat\/([a-zA-Z0-9-]+)/);
    if (chatMatch) {
        return <EmbedChat agentId={chatMatch[1]} />;
    }
    return <App />;
}


function App() {
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
    const [serverAvailable, setServerAvailable] = useState(null); // null=unknown, true=ok, false=down
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [showAgentDesigner, setShowAgentDesigner] = useState(() => pageFromPath(window.location.pathname) === 'agentDesigner');
    const [initialDesignerAgentId, setInitialDesignerAgentId] = useState(() => parseAgentDesignerUrl(window.location.pathname));
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
    const profileMenuRef = useRef(null);

    // Parse initial agent/conversation from URL
    const initialUrlRef = useRef(parseAgentUrl(window.location.pathname));
    const initialDirectConvRef = useRef(parseDirectChatUrl(window.location.pathname));

    // Close profile menu on click outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            // No longer handled in App.jsx
        };
    }, []);

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
                        setServerAvailable(true);
                    } else {
                        setServerAvailable(true); // server responded, even if not OK
                    }
                } catch (_) {
                    // Network error — server is unreachable
                    setServerAvailable(false);
                    setIsLoading(false);
                    return;
                }

                const res = await authFetch(`${API_BASE}/auth/user`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.authenticated && data.user) {
                        // Update deployment mode from authenticated response too
                        if (data.featureFlags?.deploymentMode) {
                            setDeploymentMode(data.featureFlags.deploymentMode);
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
                        // Also fetch dynamic permissions
                        const permsRes = await authFetch(`${API_BASE}/auth/my-permissions`);
                        let permissions = [];
                        let userGroups = [];
                        let userOrgs = [];
                        let allowedAgentTypes = [];
                        let betaFeatures = [];
                        if (permsRes.ok) {
                            const permsData = await permsRes.json();
                            permissions = permsData.permissions || [];
                            userGroups = permsData.groups || [];
                            userOrgs = permsData.organizations || [];
                            allowedAgentTypes = permsData.allowedAgentTypes || [];
                            betaFeatures = permsData.betaFeatures || [];
                        }
                        const canManageUsers = permissions.includes('all') || permissions.includes('manage_users');
                        setUser({ ...data.user, permissions, groups: userGroups, organizations: userOrgs, allowedAgentTypes, betaFeatures, featureFlags: data.featureFlags || {}, enabledIntegrations: data.enabledIntegrations || null, canManageUsers: canManageUsers || data.user.isAdmin, encryptionEnabled: data.encryptionEnabled !== false, isConsumerAccount: !!data.isConsumerAccount });
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
            if (isDesigner) setInitialDesignerAgentId(parseAgentDesignerUrl(window.location.pathname));
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

    // Apply permanent light theme
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', 'light');
        localStorage.setItem('theme', 'light');
    }, []);

    const navigateToPage = useCallback((page) => {
        // Root / home → redirect to /app
        if (page === '/' || page === 'home') {
            setCurrentPage('agents');
            window.history.pushState({}, '', '/app');
            return;
        }
        // Agent Designer renders inline in conversation area
        if (page === 'agentDesigner' || page.startsWith('agentDesigner:')) {
            const agentId = page.includes(':') ? page.split(':')[1] : null;
            setInitialDesignerAgentId(agentId);
            setShowAgentDesigner(true);
            setShowSettings(false);
            setShowSkillsPanel(false);
            // Push the URL so /app/agent-designer[/{id}] is bookmarkable.
            const path = agentId ? `/app/agent-designer/${agentId}` : '/app/agent-designer';
            if (window.location.pathname !== path) {
                window.history.pushState({ page: 'agentDesigner' }, '', path);
            }
            setCurrentPage('agentDesigner');
            return;
        }
        // Settings renders inline in conversation area
        if (page === 'settings' || page.startsWith('settings/')) {
            setShowSettings(true);
            setShowAgentDesigner(false);
            setShowSkillsPanel(false);
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
            return;
        }
        // Email KB renders inline in conversation area
        if (page === 'emailKB') {
            setShowEmailKB(true);
            setShowSettings(false);
            setShowAgentDesigner(false);
            setShowSkillsPanel(false);
            return;
        }
        // Support admin sub-paths like 'admin/ai-config' or 'admin/security/sso'
        if (page.startsWith('admin')) {
            const subPath = page === 'admin' ? '' : page.slice('admin'.length); // e.g. '/ai-config'
            const path = '/app/admin' + subPath;
            setCurrentPage('admin');
            setAdminPath(parseAdminPath(path));
            setShowProfileMenu(false);
            window.history.pushState({ page: 'admin' }, '', path);
            return;
        }
        // Support org-settings sub-paths like 'org-settings/agents'
        if (page === 'orgSettings' || page.startsWith('org-settings')) {
            const subPage = page === 'orgSettings' ? 'org-settings' : page;
            const path = '/app/' + subPage;
            setCurrentPage('orgSettings');
            setOrgSettingsPath(parseOrgSettingsPath(path));
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
            setCurrentPage('notebooks');
            setShowProfileMenu(false);
            const path = notebookId ? `/app/notebooks/${notebookId}` : '/app/notebooks';
            if (window.location.pathname !== path) {
                window.history.pushState({ page: 'notebooks', notebookId }, '', path);
            }
            return;
        }
        setCurrentPage(page);
        setShowProfileMenu(false);
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
            if (permsRes.ok) {
                const permsData = await permsRes.json();
                permissions = permsData.permissions || [];
                userGroups = permsData.groups || [];
                userOrgs = permsData.organizations || [];
                allowedAgentTypes = permsData.allowedAgentTypes || [];
                betaFeatures = permsData.betaFeatures || [];
            }
            const canManageUsers = permissions.includes('all') || permissions.includes('manage_users');
            setUser({ ...userData, permissions, groups: userGroups, organizations: userOrgs, allowedAgentTypes, betaFeatures, canManageUsers: canManageUsers || userData.isAdmin, isConsumerAccount: !!userData.isConsumerAccount });
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
        setUser(null);
        setIsAuthenticated(false);
        navigateToPage('agents');
    };

    // Show loading spinner while checking auth
    if (isLoading) {
        return (
            <div className="h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
                <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center animate-pulse"
                        style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
                        <span className="text-3xl">🐝</span>
                    </div>
                    <p className="text-[var(--text-secondary)] text-sm">Loading...</p>
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
                    <div style={{
                        width: 64, height: 64, borderRadius: 18, margin: '0 auto 20px',
                        background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 30,
                    }}>🐝</div>
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
                        Server Unavailable
                    </h2>
                    <p style={{ margin: '0 0 28px', fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.65 }}>
                        Could not connect to the Bee Flow server. Please make sure the server is running and try again.
                    </p>
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
                        Retry Connection
                    </button>
                </div>
            </div>
        );
    }

    // Not authenticated → show login page directly
    if (!isAuthenticated) {
        return <LoginPage onLogin={handleLogin} onDemoLogin={handleLogin} />;
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

    // Show no-organisation gate for SSO users without org membership
    // Consumer accounts (org-less by design) bypass this gate
    if (noOrganization && !user?.isConsumerAccount) {
        return (
            <div className="h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(160deg, var(--bg-primary) 0%, var(--bg-secondary) 50%, var(--bg-tertiary) 100%)' }}>
                <div className="w-full max-w-md">
                    <div className="backdrop-blur-xl rounded-3xl p-8 shadow-2xl border relative overflow-hidden text-center" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)' }}>
                        <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-[var(--border-default)] to-transparent" />
                        <div className="w-20 h-20 mx-auto mb-5 rounded-full overflow-hidden shadow-xl ring-4 ring-[var(--border-subtle)]">
                            <img src="/bee-flow-logo.svg" alt="Bee Flow" className="w-full h-full object-cover" />
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
                            <img src="/bee-flow-logo.svg" alt="Bee Flow" className="w-full h-full object-cover" />
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

    const renderContent = () => {
        if (currentPage === 'admin') {
            return <AdminDashboard user={user} onBack={() => navigateToPage('agents')} adminPath={adminPath} onNavigate={navigateToPage} />;
        }
        if (currentPage === 'orgSettings') {
            return <OrgSettings user={user} onBack={() => navigateToPage('agents')} orgSettingsPath={orgSettingsPath} onNavigate={navigateToPage} />;
        }


        if (currentPage === 'components') {
            return <ComponentBuilder onBack={() => navigateToPage('agents')} />;
        }


        if (currentPage === 'meetingNotes') {
            if (user?.featureFlags?.meeting_notes === false) return navigateToPage('agents');
            return <MeetingNotesPage user={user} onBack={() => navigateToPage('agents')} />;
        }
        if (currentPage === 'templates') {
            if (user?.featureFlags?.templates === false) return navigateToPage('agents');
            return <TemplatesPage user={user} onBack={() => navigateToPage('agents')} />;
        }
        // Notebooks used to render as a standalone page here, taking over the
        // whole viewport. It now renders inline inside AgentHub below (same
        // slot as Settings / Agent Designer) so the app sidebar stays visible.

        return <AgentHub onNavigate={navigateToPage} user={user} initialAgentId={initialUrlRef.current.agentId} initialConversationId={initialUrlRef.current.conversationId} initialDirectConvId={initialDirectConvRef.current} onLogout={handleLogout} currentPage={currentPage} showSettings={showSettings} onCloseSettings={() => {
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
        }} initialDesignerAgentId={initialDesignerAgentId} showSkillsPanel={showSkillsPanel} onCloseSkillsPanel={() => setShowSkillsPanel(false)} showEmailKB={showEmailKB} onCloseEmailKB={() => setShowEmailKB(false)} showNotebooks={showNotebooks && user?.featureFlags?.notebooks !== false} initialNotebookId={initialNotebookId} onNotebookChange={(id) => {
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
        <div className="h-screen flex flex-col">

            {/* Content */}
            <div className="flex-1 overflow-hidden">
                {renderContent()}
            </div>

            {/* Pre-flight DLP preview modal — globally mounted, listens for
                `beeflow:dlp_preview` window events emitted by useChatEngine. */}
            {isAuthenticated && <DlpPreviewModal />}

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
    );
}

export default AppRoot;
