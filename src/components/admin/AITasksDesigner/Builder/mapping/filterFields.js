/**
 * Variable-tree filtering, shared by the {} VariablePicker popover and the
 * NDV's INPUT panel so "search" means exactly the same thing in both.
 *
 * A node survives when its own key/path matches OR any descendant matches — a
 * parent is kept as a PATH to its matching children, never as a false hit, and
 * the surviving subtree is a copy so the caller's data is untouched.
 */

/** Filter a `[{key, path, sample, children?}]` tree against a lowercase query. */
export function filterFields(fields, q) {
    const needle = String(q || '').toLowerCase();
    if (!needle) return fields || [];
    const out = [];
    for (const f of fields || []) {
        const matchesSelf = f.key?.toLowerCase().includes(needle) || f.path?.toLowerCase().includes(needle);
        let subs = [];
        if (Array.isArray(f.children)) subs = filterFields(f.children, needle);
        if (matchesSelf) {
            out.push(subs.length > 0 ? { ...f, children: subs } : f);
        } else if (subs.length > 0) {
            out.push({ ...f, children: subs });
        }
    }
    return out;
}

/**
 * Filter whole groups. A group whose own LABEL matches is kept in full (that is
 * how you ask for "everything from the Gmail step"); otherwise it is kept only
 * for the fields that matched.
 */
export function filterGroups(groups, q) {
    const needle = String(q || '').trim().toLowerCase();
    if (!needle) return groups || [];
    const out = [];
    for (const g of groups || []) {
        if (g?.label?.toLowerCase().includes(needle)) { out.push(g); continue; }
        const fields = filterFields(g?.fields || [], needle);
        if (fields.length > 0) out.push({ ...g, fields });
    }
    return out;
}
