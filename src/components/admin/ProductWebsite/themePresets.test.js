/**
 * Unit — every theme preset must survive the server's sanitizeDesign()
 * whitelist field-for-field: a preset field the server would drop or
 * coerce means "preview shows it, publish loses it". We assert against
 * the server schema of record directly.
 *
 * Run: cd agent-hub && npx vitest run src/components/admin/ProductWebsite/themePresets.test.js
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { THEME_PRESETS, applyPreset } from './themePresets';

const require = createRequire(import.meta.url);
const {
    DESIGN_DEFAULTS, DESIGN_COMPONENT_ENUMS, DESIGN_LAYOUT_ENUMS, DESIGN_FONTS,
} = require('../../../../../server/i18n/defaults/cmsDefaults.js');
const serverPresets = require('../../../../../server/i18n/defaults/themePresets.js');

describe('themePresets', () => {
    it('the client mirror is byte-equal to the server schema of record', () => {
        // Browser code can't import the server module at runtime, so the
        // preset data is duplicated. If these drift, the AI could apply a
        // theme by name that looks different from the editor's gallery.
        expect(THEME_PRESETS).toEqual(serverPresets.THEME_PRESETS);
    });

    it('presets only use fields the server DesignDoc knows', () => {
        const knownKeys = new Set([...Object.keys(DESIGN_DEFAULTS), 'preset']);
        for (const p of THEME_PRESETS) {
            for (const key of Object.keys(p.design)) {
                expect(knownKeys.has(key), `${p.id}.design.${key} unknown to DESIGN_DEFAULTS`).toBe(true);
            }
            for (const group of ['colors', 'darkColors', 'fonts', 'components', 'layout']) {
                expect(Object.keys(p.design[group]).sort(), `${p.id}.design.${group}`)
                    .toEqual(Object.keys(DESIGN_DEFAULTS[group]).sort());
            }
        }
    });

    it('enum fields sit inside sanitizeDesign() accepted sets', () => {
        for (const p of THEME_PRESETS) {
            expect(['light', 'dark']).toContain(p.design.theme);
            expect(['none', 'subtle', 'full']).toContain(p.design.motion);
            expect(['md', 'lg', 'xl']).toContain(p.design.typography.displaySize);
            expect([500, 600, 700]).toContain(p.design.typography.headingWeight);
            expect([16, 17, 18]).toContain(p.design.typography.bodySize);
            expect(p.design.radius).toBeGreaterThanOrEqual(0);
            // Server clamps at 24 even though the renderer accepts 48.
            expect(p.design.radius).toBeLessThanOrEqual(24);
            expect(typeof p.design.gradient).toBe('boolean');
            expect(typeof p.design.grain).toBe('boolean');
            for (const [key, allowed] of Object.entries(DESIGN_COMPONENT_ENUMS)) {
                expect(allowed, `${p.id}.components.${key}`).toContain(p.design.components[key]);
            }
            for (const [key, allowed] of Object.entries(DESIGN_LAYOUT_ENUMS)) {
                expect(allowed, `${p.id}.layout.${key}`).toContain(p.design.layout[key]);
            }
        }
    });

    it('every preset font is on the server allowlist', () => {
        // An unknown family persists silently, 404s against Google Fonts and
        // falls back to a system face with no error anywhere.
        for (const p of THEME_PRESETS) {
            for (const role of ['heading', 'body', 'mono']) {
                expect(DESIGN_FONTS, `${p.id}.fonts.${role}`).toContain(p.design.fonts[role]);
            }
        }
    });

    it('body text and button labels meet WCAG AA in every preset', () => {
        const lum = (hex) => {
            let h = String(hex).replace('#', '');
            if (h.length === 3) h = h.split('').map(c => c + c).join('');
            const ch = (i) => {
                const c = parseInt(h.slice(i * 2, i * 2 + 2), 16) / 255;
                return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
            };
            return 0.2126 * ch(0) + 0.7152 * ch(1) + 0.0722 * ch(2);
        };
        const ratio = (a, b) => {
            const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
            return (x + 0.05) / (y + 0.05);
        };
        for (const p of THEME_PRESETS) {
            const c = p.design.colors;
            expect(ratio(c.textPrimary, c.background), `${p.id} body text`).toBeGreaterThanOrEqual(4.5);
            const dk = p.design.darkColors;
            expect(ratio(dk.textPrimary, dk.background), `${p.id} dark body text`).toBeGreaterThanOrEqual(4.5);
            // Button label: 'auto' is resolved at render time from the
            // primary's luminance, so it is safe by construction.
            const fg = p.design.components.buttonTextColor;
            if (fg === 'light' || fg === 'dark') {
                const label = fg === 'dark' ? '#0B0B0C' : '#ffffff';
                expect(ratio(label, c.primary), `${p.id} button label on primary`).toBeGreaterThanOrEqual(4.5);
            }
        }
    });

    it('applyPreset materializes values, tags provenance, and preserves site identity', () => {
        const current = { logo: 'cms/logo.png', favicon: 'cms/fav.png', colors: { primary: '#123456' } };
        const next = applyPreset(current, THEME_PRESETS[0]);
        expect(next.preset).toBe('european-warmth');
        expect(next.logo).toBe('cms/logo.png');
        expect(next.favicon).toBe('cms/fav.png');
        expect(next.colors.primary).toBe(THEME_PRESETS[0].design.colors.primary);
        // Fresh objects — applying a preset must never alias preset data.
        expect(next.colors).not.toBe(THEME_PRESETS[0].design.colors);
    });
});
