/**
 * What an audience choice actually GRANTS in the app's own tables.
 *
 * Publishing is described as a page-access decision, but it is a data decision:
 * whoever can open the app is handed a role, and that role's table access is
 * what they may do to the rows. This module mirrors the two server decisions
 * (appStudio/rlsGateway.js) so the publish modal can name the consequence
 * instead of guessing at it:
 *
 *   who someone is  → resolveViewerRole: a role of their own first, then a
 *                     group listed in roleMapping.byGroup, then
 *                     roleMapping.default, then nobody (no data at all)
 *   what they may do → resolveScope: an explicit access.roles[role][action]
 *                     wins per action, otherwise the table's access.default
 *
 * A row rule (access.rowFilters[role]) narrows SEEING, EDITING and DELETING —
 * never ADDING, which the server gates with assertCanWrite alone.
 *
 * A table saved without an access block keeps that shape (PUT /:id/schema
 * stores the model as given), and the gateway denies every action it has no
 * rule for — so a missing or unknown access.default reads as "nobody but the
 * owner" here too. Reading it as full access would raise an alarm the runtime
 * never honours.
 *
 * The tables are not the whole story: model.connectors[] runs on
 * routes/studioAppConnectors.js, which gates on canReadStudioApp ALONE — no
 * role, no row rule. Unless a connector is marked runAs 'viewer', whoever can
 * open the app fetches through the owner's own credentials, so any sentence
 * about the tables that stayed silent about those would be a false comfort.
 */

/** The three audiences, shared with the picker so the two can never drift. */
export const PRIVATE = 'private';
export const ORG = 'org';
export const GROUPS = 'groups';

const ROW_SCOPES = ['none', 'own', 'all'];
const CONNECTOR_KINDS = ['integration_tool', 'automation', 'rest'];

/** ["a","b","c"] → "a, b and c" */
export function joinNames(names) {
    const list = names.filter(Boolean);
    if (list.length <= 1) return list[0] || '';
    return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
}

export function tableName(table) {
    return table?.name || table?.key || table?.id || 'a table';
}

/**
 * The outside sources every viewer reaches as the owner — the connector runtime
 * accepts the same shapes it can run (id + a kind it knows) and only a
 * runAs 'viewer' connector uses the viewer's own credentials instead.
 */
export function ownerRunFeeds(model) {
    const list = Array.isArray(model?.connectors) ? model.connectors : [];
    return list
        .filter((c) => c && typeof c === 'object' && typeof c.id === 'string' && c.id
            && CONNECTOR_KINDS.includes(c.kind) && c.runAs !== 'viewer')
        .map((c) => ((typeof c.name === 'string' && c.name) ? c.name : c.id));
}

function accessOf(table) {
    return (table && typeof table.access === 'object' && table.access) ? table.access : {};
}

function normalizePerm(value, action) {
    if (action === 'create') return value === true || value === 'all' || value === 'own';
    if (ROW_SCOPES.includes(value)) return value;
    if (value === true) return 'all';
    if (value === false) return 'none';
    return 'none';
}

function modeScope(mode, action) {
    switch (mode) {
        case 'app': return action === 'create' ? true : 'all';
        case 'owner': return action === 'create' ? true : 'own';
        // 'role', 'none', and a table with no access block at all.
        default: return action === 'create' ? false : 'none';
    }
}

/** The scope (none/own/all, or a boolean for 'create') this role has on a table. */
export function resolveScope(table, role, action) {
    if (role === 'owner') return action === 'create' ? true : 'all';
    if (!role) return action === 'create' ? false : 'none';
    const access = accessOf(table);
    const roles = (access.roles && typeof access.roles === 'object') ? access.roles : {};
    const entry = Object.hasOwn(roles, role) ? roles[role] : null;
    if (entry && typeof entry === 'object' && Object.hasOwn(entry, action)) {
        return normalizePerm(entry[action], action);
    }
    return modeScope(access.default, action);
}

export function tableGrant(table, role) {
    const rules = accessOf(table).rowFilters;
    return {
        read: resolveScope(table, role, 'read'),
        update: resolveScope(table, role, 'update'),
        remove: resolveScope(table, role, 'delete'),
        create: resolveScope(table, role, 'create'),
        rule: !!(role && role !== 'owner' && rules && typeof rules === 'object' && rules[role]),
    };
}

const VERB_ORDER = ['see', 'add', 'edit', 'delete'];
const EVERY_ROW = 'every row';

function rowQualifier(scope, rule) {
    if (scope === 'all') return rule ? 'only the rows your row rule allows' : EVERY_ROW;
    return rule
        ? 'only the rows they added themselves that your row rule also allows'
        : 'only the rows they added themselves';
}

/**
 * One table's grant in words — "see, add, edit and delete every row" — or null
 * when the role cannot touch the table at all. Verbs that share a qualifier are
 * listed together; adding joins them only when nothing narrows the rows.
 */
export function grantPhrase(grant) {
    const clauses = [];
    const put = (qualifier, verb) => {
        const found = clauses.find((c) => c.qualifier === qualifier);
        if (found) found.verbs.push(verb); else clauses.push({ qualifier, verbs: [verb] });
    };
    if (grant.read !== 'none') put(rowQualifier(grant.read, grant.rule), 'see');
    if (grant.update !== 'none') put(rowQualifier(grant.update, grant.rule), 'edit');
    if (grant.remove !== 'none') put(rowQualifier(grant.remove, grant.rule), 'delete');

    if (grant.create) {
        const open = clauses.find((c) => c.qualifier === EVERY_ROW);
        if (open) open.verbs.push('add');
        else if (clauses.length === 0) return 'add rows, without seeing them afterwards';
        else clauses.unshift({ qualifier: null, verbs: ['add'] });
    }
    if (clauses.length === 0) return null;
    return clauses.map((c) => {
        if (!c.qualifier) return 'add rows';
        const verbs = [...c.verbs].sort((a, b) => VERB_ORDER.indexOf(a) - VERB_ORDER.indexOf(b));
        return `${joinNames(verbs)} ${c.qualifier}`;
    }).join(', and ');
}

