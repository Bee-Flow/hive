import { describe, expect, it } from 'vitest';
import {
    audienceCohorts,
    grantPhrase,
    ownerRunFeeds,
    resolveScope,
    summarizeAudience,
    tableGrant,
} from './publishAccessSummary';

// The shipped defaults: no explicit access block anywhere, roleMapping.default
// 'app'. Whatever this file says about THIS model is what the publish modal
// promises an owner, so every expectation below is checked against the server's
// rlsGateway resolveScope / resolveViewerRole.
const table = (name, access) => ({ id: `tbl_${name}`, key: name.toLowerCase(), name, fields: [], access });

const ABSENCES = table('Absences', { default: 'app', roles: {}, rowFilters: {} });
const EMPLOYEES = table('Employees', { default: 'app', roles: {}, rowFilters: {} });

const model = (over = {}) => ({
    modelVersion: 1,
    roles: [{ key: 'manager', label: 'Manager' }],
    roleMapping: { default: 'app', byGroup: {} },
    tables: [ABSENCES, EMPLOYEES],
    ...over,
});

describe('resolveScope — mirrors the server gateway', () => {
    it('denies a table saved with no access block, the way the gateway reads it', () => {
        const bare = { id: 'tbl_x', key: 'x', name: 'X' };
        expect(resolveScope(bare, 'app', 'read')).toBe('none');
        expect(resolveScope(bare, 'app', 'update')).toBe('none');
        expect(resolveScope(bare, 'app', 'delete')).toBe('none');
        expect(resolveScope(bare, 'app', 'create')).toBe(false);
        // …and an access block whose default is a mode the gateway doesn't know.
        const odd = table('T', { default: 'everyone', roles: {}, rowFilters: {} });
        expect(resolveScope(odd, 'app', 'read')).toBe('none');
    });

    it('maps every access.default mode the way defaultScope does', () => {
        const modes = {
            app: ['all', true],
            owner: ['own', true],
            role: ['none', false],
            none: ['none', false],
        };
        for (const [mode, [read, create]] of Object.entries(modes)) {
            const t = table('T', { default: mode, roles: {}, rowFilters: {} });
            expect(resolveScope(t, 'staff', 'read')).toBe(read);
            expect(resolveScope(t, 'staff', 'create')).toBe(create);
        }
    });

    it('lets an explicit role entry win per action, and falls back per action', () => {
        const t = table('T', { default: 'app', roles: { staff: { read: 'own', delete: false } }, rowFilters: {} });
        expect(resolveScope(t, 'staff', 'read')).toBe('own');
        expect(resolveScope(t, 'staff', 'delete')).toBe('none');
        // No entry for update → the table default still applies.
        expect(resolveScope(t, 'staff', 'update')).toBe('all');
        // Another role is untouched by staff's entry.
        expect(resolveScope(t, 'manager', 'read')).toBe('all');
    });

    it('gives nobody anything without a role, and the owner everything', () => {
        expect(resolveScope(ABSENCES, null, 'read')).toBe('none');
        expect(resolveScope(ABSENCES, null, 'create')).toBe(false);
        expect(resolveScope(table('T', { default: 'none', roles: {}, rowFilters: {} }), 'owner', 'read')).toBe('all');
    });
});

