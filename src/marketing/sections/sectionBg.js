// Shared background-variant resolver for section renderers.
//
// Compat rule: a block whose content has NO backgroundVariant key keeps its
// legacy hardcoded class (e.g. Steps/Integrations/TechStats/Pricing always
// rendered `alt-bg`), so stored pages are pixel-identical. Any EXPLICIT
// value — including 'default' — switches to the shared cms-bg--* utilities,
// which is what makes the editor's Background control actually work on
// every block (it was a dead control on 7 of 15 types).
export function sectionBgClass(data, legacyClass = '') {
    const v = data?.backgroundVariant;
    if (v === undefined || v === null || v === '') return legacyClass;
    if (v === 'default') return '';
    return ['surface', 'primary', 'dark'].includes(v) ? `cms-bg--${v}` : legacyClass;
}
