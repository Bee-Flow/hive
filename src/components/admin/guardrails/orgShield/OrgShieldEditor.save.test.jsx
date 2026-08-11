/**
 * Saving the Privacy Shield must not destroy what the page cannot see.
 *
 * The PUT handler rebuilds the whole shield row from the request body, and this
 * page sent a fixed list of keys. Every key it did not send therefore came back
 * as a server default — so every admin save silently:
 *
 *   - emptied `customSensitiveTerms` (the org's own redaction patterns, which
 *     the runtime really does read),
 *   - reset `dlpScope`, `dlpFailureMode`, `dlpAllowlistedHosts` and
 *     `attachmentLargeInputPolicy`,
 *   - overwrote `scope` and `action` with hardcoded values.
 *
 * The fix keeps the loaded document and lays this page's fields over it. That
 * is invisible in the UI, so it needs a test that reads the actual PUT body —
 * including a field this code has never heard of, because the next release will
 * add one.
 *
 * Run: npx vitest run src/components/admin/guardrails/orgShield/OrgShieldEditor.save.test.jsx
 */

import { render, screen, waitFor } from '@testing-library/react';
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

/**
 * A stored document that exercises every field this page does NOT render,
 * plus one it cannot possibly know about.
 */
const STORED = {
    enabled: true,
    collectionIds: ['col-1'],
    scope: { userInput: false, agentOutput: true },
    action: 'redact',
    piiDetectionCategories: ['Email'],
    piiDetectionConfidenceThreshold: 0.7,
    piiDetectionAction: 'block',
    piiFailureMode: 'fail_closed',
    toolPiiPolicy: { external: { blockCategories: [] }, internal: { blockCategories: [] } },
    // Not rendered by this page — all previously destroyed on save.
    customSensitiveTerms: [{ id: 't1', label: 'Codename', pattern: 'AURORA', type: 'literal', caseSensitive: false }],
    dlpScope: 'all',
    dlpFailureMode: 'fail_open',
    dlpAllowlistedHosts: ['intern.example'],
    attachmentLargeInputPolicy: 'fail_closed',
    webSearchGuardPiiCategories: ['Person'],
    // A field from a future release. It must survive too.
    somethingAddedLater: { deeply: ['nested'] },
    // Response-only keys — these must NOT be echoed back into the row.
    updatedAt: '2020-01-01T00:00:00.000Z',
    updatedBy: 'someone-else',
};

let requested = [];
let putBodies = [];
let shieldStatus = 200;

const ok = (body) => ({ ok: true, status: 200, json: async () => body });

beforeEach(() => {
    requested = [];
    putBodies = [];
    shieldStatus = 200;
    authFetch.mockReset();
    authFetch.mockImplementation(async (url, opts) => {
        requested.push(url);
        if (url.includes('/auth/organizations')) return ok([{ id: ORG_ID, name: 'Alpha BV' }]);
        if (url.includes('/ai/config/chat-models-eu')) return ok({});
        if (url.includes('/ai/config')) return ok({});
        if (url.includes('/api/org-privacy-shield/')) {
            if (opts?.method === 'PUT') {
                putBodies.push(JSON.parse(opts.body));
                return ok({ ok: true, config: { ...STORED }, termErrors: [] });
            }
            if (shieldStatus !== 200) {
                return { ok: false, status: shieldStatus, json: async () => ({ error: 'nope' }) };
            }
            return ok(STORED);
        }
        return ok({});
    });
});

const saveButton = () => screen.getByRole('button', { name: /save/i });

async function renderLoaded() {
    render(<OrgShieldEditor orgId={ORG_ID} />);
    await waitFor(() => expect(saveButton()).toBeEnabled());
}

