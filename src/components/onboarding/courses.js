// Bee Flow Academy — course catalog.
//
// A COURSE is a thin grouping layered ABOVE the flat LESSONS catalog (lessons.js):
// an ordered list of existing lesson ids + a badge + a track. Completion is still
// a pure function of the per-lesson progress map — a course is "complete" when all
// of its VISIBLE lessons are done (visible = the user has the permission/feature
// gate for that lesson; see lessonVisible). Computing against visible lessons means
// a permission-gated lesson a member can't see never makes a course uncompletable.
//
// A TRACK groups courses for certificate eligibility. A CERTIFICATE is earned by
// completing every course in a track (or any N courses, for the capstone).
//
// STRUCTURE (ids, lessonIds, tracks, prereqs, badges, certificate rules) is
// owned by the server (server/learning/courseCatalog.js, served via
// GET /ai/learning/catalog) — applyServerCatalog() overlays it onto this bundled
// copy at load, so structural changes ship without a frontend release. This copy
// carries PRESENTATION (i18n keys, icons, levels) and doubles as the offline
// fallback; catalogLockstep.test.js fails when the two drift.

import { LESSONS, getLesson, lessonVisible } from './lessons';

/* ── Tracks ──────────────────────────────────────────────────────────────── */
export const TRACKS = {
    foundations: { id: 'foundations', titleKey: 'learn.track.foundations', titleFallback: 'Foundations' },
    builder: { id: 'builder', titleKey: 'learn.track.builder', titleFallback: 'Agent Builder' },
    power: { id: 'power', titleKey: 'learn.track.power', titleFallback: 'Power User' },
};

/* ── Courses ─────────────────────────────────────────────────────────────────
 * id              — stable key (progress map, React keys, analytics)
 * titleKey/Fallback, descKey/Fallback — card copy (fallback always renders)
 * icon            — emoji in the tinted tile (never purple)
 * level           — 'beginner' | 'intermediate' | 'advanced' (chip)
 * track           — TRACKS key (certificate grouping)
 * lessonIds       — ordered existing/new lesson ids
 * prereqCourseIds — courses that must be complete before this unlocks
 * badge           — { id, icon, titleKey/Fallback, descFallback }
 * ──────────────────────────────────────────────────────────────────────────── */
