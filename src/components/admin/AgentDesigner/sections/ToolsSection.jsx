import React from 'react';
import { INTEGRATION_CATALOG } from '../integrations';
import ConnectionPolicyPicker from '../../../shared/ConnectionPolicyPicker';

export const ToolsSection = ({
  selectedAgent, name, setName, description, setDescription,
  systemPrompt, setSystemPrompt, avatar, setAvatar,
  showEmojiPicker, setShowEmojiPicker, emojiCategory, setEmojiCategory, emojiPickerRef,
  model, setModel, modelTiers, authFetch, API_BASE,
  activeGuardrailTab, setActiveGuardrailTab, llamaGuardEnabled, setLlamaGuardEnabled,
  webSearchGuardEnabled, setWebSearchGuardEnabled, regexGuardrailsEnabled, setRegexGuardrailsEnabled,
  availableCollections, selectedCollections, setSelectedCollections,
  regexScope, setRegexScope, guardrailAction, setGuardrailAction,
  enabledIntegrations, setEnabledIntegrations, integrationStatus,
  sequentialThinkingEnabled, setSequentialThinkingEnabled,
  sequentialThinkingModel, setSequentialThinkingModel, availableModels,
  CAPABILITIES, checkCapability, toggleCapability,
  allowCopy, setAllowCopy, embedEnabled, setEmbedEnabled,
  bubbleColor, setBubbleColor, bubblePosition, setBubblePosition,
  bubbleSize, setBubbleSize, bubbleIcon, setBubbleIcon,
  windowWidth, setWindowWidth, windowHeight, setWindowHeight,
  chatFont, setChatFont, chatFontSize, setChatFontSize,
  chatLineHeight, setChatLineHeight, userBubbleColor, setUserBubbleColor,
  assistantBubbleColor, setAssistantBubbleColor, warningText, setWarningText,
  setPromptDesignerMessages, setPromptDesignerInput, setShowPromptDesigner
}) => {
  return (
                                                <div className="space-y-6 animate-fadeIn">
                                                    <div>
                                                        <h2 data-tour="agent-tools" className="text-base font-semibold text-primary">Capabilities & Integrations</h2>
                                                        <p className="text-xs text-muted mt-0.5">Select which integrations this agent can use. Only integrations you have access to are shown.</p>
                                                    </div>

                                                    {/* Integration Status Grid */}
                                                    {(() => {
                                                        const isAvailable = (item) => {
                                                            if (!integrationStatus) return false;
                                                            // Org-level gating only
                                                            const orgEnabled = integrationStatus.orgEnabledIntegrations;
                                                            if (orgEnabled && !orgEnabled.includes(item.id)) return false;
                                                            // Credential/SSO requirements
                                                            if (item.group === 'google') return !!integrationStatus.isGoogleUser;
                                                            if (item.id === 'fireflies') return !!integrationStatus.hasFirefliesKey;
                                                            if (item.id === 'youtrack') return !!integrationStatus.hasYouTrackConfig;
                                                            if (item.id === 'gamma') return !!integrationStatus.hasGammaKey;
                                                            if (item.id === 'afas-profit') return !!integrationStatus.hasAfasConfig;
                                                            if (item.id === 'nmbrs') return !!integrationStatus.hasNmbrsConfig;
                                                            if (item.id === 'n8n') return !!integrationStatus.hasN8nConfig;
                                                            if (item.id === 'linkedin') return !!integrationStatus.hasLinkedInConfig || !!integrationStatus.linkedInConnected;
                                                            return true;
                                                        };

                                                        const available = INTEGRATION_CATALOG.filter(isAvailable);

                                                        const isSelected = (id) => {
                                                            if (!enabledIntegrations) return true; // null = all enabled by default
                                                            return enabledIntegrations.includes(id);
                                                        };

                                                        const toggleIntegration = (id) => {
                                                            setEnabledIntegrations(prev => {
                                                                const currentList = prev || available.map(a => a.id);
                                                                if (currentList.includes(id)) {
                                                                    return currentList.filter(x => x !== id);
                                                                } else {
                                                                    return [...currentList, id];
                                                                }
                                                            });
                                                        };

                                                        const selectedCount = available.filter(a => isSelected(a.id)).length;

                                                        return (
                                                            <>
                                                                {available.length > 0 ? (
                                                                    <div>
                                                                        <h3 className="text-xs font-medium text-muted mb-3 flex items-center gap-1.5">
                                                                            <svg className="w-3 h-3 text-emerald-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" /></svg>
                                                                            Agent Integrations ({selectedCount}/{available.length})
                                                                        </h3>
                                                                        <div className="grid grid-cols-2 gap-2">
                                                                            {available.map(item => {
                                                                                const selected = isSelected(item.id);
                                                                                return (
                                                                                    <div
                                                                                        key={item.id}
                                                                                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${selected ? '' : 'opacity-50'}`}
                                                                                        style={{ borderColor: selected ? 'var(--accent-primary)' : 'var(--border-subtle)', background: selected ? 'rgba(16, 185, 129, 0.04)' : 'transparent' }}
                                                                                        onClick={() => toggleIntegration(item.id)}
                                                                                    >
                                                                                        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                                                                                            {item.iconSvg}
                                                                                        </div>
                                                                                        <div className="min-w-0 flex-1">
                                                                                            <p className="text-sm font-medium text-primary truncate">{item.label}</p>
                                                                                            <p className="text-[10px] text-muted truncate">{item.description}</p>
                                                                                        </div>
                                                                                        <label className="relative inline-flex items-center cursor-pointer flex-shrink-0" onClick={e => e.stopPropagation()}>
                                                                                            <input type="checkbox" checked={selected} onChange={() => toggleIntegration(item.id)} className="sr-only peer" />
                                                                                            <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                                                                                        </label>
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="text-center py-8 rounded-xl border border-dashed" style={{ borderColor: 'var(--border-subtle)' }}>
                                                                        <svg className="w-8 h-8 mx-auto mb-2 text-muted opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                                                                        <p className="text-sm text-muted">No integrations available</p>
                                                                        <p className="text-[10px] text-muted mt-1">Connect via Google SSO or configure API keys in Settings</p>
                                                                    </div>
                                                                )}
                                                            </>
                                                        );
                                                    })()}

                                                    {/* Connection lending (gated): owner lends a named connection for
                                                        this agent, or recipients bring their own (default). */}
                                                    <ConnectionPolicyPicker
                                                        resourceType="agent"
                                                        resourceId={selectedAgent?.id || null}
                                                        providers={enabledIntegrations || INTEGRATION_CATALOG.map(i => i.id)}
                                                    />
                                                </div>
  );
};
