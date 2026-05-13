/**
 * Display helpers — turn machine identifiers (tool names, step refs)
 * into human-readable text for the canvas. The inspector still shows
 * the raw values; this module is for the at-a-glance node body where
 * underscores and step IDs make the diagram look like raw JSON.
 */

// Hand-curated proper-noun casing so 'gmail' renders as 'Gmail' instead
// of 'Gmail' is fine but 'github' should render as 'GitHub', 'youtrack'
// as 'YouTrack', etc. Anything not listed falls through to title-case.
const PROPER_CASE = {
    gmail: 'Gmail',
    github: 'GitHub',
    youtrack: 'YouTrack',
    nextcloud: 'Nextcloud',
    google: 'Google',
    docs: 'Docs',
    sheets: 'Sheets',
    slides: 'Slides',
    drive: 'Drive',
    calendar: 'Calendar',
    contacts: 'Contacts',
    keep: 'Keep',
    groups: 'Groups',
    maps: 'Maps',
    outlook: 'Outlook',
    onedrive: 'OneDrive',
    ms: 'Microsoft',
    fireflies: 'Fireflies',
    elevenlabs: 'ElevenLabs',
    linkedin: 'LinkedIn',
    signrequest: 'SignRequest',
    n8n: 'n8n',
    kb: 'Knowledge Base',
    deck: 'Deck',
    talk: 'Talk',
    tasks: 'Tasks',
    notes: 'Notes',
    mail: 'Mail',
    activity: 'Activity',
    notifications: 'Notifications',
    status: 'Status',
    tts: 'TTS',
    sfx: 'SFX',
    ai: 'AI',
    pdf: 'PDF',
};

function pretty(token) {
    if (!token) return '';
    const lower = token.toLowerCase();
    if (PROPER_CASE[lower]) return PROPER_CASE[lower];
    return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/**
 * Convert a tool name to a friendly subtitle. Splits on underscores,
 * applies proper-noun casing, joins with spaces.
 *
 *   gmail_send                  → 'Gmail Send'
 *   nextcloud_tasks_create      → 'Nextcloud Tasks Create'
 *   nextcloud_notifications_send → 'Nextcloud Notifications Send'
 *   generate_image              → 'Generate Image'
 *   elevenlabs_tts              → 'ElevenLabs TTS'
 */
export function humanizeToolName(toolName) {
    if (!toolName || typeof toolName !== 'string') return '';
    return toolName.split('_').filter(Boolean).map(pretty).join(' ');
}

/**
 * Replace `steps.<id>.output.<path>` references inside an expression
 * with a human marker `‹Step Label›.path`. Quoted strings are left
 * untouched so we don't mangle literal strings that happen to contain
 * the word `steps`.
 *
 *   steps.ai_a9afb3.output.urgentie == "hoog"
 *     →  ‹Classificeer document›.urgentie == "hoog"
 *
 * If `stepLabelById` is missing or has no entry for an id, the original
 * id is preserved so the user can still trace it.
 */
export function humanizeExpression(expr, stepLabelById = null) {
    if (!expr || typeof expr !== 'string') return '';
    return expr
        .replace(
            /steps\.([A-Za-z0-9_]+)\.output(?:\.([A-Za-z0-9_.[\]]+))?/g,
            (_, stepId, path) => {
                const label = stepLabelById?.get?.(stepId) || stepId;
                return path ? `‹${label}›.${path}` : `‹${label}›`;
            },
        )
        .replace(
            /\btrigger(?:\.([A-Za-z0-9_.[\]]+))?/g,
            (_, path) => (path ? `‹Trigger›.${path}` : '‹Trigger›'),
        );
}

/**
 * Build the lookup map the helpers above need from a definition.
 * Trigger + steps both contribute; falls back to id when a step has
 * no `label` set.
 */
export function buildStepLabelMap(def) {
    const m = new Map();
    if (!def) return m;
    const all = [def.trigger, ...(def.steps || [])].filter(Boolean);
    for (const s of all) m.set(s.id, s.label || s.id);
    return m;
}
