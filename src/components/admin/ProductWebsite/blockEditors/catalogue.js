import { ArchitectureEditor } from './ArchitectureEditor';
import { ContentEditor } from './ContentEditor';
import { CtaBannerEditor } from './CtaBannerEditor';
import { CTAEditor } from './CTAEditor';
import { CustomerSupportEditor } from './CustomerSupportEditor';
import { FeaturesEditor } from './FeaturesEditor';
import { HeroEditor } from './HeroEditor';
import { IntegrationsEditor } from './IntegrationsEditor';
import { LiveComponentEditor } from './LiveComponentEditor';
import { MediaTextEditor } from './MediaTextEditor';
import { PricingEditor } from './PricingEditor';
import { SecurityEditor } from './SecurityEditor';
import { SocialProofEditor } from './SocialProofEditor';
import { StepsEditor } from './StepsEditor';
import { TechStatsEditor } from './TechStatsEditor';
import { TestimonialsEditor } from './TestimonialsEditor';
import { FaqEditor } from './FaqEditor';
import { TrustBandEditor } from './TrustBandEditor';
import { ShowcaseEditor } from './ShowcaseEditor';
import { FeatureDemoEditor } from './FeatureDemoEditor';
import { RoadmapEditor } from './RoadmapEditor';
import { CompareTableEditor } from './CompareTableEditor';
import { GitHubStatsEditor } from './GitHubStatsEditor';
import { ReleaseNotesEditor } from './ReleaseNotesEditor';

// ── Catalogue + registries ────────────────────────────────────────────
//
// BLOCK_CATALOGUE   used by BlockList (add picker) and BlockRow (labels/icons)
// BLOCK_EDITORS     used by ProductWebsitePanel to render the active editor
// BLOCK_DEFAULTS    used by the panel when creating a new block

export const BLOCK_CATALOGUE = {
    hero:         { type: 'hero',         label: 'Hero',           icon: 'Megaphone',   category: 'Above the fold' },
    socialProof:  { type: 'socialProof',  label: 'Social proof',   icon: 'Users',       category: 'Above the fold' },
    content:      { type: 'content',      label: 'Content',        icon: 'Type',             category: 'Content' },
    'media-text': { type: 'media-text',   label: 'Media + Text',   icon: 'LayoutPanelLeft',  category: 'Content' },
    features:     { type: 'features',     label: 'Features',       icon: 'Sparkles',         category: 'Content' },
    steps:        { type: 'steps',        label: 'How it works',   icon: 'ListOrdered', category: 'Content' },
    security:     { type: 'security',     label: 'Security',       icon: 'ShieldCheck', category: 'Content' },
    integrations: { type: 'integrations', label: 'Integrations',   icon: 'Plug',        category: 'Content' },
    architecture: { type: 'architecture', label: 'Architecture',   icon: 'Boxes',       category: 'Content' },
    techStats:    { type: 'techStats',    label: 'Stats',          icon: 'BarChart3',   category: 'Content' },
    cta:          { type: 'cta',          label: 'Call to action', icon: 'Target',           category: 'Conversion' },
    'cta-banner': { type: 'cta-banner',   label: 'CTA Banner',     icon: 'Rocket',           category: 'Conversion' },
    'live-component': { type: 'live-component', label: 'Live Component', icon: 'Code',         category: 'Content' },
    pricing:      { type: 'pricing',      label: 'Pricing',        icon: 'CreditCard',       category: 'Conversion' },
    'customer-support': { type: 'customer-support', label: 'Customer Support', icon: 'LifeBuoy', category: 'Conversion' },
    // ROLLBACK CAVEAT: exports containing the four types below, imported
    // into an OLDER deployment, silently drop those blocks (unknown-type in
    // normalizeBlockRecord) — land schema + renderer as one deploy unit.
    testimonials: { type: 'testimonials', label: 'Testimonials', icon: 'Quote',                 category: 'Trust' },
    faq:          { type: 'faq',          label: 'FAQ',          icon: 'MessageCircleQuestion', category: 'Content' },
    'trust-band': { type: 'trust-band',   label: 'Trust band',   icon: 'ShieldCheck',           category: 'Trust' },
    showcase:     { type: 'showcase',     label: 'Showcase',     icon: 'MonitorPlay',           category: 'Content' },
    'feature-demo': { type: 'feature-demo', label: 'Live feature demo', icon: 'MousePointerClick', category: 'Content' },
    roadmap:        { type: 'roadmap',      label: 'Roadmap',           icon: 'Milestone',          category: 'Trust' },
    'compare-table': { type: 'compare-table', label: 'Comparison table', icon: 'Table',            category: 'Trust' },
    'github-stats':  { type: 'github-stats',  label: 'GitHub stats',     icon: 'Github',           category: 'Trust' },
    'release-notes': { type: 'release-notes', label: 'Release notes',    icon: 'ScrollText',       category: 'Trust' },
};

