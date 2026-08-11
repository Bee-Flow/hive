import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

// Stub collaborators not under test.
vi.mock('./CaptureControls', () => ({ default: () => null }));
vi.mock('../../../utils/helpers', () => ({ API_BASE: '', authFetch: vi.fn() }));
vi.mock('../hooks/useGoogleMeetConnected', () => ({ default: vi.fn() }));
vi.mock('../lib/transcriptionsApi', () => ({ listGoogleMeetRecordings: vi.fn() }));
vi.mock('../../../lib/googleOAuthPopup', () => ({ openGoogleOAuthPopup: vi.fn() }));

const recorderMock = { current: null };
vi.mock('../hooks/RecorderContext', () => ({ useRecorder: () => recorderMock.current }));

import GoogleMeetImportPanel from './GoogleMeetImportPanel';
import useGoogleMeetConnected from '../hooks/useGoogleMeetConnected';
import { listGoogleMeetRecordings } from '../lib/transcriptionsApi';
import { openGoogleOAuthPopup } from '../../../lib/googleOAuthPopup';

const ITEMS = [
    { eventId: 'e1', meetingCode: 'abc-defg-hij', title: 'Weekly sync', start: '2026-07-16T10:00:00Z', end: '2026-07-16T10:45:00Z', recordingState: 'available', importedNoteId: null },
    { eventId: 'e2', meetingCode: 'kkk-llll-mmm', title: 'Design review', start: '2026-07-16T12:00:00Z', end: '2026-07-16T13:00:00Z', recordingState: 'processing', importedNoteId: null },
    { eventId: 'e3', meetingCode: 'nnn-oooo-ppp', title: 'Standup', start: '2026-07-16T09:00:00Z', end: '2026-07-16T09:15:00Z', recordingState: 'none', importedNoteId: null },
    { eventId: 'e4', meetingCode: 'qqq-rrrr-sss', title: 'Retro', start: '2026-07-15T15:00:00Z', end: '2026-07-15T16:00:00Z', recordingState: 'available', importedNoteId: 42 },
];

const makeRecorder = (over = {}) => ({
    importFromGoogleMeet: vi.fn().mockResolvedValue({ ok: true }),
    settings: { language: 'nl', provider: '', contextTerms: 'AFAS' },
    uploading: false,
    uploadStage: '',
    uploadError: null,
    clearError: vi.fn(),
    ...over,
});

describe('GoogleMeetImportPanel', () => {
    beforeEach(() => {
        cleanup();
        vi.clearAllMocks();
        recorderMock.current = makeRecorder();
        useGoogleMeetConnected.mockReturnValue({ connected: true, needsReconsent: false, loading: false });
        listGoogleMeetRecordings.mockResolvedValue({ items: ITEMS });
    });

    it('renders a row per meeting with the state-appropriate action', async () => {
        render(<GoogleMeetImportPanel />);
        expect(await screen.findByText('Weekly sync')).toBeTruthy();
        // available → Transcribe button (e4 is available too but already imported)
        expect(screen.getByRole('button', { name: 'Transcribe' }).disabled).toBe(false);
        // processing → disabled Processing… button
        expect(screen.getByRole('button', { name: 'Processing…' }).disabled).toBe(true);
        // none → muted text
        expect(screen.getByText('No recording')).toBeTruthy();
        // importedNoteId → Note created chip, no second Transcribe button
        expect(screen.getByText('Note created')).toBeTruthy();
        expect(screen.getAllByRole('button', { name: 'Transcribe' })).toHaveLength(1);
    });

    it('imports a recording with the capture settings and calls onComplete', async () => {
        const onComplete = vi.fn();
        render(<GoogleMeetImportPanel onComplete={onComplete} />);
        fireEvent.click(await screen.findByRole('button', { name: 'Transcribe' }));
        await waitFor(() => expect(onComplete).toHaveBeenCalled());
        expect(recorderMock.current.importFromGoogleMeet).toHaveBeenCalledWith(ITEMS[0], { language: 'nl', contextTerms: 'AFAS' });
        expect(recorderMock.current.clearError).toHaveBeenCalled();
    });

    it('does not close the modal when the import fails', async () => {
        recorderMock.current = makeRecorder({ importFromGoogleMeet: vi.fn().mockResolvedValue({ ok: false, error: new Error('nope') }) });
        const onComplete = vi.fn();
        render(<GoogleMeetImportPanel onComplete={onComplete} />);
        fireEvent.click(await screen.findByRole('button', { name: 'Transcribe' }));
        await waitFor(() => expect(recorderMock.current.importFromGoogleMeet).toHaveBeenCalled());
        expect(onComplete).not.toHaveBeenCalled();
    });

    it('disables Transcribe while an upload is in flight', async () => {
        recorderMock.current = makeRecorder({ uploading: true });
        render(<GoogleMeetImportPanel />);
        const btn = await screen.findByRole('button', { name: 'Transcribe' });
        expect(btn.disabled).toBe(true);
    });

    it('shows the empty state when there are no recordings', async () => {
        listGoogleMeetRecordings.mockResolvedValue({ items: [] });
        render(<GoogleMeetImportPanel />);
        expect(await screen.findByText('No Meet recordings found')).toBeTruthy();
    });

    it('surfaces a load error', async () => {
        listGoogleMeetRecordings.mockRejectedValue(new Error('boom'));
        render(<GoogleMeetImportPanel />);
        expect(await screen.findByText("Couldn't load recordings")).toBeTruthy();
        expect(screen.getByText('boom')).toBeTruthy();
    });

    it('shows the re-consent CTA instead of the list and reloads after a successful re-auth', async () => {
        useGoogleMeetConnected.mockReturnValue({ connected: false, needsReconsent: true, loading: false });
        openGoogleOAuthPopup.mockResolvedValue({ success: true });
        render(<GoogleMeetImportPanel />);
        expect(screen.getByText('Google Meet needs additional access')).toBeTruthy();
        expect(screen.queryByText('Weekly sync')).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: 'Re-authorize Google' }));
        expect(await screen.findByText('Weekly sync')).toBeTruthy();
        expect(openGoogleOAuthPopup).toHaveBeenCalled();
    });

    it('stays on the re-consent view when the popup is closed without consent', async () => {
        useGoogleMeetConnected.mockReturnValue({ connected: false, needsReconsent: true, loading: false });
        openGoogleOAuthPopup.mockResolvedValue({ success: false, closed: true });
        render(<GoogleMeetImportPanel />);
        fireEvent.click(screen.getByRole('button', { name: 'Re-authorize Google' }));
        await waitFor(() => expect(openGoogleOAuthPopup).toHaveBeenCalled());
        expect(screen.getByText('Google Meet needs additional access')).toBeTruthy();
    });
});
