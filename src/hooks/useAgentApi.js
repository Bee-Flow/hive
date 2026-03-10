import { useState, useCallback } from 'react';
import { API_BASE, authFetch } from '../utils/helpers';

/**
 * Hook for agent-related API operations
 * Provides authenticated fetch and conversation management
 */
export const useAgentApi = (sessionToken = null) => {
    const [agents, setAgents] = useState([]);
    const [conversations, setConversations] = useState([]);
    const [loading, setLoading] = useState(false);

    // Authenticated fetch wrapper
    const authFetch = useCallback(async (url, options = {}) => {
        const fetchOptions = {
            ...options,
            headers: {
                ...options.headers,
            }
        };

        // If we have a session token from parent, add it as header
        if (sessionToken) {
            fetchOptions.headers['X-Session-Token'] = sessionToken;
        }

        return fetch(url, fetchOptions);
    }, [sessionToken]);

    // Fetch published agents
    const fetchAgents = useCallback(async () => {
        try {
            setLoading(true);
            const res = await authFetch(`${API_BASE}/agents/published`);
            const data = await res.json();
            if (Array.isArray(data)) {
                setAgents(data);
                return data;
            }
            return [];
        } catch (err) {
            console.error('Failed to fetch agents:', err);
            return [];
        } finally {
            setLoading(false);
        }
    }, [authFetch]);

    // Load conversations for an agent
    const loadConversations = useCallback(async (agentId) => {
        try {
            const res = await authFetch(`${API_BASE}/agents/${agentId}/conversations`);
            if (res.ok) {
                const convs = await res.json();
                setConversations(Array.isArray(convs) ? convs : []);
                return convs;
            }
        } catch (err) {
            console.error('Failed to load conversations:', err);
        }
        return [];
    }, [authFetch]);

    // Load a specific conversation with messages
    const loadConversation = useCallback(async (agentId, convId) => {
        try {
            const res = await authFetch(`${API_BASE}/agents/${agentId}/conversations/${convId}`);
            if (res.ok) {
                return await res.json();
            }
        } catch (err) {
            console.error('Failed to load conversation:', err);
        }
        return null;
    }, [authFetch]);

    // Create a new conversation
    const createConversation = useCallback(async (agentId, title = 'New Chat') => {
        try {
            const res = await authFetch(`${API_BASE}/agents/${agentId}/conversations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title })
            });
            if (res.ok) {
                const newConv = await res.json();
                await loadConversations(agentId); // Refresh list
                return newConv;
            }
        } catch (err) {
            console.error('Failed to create conversation:', err);
        }
        return null;
    }, [authFetch, loadConversations]);

    // Delete a conversation
    const deleteConversation = useCallback(async (agentId, convId) => {
        try {
            await authFetch(`${API_BASE}/agents/${agentId}/conversations/${convId}`, {
                method: 'DELETE'
            });
            await loadConversations(agentId); // Refresh list
            return true;
        } catch (err) {
            console.error('Failed to delete conversation:', err);
            return false;
        }
    }, [authFetch, loadConversations]);

    // Update thread titles for a conversation
    const updateThreadTitles = useCallback(async (agentId, convId, threadTitles) => {
        try {
            await authFetch(`${API_BASE}/agents/${agentId}/conversations/${convId}/thread-titles`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ threadTitles })
            });
            return true;
        } catch (err) {
            console.error('Failed to update thread titles:', err);
            return false;
        }
    }, [authFetch]);

    return {
        // State
        agents,
        setAgents,
        conversations,
        setConversations,
        loading,

        // Functions
        authFetch,
        fetchAgents,
        loadConversations,
        loadConversation,
        createConversation,
        deleteConversation,
        updateThreadTitles
    };
};

export default useAgentApi;
