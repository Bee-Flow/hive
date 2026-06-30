import React from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { Shield, KeyRound, Users } from 'lucide-react';
import GuardrailsPanel from './GuardrailsPanel';
import SSOConfigPanel from './SSOConfigPanel';
import UserManagement from './UserManagement';
import { useLicenseContext } from '../LicenseContext';

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
];

const SecurityHub = ({ activeSection: activeProp = 'users', userSection = '', onNavigate, user }) => {
    const { t } = useTranslation();
    const { hasTier } = useLicenseContext();
    const isEnterprise = hasTier('enterprise');
    const isFullAdmin = user?.permissions?.includes('all') || user?.isAdmin;
    const visibleSections = (isFullAdmin ? SECTIONS : SECTIONS.filter(s => !s.superAdminOnly && s.id !== 'sso'))
        .filter(s => !s.enterpriseOnly || isEnterprise);
    const VALID_IDS = visibleSections.map(s => s.id);
    const active = VALID_IDS.includes(activeProp) ? activeProp : 'users';

    const handleSectionClick = (sectionId) => {
        if (onNavigate) {
            onNavigate(`admin/security/${sectionId}`);
        }
    };

    return (
        <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
            {/* ── Left Sidebar ── */}
            <div style={{
                width: '56px',
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                padding: '8px 0',
                background: 'var(--bg-secondary, #111)',
                borderRight: '1px solid var(--border-default, rgba(255,255,255,0.08))',
            }}>
                {visibleSections.map(sec => {
                    const Icon = sec.icon;
                    const isActive = active === sec.id;
                    return (
                        <button
                            key={sec.id}
                            onClick={() => handleSectionClick(sec.id)}
                            title={t(sec.labelKey)}
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '3px',
                                padding: '10px 4px',
                                margin: '0 4px',
                                borderRadius: '8px',
                                border: 'none',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                background: isActive ? `${sec.color}20` : 'transparent',
                                borderLeft: isActive ? `3px solid ${sec.color}` : '3px solid transparent',
                            }}
                        >
                            <Icon style={{
                                width: 20, height: 20,
                                color: isActive ? sec.color : 'var(--text-muted, #888)',
                                transition: 'color 0.15s ease',
                            }} />
                            <span style={{
                                fontSize: '9px',
                                fontWeight: isActive ? '700' : '500',
                                color: isActive ? sec.color : 'var(--text-muted, #888)',
                                textAlign: 'center',
                                lineHeight: 1.1,
                                transition: 'color 0.15s ease',
                            }}>
                                {t(sec.labelKey)}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* ── Main Panel ── */}
            <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
                {active === 'users' && (
                    <div style={{ position: 'absolute', inset: 0 }}>
                        <UserManagement activeSection={userSection} onNavigate={onNavigate} user={user} />
                    </div>
                )}
                {active === 'guardrails' && (
                    <div style={{ position: 'absolute', inset: 0, overflow: 'auto', padding: '1.5rem' }}>
                        <GuardrailsPanel />
                    </div>
                )}
                {active === 'sso' && (
                    <div style={{ position: 'absolute', inset: 0, overflow: 'auto', padding: '1.5rem' }}>
                        <SSOConfigPanel />
                    </div>
                )}
            </div>
        </div>
    );
};

export default SecurityHub;
