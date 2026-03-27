import React, { useState, useEffect, useRef } from 'react';
import AvatarPicker from './AvatarPicker';
import { useTranslation } from '../../hooks/useTranslation';
import { Globe, Check, ChevronDown } from 'lucide-react';
import { API_BASE, authFetch } from '../../utils/helpers';

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

// ── Language Settings ─────────────────────────────────────────────────────────
const LanguageSettingsSection = () => {
    const { locale, setLocale, t } = useTranslation();
    const [locales, setLocales] = useState([]);
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        authFetch(`${API_BASE}/api/languages/user/locales`)
            .then(r => r.json())
            .then(data => { if (Array.isArray(data)) setLocales(data); })
            .catch(() => {});
    }, []);

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    if (locales.length <= 1) return null;

    const currentLocale = locales.find(l => l.code === locale) || { code: locale, name: locale };

    return (
        <div className="space-y-1.5 mt-6">
            <p className="text-[11px] font-semibold uppercase tracking-widest px-1 mb-2" style={{ color: 'var(--text-muted)' }}>Language</p>
            <div className="rounded-xl" style={{ border: '1px solid var(--border-subtle)' }}>
                <div className="px-5 py-3.5" style={{ background: 'var(--bg-secondary)', borderRadius: '0.75rem' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(59,130,246,0.1)' }}>
                            <Globe className="w-4 h-4" style={{ color: '#3b82f6' }} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>Interface Language</p>
                            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Choose the language for the BeeFlow interface</p>
                        </div>
                        <div className="relative" ref={ref}>
                            <button
                                onClick={() => setOpen(v => !v)}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[13px] transition-colors"
                                style={{ background: 'var(--bg-primary)', borderColor: open ? 'var(--accent-primary)' : 'var(--border-default)', color: 'var(--text-primary)' }}
                            >
                                <span>{currentLocale.name}</span>
                                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} style={{ color: 'var(--text-muted)' }} />
                            </button>
                            {open && (
                                <div
                                    className="absolute right-0 top-full mt-1 min-w-44 rounded-lg border shadow-xl py-1 z-50"
                                    style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}
                                >
                                    {locales.map(l => (
                                        <button
                                            key={l.code}
                                            onClick={() => { setLocale(l.code); setOpen(false); }}
                                            className="w-full px-3 py-2 text-left text-[13px] flex items-center justify-between transition-colors"
                                            style={{ color: locale === l.code ? 'var(--accent-primary)' : 'var(--text-primary)' }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                        >
                                            <span>{l.name}</span>
                                            {locale === l.code && <Check className="w-4 h-4" />}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const StartupAgentSection = ({ defaultAgentMode, setDefaultAgentMode, defaultAgentId, setDefaultAgentId, agents, onLogout, user }) => {
    const { t } = useTranslation();
    const showAgentSelect = defaultAgentMode === 'specific';
    const [localUser, setLocalUser] = useState(user);
    useEffect(() => { if (user) setLocalUser(user); }, [user]);

    const handleAvatarSaved = (avatar, avatarType) => {
        setLocalUser(prev => ({ ...prev, avatar, avatarType }));
    };

    return (
        <div className="space-y-6">
            {/* ── Profile card ── */}
            {localUser && (
                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
                    <div className="flex items-center gap-5 px-5 py-5" style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)' }}>
                        <AvatarPicker user={localUser} onSaved={handleAvatarSaved} />
                        <div className="flex-1 min-w-0">
                            <p className="text-[17px] font-semibold truncate text-black">
                                {localUser.displayName || localUser.username || 'User'}
                            </p>
                            {localUser.email && (
                                <p className="text-[13px] truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>{localUser.email}</p>
                            )}
                            <p className="text-[11px] mt-1.5" style={{ color: 'var(--text-muted)' }}>
                                Click avatar to change photo or emoji
                            </p>
                        </div>
                    </div>
                </div>
            )}

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

            {/* Language Settings */}
            <LanguageSettingsSection />

            {/* Session Settings */}
            {onLogout && (
                <div className="space-y-1.5 mt-6">
                    <p className="text-[11px] font-semibold uppercase tracking-widest px-1 mb-2" style={{ color: 'var(--text-muted)' }}>Session</p>
                    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
                        <button
                            onClick={onLogout}
                            className="w-full flex items-center px-5 py-3.5 text-left transition-colors gap-3"
                            style={{ background: 'var(--bg-secondary)' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(220,38,38,0.05)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                        >
                            <svg width="15" height="15" fill="none" stroke="#dc2626" viewBox="0 0 24 24" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
                            </svg>
                            <span className="text-[13px] font-medium" style={{ color: '#dc2626' }}>Sign out</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StartupAgentSection;
