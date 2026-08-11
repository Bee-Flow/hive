import { describe, it, expect } from 'vitest';
import { parseProjectUrl, projectRoutePath } from './projectRoutes';

describe('parseProjectUrl', () => {
    it('is null for non-project paths', () => {
        expect(parseProjectUrl('/app')).toBeNull();
        expect(parseProjectUrl('/app/notebooks/abc')).toBeNull();
        // Prefix match must not swallow a sibling route.
        expect(parseProjectUrl('/app/projectsomething')).toBeNull();
    });

    it('reads the list route', () => {
        expect(parseProjectUrl('/app/projects')).toEqual({ projectId: null, tab: null });
        expect(parseProjectUrl('/app/projects/')).toEqual({ projectId: null, tab: null });
    });

    it('reads the create route as the empty-string sentinel', () => {
        // Distinct from the list (null) — that collapse is what broke the
        // "New Project" button.
        expect(parseProjectUrl('/app/projects/new')).toEqual({ projectId: '', tab: null });
    });

    it('reads a project and its tab', () => {
        expect(parseProjectUrl('/app/projects/abc-123')).toEqual({ projectId: 'abc-123', tab: null });
        expect(parseProjectUrl('/app/projects/abc-123/threads')).toEqual({ projectId: 'abc-123', tab: 'threads' });
    });
});

describe('projectRoutePath', () => {
    it('round-trips every destination', () => {
        for (const [id, tab, path] of [
            [null, null, '/app/projects'],
            [undefined, null, '/app/projects'],
            ['', null, '/app/projects/new'],
            ['abc-123', null, '/app/projects/abc-123'],
            ['abc-123', 'threads', '/app/projects/abc-123/threads'],
        ]) {
            expect(projectRoutePath(id, tab)).toBe(path);
            expect(parseProjectUrl(path)).toEqual({ projectId: id ?? null, tab: tab || null });
        }
    });
});
