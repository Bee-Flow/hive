import { Plus, ArrowLeft, ArrowUp, ArrowDown, Trash2, BookOpen, Globe, GlobeLock, Save } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { academyApi } from './academyApi';
import MarkdownRenderer from '../../../../components/MarkdownRenderer';
import { useTranslation } from '../../../../hooks/useTranslation';

/**
 * AcademyContentEditor — org-admin authoring surface for custom Academy
 * courses (Settings → Organisation → Academy → Content). Drafts are edited
 * here and only reach members after an explicit Publish, which snapshots the
 * course + lessons server-side (learningContentStore).
 *
 * Lessons are stored standalone on the server: saving a lesson is always
 * followed by a course save so the lesson id lands in the course's lessonIds
 * (see server/routes/ai/learningAdmin.js).
 */

// Mirrors server learningContentStore.LIMITS — the server is authoritative,
// these only keep the UI from offering inputs that would be rejected anyway.
const MAX_CHOICES = 6;
const MAX_CRITERIA = 6;
const MAX_STEPS = 30;
const MAX_LESSONS = 20;

const COURSE_EMOJIS = ['📘', '🐝', '🧭', '🛠️', '💬', '📊', '🔌', '🧠', '✍️', '🎯', '🤝', '🧩'];
const BADGE_EMOJIS = ['🏵️', '🏅', '🎖️', '🏆', '⭐', '🎓', '💎', '🚀', '🐝', '🧠', '🎯', '📘'];

let mintCounter = 0;
const mintLocalId = (prefix) => `${prefix}-${Date.now().toString(36)}-${(mintCounter += 1)}`;
// Temp ids mark lessons that exist only in the browser; the server mints the
// real 'orgl-…' id on first save and we swap it into the course order.
const isTempId = (id) => String(id || '').startsWith('tmp-');

/* ── Doc mapping ──────────────────────────────────────────────────────────── */

// Server LessonDocs store presentation fields with a Fallback suffix and the
// exercise grading data nested under `rubric`; map them back to the flat
// input shape validateLessonDoc accepts, so the editor round-trips cleanly.
function toEditableLesson(doc) {
    return {
        id: doc.id,
        title: doc.title || '',
        desc: doc.desc || '',
        icon: doc.icon || '📘',
        estMinutes: doc.estMinutes || 5,
        steps: (doc.steps || []).map((s) => {
            if (s.type === 'slide') {
                return { type: 'slide', id: s.id, icon: s.icon, title: s.titleFallback ?? s.title ?? '', bodyMd: s.bodyMdFallback ?? s.bodyMd ?? '' };
            }
            if (s.type === 'quiz') {
                return {
                    type: 'quiz', id: s.id, icon: s.icon,
                    title: s.titleFallback ?? s.title ?? '',
                    question: s.questionFallback ?? s.question ?? '',
                    multi: !!s.multi,
                    choices: (s.choices || []).map((c) => ({ id: c.id, label: c.labelFallback ?? c.label ?? '', correct: !!c.correct })),
                    explanation: s.explanationFallback ?? s.explanation ?? '',
                };
            }
            return {
                type: 'exercise', id: s.id, icon: s.icon,
                title: s.titleFallback ?? s.title ?? '',
                instruction: s.instructionFallback ?? s.instruction ?? '',
                placeholder: s.placeholderFallback ?? s.placeholder ?? '',
                maxAttempts: s.maxAttempts ?? 3,
                task: s.rubric?.task ?? s.task ?? '',
                criteria: (s.rubric?.criteria ?? s.criteria ?? ['']).slice(),
                passScore: s.rubric?.passScore ?? s.passScore ?? 70,
                guidance: s.rubric?.guidance ?? s.guidance ?? '',
            };
        }),
    };
}

function newStep(type) {
    const id = mintLocalId('s');
    if (type === 'slide') return { type, id, icon: '📘', title: '', bodyMd: '' };
    if (type === 'quiz') {
        return {
            type, id, icon: '❓', title: '', question: '', multi: false, explanation: '',
            choices: [
                { id: mintLocalId('c'), label: '', correct: true },
                { id: mintLocalId('c'), label: '', correct: false },
            ],
        };
    }
    return {
        type, id, icon: '✍️', title: '', instruction: '', placeholder: '',
        task: '', criteria: [''], passScore: 70, guidance: '', maxAttempts: 3,
    };
}

/* ── Small shared UI bits (house style: OrgAcademyPanel) ─────────────────── */

