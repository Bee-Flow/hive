import React, { useState } from 'react';
import { Clock, Check, Play, RotateCcw, Lock, ChevronDown, BookOpen } from 'lucide-react';

// Course-completion ring (% of lessons done). Amber while in progress, green on
// completion. Never purple.
function ProgressRing({ done, total, complete }) {
    const r = 15;
    const c = 2 * Math.PI * r;
    const pct = total ? done / total : 0;
    const color = complete ? '#15803d' : 'var(--accent-primary)';
    return (
        <svg width="38" height="38" viewBox="0 0 38 38" aria-hidden="true">
            <circle cx="19" cy="19" r={r} fill="none" stroke="var(--border-subtle)" strokeWidth="3.5" />
            <circle cx="19" cy="19" r={r} fill="none" stroke={color} strokeWidth="3.5" strokeLinecap="round"
                strokeDasharray={`${pct * c} ${c}`} transform="rotate(-90 19 19)"
                style={{ transition: 'stroke-dasharray .4s ease' }} />
            <text x="19" y="23" textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--text-secondary)">
                {done}/{total}
            </text>
        </svg>
    );
}

const LEVEL_STYLE = {
    beginner: { bg: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' },
    intermediate: { bg: 'color-mix(in srgb, var(--accent-primary) 14%, transparent)', color: 'var(--accent-primary)' },
    advanced: { bg: 'color-mix(in srgb, var(--accent-primary) 24%, transparent)', color: 'var(--accent-primary)' },
};

/**
 * CourseCard — one course: progress ring, level chip, lesson count, badge state,
 * locked/prereq handling, and an expandable list of lessons to launch.
 */
export default function CourseCard({ course, lessons, completedMap, complete, locked, lockedReason, badgeEarned, estMinutes, onStartLesson, t }) {
    const [open, setOpen] = useState(false);
    const doneCount = lessons.filter((l) => !!completedMap[l.id]).length;
    const level = LEVEL_STYLE[course.level] || LEVEL_STYLE.beginner;

    return (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: complete ? 'color-mix(in srgb, #15803d 45%, var(--border-default))' : 'var(--border-default)', background: 'var(--bg-card)', opacity: locked ? 0.72 : 1 }}>
            <button type="button" onClick={() => !locked && setOpen((o) => !o)} disabled={locked}
                aria-expanded={open} aria-label={locked ? `${t(course.titleKey, course.titleFallback)} — ${lockedReason}` : undefined}
                className="w-full text-left p-4 flex items-start gap-3 disabled:cursor-not-allowed">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                    style={{ background: 'color-mix(in srgb, var(--accent-primary) 14%, transparent)' }} aria-hidden="true">
                    {course.icon}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-[15px] font-bold" style={{ color: 'var(--text-primary)' }}>
                            {t(course.titleKey, course.titleFallback)}
                        </h3>
                        <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ background: level.bg, color: level.color }}>
                            {t(`learn.level.${course.level}`, course.level)}
                        </span>
                        {badgeEarned && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded"
                                style={{ background: 'color-mix(in srgb, var(--accent-primary) 14%, transparent)', color: 'var(--accent-primary)' }}>
                                <span aria-hidden="true">{course.badge?.icon}</span> {t(course.badge?.titleKey, course.badge?.titleFallback)}
                            </span>
                        )}
                    </div>
                    <p className="text-[12.5px] mt-1 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                        {t(course.descKey, course.descFallback)}
                    </p>
                    <div className="mt-2 flex items-center gap-3 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                        <span className="inline-flex items-center gap-1"><BookOpen className="w-3 h-3" /> {t('learn.course.lesson_count', '{n} lessons').replace('{n}', String(lessons.length))}</span>
                        <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> {t('settings.learning_minutes', '{n} min').replace('{n}', String(estMinutes))}</span>
                        {locked && (
                            <span className="inline-flex items-center gap-1" style={{ color: 'var(--accent-primary)' }}>
                                <Lock className="w-3 h-3" /> {lockedReason}
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex flex-col items-center gap-1 flex-shrink-0">
                    <ProgressRing done={doneCount} total={lessons.length} complete={complete} />
                    {!locked && <ChevronDown className="w-4 h-4 transition-transform" style={{ color: 'var(--text-tertiary)', transform: open ? 'rotate(180deg)' : 'none' }} />}
                </div>
            </button>

            {open && !locked && (
                <div className="border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                    {lessons.map((lesson, i) => {
                        const done = !!completedMap[lesson.id];
                        return (
                            <div key={lesson.id} className="flex items-center gap-3 px-4 py-2.5"
                                style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border-subtle)' }}>
                                <span className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[13px]"
                                    style={{ background: done ? 'color-mix(in srgb, #22c55e 16%, transparent)' : 'var(--bg-tertiary)' }}>
                                    {done ? <Check className="w-3.5 h-3.5" style={{ color: '#15803d' }} /> : (lesson.icon || '•')}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <div className="text-[13px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                                        {t(lesson.titleKey, lesson.titleFallback)}
                                    </div>
                                    <div className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                                        {t('settings.learning_minutes', '{n} min').replace('{n}', String(lesson.estMinutes))}
                                    </div>
                                </div>
                                <button type="button" onClick={() => onStartLesson(lesson.id)}
                                    className="px-3 py-1.5 rounded-md text-[12px] font-semibold inline-flex items-center gap-1.5 transition-colors flex-shrink-0"
                                    style={done
                                        ? { borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-default)', color: 'var(--text-secondary)', background: 'transparent' }
                                        : { background: 'var(--accent-primary)', color: 'var(--accent-primary-fg, #fff)' }}>
                                    {done
                                        ? (<><RotateCcw className="w-3.5 h-3.5" /> {t('settings.learning_replay', 'Replay')}</>)
                                        : (<><Play className="w-3.5 h-3.5" /> {t('settings.learning_start', 'Start')}</>)}
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
