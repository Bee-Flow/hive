import { API_BASE, authFetch } from '../../../../utils/helpers';

/**
 * System Prompt Designer (AI-assisted prompt generation).
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

        try {
            const contextMessage = `Context about the agent being designed:
- Agent Name: ${name || '(not set)'}
- Description: ${description || '(not set)'}
- Current System Prompt: ${systemPrompt || '(empty)'}

User message: ${userMessage}`;

            const res = await authFetch(`${API_BASE}/agents/system/prompt-designer/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: contextMessage })
            });

            const data = await res.json();

            if (data.error) {
                setPromptDesignerMessages(prev => [...prev, {
                    role: 'assistant',
                    content: `❌ Error: ${data.error}`
                }]);
            } else {
                setPromptDesignerMessages(prev => [...prev, {
                    role: 'assistant',
                    content: data.message || data.response || 'No response received.'
                }]);
            }
        } catch (error) {
            console.error('Prompt designer error:', error);
            setPromptDesignerMessages(prev => [...prev, {
                role: 'assistant',
                content: `❌ Failed to connect: ${error.message}`
            }]);
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
