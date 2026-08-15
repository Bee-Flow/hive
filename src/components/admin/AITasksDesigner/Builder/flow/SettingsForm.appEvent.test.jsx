import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import SettingsForm from './SettingsForm';
import { VariablePickerProvider } from '../mapping/VariablePickerContext';
import { extractFormState, buildPatch } from './settings/formState';
import scopedStorage from '../../../../../utils/scopedStorage';

const noIssues = { errors: [], warnings: [] };

const gmailDef = {
    id: 'gmail', label: 'Gmail', defaultEvent: 'mail.new',
    events: [
        { id: 'mail.new', label: 'New email', deliverability: 'ok' },
        { id: 'label.added', label: 'Label added', deliverability: 'ok' },
    ],
};
const nextcloudDef = {
    id: 'nextcloud', label: 'Nextcloud', defaultEvent: 'file.new',
    events: [
        { id: 'file.new', label: 'New file', deliverability: 'ok' },
        {
            id: 'deck.card.created', label: 'Deck card created', deliverability: 'connector',
            deliverabilityNote: 'Requires the Bee Flow connector for Nextcloud — pending validation. This event will not fire yet.',
        },
        // Same gate, no explanation supplied — the UI must still say something.
        { id: 'deck.card.moved', label: 'Deck card moved', deliverability: 'connector' },
    ],
};
const supportDef = {
    id: 'support', label: 'Support Inbox', defaultEvent: 'ticket.resolved',
    events: [
        { id: 'ticket.resolved', label: 'Ticket resolved', deliverability: 'ok' },
    ],
};
const CATALOG = { triggers: [{ kind: 'app_event', providers: [gmailDef, nextcloudDef, supportDef] }] };

function renderForm(step, { onPatch = vi.fn(), catalog = CATALOG } = {}) {
    const utils = render(
        <VariablePickerProvider groups={[]} previewSample={null} stepLabelById={new Map()}>
            <SettingsForm step={step} modelTiers={{}} stepIssues={noIssues} saving={false} saveError={null} onPatch={onPatch} catalog={catalog} groups={[]} />
        </VariablePickerProvider>,
    );
    return { onPatch, ...utils };
}

// The app is chosen through the same picker overlay the agent editor uses, so
// it is a button + dialog rather than a <select>. The event stays a select.
// Combobox order: [0] trigger kind, [1] event.
const appButton = () => screen.getByLabelText('Choose the app to trigger on');
const eventSelect = () => screen.getAllByRole('combobox')[1];
const openPicker = () => fireEvent.click(appButton());
/** Names of the apps the picker offers, in order. */
const pickerApps = () => screen.getAllByRole('option', { hidden: false })
    .filter(o => o.closest('[role="listbox"][aria-label="Apps"]'))
    .map(o => o.textContent.trim());
/** Click the app in the list, then confirm it — what a user actually does. */
const chooseApp = (label) => {
    const row = screen.getAllByRole('option').find(o => o.textContent.trim() === label);
    fireEvent.click(row);
    fireEvent.click(screen.getByRole('button', { name: `Use ${label}` }));
};

const trigger = (appEvent) => ({ id: 'trg', type: 'trigger', kind: 'app_event', ...(appEvent !== undefined ? { appEvent } : {}) });

