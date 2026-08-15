import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from '../hooks/useTranslation';
import { MessageSquare, Trash2, Store, Bot, User, Users, Shield, Settings, LogOut, ChevronDown, Search, X, FolderOpen, Plus, FolderInput, Pin, PinOff, Pencil, MoreHorizontal, Tag, Check, FileText, PenLine, Handshake, Mail, BookOpen, LayoutGrid, AppWindow } from 'lucide-react';
import { useTheme } from './ThemeContext';
import { useLicenseContext } from './LicenseContext';
import { useEntitlements } from './EntitlementsContext';
import { API_BASE, authFetch } from '../utils/helpers';
import { isImageAvatar, resolveAvatarSrc, pickAgentAvatar, DEFAULT_AGENT_EMOJI } from '../utils/agentAvatar';
import NotificationCenter from './NotificationCenter';
import NavLink from './NavLink';
import AppIcon from './AppIcon';
// The Studio app registry doubles as the sidebar's Studio-group source: the
// Studio screen no longer has its own tab bar, so the sections (and their
// gates) render here instead. Main-chunk-safe by design — see the import
// discipline note in studioApps.jsx.
import { STUDIO_APPS, makeCanUse } from './admin/Studio/studioApps';
import { useRuntimeStudioApps } from '../moduleRuntime/registry';
import { studioAppsApi } from './admin/Studio/AppStudio/studioAppsApi';
import beeFlowIcon from '../assets/BeeFlow-logo-Icon-2026.svg';
import beeFlowLogo from '../assets/bee-flow-logo.svg';


/* ─── Design tokens ─── */
const ROW = 'w-full flex items-center gap-2.5 px-3 h-9 rounded-lg transition-all duration-150 text-left relative';
const ROW_ACTIVE = 'bg-[var(--item-active-bg)]';
const ROW_IDLE = 'hover:bg-[var(--item-hover-bg)]';
const ACCENT_BAR = 'absolute left-0 top-1 bottom-1 w-[3px] rounded-r-full bg-[var(--accent-primary)]';
const SECTION_HDR = 'flex items-center justify-between px-3 h-9 cursor-pointer select-none';
// Uppercase micro-heading — same voice as the marketing header's mega-menu
// column headings (BUILD / WORK).
const SECTION_LBL = 'text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--text-tertiary)]';
const CONV_ROW = 'w-full flex items-center px-4 py-1 text-left relative cursor-pointer gap-1.5';
const ICON_ACTIVE = 'text-[var(--accent-primary)]';
const ICON_IDLE = 'text-[var(--text-tertiary)]';
const TEXT_ACTIVE = 'font-bold text-[var(--text-primary)]';
const TEXT_IDLE = 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors';
const ACCENT_BAR_CONV = 'absolute left-0 top-0 bottom-0 w-[3px] bg-gray-400 rounded-r-sm';

import scopedStorage from '../utils/scopedStorage';

/* ─── Scoped-storage helpers for sidebar collapse state (per-user). */
const storageKey = (k) => `sidebar_${k}_expanded`;
const readExpanded = (k, fallback) => {
    const v = scopedStorage.getItem(storageKey(k));
    return v !== null ? v === '1' : fallback;
};
const writeExpanded = (k, v) => {
    scopedStorage.setItem(storageKey(k), v ? '1' : '0');
};

/* ─── Published-app icon colour — the app's accent (validated hex), same
   default as AppList / AppsHomePage. No tile behind it, just the glyph. */
const APP_DEFAULT_ACCENT = '#0F766E';
const appAccent = (accentColor) => (/^#[0-9a-fA-F]{6}$/.test(accentColor || '') ? accentColor : APP_DEFAULT_ACCENT);

/* ─── Inline label creator (with color wheel) ─── */
const CreateLabelInline = ({ onCreateLabel, t }) => {
    const [isCreating, setIsCreating] = useState(false);
    const [name, setName] = useState('');
    const [color, setColor] = useState('#6366f1');
    const inputRef = useRef(null);
    const containerRef = useRef(null);

    useEffect(() => {
        if (isCreating && inputRef.current) inputRef.current.focus();
    }, [isCreating]);

    useEffect(() => {
        if (!isCreating) return;
        const close = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setIsCreating(false); setName('');
            }
        };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, [isCreating]);

    const handleCreate = async () => {
        const trimmed = name.trim();
        if (trimmed && onCreateLabel) {
            await onCreateLabel(trimmed, color);
            setName(''); setColor('#6366f1'); setIsCreating(false);
        }
    };

    if (!isCreating) {
        return (
            <button
                onClick={(e) => { e.stopPropagation(); setIsCreating(true); }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[12px] hover:bg-[var(--bg-secondary)] rounded-md transition-colors text-left text-[var(--text-tertiary)]"
            >
                <Plus className="w-3 h-3" /> {t ? t('sidebar.new_label') : 'New label'}
            </button>
        );
    }

    return (
        <div ref={containerRef} className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-1.5">
                <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-6 h-6 rounded cursor-pointer border-0 p-0 bg-transparent"
                    title="Pick a color"
                    style={{ WebkitAppearance: 'none' }}
                />
                <input
                    ref={inputRef}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && name.trim()) handleCreate();
                        if (e.key === 'Escape') { setName(''); setIsCreating(false); }
                    }}
                    placeholder="Label name..."
                    className="flex-1 text-[12px] bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded px-2 py-1 outline-none focus:border-[var(--accent-primary)] text-[var(--text-primary)] min-w-0"
                />
                <button
                    onClick={handleCreate}
                    disabled={!name.trim()}
                    className="text-[11px] px-2 py-0.5 rounded-md bg-[var(--accent-primary)] text-[var(--accent-primary-fg,#fff)] font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
                >
                    {t ? t('common.add') : 'Add'}
                </button>
            </div>
        </div>
    );
};

/* ─── Inline label editor ─── */
const EditLabelInline = ({ label, onSave, onCancel, t }) => {
    const [name, setName] = useState(label.name);
    const [color, setColor] = useState(label.color);
    const inputRef = useRef(null);

    useEffect(() => {
        if (inputRef.current) { inputRef.current.focus(); inputRef.current.select(); }
    }, []);

    const handleSave = () => {
        const trimmed = name.trim();
        if (trimmed && (trimmed !== label.name || color !== label.color)) {
            onSave(label.id, { name: trimmed, color });
        }
        onCancel();
    };

    return (
        <div className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-1.5">
                <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-6 h-6 rounded cursor-pointer border-0 p-0 bg-transparent"
                    title="Pick a color"
                    style={{ WebkitAppearance: 'none' }}
                />
                <input
                    ref={inputRef}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSave();
                        if (e.key === 'Escape') onCancel();
                    }}
                    className="flex-1 text-[12px] bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded px-2 py-1 outline-none focus:border-[var(--accent-primary)] text-[var(--text-primary)] min-w-0"
                />
                <button onClick={handleSave} className="text-[11px] px-2 py-0.5 rounded-md bg-[var(--accent-primary)] text-[var(--accent-primary-fg,#fff)] font-medium hover:opacity-90">
                    {t ? t('common.save') : 'Save'}
                </button>
                <button onClick={onCancel} className="text-[11px] p-0.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    );
};

