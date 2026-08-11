import React, { useCallback, useState } from 'react';
import ComplianceHub from '../components/admin/ComplianceHub';
import { rewriteComplianceNav } from '../pages/settings/complianceNavAdapter';

/**
 * The Compliance Center demo — the real hub, with somewhere to click.
 *
 * `ComplianceHub` is a CONTROLLED component: it never owns `activeSection`.
 * In the product the URL owns it (AdvancedSettings reads the path segment and
 * complianceNavAdapter writes it back), and the hub reports a click by calling
 * `onNavigate('admin/compliance/<section>')`. The demo used to mount the hub
 * directly with `onNavigate: null`, so `handleSectionClick` was a no-op and
 * every one of the sixteen sections plus the GDPR/ISO framework switch was
 * dead — a visitor saw the Overview and nothing else, while the fixture held
 * 44 checks, 93 Annex A controls, a DSR inbox and a Statement of Applicability
 * that could not be reached. The page copy meanwhile invited them to "switch
 * between the privacy frameworks and ISO 27001 on the left".
 *
 * So this host supplies the missing half: it holds the section in local state
 * and plays the role the URL plays in the product. It does NOT teach the hub
 * to navigate itself — a second, internal source of truth for the active
 * section is exactly the drift the controlled design avoids.
 *
 * `rewriteComplianceNav` is the product's own parser, reused rather than
 * re-implemented: same path family, same `overview` default, same checkId
 * decoding. It returns null for anything outside `admin/compliance/*`, which
 * is the behaviour we want for the remediation links that point elsewhere —
 * `admin/agents`, `admin/security/guardrails`, `admin/monitoring/activity`.
 * Those screens are not in this demo, and a no-op is better than dumping the
 * visitor on an unrelated section or a blank pane.
 */
export default function ComplianceDemo({ exportsEnabled = false }) {
    const [nav, setNav] = useState({ section: 'overview', checkId: '' });

    const handleNavigate = useCallback((path) => {
        const target = rewriteComplianceNav(path);
        if (!target) return; // outside the hub — nothing to show here
        setNav({ section: target.section, checkId: target.checkId || '' });
    }, []);

    return (
        <ComplianceHub
            activeSection={nav.section}
            focusCheckId={nav.checkId || null}
            onNavigate={handleNavigate}
            // Every register offers a PDF or a zip through a plain
            // `<a href download>`, which is a browser navigation the demo
            // transport cannot answer. The hub hides the buttons rather than
            // serving a broken one.
            exportsEnabled={exportsEnabled}
        />
    );
}
