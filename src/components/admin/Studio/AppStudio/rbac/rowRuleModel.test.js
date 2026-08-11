import { createRequire } from 'module';
import { describe, it, expect } from 'vitest';
import {
    BASE_SCOPES,
    blankCondition,
    buildRowRule,
    conditionProblem,
    describeAccessOutcome,
    describeRowRule,
    matchBaseScope,
    operatorsForField,
    ownRowsCondition,
    parseRowRule,
    resolveAccessEntry,
    retypeCondition,
    ruleFields,
    scopeToEntry,
    serializeCondition,
} from './rowRuleModel';

// The gateway the expression actually has to survive. Required through Node so
// the picker output is checked against the SAME translator the server runs.
const require = createRequire(import.meta.url);
const gateway = require('../../../../../../../server/appStudio/rlsGateway.js');

const table = {
    id: 't1',
    key: 'salaries',
    name: 'Salaries',
    fields: [
        { key: 'owner_id', name: 'Owner', type: 'text' },
        { key: 'status', name: 'Status', type: 'select', options: ['open', 'closed'] },
        { key: 'amount', name: 'Amount', type: 'number' },
        { key: 'approved', name: 'Approved', type: 'bool' },
        { key: 'starts_on', name: 'Starts on', type: 'date' },
        { key: 'live_total', name: 'Live total', type: 'computed', computed: { stored: false } },
    ],
};

function cond(patch) {
    return { id: 'c', field: 'owner_id', op: '==', source: 'value', value: '', valueType: 'string', ...patch };
}

describe('base access presets say what they actually grant', () => {
    it('never presents a preset as narrower than the permissions it writes', () => {
        // "All rows" used to hide create/update/delete behind a read-only sounding label.
        for (const scope of BASE_SCOPES) {
            const entry = scopeToEntry(scope.value);
            const out = describeAccessOutcome({ entry, roleLabel: 'Member', tableName: 'Salaries' });
            const text = `${scope.label} ${out.sees} ${out.writes || ''}`.toLowerCase();
            if (entry.update !== 'none') expect(text).toMatch(/change/);
            if (entry.delete !== 'none') expect(text).toMatch(/delete/);
            expect(text).toMatch(entry.create ? /can add new rows|add new rows,/ : /cannot add/);
        }
    });

    it('recognises its own presets and calls anything else a mix of its own', () => {
        expect(matchBaseScope(scopeToEntry('own'))).toBe('own');
        expect(matchBaseScope(scopeToEntry('none'))).toBe('none');
        expect(matchBaseScope({ read: 'all', create: false, update: 'none', delete: 'none' })).toBeNull();
    });
});

describe('the access a role already has', () => {
    const withAccess = (access) => ({ ...table, access });
    const gatewayEntry = (t, role) => ({
        read: gateway.resolveScope(t, role, 'read'),
        create: gateway.resolveScope(t, role, 'create'),
        update: gateway.resolveScope(t, role, 'update'),
        delete: gateway.resolveScope(t, role, 'delete'),
    });

    it('reads the same permissions the server gateway resolves', () => {
        const cases = [
            { default: 'app', roles: {}, rowFilters: {} },
            { default: 'owner', roles: {} },
            { default: 'none', roles: {} },
            { default: 'role', roles: { member: { read: 'all', create: false, update: 'none', delete: 'none' } } },
            { default: 'app', roles: { member: { read: 'own', create: true, update: 'own', delete: 'none' } } },
            { default: 'app', roles: { member: { read: true, create: 'own', update: false } } },
        ];
        for (const access of cases) {
            const t = withAccess(access);
            expect(resolveAccessEntry(t, 'member')).toEqual(gatewayEntry(t, 'member'));
        }
    });

    it('reads a model with no access block at all as the "app" default the server stores', () => {
        expect(resolveAccessEntry({ ...table, access: undefined }, 'member')).toEqual(scopeToEntry('all'));
    });

    it('keeps the four actions apart instead of guessing them from reading', () => {
        const t = withAccess({ default: 'app', roles: { member: { read: 'all', create: false, update: 'none', delete: 'none' } } });
        expect(resolveAccessEntry(t, 'member')).toEqual({ read: 'all', create: false, update: 'none', delete: 'none' });
        expect(matchBaseScope(resolveAccessEntry(t, 'member'))).toBeNull();
    });
});

