import { API_BASE } from './helpers';

// Agent avatars are stored as a single string that can be:
//   - an emoji ("🤖")
//   - a base64 data-URL ("data:image/png;base64,...")
//   - an absolute http(s) URL
//   - a server-relative upload path ("/uploads/agents/<id>.png")
// All consumers in the app must agree on detection and src resolution, so
// these helpers are the single source of truth.

export const DEFAULT_AGENT_EMOJI = '🤖';

export function isImageAvatar(value) {
    return !!value
        && typeof value === 'string'
        && (value.startsWith('data:') || value.startsWith('http') || value.startsWith('/'));
}

// For server-relative paths we prefix API_BASE so dev (Vite on a different
// port than the API server) and embed iframes resolve the same as production
// nginx. data: and http(s) URLs are returned unchanged.
export function resolveAvatarSrc(value) {
    if (!value) return '';
    if (value.startsWith('/')) return `${API_BASE}${value}`;
    return value;
}

// During the migration window an older agent may only have its avatar in
// `config.avatar`. New writes go to the top-level column; reads fall through
// to config so existing pictures don't disappear.
export function pickAgentAvatar(agent) {
    if (!agent) return null;
    return agent.avatar || agent.config?.avatar || null;
}
