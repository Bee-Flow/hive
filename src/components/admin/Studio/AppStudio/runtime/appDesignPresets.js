/**
 * Client mirror of server/appStudio/appDesignPresets.js — the preset gallery's
 * data. Byte-equal with the server copy, pinned by appDesignPresets.sync.test.js
 * (themePresets sync-test pattern). Edit BOTH or the test fails.
 */

export const APP_DESIGN_PRESETS = [
    {
        id: 'classic',
        name: 'Classic',
        description: 'The familiar look — calm, light and compact enough for any team.',
        theme: { primary: '#0F766E', radius: 'md', density: 'comfortable', fontScale: 'md', appearance: 'auto' },
        design: { preset: 'classic', font: 'system', surface: 'hairline', motion: 'subtle', chartPalette: 'classic', logoUrl: null },
        navStyle: 'tabs',
    },
    {
        id: 'cloud',
        name: 'Cloud',
        description: 'Modern B2B SaaS: light and airy, soft cards, navigation in a sidebar.',
        theme: { primary: '#1D4ED8', radius: 'lg', density: 'comfortable', fontScale: 'md', appearance: 'light' },
        design: { preset: 'cloud', font: 'satoshi', surface: 'soft', motion: 'full', chartPalette: 'brand', logoUrl: null },
        navStyle: 'sidebar',
    },
    {
        id: 'atlas',
        name: 'Atlas',
        description: 'A product, not a form: a top bar whose menus open with a line about each screen.',
        theme: { primary: '#0369A1', radius: 'lg', density: 'comfortable', fontScale: 'md', appearance: 'auto' },
        design: { preset: 'atlas', font: 'satoshi', surface: 'soft', motion: 'full', chartPalette: 'brand', logoUrl: null },
        navStyle: 'mega',
    },
    {
        id: 'midnight',
        name: 'Midnight',
        description: 'A dark ops console — technical, focused, built for long sessions.',
        theme: { primary: '#0891B2', radius: 'md', density: 'compact', fontScale: 'md', appearance: 'dark' },
        design: { preset: 'midnight', font: 'geist', surface: 'soft', motion: 'subtle', chartPalette: 'brand', logoUrl: null },
        navStyle: 'rail',
    },
    {
        id: 'field',
        name: 'Field',
        description: 'A friendly field-service app: big buttons, plenty of air, mobile first.',
        theme: { primary: '#047857', radius: 'xl', density: 'spacious', fontScale: 'lg', appearance: 'light' },
        design: { preset: 'field', font: 'general-sans', surface: 'soft', motion: 'subtle', chartPalette: 'brand', logoUrl: null },
        navStyle: 'tabs',
    },
    {
        id: 'paper',
        name: 'Paper',
        description: 'Warm and editorial — a back office that reads like a well-set document.',
        theme: { primary: '#B45309', radius: 'sm', density: 'comfortable', fontScale: 'md', appearance: 'light' },
        design: { preset: 'paper', font: 'cabinet', surface: 'hairline', motion: 'subtle', chartPalette: 'classic', logoUrl: null },
        navStyle: 'tabs',
    },
    {
        id: 'mono',
        name: 'Mono',
        description: 'A dense, businesslike expert tool — no frills, maximum information density.',
        theme: { primary: '#334155', radius: 'sm', density: 'compact', fontScale: 'sm', appearance: 'auto' },
        design: { preset: 'mono', font: 'plex', surface: 'flat', motion: 'none', chartPalette: 'classic', logoUrl: null },
        navStyle: 'tabs',
    },
];

export function getAppDesignPreset(id) {
    return APP_DESIGN_PRESETS.find((p) => p.id === id) || null;
}
