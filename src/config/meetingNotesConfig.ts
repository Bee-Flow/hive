// Static config for the Meeting Notes page. Extracted from
// pages/MeetingNotesPage.jsx so the data lives next to other UI config
// (and so smaller follow-up modules can import a single canonical list
// without re-pulling the 1973-LOC page).

export interface MeetingLanguage {
    /** BCP-47 code passed to the transcription backend. */
    code: string;
    /** Display label for the upload picker. */
    label: string;
}

/**
 * Supported transcription languages, sorted by what the product surfaces
 * most prominently (Dutch first; this is a Bee Flow product convention).
 */
export const LANGUAGES: readonly MeetingLanguage[] = [
    { code: 'nl', label: '🇳🇱 Dutch' },
    { code: 'en', label: '🇬🇧 English' },
    { code: 'de', label: '🇩🇪 German' },
    { code: 'fr', label: '🇫🇷 French' },
    { code: 'es', label: '🇪🇸 Spanish' },
    { code: 'it', label: '🇮🇹 Italian' },
    { code: 'pt', label: '🇵🇹 Portuguese' },
    { code: 'pl', label: '🇵🇱 Polish' },
    { code: 'tr', label: '🇹🇷 Turkish' },
    { code: 'ja', label: '🇯🇵 Japanese' },
    { code: 'zh', label: '🇨🇳 Chinese' },
    { code: 'ko', label: '🇰🇷 Korean' },
    { code: 'ar', label: '🇸🇦 Arabic' },
    { code: 'ru', label: '🇷🇺 Russian' },
];

/**
 * Ten-colour cycle for the transcript-display speaker lanes. Stable so
 * the same speaker keeps the same colour across re-renders; the consumer
 * picks by index modulo this list's length.
 *
 * Tints are tailwind-blue / pink / amber / emerald / cyan / indigo / red
 * / orange / lime / a final indigo step. NB: indigo (#6366f1, #8b5cf6
 * neighbour) is allowed in product chrome but never in core UI accents
 * (the project ban is on purple/violet accents, not the indigo speaker
 * palette).
 */
export const SPEAKER_COLORS: readonly string[] = [
    '#3b82f6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4',
    '#8b5cf6', '#ef4444', '#f97316', '#84cc16', '#6366f1',
];
