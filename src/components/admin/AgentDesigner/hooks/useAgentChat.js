import { useEffect } from 'react';
import { API_BASE, authFetch } from '../../../../utils/helpers';

/**
 * Chat test functionality for the AgentDesigner.
 */
export default function useAgentChat(state) {
    const {
        chatInput, setChatInput, chatLoading, setChatLoading,
        messages, setMessages, selectedAgent, chatEndRef,
    } = state;

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const sendMessage = async () => {
        if (!chatInput.trim() || !selectedAgent || chatLoading) return;

        const userMessage = chatInput.trim();
        setChatInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setChatLoading(true);

        try {
            const res = await authFetch(`${API_BASE}/agents/${selectedAgent.id}/chat/stream`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: userMessage })
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || 'Failed to send message');
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let assistantMessage = '';
            let toolMessages = [];

            setMessages(prev => [...prev, { role: 'assistant', content: '...' }]);

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n\n');
                buffer = lines.pop() || '';

                for (const chunk of lines) {
                    const eventMatch = chunk.match(/event: (\w+)/);
                    const dataMatch = chunk.match(/data: (.+)/);

                    if (eventMatch && dataMatch) {
                        const eventType = eventMatch[1];
                        try {
                            const data = JSON.parse(dataMatch[1]);

                            if (eventType === 'content') {
                                assistantMessage += data.text;
                                setMessages(prev => {
                                    const updated = [...prev];
                                    updated[updated.length - 1] = { role: 'assistant', content: assistantMessage };
                                    return updated;
                                });
                            } else if (eventType === 'tool_start') {
                                toolMessages.push(`🔧 Calling **${data.name}**(${JSON.stringify(data.args).slice(0, 100)}...)`);
                                setMessages(prev => {
                                    const updated = [...prev];
                                    updated.splice(updated.length - 1, 0, { role: 'tool', content: toolMessages.join('\n') });
                                    return updated;
                                });
                            } else if (eventType === 'tool_end') {
                                const lastIdx = toolMessages.length - 1;
                                toolMessages[lastIdx] = `🔧 **${data.name}** → ${JSON.stringify(data.result).slice(0, 150)}...`;
                                setMessages(prev => {
                                    const updated = [...prev];
                                    const toolIdx = updated.findIndex(m => m.role === 'tool' && m.content.includes(data.name));
                                    if (toolIdx >= 0) {
                                        updated[toolIdx] = { role: 'tool', content: toolMessages.join('\n') };
                                    }
                                    return updated;
                                });
                            } else if (eventType === 'done') {
                                if (data.message) {
                                    setMessages(prev => {
                                        const updated = [...prev];
                                        updated[updated.length - 1] = { role: 'assistant', content: data.message };
                                        return updated;
                                    });
                                }
                            } else if (eventType === 'guardrail_violation') {
                                setMessages(prev => {
                                    const updated = [...prev];
                                    updated[updated.length - 1] = {
                                        role: 'assistant',
                                        content: `🛑 Blocked by Guardrails (${data.rules.join(', ')})`
                                    };
                                    return updated;
                                });
                                setTimeout(() => {
                                    setMessages(prev => {
                                        const updated = [...prev];
                                        if (updated.length >= 2 && updated[updated.length - 1].content.includes('Blocked by Guardrails')) {
                                            return updated.slice(0, -2);
                                        }
                                        return updated;
                                    });
                                }, (data.autoDeleteSeconds || 3) * 1000);
                            } else if (eventType === 'error') {
                                console.error('[Agent Error/Guardrail]', data.error);
                                if (data.outcome) console.log('[LlamaGuard Raw Outcome]', data.outcome);
                                if (data.codes) console.log('[LlamaGuard Codes]', data.codes);
                                setMessages(prev => {
                                    const updated = [...prev];
                                    updated[updated.length - 1] = { role: 'assistant', content: `Error: ${data.error}` };
                                    return updated;
                                });
                            }
                        } catch (e) {
                            // Parse error, skip
                        }
                    }
                }
            }
        } catch (err) {
            setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
        } finally {
            setChatLoading(false);
        }
    };

    const clearHistory = async () => {
        if (!selectedAgent) return;
        try {
            await authFetch(`${API_BASE}/agents/${selectedAgent.id}/history`, { method: 'DELETE' });
            setMessages([]);
        } catch (err) {
            console.error('Failed to clear history:', err);
        }
    };

    return { sendMessage, clearHistory };
}