describe('SettingsForm — app_event (dynamic availability-gated providers)', () => {
    beforeEach(() => {
        cleanup();
        scopedStorage.setCurrentUser('app-event-test-user');
        try { localStorage.clear(); } catch {}
    });

    it('lists exactly the catalog providers — no hardcoded extras', () => {
        renderForm(trigger({ provider: 'gmail', event: 'mail.new', filter: null }));
        openPicker();
        expect(pickerApps()).toEqual(['Gmail', 'Nextcloud', 'Support Inbox']);
    });

    it('the picker shows what an app can trigger on before you commit to it', () => {
        renderForm(trigger({ provider: 'gmail', event: 'mail.new', filter: null }));
        openPicker();
        fireEvent.click(screen.getAllByRole('option').find(o => o.textContent.includes('Nextcloud')));
        expect(screen.getByText('New file')).toBeTruthy();
        expect(screen.getByText('Deck card created')).toBeTruthy();
        // A connector-gated event is flagged in the list, not silently offered.
        expect(screen.getAllByText('needs connector').length).toBe(2);
    });

    it('the picker can be searched by app name', () => {
        renderForm(trigger({ provider: 'gmail', event: 'mail.new', filter: null }));
        openPicker();
        fireEvent.change(screen.getByLabelText('Search apps'), { target: { value: 'next' } });
        expect(pickerApps()).toEqual(['Nextcloud']);
    });

    it('switching provider snaps the event to its defaultEvent and clears the filter (via buildPatch)', () => {
        const step = trigger({ provider: 'gmail', event: 'label.added', filter: { labelId: 'Label_3' } });
        const { onPatch } = renderForm(step);
        openPicker();
        chooseApp('Nextcloud');
        expect(eventSelect().value).toBe('file.new');
        fireEvent.click(screen.getByText('Save'));
        expect(onPatch).toHaveBeenCalledTimes(1);
        expect(onPatch.mock.calls[0][0].appEvent).toEqual({ provider: 'nextcloud', event: 'file.new', filter: null });
    });

    it('a configured-but-unlisted provider renders "(not available)" + warning and is never mutated', () => {
        const step = trigger({ provider: 'github', event: 'push', filter: null });
        renderForm(step);
        expect(appButton().textContent).toContain('GitHub (not available)');
        expect(screen.getByText(/This app isn't available to you right now/)).toBeTruthy();
        // No edits → buildPatch emits no appEvent key, so the stored value is untouched.
        const patch = buildPatch(step, extractFormState(step));
        expect('appEvent' in patch).toBe(false);
    });

    it('an unknown event on a known provider renders the "(unknown event)" option', () => {
        renderForm(trigger({ provider: 'gmail', event: 'weird.event', filter: null }));
        expect(eventSelect().value).toBe('weird.event');
        expect(screen.getByRole('option', { name: 'weird.event (unknown event)' })).toBeTruthy();
    });

    it('a connector-deliverability event shows the connector hint; an ok event does not', () => {
        // The wording travels with the event now, so it names the right app —
        // it used to say "Nextcloud" whichever provider was selected.
        renderForm(trigger({ provider: 'nextcloud', event: 'deck.card.created', filter: null }));
        expect(screen.getByText(/Requires the Bee Flow connector for Nextcloud/)).toBeTruthy();

        cleanup();
        renderForm(trigger({ provider: 'nextcloud', event: 'file.new', filter: null }));
        expect(screen.queryByText(/Requires the Bee Flow connector/)).toBeNull();
    });

    it('a connector event with no supplied wording still explains itself', () => {
        renderForm(trigger({ provider: 'nextcloud', event: 'deck.card.moved', filter: null }));
        expect(screen.getByText(/needs an extra connector that isn’t available yet/)).toBeTruthy();
    });

    it('catalog=null keeps the configured provider selected (never blanked)', () => {
        renderForm(trigger({ provider: 'gmail', event: 'mail.new', filter: null }), { catalog: null });
        expect(appButton().textContent).toContain('Gmail (not available)');
    });

    it('normalizes a legacy string[] providers payload from a stale backend', () => {
        const catalog = { triggers: [{ kind: 'app_event', providers: ['gmail', 'nextcloud'] }] };
        renderForm(trigger({ provider: 'gmail', event: 'mail.new', filter: null }), { catalog });
        expect(appButton().textContent).toContain('gmail');
        openPicker();
        expect(pickerApps()).toEqual(['gmail', 'nextcloud']);
        fireEvent.click(screen.getByLabelText('Close'));
        // String defs carry no events — the configured one survives as unknown.
        expect(screen.getByRole('option', { name: 'mail.new (unknown event)' })).toBeTruthy();
    });

    it('a fresh trigger auto-selects the first available provider once', () => {
        renderForm(trigger());
        expect(appButton().textContent).toContain('Gmail');
        expect(eventSelect().value).toBe('mail.new');
    });

    it('renders an empty state when no providers are available and nothing is configured', () => {
        renderForm(trigger(), { catalog: { triggers: [{ kind: 'app_event', providers: [] }] } });
        expect(screen.getByText(/No event sources are available to you yet/)).toBeTruthy();
        expect(screen.getAllByRole('combobox')).toHaveLength(1); // only the trigger-kind select
    });

    it('maps gmail.mail.new to the Gmail filter form and leaves unmapped combos without one', () => {
        renderForm(trigger({ provider: 'gmail', event: 'mail.new', filter: null }));
        expect(screen.getByText(/Gmail filter \(all optional, AND across keys\)/)).toBeTruthy();

        cleanup();
        renderForm(trigger({ provider: 'nextcloud', event: 'deck.card.created', filter: null }));
        expect(screen.queryByText(/filter/i)).toBeNull();
    });

    it('support.ticket.resolved renders the support filter; unchecking genuine contact stores false', () => {
        const { onPatch } = renderForm(trigger({ provider: 'support', event: 'ticket.resolved', filter: null }));
        expect(screen.getByText(/Support Inbox ticket.resolved filter/)).toBeTruthy();
        const genuine = screen.getByRole('checkbox');
        expect(genuine.checked).toBe(true); // default on
        fireEvent.click(genuine);
        fireEvent.click(screen.getByText('Save'));
        expect(onPatch).toHaveBeenCalledTimes(1);
        expect(onPatch.mock.calls[0][0].appEvent.filter).toEqual({ requireGenuineContact: false });
    });
});
