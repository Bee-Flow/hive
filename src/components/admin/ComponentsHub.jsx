import React from 'react';
import { Puzzle, Palette } from 'lucide-react';
import ComponentBuilder from './ComponentBuilder';
import RenderingConfigPanel from './RenderingConfigPanel';

/**
 * ComponentsHub — Unified components & rendering configuration page
 */
const SECTIONS = [
    { id: 'components', label: 'Components', icon: Puzzle, color: '#6366f1' },
    { id: 'rendering', label: 'Rendering', icon: Palette, color: '#ec4899' },
];

const ComponentsHub = ({ hasPermission = () => true, activeSection = '', onNavigate }) => {
    const VALID_IDS = SECTIONS.map(s => s.id);
    const active = VALID_IDS.includes(activeSection) ? activeSection : 'components';

    const handleClick = (id) => {
        if (onNavigate) onNavigate(`admin/components/${id}`);
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
                {SECTIONS.map(sec => {
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
                                {sec.label}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* ── Main Panel ── */}
            <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
                {active === 'components' && (
                    <div style={{ position: 'absolute', inset: 0 }}>
                        <ComponentBuilder onBack={null} hasPermission={hasPermission} />
                    </div>
                )}
                {active === 'rendering' && (
                    <div style={{ position: 'absolute', inset: 0 }}>
                        <RenderingConfigPanel />
                    </div>
                )}
            </div>
        </div>
    );
};

export default ComponentsHub;
