import { API_BASE, authFetch } from '../../../../utils/helpers';

/**
 * System Prompt Designer (AI-assisted prompt generation) — SSE streaming.
 */
export default function usePromptDesigner(state) {
    const {
        name, description, systemPrompt, setSystemPrompt,
        promptDesignerInput, setPromptDesignerInput,
        promptDesignerMessages, setPromptDesignerMessages,
        promptDesignerLoading, setPromptDesignerLoading,
        setShowPromptDesigner,
    } = state;

    const sendPromptDesignerMessage = async () => {
        if (!promptDesignerInput.trim() || promptDesignerLoading) return;

        const userMessage = promptDesignerInput.trim();
        setPromptDesignerInput('');
        setPromptDesignerMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setPromptDesignerLoading(true);

        // Add a placeholder assistant message that we'll stream into
        const assistantIdx = promptDesignerMessages.length + 1; // +1 for the user msg we just added
        setPromptDesignerMessages(prev => [...prev, { role: 'assistant', content: '', thinking: '' }]);

        try {
            const contextMessage = `Context about the agent being designed:
- Agent Name: ${name || '(not set)'}
- Description: ${description || '(not set)'}
- Current System Prompt: ${systemPrompt || '(empty)'}

User message: ${userMessage}`;

            const response = await authFetch(`${API_BASE}/agents/system/prompt-designer/stream`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: contextMessage }),
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({ error: response.statusText }));
                throw new Error(errData.error || `HTTP ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let contentSoFar = '';
            let thinkingSoFar = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });

                // Parse SSE events from buffer
                const lines = buffer.split('\n');
                buffer = lines.pop(); // Keep incomplete line in buffer

                let eventType = null;
                for (const line of lines) {
                    if (line.startsWith('event: ')) {
                        eventType = line.slice(7).trim();
                    } else if (line.startsWith('data: ') && eventType) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            if (eventType === 'content') {
                                contentSoFar += data.text;
                                setPromptDesignerMessages(prev => {
                                    const updated = [...prev];
                                    const lastMsg = updated[updated.length - 1];
                                    if (lastMsg?.role === 'assistant') {
                                        updated[updated.length - 1] = { ...lastMsg, content: contentSoFar };
                                    }
                                    return updated;
                                });
                            } else if (eventType === 'thinking') {
                                thinkingSoFar += data.text;
                                setPromptDesignerMessages(prev => {
                                    const updated = [...prev];
                                    const lastMsg = updated[updated.length - 1];
                                    if (lastMsg?.role === 'assistant') {
                                        updated[updated.length - 1] = { ...lastMsg, thinking: thinkingSoFar };
                                    }
                                    return updated;
                                });
                            } else if (eventType === 'error') {
                                contentSoFar += `\n\n❌ Error: ${data.error}`;
                                setPromptDesignerMessages(prev => {
                                    const updated = [...prev];
                                    const lastMsg = updated[updated.length - 1];
                                    if (lastMsg?.role === 'assistant') {
                                        updated[updated.length - 1] = { ...lastMsg, content: contentSoFar };
                                    }
                                    return updated;
                                });
                            }
                        } catch (e) {
                            // Ignore parse errors for partial data
                        }
                        eventType = null;
                    }
                }
            }

            // If we got no content at all, show an error
            if (!contentSoFar.trim()) {
                setPromptDesignerMessages(prev => {
                    const updated = [...prev];
                    const lastMsg = updated[updated.length - 1];
                    if (lastMsg?.role === 'assistant') {
                        updated[updated.length - 1] = { ...lastMsg, content: 'No response received.' };
                    }
                    return updated;
                });
            }

        } catch (error) {
            console.error('Prompt designer error:', error);
            setPromptDesignerMessages(prev => {
                const updated = [...prev];
                const lastMsg = updated[updated.length - 1];
                if (lastMsg?.role === 'assistant') {
                    updated[updated.length - 1] = { ...lastMsg, content: `❌ ${error.message}` };
                }
                return updated;
            });
        } finally {
            setPromptDesignerLoading(false);
        }
    };

    const applyGeneratedPrompt = (content) => {
        const codeBlockMatch = content.match(/```(?:\w*\n)?([\s\S]*?)```/);
        if (codeBlockMatch) {
            setSystemPrompt(codeBlockMatch[1].trim());
            setShowPromptDesigner(false);
        } else {
            setSystemPrompt(content);
            setShowPromptDesigner(false);
        }
    };

    return { sendPromptDesignerMessage, applyGeneratedPrompt };
}
