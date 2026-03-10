import { CAPABILITIES } from '../constants';

/**
 * Capability toggle helpers (check/toggle capabilities embedded in system prompt).
 */
export default function useCapabilities(state) {
    const { systemPrompt, setSystemPrompt, setWorkspaceEnabled } = state;

    const checkCapability = (prompt, key) => {
        return prompt.includes(`<!-- CAPABILITY: ${key} -->`);
    };

    const toggleCapability = (key) => {
        const cap = CAPABILITIES[key];
        if (!cap) return;

        const hasCapability = checkCapability(systemPrompt, key);
        let newPrompt = systemPrompt;

        if (hasCapability) {
            const regex = new RegExp(`\\n*<!-- CAPABILITY: ${key} -->[\\s\\S]*?<!-- /CAPABILITY -->`, 'g');
            newPrompt = newPrompt.replace(regex, '');
            if (key === 'WORKSPACE') setWorkspaceEnabled(false);
        } else {
            newPrompt += cap.instructions;
            if (key === 'WORKSPACE') setWorkspaceEnabled(true);
        }

        setSystemPrompt(newPrompt);
    };

    const componentsByCategory = (components) => components.reduce((acc, comp) => {
        const category = comp.category || 'Uncategorized';
        if (!acc[category]) acc[category] = [];
        acc[category].push(comp);
        return acc;
    }, {});

    return { checkCapability, toggleCapability, componentsByCategory };
}
