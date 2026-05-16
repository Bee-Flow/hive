import { Palette, Package } from 'lucide-react';
import React, { useState } from 'react';
import IconsEditor from './icons/IconsEditor';
import LookEditor from './look/LookEditor';
import Tabs from '../../shared/Tabs';

/**
 * AppearancePanel — top-level admin Appearance shell. Two tabs only: **Look**
 * (theme + wallpaper merged into a single scrolling editor) and **Icons**
 * (asset management — kept separate because its UX is a different domain).
 *
 * Replaces the previous three-tab structure (Theme / Wallpaper / Icons) that
 * artificially split tightly-related controls.
 */
const TABS = [
    { id: 'look',  label: 'Look',  icon: <Palette className="w-4 h-4" /> },
    { id: 'icons', label: 'Icons', icon: <Package className="w-4 h-4" /> },
];

export default function AppearancePanel() {
    const [active, setActive] = useState('look');

    return (
        <div
            className="h-full flex flex-col overflow-hidden"
            style={{ background: 'var(--bg-primary)' }}
        >
            <div
                className="px-4 pt-3 shrink-0"
                style={{ background: 'var(--bg-primary)' }}
            >
                <Tabs
                    value={active}
                    onChange={setActive}
                    items={TABS}
                    ariaLabel="Appearance sections"
                />
            </div>
            <div className="flex-1 min-h-0">
                {active === 'look' ? <LookEditor /> : <IconsEditor />}
            </div>
        </div>
    );
}
