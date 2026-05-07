import React, { useEffect, useState, useMemo } from "react";

import KnowledgePanel from "../../KnowledgePanel";
import VersionHistory from "../../VersionHistory";
import ModelSelector from "../../ModelSelector";
import ModelTierSelector from "../../ModelTierSelector";

import { API_BASE, authFetch } from "../../../utils/helpers";
import { isImageAvatar, resolveAvatarSrc, pickAgentAvatar } from "../../../utils/agentAvatar";
import { CAPABILITIES } from "./constants";
import { INTEGRATION_CATALOG } from "./integrations";

// Extracted hooks
import useAgentState from "./hooks/useAgentState";
import useAgentApi from "./hooks/useAgentApi";
import useAgentChat from "./hooks/useAgentChat";
import useCapabilities from "./hooks/useCapabilities";
import { IdentitySection } from "./sections/IdentitySection";
import { ToolsSection } from "./sections/ToolsSection";
import { BehaviorSection } from "./sections/BehaviorSection";


const AgentDesigner = ({
  onBack,
  systemMode = false,
  securityMode = false,
  hasPermission = () => true,
  initialAgentId = null,
  user = null,
  onClose = null,
}) => {
  // All state from hooks
  const state = useAgentState();
  const {
    agents,
    selectedAgent,
    isCreating,
    components,
    loading,
    saving,
    name,
    setName,
    description,
    systemPrompt,
    setSystemPrompt,
    selectedTools,
    setSelectedTools,
    toolParams,
    setToolParams,
    model,
    setModel,
    isPublished,
    sharedGroups,
    setSharedGroups,
    showPublishMenu,
    setShowPublishMenu,
    orgGroups,
    availableModels,
    modelTiers,
    avatar,
    setAvatar,
    showEmojiPicker,
    setShowEmojiPicker,
    emojiCategory,
    setEmojiCategory,
    emojiPickerRef,
    activeSection,
    setActiveSection,
    activeGuardrailTab,
    setActiveGuardrailTab,
    messages,
    chatInput,
    setChatInput,
    chatLoading,
    showChat,
    setShowChat,
    showToolSelector,
    setShowToolSelector,
    integrationStatus,
    enabledIntegrations,
    setEnabledIntegrations,
    showPromptDesigner,
    setShowPromptDesigner,
    promptDesignerMessages,
    setPromptDesignerMessages,
    promptDesignerInput,
    setPromptDesignerInput,
    promptDesignerLoading,
    chatEndRef,
    // Behavior
    allowCopy,
    setAllowCopy,
    embedEnabled,
    setEmbedEnabled,
    workspaceEnabled,
    setWorkspaceEnabled,
    enableGuardrails,
    setEnableGuardrails,
    llamaGuardEnabled,
    setLlamaGuardEnabled,
    webSearchGuardEnabled,
    setWebSearchGuardEnabled,
    strictKnowledge,

    setStrictKnowledge,
    includeSourceReferences,
    setIncludeSourceReferences,
    knowledgeBaseIds,
    setKnowledgeBaseIds,
    // Regex Guardrails
    regexGuardrailsEnabled,
    setRegexGuardrailsEnabled,
    selectedCollections,
    setSelectedCollections,
    availableCollections,
    regexScope,
    setRegexScope,
    guardrailAction,
    setGuardrailAction,
    // Bubble Widget
    bubbleColor,
    setBubbleColor,
    bubblePosition,
    setBubblePosition,
    bubbleSize,
    setBubbleSize,
    bubbleIcon,
    setBubbleIcon,
    windowWidth,
    setWindowWidth,
    windowHeight,
    setWindowHeight,
    chatFont,
    setChatFont,
    chatFontSize,
    setChatFontSize,
    chatLineHeight,
    setChatLineHeight,
    userBubbleColor,
    setUserBubbleColor,
    assistantBubbleColor,
    setAssistantBubbleColor,
    warningText,
    setWarningText,
  } = state;

  // API operations
  const {
    selectAgent,
    createNewAgent,
    saveAgent,
    deleteAgent,
    duplicateAgent,
    togglePublish,
    setPublishState,
    toggleTool,
  } = useAgentApi(state, { systemMode, securityMode, initialAgentId });

  // Chat
  const { sendMessage, clearHistory } = useAgentChat(state);

  // Capabilities
  const { checkCapability, toggleCapability } = useCapabilities(state);

  // Close emoji picker on click outside
  useEffect(() => {
    if (!showEmojiPicker) return;
    const handleClickOutside = (e) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(e.target)
      ) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showEmojiPicker]);

  const isAgentEditor = user?.orgRole === 'agent_editor';
  const isOwner = selectedAgent?.owner_id === user?.id;
  const isReadonly = Boolean(selectedAgent && isAgentEditor && !isOwner && !selectedAgent?.is_published && !isCreating);

  const sharedProps = {
    ...state,
    authFetch,
    API_BASE,
    CAPABILITIES,
    checkCapability,
    toggleCapability,
    isReadonly,
  };
  return (
    <div
      className="h-full flex flex-col"
      style={{ background: "var(--bg-primary)" }}
    >
      {/* Title bar — only rendered when inline (onClose provided) */}
      {onClose && (
        <div
          className="flex-shrink-0 flex items-center px-5"
          style={{ height: '48px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)' }}
        >
          <span className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>Agent Designer</span>
        </div>
      )}
      {/* Main Content */}
      <div
        className="flex-1 flex overflow-hidden"
        style={{ background: "var(--bg-primary)" }}
      >
        {/* 1. Agent List Sidebar */}
        <div
          className="w-64 border-r flex flex-col flex-shrink-0"
          style={{
            borderColor: "var(--border-subtle)",
            background: "var(--bg-primary)",
          }}
        >
          <div
            className="px-3 h-9 border-b flex items-center justify-between"
            style={{ borderColor: "var(--border-default)" }}
          >
            <span
              className="text-[13px] font-semibold tracking-normal"
              style={{ color: "var(--text-primary)" }}
            >
              {systemMode ? "System Agents" : "Agents"}
            </span>
            {!systemMode && hasPermission("manage_agents") && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => { window.history.pushState({ page: 'agentWizard' }, '', '/app/agent-wizard'); window.dispatchEvent(new PopStateEvent('popstate')); }}
                  className="px-2 py-1 rounded-lg hover:bg-[var(--item-hover-bg)] transition-colors flex items-center gap-1 text-[11px]"
                  title="Create with AI"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3z"/></svg>
                  AI
                </button>
                <button
                  onClick={createNewAgent}
                  className="p-1 rounded-lg hover:bg-[var(--item-hover-bg)] transition-colors"
                  title="Create New Agent (empty)"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar px-1.5 py-1">
            {loading ? (
              <div className="p-8 text-center text-muted text-sm">
                <div className="spinner-sm mx-auto mb-2"></div>
                Loading...
              </div>
            ) : agents.length === 0 ? (
              <div className="p-8 text-center text-muted text-sm flex flex-col items-center">
                <span className="text-2xl mb-2">🤖</span>
                <p className="mb-3">No agents found</p>
                {!systemMode && hasPermission("manage_agents") && (
                  <button
                    onClick={createNewAgent}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg border bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] transition-all"
                    style={{
                      borderColor: "var(--border-default)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    Create First Agent
                  </button>
                )}
              </div>
            ) : (
              agents.map((agent) => {
                const sel = selectedAgent?.id === agent.id;
                return (
                  <div
                    key={agent.id}
                    onClick={() => selectAgent(agent)}
                    role="button"
                    tabIndex={0}
                    className="w-full flex items-center gap-2.5 px-3 h-9 rounded-lg transition-all duration-150 text-left relative group hover:bg-[var(--item-hover-bg)] cursor-pointer"
                  >
                    {sel && (
                      <div className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r-full bg-[var(--accent-primary)]" />
                    )}
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-base flex-shrink-0 transition-transform ${sel ? "scale-110" : ""}`}
                    >
                      {(() => {
                        const av = pickAgentAvatar(agent);
                        return isImageAvatar(av) ? (
                          <img
                            src={resolveAvatarSrc(av)}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          av || agent.name?.[0]?.toUpperCase()
                        );
                      })()}
                    </div>
                    <span
                      className={`text-[13px] truncate flex-1 ${sel ? "font-bold text-black" : "text-black hover:text-black transition-colors"}`}
                    >
                      {agent.name}
                    </span>
                    {!systemMode && hasPermission("manage_agents") && (
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        {hasPermission("manage_agents") && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              duplicateAgent(agent);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 text-[var(--text-tertiary)] hover:text-blue-400 transition-all rounded disabled:opacity-0 disabled:cursor-not-allowed"
                            title="Duplicate agent"
                            disabled={Boolean(user?.orgRole === 'agent_editor' && agent.owner_id !== user?.id && !agent.is_published)}
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteAgent(agent.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-[var(--text-tertiary)] hover:text-red-500 transition-all rounded disabled:opacity-0 disabled:cursor-not-allowed"
                          title="Delete agent"
                          disabled={Boolean(user?.orgRole === 'agent_editor' && agent.owner_id !== user?.id && !agent.is_published)}
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 2. Main Workspace (Split View) */}
        <div className="flex-1 flex overflow-hidden relative">
          {selectedAgent || isCreating ? (
            <div className="flex-1 flex w-full">
              {/* Configuration Area */}
              <div
                className="flex-1 flex flex-col min-w-[600px] border-r"
                style={{ borderColor: "var(--border-default)" }}
              >
                {/* Header */}
                <div
                  className="px-6 py-3 border-b flex items-center justify-between"
                  style={{ borderColor: "var(--border-default)" }}
                >
                  <div>
                    <h1
                      className="text-lg font-semibold"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {isCreating ? "Create New Agent" : "Edit Agent"}
                    </h1>
                    <p className="text-xs text-muted">
                      Configure identity, logic, and safeguards.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {!systemMode && selectedAgent && (
                      <>
                        {/* Publish Menu Toggle or Current State */}
                        <div className="relative">
                          {!isReadonly && (
                            <button
                              onClick={() => setShowPublishMenu(!showPublishMenu)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 border ${
                                isPublished ? "bg-emerald-500 text-white border-emerald-500 hover:bg-emerald-600" : "text-[var(--text-secondary)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)]"
                              }`}
                              style={!isPublished ? { borderColor: "var(--border-default)" } : {}}
                            >
                              {isPublished ? (
                                <>
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                  Published {sharedGroups.length > 0 ? ` (${sharedGroups.length})` : ""}
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                </>
                              ) : (
                                <>
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c1.657 0 3-1.343 3-3V6a3 3 0 10-6 0v2c0 1.657 1.343 3 3 3zM5 21v-2a4 4 0 014-4h6a4 4 0 014 4v2" /></svg>
                                  Personal
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                </>
                              )}
                            </button>
                          )}
                          
                          {/* Publish Target Dropdown */}
                          {/* ... remainder handled by existing React component ... */}
                        {showPublishMenu && (
                          <div
                            className="absolute right-0 top-full mt-2 w-72 rounded-xl shadow-2xl z-50 overflow-hidden"
                            style={{
                              background: "var(--bg-secondary)",
                              border: "1px solid var(--border-default)",
                            }}
                          >
                            <div
                              className="p-3 border-b"
                              style={{ borderColor: "var(--border-subtle)" }}
                            >
                              <p
                                className="text-sm font-semibold"
                                style={{ color: "var(--text-primary)" }}
                              >
                                Publish to...
                              </p>
                              <p
                                className="text-xs mt-0.5"
                                style={{ color: "var(--text-muted)" }}
                              >
                                Choose who can see this agent
                              </p>
                            </div>

                            {/* Personal — only the owner can access. */}
                            <button
                              onClick={() => setPublishState(false, [])}
                              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-[var(--bg-tertiary)] transition-colors text-left"
                            >
                              <div
                                className="w-8 h-8 rounded-lg flex items-center justify-center"
                                style={{ background: "rgba(107, 114, 128, 0.15)" }}
                              >
                                <svg className="w-4 h-4 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c1.657 0 3-1.343 3-3V6a3 3 0 10-6 0v2c0 1.657 1.343 3 3 3zM5 21v-2a4 4 0 014-4h6a4 4 0 014 4v2" />
                                </svg>
                              </div>
                              <div className="flex-1">
                                <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Personal</p>
                                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Only you can access</p>
                              </div>
                              {!isPublished && (
                                <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                              )}
                            </button>

                            {/* Publish to entire org */}
                            <button
                              onClick={() => setPublishState(true, [])}
                              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-[var(--bg-tertiary)] transition-colors text-left border-t"
                              style={{ borderColor: "var(--border-subtle)" }}
                            >
                              <div
                                className="w-8 h-8 rounded-lg flex items-center justify-center"
                                style={{
                                  background: "rgba(16, 185, 129, 0.15)",
                                }}
                              >
                                <svg
                                  className="w-4 h-4 text-emerald-400"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                                  />
                                </svg>
                              </div>
                              <div className="flex-1">
                                <p
                                  className="text-sm font-medium"
                                  style={{ color: "var(--text-primary)" }}
                                >
                                  Entire Organization
                                </p>
                                <p
                                  className="text-xs"
                                  style={{ color: "var(--text-muted)" }}
                                >
                                  All members can access
                                </p>
                              </div>
                              {isPublished && sharedGroups.length === 0 && (
                                <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                              )}
                            </button>

                            {/* Divider */}
                            {orgGroups.length > 0 && (
                              <div
                                className="px-3 py-2 border-t"
                                style={{ borderColor: "var(--border-subtle)" }}
                              >
                                <p
                                  className="text-xs font-semibold uppercase tracking-wider"
                                  style={{ color: "var(--text-muted)" }}
                                >
                                  Or specific groups
                                </p>
                              </div>
                            )}

                            {/* Group list */}
                            <div className="max-h-48 overflow-auto">
                              {orgGroups.map((group) => (
                                <label
                                  key={group.id}
                                  className="flex items-center gap-3 px-4 py-2 hover:bg-[var(--bg-tertiary)] cursor-pointer transition-colors"
                                >
                                  <input
                                    type="checkbox"
                                    checked={sharedGroups.includes(group.id)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSharedGroups((prev) => [
                                          ...prev,
                                          group.id,
                                        ]);
                                      } else {
                                        setSharedGroups((prev) =>
                                          prev.filter((g) => g !== group.id),
                                        );
                                      }
                                    }}
                                    className="accent-[var(--accent-primary)] w-4 h-4"
                                  />
                                  <div className="flex-1">
                                    <p
                                      className="text-sm"
                                      style={{ color: "var(--text-primary)" }}
                                    >
                                      {group.name}
                                    </p>
                                    {group.description && (
                                      <p
                                        className="text-xs"
                                        style={{ color: "var(--text-muted)" }}
                                      >
                                        {group.description}
                                      </p>
                                    )}
                                  </div>
                                </label>
                              ))}
                            </div>

                            {/* Publish to selected groups button */}
                            {sharedGroups.length > 0 && (
                              <div
                                className="p-3 border-t"
                                style={{ borderColor: "var(--border-subtle)" }}
                              >
                                <button
                                  onClick={() => togglePublish(sharedGroups)}
                                  className="w-full px-4 py-2 rounded-lg text-sm font-medium bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
                                >
                                  Publish to {sharedGroups.length} group
                                  {sharedGroups.length > 1 ? "s" : ""}
                                </button>
                              </div>
                            )}

                            {/* Cancel */}
                            <div
                              className="p-2 border-t"
                              style={{ borderColor: "var(--border-subtle)" }}
                            >
                              <button
                                onClick={() => setShowPublishMenu(false)}
                                className="w-full px-3 py-1.5 rounded-lg text-xs text-center"
                                style={{ color: "var(--text-muted)" }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                      </>
                    )}
                    <div className="flex items-center gap-2">
                      {isReadonly && (
                        <span className="text-xs px-2 py-1 rounded bg-red-500/10 text-red-500 font-medium">Read-only (Unpublished)</span>
                      )}
                      <button
                        onClick={saveAgent}
                        disabled={saving || !name.trim() || isReadonly}
                        className="px-5 py-1.5 text-sm font-medium rounded-lg border bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{
                          borderColor: "var(--border-default)",
                          color: "var(--text-secondary)",
                        }}
                      >
                        {saving ? "Saving..." : "Save Changes"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Config Content (Sidebar + Main) */}
                <div className="flex-1 flex overflow-hidden">
                  {/* Navigation Sidebar */}
                  <div
                    className="w-40 flex flex-col py-3 border-r"
                    style={{
                      borderColor: "var(--border-subtle)",
                      background: "var(--bg-primary)",
                    }}
                  >
                    {(() => {
                      const isIntegrationAvailable = (item) => {
                        if (!integrationStatus) return false;
                        const orgEnabled = integrationStatus.orgEnabledIntegrations;
                        if (orgEnabled && !orgEnabled.includes(item.id)) return false;
                        if (item.group === 'google') return !!integrationStatus.isGoogleUser;
                        if (item.id === 'fireflies') return !!integrationStatus.hasFirefliesKey;
                        if (item.id === 'youtrack') return !!integrationStatus.hasYouTrackConfig;
                        if (item.id === 'gamma') return !!integrationStatus.hasGammaKey;
                        if (item.id === 'n8n') return !!integrationStatus.hasN8nConfig;
                        if (item.id === 'linkedin') return !!integrationStatus.hasLinkedInConfig || !!integrationStatus.linkedInConnected;
                        return true;
                      };
                      const hasIntegrations = INTEGRATION_CATALOG.some(isIntegrationAvailable);
                      return [
                        { id: "identity", label: "Identity" },
                        { id: "knowledge", label: "Knowledge" },
                        ...(hasIntegrations ? [{ id: "tools", label: "Integrations" }] : []),
                        { id: "behavior", label: "Behavior" },
                      ].map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setActiveSection(item.id)}
                        className={`text-left px-4 py-2 text-[13px] font-medium transition-all border-l-2 ${
                          activeSection === item.id
                            ? "border-[var(--accent-primary)] text-[var(--text-primary)] bg-[var(--bg-tertiary)]/50"
                            : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]/30"
                        }`}
                      >
                        {item.label}
                      </button>
                    ));
                    })()}
                  </div>

                  {/* Section Content */}
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                    <div>
                      {activeSection === "knowledge" && (
                        <div className="space-y-6 animate-fadeIn h-full flex flex-col">
                          <div>
                            <h2 className="text-base font-semibold text-primary">
                              Knowledge Base
                            </h2>
                            <p className="text-xs text-muted mt-0.5">
                              Upload documents or add facts for the agent to
                              use.
                            </p>
                          </div>

                          <div className="flex-1 overflow-hidden">
                            {selectedAgent ? (
                              <KnowledgePanel
                                agentId={selectedAgent.id}
                                API_BASE={API_BASE}
                                strictKnowledge={strictKnowledge}
                                onStrictKnowledgeChange={setStrictKnowledge}
                                includeSourceReferences={
                                  includeSourceReferences
                                }
                                onIncludeSourceReferencesChange={
                                  setIncludeSourceReferences
                                }
                                knowledgeBaseIds={knowledgeBaseIds}
                                onKnowledgeBaseIdsChange={setKnowledgeBaseIds}
                              />
                            ) : (
                              <div
                                className="h-full flex flex-col items-center justify-center text-muted border-2 border-dashed rounded-xl"
                                style={{ borderColor: "var(--border-subtle)" }}
                              >
                                <p>
                                  Please save the agent first to add knowledge.
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {activeSection === "identity" && (
                        <IdentitySection {...sharedProps} />
                      )}
                      {activeSection === "tools" && (
                        <ToolsSection {...sharedProps} />
                      )}
                      {activeSection === "behavior" && (
                        <BehaviorSection {...sharedProps} />
                      )}

                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div
              className="flex-1 flex flex-col items-center justify-center p-8 max-w-4xl mx-auto w-full"
              style={{ paddingBottom: "20%" }}
            >
              <h1
                className="text-center"
                style={{
                  fontSize: "32px",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  marginBottom: "12px",
                  letterSpacing: "-0.02em",
                }}
              >
                Agent Designer
              </h1>
              <p
                className="text-sm text-center mb-8 leading-relaxed"
                style={{ color: "var(--text-muted)", maxWidth: "420px" }}
              >
                Select an agent from the sidebar to edit, or create a new one to
                start building your custom AI workflow assistant.
              </p>
              {!systemMode && (
                <button
                  onClick={createNewAgent}
                  className="px-6 py-2.5 rounded-full text-sm font-medium transition-all border hover:border-purple-500/30 hover:bg-[var(--bg-secondary)]"
                  style={{
                    borderColor: "var(--border-subtle)",
                    color: "var(--text-primary)",
                    background: "var(--bg-card)",
                  }}
                >
                  Create New Agent
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AgentDesigner;
