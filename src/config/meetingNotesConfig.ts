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
 * Ten-colour palette for speaker identity across the meeting UI (timeline
 * rows, legend, transcript dots, tooltip, speaker editor). Assigned by
 * speaking-time RANK via `buildSpeakerColorMap` in
 * `pages/meeting-notes/lib/playerData.js` — the top-ranked speaker always
 * gets the first colour, so the assignment is collision-free for the main
 * speakers and survives renames. Ranks beyond the palette all share
 * `NEUTRAL_SPEAKER_COLOR` (deliberately no modulo-cycling: that would give
 * two speakers the same colour, the exact ambiguity the rank map removes).
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

/**
 * Colour for every speaker ranked past the palette (and for unknown ids):
 * slate-400 — reads as "minor speaker", matching the grey aggregate row on
 * the timeline.
 */
export const NEUTRAL_SPEAKER_COLOR = '#94a3b8';
