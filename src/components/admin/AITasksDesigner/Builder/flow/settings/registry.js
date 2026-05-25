/**
 * Per-step-type settings registry (§2 scaffolding).
 *
 * Goal: replace the 1774-line SettingsForm.jsx god-component with one
 * file per step type, mirroring the existing flow/nodes/ layout. The
 * SettingsHost (sibling file) looks up the right component here and
 * renders it inside a SettingsContext that carries binding helpers,
 * variable scope, and validation matchers.
 *
 * Phase 1 lands the directory + the registry contract; per-type
 * editors are migrated out of SettingsForm.jsx one at a time so the
 * cutover is non-breaking. Add a new entry here as each editor moves.
 *
 * Example future entries (filled in by per-type PRs):
 *   ai:                 require('./AiStepSettings').default,
 *   code:               require('./CodeStepSettings').default,
 *   integration_action: require('./IntegrationActionStepSettings').default,
 *   condition:          require('./ConditionStepSettings').default,
 *   ...
 *
 * The host treats a missing entry as a signal to fall back to the
 * legacy SettingsForm, so this registry can start empty without
 * regressing existing builds.
 */

const REGISTRY = {};

export function registerSettings(type, component) {
    REGISTRY[type] = component;
}

export function getSettingsForType(type) {
    return REGISTRY[type] || null;
}

export default REGISTRY;
