import React, { useState, useRef, useEffect, useCallback } from 'react';
import { API_BASE, authFetch } from '../../utils/helpers';
import { AvatarDisplay } from '../AdvancedSettings';

// ── Emoji picker data ────────────────────────────────────────────────────────
const EMOJI_CATEGORIES = [
    { label: '😀', emojis: ['😀', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '🥲', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🥶', '🤯'] },
    { label: '🧑', emojis: ['🧑', '👩', '👨', '🧔', '👱', '👮', '🕵️', '💂', '👷', '🤴', '👸', '🧙', '🧛', '🧟', '🧞', '🧜', '🧚', '👼', '🎅', '🤶', '🦸', '🦹', '🤺', '🏇', '⛷️', '🏂', '🏋️', '🤼', '🤸', '🤾'] },
    { label: '🐶', emojis: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🦅', '🦉', '🦋', '🐛', '🐌', '🐜', '🐝', '🐞', '🦎', '🐍', '🐢', '🦕'] },
    { label: '🌟', emojis: ['⚡', '🔥', '💧', '🌊', '🌈', '❄️', '🌪️', '🌙', '☀️', '⭐', '🌟', '💥', '🎯', '🏆', '🥇', '🎖️', '🏅', '🎗️', '💎', '🔮', '🪄', '🎲', '🎰', '🎭', '🎨', '🎬', '🔭', '🔬', '💡', '⚙️'] },
    { label: '🤖', emojis: ['🤖', '👾', '👻', '💀', '☠️', '👽', '🦄', '🐉', '🐲', '🦖', '🦕', '🦑', '🐙', '🦂', '🦠', '🧫', '🧪', '🌀', '🔑', '🗝️', '🔓', '🔐', '🔒', '🔏', '🛡️', '⚔️', '🪃', '🏹', '🪓', '🔧'] },
    { label: '🍎', emojis: ['🍎', '🍊', '🍋', '🍇', '🍓', '🫐', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🫒', '🥑', '🍆', '🥦', '🌽', '🥕', '🧄', '🧅', '🫘', '🥜', '🌰', '🍞', '🥐', '🥖', '🧀', '🍔', '🍕'] },
];

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

export default AvatarPicker;
