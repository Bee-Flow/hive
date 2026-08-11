import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import SettingsForm from './SettingsForm';
import { VariablePickerProvider } from '../mapping/VariablePickerContext';
import { editor, typeInEditor } from '../../../../../test/refEditor';
import scopedStorage from '../../../../../utils/scopedStorage';

/**
 * The notification step's delivery target. `channels` was honoured by the
 * runner from the start (in-app bell and email, both real) but the form never
 * rendered it, so the step could say WHAT to send and never WHERE — and email
 * was reachable only by hand-editing the JSON (BFSF-350).
 */

const noIssues = { errors: [], warnings: [] };

function renderForm(step) {
    const onPatch = vi.fn();
    const utils = render(
        <VariablePickerProvider groups={[]} previewSample={null} stepLabelById={new Map()}>
            <SettingsForm step={step} modelTiers={{}} stepIssues={noIssues} saving={false} saveError={null} onPatch={onPatch} catalog={null} groups={[]} />
        </VariablePickerProvider>,
    );
    return { onPatch, ...utils };
}

const notifyStep = (over = {}) => ({ id: 'n1', type: 'notification', title: 'Invoice in', body: '', ...over });
const pill = (name) => screen.getByRole('button', { name: new RegExp(name, 'i') });

beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    scopedStorage.setCurrentUser('notification-test-user');
    try { localStorage.clear(); } catch {}
});

describe('SettingsForm — notification channels', () => {
    it('says where the message goes, and that the bell is the Bee Flow one', () => {
        renderForm(notifyStep());
        expect(screen.getByText('Send to')).toBeTruthy();
        // In the open, not behind a hint icon — "where does this even go?" was
        // the whole of the report.
        expect(screen.getByText(/notification centre/i)).toBeTruthy();
        expect(screen.getByText(/email goes to the person/i)).toBeTruthy();
    });

    it('shows the bell lit for a step that never set a channel', () => {
        renderForm(notifyStep());
        expect(pill('In-app bell').getAttribute('aria-pressed')).toBe('true');
        expect(pill('Email').getAttribute('aria-pressed')).toBe('false');
    });

    it("lights the bell for a step using the runner's own name for it", () => {
        // The step vocabulary calls the bell `notification`; the run-level
        // policy calls the same thing `inapp`. Either must read as "the bell".
        renderForm(notifyStep({ channels: ['notification'] }));
        expect(pill('In-app bell').getAttribute('aria-pressed')).toBe('true');
    });

    it('adds email to the step when the pill is pressed', async () => {
        const { onPatch } = renderForm(notifyStep());
        fireEvent.click(pill('Email'));
        await waitFor(() => expect(onPatch).toHaveBeenCalled());
        const patch = onPatch.mock.calls.at(-1)[0];
        expect(patch.channels).toContain('email');
        expect(patch.channels).toContain('inapp');
    });

    it('takes email away again, and never the bell', async () => {
        const { onPatch } = renderForm(notifyStep({ channels: ['inapp', 'email'] }));
        expect(pill('Email').getAttribute('aria-pressed')).toBe('true');
        fireEvent.click(pill('Email'));
        await waitFor(() => expect(onPatch).toHaveBeenCalled());
        expect(onPatch.mock.calls.at(-1)[0].channels).toEqual(['inapp']);

        // The runner rejects a notification with no known channel, so the bell
        // is not something the form lets you switch off.
        expect(pill('In-app bell').disabled).toBe(true);
    });

    it('offers the channels with no backend as visibly unavailable', () => {
        renderForm(notifyStep());
        for (const name of ['Slack', 'Push']) {
            const p = pill(name);
            expect(p.disabled).toBe(true);
            expect(p.textContent).toMatch(/soon/i);
        }
    });

    it('leaves an untouched step alone rather than stamping a default in', async () => {
        // Editing something ELSE must not write a `channels` key the step never
        // had — every notification step the user merely opened would go dirty.
        const { onPatch, container } = renderForm(notifyStep());
        typeInEditor(editor({ container }), 'Changed');
        await waitFor(() => expect(onPatch).toHaveBeenCalled());
        expect(onPatch.mock.calls.at(-1)[0]).not.toHaveProperty('channels');
    });
});
