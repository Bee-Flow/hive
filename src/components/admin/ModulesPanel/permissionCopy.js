// Canonical operator-facing copy for module permission ids (mv2 manifests).
// Pure helpers shared by PermissionList / PermissionConsentDialog and unit-
// tested directly. Copy lives in the i18n dict; this maps ids → keys.

// Fixed ids → dict keys (variable lookup, not literal t() calls, so the i18n
// guard's literal-call check skips the indirection; every value is in the dict).
const PERM_KEY = {
    'db': 'modules.permissions.db',
    'ai': 'modules.permissions.ai',
    'usage:write': 'modules.permissions.usage_write',
    'limits:read': 'modules.permissions.limits_read',
    'storage:read': 'modules.permissions.storage_read',
    'webpages:write': 'modules.permissions.webpages_write',
    'email:send': 'modules.permissions.email_send',
    'license:read': 'modules.permissions.license_read',
    'config': 'modules.permissions.config',
};

/**
 * Server payloads carry permissions either as bare id strings or as
 * { id, reason? } objects — normalise to the object shape.
 */
export const normalizePermissions = (list) => (Array.isArray(list) ? list : [])
    .map((p) => (typeof p === 'string' ? { id: p } : p))
    .filter((p) => p && typeof p.id === 'string' && p.id);

/** env:* ids run with server privileges and render in their own section. */
export const isEnvPermission = (id) => typeof id === 'string' && id.startsWith('env:');

export function splitEnvPermissions(perms) {
    const normal = [];
    const env = [];
    for (const p of perms) (isEnvPermission(p.id) ? env : normal).push(p);
    return { normal, env };
}

/** Human copy for one permission id (t = useTranslation().t). */
export function permissionCopy(t, id) {
    const key = PERM_KEY[id];
    if (key) return t(key);
    if (typeof id === 'string' && id.startsWith('http:')) {
        const pattern = id.slice('http:'.length) || '*';
        return t('modules.permissions.http', {
            pattern: pattern === '*' ? t('modules.permissions.http_any') : pattern,
        });
    }
    if (isEnvPermission(id)) return t('modules.permissions.env_item', { id });
    return t('modules.permissions.unknown', { id });
}