describe('grantPhrase', () => {
    it('names all four verbs for the shipped default', () => {
        expect(grantPhrase(tableGrant(ABSENCES, 'app'))).toBe('see, add, edit and delete every row');
    });

    it('separates adding from the rows they may look at', () => {
        const own = table('T', { default: 'owner', roles: {}, rowFilters: {} });
        expect(grantPhrase(tableGrant(own, 'staff')))
            .toBe('add rows, and see, edit and delete only the rows they added themselves');
    });

    it('keeps adding out of the row rule — the server does not filter it', () => {
        const ruled = table('T', { default: 'app', roles: {}, rowFilters: { staff: 'record.owner == viewer.id' } });
        expect(grantPhrase(tableGrant(ruled, 'staff')))
            .toBe('add rows, and see, edit and delete only the rows your row rule allows');
    });

    it('splits verbs that do not share a scope', () => {
        const mixed = table('T', { default: 'app', roles: { staff: { read: 'all', update: 'own', delete: 'none', create: false } }, rowFilters: {} });
        expect(grantPhrase(tableGrant(mixed, 'staff')))
            .toBe('see every row, and edit only the rows they added themselves');
    });

    it('says so when a role may add rows it can never see again', () => {
        const blind = table('T', { default: 'none', roles: { staff: { create: true } }, rowFilters: {} });
        expect(grantPhrase(tableGrant(blind, 'staff'))).toBe('add rows, without seeing them afterwards');
    });

    it('is null when the role cannot touch the table', () => {
        const shut = table('T', { default: 'none', roles: {}, rowFilters: {} });
        expect(grantPhrase(tableGrant(shut, 'staff'))).toBeNull();
    });
});

describe('ownerRunFeeds', () => {
    it('names every source a viewer reaches on the owner\'s credentials, and skips the rest', () => {
        const m = model({
            connectors: [
                { id: 'conn_1', kind: 'integration_tool', name: 'Recent emails' },
                { id: 'conn_2', kind: 'automation', name: 'Open tickets', runAs: 'owner' },
                { id: 'conn_3', kind: 'rest' },
                // Each user brings their own connection — the owner shares nothing.
                { id: 'conn_4', kind: 'integration_tool', name: 'My calendar', runAs: 'viewer' },
                // Shapes the connector runtime will not run either.
                { id: 'conn_5', kind: 'sql', name: 'Warehouse' },
                { kind: 'rest', name: 'No id' },
            ],
        });
        expect(ownerRunFeeds(m)).toEqual(['Recent emails', 'Open tickets', 'conn_3']);
    });

    it('is empty for a model without any', () => {
        expect(ownerRunFeeds(model())).toEqual([]);
        expect(ownerRunFeeds(null)).toEqual([]);
    });
});

describe('audienceCohorts', () => {
    it('is the whole organisation on the default role', () => {
        expect(audienceCohorts({ audience: 'org', model: model() }))
            .toEqual([{ key: 'org', who: 'Everyone in your organisation', role: 'app' }]);
    });

    it('carves the groups that get another role out of the org-wide sentence', () => {
        const cohorts = audienceCohorts({
            audience: 'org',
            model: model({ roleMapping: { default: 'app', byGroup: { g1: 'manager' } } }),
            groups: [{ id: 'g1', name: 'Sales' }],
        });
        expect(cohorts).toEqual([
            { key: 'org', who: 'Everyone in your organisation except Sales', role: 'app' },
            { key: 'g:manager', who: 'People in Sales', role: 'manager' },
        ]);
    });

    it('ignores a group mapped to the role everyone already has', () => {
        const cohorts = audienceCohorts({
            audience: 'org',
            model: model({ roleMapping: { default: 'app', byGroup: { g1: 'app' } } }),
            groups: [{ id: 'g1', name: 'Sales' }],
        });
        expect(cohorts).toHaveLength(1);
        expect(cohorts[0].who).toBe('Everyone in your organisation');
    });

    it('names the picked groups, one line per role they land on', () => {
        const cohorts = audienceCohorts({
            audience: 'groups',
            model: model({ roleMapping: { default: 'app', byGroup: { g2: 'manager' } } }),
            groups: [{ id: 'g1', name: 'Sales' }, { id: 'g2', name: 'Engineering' }],
            selectedGroupIds: ['g1', 'g2'],
        });
        expect(cohorts).toEqual([
            { key: 'g:app', who: 'Everyone in Sales', role: 'app' },
            { key: 'g:manager', who: 'Everyone in Engineering', role: 'manager' },
        ]);
    });

    it('adds the role another group still hands the people you shared with', () => {
        const cohorts = audienceCohorts({
            audience: 'groups',
            model: model({ roleMapping: { default: 'app', byGroup: { g2: 'manager' } } }),
            groups: [{ id: 'g1', name: 'Sales' }, { id: 'g2', name: 'HR' }],
            selectedGroupIds: ['g1'],
        });
        expect(cohorts).toEqual([
            { key: 'g:app', who: 'Everyone in Sales', role: 'app' },
            { key: 'x:manager', who: 'Anyone you share with who is also in HR', role: 'manager', maybe: true },
        ]);
    });

    it('stays quiet about a mapping that lands on a role it already described', () => {
        const cohorts = audienceCohorts({
            audience: 'groups',
            model: model({ roleMapping: { default: 'app', byGroup: { g1: 'manager', g2: 'manager' } } }),
            groups: [{ id: 'g1', name: 'Sales' }, { id: 'g2', name: 'HR' }],
            selectedGroupIds: ['g1'],
        });
        expect(cohorts).toEqual([{ key: 'g:manager', who: 'Everyone in Sales', role: 'manager' }]);
    });

    it('has nobody to describe before a group is picked', () => {
        expect(audienceCohorts({ audience: 'groups', model: model(), selectedGroupIds: [] })).toEqual([]);
    });

    it('reads a blank default the way the server does — no role at all', () => {
        const [cohort] = audienceCohorts({ audience: 'org', model: model({ roleMapping: { default: '', byGroup: {} } }) });
        expect(cohort.role).toBeNull();
    });
});

