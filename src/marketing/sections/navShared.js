/**
 * Bits the desktop header and the mobile drawer both need.
 *
 * They live here rather than in Header.jsx because MobileNav imports them
 * and Header imports MobileNav — putting them in Header would make that
 * circular.
 */
// Resolve the dropdown shape regardless of which mode the user picked.
// Returns:
//   { kind: 'columns', columns: [{ heading, items: [...] }] }  — mega menu
//   { kind: 'list',    items:   [{ label, href, ... }]      }  — flat
//   null if the link has no dropdown content at all
export function readDropdown(link) {
    if (link?.dropdown?.layout === 'columns'
        && Array.isArray(link.dropdown.columns)
        && link.dropdown.columns.length > 0) {
        return { kind: 'columns', columns: link.dropdown.columns };
    }
    if (Array.isArray(link?.children) && link.children.length > 0) {
        return { kind: 'list', items: link.children };
    }
    return null;
}

export const isPreview = () =>
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).has('preview');

// In preview mode, anchor clicks should not jump-scroll inside the iframe;
// they'd take the admin's focus away from what they were editing.
export const navHandler = (e) => {
    if (isPreview()) e.preventDefault();
};

// True on a device with no hover — a phone, or an iPad in landscape wide
// enough to still get the desktop nav. There, the first tap on a dropdown
// parent must OPEN the panel rather than navigate away from it.
export const isTouchLike = () =>
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(hover: none)').matches;
