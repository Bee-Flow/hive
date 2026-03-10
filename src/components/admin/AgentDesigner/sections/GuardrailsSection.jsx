import React from 'react';

export const GuardrailsSection = ({
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
                                                <div className="space-y-6 animate-fadeIn h-full flex flex-col">
                                                    <h2 className="text-base font-semibold mb-4 text-primary">Safety Guardrails</h2>

                                                    <div className="flex-1 flex gap-6 overflow-hidden">
                                                        {/* Sub-navigation for Guardrails */}
                                                        <div className="w-48 flex-shrink-0 flex flex-col gap-1 border-r pr-6" style={{ borderColor: 'var(--border-subtle)' }}>
                                                            <button
                                                                onClick={() => setActiveGuardrailTab('llama')}
                                                                className={`px-3 py-2 rounded-lg text-sm text-left transition-colors ${activeGuardrailTab === 'llama' ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] font-medium' : 'text-muted hover:text-primary hover:bg-white/5'}`}
                                                            >
                                                                🛡️ Llama Guard
                                                            </button>
                                                            <button
                                                                onClick={() => setActiveGuardrailTab('regex')}
                                                                className={`px-3 py-2 rounded-lg text-sm text-left transition-colors ${activeGuardrailTab === 'regex' ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] font-medium' : 'text-muted hover:text-primary hover:bg-white/5'}`}
                                                            >
                                                                Regex Rules
                                                            </button>
                                                        </div>

                                                        {/* Content */}
                                                        <div className="flex-1 overflow-y-auto pr-2">

                                                            {activeGuardrailTab === 'llama' && (
                                                                <div>
                                                                    <div className="flex items-center justify-between p-4 rounded-xl border transition-colors mb-4" style={{ background: 'var(--bg-tertiary)', borderColor: 'transparent' }}>
                                                                        <div>
                                                                            <h4 className="text-sm font-medium text-primary flex items-center gap-2">
                                                                                Enable Llama Guard
                                                                            </h4>
                                                                            <p className="text-xs text-muted mt-0.5">Input/Output safety validation using self-hosted Llama Guard</p>
                                                                        </div>
                                                                        <label className="relative inline-flex items-center cursor-pointer">
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={llamaGuardEnabled}
                                                                                onChange={(e) => setLlamaGuardEnabled(e.target.checked)}
                                                                                className="sr-only peer"
                                                                            />
                                                                            <div className="w-11 h-6 bg-[var(--bg-tertiary)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                                                                        </label>
                                                                    </div>

                                                                    {/* Web Search Guard */}
                                                                    <div className="flex items-center justify-between p-4 rounded-xl border transition-colors mb-4" style={{ background: 'var(--bg-tertiary)', borderColor: 'transparent' }}>
                                                                        <div>
                                                                            <h4 className="text-sm font-medium text-primary flex items-center gap-2">
                                                                                🔍 Web Search Guard
                                                                            </h4>
                                                                            <p className="text-xs text-muted mt-0.5">Validate search queries through Llama Guard before sending to external search</p>
                                                                        </div>
                                                                        <label className="relative inline-flex items-center cursor-pointer">
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={webSearchGuardEnabled}
                                                                                onChange={(e) => setWebSearchGuardEnabled(e.target.checked)}
                                                                                className="sr-only peer"
                                                                            />
                                                                            <div className="w-11 h-6 bg-[var(--bg-tertiary)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                                                                        </label>
                                                                    </div>

                                                                    <div className="p-4 rounded-xl border text-xs leading-relaxed transition-colors" style={{ background: 'var(--accent-primary)', backgroundColor: 'rgba(249, 115, 22, 0.05)', borderColor: 'rgba(249, 115, 22, 0.2)', color: 'var(--text-secondary)' }}>
                                                                        <strong className="block mb-1" style={{ color: 'var(--text-primary)' }}>About Llama Guard</strong>
                                                                        <p className="mb-3">Llama Guard is a self-hosted safety classifier that detects harmful content across multiple policy categories. No external API key required.</p>

                                                                        <details className="group" open>
                                                                            <summary className="font-medium cursor-pointer flex items-center gap-2 hover:opacity-80 transition-opacity select-none" style={{ color: 'var(--text-primary)' }}>
                                                                                <svg className="w-3.5 h-3.5 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                                                                Content Categories
                                                                            </summary>
                                                                            <div className="mt-3 pt-3 border-t space-y-3" style={{ borderColor: 'rgba(249, 115, 22, 0.1)' }}>
                                                                                <p className="opacity-80">The model classifies content against the following categories:</p>
                                                                                <div className="grid gap-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                                                                                    {[
                                                                                        { id: '⚔️', name: 'Violence & Threats', desc: 'Content that promotes or threatens violence against individuals or groups.' },
                                                                                        { id: '🚫', name: 'Hate & Discrimination', desc: 'Content that demeans or discriminates against individuals or groups on the basis of protected characteristics.' },
                                                                                        { id: '⚠️', name: 'Dangerous & Criminal Content', desc: 'Content that enables, encourages, or endorses dangerous or criminal activities.' },
                                                                                        { id: '💔', name: 'Self-Harm', desc: 'Content that enables, encourages, or endorses acts of intentional self-harm.' },
                                                                                        { id: '🔞', name: 'Sexual Content', desc: 'Content that contains explicit sexual material.' },
                                                                                        { id: '🔒', name: 'Personal Information (PII)', desc: 'Content that contains sensitive personal identifiable information.' }
                                                                                    ].map(item => (
                                                                                        <div key={item.id} className="p-2 rounded bg-white/5 border border-white/5">
                                                                                            <div className="flex items-center gap-2 mb-1">
                                                                                                <span className="text-sm">{item.id}</span>
                                                                                                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{item.name}</span>
                                                                                            </div>
                                                                                            <p className="opacity-70 leading-snug">{item.desc}</p>
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            </div>
                                                                        </details>
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {activeGuardrailTab === 'regex' && (
                                                                <div className="space-y-4">
                                                                    <div className="flex items-center justify-between p-4 rounded-xl border transition-colors" style={{ background: 'var(--bg-tertiary)', borderColor: 'transparent' }}>
                                                                        <div>
                                                                            <h4 className="text-sm font-medium text-primary flex items-center gap-2">
                                                                                Regex Pattern Guardrails
                                                                            </h4>
                                                                            <p className="text-xs text-muted mt-0.5">Block content matching custom patterns</p>
                                                                        </div>
                                                                        <label className="relative inline-flex items-center cursor-pointer">
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={regexGuardrailsEnabled}
                                                                                onChange={(e) => setRegexGuardrailsEnabled(e.target.checked)}
                                                                                className="sr-only peer"
                                                                            />
                                                                            <div className="w-11 h-6 bg-[var(--bg-tertiary)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                                                                        </label>
                                                                    </div>

                                                                    {regexGuardrailsEnabled && (
                                                                        <div className="space-y-6 pt-2 animate-fadeIn">
                                                                            {/* Collections */}
                                                                            <div>
                                                                                <label className="text-xs font-medium text-muted mb-3 block">Rule Collections</label>
                                                                                <div className="space-y-2 p-3 rounded-xl border" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-subtle)' }}>
                                                                                    {availableCollections.length === 0 ? (
                                                                                        <p className="text-xs text-muted italic">No collections available. Create them in Admin &gt; Guardrails.</p>
                                                                                    ) : availableCollections.map(col => (
                                                                                        <label key={col.id} className="flex items-center gap-3 text-sm text-[var(--text-secondary)] cursor-pointer p-2 rounded hover:bg-white/5 transition-colors">
                                                                                            <input
                                                                                                type="checkbox"
                                                                                                checked={selectedCollections.includes(col.id)}
                                                                                                onChange={(e) => {
                                                                                                    if (e.target.checked) {
                                                                                                        setSelectedCollections([...selectedCollections, col.id]);
                                                                                                    } else {
                                                                                                        setSelectedCollections(selectedCollections.filter(id => id !== col.id));
                                                                                                    }
                                                                                                }}
                                                                                                className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-[var(--accent-primary)] focus:ring-0"
                                                                                            />
                                                                                            <div className="flex-1">
                                                                                                <div className="font-medium text-[var(--text-primary)]">{col.name}</div>
                                                                                                <div className="text-xs text-muted">{col.ruleIds?.length || 0} rules included</div>
                                                                                            </div>
                                                                                        </label>
                                                                                    ))}
                                                                                </div>
                                                                            </div>

                                                                            <div className="grid grid-cols-2 gap-6">
                                                                                {/* Scope */}
                                                                                <div>
                                                                                    <label className="text-xs font-medium text-muted mb-3 block">Monitoring Scope</label>
                                                                                    <div className="space-y-2">
                                                                                        {[
                                                                                            { key: 'userInput', label: 'User Input' },
                                                                                            { key: 'agentOutput', label: 'Agent Output' },
                                                                                            { key: 'toolInput', label: 'Tool Input' },
                                                                                            { key: 'toolOutput', label: 'Tool Output' }
                                                                                        ].map(scope => (
                                                                                            <label key={scope.key} className="flex items-center gap-2 text-sm text-[var(--text-secondary)] cursor-pointer hover:text-primary transition-colors">
                                                                                                <input
                                                                                                    type="checkbox"
                                                                                                    checked={regexScope[scope.key]}
                                                                                                    onChange={(e) => setRegexScope(prev => ({ ...prev, [scope.key]: e.target.checked }))}
                                                                                                    className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-[var(--accent-primary)] focus:ring-0"
                                                                                                />
                                                                                                {scope.label}
                                                                                            </label>
                                                                                        ))}
                                                                                    </div>
                                                                                </div>

                                                                                {/* Action */}
                                                                                <div>
                                                                                    <label className="text-xs font-medium text-muted mb-3 block">Violation Action</label>
                                                                                    <div className="flex flex-col gap-3">
                                                                                        <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)] cursor-pointer hover:text-primary transition-colors">
                                                                                            <input
                                                                                                type="radio"
                                                                                                name="guardrailAction"
                                                                                                value="delete"
                                                                                                checked={guardrailAction === 'delete'}
                                                                                                onChange={(e) => setGuardrailAction(e.target.value)}
                                                                                                className="w-4 h-4 border-gray-600 bg-gray-700 text-[var(--accent-primary)] focus:ring-0"
                                                                                            />
                                                                                            Delete message
                                                                                        </label>
                                                                                        <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)] cursor-pointer hover:text-primary transition-colors">
                                                                                            <input
                                                                                                type="radio"
                                                                                                name="guardrailAction"
                                                                                                value="redact"
                                                                                                checked={guardrailAction === 'redact'}
                                                                                                onChange={(e) => setGuardrailAction(e.target.value)}
                                                                                                className="w-4 h-4 border-gray-600 bg-gray-700 text-[var(--accent-primary)] focus:ring-0"
                                                                                            />
                                                                                            Redact information
                                                                                        </label>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
  );
};
