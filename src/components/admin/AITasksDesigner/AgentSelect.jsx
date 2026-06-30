// §WS5 — agent avatar + custom <select> replacement, extracted verbatim from
// AITasksDesigner/index.jsx. AgentAvatar is internal to this picker.
import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { isImageAvatar, resolveAvatarSrc, pickAgentAvatar, DEFAULT_AGENT_EMOJI } from '../../../utils/agentAvatar';

// Render an agent avatar that may be either an emoji or an image
// (data: URL, http(s) URL, or app-relative path). Native <option> elements
// can't render images, so the surrounding AgentSelect uses this and a
// custom popover instead of <select>.
function AgentAvatar({ value, size = 20 }) {
    if (isImageAvatar(value)) {
        return (
            <img
                src={resolveAvatarSrc(value)}
                alt=""
                className="rounded object-cover flex-shrink-0"
                style={{ width: size, height: size }}
            />
        );
    }
    return (
        <span
            className="inline-flex items-center justify-center flex-shrink-0"
            style={{ width: size, height: size, fontSize: Math.round(size * 0.85), lineHeight: 1 }}
        >
            {value || DEFAULT_AGENT_EMOJI}
        </span>
    );
}

// Custom replacement for <select> that supports image avatars in both the
// trigger and the option rows. Closes on outside click; falls back to a
// generic 🤖 emoji when an agent has no avatar.
export default function AgentSelect({ value, onChange, agents, placeholder }) {
    const [open, setOpen] = useState(false);
    const wrapRef = useRef(null);
    useEffect(() => {
        if (!open) return;
        const onDoc = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [open]);

    const selected = agents.find(a => a.id === value) || null;
    const triggerLabel = selected
        ? (selected.name || '(untitled)')
        : (placeholder || '— No agent —');
    const triggerAvatar = selected ? (pickAgentAvatar(selected) || DEFAULT_AGENT_EMOJI) : null;

    return (
        <div ref={wrapRef} className="relative">
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className="w-full px-3.5 py-2.5 rounded-xl border bg-[var(--bg-card)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--text-primary)] transition-colors cursor-pointer flex items-center gap-2"
                style={{ borderColor: 'var(--border-subtle, rgba(0,0,0,0.08))' }}
            >
                {triggerAvatar && <AgentAvatar value={triggerAvatar} size={20} />}
                <span className="flex-1 text-left truncate">{triggerLabel}</span>
                <ChevronDown size={14} className={`text-[var(--text-tertiary)] transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
                <div
                    className="absolute left-0 right-0 top-full mt-1 z-30 rounded-xl border bg-[var(--bg-card)] shadow-lg max-h-64 overflow-auto"
                    style={{ borderColor: 'var(--border-subtle, rgba(0,0,0,0.08))' }}
                >
                    <button
                        type="button"
                        onClick={() => { onChange(''); setOpen(false); }}
                        className="w-full px-3.5 py-2 text-left text-[13px] hover:bg-[var(--bg-secondary)] transition-colors flex items-center gap-2"
                    >
                        <span className="w-5 h-5 inline-flex items-center justify-center text-[var(--text-tertiary)]">—</span>
                        <span className="flex-1 text-[var(--text-secondary)]">{placeholder || 'No agent (general prompt)'}</span>
                        {!value && <Check size={14} className="text-emerald-500" />}
                    </button>
                    {agents.map(a => {
                        const av = pickAgentAvatar(a) || DEFAULT_AGENT_EMOJI;
                        const isSelected = a.id === value;
                        return (
                            <button
                                key={a.id}
                                type="button"
                                onClick={() => { onChange(a.id); setOpen(false); }}
                                className="w-full px-3.5 py-2 text-left text-[13px] hover:bg-[var(--bg-secondary)] transition-colors flex items-center gap-2"
                            >
                                <AgentAvatar value={av} size={20} />
                                <span className="flex-1 truncate">{a.name || '(untitled)'}</span>
                                {isSelected && <Check size={14} className="text-emerald-500" />}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
