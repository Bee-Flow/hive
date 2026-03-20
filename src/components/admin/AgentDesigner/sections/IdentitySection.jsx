import React, { useState as useLocalState } from 'react';
import ModelTierSelector from '../../../ModelTierSelector';
import VersionHistory from '../../../VersionHistory';

export const IdentitySection = ({
  selectedAgent, name, setName, description, setDescription,
  systemPrompt, setSystemPrompt, avatar, setAvatar,
  showEmojiPicker, setShowEmojiPicker, emojiCategory, setEmojiCategory, emojiPickerRef,
  model, setModel, modelTiers, authFetch, API_BASE,
  activeGuardrailTab, setActiveGuardrailTab, llamaGuardEnabled, setLlamaGuardEnabled,
  webSearchGuardEnabled, setWebSearchGuardEnabled, regexGuardrailsEnabled, setRegexGuardrailsEnabled,
  availableCollections, selectedCollections, setSelectedCollections,
  regexScope, setRegexScope, guardrailAction, setGuardrailAction,
  enabledIntegrations, setEnabledIntegrations, integrationStatus,
  availableModels,

  CAPABILITIES, checkCapability, toggleCapability,
  allowCopy, setAllowCopy, embedEnabled, setEmbedEnabled,
  bubbleColor, setBubbleColor, bubblePosition, setBubblePosition,
  bubbleSize, setBubbleSize, bubbleIcon, setBubbleIcon,
  windowWidth, setWindowWidth, windowHeight, setWindowHeight,
  chatFont, setChatFont, chatFontSize, setChatFontSize,
  chatLineHeight, setChatLineHeight, userBubbleColor, setUserBubbleColor,
  assistantBubbleColor, setAssistantBubbleColor, warningText, setWarningText,
  setPromptDesignerMessages, setPromptDesignerInput, setShowPromptDesigner,
  categoryId, setCategoryId, agentCategories, setAgentCategories,
}) => {
  const [showNewCategory, setShowNewCategory] = useLocalState(false);
  const [newCategoryName, setNewCategoryName] = useLocalState('');

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      const res = await authFetch(`${API_BASE}/agents/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCategoryName.trim() })
      });
      if (res.ok) {
        const cat = await res.json();
        setAgentCategories(prev => [...prev, cat]);
        setCategoryId(cat.id);
        setNewCategoryName('');
        setShowNewCategory(false);
      }
    } catch (err) { console.error('Failed to create category:', err); }
  };
  return (
                                                <div className="space-y-6 animate-fadeIn">
                                                    <div className="flex items-center justify-between">
                                                        <h2 className="text-base font-semibold text-primary">Agent Identity</h2>
                                                        <button
                                                            type="button"
                                                            onClick={async () => {
                                                                if (!systemPrompt) {
                                                                    alert('Please set a System Prompt first (below)');
                                                                    return;
                                                                }
                                                                try {
                                                                    const res = await authFetch(`${API_BASE}/agents/system/identity-improver/generate`, {
                                                                        method: 'POST',
                                                                        headers: { 'Content-Type': 'application/json' },
                                                                        body: JSON.stringify({ currentName: name, currentDescription: description, systemPrompt })
                                                                    });
                                                                    const data = await res.json();
                                                                    if (data.avatar) setAvatar(data.avatar);
                                                                    if (data.name) setName(data.name);
                                                                    if (data.description) setDescription(data.description);
                                                                } catch (err) {
                                                                    console.error('Failed to improve identity:', err);
                                                                    alert('Failed to improve identity. Please try again.');
                                                                }
                                                            }}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)]" style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                                                            title="Generate name and description from system prompt"
                                                        >
                                                            Improve Identity
                                                        </button>
                                                    </div>

                                                    {/* Avatar Picker */}
                                                    <div className="relative">
                                                        <label className="text-xs font-medium text-muted mb-2 block">Avatar</label>
                                                        <div className="flex items-center gap-4">
                                                            <div
                                                                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                                                className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl cursor-pointer hover:bg-[var(--bg-tertiary)] transition-all overflow-hidden border border-[var(--border-subtle)]"
                                                                title="Click to change avatar"
                                                            >
                                                                {avatar && (avatar.startsWith('data:') || avatar.startsWith('http')) ? (
                                                                    <img src={avatar} alt="" className="w-full h-full object-cover" />
                                                                ) : (
                                                                    avatar
                                                                )}
                                                            </div>
                                                            <div className="text-sm text-muted">
                                                                <p>Click to select an emoji or image</p>
                                                                <p className="text-xs opacity-70">Supports emoji, PNG, JPG, or SVG</p>
                                                            </div>
                                                        </div>
                                                        {showEmojiPicker && (() => {
                                                            const categories = {
                                                                smileys: { label: '😀', title: 'Smileys', emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😊', '😇', '🥰', '😍', '🤩', '😘', '😋', '😛', '🤪', '🤨', '🧐', '🤓', '😎', '🥸', '🤡', '🥹', '😏', '😌', '😔', '😴', '🤤', '😷', '🤒', '🤕', '🤢', '🤮', '🥵', '🥶', '😵', '🤯', '🥳', '🤠', '😈', '👿', '👹', '👺', '💀', '👻', '👽', '🤖', '💩', '😺', '😸'] },
                                                                people: { label: '👤', title: 'People', emojis: ['👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '💪', '🦾', '🦿', '👨‍💻', '👩‍💻', '👨‍🔬', '👩‍🔬', '👨‍🎨', '👩‍🎨', '🧙‍♂️', '🧙‍♀️', '🦸‍♂️', '🦸‍♀️', '🥷', '🧑‍🚀', '👮', '🕵️', '💂', '🧑‍🍳', '🧑‍🏫', '🧑‍⚕️'] },
                                                                animals: { label: '🐾', title: 'Animals', emojis: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🦗', '🕷️', '🦂', '🐢', '🐍', '🦎', '🐙', '🦑', '🐠', '🐟', '🐬', '🐳', '🦈'] },
                                                                food: { label: '🍕', title: 'Food', emojis: ['🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕', '🧄', '🧅', '🥔', '🍞', '🥐', '🥖', '🥨', '🧀', '🥚', '🍳', '🥞', '🧇', '🥓', '🍔', '🍟', '🍕', '🌭', '🥪', '🌮', '🌯', '🫔', '🥗', '🍜'] },
                                                                travel: { label: '✈️', title: 'Travel', emojis: ['🚗', '🚕', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚', '🚛', '🚜', '🛵', '🏍️', '🚲', '🛴', '🚂', '🚆', '🚇', '✈️', '🛫', '🛬', '🚀', '🛸', '🚁', '⛵', '🚢', '🏠', '🏡', '🏢', '🏣', '🏥', '🏦', '🏨', '🏩', '🏪', '🏫', '🏬', '🏭', '🗼', '🗽', '⛪', '🕌', '🛕', '🕍', '⛩️', '🕋', '⛲', '🌍'] },
                                                                objects: { label: '💡', title: 'Objects', emojis: ['⌚', '📱', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '💽', '💾', '💿', '📀', '🎥', '📷', '📹', '🔍', '🔬', '🔭', '📡', '💡', '🔦', '🏮', '🪔', '📔', '📕', '📖', '📗', '📘', '📙', '📚', '📓', '📒', '📃', '📜', '📄', '📰', '🗞️', '📑', '🔖', '🏷️', '💰', '🪙', '💴', '💵', '💶', '💷', '💸', '💳', '🧾', '💹', '✉️'] },
                                                                symbols: { label: '⚡', title: 'Symbols', emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓', '🆔', '⚛️', '🉑', '☢️', '☣️', '📴', '📳'] },
                                                                tech: { label: '🤖', title: 'Tech & Work', emojis: ['🤖', '🧠', '💡', '🔧', '🔨', '⚒️', '🛠️', '⚙️', '🧰', '📊', '📈', '📉', '💹', '🎯', '🚀', '⚡', '🔥', '💥', '✨', '🌟', '⭐', '🏆', '🥇', '🥈', '🥉', '🎖️', '🏅', '🎗️', '📝', '✏️', '🖊️', '🖋️', '📌', '📍', '📎', '🖇️', '📐', '📏', '🗂️', '📂', '📁', '🗃️', '🗄️', '🔒', '🔓', '🔐', '🔑', '🗝️', '🛡️', '⚔️'] }
                                                            };
                                                            const currentEmojis = categories[emojiCategory]?.emojis || categories.smileys.emojis;
                                                            return (
                                                                <div ref={emojiPickerRef} className="absolute top-full left-0 mt-2 rounded-xl border bg-[var(--bg-card)] shadow-xl z-50" style={{ borderColor: 'var(--border-default)', width: '400px' }}>
                                                                    {/* Category Tabs */}
                                                                    <div className="flex items-center gap-0.5 px-2 py-1.5 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                                                                        {Object.entries(categories).map(([key, cat]) => (
                                                                            <button
                                                                                key={key}
                                                                                onClick={() => setEmojiCategory(key)}
                                                                                className={`flex-1 py-1.5 rounded-md text-sm transition-all ${emojiCategory === key
                                                                                    ? 'bg-[var(--bg-tertiary)]'
                                                                                    : 'hover:bg-[var(--bg-tertiary)]/50'
                                                                                    }`}
                                                                                title={cat.title}
                                                                            >
                                                                                {cat.label}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                    {/* Emoji Grid */}
                                                                    <div className="p-2">
                                                                        <div className="grid grid-cols-8 gap-0.5">
                                                                            {currentEmojis.map(emoji => (
                                                                                <button
                                                                                    key={emoji}
                                                                                    onClick={() => { setAvatar(emoji); setShowEmojiPicker(false); }}
                                                                                    className={`w-9 h-9 rounded-lg flex items-center justify-center text-xl hover:bg-[var(--bg-tertiary)] transition-colors ${avatar === emoji ? 'bg-[var(--bg-tertiary)] ring-2 ring-emerald-500' : ''}`}
                                                                                >
                                                                                    {emoji}
                                                                                </button>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                    {/* Custom Input + Image Upload */}
                                                                    <div className="flex items-center gap-2 px-3 py-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                                                                        <input
                                                                            type="text"
                                                                            value={avatar && (avatar.startsWith('data:') || avatar.startsWith('http')) ? '' : avatar}
                                                                            onChange={(e) => setAvatar(e.target.value.slice(-2) || '🤖')}
                                                                            className="input flex-1 py-1 text-center text-xl"
                                                                            placeholder="🤖"
                                                                            maxLength={2}
                                                                        />
                                                                        <input
                                                                            type="file"
                                                                            accept="image/png,image/jpeg,image/svg+xml,image/webp,image/gif"
                                                                            className="hidden"
                                                                            id="agent-avatar-upload"
                                                                            onChange={(e) => {
                                                                                const file = e.target.files?.[0];
                                                                                if (!file) return;
                                                                                if (file.size > 512 * 1024) {
                                                                                    alert('Image must be under 512KB');
                                                                                    return;
                                                                                }
                                                                                const reader = new FileReader();
                                                                                reader.onload = (ev) => {
                                                                                    setAvatar(ev.target.result);
                                                                                    setShowEmojiPicker(false);
                                                                                };
                                                                                reader.readAsDataURL(file);
                                                                                e.target.value = '';
                                                                            }}
                                                                        />
                                                                        <button
                                                                            onClick={() => document.getElementById('agent-avatar-upload')?.click()}
                                                                            className="px-3 py-1 text-xs font-medium rounded-lg bg-[var(--bg-tertiary)] hover:bg-[var(--accent-primary)] hover:text-white transition-colors flex items-center gap-1.5"
                                                                            style={{ color: 'var(--text-secondary)' }}
                                                                            title="Upload an image as avatar"
                                                                        >
                                                                            📷 Upload
                                                                        </button>
                                                                        <button
                                                                            onClick={() => setShowEmojiPicker(false)}
                                                                            className="px-3 py-1 text-xs font-medium rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors" style={{ color: 'var(--text-secondary)' }}
                                                                        >
                                                                            Done
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                                        <div>
                                                            <label className="text-xs font-medium text-muted mb-1.5 block">Name</label>
                                                            <input
                                                                type="text"
                                                                value={name}
                                                                onChange={(e) => setName(e.target.value)}
                                                                className="input w-full px-3 py-2 text-sm"
                                                                placeholder="e.g. Data Analyst"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-xs font-medium text-muted mb-1.5 block">Role Description</label>
                                                            <input
                                                                type="text"
                                                                value={description}
                                                                onChange={(e) => setDescription(e.target.value)}
                                                                className="input w-full px-3 py-2 text-sm"
                                                                placeholder="e.g. Analyzes trends in CSV files"
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* Category */}
                                                    {agentCategories && agentCategories.length > 0 || showNewCategory ? (
                                                        <div className="mt-4">
                                                            <label className="text-xs font-medium text-muted mb-1.5 block">Category</label>
                                                            <div className="flex items-center gap-2">
                                                                {!showNewCategory ? (
                                                                    <>
                                                                        <select
                                                                            value={categoryId || ''}
                                                                            onChange={(e) => setCategoryId(e.target.value || null)}
                                                                            className="input flex-1 px-3 py-2 text-sm"
                                                                        >
                                                                            <option value="">No category</option>
                                                                            {(agentCategories || []).map(c => (
                                                                                <option key={c.id} value={c.id}>{c.name}</option>
                                                                            ))}
                                                                        </select>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setShowNewCategory(true)}
                                                                            className="p-2 rounded-lg border hover:bg-[var(--bg-tertiary)] transition-colors"
                                                                            style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                                                                            title="Create new category"
                                                                        >
                                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                                                            </svg>
                                                                        </button>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <input
                                                                            type="text"
                                                                            value={newCategoryName}
                                                                            onChange={(e) => setNewCategoryName(e.target.value)}
                                                                            onKeyDown={(e) => e.key === 'Enter' && handleCreateCategory()}
                                                                            className="input flex-1 px-3 py-2 text-sm"
                                                                            placeholder="Category name..."
                                                                            autoFocus
                                                                        />
                                                                        <button
                                                                            type="button"
                                                                            onClick={handleCreateCategory}
                                                                            disabled={!newCategoryName.trim()}
                                                                            className="px-3 py-2 rounded-lg text-xs font-medium bg-emerald-500 text-white hover:bg-emerald-600 transition-colors disabled:opacity-40"
                                                                        >
                                                                            Create
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => { setShowNewCategory(false); setNewCategoryName(''); }}
                                                                            className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors"
                                                                            style={{ color: 'var(--text-muted)' }}
                                                                        >
                                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                                            </svg>
                                                                        </button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="mt-4">
                                                            <button
                                                                type="button"
                                                                onClick={() => setShowNewCategory(true)}
                                                                className="flex items-center gap-1.5 text-xs font-medium transition-all hover:text-[var(--text-primary)]"
                                                                style={{ color: 'var(--text-muted)' }}
                                                            >
                                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                                                </svg>
                                                                Add to category
                                                            </button>
                                                        </div>
                                                    )}

                                                    {/* Intelligence & Instructions (merged) */}
                                                    <div className="mt-5 pt-5 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                                                        <h3 className="text-xs font-medium text-muted mb-4">Intelligence & Instructions</h3>

                                                        <div className="space-y-5">
                                                            <div>
                                                                <label className="text-xs font-medium text-muted mb-2 block">AI Model</label>
                                                                <ModelTierSelector
                                                                    tiers={modelTiers}
                                                                    value={model ? model.replace('tier:', '') : 'auto'}
                                                                    onChange={(tier) => setModel(`tier:${tier}`)}
                                                                />
                                                            </div>

                                                            <div>
                                                                <div className="flex items-center justify-between mb-2">
                                                                    <label className="text-xs font-medium text-muted">
                                                                        System Prompt
                                                                        <span className="ml-2 normal-case font-normal opacity-50 text-[10px]">Defines personality and rules</span>
                                                                    </label>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            // Always start fresh
                                                                            setPromptDesignerMessages([{
                                                                                role: 'assistant',
                                                                                content: systemPrompt
                                                                                    ? `I'll improve your existing prompt. Just click send or tell me what to change.`
                                                                                    : `What should this agent do? I'll generate a prompt for you.`
                                                                            }]);
                                                                            setPromptDesignerInput('');
                                                                            setShowPromptDesigner(true);
                                                                        }}
                                                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)]" style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                                                                    >
                                                                        AI Assist
                                                                    </button>
                                                                </div>
                                                                <textarea
                                                                    value={systemPrompt}
                                                                    onChange={(e) => setSystemPrompt(e.target.value)}
                                                                    className="input w-full font-mono text-sm leading-relaxed"
                                                                    rows={12}
                                                                    placeholder="You are a helpful assistant..."
                                                                    style={{ minHeight: '200px' }}
                                                                />
                                                            </div>

                                                        </div>
                                                    </div>

                                                    {/* Version History */}
                                                    {selectedAgent && (
                                                        <VersionHistory agentId={selectedAgent.id} onRestore={() => window.location.reload()} />
                                                    )}
                                                </div>
  );
};
