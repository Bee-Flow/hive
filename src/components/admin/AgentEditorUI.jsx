import React, { useState, useEffect } from 'react';
import KnowledgePanel from '../KnowledgePanel';
import VersionHistory from '../VersionHistory';
import ModelTierSelector from '../ModelTierSelector';
import { API_BASE, authFetch } from '../../utils/helpers';
import { isImageAvatar, resolveAvatarSrc, DEFAULT_AGENT_EMOJI } from '../../utils/agentAvatar';
import { useUrlQueryParam } from '../../hooks/useUrlTab';
import AgentSkillsTab from './AgentSkillsTab';

/**
 * AgentEditorUI - Reusable presentational component for editing agents
 * 
 * @param {Object} data - The agent data (name, description, systemPrompt, etc.)
 * @param {Function} onChange - Handler for field updates (field, value) => void
 * @param {Array} components - List of available tool components
 * @param {Array} availableModels - List of available LLM models
 * @param {boolean} isSystem - Whether this is a system agent (read-only flags etc)
 * @param {boolean} hasKnowledge - Whether to show the Knowledge tab (requires persistent ID)
 * @param {string} agentId - The ID of the agent (required for KnowledgePanel)
 * @param {string} API_BASE - Base URL for API calls (required for KnowledgePanel)
 */
