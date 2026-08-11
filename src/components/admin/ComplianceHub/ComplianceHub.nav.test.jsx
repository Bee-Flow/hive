/**
 * Contract guard for ComplianceHub navigation. The settings surface
 * (AdvancedSettings → complianceNavAdapter) rewrites the paths this component
 * emits, so the shape `admin/compliance/<section>[/<checkId>]` is load-bearing
 * in two places. If these tests fail, update the adapter regex in
 * src/pages/settings/complianceNavAdapter.js in the same change.
 */
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ComplianceHub from './index';

vi.mock('../../../hooks/useTranslation', () => ({
    useTranslation: () => ({ t: (key) => key }),
}));
vi.mock('./OverviewPage', () => ({
    default: () => <div data-testid="overview-page" />,
}));
vi.mock('./ChecksPage', () => ({
    default: ({ regulation, focusCheckId }) => (
        <div data-testid="checks-page" data-regulation={regulation} data-focus={focusCheckId || ''} />
    ),
}));
vi.mock('./SettingsPage', () => ({
    default: ({ orgUsers }) => (
        <div data-testid="settings-page" data-orgusers={orgUsers === null ? 'null' : JSON.stringify(orgUsers)} />
    ),
}));
vi.mock('./DsrInboxPage', () => ({ default: () => <div data-testid="dsr-page" /> }));
vi.mock('./RopaPage', () => ({ default: () => <div data-testid="ropa-page" /> }));
vi.mock('./DpiaPage', () => ({ default: () => <div data-testid="dpia-page" /> }));
vi.mock('./OnboardingWizard', () => ({ default: () => <div data-testid="wizard" /> }));
vi.mock('../guardrails/Toast', () => ({
    ToastHost: () => null,
    showToast: vi.fn(),
}));
vi.mock('./shared/Skeleton', () => ({
    CheckCardSkeleton: () => <div data-testid="skeleton" />,
}));

function mockFetch() {
    global.fetch = vi.fn(async (url) => ({
        ok: true,
        json: async () => (String(url).endsWith('/overview')
            ? { onboarded: true, overall: { score: 100 }, settings: {} }
            : []),
    }));
}

describe('ComplianceHub navigation contract', () => {
    beforeEach(() => {
        cleanup();
        mockFetch();
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('emits admin/compliance/<section> when a sidebar section is clicked', async () => {
        const onNavigate = vi.fn();
        render(<ComplianceHub onNavigate={onNavigate} />);
        await waitFor(() => expect(global.fetch).toHaveBeenCalled());
        fireEvent.click(screen.getByTitle('compliance.nav_gdpr'));
        expect(onNavigate).toHaveBeenCalledWith('admin/compliance/gdpr');
        fireEvent.click(screen.getByTitle('compliance.nav_settings'));
        expect(onNavigate).toHaveBeenCalledWith('admin/compliance/settings');
    });

    it('routes activeSection to the matching page', async () => {
        render(<ComplianceHub activeSection="gdpr" />);
        await waitFor(() => expect(screen.getByTestId('checks-page')).toBeInTheDocument());
        expect(screen.getByTestId('checks-page').dataset.regulation).toBe('GDPR');
    });

    it('threads focusCheckId through to the checks page', async () => {
        render(<ComplianceHub activeSection="aia" focusCheckId="AIA-Art50-ai-disclosure" />);
        await waitFor(() => expect(screen.getByTestId('checks-page')).toBeInTheDocument());
        expect(screen.getByTestId('checks-page').dataset.focus).toBe('AIA-Art50-ai-disclosure');
    });

    it('falls back to overview for an unknown section', async () => {
        render(<ComplianceHub activeSection="not-a-section" />);
        await waitFor(() => expect(screen.getByTestId('overview-page')).toBeInTheDocument());
    });

    it('routes the dsr / ropa / dpia sections to their pages', async () => {
        render(<ComplianceHub activeSection="dsr" />);
        await waitFor(() => expect(screen.getByTestId('dsr-page')).toBeInTheDocument());
        cleanup(); mockFetch();
        render(<ComplianceHub activeSection="ropa" />);
        await waitFor(() => expect(screen.getByTestId('ropa-page')).toBeInTheDocument());
        cleanup(); mockFetch();
        render(<ComplianceHub activeSection="dpia" />);
        await waitFor(() => expect(screen.getByTestId('dpia-page')).toBeInTheDocument());
    });

    it('fetches the org-user directory for the settings section and threads it down', async () => {
        render(<ComplianceHub activeSection="settings" />);
        await waitFor(() => expect(screen.getByTestId('settings-page')).toBeInTheDocument());
        await waitFor(() =>
            expect(global.fetch.mock.calls.some(([u]) => String(u).endsWith('/org-users'))).toBe(true));
        // The [] fallback (mock returns [] for non-overview URLs) reaches the page.
        await waitFor(() => expect(screen.getByTestId('settings-page').dataset.orgusers).toBe('[]'));
    });

    it('does not fetch the directory for sections without a picker', async () => {
        render(<ComplianceHub activeSection="gdpr" />);
        await waitFor(() => expect(global.fetch).toHaveBeenCalled());
        expect(global.fetch.mock.calls.some(([u]) => String(u).endsWith('/org-users'))).toBe(false);
    });
});
