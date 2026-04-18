import React, { useMemo } from 'react';
import { X, Lock } from 'lucide-react';
import { useSkills } from '../../hooks/useSkills';

/**
 * ActiveSkillChips — thin strip of pills above the composer showing which
 * skills will be applied to the next message. Attached skills (from the
 * agent's config) render with a lock and cannot be removed from here.
 * Session-active skills render with an × that calls onToggleSkill.
 */
export default function ActiveSkillChips({
    activeSkillIds = [],
    attachedSkillIds = [],
    onToggleSkill,
    hasThreadBanner = false,
    hasAttachments = false,
}) {
    const { skills } = useSkills();

    const chips = useMemo(() => {
        const attachedSet = new Set(attachedSkillIds);
        const seen = new Set();
        const byId = new Map(skills.map(s => [s.id, s]));
        const out = [];
        // Attached first, then session-only
        for (const id of attachedSkillIds) {
            if (seen.has(id)) continue;
            seen.add(id);
            const s = byId.get(id);
            if (s) out.push({ skill: s, attached: true });
        }
        for (const id of activeSkillIds) {
            if (seen.has(id) || attachedSet.has(id)) continue;
            seen.add(id);
            const s = byId.get(id);
            if (s) out.push({ skill: s, attached: false });
        }
        return out;
    }, [activeSkillIds, attachedSkillIds, skills]);

    if (chips.length === 0) return null;

    const topRounding = hasThreadBanner || hasAttachments ? '' : 'rounded-t-xl';

    return (
        <div className={`flex flex-wrap gap-1.5 bg-[var(--bg-secondary)] px-3 py-2 border-x border-t border-[var(--border-subtle)] ${topRounding}`}>
            {chips.map(({ skill, attached }) => (
                <div
                    key={skill.id}
                    className="flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-full text-[11px] border"
                    style={{
                        background: 'rgba(245,158,11,.08)',
                        borderColor: 'rgba(245,158,11,.3)',
                        color: 'var(--text-primary)',
                    }}
                    title={attached ? `${skill.name} — attached to this agent` : `${skill.name} — active for this chat`}
                >
                    <span className="text-[13px] leading-none">{skill.icon || '⚡'}</span>
                    <span className="font-medium truncate max-w-[140px]">{skill.name}</span>
                    {attached ? (
                        <span className="ml-0.5 p-0.5 text-[var(--text-tertiary)]" aria-label="Attached by agent">
                            <Lock className="w-2.5 h-2.5" />
                        </span>
                    ) : (
                        <button
                            onClick={() => onToggleSkill?.(skill.id)}
                            className="ml-0.5 p-0.5 rounded-full text-[var(--text-tertiary)] hover:text-red-500 hover:bg-white/30 transition-colors"
                            aria-label={`Deactivate ${skill.name}`}
                            title="Deactivate"
                        >
                            <X className="w-2.5 h-2.5" />
                        </button>
                    )}
                </div>
            ))}
        </div>
    );
}