const inputClass = 'w-full px-3 py-2 rounded-lg border text-sm outline-none focus:border-[var(--accent-primary)]';
const inputStyle = { borderColor: 'var(--border-default)', background: 'var(--bg-card)', color: 'var(--text-primary)' };

const Field = ({ label, children, hint }) => (
    <div>
        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{label}</label>
        {children}
        {hint && <div className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>{hint}</div>}
    </div>
);

const ErrorText = ({ children }) => (
    children ? <div className="text-xs mt-2" style={{ color: '#dc2626' }} role="alert">{children}</div> : null
);

const PrimaryBtn = ({ children, ...props }) => (
    <button type="button" {...props}
        className="px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 transition-opacity hover:opacity-90 disabled:opacity-40"
        style={{ background: 'var(--accent-primary)', color: '#fff' }}>
        {children}
    </button>
);

const GhostBtn = ({ children, ...props }) => (
    <button type="button" {...props}
        className="px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 border transition-colors hover:bg-[var(--bg-tertiary)] disabled:opacity-40"
        style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)', background: 'transparent' }}>
        {children}
    </button>
);

const IconBtn = ({ title, disabled, onClick, children }) => (
    <button type="button" title={title} aria-label={title} disabled={disabled} onClick={onClick}
        className="w-7 h-7 rounded-md border flex items-center justify-center transition-colors hover:bg-[var(--bg-tertiary)] disabled:opacity-30"
        style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>
        {children}
    </button>
);

const EmojiRow = ({ value, onChange, emojis }) => (
    <div className="flex flex-wrap gap-1.5">
        {emojis.map((e) => (
            <button key={e} type="button" onClick={() => onChange(e)} aria-pressed={value === e}
                className="w-9 h-9 rounded-lg border text-lg flex items-center justify-center transition-colors hover:bg-[var(--bg-tertiary)]"
                style={{
                    borderColor: value === e ? 'var(--accent-primary)' : 'var(--border-default)',
                    background: value === e ? 'color-mix(in srgb, var(--accent-primary) 12%, transparent)' : 'var(--bg-card)',
                }}>
                {e}
            </button>
        ))}
    </div>
);

const StatusChip = ({ status, t }) => (
    status === 'published' ? (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
            style={{ background: 'color-mix(in srgb, #059669 15%, transparent)', color: '#059669' }}>
            {t('org.academy.content.published', 'Published')}
        </span>
    ) : (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
            style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
            {t('org.academy.content.draft', 'Draft')}
        </span>
    )
);

/* ── Step forms ──────────────────────────────────────────────────────────── */

function SlideForm({ step, onChange, t }) {
    return (
        <div className="space-y-3">
            <Field label={t('org.academy.content.step_title', 'Title')}>
                <input className={inputClass} style={inputStyle} value={step.title}
                    onChange={(e) => onChange({ title: e.target.value })} />
            </Field>
            <Field label={t('org.academy.content.slide_body', 'Body (Markdown)')}>
                <textarea className={inputClass} style={{ ...inputStyle, minHeight: 140, fontFamily: 'monospace' }} value={step.bodyMd}
                    onChange={(e) => onChange({ bodyMd: e.target.value })} />
            </Field>
            {step.bodyMd.trim() && (
                <Field label={t('org.academy.content.preview', 'Preview')}>
                    <div className="rounded-lg border p-3 text-sm" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                        <MarkdownRenderer content={step.bodyMd} />
                    </div>
                </Field>
            )}
        </div>
    );
}

