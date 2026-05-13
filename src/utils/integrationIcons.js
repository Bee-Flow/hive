/**
 * Integration icon registry — mirrors server/core/integrationToolMap.js
 * (INTEGRATION_PREFIXES) so the visual automation builder can render a
 * recognizable brand mark on every node and palette chip without a
 * round-trip to the server.
 *
 * The bundled fallback is a brand-coloured letter-mark (deliberately not a
 * brand SVG — we don't bundle third-party trademarks). Users / orgs can
 * override any entry via the existing icon-pack editor under the
 * `integration.<id>` namespace (see emojiCatalog.js); useIntegrationIcon
 * picks that up automatically.
 */

import { useIconPack } from '../hooks/useIconPack';

/**
 * id → { label, color, mark }. id matches the `integration` field returned
 * by the server's resolveIntegration() so palette chips and nodes line up
 * with /api/automation/catalog responses.
 */
export const INTEGRATION_META = {
    gmail:                  { label: 'Gmail',                color: '#EA4335', mark: 'G' },
    google_calendar:        { label: 'Google Calendar',      color: '#4285F4', mark: 'GC' },
    google_drive:           { label: 'Google Drive',         color: '#1FA463', mark: 'GD' },
    google_docs:            { label: 'Google Docs',          color: '#1A73E8', mark: 'GD' },
    google_contacts:        { label: 'Google Contacts',      color: '#1A73E8', mark: 'GC' },
    google_keep:            { label: 'Google Keep',          color: '#FBBC04', mark: 'GK' },
    google_groups:          { label: 'Google Groups',        color: '#34A853', mark: 'GG' },
    outlook:                { label: 'Outlook',              color: '#0078D4', mark: 'O' },
    ms_calendar:            { label: 'Microsoft Calendar',   color: '#0078D4', mark: 'MC' },
    ms_contacts:            { label: 'Microsoft Contacts',   color: '#0078D4', mark: 'MC' },
    onedrive:               { label: 'OneDrive',             color: '#0364B8', mark: 'OD' },
    n8n:                    { label: 'n8n',                  color: '#EA4B71', mark: 'n8' },
    fireflies:              { label: 'Fireflies',            color: '#F0511E', mark: 'F' },
    youtrack:               { label: 'YouTrack',             color: '#F65DAB', mark: 'YT' },
    signrequest:            { label: 'SignRequest',          color: '#2D9CDB', mark: 'SR' },
    gamma:                  { label: 'Gamma',                color: '#7C3AED', mark: 'Ga' },
    linkedin:               { label: 'LinkedIn',             color: '#0A66C2', mark: 'in' },
    github:                 { label: 'GitHub',               color: '#181717', mark: 'GH' },
    media_gen:              { label: 'Media Generation',     color: '#0EA5E9', mark: 'M' },
    maps:                   { label: 'Google Maps',          color: '#34A853', mark: 'M' },
    keyword_planner:        { label: 'Keyword Planner',      color: '#FBBC04', mark: 'KP' },
    transcription:          { label: 'Transcription',        color: '#0EA5E9', mark: 'Tr' },
    nextcloud:              { label: 'Nextcloud Files',      color: '#0082C9', mark: 'NC' },
    nextcloud_calendar:     { label: 'Nextcloud Calendar',   color: '#0082C9', mark: 'NC' },
    nextcloud_contacts:     { label: 'Nextcloud Contacts',   color: '#0082C9', mark: 'NC' },
    nextcloud_deck:         { label: 'Nextcloud Deck',       color: '#0082C9', mark: 'ND' },
    nextcloud_notifications:{ label: 'Nextcloud Notifications', color: '#0082C9', mark: 'NN' },
    nextcloud_talk:         { label: 'Nextcloud Talk',       color: '#0082C9', mark: 'NT' },
    nextcloud_tasks:        { label: 'Nextcloud Tasks',      color: '#0082C9', mark: 'NT' },
    nextcloud_notes:        { label: 'Nextcloud Notes',      color: '#0082C9', mark: 'NN' },
    nextcloud_mail:         { label: 'Nextcloud Mail',       color: '#0082C9', mark: 'NM' },
    nextcloud_activity:     { label: 'Nextcloud Activity',   color: '#0082C9', mark: 'NA' },
    nextcloud_status:       { label: 'Nextcloud Status',     color: '#0082C9', mark: 'NS' },
    web_search:             { label: 'Web Search',           color: '#0EA5E9', mark: 'WS' },
    agent_search:           { label: 'Web Search',           color: '#0EA5E9', mark: 'WS' },
    kb_search:              { label: 'Knowledge Base',       color: '#10B981', mark: 'KB' },
    email:                  { label: 'Email',                color: '#0EA5E9', mark: '@' },
    calendar:               { label: 'Calendar',             color: '#0EA5E9', mark: 'Ca' },
    image_gen:              { label: 'Image Generation',     color: '#0EA5E9', mark: 'Im' },
    video_gen:              { label: 'Video Generation',     color: '#0EA5E9', mark: 'Vi' },
    elevenlabs:             { label: 'ElevenLabs',           color: '#0EA5E9', mark: 'EL' },
    mcp:                    { label: 'MCP',                  color: '#10B981', mark: 'MC' },
    webpages:               { label: 'Webpages',             color: '#0EA5E9', mark: 'Wp' },
};

