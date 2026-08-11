import { STUDIO_APPS } from './studioApps';
import { getRuntimeStudioApps } from '../../../moduleRuntime/registry';

// URL segment ↔ Studio section maps, derived from the app registry so a new
// Studio app only has to declare its slug once. Consumed by App.jsx (URL
// parsing + the navigateToPage 'studio/...' handler) and kept free of any
// other imports so it can't drag components into the main chunk.
//
// Runtime (remotely-installed) modules add their own segments too. The static
// SEG_TO_SECTION / SECTION_TO_SEG below stay built-in-only (stable constants);
// sectionFromRaw/segmentForSection consult the LIVE runtime list after the
// static map so a deep link into a remote module's tab resolves once its
// descriptor loads — built-ins always win a segment collision.

// Accepted raw segments: the canonical urlSegment, the section id itself
// (navigation code historically passed e.g. 'studio/meetingNotes'), and any
// declared legacy slugs (e.g. 'ai-tasks' for routines).
export const SEG_TO_SECTION = Object.fromEntries(
    STUDIO_APPS.flatMap((app) => [
        [app.urlSegment, app.id],
        [app.id, app.id],
        ...(app.legacySegments || []).map((seg) => [seg, app.id]),
    ])
);

export const SECTION_TO_SEG = Object.fromEntries(
    STUDIO_APPS.map((app) => [app.id, app.urlSegment])
);

// Unknown segments fall back to the Agents tab (legacy switch behaviour).
// Built-in segments resolve first; then the live runtime module list; then agents.
export function sectionFromRaw(raw) {
    if (!raw) return 'agents';
    if (SEG_TO_SECTION[raw]) return SEG_TO_SECTION[raw];
    for (const app of getRuntimeStudioApps()) {
        if (raw === app.urlSegment || raw === app.id || (app.legacySegments || []).includes(raw)) {
            return app.id;
        }
    }
    return 'agents';
}

export function segmentForSection(section) {
    if (SECTION_TO_SEG[section]) return SECTION_TO_SEG[section];
    const app = getRuntimeStudioApps().find((a) => a.id === section);
    return app ? app.urlSegment : section;
}

// Parse /app/studio/{section}/{id?} → { section, id?, sub?, routineKind? }
// 'routines' is the canonical URL slug; 'ai-tasks' is accepted for backward compat.
export function parseStudioUrl(pathname) {
    // Legacy /app/webpages[/<id>] paths route into Studio's Webpages section.
    const wp = pathname.match(/^\/app\/webpages(?:\/([^/]+))?/);
    if (wp) return { section: 'webpages', id: wp[1] || null };
    // Legacy /app/meeting-notes[/<id>] paths route into Studio's Meeting Notes section.
    const mn = pathname.match(/^\/app\/meeting-notes(?:\/([^/]+))?/);
    if (mn) return { section: 'meetingNotes', id: mn[1] || null };
    const m = pathname.match(/^\/app\/studio(?:\/([^/]+))?(?:\/([^/]+))?(?:\/([^/]+))?(?:\/([^/]+))?/);
    const seg = m?.[1] || 'agents';
    let id = m?.[2] || null;
    // Third path segment — Routines uses it for a flowlet (layer) key.
    let sub = m?.[3] || null;
    // Reusable Steps live under /studio/routines/steps/<id>[/<flowletKey>].
    // The literal "steps" id segment is reserved (no automation can use it).
    let routineKind = null;
    if ((seg === 'routines' || seg === 'ai-tasks') && id === 'steps') {
        routineKind = 'step';
        id = m?.[3] || null;
        sub = m?.[4] || null;
    }
    const section = sectionFromRaw(seg);
    return { section, id, sub, routineKind };
}
