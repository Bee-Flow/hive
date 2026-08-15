/**
 * CoworkPage — the two halves that used to be separate screens, now one.
 *
 * Left: a brief becomes a cowork item with no extra form-filling, and the
 * schedule chips change what gets posted. Right: the selected item's detail,
 * its editor, and a row per run — the part the sidebar's page never had.
 */
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CoworkPage from './CoworkPage';

const api = vi.hoisted(() => ({
    listCowork: vi.fn(),
    createCowork: vi.fn(),
    updateCowork: vi.fn(),
    toggleCowork: vi.fn(),
    runCoworkNow: vi.fn(),
    deleteCowork: vi.fn(),
    composeCowork: vi.fn(),
    listCoworkRuns: vi.fn(),
    listCoworkAgents: vi.fn(),
}));

vi.mock('./coworkApi', () => api);
// The agent picker is beta-gated; default the tests to "no beta".
vi.mock('../EntitlementsContext', () => ({
    useEntitlements: () => ({ loading: false, can: () => false }),
}));
// The composer's Apps picker and tier picker fetch on mount. Give them a
// connected Google account and two tiers so both controls have something to
// show — the point of these tests is that the page renders them at all.
vi.mock('../../hooks/useIntegrationStatus', () => ({
    useIntegrationStatus: () => ({
        integrationStatus: { isGoogleUser: true, enabledApps: null, orgEnabledIntegrations: null },
    }),
}));
vi.mock('../../hooks/useModelTierSelection', () => ({
    default: () => ({
        modelTiers: { auto: { model: 'gpt-4o' }, thinking: { model: 'gpt-5' } },
        selectedTier: 'thinking',
        setSelectedTier: vi.fn(),
    }),
}));

const ITEM = {
    id: 'w1',
    title: 'Weekly digest',
    prompt: 'Summarise the week',
    isActive: true,
    lastStatus: 'success',
    nextRunAt: new Date(Date.now() + 86400_000).toISOString(),
    lastRunAt: new Date().toISOString(),
    lastResult: '# Digest\nAll good.',
    repeatInterval: 'weekly',
    runCount: 3,
};

const RUN = {
    id: 'r1',
    status: 'success',
    triggerKind: 'manual',
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    durationMs: 5200,
    result: 'All good.',
    error: null,
};

function seed(items = []) {
    api.listCowork.mockResolvedValue({ items, maxItems: 10 });
}

beforeEach(() => {
    vi.clearAllMocks();
    seed();
    api.createCowork.mockResolvedValue({ id: 'new', title: 'Send the digest' });
    api.listCoworkAgents.mockResolvedValue([]);
    api.listCoworkRuns.mockResolvedValue({ runs: [], total: 0 });
    // The composer asks the server to read the brief; these tests are about
    // what the UI does with the user's own chips, so let it degrade.
    api.composeCowork.mockRejectedValue(new Error('offline'));
});

