import React, { useState, useRef, useEffect, useCallback } from 'react';
import { API_BASE, authFetch } from '../../utils/helpers';
import { useTranslation } from '../../hooks/useTranslation';

// ── Emoji picker data ────────────────────────────────────────────────────────
const EMOJI_CATEGORIES = [
    { label: '😀', emojis: ['😀', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '🥲', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🥶', '🤯'] },
    { label: '🧑', emojis: ['🧑', '👩', '👨', '🧔', '👱', '👮', '🕵️', '💂', '👷', '🤴', '👸', '🧙', '🧛', '🧟', '🧞', '🧜', '🧚', '👼', '🎅', '🤶', '🦸', '🦹', '🤺', '🏇', '⛷️', '🏂', '🏋️', '🤼', '🤸', '🤾'] },
    { label: '🐶', emojis: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🦅', '🦉', '🦋', '🐛', '🐌', '🐜', '🐝', '🐞', '🦎', '🐍', '🐢', '🦕'] },
    { label: '🌟', emojis: ['⚡', '🔥', '💧', '🌊', '🌈', '❄️', '🌪️', '🌙', '☀️', '⭐', '🌟', '💥', '🎯', '🏆', '🥇', '🎖️', '🏅', '🎗️', '💎', '🔮', '🪄', '🎲', '🎰', '🎭', '🎨', '🎬', '🔭', '🔬', '💡', '⚙️'] },
    { label: '🤖', emojis: ['🤖', '👾', '👻', '💀', '☠️', '👽', '🦄', '🐉', '🐲', '🦖', '🦕', '🦑', '🐙', '🦂', '🦠', '🧫', '🧪', '🌀', '🔑', '🗝️', '🔓', '🔐', '🔒', '🔏', '🛡️', '⚔️', '🪃', '🏹', '🪓', '🔧'] },
    { label: '🍎', emojis: ['🍎', '🍊', '🍋', '🍇', '🍓', '🫐', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🫒', '🥑', '🍆', '🥦', '🌽', '🥕', '🧄', '🧅', '🫘', '🥜', '🌰', '🍞', '🥐', '🥖', '🧀', '🍔', '🍕'] },
];

// ── Avatar display helper ────────────────────────────────────────────────────
export const AvatarDisplay = ({ user, size = 40, className = '' }) => {
    const sizeStyle = { width: `${size}px`, height: `${size}px`, flexShrink: 0 };

    if (user?.avatarType === 'emoji' && user?.avatar) {
        return (
            <div
                className={`rounded-full flex items-center justify-center ${className}`}
                style={{ ...sizeStyle, background: 'var(--bg-tertiary)', border: '1px solid var(--border-default)', fontSize: `${size * 0.5}px`, lineHeight: 1 }}
            >
                {user.avatar}
            </div>
        );
    }
    if (user?.avatarType === 'url' && user?.avatar) {
        return <img src={user.avatar} alt="Avatar" className={`rounded-full object-cover ${className}`} style={sizeStyle} />;
    }
    return (
        <div
            className={`rounded-full flex items-center justify-center font-bold ${className}`}
            style={{ ...sizeStyle, background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-default)', fontSize: `${Math.round(size * 0.38)}px` }}
        >
            {(user?.displayName || user?.username || 'U')[0].toUpperCase()}
        </div>
    );
};

// ── Avatar Picker ─────────────────────────────────────────────────────────────
const AvatarPicker = ({ user, onSaved }) => {
    const [open, setOpen] = useState(false);
    const [tab, setTab] = useState(0);
    const [saving, setSaving] = useState(false);
    const [customEmoji, setCustomEmoji] = useState('');
    const fileRef = useRef();
    const popoverRef = useRef();

    useEffect(() => {
        if (!open) return;
        const handler = (e) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    const pickEmoji = useCallback(async (emoji) => {
        setSaving(true);
        try {
            const res = await authFetch(`${API_BASE}/auth/update-profile`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ avatar: emoji, avatarType: 'emoji' }),
            });
            if (res.ok) { onSaved(emoji, 'emoji'); setOpen(false); return; }
        } catch (e) { console.warn('API save failed, applying locally:', e); }
        onSaved(emoji, 'emoji');
        setOpen(false);
        setSaving(false);
    }, [onSaved]);

    const handleImage = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (ev) => {
            const dataUrl = ev.target.result;
            setSaving(true);
            try {
                await authFetch(`${API_BASE}/auth/update-profile`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ avatar: dataUrl, avatarType: 'url' }),
                });
            } catch (e) { console.warn('API save failed:', e); }
            onSaved(dataUrl, 'url');
            setOpen(false);
            setSaving(false);
        };
        reader.readAsDataURL(file);
    };

    const removeAvatar = async () => {
        setSaving(true);
        try {
            await authFetch(`${API_BASE}/auth/update-profile`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ avatar: null, avatarType: null }),
            });
        } catch (e) { console.warn('API save failed:', e); }
        onSaved(null, null);
        setOpen(false);
        setSaving(false);
    };

    return (
        <div className="relative" ref={popoverRef}>
            <button onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }} className="relative group cursor-pointer" type="button">
                <AvatarDisplay user={user} size={64} />
                <div className="absolute inset-0 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'rgba(0,0,0,0.4)' }}>
                    <svg fill="none" stroke="white" viewBox="0 0 24 24" style={{ width: '14px', height: '14px' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                </div>
            </button>

            {open && (
                <div
                    className="absolute left-0 top-[72px] z-50 rounded-xl"
                    style={{ width: '300px', background: 'var(--bg-card)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-lg)' }}
                    onClick={e => e.stopPropagation()}
                >
                    <div className="flex items-center px-2 pt-2 pb-1 gap-0.5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        {EMOJI_CATEGORIES.map((cat, i) => (
                            <button key={i} onClick={() => setTab(i)} type="button"
                                className="flex-1 flex items-center justify-center py-1.5 rounded-md transition-colors text-base"
                                style={{ background: tab === i ? 'var(--bg-tertiary)' : 'transparent' }}>
                                {cat.label}
                            </button>
                        ))}
                    </div>
                    <div className="p-2 grid grid-cols-8 gap-0.5" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                        {EMOJI_CATEGORIES[tab].emojis.map((em, i) => (
                            <button key={i} type="button" onClick={() => pickEmoji(em)}
                                className="text-xl w-8 h-8 flex items-center justify-center rounded-md hover:bg-[var(--bg-tertiary)] transition-colors leading-none cursor-pointer"
                                disabled={saving}>{em}
                            </button>
                        ))}
                    </div>
                    <div className="px-2.5 pb-2.5 pt-2 flex flex-col gap-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                        <div className="flex gap-1.5">
                            <input value={customEmoji} onChange={e => setCustomEmoji(e.target.value)}
                                placeholder="Paste any emoji…"
                                className="flex-1 px-2.5 py-1.5 rounded-lg border outline-none text-sm"
                                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                onKeyDown={e => { if (e.key === 'Enter' && customEmoji.trim()) pickEmoji(customEmoji.trim()); }}
                            />
                            <button onClick={() => customEmoji.trim() && pickEmoji(customEmoji.trim())} type="button"
                                disabled={!customEmoji.trim() || saving}
                                className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-40"
                                style={{ background: 'var(--accent-primary)' }}>Use</button>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex gap-1.5">
                                <button onClick={() => fileRef.current?.click()} type="button"
                                    className="text-xs px-2.5 py-1 rounded-md transition-colors"
                                    style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>📁 Upload image</button>
                                {user?.avatar && (
                                    <button onClick={removeAvatar} type="button"
                                        className="text-xs px-2.5 py-1 rounded-md transition-colors hover:bg-red-500/10"
                                        style={{ color: '#f87171' }}>Remove</button>
                                )}
                            </div>
                            <button onClick={() => setOpen(false)} type="button"
                                className="text-xs px-2.5 py-1 rounded-md hover:bg-[var(--bg-tertiary)] transition-colors"
                                style={{ color: 'var(--text-muted)' }}>Done</button>
                        </div>
                        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImage} />
                    </div>
                </div>
            )}
        </div>
    );
};

