/**
 * Chat ⇄ Cowork switch.
 *
 * The composer is the same box in both modes — what changes is where a send
 * goes: Chat answers you, Cowork goes off and does the thing. Keeping one
 * composer (rather than a separate "new task" screen) is the part of this
 * model people actually praise: you don't have to decide which surface you
 * need before you've finished the thought.
 *
 * Styling stays on the Bee Flow tokens (--accent-primary, --bg-*), so the
 * control inherits whatever theme the workspace is running.
 */
import { Handshake, MessageCircle } from 'lucide-react';
import React from 'react';

// The mode id matches the caption. It briefly didn't — the button said
// "Cowork" while the id, the data attributes and the test ids all said "work"
// — which is exactly how one feature ends up with two vocabularies. Nothing
// persists this value (it is component state for the length of one empty
// thread), so there was no stored data to keep it honest to.
const MODES = [
    { id: 'chat', label: 'Chat', icon: MessageCircle, hint: 'Answers you here, in the conversation' },
    { id: 'cowork', label: 'Cowork', icon: Handshake, hint: 'Runs on its own — now or on a schedule' },
];

export default function CoworkModeSwitch({ value = 'chat', onChange, size = 'md', className = '' }) {
    const compact = size === 'sm';
    return (
        <div
            role="tablist"
            aria-label="Chat or Cowork"
            data-testid="cowork-mode-switch"
            className={`inline-flex items-center rounded-full p-0.5 border ${className}`}
            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)' }}
        >
            {MODES.map(({ id, label, icon: Icon, hint }) => {
                const active = value === id;
                return (
                    <button
                        key={id}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        title={hint}
                        data-testid={`cowork-mode-${id}`}
                        onClick={() => onChange && onChange(id)}
                        className={`inline-flex items-center gap-1.5 rounded-full font-medium transition-all ${
                            compact ? 'px-2.5 py-1 text-[11.5px]' : 'px-3.5 py-1.5 text-[12.5px]'
                        }`}
                        style={active ? {
                            background: 'var(--bg-primary)',
                            color: 'var(--text-primary)',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.10)',
                        } : {
                            background: 'transparent',
                            color: 'var(--text-tertiary)',
                        }}
                    >
                        <Icon
                            className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'}
                            style={active && id === 'cowork' ? { color: 'var(--accent-primary)' } : undefined}
                            strokeWidth={active ? 2.25 : 1.75}
                        />
                        {label}
                    </button>
                );
            })}
        </div>
    );
}
