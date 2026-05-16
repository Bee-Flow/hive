import React from 'react';

/**
 * Small visual swatch shown inside theme-preset radio cards. Each preset has
 * its own palette + composition; glass uses a tinted card with backdrop-blur
 * to hint at what the real theme will look like.
 *
 * Used by both the admin Theme sub-panel and the user-facing Appearance
 * section in Settings — kept in a shared location so they never drift.
 */
export default function PresetSwatch({ preset }) {
    const palettes = {
        light:           ['#fafafa', '#f3f3f3', '#ffffff'],
        dark:            ['#0f0f13', '#16161d', '#1a1a24'],
        glass:           ['rgba(255,255,255,0.55)', 'rgba(255,255,255,0.30)', '#a8b5d9'],
        'glass-dark':    ['rgba(15,23,42,0.65)', 'rgba(15,23,42,0.40)', '#0a0e1a'],
        paper:           ['#fdfcf8', '#b45309', '#ffffff'],
        obsidian:        ['#0a0a0c', '#e7e5e4', '#131316'],
        sepia:           ['#f4ede0', '#c2410c', '#fbf6ec'],
        'high-contrast': ['#000000', '#ffd400', '#ffffff'],
        custom:          ['var(--bg-primary)', 'var(--accent-primary)', 'var(--bg-card)'],
    };
    const colors = palettes[preset] || palettes.custom;
    const isGlass = preset === 'glass' || preset === 'glass-dark';
    const isGlassDark = preset === 'glass-dark';

    return (
        <div
            className="h-12 rounded-lg border overflow-hidden relative"
            style={{
                borderColor: 'var(--border-subtle)',
                background: isGlassDark
                    ? 'radial-gradient(circle at 30% 30%, rgba(251,191,36,0.6), transparent 50%), radial-gradient(circle at 70% 70%, rgba(244,114,182,0.55), transparent 50%), #0a0e1a'
                    : isGlass
                        ? 'linear-gradient(135deg, #fbbf24 0%, #f472b6 35%, #06b6d4 70%, #10b981 100%)'
                        : colors[0],
            }}
        >
            <div
                className="absolute inset-2 rounded-md flex items-center gap-1.5"
                style={{
                    background: colors[2] === '#ffffff' ? 'rgba(255, 255, 255, 0.9)' : colors[2],
                    backdropFilter: isGlass ? 'blur(10px) saturate(180%)' : 'none',
                    WebkitBackdropFilter: isGlass ? 'blur(10px) saturate(180%)' : 'none',
                    boxShadow: isGlass
                        ? 'inset 0 1px 0 rgba(255,255,255,0.7), 0 2px 8px rgba(15,23,42,0.12)'
                        : 'none',
                    padding: '0 8px',
                    border: isGlass ? '1px solid rgba(255,255,255,0.4)' : 'none',
                }}
            >
                <div className="w-2 h-2 rounded-full" style={{ background: colors[1] }} />
                <div className="flex-1 h-1.5 rounded-full" style={{ background: colors[1], opacity: 0.6 }} />
            </div>
        </div>
    );
}