/**
 * Prefix → integration id, sorted longest-first so `ms_calendar_` matches
 * before `ms_`. Mirrors INTEGRATION_PREFIXES in
 * server/core/integrationToolMap.js — keep in sync when adding tools.
 */
const PREFIX_TO_INTEGRATION = [
    ['nextcloud_calendar_', 'nextcloud_calendar'],
    ['nextcloud_contacts_', 'nextcloud_contacts'],
    ['nextcloud_deck_', 'nextcloud_deck'],
    ['nextcloud_notifications_', 'nextcloud_notifications'],
    ['nextcloud_talk_', 'nextcloud_talk'],
    ['nextcloud_tasks_', 'nextcloud_tasks'],
    ['nextcloud_notes_', 'nextcloud_notes'],
    ['nextcloud_mail_', 'nextcloud_mail'],
    ['nextcloud_activity_', 'nextcloud_activity'],
    ['nextcloud_status_', 'nextcloud_status'],
    ['nextcloud_', 'nextcloud'],
    ['ms_calendar_', 'ms_calendar'],
    ['ms_contacts_', 'ms_contacts'],
    ['keyword_planner_', 'keyword_planner'],
    ['n8n_workflow_', 'n8n'],
    ['n8n_', 'n8n'],
    ['gmail_', 'gmail'],
    ['calendar_', 'google_calendar'],
    ['drive_', 'google_drive'],
    ['docs_', 'google_docs'],
    ['contacts_', 'google_contacts'],
    ['keep_', 'google_keep'],
    ['groups_', 'google_groups'],
    ['outlook_', 'outlook'],
    ['onedrive_', 'onedrive'],
    ['fireflies_', 'fireflies'],
    ['youtrack_', 'youtrack'],
    ['signrequest_', 'signrequest'],
    ['gamma_', 'gamma'],
    ['linkedin_', 'linkedin'],
    ['github_', 'github'],
    ['generate_', 'media_gen'],
    ['maps_', 'maps'],
    ['transcribe_', 'transcription'],
].sort((a, b) => b[0].length - a[0].length);

const STATIC_TOOL_TO_INTEGRATION = {
    agent_search: 'web_search',
    web_search: 'web_search',
    kb_search: 'kb_search',
    send_email: 'email',
    read_emails: 'email',
    search_emails: 'email',
    read_calendar: 'calendar',
    create_calendar_event: 'calendar',
    search_maps: 'maps',
    get_directions: 'maps',
    generate_image: 'image_gen',
    generate_video: 'video_gen',
    generate_music: 'elevenlabs',
    generate_song: 'elevenlabs',
    generate_tts: 'elevenlabs',
    generate_sfx: 'elevenlabs',
    n8n_execute: 'n8n',
};

/**
 * Resolve a tool name to its integration id. Mirrors the server-side
 * resolveIntegration() so the palette and graph nodes don't need a
 * roundtrip. Returns null when the name doesn't belong to a known
 * integration (e.g. internal `regex_*` / `notebook_*` tools).
 */
export function resolveIntegrationFromTool(toolName) {
    if (!toolName) return null;
    if (STATIC_TOOL_TO_INTEGRATION[toolName]) return STATIC_TOOL_TO_INTEGRATION[toolName];
    for (const [prefix, id] of PREFIX_TO_INTEGRATION) {
        if (toolName.startsWith(prefix)) return id;
    }
    if (toolName.startsWith('mcp__') || toolName.startsWith('mcp_')) return 'mcp';
    return null;
}

/**
 * Hook variant: returns { kind: 'image'|'emoji'|'mark', value, meta }.
 *   - `image`: user-uploaded logo wins (kind: 'image', value: URL).
 *   - `emoji`: user-picked emoji override (kind: 'emoji', value: string).
 *   - `mark`:  bundled brand-coloured letter-mark fallback. value is the
 *              letter(s), meta.color is the brand background.
 *
 * Consumed by <IntegrationLogo>. Returns null when no integration id is
 * provided so callers can render their own generic icon.
 */
export function useIntegrationIcon(integrationId) {
    const { getCustomIcon } = useIconPack();
    if (!integrationId) return null;
    // INTEGRATION_META keys use underscore form (`google_drive`) but
    // upstream callers may pass either form depending on the source —
    // server's TOOL_REGISTRY uses dashes (`google-drive`), client tool
    // prefix resolver uses underscores. Normalise here so both shapes hit.
    const normalised = String(integrationId).replace(/-/g, '_');
    const custom = getCustomIcon(`integration.${normalised}`) || getCustomIcon(`integration.${integrationId}`);
    const meta = INTEGRATION_META[normalised] || INTEGRATION_META[integrationId] || null;
    if (custom?.type === 'image' && custom.value) return { kind: 'image', value: custom.value, meta };
    if (custom?.type === 'emoji' && custom.value) return { kind: 'emoji', value: custom.value, meta };
    if (!meta) return null;
    return { kind: 'mark', value: meta.mark, meta };
}
