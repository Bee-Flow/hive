// Shared integration catalog — used by both the super-admin
// IntegrationsAdminPanel and the org-admin OrgFeatureTogglesPanel so the
// two stay in sync. IDs here mirror the runtime gates in
// server/core/integrationTools.js and server/core/ncIntegrationCatalog.js
// — never rename without updating those.

export const INTEGRATION_CATALOG = [
    { id: 'gmail', label: 'Gmail', description: 'Send and read emails', category: 'Google Workspace' },
    { id: 'google-calendar', label: 'Calendar', description: 'Manage calendar events', category: 'Google Workspace' },
    { id: 'google-drive', label: 'Drive', description: 'Access and manage files', category: 'Google Workspace' },
    { id: 'google-slides', label: 'Slides', description: 'Create presentations', category: 'Google Workspace' },
    { id: 'google-sheets', label: 'Sheets', description: 'Work with spreadsheets', category: 'Google Workspace' },
    { id: 'google-docs', label: 'Docs', description: 'Create and edit documents', category: 'Google Workspace' },
    { id: 'google-contacts', label: 'Contacts', description: 'Search, create & update contacts', category: 'Google Workspace' },
    { id: 'google-keep', label: 'Keep', description: 'List, create & delete notes (Workspace only)', category: 'Google Workspace' },
    { id: 'outlook', label: 'Outlook', description: 'Send and read emails', category: 'Microsoft 365' },
    { id: 'outlook-readonly', label: 'Outlook (Read-Only)', description: 'Search and read emails only', category: 'Microsoft 365' },
    { id: 'ms-calendar', label: 'Calendar', description: 'Manage calendar events', category: 'Microsoft 365' },
    { id: 'onedrive', label: 'OneDrive', description: 'Access and manage files', category: 'Microsoft 365' },
    { id: 'ms-contacts', label: 'Contacts', description: 'Search, create & update contacts', category: 'Microsoft 365' },
    { id: 'image-gen', label: 'Image Generation', description: 'Generate images with AI', category: 'AI & Media' },
    { id: 'music-gen', label: 'Music Generation', description: 'Generate music with AI (ElevenLabs)', category: 'AI & Media' },
    { id: 'video-gen', label: 'Video Generation', description: 'Generate short videos with AI (Veo)', category: 'AI & Media' },
    { id: 'elevenlabs', label: 'ElevenLabs', description: 'Music with vocals, TTS & sound effects', category: 'AI & Media' },
    { id: 'agent-search', label: 'Agent Search', description: 'AI-powered web search with reranking', category: 'AI & Media' },
    { id: 'transcription', label: 'Meeting Transcription', description: 'Transcribe audio with speaker diarization (Voxtral or Azure AI Speech)', category: 'AI & Media' },
    { id: 'fireflies', label: 'Fireflies', description: 'Meeting transcripts', category: 'Productivity' },
    { id: 'youtrack', label: 'YouTrack', description: 'Issue tracking', category: 'Developer' },
    { id: 'gamma', label: 'Gamma', description: 'Create presentations', category: 'Productivity' },
    { id: 'afas-profit', label: 'AFAS Profit', description: 'Query AFAS Profit business data (read-only)', category: 'Productivity' },
    { id: 'nmbrs', label: 'NMBRS', description: 'Read NMBRS payroll & HR data (read-only)', category: 'Productivity' },
    { id: 'n8n', label: 'n8n', description: 'Workflow automation', category: 'Automation' },
    { id: 'linkedin', label: 'LinkedIn', description: 'Post to LinkedIn', category: 'Social' },
    { id: 'github', label: 'GitHub', description: 'Repository management, view code', category: 'Developer' },
    { id: 'signrequest', label: 'SignRequest', description: 'E-signature requests', category: 'Productivity' },
    { id: 'maps', label: 'Google Maps', description: 'Places search, directions, geocoding', category: 'Google Workspace' },
    { id: 'google-groups', label: 'Google Groups', description: 'List and manage Google Workspace groups', category: 'Google Workspace' },
    { id: 'kb-search', label: 'Knowledge Base', description: 'Search org knowledge bases', category: 'AI & Media' },
    { id: 'webpages', label: 'Webpages', description: 'Run user-authored webpage automations', category: 'Automation' },
    { id: 'nextcloud', label: 'Nextcloud', description: 'Files & WebDAV (list, search, read, upload, share)', category: 'Nextcloud' },
    { id: 'nextcloud-mail', label: 'Nextcloud Mail', description: 'Send & read mail via Nextcloud Mail app', category: 'Nextcloud' },
    { id: 'nextcloud-calendar', label: 'Nextcloud Calendar', description: 'CalDAV — list, search, create, update, delete events', category: 'Nextcloud' },
    { id: 'nextcloud-contacts', label: 'Nextcloud Contacts', description: 'CardDAV — list, search, create, update, delete contacts', category: 'Nextcloud' },
    { id: 'nextcloud-deck', label: 'Nextcloud Deck', description: 'Kanban — boards, stacks, cards, labels, comments', category: 'Nextcloud' },
    { id: 'nextcloud-notifications', label: 'Nextcloud Notifications', description: 'List and dismiss Nextcloud notifications', category: 'Nextcloud' },
    { id: 'nextcloud-talk', label: 'Nextcloud Talk', description: 'Chat rooms, messages, reactions', category: 'Nextcloud' },
    { id: 'nextcloud-tasks', label: 'Nextcloud Tasks', description: 'VTODO via CalDAV — list, create, update, complete, delete tasks', category: 'Nextcloud' },
    { id: 'nextcloud-notes', label: 'Nextcloud Notes', description: 'Plain-text / markdown notes — list, search, create, update, delete', category: 'Nextcloud' },
    { id: 'nextcloud-activity', label: 'Nextcloud Activity', description: 'Read-only feed of recent file changes, shares, mentions', category: 'Nextcloud' },
    { id: 'nextcloud-status', label: 'Nextcloud User Status', description: "Get / set / clear the user's availability and custom message", category: 'Nextcloud' },
];

// Stable set of Nextcloud IDs — the org-admin generic toggle UI excludes
// these because they're managed by the dedicated Nextcloud panel.
export const NEXTCLOUD_INTEGRATION_IDS = new Set(
    INTEGRATION_CATALOG.filter(i => i.category === 'Nextcloud').map(i => i.id)
);

// Display order of category sections across the admin UIs. Categories not
// listed here (e.g. the dynamic 'MCP' group) are appended after these.
export const CATEGORY_ORDER = [
    'Google Workspace', 'Microsoft 365', 'Nextcloud', 'AI & Media',
    'Developer', 'Automation', 'Productivity', 'Social',
];

export function orderCategories(cats) {
    const present = new Set(cats);
    const ordered = CATEGORY_ORDER.filter(c => present.has(c));
    const extras = cats.filter(c => !CATEGORY_ORDER.includes(c)); // e.g. 'MCP'
    return [...ordered, ...extras];
}

export function getIntegrationById(id) {
    return INTEGRATION_CATALOG.find(i => i.id === id) || null;
}
