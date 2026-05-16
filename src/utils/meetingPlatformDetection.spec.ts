import { describe, it, expect } from 'vitest';
import { detectMeetingPlatform, platformBadge } from './meetingPlatformDetection';

describe('detectMeetingPlatform', () => {
    it('returns null for empty/unrecognised URLs', () => {
        expect(detectMeetingPlatform(null)).toBeNull();
        expect(detectMeetingPlatform('')).toBeNull();
        expect(detectMeetingPlatform('https://example.com/foo')).toBeNull();
    });

    it('falls back to a sensible default per family when no platforms are loaded', () => {
        const r = detectMeetingPlatform('https://meet.google.com/abc-defg-hij');
        expect(r).toEqual({
            id: 'google',
            label: 'Google Meet',
            requiresCreds: true,
            color: '#1a73e8',
            configured: true,
            family: 'google',
        });
    });

    it('prefers the first configured provider in family.order', () => {
        const r = detectMeetingPlatform('https://meet.google.com/x', [
            { platform: 'google', configured: false },
            { platform: 'google-meet-sdk', configured: true, label: 'Meet (SDK)' },
        ]);
        expect(r?.id).toBe('google-meet-sdk');
        expect(r?.configured).toBe(true);
    });

    it('surfaces an unconfigured provider when nothing in the family is configured', () => {
        const r = detectMeetingPlatform('https://teams.microsoft.com/meet/abc', [
            { platform: 'teams-graph', configured: false, label: 'Teams' },
        ]);
        expect(r?.id).toBe('teams-graph');
        expect(r?.configured).toBe(false);
        expect(r?.family).toBe('teams');
    });

    it('matches the Nextcloud Talk URL shape', () => {
        const a = detectMeetingPlatform('https://cloud.example.com/index.php/call/abc123');
        const b = detectMeetingPlatform('https://cloud.example.com/call/xyz789');
        expect(a?.family).toBe('nextcloud');
        expect(b?.family).toBe('nextcloud');
    });
});

describe('platformBadge', () => {
    it('returns a known badge for each canonical id', () => {
        expect(platformBadge('google').color).toBe('#1a73e8');
        expect(platformBadge('zoom').label).toBe('Zoom');
        expect(platformBadge('teams-graph').emoji).toBe('⚡');
    });

    it('falls back to a generic Bot badge for unknown ids', () => {
        expect(platformBadge('something-else').label).toBe('something-else');
        expect(platformBadge(null).label).toBe('Bot');
    });
});
