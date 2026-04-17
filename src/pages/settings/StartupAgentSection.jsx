import React, { useState, useEffect, useRef } from 'react';
import AvatarPicker from './AvatarPicker';
import { useTranslation } from '../../hooks/useTranslation';
import { Globe, Check, ChevronDown, Shield } from 'lucide-react';
import { API_BASE, authFetch } from '../../utils/helpers';
import scopedStorage from '../../utils/scopedStorage';

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

// Re-use RadioRow for Chat History section
const ChatHistoryRadioRow = RadioRow;

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
            <p className="text-[11px] font-semibold uppercase tracking-widest px-1 mb-2" style={{ color: 'var(--text-muted)' }}>{t('settings.language_section')}</p>
            <div className="rounded-xl" style={{ border: '1px solid var(--border-subtle)' }}>
                <div className="px-5 py-3.5" style={{ background: 'var(--bg-secondary)', borderRadius: '0.75rem' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(59,130,246,0.1)' }}>
                            <Globe className="w-4 h-4" style={{ color: '#3b82f6' }} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>{t('settings.interface_language')}</p>
                            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{t('settings.interface_language_desc')}</p>
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

// ── EU-Only Models Toggle ─────────────────────────────────────────────────────
const EUPrivacySection = () => {
    const { t } = useTranslation();
    const [euEnabled, setEuEnabled] = useState(false);
    const [orgForced, setOrgForced] = useState(false);
    const [hasEuModels, setHasEuModels] = useState(false);
    const [saving, setSaving] = useState(false);
    const loaded = useRef(false);

    useEffect(() => {
        authFetch(`${API_BASE}/ai/user-settings`)
            .then(r => r.json())
            .then(data => {
                setEuEnabled(!!data.userEuModeEnabled);
                setOrgForced(!!data.orgEuModeForced);
                setHasEuModels(!!data.hasEuModelsConfigured);
                loaded.current = true;
            })
            .catch(() => {});
    }, []);

    const handleToggle = async () => {
        const newVal = !euEnabled;
        setEuEnabled(newVal);
        setSaving(true);
        try {
            await authFetch(`${API_BASE}/ai/user-settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userEuModeEnabled: newVal }),
            });
        } catch (_) {
            setEuEnabled(!newVal); // revert on failure
        }
        setSaving(false);
    };

    // Don't show if no EU models are configured by admin
    if (!hasEuModels && !orgForced) return null;

    return (
        <div className="space-y-1.5 mt-6">
            <p className="text-[11px] font-semibold uppercase tracking-widest px-1 mb-2" style={{ color: 'var(--text-muted)' }}>{t('settings.privacy_section')}</p>
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
                <div className="flex items-center gap-3 px-5 py-4" style={{ background: 'var(--bg-secondary)', borderRadius: '0.75rem' }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(59,130,246,0.1)' }}>
                        <Shield className="w-4 h-4" style={{ color: '#3b82f6' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>{t('settings.eu_only_models')}</p>
                        <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            {orgForced
                                ? t('settings.eu_only_models_org_forced')
                                : t('settings.eu_only_models_desc')}
                        </p>
                    </div>
                    {orgForced ? (
                        <span
                            className="text-[10px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0"
                            style={{ background: 'rgba(5,150,105,0.1)', color: '#059669' }}
                        >
                            {t('settings.enforced_by_org')}
                        </span>
                    ) : (
                        <button
                            type="button"
                            onClick={handleToggle}
                            disabled={saving}
                            className="relative w-11 h-6 rounded-full transition-colors flex-shrink-0"
                            style={{ background: euEnabled ? 'var(--accent-primary)' : 'var(--border-default)', opacity: saving ? 0.6 : 1 }}
                        >
                            <div
                                className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
                                style={{ transform: euEnabled ? 'translateX(20px)' : 'translateX(0)' }}
                            />
                        </button>
                    )}
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

    // Chat History display mode — user-scoped so two users on the same browser
    // don't share preferences.
    const [chatHistoryMode, setChatHistoryModeRaw] = useState(
        () => scopedStorage.getItem('chatHistoryMode') || 'per-agent'
    );
    const setChatHistoryMode = (v) => {
        setChatHistoryModeRaw(v);
        scopedStorage.setItem('chatHistoryMode', v);
        // Dispatch event so AgentHub / Sidebar pick it up without a remount.
        window.dispatchEvent(new CustomEvent('chatHistoryModeChanged', { detail: v }));
    };

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
                                {t('settings.click_avatar_hint')}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-widest px-1 mb-2" style={{ color: 'var(--text-muted)' }}>
                    {t('settings.startup_section')}
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
                            <p className="text-[11px] font-medium mb-2" style={{ color: 'var(--text-muted)' }}>{t('settings.select_agent_label')}</p>
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

            {/* EU-Only Models */}
            <EUPrivacySection />

            {/* Chat History Display Mode */}
            <div className="space-y-1.5 mt-6">
                <p className="text-[11px] font-semibold uppercase tracking-widest px-1 mb-2" style={{ color: 'var(--text-muted)' }}>
                    {t('settings.chat_history')}
                </p>
                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
                    <div className="flex items-center gap-3 px-5 py-4" style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)' }}>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(99,102,241,0.10)' }}>
                            <svg style={{ color: '#6366f1', width: '15px', height: '15px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-[13px] font-medium text-black">{t('settings.chat_history')}</p>
                            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{t('settings.chat_history_desc')}</p>
                        </div>
                    </div>
                    <ChatHistoryRadioRow
                        value="per-agent"
                        currentValue={chatHistoryMode}
                        onChange={(e) => setChatHistoryMode(e.target.value)}
                        label={t('settings.chat_history_per_agent')}
                        description={t('settings.chat_history_per_agent_desc')}
                    />
                    <ChatHistoryRadioRow
                        value="all-chats"
                        currentValue={chatHistoryMode}
                        onChange={(e) => setChatHistoryMode(e.target.value)}
                        label={t('settings.chat_history_all_chats')}
                        description={t('settings.chat_history_all_chats_desc')}
                        last
                    />
                </div>
            </div>

            {/* Session Settings */}
            {onLogout && (
                <div className="space-y-1.5 mt-6">
                    <p className="text-[11px] font-semibold uppercase tracking-widest px-1 mb-2" style={{ color: 'var(--text-muted)' }}>{t('settings.session_section')}</p>
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
                            <span className="text-[13px] font-medium" style={{ color: '#dc2626' }}>{t('settings.sign_out')}</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StartupAgentSection;