export const COURSES = [
    {
        id: 'course-foundations',
        titleKey: 'learn.course.foundations.title', titleFallback: 'Bee Flow Foundations',
        descKey: 'learn.course.foundations.desc',
        descFallback: 'Find your way around chat, agents, memory and where everything lives.',
        icon: '🐝', level: 'beginner', track: 'foundations',
        lessonIds: ['getting-started', 'using-memory'],
        prereqCourseIds: [],
        badge: {
            id: 'badge-foundations', icon: '🍯',
            titleKey: 'learn.badge.foundations', titleFallback: 'Hive Newcomer',
            descFallback: 'Completed Bee Flow Foundations.',
        },
    },
    {
        id: 'course-prompting',
        titleKey: 'learn.course.prompting.title', titleFallback: 'Prompt Engineering',
        descKey: 'learn.course.prompting.desc',
        descFallback: 'Write prompts that get great answers — context, structure, iteration and advanced techniques, with hands-on practice graded by an AI coach.',
        icon: '💬', level: 'beginner', track: 'foundations',
        lessonIds: ['prompt-basics', 'prompt-context', 'prompt-structure', 'prompt-iterating', 'prompt-advanced'],
        prereqCourseIds: [],
        badge: {
            id: 'badge-prompt-smith', icon: '✍️',
            titleKey: 'learn.badge.prompt_smith', titleFallback: 'Prompt Smith',
            descFallback: 'Mastered the craft of writing effective prompts.',
        },
    },
    {
        id: 'course-build-agent',
        titleKey: 'learn.course.build_agent.title', titleFallback: 'Build Your First Agent',
        descKey: 'learn.course.build_agent.desc',
        descFallback: 'Go from a plain-English idea to a published, tuned agent with the right tools and knowledge.',
        icon: '🤖', level: 'intermediate', track: 'builder',
        lessonIds: ['creating-agents', 'refining-prompt', 'knowledge-bases'],
        prereqCourseIds: ['course-foundations'],
        badge: {
            id: 'badge-agent-architect', icon: '🛠️',
            titleKey: 'learn.badge.agent_architect', titleFallback: 'Agent Architect',
            descFallback: 'Designed, tuned and published a Bee Flow agent.',
        },
    },
    {
        id: 'course-skills-automation',
        titleKey: 'learn.course.skills.title', titleFallback: 'Skills & Automation',
        descKey: 'learn.course.skills.desc',
        descFallback: 'Package reusable skills and run agents on a schedule.',
        icon: '🧩', level: 'intermediate', track: 'builder',
        lessonIds: ['creating-skills', 'automations'],
        prereqCourseIds: ['course-build-agent'],
        badge: {
            id: 'badge-automator', icon: '⏱️',
            titleKey: 'learn.badge.automator', titleFallback: 'Automator',
            descFallback: 'Built reusable skills and scheduled automations.',
        },
    },
    {
        id: 'course-power',
        titleKey: 'learn.course.power.title', titleFallback: 'Power Connections',
        descKey: 'learn.course.power.desc',
        descFallback: 'Connect the tools your team already uses and keep an eye on usage across the org.',
        icon: '🔌', level: 'advanced', track: 'power',
        lessonIds: ['connecting-integrations', 'org-usage'],
        prereqCourseIds: [],
        badge: {
            id: 'badge-connector', icon: '🔗',
            titleKey: 'learn.badge.connector', titleFallback: 'Connector',
            descFallback: 'Connected integrations and mastered usage monitoring.',
        },
    },
    {
        id: 'course-automations-mastery',
        titleKey: 'learn.course.automations.title', titleFallback: 'Automate Your Week',
        descKey: 'learn.course.automations.desc',
        descFallback: 'Design automations that run without you — triggers, briefs, dry-runs and run history.',
        icon: '⚙️', level: 'intermediate', track: 'power',
        lessonIds: ['automation-anatomy', 'automation-practice'],
        prereqCourseIds: [],
        badge: {
            id: 'badge-routine-master', icon: '⏰',
            titleKey: 'learn.badge.routine_master', titleFallback: 'Routine Master',
            descFallback: 'Designed automations with the right triggers and verified runs.',
        },
    },
    {
        id: 'course-admin-essentials',
        titleKey: 'learn.course.admin.title', titleFallback: 'Admin Essentials',
        descKey: 'learn.course.admin.desc',
        descFallback: 'Run a healthy organisation — access control, usage monitoring and deliberate rollouts.',
        icon: '🛡️', level: 'advanced', track: 'power',
        lessonIds: ['admin-access-control', 'admin-governance'],
        prereqCourseIds: [],
        badge: {
            id: 'badge-hive-steward', icon: '🐝',
            titleKey: 'learn.badge.hive_steward', titleFallback: 'Hive Steward',
            descFallback: 'Mastered access control, monitoring and feature rollouts.',
        },
    },
];

/* ── Certificates ─────────────────────────────────────────────────────────────
 * Earned by completing every course in a `track`, or any N courses for a capstone
 * (`rule: { type:'count', n }`). The server recomputes eligibility before issuing.
 * ──────────────────────────────────────────────────────────────────────────── */
export const CERTIFICATES = [
    {
        id: 'cert-foundations', track: 'foundations',
        titleKey: 'learn.cert.foundations', titleFallback: 'Bee Flow AI Certified — Foundations',
        level: 'Foundations', icon: '📜',
    },
    {
        id: 'cert-builder', track: 'builder',
        titleKey: 'learn.cert.builder', titleFallback: 'Bee Flow AI Certified — Agent Builder',
        level: 'Agent Builder', icon: '📜',
    },
    {
        id: 'cert-practitioner', rule: { type: 'count', n: 4 },
        titleKey: 'learn.cert.practitioner', titleFallback: 'Bee Flow AI Practitioner',
        level: 'Practitioner', icon: '🏅',
    },
];

/* ── Active catalog (server-overlayable) ─────────────────────────────────────
 * The lists every resolver below reads. They default to the bundled arrays and
 * are replaced when applyServerCatalog() merges the server's structural truth
 * over the bundled presentation. Components re-render via the version counter
 * (include catalogVersion() in a useMemo dep after awaiting fetchCatalog()).
 * ──────────────────────────────────────────────────────────────────────────── */
