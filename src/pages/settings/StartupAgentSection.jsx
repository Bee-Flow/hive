import React from 'react';
import { useTranslation } from '../../hooks/useTranslation';

// ── macOS-style radio row ─────────────────────────────────────────────────────
const RadioRow = ({ value, currentValue, onChange, label, description, last = false }) => {
    const isSelected = currentValue === value;
    return (
        <label
            className="flex items-center px-5 py-4 cursor-pointer transition-colors gap-4"
            style={{
                background: 'var(--bg-secondary)',
                borderBottom: last ? 'none' : '1px solid var(--border-subtle)',
            }}
            onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
            onMouseLeave={e => e.currentTarget.style.background = isSelected ? 'var(--bg-secondary)' : 'var(--bg-secondary)'}
        >
            <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-black">{label}</p>
                {description && <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{description}</p>}
            </div>
            {/* macOS-style radio circle on right */}
            <div
                className="flex-shrink-0 rounded-full border-2 flex items-center justify-center transition-all"
                style={{
                    borderColor: isSelected ? 'var(--accent-primary)' : 'var(--border-default)',
                    width: '18px', height: '18px', minWidth: '18px',
                    background: isSelected ? 'var(--accent-primary)' : 'transparent',
                }}
            >
                {isSelected && <div className="rounded-full bg-white" style={{ width: '7px', height: '7px' }} />}
            </div>
            <input type="radio" name="defaultAgentMode" value={value} checked={isSelected} onChange={onChange} className="sr-only" />
        </label>
    );
};

const StartupAgentSection = ({ defaultAgentMode, setDefaultAgentMode, defaultAgentId, setDefaultAgentId, agents }) => {
    const { t } = useTranslation();
    const showAgentSelect = defaultAgentMode === 'specific';

    return (
        <div className="space-y-6">
            <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-widest px-1 mb-2" style={{ color: 'var(--text-muted)' }}>
                    Startup
                </p>

                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
                    {/* Header row */}
                    <div className="flex items-center gap-3 px-5 py-4" style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)' }}>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(34,197,94,0.10)' }}>
                            <svg style={{ color: '#059669', width: '15px', height: '15px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-[13px] font-medium text-black">{t('settings.startup_agent')}</p>
                            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{t('settings.startup_agent_desc')}</p>
                        </div>
                    </div>

                    {/* Radio rows */}
                    <RadioRow
                        value="last-used"
                        currentValue={defaultAgentMode}
                        onChange={e => setDefaultAgentMode(e.target.value)}
                        label={t('settings.continue_where_left')}
                        description={t('settings.continue_where_left_desc')}
                    />
                    <RadioRow
                        value="specific"
                        currentValue={defaultAgentMode}
                        onChange={e => setDefaultAgentMode(e.target.value)}
                        label={t('settings.always_open_specific')}
                        description={t('settings.always_open_specific_desc')}
                    />
                    <RadioRow
                        value="direct-chat"
                        currentValue={defaultAgentMode}
                        onChange={e => setDefaultAgentMode(e.target.value)}
                        label={t('settings.start_direct_chat')}
                        description={t('settings.start_direct_chat_desc')}
                        last={!showAgentSelect}
                    />

                    {/* Agent selector — only when mode = specific */}
                    {showAgentSelect && (
                        <div className="px-5 py-4" style={{ background: 'var(--bg-secondary)' }}>
                            <p className="text-[11px] font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Select agent</p>
                            <select
                                value={defaultAgentId}
                                onChange={e => setDefaultAgentId(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border outline-none focus:border-[var(--accent-primary)] transition-colors text-[13px]"
                                style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', background: 'var(--bg-primary)' }}
                            >
                                <option value="">{t('settings.select_agent')}</option>
                                {agents.map(agent => (
                                    <option key={agent.id} value={agent.id}>{agent.name}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StartupAgentSection;
