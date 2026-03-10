import React, { useState, useEffect, useRef, useCallback } from 'react';
import AgentHub from './AgentHub';
import ComponentBuilder from './components/admin/ComponentBuilder';
import AdminDashboard from './pages/AdminDashboard';
import AdvancedSettings from './pages/AdvancedSettings';
import OrgSettings from './pages/OrgSettings';
import ReportsDashboard from './pages/ReportsDashboard';
import GroupChatConfig from './pages/GroupChatConfig';
import TerminalAgentManager from './pages/TerminalAgentManager';
import TasksPage from './pages/TasksPage';
import MonitoringDashboard from './pages/monitoring/MonitoringDashboard';
import AgentDesigner from './components/admin/AgentDesigner';
import LoginPage from './pages/LoginPage';
import EncryptionSetup from './pages/EncryptionSetup';
import EmbedChat from './pages/EmbedChat';
import { LogOut, User, Shield, Settings, ChevronDown } from 'lucide-react';

import { API_BASE, authFetch } from './utils/helpers';

// ── Route mapping ──────────────────────────────────────────────
const PAGE_ROUTES = {
    agents: '/',
    admin: '/admin',
    orgSettings: '/org-settings',
    settings: '/settings',
    agentDesigner: '/agent-designer',
    reports: '/app/reports',
    components: '/app/components',
    groupChats: '/group-chats',
    terminalAgents: '/terminal-agents',
    tasks: '/tasks',
    monitoring: '/monitoring',
};

// Reverse lookup: path → page key
const PATH_TO_PAGE = Object.fromEntries(
    Object.entries(PAGE_ROUTES).map(([page, path]) => [path, page])
);

function pageFromPath(pathname) {
    // Exact match first
    if (PATH_TO_PAGE[pathname]) return PATH_TO_PAGE[pathname];
    // /admin or /admin/* → admin page
    if (pathname === '/admin' || pathname.startsWith('/admin/')) return 'admin';
    // /org-settings or /org-settings/* → orgSettings page
    if (pathname === '/org-settings' || pathname.startsWith('/org-settings/')) return 'orgSettings';
    // /a/:shortId or /agent/:id → agents page
    if (pathname.startsWith('/a/') || pathname.startsWith('/agent/')) return 'agents';
    // /d/:convId → direct chat (agents page in direct mode)
    if (pathname.startsWith('/d/')) return 'agents';
    // Legacy ?page= param support (backward compat)
    const params = new URLSearchParams(window.location.search);
    const legacyPage = params.get('page');
    if (legacyPage && PAGE_ROUTES[legacyPage]) return legacyPage;
    // Default
    return 'agents';
}

// Parse /admin/{seg1}/{seg2}/{seg3} from the URL
function parseAdminPath(pathname) {
    const match = pathname.match(/^\/admin(?:\/([^/]+))?(?:\/([^/]+))?(?:\/([^/]+))?/);
    return {
        seg1: match?.[1] || '',
        seg2: match?.[2] || '',
        seg3: match?.[3] || '',
    };
}

// Parse /org-settings/{seg1}/{seg2} from the URL
function parseOrgSettingsPath(pathname) {
    const match = pathname.match(/^\/org-settings(?:\/([^/]+))?(?:\/([^/]+))?/);
    return {
        seg1: match?.[1] || '',
        seg2: match?.[2] || '',
    };
}

// Extract agent ID prefix and conversation ID prefix from URL
// Supports: /a/:shortId, /a/:shortId/:shortConvId, /agent/:fullId, /agent/:fullId/:fullConvId
function parseAgentUrl(pathname) {
    const match = pathname.match(/^\/(?:a|agent)\/([a-zA-Z0-9_-]+)(?:\/([a-zA-Z0-9_-]+))?/);
    if (match) {
        return { agentId: match[1], conversationId: match[2] || null };
    }
    return { agentId: null, conversationId: null };
}

