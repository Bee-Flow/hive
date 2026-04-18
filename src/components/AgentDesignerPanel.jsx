import React, { useState, useEffect } from 'react';
import AgentEditorUI from './admin/AgentEditorUI';
import { filterVisibleModels } from '../utils/modelMeta.js';
import { API_BASE, authFetch } from '../utils/helpers';
import { useTranslation } from '../hooks/useTranslation';

/**
 * AgentDesignerPanel - Editing panel for agents within Agent Hub
 * Receives selected agent from parent, manages editing state
 */
const AgentDesignerPanel = ({
    agent,
    onClose,
    onSave,
    onDelete,
    user = null,
}) => {
    const [saving, setSaving] = useState(false);
    const { t } = useTranslation();
    const [availableModels, setAvailableModels] = useState([]);
    const [organizations, setOrganizations] = useState([]);
    const [groups, setGroups] = useState([]);
    const [categories, setCategories] = useState([]);

    // Form state object
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        avatar: '',
        systemPrompt: '',
        tools: [],
        toolParams: {},
        model: '',
        starterPrompts: [],
        workspaceEnabled: false,
        copyEnabled: true,
        isPublished: false,
        embedEnabled: false,
        organizationId: '',
        sharedGroups: [],
        categoryId: '',
        config: {},
    });

    // Load agent data when agent changes
    useEffect(() => {
        if (agent) {
            setFormData({
                name: agent.name || '',
                description: agent.description || '',
                avatar: agent.avatar || '',
                systemPrompt: agent.system_prompt || '',
                tools: agent.tools || [],
                toolParams: agent.tool_params || {},
                model: agent.model || '',
                starterPrompts: typeof agent.starter_prompts === 'string'
                    ? JSON.parse(agent.starter_prompts || '[]')
                    : (agent.starter_prompts || []),
                workspaceEnabled: agent.workspace_enabled !== 0,
                copyEnabled: agent.copy_enabled !== 0,
                isPublished: agent.is_published === 1,
                embedEnabled: agent.embed_enabled === 1,
                organizationId: agent.organization_id || '',
                sharedGroups: typeof agent.shared_groups === 'string'
                    ? (() => { try { return JSON.parse(agent.shared_groups || '[]'); } catch (_) { return []; } })()
                    : (agent.shared_groups || []),
                categoryId: agent.category_id || '',
                config: (typeof agent.config === 'string'
                    ? (() => { try { return JSON.parse(agent.config || '{}'); } catch (_) { return {}; } })()
                    : (agent.config || {})),
            });
        } else {
            // New agent
            setFormData({
                name: '',
                description: '',
                avatar: '',
                systemPrompt: 'You are a helpful AI assistant. Use the available tools when appropriate to help accomplish tasks.',
                tools: [],
                toolParams: {},
                model: '',
                starterPrompts: [],
                workspaceEnabled: false,
                copyEnabled: true,
                isPublished: false,
                embedEnabled: false,
                organizationId: '',
                sharedGroups: [],
                categoryId: '',
                config: {},
            });
        }
    }, [agent]);

    useEffect(() => {
        fetchModels();
        fetchOrgsAndGroups();
        fetchCategories();
    }, []);

    const fetchModels = async () => {
        try {
            const res = await authFetch(`${API_BASE}/agents/meta/models`);
            const data = await res.json();
            if (data.models) {
                setAvailableModels(filterVisibleModels(data.models));
            }
        } catch (err) {
            console.error('Failed to fetch models:', err);
        }
    };

    const fetchOrgsAndGroups = async () => {
        try {
            const [orgsRes, groupsRes] = await Promise.all([
                authFetch(`${API_BASE}/auth/organizations`),
                authFetch(`${API_BASE}/auth/groups`)
            ]);
            if (orgsRes.ok) {
                const orgsData = await orgsRes.json();
                setOrganizations(Array.isArray(orgsData) ? orgsData : []);
            }
            if (groupsRes.ok) {
                const groupsData = await groupsRes.json();
                setGroups(Array.isArray(groupsData) ? groupsData : []);
            }
        } catch (err) {
            console.error('Failed to fetch orgs/groups:', err);
        }
    };

    const fetchCategories = async () => {
        try {
            const res = await authFetch(`${API_BASE}/agents/categories`);
            if (res.ok) {
                const data = await res.json();
                setCategories(Array.isArray(data) ? data : []);
            }
        } catch (err) {
            console.error('Failed to fetch categories:', err);
        }
    };

    const handleCreateCategory = async (name) => {
        try {
            const res = await authFetch(`${API_BASE}/agents/categories`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });
            if (res.ok) {
                const cat = await res.json();
                setCategories(prev => [...prev, cat]);
                // Auto-select the newly created category
                setFormData(prev => ({ ...prev, categoryId: cat.id }));
            }
        } catch (err) {
            console.error('Failed to create category:', err);
        }
    };

    const togglePublish = async () => {
        if (!agent) return;

        try {
            const res = await authFetch(`${API_BASE}/agents/${agent.id}/publish`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    isPublished: !formData.isPublished,
                    sharedGroups: formData.sharedGroups || [],
                })
            });

            if (res.ok) {
                setFormData(prev => ({ ...prev, isPublished: !prev.isPublished }));
                if (onSave) onSave(); // Refresh agent list
            } else {
                const data = await res.json().catch(() => ({}));
                alert(data.error || 'Failed to update publish status.');
            }
        } catch (err) {
            console.error('Failed to toggle publish:', err);
            alert('Failed to update publish status. Please try again.');
        }
    };

    const saveAgent = async () => {
        if (!formData.name.trim()) return;
        setSaving(true);

        try {
            // Transform toolParams
            const transformedParams = {};
            for (const [toolId, params] of Object.entries(formData.toolParams || {})) {
                transformedParams[toolId] = {};
                for (const [paramName, paramConfig] of Object.entries(params)) {
                    if (paramConfig.fixed && paramConfig.value !== undefined) {
                        transformedParams[toolId][paramName] = paramConfig.value;
                    }
                }
                if (Object.keys(transformedParams[toolId]).length === 0) {
                    delete transformedParams[toolId];
                }
            }

            const body = {
                name: formData.name,
                description: formData.description,
                avatar: formData.avatar,
                systemPrompt: formData.systemPrompt,
                tools: formData.tools,
                toolParams: transformedParams,
                model: formData.model || null,
                starterPrompts: formData.starterPrompts,
                workspaceEnabled: formData.workspaceEnabled ? 1 : 0,
                copyEnabled: formData.copyEnabled,
                embedEnabled: formData.embedEnabled,
                organizationId: formData.organizationId || null,
                sharedGroups: formData.sharedGroups || [],
                categoryId: formData.categoryId || null,
                config: formData.config || {},
            };

            let savedAgent = agent;
            if (agent) {
                await authFetch(`${API_BASE}/agents/${agent.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
            } else {
                const res = await authFetch(`${API_BASE}/agents`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
                if (res.ok) {
                    savedAgent = await res.json();
                }
            }

            if (onSave) onSave(savedAgent);
        } catch (err) {
            console.error('Failed to save agent:', err);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!agent) return;
        if (!confirm(t('agent.delete_confirm'))) return;

        try {
            const res = await authFetch(`${API_BASE}/agents/${agent.id}`, {
                method: 'DELETE',
            });
            if (res.ok) {
                if (onDelete) onDelete();
            } else {
                const data = await res.json().catch(() => ({}));
                alert(data.error || 'Failed to delete agent');
            }
        } catch (err) {
            console.error('Failed to delete agent:', err);
            alert('Failed to delete agent. Please try again.');
        }
    };

    const handleFieldChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    return (
        <div className="flex flex-col h-full" style={{ background: 'var(--bg-primary)' }} data-testid="agent-designer-panel">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-secondary)' }}>
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                    </div>
                    <div>
                        <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {agent ? t('agent.edit_agent') : t('agent.create_agent')}
                        </h2>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {formData.name || t('agent.new_agent')}
                        </p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="p-2 rounded-lg hover:bg-white/10 transition-all"
                    title={t('agent.back_to_chat')}
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--text-muted)' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            {/* Editor Content */}
            <div className="flex-1 overflow-hidden">
                <AgentEditorUI
                    data={formData}
                    onChange={handleFieldChange}
                    availableModels={availableModels}
                    hasKnowledge={!!agent}
                    hasSkills={Array.isArray(user?.betaFeatures) && user.betaFeatures.includes('skills')}
                    user={user}
                    agentId={agent ? agent.id : null}
                    API_BASE={API_BASE}
                    organizations={organizations}
                    groups={groups}
                    categories={categories}
                    onCreateCategory={handleCreateCategory}
                    urlSyncKey="editTab"
                />
            </div>

            {/* Footer Actions */}
            <div className="px-4 py-3 border-t flex items-center justify-between" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-secondary)' }}>
                <div className="flex items-center gap-2">
                    {agent && (
                        <>
                            <button
                                onClick={handleDelete}
                                className="px-4 py-2 rounded-xl text-sm font-medium transition-all hover:bg-red-500/20"
                                style={{ color: 'var(--error)' }}
                                data-testid="agent-delete-btn"
                            >
                                {t('common.delete')}
                            </button>
                            <button
                                onClick={togglePublish}
                                className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-all`}
                                style={formData.isPublished ? {
                                    background: 'linear-gradient(135deg, #10b981, #059669)',
                                    color: 'white'
                                } : {
                                    background: 'var(--bg-tertiary)',
                                    color: 'var(--text-muted)'
                                }}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    {formData.isPublished ? (
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    ) : (
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                                    )}
                                </svg>
                                {formData.isPublished ? t('agent.published') : t('agent.publish')}
                            </button>
                        </>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl text-sm font-medium transition-all hover:bg-white/5"
                        style={{ color: 'var(--text-muted)' }}
                    >
                        {t('common.cancel')}
                    </button>
                    <button
                        onClick={saveAgent}
                        className="px-6 py-2 rounded-xl text-sm font-medium text-white transition-all hover:scale-[1.02]"
                        style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)' }}
                        disabled={saving || !formData.name.trim()}
                        data-testid="agent-save-btn"
                    >
                        {saving ? t('agent.saving') : agent ? t('agent.save_changes') : t('agent.create_agent')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AgentDesignerPanel;
