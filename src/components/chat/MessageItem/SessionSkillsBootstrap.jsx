import React, { useState } from 'react';
import { Puzzle, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';

/**
 * SessionSkillsBootstrap — slim card that sits above the assistant message
 * when the Standard tier auto-generated chat-local skills before answering.
 *
 * Two states:
 *   - state: 'pending'  — bootstrap call in flight; show spinner.
 *   - state: 'done'     — show "Created N chat-local skills" with an expandable
 *                          list of name + 1-line description per skill.
 */
export default function SessionSkillsBootstrap({ bootstrap }) {
    const [expanded, setExpanded] = useState(false);
    if (!bootstrap || (bootstrap.state !== 'pending' && bootstrap.state !== 'done')) return null;

    const skills = Array.isArray(bootstrap.skills) ? bootstrap.skills : [];
    const isPending = bootstrap.state === 'pending';

    return (
        <div
            className="mb-3 rounded-xl border px-3 py-2.5"
            style={{
                background: 'rgba(245, 158, 11, .06)',
                borderColor: 'rgba(245, 158, 11, .25)',
            }}
        >
            <button
                type="button"
                onClick={() => !isPending && skills.length > 0 && setExpanded(v => !v)}
                disabled={isPending || skills.length === 0}
                className="w-full flex items-center gap-2 text-left"
                style={{ color: 'var(--text-primary)' }}
            >
                <span
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(245,158,11,.15)' }}
                >
                    {isPending
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
                        : <Puzzle className="w-3.5 h-3.5 text-amber-500" />}
                </span>
                <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-semibold leading-tight">
                        {isPending
                            ? 'Preparing chat-local skills…'
                            : `Created ${skills.length} chat-local skill${skills.length === 1 ? '' : 's'} for this conversation`}
                    </div>
                    {!isPending && (
                        <div className="text-[10.5px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                            Activated automatically when relevant. Open the Skills popover to import any of them into your library.
                        </div>
                    )}
                </div>
                {!isPending && skills.length > 0 && (
                    <span className="flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>
                        {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </span>
                )}
            </button>

            {!isPending && expanded && skills.length > 0 && (
                <ul className="mt-2.5 space-y-1.5 border-t pt-2.5" style={{ borderColor: 'rgba(245,158,11,.18)' }}>
                    {skills.map(s => (
                        <li key={s.id} className="flex items-start gap-2 text-[11.5px]">
                            <span className="flex-shrink-0 w-4 text-center">{s.icon || '🧩'}</span>
                            <div className="min-w-0">
                                <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{s.name}</div>
                                {s.description && (
                                    <div className="leading-snug" style={{ color: 'var(--text-secondary)' }}>{s.description}</div>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
