// Meeting-bot platform detection — figures out which transcription
// provider should be offered for a given meeting URL (Google Meet, Teams,
// Zoom, Nextcloud Talk) and reconciles that against the backend's
// /api/meet-bot/platforms config (provider priority, whether SDK
// providers are configured, credentials requirements).
//
// Extracted from pages/MeetingNotesPage.jsx where it lived inline.

export type MeetingFamily = 'google' | 'teams' | 'zoom' | 'nextcloud';

export interface PlatformAvailability {
    platform: string;
    label?: string;
    configured?: boolean;
    requiresCredentials?: boolean;
}

export interface PlatformBadge {
    label: string;
    color: string;
    emoji: string;
}

export interface DetectedPlatform {
    id: string;
    label: string;
    requiresCreds: boolean;
    color: string;
    configured: boolean;
    family: MeetingFamily;
}

interface FamilyMeta {
    label: string;
    color: string;
    order: readonly string[];
    fallbackId: string;
    fallbackRequiresCreds: boolean;
}

const FAMILIES: Record<MeetingFamily, FamilyMeta> = {
    google: {
        label: 'Google Meet',
        color: '#1a73e8',
        order: ['google-meet-sdk', 'google'],
        fallbackId: 'google',
        fallbackRequiresCreds: true,
    },
    teams: {
        label: 'Microsoft Teams',
        color: '#5059c9',
        order: ['teams-graph'],
        fallbackId: 'teams-graph',
        fallbackRequiresCreds: false,
    },
    zoom: {
        label: 'Zoom',
        color: '#2d8cff',
        order: ['zoom'],
        fallbackId: 'zoom',
        fallbackRequiresCreds: false,
    },
    nextcloud: {
        label: 'Nextcloud Talk',
        color: '#0082c9',
        order: ['nextcloud-talk'],
        fallbackId: 'nextcloud-talk',
        fallbackRequiresCreds: false,
    },
};

function familyForUrl(url: string): MeetingFamily | null {
    if (/meet\.google\.com/i.test(url)) return 'google';
    if (/teams\.(microsoft|live)\.com/i.test(url)) return 'teams';
    if (/zoom\.us/i.test(url)) return 'zoom';
    // Nextcloud Talk: /index.php/call/<token> or /call/<token>
    if (/(?:\/index\.php)?\/call\/[a-zA-Z0-9]+(?:[/?#]|$)/.test(url)) return 'nextcloud';
    return null;
}

/**
 * Resolve a small badge (label/color/emoji) for any platform id, including
 * provider variants like 'google-meet-sdk' or 'teams-graph'. Falls back to
 * a neutral 'Bot' badge for unknown ids.
 */
export function platformBadge(platform: string | null | undefined): PlatformBadge {
    switch (platform) {
        case 'google': return { label: 'Google Meet', color: '#1a73e8', emoji: '🟢' };
        case 'google-meet-sdk': return { label: 'Meet (SDK)', color: '#1a73e8', emoji: '⚡' };
        case 'teams-graph': return { label: 'Teams', color: '#5059c9', emoji: '⚡' };
        case 'zoom': return { label: 'Zoom', color: '#2d8cff', emoji: '🔵' };
        case 'nextcloud-talk': return { label: 'Nextcloud Talk', color: '#0082c9', emoji: '💬' };
        default: return { label: platform || 'Bot', color: '#6366f1', emoji: '🤖' };
    }
}

/**
 * Given a meeting URL and the backend's known platform list, return the
 * provider that should be offered (id + label + colour + credentials
 * flag) or null when the URL doesn't match a known platform.
 *
 * If the backend hasn't responded yet (platforms == []) we fall back to a
 * sensible default per family so the UI can still render.
 */
export function detectMeetingPlatform(
    url: string | null | undefined,
    platforms: readonly PlatformAvailability[] = [],
): DetectedPlatform | null {
    if (!url) return null;
    const family = familyForUrl(url);
    if (!family) return null;
    const meta = FAMILIES[family];
    const available = Array.isArray(platforms) ? platforms : [];

    if (available.length > 0) {
        // Prefer the first configured provider in family.order.
        for (const id of meta.order) {
            const p = available.find((x) => x.platform === id);
            if (p && p.configured) {
                return {
                    id: p.platform,
                    label: p.label || platformBadge(p.platform).label || meta.label,
                    requiresCreds: !!p.requiresCredentials,
                    color: meta.color,
                    configured: true,
                    family,
                };
            }
        }
        // Otherwise, surface the highest-priority known-but-unconfigured one.
        const known = meta.order
            .map((id) => available.find((x) => x.platform === id))
            .find(Boolean);
        if (known) {
            return {
                id: known.platform,
                label: known.label || platformBadge(known.platform).label || meta.label,
                requiresCreds: !!known.requiresCredentials,
                color: meta.color,
                configured: false,
                family,
            };
        }
    }

    return {
        id: meta.fallbackId,
        label: meta.label,
        requiresCreds: meta.fallbackRequiresCreds,
        color: meta.color,
        configured: true,
        family,
    };
}
