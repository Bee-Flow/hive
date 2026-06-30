import React from 'react';
import { Award, Lock } from 'lucide-react';

/**
 * BadgeShelf — the achievements strip at the top of the Learning Center. Shows one
 * tile per course badge: earned tiles are full honey/amber; unearned tiles are a
 * greyed silhouette. (Certificates land in Phase 4 below this shelf.) No purple.
 */
export default function BadgeShelf({ courses, earnedBadgeIds, levelInfo, t }) {
    const total = courses.length;
    const earned = courses.filter((c) => earnedBadgeIds.has(c.badge?.id)).length;
    if (!total) return null;

    // Progress within the current level toward the next.
    const lvl = levelInfo?.level;
    const next = levelInfo?.next;
    const xp = levelInfo?.xp || 0;
    const spanStart = lvl?.min || 0;
    const spanEnd = next?.min ?? (spanStart + 1);
    const pct = next ? Math.max(0, Math.min(1, (xp - spanStart) / (spanEnd - spanStart))) : 1;

    return (
        <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)' }}>
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Award className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                    <h3 className="text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>
                        {t('learn.achievements.title', 'Your badges')}
                    </h3>
                </div>
                <span className="text-[12px] font-semibold tabular-nums" style={{ color: 'var(--text-tertiary)' }}>
                    {t('learn.achievements.count', '{a} of {b}').replace('{a}', String(earned)).replace('{b}', String(total))}
                </span>
            </div>

            {levelInfo && (
                <div className="mb-4">
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[12px] font-semibold inline-flex items-center gap-1.5" style={{ color: 'var(--accent-primary)' }}>
                            🐝 {t(`learn.level.${lvl?.key}`, lvl?.titleFallback)}
                        </span>
                        <span className="text-[11px] tabular-nums" style={{ color: 'var(--text-tertiary)' }}>
                            {next
                                ? t('learn.xp.to_next', '{xp} XP · {n} to {level}').replace('{xp}', String(xp)).replace('{n}', String(spanEnd - xp)).replace('{level}', t(`learn.level.${next.key}`, next.titleFallback))
                                : t('learn.xp.max', '{xp} XP · top level!').replace('{xp}', String(xp))}
                        </span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--border-subtle)' }}>
                        <div className="h-full rounded-full" style={{ width: `${pct * 100}%`, background: 'var(--accent-primary)', transition: 'width .4s ease' }} />
                    </div>
                </div>
            )}
            <div className="flex flex-wrap gap-3">
                {courses.map((c) => {
                    const has = earnedBadgeIds.has(c.badge?.id);
                    return (
                        <div key={c.badge?.id} className="flex flex-col items-center gap-1 w-[88px]" title={t(c.badge?.titleKey, c.badge?.titleFallback)}>
                            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl relative"
                                style={{
                                    background: has ? 'color-mix(in srgb, var(--accent-primary) 16%, transparent)' : 'var(--bg-tertiary)',
                                    border: has ? '1.5px solid var(--accent-primary)' : '1.5px dashed var(--border-default)',
                                    filter: has ? 'none' : 'grayscale(1)', opacity: has ? 1 : 0.5,
                                }}>
                                <span aria-hidden="true">{c.badge?.icon || '🏅'}</span>
                                {!has && (
                                    <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center"
                                        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                                        <Lock className="w-2.5 h-2.5" style={{ color: 'var(--text-tertiary)' }} />
                                    </span>
                                )}
                            </div>
                            <span className="text-[10.5px] font-medium text-center leading-tight" style={{ color: has ? 'var(--text-secondary)' : 'var(--text-tertiary)' }}>
                                {t(c.badge?.titleKey, c.badge?.titleFallback)}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
