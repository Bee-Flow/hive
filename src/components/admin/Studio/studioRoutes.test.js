import { describe, it, expect, afterEach } from 'vitest';
import { STUDIO_APPS } from './studioApps';
import { SEG_TO_SECTION, SECTION_TO_SEG, sectionFromRaw, segmentForSection, parseStudioUrl, parseStudioQuery, buildStudioSearch } from './studioRoutes';
import { __setRuntimeDescriptorsForTests, __resetRuntimeForTests } from '../../../moduleRuntime/registry';

describe('seg ↔ section maps', () => {
    it('maps every canonical urlSegment and every section id to its section', () => {
        for (const app of STUDIO_APPS) {
            expect(sectionFromRaw(app.urlSegment)).toBe(app.id);
            // Section ids double as accepted raw segments (navigation code
            // historically passed e.g. 'studio/meetingNotes').
            expect(sectionFromRaw(app.id)).toBe(app.id);
            expect(segmentForSection(app.id)).toBe(app.urlSegment);
            expect(SECTION_TO_SEG[app.id]).toBe(app.urlSegment);
        }
    });

    it('accepts every legacy alias from the pre-registry switches', () => {
        // Verbatim truth table of the old App.jsx seg→section switches.
        // 'routines' was the canonical slug until the tab was renamed after
        // the one thing it holds; both it and the older 'ai-tasks' still parse.
        expect(sectionFromRaw('automations')).toBe('aiTasks');
        expect(sectionFromRaw('routines')).toBe('aiTasks');
        expect(sectionFromRaw('ai-tasks')).toBe('aiTasks');
        expect(sectionFromRaw('skills')).toBe('skills');
        expect(sectionFromRaw('knowledge')).toBe('knowledge');
        expect(sectionFromRaw('webpages')).toBe('webpages');
        expect(sectionFromRaw('support')).toBe('support');
        expect(sectionFromRaw('meeting-notes')).toBe('meetingNotes');
        expect(sectionFromRaw('meetingNotes')).toBe('meetingNotes');
        expect(SEG_TO_SECTION['ai-tasks']).toBe('aiTasks');
        expect(SEG_TO_SECTION['routines']).toBe('aiTasks');
    });

    it('falls back to agents for unknown raw segments', () => {
        expect(sectionFromRaw('nope')).toBe('agents');
        expect(sectionFromRaw('')).toBe('agents');
        expect(sectionFromRaw(undefined)).toBe('agents');
    });

    it('maps sections back to the canonical path segments', () => {
        expect(segmentForSection('aiTasks')).toBe('automations');
        expect(segmentForSection('meetingNotes')).toBe('meeting-notes');
        expect(segmentForSection('agents')).toBe('agents');
    });
});