describe('OrgShieldEditor save payload', () => {
    it('carries every stored field the page does not render', async () => {
        const user = userEvent.setup();
        await renderLoaded();

        // Change one unrelated thing, exactly as an admin would.
        // The sensitivity cards live on the "What we look for" tab; Overview is the
        // landing tab and is deliberately read-only apart from the master
        // switch, so an edit has to start with navigation.
        await user.click(screen.getByRole('tab', { name: /What we look for/ }));
        await user.click(screen.getByRole('radio', { name: /Low sensitivity/ }));
        await user.click(saveButton());
        await waitFor(() => expect(putBodies).toHaveLength(1));

        const body = putBodies[0];
        expect(body.customSensitiveTerms).toEqual(STORED.customSensitiveTerms);
        expect(body.dlpScope).toBe('all');
        expect(body.dlpFailureMode).toBe('fail_open');
        expect(body.dlpAllowlistedHosts).toEqual(['intern.example']);
        expect(body.attachmentLargeInputPolicy).toBe('fail_closed');
        expect(body.collectionIds).toEqual(['col-1']);
        expect(body.webSearchGuardPiiCategories).toEqual(['Person']);
        // Previously overwritten with hardcoded { true, true } / 'delete'.
        expect(body.scope).toEqual({ userInput: false, agentOutput: true });
        expect(body.action).toBe('redact');
        // The unknown-field guarantee: this is what makes the merge future-proof.
        expect(body.somethingAddedLater).toEqual({ deeply: ['nested'] });
    });

    it('does not echo response-only fields back into the row', async () => {
        const user = userEvent.setup();
        await renderLoaded();
        await user.click(saveButton());
        await waitFor(() => expect(putBodies).toHaveLength(1));

        // The server owns these; sending them back would persist a stale
        // author, and a transient plan note, into the stored document.
        expect(putBodies[0]).not.toHaveProperty('updatedAt');
        expect(putBodies[0]).not.toHaveProperty('updatedBy');
        expect(putBodies[0]).not.toHaveProperty('clamped_fields');
        expect(putBodies[0]).not.toHaveProperty('stalenessWarnings');
    });

    it('never persists showRawPayload while the action is not tokenize', async () => {
        const user = userEvent.setup();
        authFetch.mockImplementation(async (url, opts) => {
            requested.push(url);
            if (url.includes('/auth/organizations')) return ok([{ id: ORG_ID, name: 'Alpha BV' }]);
            if (url.includes('/ai/config/chat-models-eu')) return ok({});
            if (url.includes('/ai/config')) return ok({});
            if (url.includes('/api/org-privacy-shield/')) {
                if (opts?.method === 'PUT') { putBodies.push(JSON.parse(opts.body)); return ok({ ok: true, config: STORED }); }
                // Stored ON, with an action that hides the control entirely.
                return ok({ ...STORED, piiDetectionAction: 'block', showRawPayload: true });
            }
            return ok({});
        });
        await renderLoaded();
        await user.click(saveButton());
        await waitFor(() => expect(putBodies).toHaveLength(1));

        // The checkbox is not rendered at all under 'block', so leaving the
        // value at true kept a transparency panel switched on for every user
        // in the org with nothing on screen saying so.
        expect(putBodies[0].showRawPayload).toBe(false);
    });
});

describe('OrgShieldEditor load failure', () => {
    it('shows nothing to edit and nothing to save', async () => {
        shieldStatus = 500;
        render(<OrgShieldEditor orgId={ORG_ID} />);

        const alert = await screen.findByRole('alert');
        expect(alert).toHaveTextContent(/could not load/i);

        // The whole point. The form used to render constructor defaults —
        // "shield off, no categories" — indistinguishably from a real answer,
        // with Save live. One click then wrote that blank config over the
        // org's real one. With no trustworthy document there is nothing to
        // show and nothing to save, and the page now says exactly that.
        expect(screen.queryByRole('button', { name: /save/i })).toBeNull();
        expect(screen.queryByText('Low sensitivity')).toBeNull();
        expect(putBodies).toHaveLength(0);
    });

    it('names the access problem specifically on a 403', async () => {
        shieldStatus = 403;
        render(<OrgShieldEditor orgId={ORG_ID} />);
        const alert = await screen.findByRole('alert');
        expect(alert).toHaveTextContent(/do not have access/i);
        expect(screen.queryByRole('button', { name: /save/i })).toBeNull();
    });
});

describe('OrgShieldEditor dirty state', () => {
    it('appears on the first edit and clears after a successful save', async () => {
        const user = userEvent.setup();
        await renderLoaded();

        expect(screen.queryByText('Unsaved changes')).toBeNull();
        // The sensitivity cards live on the "What we look for" tab; Overview is the
        // landing tab and is deliberately read-only apart from the master
        // switch, so an edit has to start with navigation.
        await user.click(screen.getByRole('tab', { name: /What we look for/ }));
        await user.click(screen.getByRole('radio', { name: /Low sensitivity/ }));
        expect(screen.getByText('Unsaved changes')).toBeInTheDocument();

        await user.click(saveButton());
        await waitFor(() => expect(screen.queryByText('Unsaved changes')).toBeNull());
    });
});

describe('OrgShieldEditor partial save', () => {
    it('says so when the server rejected some custom terms', async () => {
        const user = userEvent.setup();
        authFetch.mockImplementation(async (url, opts) => {
            if (url.includes('/auth/organizations')) return ok([{ id: ORG_ID, name: 'Alpha BV' }]);
            if (url.includes('/ai/config/chat-models-eu')) return ok({});
            if (url.includes('/ai/config')) return ok({});
            if (url.includes('/api/org-privacy-shield/')) {
                if (opts?.method === 'PUT') {
                    putBodies.push(JSON.parse(opts.body));
                    // The server saves the valid terms and reports the rest —
                    // so this is a partial success, not a clean one.
                    return ok({ ok: true, config: STORED, termErrors: [{ id: 't9', label: 'Bad', error: 'Invalid regular expression' }] });
                }
                return ok(STORED);
            }
            return ok({});
        });
        await renderLoaded();
        await user.click(saveButton());

        expect(await screen.findByText(/1 custom term\(s\) were rejected/i)).toBeInTheDocument();
    });
});