// Per-type layout variants — client copy of BLOCK_VARIANTS in
// server/i18n/defaults/cmsDefaults.js; keep the two in sync (covered by
// the defaults sync test). `content.variant` absent/unknown ⇒ 'classic'
// (the legacy layout), so existing blocks never change appearance.
export const BLOCK_VARIANTS = {
    hero:        ['classic', 'panel', 'split', 'video'],
    features:    ['classic', 'bento'],
    steps:       ['classic', 'chapters'],
    security:    ['classic', 'ledger'],
    socialProof: ['classic', 'numbers'],
    // New types have no legacy layout — the FIRST entry is the default and
    // the absent/unknown fallback (mirror of the server file).
    testimonials: ['quotes', 'case', 'spotlight'],
    'trust-band': ['chips', 'detailed'],
    showcase:     ['single', 'pair', 'code-ui'],
    // compact = one entry for a homepage strip; full = the /changelog archive.
    'release-notes': ['compact', 'full'],
};

export const BLOCK_EDITORS = {
    hero:         { component: HeroEditor,         label: 'Hero',           icon: 'Megaphone'   },
    socialProof:  { component: SocialProofEditor,  label: 'Social proof',   icon: 'Users'       },
    content:      { component: ContentEditor,      label: 'Content',        icon: 'Type'             },
    'media-text': { component: MediaTextEditor,    label: 'Media + Text',   icon: 'LayoutPanelLeft'  },
    features:     { component: FeaturesEditor,     label: 'Features',       icon: 'Sparkles'         },
    steps:        { component: StepsEditor,        label: 'How it works',   icon: 'ListOrdered' },
    security:     { component: SecurityEditor,     label: 'Security',       icon: 'ShieldCheck' },
    integrations: { component: IntegrationsEditor, label: 'Integrations',   icon: 'Plug'        },
    architecture: { component: ArchitectureEditor, label: 'Architecture',   icon: 'Boxes'       },
    techStats:    { component: TechStatsEditor,    label: 'Stats',          icon: 'BarChart3'   },
    cta:          { component: CTAEditor,          label: 'Call to action', icon: 'Target'           },
    'cta-banner': { component: CtaBannerEditor,    label: 'CTA Banner',     icon: 'Rocket'           },
    'live-component': { component: LiveComponentEditor, label: 'Live Component', icon: 'Code'        },
    pricing:      { component: PricingEditor,      label: 'Pricing',        icon: 'CreditCard'        },
    'customer-support': { component: CustomerSupportEditor, label: 'Customer Support', icon: 'LifeBuoy' },
    testimonials: { component: TestimonialsEditor, label: 'Testimonials', icon: 'Quote'                 },
    faq:          { component: FaqEditor,          label: 'FAQ',          icon: 'MessageCircleQuestion' },
    'trust-band': { component: TrustBandEditor,    label: 'Trust band',   icon: 'ShieldCheck'           },
    showcase:     { component: ShowcaseEditor,     label: 'Showcase',     icon: 'MonitorPlay'           },
    'feature-demo': { component: FeatureDemoEditor, label: 'Live feature demo', icon: 'MousePointerClick' },
    roadmap:        { component: RoadmapEditor,     label: 'Roadmap',           icon: 'Milestone' },
    'compare-table': { component: CompareTableEditor, label: 'Comparison table', icon: 'Table' },
    'github-stats':  { component: GitHubStatsEditor,  label: 'GitHub stats',     icon: 'Github' },
    'release-notes': { component: ReleaseNotesEditor, label: 'Release notes',    icon: 'ScrollText' },
};

