import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import AgentDesignerPanel from './components/AgentDesignerPanel';
import AgentMarketplace from './components/AgentMarketplace';
import KBMarketplace from './components/KBMarketplace';
import KBDetailPage from './components/KBDetailPage';
import SearchOverlay from './components/SearchOverlay';

import Sidebar from './components/Sidebar';
import InputArea from './components/InputArea';
import WelcomeScreen from './components/WelcomeScreen';
import MessageItem from './components/chat/MessageItem';
import MemoryPanel from './components/MemoryPanel';
import WorkspaceNotebook from './components/WorkspaceNotebook';
import DirectChatWelcome from './components/DirectChatWelcome';
import ProjectModal from './components/ProjectModal';
import AdvancedSettings from './pages/AdvancedSettings';
import AgentDesigner from './components/admin/AgentDesigner';
import SkillsPanel from './components/SkillsPanel';
import EmailKBSettings from './components/EmailKBSettings';
import NotebooksPage from './pages/NotebooksPage';
import useChatEngine from './hooks/useChatEngine';
import { useViewport } from './hooks/useViewport';

import { API_BASE, generateMessageId, authFetch } from './utils/helpers';
import scopedStorage from './utils/scopedStorage';
import { normalizeLoadedMessages } from './utils/messageShape';
import { X, Sparkles, PenLine, Heart, MoreVertical, Menu, EyeOff, Pencil } from 'lucide-react';

