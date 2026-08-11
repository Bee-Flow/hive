import { Layers, Code2, Tag, ShieldCheck, Send, MessageSquare, Building2 } from 'lucide-react';

/**
 * Sections of the Guardrail Configs console, and the URL contract behind them.
 *
 * ── Why the URL works with no router change ───────────────────────────────
 * `AdminDashboard.parseAdminPath` already captures three admin segments and
 * SecurityHub already threads the third one through (it is how
 * ConnectorHealthPanel receives an org id). So
 * `/app/admin/security/guardrails/<section>` is routable today. A FOURTH
 * segment is not parsed at all — it would appear to work in dev, where state is
 * set directly, and then break on refresh. Anything deeper than a section
 * therefore lives in a query param (see hooks/useUrlTab → useUrlQueryParam).
 *
 * ── capability ────────────────────────────────────────────────────────────
 * The artefact types this console will own do not all have endpoints yet. Each
 * section names the capability it needs; the hub hides sections whose endpoint
 * is absent instead of rendering a tab that 404s. That is what lets the UI ship
 * ahead of the backend, and it means a section appears the moment its route
 * lands — with no frontend change.
 *
 * `capability: null` means "exists today, always shown".
 */
export const SECTIONS = [
    {
        id: 'presets',
        labelKey: 'admin.gr_tab_presets',
        fallback: 'Presets',
        icon: Layers,
        capability: 'presets',
        descKey: 'admin.gr_tab_presets_desc',
        descFallback: 'Named bundles an organisation can adopt in one step.',
    },
    {
        id: 'patterns',
        labelKey: 'admin.gr_tab_patterns',
        fallback: 'Patterns',
        icon: Code2,
        capability: null,
        descKey: 'admin.gr_tab_patterns_desc',
        descFallback: 'Regular expressions and the collections that group them.',
    },
    {
        id: 'terms',
        labelKey: 'admin.gr_tab_terms',
        fallback: 'Sensitive terms',
        icon: Tag,
        capability: 'termLibraries',
        descKey: 'admin.gr_tab_terms_desc',
        descFallback: 'Project codenames, customer identifiers and other literal strings.',
    },
    {
        id: 'pii',
        labelKey: 'admin.gr_tab_pii',
        fallback: 'PII profiles',
        icon: ShieldCheck,
        capability: 'piiProfiles',
        descKey: 'admin.gr_tab_pii_desc',
        descFallback: 'Which categories are detected, by which engine, at which threshold.',
    },
    {
        id: 'dlp',
        labelKey: 'admin.gr_tab_dlp',
        fallback: 'DLP policies',
        icon: Send,
        capability: 'dlpPolicies',
        descKey: 'admin.gr_tab_dlp_desc',
        descFallback: 'What happens to outbound prompts that contain sensitive data.',
    },
    {
        id: 'directchat',
        labelKey: 'admin.gr_tab_directchat',
        fallback: 'Direct chat',
        icon: MessageSquare,
        capability: null,
        descKey: 'admin.gr_tab_directchat_desc',
        descFallback: 'Collections applied to direct chat across this whole installation.',
    },
    {
        id: 'organisations',
        labelKey: 'admin.gr_tab_orgs',
        fallback: 'Organisations',
        icon: Building2,
        capability: null,
        descKey: 'admin.gr_tab_orgs_desc',
        descFallback: 'Which organisation uses what, and where a reference has gone stale.',
    },
];

/** Preference order when the requested section does not exist. */
const FALLBACK_ORDER = ['presets', 'patterns', 'organisations'];

/**
 * Sections available given the capabilities the server actually reports.
 * @param {object|null} capabilities  { presets: bool, termLibraries: bool, … }
 *   `null` means "not probed yet" — treat only the always-on sections as known,
 *   so the tab bar never flashes tabs that then disappear.
 */
export function availableSections(capabilities) {
    return SECTIONS.filter(s => s.capability === null || capabilities?.[s.capability] === true);
}

/**
 * Resolve a URL segment to a section id that is actually renderable.
 *
 * Falls back rather than erroring: a bookmarked link to a section that has
 * since been gated off should land somewhere useful, not on a blank pane.
 */
export function resolveSection(segment, sections) {
    const ids = sections.map(s => s.id);
    if (segment && ids.includes(segment)) return segment;
    for (const preferred of FALLBACK_ORDER) {
        if (ids.includes(preferred)) return preferred;
    }
    return ids[0] || null;
}

/** True when the segment names a section that exists but is not available. */
export function isKnownButUnavailable(segment, sections) {
    if (!segment) return false;
    const known = SECTIONS.some(s => s.id === segment);
    return known && !sections.some(s => s.id === segment);
}

export const BASE_PATH = 'admin/security/guardrails';

/** The navigation target for a section, for onNavigate(). */
export function pathFor(sectionId) {
    return `${BASE_PATH}/${sectionId}`;
}
