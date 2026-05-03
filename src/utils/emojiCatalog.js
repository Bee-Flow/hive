/**
 * Frontend mirror of server/core/emojiCatalog.js. Pure data — no React.
 * Manually kept in sync with the server module (this list rarely changes).
 *
 * Used by:
 *   - components/AppEmoji.jsx       (default emoji lookup by id)
 *   - admin/AppearanceAdminPanel    (renders categories when offline / fast init)
 *   - utils/helpers.js              (toolNameToCatalogId mapping)
 *
 * The Appearance panel still fetches the authoritative version from
 * /api/icons/catalog at runtime; this file is the synchronous fallback so
 * <AppEmoji id="..."> renders the right default before the catalog loads.
 */

export const EMOJI_CATEGORIES = [
    {
        name: 'Tools',
        entries: [
            { id: 'tools.search',           label: 'Search',                    defaultEmoji: '🔍' },
            { id: 'tools.web_browser',      label: 'Web browser',               defaultEmoji: '🌐' },
            { id: 'tools.terminal',         label: 'Terminal',                  defaultEmoji: '💻' },
            { id: 'tools.python',           label: 'Python interpreter',        defaultEmoji: '🐍' },
            { id: 'tools.notebook_write',   label: 'Notebook · write',          defaultEmoji: '📝' },
            { id: 'tools.notebook_attach',  label: 'Notebook · attach source',  defaultEmoji: '📎' },
            { id: 'tools.sql',              label: 'SQL query',                 defaultEmoji: '🗄️' },
            { id: 'tools.file_read',        label: 'File reader',               defaultEmoji: '📂' },
            { id: 'tools.document_reader',  label: 'Document reader',           defaultEmoji: '📄' },
            { id: 'tools.gmail',            label: 'Gmail',                     defaultEmoji: '📧' },
            { id: 'tools.calendar',         label: 'Calendar',                  defaultEmoji: '📅' },
            { id: 'tools.thinking',         label: 'Sequential thinking',       defaultEmoji: '🧠' },
            { id: 'tools.api_fetcher',      label: 'API fetcher',               defaultEmoji: '🔗' },
            { id: 'tools.skill',            label: 'Skill',                     defaultEmoji: '🧩' },
            { id: 'tools.session_skill',    label: 'Session skill',             defaultEmoji: '🐝' },
            { id: 'tools.skill_complete',   label: 'Skill complete',            defaultEmoji: '✅' },
            { id: 'tools.skill_publish',    label: 'Skill publish to library',  defaultEmoji: '⭐' },
            { id: 'tools.gamma_create',     label: 'Gamma · create',            defaultEmoji: '📊' },
            { id: 'tools.gamma_status',     label: 'Gamma · generation status', defaultEmoji: '⏱️' },
            { id: 'tools.gamma_themes',     label: 'Gamma · themes',            defaultEmoji: '🎨' },
            { id: 'tools.gamma_folders',    label: 'Gamma · folders',           defaultEmoji: '📁' },
            { id: 'tools.fallback',         label: 'Generic tool (fallback)',   defaultEmoji: '🔧' },
        ],
    },
    {
        name: 'Guardrail categories',
        entries: [
            { id: 'guardrail.violence',            label: 'Violent crimes',            defaultEmoji: '⚔️' },
            { id: 'guardrail.crimes',              label: 'Non-violent crimes',        defaultEmoji: '⚠️' },
            { id: 'guardrail.sex_crimes',          label: 'Sex-related crimes',        defaultEmoji: '🚫' },
            { id: 'guardrail.csae',                label: 'Child sexual exploitation', defaultEmoji: '🔴' },
            { id: 'guardrail.defamation',          label: 'Defamation',                defaultEmoji: '🗣️' },
            { id: 'guardrail.specialized_advice',  label: 'Specialized advice',        defaultEmoji: '⚖️' },
            { id: 'guardrail.privacy',             label: 'Privacy',                   defaultEmoji: '🔒' },
            { id: 'guardrail.ip',                  label: 'Intellectual property',     defaultEmoji: '©️' },
            { id: 'guardrail.weapons',             label: 'Indiscriminate weapons',    defaultEmoji: '💣' },
            { id: 'guardrail.hate',                label: 'Hate',                      defaultEmoji: '🚷' },
            { id: 'guardrail.self_harm',           label: 'Suicide & self-harm',       defaultEmoji: '💔' },
            { id: 'guardrail.sexual',              label: 'Sexual content',            defaultEmoji: '🔞' },
            { id: 'guardrail.elections',           label: 'Elections',                 defaultEmoji: '🗳️' },
            { id: 'guardrail.code_abuse',          label: 'Code interpreter abuse',    defaultEmoji: '💻' },
        ],
    },
    {
        name: 'File types',
        entries: [
            { id: 'file.pdf',     label: 'PDF',               defaultEmoji: '📄' },
            { id: 'file.word',    label: 'Word document',     defaultEmoji: '📝' },
            { id: 'file.excel',   label: 'Excel / CSV',       defaultEmoji: '📊' },
            { id: 'file.text',    label: 'Plain text',        defaultEmoji: '📋' },
            { id: 'file.url',     label: 'URL / website',     defaultEmoji: '🌐' },
            { id: 'file.cloud',   label: 'Cloud file',        defaultEmoji: '☁️' },
            { id: 'file.folder',  label: 'Folder',            defaultEmoji: '📁' },
            { id: 'file.meeting', label: 'Meeting recording', defaultEmoji: '🎙️' },
        ],
    },
    {
        name: 'Integration providers',
        entries: [
            { id: 'integration.fast',      label: 'Fast / cloud LLM',  defaultEmoji: '⚡' },
            { id: 'integration.cloud',     label: 'Cloud',             defaultEmoji: '☁️' },
            { id: 'integration.recording', label: 'Recording',         defaultEmoji: '🎙️' },
            { id: 'integration.local',     label: 'Local / on-prem',   defaultEmoji: '🏠' },
            { id: 'integration.web',       label: 'Web mode',          defaultEmoji: '🌐' },
            { id: 'integration.default',   label: 'Generic (fallback)', defaultEmoji: '🔌' },
        ],
    },
    {
        name: 'Model tiers',
        entries: [
            { id: 'tier.auto',      label: 'Auto',            defaultEmoji: '🔀' },
            { id: 'tier.fast',      label: 'Fast',            defaultEmoji: '⚡' },
            { id: 'tier.standard',  label: 'Flow (standard)', defaultEmoji: '🐝' },
            { id: 'tier.swarm',     label: 'Swarm',           defaultEmoji: '🐝🐝' },
            { id: 'tier.thinking',  label: 'Think',           defaultEmoji: '🧠' },
            { id: 'tier.writer',    label: 'Write',           defaultEmoji: '✍️' },
            { id: 'tier.deep',      label: 'Deep thinking',   defaultEmoji: '✨' },
            { id: 'tier.custom',    label: 'Custom tier',     defaultEmoji: '✨' },
        ],
    },
    {
        name: 'Status indicators',
        entries: [
            { id: 'status.success',    label: 'Success',    defaultEmoji: '✅' },
            { id: 'status.warning',    label: 'Warning',    defaultEmoji: '⚠️' },
            { id: 'status.error',      label: 'Error',      defaultEmoji: '❌' },
            { id: 'status.info',       label: 'Info',       defaultEmoji: 'ℹ️' },
            { id: 'status.processing', label: 'Processing', defaultEmoji: '⏳' },
        ],
    },
];

export const EMOJI_BY_ID = Object.fromEntries(
    EMOJI_CATEGORIES.flatMap(c => c.entries.map(e => [e.id, e]))
);

export const ALL_EMOJI_IDS = EMOJI_CATEGORIES.flatMap(c => c.entries.map(e => e.id));

export function defaultEmojiFor(id) {
    return EMOJI_BY_ID[id]?.defaultEmoji || null;
}

export function labelFor(id) {
    return EMOJI_BY_ID[id]?.label || id;
}
