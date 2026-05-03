import React, { useState, useRef, useEffect } from 'react';
import { Image as ImageIcon } from 'lucide-react';

// Avatar can be either an emoji string OR a data-URL / http URL for an
// uploaded image. The picker offers both: tabbed emoji grid + a file upload.
const AVATAR_EMOJI_CATEGORIES = {
    tech:    { label: '🤖', emojis: ['🤖','🧠','💡','🔧','🛠️','⚙️','📊','📈','📉','🎯','🚀','⚡','🔥','💥','✨','🌟','⭐','🏆','📝','✏️','📌','📎','🗂️','📂','📁','🔒','🔑','🛡️','💻','⌨️','🖥️','📱','🖨️','🔍','🔬','📡','💾','🌐','🧰','📚'] },
    smileys: { label: '😀', emojis: ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','😊','😇','🥰','😍','🤩','😘','😋','😎','🥸','🤓','🧐','🤨','😏','😌','😴','🥳','🤠','😈','👽','💀','👻','😺','🙃','😉','🤗','🤔','🤫','🤭','🤐','😶','🙄'] },
    people:  { label: '👤', emojis: ['👋','🤚','✋','👌','✌️','🤞','🤟','🤘','👍','👎','👏','🙌','👐','🤝','🙏','💪','👨‍💻','👩‍💻','👨‍🔬','👩‍🔬','👨‍🎨','👩‍🎨','🧑‍🚀','🧑‍🍳','🧑‍🏫','🧑‍⚕️','🧑‍🎓','👮','🕵️','🧙','🦸','🥷','💼','🎩','👑','🦾','🫶','🫡','🫰','🫵'] },
    nature:  { label: '🌿', emojis: ['🐶','🐱','🦊','🐻','🐼','🐨','🦁','🐯','🐮','🐷','🐸','🐵','🐔','🐧','🐦','🦆','🦅','🦉','🐺','🦄','🐝','🦋','🐢','🐍','🐬','🐳','🦈','🌳','🌲','🌴','🌵','🌷','🌹','🌻','🌼','🍀','🍁','🌍','🌙','☀️'] },
    food:    { label: '🍔', emojis: ['🍏','🍎','🍌','🍇','🍓','🍒','🥑','🥦','🥕','🌽','🍞','🥐','🥨','🧀','🥚','🍳','🥞','🥓','🍔','🍟','🍕','🌭','🥪','🌮','🌯','🥗','🍜','🍝','🍣','🍱','🍙','🍩','🍪','🎂','🍰','🍫','🍿','☕','🍵','🥤'] },
    objects: { label: '💡', emojis: ['📞','📟','📠','🔋','🔌','💡','🔦','🕯️','🧯','🛢️','💸','💵','💴','💶','💷','🪙','💳','🧾','💎','⚖️','🪜','🧰','🔧','🔨','⛏️','🔩','⚙️','🧲','🔫','💣','🧨','🪓','🔪','🗡️','⚔️','🛡️','🚬','⚰️','🪦','🧪'] },
    travel:  { label: '✈️', emojis: ['🚗','🚕','🚌','🏎️','🚓','🚑','🚒','🚜','🏍️','🚲','🛴','🚂','🚆','🚇','✈️','🛫','🚀','🛸','🚁','⛵','🚢','🏠','🏢','🏥','🏨','🏫','🏭','🗼','🗽','⛪','🕌','⛲','🌍','🌎','🌏','🗺️','🏝️','🏔️','⛰️','🌋'] },
    symbols: { label: '⚡', emojis: ['❤️','🧡','💛','💚','💙','💜','🤍','🖤','💔','❣️','💕','💞','💓','💖','💘','💝','💟','☮️','✝️','☪️','🕉️','☸️','✡️','☯️','♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓','✅','❌','⚠️','♻️'] },
};
const isImageAvatar = (a) => !!a && (typeof a === 'string') && (a.startsWith('data:') || a.startsWith('http'));

export default function AvatarPicker({ avatar, onChange, t }) {
    const [open, setOpen] = useState(false);
    const [category, setCategory] = useState('tech');
    const popoverRef = useRef(null);
    const triggerRef = useRef(null);
    const isImage = isImageAvatar(avatar);

    useEffect(() => {
        if (!open) return;
        const onDoc = (e) => {
            if (popoverRef.current?.contains(e.target)) return;
            if (triggerRef.current?.contains(e.target)) return;
            setOpen(false);
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [open]);

    const onFile = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 512 * 1024) { alert(t('agent_wizard.avatar.too_large') || 'Image must be under 512KB'); e.target.value = ''; return; }
        const reader = new FileReader();
        reader.onload = (ev) => { onChange(ev.target.result); setOpen(false); };
        reader.readAsDataURL(file);
        e.target.value = '';
    };
    const pickEmoji = (em) => { onChange(em); setOpen(false); };

    return (
        <div className="relative">
            <button
                ref={triggerRef}
                type="button"
                onClick={() => setOpen(v => !v)}
                className="w-16 h-16 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-default)] text-3xl flex items-center justify-center overflow-hidden hover:bg-[var(--bg-tertiary)] transition"
                title={t('agent_wizard.avatar.title') || 'Avatar'}
            >
                {isImage
                    ? <img src={avatar} alt="" className="w-full h-full object-cover" />
                    : <span>{avatar || '🤖'}</span>}
            </button>
            {open && (
                <div
                    ref={popoverRef}
                    className="absolute z-30 top-full left-0 mt-2 w-[360px] rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)] shadow-xl overflow-hidden"
                >
                    {/* Category tabs */}
                    <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-[var(--border-default)]">
                        {Object.entries(AVATAR_EMOJI_CATEGORIES).map(([key, cat]) => (
                            <button
                                key={key}
                                type="button"
                                onClick={() => setCategory(key)}
                                className={`flex-1 py-1.5 rounded-md text-base transition ${category === key ? 'bg-[var(--bg-tertiary)]' : 'hover:bg-[var(--bg-secondary)]'}`}
                                title={key}
                            >
                                {cat.label}
                            </button>
                        ))}
                    </div>
                    {/* Emoji grid */}
                    <div className="p-2 max-h-64 overflow-y-auto">
                        <div className="grid grid-cols-8 gap-0.5">
                            {(AVATAR_EMOJI_CATEGORIES[category]?.emojis || []).map((em) => (
                                <button
                                    key={em}
                                    type="button"
                                    onClick={() => pickEmoji(em)}
                                    className={`w-9 h-9 rounded-lg flex items-center justify-center text-xl hover:bg-[var(--bg-tertiary)] transition ${avatar === em ? 'bg-[var(--bg-tertiary)] ring-2 ring-[var(--accent)]' : ''}`}
                                >
                                    {em}
                                </button>
                            ))}
                        </div>
                    </div>
                    {/* Upload + reset row — <label> wrapping the file input is the
                        most reliable cross-browser pattern (see legacy
                        KnowledgeBasesSection.jsx:621). */}
                    <div className="flex items-center gap-2 px-3 py-2 border-t border-[var(--border-default)]">
                        <label className="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] transition cursor-pointer text-center flex items-center justify-center gap-1.5">
                            <ImageIcon size={13} />
                            {t('agent_wizard.avatar.upload') || 'Upload image'}
                            <input
                                type="file"
                                accept="image/png,image/jpeg,image/svg+xml,image/webp,image/gif"
                                className="hidden"
                                onChange={onFile}
                            />
                        </label>
                        {isImage && (
                            <button
                                type="button"
                                onClick={() => { onChange('🤖'); setOpen(false); }}
                                className="px-3 py-1.5 text-xs rounded-lg text-[var(--text-tertiary)] hover:text-red-500 hover:bg-[var(--bg-secondary)] transition"
                            >
                                {t('agent_wizard.avatar.reset') || 'Remove'}
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
