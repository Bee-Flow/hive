import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import GoogleMeetNotesSection from './GoogleMeetNotesSection';
import { authFetch } from '../../utils/helpers';

vi.mock('../../utils/helpers', () => ({ API_BASE: '', authFetch: vi.fn() }));
vi.mock('../../lib/googleOAuthPopup', () => ({ openGoogleOAuthPopup: vi.fn() }));

const jsonRes = (body, status = 200) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
});

const SETTINGS = {
    autoImport: true, autoRecordConfig: false, importScope: 'organizer', language: 'nl',
    connection: { googleConnected: true, meetScopesGranted: true, needsReauth: false },
};

describe('GoogleMeetNotesSection', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    it('renders nothing when the API returns non-OK (feature not licensed)', async () => {
        authFetch.mockResolvedValue(jsonRes({ error: 'forbidden' }, 403));
        const { container } = render(<GoogleMeetNotesSection />);
        await waitFor(() => expect(authFetch).toHaveBeenCalled());
        expect(container).toBeEmptyDOMElement();
    });

    it('renders nothing when Google is not connected', async () => {
        authFetch.mockResolvedValue(jsonRes({
            ...SETTINGS,
            connection: { googleConnected: false, meetScopesGranted: false, needsReauth: false },
        }));
        const { container } = render(<GoogleMeetNotesSection />);
        await waitFor(() => expect(authFetch).toHaveBeenCalled());
        expect(container).toBeEmptyDOMElement();
    });

    it('renders the settings rows when connected with Meet scopes granted', async () => {
        authFetch.mockResolvedValue(jsonRes(SETTINGS));
        render(<GoogleMeetNotesSection />);
        await screen.findByText('Auto-import my recorded Meet meetings');
        expect(screen.getByText('Also pre-enable auto-recording for meetings I organize')).toBeInTheDocument();
        expect(screen.getByText('Which meetings')).toBeInTheDocument();
        expect(screen.getByText('Default language')).toBeInTheDocument();
        expect(screen.queryByText('Re-authorize Google')).not.toBeInTheDocument();
    });

    it('shows the re-consent card instead of rows when Meet scopes are missing', async () => {
        authFetch.mockResolvedValue(jsonRes({
            ...SETTINGS,
            connection: { googleConnected: true, meetScopesGranted: false, needsReauth: false },
        }));
        render(<GoogleMeetNotesSection />);
        await screen.findByText('Re-authorize Google');
        expect(screen.getByText('Google Meet Meeting Notes')).toBeInTheDocument();
        expect(screen.queryByText('Auto-import my recorded Meet meetings')).not.toBeInTheDocument();
    });
});