function QuizForm({ step, onChange, t }) {
    const setChoice = (idx, patch) => {
        let choices = step.choices.map((c, i) => (i === idx ? { ...c, ...patch } : c));
        // Single-answer quizzes keep exactly one correct choice.
        if (patch.correct && !step.multi) {
            choices = choices.map((c, i) => ({ ...c, correct: i === idx }));
        }
        onChange({ choices });
    };
    return (
        <div className="space-y-3">
            <Field label={t('org.academy.content.step_title', 'Title')}>
                <input className={inputClass} style={inputStyle} value={step.title}
                    placeholder={t('org.academy.content.quiz_title_ph', 'Quick check')}
                    onChange={(e) => onChange({ title: e.target.value })} />
            </Field>
            <Field label={t('org.academy.content.quiz_question', 'Question')}>
                <input className={inputClass} style={inputStyle} value={step.question}
                    onChange={(e) => onChange({ question: e.target.value })} />
            </Field>
            <Field label={t('org.academy.content.quiz_choices', 'Choices (2–6, tick the correct ones)')}>
                <div className="space-y-1.5">
                    {step.choices.map((c, idx) => (
                        <div key={c.id} className="flex items-center gap-2">
                            <input type="checkbox" checked={c.correct} className="accent-[#059669]"
                                title={t('org.academy.content.quiz_correct', 'Correct answer')}
                                onChange={(e) => setChoice(idx, { correct: e.target.checked })} />
                            <input className={inputClass} style={inputStyle} value={c.label}
                                placeholder={`${t('org.academy.content.quiz_choice', 'Choice')} ${idx + 1}`}
                                onChange={(e) => setChoice(idx, { label: e.target.value })} />
                            <IconBtn title={t('org.academy.content.remove', 'Remove')}
                                disabled={step.choices.length <= 2}
                                onClick={() => onChange({ choices: step.choices.filter((_, i) => i !== idx) })}>
                                <Trash2 className="w-3.5 h-3.5" />
                            </IconBtn>
                        </div>
                    ))}
                </div>
                {step.choices.length < MAX_CHOICES && (
                    <button type="button" className="mt-1.5 text-xs font-medium hover:underline" style={{ color: 'var(--accent-primary)' }}
                        onClick={() => onChange({ choices: [...step.choices, { id: mintLocalId('c'), label: '', correct: false }] })}>
                        + {t('org.academy.content.add_choice', 'Add choice')}
                    </button>
                )}
            </Field>
            <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <input type="checkbox" checked={step.multi} className="accent-[#059669]"
                    onChange={(e) => onChange({ multi: e.target.checked })} />
                {t('org.academy.content.quiz_multi', 'Multiple answers can be correct')}
            </label>
            <Field label={t('org.academy.content.quiz_explanation', 'Explanation (shown after answering)')}>
                <input className={inputClass} style={inputStyle} value={step.explanation}
                    onChange={(e) => onChange({ explanation: e.target.value })} />
            </Field>
        </div>
    );
}

function ExerciseForm({ step, onChange, t }) {
    const setCriterion = (idx, value) => onChange({ criteria: step.criteria.map((c, i) => (i === idx ? value : c)) });
    return (
        <div className="space-y-3">
            <Field label={t('org.academy.content.step_title', 'Title')}>
                <input className={inputClass} style={inputStyle} value={step.title}
                    placeholder={t('org.academy.content.exercise_title_ph', 'Hands-on practice')}
                    onChange={(e) => onChange({ title: e.target.value })} />
            </Field>
            <Field label={t('org.academy.content.exercise_task', 'Task (what the learner must do)')}>
                <textarea className={inputClass} style={{ ...inputStyle, minHeight: 64 }} value={step.task}
                    onChange={(e) => onChange({ task: e.target.value })} />
            </Field>
            <Field label={t('org.academy.content.exercise_instruction', 'Instruction (shown above the answer box)')}>
                <input className={inputClass} style={inputStyle} value={step.instruction}
                    onChange={(e) => onChange({ instruction: e.target.value })} />
            </Field>
            <Field label={t('org.academy.content.exercise_placeholder', 'Answer box placeholder')}>
                <input className={inputClass} style={inputStyle} value={step.placeholder}
                    onChange={(e) => onChange({ placeholder: e.target.value })} />
            </Field>
            <Field label={t('org.academy.content.exercise_criteria', 'Grading criteria (private, max 6)')}
                hint={t('org.academy.content.exercise_criteria_hint', 'The AI coach grades against these. Learners never see them.')}>
                <div className="space-y-1.5">
                    {step.criteria.map((c, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                            <input className={inputClass} style={inputStyle} value={c}
                                placeholder={`${t('org.academy.content.exercise_criterion', 'Criterion')} ${idx + 1}`}
                                onChange={(e) => setCriterion(idx, e.target.value)} />
                            <IconBtn title={t('org.academy.content.remove', 'Remove')}
                                disabled={step.criteria.length <= 1}
                                onClick={() => onChange({ criteria: step.criteria.filter((_, i) => i !== idx) })}>
                                <Trash2 className="w-3.5 h-3.5" />
                            </IconBtn>
                        </div>
                    ))}
                </div>
                {step.criteria.length < MAX_CRITERIA && (
                    <button type="button" className="mt-1.5 text-xs font-medium hover:underline" style={{ color: 'var(--accent-primary)' }}
                        onClick={() => onChange({ criteria: [...step.criteria, ''] })}>
                        + {t('org.academy.content.add_criterion', 'Add criterion')}
                    </button>
                )}
            </Field>
            <div className="grid grid-cols-2 gap-3">
                <Field label={t('org.academy.content.exercise_pass_score', 'Pass score (1–100)')}>
                    <input type="number" min={1} max={100} className={inputClass} style={inputStyle} value={step.passScore}
                        onChange={(e) => onChange({ passScore: e.target.value === '' ? '' : Number(e.target.value) })} />
                </Field>
                <Field label={t('org.academy.content.exercise_max_attempts', 'Max attempts (1–10)')}>
                    <input type="number" min={1} max={10} className={inputClass} style={inputStyle} value={step.maxAttempts}
                        onChange={(e) => onChange({ maxAttempts: e.target.value === '' ? '' : Number(e.target.value) })} />
                </Field>
            </div>
            <Field label={t('org.academy.content.exercise_guidance', 'Grading guidance (private note to the AI coach)')}>
                <textarea className={inputClass} style={{ ...inputStyle, minHeight: 56 }} value={step.guidance}
                    onChange={(e) => onChange({ guidance: e.target.value })} />
            </Field>
        </div>
    );
}