describe('summarizeAudience', () => {
    it('names every table an org-wide publish opens up', () => {
        const { cohorts, broad } = summarizeAudience({ audience: 'org', model: model(), tables: model().tables });
        expect(broad).toBe(true);
        expect(cohorts[0].grants).toEqual([
            { phrase: 'see, add, edit and delete every row', names: ['Absences', 'Employees'] },
        ]);
        expect(cohorts[0].denied).toEqual([]);
    });

    it('lists the tables the audience cannot open at all', () => {
        const shut = table('Salaries', { default: 'none', roles: {}, rowFilters: {} });
        const { cohorts } = summarizeAudience({ audience: 'org', model: model(), tables: [ABSENCES, shut] });
        expect(cohorts[0].grants[0].names).toEqual(['Absences']);
        expect(cohorts[0].denied).toEqual(['Salaries']);
    });

    it('is not broad when a row rule or "own rows only" holds every table back', () => {
        const ruled = table('A', { default: 'app', roles: {}, rowFilters: { app: 'record.owner == viewer.id' } });
        const own = table('B', { default: 'owner', roles: {}, rowFilters: {} });
        expect(summarizeAudience({ audience: 'org', model: model(), tables: [ruled, own] }).broad).toBe(false);
    });

    it('keeps a "may also get" line to what it adds, and drops it when it adds nothing', () => {
        const roleMapping = { default: 'app', byGroup: { g2: 'manager' } };
        const reads = table('Absences', { default: 'app', roles: { manager: { read: 'all', create: false, update: 'none', delete: 'none' } }, rowFilters: {} });
        const shut = table('Salaries', { default: 'app', roles: { manager: { read: 'none', create: false, update: 'none', delete: 'none' } }, rowFilters: {} });
        const args = { audience: 'groups', model: model({ roleMapping }), groups: [{ id: 'g2', name: 'HR' }], selectedGroupIds: ['g1'] };

        const { cohorts } = summarizeAudience({ ...args, tables: [reads, shut] });
        expect(cohorts[1]).toMatchObject({
            who: 'Anyone you share with who is also in HR',
            grants: [{ phrase: 'see every row', names: ['Absences'] }],
            denied: [],
        });

        // A role that reaches nothing would only contradict the line above it.
        expect(summarizeAudience({ ...args, tables: [shut] }).cohorts).toHaveLength(1);
    });

    it('leaves a cohort with no role empty-handed', () => {
        const { cohorts, broad } = summarizeAudience({
            audience: 'org',
            model: model({ roleMapping: { default: '', byGroup: {} } }),
            tables: model().tables,
        });
        expect(broad).toBe(false);
        expect(cohorts[0].grants).toEqual([]);
        expect(cohorts[0].denied).toEqual(['Absences', 'Employees']);
    });
});
