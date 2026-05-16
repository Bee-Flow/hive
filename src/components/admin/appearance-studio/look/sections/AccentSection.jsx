import React from 'react';
import ColorPicker from '../../../../shared/ColorPicker';
import { SECTION_IDS } from '../useLookForm';

// Accent presets — deliberately avoid purple/violet (banned brand-wide).
export const ACCENT_PRESETS = [
    '#9ca3af', // neutral gray (default)
    '#3b82f6', // blue
    '#06b6d4', // cyan
    '#10b981', // emerald
    '#f59e0b', // amber
    '#ef4444', // red
];

export default function AccentSection({ form, setForm, saving }) {
    return (
        <section
            id={SECTION_IDS.accent}
            aria-labelledby={`${SECTION_IDS.accent}-heading`}
        >
            <h3
                id={`${SECTION_IDS.accent}-heading`}
                className="text-base font-semibold mb-1"
                style={{ color: 'var(--text-primary)' }}
            >
                Accent colour
            </h3>
            <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
                Used for primary buttons, selected items, focus rings, and active states.
            </p>
            <ColorPicker
                value={form.accent}
                onChange={(hex) => setForm((f) => ({ ...f, accent: hex }))}
                presets={ACCENT_PRESETS}
                disabled={saving}
                ariaLabel="Accent colour"
            />
        </section>
    );
}
