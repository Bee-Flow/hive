/**
 * Client-side mirror of the server's deriveCompletedSkillIds.
 * A skill counts as "completed" when it's activated AND either:
 *   - a downstream skill is also activated (pipeline moved past it), or
 *   - it has no downstream (terminal node that's active = pipeline done).
 * Kept duplicated on the client to avoid a round-trip; logic is tiny.
 */
export function deriveCompletedSkillIds(sessionSkills, activatedSkillIds) {
    if (!Array.isArray(sessionSkills) || sessionSkills.length === 0) return [];
    const activated = new Set(Array.isArray(activatedSkillIds) ? activatedSkillIds : []);
    if (activated.size === 0) return [];
    const downstream = new Map(sessionSkills.map(s => [s.id, []]));
    for (const s of sessionSkills) {
        for (const dep of s.dependsOn || []) {
            if (downstream.has(dep)) downstream.get(dep).push(s.id);
        }
    }
    const completed = [];
    for (const s of sessionSkills) {
        if (!activated.has(s.id)) continue;
        const down = downstream.get(s.id) || [];
        const hasActiveDownstream = down.some(id => activated.has(id));
        const isTerminal = down.length === 0;
        if (hasActiveDownstream || isTerminal) completed.push(s.id);
    }
    return completed;
}

/**
 * Classify each session skill into a single lifecycle state for rendering:
 *   'done'    — activated + considered completed.
 *   'active'  — activated + still in focus (downstream not activated yet).
 *   'ready'   — not activated, dependencies met, ready to activate.
 *   'waiting' — not activated, has unmet dependencies.
 */
export function classifySessionSkill(skill, activatedSet, completedSet) {
    if (completedSet.has(skill.id)) return 'done';
    if (activatedSet.has(skill.id)) return 'active';
    const unmet = (skill.dependsOn || []).filter(dep => !activatedSet.has(dep));
    return unmet.length === 0 ? 'ready' : 'waiting';
}
