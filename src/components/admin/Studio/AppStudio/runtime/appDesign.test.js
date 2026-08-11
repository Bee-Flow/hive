/**
 * App Design v2 runtime helpers — identity discipline + the noPurple contract
 * for the derived chart palette.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import {
    appDesignProps, brandPalette, isBannedHue,
    DESIGN_ENUMS, DESIGN_DEFAULTS, NAV_STYLES, NAV_DEFAULT_STYLE, FONT_STACKS,
} from './appDesign';

const require = createRequire(import.meta.url);
const serverSpec = require('../../../../../../../server/appStudio/appDesignSpec');

describe('appDesign mirrors', () => {
    it('enums mirror the server spec exactly', () => {
        for (const [key, spec] of Object.entries(serverSpec.DESIGN_SPEC)) {
            if (spec.type !== 'enum') continue;
            expect(DESIGN_ENUMS[key]).toEqual(spec.values);
            expect(DESIGN_DEFAULTS[key]).toBe(spec.default);
        }
        expect(DESIGN_DEFAULTS.logoUrl).toBe(serverSpec.DESIGN_SPEC.logoUrl.default);
        expect(NAV_STYLES).toEqual(serverSpec.NAV_STYLES);
        expect(NAV_DEFAULT_STYLE).toBe(serverSpec.NAV_DEFAULT_STYLE);
        expect(Object.keys(FONT_STACKS)).toEqual(Object.keys(serverSpec.FONT_FAMILIES));
    });
});

describe('appDesignProps identity discipline', () => {
    it('absent design emits nothing', () => {
        expect(appDesignProps({})).toEqual({ className: '', style: {} });
        expect(appDesignProps(undefined)).toEqual({ className: '', style: {} });
    });

    it('an all-default design emits nothing (absent ≡ default)', () => {
        const design = { ...DESIGN_DEFAULTS };
        expect(appDesignProps({ design })).toEqual({ className: '', style: {} });
    });

    it('non-identity values emit their class/style', () => {
        const { className, style } = appDesignProps({
            design: { ...DESIGN_DEFAULTS, surface: 'soft', motion: 'full', font: 'satoshi' },
        });
        expect(className).toContain('app-design--surface-soft');
        expect(className).toContain('app-motion--full');
        expect(style.fontFamily).toContain('Satoshi');
    });

    it('motion none stamps its kill switch', () => {
        expect(appDesignProps({ design: { ...DESIGN_DEFAULTS, motion: 'none' } }).className)
            .toContain('app-motion--none');
    });
});

describe('brandPalette', () => {
    const { THEME_PRIMARY_PRESETS } = require('../../../../../../../server/core/themeSpec');

    it('series 0 is the primary; 8 distinct colors; valid hex', () => {
        const pal = brandPalette('#1D4ED8');
        expect(pal).toHaveLength(8);
        expect(pal[0].toLowerCase()).toBe('#1d4ed8');
        expect(new Set(pal.map((c) => c.toLowerCase())).size).toBe(8);
        for (const c of pal) expect(c).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it('NEVER lands in the banned hue window, for every shipped primary preset', () => {
        for (const primary of THEME_PRIMARY_PRESETS) {
            for (const color of brandPalette(primary)) {
                expect(isBannedHue(color), `${primary} → ${color} is in the banned hue window`).toBe(false);
            }
        }
    });
});