const AgentHub = ({
    onNavigate, user, onLogout, currentPage,
    initialAgentId = null, initialConversationId = null, initialDirectConvId = null,
    showSettings = false, onCloseSettings,
    showAgentDesigner = false, onCloseAgentDesigner, initialDesignerAgentId = null,
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

    // Notebook layout: split-pane on desktop, slide-over drawer on 13" laptops.
    // The drawer floats above the chat (fixed position) so the chat keeps its
    // full width; a scrim lets the user dismiss by tapping outside.
    const notebookWrapperClass = isCompact
        ? "fixed right-0 top-0 bottom-0 z-30 w-[420px] max-w-[90vw] flex flex-col h-full bg-[var(--bg-primary)] border-l border-[var(--border-subtle)] shadow-2xl animate-in slide-in-from-right duration-300"
        : "w-1/2 min-w-[400px] flex flex-col h-full animate-in slide-in-from-right duration-300";

    // Feature flags
    const notebooksEnabled = user?.featureFlags?.notebooks !== false;
    const projectsEnabled = user?.featureFlags?.projects !== false;

    // Core State
    const [agents, setAgents] = useState([]);
    const [agentCategories, setAgentCategories] = useState([]);
    const [selectedAgent, setSelectedAgent] = useState(null);
    const [conversations, setConversations] = useState([]);
    const [currentConversation, setCurrentConversation] = useState(null);
    // Sidebar defaults to its full-width state only on true desktops (>=1280).
    // On small laptops (768-1279) we default to the icon-rail mode so the chat
    // pane has room to breathe. The user can still toggle it open.
    const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 1280);
    const [notebookContent, setNotebookContent] = useState('');
    const [notebookLastFetchedId, setNotebookLastFetchedId] = useState(null);
    const [notebookSelection, setNotebookSelection] = useState('');
    const [showNotebook, setShowNotebook] = useState(false);
    const [notebookLinkedId, setNotebookLinkedId] = useState(null);

    // Direct Chat State
    const [directChatMode, setDirectChatMode] = useState(() => window.innerWidth < 768);
    const [selectedTier, setSelectedTier] = useState('auto');
    const [modelTiers, setModelTiers] = useState({});
    const [directConversations, setDirectConversations] = useState([]);
    const [currentDirectConversation, setCurrentDirectConversation] = useState(null);
    const [chatInput, setChatInput] = useState('');

    // Projects State
    const [projects, setProjects] = useState([]);
    const [activeProject, setActiveProject] = useState(null);
    const [showProjectModal, setShowProjectModal] = useState(false);
    const [editingProject, setEditingProject] = useState(null);

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
    const [directCompletedSessionSkillIds, setDirectCompletedSessionSkillIds] = useState([]);

    // Hydrate user-scoped preferences once the user id is known.
    useEffect(() => {
        if (!user?.id) return;
        const storedMode = scopedStorage.getItem('chatHistoryMode');
        if (storedMode) setChatHistoryMode(storedMode);
        const storedSkills = scopedStorage.getJSON('activeSkillIds', null);
        if (Array.isArray(storedSkills)) setActiveSkillIds(storedSkills);
        const storedFavs = scopedStorage.getJSON('agentFavorites', null);
        if (Array.isArray(storedFavs)) setFavorites(storedFavs);
    }, [user?.id]);

    // Chat engine hook — owns messages, isLoading, sendMessage, stopGenerating
    const { messages, setMessages, isLoading, sendMessage, stopGenerating, retryMessage, editAndRegenerate, submittedFormIds, setSubmittedFormIds } = useChatEngine({
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
            if (!showNotebook) return {};
            // Ship `notebookspaceContent` as an empty string (not a single space)
            // when the notebook is open but blank — the server treats
            // `undefined` as "no notebook" and `""` as "notebook present,
            // blank", so the AI still knows the notebook tools are available.
            // Previously we sent `' '` to dodge a truthy-check; server now
            // checks `!== undefined` explicitly.
            return {
                notebookspaceContent: notebookContent || '',
                notebookspaceSelection: notebookSelection || '',
            };
        }, [notebookContent, notebookSelection, showNotebook]),
        onNotebookUpdate: useCallback((content) => {
            // On mobile, silently ignore notebook writes from AI
            if (window.innerWidth < 768) return;
            setNotebookContent(content);
            if (content) setShowNotebook(true);
        }, []),
        directMode: directChatMode ? {
            enabled: true,
            modelTier: selectedTier,
            getExtraPayload: () => ({
                ...(Array.isArray(directSessionSkills) && directSessionSkills.length > 0 ? { sessionSkills: directSessionSkills } : {}),
                ...(Array.isArray(directActivatedSessionSkillIds) && directActivatedSessionSkillIds.length > 0 ? { activatedSessionSkillIds: directActivatedSessionSkillIds } : {}),
            }),
        } : undefined,
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
                respondingAgentAvatar: selectedAgent?.avatar || '🎙️',
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
    const [showSearch, setShowSearch] = useState(false);

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



    // Reusable function to (re-)fetch published agents
    const refreshAgents = useCallback(async () => {
        try {
            const res = await authFetch(`${API_BASE}/agents/published?t=${Date.now()}`, { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();

                setAgents(data);

                // Also load agent categories
                try {
                    const catRes = await authFetch(`${API_BASE}/agents/categories`);
                    if (catRes.ok) {
                        const cats = await catRes.json();
                        setAgentCategories(Array.isArray(cats) ? cats : []);
                    }
                } catch (e) { console.warn('Failed to load agent categories', e); }

                return data;
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
                authFetch(`${API_BASE}/api/kb?t=${Date.now()}`, { cache: 'no-store' }),
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

    // Close KB views when the user navigates to a chat (agent or direct).
    // Mirrors how the agent marketplace closes itself in handleSelectAgent etc.
    useEffect(() => {
        if (showMarketplace || showSettings || showAgentDesigner || showSkillsPanel || showEmailKB) {
            setShowKBStore(false);
            setActiveKBId(null);
        }
    }, [showMarketplace, showSettings, showAgentDesigner, showSkillsPanel, showEmailKB]);

    // Persist KB favourites per-user via scopedStorage
    useEffect(() => {
        if (!user?.id) return;
        const stored = scopedStorage.getJSON('kb_favorites', []);
        setKbFavorites(Array.isArray(stored) ? stored : []);
    }, [user?.id]);

    const handleToggleKBFavorite = useCallback((id) => {
        setKbFavorites(prev => {
            const next = prev.includes(id) ? prev.filter(k => k !== id) : [...prev, id];
            scopedStorage.setJSON('kb_favorites', next);
            return next;
        });
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
        setSelectedAgent(agent);
        setDesignMode(false);
        setShowMarketplace(false);
        setShowKBStore(false);
        setActiveKBId(null);
        setDirectChatMode(false);
        if (onCloseSettings) onCloseSettings();
        if (onCloseAgentDesigner) onCloseAgentDesigner();

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
        const handler = (e) => {
            const { title, content } = e.detail || {};
            if (!content) return;

            // Switch to direct chat mode
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

            // Auto-close sidebar on mobile
            if (isMobile) setSidebarOpen(false);

            // Seed the chat with the AI task result as a conversation history
            // so the user can immediately ask follow-up questions
            const now = new Date().toISOString();
            setTimeout(() => {
                setMessages([
                    {
                        id: generateMessageId(),
                        role: 'user',
                        content: `Show me the result from my AI Task "${title}"`,
                        timestamp: now,
                    },
                    {
                        id: generateMessageId(),
                        role: 'assistant',
                        content: content,
                        timestamp: now,
                        respondingAgentAvatar: '🤖',
                    },
                ]);
            }, 100);
        };
        window.addEventListener('openDirectChatWithContext', handler);
        return () => window.removeEventListener('openDirectChatWithContext', handler);
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
        setShowMarketplace(false);
        setShowKBStore(false);
        setActiveKBId(null);
        if (onCloseSettings) onCloseSettings();
        if (onCloseAgentDesigner) onCloseAgentDesigner();
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
        if (onCloseSettings) onCloseSettings();
        if (onCloseAgentDesigner) onCloseAgentDesigner();
        if (onCloseSkillsPanel) onCloseSkillsPanel();
        if (onCloseEmailKB) onCloseEmailKB();
        setShowMarketplace(false);
        setShowKBStore(false);
        setActiveKBId(null);
        if (directChatMode) {
            setCurrentDirectConversation(null);
            setMessages([]);
            setDirectSessionSkills([]);
            setDirectActivatedSessionSkillIds([]);
            setNotebookContent('');
            setNotebookSelection('');
            setShowNotebook(false);
            setNotebookLinkedId(null);
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
            scopedStorage.setItem('lastUsedMode', 'direct-chat');
            loadDirectConversations();
            loadModelTiers();
            updateDirectChatUrl(null);
            return;
        }
        setCurrentConversation({ id: null, title: 'New Chat', messages: [] });
        setMessages([]);
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

    const handleFormSubmit = (msg, formSubmission, formKey) => {
        setSubmittedFormIds(prev => new Set([...prev, formKey]));

        setMessages(prev => prev.map(m =>
            m.id === msg.id ? { ...m, savedFormData: formSubmission.formData } : m
        ));

        // Persist form data in background (don't block)
        if (currentConversation?.id && selectedAgent) {
            authFetch(`${API_BASE}/agents/${selectedAgent.id}/conversations/${currentConversation.id}/form-data`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messageId: msg.id, formData: formSubmission.formData })
            }).catch(err => console.error("Failed to persist form data", err));
        }

        // Populate the input field with the form answers so the user can send it
        const messageText = formSubmission.text || 'Form submitted';
        setChatInput(messageText);
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

    const handleToggleFavorite = (id) => {
        const newFavs = favorites.includes(id)
            ? favorites.filter(f => f !== id)
            : [...favorites, id];
        setFavorites(newFavs);
        scopedStorage.setJSON('agentFavorites', newFavs);
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
        );
    }

    return (
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
                    // Close any open overlays
                    if (onCloseSettings) onCloseSettings();
                    if (onCloseAgentDesigner) onCloseAgentDesigner();
                    if (onCloseSkillsPanel) onCloseSkillsPanel();
        if (onCloseEmailKB) onCloseEmailKB();
                    setShowMarketplace(false);
                    setShowKBStore(false);
                    setActiveKBId(null);
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
                onOpenMarketplace={() => { if (onCloseSettings) onCloseSettings(); if (onCloseAgentDesigner) onCloseAgentDesigner(); setShowKBStore(false); setActiveKBId(null); setShowMarketplace(true); }}
                onOpenKBStore={() => { if (onCloseSettings) onCloseSettings(); if (onCloseAgentDesigner) onCloseAgentDesigner(); setShowMarketplace(false); setActiveKBId(null); setShowKBStore(true); }}
                onOpenSearch={() => { if (onCloseSettings) onCloseSettings(); if (onCloseAgentDesigner) onCloseAgentDesigner(); setShowSearch(true); }}
                hasPermission={hasPermission}
                user={user}
                onLogout={onLogout}
                onNavigate={onNavigate}
                currentPage={currentPage}
                showSettings={showSettings}
                showAgentDesigner={showAgentDesigner}
                showSkillsPanel={showSkillsPanel}
                showEmailKB={showEmailKB}
                onDirectChat={handleDirectChat}
                directChatMode={directChatMode}
                directConversations={directConversations}
                onSelectDirectConversation={(conv) => {
                    // Close any open overlays
                    if (onCloseSettings) onCloseSettings();
                    if (onCloseAgentDesigner) onCloseAgentDesigner();
                    if (onCloseSkillsPanel) onCloseSkillsPanel();
        if (onCloseEmailKB) onCloseEmailKB();
                    setShowMarketplace(false);
                    setShowKBStore(false);
                    setActiveKBId(null);
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
                onCreateProject={() => { setEditingProject(null); setShowProjectModal(true); }}
                onEditProject={(p) => { setEditingProject(p); setShowProjectModal(true); }}
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
                    // Close any open overlays
                    if (onCloseSettings) onCloseSettings();
                    if (onCloseAgentDesigner) onCloseAgentDesigner();
                    if (onCloseSkillsPanel) onCloseSkillsPanel();
        if (onCloseEmailKB) onCloseEmailKB();
                    setShowMarketplace(false);
                    setShowKBStore(false);
                    setActiveKBId(null);
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
                       Settings / Agent Designer) so the app sidebar stays visible. */
                    <NotebooksPage
                        user={user}
                        onBack={onCloseNotebooks}
                        initialNotebookId={initialNotebookId}
                        onNotebookChange={onNotebookChange}
                    />
                ) : showSettings ? (
                    /* Settings rendered inline in conversation area — Open WebUI style */
                    <AdvancedSettings onBack={null} onNavigate={onNavigate} onLogout={onLogout} user={user} onClose={onCloseSettings} />
                ) : showAgentDesigner ? (
                    /* Agent Designer rendered inline in conversation area */
                    <AgentDesigner onBack={null} hasPermission={(perm) => {
                        const perms = user?.permissions || [];
                        return perms.includes('all') || perms.includes(perm);
                    }} initialAgentId={initialDesignerAgentId} onClose={onCloseAgentDesigner} />
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
                    /* Email Knowledge Base settings rendered inline */
                    <EmailKBSettings
                        user={user}
                        onNavigateBack={onCloseEmailKB}
                    />
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
                        groups={Array.isArray(user?.groups) ? user.groups.map(g => typeof g === 'string' ? { id: g, name: g } : g) : []}
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
                                    {selectedAgent.avatar && (selectedAgent.avatar.startsWith('data:') || selectedAgent.avatar.startsWith('http')) ? (
                                        <img src={selectedAgent.avatar} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="font-bold text-[var(--text-primary)]">
                                            {selectedAgent.avatar || selectedAgent.name?.[0]?.toUpperCase()}
                                        </span>
                                    )}
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
                            <div className="flex items-center gap-2">
                                {!isMobile && notebooksEnabled && (
                                    <button
                                        onClick={() => setShowNotebook(prev => !prev)}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors border text-xs font-medium ${showNotebook ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] border-[var(--accent-primary)]/30' : 'bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-subtle)]'}`}
                                        title={showNotebook ? 'Close Notebook' : 'Open Notebook'}
                                    >
                                        📓 {showNotebook ? 'Close' : 'Notebook'}
                                    </button>
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
                                                    handleFormSubmit={handleFormSubmit}
                                                    isFormSubmitted={submittedFormIds.has(`form-${msg.id || idx}`)}
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

                            {/* Notebook Pane — split on desktop, drawer on compact */}
                            {!isMobile && notebooksEnabled && showNotebook && isCompact && (
                                <div className="fixed inset-0 bg-black/30 z-20 animate-in fade-in duration-200" onClick={() => setShowNotebook(false)} aria-hidden="true" />
                            )}
                            {!isMobile && notebooksEnabled && showNotebook && (
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
                                <div className="flex items-center gap-2">
                                    {!isMobile && notebooksEnabled && (
                                        <button
                                            onClick={() => setShowNotebook(prev => !prev)}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors border text-xs font-medium ${showNotebook ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] border-[var(--accent-primary)]/30' : 'bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-subtle)]'}`}
                                            title={showNotebook ? 'Close Notebook' : 'Open Notebook'}
                                        >
                                            📓 {showNotebook ? 'Close' : 'Notebook'}
                                        </button>
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
                                                    handleFormSubmit={handleFormSubmit}
                                                    isFormSubmitted={submittedFormIds.has(`form-${msg.id || idx}`)}
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
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Notebook Pane — split on desktop, drawer on compact */}
                            {!isMobile && notebooksEnabled && showNotebook && isCompact && (
                                <div className="fixed inset-0 bg-black/30 z-20 animate-in fade-in duration-200" onClick={() => setShowNotebook(false)} aria-hidden="true" />
                            )}
                            {!isMobile && notebooksEnabled && showNotebook && (
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
                        </div>
                    </>
                ) : (
                    /* No Agent Selected - Empty State */
                    <div className="flex-1 flex flex-col items-center justify-center p-8">
                        <img src="/BeeFlow-logo-Icon-2026.svg" alt="Bee Flow" className="w-24 h-24 rounded-2xl object-contain mb-6 shadow-xl" />
                        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
                            Welcome to Bee Flow
                        </h1>
                        <p className="text-[var(--text-secondary)] text-center max-w-md mb-8">
                            Select an agent from the marketplace to start chatting, or create your own custom AI assistant.
                        </p>
                        <button
                            onClick={() => { if (onCloseSettings) onCloseSettings(); if (onCloseAgentDesigner) onCloseAgentDesigner(); setShowMarketplace(true); }}
                            className="flex items-center gap-2 px-6 py-3 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-xl font-medium shadow-lg transition-all hover:scale-105"
                        >
                            <Sparkles className="w-5 h-5" />
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
            {/* Project Modal */}
            {showProjectModal && (
                <ProjectModal
                    project={editingProject}
                    onClose={() => { setShowProjectModal(false); setEditingProject(null); }}
                    onSaved={() => loadProjects()}
                    onDeleted={() => { loadProjects(); if (activeProject?.id === editingProject?.id) setActiveProject(null); }}
                />
            )}
        </div >
    );
};

export default AgentHub;
