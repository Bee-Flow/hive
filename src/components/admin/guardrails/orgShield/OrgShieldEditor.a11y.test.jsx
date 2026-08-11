/**
 * Accessibility contract for the Privacy Shield editor.
 *
 * Every assertion here corresponds to something that was actually broken:
 *
 *   - seven switches were `<input class="sr-only">` inside a `<label>` that
 *     wrapped only the visual track, with the title as a sibling. A screen
 *     reader announced seven anonymous checkboxes, one of them the master
 *     enable, and clicking the title did nothing;
 *   - the sensitivity and action cards were plain `<button>`s, so "which one
 *     is selected" was carried by colour alone and nothing said the options
 *     were mutually exclusive;
 *   - the twenty-one category checkboxes were a bare grid under a `<label>`
 *     that labelled nothing;
 *   - every category icon rendered `role="img"` with an accessible name of
 *     `null`, because the id lookup feeding it had `return null` as its entire
 *     body — twenty-one nameless "image" announcements between the labels.
 *
 * Run: npx vitest run src/components/admin/guardrails/orgShield/OrgShieldEditor.a11y.test.jsx
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

const ORG_ID = 'org-alpha';
const SHIELD = {
    enabled: true,
    piiDetectionCategories: ['Email'],
    piiDetectionConfidenceThreshold: 0.7,
    piiDetectionAction: 'block',
    dlpEnabled: true,
    dlpMode: 'ask',
    toolPiiPolicy: { external: { blockCategories: [] }, internal: { blockCategories: [] } },
};

const ok = (body) => ({ ok: true, status: 200, json: async () => body });

beforeEach(() => {
    window.history.replaceState({}, '', '/app/settings/organisation/privacy');
    authFetch.mockReset();
    authFetch.mockImplementation(async (url, opts) => {
        if (url.includes('/auth/organizations')) return ok([{ id: ORG_ID, name: 'Alpha BV' }]);
        if (url.includes('/ai/config/chat-models-eu')) return ok({});
        if (url.includes('/ai/config')) return ok({ searchProvider: 'serper' });
        if (url.includes('/api/org-privacy-shield/')) {
            if (opts?.method === 'PUT') return ok({ ok: true, config: SHIELD });
            return ok(SHIELD);
        }
        return ok({});
    });
});

async function renderOn(tabName) {
    const user = userEvent.setup();
    render(<OrgShieldEditor orgId={ORG_ID} />);
    await waitFor(() => expect(screen.getByRole('tab', { name: /Overview/ })).toBeInTheDocument());
    if (tabName) await user.click(screen.getByRole('tab', { name: tabName }));
    return user;
}

describe('Privacy Shield accessibility', () => {
    it('gives every switch an accessible name', async () => {
        await renderOn(/Leaving your org/);
        const switches = screen.getAllByRole('checkbox');
        expect(switches.length).toBeGreaterThan(0);
        for (const box of switches) {
            expect(box).toHaveAccessibleName();
        }
    });

    it('names the master enable switch', async () => {
        await renderOn();
        expect(screen.getByRole('checkbox', { name: /Enable/i })).toBeInTheDocument();
    });

    it('renders the action choice as a radiogroup with exactly one checked option', async () => {
        await renderOn(/What happens/);
        const group = screen.getByRole('radiogroup', { name: /What happens when we find personal data/ });
        const radios = within(group).getAllByRole('radio');
        expect(radios.length).toBe(2);
        expect(radios.filter(r => r.getAttribute('aria-checked') === 'true')).toHaveLength(1);
    });

    it('renders the sensitivity choice as a radiogroup with exactly one checked option', async () => {
        await renderOn(/What we look for/);
        const group = screen.getByRole('radiogroup', { name: /How strict should we be/ });
        const radios = within(group).getAllByRole('radio');
        expect(radios.length).toBe(3);
        expect(radios.filter(r => r.getAttribute('aria-checked') === 'true')).toHaveLength(1);
    });

    it('groups the category checkboxes under a naming legend', async () => {
        await renderOn(/What we look for/);
        // A <fieldset> with a <legend> is what turns twenty-one unrelated
        // checkboxes into one labelled group.
        const groups = screen.getAllByRole('group');
        expect(groups.length).toBeGreaterThan(0);
        const named = groups.filter(g => (g.textContent || '').includes('Kinds of personal data')
            || !!g.querySelector('legend'));
        expect(named.length).toBeGreaterThan(0);
    });

    it('has no icon announced as a nameless image', async () => {
        const user = await renderOn(/What we look for/);
        for (const tab of [/What we look for/, /What happens/, /Leaving your org/]) {
            await user.click(screen.getByRole('tab', { name: tab }));
            // getAllByRole('img') only returns elements EXPOSED as images.
            // Decorative icons are aria-hidden and must not appear at all.
            const imgs = screen.queryAllByRole('img');
            for (const img of imgs) {
                expect(img, `an icon on ${tab} has no accessible name`).toHaveAccessibleName();
            }
        }
    });

    it('labels the org picker when it is shown', async () => {
        authFetch.mockImplementation(async (url) => {
            if (url.includes('/auth/organizations')) {
                return ok([{ id: ORG_ID, name: 'Alpha BV' }, { id: 'org-beta', name: 'Beta NV' }]);
            }
            if (url.includes('/ai/config/chat-models-eu')) return ok({});
            if (url.includes('/ai/config')) return ok({});
            if (url.includes('/api/org-privacy-shield/')) return ok(SHIELD);
            return ok({});
        });
        render(<OrgShieldEditor allowOrgPicker />);
        await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument());
        expect(screen.getByRole('combobox')).toHaveAccessibleName();
    });

    it('exposes the DLP mode as a named radiogroup rather than a bare select', async () => {
        await renderOn(/Leaving your org/);
        const group = screen.getByRole('radiogroup', { name: /What to do when it finds something/ });
        expect(within(group).getAllByRole('radio')).toHaveLength(3);
    });
});
