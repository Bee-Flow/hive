/**
 * The Privacy Shield editor must edit the organisation it was asked to edit.
 *
 * `OrgInfoPanel` embeds this for the org whose settings page is open. Before
 * the fix, the editor took no org id and fell back to `orgs[0].id` from
 * /auth/organizations — and in embedded mode the org picker is hidden, so
 * nothing on screen said which tenant was loaded. A super-admin opening org B's
 * settings therefore read, and on save WROTE, org A's shield.
 *
 * These assert against the URLs actually requested, because that is the only
 * place the bug was ever visible.
 *
 * Moved here from GuardrailsPanel.orgscope.test.jsx when the editor was
 * extracted. Four cases port verbatim. The fifth — "the full admin view
 * defaults to the first org" — is now expressed as the `allowOrgPicker` prop:
 * defaulting is permitted ONLY when a visible picker exists, so the admin can
 * see and change what was chosen.
 */

import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../utils/helpers', () => ({
    API_BASE: '',
    authFetch: vi.fn(),
}));

vi.mock('../../../../hooks/useTranslation', () => ({
    useTranslation: () => ({ t: (key, fallback) => (typeof fallback === 'string' ? fallback : key) }),
    __esModule: true,
}));

vi.mock('../../../LicenseContext', () => ({
    useLicenseContext: () => ({ tier: 'enterprise', hasFeature: () => true, hasTier: () => true }),
}));

import OrgShieldEditor from './OrgShieldEditor';
import { authFetch } from '../../../../utils/helpers';

const ORGS = [
    { id: 'org-alpha', name: 'Alpha BV' },
    { id: 'org-beta', name: 'Beta NV' },
];

const SHIELD = {
    enabled: true,
    collectionIds: ['c1'],
    piiDetectionCategories: ['Email'],
    piiDetectionConfidenceThreshold: 0.7,
    piiDetectionAction: 'block',
    customSensitiveTerms: [],
    toolPiiPolicy: { external: { blockCategories: [] }, internal: { blockCategories: [] } },
};

/** Every URL the component requested, in order. */
let requested = [];

const ok = (body) => ({ ok: true, status: 200, json: async () => body });

beforeEach(() => {
    requested = [];
    authFetch.mockReset();
    authFetch.mockImplementation(async (url) => {
        requested.push(url);
        if (url.includes('/auth/organizations')) return ok(ORGS);
        if (url.includes('/ai/config/chat-models-eu')) return ok({});
        if (url.includes('/ai/config')) return ok({});
        if (url.includes('/api/org-privacy-shield/')) return ok(SHIELD);
        return ok({});
    });
});

const shieldCalls = () => requested.filter(u => u.includes('/api/org-privacy-shield/'));

describe('OrgShieldEditor org scoping', () => {
    it('loads the organisation it was given, not the first one in the list', async () => {
        render(<OrgShieldEditor orgId="org-beta" />);

        await waitFor(() => expect(shieldCalls().length).toBeGreaterThan(0));

        // The regression: any request for org-alpha means the editor guessed.
        expect(shieldCalls().some(u => u.includes('org-alpha'))).toBe(false);
        expect(shieldCalls().every(u => u.includes('org-beta'))).toBe(true);
    });

    it('handles the id arriving after mount (the embedding page resolves it async)', async () => {
        const { rerender } = render(<OrgShieldEditor orgId={undefined} />);

        // Nothing may be fetched while the target org is unknown — guessing
        // here is exactly what the bug was.
        await waitFor(() => expect(requested.some(u => u.includes('/auth/organizations'))).toBe(true));
        expect(shieldCalls()).toHaveLength(0);

        rerender(<OrgShieldEditor orgId="org-beta" />);

        await waitFor(() => expect(shieldCalls().length).toBeGreaterThan(0));
        expect(shieldCalls().every(u => u.includes('org-beta'))).toBe(true);
    });

    it('never falls back to another org when no id and no picker are supplied', async () => {
        render(<OrgShieldEditor />);

        await waitFor(() => expect(requested.some(u => u.includes('/auth/organizations'))).toBe(true));
        // Give any stray async work a chance to fire before asserting absence.
        await new Promise(r => setTimeout(r, 20));
        expect(shieldCalls()).toHaveLength(0);
    });

    it('defaults to the first org ONLY when a visible picker is allowed', async () => {
        render(<OrgShieldEditor allowOrgPicker />);

        await waitFor(() => expect(shieldCalls().length).toBeGreaterThan(0));
        expect(shieldCalls()[0]).toContain('org-alpha');
        // The picker must actually be rendered — that is what makes the
        // default something the admin can see and correct.
        expect(screen.getByRole('combobox')).toBeTruthy();
    });

    it('hides the org picker when the org is pinned', async () => {
        render(<OrgShieldEditor orgId="org-beta" />);
        await waitFor(() => expect(shieldCalls().length).toBeGreaterThan(0));

        // A picker whose choice the prop immediately overrides is worse than none.
        expect(screen.queryByRole('combobox')).toBeNull();
    });

    it('an explicit orgId still wins when a picker is also allowed', async () => {
        render(<OrgShieldEditor orgId="org-beta" allowOrgPicker />);

        await waitFor(() => expect(shieldCalls().length).toBeGreaterThan(0));
        expect(shieldCalls().every(u => u.includes('org-beta'))).toBe(true);
        expect(screen.queryByRole('combobox')).toBeNull();
    });
});