describe('field and operator choices come from the table', () => {
    it('lists the table fields plus the built-in columns, minus read-time computed', () => {
        const keys = ruleFields(table).map((f) => f.key);
        expect(keys).toContain('owner_id');
        expect(keys).toContain('created_by');
        expect(keys).not.toContain('live_total');
    });

    it('names the built-in columns after what they hold', () => {
        const byKey = Object.fromEntries(ruleFields(table).map((f) => [f.key, f.name]));
        expect(byKey.created_by).toBe('Who added the row');
        // org_id is the app's organisation on every row, not the row author's.
        expect(byKey.org_id).toBe('Organisation the app belongs to');
    });

    it('offers date wording for dates and only is/is not for yes-no', () => {
        const dateOps = operatorsForField({ type: 'date' }).map((o) => o.label);
        expect(dateOps).toContain('is after');
        expect(operatorsForField({ type: 'bool' }).map((o) => o.op)).toEqual(['==', '!=']);
        // NULL cannot be compared in the subset, so the label promises "blank", not "empty".
        expect(operatorsForField({ type: 'text' }).map((o) => o.label)).toContain('is blank');
    });

    it('keeps an operator a hand-typed rule already uses', () => {
        expect(operatorsForField({ type: 'text' }, '>').map((o) => o.op)).toContain('>');
        // `date == ""` is not offered, but a stored rule that uses it keeps its own choice.
        expect(operatorsForField({ type: 'date' }).map((o) => o.op)).not.toContain('empty');
        expect(operatorsForField({ type: 'date' }, 'empty').map((o) => o.op)).toContain('empty');
    });
});

describe('building the expression', () => {
    it('writes a runtime value as the viewer path', () => {
        expect(serializeCondition(cond({ source: 'viewer.id' }))).toBe('record.owner_id == viewer.id');
        expect(serializeCondition(cond({ field: 'org_id', source: 'viewer.organizationId' })))
            .toBe('record.org_id == viewer.organizationId');
    });

    it('types the value off the field', () => {
        expect(serializeCondition(cond({ field: 'status', value: 'open' }))).toBe('record.status == "open"');
        expect(serializeCondition(cond({ field: 'amount', op: '>', value: '100', valueType: 'number' }))).toBe('record.amount > 100');
        expect(serializeCondition(cond({ field: 'approved', value: 'true', valueType: 'bool' }))).toBe('record.approved == true');
    });

    it('escapes quotes and backslashes in a typed value', () => {
        expect(serializeCondition(cond({ value: 'a"b\\c' }))).toBe('record.owner_id == "a\\"b\\\\c"');
    });

    it('spells is empty / is not empty with the empty string the subset allows', () => {
        expect(serializeCondition(cond({ op: 'empty' }))).toBe('record.owner_id == ""');
        expect(serializeCondition(cond({ op: 'notEmpty' }))).toBe('record.owner_id != ""');
    });

    it('joins conditions with and / or', () => {
        const conditions = [cond({ source: 'viewer.id' }), cond({ field: 'status', value: 'open' })];
        expect(buildRowRule({ join: 'and', conditions })).toBe('record.owner_id == viewer.id && record.status == "open"');
        expect(buildRowRule({ join: 'or', conditions })).toBe('record.owner_id == viewer.id || record.status == "open"');
    });

    it('leaves out a condition that is not filled in yet', () => {
        expect(buildRowRule({ conditions: [cond({ source: 'viewer.id' }), cond({ field: 'status', value: '' })] }))
            .toBe('record.owner_id == viewer.id');
    });
});

describe('unfinished conditions are named in words', () => {
    it('asks for the missing piece', () => {
        expect(conditionProblem(cond({ value: '' }), table)).toBe('Fill in the value.');
        expect(conditionProblem(cond({ field: 'amount', valueType: 'number', value: '' }), table)).toBe('Type a number.');
        expect(conditionProblem(cond({ field: 'amount', valueType: 'number', value: '-3' }), table))
            .toBe('A row rule cannot use a negative number.');
        expect(conditionProblem(cond({ field: 'gone' }), table)).toMatch(/no longer in the table/);
    });

    it('is happy with a runtime value, a yes-no and an emptiness check', () => {
        expect(conditionProblem(cond({ source: 'viewer.id' }), table)).toBeNull();
        expect(conditionProblem(cond({ field: 'approved', valueType: 'bool', value: 'false' }), table)).toBeNull();
        expect(conditionProblem(cond({ op: 'empty' }), table)).toBeNull();
    });
});

