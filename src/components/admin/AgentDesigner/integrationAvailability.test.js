import { describe, it, expect } from 'vitest';
import { filterAvailableIntegrations, ALWAYS_AVAILABLE } from './integrationAvailability';

// Minimal catalog stand-in — the filter only reads id/group.
const CATALOG = [
    { id: 'agent-search', label: 'Web Search', group: 'platform' },
    { id: 'gmail', label: 'Gmail', group: 'google' },
    { id: 'google-calendar', label: 'Calendar', group: 'google' },
    { id: 'outlook', label: 'Outlook', group: 'microsoft' },
    { id: 'fireflies', label: 'Fireflies', group: 'third-party' },
    { id: 'youtrack', label: 'YouTrack', group: 'third-party' },
    { id: 'gamma', label: 'Gamma', group: 'third-party' },
    { id: 'n8n', label: 'n8n', group: 'third-party' },
    { id: 'linkedin', label: 'LinkedIn', group: 'third-party' },
];

const ids = (list) => list.map(i => i.id);

describe('filterAvailableIntegrations', () => {
    it('returns the full catalog while status has not loaded', () => {
        expect(filterAvailableIntegrations(CATALOG, null)).toEqual(CATALOG);
        expect(filterAvailableIntegrations(CATALOG, undefined)).toEqual(CATALOG);
    });

    it('gates google-group apps on isGoogleUser', () => {
        const out = ids(filterAvailableIntegrations(CATALOG, { isGoogleUser: false }));
        expect(out).not.toContain('gmail');
        expect(out).not.toContain('google-calendar');
        const on = ids(filterAvailableIntegrations(CATALOG, { isGoogleUser: true }));
        expect(on).toContain('gmail');
    });

    it('gates credentialed third-party apps on their config flags', () => {
        const none = ids(filterAvailableIntegrations(CATALOG, {}));
        expect(none).not.toContain('fireflies');
        expect(none).not.toContain('youtrack');
        expect(none).not.toContain('gamma');
        expect(none).not.toContain('n8n');
        expect(none).not.toContain('linkedin');
        // Non-gated entries stay
        expect(none).toContain('outlook');

        const all = ids(filterAvailableIntegrations(CATALOG, {
            hasFirefliesKey: true, hasYouTrackConfig: true, hasGammaKey: true,
            hasN8nConfig: true, linkedInConnected: true,
        }));
        expect(all).toEqual(expect.arrayContaining(['fireflies', 'youtrack', 'gamma', 'n8n', 'linkedin']));
    });

    it('org-enabled list filters everything except ALWAYS_AVAILABLE', () => {
        const out = ids(filterAvailableIntegrations(CATALOG, {
            orgEnabledIntegrations: ['outlook'], isGoogleUser: true,
        }));
        expect(out).toEqual(['agent-search', 'outlook']);
        expect(ALWAYS_AVAILABLE.has('agent-search')).toBe(true);
    });
});