const STEP_META = {
    slide: { icon: '📘', labelKey: 'org.academy.content.step_slide', labelFallback: 'Slide' },
    quiz: { icon: '❓', labelKey: 'org.academy.content.step_quiz', labelFallback: 'Quiz' },
    exercise: { icon: '✍️', labelKey: 'org.academy.content.step_exercise', labelFallback: 'Exercise' },
};

function StepEditor({ step, index, count, onChange, onMove, onDelete, t }) {
    const meta = STEP_META[step.type];
    return (
        <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)' }}>
            <div className="flex items-center gap-2 mb-3">
                <span className="text-base" aria-hidden="true">{meta.icon}</span>
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                    {index + 1}. {t(meta.labelKey, meta.labelFallback)}
                </span>
                <div className="ml-auto flex items-center gap-1">
                    <IconBtn title={t('org.academy.content.move_up', 'Move up')} disabled={index === 0} onClick={() => onMove(index, -1)}>
                        <ArrowUp className="w-3.5 h-3.5" />
                    </IconBtn>
                    <IconBtn title={t('org.academy.content.move_down', 'Move down')} disabled={index === count - 1} onClick={() => onMove(index, 1)}>
                        <ArrowDown className="w-3.5 h-3.5" />
                    </IconBtn>
                    <IconBtn title={t('org.academy.content.delete_step', 'Delete step')} onClick={() => onDelete(index)}>
                        <Trash2 className="w-3.5 h-3.5" />
                    </IconBtn>
                </div>
            </div>
            {step.type === 'slide' && <SlideForm step={step} onChange={onChange} t={t} />}
            {step.type === 'quiz' && <QuizForm step={step} onChange={onChange} t={t} />}
            {step.type === 'exercise' && <ExerciseForm step={step} onChange={onChange} t={t} />}
        </div>
    );
}

/* ── Lesson editor ───────────────────────────────────────────────────────── */

