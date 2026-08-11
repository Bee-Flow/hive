import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { editorWithValue, typeInEditor } from '../../../../../test/refEditor';
import SettingsForm from './SettingsForm';
import { VariablePickerProvider } from '../mapping/VariablePickerContext';
import scopedStorage from '../../../../../utils/scopedStorage';
import { authFetch } from '../../../../../utils/helpers';

vi.mock('../../../../../utils/helpers', async (orig) => ({
    ...(await orig()),
    API_BASE: '',
    authFetch: vi.fn(),
}));

/**
 * The guard step's editor. Its one hard rule: a step may hold itself to a
 * HIGHER standard than the organisation's Privacy Shield, never a lower one —
 * so everything here narrows, and what is inherited says so.
 */

const noIssues = { errors: [], warnings: [] };

function renderForm(step, { onPatch = vi.fn(), groups = [] } = {}) {
    const utils = render(
        <VariablePickerProvider groups={groups} previewSample={null} stepLabelById={new Map()}>
            <SettingsForm step={step} modelTiers={{}} stepIssues={noIssues} saving={false} saveError={null} onPatch={onPatch} catalog={null} groups={groups} />
        </VariablePickerProvider>,
    );
    return { onPatch, ...utils };
}

const guardStep = (over = {}) => ({ id: 'g1', type: 'guard', sourceRef: 'steps.read.output.text', label: 'Check for personal data', ...over });

beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    // The REAL contract of /api/guard/health (server/index.js): a `status`
    // string, never an `installed` flag. Inventing a shape here is what let the
    // panel ship claiming the detector was missing on a perfectly healthy box.
    authFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ status: 'ok' }) });
    scopedStorage.setCurrentUser('guard-test-user');
    try { localStorage.clear(); } catch {}
});

