import { describe, it, expect } from 'vitest';
import studioAppsSource from './studioApps.jsx?raw';
import { STUDIO_APPS, makeCanUse } from './studioApps';
import EN_DEFAULTS from '../../../i18n/en-defaults';

const app = (id) => STUDIO_APPS.find((a) => a.id === id);

// Gate context builder — mirrors the ctx Studio/index.jsx passes to gate().
const ctx = ({ features = [], canUseIds = [], perms = [], user = {} } = {}) => ({
    user,
    hasLicenseFeature: (f) => features.includes(f),
    canUse: (id) => canUseIds.includes(id),
    hasPermission: (p) => perms.includes(p),
});

describe('studioApps registry shape', () => {
    it('has unique ids and unique urlSegments', () => {
        const ids = STUDIO_APPS.map((a) => a.id);
        const segs = STUDIO_APPS.map((a) => a.urlSegment);
        expect(new Set(ids).size).toBe(ids.length);
        expect(new Set(segs).size).toBe(segs.length);
    });

    it('covers the ten built-in Studio apps in tab order', () => {
        // Security Scan is no longer built-in — it ships as a downloadable module
        // and its tab is injected at runtime by moduleRuntime/registry.js.
        expect(STUDIO_APPS.map((a) => a.id)).toEqual([
            'agents', 'skills', 'knowledge', 'aiTasks', 'webpages',
            'tests', 'support', 'leadStudio', 'apps', 'meetingNotes',
        ]);
    });

    it('every labelKey resolves in the English defaults', () => {
        for (const a of STUDIO_APPS) {
            expect(EN_DEFAULTS[a.labelKey], `missing i18n key ${a.labelKey}`).toBeTruthy();
        }
    });

    it('every descriptor declares a gate, Component, getProps and Icon', () => {
        for (const a of STUDIO_APPS) {
            expect(typeof a.gate).toBe('function');
            expect(typeof a.getProps).toBe('function');
            expect(a.Component).toBeTruthy();
            expect(a.Icon).toBeTruthy();
        }
    });
});

describe('makeCanUse — canUseFeature ?? (all-permission || betaFeatures)', () => {
    it('server canUseFeature=true wins', () => {
        expect(makeCanUse({ canUseFeature: { webpages: true } })('webpages')).toBe(true);
    });
    it('server canUseFeature=false wins even over the all permission + beta opt-in', () => {
        const user = { canUseFeature: { webpages: false }, permissions: ['all'], betaFeatures: ['webpages'] };
        expect(makeCanUse(user)('webpages')).toBe(false);
    });
    it('absent map falls back to the all permission', () => {
        expect(makeCanUse({ permissions: ['all'] })('webpages')).toBe(true);
    });
    it('absent map falls back to betaFeatures membership', () => {
        expect(makeCanUse({ betaFeatures: ['webpages'] })('webpages')).toBe(true);
    });
    it('denies when neither source grants it', () => {
        expect(makeCanUse({ permissions: ['manage_agents'], betaFeatures: [] })('webpages')).toBe(false);
        expect(makeCanUse({})('webpages')).toBe(false);
        expect(makeCanUse(undefined)('webpages')).toBe(false);
    });
});

describe('gates — legacy canSee* truth tables', () => {
    it('agents / skills / knowledge are always visible', () => {
        for (const id of ['agents', 'skills', 'knowledge']) {
            expect(app(id).gate(ctx({ user: undefined }))).toBe(true);
        }
    });

    it('aiTasks: OR over agent_routines and automations (licence AND canUse per leg)', () => {
        const gate = app('aiTasks').gate;
        expect(gate(ctx({ features: ['agent_routines'], canUseIds: ['agent_routines'] }))).toBe(true);
        expect(gate(ctx({ features: ['automations'], canUseIds: ['automations'] }))).toBe(true);
        // Legs don't cross: routines licence + automations beta grants nothing.
        expect(gate(ctx({ features: ['agent_routines'], canUseIds: ['automations'] }))).toBe(false);
        expect(gate(ctx({ features: ['agent_routines', 'automations'], canUseIds: [] }))).toBe(false);
        expect(gate(ctx({ features: [], canUseIds: ['agent_routines', 'automations'] }))).toBe(false);
        expect(gate(ctx())).toBe(false);
    });

    it.each([
        ['webpages', 'webpages'],
        ['tests', 'playwright_tests'],
        ['leadStudio', 'lead_studio'],
        ['meetingNotes', 'meeting_notes'],
    ])('%s: licence AND canUse on %s', (id, feature) => {
        const gate = app(id).gate;
        expect(gate(ctx({ features: [feature], canUseIds: [feature] }))).toBe(true);
        expect(gate(ctx({ features: [feature], canUseIds: [] }))).toBe(false);
        expect(gate(ctx({ features: [], canUseIds: [feature] }))).toBe(false);
    });

    it('support: additionally requires the support_inbox (or all) permission', () => {
        const gate = app('support').gate;
        const base = { features: ['support_inbox'], canUseIds: ['support_inbox'] };
        expect(gate(ctx({ ...base, perms: [] }))).toBe(false);
        expect(gate(ctx({ ...base, perms: ['support_inbox'] }))).toBe(true);
        expect(gate(ctx({ ...base, perms: ['all'] }))).toBe(true);
        // Permission alone is not enough without licence × beta.
        expect(gate(ctx({ features: [], canUseIds: ['support_inbox'], perms: ['all'] }))).toBe(false);
        expect(gate(ctx({ features: ['support_inbox'], canUseIds: [], perms: ['all'] }))).toBe(false);
    });
});

describe('import discipline', () => {
    it('top-level imports stay limited to react, lazyWithReload and lucide-react', () => {
        const src = studioAppsSource;
        const specifiers = [
            ...src.matchAll(/^import\s[^;]*?from\s+['"]([^'"]+)['"]/gm),
            ...src.matchAll(/^import\s+['"]([^'"]+)['"]/gm),
        ].map((m) => m[1]);
        expect(specifiers.length).toBeGreaterThan(0);
        const allowed = new Set(['react', 'lucide-react', '../../../utils/lazyWithReload']);
        for (const spec of specifiers) {
            expect(allowed.has(spec), `top-level import of "${spec}" would pull it into the main chunk`).toBe(true);
        }
        // Each app component must be referenced only inside a lazy() callback.
        const lazyImports = src.match(/lazy\(\(\) => import\(/g) || [];
        expect(lazyImports.length).toBe(STUDIO_APPS.length);
    });
});