let activeCoursesList = COURSES;
let activeCertificatesList = CERTIFICATES;
let activeCatalogVersion = 0;

export function activeCourses() { return activeCoursesList; }
export function activeCertificates() { return activeCertificatesList; }
export function catalogVersion() { return activeCatalogVersion; }

// Merge the server catalog's STRUCTURE over the bundled PRESENTATION. Server
// courses matched by id keep the bundled copy's display fields (i18n keys,
// icons, levels) and adopt the server's lessonIds/track/prereqs/badge id and
// certificate rules. Server-only courses (org-authored, Phase 3) get display
// fields synthesized from the server doc. Returns true when anything changed.
export function applyServerCatalog(serverCatalog) {
    if (!serverCatalog || !Array.isArray(serverCatalog.courses)) return false;
    const mergedCourses = serverCatalog.courses.map((sc) => {
        const local = COURSES.find((c) => c.id === sc.id);
        if (local) {
            return {
                ...local,
                lessonIds: Array.isArray(sc.lessonIds) ? sc.lessonIds : local.lessonIds,
                track: sc.track || local.track,
                prereqCourseIds: Array.isArray(sc.prereqCourseIds) ? sc.prereqCourseIds : local.prereqCourseIds,
                badge: { ...local.badge, ...(sc.badge?.id ? { id: sc.badge.id } : {}) },
            };
        }
        return {
            id: sc.id,
            titleFallback: sc.title || sc.id,
            descFallback: sc.desc || '',
            icon: sc.icon || '📘',
            level: sc.level || 'beginner',
            track: sc.track || null,
            lessonIds: Array.isArray(sc.lessonIds) ? sc.lessonIds : [],
            prereqCourseIds: Array.isArray(sc.prereqCourseIds) ? sc.prereqCourseIds : [],
            badge: sc.badge?.id
                ? { id: sc.badge.id, icon: sc.badge.icon || '🏵️', titleFallback: sc.badge.title || sc.title, descFallback: sc.badge.desc || '' }
                : null,
            source: sc.source || 'server',
        };
    });
    const mergedCerts = Array.isArray(serverCatalog.certificates) && serverCatalog.certificates.length
        ? serverCatalog.certificates.map((scert) => {
            const local = CERTIFICATES.find((c) => c.id === scert.id);
            return local
                ? { ...local, track: scert.track ?? local.track, rule: scert.rule ?? local.rule, level: scert.level || local.level }
                : { id: scert.id, titleFallback: scert.title || scert.id, level: scert.level || null, icon: '📜', track: scert.track || null, rule: scert.rule || null };
        })
        : activeCertificatesList;

    activeCoursesList = mergedCourses;
    activeCertificatesList = mergedCerts;
    activeCatalogVersion += 1;
    return true;
}

/* ── Lookups & resolvers ─────────────────────────────────────────────────── */

export function getCourse(courseId) {
    return activeCoursesList.find((c) => c.id === courseId);
}

export function getCertificate(certId) {
    return activeCertificatesList.find((c) => c.id === certId);
}

// The lessons of a course this user can actually access (permission + feature
// gated). hasFeature is optional (undefined → feature gates treated as visible).
export function courseLessons(course, user, hasFeature) {
    return (course?.lessonIds || [])
        .map(getLesson)
        .filter(Boolean)
        .filter((l) => lessonVisible(l, user, hasFeature));
}

// Courses with at least one visible lesson, in catalog order.
export function resolveCourses(user, { hasFeature } = {}) {
    return activeCoursesList.filter((c) => courseLessons(c, user, hasFeature).length > 0);
}

export function courseEstMinutes(course, user, hasFeature) {
    return courseLessons(course, user, hasFeature).reduce((sum, l) => sum + (l.estMinutes || 0), 0);
}

// Course completion = every VISIBLE lesson present in the completion map.
// `completedMap` is { [lessonId]: true } (built by the page from progress).
export function isCourseComplete(course, completedMap, user, hasFeature) {
    const lessons = courseLessons(course, user, hasFeature);
    if (!lessons.length) return false;
    return lessons.every((l) => !!completedMap[l.id]);
}

export function courseLessonsDone(course, completedMap, user, hasFeature) {
    return courseLessons(course, user, hasFeature).filter((l) => !!completedMap[l.id]).length;
}

