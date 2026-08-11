import { describe, expect, it } from 'vitest';
import { buildRefineContext, mergeRefinedPlan } from './refineMerge';

const currentState = () => ({
    name: 'Support Bot',
    description: 'Helps with support',
    systemPrompt: 'Be helpful.',
    avatar: '🤖',
    model: 'tier:thinking',
    config: {
        enabledIntegrations: ['gmail', 'google-calendar'],
        attachedSkillIds: ['skill-1'],
        knowledge_base_ids: ['kb-1'],
        wizard: { capabilities: ['answer questions'] },
        memoryEnabled: true, // an unrelated config key that must survive
    },
});

describe('buildRefineContext', () => {
    it('carries the live curated config (model/apps/skills/kbs) and live description', () => {
        const ctx = buildRefineContext({
            name: 'Support Bot',
            description: 'live description',
            avatar: '🤖',
            systemPrompt: 'Be helpful.',
            capabilities: ['a'],
            model: 'tier:thinking',
            enabledIntegrations: ['gmail'],
            attachedSkills: [{ id: 'skill-1', name: 'Refunds' }],
            knowledge_base_ids: ['kb-1'],
        });
        expect(ctx.plan.description).toBe('live description');
        expect(ctx.plan.systemPrompt).toBe('Be helpful.');
        expect(ctx.current.model).toBe('tier:thinking');
        expect(ctx.current.enabledIntegrations).toEqual(['gmail']);
        expect(ctx.current.attachedSkills).toEqual([{ id: 'skill-1', name: 'Refunds' }]);
        expect(ctx.current.knowledge_base_ids).toEqual(['kb-1']);
    });
});

describe('mergeRefinedPlan — preserve & patch', () => {
    const opts = {
        availableIntegrationIds: ['gmail', 'google-calendar', 'google-drive'],
        selectableTierKeys: ['fast', 'thinking'],
    };

    it('a tone-only refine keeps curated apps, model, skills and KBs', () => {
        const current = currentState();
        // AI returns only a new systemPrompt; omits apps/model/skills/kbs.
        const updated = { name: 'Support Bot', systemPrompt: 'Be warm and helpful.' };
        const preserved = {
            model: 'tier:thinking',
            enabledIntegrations: ['gmail', 'google-calendar'],
            attachedSkillIds: ['skill-1'],
            knowledge_base_ids: ['kb-1'],
        };
        const merged = mergeRefinedPlan(current, updated, preserved, opts);

        expect(merged.systemPrompt).toBe('Be warm and helpful.');       // patched
        expect(merged.model).toBe('tier:thinking');                     // preserved
        expect(merged.config.enabledIntegrations).toEqual(['gmail', 'google-calendar']); // preserved
        expect(merged.config.attachedSkillIds).toEqual(['skill-1']);    // preserved
        expect(merged.config.knowledge_base_ids).toEqual(['kb-1']);     // preserved
        expect(merged.config.memoryEnabled).toBe(true);                 // unrelated key survives
    });

    it('never blanks the model, and applies a NEW selectable tier when asked', () => {
        const current = currentState();
        const merged = mergeRefinedPlan(current, { model: 'fast' }, {}, opts);
        expect(merged.model).toBe('tier:fast');
        // non-selectable tier is ignored, current kept
        const merged2 = mergeRefinedPlan(current, { model: 'nonexistent' }, {}, opts);
        expect(merged2.model).toBe('tier:thinking');
        // absent model → keep current
        const merged3 = mergeRefinedPlan(current, {}, {}, opts);
        expect(merged3.model).toBe('tier:thinking');
    });

    it('unions skills — existing survive and new resolved ids are added, none dropped', () => {
        const current = currentState();
        const merged = mergeRefinedPlan(current, { skills: [] }, {}, {
            ...opts,
            resolvedSkillIds: ['skill-1', 'skill-2'],
        });
        expect(merged.config.attachedSkillIds).toEqual(['skill-1', 'skill-2']);
    });

    it('replaces apps only with a non-empty AI array; an empty array preserves', () => {
        const current = currentState();
        // AI adds drive + removes calendar (non-empty) → replace
        const merged = mergeRefinedPlan(current, { enabledIntegrations: ['gmail', 'google-drive'] }, {}, opts);
        expect(merged.config.enabledIntegrations).toEqual(['gmail', 'google-drive']);
        // AI returns empty → preserve curated
        const merged2 = mergeRefinedPlan(current, { enabledIntegrations: [] }, {}, opts);
        expect(merged2.config.enabledIntegrations).toEqual(['gmail', 'google-calendar']);
        // AI returns an unknown id → filtered out
        const merged3 = mergeRefinedPlan(current, { enabledIntegrations: ['gmail', 'bogus'] }, {}, opts);
        expect(merged3.config.enabledIntegrations).toEqual(['gmail']);
    });

    it('patches systemPrompt only when non-blank; preserves on blank/absent', () => {
        const current = currentState();
        expect(mergeRefinedPlan(current, { systemPrompt: '   ' }, {}, opts).systemPrompt).toBe('Be helpful.');
        expect(mergeRefinedPlan(current, {}, {}, opts).systemPrompt).toBe('Be helpful.');
        expect(mergeRefinedPlan(current, { systemPrompt: 'New.' }, {}, opts).systemPrompt).toBe('New.');
    });

    it('preserves knowledge_base_ids when the AI omits or empties them', () => {
        const current = currentState();
        expect(mergeRefinedPlan(current, {}, {}, opts).config.knowledge_base_ids).toEqual(['kb-1']);
        expect(mergeRefinedPlan(current, { knowledge_base_ids: [] }, {}, opts).config.knowledge_base_ids).toEqual(['kb-1']);
        expect(mergeRefinedPlan(current, { knowledge_base_ids: ['kb-2'] }, {}, opts).config.knowledge_base_ids).toEqual(['kb-2']);
    });
});
