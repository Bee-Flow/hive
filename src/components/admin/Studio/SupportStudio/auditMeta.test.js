import { describe, it, expect } from 'vitest';
import { categoryFor, labelFor, summarize, metaFor, CATEGORY_META } from './auditMeta';

describe('auditMeta.categoryFor', () => {
    it('uses the precise actor_kind when present', () => {
        expect(categoryFor({ actor_kind: 'ai', action: 'ai_reply' })).toBe('ai');
        expect(categoryFor({ actor_kind: 'automation', action: 'sla_breach' })).toBe('automation');
        expect(categoryFor({ actor_kind: 'staff', action: 'staff_reply' })).toBe('staff');
        expect(categoryFor({ actor_kind: 'requester', action: 'reply' })).toBe('requester');
    });

    it('promotes legacy system rows whose action is an AI/automation action', () => {
        // Pre-refactor events were recorded as actor_kind:'system'.
        expect(categoryFor({ actor_kind: 'system', action: 'ai_action' })).toBe('ai');
        expect(categoryFor({ actor_kind: 'system', action: 'classified_not_support' })).toBe('automation');
    });

    it('keeps genuine system actions as system', () => {
        expect(categoryFor({ actor_kind: 'system', action: 'email_ingested' })).toBe('system');
        expect(categoryFor({ actor_kind: 'system', action: 'auto_assigned' })).toBe('system');
    });

    it('falls back to the action mapping when actor_kind is absent', () => {
        expect(categoryFor({ action: 'inbox_access_changed' })).toBe('staff');
        expect(categoryFor({ action: 'reopened' })).toBe('requester');
        expect(categoryFor({ action: 'totally_unknown' })).toBe('system');
    });
});

describe('auditMeta.labelFor / summarize / metaFor', () => {
    it('labels known actions and humanises unknown ones', () => {
        expect(labelFor('ai_reply')).toBe('AI replied');
        expect(labelFor('inbox_access_changed')).toBe('Access changed');
        expect(labelFor('some_new_action')).toBe('some new action');
    });

    it('summarises payloads usefully', () => {
        expect(summarize({ action: 'inbox_settings_changed', payload: { changed: ['signature', 'reply_mode'] } })).toBe('signature, reply_mode');
        expect(summarize({ action: 'ai_action', payload: { tool: 'kb_search' } })).toBe('kb_search');
        expect(summarize({ action: 'inbox_access_changed', payload: { sharedGroups: ['g1', 'g2'] } })).toContain('2 group');
        expect(summarize({ action: 'inbox_access_changed', payload: { sharedGroups: [] } })).toContain('open');
    });

    it('metaFor returns the AI icon + accent for an AI event', () => {
        const m = metaFor({ actor_kind: 'ai', action: 'ai_reply', payload: { confidence: 0.9 } });
        expect(m.category).toBe('ai');
        expect(m.Icon).toBe(CATEGORY_META.ai.Icon);
        expect(m.color).toBe('var(--accent-primary)');
        expect(m.label).toBe('AI replied');
    });

    it('every category has an icon and colour', () => {
        for (const k of Object.keys(CATEGORY_META)) {
            expect(CATEGORY_META[k].Icon).toBeTruthy();
            expect(typeof CATEGORY_META[k].color).toBe('string');
        }
    });
});
