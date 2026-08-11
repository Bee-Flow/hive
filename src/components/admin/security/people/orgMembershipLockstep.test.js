// @vitest-environment node
//
// Lockstep tripwire: the bundled org-membership resolver (orgMembership.js) must
// behave identically to the server's authoritative copy
// (server/auth/orgMembership.js). The server copy mirrors resolveUserOrgIds and
// decides which users an org-admin may see; the bundled copy decides which
// organisation heading a person is filed under in the Security People directory.
// Silent drift between them turns into "this person is in the list but under the
// wrong org" — or worse, an org that looks empty. This test makes drift a red
// build.
//
// This is behavioural, not structural: both implementations run over the same
// fixture matrix and must agree on every case. Adding a case here costs nothing
// and covers both runtimes at once.

import { createRequire } from 'module';
import { describe, it, expect } from 'vitest';
import * as client from './orgMembership';

const require = createRequire(import.meta.url);
const server = require('../../../../../../server/auth/orgMembership.js');

const GROUPS = [
    { id: 'g_fin', name: 'Finance', organizationId: 'orgA' },
    { id: 'g_sup', name: 'Support', organizationId: 'orgB' },
    { id: 'g_glob', name: 'Everyone', organizationId: null },
];

// Every membership shape the data model actually permits. Each entry is run
// through both implementations and the results compared.
const MATRIX = [
    ['direct only', { organizationId: 'orgA', groups: [] }],
    ['via group only — no organizationId at all', { organizationId: null, groups: ['g_fin'] }],
    ['both paths to the same org', { organizationId: 'orgA', groups: ['g_fin'] }],
    ['two orgs, one per path', { organizationId: 'orgA', groups: ['g_sup'] }],
    ["organizationId '' (the column DEFAULT)", { organizationId: '', groups: [] }],
    ['global group contributes nothing', { organizationId: '', groups: ['g_glob'] }],
    ['groups as a raw JSON string', { organizationId: null, groups: '["g_fin"]' }],
    ['groups as malformed JSON', { organizationId: 'orgA', groups: '{nope' }],
    ['unknown group id', { organizationId: '', groups: ['g_gone'] }],
    ['several groups, one global', { organizationId: '', groups: ['g_fin', 'g_sup', 'g_glob'] }],
    ['duplicate group ids', { organizationId: '', groups: ['g_fin', 'g_fin'] }],
    ['no groups key at all', { organizationId: 'orgB' }],
    ['empty user row', {}],
    ['null user row', null],
];

describe('client/server org-membership lockstep', () => {
    it.each(MATRIX)('membershipFor agrees: %s', (_label, userRow) => {
        expect(client.membershipFor(userRow, GROUPS)).toEqual(server.membershipFor(userRow, GROUPS));
    });

    it.each(MATRIX)('orgIdsForUser agrees: %s', (_label, userRow) => {
        expect([...client.orgIdsForUser(userRow, GROUPS)].sort())
            .toEqual([...server.orgIdsForUser(userRow, GROUPS)].sort());
    });

    it.each(MATRIX)('parseGroupIds agrees: %s', (_label, userRow) => {
        expect(client.parseGroupIds(userRow)).toEqual(server.parseGroupIds(userRow));
    });

    it('isMemberOfOrg agrees across the matrix and both orgs', () => {
        for (const [label, userRow] of MATRIX) {
            for (const orgId of ['orgA', 'orgB', '', undefined]) {
                expect(client.isMemberOfOrg(userRow, GROUPS, orgId), `${label} / ${orgId}`)
                    .toBe(server.isMemberOfOrg(userRow, GROUPS, orgId));
            }
        }
    });

    it('exports the same surface from both copies', () => {
        const surface = ['parseGroupIds', 'membershipFor', 'orgIdsForUser', 'isMemberOfOrg'];
        for (const name of surface) {
            expect(typeof client[name], `client.${name}`).toBe('function');
            expect(typeof server[name], `server.${name}`).toBe('function');
        }
        expect(Object.keys(server).sort()).toEqual(surface.sort());
    });

    // The two behaviours the whole directory rests on — asserted explicitly so a
    // reader of this file learns the rule without running it.
    it('agrees that a user with no organizationId still belongs to their group org', () => {
        const viaGroup = { organizationId: null, groups: ['g_fin'] };
        expect([...client.orgIdsForUser(viaGroup, GROUPS)]).toEqual(['orgA']);
        expect([...server.orgIdsForUser(viaGroup, GROUPS)]).toEqual(['orgA']);
    });

    it('agrees that a global group never confers org membership', () => {
        const globalOnly = { organizationId: '', groups: ['g_glob'] };
        expect([...client.orgIdsForUser(globalOnly, GROUPS)]).toEqual([]);
        expect([...server.orgIdsForUser(globalOnly, GROUPS)]).toEqual([]);
    });
});