function LessonEditor({ lesson, onChange, onSave, onBack, busy, error, notice, t }) {
    const patch = (p) => onChange({ ...lesson, ...p });
    const patchStep = (idx, p) => patch({ steps: lesson.steps.map((s, i) => (i === idx ? { ...s, ...p } : s)) });
    const moveStep = (idx, dir) => {
        const next = lesson.steps.slice();
        const j = idx + dir;
        if (j < 0 || j >= next.length) return;
        [next[idx], next[j]] = [next[j], next[idx]];
        patch({ steps: next });
    };
    const deleteStep = (idx) => {
        if (!window.confirm(t('org.academy.content.confirm_delete_step', 'Delete this step?'))) return;
        patch({ steps: lesson.steps.filter((_, i) => i !== idx) });
    };

    return (
        <div>
            <div className="flex items-center gap-2 mb-4">
                <GhostBtn onClick={onBack}>
                    <ArrowLeft className="w-3.5 h-3.5" />
                    {t('org.academy.content.back_to_course', 'Back to course')}
                </GhostBtn>
                <div className="ml-auto flex items-center gap-2">
                    {notice && <span className="text-xs" style={{ color: '#059669' }}>{notice}</span>}
                    <PrimaryBtn onClick={onSave} disabled={busy}>
                        <Save className="w-3.5 h-3.5" />
                        {t('org.academy.content.save_lesson', 'Save lesson')}
                    </PrimaryBtn>
                </div>
            </div>

            <div className="rounded-xl border p-4 mb-4 space-y-3" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)' }}>
                <div className="grid md:grid-cols-2 gap-3">
                    <Field label={t('org.academy.content.lesson_title', 'Lesson title')}>
                        <input className={inputClass} style={inputStyle} value={lesson.title}
                            onChange={(e) => patch({ title: e.target.value })} />
                    </Field>
                    <Field label={t('org.academy.content.lesson_minutes', 'Estimated minutes')}>
                        <input type="number" min={1} max={120} className={inputClass} style={inputStyle} value={lesson.estMinutes}
                            onChange={(e) => patch({ estMinutes: e.target.value === '' ? '' : Number(e.target.value) })} />
                    </Field>
                </div>
                <Field label={t('org.academy.content.lesson_desc', 'Description')}>
                    <textarea className={inputClass} style={{ ...inputStyle, minHeight: 56 }} value={lesson.desc}
                        onChange={(e) => patch({ desc: e.target.value })} />
                </Field>
                <Field label={t('org.academy.content.lesson_icon', 'Icon')}>
                    <EmojiRow value={lesson.icon} onChange={(icon) => patch({ icon })} emojis={COURSE_EMOJIS} />
                </Field>
            </div>

            <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {t('org.academy.content.steps', 'Steps')}
                </span>
                {lesson.steps.length < MAX_STEPS && (
                    <div className="ml-auto flex items-center gap-1.5">
                        {Object.keys(STEP_META).map((type) => (
                            <GhostBtn key={type} onClick={() => patch({ steps: [...lesson.steps, newStep(type)] })}>
                                <Plus className="w-3.5 h-3.5" />
                                {t(STEP_META[type].labelKey, STEP_META[type].labelFallback)}
                            </GhostBtn>
                        ))}
                    </div>
                )}
            </div>

            {lesson.steps.length === 0 ? (
                <div className="rounded-xl border p-6 text-sm text-center" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)', color: 'var(--text-muted)' }}>
                    {t('org.academy.content.no_steps', 'No steps yet — add a slide, quiz or exercise above.')}
                </div>
            ) : (
                <div className="space-y-3">
                    {lesson.steps.map((step, idx) => (
                        <StepEditor key={step.id} step={step} index={idx} count={lesson.steps.length}
                            onChange={(p) => patchStep(idx, p)} onMove={moveStep} onDelete={deleteStep} t={t} />
                    ))}
                </div>
            )}
            <ErrorText>{error}</ErrorText>
        </div>
    );
}

/* ── Main component ──────────────────────────────────────────────────────── */

