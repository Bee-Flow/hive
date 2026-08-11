// Shared field specs for reusable HTTP credentials (integration_connections
// rows with provider 'http'). Used by both the builder's http_request
// Authentication picker and Settings → Connections so the two create forms
// stay identical and POST the same payload shape.
//
// `target` decides where a field's value is sent: 'secret' goes into the
// encrypted vault blob (write-only — the API never returns it), 'meta' goes
// into the plaintext display metadata (never put secret values there).
// `nameKey` / `labelKey` are i18n keys; `name` / `label` stay as the English
// fallback so a missing translation still renders something sensible.
export const HTTP_AUTH_TYPES = [
    {
        id: 'bearer', kind: 'bearer', name: 'Bearer token', nameKey: 'connections.http_bearer',
        fields: [
            { key: 'token', label: 'Token', labelKey: 'connections.field_token', type: 'password', target: 'secret' },
        ],
    },
    {
        id: 'header', kind: 'api_key', name: 'API key (custom header)', nameKey: 'connections.http_api_key',
        fields: [
            { key: 'headerName', label: 'Header name (e.g. X-API-Key)', labelKey: 'connections.field_header_name', type: 'text', target: 'meta' },
            { key: 'token', label: 'Key value', labelKey: 'connections.field_key_value', type: 'password', target: 'secret' },
        ],
    },
    {
        id: 'basic', kind: 'basic', name: 'Basic auth', nameKey: 'connections.http_basic',
        fields: [
            { key: 'username', label: 'Username', labelKey: 'connections.field_username', type: 'text', target: 'secret' },
            { key: 'password', label: 'Password', labelKey: 'connections.field_password', type: 'password', target: 'secret' },
        ],
    },
    {
        id: 'oauth2_cc', kind: 'oauth2_cc', name: 'OAuth2 (client credentials)', nameKey: 'connections.http_oauth2_cc',
        fields: [
            { key: 'tokenUrl', label: 'Token URL', labelKey: 'connections.field_token_url', type: 'text', target: 'meta' },
            { key: 'client_id', label: 'Client ID', labelKey: 'connections.field_client_id', type: 'password', target: 'secret' },
            { key: 'client_secret', label: 'Client secret', labelKey: 'connections.field_client_secret', type: 'password', target: 'secret' },
            { key: 'scope', label: 'Scopes (space-separated, optional)', labelKey: 'connections.field_scopes', type: 'text', target: 'meta', optional: true },
        ],
    },
];

export const HTTP_AUTH_TYPE_BY_ID = Object.fromEntries(HTTP_AUTH_TYPES.map(t => [t.id, t]));
export const HTTP_AUTH_TYPE_BY_KIND = Object.fromEntries(HTTP_AUTH_TYPES.map(t => [t.kind, t]));

/** Short human label for a connection's kind ("Bearer token", …). */
export function httpKindName(kind) {
    return HTTP_AUTH_TYPE_BY_KIND[kind]?.name || kind;
}

/**
 * Split the filled-in form values into the { secret, secretMeta } halves the
 * connections API expects. Text fields are trimmed; password fields are sent
 * as typed (a legit password may contain edge whitespace).
 */
export function splitHttpAuthValues(authType, values = {}) {
    const secret = {};
    const secretMeta = {};
    for (const f of authType.fields) {
        const raw = values[f.key];
        if (typeof raw !== 'string') continue;
        const v = f.type === 'password' ? raw : raw.trim();
        if (!v.trim()) continue;
        if (f.target === 'meta') secretMeta[f.key] = v;
        else secret[f.key] = v;
    }
    return { secret, secretMeta };
}

/** Required fields the user has not filled in yet (for submit gating). */
export function missingHttpAuthFields(authType, values = {}) {
    return authType.fields.filter(f => !f.optional && !String(values[f.key] || '').trim());
}
