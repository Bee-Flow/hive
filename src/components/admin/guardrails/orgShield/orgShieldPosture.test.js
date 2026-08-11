import { describe, it, expect } from 'vitest';

import { derivePosture } from './orgShieldPosture';

/**
 * Pure module, so these assert on `tone` and the structured `value` rather
 * than on copy. The rows worth testing are the ones that flag a state the old
 * page rendered as if it were fine.
 */

const CATEGORIES = Array.from({ length: 21 }, (_, i) => ({ id: `c${i}` }));

const BASE = {
    enabled: true,
    piiCategories: ['c0', 'c1'],
    piiConfidenceThreshold: 0.7,
    piiAction: 'block',
    showRawPayload: false,
    applyToAutomations: true,
    dlpEnabled: false,
    dlpMode: 'ask',
    webSearchGuard: false,
    euModeEnabled: false,
    toolPiiPolicy: { external: { blockCategories: [] }, internal: { blockCategories: [] } },
    customSensitiveTerms: [],
    piiAllowTerms: [],
    piiAllowPublicOrgs: true,
};

const derive = (over = {}, opts = {}) => derivePosture(
    { ...BASE, ...over },
    { categories: CATEGORIES, env: {}, licence: {}, ...opts },
);

const rowById = (result, id) => result.rows.find(r => r.id === id);

describe('derivePosture', () => {
    it('reports a disabled shield as off, with no rows to explain', () => {
        const result = derive({ enabled: false });
        expect(result.off).toBe(true);
        expect(result.rows).toEqual([]);
    });

    it('flags "shield on, zero categories" — detection that can never fire', () => {
        const result = derive({ piiCategories: [] });
        expect(rowById(result, 'categories').tone).toBe('warn');
        expect(rowById(result, 'categories').value).toEqual({ n: 0, total: 21 });
    });

    it('does not flag a normal category selection', () => {
        expect(rowById(derive(), 'categories').tone).toBe('ok');
    });

    it('reports a preset by id and a custom threshold as a percentage', () => {
        expect(rowById(derive({ piiConfidenceThreshold: 0.45 }), 'sensitivity').value)
            .toEqual({ presetId: 'high' });
        expect(rowById(derive({ piiConfidenceThreshold: 0.62 }), 'sensitivity').value)
            .toEqual({ customPct: 62 });
    });

    it('flags tokenize stored against a licence that no longer includes it', () => {
        // The state that used to render as "no action card selected" with no
        // explanation at all: the server does not clamp this field, so the row
        // really is tokenize while the runtime blocks.
        const result = derive({ piiAction: 'tokenize' }, { licence: { canTokenizePii: false } });
        const row = rowById(result, 'action');
        expect(row.tone).toBe('warn');
        expect(row.value).toEqual({ action: 'tokenize', unlicensed: true });
    });

    it('does not flag tokenize when the licence allows it', () => {
        const result = derive({ piiAction: 'tokenize' }, { licence: { canTokenizePii: true } });
        expect(rowById(result, 'action').tone).toBe('ok');
        expect(rowById(result, 'action').value.unlicensed).toBe(false);
    });

    it('treats transparency as off whenever the action is not tokenize', () => {
        // showRawPayload can be stored true while the control is not rendered.
        const result = derive({ piiAction: 'block', showRawPayload: true });
        expect(rowById(result, 'transparency').value).toEqual({ on: false });
    });

    it('reports the DLP mode only while DLP is on', () => {
        expect(rowById(derive({ dlpEnabled: false, dlpMode: 'block' }), 'dlp').value)
            .toEqual({ on: false, mode: null });
        expect(rowById(derive({ dlpEnabled: true, dlpMode: 'auto_redact' }), 'dlp').value)
            .toEqual({ on: true, mode: 'auto_redact' });
    });

    it('counts both tool classes against the catalog total', () => {
        const result = derive({
            toolPiiPolicy: { external: { blockCategories: ['c0'] }, internal: { blockCategories: ['c0', 'c1'] } },
        });
        expect(rowById(result, 'toolcalls').value).toEqual({ external: 1, internal: 2, total: 21 });
    });

    it('only mentions web search and EU models when they are configured at all', () => {
        expect(rowById(derive(), 'websearch')).toBeUndefined();
        expect(rowById(derive(), 'eu')).toBeUndefined();
        const withEnv = derive({}, { env: { hasWebSearchEnabled: true, hasEuModelsConfigured: true } });
        expect(rowById(withEnv, 'websearch')).toBeDefined();
        expect(rowById(withEnv, 'eu')).toBeDefined();
    });

    it('notes an active never-redact list without calling it an error', () => {
        expect(rowById(derive(), 'allowlist').tone).toBe('ok');
        const withTerms = derive({ piiAllowTerms: ['Microsoft'] });
        // A deliberate exception, not a misconfiguration — but the one control
        // that makes the shield leak on purpose, so it gets pointed at.
        expect(rowById(withTerms, 'allowlist').tone).toBe('note');
        expect(rowById(withTerms, 'allowlist').value).toEqual({ terms: 1, publicOrgs: true });
    });

    it('puts an unreachable guard first, as an error', () => {
        const result = derive({}, { guard: { configured: true, reachable: false } });
        expect(result.rows[0].id).toBe('guard');
        expect(result.rows[0].tone).toBe('error');
        // No tab to jump to: this is not fixed on this screen.
        expect(result.rows[0].tab).toBeNull();
    });

    it('says nothing about a healthy guard', () => {
        const result = derive({}, { guard: { configured: true, reachable: true } });
        expect(rowById(result, 'guard')).toBeUndefined();
    });
});
