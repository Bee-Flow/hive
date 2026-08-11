/**
 * Rewrites ComplianceHub's admin-dashboard paths onto the Settings URL scheme.
 *
 * ComplianceHub always emits admin paths (`admin/compliance/<section>[/<checkId>]`)
 * regardless of where it is mounted. When it lives inside Settings → Organisation
 * we keep the user on the settings surface by translating that one path family to
 * `/app/settings/organisation/compliance/...`.
 *
 * Returns null for any non-compliance path — the caller tries rewriteAdminEscape
 * next, and only then forwards to the app router (admin dashboard).
 */
export function rewriteComplianceNav(path) {
    const m = /^admin\/compliance(?:\/([^/]+))?(?:\/(.+))?$/.exec(path || '');
    if (!m) return null;
    const section = m[1] || 'overview';
    return {
        section,
        checkId: m[2] ? decodeURIComponent(m[2]) : '',
        url: `/app/settings/organisation/compliance/${section}${m[2] ? `/${m[2]}` : ''}`,
    };
}

/**
 * Maps the remaining admin-dashboard destinations that compliance check
 * remediation links emit onto their organisation-settings equivalents:
 *
 *   admin/security[/guardrails[/...]]  → Organisation → Privacy (same OrgShieldEditor
 *                                        the DLP checks read)
 *   admin/monitoring                   → Organisation → Usage (consumption)
 *   admin/monitoring/activity          → Organisation → Privacy ?tab=activity (the
 *                                        shield's "What happened" tab — the safety/
 *                                        egress reports moved there from Usage)
 *
 * Agent-admin paths (admin/agents, admin/chat, admin/system) are deliberately
 * NOT mapped — Organisation settings no longer hosts an Agents tab, so they
 * forward to the admin dashboard.
 *
 * Returns { tab, seg1, url } or null. The caller must verify the user can see
 * `tab` before applying — when they can't (e.g. a pure DPO without org-admin),
 * falling through to the admin dashboard is today's behavior and stays correct.
 */
export function rewriteAdminEscape(path) {
    const p = path || '';
    if (p === 'admin/security' || p === 'admin/security/guardrails' || p.startsWith('admin/security/guardrails/')) {
        return { tab: 'privacy', seg1: '', url: '/app/settings/organisation/privacy' };
    }
    if (p === 'admin/monitoring') {
        return { tab: 'org_usage', seg1: '', url: '/app/settings/organisation/usage' };
    }
    if (p === 'admin/monitoring/activity') {
        // The safety/egress monitoring moved into the Privacy Shield screen as
        // its Activity tab. The tab rides in a QUERY param (OrgShieldEditor
        // reads ?tab= via useUrlQueryParam), never a 4th path segment.
        return { tab: 'privacy', seg1: '', url: '/app/settings/organisation/privacy?tab=activity' };
    }
    return null;
}
