// @vitest-environment node
//
// Lockstep tripwire: the bundled presentation catalog (courses.js / lessons.js)
// must structurally match the server's authoritative catalog
// (server/learning/courseCatalog.js). The server copy drives badge/certificate
// issuance and is served at runtime via GET /ai/learning/catalog; the bundled
// copy is the offline fallback — silent drift between them turns into
// badges-shown-but-never-issued bugs. This test makes drift a red build.

import { createRequire } from 'module';
import { describe, it, expect } from 'vitest';
import { COURSES, CERTIFICATES } from './courses';
import { LESSONS } from './lessons';

const require = createRequire(import.meta.url);
const serverCatalog = require('../../../../server/learning/courseCatalog.js');

describe('client/server catalog lockstep', () => {
    it('has the same course ids in the same order', () => {
        expect(serverCatalog.COURSES.map((c) => c.id)).toEqual(COURSES.map((c) => c.id));
    });

    it('agrees on lessonIds, track, prereqs and badge id per course', () => {
        for (const local of COURSES) {
            const server = serverCatalog.getCourse(local.id);
            expect(server, `course ${local.id} missing server-side`).toBeTruthy();
            expect(server.lessonIds, `lessonIds drift on ${local.id}`).toEqual(local.lessonIds);
            expect(server.track, `track drift on ${local.id}`).toBe(local.track);
            expect(server.prereqCourseIds || [], `prereq drift on ${local.id}`).toEqual(local.prereqCourseIds || []);
            expect(server.badge?.id, `badge id drift on ${local.id}`).toBe(local.badge?.id);
        }
    });

    it('agrees on certificate ids, tracks and rules', () => {
        expect(serverCatalog.CERTIFICATES.map((c) => c.id)).toEqual(CERTIFICATES.map((c) => c.id));
        for (const local of CERTIFICATES) {
            const server = serverCatalog.getCertificate(local.id);
            expect(server.track ?? null, `track drift on ${local.id}`).toBe(local.track ?? null);
            expect(server.rule ?? null, `rule drift on ${local.id}`).toEqual(local.rule ?? null);
        }
    });

    it('mirrors every lesson gate server-side (LESSON_GATES)', () => {
        for (const lesson of LESSONS) {
            const localGate = lesson.gate || {};
            const serverGate = serverCatalog.LESSON_GATES[lesson.id] || {};
            expect(serverGate.permission ?? null, `permission gate drift on ${lesson.id}`)
                .toEqual(localGate.permission ?? null);
            expect(serverGate.feature ?? null, `feature gate drift on ${lesson.id}`)
                .toEqual(localGate.feature ?? null);
        }
        // No phantom server gates for lessons that don't exist client-side.
        const lessonIds = new Set(LESSONS.map((l) => l.id));
        for (const gatedId of Object.keys(serverCatalog.LESSON_GATES)) {
            expect(lessonIds.has(gatedId), `server gate for unknown lesson ${gatedId}`).toBe(true);
        }
    });

    it('whitelists exactly the client lesson ids (LESSON_IDS)', () => {
        const local = LESSONS.map((l) => l.id).sort();
        const server = [...serverCatalog.LESSON_IDS].sort();
        expect(server).toEqual(local);
    });

    it('maps every rubric exercise to a real lesson (EXERCISE_LESSONS)', () => {
        const lessonIds = new Set(LESSONS.map((l) => l.id));
        for (const [exerciseId, lessonId] of Object.entries(serverCatalog.EXERCISE_LESSONS)) {
            expect(lessonIds.has(lessonId), `${exerciseId} → unknown lesson ${lessonId}`).toBe(true);
        }
    });
});
