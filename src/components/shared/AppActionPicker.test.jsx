import { fireEvent, render, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import AppActionPicker from './AppActionPicker';

/**
 * The one app menu, shared by the agent editor's tool picker and App Studio's
 * connector picker. These tests cover the shell itself — the behaviours both
 * surfaces inherit, so a change here can't silently regress one of them.
 */

const APPS = [
    {
        id: 'gmail', label: 'Gmail', available: true,
        actions: [
            { name: 'gmail_search', label: 'Search', description: 'Find messages', producesList: true },
            { name: 'gmail_send', label: 'Send email', description: 'Send a message', sideEffect: true },
        ],
    },
    {
        id: 'slack', label: 'Slack', available: false,
        actions: [{ name: 'slack_post', label: 'Post message' }],
    },
];

function renderPicker(props = {}) {
    const onToggle = vi.fn();
    const onToggleApp = vi.fn();
    const onClose = vi.fn();
    const utils = render(
        <AppActionPicker apps={APPS} selected={[]} onToggle={onToggle} onToggleApp={onToggleApp} onClose={onClose} {...props} />,
    );
    return { onToggle, onToggleApp, onClose, ...utils };
}

describe('AppActionPicker', () => {
    it('opens on the first app and lists its actions', () => {
        const { getByRole } = renderPicker();
        expect(getByRole('button', { name: /^Search/ })).toBeTruthy();
        expect(getByRole('button', { name: /^Send email/ })).toBeTruthy();
    });

    it('toggles one action and reports which app it belonged to', () => {
        const { getByRole, onToggle } = renderPicker();
        fireEvent.click(getByRole('button', { name: /^Search/ }));
        const [name, app, action] = onToggle.mock.calls[0];
        expect(name).toBe('gmail_search');
        expect(app.id).toBe('gmail');
        expect(action.label).toBe('Search');
    });

    it('shows how many of an app’s actions are selected, on the row and in the header', () => {
        const { getByRole, getByLabelText, getByText } = renderPicker({ selected: ['gmail_search'] });
        expect(getByLabelText('1 selected')).toBeTruthy();
        expect(getByText(/1 of 2 actions selected/i)).toBeTruthy();
        expect(getByRole('button', { name: /^Search/ }).getAttribute('aria-pressed')).toBe('true');
    });

    it('enables and disables a whole app at once', () => {
        const { getByRole, onToggleApp } = renderPicker();
        fireEvent.click(getByRole('button', { name: /enable all/i }));
        expect(onToggleApp.mock.calls[0][1]).toBe(true);
    });

    it('flips "Enable all" to "Disable all" when everything is already on', () => {
        const { getByRole } = renderPicker({ selected: ['gmail_search', 'gmail_send'] });
        expect(getByRole('button', { name: /disable all/i })).toBeTruthy();
    });

    it('badges list-producing and writing actions', () => {
        const { getByRole } = renderPicker();
        expect(getByRole('button', { name: /^Search/ }).textContent).toMatch(/list/i);
        expect(getByRole('button', { name: /^Send email/ }).textContent).toMatch(/writes/i);
    });

    it('searching narrows the RIGHT pane too, not just the app list', () => {
        // Searching "send" and still having to hunt through 15 Gmail actions
        // would defeat the point.
        const { getByLabelText, getByRole, queryByRole } = renderPicker();
        fireEvent.change(getByLabelText('Search apps and actions'), { target: { value: 'send' } });
        expect(getByRole('button', { name: /^Send email/ })).toBeTruthy();
        expect(queryByRole('button', { name: /^Search\b/ })).toBeNull();
    });

    it('keeps an unconnected app visible and explains what that means', () => {
        // Hiding it is what makes a picker feel broken ("where is Slack?").
        const { getByRole, getByText } = renderPicker({ unavailableHint: 'not connected to your account' });
        fireEvent.click(getByRole('button', { name: /^Slack$/ }));
        expect(getByText(/Slack is not connected to your account/i)).toBeTruthy();
        expect(getByRole('button', { name: /^Post message/ })).toBeTruthy();
    });

    it('closes on Escape and on the backdrop', () => {
        const { onClose, getByRole } = renderPicker();
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onClose).toHaveBeenCalledTimes(1);
        fireEvent.click(getByRole('button', { name: /^Close$/ }));
        expect(onClose).toHaveBeenCalledTimes(2);
    });

    it('renders a footer when the caller supplies one (the connector Apply bar)', () => {
        const { getByRole } = renderPicker({ footer: <button type="button">Apply</button> });
        expect(getByRole('button', { name: 'Apply' })).toBeTruthy();
    });

    it('says so rather than rendering an empty shell when there are no apps', () => {
        const { getAllByText } = render(
            <AppActionPicker apps={[]} selected={[]} onToggle={vi.fn()} onClose={vi.fn()} emptyLabel="No apps available" />,
        );
        expect(getAllByText('No apps available').length).toBeGreaterThan(0);
    });

    it('scopes selection counts per app', () => {
        const { getByText } = renderPicker({ selected: ['slack_post'] });
        // Gmail is focused and has none of them selected.
        expect(getByText(/0 of 2 actions selected/i)).toBeTruthy();
    });

    it('exposes the overlay as a labelled dialog', () => {
        const { getByRole } = renderPicker({ title: 'Choose apps & actions' });
        expect(getByRole('dialog', { name: /choose apps & actions/i })).toBeTruthy();
    });

    it('lets the caller reach an app’s actions through the left list', () => {
        const { getByRole } = renderPicker();
        fireEvent.click(getByRole('button', { name: /^Slack$/ }));
        const pane = getByRole('dialog');
        expect(within(pane).getByRole('button', { name: /^Post message/ })).toBeTruthy();
    });
});
