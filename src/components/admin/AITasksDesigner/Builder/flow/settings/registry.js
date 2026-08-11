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
 * STATUS: SettingsHost is now wired into NodeDetailView (the mechanism is
 * live — an empty registry falls back to the legacy SettingsForm with zero
 * behaviour change). SettingsForm.jsx is ALREADY internally decomposed into
 * per-type field components (TriggerFields, AiStepFields,
 * IntegrationActionFields, LoopFields, …) plus a shared "shell" (the
 * baseline / dirty-tracking / debounced-autosave lifecycle + AccordionSection
 * layout). The remaining refactor is MECHANICAL and should be done as its own
 * focused PR per type:
 *   1. Move one <Type>Fields component into its own file here.
 *   2. Wrap it with a thin shell HOC that reuses the SAME save lifecycle the
 *      current SettingsForm shell provides (extract that shell first so a
 *      per-type editor never re-implements flushNow/buildPatch/baseline).
 *   3. registerSettings('<type>', <TypeSettings>) below.
 * Do NOT extract a per-type body WITHOUT the shared shell — duplicating the
 * save machinery per type is more code and more risk than the god-component.
 *
 * The host treats a missing entry as a signal to fall back to the
 * legacy SettingsForm, so this registry can stay empty without regressing
 * existing builds while the per-type PRs land.
 */

const REGISTRY = {};

export function registerSettings(type, component) {
    REGISTRY[type] = component;
}

export function getSettingsForType(type) {
    return REGISTRY[type] || null;
}

export default REGISTRY;