describe('CoworkPage — creating', () => {
    it('keeps the box free of chrome that repeats what the chips already say', async () => {
        // "Now · results land in your notifications" restated the When chip and
        // the Run button, and "4/10 in use" was a number nobody acts on until
        // it is 10/10 — which the page raises as a warning of its own.
        seed([ITEM]);
        render(<CoworkPage />);
        await screen.findByTestId('cowork-brief-input');

        const box = screen.getByTestId('cowork-composer');
        expect(box).not.toHaveTextContent(/results land in your notifications/);
        expect(box).not.toHaveTextContent(/in use/);
        expect(screen.queryByText(/Build an automation in Studio/)).not.toBeInTheDocument();
    });

    it('still warns once every slot is taken', async () => {
        // The quota did not become invisible — it became a warning instead of
        // a permanent counter.
        api.listCowork.mockResolvedValue({ items: [ITEM], maxItems: 1 });
        render(<CoworkPage />);
        expect(await screen.findByText(/used all 1 cowork slots/)).toBeInTheDocument();
    });

    it('creates from the brief alone — no separate title or date fields', async () => {
        render(<CoworkPage />);
        await screen.findByTestId('cowork-brief-input');

        fireEvent.change(screen.getByTestId('cowork-brief-input'), {
            target: { value: 'Send the digest\nwith source links' },
        });
        fireEvent.click(screen.getByTestId('cowork-send'));

        await waitFor(() => expect(api.createCowork).toHaveBeenCalledTimes(1));
        const payload = api.createCowork.mock.calls[0][0];
        expect(payload.title).toBe('Send the digest');
        expect(payload.prompt).toBe('Send the digest\nwith source links');
        // Default is "now", which asks the server to fire it immediately.
        expect(payload.startNow).toBe(true);
        expect(payload.repeatInterval).toBeNull();
    });

    it('will not send an empty brief', async () => {
        render(<CoworkPage />);
        await screen.findByTestId('cowork-brief-input');
        expect(screen.getByTestId('cowork-send')).toBeDisabled();
    });

    it('carries the picked cadence into the payload and relabels the button', async () => {
        render(<CoworkPage />);
        await screen.findByTestId('cowork-brief-input');

        fireEvent.change(screen.getByTestId('cowork-brief-input'), { target: { value: 'Weekly digest' } });
        fireEvent.click(screen.getByTestId('cowork-repeat-chip'));
        fireEvent.click(screen.getByText('Every week'));
        fireEvent.click(screen.getByTestId('cowork-when-chip'));
        fireEvent.click(screen.getByText('Tomorrow morning'));

        expect(screen.getByTestId('cowork-send')).toHaveTextContent('Schedule');

        fireEvent.click(screen.getByTestId('cowork-send'));
        await waitFor(() => expect(api.createCowork).toHaveBeenCalled());
        const payload = api.createCowork.mock.calls[0][0];
        expect(payload.repeatInterval).toBe('weekly');
        expect(payload.startNow).toBeUndefined();
        expect(new Date(payload.nextRunAt).getHours()).toBe(9);
    });

    it('blocks send until a custom moment is fully picked', async () => {
        render(<CoworkPage />);
        await screen.findByTestId('cowork-brief-input');
        fireEvent.change(screen.getByTestId('cowork-brief-input'), { target: { value: 'Do the thing' } });

        fireEvent.click(screen.getByTestId('cowork-when-chip'));
        fireEvent.click(screen.getByText('Pick a moment…'));
        // The sheet seeds both inputs, so the button stays live…
        expect(screen.getByTestId('cowork-send')).not.toBeDisabled();
        // …and blanking one takes it away again.
        fireEvent.change(screen.getByTestId('cowork-when-time'), { target: { value: '' } });
        expect(screen.getByTestId('cowork-send')).toBeDisabled();
    });

    it('surfaces a create failure and keeps the brief in the box', async () => {
        api.createCowork.mockRejectedValue(new Error('Maximum number of cowork items reached (10).'));
        render(<CoworkPage />);
        await screen.findByTestId('cowork-brief-input');

        fireEvent.change(screen.getByTestId('cowork-brief-input'), { target: { value: 'Do the thing' } });
        fireEvent.click(screen.getByTestId('cowork-send'));

        expect(await screen.findByText(/Maximum number of cowork items reached/)).toBeInTheDocument();
        expect(screen.getByTestId('cowork-brief-input')).toHaveValue('Do the thing');
    });

    it('offers the same controls as the chat composer — Apps and a model tier', async () => {
        // The page used to be a stripped-down copy of the chat box: no Apps
        // picker, no tier picker. Both render the shared CoworkComposer now.
        render(<CoworkPage />);
        await screen.findByTestId('cowork-brief-input');
        expect(screen.getByTestId('apps-picker-button')).toBeInTheDocument();
        expect(screen.getByTitle('Apps')).toBeInTheDocument();
    });

    it('sends the chosen model tier instead of silently scheduling on auto', async () => {
        render(<CoworkPage />);
        await screen.findByTestId('cowork-brief-input');

        fireEvent.change(screen.getByTestId('cowork-brief-input'), { target: { value: 'Send the digest' } });
        fireEvent.click(screen.getByTestId('cowork-send'));

        await waitFor(() => expect(api.createCowork).toHaveBeenCalled());
        expect(api.createCowork.mock.calls[0][0].modelTier).toBe('thinking');
    });

    it('starts the brief for you when an app is picked', async () => {
        render(<CoworkPage />);
        await screen.findByTestId('cowork-brief-input');

        fireEvent.click(screen.getByTestId('apps-picker-button'));
        const calendar = screen.getAllByTestId('apps-picker-item')
            .find(el => el.dataset.appId === 'google-calendar');
        fireEvent.click(calendar);

        expect(screen.getByTestId('cowork-brief-input').value).toMatch(/calendar/i);
    });

    it('selects what it just created, so its history is already on screen', async () => {
        render(<CoworkPage />);
        await screen.findByTestId('cowork-brief-input');
        // The refresh after create is what puts the new row in the list.
        api.listCowork.mockResolvedValue({ items: [{ ...ITEM, id: 'new' }], maxItems: 10 });

        fireEvent.change(screen.getByTestId('cowork-brief-input'), { target: { value: 'Send the digest' } });
        fireEvent.click(screen.getByTestId('cowork-send'));

        expect(await screen.findByTestId('cowork-detail')).toBeInTheDocument();
    });
});

