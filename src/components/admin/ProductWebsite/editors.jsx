/**
 * editors.jsx — compatibility barrel.
 *
 * The actual editor implementations moved to ./blockEditors/ (one file per
 * block editor, plus catalogue.js for the registries and shared.jsx for
 * cross-editor helpers); the shared micro-widgets live in ./primitives.jsx.
 *
 * This file stays at its historical path with the exact same export
 * surface because:
 *   • blockSchema.test.js mocks './editors' by relative path and pins its
 *     own BLOCK_CATALOGUE type set (keep it in sync with
 *     server/i18n/defaults/cmsDefaults.js);
 *   • BlockList / PageList / ProductWebsitePanel / TranslationPanel /
 *     blockSchema / inspector/* all import the registries and the chrome
 *     editors (HeaderEditor / FooterEditor) from here.
 *
 * Add new block editors in ./blockEditors/ and re-export them here.
 */

// Chrome editors (site header / footer — not part of BLOCK_CATALOGUE).
export { HeaderEditor } from './blockEditors/HeaderEditor';
export { FooterEditor } from './blockEditors/FooterEditor';

// Block editors.
export { HeroEditor } from './blockEditors/HeroEditor';
export { SocialProofEditor } from './blockEditors/SocialProofEditor';
export { ContentEditor } from './blockEditors/ContentEditor';
export { MediaTextEditor } from './blockEditors/MediaTextEditor';
export { FeaturesEditor } from './blockEditors/FeaturesEditor';
export { StepsEditor } from './blockEditors/StepsEditor';
export { SecurityEditor } from './blockEditors/SecurityEditor';
export { IntegrationsEditor } from './blockEditors/IntegrationsEditor';
export { ArchitectureEditor } from './blockEditors/ArchitectureEditor';
export { TechStatsEditor } from './blockEditors/TechStatsEditor';
export { CTAEditor } from './blockEditors/CTAEditor';
export { CtaBannerEditor } from './blockEditors/CtaBannerEditor';
export { LiveComponentEditor } from './blockEditors/LiveComponentEditor';
export { PricingEditor } from './blockEditors/PricingEditor';
export { CustomerSupportEditor } from './blockEditors/CustomerSupportEditor';
export { TestimonialsEditor } from './blockEditors/TestimonialsEditor';
export { FaqEditor } from './blockEditors/FaqEditor';
export { TrustBandEditor } from './blockEditors/TrustBandEditor';
export { ShowcaseEditor } from './blockEditors/ShowcaseEditor';
export { FeatureDemoEditor } from './blockEditors/FeatureDemoEditor';
export { RoadmapEditor } from './blockEditors/RoadmapEditor';
export { CompareTableEditor } from './blockEditors/CompareTableEditor';
export { GitHubStatsEditor } from './blockEditors/GitHubStatsEditor';
export { ReleaseNotesEditor } from './blockEditors/ReleaseNotesEditor';

// Registries.
export { BLOCK_CATALOGUE, BLOCK_EDITORS, BLOCK_DEFAULTS } from './blockEditors/catalogue';

import { BLOCK_CATALOGUE, BLOCK_EDITORS } from './blockEditors/catalogue';

// Legacy aliases — kept so AdminDashboard and any other import that uses
// the old names doesn't break before it's updated.
export const SECTION_EDITORS = BLOCK_EDITORS;
export const SECTION_ORDER   = Object.keys(BLOCK_CATALOGUE);
