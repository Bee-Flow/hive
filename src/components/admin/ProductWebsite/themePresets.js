// MIRROR of server/i18n/defaults/themePresets.js — the schema of record.
// Browser code cannot import server modules at runtime, so the preset data
// is duplicated here and themePresets.test.js deep-equals the two copies
// (same pattern as BLOCK_DEFAULTS / BLOCK_VARIANTS in blockEditors/catalogue.js).
// Change the SERVER file first, then mirror it here.
//
// Applying a preset MATERIALIZES concrete values onto site.design, so the
// renderer never looks a preset up and editing one here never changes an
// existing site — only what a fresh apply produces.

// Identity values, repeated so a preset always writes a COMPLETE group
// (applyPreset re-clones nested objects, so a missing key would otherwise
// leak through from the previous design).
export const BASE_COMPONENTS = {
    buttonShape: 'soft',
    buttonSize: 'md',
    buttonTextColor: 'light',
    navStyle: 'bar',
    navHeight: 'default',
    logoSize: 'md',
    cardStyle: 'hairline',
    cardPadding: 'default',
    shadow: 'soft',
};
export const BASE_LAYOUT = { containerWidth: 'default', sectionRhythm: 'default' };

export const THEME_PRESETS = [
    {
        id: 'european-warmth',
        label: 'European Warmth',
        description: 'Warm cream canvas, editorial serif display, amber accents. Calm, institutional, privacy-first.',
        design: {
            colors: {
                primary: '#F5A623', secondary: '#1F2937', accent: '#FFD166',
                background: '#FAF8F4', surface: '#F3EFE7',
                textPrimary: '#1C1917', textSecondary: '#57534E',
            },
            darkColors: {
                background: '#101012', surface: '#17171B',
                textPrimary: '#F4F2EE', textSecondary: '#A6A29A',
                primary: '', accent: '',
            },
            fonts: { heading: 'Fraunces', body: 'Inter', mono: 'IBM Plex Mono' },
            radius: 12, theme: 'light', gradient: false, grain: true, motion: 'subtle',
            typography: { displaySize: 'lg', headingWeight: 600, bodySize: 17 },
            components: { ...BASE_COMPONENTS, buttonTextColor: 'dark' },
            layout: { ...BASE_LAYOUT },
        },
    },
    {
        id: 'dark-hive',
        label: 'Dark Hive',
        description: 'Near-black warm canvas, Geist + mono eyebrows, amber glow. Technical sovereignty.',
        design: {
            colors: {
                primary: '#F5A623', secondary: '#1F2937', accent: '#FFC53D',
                background: '#FAF8F4', surface: '#F3EFE7',
                textPrimary: '#1C1917', textSecondary: '#57534E',
            },
            darkColors: {
                background: '#0C0B09', surface: '#141310',
                textPrimary: '#F4F2EE', textSecondary: '#9A958C',
                primary: '', accent: '',
            },
            fonts: { heading: 'Geist', body: 'Geist', mono: 'Geist Mono' },
            radius: 10, theme: 'dark', gradient: false, grain: true, motion: 'full',
            typography: { displaySize: 'xl', headingWeight: 600, bodySize: 16 },
            components: { ...BASE_COMPONENTS, buttonTextColor: 'dark' },
            layout: { ...BASE_LAYOUT },
        },
    },
    {
        id: 'midnight-flow',
        label: 'Midnight Flow',
        description: 'Near-black canvas with a detached floating pill nav, hairline cards and vermilion CTAs. Dark, technical, product-first.',
        design: {
            colors: {
                primary: '#CE3F26', secondary: '#18181B', accent: '#F97316',
                background: '#FFFFFF', surface: '#F4F4F5',
                textPrimary: '#18181B', textSecondary: '#52525B',
            },
            darkColors: {
                background: '#0E0E11', surface: '#17171B',
                textPrimary: '#EDEDF0', textSecondary: '#A1A1AA',
                primary: '', accent: '',
            },
            fonts: { heading: 'Space Grotesk', body: 'Inter', mono: 'JetBrains Mono' },
            radius: 14, theme: 'dark', gradient: false, grain: false, motion: 'full',
            typography: { displaySize: 'xl', headingWeight: 600, bodySize: 16 },
            components: {
                ...BASE_COMPONENTS,
                navStyle: 'floating', navHeight: 'compact', logoSize: 'sm',
                buttonShape: 'pill', shadow: 'none',
            },
            layout: { ...BASE_LAYOUT },
        },
    },
    {
        id: 'editorial-bold',
        label: 'Editorial Bold',
        description: 'Cream canvas, hard-edged bar, zero-radius everything and oversized display type. Loud and typographic.',
        design: {
            colors: {
                primary: '#FA500F', secondary: '#101010', accent: '#FFB000',
                background: '#FAF7F0', surface: '#F0EBE0',
                textPrimary: '#101010', textSecondary: '#4A4744',
            },
            darkColors: {
                background: '#0F0E0C', surface: '#1A1815',
                textPrimary: '#F5F2EB', textSecondary: '#A8A29A',
                primary: '', accent: '',
            },
            fonts: { heading: 'Clash Display', body: 'General Sans', mono: 'IBM Plex Mono' },
            radius: 0, theme: 'light', gradient: false, grain: false, motion: 'subtle',
            typography: { displaySize: 'xl', headingWeight: 700, bodySize: 18 },
            components: {
                ...BASE_COMPONENTS,
                navStyle: 'bordered', navHeight: 'tall', logoSize: 'lg',
                buttonShape: 'sharp', buttonSize: 'lg', buttonTextColor: 'dark',
                cardStyle: 'flat', cardPadding: 'roomy', shadow: 'none',
            },
            layout: { containerWidth: 'wide', sectionRhythm: 'airy' },
        },
    },
    {
        id: 'clean-slate',
        label: 'Clean Slate',
        description: 'White canvas, black pill buttons, flat bento cards and a narrow measure. Minimal and open-source-flavoured.',
        design: {
            colors: {
                primary: '#111111', secondary: '#0A0A0A', accent: '#1D4ED8',
                background: '#FFFFFF', surface: '#F6F6F7',
                textPrimary: '#0A0A0A', textSecondary: '#52525B',
            },
            darkColors: {
                background: '#0B0B0C', surface: '#141416',
                textPrimary: '#FAFAFA', textSecondary: '#A1A1AA',
                // The pill inverts to white-on-dark in dark mode, which a
                // single site-wide value can't express — hence buttonTextColor:'auto'.
                primary: '#FAFAFA', accent: '#60A5FA',
            },
            fonts: { heading: 'Inter', body: 'Inter', mono: 'JetBrains Mono' },
            radius: 14, theme: 'light', gradient: false, grain: false, motion: 'subtle',
            typography: { displaySize: 'lg', headingWeight: 600, bodySize: 17 },
            components: {
                ...BASE_COMPONENTS,
                buttonShape: 'pill', buttonTextColor: 'auto',
                cardStyle: 'flat', shadow: 'none',
            },
            layout: { containerWidth: 'narrow', sectionRhythm: 'default' },
        },
    },
    {
        id: 'gradient-pop',
        label: 'Gradient Pop',
        description: 'White canvas with violet-to-magenta gradient pills and soft rounded cards. Friendly and consumer-facing.',
        design: {
            colors: {
                primary: '#7A2BD6', secondary: '#17151F', accent: '#D01A8E',
                background: '#FFFFFF', surface: '#F7F5FB',
                textPrimary: '#17151F', textSecondary: '#57536B',
            },
            darkColors: {
                background: '#100C18', surface: '#1A1526',
                textPrimary: '#F5F2FA', textSecondary: '#A9A2BC',
                primary: '', accent: '',
            },
            fonts: { heading: 'Cabinet Grotesk', body: 'DM Sans', mono: 'IBM Plex Mono' },
            radius: 18, theme: 'light', gradient: true, grain: false, motion: 'full',
            typography: { displaySize: 'lg', headingWeight: 600, bodySize: 17 },
            components: {
                ...BASE_COMPONENTS,
                buttonShape: 'pill', buttonSize: 'lg',
                cardStyle: 'soft', cardPadding: 'roomy', shadow: 'medium',
            },
            layout: { ...BASE_LAYOUT },
        },
    },
    {
        id: 'enterprise',
        label: 'Enterprise',
        description: 'Corporate blue, rounded-rect buttons, elevated cards and a wide frame. Familiar to procurement.',
        design: {
            colors: {
                primary: '#0B5CD5', secondary: '#0F172A', accent: '#0EA5E9',
                background: '#FFFFFF', surface: '#F3F6FB',
                textPrimary: '#111827', textSecondary: '#4B5563',
            },
            darkColors: {
                background: '#0B1220', surface: '#131C2E',
                textPrimary: '#E8EDF5', textSecondary: '#9AA6BA',
                primary: '', accent: '',
            },
            fonts: { heading: 'Manrope', body: 'Inter', mono: 'IBM Plex Mono' },
            radius: 6, theme: 'light', gradient: false, grain: false, motion: 'subtle',
            typography: { displaySize: 'md', headingWeight: 700, bodySize: 16 },
            components: {
                ...BASE_COMPONENTS,
                navStyle: 'bordered', navHeight: 'tall',
                buttonShape: 'rounded', cardStyle: 'elevated', shadow: 'medium',
            },
            layout: { containerWidth: 'wide', sectionRhythm: 'default' },
        },
    },
    {
        id: 'soft-focus',
        label: 'Soft Focus',
        description: 'Airy blue canvas, very large radii, floating nav and generous spacing. Calm and app-like.',
        design: {
            colors: {
                primary: '#1567D3', secondary: '#1F2430', accent: '#7CB2F0',
                background: '#FBFCFE', surface: '#EDF2FB',
                textPrimary: '#1F2430', textSecondary: '#4E5567',
            },
            darkColors: {
                background: '#0E1116', surface: '#171B22',
                textPrimary: '#E7EAF0', textSecondary: '#A0A7B4',
                primary: '', accent: '',
            },
            fonts: { heading: 'Satoshi', body: 'DM Sans', mono: 'Geist Mono' },
            radius: 24, theme: 'light', gradient: false, grain: false, motion: 'subtle',
            typography: { displaySize: 'xl', headingWeight: 500, bodySize: 18 },
            components: {
                ...BASE_COMPONENTS,
                navStyle: 'floating', navHeight: 'tall', logoSize: 'lg',
                buttonShape: 'pill', buttonSize: 'lg',
                cardStyle: 'soft', cardPadding: 'roomy',
            },
            layout: { containerWidth: 'narrow', sectionRhythm: 'airy' },
        },
    },
];

export const THEME_PRESET_IDS = THEME_PRESETS.map(p => p.id);

// Merge a preset over the current design. Nested objects are re-cloned so a
// key the preset omits cannot leak through from the previous design.
// Logo/favicon (site identity) are deliberately preserved. Returns ONE
// object so the panel commits a single history entry and a single save.
export function applyPreset(currentDesign, preset) {
    const d = currentDesign || {};
    return {
        ...d,
        ...preset.design,
        colors:     { ...preset.design.colors },
        darkColors: { ...preset.design.darkColors },
        fonts:      { ...preset.design.fonts },
        typography: { ...preset.design.typography },
        components: { ...preset.design.components },
        layout:     { ...preset.design.layout },
        logo:    d.logo    || '',
        favicon: d.favicon || '',
        preset:  preset.id,
    };
}
