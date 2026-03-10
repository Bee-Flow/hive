import React from 'react';
import { Bot, Bug, Globe, Settings, Workflow, Users, Terminal, Shield } from 'lucide-react';
import AgentDesigner from './AgentDesigner';
import SwarmManager from '../../pages/SwarmManager';
import BrowserAgentManager from '../../pages/BrowserAgentManager';
import MultiAgentConfig from '../../pages/MultiAgentConfig';
import GroupChatManager from '../../pages/GroupChatManager';
import TerminalAgentManager from '../../pages/TerminalAgentManager';
import SecurityAgentManager from '../../pages/SecurityAgentManager';

/**
 * AgentConfigHub — Unified agent configuration page
 * Wraps all agent-type panels behind a compact left sidebar.
 */
const SECTIONS = [
    { id: 'chat', label: 'Agent', icon: Bot, color: '#6366f1' },
    { id: 'swarm', label: 'Swarm Agents', icon: Bug, color: '#f59e0b' },
    { id: 'browser', label: 'Browser Agents', icon: Globe, color: '#10b981' },
    { id: 'terminal', label: 'Terminal Agents', icon: Terminal, color: '#22c55e' },
    { id: 'sec-agents', label: 'Security Agents', icon: Shield, color: '#ef4444' },
    { id: 'group', label: 'Round Table', icon: Users, color: '#3b82f6' },
    { id: 'system', label: 'System Agents', icon: Settings, color: '#8b5cf6' },
    { id: 'pipeline', label: 'Pipeline', icon: Workflow, color: '#06b6d4' },
];

const AgentConfigHub = ({ hasPermission = () => true, user, activeSection = '', onNavigate }) => {
    // Map section IDs to agent type keys used in allowedAgentTypes
    const SECTION_TO_TYPE = { chat: 'chat', swarm: 'swarm', browser: 'browser', terminal: 'terminal', 'sec-agents': 'security', group: 'roundtable', system: 'system', pipeline: 'pipeline' };

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
                            title={sec.label}
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
                                {sec.label.split(' ')[0]}
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
                {active === 'swarm' && (
                    <div style={{ position: 'absolute', inset: 0 }}>
                        <SwarmManager onBack={null} />
                    </div>
                )}
                {active === 'browser' && (
                    <div style={{ position: 'absolute', inset: 0 }}>
                        <BrowserAgentManager onBack={null} />
                    </div>
                )}
                {active === 'terminal' && (
                    <div style={{ position: 'absolute', inset: 0 }}>
                        <TerminalAgentManager onBack={null} />
                    </div>
                )}
                {active === 'sec-agents' && (
                    <div style={{ position: 'absolute', inset: 0 }}>
                        <AgentDesigner key="security-agents" onBack={null} securityMode={true} hasPermission={hasPermission} />
                    </div>
                )}
                {active === 'group' && (
                    <div style={{ position: 'absolute', inset: 0 }}>
                        <GroupChatManager onBack={null} />
                    </div>
                )}
                {active === 'system' && (
                    <div style={{ position: 'absolute', inset: 0 }}>
                        <AgentDesigner key="system-agents" onBack={null} systemMode={true} hasPermission={hasPermission} />
                    </div>
                )}
                {active === 'pipeline' && (
                    <div style={{ position: 'absolute', inset: 0, overflow: 'auto', padding: '1.5rem' }}>
                        <MultiAgentConfig embedded={true} />
                    </div>
                )}
            </div>
        </div>
    );
};

export default AgentConfigHub;
