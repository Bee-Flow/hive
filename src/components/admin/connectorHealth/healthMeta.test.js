import { describe, it, expect } from 'vitest';
import {
    STATUS_META, STATUS_IDS, statusRank,
    SEVERITY_META, SEVERITY_IDS, sevMeta,
    orgIsBlocked, labelFor, summarize,
} from './healthMeta';

// The pinned admin API contract enums — healthMeta must cover them completely.
const HEALTH_ENUM = ['ok', 'no_subscription', 'onboarding_pending', 'users_pending_approval', 'tenant_key_mismatch', 'chat_failing', 'inactive'];
const SEVERITY_ENUM = ['info', 'warning', 'error', 'critical'];

describe('healthMeta', () => {
    it('has complete meta for every pinned health status', () => {
        for (const status of HEALTH_ENUM) {
            const meta = STATUS_META[status];
            expect(meta, `missing STATUS_META for ${status}`).toBeTruthy();
            expect(meta.labelKey).toMatch(/^admin\.ch_status_/);
            expect(typeof meta.fallback).toBe('string');
            expect(meta.Icon).toBeTruthy();
            expect(meta.color).toBeTruthy();
            expect(meta.chip).toBeTruthy();
            expect(typeof meta.severityRank).toBe('number');
        }
        expect(Object.keys(STATUS_META).sort()).toEqual([...HEALTH_ENUM].sort());
        expect(STATUS_IDS).toHaveLength(HEALTH_ENUM.length);
    });

    it('sorts STATUS_IDS worst-first and ranks ok lowest', () => {
        const ranks = STATUS_IDS.map(id => STATUS_META[id].severityRank);
        expect([...ranks].sort((a, b) => b - a)).toEqual(ranks);
        expect(STATUS_IDS[STATUS_IDS.length - 1]).toBe('ok');
        expect(statusRank('unknown-status')).toBe(0);
    });

    it('has complete meta for every pinned severity', () => {
        for (const sev of SEVERITY_ENUM) {
            const meta = SEVERITY_META[sev];
            expect(meta, `missing SEVERITY_META for ${sev}`).toBeTruthy();
            expect(meta.Icon).toBeTruthy();
            expect(meta.dot).toBeTruthy();
            expect(meta.chip).toBeTruthy();
        }
        expect(SEVERITY_IDS.sort()).toEqual([...SEVERITY_ENUM].sort());
        // Unknown severities fall back to the neutral info style.
        expect(sevMeta('bogus')).toBe(SEVERITY_META.info);
    });

    it('never uses purple anywhere (colour rule)', () => {
        const all = [...Object.values(STATUS_META), ...Object.values(SEVERITY_META)];
        for (const meta of all) {
            const blob = `${meta.color} ${meta.chip} ${meta.dot || ''}`.toLowerCase();
            expect(blob).not.toMatch(/purple|violet|#8b5cf6|#a78bfa|#7c3aed/);
        }
    });

    it('labelFor falls back gracefully for unknown codes', () => {
        expect(labelFor('chat.subscription_blocked')).toBe('Chat blocked: subscription');
        expect(labelFor('brand.new_thing')).toBe('brand new thing');
        expect(labelFor('')).toBe('');
        expect(labelFor(null)).toBe('');
    });

    it('summarize only surfaces whitelisted meta keys — never the raw payload', () => {
        const s = summarize({
            code: 'chat.subscription_blocked',
            meta: { reason: 'no_subscription', token: 'SECRET-XYZ', prompt: 'user message text', nested: { deep: 1 } },
        });
        expect(s).toContain('reason: no_subscription');
        expect(s).not.toContain('SECRET-XYZ');
        expect(s).not.toContain('user message text');
        expect(s).not.toContain('[object');
        expect(s).not.toContain('{');
    });

    it('summarize is empty-safe for unknown codes and missing meta', () => {
        expect(summarize({ code: 'unknown.code', meta: { anything: 'else' } })).toBe('');
        expect(summarize({ code: 'unknown.code', meta: { reason: 'why' } })).toBe('reason: why');
        expect(summarize({ code: 'chat.provider_error' })).toBe('');
        expect(summarize(null)).toBe('');
    });

    it('orgIsBlocked is true only for open error/critical problems', () => {
        expect(orgIsBlocked({ problems: [{ severity: 'critical' }] })).toBe(true);
        expect(orgIsBlocked({ problems: [{ severity: 'error' }] })).toBe(true);
        expect(orgIsBlocked({ problems: [{ severity: 'warning' }, { severity: 'info' }] })).toBe(false);
        expect(orgIsBlocked({ problems: [] })).toBe(false);
        expect(orgIsBlocked({})).toBe(false);
        expect(orgIsBlocked(null)).toBe(false);
    });
});
