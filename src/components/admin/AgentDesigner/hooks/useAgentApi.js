import { useEffect, useRef } from 'react';
import { API_BASE, authFetch } from '../../../../utils/helpers';

/**
 * All API operations for the AgentDesigner: fetch, save, delete, duplicate, publish.
 * Accepts the state object from useAgentState.
 */
export default function useAgentApi(state, { systemMode, securityMode, initialAgentId }) {
    const {
        setAgents, setLoading, setComponents, setAvailableModels,
        setAvailableCollections, setModelTiers, setIntegrationStatus,
        setOrganizations, setOrgGroups, model, setModel,
        selectedAgent, setSelectedAgent, setIsCreating,
        setName, setDescription, setSystemPrompt, setSelectedTools,
        setToolParams, setIsPublished, setSharedGroups, setStarterPrompts,
        setAvatar, setAllowCopy, setEmbedEnabled, setWorkspaceEnabled,
        setEnableGuardrails, setLlamaGuardEnabled, setWebSearchGuardEnabled,

        strictKnowledge, setStrictKnowledge, setIncludeSourceReferences, setKnowledgeBaseIds,
        setEnabledIntegrations, setRegexGuardrailsEnabled, setSelectedCollections,
        setRegexScope, setGuardrailAction, setMessages, setShowChat,
        setActiveSection, name, description, systemPrompt, selectedTools,
        toolParams, starterPrompts, avatar, workspaceEnabled, embedEnabled,
        enableGuardrails, llamaGuardEnabled, webSearchGuardEnabled, disableExternalTools,
        includeSourceReferences, knowledgeBaseIds, enabledIntegrations,
        regexGuardrailsEnabled, selectedCollections, regexScope, guardrailAction,
        isPublished, sharedGroups, saving, setSaving, showPublishMenu, setShowPublishMenu,
        categoryId, setCategoryId, setAgentCategories,
        setDisableExternalTools,
    } = state;

    const initialSelectionDoneRef = useRef(false);

    const fetchAgents = async () => {
        try {
            const endpoint = securityMode
                ? `${API_BASE}/security-agents`
                : systemMode ? `${API_BASE}/agents/system` : `${API_BASE}/agents/all`;
            const res = await authFetch(endpoint);
            const data = await res.json();
            setAgents(data);

            // Auto-select agent if initialAgentId is provided (once)
            if (initialAgentId && !initialSelectionDoneRef.current) {
                initialSelectionDoneRef.current = true;
                const target = data.find(a => a.id === initialAgentId);
                if (target) {
                    // Defer to avoid state conflicts during initial mount
                    setTimeout(() => selectAgent(target), 0);
                }
            }
        } catch (err) {
            console.error('Failed to fetch agents:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchComponents = async () => {
        try {
            const res = await authFetch(`${API_BASE}/agents/meta/components`);
            const data = await res.json();
            if (Array.isArray(data)) {
                setComponents(data);
            } else {
                console.error('Components response not an array:', data);
            }
        } catch (err) {
            console.error('Failed to fetch components:', err);
        }
    };

    const fetchModels = async () => {
        try {
            const res = await authFetch(`${API_BASE}/agents/meta/models`);
            const data = await res.json();
            if (data.models) {
                const { filterVisibleModels, fetchAllowedModelsByAgentType } = await import('../../../../utils/modelMeta.js');
                const allowedConfig = await fetchAllowedModelsByAgentType();
                const visibleModels = filterVisibleModels(data.models, 'chat', allowedConfig);
                setAvailableModels(visibleModels);
                if (!model && data.currentModel) {
                    setModel(data.currentModel);
                }
            }
        } catch (err) {
            console.error('Failed to fetch models:', err);
        }
    };

    const fetchCollections = async () => {
        try {
            const res = await authFetch(`${API_BASE}/ai/config`);
            const data = await res.json();
            if (data.regexGuardrails?.collections) {
                setAvailableCollections(data.regexGuardrails.collections);
            }
        } catch (err) {
            console.error('Failed to fetch collections:', err);
        }
    };

    const fetchModelTiers = async () => {
        try {
            const res = await authFetch(`${API_BASE}/ai/config/chat-models`);
            if (res.ok) setModelTiers(await res.json());
        } catch (e) { console.error('Failed to load model tiers:', e); }
    };

    const fetchIntegrationStatus = async () => {
        try {
            const res = await authFetch(`${API_BASE}/ai/user-settings`);
            if (res.ok) setIntegrationStatus(await res.json());
        } catch (e) { console.error('Failed to load integration status:', e); }
    };

    // Initial data load
    useEffect(() => {
        fetchAgents();
        fetchComponents();
        fetchModels();
        fetchCollections();
        fetchModelTiers();
        fetchIntegrationStatus();
        // Fetch agent categories
        (async () => {
            try {
                const res = await authFetch(`${API_BASE}/agents/categories`);
                if (res.ok) {
                    const cats = await res.json();
                    setAgentCategories(Array.isArray(cats) ? cats : []);
                }
            } catch (e) { console.warn('Failed to load agent categories', e); }
        })();
    }, []);

    // Load org data for publish targets
    useEffect(() => {
        const loadOrgData = async () => {
            try {
                const [orgsRes, groupsRes] = await Promise.all([
                    authFetch(`${API_BASE}/auth/organizations`),
                    authFetch(`${API_BASE}/auth/groups`)
                ]);
                if (orgsRes.ok) setOrganizations(await orgsRes.json());
                if (groupsRes.ok) setOrgGroups(await groupsRes.json());
            } catch (err) {
                console.error('Failed to load org data:', err);
            }
        };
        loadOrgData();
    }, []);

    const selectAgent = async (agent) => {
        setSelectedAgent(agent);
        setIsCreating(false);
        if (agent) {
            try {
                const agentEndpoint = securityMode ? `${API_BASE}/security-agents/${agent.id}` : `${API_BASE}/agents/${agent.id}`;
                const freshRes = await authFetch(agentEndpoint);
                const freshAgent = await freshRes.json();
                console.log('[AgentDesigner] Loaded agent with tool_params:', freshAgent.tool_params);

                setName(freshAgent.name || '');
                setDescription(freshAgent.description || '');
                setSystemPrompt(freshAgent.system_prompt || '');
                setSelectedTools(freshAgent.tools || []);
                setToolParams(freshAgent.tool_params || {});
                setModel(freshAgent.model || '');
                setIsPublished(freshAgent.is_published === 1);
                setSharedGroups(Array.isArray(freshAgent.shared_groups) ? freshAgent.shared_groups : (() => { try { return JSON.parse(freshAgent.shared_groups || '[]'); } catch (_) { return []; } })());
                setStarterPrompts(typeof freshAgent.starter_prompts === 'string' ? JSON.parse(freshAgent.starter_prompts || '[]') : (freshAgent.starter_prompts || []));
                setAvatar(freshAgent.avatar || '🤖');
                setCategoryId(freshAgent.category_id || null);

                const config = freshAgent.config || {};
                setAllowCopy(config.allowCopy !== false);
                setEmbedEnabled(freshAgent.embed_enabled === 1);
                setWorkspaceEnabled(freshAgent.workspace_enabled !== 0);
                setEnableGuardrails(config.enableGuardrails === true);
                setLlamaGuardEnabled(config.llamaGuardEnabled === true);
                setWebSearchGuardEnabled(config.webSearchGuardEnabled === true);

                setStrictKnowledge(config.strictKnowledge === true);
                setDisableExternalTools(config.disableExternalTools === true);
                setIncludeSourceReferences(config.includeSourceReferences === true);
                setEnabledIntegrations(config.enabledIntegrations || null);
                setKnowledgeBaseIds(config.knowledge_base_ids || []);

                const rgConfig = config.regexGuardrails || {};
                setRegexGuardrailsEnabled(rgConfig.enabled === true);
                setSelectedCollections(rgConfig.collectionIds || []);
                setRegexScope(rgConfig.scope || { userInput: true, agentOutput: true, toolInput: false, toolOutput: false });
                setGuardrailAction(rgConfig.action || 'delete');
            } catch (err) {
                console.error('Failed to fetch agent details:', err);
            }
        }
        setShowChat(false);

        // Fetch conversation history
        try {
            const res = await authFetch(`${API_BASE}/agents/${agent.id}/history`);
            const history = await res.json();
            setMessages(history.filter(m => m.role === 'user' || m.role === 'assistant'));
        } catch (err) {
            setMessages([]);
        }
    };

    const createNewAgent = () => {
        setSelectedAgent(null);
        setIsCreating(true);
        setName('');
        setDescription('');
        setSystemPrompt('You are a helpful AI assistant. Use the available tools when appropriate to help accomplish tasks.');
        setSelectedTools([]);
        setModel('');
        setIsPublished(false);
        setSharedGroups([]);
        setStarterPrompts([]);
        setMessages([]);
        setShowChat(false);
        setAllowCopy(true);
        setEmbedEnabled(false);
        setWorkspaceEnabled(false);
        setEnableGuardrails(false);
        setLlamaGuardEnabled(false);
        setWebSearchGuardEnabled(false);
        setAvatar('🤖');
        setCategoryId(null);
        setStrictKnowledge(false);
        setDisableExternalTools(false);
        setIncludeSourceReferences(false);
        setKnowledgeBaseIds([]);
        setEnabledIntegrations(null);
    };

    const saveAgent = async () => {
        if (!name.trim()) return;
        setSaving(true);
        try {
            const body = {
                name, description, systemPrompt,
                tools: selectedTools, toolParams,
                model: model || null, starterPrompts, avatar,
                workspaceEnabled: workspaceEnabled ? 1 : 0,
                embedEnabled,
                config: {
                    enableGuardrails, llamaGuardEnabled, webSearchGuardEnabled,
                    strictKnowledge, includeSourceReferences,
                    disableExternalTools,
                    knowledge_base_ids: knowledgeBaseIds,
                    enabledIntegrations: enabledIntegrations || undefined,
                    regexGuardrails: {
                        enabled: regexGuardrailsEnabled,
                        collectionIds: selectedCollections,
                        scope: regexScope,
                        action: guardrailAction
                    }
                }
            };

            body.categoryId = categoryId || null;

            if (selectedAgent) {
                await authFetch(securityMode ? `${API_BASE}/security-agents/${selectedAgent.id}` : `${API_BASE}/agents/${selectedAgent.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
            } else {
                const res = await authFetch(securityMode ? `${API_BASE}/security-agents` : `${API_BASE}/agents`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
                const newAgent = await res.json();
                setSelectedAgent(newAgent);
                setIsCreating(false);
            }
            fetchAgents();
        } catch (err) {
            console.error('Failed to save agent:', err);
        } finally {
            setSaving(false);
        }
    };

    const deleteAgent = async (id) => {
        if (!confirm('Delete this agent?')) return;
        try {
            const res = await authFetch(securityMode ? `${API_BASE}/security-agents/${id}` : `${API_BASE}/agents/${id}`, { method: 'DELETE' });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                alert(data.error || 'Failed to delete agent. Please try again.');
                return;
            }
            if (selectedAgent?.id === id) {
                setSelectedAgent(null);
                setName(''); setDescription(''); setSystemPrompt('');
                setSelectedTools([]); setAllowCopy(true); setEmbedEnabled(false);
                setWorkspaceEnabled(false);
            }
            fetchAgents();
        } catch (err) {
            console.error('Failed to delete agent:', err);
            alert('Failed to delete agent. Please try again.');
        }
    };

    const duplicateAgent = async (agent) => {
        try {
            const freshRes = await authFetch(securityMode ? `${API_BASE}/security-agents/${agent.id}` : `${API_BASE}/agents/${agent.id}`);
            const freshAgent = await freshRes.json();

            setSelectedAgent(null);
            setIsCreating(true);
            setName(`${freshAgent.name || ''} (Copy)`);
            setDescription(freshAgent.description || '');
            setSystemPrompt(freshAgent.system_prompt || '');
            setSelectedTools(freshAgent.tools || []);
            setToolParams(freshAgent.tool_params || {});
            setModel(freshAgent.model || '');
            setIsPublished(false);
            setSharedGroups([]);
            setStarterPrompts(typeof freshAgent.starter_prompts === 'string' ? JSON.parse(freshAgent.starter_prompts || '[]') : (freshAgent.starter_prompts || []));
            setAvatar(freshAgent.avatar || '🤖');
            setCategoryId(freshAgent.category_id || null);

            const config = freshAgent.config || {};
            setAllowCopy(config.allowCopy !== false);
            setEmbedEnabled(freshAgent.embed_enabled === 1);
            setWorkspaceEnabled(freshAgent.workspace_enabled !== 0);
            setEnableGuardrails(config.enableGuardrails === true);
            setLlamaGuardEnabled(config.llamaGuardEnabled === true);
            setWebSearchGuardEnabled(config.webSearchGuardEnabled === true);

            setStrictKnowledge(config.strictKnowledge === true);
            setDisableExternalTools(config.disableExternalTools === true);
            setIncludeSourceReferences(config.includeSourceReferences === true);
            setKnowledgeBaseIds(config.knowledge_base_ids || []);
            setEnabledIntegrations(config.enabledIntegrations || null);

            const rgConfig = config.regexGuardrails || {};
            setRegexGuardrailsEnabled(rgConfig.enabled === true);
            setSelectedCollections(rgConfig.collectionIds || []);
            setRegexScope(rgConfig.scope || { userInput: true, agentOutput: true, toolInput: false, toolOutput: false });
            setGuardrailAction(rgConfig.action || 'delete');

            setMessages([]);
            setShowChat(false);
            setActiveSection('identity');
        } catch (err) {
            console.error('Failed to duplicate agent:', err);
        }
    };

    // Send explicit (isPublished, groups) to the publish endpoint. The
    // togglePublish wrapper keeps the legacy "no args = flip" semantics for
    // older callsites; the menu uses setPublishState directly so the user
    // can switch between Personal / Org / Specific Groups in one click.
    const setPublishState = async (nextPublished, nextGroups = []) => {
        if (!selectedAgent) return;
        const groups = nextPublished ? (Array.isArray(nextGroups) ? nextGroups : []) : [];
        try {
            const res = await authFetch(securityMode ? `${API_BASE}/security-agents/${selectedAgent.id}/publish` : `${API_BASE}/agents/${selectedAgent.id}/publish`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isPublished: nextPublished, sharedGroups: groups })
            });

            if (res.ok) {
                setIsPublished(nextPublished);
                setSharedGroups(groups);
                setShowPublishMenu(false);
                fetchAgents();
            } else {
                const data = await res.json().catch(() => ({}));
                const msg = data.error || `Failed to publish agent (${res.status})`;
                console.error('Failed to toggle publish:', msg);
                alert(msg);
            }
        } catch (err) {
            console.error('Failed to toggle publish:', err);
            alert('Failed to publish agent. Please try again.');
        }
    };
    const togglePublish = (targetGroups = undefined) => {
        const nextPublished = targetGroups !== undefined ? true : !isPublished;
        const nextGroups = targetGroups !== undefined ? targetGroups : sharedGroups;
        return setPublishState(nextPublished, nextGroups);
    };

    const toggleTool = (componentId) => {
        setSelectedTools(prev =>
            prev.includes(componentId)
                ? prev.filter(id => id !== componentId)
                : [...prev, componentId]
        );
    };

    return {
        fetchAgents, selectAgent, createNewAgent, saveAgent,
        deleteAgent, duplicateAgent, togglePublish, setPublishState, toggleTool,
    };
}