// The set of course ids this user has completed (used for prereq/cert math).
export function completedCourseIds(completedMap, user, hasFeature) {
    return resolveCourses(user, { hasFeature })
        .filter((c) => isCourseComplete(c, completedMap, user, hasFeature))
        .map((c) => c.id);
}

// Locked until all (visible) prereq courses are complete.
export function courseLocked(course, doneCourseIds) {
    const prereqs = (course?.prereqCourseIds || []).filter((id) => !!getCourse(id));
    return prereqs.some((id) => !doneCourseIds.includes(id));
}

// Badges earned, derived from completed courses. The server is authoritative;
// this drives the optimistic UI.
export function earnedBadgesFromProgress(completedMap, user, hasFeature) {
    return resolveCourses(user, { hasFeature })
        .filter((c) => isCourseComplete(c, completedMap, user, hasFeature))
        .map((c) => ({ ...c.badge, courseId: c.id }));
}

// Certificate eligibility, derived. A track cert needs every course in the track
// (that's visible to the user) complete; a count cert needs N completed courses.
export function certificateEligible(cert, doneCourseIds, user, hasFeature) {
    if (cert?.rule?.type === 'count') return doneCourseIds.length >= cert.rule.n;
    if (cert?.track) {
        const trackCourses = resolveCourses(user, { hasFeature }).filter((c) => c.track === cert.track);
        if (!trackCourses.length) return false;
        return trackCourses.every((c) => doneCourseIds.includes(c.id));
    }
    return false;
}

// Progress toward a certificate, for the achievements UI: { done, total }.
export function certificateProgress(cert, doneCourseIds, user, hasFeature) {
    if (cert?.rule?.type === 'count') {
        return { done: Math.min(doneCourseIds.length, cert.rule.n), total: cert.rule.n };
    }
    if (cert?.track) {
        const trackCourses = resolveCourses(user, { hasFeature }).filter((c) => c.track === cert.track);
        const done = trackCourses.filter((c) => doneCourseIds.includes(c.id)).length;
        return { done, total: trackCourses.length };
    }
    return { done: 0, total: 0 };
}

/* ── Light gamification: XP + bee-themed levels (derived, not stored) ──────────
 * XP is a pure function of progress so it can't be forged and needs no storage:
 * a fixed amount per completed lesson plus a bonus per completed course. Levels are
 * thresholds with bee-themed labels. Tasteful — no leaderboards.
 * ──────────────────────────────────────────────────────────────────────────── */
export const XP_PER_LESSON = 100;
export const XP_PER_COURSE = 250;

export const LEVELS = [
    { key: 'larva', titleFallback: 'Larva', min: 0 },
    { key: 'worker', titleFallback: 'Worker Bee', min: 300 },
    { key: 'forager', titleFallback: 'Forager', min: 800 },
    { key: 'guard', titleFallback: 'Guard Bee', min: 1500 },
    { key: 'keeper', titleFallback: 'Beekeeper', min: 2500 },
];

// Count completed lessons across all visible courses (deduped) + completed courses.
export function xpFromProgress(completedMap, user, hasFeature) {
    const visible = resolveCourses(user, { hasFeature });
    const lessonIds = new Set();
    visible.forEach((c) => courseLessons(c, user, hasFeature).forEach((l) => { if (completedMap[l.id]) lessonIds.add(l.id); }));
    const doneCourses = visible.filter((c) => isCourseComplete(c, completedMap, user, hasFeature)).length;
    const xp = lessonIds.size * XP_PER_LESSON + doneCourses * XP_PER_COURSE;

    let level = LEVELS[0];
    let next = null;
    for (let i = 0; i < LEVELS.length; i += 1) {
        if (xp >= LEVELS[i].min) { level = LEVELS[i]; next = LEVELS[i + 1] || null; }
    }
    return { xp, level, next, lessonsDone: lessonIds.size, coursesDone: doneCourses };
}

// Sanity helper used by tests: every course references real lessons.
export function unknownLessonRefs() {
    const known = new Set(LESSONS.map((l) => l.id));
    const missing = [];
    COURSES.forEach((c) => (c.lessonIds || []).forEach((id) => { if (!known.has(id)) missing.push({ course: c.id, lesson: id }); }));
    return missing;
}
