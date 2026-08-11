import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SecurityHub from './SecurityHub';

const hasTier = vi.hoisted(() => vi.fn());

vi.mock('../../hooks/useTranslation', () => ({
    useTranslation: () => ({ t: (key) => key }),
}));
vi.mock('../LicenseContext', () => ({ useLicenseContext: () => ({ hasTier }) }));

// The panels are heavy and each fetches on mount. SecurityHub only gates
// sections and routes between them, so the panels are stubbed to keep this
// about that decision. The guardrails stub echoes its `section` prop, because
// threading the third path segment through is now part of SecurityHub's job.
vi.mock('./guardrails/GuardrailsHub', () => ({
    default: ({ section }) => <div data-testid="guardrails-panel" data-section={section || ''} />,
}));
vi.mock('./SSOConfigPanel', () => ({ default: () => <div data-testid="sso-panel" /> }));
vi.mock('./UserManagement', () => ({ default: () => <div data-testid="user-management" /> }));
vi.mock('./connectorHealth/ConnectorHealthPanel', () => ({
    default: ({ initialOrgId }) => <div data-testid="connector-health-panel" data-org={initialOrgId || ''} />,
}));

const fullAdmin = { permissions: ['all'], isAdmin: true };
const orgAdmin = { permissions: ['admin_security'], isAdmin: false };

describe('SecurityHub', () => {
    beforeEach(() => {
        cleanup();
        hasTier.mockReset();
        hasTier.mockReturnValue(true); // enterprise unless a test says otherwise
    });

    it('shows all three sections to a full admin on enterprise', () => {
        render(<SecurityHub user={fullAdmin} />);
        expect(screen.getByText('admin.sec_users')).toBeInTheDocument();
        expect(screen.getByText('admin.sec_guardrails')).toBeInTheDocument();
        expect(screen.getByText('admin.sec_sso')).toBeInTheDocument();
    });

    it('hides guardrails on a community install', () => {
        hasTier.mockReturnValue(false);
        render(<SecurityHub user={fullAdmin} />);
        expect(screen.queryByText('admin.sec_guardrails')).not.toBeInTheDocument();
        expect(screen.getByText('admin.sec_users')).toBeInTheDocument();
    });

    it('resolves the tier against the real licence, with no super-admin elevation', () => {
        hasTier.mockReturnValue(false);
        render(<SecurityHub user={fullAdmin} />);
        // A super-admin on community still does not see an enterprise section:
        // LicenseContext.hasTier reads the REAL tier by documented invariant.
        expect(hasTier).toHaveBeenCalledWith('enterprise');
        expect(screen.queryByText('admin.sec_guardrails')).not.toBeInTheDocument();
    });

    it('hides sso from a non-full admin', () => {
        render(<SecurityHub user={orgAdmin} />);
        expect(screen.queryByText('admin.sec_sso')).not.toBeInTheDocument();
        expect(screen.getByText('admin.sec_users')).toBeInTheDocument();
    });

    it('renders the section named by activeSection', () => {
        render(<SecurityHub user={fullAdmin} activeSection="guardrails" />);
        expect(screen.getByTestId('guardrails-panel')).toBeInTheDocument();
        expect(screen.queryByTestId('user-management')).not.toBeInTheDocument();
    });

    it('falls back to users when activeSection is not a section at all', () => {
        render(<SecurityHub user={fullAdmin} activeSection="does-not-exist" />);
        expect(screen.getByTestId('user-management')).toBeInTheDocument();
    });

    it('falls back to users when a non-full admin lands on sso', () => {
        render(<SecurityHub user={orgAdmin} activeSection="sso" />);
        expect(screen.getByTestId('user-management')).toBeInTheDocument();
        expect(screen.queryByTestId('sso-panel')).not.toBeInTheDocument();
    });

    it('falls back to users when a community admin lands on guardrails', () => {
        hasTier.mockReturnValue(false);
        render(<SecurityHub user={fullAdmin} activeSection="guardrails" />);
        expect(screen.getByTestId('user-management')).toBeInTheDocument();
        expect(screen.queryByTestId('guardrails-panel')).not.toBeInTheDocument();
    });

    it('navigates to the section path when a rail button is clicked', () => {
        const onNavigate = vi.fn();
        render(<SecurityHub user={fullAdmin} onNavigate={onNavigate} />);
        fireEvent.click(screen.getByText('admin.sec_sso'));
        expect(onNavigate).toHaveBeenCalledWith('admin/security/sso');
    });

    it('shows connector-health to a full admin only', () => {
        render(<SecurityHub user={fullAdmin} />);
        expect(screen.getByText('admin.sec_connector_health')).toBeInTheDocument();
    });

    it('hides connector-health from a non-full admin', () => {
        render(<SecurityHub user={orgAdmin} />);
        expect(screen.queryByText('admin.sec_connector_health')).not.toBeInTheDocument();
    });

    it('falls back to users when a non-full admin lands on connector-health', () => {
        render(<SecurityHub user={orgAdmin} activeSection="connector-health" />);
        expect(screen.getByTestId('user-management')).toBeInTheDocument();
        expect(screen.queryByTestId('connector-health-panel')).not.toBeInTheDocument();
    });

    it('renders the connector-health panel and threads the org drill-in segment', () => {
        render(<SecurityHub user={fullAdmin} activeSection="connector-health" userSection="org-123" />);
        const panel = screen.getByTestId('connector-health-panel');
        expect(panel).toBeInTheDocument();
        expect(panel.getAttribute('data-org')).toBe('org-123');
        expect(screen.queryByTestId('user-management')).not.toBeInTheDocument();
    });

    it('threads the third path segment into the guardrails console', () => {
        // This is what makes /app/admin/security/guardrails/<section> a real URL
        // without touching App.jsx's three-segment parser.
        render(<SecurityHub user={fullAdmin} activeSection="guardrails" userSection="patterns" />);
        expect(screen.getByTestId('guardrails-panel').getAttribute('data-section')).toBe('patterns');
    });

    it('renders the guardrails console with no segment when none is given', () => {
        render(<SecurityHub user={fullAdmin} activeSection="guardrails" />);
        expect(screen.getByTestId('guardrails-panel').getAttribute('data-section')).toBe('');
    });
});
