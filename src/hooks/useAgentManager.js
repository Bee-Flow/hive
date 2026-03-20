import { useState, useEffect } from 'react';
import { API_BASE, authFetch } from '../utils/helpers';
import { filterVisibleModels, fetchAllowedModelsByAgentType } from '../utils/modelMeta.js';

/**
 * Custom hook that encapsulates the identical CRUD pattern shared by
 * BrowserAgentManager, TerminalAgentManager, SwarmManager, and GroupChatManager.
 *
 * @param {string} endpoint    - API endpoint path, e.g. '/browser-agents' or '/terminal-agents'
 * @param {string} agentType   - Agent type for model filtering: 'browser' | 'terminal' | 'swarm' | 'chat'
 * @param {object} defaultAgent - Default values when creating a new agent
 * @returns {object} All state and actions needed by the manager page
 */
export default function useAgentManager(endpoint, agentType, defaultAgent) {
    const [agents, setAgents] = useState([]);
    const [selected, setSelected] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [availableModels, setAvailableModels] = useState([]);
    const [activeSection, setActiveSection] = useState('identity');
    const [isCreating, setIsCreating] = useState(false);

    // Load agents and models on mount
    useEffect(() => {
        Promise.all([
            authFetch(`${API_BASE}${endpoint}`).then(r => r.json()),
            authFetch(`${API_BASE}/agents/meta/models`).then(r => r.json()).catch(() => ({ models: [] })),
            fetchAllowedModelsByAgentType()
        ]).then(([data, modelData, allowedConfig]) => {
            setAgents(Array.isArray(data) ? data : []);
            if (modelData.models) {
                setAvailableModels(filterVisibleModels(modelData.models, agentType, allowedConfig));
            }
            setLoading(false);
        }).catch(err => { console.error(err); setLoading(false); });
    }, [endpoint, agentType]);

    const selectAgent = (agent) => {
        if (dirty && !confirm('Discard unsaved changes?')) return;
        setSelected(JSON.parse(JSON.stringify(agent)));
        setDirty(false);
        setIsCreating(false);
        setActiveSection('identity');
    };

    const updateSelected = (field, value) => {
        setSelected(prev => ({ ...prev, [field]: value }));
        setDirty(true);
    };

    const updateConfig = (field, value) => {
        setSelected(prev => ({
            ...prev,
            config: { ...(prev.config || {}), [field]: value }
        }));
        setDirty(true);
    };

    const saveAgent = async () => {
        if (!selected) return;
        setSaving(true);
        try {
            const isNew = isCreating || !agents.find(a => a.id === selected.id);
            const url = isNew ? `${API_BASE}${endpoint}` : `${API_BASE}${endpoint}/${selected.id}`;
            const method = isNew ? 'POST' : 'PUT';
            const res = await authFetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(selected)
            });
            const saved = await res.json();
            setAgents(prev => {
                const idx = prev.findIndex(a => a.id === saved.id);
                if (idx >= 0) return prev.map(a => a.id === saved.id ? saved : a);
                return [...prev, saved];
            });
            setSelected(JSON.parse(JSON.stringify(saved)));
            setDirty(false);
            setIsCreating(false);
        } catch (err) { console.error('Save error:', err); }
        setSaving(false);
    };

    const deleteAgent = async (id) => {
        if (!confirm('Delete this agent?')) return;
        try {
            const res = await authFetch(`${API_BASE}${endpoint}/${id}`, { method: 'DELETE' });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                alert(data.error || 'Failed to delete agent. Please try again.');
                return;
            }
            setAgents(prev => prev.filter(a => a.id !== id));
            if (selected?.id === id) { setSelected(null); setIsCreating(false); }
        } catch (err) {
            console.error('Delete error:', err);
            alert('Failed to delete agent. Please try again.');
        }
    };

    const duplicateAgent = (agent) => {
        if (dirty && !confirm('Discard unsaved changes?')) return;
        const clone = JSON.parse(JSON.stringify(agent));
        delete clone.id;
        clone.name = `${clone.name} (Copy)`;
        setSelected(clone);
        setIsCreating(true);
        setDirty(true);
        setActiveSection('identity');
    };

    const createAgent = () => {
        if (dirty && !confirm('Discard unsaved changes?')) return;
        setIsCreating(true);
        setSelected(JSON.parse(JSON.stringify(defaultAgent)));
        setDirty(true);
        setActiveSection('identity');
    };

    return {
        // State
        agents,
        selected,
        loading,
        saving,
        dirty,
        availableModels,
        activeSection,
        isCreating,
        // Actions
        selectAgent,
        updateSelected,
        updateConfig,
        saveAgent,
        deleteAgent,
        duplicateAgent,
        createAgent,
        setActiveSection,
        setAgents,
        setSelected,
        setDirty,
        setIsCreating,
    };
}
