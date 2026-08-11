import { describe, it, expect } from 'vitest';
import { buildPurchaseReturnUrls, parsePurchaseReturn, stripPurchaseReturnParams } from './purchaseReturn';

describe('buildPurchaseReturnUrls', () => {
    const loc = { origin: 'https://ai.example.com', pathname: '/app/admin/modules' };

    it('builds success/cancel twins pointing at the marketplace tab', () => {
        expect(buildPurchaseReturnUrls('pro', loc)).toEqual({
            successUrl: 'https://ai.example.com/app/admin/modules?tab=marketplace&purchase=success&module=pro',
            cancelUrl: 'https://ai.example.com/app/admin/modules?tab=marketplace&purchase=cancel&module=pro',
        });
    });

    it('URL-encodes the module id', () => {
        const { successUrl } = buildPurchaseReturnUrls('a b/c', loc);
        expect(successUrl).toContain('module=a+b%2Fc');
    });
});

describe('parsePurchaseReturn', () => {
    it('parses a success return with its module id', () => {
        expect(parsePurchaseReturn('?tab=marketplace&purchase=success&module=pro'))
            .toEqual({ result: 'success', moduleId: 'pro' });
    });

    it('parses a cancel return; missing module id becomes null', () => {
        expect(parsePurchaseReturn('?purchase=cancel'))
            .toEqual({ result: 'cancel', moduleId: null });
    });

    it('returns null when there is no (or an unknown) purchase param', () => {
        expect(parsePurchaseReturn('')).toBeNull();
        expect(parsePurchaseReturn('?tab=marketplace')).toBeNull();
        expect(parsePurchaseReturn('?purchase=maybe&module=pro')).toBeNull();
    });
});

describe('stripPurchaseReturnParams', () => {
    it('removes purchase/module but keeps tab (and the hash)', () => {
        expect(stripPurchaseReturnParams({
            pathname: '/app/admin/modules',
            search: '?tab=marketplace&purchase=success&module=pro',
            hash: '#top',
        })).toBe('/app/admin/modules?tab=marketplace#top');
    });

    it('drops the "?" entirely when no params remain', () => {
        expect(stripPurchaseReturnParams({ pathname: '/app/admin/modules', search: '?purchase=cancel&module=pro' }))
            .toBe('/app/admin/modules');
    });
});