function roleMappingOf(model) {
    const mapping = (model && typeof model.roleMapping === 'object' && model.roleMapping) ? model.roleMapping : {};
    return {
        // A blank default is how the server spells "no role at all" → no data.
        fallback: (typeof mapping.default === 'string' && mapping.default) ? mapping.default : null,
        byGroup: (mapping.byGroup && typeof mapping.byGroup === 'object') ? mapping.byGroup : {},
    };
}

function groupNamer(groups) {
    const byId = new Map((Array.isArray(groups) ? groups : []).map((g) => [String(g?.id), g?.name]));
    return (ids) => {
        const named = ids.map((id) => byId.get(String(id))).filter(Boolean);
        // The group directory needs org-admin rights the owner may not hold.
        return named.length > 0 ? joinNames(named) : 'a group you gave a role';
    };
}

// role → the group ids mapped to it, in model order.
function groupsByRole(byGroup, ids, fallback) {
    const out = new Map();
    for (const id of ids) {
        const role = (Object.hasOwn(byGroup, id) && byGroup[id]) ? byGroup[id] : fallback;
        out.set(role, [...(out.get(role) || []), id]);
    }
    return out;
}

/**
 * Roles the group mapping hands out to people the picked groups let in: the
 * server reads the VIEWER's groups, not the picked ones, so someone in a picked
 * group who is also in a mapped group lands on the mapped group's role. `maybe`
 * marks that as a possibility rather than a promise — when their picked group
 * is mapped too, the server takes whichever it matches first.
 */
function spilloverCohorts(byGroup, pickedIds, picked, nameGroups) {
    const covered = new Set(picked.map((c) => c.role));
    const chosen = new Set(pickedIds);
    const rest = Object.keys(byGroup)
        .filter((id) => byGroup[id] && !chosen.has(String(id)) && !covered.has(byGroup[id]));
    return [...groupsByRole(byGroup, rest, null)].map(([role, ids]) => ({
        key: `x:${role}`,
        who: `Anyone you share with who is also in ${nameGroups(ids)}`,
        role,
        maybe: true,
    }));
}

/**
 * The groups of people this audience lets in, each with the role they land on.
 * `who` is the sentence subject, already exclusive: when groups override the
 * default role, the org-wide subject says "except …" so no two lines can claim
 * the same person. Someone who is in two groups mapped to DIFFERENT roles is
 * the exception — the server gives them whichever group it matches first, so
 * both lines name them.
 */
export function audienceCohorts({ audience, model, groups = [], selectedGroupIds = [] }) {
    const { fallback, byGroup } = roleMappingOf(model);
    const nameGroups = groupNamer(groups);

    if (audience === GROUPS) {
        const ids = selectedGroupIds.map(String);
        if (ids.length === 0) return [];
        const picked = [...groupsByRole(byGroup, ids, fallback)].map(([role, groupIds]) => ({
            key: `g:${role || 'none'}`,
            who: `Everyone in ${nameGroups(groupIds)}`,
            role,
        }));
        return [...picked, ...spilloverCohorts(byGroup, ids, picked, nameGroups)];
    }

    const overrides = [...groupsByRole(byGroup, Object.keys(byGroup).filter((id) => byGroup[id]), fallback)]
        .filter(([role]) => role !== fallback);
    const overridden = overrides.flatMap(([, ids]) => ids);
    return [
        {
            key: 'org',
            who: overridden.length > 0
                ? `Everyone in your organisation except ${nameGroups(overridden)}`
                : 'Everyone in your organisation',
            role: fallback,
        },
        ...overrides.map(([role, ids]) => ({ key: `g:${role}`, who: `People in ${nameGroups(ids)}`, role })),
    ];
}

/**
 * Every cohort with the tables it can reach, grouped by identical wording, plus
 * the tables it cannot open at all. `broad` marks a cohort that can change or
 * remove every row of some table — the case worth warning about.
 *
 * A `maybe` cohort only ever ADDS to what the lines above it already said: what
 * it cannot open is left out (another line covers that), and one that reaches
 * nothing is dropped rather than contradicting them.
 */
export function summarizeAudience({ audience, model, tables = [], groups = [], selectedGroupIds = [] }) {
    const cohorts = audienceCohorts({ audience, model, groups, selectedGroupIds }).map((cohort) => {
        const buckets = new Map();
        const denied = [];
        let broad = false;
        for (const table of tables) {
            const grant = tableGrant(table, cohort.role);
            const phrase = cohort.role ? grantPhrase(grant) : null;
            if (!phrase) { denied.push(tableName(table)); continue; }
            if (!grant.rule && (grant.update === 'all' || grant.remove === 'all')) broad = true;
            buckets.set(phrase, [...(buckets.get(phrase) || []), tableName(table)]);
        }
        const grants = [...buckets].map(([phrase, names]) => ({ phrase, names }));
        return { ...cohort, grants, denied: cohort.maybe ? [] : denied, broad };
    }).filter((c) => !c.maybe || c.grants.length > 0);
    return { cohorts, broad: cohorts.some((c) => c.broad) };
}
