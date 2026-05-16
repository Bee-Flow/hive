import React, { useMemo } from 'react';
import ModelTierSelector from './ModelTierSelector';
import { ALL_PROMPTS, WELCOME_MESSAGES } from '../utils/prompts';
import { useTranslation } from '../hooks/useTranslation';

const DirectChatWelcome = ({ tiers, selectedTier, onTierChange, onPromptClick, children }) => {
    const { t } = useTranslation();

    const welcomeMsg = useMemo(() => {
        return WELCOME_MESSAGES[Math.floor(Math.random() * WELCOME_MESSAGES.length)];
    }, []);

    const prompts = useMemo(() => {
        // Randomly pick 3 prompts from the list of 100
        return [...ALL_PROMPTS].sort(() => 0.5 - Math.random()).slice(0, 3);
    }, []);

    return (
        <div className="flex flex-col items-center justify-center p-4 sm:p-8 max-w-4xl mx-auto w-full">
            <h1 className="text-center" style={{
                fontSize: 'clamp(20px, 5vw, 32px)', fontWeight: 600,
                color: 'var(--text-primary)', marginBottom: '20px',
                letterSpacing: '-0.02em'
            }}>
                {t(welcomeMsg.i18nKey)}
            </h1>

            {/* Render passing InputArea here */}
            {children && (
                <div className="w-full mb-6">
                    {children}
                </div>
            )}

            <div className="w-full flex flex-wrap justify-center gap-2 mb-8">
                {prompts.map((prompt, i) => (
                    <button
                        key={i}
                        onClick={() => onPromptClick && onPromptClick(t(prompt.i18nKey))}
                        data-surface="subtle"
                        className="text-left px-3.5 py-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-card)] hover:bg-[var(--bg-secondary)] transition-all flex items-center gap-2 group whitespace-nowrap"
                    >
                        <span className="text-sm group-hover:scale-110 transition-transform">{prompt.icon}</span>
                        <span className="text-[12.5px] font-medium text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
                            {t(prompt.i18nKey)}
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );
};

export default DirectChatWelcome;
