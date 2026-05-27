import React, { useState, useEffect, useRef, useCallback, useMemo, Suspense } from 'react';
import { lazy } from './utils/lazyWithReload';
import { v4 as uuidv4 } from 'uuid';

// ── Chat-critical (eager) ────────────────────────────────────────────
// These components are on the main chat path; deferring them costs more
// in flicker than they save in bundle size.
import Sidebar from './components/Sidebar';
import { RequireTier } from './components/LicenseContext';
import InputArea from './components/InputArea';
import WelcomeScreen from './components/WelcomeScreen';
import MessageItem from './components/chat/MessageItem';
import DirectChatWelcome from './components/DirectChatWelcome';
import SearchOverlay from './components/SearchOverlay';

// ── Lazy: admin / studio / notebooks / marketplaces ──────────────────
// Each of these is opened from a modal slot or a separate route. Lazy
// loading saves ~1.2 MB off the initial bundle.
const AgentDesignerPanel = lazy(() => import('./components/AgentDesignerPanel'));
const AgentMarketplace = lazy(() => import('./components/AgentMarketplace'));
const KBMarketplace = lazy(() => import('./components/KBMarketplace'));
const KBDetailPage = lazy(() => import('./components/KBDetailPage'));
const MemoryPanel = lazy(() => import('./components/MemoryPanel'));
const WorkspaceNotebook = lazy(() => import('./components/WorkspaceNotebook'));
const GammaPreviewPanel = lazy(() => import('./components/GammaPreviewPanel'));
const SideWebpagePanel = lazy(() => import('./components/SideWebpagePanel'));
const WebpagePickerPopover = lazy(() => import('./components/WebpagePickerPopover'));
const ProjectsPage = lazy(() => import('./components/ProjectsPage'));
const ProjectDetailPage = lazy(() => import('./components/ProjectDetailPage'));
const AdvancedSettings = lazy(() => import('./pages/AdvancedSettings'));
const AgentDesigner = lazy(() => import('./components/admin/AgentDesigner'));
const AgentStudio = lazy(() => import('./components/admin/AgentStudio'));
const Studio = lazy(() => import('./components/admin/Studio'));
const AITasksDesigner = lazy(() => import('./components/admin/AITasksDesigner'));
const SkillsPanel = lazy(() => import('./components/SkillsPanel'));
const EmailKBSettings = lazy(() => import('./components/EmailKBSettings'));
const NotebooksPage = lazy(() => import('./pages/NotebooksPage'));

import useChatEngine from './hooks/useChatEngine';
import { useViewport } from './hooks/useViewport';

// Shared Suspense fallback — keeps lazy slots from flashing layout shifts.
// Each modal slot already renders inside its own animated container so a
// plain spinner is sufficient.
function LazyFallback() {
    return (
        <div className="flex items-center justify-center w-full h-full">
            <div className="w-6 h-6 rounded-full border-2 border-[var(--border-default)] border-t-[var(--accent-primary)] animate-spin" />
        </div>
    );
}

import { API_BASE, generateMessageId, authFetch } from './utils/helpers';
import { isImageAvatar, resolveAvatarSrc, pickAgentAvatar, DEFAULT_AGENT_EMOJI } from './utils/agentAvatar';
import scopedStorage from './utils/scopedStorage';
import { normalizeLoadedMessages } from './utils/messageShape';
import { X, PenLine, Heart, MoreVertical, Menu, EyeOff, Pencil } from 'lucide-react';
import beeFlowIcon from './assets/BeeFlow-logo-Icon-2026.svg';

