/**
 * Academy Custom Courses — admin API layer (pattern: ProductWebsite/cmsApi.js).
 *
 * Thin authFetch wrappers over /ai/learning/admin (server-side the routes are
 * org-admin gated AND behind the `learning_custom_content` beta capability).
 * Every call resolves to the parsed JSON body and throws an Error carrying the
 * server's error message (when present) on any non-ok response, so callers can
 * surface validation messages like "Quiz step 2 needs a correct choice" inline.
 *
 * Note on creating lessons: PUT /lessons/new mints a fresh org lesson id —
 * the saved lesson is NOT attached to any course until a follow-up
 * saveCourse() whose lessonIds includes the returned lesson.id.
 */
import { API_BASE, authFetch } from '../../../../utils/helpers';

const root = `${API_BASE}/ai/learning/admin`;

async function request(url, { method = 'GET', body } = {}) {
    const res = await authFetch(url, {
        method,
        ...(body !== undefined
            ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
            : {}),
    });
    let data = null;
    try { data = await res.json(); } catch { /* non-JSON error body */ }
    if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
    return data;
}

export const academyApi = {
    // → { courses: [{ courseId, title, status, updatedAt }] }
    listCourses: () => request(`${root}/courses`),
    // → { course: CourseDoc, lessons: LessonDoc[] } (drafts)
    getCourse: (courseId) => request(`${root}/courses/${encodeURIComponent(courseId)}`),
    // → { course } — id always minted server-side
    createCourse: (course) => request(`${root}/courses`, { method: 'POST', body: course }),
    // → { course }
    saveCourse: (courseId, course) => request(`${root}/courses/${encodeURIComponent(courseId)}`, { method: 'PUT', body: course }),
    // → { success: true } — also deletes all the course's lessons
    deleteCourse: (courseId) => request(`${root}/courses/${encodeURIComponent(courseId)}`, { method: 'DELETE' }),
    // → { lesson } — pass 'new' as lessonId to create (id minted server-side)
    saveLesson: (lessonId, lesson) => request(`${root}/lessons/${encodeURIComponent(lessonId)}`, { method: 'PUT', body: lesson }),
    // → { success: true, course }
    publishCourse: (courseId) => request(`${root}/courses/${encodeURIComponent(courseId)}/publish`, { method: 'POST' }),
    // → { success: true }
    unpublishCourse: (courseId) => request(`${root}/courses/${encodeURIComponent(courseId)}/unpublish`, { method: 'POST' }),
};
