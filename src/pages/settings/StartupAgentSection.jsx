import React from 'react';
import { useTranslation } from '../../hooks/useTranslation';

const RadioOption = ({ value, currentValue, onChange, label, description }) => {
    const isSelected = currentValue === value;
    return (
        <label
            className="flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all"
            style={{
                background: isSelected ? 'rgba(99, 102, 241, 0.06)' : 'transparent',
                border: `1px solid ${isSelected ? 'rgba(99,102,241,0.3)' : 'var(--border-subtle)'}`,
            }}
        >
            <div
                className="flex-shrink-0 mt-0.5 rounded-full border-2 flex items-center justify-center transition-all"
                style={{
                    borderColor: isSelected ? 'var(--accent-primary)' : 'var(--text-muted)',
                    width: '16px', height: '16px', minWidth: '16px',
                }}
            >
                {isSelected && (
                    <div className="rounded-full" style={{ background: 'var(--accent-primary)', width: '8px', height: '8px' }} />
                )}
            </div>
            <input type="radio" name="defaultAgentMode" value={value} checked={isSelected} onChange={onChange} className="sr-only" />
            <div>
                <span className="text-sm font-medium block" style={{ color: 'var(--text-primary)' }}>{label}</span>
                {description && <span className="text-xs block mt-0.5" style={{ color: 'var(--text-muted)' }}>{description}</span>}
            </div>
        </label>
    );
};

const StartupAgentSection = ({ defaultAgentMode, setDefaultAgentMode, defaultAgentId, setDefaultAgentId, agents }) => {
    const { t } = useTranslation();
    return (
        <section>
            <h2 className="text-[11px] font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>
                {t('settings.preferences')}
            </h2>

            <div className="flex items-center gap-2.5 mb-3">
                <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(34, 197, 94, 0.10)' }}>
                    <svg style={{ color: '#4ade80', width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                </div>
                <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{t('settings.startup_agent')}</p>
                    <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{t('settings.startup_agent_desc')}</p>
                </div>
            </div>

            <div className="space-y-1.5 ml-[38px]">
                <RadioOption
                    value="last-used"
                    currentValue={defaultAgentMode}
                    onChange={e => setDefaultAgentMode(e.target.value)}
                    label={t('settings.continue_where_left')}
                    description={t('settings.continue_where_left_desc')}
                />
                <RadioOption
                    value="specific"
                    currentValue={defaultAgentMode}
                    onChange={e => setDefaultAgentMode(e.target.value)}
                    label={t('settings.always_open_specific')}
                    description={t('settings.always_open_specific_desc')}
                />
                <RadioOption
                    value="direct-chat"
                    currentValue={defaultAgentMode}
                    onChange={e => setDefaultAgentMode(e.target.value)}
                    label={t('settings.start_direct_chat')}
                    description={t('settings.start_direct_chat_desc')}
                />

                {defaultAgentMode === 'specific' && (
                    <div className="pt-1">
                        <select
                            value={defaultAgentId}
                            onChange={e => setDefaultAgentId(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border bg-transparent outline-none focus:border-[var(--accent-primary)] transition-colors text-sm"
                            style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', background: 'var(--bg-secondary)' }}
                        >
                            <option value="">{t('settings.select_agent')}</option>
                            {agents.map(agent => (
                                <option key={agent.id} value={agent.id}>{agent.name}</option>
                            ))}
                        </select>
                    </div>
                )}
            </div>
        </section>
    );
};

export default StartupAgentSection;