const AgentEditorUI = ({
    data,
    onChange,
    availableModels = [],
    isSystem = false,
    hasKnowledge = true,
    hasSkills = true,
    user = null,
    agentId,
    API_BASE,

    // Organization & group sharing
    organizations = [],
    groups = [],
    // Agent categories
    categories = [],
    onCreateCategory,
    // When set (e.g. 'editTab'), the inner tab is mirrored on a URL query
    // parameter so the editor is deep-linkable. Undefined → local state only.
    urlSyncKey = null,
    // Tier definitions for the canonical ModelTierSelector. When omitted we
    // fetch from `/ai/config/tiers-for-user?taskType=direct_chat` ourselves —
    // exact same endpoint InputArea / BuilderSplit / AgentDesigner consume —
    // so admins see only tiers that are actually configured + entitled.
    modelTiers: modelTiersProp = null,
}) => {
    const VALID_TABS = ['general', ...(hasKnowledge ? ['knowledge'] : []), ...(hasSkills ? ['skills'] : [])];
    const [urlTab, setUrlTab] = useUrlQueryParam(urlSyncKey || '__noop_editor_tab__');
    const [localTab, setLocalTab] = useState('general');
    const [fetchedTiers, setFetchedTiers] = useState({});
    const modelTiers = modelTiersProp || fetchedTiers;
    useEffect(() => {
        if (modelTiersProp) return;
        let cancelled = false;
        (async () => {
            try {
                const res = await authFetch(`${API_BASE}/ai/config/tiers-for-user?taskType=direct_chat`);
                if (!res.ok) return;
                const data = await res.json();
                if (!cancelled) setFetchedTiers(data || {});
            } catch { /* keep empty — selector still shows standard tiers */ }
        })();
        return () => { cancelled = true; };
    }, [modelTiersProp]);
    const activeTab = urlSyncKey
        ? (VALID_TABS.includes(urlTab) ? urlTab : 'general')
        : localTab;
    const setActiveTab = (v) => {
        if (urlSyncKey) setUrlTab(v);
        else setLocalTab(v);
    };
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showNewCategory, setShowNewCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');

    // Local handler to simplify standard inputs
    const handleChange = (field, value) => {
        onChange(field, value);
    };

    return (
        <div className="flex flex-col h-full bg-[var(--bg-primary)]">
            {/* Tabs */}
            <div className="flex border-b border-[var(--border-default)] bg-[var(--bg-secondary)]">
                {['General', ...(hasKnowledge ? ['Knowledge'] : []), ...(hasSkills ? ['Skills'] : [])].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab.toLowerCase())}
                        className={`px-4 py-2 text-sm font-medium transition-colors relative ${activeTab === tab.toLowerCase()
                            ? 'text-white'
                            : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                            }`}
                    >
                        {tab}
                        {activeTab === tab.toLowerCase() && (
                            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[var(--accent-primary)]" />
                        )}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-auto p-4">
                {/* GENERAL TAB */}
                {activeTab === 'general' && (
                    <div className="max-w-2xl space-y-4">
                        {/* Identity Row */}
                        <div className="grid grid-cols-12 gap-4">
                            {/* Avatar */}
                            <div className="col-span-2 relative">
                                <label className="text-xs mb-1 block text-[var(--text-muted)]">Avatar</label>
                                <button
                                    type="button"
                                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                    className="w-full aspect-square text-2xl rounded-xl border border-[var(--border-default)] bg-[var(--bg-tertiary)] flex items-center justify-center hover:border-[var(--accent-primary)] transition-all overflow-hidden"
                                >
                                    {isImageAvatar(data.avatar) ? (
                                        <img src={resolveAvatarSrc(data.avatar)} alt="" className="w-full h-full object-cover" />
                                    ) : (data.avatar || DEFAULT_AGENT_EMOJI)}
                                </button>
                                {showEmojiPicker && (
                                    <div className="absolute top-full left-0 mt-2 p-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] shadow-xl z-50 w-64">
                                        <div className="grid grid-cols-6 gap-1 mb-2">
                                            {['🤖', '🧠', '💡', '🔧', '📊', '📝', '🔍', '🎯', '⚡', '🚀', '💻', '📱', '🌐', '🔐', '📈', '🎨', '🛠️', '📧', '💬', '🗂️', '📅', '⏰', '🔔', '✅'].map(emoji => (
                                                <button
                                                    key={emoji}
                                                    onClick={() => {
                                                        handleChange('avatar', emoji);
                                                        setShowEmojiPicker(false);
                                                    }}
                                                    className="aspect-square flex items-center justify-center rounded hover:bg-white/10 text-lg"
                                                >
                                                    {emoji}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Name & Model */}
                            <div className="col-span-10 space-y-4">
                                <div>
                                    <label className="text-xs mb-1 block text-[var(--text-muted)]">Agent Name</label>
                                    <input
                                        type="text"
                                        value={data.name || ''}
                                        onChange={e => handleChange('name', e.target.value)}
                                        className="w-full px-4 py-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] focus:border-[var(--accent-primary)] outline-none"
                                        placeholder="My Agent"
                                    />
                                </div>
                                <div>
                                    <div>
                                        <label className="text-xs mb-1 block text-[var(--text-muted)]">Model</label>
                                        {/* Canonical tier picker — same component direct chat (InputArea),
                                            BuilderSplit, AgentDesigner and AITasksDesigner use. Tier list
                                            is fetched from /ai/config/tiers-for-user?taskType=direct_chat
                                            so we surface exactly the tiers the caller is actually allowed
                                            and that have a configured modelId. */}
                                        <ModelTierSelector
                                            tiers={modelTiers || {}}
                                            value={data.model ? data.model.replace('tier:', '') : 'auto'}
                                            onChange={(tier) => handleChange('model', `tier:${tier}`)}
                                            dropDirection="down"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div>
                            <div>
                                <label className="text-xs mb-1 block text-[var(--text-muted)]">Category</label>
                                <div className="flex items-center gap-2">
                                    <select
                                        value={data.categoryId || ''}
                                        onChange={e => handleChange('categoryId', e.target.value || null)}
                                        className="flex-1 px-4 py-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] focus:border-[var(--accent-primary)] outline-none text-sm"
                                    >
                                        <option value="">None (default "Agent")</option>
                                        {categories.map(cat => (
                                            <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                                        ))}
                                    </select>
                                    {onCreateCategory && (
                                        <button
                                            type="button"
                                            onClick={() => setShowNewCategory(!showNewCategory)}
                                            className="px-3 py-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:border-[var(--accent-primary)] transition-all text-sm"
                                            title="Create new category"
                                        >
                                            +
                                        </button>
                                    )}
                                </div>
                                {showNewCategory && onCreateCategory && (
                                    <div className="mt-2 flex items-center gap-2">
                                        <input
                                            type="text"
                                            value={newCategoryName}
                                            onChange={e => setNewCategoryName(e.target.value)}
                                            className="flex-1 px-3 py-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-sm"
                                            placeholder="Category name..."
                                            onKeyDown={e => {
                                                if (e.key === 'Enter' && newCategoryName.trim()) {
                                                    onCreateCategory(newCategoryName.trim());
                                                    setNewCategoryName('');
                                                    setShowNewCategory(false);
                                                }
                                            }}
                                            autoFocus
                                        />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (newCategoryName.trim()) {
                                                    onCreateCategory(newCategoryName.trim());
                                                    setNewCategoryName('');
                                                    setShowNewCategory(false);
                                                }
                                            }}
                                            disabled={!newCategoryName.trim()}
                                            className="px-3 py-2 rounded-lg text-xs font-medium text-white transition-all"
                                            style={{ background: newCategoryName.trim() ? 'var(--accent-primary)' : 'var(--bg-secondary)' }}
                                        >
                                            Create
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setShowNewCategory(false); setNewCategoryName(''); }}
                                            className="px-2 py-2 rounded-lg text-xs text-[var(--text-muted)] hover:bg-white/10"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Description */}
                        <div>
                            <label className="text-xs mb-1 block text-[var(--text-muted)]">Description</label>
                            <input
                                type="text"
                                value={data.description || ''}
                                onChange={e => handleChange('description', e.target.value)}
                                className="w-full px-4 py-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] focus:border-[var(--accent-primary)] outline-none"
                                placeholder="What does this agent do?"
                            />
                        </div>

                        {/* System Prompt */}
                        <div>
                            <label className="text-xs mb-1 block text-[var(--text-muted)]">System Prompt</label>
                            <textarea
                                value={data.systemPrompt || data.system_prompt || ''}
                                onChange={e => handleChange('systemPrompt', e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] font-mono text-sm focus:border-[var(--accent-primary)] outline-none resize-y"
                                rows={8}
                                placeholder="You are a helpful AI assistant..."
                            />
                        </div>



                        <div>
                            <div>
                                <label className="text-xs mb-2 block text-[var(--text-muted)]">Starter Prompts</label>
                                <div className="space-y-2">
                                    {(data.starterPrompts || []).map((prompt, index) => (
                                        <div key={index} className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                value={prompt}
                                                onChange={(e) => {
                                                    const newPrompts = [...(data.starterPrompts || [])];
                                                    newPrompts[index] = e.target.value;
                                                    handleChange('starterPrompts', newPrompts);
                                                }}
                                                className="flex-1 px-3 py-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-sm"
                                                placeholder="Enter a starter prompt..."
                                            />
                                            <button
                                                onClick={() => {
                                                    const newPrompts = (data.starterPrompts || []).filter((_, i) => i !== index);
                                                    handleChange('starterPrompts', newPrompts);
                                                }}
                                                className="p-2 rounded-lg hover:bg-white/10 text-[var(--error)]"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                            </button>
                                        </div>
                                    ))}
                                    <button
                                        onClick={() => handleChange('starterPrompts', [...(data.starterPrompts || []), ''])}
                                        className="text-xs text-[var(--accent-primary)] hover:underline flex items-center gap-1"
                                    >
                                        + Add Prompt
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-4">
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="flex items-center justify-between p-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-tertiary)]">
                                        <div>
                                            <div className="text-sm font-medium text-[var(--text-primary)]">Allow Copy</div>
                                            <div className="text-xs text-[var(--text-muted)]">Copy button</div>
                                        </div>
                                        <button
                                            onClick={() => handleChange('copyEnabled', !data.copyEnabled)}
                                            className={`relative w-10 h-6 rounded-full transition-colors ${data.copyEnabled ? 'bg-green-500' : 'bg-gray-600'}`}
                                        >
                                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${data.copyEnabled ? 'left-5' : 'left-1'}`} />
                                        </button>
                                    </div>
                                    <div className="flex items-center justify-between p-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-tertiary)]">
                                        <div>
                                            <div className="text-sm font-medium text-[var(--text-primary)]">Web Embed</div>
                                            <div className="text-xs text-[var(--text-muted)]">Public chat page</div>
                                        </div>
                                        <button
                                            onClick={() => handleChange('embedEnabled', !data.embedEnabled)}
                                            className={`relative w-10 h-6 rounded-full transition-colors ${data.embedEnabled ? 'bg-green-500' : 'bg-gray-600'}`}
                                        >
                                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${data.embedEnabled ? 'left-5' : 'left-1'}`} />
                                        </button>
                                    </div>
                                    <div className="flex items-center justify-between p-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-tertiary)]">
                                        <div>
                                            <div className="text-sm font-medium text-[var(--text-primary)]">No External</div>
                                            <div className="text-xs text-[var(--text-muted)]">No integrations/search</div>
                                        </div>
                                        <button
                                            onClick={() => handleChange('disableExternalTools', !data.disableExternalTools)}
                                            className={`relative w-10 h-6 rounded-full transition-colors ${data.disableExternalTools ? 'bg-amber-500' : 'bg-gray-600'}`}
                                        >
                                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${data.disableExternalTools ? 'left-5' : 'left-1'}`} />
                                        </button>
                                    </div>
                                </div>

                                {/* Embed URL Info Card */}
                                {data.embedEnabled && agentId && (
                                    <div className="p-4 rounded-xl border border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/5 space-y-3">
                                        <div className="flex items-center gap-2 text-sm font-medium text-[var(--accent-primary)]">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                                            Embed Settings
                                        </div>
                                        <div>
                                            <label className="text-xs text-[var(--text-muted)] mb-1 block">Public URL</label>
                                            <div className="flex gap-2">
                                                <input
                                                    readOnly
                                                    value={`${window.location.origin}/chat/${agentId}`}
                                                    className="flex-1 text-xs font-mono px-3 py-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-secondary)]"
                                                />
                                                <button
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(`${window.location.origin}/chat/${agentId}`);
                                                    }}
                                                    className="px-3 py-2 text-xs rounded-lg bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary-hover)] transition-colors"
                                                >
                                                    Copy
                                                </button>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-xs text-[var(--text-muted)] mb-1 block">Iframe Embed</label>
                                            <div className="flex gap-2">
                                                <input
                                                    readOnly
                                                    value={`<iframe src="${window.location.origin}/chat/${agentId}" width="400" height="600" style="border:none;border-radius:12px;"></iframe>`}
                                                    className="flex-1 text-xs font-mono px-3 py-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-secondary)]"
                                                />
                                                <button
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(`<iframe src="${window.location.origin}/chat/${agentId}" width="400" height="600" style="border:none;border-radius:12px;"></iframe>`);
                                                    }}
                                                    className="px-3 py-2 text-xs rounded-lg bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary-hover)] transition-colors"
                                                >
                                                    Copy
                                                </button>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-xs text-[var(--text-muted)] mb-1 block">Chat Bubble Widget</label>
                                            <p className="text-[10px] text-[var(--text-muted)] mb-2">A floating chat button that opens the agent in a popup. Paste this before {'</body>'}.</p>
                                            <div className="flex gap-2">
                                                <textarea
                                                    readOnly
                                                    rows={4}
                                                    value={`<!-- Bee Flow Chat Widget -->\n<script>\n(function(){\n  var d=document,s=d.createElement('style'),b=d.createElement('div');\n  s.textContent='#bf-bubble{position:fixed;bottom:24px;right:24px;width:60px;height:60px;border-radius:50%;background:linear-gradient(135deg,#f5a623,#f7c948);border:none;cursor:pointer;box-shadow:0 4px 20px rgba(245,166,35,.4);display:flex;align-items:center;justify-content:center;font-size:28px;transition:transform .3s,box-shadow .3s;z-index:10001}#bf-bubble:hover{transform:scale(1.1);box-shadow:0 6px 28px rgba(245,166,35,.55)}#bf-bubble.open{background:linear-gradient(135deg,#e74c3c,#c0392b);box-shadow:0 4px 20px rgba(231,76,60,.4)}#bf-window{position:fixed;bottom:100px;right:24px;width:400px;height:600px;border-radius:16px;overflow:hidden;box-shadow:0 12px 48px rgba(0,0,0,.15);opacity:0;transform:translateY(20px) scale(.95);pointer-events:none;transition:opacity .3s,transform .3s;z-index:10000}#bf-window.open{opacity:1;transform:translateY(0) scale(1);pointer-events:auto}#bf-window iframe{width:100%;height:100%;border:none}';\n  d.head.appendChild(s);\n  b.innerHTML='<div id="bf-window"><iframe src="${window.location.origin}/chat/${agentId}"></iframe></div><button id="bf-bubble" onclick="var w=document.getElementById(\\'bf-window\\'),b=document.getElementById(\\'bf-bubble\\');b.classList.toggle(\\'open\\');w.classList.toggle(\\'open\\');b.textContent=b.classList.contains(\\'open\\')?\\'\u2715\\':\\'🐝\\'">🐝</button>';\n  d.body.appendChild(b);\n})();\n</script>`}
                                                    className="flex-1 text-xs font-mono px-3 py-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-secondary)] resize-none"
                                                />
                                                <button
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(`<!-- Bee Flow Chat Widget -->\n<script>\n(function(){\n  var d=document,s=d.createElement('style'),b=d.createElement('div');\n  s.textContent='#bf-bubble{position:fixed;bottom:24px;right:24px;width:60px;height:60px;border-radius:50%;background:linear-gradient(135deg,#f5a623,#f7c948);border:none;cursor:pointer;box-shadow:0 4px 20px rgba(245,166,35,.4);display:flex;align-items:center;justify-content:center;font-size:28px;transition:transform .3s,box-shadow .3s;z-index:10001}#bf-bubble:hover{transform:scale(1.1);box-shadow:0 6px 28px rgba(245,166,35,.55)}#bf-bubble.open{background:linear-gradient(135deg,#e74c3c,#c0392b);box-shadow:0 4px 20px rgba(231,76,60,.4)}#bf-window{position:fixed;bottom:100px;right:24px;width:400px;height:600px;border-radius:16px;overflow:hidden;box-shadow:0 12px 48px rgba(0,0,0,.15);opacity:0;transform:translateY(20px) scale(.95);pointer-events:none;transition:opacity .3s,transform .3s;z-index:10000}#bf-window.open{opacity:1;transform:translateY(0) scale(1);pointer-events:auto}#bf-window iframe{width:100%;height:100%;border:none}';\n  d.head.appendChild(s);\n  b.innerHTML='<div id="bf-window"><iframe src="${window.location.origin}/chat/${agentId}"></iframe></div><button id="bf-bubble" onclick="var w=document.getElementById(\\'bf-window\\'),b=document.getElementById(\\'bf-bubble\\');b.classList.toggle(\\'open\\');w.classList.toggle(\\'open\\');b.textContent=b.classList.contains(\\'open\\')?\\'\u2715\\':\\'🐝\\'">\ud83d\udc1d</button>';\n  d.body.appendChild(b);\n})();\n</script>`);
                                                    }}
                                                    className="px-3 py-2 text-xs rounded-lg bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary-hover)] transition-colors self-start"
                                                >
                                                    Copy
                                                </button>
                                            </div>
                                        </div>
                                        <p className="text-[10px] text-[var(--text-muted)]">Agent must be Published for the embed link to work.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Organization & Sharing */}
                        {organizations.length > 0 && (
                            <div className="p-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-tertiary)] space-y-3">
                                <div className="text-sm font-medium text-[var(--text-primary)] flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                                    Organization & Sharing
                                </div>
                                <div>
                                    <label className="text-xs mb-1 block text-[var(--text-muted)]">Organization</label>
                                    <select
                                        value={data.organizationId || ''}
                                        onChange={e => {
                                            handleChange('organizationId', e.target.value);
                                            // Clear shared groups when org changes
                                            if (e.target.value !== data.organizationId) {
                                                handleChange('sharedGroups', []);
                                            }
                                        }}
                                        className="w-full px-3 py-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm outline-none"
                                    >
                                        <option value="">None (Global — visible to all)</option>
                                        {organizations.map(org => (
                                            <option key={org.id} value={org.id}>{org.name}</option>
                                        ))}
                                    </select>
                                </div>
                                {data.organizationId && (() => {
                                    const orgGroups = groups.filter(g => g.organizationId === data.organizationId);
                                    if (orgGroups.length === 0) return null;
                                    return (
                                        <div>
                                            <label className="text-xs mb-2 block text-[var(--text-muted)]">Share with specific groups (leave empty for all org members)</label>
                                            <div className="space-y-1 max-h-32 overflow-auto">
                                                {orgGroups.map(group => (
                                                    <label key={group.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={(data.sharedGroups || []).includes(group.id)}
                                                            onChange={e => {
                                                                const current = data.sharedGroups || [];
                                                                const updated = e.target.checked
                                                                    ? [...current, group.id]
                                                                    : current.filter(id => id !== group.id);
                                                                handleChange('sharedGroups', updated);
                                                            }}
                                                            className="rounded"
                                                        />
                                                        <span className="text-sm text-[var(--text-primary)]">{group.name}</span>
                                                        {group.description && <span className="text-xs text-[var(--text-muted)]">— {group.description}</span>}
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        )}

                        {/* Version History (existing agents only) */}
                        {agentId && (
                            <VersionHistory agentId={agentId} onRestore={() => window.location.reload()} />
                        )}
                    </div>
                )}

                {/* KNOWLEDGE TAB */}
                {activeTab === 'knowledge' && hasKnowledge && (
                    <KnowledgePanel agentId={agentId} API_BASE={API_BASE} strictKnowledge={data.strictKnowledge} onStrictKnowledgeChange={(val) => onChange('strictKnowledge', val)} includeSourceReferences={data.includeSourceReferences} onIncludeSourceReferencesChange={(val) => onChange('includeSourceReferences', val)} />
                )}

                {/* SKILLS TAB */}
                {activeTab === 'skills' && hasSkills && (
                    <AgentSkillsTab
                        user={user}
                        attachedSkillIds={Array.isArray(data?.config?.attachedSkillIds) ? data.config.attachedSkillIds : []}
                        onChangeAttached={(nextIds) => onChange('config', { ...(data.config || {}), attachedSkillIds: nextIds })}
                    />
                )}

            </div>
        </div>
    );
};

export default AgentEditorUI;
