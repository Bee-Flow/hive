/**
 * Conversion between the builder's params-list editor rows and the JSON
 * Schema persisted on an agent-callable trigger (trigger.parametersSchema).
 *
 * The runtime side (server/automation/agentCallableTools.js) expects a
 * standard `{ type:'object', properties, required }` schema; the builder UI
 * edits a flat list of { name, type, required, description } rows. These two
 * functions are inverses so the inspector round-trips cleanly.
 */

/** params-list rows → JSON Schema. */
export function paramsToSchema(params) {
    const properties = {};
    const required = [];
    for (const p of (Array.isArray(params) ? params : [])) {
        if (!p || !p.name) continue;
        properties[p.name] = { type: p.type || 'string', ...(p.description ? { description: p.description } : {}) };
        if (p.required) required.push(p.name);
    }
    return { type: 'object', properties, ...(required.length ? { required } : {}), additionalProperties: false };
}

/** JSON Schema → params-list rows (inverse of paramsToSchema). */
export function schemaToParams(schema) {
    const props = schema && typeof schema === 'object' ? (schema.properties || {}) : {};
    const required = Array.isArray(schema?.required) ? schema.required : [];
    return Object.entries(props).map(([name, p]) => ({
        name,
        type: (p && p.type) || 'string',
        required: required.includes(name),
        description: (p && p.description) || '',
    }));
}
