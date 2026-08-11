// URL shape for the projects views, in one place — same split as
// components/admin/Studio/studioRoutes.js, so the parse and the build can't
// drift apart (they did: the create route had no path at all).
//
// Three destinations:
//   /app/projects            the list
//   /app/projects/new        the create form   (AgentHub's `''` sentinel)
//   /app/projects/:id[/:tab] one project
//
// Project ids are UUIDs server-side, so the literal `new` can never collide
// with a real id.

/**
 * @returns {{projectId: string|null, tab: string|null}|null}
 *   null when the path isn't a projects path at all, so callers can tell
 *   "no project" apart from "the project list". `''` means the create form.
 */
export function parseProjectUrl(pathname) {
    if (!/^\/app\/projects(\/|$)/.test(pathname)) return null;
    const m = pathname.match(/^\/app\/projects\/([a-zA-Z0-9_-]+)(?:\/([a-zA-Z0-9_-]+))?/);
    if (!m) return { projectId: null, tab: null };
    if (m[1] === 'new') return { projectId: '', tab: null };
    return { projectId: m[1], tab: m[2] || null };
}

/** Inverse of parseProjectUrl. `''` → the create form, null/undefined → the list. */
export function projectRoutePath(projectId, tab) {
    if (projectId === '') return '/app/projects/new';
    if (!projectId) return '/app/projects';
    return `/app/projects/${projectId}${tab ? `/${tab}` : ''}`;
}