describe('reading an existing rule back into pickers', () => {
    it('reads the common owner rule', () => {
        const parsed = parseRowRule('record.owner_id == viewer.id', table);
        expect(parsed.ok).toBe(true);
        expect(parsed.conditions).toHaveLength(1);
        expect(parsed.conditions[0]).toMatchObject({ field: 'owner_id', op: '==', source: 'viewer.id' });
    });

    it('flattens a chain and keeps the join', () => {
        const parsed = parseRowRule('record.owner_id == viewer.id || record.status == "open" || record.amount > 5', table);
        expect(parsed.ok).toBe(true);
        expect(parsed.join).toBe('or');
        expect(parsed.conditions.map((c) => c.field)).toEqual(['owner_id', 'status', 'amount']);
        expect(parsed.conditions[2]).toMatchObject({ value: '5', valueType: 'number' });
    });

    it('recognises the empty-string comparisons as is empty / is not empty', () => {
        expect(parseRowRule('record.status == ""', table).conditions[0].op).toBe('empty');
        expect(parseRowRule('record.status != ""', table).conditions[0].op).toBe('notEmpty');
    });

    it('puts the column first when the rule was typed the other way round', () => {
        const parsed = parseRowRule('viewer.id == record.owner_id && 5 < record.amount', table);
        expect(parsed.ok).toBe(true);
        expect(parsed.conditions[0]).toMatchObject({ field: 'owner_id', op: '==', source: 'viewer.id' });
        expect(parsed.conditions[1]).toMatchObject({ field: 'amount', op: '>', value: '5' });
    });

    it('keeps a rule the pickers cannot show as text instead of rewriting it', () => {
        const unpickable = [
            'record.owner_id == viewer.id && (record.status == "open" || record.amount > 5)',
            '!(record.status == "closed")',
            'record.owner_id == record.org_id',
            'record.status',
            'record.nope == viewer.id',
            'lower(record.status) == "x"',
            'record.amount + 1 > 2',
            'record.owner_id == viewer.department',
        ];
        for (const expr of unpickable) expect(parseRowRule(expr, table).ok).toBe(false);
    });

    it('treats no rule as an empty picker list, not as unreadable', () => {
        expect(parseRowRule('', table)).toEqual({ ok: true, join: 'and', conditions: [] });
    });
});

