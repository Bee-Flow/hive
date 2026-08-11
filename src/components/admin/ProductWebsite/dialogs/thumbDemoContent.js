import { BLOCK_DEFAULTS } from '../blockEditors/catalogue';

/**
 * Curated demo content for the AddBlockDialog's live section thumbnails
 * (SectionThumb). The stock BLOCK_DEFAULTS are deliberately bland
 * ("Your headline here", "Describe this feature") — fine as a starting
 * point for editing, useless for judging what a section looks like.
 * These blobs paint each type the way a finished site would: short
 * headlines (≤8 words), three items with icons, believable numbers.
 *
 * Shapes mirror BLOCK_DEFAULTS exactly — anything not overridden here
 * falls through to the defaults via demoContentFor(), so a schema field
 * added to the catalogue never breaks a thumbnail.
 *
 * This content is ONLY used to paint thumbnails; the block the user
 * actually adds still gets plain BLOCK_DEFAULTS from the panel.
 */

const DEMO_CONTENT = {
    hero: {
        badge: { enabled: true, text: 'EU AI Act ready', icon: 'Sparkles' },
        titleParts: [
            { text: 'Your AI workspace, ', gradient: false },
            { text: 'without the leak', gradient: true },
        ],
        lead: 'Private AI for teams that keep their data at home.',
        primaryCta:   { enabled: true, label: 'Start free', style: 'primary',   link: { kind: 'anchor', anchor: '' } },
        secondaryCta: { enabled: true, label: 'Book a demo', style: 'secondary', link: { kind: 'anchor', anchor: '' } },
        mockup: {
            enabled: true,
            chatBubbles: [
                { role: 'user', text: 'Summarize the Q3 board deck' },
                { role: 'assistant', text: 'Three highlights: revenue +18%, churn down, SOC 2 renewed.' },
            ],
        },
    },
    socialProof: {
        eyebrow: 'Trusted by privacy-first teams',
        logos: [
            { alt: 'Nordwind' },
            { alt: 'Kanaal 7' },
            { alt: 'Delta Legal' },
            { alt: 'BrightCare' },
            { alt: 'Fjord Labs' },
        ],
        stats: [
            { number: '4.8/5', label: 'Average rating' },
            { number: '1,200+', label: 'Teams onboard' },
            { number: '99.9%', label: 'Uptime' },
        ],
    },
    content: {
        columnLayout: '2',
        columns: [
            {
                id: 'demo_col_1',
                elements: [{
                    id: 'demo_el_1',
                    kind: 'text',
                    heading: 'Built for European teams',
                    subheading: '',
                    body: 'Data residency, GDPR tooling and audit logs come standard — not as an enterprise add-on.',
                    align: 'left',
                }],
            },
            {
                id: 'demo_col_2',
                elements: [{
                    id: 'demo_el_2',
                    kind: 'text',
                    heading: 'Deploy anywhere',
                    subheading: '',
                    body: 'Run in our EU cloud or on your own servers with the same one-line install.',
                    align: 'left',
                }],
            },
        ],
    },
    'media-text': {
        heading: 'See every answer’s sources',
        subheading: null,
        body: 'Each response links back to the documents it came from, so review takes seconds instead of meetings.',
        cta: { label: 'Explore the workspace', link: { kind: 'anchor', anchor: '' } },
    },
    features: {
        eyebrow: 'Platform',
        title: 'Everything your team needs',
        lead: '',
        items: [
            { icon: 'ShieldCheck', title: 'Zero-knowledge encryption', body: 'Keys stay with you — we could not read your data if we tried.', techTag: '', span: 2, media: { src: '', srcDark: '', alt: '', frame: 'hairline', kind: 'image' } },
            { icon: 'Zap',         title: 'Instant answers',           body: 'Search every document, chat and meeting in one place.',        techTag: '', span: 1, media: { src: '', srcDark: '', alt: '', frame: 'hairline', kind: 'image' } },
            { icon: 'Users',       title: 'Team workspaces',           body: 'Shared agents and prompts with per-role access control.',      techTag: '', span: 1, media: { src: '', srcDark: '', alt: '', frame: 'hairline', kind: 'image' } },
        ],
    },
    steps: {
        eyebrow: 'How it works',
        title: 'Live in an afternoon',
        lead: '',
        items: [
            { number: '1', title: 'Connect your sources', body: 'Point it at your drive, mail and wiki — sync starts immediately.', example: '', media: { src: '', srcDark: '', alt: '', frame: 'hairline', kind: 'image' } },
            { number: '2', title: 'Invite the team',       body: 'SSO in one click; roles and shields apply from the first login.',  example: '', media: { src: '', srcDark: '', alt: '', frame: 'hairline', kind: 'image' } },
            { number: '3', title: 'Ask anything',          body: 'Answers cite their sources so trust is never a leap.',             example: '', media: { src: '', srcDark: '', alt: '', frame: 'hairline', kind: 'image' } },
        ],
    },
    security: {
        eyebrow: 'Security',
        title: 'Private by architecture',
        lead: '',
        cards: [
            { icon: 'Lock',        title: 'End-to-end encryption', summary: 'AES-256-GCM envelopes; keys derived on your device.', details: [], link: { label: '', href: '' } },
            { icon: 'KeyRound',    title: 'Your keys, your data',  summary: 'Zero-knowledge design — the server stores ciphertext only.', details: [], link: { label: '', href: '' } },
            { icon: 'ShieldCheck', title: 'GDPR & EU hosting',     summary: 'EU datacenters, DPAs included, audit trail built in.', details: [], link: { label: '', href: '' } },
        ],
    },
    integrations: {
        eyebrow: 'Integrations',
        title: 'Plays well with your stack',
        lead: 'Connect the tools your team already lives in.',
        categories: [
            {
                heading: 'Collaboration',
                items: [
                    { icon: 'Mail',       label: 'Gmail' },
                    { icon: 'Calendar',   label: 'Calendar' },
                    { icon: 'FolderOpen', label: 'Drive' },
                ],
            },
            {
                heading: 'Knowledge',
                items: [
                    { icon: 'BookOpen', label: 'Confluence' },
                    { icon: 'Cloud',    label: 'Nextcloud' },
                    { icon: 'Database', label: 'Postgres' },
                ],
            },
        ],
    },
    architecture: {
        eyebrow: 'Under the hood',
        title: 'One platform, three layers',
        lead: 'Every layer is swappable — bring your own models or storage.',
        layers: [
            { label: 'Your apps & agents', tags: ['Chat', 'Automations', 'Studio'] },
            { label: 'Privacy layer',      tags: ['PII shield', 'Policy engine', 'Audit'] },
            { label: 'Your infrastructure', tags: ['EU cloud', 'On-premise', 'Hybrid'] },
        ],
    },
    techStats: {
        eyebrow: '',
        title: 'Proof in numbers',
        stats: [
            { number: '3.2M', label: 'Documents indexed' },
            { number: '99.9%', label: 'Uptime, 12 months' },
            { number: '< 40ms', label: 'Median search' },
        ],
    },
    cta: {
        title: 'Own your AI. Starting today.',
        lead: 'Free for 14 days — no card, no lock-in.',
        button: { label: 'Start free trial', link: { kind: 'anchor', anchor: '' } },
    },
    'cta-banner': {
        heading: 'Ready when you are',
        subheading: 'Join 1,200+ teams working in a private AI workspace.',
        primaryCta: { label: 'Get started', link: { kind: 'external', url: '', newTab: false } },
    },
    'customer-support': {
        title: 'Questions? Ask us anything',
        lead: 'Our assistant answers in seconds; a human follows up when it matters.',
    },
    // 'live-component' and 'pricing' intentionally absent: those tiles keep
    // the SVG wireframe (raw user code / a network fetch have no business
    // running inside a thumbnail). SectionThumb checks WIREFRAME_ONLY.
};

/** Types that must never live-render in a thumbnail. */
export const WIREFRAME_ONLY = new Set(['live-component', 'pricing']);

/**
 * Demo content for one block type: curated copy layered over the stock
 * BLOCK_DEFAULTS (shallow merge — demo blobs override whole top-level
 * fields, which is exactly how the real add-block flow treats content).
 * `variant` (optional) rides on top so a variant strip can preview each
 * layout with the same copy.
 */
export function demoContentFor(type, variant = null) {
    const base = BLOCK_DEFAULTS[type] || {};
    const demo = DEMO_CONTENT[type] || {};
    const merged = { ...base, ...demo };
    if (variant) merged.variant = variant;
    return merged;
}

export default DEMO_CONTENT;
