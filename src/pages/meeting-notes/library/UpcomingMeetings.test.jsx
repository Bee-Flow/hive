import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/transcriptionsApi', () => ({
    listTalkMeetings: vi.fn(),
    setMeetingRecord: vi.fn(),
    listGoogleMeetMeetings: vi.fn(),
    setGoogleMeetMeetingRecord: vi.fn(),
}));
vi.mock('../../../lib/googleOAuthPopup', () => ({ openGoogleOAuthPopup: vi.fn() }));
vi.mock('../../../utils/helpers', () => ({ API_BASE: '', authFetch: vi.fn() }));

import UpcomingMeetings from './UpcomingMeetings';
import { listTalkMeetings, setMeetingRecord, listGoogleMeetMeetings, setGoogleMeetMeetingRecord } from '../lib/transcriptionsApi';
import { openGoogleOAuthPopup } from '../../../lib/googleOAuthPopup';

const talkMeeting = (over = {}) => ({
    talkToken: 'tok1', uid: 'uid1', title: 'Talk standup',
    start: '2026-07-18T09:00:00Z', end: '2026-07-18T09:30:00Z',
    excluded: false, status: 'will_record', isModerator: true, recordedNoteId: null,
    ...over,
});
const gmeetMeeting = (over = {}) => ({
    eventId: 'ev1', iCalUID: 'ic1', title: 'Meet planning',
    start: '2026-07-18T08:00:00Z', end: '2026-07-18T08:30:00Z',
    organizerEmail: 'me@example.com', organizerSelf: true,
    meetingCode: 'abc-defg-hij', meetLink: 'https://meet.google.com/abc-defg-hij',
    excluded: false, recordingControlledByHost: false, importedNoteId: null, status: 'will_import',
    ...over,
});
const talkPayload = (meetings = [], over = {}) => ({ recordingEnabled: true, recordingMode: 'audio', meetings, ...over });
const gmeetPayload = (meetings = [], over = {}) => ({
    connection: { googleConnected: true, meetScopesGranted: true, hasSettingsScope: true, needsReauth: false },
    autoImport: true, meetings,
    ...over,
});

const toggles = (container) => container.querySelectorAll('button[aria-pressed]');

