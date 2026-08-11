/**
 * The preset gallery's data exists twice — the server copy is the schema of
 * record (builder tools materialize from it), the client copy renders the
 * gallery without a fetch. This test pins them byte-equal, exactly like the
 * CMS themePresets sync test. If it fails: edit BOTH files.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import { APP_DESIGN_PRESETS } from './appDesignPresets';

const require = createRequire(import.meta.url);
const serverPresets = require('../../../../../../../server/appStudio/appDesignPresets');

describe('appDesignPresets client/server sync', () => {
    it('the two copies are deep-equal', () => {
        expect(APP_DESIGN_PRESETS).toEqual(serverPresets.APP_DESIGN_PRESETS);
    });

    it('every preset carries a complete theme + design + navStyle', () => {
        const { DESIGN_SPEC, NAV_STYLES } = require('../../../../../../../server/appStudio/appDesignSpec');
        for (const p of APP_DESIGN_PRESETS) {
            expect(Object.keys(p.theme).sort()).toEqual(['appearance', 'density', 'fontScale', 'primary', 'radius']);
            expect(Object.keys(p.design).sort()).toEqual(Object.keys(DESIGN_SPEC).sort());
            expect(NAV_STYLES).toContain(p.navStyle);
            for (const [key, spec] of Object.entries(DESIGN_SPEC)) {
                if (spec.type === 'enum') expect(spec.values).toContain(p.design[key]);
            }
        }
    });

    it('no purple anywhere (house rule)', () => {
        const { THEME_PRIMARY_PRESETS } = require('../../../../../../../server/core/themeSpec');
        for (const p of APP_DESIGN_PRESETS) {
            expect(THEME_PRIMARY_PRESETS).toContain(p.theme.primary);
        }
    });
});
