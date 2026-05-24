// Thin wrapper over LicenseContext exposing just the deployment mode.
//
// 'cloud' = Bee Flow SaaS (saas.beeflow.nl). Stripe subscriptions are the
//   paid-access mechanism; license-key UI is hidden except for internal
//   Full-tier admin orgs.
//
// 'self-hosted' = a customer's own server. License keys are the paid-access
//   mechanism; the admin Subscriptions panel and consumer Stripe checkout
//   are hidden entirely.
//
// The value comes from /auth/setup-status (server env DEPLOYMENT_MODE) and
// defaults to 'cloud' until that endpoint resolves.
import { useLicenseContext } from '../components/LicenseContext';

export function useDeploymentMode() {
    const { deploymentMode } = useLicenseContext();
    const mode = deploymentMode === 'self-hosted' ? 'self-hosted' : 'cloud';
    return { mode, isCloud: mode === 'cloud', isSelfHosted: mode === 'self-hosted' };
}