/* ─── Conversation row (module-level to avoid closure issues in minified builds) ─── */
const ConvRow = ({
    conv, t, active,
    selectConv, deleteConv,
    conversationLabels, projects, activeProjectId,
    onRenameConversation, onPinConversation, onLabelConversation,
    onDeleteLabel, onEditLabel, onCreateLabel, onMoveToProject, onShareToProject,
    agentBadge,
}) => {
    const [showMenu, setShowMenu] = useState(false);
    const [isRenaming, setIsRenaming] = useState(false);
    const [renameValue, setRenameValue] = useState(conv.title || '');
    const [editingLabelId, setEditingLabelId] = useState(null);
    const menuRef = useRef(null);
    const inputRef = useRef(null);

    // Close menu on outside click
    useEffect(() => {
        if (!showMenu) return;
        const close = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false); };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, [showMenu]);

    // Focus input when rename starts
    useEffect(() => {
        if (isRenaming && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isRenaming]);

    const handleRename = () => {
        const trimmed = renameValue.trim();
        if (trimmed && trimmed !== conv.title) {
            onRenameConversation?.(conv, trimmed);
        }
        setIsRenaming(false);
    };

    const handlePin = () => {
        onPinConversation?.(conv);
        setShowMenu(false);
    };

    if (isRenaming) {
        return (
            <div className={`${CONV_ROW} pr-2`}>
                <input
                    ref={inputRef}
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={handleRename}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRename();
                        if (e.key === 'Escape') { setRenameValue(conv.title || ''); setIsRenaming(false); }
                    }}
                    className="flex-1 text-[13px] bg-[var(--bg-card)] border border-[var(--accent-primary)] rounded px-1.5 py-0.5 outline-none text-[var(--text-primary)] min-w-0"
                    onClick={(e) => e.stopPropagation()}
                />
            </div>
        );
    }

    return (
        <div
            onClick={() => selectConv(conv)}
            className={`group ${CONV_ROW}`}
            title={conv.updated_at ? new Date(conv.updated_at).toLocaleString() : ''}
            data-testid={`conv-row-${conv.id}`}
        >
            {active && <div className={ACCENT_BAR_CONV} />}
            {conv.pinned && <Pin className="w-3 h-3 text-[var(--accent-primary)] flex-shrink-0 -rotate-45" />}
            {/* Label dots */}
            {(() => { try { const ls = JSON.parse(conv.labels_json || '[]'); const applied = ls.map(lid => (conversationLabels || []).find(x => x.id === lid)).filter(Boolean); if (!applied.length) return null; return (
                <div className="flex items-center gap-1 flex-shrink-0 max-w-[55%] overflow-hidden">
                    {/* Show the first applied label as a readable name-pill and any
                        extras as larger dots, so the applied state is actually
                        visible instead of an easily-missed 8px dot (BFSF-212). */}
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium truncate"
                          style={{ background: `${applied[0].color}22`, color: applied[0].color, border: `1px solid ${applied[0].color}` }}
                          title={applied.map(l => l.name).join(', ')}>
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: applied[0].color }} />
                        {applied[0].name}
                    </span>
                    {applied.slice(1).map(l => (
                        <span key={l.id} className="w-2.5 h-2.5 rounded-full flex-shrink-0 ring-1 ring-white/50" style={{ background: l.color }} title={l.name} />
                    ))}
                </div>
            ); } catch { return null; } })()}
            {/* Agent avatar to the left */}
            {agentBadge && (
                <div className={`w-6 h-6 rounded-md flex-shrink-0 overflow-hidden flex items-center justify-center text-[11px] font-bold ring-1 ${agentBadge.avatarUrl ? 'ring-black/8 bg-[var(--bg-tertiary)]' : 'ring-black/8 bg-gradient-to-br from-[var(--accent-primary)]/10 to-[var(--accent-primary)]/25 text-[var(--accent-primary)]'}`}>
                    {agentBadge.avatarUrl ? (
                        <img src={agentBadge.avatarUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
                    ) : (
                        <span className="leading-none">{agentBadge.icon}</span>
                    )}
                </div>
            )}
            <span className={`text-[14px] truncate flex-1 leading-snug min-w-0 ${active ? TEXT_ACTIVE : TEXT_IDLE}`}>
                {conv.title || t('sidebar.untitled_chat')}
            </span>
            {/* Which project this chat is filed under. Project chats are no
                longer hidden from the general lists, so the chip is what keeps
                the filing visible — otherwise they would look identical to
                unfiled ones. Suppressed while inside that project, where every
                row would carry the same chip. */}
            {(() => {
                if (!conv.project_id || activeProjectId === conv.project_id) return null;
                const p = projects?.find(pr => pr.id === conv.project_id);
                if (!p) return null;
                return (
                    <span
                        className="flex-shrink-0 text-[10px] px-1 py-px rounded flex items-center gap-0.5 max-w-[80px]"
                        style={{ background: (p.color || '#6366f1') + '20', color: p.color || '#6366f1' }}
                        title={`In project: ${p.name}`}
                    >
                        <span>{p.icon || '📁'}</span>
                        <span className="truncate">{p.name}</span>
                    </span>
                );
            })()}
            {/* Three-dot menu */}
            <div className="relative" ref={menuRef}>
                <button
                    onClick={(e) => { e.stopPropagation(); setShowMenu(v => !v); }}
                    className={`${showMenu ? 'opacity-100' : 'opacity-0'} group-hover:opacity-100 focus:opacity-100 p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] rounded transition-opacity flex-shrink-0`}
                    title="Options"
                    data-testid={`conv-options-${conv.id}`}
                >
                    <MoreHorizontal className="w-3.5 h-3.5" />
                </button>
                {showMenu && (
                    <div
                        className="absolute right-0 top-full mt-1 w-52 rounded-lg border shadow-xl overflow-hidden z-50"
                        style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)', animation: 'sidebarMenuIn .15s ease-out' }}
                    >
                        <div className="p-1">
                            {/* Pin / Unpin */}
                            <button
                                onClick={(e) => { e.stopPropagation(); handlePin(); }}
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[12px] hover:bg-[var(--bg-secondary)] rounded-md transition-colors text-left text-[var(--text-primary)]"
                            >
                                {conv.pinned
                                    ? <><PinOff className="w-3.5 h-3.5" /> {t('sidebar.unpin')}</>
                                    : <><Pin className="w-3.5 h-3.5" /> {t('sidebar.pin_to_top')}</>
                                }
                            </button>
                            {/* Rename */}
                            <button
                                onClick={(e) => { e.stopPropagation(); setShowMenu(false); setIsRenaming(true); }}
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[12px] hover:bg-[var(--bg-secondary)] rounded-md transition-colors text-left text-[var(--text-primary)]"
                            >
                                <Pencil className="w-3.5 h-3.5" /> {t('sidebar.rename')}
                            </button>
                            {/* Labels */}
                            <div className="mx-1 my-1 border-t border-[var(--border-subtle)]" />
                            <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] flex items-center gap-1.5">
                                <Tag className="w-3 h-3" /> {t('sidebar.labels')}
                            </div>
                            <div className="max-h-40 overflow-y-auto">
                                {(conversationLabels || []).map(label => {
                                    if (editingLabelId === label.id) {
                                        return <EditLabelInline key={label.id} label={label} onSave={(id, updates) => { onEditLabel?.(id, updates); setEditingLabelId(null); }} onCancel={() => setEditingLabelId(null)} t={t} />;
                                    }
                                    const convLabels = (() => { try { return JSON.parse(conv.labels_json || '[]'); } catch { return []; } })();
                                    const has = convLabels.includes(label.id);
                                    return (
                                        <div key={label.id} className="group/lbl flex items-center">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onLabelConversation?.(conv, label.id); }}
                                                className="flex-1 flex items-center gap-2 px-2.5 py-1.5 text-[12px] hover:bg-[var(--bg-secondary)] rounded-md transition-colors text-left text-[var(--text-primary)] min-w-0"
                                            >
                                                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 ring-1 ring-black/10" style={{ background: label.color }} />
                                                <span className="flex-1 truncate">{label.name}</span>
                                                {has && <Check className="w-3.5 h-3.5 text-[var(--accent-primary)] flex-shrink-0" />}
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setEditingLabelId(label.id); }}
                                                className="p-1 text-[var(--text-tertiary)] hover:text-[var(--accent-primary)] rounded transition-all flex-shrink-0 opacity-0 group-hover/lbl:opacity-100"
                                                title="Edit label"
                                            >
                                                <Pencil className="w-2.5 h-2.5" />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); if (confirm(`Delete label "${label.name}"?`)) { onDeleteLabel?.(label.id); } }}
                                                className="p-1 mr-1 text-[var(--text-tertiary)] hover:text-red-500 rounded transition-all flex-shrink-0 opacity-0 group-hover/lbl:opacity-100"
                                                title="Delete label"
                                            >
                                                <X className="w-2.5 h-2.5" />
                                            </button>
                                        </div>
                                    );
                                })}
                                {(conversationLabels || []).length === 0 && (
                                    <div className="px-2.5 py-1.5 text-[11px] text-[var(--text-tertiary)] italic">{t('sidebar.no_labels_yet')}</div>
                                )}
                            </div>
                            {/* Create new label inline */}
                            <CreateLabelInline onCreateLabel={onCreateLabel} t={t} />
                            {/* Move to project */}
                            {(projects || []).length > 0 && (
                                <>
                                    <div className="mx-1 my-1 border-t border-[var(--border-subtle)]" />
                                    {conv.project_id && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onMoveToProject?.(conv, null); setShowMenu(false); }}
                                            className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[12px] hover:bg-[var(--bg-secondary)] rounded-md transition-colors text-left text-[var(--text-secondary)]"
                                        >
                                            <X className="w-3.5 h-3.5" /> {t('sidebar.remove_from_project')}
                                        </button>
                                    )}
                                    {(projects || []).filter(p => p.id !== conv.project_id).map(p => (
                                        <button
                                            key={p.id}
                                            onClick={(e) => { e.stopPropagation(); onMoveToProject?.(conv, p); setShowMenu(false); }}
                                            className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[12px] hover:bg-[var(--bg-secondary)] rounded-md transition-colors text-left text-[var(--text-primary)]"
                                        >
                                            <div className="w-4 h-4 rounded flex items-center justify-center text-[10px] flex-shrink-0" style={{ background: (p.color || '#6366f1') + '20' }}>
                                                {p.icon || '📁'}
                                            </div>
                                            <span className="truncate">{p.name}</span>
                                        </button>
                                    ))}
                                </>
                            )}
                            {/* Share into the project this chat is filed under.
                                Separate from "move to project" on purpose:
                                filing is private bookkeeping, sharing publishes
                                the conversation to every member and re-encrypts
                                it. Conflating the two would share people's chats
                                without them asking. Only offered once the chat
                                is already in a project, so the target is
                                unambiguous. */}
                            {conv.project_id && onShareToProject && (
                                <>
                                    <div className="mx-1 my-1 border-t border-[var(--border-subtle)]" />
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onShareToProject(conv); setShowMenu(false); }}
                                        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[12px] hover:bg-[var(--bg-secondary)] rounded-md transition-colors text-left text-[var(--text-secondary)]"
                                    >
                                        <Users className="w-3.5 h-3.5" />
                                        {conv.shared_scope === 'project'
                                            ? t('projects.unshare_thread')
                                            : t('projects.share_thread')}
                                    </button>
                                </>
                            )}
                            {/* Delete */}
                            <div className="mx-1 my-1 border-t border-[var(--border-subtle)]" />
                            <button
                                onClick={(e) => { e.stopPropagation(); deleteConv(conv); setShowMenu(false); }}
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[12px] hover:bg-red-50 rounded-md transition-colors text-left text-red-500"
                                data-testid={`conv-delete-${conv.id}`}
                            >
                                <Trash2 className="w-3.5 h-3.5" /> {t('common.delete')}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const Sidebar = ({
    isOpen, isMobile = false, onClose,
    selectedAgent, onClearSelection,
    favorites = [], agents = [],
    groupedConversations, currentConversation,
    onSelectConversation, onDeleteConversation,
    onSelectAgent, onOpenMarketplace, onOpenSearch, onOpenKBStore,
    user, onLogout, onNavigate, currentPage, studioRoute = null,
    hasPermission: hasPermissionProp = null,
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
    onBrowseProjects,
    onMoveToProject,
    onShareToProject,
    onRenameConversation,
    onPinConversation,
    onLabelConversation,
    conversationLabels = [],
    onCreateLabel,
    onDeleteLabel,
    onEditLabel,
    chatHistoryMode = 'per-agent',
    allAgentConversations = [],
    onSelectAllChatsConversation,
    showSettings = false,
    showAgentDesigner = false,
    showAITasks = false,
    showSkillsPanel = false,
    showMarketplace = false,
}) => {
    const { t, locale } = useTranslation();
    // We'll use the 'isOpen' prop as 'sidebarOpen' (expanded state)
    // and if !isOpen, we'll show the narrow 'Power Bar'
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const themeCtx = useTheme();
    const { hasFeature: hasLicenseFeature, deploymentMode } = useLicenseContext();
    // Effective-permission check for the Studio section gates. AgentHub passes
    // the real resolver; fall back to a permissions spot-check so the sidebar
    // renders sanely if a caller omits it.
    const hasPermission = hasPermissionProp || ((perm) => {
        const perms = user?.permissions || [];
        return perms.includes('all') || perms.includes(perm);
    });
    // App Studio consumers/builders get an "Apps" nav entry (the published-apps
    // directory at /app/apps). Gated on the app_studio capability — apps are
    // only shareable inside the licensed org, so anyone who can be an audience
    // holds the capability (see the Wave-8 viewer-entitlement decision).
    const { can: canUseCapability } = useEntitlements();
    // White-label override: in self-hosted deploys swap the Bee Flow logo for
    // the org's uploaded logo (and show a "Powered by Bee Flow" footer below).
    // Cloud is unchanged. Falls back to the Bee Flow logo if no org logo set.
    const orgLogoUrl = user?.organization?.logo
        ? (user.organization.logo.startsWith('/') ? `${API_BASE}${user.organization.logo}` : user.organization.logo)
        : null;
    const useOrgBrand = deploymentMode === 'self-hosted' && !!orgLogoUrl;
    const orgAltText = user?.organization?.name || 'Organization';
    const [agentsOpen, setAgentsOpen] = useState(() => readExpanded('agents', true));
    const [chatsOpen, setChatsOpen] = useState(() => readExpanded('chats', false));
    const [projectsOpen, setProjectsOpen] = useState(() => readExpanded('projects', true));
    const [activeCoworkCount, setActiveCoworkCount] = useState(0);
    const profileRef = useRef(null);
    const scrollRef = useRef(null);
    const secondaryItemRefs = useRef({});
    const [hiddenSecondaryKeys, setHiddenSecondaryKeys] = useState(() => new Set());

    const toggleAgents = useCallback(() => setAgentsOpen(p => { writeExpanded('agents', !p); return !p; }), []);
    const toggleChats = useCallback(() => setChatsOpen(p => { writeExpanded('chats', !p); return !p; }), []);
    const toggleProjects = useCallback(() => setProjectsOpen(p => { writeExpanded('projects', !p); return !p; }), []);

    /* ─── Studio + Apps flyout panels ───
       The Studio screen has no tab bar of its own anymore: its sections (from
       the same registry the shell renders from, gates included) open from a
       floating panel BESIDE the sidebar row — the marketing header's
       mega-menu, turned sideways. Published App Studio apps hang off the Apps
       row the same way. Hover opens (a grace timer lets the pointer cross the
       gap to the panel); click toggles; Escape, scrolling the sidebar or
       picking a destination closes. Fixed-positioned so the sidebar's own
       scroll container can't clip it. */
    const [flyout, setFlyout] = useState(null); // { key, top, left } | null
    const flyoutCloseTimer = useRef(null);
    const openFlyout = useCallback((key, anchorEl) => {
        if (flyoutCloseTimer.current) { clearTimeout(flyoutCloseTimer.current); flyoutCloseTimer.current = null; }
        const rect = anchorEl.getBoundingClientRect();
        // -6 compensates the panel's own padding so the FIRST item sits level
        // with the row that opened it.
        setFlyout({ key, top: rect.top - 6, left: rect.right + 8 });
    }, []);
    const scheduleFlyoutClose = useCallback((key) => {
        if (flyoutCloseTimer.current) clearTimeout(flyoutCloseTimer.current);
        flyoutCloseTimer.current = setTimeout(() => {
            setFlyout(f => (f?.key === key ? null : f));
        }, 180);
    }, []);
    const closeFlyout = useCallback(() => {
        if (flyoutCloseTimer.current) { clearTimeout(flyoutCloseTimer.current); flyoutCloseTimer.current = null; }
        setFlyout(null);
    }, []);
    useEffect(() => () => { if (flyoutCloseTimer.current) clearTimeout(flyoutCloseTimer.current); }, []);
    // Escape and sidebar scrolling both dismiss the panel — it is fixed-
    // positioned, so it would visually detach from its row otherwise.
    useEffect(() => {
        if (!flyout) return undefined;
        const onKey = (e) => { if (e.key === 'Escape') closeFlyout(); };
        const scroller = scrollRef.current;
        document.addEventListener('keydown', onKey);
        scroller?.addEventListener('scroll', closeFlyout);
        return () => {
            document.removeEventListener('keydown', onKey);
            scroller?.removeEventListener('scroll', closeFlyout);
        };
    }, [flyout, closeFlyout]);

    // Runtime (remotely-installed) modules contribute extra Studio sections;
    // they join the group after the built-ins, exactly like the old tab bar.
    const runtimeStudioApps = useRuntimeStudioApps();

    // Published apps for the Apps group — the same merge AppsHomePage does
    // (accessible ∪ own, published only), but alphabetical: a menu should not
    // reshuffle every time someone saves. Loaded once, then refreshed when
    // entering the directory or coming back from Studio (where publishing
    // happens) — not on every page change.
    const canSeeApps = canUseCapability('app_studio');
    const [publishedApps, setPublishedApps] = useState([]);
    const prevPageRef = useRef(undefined);
    const appsLoadedRef = useRef(false);
    useEffect(() => {
        const prev = prevPageRef.current;
        prevPageRef.current = currentPage;
        if (!canSeeApps) return undefined;
        if (appsLoadedRef.current && currentPage !== 'apps' && prev !== 'studio') return undefined;
        appsLoadedRef.current = true;
        let cancelled = false;
        (async () => {
            // Per-call catches: a consumer without builder rights may 403 on
            // /mine, and the shared directory must still fill the menu.
            const [accessible, mine] = await Promise.all([
                studioAppsApi.listAccessible().catch(() => null),
                studioAppsApi.listMine().catch(() => null),
            ]);
            if (cancelled) return;
            const isPublished = (a) => !!(a?.isPublished ?? a?.is_published);
            const byId = new Map();
            for (const a of [...(accessible?.apps || []), ...(mine?.apps || [])]) {
                if (a?.id && isPublished(a) && !byId.has(a.id)) byId.set(a.id, a);
            }
            setPublishedApps([...byId.values()].sort((a, b) => (a.name || '').localeCompare(b.name || '')));
        })();
        return () => { cancelled = true; };
    }, [currentPage, canSeeApps]);

    // Close profile menu on outside click
    useEffect(() => {
        if (!showProfileMenu) return;
        const close = (e) => { if (profileRef.current && !profileRef.current.contains(e.target)) setShowProfileMenu(false); };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, [showProfileMenu]);

    // Track which secondaryNav items have scrolled above the visible scroll
    // region so we can render them as a compact icon strip pinned below the
    // static coreNav. Uses IntersectionObserver against the scroll container.
    const observerRef = useRef(null);
    useEffect(() => {
        if (!isOpen) { setHiddenSecondaryKeys(new Set()); return; }
        const root = scrollRef.current;
        if (!root) return;
        const observer = new IntersectionObserver((entries) => {
            setHiddenSecondaryKeys(prev => {
                const next = new Set(prev);
                let changed = false;
                for (const entry of entries) {
                    const key = entry.target.dataset.navKey;
                    if (!key) continue;
                    const rootTop = entry.rootBounds?.top ?? 0;
                    const isAbove = !entry.isIntersecting && entry.boundingClientRect.bottom <= rootTop;
                    if (isAbove) {
                        if (!next.has(key)) { next.add(key); changed = true; }
                    } else {
                        if (next.has(key)) { next.delete(key); changed = true; }
                    }
                }
                return changed ? next : prev;
            });
        }, { root, threshold: 0 });
        observerRef.current = observer;
        Object.values(secondaryItemRefs.current).forEach(el => { if (el) observer.observe(el); });
        return () => { observer.disconnect(); observerRef.current = null; };
    }, [isOpen]);

    const setSecondaryRef = useCallback((key) => (el) => {
        const prev = secondaryItemRefs.current[key];
        if (prev && prev !== el && observerRef.current) observerRef.current.unobserve(prev);
        if (el) {
            secondaryItemRefs.current[key] = el;
            if (observerRef.current) observerRef.current.observe(el);
        } else {
            delete secondaryItemRefs.current[key];
        }
    }, []);

    // How much is currently running or scheduled, shown as a badge on the
    // Cowork row. Counted from /api/cowork, not /api/ai-tasks: prompt tasks
    // were migrated into cowork, and the old count was fetched every render
    // pass but never actually displayed anywhere.
    // Re-read whenever the user leaves or enters Cowork, so create / pause /
    // delete over there is reflected when they come back.
    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const res = await authFetch(`${API_BASE}/api/cowork`);
                if (!res.ok || cancelled) return;
                const data = await res.json();
                const schedules = Array.isArray(data?.schedules) ? data.schedules : [];
                setActiveCoworkCount(schedules.filter(s => s.isActive).length);
            } catch { /* silent */ }
        };
        load();
        return () => { cancelled = true; };
    }, [currentPage]);

    // On mobile, completely hide when closed (hamburger in header opens it)
    if (!isOpen && isMobile) return null;

    /* ─── Data ─── */
    const favoriteAgents = agents.filter(a => favorites.includes(a.id));
    const typeOf = () => 'Chat';

    const allConvs = (() => {
        // Inside a project: only that project's chats. That IS the point of
        // selecting one.
        //
        // Outside a project, project chats used to be HIDDEN entirely. Combined
        // with Projects having no URL, a chat filed into a project became very
        // easy to lose: it was absent from every list the user could reach
        // without first remembering which project they had put it in. They are
        // shown now, and ConvRow renders a project chip so the filing is still
        // visible.
        const withinProject = (convs) => (activeProject
            ? convs.filter(c => c.project_id === activeProject.id)
            : convs);

        // "All Chats" mode — unified timeline from all agents + direct
        if (chatHistoryMode === 'all-chats') {
            return withinProject(allAgentConversations);
        }
        // Default: per-agent mode
        let convs;
        if (directChatMode) convs = directConversations;
        else if (!groupedConversations) convs = [];
        else convs = groupedConversations.flatMap(([, c]) => c);
        return withinProject(convs);
    })();

    /* ── Time-grouped conversations (with pinned section) ── */
    const groupedConvs = (() => {
        const convs = allConvs;
        if (convs.length === 0) return [];
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(yesterdayStart.getDate() - 1);
        const monthStart = new Date(todayStart); monthStart.setDate(monthStart.getDate() - 30);
        const groups = { pinned: [], today: [], yesterday: [], month: [], older: [] };
        convs.forEach(c => {
            // Pinned conversations go to their own group
            if (c.pinned) {
                groups.pinned.push(c);
                return;
            }
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
            { label: t('sidebar.pinned'), items: groups.pinned, isPinned: true },
            { label: t('sidebar.today'), items: groups.today },
            { label: t('sidebar.yesterday'), items: groups.yesterday },
            { label: t('sidebar.last_30_days'), items: groups.month },
            { label: t('sidebar.older'), items: groups.older },
        ].filter(g => g.items.length > 0);
    })();
    const previewConvs = allConvs.slice(0, 3);
    const hasMore = allConvs.length > 3;

    const isAllChats = chatHistoryMode === 'all-chats';
    const convIsActive = (c) => {
        if (isAllChats) {
            // In all-chats mode, check both agent and direct conversations
            return currentDirectConversation?.id === c.id || currentConversation?.id === c.id;
        }
        return directChatMode ? currentDirectConversation?.id === c.id : currentConversation?.id === c.id;
    };
    const selectConv = (c) => {
        if (isAllChats && onSelectAllChatsConversation) {
            onSelectAllChatsConversation(c);
            return;
        }
        return directChatMode ? onSelectDirectConversation(c) : onSelectConversation(c);
    };
    const deleteConv = (conv) => {
        if (isAllChats) {
            // In all-chats mode, route to the correct handler based on source
            if (conv._source === 'direct') {
                onDeleteDirectConversation?.(conv.id);
            } else {
                onDeleteConversation(conv.id, conv.agent_id);
            }
            return;
        }
        return directChatMode ? onDeleteDirectConversation?.(conv.id) : onDeleteConversation(conv.id, conv.agent_id);
    };

    /* ─── Nav data + row renderer (used both in pinned top nav and inside the
       scrollable region, so secondary items scroll away like ChatGPT). */
    const _isAdminLike = user?.isAdmin || (user?.permissions || []).includes('all');
    const _betaFeatures = Array.isArray(user?.betaFeatures) ? user.betaFeatures : [];
    const _permissions = user?.permissions || [];
    const _featureFlags = user?.featureFlags || {};
    // Simple Mode strips the sidebar to: New Chat, Search, Agents, Chat History.
    // Anything past `agents` in secondaryNav and the admin/appearance items in
    // the avatar dropdown are hidden until the user turns Simple Mode back off.
    // Phone-sized screens (isMobile) always run the simplified surface — see
    // AgentHub's `simpleMode` derivation — regardless of the stored preference.
    const _simpleMode = !!user?.simpleMode || isMobile;

    // "New Chat" highlight must clear once any other destination takes over the
    // main content. Previously it stayed bold (directChatMode/selectedAgent are
    // not reset when an overlay/page opens), so two items looked active at once
    // (BFSF-172). Gate it on the same view flags the other nav items use.
    const _otherViewActive = showMarketplace || showSettings || showAITasks
        || showSkillsPanel
        || ['studio', 'notebooks', 'admin', 'cowork', 'apps', 'appRun'].includes(currentPage);

    // Studio sections for the sidebar group — the same registry + gates the
    // Studio shell renders from (built-ins first, then runtime modules).
    const _studioGateCtx = { user, hasLicenseFeature, hasPermission, canUse: makeCanUse(user), can: canUseCapability };
    const studioSections = [...STUDIO_APPS, ...runtimeStudioApps]
        .filter(app => { try { return app.gate(_studioGateCtx); } catch { return false; } });
    // Runtime modules carry a locale-aware label() fn; built-ins their i18n key.
    const studioSectionLabel = (app) => (typeof app.label === 'function'
        ? app.label(t, locale)
        : (app.labelFallback ? t(app.labelKey, app.labelFallback) : t(app.labelKey)));
    // One-line flyout description. Built-ins declare descKey/descFallback in
    // the registry; runtime modules without one simply show no description.
    const studioSectionDesc = (app) => (app.descKey ? t(app.descKey, app.descFallback) : null);

    const coreNav = [
        { key: 'new-chat', label: t('sidebar.new_chat', 'New Chat'), icon: PenLine, onClick: onDirectChat, active: directChatMode && !selectedAgent && !_otherViewActive },
        // Cowork sits right under New Chat on purpose: "ask" and "delegate" are
        // the two things people come here to do, and prompt automation used to
        // be buried three levels inside Studio → Routines. Phone-friendly, so
        // no isMobile guard.
        // Handshake, not Sparkles: Cowork is a colleague taking something off
        // your plate, not a magic-AI feature. Sparkles also already means
        // "Skills" one level down in Studio, so it named two different things.
        { key: 'cowork', label: t('sidebar.cowork', 'Cowork'), icon: Handshake, onClick: () => onNavigate && onNavigate('cowork'), active: currentPage === 'cowork', badge: activeCoworkCount },
        { key: 'search', label: t('sidebar.search'), icon: Search, onClick: onOpenSearch, active: false },
    ];

    const secondaryNav = [
        { key: 'agents', label: t('sidebar.agents', 'Agents'), icon: Store, onClick: onOpenMarketplace, active: showMarketplace },
        // Studio — a flyout, not a screen: its sections (registry-gated) open
        // from the side panel and each deep-links straight into the shell.
        // The row's onClick (compact strip / mobile fallback) lands on the
        // first visible section.
        ...(!_simpleMode && !isMobile && (_isAdminLike || _permissions.includes('manage_agents') || _permissions.includes('manage_skills') || user?.orgRole === 'admin' || user?.orgRole === 'org_admin')
            ? [{
                key: 'studio',
                label: t('studio.sidebar_link', 'Studio'),
                icon: LayoutGrid,
                onClick: () => onNavigate && onNavigate(`studio/${(studioSections[0] || STUDIO_APPS[0]).urlSegment}`),
                active: currentPage === 'studio',
                flyout: {
                    children: studioSections.map(app => ({
                        key: `studio-${app.id}`,
                        label: studioSectionLabel(app),
                        desc: studioSectionDesc(app),
                        icon: app.Icon,
                        onClick: () => onNavigate && onNavigate(`studio/${app.urlSegment}`),
                        active: currentPage === 'studio' && studioRoute?.section === app.id,
                    })),
                },
            }]
            : []),
        // Apps — the published-apps directory PLUS every published app the
        // user can open, as its own flyout row. Shown to anyone with the
        // app_studio capability (builders and org members who can be an
        // audience). Reachable on phones too (no flyout there — the row
        // navigates to the directory, which stacks).
        ...(canUseCapability('app_studio')
            ? [{
                key: 'apps',
                label: t('sidebar.apps', 'Apps'),
                icon: AppWindow,
                onClick: () => onNavigate && onNavigate('apps'),
                active: currentPage === 'apps' || currentPage === 'appRun',
                flyout: {
                    children: [
                        {
                            key: 'apps-all',
                            label: t('sidebar.all_apps', 'All apps'),
                            desc: t('sidebar.all_apps_desc', 'Browse everything published for you'),
                            icon: AppWindow,
                            onClick: () => onNavigate && onNavigate('apps'),
                            active: currentPage === 'apps',
                        },
                        ...publishedApps.map(app => ({
                            key: `app-${app.id}`,
                            label: app.name || 'Untitled app',
                            desc: app.description || null,
                            iconNode: (
                                <AppIcon
                                    name={app.icon || 'LayoutGrid'}
                                    className="w-4 h-4 flex-shrink-0 mt-0.5"
                                    style={{ color: appAccent(app.accentColor) }}
                                />
                            ),
                            onClick: () => onNavigate && onNavigate(`apps/${app.id}`),
                            active: currentPage === 'appRun' && typeof window !== 'undefined' && window.location.pathname.startsWith(`/app/apps/${app.id}`),
                        })),
                    ],
                },
            }]
            : []),
        // hasLicenseFeature short-circuits each entry on community-tier
        // installs — the licence gate is the source of truth; the beta
        // opt-in and permissions remain as additional org-level controls.
        // Meeting Notes lives inside Studio (Mic tab) and is reached there;
        // no top-level sidebar entry.
        ...(!_simpleMode && !isMobile && hasLicenseFeature('notebooks') && _featureFlags.notebooks !== false && _featureFlags.notebooksMenu !== false && (_permissions.includes('all') || _permissions.includes('use_notebooks'))
            ? [{ key: 'notebooks', label: t('sidebar.notebooks', 'Notebooks'), icon: FileText, onClick: () => onNavigate && onNavigate('notebooks'), active: currentPage === 'notebooks' }]
            : []),
    ];

    /* ── Row inside a flyout panel (Studio sections, published apps): plain
       icon + label with a short muted description underneath — the marketing
       mega-menu item, minus the icon tile. ── */
    const renderFlyoutRow = ({ key, label, desc, icon: Icon, iconNode, onClick, active }) => (
        <button
            key={key}
            onClick={() => { closeFlyout(); onClick?.(); }}
            className={`w-full flex items-start gap-2.5 px-2.5 py-2 rounded-lg text-left relative transition-all duration-150 ${active ? ROW_ACTIVE : ROW_IDLE}`}
            aria-current={active ? 'page' : undefined}
            data-testid={`nav-${key}`}
        >
            {active && <div className={ACCENT_BAR} />}
            {iconNode || (Icon ? <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${active ? ICON_ACTIVE : ICON_IDLE}`} strokeWidth={active ? 2.25 : 1.75} /> : null)}
            <span className="flex-1 min-w-0">
                <span className={`block text-[13px] leading-tight ${active ? 'font-semibold' : 'font-medium'} text-[var(--text-primary)]`}>{label}</span>
                {/* No `block` here: line-clamp needs its own -webkit-box
                    display, and a competing display utility silently
                    disables the clamp (seen live: a full app description
                    filling the panel). */}
                {desc && <span className="line-clamp-2 text-[11.5px] leading-snug mt-0.5 text-[var(--text-tertiary)]">{desc}</span>}
            </span>
        </button>
    );

    /* ── Nav row: plain icon + label. Rows with a `flyout` open a floating
       panel beside the sidebar (the marketing header's mega-menu, turned
       sideways) on hover or click instead of navigating; on phones the same
       row falls back to its onClick. Collapsed sidebar keeps the icon-only
       power bar. ── */
    const renderNavRow = (item) => {
        const { key, label, icon: Icon, onClick, active, primary, kbd, badge, flyout: flyoutDef } = item;
        if (!isOpen) {
            return (
                <button
                    key={key}
                    onClick={onClick}
                    className={`group relative flex items-center w-10 h-10 rounded-xl justify-center transition-all ${active ? 'bg-[var(--accent-primary)] text-[var(--accent-primary-fg,#fff)] shadow-lg' : primary ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] hover:bg-[var(--accent-primary)] hover:text-[var(--accent-primary-fg,#fff)]' : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'}`}
                    title={label}
                    aria-label={label}
                    aria-current={active ? 'page' : undefined}
                    data-testid={`nav-${label.toLowerCase().replace(/\s+/g, '-')}`}
                    data-tour={`nav-${key}`}
                >
                    <Icon className="w-5 h-5" strokeWidth={active || primary ? 2.25 : 1.75} />
                </button>
            );
        }
        const hasFlyout = !!flyoutDef && !isMobile;
        const flyoutOpen = hasFlyout && flyout?.key === key;
        const row = (
            <button
                key={key}
                onClick={hasFlyout
                    ? (e) => (flyoutOpen ? closeFlyout() : openFlyout(key, e.currentTarget))
                    : onClick}
                className={`group relative flex items-center ${ROW} ${active ? ROW_ACTIVE : ROW_IDLE}`}
                aria-label={label}
                aria-current={active ? 'page' : undefined}
                aria-expanded={hasFlyout ? flyoutOpen : undefined}
                aria-haspopup={hasFlyout ? 'true' : undefined}
                data-testid={`nav-${label.toLowerCase().replace(/\s+/g, '-')}`}
                data-tour={`nav-${key}`}
            >
                {active && <div className="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-r-full bg-[var(--accent-primary)]" />}
                <Icon className={`w-4 h-4 ${active ? 'text-[var(--accent-primary)]' : 'text-[var(--text-tertiary)]'}`} strokeWidth={active || primary ? 2.25 : 1.75} />
                <span className={`text-[13px] ${active ? 'font-semibold' : ''}`} style={{ color: active ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{label}</span>
                {kbd && <kbd className="ml-auto inline-flex items-center px-1.5 py-0.5 rounded-md bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[10px] font-medium text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)] transition-colors">{kbd}</kbd>}
                {typeof badge === 'number' && badge > 0 && (
                    <span
                        className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-md tabular-nums"
                        style={{
                            background: 'color-mix(in srgb, var(--accent-primary) 12%, transparent)',
                            color: 'var(--accent-primary)',
                        }}
                    >
                        {badge}
                    </span>
                )}
            </button>
        );
        if (!hasFlyout) return row;
        return (
            <div
                key={key}
                className="relative"
                onMouseEnter={(e) => {
                    const btn = e.currentTarget.querySelector('button');
                    if (btn) openFlyout(key, btn);
                }}
                onMouseLeave={() => scheduleFlyoutClose(key)}
            >
                {row}
                {flyoutOpen && flyout && (
                    <div
                        className="fixed z-50 w-72 rounded-2xl border overflow-hidden"
                        style={{
                            top: Math.max(8, Math.min(flyout.top, (typeof window !== 'undefined' ? window.innerHeight : 800) - 360)),
                            left: flyout.left,
                            borderColor: 'var(--border-default)',
                            boxShadow: 'var(--shadow-popover, 0 20px 60px rgba(15,23,42,0.18))',
                            animation: 'sidebarMenuIn .18s cubic-bezier(0.16, 1, 0.3, 1)',
                        }}
                        data-surface="opaque"
                        data-testid={`flyout-${key}`}
                    >
                        <div className="p-1.5 max-h-[70vh] overflow-y-auto custom-scrollbar">
                            {flyoutDef.children.map(renderFlyoutRow)}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    /* ─── The sidebar ─── */
    const content = (
        <div
            className={`h-full flex flex-col bg-[var(--bg-secondary)] border-r border-[var(--border-subtle)] flex-shrink-0 transition-all duration-300 ${isOpen ? 'w-72' : 'w-16 cursor-pointer'}`}
            data-testid="sidebar"
            data-surface="subtle"
            data-static
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
                        <button
                            onClick={onDirectChat}
                            className="flex items-center gap-2.5 rounded-xl transition-transform hover:scale-105"
                            aria-label={t('sidebar.new_chat', 'New Chat')}
                        >
                            {useOrgBrand
                                ? <div className="w-[4.5rem] h-[4.5rem] rounded-xl overflow-hidden flex items-center justify-center bg-[var(--bg-primary)]">
                                      <img src={orgLogoUrl} alt={orgAltText} className="w-full h-full object-contain" />
                                  </div>
                                : <img src={beeFlowLogo} alt="Bee Flow" className="w-[4.5rem] h-[4.5rem] rounded-xl object-cover" />}
                        </button>
                        <div className="flex items-center gap-1">
                            <NotificationCenter variant="icon" />
                            <button
                                onClick={toggleSidebar}
                                className="p-1.5 hover:bg-[var(--bg-tertiary)] rounded-lg text-[var(--text-tertiary)] transition-colors"
                                aria-label="Toggle sidebar"
                                data-testid="toggle-sidebar"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M9 3v18" /></svg>
                            </button>
                        </div>
                    </>
                ) : (
                    <button
                        onClick={toggleSidebar}
                        className="hover:bg-[var(--bg-tertiary)] rounded-xl text-[var(--text-primary)] transition-all transform hover:scale-105 flex items-center justify-center w-12 h-12 overflow-hidden p-1"
                    >
                        {useOrgBrand
                            ? <img src={orgLogoUrl} alt={orgAltText} className="w-full h-full rounded-lg object-contain" />
                            : <img src={beeFlowIcon} alt="Bee Flow" className="w-8 h-8 rounded-lg object-contain" />}
                    </button>
                )}
            </div>

            {/* "Powered by Bee Flow" — placed directly under the org logo in
                self-hosted (white-label) mode. Hidden in collapsed sidebar. */}
            {useOrgBrand && isOpen && (
                <div className="flex-shrink-0 px-3 -mt-1 mb-1 text-[10px] text-left text-[var(--text-tertiary)]">
                    <a
                        href="https://beeflow.nl"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-[var(--text-secondary)] transition-colors"
                    >
                        {t('sidebar.powered_by', 'Powered by Bee Flow')}
                    </a>
                </div>
            )}

            {/* ── Nav rows ── (pinned: New Chat + Search) */}
            <nav aria-label="Main navigation" data-testid="main-navigation" className={`px-2 pt-3 flex-shrink-0 flex flex-col gap-1 ${isOpen ? '' : 'items-center'}`}>
                {coreNav.map(renderNavRow)}
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
                            {isImageAvatar(agent.avatar) ? (
                                <img src={resolveAvatarSrc(agent.avatar)} alt="" loading="lazy" className="w-full h-full object-cover" />
                            ) : (agent.avatar || agent.name?.[0]?.toUpperCase())}
                        </button>
                    ))}
                </div>
            )}

            {/* ── Compact icon strip for secondaryNav items that have scrolled out of view ── */}
            {isOpen && hiddenSecondaryKeys.size > 0 && (
                <div className="px-2 py-1.5 flex items-center gap-1 flex-wrap flex-shrink-0 border-b border-[var(--border-subtle)]/50">
                    {secondaryNav.filter(item => hiddenSecondaryKeys.has(item.key)).map(item => (
                        <button
                            key={item.key}
                            onClick={item.onClick}
                            title={item.label}
                            aria-label={item.label}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors flex-shrink-0 ${item.active ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]' : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'}`}
                        >
                            <item.icon className="w-4 h-4" strokeWidth={item.active ? 2.25 : 1.75} />
                        </button>
                    ))}
                </div>
            )}

            {/* ── Scrollable middle region (Secondary nav + Projects + My Agents + Chats) ── */}
            <div ref={scrollRef} className={`flex-1 min-h-0 flex flex-col overflow-y-auto custom-scrollbar ${isOpen ? '' : ''}`}>

            {/* ── Secondary nav (Agents, AI Tasks, KB, Meeting Notes, Skills, Tickets, Notebooks)
                 — sits inside the scroll region so it scrolls away like ChatGPT ── */}
            {isOpen && secondaryNav.length > 0 && (
                <nav aria-label="Secondary navigation" className="px-2 pt-1 flex-shrink-0 flex flex-col gap-1">
                    {secondaryNav.map(item => (
                        <div key={item.key} ref={setSecondaryRef(item.key)} data-nav-key={item.key}>
                            {renderNavRow(item)}
                        </div>
                    ))}
                </nav>
            )}

            {/* ── Projects ── */}
            {isOpen && !_simpleMode && hasLicenseFeature('projects') && user?.featureFlags?.projects !== false && projects.length > 0 && (
                <div className="mt-1">
                    <div className={SECTION_HDR} onClick={toggleProjects}>
                        <span className={SECTION_LBL}>{t('sidebar.projects')}</span>
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

                            {/* The project LIST had no entry point at all: it only
                                rendered once the detail view was closed, and
                                nothing opened it directly. Members, activity and
                                shared threads all live behind it. */}
                            <button
                                onClick={() => onBrowseProjects?.()}
                                className={`${ROW} ${ROW_IDLE} text-[var(--text-tertiary)]`}
                            >
                                <FolderOpen className="w-4 h-4" />
                                <span className="text-[13px]">{t('sidebar.all_projects')}</span>
                            </button>
                        </div>
                    )}
                    <div className="mx-3 my-0.5 border-t border-[var(--border-subtle)]" />
                </div>
            )}

            {/* ── New Project (when no projects yet) ── */}
            {isOpen && hasLicenseFeature('projects') && user?.featureFlags?.projects !== false && projects.length === 0 && (
                <div className="px-2 mt-1">
                    <button
                        onClick={() => onCreateProject?.()}
                        className={`${ROW} ${ROW_IDLE} text-[var(--text-tertiary)]`}
                    >
                        <Plus className="w-4 h-4" />
                        <span className="text-[13px]">{t('sidebar.new_project')}</span>
                    </button>
                </div>
            )}

            {/* ── Divider ── (only when My Agents is visible below) */}
            {isOpen && favoriteAgents.length > 0 && (
                <div className="mx-3 my-1.5 border-t border-[var(--border-subtle)]" />
            )}

            {/* ── My Agents ── (only when there are favorites) */}
            {isOpen && favoriteAgents.length > 0 && (
                <div>
                    <div className={SECTION_HDR} onClick={toggleAgents}>
                        <span className={SECTION_LBL}>{t('sidebar.my_agents')}</span>
                        <ChevronDown className={`w-3.5 h-3.5 text-[var(--text-tertiary)] transition-transform duration-200 ${agentsOpen ? '' : '-rotate-90'}`} />
                    </div>

                    {agentsOpen && (
                        <div className="px-1.5 pb-1">
                            {favoriteAgents.map(agent => {
                                const sel = selectedAgent?.id === agent.id;
                                const initials = (agent.name?.[0]?.toUpperCase() || '?');
                                const hasImageAvatar = isImageAvatar(agent.avatar);
                                return (
                                    <button
                                        key={agent.id}
                                        onClick={() => onSelectAgent(agent)}
                                        className={`group/a w-full flex items-center gap-3 px-2 py-1.5 rounded-xl transition-all duration-150 text-left relative ${sel ? 'bg-[var(--accent-primary)]/8' : 'hover:bg-[var(--item-hover-bg)]'}`}
                                        data-testid={`agent-row-${agent.id}`}
                                    >
                                        {sel && <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-[var(--accent-primary)]" />}
                                        {/* Avatar */}
                                        <div className={`w-8 h-8 rounded-lg flex-shrink-0 overflow-hidden flex items-center justify-center text-[13px] font-bold ring-1 transition-all duration-150 ${sel ? 'ring-[var(--accent-primary)]/40 shadow-sm shadow-[var(--accent-primary)]/20' : 'ring-black/8 shadow-sm'} ${!hasImageAvatar ? 'bg-gradient-to-br from-[var(--accent-primary)]/15 to-[var(--accent-primary)]/30 text-[var(--accent-primary)]' : 'bg-[var(--bg-tertiary)]'}`}>
                                            {hasImageAvatar ? (
                                                <img src={resolveAvatarSrc(agent.avatar)} alt="" loading="lazy" className="w-full h-full object-contain" />
                                            ) : (agent.avatar || initials)}
                                        </div>
                                        <span className={`text-[13px] truncate flex-1 leading-snug ${sel ? 'font-semibold' : ''}`} style={{ color: sel ? 'var(--text-primary)' : 'var(--text-secondary)' }} title={agent.name}>
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
                            })}
                        </div>
                    )}
                    <div className="mx-3 my-0.5 border-t border-[var(--border-subtle)]" />
                </div>
            )}


            {/* ── Recent Chats ── */}
            <div className={`flex flex-col ${isOpen ? '' : 'hidden'}`}>
                <div className="flex items-center justify-between px-3 h-9 select-none">
                    <span className={SECTION_LBL}>{t('sidebar.chats')}</span>
                    {allConvs.length > 0 && (
                        <span className="text-[10px] text-[var(--text-tertiary)] font-medium tabular-nums">{allConvs.length}</span>
                    )}
                </div>

                <div className="px-1.5 pb-1">
                    {isOpen ? (allConvs.length === 0 ? (
                        <p className="px-3 py-2 text-[12px] text-[var(--text-tertiary)]">
                            {selectedAgent || directChatMode ? t('sidebar.no_chats_yet') : t('sidebar.select_agent_to_begin')}
                        </p>
                    ) : (
                        groupedConvs.map(group => (
                            <div key={group.label} className="mt-3 first:mt-0">
                                <h3 className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${group.isPinned ? 'text-[var(--accent-primary)]' : 'text-gray-500'}`}>
                                    {group.isPinned && <Pin className="w-2.5 h-2.5 inline mr-1 -mt-0.5 -rotate-45" />}
                                    {group.label}
                                </h3>
                                <div className="space-y-px">
                                    {group.items.map(c => <ConvRow key={c.id} conv={c} t={t} active={convIsActive(c)} selectConv={selectConv} deleteConv={deleteConv} conversationLabels={conversationLabels} projects={projects} activeProjectId={activeProject?.id} onRenameConversation={onRenameConversation} onPinConversation={onPinConversation} onLabelConversation={onLabelConversation} onDeleteLabel={onDeleteLabel} onEditLabel={onEditLabel} onCreateLabel={onCreateLabel} onMoveToProject={onMoveToProject} onShareToProject={onShareToProject} agentBadge={isAllChats ? (c._source === 'direct' ? { icon: '💬', name: 'Direct Chat' } : (() => { const a = agents.find(x => x.id === c.agent_id); if (!a) return { icon: DEFAULT_AGENT_EMOJI, name: c.agent_name || 'Agent' }; return isImageAvatar(a.avatar) ? { avatarUrl: resolveAvatarSrc(a.avatar), name: a.name } : { icon: a.avatar || DEFAULT_AGENT_EMOJI, name: a.name }; })()) : null} />)}
                                </div>
                            </div>
                        ))
                    )) : null}
                </div>
            </div>

            </div>{/* ── End scrollable middle region ── */}

            {/* ── Account footer ── */}
            <div className={`flex-shrink-0 mt-auto relative ${isOpen ? 'border-t border-[var(--border-subtle)]' : 'flex justify-center flex-shrink-0 border-t border-[var(--border-subtle)]'}`} ref={profileRef}>
                <div
                    onClick={() => setShowProfileMenu(v => !v)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setShowProfileMenu(v => !v);
                        }
                    }}
                    className={`flex items-center transition-colors cursor-pointer ${isOpen ? 'w-full gap-2.5 px-4 h-14 ' + (showProfileMenu ? 'bg-[var(--bg-tertiary)]' : 'hover:bg-[var(--bg-tertiary)]') : 'w-10 h-10 my-3 rounded-full justify-center hover:bg-[var(--bg-tertiary)]'}`}
                    role="button"
                    tabIndex={0}
                    aria-label="Open profile menu"
                    aria-haspopup="menu"
                    aria-expanded={showProfileMenu}
                    data-testid="sidebar-profile"
                    data-tour="account"
                >
                    {user?.avatarType === 'emoji' && user?.avatar ? (
                        <div className={`rounded-full flex items-center justify-center flex-shrink-0 bg-[var(--bg-tertiary)] ${isOpen ? 'w-8 h-8 text-base' : 'w-10 h-10 text-xl'}`}>
                            {user.avatar}
                        </div>
                    ) : (user?.avatarType === 'image' || user?.avatarType === 'url') && user?.avatar ? (
                        <img src={user.avatar.startsWith('/') ? `${API_BASE}${user.avatar}` : user.avatar} alt="" className={`rounded-full object-cover flex-shrink-0 ${isOpen ? 'w-8 h-8' : 'w-10 h-10'}`} />
                    ) : (
                        <div className={`rounded-full flex items-center justify-center flex-shrink-0 ${isOpen ? 'w-8 h-8' : 'w-10 h-10'}`}
                            style={{ background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-primary-hover))' }}>
                            <User className={`${isOpen ? 'w-4 h-4' : 'w-5 h-5'}`} style={{ color: 'var(--accent-primary-fg, #fff)' }} />
                        </div>
                    )}
                    {isOpen && (
                        <>
                            <div className="flex-1 min-w-0 text-left flex items-center gap-2">
                                <span className="text-[13px] font-medium truncate text-[var(--text-primary)]">
                                    {user?.displayName || user?.id || 'User'}
                                </span>
                            </div>
                            <ChevronDown className={`w-4 h-4 flex-shrink-0 text-[var(--text-tertiary)] transition-transform duration-200 ${showProfileMenu ? 'rotate-180' : ''}`} />
                        </>
                    )}
                </div>

                {showProfileMenu && (
                    <div
                        className={`absolute rounded-2xl border overflow-hidden z-50 ${isOpen ? 'bottom-full left-3 right-3 -mb-px' : 'bottom-full left-14 -mb-px w-64'}`}
                        style={{
                            borderColor: 'var(--border-default)',
                            boxShadow: 'var(--shadow-popover, 0 20px 60px rgba(15,23,42,0.18))',
                            animation: 'sidebarMenuIn .18s cubic-bezier(0.16, 1, 0.3, 1)',
                        }}
                        data-testid="profile-menu"
                        data-surface="opaque"
                    >
                        <div className="p-1.5">
                            {!_simpleMode && !isMobile && (user?.isAdmin || user?.permissions?.includes('all')) && (
                                <NavLink
                                    href="/admin"
                                    onClick={() => setShowProfileMenu(false)}
                                    onNavigate={() => { setShowProfileMenu(false); onNavigate('admin'); }}
                                    className={`w-full flex items-center gap-3 px-3 h-10 rounded-lg transition-all duration-150 text-left relative ${currentPage === 'admin' ? 'bg-[var(--item-active-bg)]' : 'hover:bg-[var(--item-hover-bg)]'}`}
                                    style={{ textDecoration: 'none', color: 'inherit' }}
                                    data-testid="profile-menu-admin"
                                >
                                    {currentPage === 'admin' && <div className={ACCENT_BAR} />}
                                    <Shield className={`w-4 h-4 ${currentPage === 'admin' ? ICON_ACTIVE : ICON_IDLE}`} strokeWidth={1.75} />
                                    <span className={`text-[13px] ${currentPage === 'admin' ? TEXT_ACTIVE : TEXT_IDLE}`}>{t('sidebar.admin_dashboard')}</span>
                                </NavLink>
                            )}

                            {/* Settings is an allowed mobile page (user settings only —
                                trimmed inside AdvancedSettings), so show it on phones too.
                                Admin Dashboard above stays desktop-only. */}
                            <NavLink
                                href="/settings"
                                onClick={() => setShowProfileMenu(false)}
                                onNavigate={() => { setShowProfileMenu(false); onNavigate('settings'); }}
                                className={`w-full flex items-center gap-3 px-3 h-10 rounded-lg transition-all duration-150 text-left relative ${showSettings ? 'bg-[var(--item-active-bg)]' : 'hover:bg-[var(--item-hover-bg)]'}`}
                                style={{ textDecoration: 'none', color: 'inherit' }}
                                data-testid="profile-menu-settings"
                            >
                                {showSettings && <div className={ACCENT_BAR} />}
                                <Settings className={`w-4 h-4 ${showSettings ? ICON_ACTIVE : ICON_IDLE}`} strokeWidth={1.75} />
                                <span className={`text-[13px] ${showSettings ? TEXT_ACTIVE : TEXT_IDLE}`}>{t('sidebar.settings')}</span>
                            </NavLink>

                        </div>

                        {/* Danger section — visually distinct so Sign Out is never
                            mistaken for a routine navigation action. */}
                        <div className="border-t p-1.5" style={{ borderColor: 'var(--border-subtle)' }}>
                            <button
                                onClick={onLogout}
                                className="w-full flex items-center gap-3 px-3 h-10 rounded-lg transition-all duration-150 text-left group/so hover:bg-red-500/10"
                                data-testid="sidebar-signout"
                            >
                                <LogOut className="w-4 h-4 text-red-500/80 group-hover/so:text-red-500 transition-colors" strokeWidth={1.75} />
                                <span className="text-[13px] font-medium text-red-500/80 group-hover/so:text-red-500 transition-colors">
                                    {t('sidebar.sign_out')}
                                </span>
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