describe('SettingsForm — guard', () => {
    it('asks what to scan and says where the two branches go', () => {
        renderForm(guardStep());
        expect(editorWithValue(document.body, 'steps.read.output.text')).toBeTruthy();
        // The branches ARE the step — leaving the author to discover them from
        // the ports is how a guard ends up wired to nothing.
        const branchLine = screen.getByText(/wire an alert to the first/i);
        expect(branchLine.textContent).toMatch(/personal data/);
        expect(branchLine.textContent).toMatch(/clean/);
    });

    it('saves what to scan', async () => {
        const { onPatch } = renderForm(guardStep({ sourceRef: '' }));
        typeInEditor(screen.getAllByRole('textbox').find(el => el.hasAttribute('data-ref-editor')), 'trigger.output.body');
        fireEvent.click(screen.getByText('Save'));
        await waitFor(() => expect(onPatch).toHaveBeenCalled());
        expect(onPatch.mock.calls.at(-1)[0].sourceRef).toBe('trigger.output.body');
    });

    it('an untouched category list stays INHERITED rather than freezing today\'s policy', async () => {
        // Writing the full list into the step would silently stop it following
        // the organisation the next time a category is added.
        const { onPatch } = renderForm(guardStep());
        // Something else has to change for there to BE a save — the point is
        // that saving does not quietly materialise the inherited settings.
        fireEvent.click(screen.getByRole('checkbox', { name: /Stop the run/i }));
        fireEvent.click(screen.getByText('Save'));
        await waitFor(() => expect(onPatch).toHaveBeenCalled());
        expect(onPatch.mock.calls.at(-1)[0].categories).toBeUndefined();
        expect(onPatch.mock.calls.at(-1)[0].confidence).toBeUndefined();
    });

    it('unticking one category narrows the scan to the rest, not to that one', async () => {
        // Nothing selected means "everything the org looks for", so the first
        // click has to start from that whole list — starting from empty would
        // turn one tick into "scan for only this", the opposite of the gesture.
        const { onPatch } = renderForm(guardStep());
        fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));
        // By id, not by label — the label is translated, the id is what
        // reaches the detector.
        await waitFor(() => expect(document.querySelector('[data-pii-category="Email"]')).toBeTruthy());
        fireEvent.click(document.querySelector('[data-pii-category="Email"]'));
        fireEvent.click(screen.getByText('Save'));
        await waitFor(() => expect(onPatch).toHaveBeenCalled());
        const { categories } = onPatch.mock.calls.at(-1)[0];
        expect(categories.length).toBeGreaterThan(1);
        expect(categories).not.toContain('Email');
        expect(categories).toContain('Person');
    });

    it('records the two on-found actions', async () => {
        const { onPatch } = renderForm(guardStep());
        fireEvent.click(screen.getByLabelText(/Stop the run/i, { selector: 'input' }).closest('input') || screen.getByRole('checkbox', { name: /Stop the run/i }));
        fireEvent.click(screen.getByText('Save'));
        await waitFor(() => expect(onPatch).toHaveBeenCalled());
        expect(onPatch.mock.calls.at(-1)[0].onFound).toEqual({ stop: true });
    });

    it('stays quiet when the detector is healthy', async () => {
        renderForm(guardStep());
        await waitFor(() => expect(authFetch).toHaveBeenCalled());
        expect(screen.queryByText(/cannot scan right now/i)).toBeNull();
    });

    it.each([
        ['not-configured', /is not installed/i],
        ['unavailable', /not responding/i],
        ['degraded', /model has not loaded/i],
    ])('says what is wrong when health reports %s', async (status, wording) => {
        // A guard node that looks configured but cannot scan is worse than no
        // node — and the three failures are genuinely different problems.
        authFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ status }) });
        renderForm(guardStep());
        const line = await screen.findByText(/cannot scan right now/i);
        expect(line.textContent).toMatch(wording);
        // It must never be described as reporting "clean".
        expect(line.textContent).toMatch(/never report/i);
    });

    it('the tokenize step shares the editor but not the guard outcomes', async () => {
        // Same detector, same category list, same tighten-never-loosen rule —
        // only what happens to a finding differs, so there is one editor.
        renderForm({ ...guardStep(), type: 'tokenize', label: 'Hide personal data' });
        expect(screen.getByText(/What to hide it in/)).toBeTruthy();
        // A tokenize step has ONE outcome: no branches, no stop/mask choice.
        expect(screen.queryByText(/wire an alert to the first/i)).toBeNull();
        expect(screen.queryByRole('checkbox', { name: /Stop the run/i })).toBeNull();
        // And it says where the values go, and that they come back by themselves —
        // a reader expecting a restore node would otherwise go looking for one.
        const line = screen.getByText(/output\.text/).closest('p');
        expect(line.textContent).toMatch(/automatically/);
        // …and where automatic does NOT reach, it names the step that does.
        expect(line.textContent).toMatch(/Show real values again/);
    });

    it('the restore step asks one thing and does not pretend to scan', async () => {
        // It looks placeholders up in the run's own vault, so it has no
        // categories and no threshold — offering them would imply a detector
        // runs here.
        renderForm({ id: 'u1', type: 'untokenize', sourceRef: 'steps.ai.output.text', label: 'Show real values again' });
        expect(screen.getByText(/What to restore/)).toBeTruthy();
        expect(editorWithValue(document.body, 'steps.ai.output.text')).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Advanced' })).toBeNull();
        expect(screen.queryByText(/Only report matches above/)).toBeNull();
    });

    it('a tokenize step never saves the guard-only onFound block', async () => {
        const { onPatch } = renderForm({ ...guardStep(), type: 'tokenize' });
        fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));
        await waitFor(() => expect(document.querySelector('[data-pii-category="Email"]')).toBeTruthy());
        fireEvent.click(document.querySelector('[data-pii-category="Email"]'));
        fireEvent.click(screen.getByText('Save'));
        await waitFor(() => expect(onPatch).toHaveBeenCalled());
        expect(onPatch.mock.calls.at(-1)[0]).not.toHaveProperty('onFound');
    });

    it('stays quiet when the availability probe itself fails', async () => {
        authFetch.mockRejectedValue(new Error('offline'));
        renderForm(guardStep());
        await waitFor(() => expect(authFetch).toHaveBeenCalled());
        expect(screen.queryByText(/cannot scan right now/i)).toBeNull();
    });
});
