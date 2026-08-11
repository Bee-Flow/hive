import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ConsumerPrivacySection from './ConsumerPrivacySection';
import { authFetch } from '../../utils/helpers';

vi.mock('../../utils/helpers', () => ({ API_BASE: '', authFetch: vi.fn() }));

const jsonRes = (body, status = 200) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
});

// The server's USER_SHIELD_DEFAULTS as delivered by GET /user/me when the user
// has never saved (BFSF-289): protecting, and flagged as an implicit default.
const IMPLICIT_DEFAULTS = {
    enabled: true,
    euModeEnabled: false,
    disableSearchOnUpload: false,
    piiDetectionEnabled: true,
    piiDetectionCategories: [],
    piiDetectionConfidenceThreshold: 0.7,
    piiDetectionAction: 'tokenize',
    piiFailureMode: 'fail_closed',
    showRawPayload: false,
    implicitDefault: true,
};

/** Route the two GETs the panel fires on mount. */
function mockApi({ config = IMPLICIT_DEFAULTS, guard = { configured: true, reachable: true } } = {}) {
    authFetch.mockImplementation(async (url) => {
        if (String(url).includes('guard-status')) return jsonRes(guard);
        return jsonRes(config);
    });
}

describe('ConsumerPrivacySection', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    it('BFSF-289: a never-configured account shows the shield ON and labels it a default', async () => {
        mockApi();
        render(<ConsumerPrivacySection />);

        await screen.findByText('On by default');
        expect(screen.getByText(/already in force with the secure defaults/i)).toBeInTheDocument();

        // The master toggle is the first checkbox in the panel.
        const [masterToggle] = screen.getAllByRole('checkbox');
        expect(masterToggle.checked).toBe(true);
    });

    it('does not label a saved configuration as a default', async () => {
        mockApi({ config: { ...IMPLICIT_DEFAULTS, implicitDefault: false } });
        render(<ConsumerPrivacySection />);

        await waitFor(() => expect(authFetch).toHaveBeenCalled());
        await waitFor(() => expect(screen.queryByText('Enable Privacy Shield')).toBeInTheDocument());
        expect(screen.queryByText('On by default')).not.toBeInTheDocument();
    });

    it('warns when the shield is on but the PII Guard is not configured', async () => {
        mockApi({ guard: { configured: false, reachable: false } });
        render(<ConsumerPrivacySection />);

        await screen.findByText('Personal-data check unavailable');
        expect(screen.getByText(/not set up on this server/i)).toBeInTheDocument();
    });

    it('warns when the guard is configured but unreachable', async () => {
        mockApi({ guard: { configured: true, reachable: false } });
        render(<ConsumerPrivacySection />);
        await screen.findByText('Personal-data check unavailable');
    });

    it('stays quiet when the guard is healthy', async () => {
        mockApi();
        render(<ConsumerPrivacySection />);

        await screen.findByText('Enable Privacy Shield');
        expect(screen.queryByText('Personal-data check unavailable')).not.toBeInTheDocument();
    });

    it('does not warn about the guard when the shield is switched off', async () => {
        mockApi({
            config: { ...IMPLICIT_DEFAULTS, enabled: false, implicitDefault: false },
            guard: { configured: false, reachable: false },
        });
        render(<ConsumerPrivacySection />);

        await screen.findByText('Enable Privacy Shield');
        expect(screen.queryByText('Personal-data check unavailable')).not.toBeInTheDocument();
    });
});
