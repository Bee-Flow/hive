import { describe, it, expect, beforeEach } from 'vitest';
import {
    getUsageKey,
    recordStep,
    readUsage,
    readTransitions,
    topFrequentKeys,
    scoreSuggestions,
    TRANSITION_RULES,
} from './stepUsage';
import scopedStorage from '../../../../../utils/scopedStorage';

const DAY = 86400000;

describe('stepUsage — getUsageKey', () => {
    it('keys a trigger by its triggerKind', () => {
        expect(getUsageKey({ kind: 'trigger', triggerKind: 'schedule' })).toBe('trigger:schedule');
        // missing triggerKind falls back to manual
        expect(getUsageKey({ kind: 'trigger' })).toBe('trigger:manual');
    });

    it('keys an integration_action by its tool', () => {
        expect(getUsageKey({ kind: 'integration_action', tool: 'gmail_send' })).toBe('action:gmail_send');
        // no tool -> null (nothing stable to record)
        expect(getUsageKey({ kind: 'integration_action' })).toBeNull();
    });

    it('keys call_layer by layerKey', () => {
        expect(getUsageKey({ kind: 'call_layer', layerKey: 'l1' })).toBe('flowlet:l1');
        expect(getUsageKey({ kind: 'call_layer' })).toBeNull();
    });

    it('keys call_block by blockId (incl. id 0)', () => {
        expect(getUsageKey({ kind: 'call_block', blockId: 'b9' })).toBe('block:b9');
        expect(getUsageKey({ kind: 'call_block', blockId: 0 })).toBe('block:0');
        expect(getUsageKey({ kind: 'call_block' })).toBeNull();
    });

    it('keys create_layer as a fixed key', () => {
        expect(getUsageKey({ kind: 'create_layer' })).toBe('layer:create');
    });

    it('keys any other step kind as step:<kind>', () => {
        expect(getUsageKey({ kind: 'ai_step' })).toBe('step:ai_step');
        expect(getUsageKey({ kind: 'loop' })).toBe('step:loop');
    });

    it('returns null for null / kind-less payloads', () => {
        expect(getUsageKey(null)).toBeNull();
        expect(getUsageKey(undefined)).toBeNull();
        expect(getUsageKey({})).toBeNull();
    });
});

describe('stepUsage — recordStep (storage)', () => {
    beforeEach(() => {
        scopedStorage.setCurrentUser('test-user');
        try { localStorage.clear(); } catch { /* ignore */ }
    });

    it('increments frequency and stamps lastUsed', () => {
        const t0 = 1_000_000;
        recordStep({ kind: 'ai_step' }, null, t0);
        recordStep({ kind: 'ai_step' }, null, t0 + 5);
        const usage = readUsage();
        expect(usage['step:ai_step']).toEqual({ n: 2, t: t0 + 5 });
    });

    it('records the source→step transition under the source kind', () => {
        recordStep({ kind: 'set' }, { kind: 'ai_step' }, 1);
        recordStep({ kind: 'set' }, { kind: 'ai_step' }, 2);
        const tr = readTransitions();
        expect(tr.ai_step['step:set']).toBe(2);
    });

    it('uses sourceStep.type when kind is absent', () => {
        recordStep({ kind: 'notification' }, { type: 'loop' }, 1);
        expect(readTransitions().loop['step:notification']).toBe(1);
    });

    it('buckets transitions under __none when there is no source step', () => {
        recordStep({ kind: 'ai_step' }, null, 1);
        expect(readTransitions().__none['step:ai_step']).toBe(1);
    });

    it('is a no-op for a key-less payload', () => {
        recordStep({ kind: 'integration_action' }, { kind: 'ai_step' }, 1);
        expect(readUsage()).toEqual({});
        expect(readTransitions()).toEqual({});
    });

    it('records integration actions by tool', () => {
        recordStep({ kind: 'integration_action', tool: 'gmail_send' }, { kind: 'ai_step' }, 1);
        expect(readUsage()['action:gmail_send'].n).toBe(1);
        expect(readTransitions().ai_step['action:gmail_send']).toBe(1);
    });
});

describe('stepUsage — topFrequentKeys recency weighting', () => {
    it('lets a recent low-count item outrank a stale high-count one past the half-life', () => {
        const now = 100 * DAY;
        const usage = {
            // old & big: 10 uses, but 28 days ago (two half-lives) -> score 10 * 0.25 = 2.5
            'step:loop': { n: 10, t: now - 28 * DAY },
            // recent & small: 4 uses, right now -> score 4 * 1 = 4
            'step:ai_step': { n: 4, t: now },
        };
        const ranked = topFrequentKeys(usage, 6, now);
        expect(ranked).toEqual(['step:ai_step', 'step:loop']);
    });

    it('a fresh item ties on decay so higher raw count wins', () => {
        const now = 50 * DAY;
        const usage = {
            'step:set': { n: 3, t: now },
            'step:filter': { n: 7, t: now },
        };
        expect(topFrequentKeys(usage, 6, now)).toEqual(['step:filter', 'step:set']);
    });

    it('respects the n cap', () => {
        const now = DAY;
        const usage = {
            a: { n: 5, t: now }, b: { n: 4, t: now }, c: { n: 3, t: now }, d: { n: 2, t: now },
        };
        expect(topFrequentKeys(usage, 2, now)).toEqual(['a', 'b']);
    });

    it('returns [] for empty/missing usage', () => {
        expect(topFrequentKeys({}, 6, 0)).toEqual([]);
        expect(topFrequentKeys(undefined, 6, 0)).toEqual([]);
    });
});

