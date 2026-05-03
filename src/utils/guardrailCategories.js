/**
 * Single source of truth for guardrail / moderation category metadata.
 *
 * Used by:
 *   - the admin Privacy Shield UI (GuardrailsPanel) to render checkbox grids
 *   - the end-user violation toast so "S5" becomes "Defamation"
 *   - the "What the end user sees" preview cards
 *
 * Keep the raw `id` stable — that's what the server stores and what Llama
 * Guard / Azure return. Only the `label` and `icon` are for humans.
 */

// Llama Guard safety taxonomy (S1-S14). Source: meta-llama/Llama-Guard-3-8B card.
export const LLAMA_GUARD_CATEGORIES = [
    { id: 'S1',  label: 'Violent Crimes',            icon: '⚔️' },
    { id: 'S2',  label: 'Non-Violent Crimes',        icon: '⚠️' },
    { id: 'S3',  label: 'Sex-Related Crimes',        icon: '🚫' },
    { id: 'S4',  label: 'Child Sexual Exploitation', icon: '🔴' },
    { id: 'S5',  label: 'Defamation',                icon: '🗣️' },
    { id: 'S6',  label: 'Specialized Advice',        icon: '⚖️' },
    { id: 'S7',  label: 'Privacy',                   icon: '🔒' },
    { id: 'S8',  label: 'Intellectual Property',     icon: '©️' },
    { id: 'S9',  label: 'Indiscriminate Weapons',    icon: '💣' },
    { id: 'S10', label: 'Hate',                      icon: '🚷' },
    { id: 'S11', label: 'Suicide & Self-Harm',       icon: '💔' },
    { id: 'S12', label: 'Sexual Content',            icon: '🔞' },
    { id: 'S13', label: 'Elections',                 icon: '🗳️' },
    { id: 'S14', label: 'Code Interpreter Abuse',    icon: '💻' },
];

// Azure Content Safety has 4 coarse-grained categories.
export const AZURE_CONTENT_SAFETY_CATEGORIES = [
    { id: 'Hate',     label: 'Hate & Fairness',     icon: '🚷' },
    { id: 'Violence', label: 'Violence',            icon: '⚔️' },
    { id: 'Sexual',   label: 'Sexual',              icon: '🔞' },
    { id: 'SelfHarm', label: 'Self-Harm',           icon: '💔' },
];

/**
 * Return the human-friendly label for a category id. Falls back to the raw
 * id if unknown so nothing ever renders as `undefined`.
 *
 * @param {string} id             e.g. 'S5', 'Hate', 'Email', 'CustomTerm'
 * @param {object} [opts]
 * @param {boolean} [opts.withIcon]  Prepend the icon (e.g. '🗣️ Defamation')
 * @returns {string}
 */
export function labelForCategory(id, { withIcon = false } = {}) {
    if (id == null) return '';
    const key = String(id);
    const match = _allCategories.find(c => c.id === key);
    if (!match) return key;
    return withIcon && match.icon ? `${match.icon} ${match.label}` : match.label;
}

/**
 * Look up full metadata for a category id.
 */
export function findCategory(id) {
    if (id == null) return null;
    const key = String(id);
    return _allCategories.find(c => c.id === key) || null;
}

/**
 * Convert a list of raw category ids into a display-friendly comma-separated
 * string, e.g. ['S5', 'S10'] → 'Defamation, Hate'.
 */
export function formatCategoryList(ids, { withIcon = false } = {}) {
    if (!Array.isArray(ids) || ids.length === 0) return '';
    return ids.map(id => labelForCategory(id, { withIcon })).join(', ');
}

/**
 * Return the appropriate category list for a given moderation provider.
 * Admins pick exactly one provider per org; the UI should display the
 * matching taxonomy.
 */
export function categoriesForProvider(provider) {
    return provider === 'azure' ? AZURE_CONTENT_SAFETY_CATEGORIES : LLAMA_GUARD_CATEGORIES;
}

// Private: merged list so labelForCategory() doesn't care which taxonomy owns an id.
const _allCategories = [...LLAMA_GUARD_CATEGORIES, ...AZURE_CONTENT_SAFETY_CATEGORIES];

/**
 * Map a guardrail category id (S1-S14 or an Azure key) to its emoji catalog id
 * so the active icon pack can override every site that renders this category.
 * Llama and Azure categories that share a meaning collapse onto the same id
 * (e.g. S10 'Hate' and Azure 'Hate' both -> guardrail.hate).
 */
const _CATALOG_ID_BY_CATEGORY = {
    S1: 'guardrail.violence',  S2: 'guardrail.crimes',  S3: 'guardrail.sex_crimes',
    S4: 'guardrail.csae',      S5: 'guardrail.defamation', S6: 'guardrail.specialized_advice',
    S7: 'guardrail.privacy',   S8: 'guardrail.ip',       S9: 'guardrail.weapons',
    S10: 'guardrail.hate',     S11: 'guardrail.self_harm', S12: 'guardrail.sexual',
    S13: 'guardrail.elections', S14: 'guardrail.code_abuse',
    Hate: 'guardrail.hate',    Violence: 'guardrail.violence',
    Sexual: 'guardrail.sexual', SelfHarm: 'guardrail.self_harm',
};

export function guardrailCatalogIdFor(id) {
    return _CATALOG_ID_BY_CATEGORY[String(id)] || null;
}
