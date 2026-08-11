import { describe, it, expect } from 'vitest';
import { themeVars, bestContrast, APP_COLOR_PRESETS } from './themeVars';

// hex → hue (degrees) — local to the test so preset checks don't depend on
// any runtime helper being correct.
function hexToHue(hex) {
    const n = parseInt(hex.slice(1), 16);
    const r = ((n >> 16) & 0xff) / 255;
    const g = ((n >> 8) & 0xff) / 255;
    const b = (n & 0xff) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    if (d === 0) return 0;
    let h;
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    return (h + 360) % 360;
}

describe('themeVars', () => {
    it('maps every radius enum value', () => {
        const expected = { none: '0px', sm: '4px', md: '8px', lg: '12px', xl: '16px' };
        for (const [radius, px] of Object.entries(expected)) {
            expect(themeVars({ radius })['--app-radius']).toBe(px);
        }
    });

    it('maps every density to its multiplier', () => {
        expect(themeVars({ density: 'compact' })['--app-space']).toBe('0.75');
        expect(themeVars({ density: 'comfortable' })['--app-space']).toBe('1');
        expect(themeVars({ density: 'spacious' })['--app-space']).toBe('1.25');
    });

    it('maps every fontScale to a root font size', () => {
        expect(themeVars({ fontScale: 'sm' }).fontSize).toBe('14px');
        expect(themeVars({ fontScale: 'md' }).fontSize).toBe('15px');
        expect(themeVars({ fontScale: 'lg' }).fontSize).toBe('16px');
    });

    it('falls back to schema defaults for a missing/partial theme', () => {
        const vars = themeVars(undefined);
        expect(vars['--app-primary']).toBe('#0F766E');
        expect(vars['--app-radius']).toBe('8px');
        expect(vars['--app-space']).toBe('1');
        expect(vars.fontSize).toBe('15px');
    });

    it('derives primary, soft tint and contrast from the theme primary', () => {
        const vars = themeVars({ primary: '#B91C1C' });
        expect(vars['--app-primary']).toBe('#B91C1C');
        expect(vars['--app-primary-soft']).toBe('rgba(185, 28, 28, 0.1)');
        expect(vars['--app-primary-contrast']).toBe('#ffffff');
    });

    it('bestContrast flips between black and white', () => {
        expect(bestContrast('#0F766E')).toBe('#ffffff'); // dark teal → white text
        expect(bestContrast('#1D4ED8')).toBe('#ffffff'); // blue → white text
        expect(bestContrast('#000000')).toBe('#ffffff');
        expect(bestContrast('#ffffff')).toBe('#000000');
        expect(bestContrast('#FDE68A')).toBe('#000000'); // pale amber → black text
        expect(bestContrast('#4D7C0F')).toBe('#ffffff'); // lime preset is still dark
    });

    it('every color preset hue stays outside the purple band (250–290°)', () => {
        expect(APP_COLOR_PRESETS.length).toBeGreaterThan(0);
        for (const hex of APP_COLOR_PRESETS) {
            expect(hex).toMatch(/^#[0-9a-fA-F]{6}$/);
            const hue = hexToHue(hex);
            const inPurpleBand = hue >= 250 && hue <= 290;
            expect(inPurpleBand, `${hex} (hue ${hue.toFixed(1)}°) must not be purple/violet/indigo`).toBe(false);
        }
    });
});
