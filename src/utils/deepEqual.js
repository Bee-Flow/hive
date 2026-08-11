/**
 * Structural equality for plain JSON values.
 *
 * Exists for dirty-tracking: a settings form snapshots the payload it would
 * send, and compares the current payload against it on every render. Reference
 * equality is useless there (every edit rebuilds the object) and
 * `JSON.stringify` comparison is worse than it looks — it is key-order
 * sensitive, so two payloads that differ only in the order React happened to
 * assemble them read as "changed" and the Save button never goes quiet.
 *
 * Scope is deliberately narrow: JSON-shaped data only. No Map/Set/Date/RegExp
 * handling, no cycle detection. Everything this compares came from, or is on
 * its way to, an API body.
 *
 * Extracted from hooks/useGuardrailsForm.js, which had the only copy while two
 * other call sites wanted one.
 */
export function deepEqual(a, b) {
    if (a === b) return true;
    if (a == null || b == null) return a === b;
    if (typeof a !== typeof b) return false;
    if (typeof a !== 'object') return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    const ka = Object.keys(a), kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    for (const k of ka) if (!deepEqual(a[k], b[k])) return false;
    return true;
}

export default deepEqual;
