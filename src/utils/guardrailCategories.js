/**
 * Maps a guardrail category id to its emoji-catalog id so an active icon
 * pack can override per-site rendering. Used by the PII picker and the
 * Privacy Shield UI.
 *
 * Content moderation (Hate / Violence / Sexual / Self-Harm via Azure AI
 * Content Safety, and the MLCommons S1-S14 taxonomy) was removed; only PII
 * and regex guardrail categories remain. PII categories don't have catalog
 * ids — they fall back to the `default` emoji passed by the caller.
 */
export function guardrailCatalogIdFor(_id) {
    return null;
}
