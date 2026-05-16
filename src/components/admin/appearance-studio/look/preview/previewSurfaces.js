import { MessageSquare, Search, Settings, LayoutGrid } from 'lucide-react';

/**
 * Surfaces available in the Look preview pane. Each one mounts the real route
 * inside a same-origin iframe with `?themePreview=1` so it skips the server
 * fetch and listens for postMessage theme patches instead.
 *
 * Mirrors the old theme-studio surface list — admins are used to these four.
 */
export const PREVIEW_SURFACES = [
    { id: 'chat',     label: 'Chat',     icon: MessageSquare, path: '/app' },
    { id: 'search',   label: 'Search',   icon: Search,        path: '/app',          extraQuery: '&overlay=search' },
    { id: 'settings', label: 'Settings', icon: Settings,      path: '/app/settings', extraQuery: '&sidebar=collapsed' },
    { id: 'studio',   label: 'Studio',   icon: LayoutGrid,    path: '/app/studio' },
];

/** URL-safe base64 of a JSON-stringified theme payload. */
export function encodeThemePayload(payload) {
    const json = JSON.stringify(payload);
    const b64 = btoa(json);
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Build the iframe `src` for a surface. Encoded `?t=` carries the admin's
 *  draft so the iframe paints with it on first frame. */
export function buildPreviewUrl(surface, draftPayload) {
    const t = encodeThemePayload(draftPayload);
    const extra = surface.extraQuery || '';
    return `${surface.path}?themePreview=1&t=${t}${extra}`;
}
