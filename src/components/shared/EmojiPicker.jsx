import React, { useState } from 'react';

const DEFAULT_EMOJIS = [
    '🌐', '🔍', '🌍', '💻', '🖥️', '📱', '🤖', '🕷️', '🔬', '🧪',
    '🚀', '⚡', '🎯', '📊', '📈', '🛒', '📝', '📋', '🗂️', '🔗',
    '🧠', '👁️', '🔮', '🎨', '📸', '🎬', '🎮', '🏠', '🏢', '🌟',
    '🦊', '🐱', '🐶', '🦁', '🐼', '🦉', '🦋', '🐙', '👨‍💻', '🥷'
];

/**
 * Reusable emoji picker component.
 * 
 * @param {string}   value    - Currently selected emoji
 * @param {function} onChange - Called with the new emoji string when user selects
 * @param {string[]} [emojis] - Optional custom emoji list (defaults to DEFAULT_EMOJIS)
 * @param {string}   [placeholder] - Fallback emoji shown in the input (default '🌐')
 */
export default function EmojiPicker({ value, onChange, emojis = DEFAULT_EMOJIS, placeholder = '🌐' }) {
    const [open, setOpen] = useState(false);

    return (
        <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted mb-2 block">Avatar</label>
            <div className="flex items-center gap-4">
                <div
                    onClick={() => setOpen(!open)}
                    className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border-2 border-dashed flex items-center justify-center text-3xl cursor-pointer hover:border-[var(--accent-primary)] hover:from-cyan-500/30 hover:to-blue-500/30 transition-all"
                    style={{ borderColor: 'var(--border-default)' }}
                    title="Click to change icon"
                >
                    {value}
                </div>
                <div className="text-sm text-muted">
                    <p>Click to select an emoji</p>
                    <p className="text-xs opacity-70">Or paste any emoji directly</p>
                </div>
            </div>
            {open && (
                <div className="mt-3 p-3 rounded-xl border bg-[var(--bg-secondary)]" style={{ borderColor: 'var(--border-default)' }}>
                    <div className="grid grid-cols-10 gap-1 mb-3">
                        {emojis.map(emoji => (
                            <button
                                key={emoji}
                                onClick={() => { onChange(emoji); setOpen(false); }}
                                className={`w-8 h-8 rounded-lg flex items-center justify-center text-xl hover:bg-white/10 transition-colors ${value === emoji ? 'bg-[var(--accent-primary)]/20 ring-2 ring-[var(--accent-primary)]' : ''}`}
                            >
                                {emoji}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-2 pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                        <input
                            type="text"
                            value={value}
                            onChange={(e) => onChange(e.target.value.slice(-2) || placeholder)}
                            className="input flex-1 py-1.5 text-center text-xl"
                            placeholder={placeholder}
                            maxLength={2}
                        />
                        <button
                            onClick={() => setOpen(false)}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                        >
                            Done
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