describe('parseStudioUrl', () => {
    it('parses the bare studio path to agents', () => {
        expect(parseStudioUrl('/app/studio')).toEqual({ section: 'agents', id: null, sub: null, routineKind: null });
    });

    it('parses a plain section with id and flowlet sub-segment', () => {
        expect(parseStudioUrl('/app/studio/routines/abc/flow1'))
            .toEqual({ section: 'aiTasks', id: 'abc', sub: 'flow1', routineKind: null });
        expect(parseStudioUrl('/app/studio/skills/skill-1'))
            .toEqual({ section: 'skills', id: 'skill-1', sub: null, routineKind: null });
        expect(parseStudioUrl('/app/studio/knowledge'))
            .toEqual({ section: 'knowledge', id: null, sub: null, routineKind: null });
    });

    it('treats the reserved "steps" segment as routineKind=step, on every slug', () => {
        expect(parseStudioUrl('/app/studio/automations/steps/abc'))
            .toEqual({ section: 'aiTasks', id: 'abc', sub: null, routineKind: 'step' });
        expect(parseStudioUrl('/app/studio/routines/steps/abc'))
            .toEqual({ section: 'aiTasks', id: 'abc', sub: null, routineKind: 'step' });
        expect(parseStudioUrl('/app/studio/routines/steps/abc/flow1'))
            .toEqual({ section: 'aiTasks', id: 'abc', sub: 'flow1', routineKind: 'step' });
        // Legacy ai-tasks slug keeps the same special case.
        expect(parseStudioUrl('/app/studio/ai-tasks/steps/xyz'))
            .toEqual({ section: 'aiTasks', id: 'xyz', sub: null, routineKind: 'step' });
    });

    it('keeps legacy ai-tasks URLs working', () => {
        expect(parseStudioUrl('/app/studio/ai-tasks/task-9'))
            .toEqual({ section: 'aiTasks', id: 'task-9', sub: null, routineKind: null });
    });

    it('routes legacy /app/webpages paths into the Webpages section', () => {
        expect(parseStudioUrl('/app/webpages')).toEqual({ section: 'webpages', id: null });
        expect(parseStudioUrl('/app/webpages/w1')).toEqual({ section: 'webpages', id: 'w1' });
    });

    it('routes legacy /app/meeting-notes paths into the Meeting Notes section', () => {
        expect(parseStudioUrl('/app/meeting-notes')).toEqual({ section: 'meetingNotes', id: null });
        expect(parseStudioUrl('/app/meeting-notes/m1')).toEqual({ section: 'meetingNotes', id: 'm1' });
    });

    it('parses the remaining studio sections', () => {
        expect(parseStudioUrl('/app/studio/support').section).toBe('support');
        expect(parseStudioUrl('/app/studio/meeting-notes').section).toBe('meetingNotes');
        expect(parseStudioUrl('/app/studio/webpages/w2'))
            .toEqual({ section: 'webpages', id: 'w2', sub: null, routineKind: null });
    });

    it('falls back to agents for unknown sections', () => {
        expect(parseStudioUrl('/app/studio/unknown-thing'))
            .toEqual({ section: 'agents', id: null, sub: null, routineKind: null });
    });
});

describe('runtime (remote-module) segment extension', () => {
    afterEach(() => __resetRuntimeForTests());

    it('resolves a remote module segment once its descriptor is registered', () => {
        // Before registration the segment is unknown → agents fallback.
        expect(sectionFromRaw('uptime')).toBe('agents');
        expect(parseStudioUrl('/app/studio/uptime').section).toBe('agents');

        __setRuntimeDescriptorsForTests([
            { id: 'uptime_monitor', urlSegment: 'uptime', legacySegments: [] },
        ]);

        expect(sectionFromRaw('uptime')).toBe('uptime_monitor');
        expect(sectionFromRaw('uptime_monitor')).toBe('uptime_monitor');
        expect(segmentForSection('uptime_monitor')).toBe('uptime');
        expect(parseStudioUrl('/app/studio/uptime'))
            .toEqual({ section: 'uptime_monitor', id: null, sub: null, routineKind: null });
    });

    it('never lets a remote module shadow a built-in segment', () => {
        __setRuntimeDescriptorsForTests([
            { id: 'evil', urlSegment: 'agents', legacySegments: ['skills'] },
        ]);
        expect(sectionFromRaw('agents')).toBe('agents');
        expect(sectionFromRaw('skills')).toBe('skills');
        expect(segmentForSection('agents')).toBe('agents');
    });
});

describe('parseStudioQuery / buildStudioSearch', () => {
    it('round-trips the builder state', () => {
        const state = { view: 'runs', runId: 'run_123', stepId: 'act_9' };
        expect(parseStudioQuery(buildStudioSearch(state))).toEqual(state);
    });

    it('omits nulls, and omits the default Editor view entirely', () => {
        expect(buildStudioSearch({})).toBe('');
        expect(buildStudioSearch({ view: 'build' })).toBe('');
        expect(buildStudioSearch({ view: 'build', runId: 'r1' })).toBe('?run=r1');
        expect(buildStudioSearch({ view: 'settings' })).toBe('?view=settings');
    });

    it('parses absent state to explicit nulls', () => {
        expect(parseStudioQuery('')).toEqual({ view: null, runId: null, stepId: null });
        expect(parseStudioQuery('?other=x')).toEqual({ view: null, runId: null, stepId: null });
        expect(parseStudioQuery('view=runs&run=r2')).toEqual({ view: 'runs', runId: 'r2', stepId: null });
    });
});