describe('round trip', () => {
    const cases = [
        'record.owner_id == viewer.id',
        'record.org_id == viewer.organizationId && record.status == "open"',
        'record.amount >= 100 || record.approved == true',
        'record.status != "" && record.starts_on > "2026-01-01"',
        'record.created_by == viewer.id',
    ];

    it('rebuilds each rule byte-identically', () => {
        for (const expr of cases) {
            const parsed = parseRowRule(expr, table);
            expect(parsed.ok).toBe(true);
            expect(buildRowRule(parsed)).toBe(expr);
        }
    });

    it('produces expressions the server gateway accepts and parameterises', () => {
        for (const expr of cases) {
            const built = buildRowRule(parseRowRule(expr, table));
            expect(gateway.validateRowFilter(built, table)).toEqual({ ok: true, errors: [] });
            const sql = gateway.rowFilterToSql(built, { id: 'u1', role: 'member', organizationId: 'org1' }, table);
            // Every value is bound — no literal ever reaches the SQL text.
            expect(sql.sql).not.toMatch(/viewer|'/);
        }
    });

    it('sends the viewer id through as a bound parameter, not as text', () => {
        const built = buildRowRule({ conditions: [cond({ source: 'viewer.id' })] });
        const sql = gateway.rowFilterToSql(built, { id: 'alice', role: 'member', organizationId: 'org1' }, table);
        expect(sql).toEqual({ sql: '("owner_id" = ?)', params: ['alice'] });
    });

    it('normalises === and !== to the same comparison the server compiles anyway', () => {
        const parsed = parseRowRule('record.owner_id === viewer.id', table);
        expect(buildRowRule(parsed)).toBe('record.owner_id == viewer.id');
        const before = gateway.rowFilterToSql('record.owner_id === viewer.id', { id: 'alice' }, table);
        const after = gateway.rowFilterToSql(buildRowRule(parsed), { id: 'alice' }, table);
        expect(after).toEqual(before);
    });
});

describe('plain-language summary', () => {
    it('reads back as a sentence a non-technical owner can check', () => {
        const parsed = parseRowRule('record.owner_id == viewer.id && record.status == "open"', table);
        expect(describeRowRule(parsed, table)).toBe('Owner is the person opening the app and Status is “open”');
    });

    it('uses the field name, the date wording and yes/no', () => {
        const parsed = parseRowRule('record.starts_on > "2026-01-01" || record.approved == false', table);
        expect(describeRowRule(parsed, table)).toBe('Starts on is after “2026-01-01” or Approved is no');
    });
});

describe('who ends up seeing what', () => {
    const parsed = parseRowRule('record.owner_id == viewer.id', table);
    const summary = describeRowRule(parsed, table);

    const outcome = (scope, rest = {}) => describeAccessOutcome({
        entry: scopeToEntry(scope), roleLabel: 'Member', tableName: 'Salaries', ...rest,
    });

    it('names the rows AND the writes the preset hands out', () => {
        const all = outcome('all');
        expect(all.sees).toBe('Member sees every row in Salaries.');
        expect(all.writes).toBe('They can add new rows, and change or delete every row they can see.');

        const own = outcome('own');
        expect(own.sees).toBe('Member sees only the rows in Salaries they added themselves.');
        expect(own.writes).toMatch(/change or delete the rows they added/);
    });

    it('folds the rule into the sentence, in words', () => {
        const out = outcome('all', { hasRule: true, ruleSummary: summary });
        expect(out.sees).toBe('Member sees only the rows in Salaries where Owner is the person opening the app.');
        expect(outcome('own', { hasRule: true, ruleSummary: summary }).sees)
            .toMatch(/they added themselves, and only where Owner is/);
    });

    it('still says a rule is in force when it cannot put it in words', () => {
        expect(outcome('all', { hasRule: true }).sees).toMatch(/matching the rule written below/);
    });

    it('says no access means no writing either, and that the owner is never filtered', () => {
        const none = outcome('none', { hasRule: true });
        expect(none.sees).toMatch(/no rows in Salaries at all, and cannot add any/);
        expect(none.writes).toBeNull();
        expect(none.owner).toMatch(/never applies to you/);
    });

    it('describes a role that may look but not touch, instead of the preset it resembles', () => {
        const look = describeAccessOutcome({
            entry: { read: 'all', create: false, update: 'none', delete: 'none' },
            roleLabel: 'Member',
            tableName: 'Salaries',
        });
        expect(look.sees).toBe('Member sees every row in Salaries.');
        expect(look.writes).toBe('They cannot add, change or delete anything — they can only look.');
    });

    it('names each half of a lopsided mix', () => {
        expect(describeAccessOutcome({
            entry: { read: 'all', create: true, update: 'none', delete: 'none' }, roleLabel: 'Member', tableName: 'Salaries',
        }).writes).toBe('They can add new rows, but cannot change or delete anything.');
        expect(describeAccessOutcome({
            entry: { read: 'all', create: false, update: 'all', delete: 'none' }, roleLabel: 'Member', tableName: 'Salaries',
        }).writes).toBe('They can change every row they can see, but cannot add or delete anything.');
    });

    it('warns when a role may add rows it will never be able to open', () => {
        const out = describeAccessOutcome({
            entry: { read: 'none', create: true, update: 'none', delete: 'none' },
            roleLabel: 'Member',
            tableName: 'Salaries',
        });
        expect(out.sees).not.toMatch(/cannot add any/);
        expect(out.writes).toMatch(/never see them afterwards/);
    });
});

describe('starting points', () => {
    it('offers a blank condition on the first field of the table', () => {
        expect(blankCondition(table)).toMatchObject({ field: 'owner_id', op: '==', source: 'value' });
    });

    it('offers the "rows they added themselves" shortcut', () => {
        expect(serializeCondition(ownRowsCondition())).toBe('record.created_by == viewer.id');
    });

    it('re-types the value when the field changes underneath it', () => {
        const next = retypeCondition(cond({ op: 'empty', value: 'abc' }), { key: 'amount', type: 'number' });
        expect(next).toMatchObject({ field: 'amount', op: '==', valueType: 'number', value: '' });
        const back = retypeCondition(next, { key: 'approved', type: 'bool' });
        expect(back).toMatchObject({ field: 'approved', valueType: 'bool', value: 'true' });
    });
});
