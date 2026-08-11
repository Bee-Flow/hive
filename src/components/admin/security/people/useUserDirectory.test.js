import { describe, it, expect } from 'vitest';
import { buildDirectory, GROUP_BY, SECTION_NO_ORG, SECTION_NO_GROUP, SECTION_ALL } from './useUserDirectory';

/**
 * The grouping brain is pure, so every membership shape the data model permits
 * is covered here without rendering anything.
 */

const ORGS = [
    { id: 'orgA', name: 'Acme B.V.', status: 'active' },
    { id: 'orgB', name: 'Beta N.V.', status: 'suspended' },
];

const GROUPS = [
    { id: 'g_fin', name: 'Finance', organizationId: 'orgA' },
    { id: 'g_sup', name: 'Support', organizationId: 'orgA' },
    { id: 'g_beta', name: 'Beta team', organizationId: 'orgB' },
    { id: 'g_glob', name: 'Everyone', organizationId: null },
];

const u = (id, extra) => ({ id, displayName: id, groups: [], organizationId: null, ...extra });

const JAN = u('jan', { organizationId: 'orgA', groups: ['g_fin'] });   // direct + group
const EVA = u('eva', { organizationId: null, groups: ['g_fin'] });     // group only — the trap
const PIET = u('piet', { organizationId: 'orgA' });                     // direct only, no group
const MULTI = u('multi', { organizationId: 'orgA', groups: ['g_beta'] }); // two orgs
const LOOSE = u('loose', { organizationId: '' });                       // the '' DEFAULT
const GLOBAL = u('global', { organizationId: '', groups: ['g_glob'] }); // global group only

const titles = (d) => d.sections.map((s) => s.title);
const section = (d, key) => d.sections.find((s) => s.key === key);
const ids = (arr) => arr.map((x) => x.id);

describe('buildDirectory — by organisation', () => {
    const opts = { groupBy: GROUP_BY.ORG };

    it('files a direct member under their org', () => {
        const d = buildDirectory([PIET], GROUPS, ORGS, opts);
        expect(titles(d)).toEqual(['Acme B.V.']);
        expect(ids(section(d, 'orgA').users)).toEqual(['piet']);
    });

    it('files a group-only member under their group org — the dual-path trap', () => {
        // Eva has NO organizationId, yet she belongs to Acme through Finance.
        const d = buildDirectory([EVA], GROUPS, ORGS, opts);
        expect(titles(d)).toEqual(['Acme B.V.']);
        expect(ids(section(d, 'orgA').users)).toEqual(['eva']);
    });

    it('lists a two-org person under both headers without deduping', () => {
        const d = buildDirectory([MULTI], GROUPS, ORGS, opts);
        expect(titles(d).sort()).toEqual(['Acme B.V.', 'Beta N.V.']);
        expect(ids(section(d, 'orgA').users)).toEqual(['multi']);
        expect(ids(section(d, 'orgB').users)).toEqual(['multi']);
    });

    it('counts a person once overall while sections count rows', () => {
        const d = buildDirectory([JAN, MULTI], GROUPS, ORGS, opts);
        expect(d.distinctCount).toBe(2);
        expect(d.multiOrgCount).toBe(1);
        const rows = d.sections.reduce((n, s) => n + s.count, 0);
        expect(rows).toBe(3); // jan(A) + multi(A) + multi(B)
    });

    it('buckets people with no org membership', () => {
        const d = buildDirectory([LOOSE], GROUPS, ORGS, opts);
        expect(section(d, SECTION_NO_ORG).count).toBe(1);
    });

    it("treats a global group as conferring no organisation", () => {
        const d = buildDirectory([GLOBAL], GROUPS, ORGS, opts);
        expect(titles(d)).toEqual(['No organisation']);
        expect(ids(section(d, SECTION_NO_ORG).users)).toEqual(['global']);
    });

    it('splits an org into its groups plus a no-group bucket', () => {
        const d = buildDirectory([JAN, EVA, PIET], GROUPS, ORGS, opts);
        const acme = section(d, 'orgA');
        expect(acme.count).toBe(3);
        expect(acme.subsections.map((s) => s.title)).toEqual(['Finance', 'No group']);
        expect(ids(acme.subsections[0].users)).toEqual(['jan', 'eva']);
        expect(ids(acme.subsections[1].users)).toEqual(['piet']);
    });

    it("only splits by the org's OWN groups, never another org's", () => {
        const d = buildDirectory([MULTI], GROUPS, ORGS, opts);
        // multi is in g_beta (orgB), so under Acme they are "No group".
        expect(section(d, 'orgA').subsections.map((s) => s.key)).toEqual([SECTION_NO_GROUP]);
        expect(section(d, 'orgB').subsections.map((s) => s.title)).toEqual(['Beta team']);
    });

    it('carries the org status through for the header chip', () => {
        const d = buildDirectory([PIET, MULTI], GROUPS, ORGS, opts);
        expect(section(d, 'orgA').status).toBe('active');
        expect(section(d, 'orgB').status).toBe('suspended');
    });

    it('keeps people whose org row is missing rather than dropping them', () => {
        const d = buildDirectory([u('ghost', { organizationId: 'orgGone' })], GROUPS, ORGS, opts);
        const s = section(d, 'orgGone');
        expect(s.orphaned).toBe(true);
        expect(s.title).toBe('orgGone');
        expect(ids(s.users)).toEqual(['ghost']);
    });

    it('sorts orgs by name and keeps No organisation last', () => {
        const d = buildDirectory([MULTI, LOOSE], GROUPS, ORGS, opts);
        expect(titles(d)).toEqual(['Acme B.V.', 'Beta N.V.', 'No organisation']);
    });

    it('returns no sections for an empty list', () => {
        const d = buildDirectory([], GROUPS, ORGS, opts);
        expect(d.sections).toEqual([]);
        expect(d.distinctCount).toBe(0);
    });

    describe('onlyOrgId', () => {
        it('scopes a two-org person to the requested org alone', () => {
            // Without this, filtering to Beta would still render an Acme header
            // and list `multi` twice.
            const d = buildDirectory([MULTI], GROUPS, ORGS, { ...opts, onlyOrgId: 'orgB' });
            expect(titles(d)).toEqual(['Beta N.V.']);
            expect(ids(section(d, 'orgB').users)).toEqual(['multi']);
        });

        it('excludes people who are not in the requested org', () => {
            const d = buildDirectory([JAN, MULTI], GROUPS, ORGS, { ...opts, onlyOrgId: 'orgB' });
            expect(ids(section(d, 'orgB').users)).toEqual(['multi']);
            expect(section(d, 'orgA')).toBeUndefined();
        });

        it('does not push a scoped-out person into the No organisation bucket', () => {
            // Jan has an org — he is simply not in orgB. He is absent, not org-less.
            const d = buildDirectory([JAN], GROUPS, ORGS, { ...opts, onlyOrgId: 'orgB' });
            expect(d.sections).toEqual([]);
        });

        it('still buckets genuinely org-less people', () => {
            const d = buildDirectory([LOOSE], GROUPS, ORGS, { ...opts, onlyOrgId: 'orgA' });
            expect(titles(d)).toEqual(['No organisation']);
        });
    });
});

