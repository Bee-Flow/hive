import { describe, it, expect } from 'vitest';
import { parseModuleDeepLink, searchWithModule, searchWithoutModule } from './moduleDeepLink';

describe('parseModuleDeepLink', () => {
    it('returns the module id from ?module=', () => {
        expect(parseModuleDeepLink('?tab=marketplace&module=pro')).toBe('pro');
    });

    it('returns null without a module param', () => {
        expect(parseModuleDeepLink('')).toBeNull();
        expect(parseModuleDeepLink('?tab=marketplace')).toBeNull();
    });

    it('yields to the Checkout return flow when purchase= is present', () => {
        expect(parseModuleDeepLink('?tab=marketplace&purchase=success&module=pro')).toBeNull();
        expect(parseModuleDeepLink('?purchase=cancel&module=pro')).toBeNull();
    });
});

describe('searchWithModule / searchWithoutModule', () => {
    const loc = { pathname: '/app/admin/modules', search: '?tab=marketplace', hash: '' };

    it('adds the module param, keeping existing params', () => {
        expect(searchWithModule('pro', loc)).toBe('/app/admin/modules?tab=marketplace&module=pro');
    });

    it('strips only the module param on close', () => {
        expect(searchWithoutModule({ ...loc, search: '?tab=marketplace&module=pro' }))
            .toBe('/app/admin/modules?tab=marketplace');
    });

    it('drops the "?" when nothing remains', () => {
        expect(searchWithoutModule({ pathname: '/x', search: '?module=pro', hash: '#h' })).toBe('/x#h');
    });
});
