/**
 * Pure helpers for the "preserve & patch" refine flow. No React — unit-testable
 * in isolation.
 *
 *   buildRefineContext(state) → { plan, current }
 *     The request payload the editor sends to POST /agents/wizard/refine. `plan`
 *     is the editable text surface the AI rewrites; `current` is the curated
 *     configuration the server is told to preserve.
 *
 *   mergeRefinedPlan(current, updated, preserved, opts) → { name, description,
 *     systemPrompt, avatar, model, config }
 *     Deterministically folds the AI's plan into the agent's current state so a
 *     tone-only refine NEVER wipes curated apps/skills/model/KBs.
 *
 * Golden rule: absent/empty field ⇒ keep current. Curated collections
 * (apps, skills, knowledge bases) are additive on refine — refine can add to
 * them but never silently empties them; removals are done manually in the editor.
 */

/** Build the { plan, current } portions of the refine request from live state. */
export function buildRefineContext(state = {}) {
    const {
        name, description, avatar, systemPrompt, capabilities,
        model, enabledIntegrations, attachedSkills, knowledge_base_ids,
    } = state;
    return {
        plan: {
            name: name || '',
            description: description || '',
            avatar: avatar || '',
            systemPrompt: systemPrompt || '',
            capabilities: Array.isArray(capabilities) ? capabilities : [],
        },
        current: {
            // Full model string (e.g. "tier:thinking" / a custom tier) — the
            // server echoes it back verbatim in `preserved.model`.
            model: typeof model === 'string' ? model : null,
            enabledIntegrations: Array.isArray(enabledIntegrations) ? enabledIntegrations : [],
            // [{ id, name }] so the model can reuse skills by id.
            attachedSkills: Array.isArray(attachedSkills) ? attachedSkills : [],
            knowledge_base_ids: Array.isArray(knowledge_base_ids) ? knowledge_base_ids : [],
        },
    };
}

const uniq = (arr) => Array.from(new Set((arr || []).filter(Boolean)));

/**
 * @param {object} current  { name, description, systemPrompt, avatar, model, config:{ enabledIntegrations, attachedSkillIds, knowledge_base_ids, wizard } }
 * @param {object} updated  the normalized AI plan
 * @param {object} preserved the server's echo of the current curated config
 * @param {object} opts     { availableIntegrationIds, selectableTierKeys, resolvedSkillIds }
 */
export function mergeRefinedPlan(current = {}, updated = {}, preserved = {}, opts = {}) {
    const {
        availableIntegrationIds = [],
        selectableTierKeys = [],
        resolvedSkillIds = null, // caller's already-unioned skill ids (current ∪ reused ∪ created)
    } = opts;
    const curConfig = current.config || {};

    // ── name / avatar — take the AI value only when it provided a real one ──
    const name = (typeof updated.name === 'string' && updated.name.trim()) ? updated.name : current.name;
    const avatar = updated.avatar || current.avatar;

    // ── description / systemPrompt — the patch targets ──
    const description = (typeof updated.description === 'string') ? updated.description : current.description;
    const systemPrompt = (typeof updated.systemPrompt === 'string' && updated.systemPrompt.trim())
        ? updated.systemPrompt
        : current.systemPrompt;

    // ── model — apply the AI's tier ONLY if it maps to a real, selectable tier;
    // otherwise keep the current tier. Never blank the model. (preserved.model
    // already equals current.model.) ──
    let model = current.model;
    if (typeof updated.model === 'string' && updated.model) {
        const tierName = updated.model === 'smart' ? 'thinking' : updated.model;
        if (selectableTierKeys.includes(tierName)) model = `tier:${tierName}`;
    }

    // ── enabledIntegrations — replace only with a NON-EMPTY AI array (handles
    // add & remove intent); an empty/absent array means "AI didn't touch apps"
    // → preserve. This is what stops a tone refine from wiping curated apps. ──
    const curApps = Array.isArray(preserved.enabledIntegrations) && preserved.enabledIntegrations.length
        ? preserved.enabledIntegrations
        : (Array.isArray(curConfig.enabledIntegrations) ? curConfig.enabledIntegrations : []);
    let enabledIntegrations = curApps;
    if (Array.isArray(updated.enabledIntegrations) && updated.enabledIntegrations.length) {
        enabledIntegrations = updated.enabledIntegrations.filter(id => availableIntegrationIds.includes(id));
    }

    // ── skills — UNION, never subtract. resolvedSkillIds is the caller's fully
    // resolved set; fall back to current when the refine touched no skills. ──
    const attachedSkillIds = Array.isArray(resolvedSkillIds)
        ? uniq(resolvedSkillIds)
        : (Array.isArray(curConfig.attachedSkillIds) ? curConfig.attachedSkillIds : []);

    // ── knowledge_base_ids — replace only with a NON-EMPTY AI array; else
    // preserve (refines almost never edit KBs and the model often omits them). ──
    const curKbs = Array.isArray(preserved.knowledge_base_ids) && preserved.knowledge_base_ids.length
        ? preserved.knowledge_base_ids
        : (Array.isArray(curConfig.knowledge_base_ids) ? curConfig.knowledge_base_ids : []);
    let knowledge_base_ids = curKbs;
    if (Array.isArray(updated.knowledge_base_ids) && updated.knowledge_base_ids.length) {
        knowledge_base_ids = updated.knowledge_base_ids;
    }

    const config = {
        ...curConfig,
        enabledIntegrations,
        attachedSkillIds,
        knowledge_base_ids,
        wizard: {
            ...(curConfig.wizard || {}),
            capabilities: Array.isArray(updated.capabilities) ? updated.capabilities : (curConfig.wizard?.capabilities || []),
        },
    };

    return { name, description, systemPrompt, avatar, model, config };
}
