import React from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { Bot, Settings } from 'lucide-react';
import AgentDesigner from './AgentDesigner';

/**
 * AgentConfigHub — Unified agent configuration page
 * Wraps all  agent-type panels behind a compact left sidebar.
 */
const SECTIONS = [
    { id: 'chat', labelKey: 'admin.agents_chat', icon: Bot, color: '#6366f1' },
    { id: 'system', labelKey: 'admin.agents_system', icon: Settings, color: '#8b5cf6' },
];

const AgentConfigHub = ({ hasPermission = () => true, user, activeSection = '', onNavigate }) => {
    const { t } = useTranslation();
    const SECTION_TO_TYPE = { chat: 'chat', system: 'system' };

    const isSuperAdmin = user?.isAdmin || user?.role === 'admin' || (user?.permissions || []).includes('all');
    const allowedTypes = user?.allowedAgentTypes || [];
    const hasRestrictions = !isSuperAdmin && allowedTypes.length > 0;

    const visibleSections = hasRestrictions
        ? SECTIONS.filter(s => allowedTypes.includes(SECTION_TO_TYPE[s.id]))
        : SECTIONS;

    const VALID_IDS = visibleSections.map(s => s.id);
    const active = VALID_IDS.includes(activeSection) ? activeSection : (VALID_IDS[0] || 'chat');

    const handleClick = (id) => {
        if (onNavigate) onNavigate(`admin/${id}`);
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
                overflowY: 'auto',
            }}>
                {visibleSections.map(sec => {
                    const Icon = sec.icon;
                    const isActive = active === sec.id;
                    return (
                        <button
                            key={sec.id}
                            onClick={() => handleClick(sec.id)}
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
                                background: isActive
                                    ? `${sec.color}20`
                                    : 'transparent',
                                borderLeft: isActive
                                    ? `3px solid ${sec.color}`
                                    : '3px solid transparent',
                            }}
                        >
                            <Icon
                                style={{
                                    width: 20,
                                    height: 20,
                                    color: isActive ? sec.color : 'var(--text-muted, #888)',
                                    transition: 'color 0.15s ease',
                                }}
                            />
                            <span style={{
                                fontSize: '9px',
                                fontWeight: isActive ? '700' : '500',
                                color: isActive ? sec.color : 'var(--text-muted, #888)',
                                textAlign: 'center',
                                lineHeight: 1.1,
                                transition: 'color 0.15s ease',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                maxWidth: '48px',
                            }}>
                                {t(sec.labelKey).split(' ')[0]}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* ── Main Panel ── */}
            <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
                {active === 'chat' && (
                    <div style={{ position: 'absolute', inset: 0 }}>
                        <AgentDesigner onBack={null} hasPermission={hasPermission} />
                    </div>
                )}
                {active === 'system' && (
                    <div style={{ position: 'absolute', inset: 0 }}>
                        <AgentDesigner key="system-agents" onBack={null} systemMode={true} hasPermission={hasPermission} />
                    </div>
                )}

            </div>
        </div>
    );
};

export default AgentConfigHub;
