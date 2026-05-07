import React from 'react';
import { MessageSquare, Sparkles } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import { isImageAvatar, resolveAvatarSrc, pickAgentAvatar } from '../utils/agentAvatar';

const WelcomeScreen = ({ agent, onSendMessage, children }) => {
    const { t } = useTranslation();
    // Parse starter prompts (handle string or array)
    const starterPrompts = Array.isArray(agent?.starter_prompts)
        ? agent.starter_prompts
        : (typeof agent?.starter_prompts === 'string' ? JSON.parse(agent.starter_prompts || '[]') : []);

    const avatar = pickAgentAvatar(agent);
    return (
        <div className="flex flex-col items-center justify-center max-w-3xl mx-auto p-8 text-center animate-fade-in w-full">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4 overflow-hidden">
                {isImageAvatar(avatar) ? (
                    <img src={resolveAvatarSrc(avatar)} alt="" className="w-full h-full object-cover" />
                ) : avatar ? (
                    <span className="text-3xl filter drop-shadow-md">{avatar}</span>
                ) : (
                    <span className="text-2xl font-bold">{agent?.name?.[0]?.toUpperCase()}</span>
                )}
            </div>

            <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2 tracking-tight">
                {agent?.name}
            </h1>

            <p className="text-[var(--text-secondary)] mb-8 max-w-lg leading-relaxed text-sm">
                {agent?.description || t('chat.default_agent_description')}
            </p>

            {/* Render passing InputArea here */}
            {children && (
                <div className="w-full mb-6">
                    {children}
                </div>
            )}

            {starterPrompts.length > 0 ? (
                <div className="w-full flex flex-wrap justify-center gap-2 mb-8">
                    {starterPrompts.map((prompt, idx) => (
                        <button
                            key={idx}
                            onClick={() => onSendMessage?.(prompt)}
                            className="text-left px-3.5 py-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-card)] hover:bg-[var(--bg-secondary)] hover:border-purple-500/30 transition-all flex items-center gap-2 group whitespace-nowrap"
                        >
                            <span className="text-[12.5px] font-medium text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
                                {prompt}
                            </span>
                        </button>
                    ))}
                </div>
            ) : null}
        </div>
    );
};

export default WelcomeScreen;
