import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import SettingsForm from './SettingsForm';
import { VariablePickerProvider } from '../mapping/VariablePickerContext';
import scopedStorage from '../../../../../utils/scopedStorage';
import { extractFormState, buildPatch } from './settings/formState';
import { computeUpstreamGroups } from '../mapping/upstream';
import { buildStepFromPayload } from '../DiagramPane';
import { DATA_ITEMS } from './stepPalette';

// HttpAuthPicker loads the credential list via useAutomationApi on mount
// (only when the Authentication section is expanded).
const api = {
    listHttpConnections: vi.fn(async () => ({
        connections: [
            { id: 'c-own', label: 'Prod API key', provider: 'http', kind: 'api_key', access: 'own', secretMeta: { headerName: 'X-API-Key' } },
            { id: 'c-lent', label: 'Team OAuth', provider: 'http', kind: 'oauth2_cc', access: 'lent', secretMeta: {} },
        ],
    })),
    createHttpConnection: vi.fn(async (body) => ({
        connection: { id: 'c-new', label: body.label, provider: 'http', kind: body.kind },
    })),
};
vi.mock('../../../../../hooks/useAutomationApi', async (importOriginal) => {
    const mod = await importOriginal();
    return { ...mod, default: () => api };
});

const noIssues = { errors: [], warnings: [] };

function renderForm(step, { onPatch = vi.fn() } = {}) {
    return render(
        <VariablePickerProvider groups={[]} previewSample={null} stepLabelById={new Map()}>
            <SettingsForm step={step} modelTiers={{}} stepIssues={noIssues} saving={false} saveError={null} onPatch={onPatch} catalog={null} groups={[]} />
        </VariablePickerProvider>,
    );
}

describe('http_request — form state round-trip', () => {
    it('extractFormState fills sane defaults for a fresh step', () => {
        const step = buildStepFromPayload({ kind: 'http_request', label: 'HTTP Request' });
        const draft = extractFormState(step);
        expect(draft.url).toBe('');
        expect(draft.method).toBe('GET');
        expect(draft.headers).toEqual({});
        expect(draft.timeoutMs).toBe(10_000);
        expect(draft.blockPrivateTargets).toBe(true);
    });

    it('buildPatch persists everything, uppercases the method, and clamps the timeout', () => {
        const step = { id: 'h1', type: 'http_request' };
        const draft = {
            label: 'Call API', url: 'https://api.example.com/{{trigger.output.id}}',
            method: 'post', headers: { 'Content-Type': 'application/json' },
            body: '{"x":1}', timeoutMs: 999999, blockPrivateTargets: false,
        };
        const patch = buildPatch(step, draft);
        expect(patch.url).toBe('https://api.example.com/{{trigger.output.id}}');
        expect(patch.method).toBe('POST');
        expect(patch.headers).toEqual({ 'Content-Type': 'application/json' });
        expect(patch.body).toBe('{"x":1}');
        expect(patch.timeoutMs).toBe(60_000); // clamped
        expect(patch.blockPrivateTargets).toBe(false);
    });

    it('blockPrivateTargets defaults to TRUE when the draft omits it', () => {
        const patch = buildPatch({ id: 'h1', type: 'http_request' }, { url: 'https://x.test', method: 'GET' });
        expect(patch.blockPrivateTargets).toBe(true);
    });

    it('extractFormState reads step.auth into { connectionId } and defaults to null', () => {
        expect(extractFormState({ id: 'h1', type: 'http_request' }).auth).toBeNull();
        expect(extractFormState({ id: 'h1', type: 'http_request', auth: null }).auth).toBeNull();
        expect(extractFormState({ id: 'h1', type: 'http_request', auth: { connectionId: 'c-own' } }).auth)
            .toEqual({ connectionId: 'c-own' });
        // Malformed shapes degrade to null instead of round-tripping garbage.
        expect(extractFormState({ id: 'h1', type: 'http_request', auth: 'c-own' }).auth).toBeNull();
        expect(extractFormState({ id: 'h1', type: 'http_request', auth: {} }).auth).toBeNull();
    });

    it('buildPatch persists a selected credential and clears with explicit null', () => {
        const step = { id: 'h1', type: 'http_request', url: 'https://x.test' };
        const withAuth = buildPatch(step, { url: 'https://x.test', method: 'GET', auth: { connectionId: 'c-own' } });
        expect(withAuth.auth).toEqual({ connectionId: 'c-own' });
        const cleared = buildPatch(
            { ...step, auth: { connectionId: 'c-own' } },
            { url: 'https://x.test', method: 'GET', auth: null },
        );
        expect(cleared.auth).toBeNull(); // explicit null clears the definition
    });
});

