import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { GraduationCap, RotateCcw, ArrowRight, Compass } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { useLicenseContext } from '../../components/LicenseContext';
import { API_BASE, authFetch } from '../../utils/helpers';
import {
    LESSON_COMPLETE_EVENT,
    LESSON_PLAYER_OPEN_EVENT,
    registerServerLessons,
} from '../../components/onboarding/lessons';
import { TOUR_START_EVENT } from '../../components/onboarding/tourSteps';
import {
    readCompletedMap,
    lessonEntryComplete,
    resetLearningProgress,
} from '../../components/onboarding/learningProgress';
import {
    resolveCourses,
    courseLessons,
    courseEstMinutes,
    isCourseComplete,
    completedCourseIds,
    courseLocked,
    earnedBadgesFromProgress,
    xpFromProgress,
    getCourse,
    applyServerCatalog,
    catalogVersion,
} from '../../components/onboarding/courses';
import { fetchCatalog } from '../../components/onboarding/catalogClient';
import { fetchAchievements, issueCertificate } from '../../components/onboarding/achievements';
import CourseCard from './learning/CourseCard';
import BadgeShelf from './learning/BadgeShelf';
import CertificateCard from './learning/CertificateCard';
import CertificateModal from './learning/CertificateModal';

/**
 * LearningCenterSection — "Bee Flow Academy": courses (each a set of lessons), a
 * badge per course, and a per-step lesson player. Rich lessons open in the
 * LessonPlayer (via LESSON_PLAYER_OPEN_EVENT); pure-tour lessons are routed to the
 * spotlight engine by LessonPlayerHost. Completion is keyed on completedAt so a
 * lesson that's merely in-progress (resume state) doesn't read as done.
 */

// Build the { [lessonId]: true } completion map from a server settings payload.
// (The legacy hasSeenIntroTour flag is no longer counted as getting-started —
// the server migrates it into a real completion entry once; see readServerProgress.)
function computeCompletedMap(progressMap) {
    const map = {};
    Object.keys(progressMap || {}).forEach((id) => { if (lessonEntryComplete(progressMap[id])) map[id] = true; });
    return map;
}

