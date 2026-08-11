import { Activity, Gauge, LayoutDashboard, Send, SlidersHorizontal } from 'lucide-react';

/**
 * The four tabs of the Privacy Shield editor.
 *
 * The page used to be fifteen sections in one scroll. Grouping them needed a
 * question per tab that an admin actually asks, not a taxonomy:
 *
 *   overview   — how does this organisation stand right now?
 *   detection  — what counts as personal data?
 *   processing — what do we do with a message we flagged?
 *   outbound   — what may leave the building?
 *
 * The LABELS are those questions in the user's words rather than ours. An
 * org admin is not a security engineer: "Detection / Processing / Outbound"
 * is our model of the pipeline, and reading it required already knowing the
 * pipeline. The ids stay as they are — they are in URLs and tests.
 *
 * Detection is ordered widen-then-narrow: sensitivity → categories → extra
 * terms → never-hide exceptions.
 */
export const TAB_IDS = ['overview', 'detection', 'processing', 'outbound'];

export const DEFAULT_TAB = 'overview';

export const TABS = [
    { id: 'overview', labelKey: 'admin.shield_tab_overview', fallback: 'Overview', Icon: LayoutDashboard },
    { id: 'detection', labelKey: 'admin.shield_tab_detection', fallback: 'What we look for', Icon: Gauge },
    { id: 'processing', labelKey: 'admin.shield_tab_processing', fallback: 'What happens', Icon: SlidersHorizontal },
    { id: 'outbound', labelKey: 'admin.shield_tab_outbound', fallback: 'Leaving your org', Icon: Send },
];

/**
 * The monitoring tab — evidence, where the other four are policy. It is
 * OPT-IN per mount (`showActivityTab` on OrgShieldEditor) because its data
 * endpoints derive the organisation from the SESSION: on the admin
 * GuardrailsHub mount, which can pin a DIFFERENT org, the tab would silently
 * show the wrong organisation's activity. Only the org-settings mount (own
 * org, always) offers it.
 */
export const ACTIVITY_TAB = { id: 'activity', labelKey: 'admin.shield_tab_activity', fallback: 'What happened', Icon: Activity };

export const ALL_TAB_IDS = [...TAB_IDS, ACTIVITY_TAB.id];

/**
 * Never trust the URL. A stale bookmark, a typo, or a link from a future
 * release that renamed a tab must land somewhere sane rather than render an
 * empty pane. `ids` is the mount's own tab set: `?tab=activity` on a mount
 * that does not offer the tab falls back to Overview instead of rendering a
 * wrong-organisation pane.
 */
export function normaliseTab(raw, ids = TAB_IDS) {
    return ids.includes(raw) ? raw : DEFAULT_TAB;
}