describe('CoworkPage — the list', () => {
    it('keeps a just-started one-off at the top instead of filing it under done', async () => {
        // What POST /api/cowork + startNow leaves behind: deactivated so the
        // scheduler can't double-fire it, but still very much in flight.
        seed([{ ...ITEM, isActive: false, lastStatus: 'pending', lastRunAt: null, lastResult: null, runCount: 0 }]);
        render(<CoworkPage />);
        await screen.findByText('Weekly digest');

        expect(screen.queryByText('Done & paused')).not.toBeInTheDocument();
        expect(screen.getByText('Running & scheduled')).toBeInTheDocument();
    });

    it('files a finished one-off under done', async () => {
        seed([{ ...ITEM, isActive: false, repeatInterval: null, runCount: 1 }]);
        render(<CoworkPage />);
        await screen.findByText('Weekly digest');
        expect(screen.getByText('Done & paused')).toBeInTheDocument();
    });

    it('puts the composer under the hero, not in the narrow list column', async () => {
        // In the 320px column the chips wrapped onto three rows and the brief
        // was two words per line. It belongs in the wide pane, directly under
        // the promise it answers.
        seed([ITEM]);
        render(<CoworkPage />);
        const welcome = await screen.findByTestId('cowork-welcome');
        const pane = welcome.closest('div').parentElement;
        expect(pane).toContainElement(screen.getByTestId('cowork-brief-input'));
        expect(screen.getByTestId('cowork-row').closest('aside'))
            .not.toContainElement(screen.getByTestId('cowork-brief-input'));
    });

    it('brings the composer back when the user asks for a new one', async () => {
        seed([ITEM]);
        render(<CoworkPage initialCoworkId="w1" />);
        await screen.findByTestId('cowork-detail');
        expect(screen.queryByTestId('cowork-brief-input')).not.toBeInTheDocument();

        fireEvent.click(screen.getByTestId('cowork-new'));
        expect(screen.getByTestId('cowork-brief-input')).toBeInTheDocument();
        expect(screen.queryByTestId('cowork-detail')).not.toBeInTheDocument();
    });

    it('says where cowork comes from when there is none', async () => {
        render(<CoworkPage />);
        expect(await screen.findByTestId('cowork-empty')).toHaveTextContent(/switch a chat to\s+Cowork/i);
    });

    it('drops the When popover below the chip when there is no room above it', async () => {
        // The composer sits at the top of the column, where the default upward
        // placement runs the panel off the viewport. Real bug, caught in the
        // browser: the sheet's title was clipped above the fold.
        const rect = vi.spyOn(Element.prototype, 'getBoundingClientRect');
        try {
            rect.mockReturnValue({ top: -120, bottom: 0, left: 0, right: 0, width: 280, height: 400, x: 0, y: -120, toJSON: () => ({}) });
            render(<CoworkPage />);
            await screen.findByTestId('cowork-when-chip');
            fireEvent.click(screen.getByTestId('cowork-when-chip'));

            const panel = screen.getByRole('dialog', { name: 'When should this run?' });
            expect(panel.className).toContain('top-full');
            expect(panel.className).not.toContain('bottom-full');
        } finally {
            rect.mockRestore();
        }
    });
});

