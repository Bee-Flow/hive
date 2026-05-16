import React, { useState, useRef, useEffect } from 'react';
import { Hand, CodeXml, Map as MapIcon, Check, ChevronDown } from 'lucide-react';

/**
 * Three-mode picker for the Webpages AI chat. Mirrors Claude Code's mode
 * dropdown (Ask / Auto / Plan):
 *   ask  — AI proposes a plan before any change; user approves up front.
 *   auto — AI decides; small edits run directly, big changes get a plan.
 *   plan — AI explores and proposes a plan even for tiny work; nothing runs
 *          without explicit approval.
 *
 * Picker UX: single button showing the current mode, click to open a
 * popover panel. Persistence is owned by the parent (scopedStorage). This
 * component is purely presentational.
 */
const MODES = [
    {
        id: 'ask',
        label: 'Ask before edits',
        description: 'The AI proposes a plan listing every file it will touch, then waits for your approval before changing anything.',
        tooltip: 'Ask mode — propose a plan, wait for approval, then edit. Best when you want to review every change up front.',
        Icon: Hand,
    },
    {
        id: 'auto',
        label: 'Edit automatically',
        description: 'The AI edits files directly, no approval gate. You see each change as a diff card as it happens.',
        tooltip: 'Auto mode — edits run immediately, with diffs shown live. Fastest for iterating.',
        Icon: CodeXml,
    },
    {
        id: 'plan',
        label: 'Plan mode',
        description: 'Even for small changes, the AI explores files first and presents a plan. Nothing runs until you approve.',
        tooltip: 'Plan mode — exploration + approval gate even for tiny edits. Best for high-stakes refactors.',
        Icon: MapIcon,
    },
];

export default function WebpageChatModePicker({ value = 'auto', onChange }) {
    const [open, setOpen] = useState(false);
    const containerRef = useRef(null);

    useEffect(() => {
        if (!open) return;
        const onDocClick = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', onDocClick);
        return () => document.removeEventListener('mousedown', onDocClick);
    }, [open]);

    const current = MODES.find(m => m.id === value) || MODES[1];
    const CurrentIcon = current.Icon;

    return (
        <div ref={containerRef} className="relative">
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] hover:bg-[var(--vsc-hover-bg)] transition-colors"
                style={{ color: 'var(--vsc-fg-muted)' }}
                title={current.tooltip || `${current.label} — click to change`}
            >
                <CurrentIcon size={11} />
                <span className="truncate max-w-[80px]">{current.label}</span>
                <ChevronDown size={10} style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .12s' }} />
            </button>

            {open && (
                <div
                    className="absolute right-0 top-full mt-1 z-50 rounded-lg shadow-lg border overflow-hidden"
                    style={{
                        background: 'var(--bg-primary)',
                        borderColor: 'var(--border-subtle)',
                        width: 280,
                    }}
                >
                    <div
                        className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider border-b"
                        style={{ color: 'var(--text-tertiary)', borderColor: 'var(--border-subtle)' }}
                    >
                        Modes
                    </div>
                    {MODES.map(m => {
                        const Icon = m.Icon;
                        const selected = m.id === value;
                        return (
                            <button
                                key={m.id}
                                type="button"
                                onClick={() => { onChange?.(m.id); setOpen(false); }}
                                title={m.tooltip}
                                className="w-full flex items-start gap-2.5 px-3 py-2 text-left transition-colors hover:bg-[var(--bg-secondary)]"
                            >
                                <Icon size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--text-secondary)' }} />
                                <div className="flex-1 min-w-0">
                                    <div className="text-[12px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                                        {m.label}
                                    </div>
                                    <div className="text-[11px] leading-snug" style={{ color: 'var(--text-tertiary)' }}>
                                        {m.description}
                                    </div>
                                </div>
                                {selected && <Check size={13} className="mt-1 shrink-0" style={{ color: 'var(--accent-primary)' }} />}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