// Extract direct chat conversation ID from URL: /d/:shortConvId
function parseDirectChatUrl(pathname) {
    const match = pathname.match(/^\/d\/([a-zA-Z0-9_-]+)/);
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
// Android APK download banner
const AndroidBanner = () => {
    const [visible, setVisible] = useState(() => {
        if (typeof window === 'undefined') return false;
        const ua = navigator.userAgent || '';
        const isAndroid = /Android/i.test(ua) && /Mobile/i.test(ua);
        const dismissed = localStorage.getItem('apk_banner_dismissed');
        return isAndroid && !dismissed;
    });

    if (!visible) return null;

    const dismiss = () => {
        localStorage.setItem('apk_banner_dismissed', Date.now().toString());
        setVisible(false);
    };

    return (
        <div style={{
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            color: '#fff',
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '13px',
            fontWeight: 500,
            zIndex: 9999,
            animation: 'bannerSlideIn .3s ease-out',
        }}>
            <span style={{ fontSize: '20px', flexShrink: 0 }}>🐝</span>
            <span style={{ flex: 1 }}>Get the Bee Flow app for a better experience</span>
            <a
                href="/download"
                style={{
                    background: 'rgba(255,255,255,0.2)',
                    color: '#fff',
                    padding: '6px 14px',
                    borderRadius: '8px',
                    fontWeight: 600,
                    fontSize: '12px',
                    textDecoration: 'none',
                    whiteSpace: 'nowrap',
                    border: '1px solid rgba(255,255,255,0.3)',
                }}
            >
                Download APK
            </a>
            <button
                onClick={dismiss}
                style={{
                    background: 'none',
                    border: 'none',
                    color: 'rgba(255,255,255,0.7)',
                    cursor: 'pointer',
                    padding: '4px',
                    fontSize: '18px',
                    lineHeight: 1,
                }}
                aria-label="Dismiss"
            >
                ×
            </button>
        </div>
    );
};

function App() {
    const [currentPage, setCurrentPage] = useState(() => pageFromPath(window.location.pathname));
    const [adminPath, setAdminPath] = useState(() => parseAdminPath(window.location.pathname));
    const [orgSettingsPath, setOrgSettingsPath] = useState(() => parseOrgSettingsPath(window.location.pathname));
    const [user, setUser] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [showAgentDesigner, setShowAgentDesigner] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
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
                const res = await authFetch(`${API_BASE}/auth/user`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.authenticated && data.user) {
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
                        setUser({ ...data.user, permissions, groups: userGroups, organizations: userOrgs, allowedAgentTypes, betaFeatures, featureFlags: data.featureFlags || {}, enabledIntegrations: data.enabledIntegrations || null, canManageUsers: canManageUsers || data.user.isAdmin, encryptionEnabled: data.encryptionEnabled !== false });
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
            setCurrentPage(pageFromPath(window.location.pathname));
            setAdminPath(parseAdminPath(window.location.pathname));
            setOrgSettingsPath(parseOrgSettingsPath(window.location.pathname));
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
        // Agent Designer opens as overlay, not a page
        if (page === 'agentDesigner') {
            setShowAgentDesigner(true);
            return;
        }
        // Settings opens as overlay
        if (page === 'settings') {
            setShowSettings(true);
            return;
        }
        // Support admin sub-paths like 'admin/ai-config' or 'admin/security/sso'
        if (page.startsWith('admin')) {
            const path = '/' + page; // e.g. '/admin/ai-config'
            setCurrentPage('admin');
            setAdminPath(parseAdminPath(path));
            setShowProfileMenu(false);
            window.history.pushState({ page: 'admin' }, '', path);
            return;
        }
        // Support org-settings sub-paths like 'org-settings/agents'
        if (page === 'orgSettings' || page.startsWith('org-settings')) {
            const path = '/' + (page === 'orgSettings' ? 'org-settings' : page);
            setCurrentPage('orgSettings');
            setOrgSettingsPath(parseOrgSettingsPath(path));
            setShowProfileMenu(false);
            window.history.pushState({ page: 'orgSettings' }, '', path);
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
            setUser({ ...userData, permissions, groups: userGroups, organizations: userOrgs, allowedAgentTypes, betaFeatures, canManageUsers: canManageUsers || userData.isAdmin });
        } catch (err) {
            console.error('Failed to fetch permissions after login:', err);
            setUser(userData);
        }
        setIsAuthenticated(true);
        // Show recovery key if one was generated (new user or migration)
        if (recoveryKey) {
            setEncryptionState({ recoveryKey });
        }
    };

    const handleLogout = async () => {
        try {
            await authFetch(`${API_BASE}/auth/logout`, {
                method: 'POST',
            });
        } catch (err) {
            console.error('Logout error:', err);
        }
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

    // Show login page if not authenticated
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
    if (noOrganization) {
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
                            Your account has been created and linked to an organisation, but it needs to be approved by an administrator before you can access the platform.
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

        if (currentPage === 'reports') {
            return <ReportsDashboard onBack={() => navigateToPage('settings')} />;
        }
        if (currentPage === 'components') {
            return <ComponentBuilder onBack={() => navigateToPage('agents')} />;
        }
        if (currentPage === 'groupChats') {
            return <GroupChatConfig onBack={() => navigateToPage('settings')} onSaved={() => navigateToPage('agents')} />;
        }
        if (currentPage === 'terminalAgents') {
            return <TerminalAgentManager onBack={() => navigateToPage('settings')} />;
        }
        if (currentPage === 'tasks') {
            if (user?.featureFlags?.tasks === false) return navigateToPage('agents');
            return <TasksPage user={user} onBack={() => navigateToPage('agents')} onNavigate={navigateToPage} />;
        }
        if (currentPage === 'monitoring') {
            if (user?.featureFlags?.monitoring === false) return navigateToPage('agents');
            return <MonitoringDashboard onBack={() => navigateToPage('agents')} user={user} />;
        }
        return <AgentHub onNavigate={navigateToPage} user={user} initialAgentId={initialUrlRef.current.agentId} initialConversationId={initialUrlRef.current.conversationId} initialDirectConvId={initialDirectConvRef.current} onLogout={handleLogout} currentPage={currentPage} />;
    };

    return (
        <div className="h-screen flex flex-col">
            {/* Android APK download banner */}
            <AndroidBanner />
            {/* Content */}
            <div className="flex-1 overflow-hidden">
                {renderContent()}
            </div>

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

            {/* Agent Designer Overlay */}
            {showAgentDesigner && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center"
                    style={{ animation: 'overlayIn .2s ease-out' }}
                    onKeyDown={(e) => { if (e.key === 'Escape') setShowAgentDesigner(false); }}
                    tabIndex={-1}
                    ref={(el) => el?.focus()}
                >
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm cursor-pointer" onClick={() => setShowAgentDesigner(false)} />
                    <div
                        className="relative w-[92vw] h-[90vh] max-w-[1400px] rounded-2xl overflow-hidden shadow-2xl border"
                        style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)', animation: 'overlayContentIn .25s ease-out' }}
                    >
                        <AgentDesigner onBack={null} hasPermission={() => true} />
                    </div>
                </div>
            )}

            {/* Settings Overlay */}
            {showSettings && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center"
                    style={{ animation: 'overlayIn .2s ease-out' }}
                    onKeyDown={(e) => { if (e.key === 'Escape') setShowSettings(false); }}
                    tabIndex={-1}
                    ref={(el) => el?.focus()}
                >
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm cursor-pointer" onClick={() => setShowSettings(false)} />
                    <div
                        className="relative w-[92vw] h-[90vh] max-w-[1000px] rounded-2xl overflow-hidden shadow-2xl border"
                        style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)', animation: 'overlayContentIn .25s ease-out' }}
                    >
                        <AdvancedSettings onBack={null} onNavigate={navigateToPage} onLogout={handleLogout} user={user} />
                    </div>
                </div>
            )}
        </div>
    );
}

export default AppRoot;