describe('CoworkPage — detail, history and editing', () => {
    it('shows the welcome until something is selected', async () => {
        seed([ITEM]);
        render(<CoworkPage />);
        await screen.findByText('Weekly digest');
        expect(screen.getByTestId('cowork-welcome')).toBeInTheDocument();
        expect(screen.queryByTestId('cowork-detail')).not.toBeInTheDocument();
    });

    it('opens the detail and its run history on select', async () => {
        seed([ITEM]);
        api.listCoworkRuns.mockResolvedValue({ runs: [RUN], total: 1 });
        render(<CoworkPage />);
        fireEvent.click(await screen.findByTestId('cowork-row'));

        expect(await screen.findByTestId('cowork-detail')).toBeInTheDocument();
        await waitFor(() => expect(api.listCoworkRuns).toHaveBeenCalledWith('w1'));
        const run = await screen.findByTestId('cowork-run');
        expect(run).toHaveTextContent('run by you');
        expect(run).toHaveTextContent('5.2s');
    });

    it('renders a run result as Markdown, not as raw asterisks', async () => {
        // Results are model output, so they arrive as Markdown. Printed raw,
        // a digest opened with a line of "**Quick reminders:**" and pipes.
        seed([ITEM]);
        api.listCoworkRuns.mockResolvedValue({
            runs: [{ ...RUN, result: '## Today\n\n- **Drink water**\n- Pick one thing' }],
            total: 1,
        });
        render(<CoworkPage />);
        fireEvent.click(await screen.findByTestId('cowork-row'));
        const run = await screen.findByTestId('cowork-run');
        fireEvent.click(within(run).getByRole('button', { expanded: false }));

        expect(within(run).getByRole('heading', { name: 'Today' })).toBeInTheDocument();
        expect(within(run).getAllByRole('listitem')).toHaveLength(2);
        expect(within(run).getByText('Drink water').tagName).toBe('STRONG');
        expect(run.textContent).not.toContain('**');
    });

    it('leaves a failure as plain text — a stack line is not Markdown', async () => {
        seed([ITEM]);
        api.listCoworkRuns.mockResolvedValue({
            runs: [{ ...RUN, status: 'failed', result: null, error: 'Rate limited (429): retry in 60s *now*' }],
            total: 1,
        });
        render(<CoworkPage />);
        fireEvent.click(await screen.findByTestId('cowork-row'));
        const run = await screen.findByTestId('cowork-run');
        fireEvent.click(within(run).getByRole('button', { expanded: false }));

        expect(run).toHaveTextContent('Rate limited (429): retry in 60s *now*');
    });

    it('says so plainly when a schedule has never run', async () => {
        seed([ITEM]);
        render(<CoworkPage />);
        fireEvent.click(await screen.findByTestId('cowork-row'));
        expect(await screen.findByTestId('cowork-no-runs')).toBeInTheDocument();
    });

    it('opens on the deep-linked item without a click', async () => {
        seed([ITEM]);
        render(<CoworkPage initialCoworkId="w1" />);
        expect(await screen.findByTestId('cowork-detail')).toHaveTextContent('Weekly digest');
    });

    it('runs, pauses and reloads the history', async () => {
        seed([ITEM]);
        api.runCoworkNow.mockResolvedValue({ success: true });
        api.toggleCowork.mockResolvedValue({ success: true, isActive: false });
        render(<CoworkPage initialCoworkId="w1" />);
        await screen.findByTestId('cowork-detail');

        fireEvent.click(screen.getByTestId('cowork-run-now'));
        await waitFor(() => expect(api.runCoworkNow).toHaveBeenCalledWith('w1'));
        // A run changes the history, so it must be refetched, not left stale.
        await waitFor(() => expect(api.listCoworkRuns.mock.calls.length).toBeGreaterThan(1));

        fireEvent.click(screen.getByTestId('cowork-toggle'));
        await waitFor(() => expect(api.toggleCowork).toHaveBeenCalledWith('w1'));
    });

    it('deletes only after the confirm step', async () => {
        seed([ITEM]);
        api.deleteCowork.mockResolvedValue({ success: true });
        render(<CoworkPage initialCoworkId="w1" />);
        await screen.findByTestId('cowork-detail');

        fireEvent.click(screen.getByTestId('cowork-delete'));
        expect(api.deleteCowork).not.toHaveBeenCalled();

        fireEvent.click(screen.getByTestId('cowork-confirm-delete'));
        await waitFor(() => expect(api.deleteCowork).toHaveBeenCalledWith('w1'));
    });

    it('saves an edit and only then leaves the form', async () => {
        seed([ITEM]);
        api.updateCowork.mockResolvedValue({ success: true });
        render(<CoworkPage initialCoworkId="w1" />);
        await screen.findByTestId('cowork-detail');

        fireEvent.click(screen.getByTestId('cowork-edit'));
        fireEvent.change(await screen.findByTestId('cowork-edit-title'), { target: { value: 'Monthly digest' } });
        fireEvent.click(screen.getByTestId('cowork-edit-save'));

        await waitFor(() => expect(api.updateCowork).toHaveBeenCalled());
        const [id, patch] = api.updateCowork.mock.calls[0];
        expect(id).toBe('w1');
        expect(patch.title).toBe('Monthly digest');
        await waitFor(() => expect(screen.queryByTestId('cowork-edit-form')).not.toBeInTheDocument());
    });

    it('keeps a rejected edit on screen instead of discarding it', async () => {
        seed([ITEM]);
        api.updateCowork.mockRejectedValue(new Error('Unknown timezone: Mars/Olympus'));
        render(<CoworkPage initialCoworkId="w1" />);
        await screen.findByTestId('cowork-detail');

        fireEvent.click(screen.getByTestId('cowork-edit'));
        fireEvent.change(await screen.findByTestId('cowork-edit-title'), { target: { value: 'Monthly digest' } });
        fireEvent.click(screen.getByTestId('cowork-edit-save'));

        expect(await screen.findByText(/Unknown timezone/)).toBeInTheDocument();
        expect(screen.getByTestId('cowork-edit-title')).toHaveValue('Monthly digest');
    });

    it('round-trips an hourly repeat instead of silently resetting it to Once', async () => {
        // The repeat <select> only had options down to 'quarterly', so an
        // hourly item — which the API and the AI composer both produce — fell
        // back to the first option and was rewritten to "Once" on save.
        seed([{ ...ITEM, repeatInterval: 'hourly' }]);
        api.updateCowork.mockResolvedValue({ success: true });
        render(<CoworkPage initialCoworkId="w1" />);
        await screen.findByTestId('cowork-detail');

        fireEvent.click(screen.getByTestId('cowork-edit'));
        expect(await screen.findByTestId('cowork-edit-repeat')).toHaveValue('hourly');
        fireEvent.click(screen.getByTestId('cowork-edit-save'));

        await waitFor(() => expect(api.updateCowork).toHaveBeenCalled());
        expect(api.updateCowork.mock.calls[0][1].repeatInterval).toBe('hourly');
    });

    it('sends the wall-clock time along with the moment it was moved to', async () => {
        // timeOfDay feeds the schedule description the runner puts in the
        // prompt. Leaving it behind meant a job moved to 07:00 kept telling
        // the model it runs at 09:00.
        seed([ITEM]);
        api.updateCowork.mockResolvedValue({ success: true });
        render(<CoworkPage initialCoworkId="w1" />);
        await screen.findByTestId('cowork-detail');

        fireEvent.click(screen.getByTestId('cowork-edit'));
        fireEvent.change(await screen.findByTestId('cowork-edit-time'), { target: { value: '07:00' } });
        fireEvent.click(screen.getByTestId('cowork-edit-save'));

        await waitFor(() => expect(api.updateCowork).toHaveBeenCalled());
        const patch = api.updateCowork.mock.calls[0][1];
        expect(patch.timeOfDay).toBe('07:00');
        expect(new Date(patch.nextRunAt).getHours()).toBe(7);
    });

    it('offers the Apps picker while editing, so a run can be scoped before it fires', async () => {
        // Without it you could only change which apps a cowork may touch from
        // the composer — i.e. only while creating a new one.
        seed([ITEM]);
        render(<CoworkPage initialCoworkId="w1" />);
        await screen.findByTestId('cowork-detail');
        fireEvent.click(screen.getByTestId('cowork-edit'));

        await screen.findByTestId('cowork-edit-form');
        expect(screen.getByTestId('apps-picker-button')).toBeInTheDocument();
        expect(screen.getByText(/of \d+ enabled/)).toBeInTheDocument();
    });

    it('gives the item its own app list the moment one is switched off', async () => {
        // A cowork runs unattended hours later, so "what may this one touch"
        // is a per-item question. Until the picker is touched the item has no
        // list and follows the workspace default.
        seed([ITEM]);
        api.updateCowork.mockResolvedValue({ success: true });
        render(<CoworkPage initialCoworkId="w1" />);
        await screen.findByTestId('cowork-detail');
        fireEvent.click(screen.getByTestId('cowork-edit'));
        await screen.findByTestId('cowork-edit-form');

        fireEvent.click(screen.getByTestId('apps-picker-button'));
        fireEvent.click(screen.getByLabelText('Enable Gmail'));
        fireEvent.click(screen.getByTestId('cowork-edit-save'));

        await waitFor(() => expect(api.updateCowork).toHaveBeenCalled());
        const { enabledApps } = api.updateCowork.mock.calls[0][1];
        // The first toggle materialises the inherited set minus the one app —
        // switching Gmail off must not switch everything else off with it.
        expect(Array.isArray(enabledApps)).toBe(true);
        expect(enabledApps).not.toContain('gmail');
        expect(enabledApps).toContain('google-calendar');
    });

    it('leaves the list alone when the picker is never opened', async () => {
        seed([ITEM]);
        api.updateCowork.mockResolvedValue({ success: true });
        render(<CoworkPage initialCoworkId="w1" />);
        await screen.findByTestId('cowork-detail');
        fireEvent.click(screen.getByTestId('cowork-edit'));
        fireEvent.click(await screen.findByTestId('cowork-edit-save'));

        await waitFor(() => expect(api.updateCowork).toHaveBeenCalled());
        // null, not [] — "follow the workspace list", not "may use nothing".
        expect(api.updateCowork.mock.calls[0][1].enabledApps).toBeNull();
    });

    it('can hand an item back to the workspace list', async () => {
        seed([{ ...ITEM, enabledApps: ['gmail'] }]);
        api.updateCowork.mockResolvedValue({ success: true });
        render(<CoworkPage initialCoworkId="w1" />);
        await screen.findByTestId('cowork-detail');
        fireEvent.click(screen.getByTestId('cowork-edit'));

        fireEvent.click(await screen.findByTestId('cowork-apps-reset'));
        fireEvent.click(screen.getByTestId('cowork-edit-save'));

        await waitFor(() => expect(api.updateCowork).toHaveBeenCalled());
        expect(api.updateCowork.mock.calls[0][1].enabledApps).toBeNull();
    });

    it('abandons an open edit when the user switches to another item', async () => {
        // Carrying the form over would save one item's text onto another.
        seed([ITEM, { ...ITEM, id: 'w2', title: 'Daily standup' }]);
        render(<CoworkPage initialCoworkId="w1" />);
        await screen.findByTestId('cowork-detail');
        fireEvent.click(screen.getByTestId('cowork-edit'));
        await screen.findByTestId('cowork-edit-form');

        const rows = screen.getAllByTestId('cowork-row');
        fireEvent.click(rows.find(r => within(r).queryByText('Daily standup')));

        expect(screen.queryByTestId('cowork-edit-form')).not.toBeInTheDocument();
        expect(screen.getByTestId('cowork-detail')).toHaveTextContent('Daily standup');
    });
});