describe('SettingsForm — HttpRequestFields', () => {
    beforeEach(() => {
        cleanup();
        scopedStorage.setCurrentUser('http-test-user');
        try { localStorage.clear(); } catch {}
    });

    const getStep = () => buildStepFromPayload({ kind: 'http_request', label: 'HTTP Request' });

    it('renders URL and Method, and the security toggle (on by default, inside Options)', () => {
        renderForm({ ...getStep(), id: 'h1' });
        expect(screen.getByText('URL')).toBeTruthy();
        expect(screen.getByText('Method')).toBeTruthy();
        // The security toggle lives in the (collapsed) Options accordion — expand it.
        fireEvent.click(screen.getByText('Options'));
        const toggle = screen.getByRole('checkbox');
        expect(toggle.checked).toBe(true); // blockPrivateTargets default on
    });

    it('does NOT show the Body section for a GET, but DOES for a POST', () => {
        renderForm({ ...getStep(), id: 'h1', method: 'GET' });
        expect(screen.queryByText('Body')).toBeNull();
        cleanup();
        renderForm({ ...getStep(), id: 'h1', method: 'POST' });
        expect(screen.getByText('Body')).toBeTruthy();
    });

    it('toggling the security checkbox off is reflected in the control', () => {
        renderForm({ ...getStep(), id: 'h1' });
        fireEvent.click(screen.getByText('Options'));
        const toggle = screen.getByRole('checkbox');
        fireEvent.click(toggle);
        expect(toggle.checked).toBe(false);
    });
});

