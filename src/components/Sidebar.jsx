import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MessageSquare, Trash2, Store, Bot, User, Shield, Settings, LogOut, ChevronDown, Search, X, CheckSquare, BarChart3, FolderOpen, Plus, FolderInput } from 'lucide-react';
import { API_BASE } from '../utils/helpers';
import NotificationCenter from './NotificationCenter';

/* ─── Design tokens ─── */
const ROW = 'w-full flex items-center gap-2.5 px-3 h-9 rounded-lg transition-all duration-150 text-left relative';
const ROW_ACTIVE = 'bg-[var(--item-active-bg)]';
const ROW_IDLE = 'hover:bg-[var(--item-hover-bg)]';
const ACCENT_BAR = 'absolute left-0 top-1 bottom-1 w-[3px] rounded-r-full bg-[var(--accent-primary)]';
const SECTION_HDR = 'flex items-center justify-between px-3 h-9 cursor-pointer select-none';
const SECTION_LBL = 'text-[13px] font-semibold tracking-normal text-black';
const CONV_ROW = 'w-full flex items-center px-4 py-1 text-left relative cursor-pointer gap-1.5';
const ICON_ACTIVE = 'text-[var(--accent-primary)]';
const ICON_IDLE = 'text-[var(--text-tertiary)]';
const TEXT_ACTIVE = 'font-bold text-black';
const TEXT_IDLE = 'text-black hover:text-black transition-colors';
const ACCENT_BAR_CONV = 'absolute left-0 top-0 bottom-0 w-[3px] bg-gray-400 rounded-r-sm';

/* ─── localStorage helpers for collapse state ─── */
const storageKey = (k) => `sidebar_${k}_expanded`;
const readExpanded = (k, fallback) => {
    try { const v = localStorage.getItem(storageKey(k)); return v !== null ? v === '1' : fallback; }
    catch { return fallback; }
};
const writeExpanded = (k, v) => { try { localStorage.setItem(storageKey(k), v ? '1' : '0'); } catch { } };

