import { describe, it, expect } from 'vitest';
import { rewriteComplianceNav, rewriteAdminEscape } from './complianceNavAdapter';

describe('rewriteComplianceNav', () => {
    it('maps the bare hub path to overview', () => {
        expect(rewriteComplianceNav('admin/compliance')).toEqual({
            section: 'overview',
            checkId: '',
            url: '/app/settings/organisation/compliance/overview',
        });
    });

    it('maps a section path', () => {
        expect(rewriteComplianceNav('admin/compliance/gdpr')).toEqual({
            section: 'gdpr',
            checkId: '',
            url: '/app/settings/organisation/compliance/gdpr',
        });
    });

    it('keeps compliance settings inside the settings surface', () => {
        // The remediation link of DPO/notice/breach checks — must NOT bounce
        // the user out to the admin dashboard.
        expect(rewriteComplianceNav('admin/compliance/settings').url)
            .toBe('/app/settings/organisation/compliance/settings');
    });

    it('decodes the check id but keeps the URL segment encoded', () => {
        const hit = rewriteComplianceNav('admin/compliance/gdpr/GDPR-Art32%20x');
        expect(hit.section).toBe('gdpr');
        expect(hit.checkId).toBe('GDPR-Art32 x');
        expect(hit.url).toBe('/app/settings/organisation/compliance/gdpr/GDPR-Art32%20x');
    });

    it('passes through non-compliance admin paths', () => {
        // e.g. the Art-32 access-logging remediation link → admin dashboard.
        expect(rewriteComplianceNav('admin/monitoring/activity')).toBeNull();
        expect(rewriteComplianceNav('admin/security')).toBeNull();
    });

    it('does not match prefixes of other tabs', () => {
        expect(rewriteComplianceNav('admin/compliance-other')).toBeNull();
    });

    it('handles empty and missing input', () => {
        expect(rewriteComplianceNav('')).toBeNull();
        expect(rewriteComplianceNav(undefined)).toBeNull();
    });
});

describe('rewriteAdminEscape', () => {
    it('maps security/guardrails onto the Privacy Shield tab', () => {
        const expected = { tab: 'privacy', seg1: '', url: '/app/settings/organisation/privacy' };
        // The DLP checks read exactly the config OrgShieldEditor (the Privacy
        // tab) writes — all three link shapes land there.
        expect(rewriteAdminEscape('admin/security')).toEqual(expected);
        expect(rewriteAdminEscape('admin/security/guardrails')).toEqual(expected);
        expect(rewriteAdminEscape('admin/security/guardrails/patterns')).toEqual(expected);
    });

    it('maps monitoring onto Usage, and activity onto the shield\'s Activity tab', () => {
        expect(rewriteAdminEscape('admin/monitoring')).toEqual({
            tab: 'org_usage', seg1: '', url: '/app/settings/organisation/usage',
        });
        // The safety/egress reports moved from Usage into the Privacy Shield
        // screen; the tab is a QUERY param by contract (OrgShieldEditor).
        expect(rewriteAdminEscape('admin/monitoring/activity')).toEqual({
            tab: 'privacy', seg1: '', url: '/app/settings/organisation/privacy?tab=activity',
        });
    });

    it('leaves the agents surfaces to the admin dashboard', () => {
        // Organisation settings no longer hosts an Agents tab, so these have no
        // settings equivalent to escape to.
        expect(rewriteAdminEscape('admin/agents')).toBeNull();
        expect(rewriteAdminEscape('admin/chat')).toBeNull();
        expect(rewriteAdminEscape('admin/system')).toBeNull();
    });

    it('leaves admin surfaces without a settings equivalent alone', () => {
        expect(rewriteAdminEscape('admin/security/users')).toBeNull();
        expect(rewriteAdminEscape('admin/security/sso')).toBeNull();
        expect(rewriteAdminEscape('admin/ai-config')).toBeNull();
        expect(rewriteAdminEscape('admin')).toBeNull();
    });

    it('never claims compliance paths — rewriteComplianceNav owns those', () => {
        expect(rewriteAdminEscape('admin/compliance/gdpr')).toBeNull();
        expect(rewriteAdminEscape('admin/compliance')).toBeNull();
    });

    it('handles empty and missing input', () => {
        expect(rewriteAdminEscape('')).toBeNull();
        expect(rewriteAdminEscape(undefined)).toBeNull();
    });
});
