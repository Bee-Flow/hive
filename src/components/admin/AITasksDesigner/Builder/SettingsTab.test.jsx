import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Stable mock API object (hoisted so it exists before the vi.mock factory runs).
// SettingsTab only touches the hook indirectly via VersionHistoryPanel/WebhookPanel,
// which render null when the automation has no `id` — but mock it anyway so the
// import never reaches the real authFetch/network layer.
const { api } = vi.hoisted(() => ({
    api: {
        listVersions: vi.fn().mockResolvedValue({ versions: [] }),
        listWebhooks: vi.fn().mockResolvedValue({ webhooks: [] }),
        getVersion: vi.fn(),
        getAutomation: vi.fn(),
        restoreVersion: vi.fn(),
    },
}));
vi.mock('../../../../hooks/useAutomationApi', () => ({ default: () => api }));

import SettingsTab from './SettingsTab.jsx';

const baseProps = (overrides = {}) => ({
    // No `id` → VersionHistoryPanel/WebhookPanel render null, keeping the test focused.
    automation: { title: 'Weekly Digest', definition: {} },
    onSave: vi.fn().mockResolvedValue(undefined),
    onRestored: vi.fn(),
    ...overrides,
});

describe('SettingsTab', () => {
    beforeEach(() => cleanup());

    it('shows the real automation title in notification previews, not a literal <title>', () => {
        render(<SettingsTab {...baseProps()} />);
        // The error preview interpolates the actual title.
        expect(screen.getByText('⚠️ Automation failed: Weekly Digest')).toBeTruthy();
        // It must NOT render the placeholder token.
        expect(screen.queryByText(/<title>/)).toBeNull();
    });

    it('hides the Manual Trigger Payload behind a closed Advanced disclosure that opens on click', async () => {
        render(<SettingsTab {...baseProps()} />);

        // The "Advanced" summary exists.
        const advanced = screen.getByText('Advanced');
        expect(advanced).toBeTruthy();

        // The payload textarea lives inside a <details> that starts closed.
        const payload = screen.getByPlaceholderText(/messageId/);
        const details = payload.closest('details');
        expect(details).toBeTruthy();
        expect(details.hasAttribute('open')).toBe(false);

        // Clicking the summary opens the disclosure.
        fireEvent.click(advanced);
        expect(details.hasAttribute('open')).toBe(true);
    });

    it('reflects unsaved-state copy in the footer as the user edits', async () => {
        const user = userEvent.setup();
        const { container } = render(<SettingsTab {...baseProps()} />);

        // Clean on mount.
        expect(screen.getByText('No unsaved changes')).toBeTruthy();
        expect(screen.queryByText('Unsaved changes')).toBeNull();

        // The Description textarea is the 3-row one (the payload textarea is rows=6).
        const description = container.querySelector('textarea[rows="3"]');
        await user.type(description, 'hello');

        expect(screen.getByText('Unsaved changes')).toBeTruthy();
        expect(screen.queryByText('No unsaved changes')).toBeNull();
    });

    it('updates the description character counter as you type', async () => {
        const user = userEvent.setup();
        const { container } = render(<SettingsTab {...baseProps()} />);

        const description = container.querySelector('textarea[rows="3"]');
        await user.type(description, 'hello');

        expect(screen.getByText('5 characters')).toBeTruthy();
    });

    it('renders the channel selector chips and saves a toggled Email channel on the On error row', async () => {
        const props = baseProps();
        const { container } = render(<SettingsTab {...props} />);

        // Each notification row has a "Send to" label.
        const sendToLabels = screen.getAllByText('Send to');
        expect(sendToLabels.length).toBe(3);

        // The always-on in-app bell + email chips render; slack/push are present but disabled.
        expect(screen.getAllByText('In-app bell').length).toBe(3);
        expect(screen.getAllByText('Email').length).toBe(3);
        // "coming soon" chips render with a " · soon" suffix and the disabled attribute.
        const slackChips = screen.getAllByText('Slack · soon');
        const pushChips = screen.getAllByText('Push · soon');
        expect(slackChips.length).toBe(3);
        expect(pushChips.length).toBe(3);
        for (const chip of [...slackChips, ...pushChips]) {
            expect(chip.closest('button').hasAttribute('disabled')).toBe(true);
        }
        // The in-app bell chip is the always-on (disabled) one.
        for (const bell of screen.getAllByText('In-app bell')) {
            expect(bell.closest('button').hasAttribute('disabled')).toBe(true);
        }

        // Locate the "On error" row and toggle its Email chip on.
        const onErrorLabel = screen.getByText('On error');
        const onErrorRow = onErrorLabel.closest('div.rounded.border');
        expect(onErrorRow).toBeTruthy();
        const emailChip = Array.from(onErrorRow.querySelectorAll('button'))
            .find((b) => b.textContent === 'Email');
        expect(emailChip).toBeTruthy();
        expect(emailChip.hasAttribute('disabled')).toBe(false);
        fireEvent.click(emailChip);

        // Save and assert the payload reaching onSave includes 'email' on onError.
        fireEvent.click(screen.getByText('Save'));
        await waitFor(() => expect(props.onSave).toHaveBeenCalledTimes(1));
        const saved = props.onSave.mock.calls[0][0];
        expect(saved.definition.notificationSettings.onError.channels).toContain('email');
        // The always-on bell is preserved alongside it.
        expect(saved.definition.notificationSettings.onError.channels).toContain('inapp');
    });
});
