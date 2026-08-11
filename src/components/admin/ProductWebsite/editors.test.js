/**
 * Unit — pins the ./editors compatibility-barrel export surface after the
 * blockEditors/ split. blockSchema.test.js mocks this module by path; this
 * test imports the real thing and asserts the 26-name surface plus the
 * catalogue/editors/defaults registries staying in lock-step (19 types,
 * kept in sync with server/i18n/defaults/cmsDefaults.js).
 *
 * Run: cd agent-hub && npx vitest run src/components/admin/ProductWebsite/editors.test.js
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import * as editors from './editors';
import { BLOCK_VARIANTS } from './blockEditors/catalogue';

// The server schema of record — CommonJS, so require() it directly.
const require = createRequire(import.meta.url);
const serverDefaults = require('../../../../../server/i18n/defaults/cmsDefaults.js');

const EXPORT_NAMES = [
    'HeaderEditor',
    'HeroEditor',
    'SocialProofEditor',
    'ContentEditor',
    'MediaTextEditor',
    'FeaturesEditor',
    'StepsEditor',
    'SecurityEditor',
    'IntegrationsEditor',
    'ArchitectureEditor',
    'TechStatsEditor',
    'CTAEditor',
    'CtaBannerEditor',
    'LiveComponentEditor',
    'FooterEditor',
    'PricingEditor',
    'CustomerSupportEditor',
    'TestimonialsEditor',
    'FaqEditor',
    'TrustBandEditor',
    'ShowcaseEditor',
    'FeatureDemoEditor',
    'RoadmapEditor',
    'CompareTableEditor',
    'GitHubStatsEditor',
    'ReleaseNotesEditor',
    'BLOCK_CATALOGUE',
    'BLOCK_EDITORS',
    'BLOCK_DEFAULTS',
    'SECTION_EDITORS',
    'SECTION_ORDER',
];

describe('editors barrel', () => {
    it('exposes all 31 exports (28 as of the 2026-07 split + compare-table + github-stats + release-notes)', () => {
        for (const name of EXPORT_NAMES) {
            expect(editors[name], `export "${name}" should be defined`).toBeDefined();
        }
    });

    it('pins exactly 24 block types, each with an editor component and defaults', () => {
        const types = Object.keys(editors.BLOCK_CATALOGUE);
        expect(types).toHaveLength(24);
        for (const type of types) {
            expect(
                typeof editors.BLOCK_EDITORS[type]?.component,
                `BLOCK_EDITORS["${type}"].component`
            ).toBe('function');
            expect(
                editors.BLOCK_DEFAULTS[type],
                `BLOCK_DEFAULTS["${type}"]`
            ).toBeTypeOf('object');
        }
    });

    it('keeps the legacy aliases wired to the registries', () => {
        expect(editors.SECTION_EDITORS).toBe(editors.BLOCK_EDITORS);
        expect(editors.SECTION_ORDER).toEqual(Object.keys(editors.BLOCK_CATALOGUE));
    });

    it('stays in sync with server/i18n/defaults/cmsDefaults.js', () => {
        // Same type set, same order-independent membership.
        expect(Object.keys(editors.BLOCK_DEFAULTS).sort())
            .toEqual(Object.keys(serverDefaults.BLOCK_DEFAULTS).sort());
        expect(Object.keys(editors.BLOCK_CATALOGUE).sort())
            .toEqual(serverDefaults.BLOCK_TYPE_IDS.slice().sort());
        // Layout variants must be byte-identical — an entry added on one
        // side only would let the editor offer (or the AI emit) a variant
        // the other side doesn't know about.
        expect(BLOCK_VARIANTS).toEqual(serverDefaults.BLOCK_VARIANTS);
    });
});
