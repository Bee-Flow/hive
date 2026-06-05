import React, { useState, useEffect, useRef } from 'react';
import AvatarPicker from './AvatarPicker';
import { useTranslation } from '../../hooks/useTranslation';
import { Check, ChevronDown } from 'lucide-react';
import { API_BASE, authFetch } from '../../utils/helpers';
import scopedStorage from '../../utils/scopedStorage';
import MeetingNotesSection from './MeetingNotesSection';

const ROLE_LABELS = {
    admin: 'Admin',
    org_admin: 'Organisation Admin',
    agent_admin: 'Agent Admin',
    agent_editor: 'Agent Editor',
    user: 'User',
    member: 'Member',
};

// ── Generic list row used in the General container ───────────────────────────
const Row = ({ label, description, right, first }) => (
    <div
        className="flex items-center gap-4 px-5 py-3.5"
        style={{
            borderTop: first ? 'none' : '1px solid var(--border-subtle)',
        }}
    >
        <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>{label}</p>
            {description && (
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{description}</p>
            )}
        </div>
        <div className="flex-shrink-0">{right}</div>
    </div>
);

// ── Shared dropdown used for Language and Chat History ──────────────────────
const Dropdown = ({ value, options, onChange }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        if (!open) return;
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    const current = options.find(o => o.value === value) || options[0];

    return (
        <div className="relative" ref={ref}>
            <button
                onClick={() => setOpen(v => !v)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[13px] transition-colors"
                style={{
                    background: 'var(--bg-primary)',
                    borderColor: open ? 'var(--accent-primary)' : 'var(--border-default)',
                    color: 'var(--text-primary)',
                }}
            >
                <span>{current?.label}</span>
                <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
                    style={{ color: 'var(--text-muted)' }}
                />
            </button>
            {open && (
                <div
                    className="absolute right-0 top-full mt-1 min-w-44 rounded-lg border shadow-xl py-1 z-50"
                    style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}
                >
                    {options.map(o => (
                        <button
                            key={o.value}
                            onClick={() => { onChange(o.value); setOpen(false); }}
                            className="w-full px-3 py-2 text-left text-[13px] flex items-center justify-between transition-colors"
                            style={{ color: value === o.value ? 'var(--accent-primary)' : 'var(--text-primary)' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                            <span>{o.label}</span>
                            {value === o.value && <Check className="w-4 h-4" />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

// ── iOS-style toggle ─────────────────────────────────────────────────────────
const Toggle = ({ on, onClick, disabled }) => (
    <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-pressed={on}
        className="relative w-11 h-6 rounded-full transition-colors flex-shrink-0"
        style={{
            background: on ? 'var(--accent-primary)' : 'var(--border-default)',
            opacity: disabled ? 0.6 : 1,
        }}
    >
        <div
            className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
            style={{ transform: on ? 'translateX(20px)' : 'translateX(0)' }}
        />
    </button>
);

const SectionLabel = ({ children }) => (
    <p
        className="text-[11px] font-semibold uppercase tracking-widest px-1 mb-2"
        style={{ color: 'var(--text-muted)' }}
    >
        {children}
    </p>
);

const PreferencesSection = ({
    defaultAgentMode,
    setDefaultAgentMode,
    defaultAgentId,
    setDefaultAgentId,
    agents,
    onLogout,
    user,
    onUpdateUser,
}) => {
    const { t, locale, setLocale } = useTranslation();
    const [localUser, setLocalUser] = useState(user);
    useEffect(() => { if (user) setLocalUser(user); }, [user]);

    const isSimpleMode = !!localUser?.simpleMode;
    const showAgentSelect = defaultAgentMode === 'specific';

    // Chat history — user-scoped, broadcast for live sidebar updates.
    const [chatHistoryMode, setChatHistoryModeRaw] = useState(
        () => scopedStorage.getItem('chatHistoryMode') || 'per-agent'
    );
    const setChatHistoryMode = (v) => {
        setChatHistoryModeRaw(v);
        scopedStorage.setItem('chatHistoryMode', v);
        window.dispatchEvent(new CustomEvent('chatHistoryModeChanged', { detail: v }));
    };

    // Available UI locales (only render the row if more than one).
    const [locales, setLocales] = useState([]);
    useEffect(() => {
        authFetch(`${API_BASE}/api/languages/user/locales`)
            .then(r => r.json())
            .then(data => { if (Array.isArray(data)) setLocales(data); })
            .catch(e => console.warn('[Preferences] load locales failed', e));
    }, []);

    // Simple Mode toggle (lifted from SimpleModeSection).
    const [simpleSaving, setSimpleSaving] = useState(false);
    const handleSimpleModeToggle = async () => {
        const newVal = !isSimpleMode;
        setLocalUser(prev => ({ ...prev, simpleMode: newVal }));
        if (onUpdateUser) onUpdateUser({ simpleMode: newVal });
        setSimpleSaving(true);
        try {
            await authFetch(`${API_BASE}/ai/user-settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ simpleMode: newVal }),
            });
        } catch {
            setLocalUser(prev => ({ ...prev, simpleMode: !newVal }));
            if (onUpdateUser) onUpdateUser({ simpleMode: !newVal });
        }
        setSimpleSaving(false);
    };

    const handleAvatarSaved = (avatar, avatarType) => {
        setLocalUser(prev => ({ ...prev, avatar, avatarType }));
        // Lift the change to the app-level `user` so the sidebar footer avatar
        // updates too — without this only the Settings panel reflected the new
        // image until a hard reload (BFSF-182). Mirrors handleSimpleModeToggle.
        if (onUpdateUser) onUpdateUser({ avatar, avatarType });
    };

    const effectiveRole = localUser?.orgRole || localUser?.role;
    const roleLabel = effectiveRole
        ? (ROLE_LABELS[effectiveRole] || effectiveRole.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()))
        : null;
    const isAdminRole = ['admin', 'org_admin'].includes(effectiveRole);

    const hasLanguageRow = locales.length > 1;
    const showStartup = !isSimpleMode;
    const showChatHistory = !isSimpleMode;

    const localeOptions = locales.map(l => ({ value: l.code, label: l.name }));
    const chatHistoryOptions = [
        { value: 'per-agent', label: t('settings.chat_history_per_agent') || 'Per agent' },
        { value: 'all-chats', label: t('settings.chat_history_all_chats') || 'All chats' },
    ];
    const startupOptions = [
        { value: 'last-used', label: t('settings.continue_where_left') || 'Continue where you left off' },
        { value: 'specific', label: t('settings.always_open_specific') || 'Always open a specific agent' },
        { value: 'direct-chat', label: t('settings.start_direct_chat') || 'Start with Direct Chat' },
    ];

    return (
        <div className="space-y-7">
            {/* ── Profile strip ── */}
            {localUser && (
                <div
                    className="flex items-center gap-4 px-5 py-4 rounded-xl"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}
                >
                    <AvatarPicker user={localUser} onSaved={handleAvatarSaved} />
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-[15px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                                {localUser.displayName || localUser.username || 'User'}
                            </p>
                            {roleLabel && (
                                <span
                                    className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                                    style={{
                                        background: isAdminRole ? 'rgba(5,150,105,0.1)' : 'var(--bg-tertiary)',
                                        color: isAdminRole ? '#059669' : 'var(--text-muted)',
                                    }}
                                >
                                    {roleLabel}
                                </span>
                            )}
                        </div>
                        {localUser.email && (
                            <p className="text-[12px] truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                {localUser.email}
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* ── General ── */}
            <div>
                <SectionLabel>{t('settings.general_section') || 'General'}</SectionLabel>
                <div
                    className="rounded-xl"
                    style={{ border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}
                >
                    {hasLanguageRow && (
                        <Row
                            first
                            label={t('settings.interface_language')}
                            right={<Dropdown value={locale} options={localeOptions} onChange={setLocale} />}
                        />
                    )}
                    {showChatHistory && (
                        <Row
                            first={!hasLanguageRow}
                            label={t('settings.chat_history')}
                            description={t('settings.chat_history_desc')}
                            right={
                                <Dropdown
                                    value={chatHistoryMode}
                                    options={chatHistoryOptions}
                                    onChange={setChatHistoryMode}
                                />
                            }
                        />
                    )}
                    {showStartup && (
                        <Row
                            first={!hasLanguageRow && !showChatHistory}
                            label={t('settings.startup_behavior') || 'Startup'}
                            description={t('settings.startup_behavior_desc') || 'Choose what opens when you launch Bee Flow'}
                            right={
                                <Dropdown
                                    value={defaultAgentMode}
                                    options={startupOptions}
                                    onChange={setDefaultAgentMode}
                                />
                            }
                        />
                    )}
                    {showStartup && showAgentSelect && (
                        <div
                            className="flex items-center gap-4 px-5 py-3.5"
                            style={{ borderTop: '1px solid var(--border-subtle)' }}
                        >
                            <p className="text-[13px] font-medium flex-1 min-w-0" style={{ color: 'var(--text-primary)' }}>
                                {t('settings.select_agent_label')}
                            </p>
                            <select
                                value={defaultAgentId}
                                onChange={e => setDefaultAgentId(e.target.value)}
                                className="px-3 py-1.5 rounded-lg border outline-none focus:border-[var(--accent-primary)] transition-colors text-[13px]"
                                style={{
                                    borderColor: 'var(--border-default)',
                                    color: 'var(--text-primary)',
                                    background: 'var(--bg-primary)',
                                    minWidth: '180px',
                                }}
                            >
                                <option value="">{t('settings.select_agent')}</option>
                                {agents.map(agent => (
                                    <option key={agent.id} value={agent.id}>{agent.name}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    <Row
                        first={!hasLanguageRow && !showChatHistory && !showStartup}
                        label={t('settings.simple_mode_toggle') || 'Simple Mode'}
                        description={t('settings.simple_mode_desc') || 'Show only New Chat, Search, Agents and your chat history. Hides Studio, Meeting Notes, Notebooks, Webpages and other settings.'}
                        right={<Toggle on={isSimpleMode} onClick={handleSimpleModeToggle} disabled={simpleSaving} />}
                    />
                </div>
            </div>

            {/* ── Nextcloud Talk Meeting Notes (self-hides when not licensed) ── */}
            <MeetingNotesSection />

            {/* ── Sign out ── */}
            {onLogout && (
                <div className="flex justify-end pt-2">
                    <button
                        onClick={onLogout}
                        className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-[13px] font-medium transition-colors"
                        style={{ color: '#dc2626', background: 'transparent' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(220,38,38,0.08)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                        <svg width="14" height="14" fill="none" stroke="#dc2626" viewBox="0 0 24 24" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
                        </svg>
                        <span>{t('settings.sign_out')}</span>
                    </button>
                </div>
            )}
        </div>
    );
};

export default PreferencesSection;
