import React from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { Shield, KeyRound, Users, AtSign, Activity } from 'lucide-react';
import GuardrailsHub from './guardrails/GuardrailsHub';
import SSOConfigPanel from './SSOConfigPanel';
import FreeEmailDomainsPanel from './FreeEmailDomainsPanel';
import ConnectorHealthPanel from './connectorHealth/ConnectorHealthPanel';
import UserManagement from './UserManagement';
import { useLicenseContext } from '../LicenseContext';
import HubScaffold from './shared/HubScaffold';

/**
 * SecurityHub — Unified security configuration page
 * Groups Guardrails and SSO behind a compact left sidebar.
 *
 * `enterpriseOnly` sections are hidden on Community installs (the resolved
 * tier is the REAL tier — LicenseContext.hasTier has no super-admin
 * elevation — so the operator's own UI hides them too).
 *
 * Beta features are no longer configured here — they moved to the unified
 * Access & Permissions hub (Admin → Access → Ceiling / Grants).
 */
const SECTIONS = [
    { id: 'users', labelKey: 'admin.sec_users', icon: Users, color: '#3b82f6' },
    { id: 'guardrails', labelKey: 'admin.sec_guardrails', icon: Shield, color: '#ef4444', enterpriseOnly: true },
    { id: 'sso', labelKey: 'admin.sec_sso', icon: KeyRound, color: '#f59e0b' },
    { id: 'email-domains', labelKey: 'admin.sec_email_domains', icon: AtSign, color: '#8b5cf6', superAdminOnly: true },
    { id: 'connector-health', labelKey: 'admin.sec_connector_health', icon: Activity, color: '#14b8a6', superAdminOnly: true },
];

const SecurityHub = ({ activeSection: activeProp = 'users', userSection = '', onNavigate, user }) => {
    const { t } = useTranslation();
    const { hasTier } = useLicenseContext();
    const isEnterprise = hasTier('enterprise');
    // Platform operator only. The 'all' permission is deliberately NOT enough —
    // it is obtainable inside a tenant, and the server-side gates on these
    // sections (SSO config, email domains, connector health) require
    // users.role === 'admin'. See AdminDashboard's isSuperAdmin.
    const isFullAdmin = user?.isAdmin || user?.role === 'admin';
    const visibleSections = (isFullAdmin ? SECTIONS : SECTIONS.filter(s => !s.superAdminOnly && s.id !== 'sso'))
        .filter(s => !s.enterpriseOnly || isEnterprise);
    const VALID_IDS = visibleSections.map(s => s.id);
    const active = VALID_IDS.includes(activeProp) ? activeProp : 'users';

    return (
        <HubScaffold
            sections={visibleSections}
            activeId={active}
            onSelect={(id) => { if (onNavigate) onNavigate(`admin/security/${id}`); }}
            labelFor={(sec) => t(sec.labelKey)}
        >
            {active === 'users' && (
                <div style={{ position: 'absolute', inset: 0 }}>
                    <UserManagement activeSection={userSection} onNavigate={onNavigate} user={user} />
                </div>
            )}
            {active === 'guardrails' && (
                <div style={{ position: 'absolute', inset: 0, overflow: 'auto', padding: '1.5rem' }}>
                    {/* `userSection` is the third admin path segment — the same one
                        ConnectorHealthPanel receives. Threading it here is what makes
                        /app/admin/security/guardrails/<section> a real, bookmarkable
                        URL without touching App.jsx's router. */}
                    <GuardrailsHub section={userSection} onNavigate={onNavigate} />
                </div>
            )}
            {active === 'sso' && (
                <div style={{ position: 'absolute', inset: 0, overflow: 'auto', padding: '1.5rem' }}>
                    <SSOConfigPanel />
                </div>
            )}
            {active === 'email-domains' && (
                <div style={{ position: 'absolute', inset: 0, overflow: 'auto', padding: '1.5rem' }}>
                    <FreeEmailDomainsPanel />
                </div>
            )}
            {active === 'connector-health' && (
                <div style={{ position: 'absolute', inset: 0, overflow: 'auto', padding: '1.5rem' }}>
                    <ConnectorHealthPanel initialOrgId={userSection} onNavigate={onNavigate} />
                </div>
            )}
        </HubScaffold>
    );
};

export default SecurityHub;