describe('SettingsForm — Authentication section (HttpAuthPicker)', () => {
    beforeEach(() => {
        cleanup();
        vi.clearAllMocks();
        scopedStorage.setCurrentUser('http-test-user');
        try { localStorage.clear(); } catch {}
    });

    const getStep = () => buildStepFromPayload({ kind: 'http_request', label: 'HTTP Request' });

    const openAuthSection = async () => {
        fireEvent.click(screen.getByText('Authentication'));
        // The picker lazy-loads on expand; wait for the loaded select.
        return waitFor(() => {
            const sel = screen.getAllByRole('combobox').find(s => s.querySelector('option[value=""]')?.textContent === 'None (no credential)');
            if (!sel) throw new Error('credential select not loaded yet');
            return sel;
        });
    };

    it('renders the accordion and lists own + shared credentials from the API', async () => {
        renderForm({ ...getStep(), id: 'h1' });
        const select = await openAuthSection();
        expect(api.listHttpConnections).toHaveBeenCalledTimes(1);
        const texts = Array.from(select.querySelectorAll('option')).map(o => o.textContent);
        expect(texts).toContain('None (no credential)');
        expect(texts).toContain('Prod API key — API key (custom header)');
        expect(texts).toContain('Team OAuth — OAuth2 (client credentials) (shared with you)');
        // Encrypted-vault hint is visible under the select.
        expect(screen.getByText(/stored encrypted in your organization's vault/)).toBeTruthy();
    });

    it('selecting a credential lands in the saved patch as auth.connectionId', async () => {
        const onPatch = vi.fn(async () => {});
        renderForm({ ...getStep(), id: 'h1' }, { onPatch });
        const select = await openAuthSection();
        fireEvent.change(select, { target: { value: 'c-own' } });
        fireEvent.click(screen.getByText('Save'));
        await waitFor(() => expect(onPatch).toHaveBeenCalled());
        const patch = onPatch.mock.calls.at(-1)[0];
        expect(patch.auth).toEqual({ connectionId: 'c-own' });
    });

    it('picking None clears the credential (auth: null in the patch)', async () => {
        const onPatch = vi.fn(async () => {});
        renderForm({ ...getStep(), id: 'h1', auth: { connectionId: 'c-own' } }, { onPatch });
        // Section defaults open when a credential is set — the select loads directly.
        const select = await waitFor(() => {
            const sel = screen.getAllByRole('combobox').find(s => s.querySelector('option[value=""]')?.textContent === 'None (no credential)');
            if (!sel) throw new Error('not loaded');
            return sel;
        });
        expect(select.value).toBe('c-own');
        fireEvent.change(select, { target: { value: '' } });
        fireEvent.click(screen.getByText('Save'));
        await waitFor(() => expect(onPatch).toHaveBeenCalled());
        expect(onPatch.mock.calls.at(-1)[0].auth).toBeNull();
    });

    it('shows a disabled Unknown-credential placeholder for an inaccessible id', async () => {
        renderForm({ ...getStep(), id: 'h1', auth: { connectionId: 'ghost' } });
        const select = await waitFor(() => {
            const sel = screen.getAllByRole('combobox').find(s => s.querySelector('option[value=""]')?.textContent === 'None (no credential)');
            if (!sel) throw new Error('not loaded');
            return sel;
        });
        expect(select.value).toBe('ghost');
        const ghost = select.querySelector('option[value="ghost"]');
        expect(ghost).toBeTruthy();
        expect(ghost.disabled).toBe(true);
        expect(ghost.textContent).toMatch(/Unknown credential \(not accessible\)/);
    });

    it('inline create posts the new credential and auto-selects it', async () => {
        renderForm({ ...getStep(), id: 'h1' });
        const select = await openAuthSection();
        fireEvent.click(screen.getByText('Add credential'));
        // Default auth type is Bearer token — a single password field.
        const form = screen.getByText('Save credential').closest('div').parentElement;
        const nameInput = form.querySelector('input[type="text"]');
        fireEvent.change(nameInput, { target: { value: 'My bearer' } });
        const tokenInput = form.querySelector('input[type="password"]');
        expect(tokenInput).toBeTruthy(); // secrets are never plain text inputs
        fireEvent.change(tokenInput, { target: { value: 'tok-inline-test' } });
        fireEvent.click(screen.getByText('Save credential'));
        await waitFor(() => expect(api.createHttpConnection).toHaveBeenCalledTimes(1));
        expect(api.createHttpConnection).toHaveBeenCalledWith({
            provider: 'http', kind: 'bearer', label: 'My bearer', secret: { token: 'tok-inline-test' },
        });
        await waitFor(() => expect(select.value).toBe('c-new'));
        // The mini-form collapsed back to the toggle.
        expect(screen.queryByText('Save credential')).toBeNull();
    });

    it('links to Settings for full credential management', async () => {
        renderForm({ ...getStep(), id: 'h1' });
        await openAuthSection();
        const link = screen.getByText('Manage credentials in Settings');
        // Top-level integrations tab — that's where IntegrationsSection hosts
        // ConnectionsManager; /organisation/integrations is the org-admin panel.
        expect(link.getAttribute('href')).toBe('/app/settings/integrations');
    });
});

describe('http_request — palette + upstream', () => {
    it('is offered as a Data palette item', () => {
        const item = DATA_ITEMS.find(i => i.id === 'http_request');
        expect(item).toBeTruthy();
        expect(item.payload.kind).toBe('http_request');
    });

    it('surfaces status/ok/body as bindable upstream fields for a downstream step', () => {
        const def = {
            trigger: { id: 'trg', kind: 'manual' },
            steps: [
                { id: 'h1', type: 'http_request', url: 'https://api.example.com', label: 'Call API' },
                { id: 'n1', type: 'notification', title: 'x' },
            ],
            edges: [{ from: 'trg', to: 'h1' }, { from: 'h1', to: 'n1' }],
        };
        const groups = computeUpstreamGroups(def, 'n1', {});
        const httpGroup = groups.find(g => g.id === 'h1');
        expect(httpGroup).toBeTruthy();
        expect(httpGroup.basePath).toBe('steps.h1.output');
        const fieldKeys = httpGroup.fields.map(f => f.key);
        expect(fieldKeys).toContain('status');
        expect(fieldKeys).toContain('ok');
        expect(fieldKeys).toContain('body');
    });
});