describe('UpcomingMeetings', () => {
    beforeEach(() => {
        listTalkMeetings.mockReset().mockResolvedValue(talkPayload());
        setMeetingRecord.mockReset().mockResolvedValue({});
        listGoogleMeetMeetings.mockReset().mockResolvedValue(gmeetPayload());
        setGoogleMeetMeetingRecord.mockReset().mockResolvedValue({});
        openGoogleOAuthPopup.mockReset().mockResolvedValue({ success: true });
    });

    it('merges both providers sorted by start time with provider chips', async () => {
        listTalkMeetings.mockResolvedValue(talkPayload([talkMeeting()]));
        listGoogleMeetMeetings.mockResolvedValue(gmeetPayload([gmeetMeeting()])); // starts before the Talk one
        const { container } = render(<UpcomingMeetings />);

        await screen.findByText('Talk standup');
        await screen.findByText('Meet planning');
        expect(screen.getByText('Talk')).toBeInTheDocument();
        expect(screen.getByText('Meet')).toBeInTheDocument();

        const text = container.textContent;
        expect(text.indexOf('Meet planning')).toBeLessThan(text.indexOf('Talk standup'));
        expect(toggles(container)).toHaveLength(2);
    });

    it('shows a Talk error card while still rendering Meet rows when only Talk fails', async () => {
        listTalkMeetings.mockRejectedValue(new Error('talk backend down'));
        listGoogleMeetMeetings.mockResolvedValue(gmeetPayload([gmeetMeeting()]));
        render(<UpcomingMeetings />);

        await screen.findByText("Couldn't load Nextcloud Talk meetings");
        expect(screen.getByText('talk backend down')).toBeInTheDocument();
        expect(screen.getByText('Meet planning')).toBeInTheDocument();
        expect(screen.queryByText("Couldn't load Google Meet meetings")).not.toBeInTheDocument();
    });

    it('renders the connect-Google prompt when Google is not connected, without errors or reconnect banner', async () => {
        listGoogleMeetMeetings.mockResolvedValue(gmeetPayload([], {
            connection: { googleConnected: false, meetScopesGranted: false, hasSettingsScope: false, needsReauth: false },
        }));
        render(<UpcomingMeetings />);

        await screen.findByText(/Connect Google Workspace to see your Meet meetings here/);
        expect(screen.getByRole('link', { name: /Settings → Integrations/ })).toHaveAttribute('href', '/app/settings/integrations');
        expect(screen.queryByText("Couldn't load Google Meet meetings")).not.toBeInTheDocument();
        expect(screen.queryByText(/doesn't include Meet permissions/)).not.toBeInTheDocument();
    });

    it('shows the reconnect banner when connected without Meet scopes and reloads after the popup', async () => {
        listGoogleMeetMeetings.mockResolvedValue(gmeetPayload([], {
            connection: { googleConnected: true, meetScopesGranted: false, hasSettingsScope: false, needsReauth: false },
        }));
        render(<UpcomingMeetings />);

        await screen.findByText(/doesn't include Meet permissions yet — reconnect to enable auto-import/);
        expect(screen.queryByText(/Connect Google Workspace to see your Meet meetings/)).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Reconnect' }));
        await waitFor(() => expect(listGoogleMeetMeetings).toHaveBeenCalledTimes(2));
        expect(openGoogleOAuthPopup).toHaveBeenCalledWith(expect.objectContaining({ apiBase: '' }));
    });

    it('toggles a Meet row optimistically and keeps it on success', async () => {
        listGoogleMeetMeetings.mockResolvedValue(gmeetPayload([gmeetMeeting({ excluded: true, status: 'excluded' })]));
        const { container } = render(<UpcomingMeetings />);
        await screen.findByText('Meet planning');

        const toggle = toggles(container)[0];
        expect(toggle).toHaveAttribute('aria-pressed', 'false');
        fireEvent.click(toggle);
        expect(toggle).toHaveAttribute('aria-pressed', 'true'); // optimistic

        await waitFor(() => expect(setGoogleMeetMeetingRecord).toHaveBeenCalledWith('ev1', true, { meetingCode: 'abc-defg-hij' }));
        expect(listGoogleMeetMeetings).toHaveBeenCalledTimes(1); // no reload on success
    });

    it('reverts a failed Meet toggle by reload and shows the row error for classified failures', async () => {
        listGoogleMeetMeetings.mockResolvedValue(gmeetPayload([gmeetMeeting({ excluded: true, status: 'excluded' })]));
        const err = Object.assign(new Error('Meet permissions missing'), { code: 'needs_meet_scopes' });
        setGoogleMeetMeetingRecord.mockRejectedValue(err);
        const { container } = render(<UpcomingMeetings />);
        await screen.findByText('Meet planning');

        fireEvent.click(toggles(container)[0]);
        expect(toggles(container)[0]).toHaveAttribute('aria-pressed', 'true'); // optimistic

        await screen.findByText('Meet permissions missing');
        expect(listGoogleMeetMeetings).toHaveBeenCalledTimes(2); // revert-by-reload
        await waitFor(() => expect(toggles(container)[0]).toHaveAttribute('aria-pressed', 'false'));
    });

    it('disables the Meet toggle when Meet scopes are missing', async () => {
        listGoogleMeetMeetings.mockResolvedValue(gmeetPayload([gmeetMeeting()], {
            connection: { googleConnected: true, meetScopesGranted: false, hasSettingsScope: false, needsReauth: false },
        }));
        const { container } = render(<UpcomingMeetings />);
        await screen.findByText('Meet planning');
        expect(toggles(container)[0]).toBeDisabled();
    });

    it('renders manual_record and not_organizer chips for Meet rows', async () => {
        listGoogleMeetMeetings.mockResolvedValue(gmeetPayload([
            gmeetMeeting({ eventId: 'ev1', title: 'Hosted elsewhere', organizerSelf: false, recordingControlledByHost: true }),
            gmeetMeeting({ eventId: 'ev2', title: 'Organizer gated', start: '2026-07-18T11:00:00Z', status: 'not_organizer' }),
        ]));
        render(<UpcomingMeetings />);

        const manual = await screen.findByText('Record in Meet');
        expect(manual).toHaveAttribute('title', 'Start the recording in Google Meet — it will be imported afterwards.');
        expect(screen.getByText('Organizer only')).toBeInTheDocument();
    });

    it('opens the imported note from the Meet status chip', async () => {
        listGoogleMeetMeetings.mockResolvedValue(gmeetPayload([gmeetMeeting({ importedNoteId: 42, status: 'imported' })]));
        const onOpenNote = vi.fn();
        render(<UpcomingMeetings onOpenNote={onOpenNote} />);

        fireEvent.click(await screen.findByRole('button', { name: /Note created/ }));
        expect(onOpenNote).toHaveBeenCalledWith(42);
    });

    it('keeps the Talk toggle flow: optimistic, silent revert-by-reload, no row error', async () => {
        listTalkMeetings.mockResolvedValue(talkPayload([talkMeeting()]));
        setMeetingRecord.mockRejectedValue(new Error('boom'));
        const { container } = render(<UpcomingMeetings />);
        await screen.findByText('Talk standup');

        const toggle = toggles(container)[0];
        expect(toggle).toHaveAttribute('aria-pressed', 'true');
        fireEvent.click(toggle);
        expect(toggle).toHaveAttribute('aria-pressed', 'false'); // optimistic OFF

        await waitFor(() => expect(listTalkMeetings).toHaveBeenCalledTimes(2)); // silent revert-by-reload
        expect(setMeetingRecord).toHaveBeenCalledWith('tok1', false, 'uid1');
        expect(screen.queryByText('boom')).not.toBeInTheDocument();
        await waitFor(() => expect(toggles(container)[0]).toHaveAttribute('aria-pressed', 'true'));
    });

    it('keeps the Talk recording-backend banner', async () => {
        listTalkMeetings.mockResolvedValue(talkPayload([], { recordingEnabled: false }));
        render(<UpcomingMeetings />);
        await screen.findByText(/Nextcloud Talk recording backend isn't configured/);
    });
});