describe('buildDirectory — by group', () => {
    const opts = { groupBy: GROUP_BY.GROUP };

    it('sections by group and labels each with its org', () => {
        const d = buildDirectory([JAN, EVA], GROUPS, ORGS, opts);
        expect(titles(d)).toEqual(['Finance']);
        expect(section(d, 'g_fin').subtitle).toBe('Acme B.V.');
        expect(ids(section(d, 'g_fin').users)).toEqual(['jan', 'eva']);
    });

    it('marks a global group as global rather than inventing an org', () => {
        const d = buildDirectory([GLOBAL], GROUPS, ORGS, opts);
        const s = section(d, 'g_glob');
        expect(s.isGlobal).toBe(true);
        expect(s.subtitle).toBe(null);
    });

    it('buckets people in no group at all', () => {
        const d = buildDirectory([PIET], GROUPS, ORGS, opts);
        expect(section(d, SECTION_NO_GROUP).count).toBe(1);
    });

    it('lists a person in several groups under each', () => {
        const both = u('both', { groups: ['g_fin', 'g_sup'] });
        const d = buildDirectory([both], GROUPS, ORGS, opts);
        expect(titles(d)).toEqual(['Finance', 'Support']);
        expect(d.distinctCount).toBe(1);
    });
});

describe('buildDirectory — flat', () => {
    it('returns one section holding everyone', () => {
        const d = buildDirectory([JAN, EVA, LOOSE], GROUPS, ORGS, { groupBy: GROUP_BY.FLAT });
        expect(d.sections).toHaveLength(1);
        expect(d.sections[0].key).toBe(SECTION_ALL);
        expect(ids(d.sections[0].users)).toEqual(['jan', 'eva', 'loose']);
    });

    it('still reports multi-org people so the footnote stays honest', () => {
        const d = buildDirectory([MULTI], GROUPS, ORGS, { groupBy: GROUP_BY.FLAT });
        expect(d.multiOrgCount).toBe(1);
    });
});

describe('buildDirectory — robustness', () => {
    it('survives null inputs', () => {
        expect(buildDirectory(null, null, null, { groupBy: GROUP_BY.ORG }).sections).toEqual([]);
    });

    it('reads groups from the raw JSON TEXT column', () => {
        const raw = u('raw', { organizationId: null, groups: '["g_fin"]' });
        const d = buildDirectory([raw], GROUPS, ORGS, { groupBy: GROUP_BY.ORG });
        expect(titles(d)).toEqual(['Acme B.V.']);
    });

    it('does not throw on malformed group JSON', () => {
        const bad = u('bad', { organizationId: 'orgA', groups: '{nope' });
        const d = buildDirectory([bad], GROUPS, ORGS, { groupBy: GROUP_BY.ORG });
        expect(ids(section(d, 'orgA').users)).toEqual(['bad']);
    });
});