const Sidebar = ({
    isOpen, isMobile = false, onClose,
    selectedAgent, onClearSelection,
    favorites = [], agents = [],
    groupedConversations, currentConversation,
    onSelectConversation, onDeleteConversation,
    onSelectAgent, onOpenMarketplace, onOpenSearch,
    user, onLogout, onNavigate, currentPage,
    onDirectChat, directChatMode,
    directConversations = [],
    onSelectDirectConversation, onDeleteDirectConversation,
    currentDirectConversation,
    toggleSidebar,
    onNewChat,
    onToggleFavorite,
    projects = [],
    activeProject,
    onSelectProject,
    onCreateProject,
    onEditProject,
    onMoveToProject,
}) => {
    // We'll use the 'isOpen' prop as 'sidebarOpen' (expanded state)
    // and if !isOpen, we'll show the narrow 'Power Bar'
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [agentsOpen, setAgentsOpen] = useState(() => readExpanded('agents', true));
    const [chatsOpen, setChatsOpen] = useState(() => readExpanded('chats', false));
    const [projectsOpen, setProjectsOpen] = useState(() => readExpanded('projects', true));
    const profileRef = useRef(null);

    const toggleAgents = useCallback(() => setAgentsOpen(p => { writeExpanded('agents', !p); return !p; }), []);
    const toggleChats = useCallback(() => setChatsOpen(p => { writeExpanded('chats', !p); return !p; }), []);
    const toggleProjects = useCallback(() => setProjectsOpen(p => { writeExpanded('projects', !p); return !p; }), []);

    // Close profile menu on outside click
    useEffect(() => {
        if (!showProfileMenu) return;
        const close = (e) => { if (profileRef.current && !profileRef.current.contains(e.target)) setShowProfileMenu(false); };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, [showProfileMenu]);

    // On mobile, completely hide when closed (hamburger in header opens it)
    if (!isOpen && isMobile) return null;

    /* ─── Data ─── */
    const favoriteAgents = agents.filter(a => favorites.includes(a.id));
    const typeOf = (a) => a.is_swarm ? 'Swarm' : a.is_browser_agent ? 'Web' : a.is_terminal_agent ? 'Dev' : a.is_security_agent ? 'Security' : 'Chat';

    const allConvs = (() => {
        let convs;
        if (directChatMode) convs = directConversations;
        else if (!groupedConversations) convs = [];
        else convs = groupedConversations.flatMap(([, c]) => c);
        // Filter by active project
        if (activeProject) {
            return convs.filter(c => c.project_id === activeProject.id);
        }
        // In "All Chats" view, hide conversations assigned to a project
        return convs.filter(c => !c.project_id);
    })();

    /* ── Time-grouped conversations ── */
    const groupedConvs = (() => {
        const convs = allConvs;
        if (convs.length === 0) return [];
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(yesterdayStart.getDate() - 1);
        const monthStart = new Date(todayStart); monthStart.setDate(monthStart.getDate() - 30);
        const groups = { today: [], yesterday: [], month: [], older: [] };
        convs.forEach(c => {
            const rawDate = c.updated_at || c.created_at;
            const d = rawDate ? new Date(rawDate) : new Date(0);

            const msgStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
            const diffDays = Math.floor((todayStart - msgStart) / (1000 * 60 * 60 * 24));

            if (diffDays <= 0) groups.today.push(c);
            else if (diffDays === 1) groups.yesterday.push(c);
            else if (diffDays <= 30) groups.month.push(c);
            else groups.older.push(c);
        });
        return [
            { label: 'Today', items: groups.today },
            { label: 'Yesterday', items: groups.yesterday },
            { label: 'Last 30 Days', items: groups.month },
            { label: 'Older', items: groups.older },
        ].filter(g => g.items.length > 0);
    })();
    const previewConvs = allConvs.slice(0, 3);
    const hasMore = allConvs.length > 3;

    const convIsActive = (c) => directChatMode ? currentDirectConversation?.id === c.id : currentConversation?.id === c.id;
    const selectConv = (c) => directChatMode ? onSelectDirectConversation(c) : onSelectConversation(c);
    const deleteConv = (id) => directChatMode ? onDeleteDirectConversation?.(id) : onDeleteConversation(id);

    /* ─── Conversation row ─── */
    const ConvRow = ({ conv }) => {
        const active = convIsActive(conv);
        const [showMoveMenu, setShowMoveMenu] = useState(false);
        const moveRef = useRef(null);
        // Close menu on outside click
        useEffect(() => {
            if (!showMoveMenu) return;
            const close = (e) => { if (moveRef.current && !moveRef.current.contains(e.target)) setShowMoveMenu(false); };
            document.addEventListener('mousedown', close);
            return () => document.removeEventListener('mousedown', close);
        }, [showMoveMenu]);
        return (
            <div
                onClick={() => selectConv(conv)}
                className={`group ${CONV_ROW}`}
                title={conv.updated_at ? new Date(conv.updated_at).toLocaleString() : ''}
            >
                {active && <div className={ACCENT_BAR_CONV} />}
                <span className={`text-[14px] truncate flex-1 leading-snug ${active ? TEXT_ACTIVE : TEXT_IDLE}`}>
                    {conv.title || 'Untitled Chat'}
                </span>
                {/* Move to project button */}
                {projects.length > 0 && (
                    <div className="relative" ref={moveRef}>
                        <button
                            onClick={(e) => { e.stopPropagation(); setShowMoveMenu(v => !v); }}
                            className="opacity-0 group-hover:opacity-100 p-1 text-[var(--text-tertiary)] hover:text-[var(--accent-primary)] rounded transition-opacity flex-shrink-0"
                            title="Move to project"
                        >
                            <FolderInput className="w-3.5 h-3.5" />
                        </button>
                        {showMoveMenu && (
                            <div
                                className="absolute right-0 top-full mt-1 w-44 rounded-lg border shadow-xl overflow-hidden z-50"
                                style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)' }}
                            >
                                <div className="p-1">
                                    {conv.project_id && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onMoveToProject?.(conv, null); setShowMoveMenu(false); }}
                                            className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[12px] hover:bg-[var(--bg-secondary)] rounded-md transition-colors text-left text-[var(--text-secondary)]"
                                        >
                                            <X className="w-3.5 h-3.5" /> Remove from project
                                        </button>
                                    )}
                                    {projects.filter(p => p.id !== conv.project_id).map(p => (
                                        <button
                                            key={p.id}
                                            onClick={(e) => { e.stopPropagation(); onMoveToProject?.(conv, p); setShowMoveMenu(false); }}
                                            className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[12px] hover:bg-[var(--bg-secondary)] rounded-md transition-colors text-left text-[var(--text-primary)]"
                                        >
                                            <div className="w-4 h-4 rounded flex items-center justify-center text-[10px] flex-shrink-0" style={{ background: (p.color || '#6366f1') + '20' }}>
                                                {p.icon || '📁'}
                                            </div>
                                            <span className="truncate">{p.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
                <button
                    onClick={(e) => { e.stopPropagation(); deleteConv(conv.id); }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-[var(--text-tertiary)] hover:text-red-500 rounded transition-opacity flex-shrink-0"
                    title="Delete"
                >
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
            </div>
        );
    };

    /* ─── The sidebar ─── */
    const content = (
        <div
            className={`h-full flex flex-col bg-[var(--bg-secondary)] border-r border-[var(--border-subtle)] flex-shrink-0 transition-all duration-300 ${isOpen ? 'w-72' : 'w-16 cursor-pointer'}`}
            onClick={(e) => {
                if (!isOpen && !e.target.closest('button')) {
                    toggleSidebar();
                }
            }}
        >

            {/* ── Top Bar Container ── */}
            <div className={`px-3 py-3 flex items-center flex-shrink-0 ${isOpen ? 'justify-between' : 'justify-center border-b border-[var(--border-subtle)]/50'}`}>
                {isOpen ? (
                    <>
                        <div className="flex items-center gap-2.5">
                            <img src="/bee-flow-logo.svg" alt="Bee Flow" className="w-[4.5rem] h-[4.5rem] rounded-xl object-cover" />
                        </div>
                        <button
                            onClick={toggleSidebar}
                            className="p-1.5 hover:bg-[var(--bg-tertiary)] rounded-lg text-[var(--text-tertiary)] transition-colors"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M9 3v18" /></svg>
                        </button>
                    </>
                ) : (
                    <button
                        onClick={toggleSidebar}
                        className="p-2 hover:bg-[var(--bg-tertiary)] rounded-xl text-[var(--text-primary)] transition-all transform hover:scale-105"
                    >
                        <span className="text-xl leading-none">🐝</span>
                    </button>
                )}
            </div>

            {/* ── Nav rows ── */}
            <nav className={`px-2 pt-4 flex-shrink-0 flex flex-col gap-2 ${isOpen ? '' : 'items-center'}`}>
                {[
                    { label: 'Direct Chat', icon: MessageSquare, onClick: onDirectChat, active: directChatMode && !selectedAgent },
                    { label: 'Agent Store', icon: Store, onClick: onOpenMarketplace, active: currentPage === 'marketplace' },
                    { label: 'Search', icon: Search, onClick: onOpenSearch, active: false },
                ].map(({ label, icon: Icon, onClick, active, primary, beta }) => (
                    <button
                        key={label}
                        onClick={onClick}
                        className={`group relative flex items-center ${isOpen
                            ? ROW + ' ' + (active ? ROW_ACTIVE : ROW_IDLE)
                            : 'w-10 h-10 rounded-xl justify-center transition-all ' + (active ? 'bg-[var(--accent-primary)] text-white shadow-lg' : primary ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] hover:bg-[var(--accent-primary)] hover:text-white' : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]')}`}
                        title={!isOpen ? label : ''}
                    >
                        {isOpen && active && <div className="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-r-full bg-[var(--accent-primary)]" />}
                        <Icon className={`${isOpen ? 'w-4 h-4' : 'w-5 h-5'} ${isOpen ? (active ? 'text-[var(--accent-primary)]' : 'text-[var(--text-tertiary)]') : ''}`} strokeWidth={active || primary ? 2.25 : 1.75} />
                        {isOpen && <span className={`text-[13px] ${active ? 'font-semibold text-black' : 'text-black'}`}>{label}</span>}
                        {isOpen && primary === undefined && beta && <span className="text-[9px] px-1 py-px rounded bg-purple-500/10 text-purple-500 font-medium flex-shrink-0 ml-auto">beta</span>}
                    </button>
                ))}
            </nav>

            {/* ── Favorite Agents (Narrow Mode) ── */}
            {!isOpen && favoriteAgents.length > 0 && (
                <div className="flex flex-col items-center gap-2 mt-4 pt-4 border-t border-[var(--border-subtle)]/50">
                    {favoriteAgents.map(agent => (
                        <button
                            key={agent.id}
                            onClick={() => onSelectAgent(agent)}
                            className={`relative w-10 h-10 rounded-xl flex items-center justify-center text-lg font-semibold transition-all hover:scale-110 overflow-hidden ${selectedAgent?.id === agent.id ? 'scale-110' : ''}`}
                            title={agent.name}
                        >
                            {selectedAgent?.id === agent.id && <div className={ACCENT_BAR.replace('left-0', '-left-1.5')} />}
                            {agent.avatar && (agent.avatar.startsWith('data:') || agent.avatar.startsWith('http')) ? (
                                <img src={agent.avatar} alt="" className="w-full h-full object-cover" />
                            ) : (agent.avatar || agent.name?.[0]?.toUpperCase())}
                        </button>
                    ))}
                </div>
            )}

            {/* ── Projects ── */}
            {isOpen && projects.length > 0 && (
                <div className="flex-shrink-0 mt-1">
                    <div className={SECTION_HDR} onClick={toggleProjects}>
                        <span className={SECTION_LBL}>Projects</span>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={(e) => { e.stopPropagation(); onCreateProject?.(); }}
                                className="p-0.5 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] hover:text-[var(--accent-primary)] transition-colors"
                                title="New Project"
                            >
                                <Plus className="w-3.5 h-3.5" />
                            </button>
                            <ChevronDown className={`w-3.5 h-3.5 text-[var(--text-tertiary)] transition-transform duration-200 ${projectsOpen ? '' : '-rotate-90'}`} />
                        </div>
                    </div>

                    {projectsOpen && (
                        <div className="px-1.5 pb-1 space-y-0.5">

                            {projects.map(p => {
                                const active = activeProject?.id === p.id;
                                return (
                                    <button
                                        key={p.id}
                                        onClick={() => onSelectProject?.(active ? null : p)}
                                        className={`${ROW} group/p ${active ? ROW_ACTIVE : ROW_IDLE}`}
                                    >
                                        {active && <div className={ACCENT_BAR} />}
                                        <div className="w-5 h-5 rounded flex items-center justify-center text-xs flex-shrink-0" style={{ background: (p.color || '#6366f1') + '20' }}>
                                            {p.icon || '📁'}
                                        </div>
                                        <span className={`text-[13px] truncate flex-1 ${active ? TEXT_ACTIVE : TEXT_IDLE}`}>{p.name}</span>
                                        {p.permission && p.permission !== 'owner' && (
                                            <span className="text-[9px] px-1 py-px rounded bg-blue-500/10 text-blue-500 font-medium flex-shrink-0">shared</span>
                                        )}
                                        {(!p.permission || p.permission === 'owner') && (
                                            <span
                                                onClick={(e) => { e.stopPropagation(); onEditProject?.(p); }}
                                                className="opacity-0 group-hover/p:opacity-100 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] text-sm px-1 rounded transition-all cursor-pointer"
                                                title="Edit project"
                                            >⋯</span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                    <div className="mx-3 my-0.5 border-t border-[var(--border-subtle)]" />
                </div>
            )}

            {/* ── New Project (when no projects yet) ── */}
            {isOpen && projects.length === 0 && (
                <div className="px-2 mt-1">
                    <button
                        onClick={() => onCreateProject?.()}
                        className={`${ROW} ${ROW_IDLE} text-[var(--text-tertiary)]`}
                    >
                        <Plus className="w-4 h-4" />
                        <span className="text-[13px]">New Project</span>
                    </button>
                </div>
            )}

            {/* ── Divider ── */}
            <div className="mx-3 my-1.5 border-t border-[var(--border-subtle)]" />

            {/* ── My Agents ── */}
            {isOpen && (
                <div className="flex-shrink-0">
                    <div className={SECTION_HDR} onClick={toggleAgents}>
                        <span className={SECTION_LBL}>My Agents</span>
                        <ChevronDown className={`w-3.5 h-3.5 text-[var(--text-tertiary)] transition-transform duration-200 ${agentsOpen ? '' : '-rotate-90'}`} />
                    </div>

                    {agentsOpen && (
                        <div className="px-1.5 pb-1">
                            {favoriteAgents.length > 0 ? favoriteAgents.map(agent => {
                                const sel = selectedAgent?.id === agent.id;
                                return (
                                    <button
                                        key={agent.id}
                                        onClick={() => onSelectAgent(agent)}
                                        className={`${ROW} group/a ${ROW_IDLE}`}
                                    >
                                        {sel && <div className={ACCENT_BAR} />}
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg font-semibold flex-shrink-0 transition-transform overflow-hidden ${sel ? 'scale-110' : ''}`}>
                                            {agent.avatar && (agent.avatar.startsWith('data:') || agent.avatar.startsWith('http')) ? (
                                                <img src={agent.avatar} alt="" className="w-full h-full object-cover" />
                                            ) : (agent.avatar || (agent._type === 'roundtable' ? '🗣️' : agent.name?.[0]?.toUpperCase()))}
                                        </div>
                                        <span className={`text-[13px] truncate flex-1 ${sel ? TEXT_ACTIVE : TEXT_IDLE}`}>
                                            {agent.name}
                                        </span>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onToggleFavorite?.(agent.id); }}
                                            className="opacity-0 group-hover/a:opacity-100 p-1 text-[var(--text-tertiary)] hover:text-red-500 rounded transition-opacity flex-shrink-0"
                                            title="Remove from favorites"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </button>
                                );
                            }) : (
                                <button onClick={onOpenMarketplace} className={`${ROW} ${ROW_IDLE} text-[var(--text-tertiary)]`}>
                                    <span className="text-[13px]">Discover AI Agents</span>
                                </button>
                            )}
                        </div>
                    )}
                    <div className="mx-3 my-0.5 border-t border-[var(--border-subtle)]" />
                </div>
            )}

            {/* ── Recent Chats ── */}
            <div className={`flex-1 min-h-0 flex flex-col overflow-hidden ${isOpen ? '' : 'hidden'}`}>
                <div className={SECTION_HDR} onClick={toggleChats}>
                    <span className={SECTION_LBL}>Chats</span>
                    <div className="flex items-center gap-1.5">
                        {allConvs.length > 0 && (
                            <span className="text-[10px] text-[var(--text-tertiary)] font-medium tabular-nums">{allConvs.length}</span>
                        )}
                        <ChevronDown className={`w-3.5 h-3.5 text-[var(--text-tertiary)] transition-transform duration-200 ${chatsOpen ? '' : '-rotate-90'}`} />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar px-1.5 pb-1">
                    {isOpen ? (allConvs.length === 0 ? (
                        <p className="px-3 py-2 text-[12px] text-[var(--text-tertiary)]">
                            {selectedAgent || directChatMode ? 'No chats yet' : 'Select an agent to begin'}
                        </p>
                    ) : (
                        !chatsOpen ? (
                            <>
                                {previewConvs.map(c => <ConvRow key={c.id} conv={c} />)}
                                {hasMore && (
                                    <button onClick={toggleChats} className={`${ROW} ${ROW_IDLE} h-8 justify-center`}>
                                        <span className="text-[12px] font-medium text-[var(--accent-primary)]">
                                            View all ({allConvs.length})
                                        </span>
                                    </button>
                                )}
                            </>
                        ) : (
                            groupedConvs.map(group => (
                                <div key={group.label} className="mt-3 first:mt-0">
                                    <h3 className="px-3 py-1 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                                        {group.label}
                                    </h3>
                                    <div className="space-y-px">
                                        {group.items.map(c => <ConvRow key={c.id} conv={c} />)}
                                    </div>
                                </div>
                            ))
                        )
                    )) : null}
                </div>
            </div>

            {/* ── Account footer ── */}
            <div className={`flex-shrink-0 mt-auto border-t border-[var(--border-subtle)] relative ${isOpen ? '' : 'flex justify-center flex-shrink-0'}`} ref={profileRef}>
                <div
                    onClick={() => setShowProfileMenu(v => !v)}
                    className={`flex items-center transition-colors cursor-pointer ${isOpen ? 'w-full gap-2.5 px-4 h-14 ' + (showProfileMenu ? 'bg-[var(--bg-tertiary)]' : 'hover:bg-[var(--bg-tertiary)]') : 'w-10 h-10 my-3 rounded-full justify-center hover:bg-[var(--bg-tertiary)]'}`}
                    role="button"
                    tabIndex={0}
                >
                    {user?.avatarType === 'emoji' && user?.avatar ? (
                        <div className={`rounded-full flex items-center justify-center flex-shrink-0 bg-[var(--bg-tertiary)] ${isOpen ? 'w-8 h-8 text-base' : 'w-10 h-10 text-xl'}`}>
                            {user.avatar}
                        </div>
                    ) : user?.avatarType === 'image' && user?.avatar ? (
                        <img src={user.avatar.startsWith('/') ? `${API_BASE}${user.avatar}` : user.avatar} alt="" className={`rounded-full object-cover flex-shrink-0 ${isOpen ? 'w-8 h-8' : 'w-10 h-10'}`} />
                    ) : (
                        <div className={`rounded-full flex items-center justify-center flex-shrink-0 ${isOpen ? 'w-8 h-8' : 'w-10 h-10'}`}
                            style={{ background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-primary-hover))' }}>
                            <User className={`${isOpen ? 'w-4 h-4' : 'w-5 h-5'} text-white`} />
                        </div>
                    )}
                    {isOpen && (
                        <>
                            <div className="flex-1 min-w-0 text-left flex items-center gap-2">
                                <span className="text-[13px] font-medium truncate text-[var(--text-primary)]">
                                    {user?.displayName || user?.id || 'User'}
                                </span>
                                {user?.isDemo && (
                                    <span className="text-[9px] px-1 py-px rounded bg-amber-500/10 text-amber-600/70 font-medium flex-shrink-0">demo</span>
                                )}
                            </div>
                            <div onClick={e => e.stopPropagation()} className="flex-shrink-0">
                                <NotificationCenter />
                            </div>
                            <ChevronDown className={`w-4 h-4 flex-shrink-0 text-[var(--text-tertiary)] transition-transform duration-200 ${showProfileMenu ? 'rotate-180' : ''}`} />
                        </>
                    )}
                </div>

                {showProfileMenu && (
                    <div
                        className={`absolute rounded-xl border shadow-2xl overflow-hidden z-50 ${isOpen ? 'bottom-full left-3 right-3 mb-2' : 'bottom-full left-14 mb-0 w-48'}`}
                        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)', animation: 'sidebarMenuIn .15s ease-out' }}
                    >
                        <div className="p-1">
                            {!isMobile && (user?.isAdmin || user?.permissions?.includes('all')) && (
                                <button
                                    onClick={() => { setShowProfileMenu(false); onNavigate('admin'); }}
                                    className={`${ROW} ${currentPage === 'admin' ? ROW_ACTIVE : ROW_IDLE}`}
                                >
                                    {currentPage === 'admin' && <div className={ACCENT_BAR} />}
                                    <Shield className={`w-4 h-4 ${currentPage === 'admin' ? ICON_ACTIVE : ICON_IDLE}`} strokeWidth={1.75} />
                                    <span className={`text-[13px] ${currentPage === 'admin' ? TEXT_ACTIVE : TEXT_IDLE}`}>Admin Dashboard</span>
                                </button>
                            )}
                            {!isMobile && user?.featureFlags?.tasks !== false && (user?.isAdmin || user?.permissions?.includes('all') || (Array.isArray(user?.betaFeatures) && user.betaFeatures.includes('tasks'))) && (
                                <button
                                    onClick={() => { setShowProfileMenu(false); onNavigate('tasks'); }}
                                    className={`${ROW} ${currentPage === 'tasks' ? ROW_ACTIVE : ROW_IDLE}`}
                                >
                                    {currentPage === 'tasks' && <div className={ACCENT_BAR} />}
                                    <CheckSquare className={`w-4 h-4 ${currentPage === 'tasks' ? ICON_ACTIVE : ICON_IDLE}`} strokeWidth={1.75} />
                                    <span className={`text-[13px] ${currentPage === 'tasks' ? TEXT_ACTIVE : TEXT_IDLE}`}>Tasks</span>
                                    <span className="text-[9px] px-1 py-px rounded bg-purple-500/10 text-purple-500 font-medium flex-shrink-0 ml-auto">beta</span>
                                </button>
                            )}
                            {!isMobile && user?.featureFlags?.monitoring !== false && (user?.isAdmin || user?.permissions?.includes('all') || (Array.isArray(user?.betaFeatures) && user.betaFeatures.includes('monitoring'))) && (
                                <button
                                    onClick={() => { setShowProfileMenu(false); onNavigate('monitoring'); }}
                                    className={`${ROW} ${currentPage === 'monitoring' ? ROW_ACTIVE : ROW_IDLE}`}
                                >
                                    {currentPage === 'monitoring' && <div className={ACCENT_BAR} />}
                                    <BarChart3 className={`w-4 h-4 ${currentPage === 'monitoring' ? ICON_ACTIVE : ICON_IDLE}`} strokeWidth={1.75} />
                                    <span className={`text-[13px] ${currentPage === 'monitoring' ? TEXT_ACTIVE : TEXT_IDLE}`}>Monitoring</span>
                                    <span className="text-[9px] px-1 py-px rounded bg-purple-500/10 text-purple-500 font-medium flex-shrink-0 ml-auto">beta</span>
                                </button>
                            )}
                            {!isMobile && (user?.isAdmin || user?.permissions?.includes('all') || user?.permissions?.includes('org_admin') || user?.permissions?.some?.(p => p.startsWith?.('admin_')) || user?.orgRole === 'admin' || user?.orgRole === 'org_admin') && (
                                <button
                                    onClick={() => { setShowProfileMenu(false); onNavigate('agentDesigner'); }}
                                    className={`${ROW} ${currentPage === 'agentDesigner' ? ROW_ACTIVE : ROW_IDLE}`}
                                >
                                    {currentPage === 'agentDesigner' && <div className={ACCENT_BAR} />}
                                    <Bot className={`w-4 h-4 ${currentPage === 'agentDesigner' ? ICON_ACTIVE : ICON_IDLE}`} strokeWidth={1.75} />
                                    <span className={`text-[13px] ${currentPage === 'agentDesigner' ? TEXT_ACTIVE : TEXT_IDLE}`}>Agents</span>
                                </button>
                            )}
                            {!isMobile && (
                                <button
                                    onClick={() => { setShowProfileMenu(false); onNavigate('settings'); }}
                                    className={`${ROW} ${currentPage === 'settings' ? ROW_ACTIVE : ROW_IDLE}`}
                                >
                                    {currentPage === 'settings' && <div className={ACCENT_BAR} />}
                                    <Settings className={`w-4 h-4 ${currentPage === 'settings' ? ICON_ACTIVE : ICON_IDLE}`} strokeWidth={1.75} />
                                    <span className={`text-[13px] ${currentPage === 'settings' ? TEXT_ACTIVE : TEXT_IDLE}`}>Settings</span>
                                </button>
                            )}
                        </div>
                        <div className="border-t border-[var(--border-subtle)] p-1">
                            <button onClick={onLogout} className={`${ROW} ${ROW_IDLE} group/so`}>
                                <LogOut className="w-4 h-4 text-red-400 group-hover/so:text-red-500 transition-colors" strokeWidth={1.75} />
                                <span className="text-[13px] text-[var(--text-tertiary)] group-hover/so:text-red-500 transition-colors">Sign Out</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <style>{`
                @keyframes sidebarMenuIn {
                    from { opacity: 0; transform: translateY(4px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );

    if (isMobile && isOpen) {
        return (
            <div className="fixed inset-0 z-50 flex">
                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => onClose?.()} />
                <div className="relative sidebar-slide-in" style={{ zIndex: 1 }}>{content}</div>
            </div>
        );
    }
    return content;
};

export default Sidebar;
