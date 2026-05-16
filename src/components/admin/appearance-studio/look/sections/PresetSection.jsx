import { Sun, Moon, Sparkles, Eye, Palette, FileText, Gem, BookOpen } from 'lucide-react';
import React from 'react';
import { THEME_PRESETS } from '../../../../ThemeContext';
import PresetCard from '../../shared/PresetCard';
import { SECTION_IDS } from '../useLookForm';

const PRESET_ICONS = {
    light: Sun,
    dark: Moon,
    glass: Sparkles,
    'glass-dark': Sparkles,
    paper: FileText,
    obsidian: Gem,
    sepia: BookOpen,
    'high-contrast': Eye,
    custom: Palette,
};

const PRESET_HINTS = {
    light: 'Clean, bright surfaces. Good for daytime use.',
    dark: 'Low-glare dark surfaces. Easier on the eyes at night.',
    glass: 'Translucent iOS-style Liquid Glass panels with frosted blur.',
    'glass-dark': 'Dark Liquid Glass — glowing colour over a deep night backdrop.',
    paper: 'Warm editorial light. Off-white pages, espresso text.',
    obsidian: 'Monochrome carbon dark. Hairline borders, warm-pearl accents.',
    sepia: 'Warm tan paper with deep-brown ink. Best for long reading sessions.',
    'high-contrast': 'WCAG AAA contrast pairs. Best for accessibility.',
    custom: 'Start from the active preset; tweak accent, radius and font.',
};

export default function PresetSection({ form, setForm, saving }) {
    return (
        <section
            id={SECTION_IDS.preset}
            aria-labelledby={`${SECTION_IDS.preset}-heading`}
        >
            <SectionHeading id={`${SECTION_IDS.preset}-heading`}>Preset</SectionHeading>
            <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
                Pick the base look. Everything below adjusts within it.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {THEME_PRESETS.map((p) => (
                    <PresetCard
                        key={p.id}
                        id={p.id}
                        label={p.label}
                        Icon={PRESET_ICONS[p.id] || Palette}
                        hint={PRESET_HINTS[p.id]}
                        selected={form.preset === p.id}
                        disabled={saving}
                        onSelect={(id) => setForm((f) => ({ ...f, preset: id }))}
                    />
                ))}
            </div>
        </section>
    );
}

function SectionHeading({ id, children }) {
    return (
        <h3
            id={id}
            className="text-base font-semibold mb-1"
            style={{ color: 'var(--text-primary)' }}
        >
            {children}
        </h3>
    );
}