export default function LearningCenterSection({ user }) {
    const { t } = useTranslation();
    const { hasFeature } = useLicenseContext();
    const [completedMap, setCompletedMap] = useState({});
    const [certificates, setCertificates] = useState([]);
    const [certModal, setCertModal] = useState(null); // the cert entry being viewed
    const [busyCertId, setBusyCertId] = useState(null);
    const [catVersion, setCatVersion] = useState(() => catalogVersion());

    // Overlay the server's structural catalog (lessonIds/tracks/prereqs/cert
    // rules) onto the bundled presentation copy; bundled stays as fallback.
    // Org-authored courses arrive with their lesson docs inline — register
    // those so the player can resolve them like built-ins.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            const serverCatalog = await fetchCatalog();
            if (cancelled || !serverCatalog) return;
            const orgLessons = (serverCatalog.courses || [])
                .filter((c) => Array.isArray(c.lessons))
                .flatMap((c) => c.lessons);
            if (orgLessons.length) registerServerLessons(orgLessons);
            if (applyServerCatalog(serverCatalog)) setCatVersion(catalogVersion());
        })();
        return () => { cancelled = true; };
    }, []);

    // eslint-disable-next-line react-hooks/exhaustive-deps -- catVersion invalidates the module-level catalog
    const courses = useMemo(() => resolveCourses(user, { hasFeature }), [user, hasFeature, catVersion]);

    const loadAchievements = useCallback(async () => {
        const data = await fetchAchievements();
        if (data?.certificates) setCertificates(data.certificates);
    }, []);

    // Seed from the local mirror, then hydrate from the server (authoritative).
    useEffect(() => {
        let cancelled = false;
        setCompletedMap(readCompletedMap(user));
        (async () => {
            try {
                const res = await authFetch(`${API_BASE}/ai/user-settings`);
                if (!res.ok || cancelled) return;
                const data = await res.json();
                if (cancelled) return;
                setCompletedMap(computeCompletedMap(data?.learningProgress));
            } catch (_) { /* keep the local seed */ }
        })();
        return () => { cancelled = true; };
    }, [user?.id]);

    // Load server-computed achievements (certificate eligibility + issued state).
    useEffect(() => { loadAchievements(); }, [user?.id, loadAchievements]);

    // Recompute from the local mirror whenever a lesson finishes (the player and
    // engine both write local + server before firing this), and refresh certs.
    useEffect(() => {
        const onDone = () => { setCompletedMap(readCompletedMap(user)); loadAchievements(); };
        window.addEventListener(LESSON_COMPLETE_EVENT, onDone);
        return () => window.removeEventListener(LESSON_COMPLETE_EVENT, onDone);
    }, [user, loadAchievements]);

    /* eslint-disable react-hooks/exhaustive-deps -- catVersion invalidates the module-level catalog */
    const doneCourseIds = useMemo(() => completedCourseIds(completedMap, user, hasFeature), [completedMap, user, hasFeature, catVersion]);
    const earnedBadgeIds = useMemo(
        () => new Set(earnedBadgesFromProgress(completedMap, user, hasFeature).map((b) => b.id)),
        [completedMap, user, hasFeature, catVersion],
    );
    const levelInfo = useMemo(() => xpFromProgress(completedMap, user, hasFeature), [completedMap, user, hasFeature, catVersion]);
    /* eslint-enable react-hooks/exhaustive-deps */

    const startLesson = useCallback((lessonId, courseId) => {
        window.dispatchEvent(new CustomEvent(LESSON_PLAYER_OPEN_EVENT, { detail: { lessonId, courseId } }));
    }, []);

    const onReset = useCallback(async () => {
        setCompletedMap({});
        try { await resetLearningProgress(user); } catch (_) { /* best-effort */ }
        loadAchievements();
    }, [user, loadAchievements]);

    const onEarnCert = useCallback(async (cert) => {
        setBusyCertId(cert.certificateId);
        try {
            const issued = await issueCertificate(cert.certificateId, { makePublic: false });
            setCertModal(issued);
            await loadAchievements();
        } catch (_) { /* surfaced by the disabled state; user can retry */ }
        finally { setBusyCertId(null); }
    }, [loadAchievements]);

    const onViewCert = useCallback((cert) => setCertModal(cert), []);

    const onTogglePublic = useCallback(async (makePublic) => {
        if (!certModal) return;
        setBusyCertId(certModal.certificateId);
        try {
            const updated = await issueCertificate(certModal.certificateId, { makePublic });
            setCertModal(updated);
            await loadAchievements();
        } catch (_) { /* keep current modal state */ }
        finally { setBusyCertId(null); }
    }, [certModal, loadAchievements]);

    // "Continue where you left off" — the first not-complete lesson in the first
    // unlocked, incomplete course.
    const continueTarget = useMemo(() => {
        for (const course of courses) {
            if (courseLocked(course, doneCourseIds)) continue;
            if (isCourseComplete(course, completedMap, user, hasFeature)) continue;
            const lessons = courseLessons(course, user, hasFeature);
            const next = lessons.find((l) => !completedMap[l.id]);
            if (next) return { course, lesson: next };
        }
        return null;
    }, [courses, doneCourseIds, completedMap, user, hasFeature]);

    const anyProgress = Object.keys(completedMap).length > 0;
    const lockedReasonFor = useCallback((course) => {
        const blocker = (course.prereqCourseIds || []).map(getCourse).find((c) => c && !doneCourseIds.includes(c.id));
        return blocker ? t('learn.course.locked_reason', 'Complete {course} first').replace('{course}', t(blocker.titleKey, blocker.titleFallback)) : '';
    }, [doneCourseIds, t]);

    return (
        <div className="max-w-3xl mx-auto py-4">
            {/* Header */}
            <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <GraduationCap className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
                        <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {t('settings.learning_center', 'Learning Center')}
                        </h2>
                    </div>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                        {t('settings.learning_center_subtitle_courses', 'Hands-on courses to master Bee Flow — earn badges as you go.')}
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                    {/* Replay the welcome product tour — moved here from Help & Support. */}
                    <button onClick={() => window.dispatchEvent(new CustomEvent(TOUR_START_EVENT))}
                        className="px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 border transition-colors hover:bg-[var(--bg-tertiary)]"
                        style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)', background: 'transparent' }}
                        title={t('settings.learning_take_tour', 'Replay the welcome tour')}>
                        <Compass className="w-3.5 h-3.5" /> {t('settings.learning_take_tour_label', 'Take the tour')}
                    </button>
                    {anyProgress && (
                        <button onClick={onReset}
                            className="px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 border transition-colors hover:bg-[var(--bg-tertiary)]"
                            style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)', background: 'transparent' }}
                            title={t('settings.learning_reset', 'Reset progress')}>
                            <RotateCcw className="w-3.5 h-3.5" /> {t('settings.learning_reset', 'Reset progress')}
                        </button>
                    )}
                </div>
            </div>

            {courses.length === 0 ? (
                <div className="rounded-xl border p-8 text-sm text-center"
                    style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)', color: 'var(--text-muted)' }}>
                    {t('settings.learning_empty', 'No lessons available for your account yet.')}
                </div>
            ) : (
                <div className="flex flex-col gap-4">
                    {/* Achievements */}
                    <BadgeShelf courses={courses} earnedBadgeIds={earnedBadgeIds} levelInfo={levelInfo} t={t} />

                    {/* Certificates */}
                    {certificates.length > 0 && (
                        <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)' }}>
                            <div className="flex items-center gap-2 mb-3">
                                <span aria-hidden="true">📜</span>
                                <h3 className="text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>
                                    {t('learn.cert.section_title', 'Certificates')}
                                </h3>
                            </div>
                            <div className="flex flex-col gap-2.5">
                                {certificates.map((cert) => (
                                    <CertificateCard key={cert.certificateId} cert={cert}
                                        busy={busyCertId === cert.certificateId}
                                        onEarn={onEarnCert} onView={onViewCert} t={t} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Continue where you left off */}
                    {continueTarget && (
                        <button type="button"
                            onClick={() => startLesson(continueTarget.lesson.id, continueTarget.course.id)}
                            className="rounded-xl border p-4 flex items-center gap-3 text-left transition-colors hover:bg-[var(--bg-tertiary)]"
                            style={{ borderColor: 'var(--accent-primary)', background: 'color-mix(in srgb, var(--accent-primary) 6%, transparent)' }}>
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                                style={{ background: 'color-mix(in srgb, var(--accent-primary) 16%, transparent)' }}>
                                {continueTarget.lesson.icon || '▶️'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--accent-primary)' }}>
                                    {t('learn.continue.label', 'Continue learning')}
                                </div>
                                <div className="text-[14px] font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                                    {t(continueTarget.lesson.titleKey, continueTarget.lesson.titleFallback)}
                                </div>
                                <div className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
                                    {t(continueTarget.course.titleKey, continueTarget.course.titleFallback)}
                                </div>
                            </div>
                            <ArrowRight className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--accent-primary)' }} />
                        </button>
                    )}

                    {/* Courses */}
                    {courses.map((course) => {
                        const lessons = courseLessons(course, user, hasFeature);
                        return (
                            <CourseCard
                                key={course.id}
                                course={course}
                                lessons={lessons}
                                completedMap={completedMap}
                                complete={isCourseComplete(course, completedMap, user, hasFeature)}
                                locked={courseLocked(course, doneCourseIds)}
                                lockedReason={lockedReasonFor(course)}
                                badgeEarned={earnedBadgeIds.has(course.badge?.id)}
                                estMinutes={courseEstMinutes(course, user, hasFeature)}
                                onStartLesson={(lessonId) => startLesson(lessonId, course.id)}
                                t={t}
                            />
                        );
                    })}
                </div>
            )}

            {certModal && (
                <CertificateModal
                    cert={certModal}
                    busy={busyCertId === certModal.certificateId}
                    onTogglePublic={onTogglePublic}
                    onClose={() => setCertModal(null)}
                    t={t}
                />
            )}
        </div>
    );
}