describe('stepUsage — scoreSuggestions', () => {
    const NOW = 10 * DAY;

    it('surfaces loop/filter first when the source output is a list', () => {
        const out = scoreSuggestions({ sourceKind: 'integration_action', sourceOutputIsArray: true, now: NOW });
        const keys = out.map(s => s.key);
        expect(keys[0]).toBe('step:loop');
        expect(keys.slice(0, 3)).toContain('step:filter');
        // the array winners should carry the "fits a list" reason
        expect(out.find(s => s.key === 'step:loop').reason).toBe('fits a list');
    });

    it('surfaces set/notification after an ai_step', () => {
        const out = scoreSuggestions({ sourceKind: 'ai_step', now: NOW });
        const keys = out.map(s => s.key);
        expect(keys).toContain('step:set');
        expect(keys).toContain('step:notification');
        // ai_step rules rank set above notification
        expect(keys.indexOf('step:set')).toBeLessThan(keys.indexOf('step:notification'));
    });

    it('never returns a trigger:* suggestion', () => {
        const usage = { 'trigger:schedule': { n: 99, t: NOW } };
        const transitions = { ai_step: { 'trigger:manual': 50 } };
        const out = scoreSuggestions({ sourceKind: 'ai_step', usage, transitions, now: NOW });
        expect(out.every(s => !s.key.startsWith('trigger:'))).toBe(true);
    });

    it('lets a personal transition boost a key above the static ranking', () => {
        // Static: after ai_step, set > notification. A strong personal habit of
        // adding a Gmail action after ai_step should push it to the top.
        const transitions = { ai_step: { 'action:gmail_send': 5 } };
        const out = scoreSuggestions({ sourceKind: 'ai_step', transitions, now: NOW });
        expect(out[0].key).toBe('action:gmail_send');
        expect(out[0].reason).toBe('you usually do this next');
    });

    it('lets personal frequency boost a key', () => {
        const baseline = scoreSuggestions({ sourceKind: 'ai_step', now: NOW });
        const hasBlock = baseline.some(s => s.key === 'block:b1');
        expect(hasBlock).toBe(false); // not present without frequency signal

        const usage = { 'block:b1': { n: 20, t: NOW } };
        const out = scoreSuggestions({ sourceKind: 'ai_step', usage, now: NOW });
        const entry = out.find(s => s.key === 'block:b1');
        expect(entry).toBeTruthy();
        expect(entry.reason).toBe('you use this a lot');
    });

    it('respects the limit', () => {
        const usage = {
            'block:b1': { n: 9, t: NOW }, 'block:b2': { n: 8, t: NOW }, 'block:b3': { n: 7, t: NOW },
        };
        const transitions = { ai_step: { 'action:a1': 3, 'action:a2': 2 } };
        const out = scoreSuggestions({ sourceKind: 'ai_step', usage, transitions, now: NOW, limit: 3 });
        expect(out).toHaveLength(3);
    });

    it('falls back to __default rules for an unknown source kind', () => {
        const out = scoreSuggestions({ sourceKind: 'wait', now: NOW });
        const keys = out.map(s => s.key);
        expect(keys[0]).toBe('step:ai_step'); // __default leads with ai_step
    });

    it('dedupes keys that appear in multiple signals (single entry, summed score)', () => {
        // ai_step appears in __default rules AND in frequency.
        const usage = { 'step:ai_step': { n: 30, t: NOW } };
        const out = scoreSuggestions({ sourceKind: 'wait', usage, now: NOW });
        const aiEntries = out.filter(s => s.key === 'step:ai_step');
        expect(aiEntries).toHaveLength(1);
    });
});

describe('stepUsage — TRANSITION_RULES shape', () => {
    it('exposes the required signal keys with step:* candidates', () => {
        for (const k of ['__trigger', '__array', '__default', 'ai_step', 'integration_action', 'loop', 'condition']) {
            expect(Array.isArray(TRANSITION_RULES[k])).toBe(true);
            expect(TRANSITION_RULES[k].length).toBeGreaterThan(0);
            for (const r of TRANSITION_RULES[k]) {
                expect(typeof r.key).toBe('string');
                expect(typeof r.w).toBe('number');
            }
        }
        expect(TRANSITION_RULES.__array.some(r => r.key === 'step:loop')).toBe(true);
    });
});