export default function AcademyContentEditor() {
    const { t } = useTranslation();
    const [courses, setCourses] = useState(null);
    const [loadingList, setLoadingList] = useState(true);
    const [course, setCourse] = useState(null);      // editable course, id=null until first save
    const [lessons, setLessons] = useState({});      // lessonId → editable lesson
    const [activeLessonId, setActiveLessonId] = useState(null);
    const [status, setStatus] = useState('draft');   // publish status of the open course
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [notice, setNotice] = useState(null);

    const loadList = useCallback(async () => {
        setLoadingList(true);
        setError(null);
        try {
            const data = await academyApi.listCourses();
            setCourses(data.courses || []);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoadingList(false);
        }
    }, []);

    useEffect(() => { loadList(); }, [loadList]);

    useEffect(() => {
        if (!notice) return undefined;
        const timer = setTimeout(() => setNotice(null), 2500);
        return () => clearTimeout(timer);
    }, [notice]);

    const openCourse = async (entry) => {
        setBusy(true);
        setError(null);
        try {
            const data = await academyApi.getCourse(entry.courseId);
            const c = data.course;
            setCourse({
                id: c.id, title: c.title || '', desc: c.desc || '', icon: c.icon || '📘',
                level: c.level || 'beginner', lessonIds: (c.lessonIds || []).slice(),
                badgeTitle: c.badge?.title || '', badgeIcon: c.badge?.icon || '🏵️',
            });
            const map = {};
            for (const l of data.lessons || []) map[l.id] = toEditableLesson(l);
            setLessons(map);
            setStatus(entry.status || 'draft');
            setActiveLessonId(null);
        } catch (e) {
            setError(e.message);
        } finally {
            setBusy(false);
        }
    };

    const newCourse = () => {
        setCourse({ id: null, title: '', desc: '', icon: '📘', level: 'beginner', lessonIds: [], badgeTitle: '', badgeIcon: '🏵️' });
        setLessons({});
        setStatus('draft');
        setActiveLessonId(null);
        setError(null);
    };

    const closeCourse = () => {
        setCourse(null);
        setActiveLessonId(null);
        setError(null);
        loadList();
    };

    // PUT (or POST when no id yet); returns the saved CourseDoc. Temp lesson
    // ids are local-only and stripped — they're attached on lesson save.
    const persistCourse = async (c) => {
        const body = {
            title: c.title, desc: c.desc, icon: c.icon, level: c.level,
            lessonIds: c.lessonIds.filter((id) => !isTempId(id)),
            badgeTitle: c.badgeTitle, badgeIcon: c.badgeIcon,
        };
        const data = c.id ? await academyApi.saveCourse(c.id, body) : await academyApi.createCourse(body);
        return data.course;
    };

    const handleSaveCourse = async () => {
        setBusy(true);
        setError(null);
        try {
            const doc = await persistCourse(course);
            setCourse((prev) => ({ ...prev, id: doc.id }));
            setNotice(t('org.academy.content.saved', 'Saved'));
        } catch (e) {
            setError(e.message);
        } finally {
            setBusy(false);
        }
    };

    // Save the open lesson, then the course — the lesson doc is standalone on
    // the server, so the course's lessonIds must be updated to attach it.
    const handleSaveLesson = async () => {
        const draft = lessons[activeLessonId];
        if (!draft) return;
        setBusy(true);
        setError(null);
        try {
            let c = course;
            if (!c.id) c = { ...c, id: (await persistCourse(c)).id };
            const isNew = isTempId(draft.id);
            const data = await academyApi.saveLesson(isNew ? 'new' : draft.id, { ...draft, id: isNew ? undefined : draft.id });
            const saved = data.lesson;
            let lessonIds = c.lessonIds.map((id) => (id === draft.id ? saved.id : id));
            if (!lessonIds.includes(saved.id)) lessonIds = [...lessonIds, saved.id];
            c = { ...c, lessonIds };
            await persistCourse(c);
            setCourse(c);
            setLessons((prev) => {
                const next = { ...prev };
                delete next[draft.id];
                next[saved.id] = toEditableLesson(saved);
                return next;
            });
            setActiveLessonId(saved.id);
            setNotice(t('org.academy.content.lesson_saved', 'Lesson saved'));
        } catch (e) {
            setError(e.message);
        } finally {
            setBusy(false);
        }
    };

    const addLesson = () => {
        const id = mintLocalId('tmp');
        setLessons((prev) => ({ ...prev, [id]: { id, title: '', desc: '', icon: '📘', estMinutes: 5, steps: [] } }));
        setCourse((prev) => ({ ...prev, lessonIds: [...prev.lessonIds, id] }));
        setActiveLessonId(id);
        setError(null);
    };

    const moveLesson = (idx, dir) => {
        setCourse((prev) => {
            const ids = prev.lessonIds.slice();
            const j = idx + dir;
            if (j < 0 || j >= ids.length) return prev;
            [ids[idx], ids[j]] = [ids[j], ids[idx]];
            return { ...prev, lessonIds: ids };
        });
    };

    const deleteLesson = async (lessonId) => {
        if (!window.confirm(t('org.academy.content.confirm_delete_lesson', 'Remove this lesson from the course?'))) return;
        const c = { ...course, lessonIds: course.lessonIds.filter((id) => id !== lessonId) };
        setCourse(c);
        setLessons((prev) => {
            const next = { ...prev };
            delete next[lessonId];
            return next;
        });
        if (c.id && !isTempId(lessonId)) {
            try { await persistCourse(c); } catch (e) { setError(e.message); }
        }
    };

    const handleDeleteCourse = async () => {
        if (!window.confirm(t('org.academy.content.confirm_delete_course', 'Delete this course and all its lessons? This also removes it for members.'))) return;
        setBusy(true);
        setError(null);
        try {
            if (course.id) await academyApi.deleteCourse(course.id);
            closeCourse();
        } catch (e) {
            setError(e.message);
        } finally {
            setBusy(false);
        }
    };

    const handlePublish = async () => {
        setBusy(true);
        setError(null);
        try {
            const doc = await persistCourse(course);
            setCourse((prev) => ({ ...prev, id: doc.id }));
            await academyApi.publishCourse(doc.id);
            setStatus('published');
            setNotice(t('org.academy.content.published_notice', 'Published — members can now see this course.'));
        } catch (e) {
            setError(e.message);
        } finally {
            setBusy(false);
        }
    };

    const handleUnpublish = async () => {
        setBusy(true);
        setError(null);
        try {
            await academyApi.unpublishCourse(course.id);
            setStatus('draft');
            setNotice(t('org.academy.content.unpublished_notice', 'Unpublished — hidden from members again.'));
        } catch (e) {
            setError(e.message);
        } finally {
            setBusy(false);
        }
    };

    /* ── Lesson editor view ── */
    if (course && activeLessonId && lessons[activeLessonId]) {
        return (
            <LessonEditor lesson={lessons[activeLessonId]} busy={busy} error={error} notice={notice} t={t}
                onChange={(l) => setLessons((prev) => ({ ...prev, [activeLessonId]: l }))}
                onSave={handleSaveLesson}
                onBack={() => { setActiveLessonId(null); setError(null); }} />
        );
    }

    /* ── Course edit view ── */
    if (course) {
        return (
            <div>
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                    <GhostBtn onClick={closeCourse}>
                        <ArrowLeft className="w-3.5 h-3.5" />
                        {t('org.academy.content.back_to_courses', 'All courses')}
                    </GhostBtn>
                    <StatusChip status={status} t={t} />
                    <div className="ml-auto flex items-center gap-2 flex-wrap">
                        {notice && <span className="text-xs" style={{ color: '#059669' }}>{notice}</span>}
                        <GhostBtn onClick={handleDeleteCourse} disabled={busy}>
                            <Trash2 className="w-3.5 h-3.5" />
                            {t('org.academy.content.delete_course', 'Delete')}
                        </GhostBtn>
                        {status === 'published' ? (
                            <GhostBtn onClick={handleUnpublish} disabled={busy || !course.id}>
                                <GlobeLock className="w-3.5 h-3.5" />
                                {t('org.academy.content.unpublish', 'Unpublish')}
                            </GhostBtn>
                        ) : (
                            <button type="button" onClick={handlePublish} disabled={busy}
                                className="px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 transition-opacity hover:opacity-90 disabled:opacity-40"
                                style={{ background: '#059669', color: '#fff' }}>
                                <Globe className="w-3.5 h-3.5" />
                                {t('org.academy.content.publish', 'Publish')}
                            </button>
                        )}
                        <PrimaryBtn onClick={handleSaveCourse} disabled={busy}>
                            <Save className="w-3.5 h-3.5" />
                            {t('org.academy.content.save_course', 'Save course')}
                        </PrimaryBtn>
                    </div>
                </div>

                <div className="rounded-xl border p-4 mb-4 space-y-3" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)' }}>
                    <div className="grid md:grid-cols-2 gap-3">
                        <Field label={t('org.academy.content.course_title', 'Course title')}>
                            <input className={inputClass} style={inputStyle} value={course.title}
                                onChange={(e) => setCourse((prev) => ({ ...prev, title: e.target.value }))} />
                        </Field>
                        <Field label={t('org.academy.content.course_level', 'Level')}>
                            <select className={inputClass} style={inputStyle} value={course.level}
                                onChange={(e) => setCourse((prev) => ({ ...prev, level: e.target.value }))}>
                                <option value="beginner">{t('org.academy.content.level_beginner', 'Beginner')}</option>
                                <option value="intermediate">{t('org.academy.content.level_intermediate', 'Intermediate')}</option>
                                <option value="advanced">{t('org.academy.content.level_advanced', 'Advanced')}</option>
                            </select>
                        </Field>
                    </div>
                    <Field label={t('org.academy.content.course_desc', 'Description')}>
                        <textarea className={inputClass} style={{ ...inputStyle, minHeight: 56 }} value={course.desc}
                            onChange={(e) => setCourse((prev) => ({ ...prev, desc: e.target.value }))} />
                    </Field>
                    <Field label={t('org.academy.content.course_icon', 'Icon')}>
                        <EmojiRow value={course.icon} onChange={(icon) => setCourse((prev) => ({ ...prev, icon }))} emojis={COURSE_EMOJIS} />
                    </Field>
                    <div className="grid md:grid-cols-2 gap-3">
                        <Field label={t('org.academy.content.badge_title', 'Badge title (earned on completion)')}>
                            <input className={inputClass} style={inputStyle} value={course.badgeTitle}
                                placeholder={course.title || undefined}
                                onChange={(e) => setCourse((prev) => ({ ...prev, badgeTitle: e.target.value }))} />
                        </Field>
                        <Field label={t('org.academy.content.badge_icon', 'Badge emoji')}>
                            <EmojiRow value={course.badgeIcon} onChange={(badgeIcon) => setCourse((prev) => ({ ...prev, badgeIcon }))} emojis={BADGE_EMOJIS} />
                        </Field>
                    </div>
                </div>

                <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {t('org.academy.content.lessons', 'Lessons')}
                    </span>
                    {course.lessonIds.length < MAX_LESSONS && (
                        <div className="ml-auto">
                            <GhostBtn onClick={addLesson}>
                                <Plus className="w-3.5 h-3.5" />
                                {t('org.academy.content.add_lesson', 'Add lesson')}
                            </GhostBtn>
                        </div>
                    )}
                </div>

                <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)' }}>
                    {course.lessonIds.length === 0 ? (
                        <div className="p-6 text-sm text-center" style={{ color: 'var(--text-muted)' }}>
                            {t('org.academy.content.no_lessons', 'No lessons yet — a course needs at least one lesson before publishing.')}
                        </div>
                    ) : (
                        <div className="divide-y divide-[var(--border-subtle)]">
                            {course.lessonIds.map((lessonId, idx) => {
                                const lesson = lessons[lessonId];
                                return (
                                    <div key={lessonId} className="px-4 py-2.5 flex items-center gap-3 hover:bg-[var(--bg-secondary)] transition-colors">
                                        <span className="text-lg" aria-hidden="true">{lesson?.icon || '📘'}</span>
                                        <button type="button" className="flex-1 min-w-0 text-left"
                                            onClick={() => { setActiveLessonId(lessonId); setError(null); }}>
                                            <span className="text-sm font-medium block truncate" style={{ color: 'var(--text-primary)' }}>
                                                {lesson?.title || t('org.academy.content.untitled_lesson', 'Untitled lesson')}
                                            </span>
                                            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                                {isTempId(lessonId)
                                                    ? t('org.academy.content.not_saved', 'Not saved yet')
                                                    : `${lesson?.steps?.length ?? 0} ${t('org.academy.content.steps_count', 'steps')} · ${lesson?.estMinutes ?? '—'} ${t('org.academy.content.minutes_short', 'min')}`}
                                            </span>
                                        </button>
                                        <IconBtn title={t('org.academy.content.move_up', 'Move up')} disabled={idx === 0} onClick={() => moveLesson(idx, -1)}>
                                            <ArrowUp className="w-3.5 h-3.5" />
                                        </IconBtn>
                                        <IconBtn title={t('org.academy.content.move_down', 'Move down')} disabled={idx === course.lessonIds.length - 1} onClick={() => moveLesson(idx, 1)}>
                                            <ArrowDown className="w-3.5 h-3.5" />
                                        </IconBtn>
                                        <IconBtn title={t('org.academy.content.delete_lesson', 'Delete lesson')} onClick={() => deleteLesson(lessonId)}>
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </IconBtn>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
                <ErrorText>{error}</ErrorText>
            </div>
        );
    }

    /* ── Course list view ── */
    return (
        <div>
            <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <BookOpen className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
                        <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {t('org.academy.content.title', 'Custom courses')}
                        </h2>
                    </div>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                        {t('org.academy.content.subtitle', 'Author your own Academy courses. Drafts stay private until you publish them to your members.')}
                    </p>
                </div>
                <PrimaryBtn onClick={newCourse}>
                    <Plus className="w-3.5 h-3.5" />
                    {t('org.academy.content.new_course', 'New course')}
                </PrimaryBtn>
            </div>

            <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)' }}>
                {loadingList ? (
                    <div className="animate-pulse space-y-2 p-5">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="h-10 rounded-lg" style={{ background: 'var(--bg-tertiary)' }} />
                        ))}
                    </div>
                ) : !courses || courses.length === 0 ? (
                    <div className="p-8 text-sm text-center" style={{ color: 'var(--text-muted)' }}>
                        {t('org.academy.content.empty', 'No custom courses yet — create your first one.')}
                    </div>
                ) : (
                    <div className="divide-y divide-[var(--border-subtle)]">
                        {courses.map((entry) => (
                            <button key={entry.courseId} type="button" onClick={() => openCourse(entry)} disabled={busy}
                                className="w-full px-5 py-3 flex items-center gap-3 text-left hover:bg-[var(--bg-secondary)] transition-colors disabled:opacity-60">
                                <span className="text-sm font-medium flex-1 min-w-0 truncate" style={{ color: 'var(--text-primary)' }}>
                                    {entry.title}
                                </span>
                                <StatusChip status={entry.status} t={t} />
                                <span className="text-[11px] w-24 text-right flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                                    {entry.updatedAt ? new Date(entry.updatedAt).toLocaleDateString() : '—'}
                                </span>
                            </button>
                        ))}
                    </div>
                )}
            </div>
            <ErrorText>{error}</ErrorText>
        </div>
    );
}
