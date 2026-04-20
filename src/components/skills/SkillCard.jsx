import React, { useState } from 'react';
import { Edit2, Trash2, Check, ChevronDown, ChevronUp, Users, Lock, Link2 } from 'lucide-react';

const TILE_GRADIENTS = [
    'linear-gradient(135deg, rgba(245,158,11,.25), rgba(251,191,36,.10))',
    'linear-gradient(135deg, rgba(59,130,246,.25), rgba(99,102,241,.10))',
    'linear-gradient(135deg, rgba(168,85,247,.25), rgba(217,70,239,.10))',
    'linear-gradient(135deg, rgba(16,185,129,.25), rgba(20,184,166,.10))',
    'linear-gradient(135deg, rgba(239,68,68,.25), rgba(244,114,182,.10))',
    'linear-gradient(135deg, rgba(14,165,233,.25), rgba(6,182,212,.10))',
];

function gradientFor(id) {
    if (!id) return TILE_GRADIENTS[0];
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    return TILE_GRADIENTS[h % TILE_GRADIENTS.length];
}

function FieldPreview({ label, value }) {
    return (
        <div>
            <div className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-tertiary)' }}>{label}</div>
            <p className="text-[12.5px] leading-relaxed whitespace-pre-wrap m-0" style={{ color: 'var(--text-secondary)' }}>{value}</p>
        </div>
    );
}

export default function SkillCard({
    skill,
    isOwner,
    isActive,
    onToggle,
    onEdit,
    onDelete,
    attachedAgentCount = 0,
    compact = false,
}) {
    const [expanded, setExpanded] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);

    return (
        <div
            className={`rounded-2xl border overflow-hidden transition-all ${isActive ? 'shadow-[0_0_0_3px_rgba(245,158,11,.12)]' : ''}`}
            style={{
                borderColor: isActive ? 'var(--accent-primary)' : 'var(--border-subtle)',
                background: isActive ? 'var(--bg-secondary)' : 'var(--bg-primary)',
                borderWidth: 1.5,
            }}
        >
            <div className="flex items-center gap-3 px-4 py-3.5">
                <div
                    className="w-[38px] h-[38px] rounded-[10px] flex items-center justify-center text-[18px] flex-shrink-0"
                    style={{ background: gradientFor(skill.id) }}
                >
                    {skill.icon || '⚡'}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-[14px] leading-tight" style={{ color: 'var(--text-primary)' }}>
                            {skill.name}
                        </span>
                        {skill.isShared ? (
                            <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded text-blue-500 bg-blue-500/10">
                                <Users size={9} /> shared
                            </span>
                        ) : (
                            <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' }}>
                                <Lock size={9} /> private
                            </span>
                        )}
                        {attachedAgentCount > 0 && (
                            <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded text-emerald-500 bg-emerald-500/10">
                                <Link2 size={9} /> attached to {attachedAgentCount}
                            </span>
                        )}
                    </div>
                    {skill.description && (
                        <p className="m-0 mt-0.5 text-[12px] leading-snug truncate" style={{ color: 'var(--text-secondary)' }}>
                            {skill.description}
                        </p>
                    )}
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                    {!compact && (
                        <button
                            onClick={() => setExpanded(v => !v)}
                            title="Show details"
                            className="w-7 h-7 rounded-md flex items-center justify-center transition-colors hover:bg-[var(--bg-tertiary)]"
                            style={{ color: 'var(--text-tertiary)' }}
                        >
                            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                    )}

                    {isOwner && !compact && (
                        <>
                            <button
                                onClick={() => onEdit?.(skill)}
                                title="Edit skill"
                                className="w-7 h-7 rounded-md flex items-center justify-center transition-colors hover:bg-[var(--bg-tertiary)]"
                                style={{ color: 'var(--text-tertiary)' }}
                            >
                                <Edit2 size={13} />
                            </button>
                            {confirmDelete ? (
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => onDelete?.(skill.id)}
                                        className="text-[11px] px-2 py-1 rounded-md font-semibold bg-red-500 text-white hover:bg-red-600"
                                    >
                                        Delete
                                    </button>
                                    <button
                                        onClick={() => setConfirmDelete(false)}
                                        className="text-[11px] px-1.5 py-1 rounded-md"
                                        style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setConfirmDelete(true)}
                                    title="Delete skill"
                                    className="w-7 h-7 rounded-md flex items-center justify-center transition-colors hover:bg-[var(--bg-tertiary)]"
                                    style={{ color: 'var(--text-tertiary)' }}
                                >
                                    <Trash2 size={13} />
                                </button>
                            )}
                        </>
                    )}

                    {onToggle && (
                        <button
                            onClick={() => onToggle?.(skill.id)}
                            title={isActive ? 'Deactivate skill' : 'Activate skill'}
                            className="h-7 px-3 rounded-lg text-[12px] font-semibold flex items-center gap-1.5 transition-colors"
                            style={{
                                background: isActive ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                                color: isActive ? '#fff' : 'var(--text-secondary)',
                            }}
                        >
                            {isActive ? (<><Check size={11} /> Active</>) : 'Use'}
                        </button>
                    )}
                </div>
            </div>

            {expanded && !compact && (
                <div className="border-t px-4 py-3 flex flex-col gap-2.5" style={{ borderColor: 'var(--border-subtle)' }}>
                    {skill.instructions && <FieldPreview label="Instructions" value={skill.instructions} />}
                    {skill.workflow && <FieldPreview label="Workflow" value={skill.workflow} />}
                    {skill.rules && <FieldPreview label="Rules" value={skill.rules} />}
                    {skill.examples && <FieldPreview label="Examples" value={skill.examples} />}
                </div>
            )}
        </div>
    );
}