const AgentHub = ({
    onNavigate, user, onUpdateUser, onLogout, currentPage,
    initialAgentId = null, initialConversationId = null, initialDirectConvId = null,
    showSettings = false, onCloseSettings,
    showAgentDesigner = false, onCloseAgentDesigner, initialDesignerAgentId = null,
    showAgentWizard = false, onCloseAgentWizard,
    showStudio = false, studioRoute = { section: 'agents', id: null }, onCloseStudio,
    showAITasks = false, onCloseAITasks, initialAITaskId = null,
    showSkillsPanel = false, onCloseSkillsPanel,
    showEmailKB = false, onCloseEmailKB,
    // Notebooks rendered inline (previously a standalone page at App level).
    showNotebooks = false, onCloseNotebooks, initialNotebookId = null, onNotebookChange,
}) => {
    // Permission helper - checks if user has a specific permission
    const hasPermission = (perm) => {
        const perms = user?.permissions || [];
        return perms.includes('all') || perms.includes(perm);
    };

    // Beta feature helper - checks if user's org has a beta feature enabled
    // Admins always have access to all beta features
    const hasBetaFeature = (featureId) => {
        if (user?.isAdmin || (user?.permissions || []).includes('all')) return true;
        const features = Array.isArray(user?.betaFeatures) ? user.betaFeatures : [];
        return features.includes(featureId);
    };

    // Viewport detection — shared hook (see hooks/useViewport.js).
    //   isMobile  <768  — hamburger/overlay patterns
    //   isCompact 768–1279 — 13" laptops: auto-collapse sidebar, notebook as drawer
    //   isDesktop >=1280  — full split-pane layout
    const { isMobile, isCompact } = useViewport();

    // Notebook layout: split-pane sibling column at every breakpoint above
    // mobile. On compact (13" laptops) it takes a fixed ~420 px width so the
    // chat keeps usable room; on desktop it splits 50/50 with the chat. No
    // floating drawer or scrim — the notebook simply sits to the right of
    // the chat, the way users expect a split workspace.
    const notebookWrapperClass = isCompact
        ? "w-[420px] flex-shrink-0 flex flex-col h-full border-l border-[var(--border-subtle)] animate-in slide-in-from-right duration-300"
        : "w-1/2 min-w-[400px] flex flex-col h-full border-l border-[var(--border-subtle)] animate-in slide-in-from-right duration-300";

    // Feature flags
    // Simple Mode also forces notebooks off — the toggle in /settings/simple-mode
    // hides the panel + buttons until the user turns Simple Mode back off.
    const notebooksEnabled = !user?.simpleMode && user?.featureFlags?.notebooks !== false;
    const projectsEnabled = user?.featureFlags?.projects !== false;

    // Core State
    const [agents, setAgents] = useState([]);
    const [agentCategories, setAgentCategories] = useState([]);
    const [selectedAgent, setSelectedAgent] = useState(null);
    const [conversations, setConversations] = useState([]);
    const [currentConversation, setCurrentConversation] = useState(null);
    // Sidebar defaults to its full-width state only on true desktops (>=1280).
    // Default to expanded on anything wider than a tablet; only small screens
    // start in icon-rail mode. The user can still toggle it.
    const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 768);
    const [studioFullscreen, setStudioFullscreen] = useState(false);
    // Collapse the main sidebar to its icon-rail whenever Studio is open OR a
    // child explicitly asks for fullscreen (legacy path used by AgentStudio's
    // edit mode). Stash the prior expanded/collapsed state so we can restore
    // it when the user navigates back out of Studio.
    const collapseForStudio = showStudio || studioFullscreen;
    const sidebarOpenBeforeStudioRef = useRef(null);
    useEffect(() => {
        if (collapseForStudio) {
            if (sidebarOpenBeforeStudioRef.current === null) {
                sidebarOpenBeforeStudioRef.current = sidebarOpen;
            }
            if (sidebarOpen) setSidebarOpen(false);
        } else if (sidebarOpenBeforeStudioRef.current !== null) {
            const restore = sidebarOpenBeforeStudioRef.current;
            sidebarOpenBeforeStudioRef.current = null;
            if (restore) setSidebarOpen(true);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [collapseForStudio]);
    const [notebookContent, setNotebookContent] = useState('');
    const [notebookLastFetchedId, setNotebookLastFetchedId] = useState(null);
    const [notebookSelection, setNotebookSelection] = useState('');
    const [showNotebook, setShowNotebook] = useState(false);
    const [notebookLinkedId, setNotebookLinkedId] = useState(null);
    const [showGammaPreview, setShowGammaPreview] = useState(false);
    const [gammaPreview, setGammaPreview] = useState(null);
    // Webpage side panel — mutually exclusive with the notebook / gamma slot.
    // Holds the id of the webpage currently displayed (null = panel closed).
    const [sidePanelWebpageId, setSidePanelWebpageId] = useState(null);
    // Metadata for the open webpage (resolved once the panel loads it). Used
    // to surface { id, name } to the chat backend so the AI knows what the
    // user is looking at. Server reads sidePanelWebpageId and pulls fresh
    // html/css/js itself — we don't ship the bytes on every chat turn.
    const [sidePanelWebpage, setSidePanelWebpage] = useState(null);
    // Mirror the latest html/css/js of the open webpage. We ship these with
    // every webpage-chat turn so the AI sees the user's current page, and
    // update them locally whenever it edits via webpage_doc_update SSE.
    const [sidePanelWebpageFiles, setSidePanelWebpageFiles] = useState({ html: '', css: '', js: '' });
    // Selection captured from the iframe selection bridge — shown as a chip
    // above the chat input and shipped as `webpageSelection` on next send.
    const [attachedWebpageSelection, setAttachedWebpageSelection] = useState(null);
    // Bumped to force SideWebpagePanel to re-fetch after AI edits land —
    // simpler than threading mutable state through the preview.
    const [sidePanelReloadKey, setSidePanelReloadKey] = useState(0);
    const [webpagePickerOpen, setWebpagePickerOpen] = useState(false);
    const webpageButtonRef = useRef(null);
    const webpageButtonRefDirect = useRef(null);
    const canUseWebpagesSide = !user?.simpleMode && !!(user?.canUseFeature?.webpages ?? (user?.permissions?.includes('all') || user?.betaFeatures?.includes('webpages')));

    const toggleNotebookPanel = useCallback(() => {
        setShowNotebook(prev => {
            const next = !prev;
            if (next) {
                setShowGammaPreview(false);
                setSidePanelWebpageId(null);
            }
            return next;
        });
    }, []);

    const closeSidePreview = useCallback(() => {
        setShowNotebook(false);
        setShowGammaPreview(false);
        setSidePanelWebpageId(null);
    }, []);

    const openWebpageInSidePanel = useCallback((id) => {
        if (!id) return;
        setSidePanelWebpageId(prev => {
            // Drop stale metadata when switching to a different webpage so the
            // chat payload doesn't carry the previous page's name briefly.
            if (prev !== id) setSidePanelWebpage(null);
            return id;
        });
        setShowNotebook(false);
        setShowGammaPreview(false);
        setWebpagePickerOpen(false);
    }, []);

    const closeWebpagePanel = useCallback(() => {
        setSidePanelWebpageId(null);
        setSidePanelWebpage(null);
        setSidePanelWebpageFiles({ html: '', css: '', js: '' });
        setAttachedWebpageSelection(null);
    }, []);

    const clearWebpageSelection = useCallback(() => setAttachedWebpageSelection(null), []);

    // WebpageLinkCard in a chat message dispatches this event so we can host
    // the webpage in the side slot without losing chat context. Listener
    // calls preventDefault() to claim it — the card falls back to navigation
    // when no listener (e.g. message rendered outside the chat shell).
    useEffect(() => {
        const onOpenSide = (e) => {
            const id = e?.detail?.id;
            if (!id) return;
            e.preventDefault();
            openWebpageInSidePanel(id);
        };
        window.addEventListener('beeflow:open-webpage-side', onOpenSide);
        return () => window.removeEventListener('beeflow:open-webpage-side', onOpenSide);
    }, [openWebpageInSidePanel]);

    // When Simple Mode is turned ON, force-close any open side panels — the
    // panel buttons disappear in the same frame so we'd otherwise leave the
    // panel orphaned on screen with no way to close it. Also force the model
    // tier back to 'auto' since the selector is hidden.
    useEffect(() => {
        const on = !!user?.simpleMode;
        // Broadcast so deep descendants (e.g. MessageItem) can hide
        // surface-level features like the "How I got this answer" panel
        // without prop-drilling. Mirrors the chatHistoryMode pattern.
        if (typeof window !== 'undefined') {
            window.__beeflowSimpleMode = on;
            window.dispatchEvent(new CustomEvent('beeflow:simpleModeChanged', { detail: on }));
        }
        if (on) {
            setShowNotebook(false);
            setShowGammaPreview(false);
            setSidePanelWebpageId(null);
            setSidePanelWebpage(null);
            setSelectedTier('auto');
        }
    }, [user?.simpleMode]);

    // Direct Chat State
    const [directChatMode, setDirectChatMode] = useState(() => window.innerWidth < 768);
    const [selectedTier, setSelectedTier] = useState('auto');
    const [modelTiers, setModelTiers] = useState({});
    const [directConversations, setDirectConversations] = useState([]);
    const [currentDirectConversation, setCurrentDirectConversation] = useState(null);
    const [chatInput, setChatInput] = useState('');

    useEffect(() => {
        setShowGammaPreview(false);
        setGammaPreview(null);
    }, [directChatMode]);

    // Projects State
    const [projects, setProjects] = useState([]);
    const [activeProject, setActiveProject] = useState(null);
    const [showProjectsStore, setShowProjectsStore] = useState(false);
    // null = closed, '' = create-new, otherwise an existing project id
    const [activeProjectId, setActiveProjectId] = useState(null);

    // Conversation Labels State
    const [conversationLabels, setConversationLabels] = useState([]);

    // Chat History Mode — "per-agent" (default) or "all-chats" (unified timeline).
    // Initial value is null because scopedStorage isn't populated until App.jsx's
    // setCurrentUser fires. The useEffect below hydrates on first render.
    const [chatHistoryMode, setChatHistoryMode] = useState('per-agent');
    const [allAgentConversations, setAllAgentConversations] = useState([]);

    // Skills State (must be declared before useChatEngine so it can reference activeSkillIds)
    const [activeSkillIds, setActiveSkillIds] = useState([]);
    const [directSessionSkills, setDirectSessionSkills] = useState([]);
    const [directActivatedSessionSkillIds, setDirectActivatedSessionSkillIds] = useState([]);
    // Knowledge bases attached to the current direct chat (per-session, not persisted).
    const [directChatKBIds, setDirectChatKBIds] = useState([]);
    const [directCompletedSessionSkillIds, setDirectCompletedSessionSkillIds] = useState([]);

    // Hydrate user-scoped preferences once the user id is known.
    //
    // The original implementation chained the favorites fetch and the
    // legacy-favorites migration sequentially, gating first paint on both.
    // We now:
    //   1. Read local prefs synchronously (fast).
    //   2. Start the favorites GET — set state as soon as it lands so the
    //      sidebar can render its primary list.
    //   3. If a legacy migration is needed, run it in the background after
    //      the GET resolves — it must NOT block first paint, and a missing
    //      migration result silently falls back to the server response.
    useEffect(() => {
        if (!user?.id) return;
        // React fires child effects before parent effects on mount, so App.jsx's
        // scopedStorage.setCurrentUser hasn't run yet on first hydration. Set it
        // here (idempotent) so getItem returns the stored value instead of null.
        scopedStorage.setCurrentUser(user.id);
        const storedMode = scopedStorage.getItem('chatHistoryMode');
        if (storedMode) setChatHistoryMode(storedMode);
        const storedSkills = scopedStorage.getJSON('activeSkillIds', null);
        if (Array.isArray(storedSkills)) setActiveSkillIds(storedSkills);

        let cancelled = false;
        (async () => {
            try {
                const res = await authFetch(`${API_BASE}/agents/favorites`);
                if (!res.ok) return;
                const serverFavs = await res.json();
                if (cancelled) return;
                const legacy = scopedStorage.getJSON('agentFavorites', null);
                const needsMigration =
                    Array.isArray(legacy) && legacy.length &&
                    Array.isArray(serverFavs) && serverFavs.length === 0;

                // Set whatever the server returned right away so the sidebar
                // can render. Migration (if needed) replaces this value later.
                setFavorites(Array.isArray(serverFavs) ? serverFavs : []);
                if (Array.isArray(legacy) && !needsMigration) {
                    scopedStorage.removeItem('agentFavorites');
                }

                if (needsMigration) {
                    // Background: replace the list with the merged result once
                    // the bulk upload comes back. Errors don't roll the UI back
                    // — the server state we just rendered is still correct.
                    authFetch(`${API_BASE}/agents/favorites/bulk`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ agentIds: legacy }),
                    }).then(async (bulkRes) => {
                        if (cancelled || !bulkRes.ok) return;
                        const merged = await bulkRes.json();
                        if (cancelled) return;
                        setFavorites(Array.isArray(merged) ? merged : []);
                        scopedStorage.removeItem('agentFavorites');
                    }).catch((e) => {
                        if (!cancelled) console.warn('[AgentHub] favorites migration failed:', e);
                    });
                }
            } catch (e) {
                console.warn('[AgentHub] Failed to load agent favorites from server:', e);
            }
        })();
        return () => { cancelled = true; };
    }, [user?.id]);

    // Chat engine hook — owns messages, isLoading, sendMessage, stopGenerating
    const { messages, setMessages, isLoading, sendMessage, stopGenerating, retryMessage, editAndRegenerate } = useChatEngine({
        selectedAgent,
        currentConversation: directChatMode ? currentDirectConversation : currentConversation,
        onConversationCreated: useCallback((conversationId) => {
            setCurrentConversation(prev => ({ ...prev, id: conversationId }));
            if (selectedAgent) {
                updateAgentUrl(selectedAgent.id, conversationId);
                loadConversations(selectedAgent.id);
            }
        }, [selectedAgent]),
        getNotebookPayload: useCallback(() => {
            // `notebookspaceAvailable: true` flags that the Notebook panel exists
            // in this UI even when it's currently closed — so the model can call
            // notebook_write to start a memo and the panel auto-opens via the
            // workspace_update SSE event. `notebookspaceContent` is only sent
            // when the panel is open (server treats `undefined` as "no notebook
            // currently rendered", `""` as "open but blank").
            return {
                notebookspaceAvailable: true,
                ...(showNotebook ? {
                    notebookspaceContent: notebookContent || '',
                    notebookspaceSelection: notebookSelection || '',
                } : {}),
                // Webpage side panel — tell the AI which page the user is
                // currently viewing. Server fetches the latest html/css/js
                // by id; we only send the metadata so chat payloads stay small.
                ...(sidePanelWebpageId ? {
                    sidePanelWebpage: {
                        id: sidePanelWebpageId,
                        ...(sidePanelWebpage?.name ? { name: sidePanelWebpage.name } : {}),
                        ...(sidePanelWebpage?.description ? { description: sidePanelWebpage.description } : {}),
                    },
                } : {}),
            };
        }, [notebookContent, notebookSelection, showNotebook, sidePanelWebpageId, sidePanelWebpage]),
        onNotebookUpdate: useCallback((content) => {
            // On mobile, silently ignore notebook writes from AI
            if (window.innerWidth < 768) return;
            setShowGammaPreview(false);
            setNotebookContent(content);
            if (content && content.trim()) setShowNotebook(true);
        }, []),
        onGammaPreview: useCallback((preview) => {
            if (window.innerWidth < 768) return;
            setGammaPreview(prev => ({ ...(prev || {}), ...preview }));
            setShowNotebook(false);
            setShowGammaPreview(true);
        }, []),
        directMode: directChatMode ? {
            enabled: true,
            modelTier: selectedTier,
            // When the user has a webpage open in the side panel we reroute the
            // chat to the dedicated webpage endpoint — same one the standalone
            // Webpage Editor uses, so the AI gets the full toolbelt
            // (file/multi-file/db tools + sources).
            ...(sidePanelWebpageId ? { customEndpoint: '/ai/chat/webpage/stream' } : {}),
            getExtraPayload: () => ({
                ...(Array.isArray(directSessionSkills) && directSessionSkills.length > 0 ? { sessionSkills: directSessionSkills } : {}),
                ...(Array.isArray(directActivatedSessionSkillIds) && directActivatedSessionSkillIds.length > 0 ? { activatedSessionSkillIds: directActivatedSessionSkillIds } : {}),
                ...(Array.isArray(directChatKBIds) && directChatKBIds.length > 0 ? { knowledgeBaseIds: directChatKBIds } : {}),
                ...(sidePanelWebpageId ? {
                    webpageId: sidePanelWebpageId,
                    htmlContent: sidePanelWebpageFiles.html,
                    cssContent: sidePanelWebpageFiles.css,
                    jsContent: sidePanelWebpageFiles.js,
                    chatMode: 'auto',
                    ...(attachedWebpageSelection ? {
                        webpageSelection: {
                            text: attachedWebpageSelection.text,
                            file: 'html',
                        },
                    } : {}),
                } : {}),
            }),
        } : undefined,
        onWebpageDocUpdate: useCallback((data) => {
            const { file, content } = data || {};
            if (!file) return;
            setSidePanelWebpageFiles(prev => ({ ...prev, [file]: content || '' }));
            setSidePanelReloadKey(k => k + 1);
        }, []),
        onWebpageExtraUpdate: useCallback(() => {
            setSidePanelReloadKey(k => k + 1);
        }, []),
        onWebpageExtraDeleted: useCallback(() => {
            setSidePanelReloadKey(k => k + 1);
        }, []),
        onWebpageSourceAdded: useCallback(() => { /* surfaced inline in chat; no panel action */ }, []),
        activeProject,
        onDirectConversationCreated: useCallback(({ conversationId, title }) => {
            if (conversationId && !currentDirectConversation?.id) {
                setCurrentDirectConversation(prev => ({ ...prev, id: conversationId }));
                updateDirectChatUrl(conversationId);
            }
            if (title) {
                setCurrentDirectConversation(prev => prev ? { ...prev, title } : prev);
            }
            // Refresh conversations list
            loadDirectConversations();
        }, [currentDirectConversation]),
        activeSkillIds,
        onSessionSkillsChanged: useCallback(({ skills, activatedSkillIds, completedSkillIds }) => {
            setDirectSessionSkills(Array.isArray(skills) ? skills : []);
            setDirectActivatedSessionSkillIds(Array.isArray(activatedSkillIds) ? activatedSkillIds : []);
            if (Array.isArray(completedSkillIds)) {
                setDirectCompletedSessionSkillIds(completedSkillIds);
            }
        }, []),
    });

    // Voice Chat (Beta) — completed voice turns flow up from the embedded
    // VoiceInlinePanel and are injected into the chat conversation here so
    // they render as regular MessageItem bubbles. Voice messages carry a
    // `source: 'voice'` marker plus an optional `tools` array (chip data).
    const handleVoiceTurnComplete = useCallback(({ user: userMsg, assistant: assistantMsg }) => {
        if (!userMsg) return;
        const timestamp = new Date().toISOString();
        const newMessages = [{
            id: generateMessageId(),
            role: 'user',
            content: userMsg.content || '',
            attachments: [],
            timestamp,
            source: 'voice',
        }];
        if (assistantMsg) {
            newMessages.push({
                id: generateMessageId(),
                role: 'assistant',
                content: assistantMsg.content || '',
                respondingAgentId: selectedAgent?.id || 'direct',
                respondingAgentName: selectedAgent?.name || null,
                respondingAgentAvatar: pickAgentAvatar(selectedAgent) || DEFAULT_AGENT_EMOJI,
                timestamp,
                source: 'voice',
                voiceTools: Array.isArray(assistantMsg.tools) ? assistantMsg.tools : [],
            });
        }
        setMessages(prev => [...prev, ...newMessages]);
        shouldForceScrollRef.current = true;
    }, [selectedAgent, setMessages]);




    // Skills handlers
    const handleToggleSkill = useCallback((skillId) => {
        setActiveSkillIds(prev => {
            const next = prev.includes(skillId)
                ? prev.filter(id => id !== skillId)
                : [...prev.slice(0, 4), skillId]; // max 5
            scopedStorage.setJSON('activeSkillIds', next);
            return next;
        });
    }, []);

    // Skills attached to the currently selected agent via agent.config.attachedSkillIds
    const agentAttachedSkillIds = useMemo(() => {
        const ids = selectedAgent?.config?.attachedSkillIds;
        return Array.isArray(ids) ? ids : [];
    }, [selectedAgent]);

    // UI/Mode State
    const [designMode, setDesignMode] = useState(false);
    const [createMode, setCreateMode] = useState(false);
    const [showMarketplace, setShowMarketplace] = useState(false);
    const [showKBStore, setShowKBStore] = useState(false);
    const [activeKBId, setActiveKBId] = useState(null); // null = closed, '' = create-new, otherwise an id
    const [kbs, setKbs] = useState([]);
    const [kbCategories, setKbCategories] = useState([]);
    const [kbFavorites, setKbFavorites] = useState([]);
    const [kbsLoadedOnce, setKbsLoadedOnce] = useState(false);
    // Direct-chat picker only sees KBs whose usage_contexts include 'direct_chat'.
    // (The Knowledge Bases marketplace continues to show the full `kbs` list.)
    const directChatKbs = useMemo(() => (kbs || []).filter(kb => {
        const ctx = kb.usage_contexts;
        if (Array.isArray(ctx)) return ctx.includes('direct_chat');
        if (typeof ctx === 'string') {
            try { const v = JSON.parse(ctx); return Array.isArray(v) && v.includes('direct_chat'); } catch { return true; }
        }
        return true; // legacy rows without the column → include by default
    }), [kbs]);
    const [showSearch, setShowSearch] = useState(false);

    // Admin Theme Studio preview: when the iframe URL contains
    // ?themePreview=1, honour the optional hints — `overlay=search` auto-opens
    // the search overlay, `sidebar=collapsed` folds the conversation rail so
    // a Settings/Studio preview reads cleaner without the chat list dominating.
    useEffect(() => {
        try {
            const params = new URLSearchParams(window.location.search);
            if (params.get('themePreview') !== '1') return;
            if (params.get('overlay') === 'search') setShowSearch(true);
            if (params.get('sidebar') === 'collapsed') setSidebarOpen(false);
        } catch (_) { /* search params unavailable */ }
    }, []);

    const [showMemoryPanel, setShowMemoryPanel] = useState(false);
    const [showAgentMenu, setShowAgentMenu] = useState(false);

    // Favourites hydrate per-user via the same `user?.id` effect below.
    const [favorites, setFavorites] = useState([]);

    const messagesEndRef = useRef(null);
    const messagesContainerRef = useRef(null);
    const shouldForceScrollRef = useRef(false);
    const hasInitialized = useRef(false);
    const pendingConversationId = useRef(initialConversationId);
    const pendingDirectConvId = useRef(initialDirectConvId);

    // URL sync helper — updates browser URL to reflect selected agent/conversation
    // Uses first 8 chars of IDs for clean short URLs
    const updateAgentUrl = useCallback((agentId, conversationId) => {
        if (!agentId) {
            // Don't reset URL if in direct chat mode (handled by updateDirectChatUrl)
            if (!window.location.pathname.startsWith('/d/')) {
                window.history.replaceState({}, '', '/');
            }
            return;
        }
        const shortAgent = agentId.substring(0, 8);
        const path = conversationId
            ? `/a/${shortAgent}/${conversationId.substring(0, 8)}`
            : `/a/${shortAgent}`;
        window.history.replaceState({}, '', path);
    }, []);

    // URL sync helper for direct chat — /d/:8chars
    const updateDirectChatUrl = useCallback((convId) => {
        if (!convId) {
            window.history.replaceState({}, '', '/');
            return;
        }
        const shortConv = convId.substring(0, 8);
        window.history.replaceState({}, '', `/d/${shortConv}`);
    }, []);

    // --- Hooks ---


    const sendMessageRef = useRef(null);



    // --- Effects ---

    const scrollToBottom = (behavior = 'smooth') => {
        messagesEndRef.current?.scrollIntoView({ behavior });
    };

    useEffect(() => {
        const lastMsg = messages[messages.length - 1];
        const isStreaming = lastMsg?.isStreaming;

        // Force-scroll when user just sent a message
        if (shouldForceScrollRef.current) {
            shouldForceScrollRef.current = false;
            scrollToBottom('auto');
            return;
        }

        // Smart scroll: only auto-scroll if user is near the bottom
        const container = messagesContainerRef.current;
        if (container) {
            const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
            const isNearBottom = distanceFromBottom < 300;
            if (isNearBottom) {
                scrollToBottom(isStreaming ? 'auto' : 'smooth');
            }
        } else {
            scrollToBottom(isStreaming ? 'auto' : 'smooth');
        }
    }, [messages]);

    useEffect(() => {
        sendMessageRef.current = (text) => sendMessage(text, []);
    }, [selectedAgent, isLoading]);

    // Global Cmd/Ctrl+K to open Search
    useEffect(() => {
        const onKey = (e) => {
            if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setShowSearch(prev => !prev);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);



    // Reusable function to (re-)fetch the agent list shown across the hub.
    // Merges two sources so the list matches what the user can actually open:
    //   1. /agents/published — agents published in the user's org / groups
    //   2. /agents          — the user's own agents, INCLUDING personal drafts
    // Without (2), an agent set to "Personal" disappeared from the marketplace
    // for its own owner, even though they're the only person who can use it.
    const refreshAgents = useCallback(async () => {
        try {
            const [publishedRes, ownRes] = await Promise.all([
                authFetch(`${API_BASE}/agents/published?t=${Date.now()}`, { cache: 'no-store' }),
                authFetch(`${API_BASE}/agents?t=${Date.now()}`, { cache: 'no-store' }),
            ]);
            if (publishedRes.ok || ownRes.ok) {
                const published = publishedRes.ok ? await publishedRes.json() : [];
                const own = ownRes.ok ? await ownRes.json() : [];
                // Dedup by id — published records are authoritative when both
                // lists return the same agent (they carry parsed tool_params).
                const byId = new Map();
                for (const a of (Array.isArray(own) ? own : [])) byId.set(a.id, a);
                for (const a of (Array.isArray(published) ? published : [])) byId.set(a.id, a);
                const merged = Array.from(byId.values());
                setAgents(merged);

                // Also load agent categories
                try {
                    const catRes = await authFetch(`${API_BASE}/agents/categories`);
                    if (catRes.ok) {
                        const cats = await catRes.json();
                        setAgentCategories(Array.isArray(cats) ? cats : []);
                    }
                } catch (e) { console.warn('Failed to load agent categories', e); }

                return merged;
            }
        } catch (err) {
            console.error("Failed to refresh agents", err);
        }
        return null;
    }, [user]);

    // Refresh agents whenever the Agent Store (marketplace) opens
    useEffect(() => {
        if (showMarketplace) refreshAgents();
    }, [showMarketplace, refreshAgents]);

    // ── Knowledge Bases ────────────────────────────────────────────────
    const refreshKBs = useCallback(async () => {
        try {
            const [kbRes, catRes] = await Promise.all([
                // Studio is for KBs managed by the user. Webpage-owned KBs (auto-created
                // or explicitly tagged) are managed inside the webpage UI, not here.
                authFetch(`${API_BASE}/api/kb?excludeContext=webpage&t=${Date.now()}`, { cache: 'no-store' }),
                authFetch(`${API_BASE}/api/kb/categories`),
            ]);
            if (kbRes.ok) {
                const data = await kbRes.json();
                setKbs(Array.isArray(data) ? data : []);
            }
            if (catRes.ok) {
                const cats = await catRes.json();
                setKbCategories(Array.isArray(cats) ? cats : []);
            }
            setKbsLoadedOnce(true);
        } catch (err) {
            console.error('Failed to refresh KBs', err);
        }
    }, []);

    // Refresh KBs whenever the KB store opens
    useEffect(() => {
        if (showKBStore) refreshKBs();
    }, [showKBStore, refreshKBs]);

    // Lazy-load KBs the first time direct chat is active, so the input-area
    // picker has data to show without forcing the user to open the store first.
    useEffect(() => {
        if (directChatMode && !kbsLoadedOnce) refreshKBs();
    }, [directChatMode, kbsLoadedOnce, refreshKBs]);

    // Close KB and Projects views when the user navigates to a chat (agent or direct).
    // Mirrors how the agent marketplace closes itself in handleSelectAgent etc.
    useEffect(() => {
        if (showMarketplace || showSettings || showAgentDesigner || showAgentWizard || showStudio || showSkillsPanel || showEmailKB || showAITasks) {
            setShowKBStore(false);
            setActiveKBId(null);
            setShowProjectsStore(false);
            setActiveProjectId(null);
        }
    }, [showMarketplace, showSettings, showAgentDesigner, showAgentWizard, showStudio, showSkillsPanel, showEmailKB, showAITasks]);

    // KB favourites: load from server, with one-time migration of any legacy
    // localStorage favorites left over from the client-side implementation.
    useEffect(() => {
        if (!user?.id) return;
        let cancelled = false;
        (async () => {
            try {
                const res = await authFetch(`${API_BASE}/api/kb/favorites`);
                if (!res.ok) return;
                const serverFavs = await res.json();
                const legacy = scopedStorage.getJSON('kb_favorites', null);
                if (Array.isArray(legacy) && legacy.length && Array.isArray(serverFavs) && serverFavs.length === 0) {
                    const bulkRes = await authFetch(`${API_BASE}/api/kb/favorites/bulk`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ kbIds: legacy }),
                    });
                    if (bulkRes.ok) {
                        const merged = await bulkRes.json();
                        if (!cancelled) setKbFavorites(Array.isArray(merged) ? merged : []);
                        scopedStorage.removeItem('kb_favorites');
                        return;
                    }
                }
                if (!cancelled) setKbFavorites(Array.isArray(serverFavs) ? serverFavs : []);
                if (Array.isArray(legacy)) scopedStorage.removeItem('kb_favorites');
            } catch (e) {
                console.warn('[AgentHub] Failed to load KB favorites from server:', e);
            }
        })();
        return () => { cancelled = true; };
    }, [user?.id]);

    const handleToggleKBFavorite = useCallback(async (id) => {
        let prevSnapshot = null;
        setKbFavorites(prev => {
            prevSnapshot = prev;
            return prev.includes(id) ? prev.filter(k => k !== id) : [...prev, id];
        });
        const wasFav = Array.isArray(prevSnapshot) && prevSnapshot.includes(id);
        try {
            const res = await authFetch(`${API_BASE}/api/kb/${id}/favorite`, {
                method: wasFav ? 'DELETE' : 'PUT',
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
        } catch (e) {
            console.error('[AgentHub] Failed to toggle KB favorite:', e);
            if (Array.isArray(prevSnapshot)) setKbFavorites(prevSnapshot);
        }
    }, []);

    const handleUnpublishKB = useCallback(async (kbId) => {
        try {
            const res = await authFetch(`${API_BASE}/api/kb/${kbId}/publish`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isPublished: false, sharedGroups: [] }),
            });
            if (res.ok) refreshKBs();
        } catch (e) { console.error('Failed to unpublish KB', e); }
    }, [refreshKBs]);

    // Load Agents and Handle Startup Logic
    useEffect(() => {
        const loadAgents = async () => {
            const data = await refreshAgents();
            if (!data) return;

            loadLabels(); // Always load labels on init

            // Startup Logic — URL agent takes priority over scopedStorage.
            // These four keys are user-specific preferences so they must not
                // survive an account switch on a shared browser.
            let targetId = initialAgentId;
            if (!targetId && !initialDirectConvId) {
                const mode = scopedStorage.getItem('defaultAgentMode') || 'last-used';
                const defaultId = scopedStorage.getItem('defaultAgentId');
                const lastUsedId = scopedStorage.getItem('lastUsedAgentId');
                if (mode === 'direct-chat') {
                    setDirectChatMode(true);
                    loadDirectConversations();
                    loadLabels();
                    loadModelTiers();
                } else if (mode === 'specific' && defaultId) {
                    targetId = defaultId;
                } else if (mode === 'last-used') {
                    const lastMode = scopedStorage.getItem('lastUsedMode');
                    if (lastMode === 'direct-chat') {
                        setDirectChatMode(true);
                        loadDirectConversations();
                        loadLabels();
                        loadModelTiers();
                    } else if (lastUsedId) {
                        targetId = lastUsedId;
                    }
                }
            }

            // Auto-load direct chat conversation from URL /d/:convId
            if (initialDirectConvId) {
                setDirectChatMode(true);
                loadModelTiers();
                loadLabels();
                loadDirectConversations().then(async () => {
                    try {
                        const convPrefix = initialDirectConvId;
                        const listRes = await authFetch(`${API_BASE}/ai/direct/conversations`);
                        if (listRes.ok) {
                            const convs = await listRes.json();
                            const match = convs.find(c => c.id === convPrefix || c.id.startsWith(convPrefix));
                            if (match) {
                                const detailRes = await authFetch(`${API_BASE}/ai/direct/conversations/${match.id}`);
                                if (detailRes.ok) {
                                    const detailData = await detailRes.json();
                                    setCurrentDirectConversation(detailData);
                                    // normalizeLoadedMessages also marks policy-removed messages as deleted.
                                    setMessages(normalizeLoadedMessages(detailData.messages || []));
                                    if (detailData.model_tier) setSelectedTier(detailData.model_tier);
                                    updateDirectChatUrl(match.id);

                                    // Fetch notebook content
                                    try {
                                        const wsRes = await authFetch(`${API_BASE}/ai/direct/conversations/${match.id}/workspace`);
                                        if (wsRes.ok) {
                                            const wsData = await wsRes.json();
                                            const convContent = wsData.content || '';
                                            setNotebookLinkedId(wsData.notebookId || null);
                                            if (convContent.trim().length > 0) {
                                                setNotebookContent(convContent);
                                                setShowNotebook(true);
                                            }
                                        }
                                    } catch (wsErr) {
                                        console.error('Failed to fetch direct notebook from URL:', wsErr);
                                    }
                                }
                            }
                        }
                    } catch (e) { console.error('Failed to load direct conversation from URL:', e); }
                });
                scopedStorage.setItem('lastUsedMode', 'direct-chat');
            }

            if (targetId) {
                const targetAgent = data.find(a => a.id === targetId || a.id.startsWith(targetId));
                if (targetAgent) {
                    setSelectedAgent(targetAgent);
                }
            }
        };
        loadAgents();
    }, []);

    // Load Conversations when Agent Selected
    const loadConversations = useCallback(async (agentId) => {
        if (!agentId) return;
        try {
            const res = await authFetch(`${API_BASE}/agents/${agentId}/conversations`);
            if (res.ok) {
                const data = await res.json();
                setConversations(data.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)));
            }
        } catch (err) {
            console.error("Failed to load conversations", err);
        }
    }, []);

    useEffect(() => {
        if (selectedAgent) {
            loadConversations(selectedAgent.id).then(async () => {
                // Auto-select conversation from URL on initial load
                if (pendingConversationId.current) {
                    const convPrefix = pendingConversationId.current;
                    pendingConversationId.current = null; // only once
                    // Find full conversation ID by prefix match
                    const res2 = await authFetch(`${API_BASE}/agents/${selectedAgent.id}/conversations`);
                    if (res2.ok) {
                        const convs = await res2.json();
                        const match = convs.find(c => c.id === convPrefix || c.id.startsWith(convPrefix));
                        if (match) {
                            selectConversation(selectedAgent.id, match.id);
                        }
                    }
                } else {
                    updateAgentUrl(selectedAgent.id, null);
                }
            });
        } else {
            setConversations([]);
            setMessages([]);
            setCurrentConversation(null);
            setNotebookContent('');
            setNotebookSelection('');
            setShowNotebook(false);
            setNotebookLinkedId(null);
        }
    }, [selectedAgent, loadConversations]);

    // Load Messages when Conversation Selected
    const selectConversation = async (agentId, convId) => {
        try {
            const res = await authFetch(`${API_BASE}/agents/${agentId}/conversations/${convId}`);
            if (res.ok) {
                const data = await res.json();
                setCurrentConversation(data);
                updateAgentUrl(agentId, data.id);

                // Fetch notebook content — always swap to match the selected conversation
                if (agentId && data.id) {
                    try {
                        const wsRes = await authFetch(`${API_BASE}/agents/${agentId}/conversations/${data.id}/workspace`);
                        if (wsRes.ok) {
                            const wsData = await wsRes.json();
                            const convContent = wsData.content || '';
                            setNotebookLinkedId(wsData.notebookId || null);
                            if (convContent.trim().length > 0) {
                                setNotebookContent(convContent);
                                setShowNotebook(true);
                            } else {
                                // New conversation has no notebook — hide and clear
                                setNotebookContent('');
                                setShowNotebook(false);
                            }
                            setNotebookLastFetchedId(data.id);
                        }
                    } catch (e) {
                        console.error('Failed to fetch notebook', e);
                        // Don't clear notebook on fetch error — keep existing content
                    }
                }

                let parsedMessages = [];
                if (typeof data.messages === 'string') {
                    parsedMessages = JSON.parse(data.messages);
                } else {
                    parsedMessages = data.messages || [];
                }

                // Filter out tool messages and empty messages - only show user and assistant with content
                parsedMessages = parsedMessages.filter(m =>
                    m.role !== 'tool' &&
                    ((m.content && typeof m.content === 'string' && m.content.trim().length > 0) || (m.images && m.images.length > 0) || (m.audioFiles && m.audioFiles.length > 0) || (m.videoFiles && m.videoFiles.length > 0) || m.sheetsResults || m.sheetsDrafts || m.sheetsReports || m.emailDrafts || m.calendarDrafts || m.contactsDrafts || (m.attachments && m.attachments.length > 0))
                );

                // Strip streaming-only progress fields — these are only relevant during live chat
                parsedMessages = parsedMessages.map(m => {
                    const { toolCall, isStreaming, ...clean } = m;
                    // Strip raw tool-call JSON blocks from content (e.g. { "action": "generate_image", ... })
                    if (clean.content && typeof clean.content === 'string' && clean.role === 'assistant') {
                        clean.content = clean.content.replace(/\{\s*"action":\s*"[^"]*"\s*,\s*"action_input":\s*"[^"]*"(?:\s*\}\s*,\s*"thought":\s*"[^"]*"\s*\}|\s*\})/g, '').trim();
                    }
                    return clean;
                });

                // Canonicalise thinking shape + deleted flag in one pass.
                parsedMessages = normalizeLoadedMessages(parsedMessages);

                // Remove messages that became empty after cleanup
                parsedMessages = parsedMessages.filter(m =>
                    m.role === 'user' || (m.content && typeof m.content === 'string' && m.content.trim().length > 0) || (m.images && m.images.length > 0) || (m.audioFiles && m.audioFiles.length > 0) || (m.videoFiles && m.videoFiles.length > 0) || m.sheetsResults || m.sheetsDrafts || m.sheetsReports || m.emailDrafts || m.calendarDrafts || m.contactsDrafts
                );

                setMessages(parsedMessages);
            }
        } catch (err) {
            console.error("Failed to load conversation", err);
        }
    };

    // --- Actions ---

    const handleSelectAgent = (agent) => {
        closeAllOverlays();
        setSelectedAgent(agent);
        setDesignMode(false);
        setDirectChatMode(false);

        // Auto-start new chat — reset notebook only when switching agents
        setCurrentConversation({ id: null, title: 'New Chat', messages: [] });
        setMessages([]);
        setNotebookContent('');
        setNotebookSelection('');
        setShowNotebook(false);
        setNotebookLinkedId(null);

        // Auto-close sidebar on mobile
        if (isMobile) setSidebarOpen(false);

        // Persist last used & update URL
        if (agent) {
            scopedStorage.setItem('lastUsedAgentId', agent.id);
            scopedStorage.setItem('lastUsedMode', 'agent');
            updateAgentUrl(agent.id, null);
        } else {
            updateAgentUrl(null, null);
        }
    };

    // --- Direct Chat Handlers ---

    const loadDirectConversations = async () => {
        try {
            const res = await authFetch(`${API_BASE}/ai/direct/conversations`);
            if (res.ok) setDirectConversations(await res.json());
        } catch (e) { console.error('Failed to load direct conversations:', e); }
    };

    const loadLabels = async () => {
        try {
            const res = await authFetch(`${API_BASE}/ai/labels`);
            if (res.ok) setConversationLabels(await res.json());
        } catch (e) { console.error('Failed to load labels:', e); }
    };

    // Load ALL conversations across all agents (for "All Chats" mode)
    const loadAllConversations = useCallback(async () => {
        try {
            const [agentRes, directRes] = await Promise.all([
                authFetch(`${API_BASE}/agents/conversations/all`),
                authFetch(`${API_BASE}/ai/direct/conversations`),
            ]);
            let all = [];
            if (agentRes.ok) {
                const agentConvs = await agentRes.json();
                all = [...agentConvs.map(c => ({ ...c, _source: 'agent' }))];
            }
            if (directRes.ok) {
                const directConvs = await directRes.json();
                all = [...all, ...directConvs.map(c => ({ ...c, _source: 'direct' }))];
            }
            all.sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));
            setAllAgentConversations(all);
        } catch (e) { console.error('Failed to load all conversations:', e); }
    }, []);

    // Load all conversations when mode is 'all-chats'
    useEffect(() => {
        if (chatHistoryMode === 'all-chats') loadAllConversations();
    }, [chatHistoryMode, loadAllConversations]);

    // Listen for mode changes from Settings panel
    useEffect(() => {
        const handler = (e) => {
            setChatHistoryMode(e.detail);
        };
        window.addEventListener('chatHistoryModeChanged', handler);
        return () => window.removeEventListener('chatHistoryModeChanged', handler);
    }, []);

    // Listen for "Open in Direct Chat" events from NotificationCenter (AI Task results)
    useEffect(() => {
        const handler = async (e) => {
            const { title, content, agentId, conversationId } = e.detail || {};
            if (!content) return;

            // R2: routine result came from an agent — open the agent's chat
            // (continuing the same conversation the routine ran in when
            // possible) instead of generic direct chat.
            if (agentId) {
                try {
                    const agentRes = await authFetch(`${API_BASE}/agents/${agentId}`);
                    if (agentRes.ok) {
                        const agent = await agentRes.json();
                        setDirectChatMode(false);
                        setSelectedAgent(agent);
                        scopedStorage.setItem('lastUsedMode', 'agent');
                        if (isMobile) setSidebarOpen(false);

                        // Try to attach the routine's persisted conversation so
                        // the user picks up the same thread the routine wrote
                        // to. Falls back to a fresh thread seeded with the
                        // result if the conversation can't be loaded.
                        if (conversationId) {
                            try { await selectConversation(agentId, conversationId); return; }
                            catch (_) { /* fall through */ }
                        }
                        const now = new Date().toISOString();
                        setCurrentConversation(null);
                        setMessages([
                            { id: generateMessageId(), role: 'user',
                              content: `Show me the result from my routine "${title}"`, timestamp: now },
                            { id: generateMessageId(), role: 'assistant',
                              content, timestamp: now,
                              respondingAgentAvatar: pickAgentAvatar(agent) || DEFAULT_AGENT_EMOJI },
                        ]);
                        return;
                    }
                } catch (err) {
                    console.warn('Failed to open agent for routine result, falling back to direct chat:', err);
                }
            }

            // Default path: direct chat (no agent on the routine, or lookup failed).
            setDirectChatMode(true);
            setSelectedAgent(null);
            setCurrentConversation(null);
            setCurrentDirectConversation(null);
            setMessages([]);
            setNotebookContent('');
            setNotebookSelection('');
            setShowNotebook(false);
            setNotebookLinkedId(null);
            scopedStorage.setItem('lastUsedMode', 'direct-chat');
            loadDirectConversations();
            loadModelTiers();
            updateDirectChatUrl(null);
            if (isMobile) setSidebarOpen(false);

            const now = new Date().toISOString();
            setTimeout(() => {
                setMessages([
                    { id: generateMessageId(), role: 'user',
                      content: `Show me the result from my routine "${title}"`, timestamp: now },
                    { id: generateMessageId(), role: 'assistant',
                      content, timestamp: now, respondingAgentAvatar: '🤖' },
                ]);
            }, 100);
        };
        window.addEventListener('openDirectChatWithContext', handler);
        return () => window.removeEventListener('openDirectChatWithContext', handler);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isMobile]);

    const loadModelTiers = async () => {
        try {
            // Use the permission- and task-aware endpoint so custom tiers appear
            // only when the user's groups grant access AND the tier is allowed
            // for the direct_chat task type. Standard tiers always pass through.
            const res = await authFetch(`${API_BASE}/ai/config/tiers-for-user?taskType=direct_chat`);
            if (res.ok) setModelTiers(await res.json());
        } catch (e) { console.error('Failed to load model tiers:', e); }
    };

    // Non-admins without the skills-beta feature get a filtered modelTiers
    // response (the server omits 'standard'). If our persisted/restored
    // selectedTier is one the server no longer returns, fall back to 'auto'
    // so downstream reads like modelTiers[selectedTier] don't see undefined.
    useEffect(() => {
        const keys = Object.keys(modelTiers || {});
        if (keys.length === 0) return;
        if (!keys.includes(selectedTier)) {
            setSelectedTier(keys.includes('auto') ? 'auto' : keys[0]);
        }
    }, [modelTiers, selectedTier]);

    // Populate a read-only diagnostics bag on window so ErrorBoundary can
    // include role/tier context in crash reports without having to plumb
    // hook state through the boundary.
    useEffect(() => {
        try {
            window.__APP_DIAGNOSTICS__ = {
                userRole: user?.isAdmin ? 'admin' : (user?.role || 'user'),
                featureFlags: {
                    permissions: Array.isArray(user?.permissions) ? user.permissions : [],
                    betaFeatures: Array.isArray(user?.betaFeatures) ? user.betaFeatures : [],
                    selectedTier,
                    modelTierKeys: Object.keys(modelTiers || {}),
                },
            };
        } catch (_) { /* ignore */ }
    }, [user, selectedTier, modelTiers]);

    // --- Projects ---
    const loadProjects = async () => {
        try {
            const res = await authFetch(`${API_BASE}/api/projects`);
            if (res.ok) setProjects(await res.json());
        } catch (e) { console.error('Failed to load projects:', e); }
    };

    // Load projects on mount (only if the feature is enabled for this user)
    useEffect(() => { if (projectsEnabled) loadProjects(); }, [projectsEnabled]);

    const handleMoveToProject = async (conv, targetProject) => {
        try {
            const type = directChatMode ? 'direct' : 'agent';
            if (targetProject) {
                // Assign to project
                await authFetch(`${API_BASE}/api/projects/${targetProject.id}/conversations`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ assign: [{ id: conv.id, type }] }),
                });
            } else {
                // Find current project and unassign
                const currentProjId = conv.project_id;
                if (currentProjId) {
                    await authFetch(`${API_BASE}/api/projects/${currentProjId}/conversations`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ unassign: [{ id: conv.id, type }] }),
                    });
                }
            }
            // Refresh conversation lists to reflect project_id changes
            if (directChatMode) loadDirectConversations();
            else if (selectedAgent) loadConversations(selectedAgent.id);
        } catch (e) {
            console.error('Failed to move conversation to project:', e);
        }
    };

    const handleRenameConversation = async (conv, newTitle) => {
        try {
            if (directChatMode) {
                await authFetch(`${API_BASE}/ai/direct/conversations/${conv.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title: newTitle }),
                });
                setDirectConversations(prev => prev.map(c => c.id === conv.id ? { ...c, title: newTitle } : c));
            } else {
                const agentId = conv.agent_id || selectedAgent?.id;
                await authFetch(`${API_BASE}/agents/${agentId}/conversations/${conv.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title: newTitle }),
                });
                setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, title: newTitle } : c));
            }
        } catch (e) {
            console.error('Failed to rename conversation:', e);
        }
    };

    const handlePinConversation = async (conv) => {
        const newPinned = !conv.pinned;
        try {
            if (directChatMode) {
                await authFetch(`${API_BASE}/ai/direct/conversations/${conv.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ pinned: newPinned }),
                });
                setDirectConversations(prev => prev.map(c => c.id === conv.id ? { ...c, pinned: newPinned } : c));
            } else {
                const agentId = conv.agent_id || selectedAgent?.id;
                await authFetch(`${API_BASE}/agents/${agentId}/conversations/${conv.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ pinned: newPinned }),
                });
                setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, pinned: newPinned } : c));
            }
        } catch (e) {
            console.error('Failed to pin/unpin conversation:', e);
        }
    };

    const handleLabelConversation = async (conv, label) => {
        // Toggle label: if already has it, remove; otherwise add
        const currentLabels = (() => { try { return JSON.parse(conv.labels_json || '[]'); } catch { return []; } })();
        const newLabels = currentLabels.includes(label)
            ? currentLabels.filter(l => l !== label)
            : [...currentLabels, label];
        try {
            if (directChatMode) {
                await authFetch(`${API_BASE}/ai/direct/conversations/${conv.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ labels: newLabels }),
                });
                setDirectConversations(prev => prev.map(c => c.id === conv.id ? { ...c, labels_json: JSON.stringify(newLabels) } : c));
            } else {
                const agentId = conv.agent_id || selectedAgent?.id;
                await authFetch(`${API_BASE}/agents/${agentId}/conversations/${conv.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ labels: newLabels }),
                });
                setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, labels_json: JSON.stringify(newLabels) } : c));
            }
        } catch (e) {
            console.error('Failed to update conversation labels:', e);
        }
    };

    const handleCreateLabel = async (name, color) => {
        try {
            const res = await authFetch(`${API_BASE}/ai/labels`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, color }),
            });
            if (res.ok) {
                const label = await res.json();
                setConversationLabels(prev => [...prev, label]);
                return label;
            }
        } catch (e) {
            console.error('Failed to create label:', e);
        }
    };

    const handleDeleteLabel = async (labelId) => {
        try {
            await authFetch(`${API_BASE}/ai/labels/${labelId}`, { method: 'DELETE' });
            setConversationLabels(prev => prev.filter(l => l.id !== labelId));
        } catch (e) {
            console.error('Failed to delete label:', e);
        }
    };

    const handleEditLabel = async (labelId, updates) => {
        try {
            const res = await authFetch(`${API_BASE}/ai/labels/${labelId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            });
            if (res.ok) {
                setConversationLabels(prev => prev.map(l => l.id === labelId ? { ...l, ...updates } : l));
            }
        } catch (e) {
            console.error('Failed to edit label:', e);
        }
    };

    // Single source of truth for "user navigated somewhere — dismiss every
    // floating overlay first." Without this, opening a chat / notification /
    // marketplace while Studio (or AgentWizard / SkillsPanel / etc) is open
    // leaves the overlay sitting on top of the new content. Every navigation
    // entry point should call this before changing state.
    const closeAllOverlays = () => {
        if (onCloseSettings) onCloseSettings();
        if (onCloseAgentDesigner) onCloseAgentDesigner();
        if (onCloseAgentWizard) onCloseAgentWizard();
        if (onCloseStudio) onCloseStudio();
        if (onCloseAITasks) onCloseAITasks();
        if (onCloseSkillsPanel) onCloseSkillsPanel();
        if (onCloseEmailKB) onCloseEmailKB();
        if (onCloseNotebooks) onCloseNotebooks();
        setShowMarketplace(false);
        setShowKBStore(false);
        setActiveKBId(null);
        setShowProjectsStore(false);
        setActiveProjectId(null);
    };

    const handleDirectChat = () => {
        setDirectChatMode(true);
        setSelectedAgent(null);
        setCurrentConversation(null);
        setMessages([]);
        setCurrentDirectConversation(null);
        setDirectSessionSkills([]);
        setDirectActivatedSessionSkillIds([]);
        setDirectCompletedSessionSkillIds([]);
        setNotebookContent('');
        setNotebookSelection('');
        setShowNotebook(false);
        setNotebookLinkedId(null);
        setSelectedTier('auto');
        setShowMarketplace(false);
        setShowKBStore(false);
        setActiveKBId(null);
        setShowProjectsStore(false);
        setActiveProjectId(null);
        closeAllOverlays();
        scopedStorage.setItem('lastUsedMode', 'direct-chat');
        loadDirectConversations();
        loadModelTiers();
        updateDirectChatUrl(null);
    };

    const handleSelectDirectConversation = async (conv) => {
        try {
            const res = await authFetch(`${API_BASE}/ai/direct/conversations/${conv.id}`);
            if (res.ok) {
                const data = await res.json();
                setCurrentDirectConversation(data);
                setDirectSessionSkills(Array.isArray(data.sessionSkills) ? data.sessionSkills : []);
                setDirectActivatedSessionSkillIds(Array.isArray(data.activatedSessionSkillIds) ? data.activatedSessionSkillIds : []);
                setDirectCompletedSessionSkillIds(Array.isArray(data.completedSessionSkillIds) ? data.completedSessionSkillIds : []);
                // normalizeLoadedMessages handles both the deleted-placeholder
                // marking AND lifting legacy string thinking into the canonical
                // thinkingParts shape the UI expects.
                setMessages(normalizeLoadedMessages(data.messages || []));
                if (data.model_tier) setSelectedTier(data.model_tier);
                updateDirectChatUrl(conv.id);

                // Fetch notebook content — always swap to match the selected conversation
                try {
                    const wsRes = await authFetch(`${API_BASE}/ai/direct/conversations/${conv.id}/workspace`);
                    if (wsRes.ok) {
                        const wsData = await wsRes.json();
                        const convContent = wsData.content || '';
                        setNotebookLinkedId(wsData.notebookId || null);
                        if (convContent.trim().length > 0) {
                            setNotebookContent(convContent);
                            setShowNotebook(true);
                        } else {
                            // New conversation has no notebook — hide and clear
                            setNotebookContent('');
                            setShowNotebook(false);
                        }
                    }
                } catch (e) {
                    console.error('Failed to fetch direct notebook', e);
                }
            }
        } catch (e) { console.error('Failed to load direct conversation:', e); }
    };

    const handleDeleteDirectConversation = async (convId) => {
        try {
            await authFetch(`${API_BASE}/ai/direct/conversations/${convId}`, { method: 'DELETE' });
            setDirectConversations(prev => prev.filter(c => c.id !== convId));
            setAllAgentConversations(prev => prev.filter(c => c.id !== convId));
            if (currentDirectConversation?.id === convId) {
                setCurrentDirectConversation(null);
                setMessages([]);
                setDirectSessionSkills([]);
                setDirectActivatedSessionSkillIds([]);
            }
        } catch (e) { console.error('Failed to delete direct conversation:', e); }
    };

    const handleNewChat = () => {
        closeAllOverlays();
        if (directChatMode) {
            setCurrentDirectConversation(null);
            setMessages([]);
            setDirectSessionSkills([]);
            setDirectActivatedSessionSkillIds([]);
            setNotebookContent('');
            setNotebookSelection('');
            setShowNotebook(false);
            setNotebookLinkedId(null);
            setSelectedTier('auto');
            updateDirectChatUrl(null);
            return;
        }
        if (!selectedAgent) {
            // No agent selected — fall back to direct chat mode
            setDirectChatMode(true);
            setSelectedAgent(null);
            setCurrentDirectConversation(null);
            setMessages([]);
            setDirectSessionSkills([]);
            setDirectActivatedSessionSkillIds([]);
            setNotebookContent('');
            setNotebookSelection('');
            setShowNotebook(false);
            setNotebookLinkedId(null);
            setSelectedTier('auto');
            scopedStorage.setItem('lastUsedMode', 'direct-chat');
            loadDirectConversations();
            loadModelTiers();
            updateDirectChatUrl(null);
            return;
        }
        setCurrentConversation({ id: null, title: 'New Chat', messages: [] });
        setMessages([]);
        setSelectedTier('auto');
        setNotebookContent('');
        setNotebookSelection('');
        setShowNotebook(false);
        setNotebookLinkedId(null);
        updateAgentUrl(selectedAgent.id, null);
    };
    const handleDeleteConversation = async (convId, agentId) => {
        try {
            agentId = agentId || selectedAgent?.id;
            if (!agentId) {
                console.error('Delete failed: no agentId available');
                return;
            }
            const res = await authFetch(`${API_BASE}/agents/${agentId}/conversations/${convId}`, { method: 'DELETE' });
            if (!res.ok) {
                console.error('Delete failed with status:', res.status);
                return;
            }
            setConversations(prev => prev.filter(c => c.id !== convId));
            setAllAgentConversations(prev => prev.filter(c => c.id !== convId));
            if (currentConversation?.id === convId) {
                handleNewChat();
            }
        } catch (err) {
            console.error("Delete failed", err);
        }
    };

    const handleSearchResultSelect = (result) => {
        setShowSearch(false);
        if (result.kind === 'direct') {
            setDirectChatMode(true);
            handleSelectDirectConversation({ id: result.id });
            return;
        }
        // Switch agent if needed
        if (!selectedAgent || selectedAgent.id !== result.agent_id) {
            const agent = agents.find(a => a.id === result.agent_id);
            if (agent) {
                handleSelectAgent(agent);
            }
        }
        // Open conversation
        selectConversation(result.agent_id, result.id);
    };

    const getGroupedConversations = () => {
        const groups = { Today: [], Yesterday: [], 'Last 30 Days': [], Older: [] };

        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        conversations.forEach(c => {
            const date = new Date(c.updated_at);
            const msgStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());

            const diffDays = Math.floor((todayStart - msgStart) / (1000 * 60 * 60 * 24));

            if (diffDays <= 0) groups.Today.push(c);
            else if (diffDays === 1) groups.Yesterday.push(c);
            else if (diffDays <= 30) groups['Last 30 Days'].push(c);
            else groups.Older.push(c);
        });
        return Object.entries(groups).filter(([_, list]) => list.length > 0);
    };

    const handleToggleFavorite = async (id) => {
        const wasFav = favorites.includes(id);
        const newFavs = wasFav ? favorites.filter(f => f !== id) : [...favorites, id];
        setFavorites(newFavs);
        try {
            const res = await authFetch(`${API_BASE}/agents/${id}/favorite`, {
                method: wasFav ? 'DELETE' : 'PUT',
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
        } catch (e) {
            console.error('[AgentHub] Failed to toggle agent favorite:', e);
            setFavorites(favorites);
        }
    };

    const handleUnpublishAgent = async (agentId) => {
        if (!confirm('Unpublish this agent? It will no longer be visible in the Agent Store, but its configuration will be preserved.')) return;
        try {
            const res = await authFetch(`${API_BASE}/agents/${agentId}/publish`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isPublished: false })
            });
            if (res.ok) {
                // If this was the currently selected agent, deselect it
                if (selectedAgent?.id === agentId) {
                    setSelectedAgent(null);
                }
                refreshAgents();
            }
        } catch (err) {
            console.error('Failed to unpublish agent:', err);
        }
    };

    const saveNotebook = async (content, nbId) => {
        setNotebookContent(content); // Optimistic update

        // If a new notebook ID was provided, persist it
        const notebookIdToSave = nbId !== undefined ? nbId : notebookLinkedId;

        try {
            if (directChatMode && currentDirectConversation?.id) {
                // Direct chat notebook save
                await authFetch(`${API_BASE}/ai/direct/conversations/${currentDirectConversation.id}/workspace`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ content, notebookId: notebookIdToSave })
                });
            } else if (selectedAgent && currentConversation?.id) {
                // Agent chat notebook save
                await authFetch(`${API_BASE}/agents/${selectedAgent.id}/conversations/${currentConversation.id}/workspace`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ content, notebookId: notebookIdToSave })
                });
            }
        } catch (err) {
            console.error('Failed to save notebook', err);
        }
    };

    const handleOpenInNotebook = async (markdownContent, existingNotebookId) => {
        try {
            let nbId = existingNotebookId;

            // If no existing notebook, create one
            if (!nbId) {
                const createRes = await authFetch(`${API_BASE}/api/notebooks`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: `Chat Notebook – ${new Date().toLocaleDateString()}` }),
                });
                if (!createRes.ok) throw new Error('Failed to create notebook');
                const { notebook } = await createRes.json();
                nbId = notebook.id;
            }

            // Sync markdown content to the notebook's document field
            await authFetch(`${API_BASE}/api/notebooks/${nbId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ documentContent: markdownContent }),
            });

            // Navigate to the notebook
            if (onNavigate) onNavigate(`notebooks/${nbId}`);
        } catch (err) {
            console.error('[AgentHub] Failed to open in notebook:', err);
        }
    };


    if (designMode) {
        return (
            <Suspense fallback={<LazyFallback />}>
                <AgentDesignerPanel
                    agent={selectedAgent}
                    user={user}
                    onClose={() => setDesignMode(false)}
                    onSave={(newAgent) => {
                        if (newAgent && newAgent.id) {
                            setSelectedAgent(newAgent);
                            refreshAgents();
                        }
                    }}
                    onDelete={() => {
                        setSelectedAgent(null);
                        setDesignMode(false);
                        refreshAgents();
                    }}
                />
            </Suspense>
        );
    }

    return (
        <Suspense fallback={<LazyFallback />}>
        <div className="flex h-full bg-[var(--bg-primary)] overflow-hidden">
            {/* Sidebar */}
            <Sidebar
                isOpen={sidebarOpen}
                isMobile={isMobile}
                onClose={() => setSidebarOpen(false)}
                toggleSidebar={() => setSidebarOpen(!sidebarOpen)}
                onNewChat={handleNewChat}
                selectedAgent={selectedAgent}
                onClearSelection={() => setSelectedAgent(null)}
                favorites={favorites}
                agents={agents}
                groupedConversations={getGroupedConversations()}
                currentConversation={currentConversation}
                onSelectConversation={(conv) => {
                    closeAllOverlays();
                    // Switch agent if the conversation belongs to a different one
                    if (conv.agent_id && (!selectedAgent || selectedAgent.id !== conv.agent_id)) {
                        const agent = agents.find(a => a.id === conv.agent_id);
                        if (agent) {
                            setSelectedAgent(agent);
                            setDirectChatMode(false);
                            scopedStorage.setItem('lastUsedAgentId', agent.id);
                            scopedStorage.setItem('lastUsedMode', 'agent');
                        }
                    }
                    selectConversation(conv.agent_id || selectedAgent?.id, conv.id);
                    if (isMobile) setSidebarOpen(false);
                }}
                onDeleteConversation={handleDeleteConversation}
                onSelectAgent={handleSelectAgent}
                onOpenMarketplace={() => { closeAllOverlays(); setShowMarketplace(true); }}
                onOpenKBStore={() => { closeAllOverlays(); setShowKBStore(true); }}
                onOpenSearch={() => { closeAllOverlays(); setShowSearch(true); }}
                hasPermission={hasPermission}
                user={user}
                onLogout={onLogout}
                onNavigate={onNavigate}
                currentPage={currentPage}
                studioRoute={studioRoute}
                showSettings={showSettings}
                showAgentDesigner={showAgentDesigner}
                showAITasks={showAITasks}
                showSkillsPanel={showSkillsPanel}
                showEmailKB={showEmailKB}
                onDirectChat={handleDirectChat}
                directChatMode={directChatMode}
                directConversations={directConversations}
                onSelectDirectConversation={(conv) => {
                    // Close every overlay before switching to direct chat —
                    // Studio, Agent Wizard, Notebooks, and Webpages were missing
                    // here, so picking a direct chat from history while Studio
                    // was open updated the URL but kept the editor on screen.
                    closeAllOverlays();
                    // Ensure we're in direct chat mode
                    if (!directChatMode) {
                        setDirectChatMode(true);
                        setSelectedAgent(null);
                        scopedStorage.setItem('lastUsedMode', 'direct-chat');
                        loadModelTiers();
                    }
                    handleSelectDirectConversation(conv);
                    if (isMobile) setSidebarOpen(false);
                }}
                onDeleteDirectConversation={handleDeleteDirectConversation}
                currentDirectConversation={currentDirectConversation}
                onToggleFavorite={handleToggleFavorite}
                projects={projects}
                activeProject={activeProject}
                onSelectProject={(p) => setActiveProject(p)}
                onCreateProject={() => {
                    if (onCloseSettings) onCloseSettings();
                    if (onCloseAgentDesigner) onCloseAgentDesigner();
                    if (onCloseAITasks) onCloseAITasks();
                    if (onCloseSkillsPanel) onCloseSkillsPanel();
                    if (onCloseEmailKB) onCloseEmailKB();
                    setShowMarketplace(false);
                    setShowKBStore(false); setActiveKBId(null);
                    setShowProjectsStore(true);
                    setActiveProjectId('');
                }}
                onEditProject={(p) => {
                    if (onCloseSettings) onCloseSettings();
                    if (onCloseAgentDesigner) onCloseAgentDesigner();
                    if (onCloseAITasks) onCloseAITasks();
                    if (onCloseSkillsPanel) onCloseSkillsPanel();
                    if (onCloseEmailKB) onCloseEmailKB();
                    setShowMarketplace(false);
                    setShowKBStore(false); setActiveKBId(null);
                    setShowProjectsStore(true);
                    setActiveProjectId(p.id);
                }}
                onMoveToProject={handleMoveToProject}
                onRenameConversation={handleRenameConversation}
                onPinConversation={handlePinConversation}
                onLabelConversation={handleLabelConversation}
                conversationLabels={conversationLabels}
                onCreateLabel={handleCreateLabel}
                onDeleteLabel={handleDeleteLabel}
                onEditLabel={handleEditLabel}
                chatHistoryMode={chatHistoryMode}
                allAgentConversations={allAgentConversations}
                onSelectAllChatsConversation={(conv) => {
                    // Close every overlay before switching context — Studio, Agent
                    // Wizard, Notebooks, Webpages, etc. were all missing here, which
                    // is why clicking a chat from history while Studio was open
                    // appeared to "do nothing": the conversation loaded behind the
                    // Studio overlay. closeAllOverlays() is the single source of
                    // truth for this and matches the per-agent path above.
                    closeAllOverlays();
                    if (conv._source === 'direct') {
                        // Switch to direct chat mode and open the conversation
                        if (!directChatMode) {
                            setDirectChatMode(true);
                            setSelectedAgent(null);
                            loadModelTiers();
                            scopedStorage.setItem('lastUsedMode', 'direct-chat');
                        }
                        handleSelectDirectConversation(conv);
                    } else {
                        // Switch to the agent and open the conversation
                        const agent = agents.find(a => a.id === conv.agent_id);
                        if (agent && (!selectedAgent || selectedAgent.id !== agent.id)) {
                            setSelectedAgent(agent);
                            setDirectChatMode(false);
                            scopedStorage.setItem('lastUsedAgentId', agent.id);
                            scopedStorage.setItem('lastUsedMode', 'agent');
                        } else if (!agent) {
                            setDirectChatMode(false);
                        }
                        selectConversation(conv.agent_id, conv.id);
                    }
                    if (isMobile) setSidebarOpen(false);
                }}
            />

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 relative">
                {showNotebooks ? (
                    /* Notebooks rendered inline in conversation area (same slot as
                       Settings / Agent Designer) so the app sidebar stays visible.
                       Wrapped in RequireTier so community installs see the upgrade
                       panel instead of a runtime 403 from /api/notebooks. */
                    <RequireTier feature="notebooks">
                        <NotebooksPage
                            user={user}
                            onBack={onCloseNotebooks}
                            initialNotebookId={initialNotebookId}
                            onNotebookChange={onNotebookChange}
                        />
                    </RequireTier>
                ) : showSettings ? (
                    /* Settings rendered inline in conversation area — Open WebUI style */
                    <AdvancedSettings onBack={null} onNavigate={onNavigate} onLogout={onLogout} user={user} onUpdateUser={onUpdateUser} onClose={onCloseSettings} />
                ) : showStudio ? (
                    /* Unified Studio: Agents / Skills / AI Tasks under one shell. */
                    <Studio
                        user={user}
                        section={studioRoute.section}
                        initialAgentId={studioRoute.section === 'agents' ? studioRoute.id : null}
                        initialSkillId={studioRoute.section === 'skills' ? studioRoute.id : null}
                        initialKbId={studioRoute.section === 'knowledge' ? studioRoute.id : null}
                        initialTaskId={studioRoute.section === 'aiTasks' ? studioRoute.id : null}
                        initialWebpageId={studioRoute.section === 'webpages' ? studioRoute.id : null}
                        onClose={onCloseStudio}
                        onNavigate={onNavigate}
                        modelTiers={modelTiers}
                        onEditingChange={setStudioFullscreen}
                        hasPermission={(perm) => {
                            const perms = user?.permissions || [];
                            return perms.includes('all') || perms.includes(perm);
                        }}
                    />
                ) : showAgentDesigner ? (
                    /* Unified Agent Studio: list + wizard split layout. Replaces the
                       legacy AgentDesigner as the primary editor. The legacy form
                       (advanced settings: guardrails, embed, bubble widget, sharing)
                       is still reachable via "Advanced" inside the studio. */
                    <AgentStudio
                        user={user}
                        initialAgentId={initialDesignerAgentId}
                        onClose={onCloseAgentDesigner}
                        onNavigate={onNavigate}
                        hasPermission={(perm) => {
                            const perms = user?.permissions || [];
                            return perms.includes('all') || perms.includes(perm);
                        }}
                    />
                ) : showAgentWizard ? (
                    /* /app/agent-wizard kept as a deep link — same studio, opens in
                       wizard (chat) mode for fresh creation. */
                    <AgentStudio
                        user={user}
                        initialAgentId={null}
                        onClose={onCloseAgentWizard}
                        onNavigate={onNavigate}
                        hasPermission={(perm) => {
                            const perms = user?.permissions || [];
                            return perms.includes('all') || perms.includes(perm);
                        }}
                    />
                ) : showAITasks ? (
                    /* AI Tasks designer rendered inline in conversation area */
                    <AITasksDesigner initialTaskId={initialAITaskId} onClose={onCloseAITasks} modelTiers={modelTiers} />
                ) : showSkillsPanel ? (
                    /* Skills panel rendered inline in conversation area */
                    <SkillsPanel
                        user={user}
                        onClose={onCloseSkillsPanel}
                        activeSkillIds={activeSkillIds}
                        onToggleSkill={handleToggleSkill}
                        agents={agents}
                    />
                ) : showEmailKB ? (
                    /* Email Knowledge Base settings rendered inline.
                       Wrapped in RequireTier so community installs see the
                       upgrade panel rather than an empty page when the
                       backend gates `/api/ticket-assistant` at the router. */
                    <RequireTier feature="ticket_assistant">
                        <EmailKBSettings
                            user={user}
                            onNavigateBack={onCloseEmailKB}
                        />
                    </RequireTier>
                ) : showMarketplace ? (
                    /* Agent Marketplace rendered inline in conversation area */
                    <AgentMarketplace
                        agents={agents}
                        favorites={favorites}
                        categories={agentCategories}
                        onToggleFavorite={handleToggleFavorite}
                        onSelect={handleSelectAgent}
                        onClose={() => setShowMarketplace(false)}
                        onUnpublish={handleUnpublishAgent}
                        onEditAgent={(agent) => { setShowMarketplace(false); onNavigate(agent ? `agentDesigner:${agent.id}` : 'agentDesigner'); }}
                        user={user}
                    />
                ) : (showKBStore && activeKBId !== null) ? (
                    /* KB detail / create page */
                    <KBDetailPage
                        kbId={activeKBId || null}
                        user={user}
                        onClose={() => setActiveKBId(null)}
                        onSaved={() => { refreshKBs(); }}
                    />
                ) : showKBStore ? (
                    /* KB Marketplace */
                    <KBMarketplace
                        kbs={kbs}
                        categories={kbCategories}
                        favorites={kbFavorites}
                        onSelectKB={(kb) => setActiveKBId(kb.id)}
                        onEditKB={(kb) => setActiveKBId(kb ? kb.id : '')}
                        onUnpublishKB={handleUnpublishKB}
                        onToggleFavorite={handleToggleKBFavorite}
                        onClose={() => setShowKBStore(false)}
                        user={user}
                    />
                ) : (showProjectsStore && activeProjectId !== null) ? (
                    /* Project detail / create page */
                    <ProjectDetailPage
                        projectId={activeProjectId || null}
                        user={user}
                        onClose={() => setActiveProjectId(null)}
                        onSaved={(saved) => {
                            loadProjects();
                            // After creating a new project, switch to its edit view.
                            if (activeProjectId === '' && saved?.id) {
                                setActiveProjectId(saved.id);
                            }
                        }}
                        onDeleted={(id) => {
                            loadProjects();
                            if (activeProject?.id === id) setActiveProject(null);
                            setActiveProjectId(null);
                        }}
                    />
                ) : showProjectsStore ? (
                    /* Projects list / browse */
                    <ProjectsPage
                        projects={projects}
                        user={user}
                        onSelectProject={(p) => setActiveProjectId(p.id)}
                        onCreateProject={() => setActiveProjectId('')}
                        onClose={() => setShowProjectsStore(false)}
                    />
                ) : selectedAgent ? (
                    <>
                        {/* New Inline Header for Agent */}
                        <div className={`h-14 flex items-center justify-between ${isMobile ? 'px-3' : 'px-6'} bg-[var(--bg-primary)]/80 backdrop-blur-md sticky top-0 z-20 border-b border-[var(--border-subtle)]/50`}>
                            <div className="flex items-center gap-2">
                                {isMobile && (
                                    <button
                                        onClick={() => setSidebarOpen(true)}
                                        className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] transition-colors"
                                    >
                                        <Menu className="w-5 h-5" />
                                    </button>
                                )}
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm overflow-hidden">
                                    {(() => {
                                        const av = pickAgentAvatar(selectedAgent);
                                        return isImageAvatar(av) ? (
                                            <img src={resolveAvatarSrc(av)} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="font-bold text-[var(--text-primary)]">
                                                {av || selectedAgent.name?.[0]?.toUpperCase()}
                                            </span>
                                        );
                                    })()}
                                </div>
                                <h1 className="font-semibold text-[var(--text-primary)] text-sm">{selectedAgent.name}</h1>
                                <div className="relative">
                                    <button
                                        onClick={() => setShowAgentMenu(v => !v)}
                                        className="p-1 rounded-md hover:bg-[var(--bg-tertiary)] transition-colors text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                                    >
                                        <MoreVertical className="w-4 h-4" />
                                    </button>
                                    {showAgentMenu && (
                                        <>
                                            <div className="fixed inset-0 z-40" onClick={() => setShowAgentMenu(false)} />
                                            <div
                                                className="absolute top-full left-0 mt-1 w-44 rounded-lg border shadow-xl overflow-hidden z-50"
                                                style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)' }}
                                            >
                                                <button
                                                    onClick={() => { setShowAgentMenu(false); handleNewChat(); }}
                                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--bg-secondary)] transition-colors text-left"
                                                    style={{ color: 'var(--text-primary)' }}
                                                >
                                                    <PenLine className="w-4 h-4" />
                                                    New Chat
                                                </button>
                                                <button
                                                    onClick={() => { handleToggleFavorite(selectedAgent.id); setShowAgentMenu(false); }}
                                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--bg-secondary)] transition-colors text-left"
                                                    style={{ color: 'var(--text-primary)' }}
                                                >
                                                    {favorites.includes(selectedAgent.id) ? 'Remove from favorites' : 'Add to favorites'}
                                                </button>
                                                {(selectedAgent.owner_id === user?.id || user?.isAdmin || (user?.permissions || []).includes('all')) && (
                                                    <>
                                                        <button
                                                            onClick={() => { setShowAgentMenu(false); onNavigate(`agentDesigner:${selectedAgent.id}`); }}
                                                            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--bg-secondary)] transition-colors text-left"
                                                            style={{ color: 'var(--text-primary)' }}
                                                        >
                                                            <Pencil className="w-4 h-4" />
                                                            Edit Agent
                                                        </button>
                                                        <button
                                                            onClick={() => { handleUnpublishAgent(selectedAgent.id); setShowAgentMenu(false); }}
                                                            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--bg-secondary)] transition-colors text-left"
                                                            style={{ color: 'var(--error, #ef4444)' }}
                                                        >
                                                            <EyeOff className="w-4 h-4" />
                                                            Unpublish Agent
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 relative">
                                {!isMobile && notebooksEnabled && (
                                    <button
                                        onClick={toggleNotebookPanel}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors border text-xs font-medium ${showNotebook ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] border-[var(--accent-primary)]/30' : 'bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-subtle)]'}`}
                                        title={showNotebook ? 'Close Notebook' : 'Open Notebook'}
                                    >
                                        📓 {showNotebook ? 'Close' : 'Notebook'}
                                    </button>
                                )}
                                {!isMobile && canUseWebpagesSide && (
                                    <>
                                        <button
                                            ref={webpageButtonRef}
                                            onClick={() => {
                                                if (sidePanelWebpageId) closeWebpagePanel();
                                                else setWebpagePickerOpen(v => !v);
                                            }}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors border text-xs font-medium ${sidePanelWebpageId ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] border-[var(--accent-primary)]/30' : 'bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-subtle)]'}`}
                                            title={sidePanelWebpageId ? 'Close Webpage' : 'Open Webpage'}
                                        >
                                            🌐 {sidePanelWebpageId ? 'Close' : 'Webpage'}
                                        </button>
                                        <WebpagePickerPopover
                                            anchorRef={webpageButtonRef}
                                            open={webpagePickerOpen && !sidePanelWebpageId}
                                            onClose={() => setWebpagePickerOpen(false)}
                                            onSelect={openWebpageInSidePanel}
                                        />
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Split Panes if Workspace Enabled */}
                        <div className="flex-1 flex overflow-hidden">
                            {/* Chat Pane */}
                            <div className="flex-1 flex flex-col min-w-0 border-r" style={{ borderColor: 'var(--border-subtle)' }}>
                                <div ref={messagesContainerRef} className={`flex-1 overflow-y-auto ${isMobile ? 'p-2' : 'p-4'} custom-scrollbar`}>
                                    {messages.length === 0 ? (
                                        <div className="flex flex-col flex-1 h-full items-center justify-center -mt-10">
                                            <WelcomeScreen
                                                agent={selectedAgent}
                                                onSendMessage={(text) => { setChatInput(text); }}
                                                user={user}
                                                onNavigate={onNavigate}
                                            >
                                                <InputArea
                                                    onSendMessage={(text, attachments, parentId) => {
                                                        shouldForceScrollRef.current = true;
                                                        sendMessage(text, attachments, parentId, false);
                                                    }}
                                                    onStopGenerating={stopGenerating}
                                                    isLoading={isLoading}
                                                    selectedAgent={selectedAgent}
                                                    agentIntegrations={selectedAgent?.config?.enabledIntegrations || null}
                                                    isMobile={isMobile}
                                                    input={chatInput}
                                                    setInput={setChatInput}
                                                    user={user}
                                                    activeSkillIds={activeSkillIds}
                                                    agentAttachedSkillIds={agentAttachedSkillIds}
                                                    onToggleSkill={handleToggleSkill}
                                                    messages={messages}
                                                    onVoiceTurnComplete={handleVoiceTurnComplete}
                                                />
                                            </WelcomeScreen>
                                        </div>
                                    ) : (
                                        <div className="max-w-full px-6 mx-auto space-y-6 pb-4">
                                            {messages.filter(m => !m.parentId).map((msg, idx) => (
                                                <MessageItem
                                                    key={msg.id || idx}
                                                    idx={idx}
                                                    msg={msg}
                                                    selectedAgent={selectedAgent}
                                                    onCopy={(txt) => navigator.clipboard.writeText(txt)}
                                                    allMessages={messages}
                                                    conversationId={currentConversation?.id}
                                                    agentId={selectedAgent?.id}
                                                    chatSource="agent"
                                                    onRetry={retryMessage}
                                                    onEditMessage={editAndRegenerate}
                                                    modelTiers={modelTiers}
                                                />
                                            ))}
                                            <div ref={messagesEndRef} />
                                        </div>
                                    )}
                                </div>


                                {messages.length > 0 && (
                                    <div className="w-full flex flex-col shrink-0">
                                        <InputArea
                                            onSendMessage={(text, attachments, parentId) => {
                                                shouldForceScrollRef.current = true;
                                                sendMessage(text, attachments, parentId, false);
                                            }}
                                            onStopGenerating={stopGenerating}
                                            isLoading={isLoading}
                                            selectedAgent={selectedAgent}
                                            agentIntegrations={selectedAgent?.config?.enabledIntegrations || null}
                                            input={chatInput}
                                            isMobile={isMobile}
                                            setInput={setChatInput}
                                            user={user}
                                            activeSkillIds={activeSkillIds}
                                            agentAttachedSkillIds={agentAttachedSkillIds}
                                            onToggleSkill={handleToggleSkill}
                                            messages={messages}
                                            onVoiceTurnComplete={handleVoiceTurnComplete}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Notebook Pane — sibling split column at all viewport sizes
                                (mobile uses a separate full-screen layout, not handled here). */}
                            {!isMobile && notebooksEnabled && showNotebook && !showGammaPreview && (
                                <div className={notebookWrapperClass}>
                                    <WorkspaceNotebook
                                        content={notebookContent}
                                        onChange={setNotebookContent}
                                        onSave={saveNotebook}
                                        onClose={() => setShowNotebook(false)}
                                        onSelectionChange={(text) => { setNotebookSelection(text); }}
                                        onAskAI={(message) => {
                                            console.log('[Notebook AI] AgentHub.onAskAI -> sendMessage, isLoading=', isLoading, 'mode=agent', 'agent=', selectedAgent?.id);
                                            sendMessage(message, []);
                                        }}
                                        onOpenInNotebook={notebooksEnabled ? handleOpenInNotebook : undefined}
                                        user={user}
                                        conversationId={currentConversation?.id}
                                        existingNotebookId={notebookLinkedId}
                                        onNotebookIdChange={setNotebookLinkedId}
                                    />
                                </div>
                            )}
                            {!isMobile && showGammaPreview && (
                                <div className={notebookWrapperClass}>
                                    <GammaPreviewPanel
                                        preview={gammaPreview}
                                        onClose={() => setShowGammaPreview(false)}
                                        onUpdate={setGammaPreview}
                                    />
                                </div>
                            )}
                            {!isMobile && sidePanelWebpageId && !showNotebook && !showGammaPreview && (
                                <div className={notebookWrapperClass}>
                                    <SideWebpagePanel
                                        webpageId={sidePanelWebpageId}
                                        onClose={closeWebpagePanel}
                                        user={user}
                                        onLoaded={setSidePanelWebpage}
                                        onFilesLoaded={(files) => {
                                            if (files) setSidePanelWebpageFiles({
                                                html: files.html || '',
                                                css: files.css || '',
                                                js: files.js || '',
                                            });
                                        }}
                                        onSelectionAttach={(sel) => { if (sel?.text) setAttachedWebpageSelection(sel); }}
                                        reloadKey={sidePanelReloadKey}
                                        onNavigate={onNavigate}
                                    />
                                </div>
                            )}
                        </div>
                    </>
                ) : directChatMode ? (
                    /* Direct Chat Mode */
                    <>
                        {/* Minimal toolbar for Direct Chat */}
                        {(isMobile || (!isMobile && notebooksEnabled)) && (
                            <div className={`h-14 flex items-center justify-between ${isMobile ? 'px-3' : 'px-6'} bg-[var(--bg-primary)]/80 backdrop-blur-md sticky top-0 z-20 border-b border-[var(--border-subtle)]/50`}>
                                <div className="flex items-center gap-2">
                                    {isMobile && (
                                        <button
                                            onClick={() => setSidebarOpen(true)}
                                            className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] transition-colors"
                                        >
                                            <Menu className="w-5 h-5" />
                                        </button>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 relative">
                                    {!isMobile && notebooksEnabled && (
                                        <button
                                            onClick={toggleNotebookPanel}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors border text-xs font-medium ${showNotebook ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] border-[var(--accent-primary)]/30' : 'bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-subtle)]'}`}
                                            title={showNotebook ? 'Close Notebook' : 'Open Notebook'}
                                        >
                                            📓 {showNotebook ? 'Close' : 'Notebook'}
                                        </button>
                                    )}
                                    {!isMobile && canUseWebpagesSide && (
                                        <>
                                            <button
                                                ref={webpageButtonRefDirect}
                                                onClick={() => {
                                                    if (sidePanelWebpageId) closeWebpagePanel();
                                                    else setWebpagePickerOpen(v => !v);
                                                }}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors border text-xs font-medium ${sidePanelWebpageId ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] border-[var(--accent-primary)]/30' : 'bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-subtle)]'}`}
                                                title={sidePanelWebpageId ? 'Close Webpage' : 'Open Webpage'}
                                            >
                                                🌐 {sidePanelWebpageId ? 'Close' : 'Webpage'}
                                            </button>
                                            <WebpagePickerPopover
                                                anchorRef={webpageButtonRefDirect}
                                                open={webpagePickerOpen && !sidePanelWebpageId}
                                                onClose={() => setWebpagePickerOpen(false)}
                                                onSelect={openWebpageInSidePanel}
                                            />
                                        </>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Split Panes: Chat + Workspace */}
                        <div className="flex-1 flex overflow-hidden">
                            {/* Chat Pane */}
                            <div className="flex-1 flex flex-col min-w-0 border-r" style={{ borderColor: 'var(--border-subtle)' }}>
                                <div ref={messagesContainerRef} className={`flex-1 overflow-y-auto ${isMobile ? 'p-2' : 'p-4'} custom-scrollbar`}>
                                    {messages.length === 0 ? (
                                        <div className="flex flex-col flex-1 h-full items-center justify-center -mt-10">
                                            <DirectChatWelcome
                                                tiers={modelTiers}
                                                selectedTier={selectedTier}
                                                onTierChange={setSelectedTier}
                                                onPromptClick={(text) => setChatInput(text)}
                                            >
                                                <InputArea
                                                    onSendMessage={(text, attachments) => { shouldForceScrollRef.current = true; sendMessage(text, attachments); }}
                                                    onStopGenerating={stopGenerating}
                                                    isLoading={isLoading}
                                                    directMode={true}
                                                    modelTiers={modelTiers}
                                                    selectedTier={selectedTier}
                                                    onTierChange={setSelectedTier}
                                                    input={chatInput}
                                                    isMobile={isMobile}
                                                    setInput={setChatInput}
                                                    user={user}
                                                    activeSkillIds={activeSkillIds}
                                                    directSessionSkills={directSessionSkills}
                                                    directActivatedSessionSkillIds={directActivatedSessionSkillIds}
                                                    directConversationId={currentDirectConversation?.id}
                                                    onToggleSkill={handleToggleSkill}
                                                    messages={messages}
                                                    onVoiceTurnComplete={handleVoiceTurnComplete}
                                                    availableKBs={directChatKbs}
                                                    selectedKBIds={directChatKBIds}
                                                    onChangeKBIds={setDirectChatKBIds}
                                                />
                                            </DirectChatWelcome>
                                        </div>
                                    ) : (
                                        <div className="max-w-full px-6 mx-auto space-y-6 pb-4">
                                            {messages.filter(m => !m.parentId).map((msg, idx) => (
                                                <MessageItem
                                                    key={msg.id || idx}
                                                    idx={idx}
                                                    msg={msg}
                                                    selectedAgent={{ name: 'AI', avatar: '💬' }}
                                                    onCopy={(txt) => navigator.clipboard.writeText(txt)}
                                                    allMessages={messages}
                                                    conversationId={currentDirectConversation?.id}
                                                    sessionSkills={directSessionSkills}
                                                    liveActivatedSkillIds={directActivatedSessionSkillIds}
                                                    liveCompletedSkillIds={directCompletedSessionSkillIds}
                                                    chatSource="direct"
                                                    onRetry={retryMessage}
                                                    onEditMessage={editAndRegenerate}
                                                    modelTiers={modelTiers}
                                                />
                                            ))}
                                            <div ref={messagesEndRef} />
                                        </div>
                                    )}
                                </div>
                                {messages.length > 0 && (
                                    <div className="w-full flex flex-col shrink-0">
                                        {attachedWebpageSelection && sidePanelWebpageId && (
                                            <div className="mx-4 mb-2 px-3 py-2 rounded-lg border flex items-start gap-2"
                                                 style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                                                <div className="text-[11px] mt-0.5" style={{ color: 'var(--accent-primary)' }}>↳</div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-[11px] font-medium mb-0.5" style={{ color: 'var(--text-secondary)' }}>
                                                        Selection from page{attachedWebpageSelection.tagName ? ` · <${attachedWebpageSelection.tagName}>` : ''}
                                                    </div>
                                                    <div className="text-[12px] truncate" style={{ color: 'var(--text-primary)' }}>
                                                        {attachedWebpageSelection.text.length > 140 ? attachedWebpageSelection.text.slice(0, 140) + '…' : attachedWebpageSelection.text}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={clearWebpageSelection}
                                                    className="p-0.5 rounded hover:bg-[var(--bg-tertiary)]"
                                                    title="Remove selection"
                                                >
                                                    <X className="w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} />
                                                </button>
                                            </div>
                                        )}
                                        <InputArea
                                            onSendMessage={(text, attachments) => {
                                                shouldForceScrollRef.current = true;
                                                sendMessage(text, attachments);
                                                // Single-shot — the user implicitly cleared their pick
                                                // by sending; next message starts fresh.
                                                if (attachedWebpageSelection) setAttachedWebpageSelection(null);
                                            }}
                                            onStopGenerating={stopGenerating}
                                            isLoading={isLoading}
                                            directMode={true}
                                            modelTiers={modelTiers}
                                            selectedTier={selectedTier}
                                            onTierChange={setSelectedTier}
                                            input={chatInput}
                                            isMobile={isMobile}
                                            setInput={setChatInput}
                                            user={user}
                                            activeSkillIds={activeSkillIds}
                                            directSessionSkills={directSessionSkills}
                                            directActivatedSessionSkillIds={directActivatedSessionSkillIds}
                                            directConversationId={currentDirectConversation?.id}
                                            onToggleSkill={handleToggleSkill}
                                            messages={messages}
                                            onVoiceTurnComplete={handleVoiceTurnComplete}
                                            availableKBs={directChatKbs}
                                            selectedKBIds={directChatKBIds}
                                            onChangeKBIds={setDirectChatKBIds}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Notebook Pane — sibling split column at all viewport sizes
                                (mobile uses a separate full-screen layout, not handled here). */}
                            {!isMobile && notebooksEnabled && showNotebook && !showGammaPreview && (
                                <div className={notebookWrapperClass}>
                                    <WorkspaceNotebook
                                        content={notebookContent}
                                        onChange={setNotebookContent}
                                        onSave={saveNotebook}
                                        onClose={() => setShowNotebook(false)}
                                        onSelectionChange={(text) => { setNotebookSelection(text); }}
                                        onAskAI={(message) => {
                                            console.log('[Notebook AI] AgentHub.onAskAI -> sendMessage, isLoading=', isLoading, 'mode=direct');
                                            sendMessage(message, []);
                                        }}
                                        onOpenInNotebook={notebooksEnabled ? handleOpenInNotebook : undefined}
                                        user={user}
                                        conversationId={currentDirectConversation?.id}
                                        existingNotebookId={notebookLinkedId}
                                        onNotebookIdChange={setNotebookLinkedId}
                                    />
                                </div>
                            )}
                            {!isMobile && showGammaPreview && (
                                <div className={notebookWrapperClass}>
                                    <GammaPreviewPanel
                                        preview={gammaPreview}
                                        onClose={() => setShowGammaPreview(false)}
                                        onUpdate={setGammaPreview}
                                    />
                                </div>
                            )}
                            {!isMobile && sidePanelWebpageId && !showNotebook && !showGammaPreview && (
                                <div className={notebookWrapperClass}>
                                    <SideWebpagePanel
                                        webpageId={sidePanelWebpageId}
                                        onClose={closeWebpagePanel}
                                        user={user}
                                        onLoaded={setSidePanelWebpage}
                                        onFilesLoaded={(files) => {
                                            if (files) setSidePanelWebpageFiles({
                                                html: files.html || '',
                                                css: files.css || '',
                                                js: files.js || '',
                                            });
                                        }}
                                        onSelectionAttach={(sel) => { if (sel?.text) setAttachedWebpageSelection(sel); }}
                                        reloadKey={sidePanelReloadKey}
                                        onNavigate={onNavigate}
                                    />
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    /* No Agent Selected - Empty State */
                    <div className="flex-1 flex flex-col items-center justify-center p-8">
                        <img src={beeFlowIcon} alt="Bee Flow" className="w-24 h-24 rounded-2xl object-contain mb-6 shadow-xl" />
                        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
                            Welcome to Bee Flow
                        </h1>
                        <p className="text-[var(--text-secondary)] text-center max-w-md mb-8">
                            Select an agent from the marketplace to start chatting, or create your own custom AI assistant.
                        </p>
                        <button
                            onClick={() => { if (onCloseSettings) onCloseSettings(); if (onCloseAgentDesigner) onCloseAgentDesigner(); if (onCloseAITasks) onCloseAITasks(); setShowMarketplace(true); }}
                            className="flex items-center gap-2 px-6 py-3 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-xl font-medium shadow-lg transition-all hover:scale-105"
                        >
                            Browse Agents
                        </button>
                    </div>
                )}
            </div>








            {/* Global Search Overlay */}
            <SearchOverlay
                isOpen={showSearch}
                onClose={() => setShowSearch(false)}
                onSelectResult={handleSearchResultSelect}
                agents={agents}
            />

            {/* Memory Panel */}
            {
                showMemoryPanel && (
                    <MemoryPanel
                        agentId={selectedAgent?.id}
                        onClose={() => setShowMemoryPanel(false)}
                    />
                )
            }
        </div >
        </Suspense>
    );
};

export default AgentHub;
