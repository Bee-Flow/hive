import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { useLicenseContext } from '../LicenseContext';
import { LESSON_PLAYER_OPEN_EVENT, TOUR_START_EVENT, lessonIdIsPureTour } from './lessons';
import { readCompletedMap } from './learningProgress';
import { activeCourses, earnedBadgesFromProgress, isCourseComplete } from './courses';
import LessonPlayer from './player/LessonPlayer';

/**
 * LessonPlayerHost — mounted once in App (beside OnboardingTour). Listens for
 * LESSON_PLAYER_OPEN_EVENT and opens the focused LessonPlayer for rich lessons.
 * Pure-tour lessons (the legacy 10) are routed straight to the spotlight engine so
 * they behave exactly as before. On completion it diffs earned badges (snapshotted
 * at open time) to celebrate any newly-earned badge in the player's final screen.
 */
export default function LessonPlayerHost({ user }) {
    const { t } = useTranslation();
    const { hasFeature } = useLicenseContext();
    const [active, setActive] = useState(null); // { lessonId, courseId }
    const beforeBadgesRef = useRef(new Set());

    useEffect(() => {
        const onOpen = (e) => {
            const lessonId = e?.detail?.lessonId;
            if (!lessonId) return;
            // A lesson made entirely of live-app tour steps skips the player.
            if (lessonIdIsPureTour(lessonId)) {
                try { window.dispatchEvent(new CustomEvent(TOUR_START_EVENT, { detail: { lessonId } })); } catch (_) { /* ignore */ }
                return;
            }
            try {
                beforeBadgesRef.current = new Set(
                    earnedBadgesFromProgress(readCompletedMap(user), user, hasFeature).map((b) => b.id),
                );
            } catch (_) { beforeBadgesRef.current = new Set(); }
            setActive({ lessonId, courseId: e?.detail?.courseId || null });
        };
        window.addEventListener(LESSON_PLAYER_OPEN_EVENT, onOpen);
        return () => window.removeEventListener(LESSON_PLAYER_OPEN_EVENT, onOpen);
    }, [user, hasFeature]);

    const handleComplete = useCallback(async (lessonId) => {
        const completedMap = readCompletedMap(user);
        const after = earnedBadgesFromProgress(completedMap, user, hasFeature);
        const before = beforeBadgesRef.current;
        const newBadges = after.filter((b) => !before.has(b.id));

        let courseComplete = false;
        let courseTitle = null;
        const course = activeCourses().find((c) => (c.lessonIds || []).includes(lessonId));
        if (course && isCourseComplete(course, completedMap, user, hasFeature)) {
            courseComplete = true;
            courseTitle = t(course.titleKey, course.titleFallback);
        }
        return { newBadges, courseComplete, courseTitle };
    }, [user, hasFeature, t]);

    if (!active) return null;

    return (
        <LessonPlayer
            key={active.lessonId}
            lessonId={active.lessonId}
            courseId={active.courseId}
            user={user}
            onClose={() => setActive(null)}
            onComplete={handleComplete}
        />
    );
}
