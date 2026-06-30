/**
 * Single source of truth for subscription-plan feature id → human label.
 *
 * Pure data (no icons / framework imports) so it is safe to import from
 * both the admin Subscriptions UI and the (server-rendered) marketing
 * pricing block. `FEATURE_OPTIONS` in
 * components/admin/subscriptions/constants.js re-exports FEATURE_CATALOG.
 *
 * Note: this curated list is the set of *core* plan features admins can
 * toggle. Integration-style ids (e.g. `web_search`, which is an
 * agent-search integration, not a license feature) are intentionally NOT
 * added here — `featureLabel()` still renders them nicely via the
 * title-case fallback, so the pricing block never shows raw snake_case.
 */

export const FEATURE_CATALOG = [
    { id: 'chat',           label: 'Chat' },
    { id: 'agents',         label: 'Agents' },
    { id: 'knowledge_base', label: 'Knowledge Base' },
    { id: 'embed_chat',     label: 'Embed Chat' },
    { id: 'direct_chat',    label: 'Direct Chat' },
    { id: 'workspace',      label: 'Workspace' },
    { id: 'notebooks',      label: 'Notebooks' },
    { id: 'encryption',     label: 'Encryption (PIN)' },
];

const LABEL_BY_ID = Object.fromEntries(FEATURE_CATALOG.map(f => [f.id, f.label]));

// Title-case a raw id as a fallback: "web_search" → "Web Search". Ensures
// unknown / integration feature ids never render as snake_case.
function prettify(id) {
    return String(id)
        .replace(/[_-]+/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase())
        .trim();
}

export function featureLabel(id) {
    if (id === null || id === undefined) return '';
    return LABEL_BY_ID[id] || prettify(id);
}