// ── PIN Change ─────────────────────────────────────────────────────────────
const PinChangeSection = ({ user }) => {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [oldPin, setOldPin] = useState('');
    const [newPin, setNewPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [recoveryKey, setRecoveryKey] = useState(null);
    const [copied, setCopied] = useState(false);

    const handleChange = async () => {
        setError('');
        if (!oldPin) { setError('Enter your current PIN'); return; }
        if (newPin.length < 6) { setError('Must be at least 6 characters'); return; }
        if (newPin !== confirmPin) { setError('PINs do not match'); return; }
        setLoading(true);
        try {
            const res = await authFetch(`${API_BASE}/auth/sso-change-pin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ oldPin, newPin }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setRecoveryKey(data.recoveryKey || null);
                setOldPin(''); setNewPin(''); setConfirmPin('');
            } else { setError(data.error || 'Failed'); }
        } catch { setError('Connection error'); }
        finally { setLoading(false); }
    };

    if (user?.provider === 'local') return null;
    if (user?.encryptionEnabled === false) return null;

    return (
        <>
            {!open && !recoveryKey && (
                <button onClick={() => setOpen(true)} type="button"
                    className="text-xs px-3 py-1 rounded-lg transition-colors"
                    style={{ color: 'var(--accent-primary)', border: '1px solid var(--border-subtle)', background: 'transparent' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    Change
                </button>
            )}
            {recoveryKey && (
                <div className="mt-3 space-y-2">
                    <div className="p-2 rounded-lg text-xs" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', color: '#4ade80' }}>
                        ✓ PIN changed — save your recovery key below.
                    </div>
                    <div className="p-2 rounded-lg font-mono text-xs text-center tracking-wider break-all select-all"
                        style={{ background: 'var(--bg-primary)', border: '2px dashed var(--border-default)', color: 'var(--text-primary)' }}>
                        {recoveryKey}
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => { navigator.clipboard.writeText(recoveryKey); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                            className="flex-1 py-1.5 rounded-lg text-xs font-medium"
                            style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}>
                            {copied ? '✓ Copied' : 'Copy key'}
                        </button>
                        <button onClick={() => { setRecoveryKey(null); setOpen(false); }}
                            className="px-4 py-1.5 rounded-lg text-xs font-medium text-white"
                            style={{ background: 'var(--accent-primary)' }}>Done</button>
                    </div>
                </div>
            )}
            {open && !recoveryKey && (
                <div className="mt-3 space-y-2">
                    {error && <div className="p-2 rounded-lg text-xs" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>{error}</div>}
                    <input type="password" value={oldPin} onChange={e => setOldPin(e.target.value)} placeholder="Current PIN"
                        className="w-full px-3 py-2 rounded-lg border outline-none focus:border-[var(--accent-primary)] text-sm"
                        style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} />
                    <input type="password" value={newPin} onChange={e => setNewPin(e.target.value)} placeholder="New PIN (min 8)"
                        className="w-full px-3 py-2 rounded-lg border outline-none focus:border-[var(--accent-primary)] text-sm"
                        style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} />
                    <input type="password" value={confirmPin} onChange={e => setConfirmPin(e.target.value)} placeholder="Confirm"
                        className="w-full px-3 py-2 rounded-lg border outline-none focus:border-[var(--accent-primary)] text-sm"
                        style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                        onKeyDown={e => e.key === 'Enter' && handleChange()} />
                    <div className="flex gap-2">
                        <button onClick={() => { setOpen(false); setError(''); setOldPin(''); setNewPin(''); setConfirmPin(''); }}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium"
                            style={{ color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}>Cancel</button>
                        <button onClick={handleChange} disabled={loading}
                            className="flex-1 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50"
                            style={{ background: 'var(--accent-primary)' }}>
                            {loading ? 'Changing…' : 'Change PIN'}
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};

// ── List Card helpers ─────────────────────────────────────────────────────────
const SettingsCard = ({ children, className = '' }) => (
    <div className={`rounded-xl overflow-hidden ${className}`} style={{ border: '1px solid var(--border-subtle)' }}>
        {children}
    </div>
);

const SettingsRow = ({ label, value, children, last = false, danger = false }) => (
    <div
        className="flex items-center px-5 py-3.5 gap-4"
        style={{
            background: 'var(--bg-secondary)',
            borderBottom: last ? 'none' : '1px solid var(--border-subtle)',
        }}
    >
        <span className="text-[13px] flex-1" style={{ color: danger ? 'var(--error)' : 'var(--text-primary)' }}>{label}</span>
        {value && <span className="text-[13px]" style={{ color: 'var(--text-muted)' }}>{value}</span>}
        {children}
    </div>
);

// ── Account Section ──────────────────────────────────────────────────────────
const AccountSection = ({ user, onLogout, onAvatarChange }) => {
    const { t } = useTranslation();
    const [localUser, setLocalUser] = useState(user);
    useEffect(() => { if (user) setLocalUser(user); }, [user]);
    if (!localUser) return null;

    const handleAvatarSaved = (avatar, avatarType) => {
        const updated = { ...localUser, avatar, avatarType };
        setLocalUser(updated);
        if (onAvatarChange) onAvatarChange(updated);
    };

    const hasPinSection = localUser.provider !== 'local' && localUser.encryptionEnabled !== false;

    return (
        <div className="space-y-6">
            {/* ── Profile card ── */}
            <SettingsCard>
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
            </SettingsCard>

            {/* ── Account details list ── */}
            <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-widest px-1 mb-2" style={{ color: 'var(--text-muted)' }}>Account</p>
                <SettingsCard>
                    {localUser.role && (
                        <SettingsRow label="Role">
                            <span
                                className="text-[11px] px-2 py-0.5 rounded font-medium"
                                style={{
                                    background: localUser.role === 'admin' ? 'rgba(5,150,105,0.1)' : 'var(--bg-tertiary)',
                                    color: localUser.role === 'admin' ? '#059669' : 'var(--text-muted)',
                                }}
                            >{localUser.role}</span>
                        </SettingsRow>
                    )}
                    {localUser.provider && (
                        <SettingsRow label="Sign-in method" value={localUser.provider === 'local' ? 'Email & password' : localUser.provider} />
                    )}
                    {hasPinSection && (
                        <SettingsRow label="Encryption PIN" last>
                            <PinChangeSection user={localUser} />
                        </SettingsRow>
                    )}
                    {!localUser.role && !localUser.provider && !hasPinSection && (
                        <SettingsRow label="No additional details" last />
                    )}
                </SettingsCard>
            </div>

            {/* ── Danger zone ── */}
            {onLogout && (
                <div className="space-y-1.5">
                    <p className="text-[11px] font-semibold uppercase tracking-widest px-1 mb-2" style={{ color: 'var(--text-muted)' }}>Session</p>
                    <SettingsCard>
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
                    </SettingsCard>
                </div>
            )}
        </div>
    );
};

export default AccountSection;
