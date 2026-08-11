import React from 'react';
import { Puzzle, Palette } from 'lucide-react';
import ComponentBuilder from './ComponentBuilder';
import RenderingConfigPanel from './RenderingConfigPanel';
import HubScaffold from './shared/HubScaffold';

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

    return (
        <HubScaffold
            sections={SECTIONS}
            activeId={active}
            onSelect={(id) => { if (onNavigate) onNavigate(`admin/components/${id}`); }}
            labelFor={(sec) => sec.label}
        >
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
        </HubScaffold>
    );
};

export default ComponentsHub;