// Brand-neutral placeholder content used when the user clicks "+ Add block"
// in the panel. Kept in sync with server/i18n/defaults/cmsDefaults.js so a
// block created via the panel matches one created server-side.
export const BLOCK_DEFAULTS = {
    hero: {
        eyebrow: '',
        // Each toggle-able piece carries an `enabled: true` so the panel's
        // "Show …" toggles can flip it off. Old hero blocks stored without
        // this field render as before because the renderer treats missing
        // `enabled` as truthy via `!== false`.
        badge: { enabled: true, text: '', icon: '' },
        // Per-text styling — empty strings / 0 = inherit the page CSS and
        // the Design tab, so blocks stored without these keys read as
        // undefined and the renderer skips inline-style application.
        badgeStyle: { fontFamily: '', fontSize: 0, color: '' },
        titleParts: [{ text: 'Your headline here', gradient: false }],
        titleStyle: { fontFamily: '', fontSize: 0, color: '' },
        lead: 'Describe your product or service',
        leadStyle: { fontFamily: '', fontSize: 0, color: '' },
        // CTAs grew an explicit `style` field (matching site-chrome /
        // multi-CTA patterns) and an `enabled` toggle. Defaults preserve
        // the original visual: primary = filled orange, secondary = outline.
        primaryCta:   { enabled: true, label: 'Get started', style: 'primary',   link: { kind: 'anchor', anchor: '' } },
        secondaryCta: { enabled: true, label: 'Learn more',  style: 'secondary', link: { kind: 'anchor', anchor: '' } },
        mockup: { enabled: true, chatBubbles: [] },
        // 'default' / 'surface' / 'primary' / 'dark' — same scale as
        // Media + Text and Content blocks. Default keeps the page bg.
        backgroundVariant: 'default',
        // Layout variant (BLOCK_VARIANTS) + shared FramedMedia slot; new
        // heroes default to the premium 'panel' layout, empty src renders
        // the intentional skeleton panel. Mirror of the server defaults.
        variant: 'panel',
        media: { src: '', srcDark: '', alt: '', frame: 'browser', kind: 'image' },
    },
    socialProof: {
        eyebrow: 'Add your client logos',
        title: '',
        // Empty strings = inherit the page CSS / Design tab. Old blocks
        // saved without these keys read as `undefined` and the renderer
        // skips inline-style application, so backwards-compat is free.
        eyebrowStyle: { fontFamily: '', fontSize: 14, color: '' },
        titleStyle:   { fontFamily: '', fontSize: 32, color: '' },
        logos: [],
        // 'classic' = logo wall only; 'numbers' adds a hard-numbers row
        // above the wall. Mirror of the server defaults.
        variant: 'classic',
        stats: [],
    },
    content: {
        // New flexible Content block — column + elements system. The editor
        // and renderer accept the legacy flat shape too via
        // migrateLegacyContent(), so existing blocks keep rendering until
        // they're saved (the next save persists the new shape).
        columnLayout: '1',
        verticalAlign: 'top',
        background: 'none',
        columns: [
            {
                id: 'col_default',
                elements: [
                    {
                        id: 'el_default',
                        kind: 'text',
                        heading: 'Your heading here',
                        subheading: '',
                        body: 'Add your content here.',
                        align: 'left',
                    },
                ],
            },
        ],
    },
    'media-text': {
        heading:           'Your heading here',
        subheading:        null,
        body:              'Add your content here.',
        cta:               null,                       // { label, link: { kind, ... } }
        media: {
            kind: 'image',                              // 'image' | 'video'
            src:  '',
            alt:  '',
            srcDark: '',                                // optional dark-theme image (framed rendering)
            frame:   '',                                // '' (legacy bare img) | 'hairline' | 'browser'
        },
        mediaPosition:     'left',                     // 'left' | 'right'
        mediaSize:         'half',                     // 'half' | 'third' | 'two-thirds'
        backgroundVariant: 'default',                  // 'default' | 'surface' | 'primary' | 'dark'
    },
    features: {
        eyebrow: 'Features',
        title: 'What we offer',
        lead: '',
        // Mirror of the server defaults: bento by default for new blocks,
        // per-item span (1|2) + optional FramedMedia slot.
        variant: 'bento',
        spotlight: false,
        items: [
            { icon: 'Star',   title: 'Feature 1', body: 'Describe this feature', techTag: '', span: 2, media: { src: '', srcDark: '', alt: '', frame: 'hairline', kind: 'image' } },
            { icon: 'Zap',    title: 'Feature 2', body: 'Describe this feature', techTag: '', span: 1, media: { src: '', srcDark: '', alt: '', frame: 'hairline', kind: 'image' } },
            { icon: 'Shield', title: 'Feature 3', body: 'Describe this feature', techTag: '', span: 1, media: { src: '', srcDark: '', alt: '', frame: 'hairline', kind: 'image' } },
        ],
    },
    steps: {
        eyebrow: '',
        title: 'How it works',
        lead: '',
        // Mirror of the server defaults: chapters by default for new
        // blocks, per-step FramedMedia slot.
        variant: 'chapters',
        items: [
            { number: '1', title: 'Step 1', body: 'Describe what happens in this step', example: '', media: { src: '', srcDark: '', alt: '', frame: 'hairline', kind: 'image' } },
            { number: '2', title: 'Step 2', body: 'Describe what happens in this step', example: '', media: { src: '', srcDark: '', alt: '', frame: 'hairline', kind: 'image' } },
            { number: '3', title: 'Step 3', body: 'Describe what happens in this step', example: '', media: { src: '', srcDark: '', alt: '', frame: 'hairline', kind: 'image' } },
        ],
    },
    security: {
        eyebrow: '',
        title: 'Security',
        lead: '',
        // Mirror of the server defaults: classic 2-up cards by default;
        // 'ledger' renders the 5/7 split with mono-indexed hairline rows
        // and an optional per-card "→ label" link.
        variant: 'classic',
        cards: [
            { icon: 'Lock',        title: 'Data encryption', summary: 'Describe your encryption story', details: [], link: { label: '', href: '' } },
            { icon: 'KeyRound',    title: 'Access control',  summary: 'Describe your access controls',  details: [], link: { label: '', href: '' } },
            { icon: 'ShieldCheck', title: 'Compliance',      summary: 'Describe your compliance posture', details: [], link: { label: '', href: '' } },
        ],
    },
    integrations: {
        eyebrow: '',
        title: 'Integrations',
        lead: 'Add your integrations',
        categories: [],
    },
    architecture: {
        eyebrow: '',
        title: 'Architecture',
        lead: 'Describe your architecture',
        layers: [{ label: 'Layer 1', tags: [] }],
    },
    techStats: {
        eyebrow: '',
        title: 'Key numbers',
        stats: [
            { number: '100+', label: 'Customers' },
            { number: '99%',  label: 'Uptime' },
            { number: '24/7', label: 'Support' },
        ],
    },
    cta: {
        title: 'Ready to get started?',
        lead: 'Contact us today',
        button: { label: 'Get started', link: { kind: 'anchor', anchor: '' } },
        // Mirror of the server defaults — page-closing band.
        secondaryCta: null,
        showMotif: true,
        backgroundVariant: 'dark',
    },
    'cta-banner': {
        heading:           'Ready to get started?',
        subheading:        'Join thousands of teams already using the platform.',
        layout:            'centered',                  // 'centered' | 'split'
        backgroundVariant: 'primary',                   // 'default' | 'surface' | 'primary' | 'dark'
        primaryCta: {
            label: 'Get started',
            link: { kind: 'external', url: '', newTab: false },
        },
        secondaryCta:      null,                        // null | { label, link: { kind, ... } }
    },
    // Live Component — user pastes raw HTML/CSS/JS into one of four
    // layout modes. The renderer reads `layout` to pick the column
    // structure and falls back to 'full' for blocks that pre-date the
    // multi-layout upgrade. CTA mirrors the Hero pattern: nested
    // { enabled, label, link, style } blob so the LinkField gives users
    // anchor / external-URL / internal-page destinations consistently.
    'live-component': {
        layout:    'full',
        code:      '',
        codeRight: '',
        heading:   '',
        body:      '',
        cta: {
            enabled: true,
            label:   'Get started',
            link:    { kind: 'external', url: '', newTab: false },
            style:   'primary',
        },
    },
    // Pricing — dynamic. Plans come from /api/billing/public-plans;
    // the admin chooses an audience (planType) and the toggle defaults
    // here. Kept in sync with server/i18n/defaults/cmsDefaults.js.
    pricing: {
        heading: 'Pricing',
        subheading: '',
        planType: 'organization',
        enableToggle: true,
        defaultInterval: 'monthly',
        toggleLabelMonthly: 'Maandelijks',
        toggleLabelYearly: 'Jaarlijks',
        ctaLabel: 'Kies plan',
        emptyText: 'Geen plannen beschikbaar',
        // Mirror of the server defaults — previously hardcoded Dutch
        // strings, now translatable content fields + featured tier.
        suffixMonthly: '/maand',
        suffixYearly: '/jaar',
        customPriceText: 'Op aanvraag',
        trialText: '{days} dagen gratis proberen',
        featuredPlanId: '',
        featuredStyle: 'border',
    },
    // Customer Support — public AI-first support form. Submits to
    // POST /api/support/threads (source: 'marketing'); the AI replies inline
    // and a human takes over on escalation. Kept in sync with cmsDefaults.js.
    'customer-support': {
        title: 'Talk to us',
        lead: 'Question about pricing, custom deployments, or anything else? Send us a note — our AI assistant replies within seconds, and a human picks it up if needed.',
        nameLabel: 'Your name',
        namePlaceholder: 'Jane Doe',
        emailLabel: 'Email',
        emailPlaceholder: 'you@company.com',
        subjectLabel: 'Subject',
        subjectPlaceholder: 'How can we help?',
        messageLabel: 'Message',
        messagePlaceholder: "Tell us about your team, what you're trying to do, and any constraints.",
        submitLabel: 'Send to Bee Flow',
        successTitle: "Thanks — we've got your message",
        successBody: "Our AI assistant is looking through our knowledge base right now and you'll receive an email reply within a few minutes. If it can't fully resolve your question, a Bee Flow teammate will take over.",
        backgroundVariant: 'surface',
    },
    // Testimonials — quantified social proof (name + role + company always;
    // NEVER star ratings). Mirror of the server defaults.
    testimonials: {
        variant: 'quotes',
        eyebrow: 'What teams say',
        title: 'Trusted by teams that ship',
        items: [
            { quote: 'We replaced three tools in the first week. Nobody has asked for them back.', name: 'Sanne de Vries', role: 'Head of Operations', company: 'Fjord Analytics', avatarSrc: '', logoSrc: '', metric: { number: '', label: '' } },
            { quote: 'Setup took an afternoon. The privacy review took even less — everything stays on our own servers.', name: 'Jonas Weber', role: 'CTO', company: 'Kompas Legal', avatarSrc: '', logoSrc: '', metric: { number: '', label: '' } },
            { quote: 'The first platform our whole team adopted without being pushed.', name: 'Elena Rossi', role: 'Product Lead', company: 'Brightloop', avatarSrc: '', logoSrc: '', metric: { number: '', label: '' } },
        ],
    },
    // FAQ — controlled accordion (first item open by default in preview).
    // Mirror of the server defaults.
    faq: {
        eyebrow: 'FAQ',
        title: 'Questions, answered',
        lead: '',
        items: [
            { question: 'How long does setup take?', answer: 'Most teams are up and running within a day. Connect your data, invite your team, and start working — no consultants required.' },
            { question: 'Where is our data stored?', answer: 'On your own infrastructure, or in the EU region you choose. Nothing leaves your environment without your say-so.' },
            { question: 'Can we try it before committing?', answer: 'Yes — start small with a pilot team and expand when it proves itself. You keep full control the whole way.' },
            { question: 'What happens if we want to leave?', answer: 'Your data is yours. Export everything in open formats at any time — no lock-in, no exit fees.' },
        ],
    },
    // Trust band — monochrome institutional chips; chips with an href render
    // as external links. Mirror of the server defaults.
    'trust-band': {
        variant: 'chips',
        eyebrow: 'Built for European teams',
        title: '',
        chips: [
            { icon: 'ShieldCheck', label: 'GDPR-compliant', sublabel: 'EU data residency', href: '' },
            { icon: 'Lock', label: 'Zero-knowledge encryption', sublabel: 'Not even we can read your data', href: '' },
            { icon: 'Scale', label: 'Fair-code licensed', sublabel: 'Source available, auditable', href: '' },
        ],
    },
    // Showcase — staged product proof; `code` is translation-denied
    // (structural subtree). Mirror of the server defaults.
    showcase: {
        variant: 'single',
        eyebrow: '',
        title: 'See it working',
        lead: '',
        media: { src: '', srcDark: '', alt: '', frame: 'browser', kind: 'image' },
        mediaSecondary: { src: '', srcDark: '', alt: '', frame: 'browser', kind: 'image' },
        code: { language: 'bash', snippet: 'docker compose up -d' },
    },
    // Live feature demo — frames the real product UI from the demo registry.
    // `feature` is an ID, never a URL: the renderer builds the src, so this
    // block can never be pointed at a third-party origin. Mirror of the
    // server defaults.
    'feature-demo': {
        eyebrow: 'Live demo',
        title: 'Try it right here',
        lead: '',
        feature: 'routines',
        height: 720,
        theme: 'light',
        note: 'This is the real interface running on sample data. Nothing you do here is saved, and nothing leaves your browser.',
        // No default CTA under the frame — mirror of the server defaults.
    },
    // Grouped into status buckets at render time — never stored sorted.
    // `item.status` is structural and denylisted from translation; the
    // labels below are prose and do translate. Mirror of the server defaults.
    roadmap: {
        eyebrow: 'Roadmap',
        title: 'What we are building',
        lead: '',
        statusLabels: {
            shipped:   'Available now',
            beta:      'In beta',
            building:  'In development',
            exploring: 'Exploring',
        },
        showLegend: true,
        items: [],
        disclaimer: 'This page describes what we are working on, not what we promise to deliver or when.',
    },

    // Mirror of the server defaults: rows are { aspect, left, right } and
    // `left` is always our side (leftLabel).
    'compare-table': {
        eyebrow: '',
        title: '',
        lead: '',
        leftLabel: 'Bee Flow',
        rightLabel: '',
        rows: [],
        footnote: '',
    },

    // Stores no numbers — stars/releases are fetched live from
    // /api/public/github-stats so the block can never go stale.
    'github-stats': {
        eyebrow: '',
        title: '',
        lead: '',
        repoUrl: 'https://github.com/Bee-Flow/Bee-Flow-AI',
        linkLabel: 'Source on GitHub',
    },
    // Entries are NOT stored here — they come from /api/release-notes/public.
    // Must stay byte-identical to the server copy in
    // server/i18n/defaults/cmsDefaults.js (editors.test.js asserts it).
    'release-notes': {
        variant: 'compact',
        eyebrow: '',
        title: 'What\'s new',
        lead: '',
        limit: 1,
        kindLabels: {
            feature: 'New',
            improvement: 'Improved',
            fix: 'Fixed',
        },
        emptyText: '',
        linkLabel: '',
        linkUrl: '',
    },
};
